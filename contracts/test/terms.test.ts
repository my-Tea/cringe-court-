import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  CONTENT, LEVEL, MODE, OUTCOME, STATUS, TERMS, buildTerms, usdc, deployWorld, fileSolo, openAndJoinVersus,
  publishAndFundGrandJury, fillJury, openCourt, commit, reveal, runTrial, acceptSeat, signSeatOffer, saltFor, assertConserved,
  humanIdOf, type World,
} from "./helpers";

const fx = () => deployWorld();
const fxLaunch = () => deployWorld({ pricing: "launch" });
const fxDemo = () => deployWorld({ timing: "demo" });

const GJ = MODE.GrandJury;

describe("Terms, pricing and marketing cap", () => {
  describe("quote() matches DECISIONS", () => {
    it("Solo costs 1.20", async () => {
      const w = await loadFixture(fx);
      expect(await w.court.quote(MODE.Solo, true, false)).to.equal(BigInt(TERMS.expectedCharges.solo));
      expect(await w.court.quote(MODE.Solo, true, false)).to.equal(usdc("1.20"));
    });

    it("Solo with the 0G pass costs 1.00 once the pass is enabled", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), passEnabled: true });
      expect(await w.court.quote(MODE.Solo, true, true)).to.equal(BigInt(TERMS.expectedCharges.soloWithPass));
      expect(await w.court.quote(MODE.Solo, true, true)).to.equal(usdc("1.00"));
      const before = await w.usdcToken.balanceOf(w.creator.address);
      await expect(w.court.connect(w.creator).fileSolo(CONTENT, true))
        .to.emit(w.court, "PaymentReceived")
        .withArgs(1, w.creator.address, usdc("1.00"), true);
      expect(before - (await w.usdcToken.balanceOf(w.creator.address))).to.equal(usdc("1.00"));
    });

    it("Versus costs 0.70 per side, with and without the pass", async () => {
      const w = await loadFixture(fx);
      expect(await w.court.quote(MODE.Versus, true, false)).to.equal(BigInt(TERMS.expectedCharges.versusSide));
      expect(await w.court.quote(MODE.Versus, false, false)).to.equal(BigInt(TERMS.expectedCharges.versusSide));
      expect(await w.court.quote(MODE.Versus, true, true)).to.equal(usdc("0.50"));
    });

    it("Versus charges 0.70 per side on-chain", async () => {
      const w = await loadFixture(fx);
      const [a, b] = [await w.usdcToken.balanceOf(w.creator.address), await w.usdcToken.balanceOf(w.sideB.address)];
      await openAndJoinVersus(w);
      expect(a - (await w.usdcToken.balanceOf(w.creator.address))).to.equal(usdc("0.70"));
      expect(b - (await w.usdcToken.balanceOf(w.sideB.address))).to.equal(usdc("0.70"));
    });

    it("Grand Jury hackathon target is 7.30", async () => {
      const w = await loadFixture(fx);
      expect(await w.court.quote(GJ, true, false)).to.equal(BigInt(TERMS.expectedCharges.grandJuryHackathonTarget));
      expect(await w.court.quote(GJ, true, true)).to.equal(usdc("7.30")); // pass is ignored
    });

    it("Grand Jury launch target is 7.80", async () => {
      const w = await loadFixture(fxLaunch);
      expect(await w.court.quote(GJ, false, false)).to.equal(BigInt(TERMS.expectedCharges.grandJuryLaunchTarget));
      await w.court.connect(w.curator).publishGrandJury(CONTENT, w.sponsor.address, usdc(2));
      expect((await w.court.getCase(1)).target).to.equal(usdc("7.80"));
    });
  });

  describe("Pass and mode flags", () => {
    it("the pass is disabled by default: fileSolo reverts PassDisabled", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.creator).fileSolo(CONTENT, true)).to.be.revertedWithCustomError(w.court, "PassDisabled");
    });

    it("openVersus with the pass reverts PassDisabled", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, true)).to.be.revertedWithCustomError(
        w.court,
        "PassDisabled",
      );
    });

    it("joinVersus with the pass reverts PassDisabled", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      await expect(w.court.connect(w.sideB).joinVersus(1, true)).to.be.revertedWithCustomError(w.court, "PassDisabled");
    });

    it("a pass-enabled Versus lets each side waive its AI fee independently", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Versus, { ...buildTerms(MODE.Versus), passEnabled: true });
      const id = await openAndJoinVersus(w, true, false);
      expect(await w.court.paidBy(id, w.creator.address)).to.equal(usdc("0.50"));
      expect(await w.court.paidBy(id, w.sideB.address)).to.equal(usdc("0.70"));
      expect((await w.court.getCase(id)).aiFeeHeld).to.equal(usdc("0.20"));
    });

    it("a disabled Solo mode reverts ModeDisabled(0)", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), enabled: false });
      await expect(w.court.connect(w.creator).fileSolo(CONTENT, false))
        .to.be.revertedWithCustomError(w.court, "ModeDisabled")
        .withArgs(MODE.Solo);
    });

    it("a disabled Versus mode reverts ModeDisabled(1)", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Versus, { ...buildTerms(MODE.Versus), enabled: false });
      await expect(w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false))
        .to.be.revertedWithCustomError(w.court, "ModeDisabled")
        .withArgs(MODE.Versus);
    });

    it("a disabled Grand Jury mode reverts ModeDisabled(2)", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(GJ, { ...buildTerms(GJ), enabled: false });
      await expect(w.court.connect(w.curator).publishGrandJury(CONTENT, w.sponsor.address, usdc(2)))
        .to.be.revertedWithCustomError(w.court, "ModeDisabled")
        .withArgs(GJ);
    });

    it("a mode that was never configured is disabled", async () => {
      const [admin] = await ethers.getSigners();
      const w = await loadFixture(fx);
      const court = await (await ethers.getContractFactory("CringeCourt")).deploy(
        await w.usdcToken.getAddress(), await w.registry.getAddress(), admin.address, admin.address, admin.address,
      );
      await expect(court.connect(w.creator).fileSolo(CONTENT, false)).to.be.revertedWithCustomError(court, "ModeDisabled");
    });
  });

  describe("setTerms validation", () => {
    const bad = async (mut: Record<string, unknown>, why: string, mode: 0 | 1 | 2 = MODE.Solo) => {
      const w = await loadFixture(fx);
      await expect(w.court.setTerms(mode, { ...buildTerms(mode), ...mut } as any))
        .to.be.revertedWithCustomError(w.court, "InvalidTerms")
        .withArgs(why);
    };

    it("n = 0 is invalid", () => bad({ n: 0 }, "n"));
    it("n = 11 is invalid", () => bad({ n: 11 }, "n"));
    it("bond = 0 is invalid", () => bad({ bond: 0n }, "bond"));
    it("failedTrialBonus * 2n above the bond is invalid", () => bad({ failedTrialBonus: 200001n }, "failedTrialBonus"));
    it("Grand Jury failedTrialBonus * 2n above the bond is invalid", () => bad({ failedTrialBonus: 200001n }, "failedTrialBonus", GJ));
    it("recruitWindow = 0 is invalid", () => bad({ recruitWindow: 0 }, "window"));
    it("prepWindow = 0 is invalid", () => bad({ prepWindow: 0 }, "window"));
    it("commitWindow = 0 is invalid", () => bad({ commitWindow: 0 }, "window"));
    it("revealWindow = 0 is invalid", () => bad({ revealWindow: 0 }, "window"));
    it("Solo with a pendingWindow is invalid", () => bad({ pendingWindow: 60 }, "solo"));
    it("Solo with a minContribution is invalid", () => bad({ minContribution: 1n }, "solo"));
    it("Solo with a sponsorFloor is invalid", () => bad({ sponsorFloor: 1n }, "solo"));
    it("Versus with pendingWindow 0 is invalid", () => bad({ pendingWindow: 0 }, "pendingWindow", MODE.Versus));
    it("Versus with a minContribution is invalid", () => bad({ minContribution: 1n }, "versus", MODE.Versus));
    it("Versus with a sponsorFloor is invalid", () => bad({ sponsorFloor: 1n }, "versus", MODE.Versus));
    it("Grand Jury with pendingWindow 0 is invalid", () => bad({ pendingWindow: 0 }, "pendingWindow", GJ));
    it("Grand Jury with passEnabled is invalid", () => bad({ passEnabled: true }, "pass", GJ));
    it("Grand Jury with a zero target is invalid", () =>
      bad({ successBonus: 0n, protocolFee: 0n, aiFeePerAgent: 0n, failedTrialBonus: 0n }, "target", GJ));

    it("failedTrialBonus * 2n exactly equal to the bond is valid", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), failedTrialBonus: 200000n })).to.emit(
        w.court,
        "TermsUpdated",
      );
    });

    it("valid terms are stored and returned by termsOf, and emit TermsUpdated", async () => {
      const w = await loadFixture(fx);
      const t = { ...buildTerms(MODE.Versus), bond: 500000n, pendingWindow: 7200 };
      await expect(w.court.setTerms(MODE.Versus, t)).to.emit(w.court, "TermsUpdated");
      const read = await w.court.termsOf(MODE.Versus);
      expect(read.bond).to.equal(500000n);
      expect(read.pendingWindow).to.equal(7200);
      expect(read.enabled).to.equal(true);
    });

    it("n = 10 is accepted and a 21-juror case can be created, seated and settled", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), n: 10, bond: 4_000_000n });
      const signers = await ethers.getSigners();
      const jurors = [...w.jurors, ...w.others, ...signers.slice(26, 31)];
      expect(jurors.length).to.equal(21);
      const courtAddr = await w.court.getAddress();
      const exp = (await time.latest()) + 10 * 24 * 3600;
      for (let i = 0; i < jurors.length; i++) {
        if (i >= 10) {
          await w.usdcToken.mint(jurors[i].address, usdc(1000));
          await w.usdcToken.connect(jurors[i]).approve(courtAddr, ethers.MaxUint256);
          await w.registry.connect(w.attester).attest(jurors[i].address, humanIdOf(`big${i}`), LEVEL.ORB, exp);
        }
      }
      const id = await fileSolo(w);
      const c = await w.court.getCase(id);
      expect(c.jurySize).to.equal(21);
      expect(c.poolHeld).to.equal(21n * 300000n);
      for (const j of jurors) await acceptSeat(w, id, j);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Preparing);
      await openCourt(w, id);
      // verdict threshold is 11: 11 vote Choice 1, the rest are absent
      for (const j of jurors.slice(0, 11)) await commit(w, id, j, 1);
      await time.increaseTo((await w.court.getCase(id)).commitDeadline);
      for (const j of jurors.slice(0, 11)) await reveal(w, id, j, 1);
      await time.increaseTo((await w.court.getCase(id)).revealDeadline);
      await w.court.finalize(id);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.Choice1);
      await assertConserved(w, signers.slice(26, 31).map((s) => s.address));
    });

    it("a 10 vote result is NO VERDICT with n = 10 (threshold 11)", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), n: 10, bond: 4_000_000n });
      const signers = await ethers.getSigners();
      const jurors = [...w.jurors, ...w.others, ...signers.slice(26, 31)];
      const courtAddr = await w.court.getAddress();
      const exp = (await time.latest()) + 10 * 24 * 3600;
      for (let i = 10; i < jurors.length; i++) {
        await w.usdcToken.mint(jurors[i].address, usdc(1000));
        await w.usdcToken.connect(jurors[i]).approve(courtAddr, ethers.MaxUint256);
        await w.registry.connect(w.attester).attest(jurors[i].address, humanIdOf(`big${i}`), LEVEL.ORB, exp);
      }
      const id = await fileSolo(w);
      for (const j of jurors) await acceptSeat(w, id, j);
      await openCourt(w, id);
      for (const j of jurors.slice(0, 10)) await commit(w, id, j, 0);
      await time.increaseTo((await w.court.getCase(id)).commitDeadline);
      for (const j of jurors.slice(0, 10)) await reveal(w, id, j, 0);
      await time.increaseTo((await w.court.getCase(id)).revealDeadline);
      await w.court.finalize(id);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      await assertConserved(w, signers.slice(26, 31).map((s) => s.address));
    });
  });

  describe("Terms snapshot immutability", () => {
    it("a case keeps its bond, fees, windows and settlement after Solo terms change; a new case uses the new ones", async () => {
      const w = await loadFixture(fx);
      const oldId = await fileSolo(w);
      const oldCase = await w.court.getCase(oldId);

      const newTerms = {
        ...buildTerms(MODE.Solo),
        bond: 600000n,
        successBonus: 500000n,
        protocolFee: 200000n,
        aiFeePerAgent: 300000n,
        commitWindow: 100,
        revealWindow: 100,
        recruitWindow: 999,
        prepWindow: 888,
      };
      await w.court.setTerms(MODE.Solo, newTerms);

      // old case: old snapshot
      const snap = await w.court.caseTerms(oldId);
      expect(snap.bond).to.equal(400000n);
      expect(snap.commitWindow).to.equal(1200);
      const j = w.jurors[0];
      const { expiresAt, sig } = await signSeatOffer(w, oldId, j.address);
      await expect(w.court.connect(j).acceptSeat(oldId, expiresAt, sig)).to.changeTokenBalance(w.usdcToken, j, -usdc("0.40"));
      for (const x of w.jurors.slice(1, 3)) await acceptSeat(w, oldId, x);
      const tx = await openCourt(w, oldId);
      const t = (await (await tx.wait())!.getBlock()).timestamp;
      const opened = await w.court.getCase(oldId);
      expect(opened.commitDeadline).to.equal(t + 1200);
      expect(opened.revealDeadline).to.equal(t + 1800);
      expect(oldCase.recruitDeadline).to.equal(oldCase.createdAt + 1800n);
      await runTrial(w, oldId, [0, 0, 0]);
      for (const x of w.jurors.slice(0, 3)) expect(await w.court.claimable(x.address)).to.equal(usdc("0.70"));
      expect(await w.court.claimable(w.treasury.address)).to.equal(usdc("0.10"));
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(usdc("0.20"));

      // new case: new snapshot
      const before = await w.usdcToken.balanceOf(w.creator.address);
      const newId = await fileSolo(w);
      expect(before - (await w.usdcToken.balanceOf(w.creator.address))).to.equal(usdc("2.00")); // 3*0.5 + 0.2 + 0.3
      const nt = await w.court.caseTerms(newId);
      expect(nt.bond).to.equal(600000n);
      const nc = await w.court.getCase(newId);
      expect(nc.recruitDeadline).to.equal(nc.createdAt + 999n);
      await fillJury(w, newId);
      expect((await w.court.getCase(newId)).prepDeadline).to.be.greaterThan(0);
      await openCourt(w, newId);
      const after = await w.court.getCase(newId);
      expect(after.revealDeadline - after.commitDeadline).to.equal(100n);
      await runTrial(w, newId, [1, 1, 1]);
      expect(await w.court.claimable(w.jurors[0].address)).to.equal(usdc("0.70") + usdc("1.10"));
      await assertConserved(w);
    });

    it("changing GJ terms does not affect a case already being crowdfunded", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.curator).publishGrandJury(CONTENT, w.sponsor.address, usdc(2));
      const id = await w.court.caseCount();
      await w.court.setTerms(GJ, { ...buildTerms(GJ), minContribution: 1_000_000n, protocolFee: 900000n });
      expect((await w.court.caseTerms(id)).minContribution).to.equal(100000n);
      await w.court.connect(w.others[0]).contribute(id, usdc("0.10"));
      const c = await w.court.getCase(id);
      expect(c.target).to.equal(usdc("7.30"));
    });

    it("disabling a mode does not stop an existing case from finishing", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), enabled: false });
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0]);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Finalized);
      await assertConserved(w);
    });
  });

  describe("D7 retune: Grand Jury n = 2", () => {
    const retuned = () => ({ ...buildTerms(GJ), n: 2, bond: 800000n, successBonus: 600000n });

    async function setup(w: World) {
      await w.court.setTerms(GJ, retuned());
      return publishAndFundGrandJury(w, { contributions: [usdc(1), usdc(3)] });
    }

    it("has 5 jurors, a 4.00 target, a 3.00 pool and threshold 3", async () => {
      const w = await loadFixture(fx);
      const { id } = await setup(w);
      expect(await w.court.quote(GJ, true, false)).to.equal(usdc("4.00"));
      const c = await w.court.getCase(id);
      expect(c.jurySize).to.equal(5);
      expect(c.poolHeld).to.equal(usdc("3.00"));
      expect(c.target).to.equal(usdc("4.00"));
      expect((await w.court.caseTerms(id)).bond).to.equal(usdc("0.80"));
      await fillJury(w, id);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Preparing);
    });

    it("a 3-2 vote is a verdict", async () => {
      const w = await loadFixture(fx);
      const { id } = await setup(w);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0, 1, 1]);
      const c = await w.court.getCase(id);
      expect(c.outcome).to.equal(OUTCOME.Choice0);
      for (const j of w.jurors.slice(0, 5)) expect(await w.court.claimable(j.address)).to.equal(usdc("1.40"));
      expect(await w.court.claimable(w.treasury.address)).to.equal(usdc("0.50"));
      await assertConserved(w);
    });

    it("2-2 with one juror absent is NO VERDICT and pays the failed-trial bonus", async () => {
      const w = await loadFixture(fx);
      const { id, contributors } = await setup(w);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 1, 1, "absent"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      for (const j of w.jurors.slice(0, 4)) expect(await w.court.claimable(j.address)).to.equal(usdc("1.00"));
      expect(await w.court.claimable(w.jurors[4].address)).to.equal(0);
      // forfeited 0.80 pays 4 * 0.20 exactly: nothing left for the treasury
      expect(await w.court.claimable(w.treasury.address)).to.equal(0);
      for (const c of contributors) await w.court.claimRefundFor(1, c.address);
      await assertConserved(w);
    });

    it("2-2 plus an unrevealed commit is also NO VERDICT", async () => {
      const w = await loadFixture(fx);
      const { id } = await setup(w);
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 1, 1, "committed"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      await assertConserved(w);
    });
  });

  describe("Marketing cap (D10)", () => {
    const publish = (w: World, sponsor = ethers.ZeroAddress, amount = 0n) =>
      w.court.connect(w.curator).publishGrandJury(CONTENT, sponsor, amount);

    it("hackathon pricing starts with cap 40, floor 2.00 and no usage", async () => {
      const w = await loadFixture(fx);
      expect(await w.court.marketingCap()).to.equal(40);
      expect(await w.court.marketingUsed()).to.equal(0);
      expect((await w.court.termsOf(GJ)).sponsorFloor).to.equal(usdc("2.00"));
    });

    it("an unsponsored publish consumes the marketing cap", async () => {
      const w = await loadFixture(fx);
      await publish(w);
      expect(await w.court.marketingUsed()).to.equal(1);
      expect((await w.court.getCase(1)).sponsored).to.equal(false);
    });

    it("after lowering the cap to 1 a second unsponsored publish reverts MarketingCapReached", async () => {
      const w = await loadFixture(fx);
      await publish(w);
      await w.court.setMarketingCap(1);
      await expect(publish(w)).to.be.revertedWithCustomError(w.court, "MarketingCapReached").withArgs(1);
      expect(await w.court.marketingUsed()).to.equal(1);
      expect(await w.court.caseCount()).to.equal(1);
    });

    it("the cap allows exactly `cap` unsponsored cases", async () => {
      const w = await loadFixture(fx);
      await w.court.setMarketingCap(3);
      for (let i = 0; i < 3; i++) await publish(w);
      expect(await w.court.marketingUsed()).to.equal(3);
      await expect(publish(w)).to.be.revertedWithCustomError(w.court, "MarketingCapReached").withArgs(3);
    });

    it("a sponsored case (>= 2.00) does not consume the cap, even when the cap is exhausted", async () => {
      const w = await loadFixture(fx);
      await publish(w);
      await w.court.setMarketingCap(1);
      await expect(publish(w, w.sponsor.address, usdc("2.00")))
        .to.emit(w.court, "SponsorDeposited")
        .withArgs(2, w.sponsor.address, usdc("2.00"), true);
      expect(await w.court.marketingUsed()).to.equal(1);
      const c = await w.court.getCase(2);
      expect(c.sponsored).to.equal(true);
      expect(c.sponsor).to.equal(w.sponsor.address);
      expect(c.sponsorDeposit).to.equal(usdc("2.00"));
      await assertConserved(w);
    });

    it("a sponsor deposit just below the floor counts as marketing and is flagged unsponsored", async () => {
      const w = await loadFixture(fx);
      await expect(publish(w, w.sponsor.address, usdc("1.999999")))
        .to.emit(w.court, "SponsorDeposited")
        .withArgs(1, w.sponsor.address, usdc("1.999999"), false);
      expect(await w.court.marketingUsed()).to.equal(1);
      expect((await w.court.getCase(1)).sponsored).to.equal(false);
      await assertConserved(w);
    });

    it("launch pricing (cap 0): an unsponsored publish reverts SponsorRequired(2.00)", async () => {
      const w = await loadFixture(fxLaunch);
      expect(await w.court.marketingCap()).to.equal(0);
      await expect(publish(w)).to.be.revertedWithCustomError(w.court, "SponsorRequired").withArgs(usdc("2.00"));
    });

    it("launch pricing: a below-floor sponsor still reverts SponsorRequired, a qualifying one works", async () => {
      const w = await loadFixture(fxLaunch);
      await expect(publish(w, w.sponsor.address, usdc("1.50"))).to.be.revertedWithCustomError(w.court, "SponsorRequired");
      await publish(w, w.sponsor.address, usdc("2.00"));
      expect(await w.court.marketingUsed()).to.equal(0);
      expect((await w.court.getCase(1)).sponsored).to.equal(true);
    });

    it("sponsorAmount > 0 with the zero address as sponsor reverts ZeroAddress", async () => {
      const w = await loadFixture(fx);
      await expect(publish(w, ethers.ZeroAddress, usdc("2.00"))).to.be.revertedWithCustomError(w.court, "ZeroAddress");
    });

    it("a sponsor that has not approved the court makes the publish revert", async () => {
      const w = await loadFixture(fx);
      await w.usdcToken.connect(w.sponsor).approve(await w.court.getAddress(), 0);
      await expect(publish(w, w.sponsor.address, usdc("2.00"))).to.be.reverted;
      expect(await w.court.caseCount()).to.equal(0);
    });

    it("a sponsor deposit is pulled from the sponsor at publish time", async () => {
      const w = await loadFixture(fx);
      await expect(publish(w, w.sponsor.address, usdc("3.00"))).to.changeTokenBalances(
        w.usdcToken,
        [w.sponsor, w.court],
        [-usdc("3.00"), usdc("3.00")],
      );
    });
  });

  describe("demoTiming flag", () => {
    it("round-trips through caseTerms and the windows follow the demo profile", async () => {
      const w = await loadFixture(fxDemo);
      const id = await fileSolo(w);
      const t = await w.court.caseTerms(id);
      expect(t.demoTiming).to.equal(true);
      expect(t.recruitWindow).to.equal(TERMS.timing.demo.recruitWindow);
      expect(t.commitWindow).to.equal(TERMS.timing.demo.commitWindow);
      expect(t.revealWindow).to.equal(TERMS.timing.demo.revealWindow);
    });

    it("production timing has demoTiming false, and a case keeps its flag when the mode flips later", async () => {
      const w = await loadFixture(fx);
      const first = await fileSolo(w);
      expect((await w.court.caseTerms(first)).demoTiming).to.equal(false);
      await w.court.setTerms(MODE.Solo, buildTerms(MODE.Solo, "demo"));
      const second = await fileSolo(w);
      expect((await w.court.caseTerms(second)).demoTiming).to.equal(true);
      expect((await w.court.caseTerms(first)).demoTiming).to.equal(false);
      expect((await w.court.getCase(second)).recruitDeadline).to.equal((await w.court.getCase(second)).createdAt + 300n);
    });

    it("demo windows drive the deadlines of a full demo trial", async () => {
      const w = await loadFixture(fxDemo);
      const id = await fileSolo(w);
      await fillJury(w, id);
      const tx = await openCourt(w, id);
      const t = (await (await tx.wait())!.getBlock()).timestamp;
      const c = await w.court.getCase(id);
      expect(c.commitDeadline).to.equal(t + 120);
      expect(c.revealDeadline).to.equal(t + 240);
      void saltFor;
      await runTrial(w, id, [0, 0, 1]);
      await assertConserved(w);
    });
  });
});
