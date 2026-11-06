import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  CONTENT, MODE, OUTCOME, STATUS, buildTerms, usdc, deployWorld, fileSolo, fillJury, openCourt, runTrial,
  assertConserved, publishAndFundGrandJury, type Attendance, type World,
} from "./helpers";

const fx = () => deployWorld();
const GJ = MODE.GrandJury;

/** Withdraws every claimable balance and refund, then checks the court holds exactly the reserve. */
async function drain(w: World) {
  const accounts = [w.treasury, w.aiTreasury, w.sponsor, w.creator, w.sideB, ...w.jurors, ...w.others];
  const count = await w.court.caseCount();
  for (let id = 1n; id <= count; id++) {
    if (!(await w.court.isRefundable(id))) continue;
    for (const a of accounts) {
      if ((await w.court.paidBy(id, a.address)) > 0n) await w.court.claimRefundFor(id, a.address);
    }
  }
  for (const a of accounts) {
    if ((await w.court.claimable(a.address)) > 0n) await w.court.connect(a).withdraw();
  }
  expect(await w.usdcToken.balanceOf(await w.court.getAddress())).to.equal(await w.court.reserveBalance());
  expect(await w.court.reserveLocked()).to.equal(0);
}

describe("Rounding and base-unit edge cases", () => {
  describe("Versus with odd base units", () => {
    const variants = [
      { name: "odd protocol fee only", fee: 100001n, bonus: 300000n, diff: 1n },
      { name: "odd success bonus only (odd pool)", fee: 100000n, bonus: 300001n, diff: 1n },
      { name: "odd protocol fee and odd success bonus", fee: 100001n, bonus: 300001n, diff: 2n },
    ];

    for (const v of variants) {
      const versusTerms = () => ({ ...buildTerms(MODE.Versus), protocolFee: v.fee, successBonus: v.bonus });
      const pool = 3n * v.bonus;

      it(`${v.name}: Side A pays the extra unit(s) and the sides sum to pool + fee + 2 AI fees`, async () => {
        const w = await loadFixture(fx);
        await w.court.setTerms(MODE.Versus, versusTerms());
        const qa = await w.court.quote(MODE.Versus, true, false);
        const qb = await w.court.quote(MODE.Versus, false, false);
        expect(qa - qb).to.equal(v.diff);
        expect(qa + qb).to.equal(pool + v.fee + 2n * 200000n);

        const [ba, bb] = [await w.usdcToken.balanceOf(w.creator.address), await w.usdcToken.balanceOf(w.sideB.address)];
        await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
        await w.court.connect(w.sideB).joinVersus(1, false);
        expect(ba - (await w.usdcToken.balanceOf(w.creator.address))).to.equal(qa);
        expect(bb - (await w.usdcToken.balanceOf(w.sideB.address))).to.equal(qb);
        const c = await w.court.getCase(1);
        expect(c.target).to.equal(qa + qb);
        expect(c.raised).to.equal(qa + qb);
        expect(c.poolHeld).to.equal(pool);
        expect(c.protocolFeeHeld).to.equal(v.fee);
        expect(c.aiFeeHeld).to.equal(400000n);
        await assertConserved(w);
      });

      it(`${v.name}: a verdict settles exactly and every unit is withdrawable`, async () => {
        const w = await loadFixture(fx);
        await w.court.setTerms(MODE.Versus, versusTerms());
        await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
        await w.court.connect(w.sideB).joinVersus(1, false);
        await fillJury(w, 1n);
        await openCourt(w, 1n);
        await runTrial(w, 1n, [0, 0, 1]);
        const c = await w.court.getCase(1);
        expect(c.outcome).to.equal(OUTCOME.Choice0);
        for (const j of w.jurors.slice(0, 3)) expect(await w.court.claimable(j.address)).to.equal(400000n + v.bonus);
        expect(await w.court.claimable(w.treasury.address)).to.equal(v.fee);
        expect(await w.court.claimable(w.aiTreasury.address)).to.equal(400000n);
        await assertConserved(w);
        await drain(w);
      });

      it(`${v.name}: a verdict with an absent juror sends the unearned odd bonus to the treasury`, async () => {
        const w = await loadFixture(fx);
        await w.court.setTerms(MODE.Versus, versusTerms());
        await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
        await w.court.connect(w.sideB).joinVersus(1, false);
        await fillJury(w, 1n);
        await openCourt(w, 1n);
        await runTrial(w, 1n, [0, 0, "absent"]);
        expect(await w.court.claimable(w.treasury.address)).to.equal(400000n + v.bonus + v.fee);
        await assertConserved(w);
        await drain(w);
      });

      it(`${v.name}: NO VERDICT refunds each side exactly what it paid`, async () => {
        const w = await loadFixture(fx);
        await w.court.setTerms(MODE.Versus, versusTerms());
        const qa = await w.court.quote(MODE.Versus, true, false);
        const qb = await w.court.quote(MODE.Versus, false, false);
        await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
        await w.court.connect(w.sideB).joinVersus(1, false);
        await fillJury(w, 1n);
        await openCourt(w, 1n);
        await runTrial(w, 1n, [0, 1, "absent"]);
        expect((await w.court.getCase(1)).outcome).to.equal(OUTCOME.NoVerdict);
        await expect(w.court.claimRefundFor(1, w.creator.address)).to.changeTokenBalance(w.usdcToken, w.creator, qa);
        await expect(w.court.claimRefundFor(1, w.sideB.address)).to.changeTokenBalance(w.usdcToken, w.sideB, qb);
        await assertConserved(w);
        await drain(w);
      });

      it(`${v.name}: withdrawing the invite refunds Side A's odd amount exactly`, async () => {
        const w = await loadFixture(fx);
        await w.court.setTerms(MODE.Versus, versusTerms());
        const qa = await w.court.quote(MODE.Versus, true, false);
        await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
        await w.court.connect(w.creator).withdrawInvite(1);
        await expect(w.court.connect(w.creator).claimRefund(1)).to.changeTokenBalance(w.usdcToken, w.creator, qa);
        await assertConserved(w);
        await drain(w);
      });
    }
  });

  describe("Solo with 1-unit amounts", () => {
    const tiny = () => ({
      ...buildTerms(MODE.Solo),
      bond: 2n,
      failedTrialBonus: 1n,
      successBonus: 1n,
      protocolFee: 1n,
      aiFeePerAgent: 1n,
      incidentStipend: 1n,
    });

    async function run(w: World, attendance: Attendance[]) {
      await w.court.setTerms(MODE.Solo, tiny());
      const id = await fileSolo(w);
      expect((await w.court.getCase(id)).target).to.equal(5n); // 3 + 1 + 1
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, attendance);
      return id;
    }

    it("verdict 3-0: each juror gets 2 + 1, treasury 1, AI 1", async () => {
      const w = await loadFixture(fx);
      await run(w, [0, 0, 0]);
      for (const j of w.jurors.slice(0, 3)) expect(await w.court.claimable(j.address)).to.equal(3n);
      expect(await w.court.claimable(w.treasury.address)).to.equal(1n);
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(1n);
      await assertConserved(w);
      await drain(w);
    });

    it("verdict with one absent juror: treasury gets forfeited bond + unearned bonus + fee", async () => {
      const w = await loadFixture(fx);
      await run(w, [0, 0, "absent"]);
      expect(await w.court.claimable(w.treasury.address)).to.equal(2n + 1n + 1n);
      await assertConserved(w);
      await drain(w);
    });

    it("NO VERDICT 1-1 + absent: timely jurors get 2 + 1, treasury gets 0, creator refunded 5", async () => {
      const w = await loadFixture(fx);
      const id = await run(w, [0, 1, "absent"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      expect(await w.court.claimable(w.jurors[0].address)).to.equal(3n);
      expect(await w.court.claimable(w.jurors[2].address)).to.equal(0n);
      expect(await w.court.claimable(w.treasury.address)).to.equal(0n);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.creator, 5n);
      await assertConserved(w);
      await drain(w);
    });

    it("everyone absent: the whole pool and all bonds go to the protocol", async () => {
      const w = await loadFixture(fx);
      const id = await run(w, ["absent", "absent", "absent"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      expect(await w.court.claimable(w.treasury.address)).to.equal(6n); // 3 absent bonds
      await w.court.claimRefundFor(id, w.creator.address);
      await assertConserved(w);
      await drain(w);
    });

    it("a protective cancel pays 1-unit stipends from the reserve and conserves", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, tiny());
      const id = await fileSolo(w);
      await fillJury(w, id);
      await openCourt(w, id);
      expect(await w.court.reserveLocked()).to.equal(3n);
      await w.court.connect(w.operator).protectiveCancel(id);
      expect(await w.court.reserveLocked()).to.equal(0n);
      await assertConserved(w);
      await drain(w);
    });
  });

  describe("Grand Jury awkward contributions", () => {
    it("partial contributions of awkward sizes are refunded to the base unit when funding expires", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.curator).publishGrandJury(CONTENT, ethers.ZeroAddress, 0);
      const amounts = [1234567n, 100001n, 3999999n];
      for (let i = 0; i < amounts.length; i++) await w.court.connect(w.others[i]).contribute(1, amounts[i]);
      await w.court.connect(w.operator).protectiveCancel(1);
      for (let i = 0; i < amounts.length; i++) {
        await expect(w.court.connect(w.others[i]).claimRefund(1)).to.changeTokenBalance(w.usdcToken, w.others[i], amounts[i]);
      }
      await assertConserved(w);
      await drain(w);
    });

    it("a repeated contributor's amounts accumulate and refund as one exact sum", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.curator).publishGrandJury(CONTENT, ethers.ZeroAddress, 0);
      await w.court.connect(w.others[0]).contribute(1, 123457n);
      await w.court.connect(w.others[0]).contribute(1, 234567n);
      await w.court.connect(w.others[0]).contribute(1, 100001n);
      expect(await w.court.paidBy(1, w.others[0].address)).to.equal(458025n);
      await w.court.connect(w.operator).protectiveCancel(1);
      await expect(w.court.connect(w.others[0]).claimRefund(1)).to.changeTokenBalance(w.usdcToken, w.others[0], 458025n);
      await assertConserved(w);
    });

    it("a fully funded case with an awkward remainder refunds exactly after a NO VERDICT", async () => {
      const w = await loadFixture(fx);
      const target = usdc("7.30");
      const first = 1234567n;
      const second = 2000001n;
      const { id, contributors } = await publishAndFundGrandJury(w, {
        contributions: [first, second, target - first - second],
      });
      const c = await w.court.getCase(id);
      expect(c.raised).to.equal(target);
      expect(c.status).to.equal(STATUS.Recruiting);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0, 1, 1, 1, "absent"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      const paid = [first, second, target - first - second];
      for (let i = 0; i < 3; i++) {
        await expect(w.court.claimRefundFor(id, contributors[i].address)).to.changeTokenBalance(
          w.usdcToken, contributors[i], paid[i],
        );
      }
      await assertConserved(w);
      await drain(w);
    });

    it("an oversized final contribution takes only the awkward remainder and the verdict conserves", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.curator).publishGrandJury(CONTENT, ethers.ZeroAddress, 0);
      await w.court.connect(w.others[0]).contribute(1, 1234567n);
      expect(await w.court.connect(w.others[1]).contribute.staticCall(1, usdc(900))).to.equal(usdc("7.30") - 1234567n);
      await w.court.connect(w.others[1]).contribute(1, usdc(900));
      expect(await w.court.paidBy(1, w.others[1].address)).to.equal(usdc("7.30") - 1234567n);
      await fillJury(w, 1n);
      await openCourt(w, 1n);
      await runTrial(w, 1n, [0, 0, 0, 0, 0, 0, 0]);
      expect((await w.court.getCase(1)).outcome).to.equal(OUTCOME.Choice0);
      await assertConserved(w);
      await drain(w);
    });
  });

  describe("Coverage edge: failedTrialBonus * 2n == bond", () => {
    it("Grand Jury default terms: 6 timely jurors split 3-3 leave the treasury exactly 0", async () => {
      const w = await loadFixture(fx);
      const t = await w.court.termsOf(GJ);
      expect(t.failedTrialBonus * 2n * BigInt(t.n)).to.equal(t.bond); // 0.20 * 6 = 1.20
      const { id } = await publishAndFundGrandJury(w);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0, 1, 1, 1, "absent"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      expect(await w.court.claimable(w.treasury.address)).to.equal(0n);
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(0n);
      for (const j of w.jurors.slice(0, 6)) expect(await w.court.claimable(j.address)).to.equal(usdc("1.40"));
      expect(await w.court.claimable(w.jurors[6].address)).to.equal(0n);
      await assertConserved(w);
      await drain(w);
    });

    it("with a sponsor the treasury receives exactly the sponsor deposit", async () => {
      const w = await loadFixture(fx);
      const { id } = await publishAndFundGrandJury(w, { sponsorAmount: usdc("2.50") });
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0, 1, 1, 1, "absent"]);
      expect(await w.court.claimable(w.treasury.address)).to.equal(usdc("2.50"));
      await assertConserved(w);
      await drain(w);
    });

    it("Solo and Versus defaults sit on the same edge: 2 timely jurors on NO VERDICT leave the treasury 0", async () => {
      const w = await loadFixture(fx);
      const t = await w.court.termsOf(MODE.Solo);
      expect(t.failedTrialBonus * 2n * BigInt(t.n)).to.equal(t.bond);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 1, "absent"]);
      expect(await w.court.claimable(w.treasury.address)).to.equal(0n);
      await assertConserved(w);
      await drain(w);
    });

    it("a NO VERDICT with more than one absent juror leaves a positive surplus for the treasury", async () => {
      const w = await loadFixture(fx);
      const { id } = await publishAndFundGrandJury(w);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0, 1, 1, "absent", "absent"]);
      // 2 absent bonds (2.40) - 5 timely * 0.20
      expect(await w.court.claimable(w.treasury.address)).to.equal(usdc("1.40"));
      await assertConserved(w);
      await drain(w);
    });
  });
});
