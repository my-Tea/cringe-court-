import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import scenarios from "./fixtures/settlement-scenarios.json";
import {
  MODE, OUTCOME, STATUS, buildTerms, usdc, deployWorld, fileSolo, openAndJoinVersus, publishAndFundGrandJury,
  fillJury, openCourt, runTrial, assertConserved, type Attendance, type World,
} from "./helpers";

type Scenario = (typeof scenarios.scenarios)[number] & {
  pricing?: "hackathon" | "launch";
  passEnabled?: boolean;
  passA?: boolean;
  passB?: boolean;
  sponsor?: string;
  charges?: Record<string, string>;
};

const worlds = {
  hackathon: () => deployWorld({ pricing: "hackathon" }),
  launch: () => deployWorld({ pricing: "launch" }),
};

describe("Settlement oracle (V4 §9 and ECONOMICS tables)", () => {
  for (const raw of scenarios.scenarios) {
    const s = raw as Scenario;
    it(s.name, async () => {
      const w: World = await loadFixture(s.pricing === "launch" ? worlds.launch : worlds.hackathon);
      const before = async (a: string) => w.usdcToken.balanceOf(a);

      if (s.passEnabled) {
        const m = s.mode === "solo" ? MODE.Solo : MODE.Versus;
        await w.court.setTerms(m, { ...buildTerms(m), passEnabled: true });
      }

      let id: bigint;
      let payers: { label: string; address: string }[] = [];
      if (s.mode === "solo") {
        const b = await before(w.creator.address);
        id = await fileSolo(w, !!s.passA);
        if (s.charges?.creator) expect(b - (await before(w.creator.address))).to.equal(usdc(s.charges.creator));
        payers = [{ label: "creator", address: w.creator.address }];
      } else if (s.mode === "versus") {
        const [ba, bb] = [await before(w.creator.address), await before(w.sideB.address)];
        id = await openAndJoinVersus(w, !!s.passA, !!s.passB);
        if (s.charges?.sideA) expect(ba - (await before(w.creator.address))).to.equal(usdc(s.charges.sideA));
        if (s.charges?.sideB) expect(bb - (await before(w.sideB.address))).to.equal(usdc(s.charges.sideB));
        payers = [
          { label: "sideA", address: w.creator.address },
          { label: "sideB", address: w.sideB.address },
        ];
      } else {
        const gj = await publishAndFundGrandJury(w, { sponsorAmount: s.sponsor ? usdc(s.sponsor) : 0n });
        id = gj.id;
        const c = await w.court.getCase(id);
        if (s.charges?.target) expect(c.target).to.equal(usdc(s.charges.target));
        payers = gj.contributors.map((c) => ({ label: "contributors", address: c.address }));
      }

      const jurorBalances = await Promise.all(w.jurors.map((j) => before(j.address)));
      await fillJury(w, id);
      await openCourt(w, id);
      const { jurors, tx } = await runTrial(w, id, s.attendance as Attendance[]);

      const c = await w.court.getCase(id);
      expect(c.status).to.equal(STATUS.Finalized);
      expect(c.outcome).to.equal(OUTCOME[s.outcome as keyof typeof OUTCOME]);
      await expect(tx).to.emit(w.court, "CaseFinalized");

      // jurors: timely get bond + bonus, absent get nothing
      const payout = usdc(s.payoutPerTimelyJuror);
      for (let i = 0; i < jurors.length; i++) {
        const timely = s.attendance[i] === 0 || s.attendance[i] === 1;
        expect(await w.court.claimable(jurors[i].address)).to.equal(timely ? payout : 0n, `juror ${i}`);
      }
      expect(await w.court.claimable(w.treasury.address)).to.equal(usdc(s.toTreasury), "treasury");
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(usdc(s.toAiTreasury), "ai treasury");
      expect(await w.court.claimable(w.sponsor.address)).to.equal(0n, "sponsor fee is never refunded once the trial ran");
      await assertConserved(w);

      // refunds per payer label
      const refundTotals: Record<string, bigint> = {};
      for (const p of payers) {
        const refundable = await w.court.isRefundable(id);
        if (!refundable) {
          await expect(w.court.claimRefundFor(id, p.address)).to.be.revertedWithCustomError(w.court, "NotRefundable");
          refundTotals[p.label] = (refundTotals[p.label] ?? 0n) + 0n;
          continue;
        }
        const b = await before(p.address);
        await w.court.claimRefundFor(id, p.address);
        refundTotals[p.label] = (refundTotals[p.label] ?? 0n) + ((await before(p.address)) - b);
      }
      for (const [label, amount] of Object.entries(s.refunds)) {
        if (label === "sponsor") continue;
        expect(refundTotals[label] ?? 0n).to.equal(usdc(amount), `refund ${label}`);
      }

      // everyone withdraws; jurors' net matches payout - bond
      const bond = (await w.court.caseTerms(id)).bond;
      for (let i = 0; i < jurors.length; i++) {
        if ((await w.court.claimable(jurors[i].address)) > 0n) await w.court.connect(jurors[i]).withdraw();
        const net = (await before(jurors[i].address)) - jurorBalances[i];
        const timely = s.attendance[i] === 0 || s.attendance[i] === 1;
        expect(net).to.equal(timely ? payout - bond : -bond);
      }
      for (const acct of [w.treasury, w.aiTreasury]) {
        if ((await w.court.claimable(acct.address)) > 0n) await w.court.connect(acct).withdraw();
      }
      // only the reserve is left once everyone has been paid
      expect(await w.usdcToken.balanceOf(await w.court.getAddress())).to.equal(await w.court.reserveBalance());
      expect(await w.court.reserveLocked()).to.equal(0n);
      void ethers;
    });
  }
});
