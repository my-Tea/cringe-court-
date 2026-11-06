import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CANCEL, OUTCOME, PHASE, STATUS, TRANSCRIPT, usdc, deployWorld, fileSolo, openAndJoinVersus,
  publishAndFundGrandJury, fillJury, openCourt, commit, reveal, runTrial, acceptSeat, saltFor, assertConserved,
  CONTENT, type World,
} from "./helpers";

const fx = () => deployWorld();
const fxNoReserve = () => deployWorld({ reserve: 0n });
const fxSmallReserve = () => deployWorld({ reserve: usdc(1) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ethers tx/promise union in tests
async function blockTime(txp: Promise<any> | any): Promise<number> {
  const tx = await txp;
  const r = await tx.wait();
  return (await r.getBlock()).timestamp;
}

/** Solo case with a full jury and an open court. */
async function openSolo(w: World) {
  const id = await fileSolo(w);
  const jurors = await fillJury(w, id);
  await openCourt(w, id);
  return { id, jurors, c: await w.court.getCase(id) };
}

async function bal(w: World, a: string) {
  return w.usdcToken.balanceOf(a);
}

/** Withdraws every claimable balance and every refund; afterwards the court holds only the reserve. */
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
}

describe("Lifecycle: phases, events and boundaries", () => {
  describe("Solo happy path", () => {
    it("walks Recruiting -> Preparing -> Commit -> Reveal -> Finalizable -> Finalized with the right phases and events", async () => {
      const w = await loadFixture(fx);
      const t = w.court.connect(w.creator);

      const fileTx = await t.fileSolo(CONTENT, false);
      const filedAt = await blockTime(fileTx);
      const id = await w.court.caseCount();
      await expect(fileTx).to.emit(w.court, "RecruitmentOpened").withArgs(id, filedAt + 1800);
      let c = await w.court.getCase(id);
      expect(c.status).to.equal(STATUS.Recruiting);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Recruiting);

      const seated = w.jurors.slice(0, 3);
      for (let i = 0; i < 3; i++) {
        const tx = await acceptSeat(w, id, seated[i]);
        await expect(tx).to.emit(w.court, "SeatAccepted").withArgs(id, seated[i].address, i);
        if (i < 2) expect(await w.court.phaseOf(id)).to.equal(PHASE.Recruiting);
        else {
          const at = await blockTime(tx);
          await expect(tx).to.emit(w.court, "JuryFilled").withArgs(id, at + 3600);
        }
      }
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Preparing);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Preparing);

      const openTx = await openCourt(w, id);
      const openedAt = await blockTime(openTx);
      await expect(openTx)
        .to.emit(w.court, "CourtOpened")
        .withArgs(id, TRANSCRIPT, openedAt + 1200, openedAt + 1200 + 600);
      c = await w.court.getCase(id);
      expect(c.status).to.equal(STATUS.Voting);
      expect(c.transcriptHash).to.equal(TRANSCRIPT);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Commit);

      for (const j of seated) {
        await expect(commit(w, id, j, 0)).to.emit(w.court, "VoteCommitted").withArgs(id, j.address);
      }
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Reveal); // all committed: reveal opened early

      for (let i = 0; i < 3; i++) {
        await expect(reveal(w, id, seated[i], 0)).to.emit(w.court, "VoteRevealed").withArgs(id, seated[i].address, 0);
      }
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Finalizable);

      await expect(w.court.finalize(id)).to.emit(w.court, "CaseFinalized");
      c = await w.court.getCase(id);
      expect(c.status).to.equal(STATUS.Finalized);
      expect(c.outcome).to.equal(OUTCOME.Choice0);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Finalized);
      await assertConserved(w);
    });

    it("reveal opens at the commit deadline when not everyone committed (phase Commit then Reveal then Finalizable)", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      await commit(w, id, jurors[0], 1);
      await commit(w, id, jurors[1], 1);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Commit);
      await time.increaseTo(Number(c.commitDeadline) + 5);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Reveal);
      await time.increaseTo(Number(c.revealDeadline) + 5);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Finalizable);
    });

    it("phases are Expired once a recruiting or preparing deadline passes and Cancelled after cancelExpired", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const c = await w.court.getCase(id);
      await time.increaseTo(Number(c.recruitDeadline) + 5);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Expired);
      await w.court.cancelExpired(id);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Cancelled);
      expect(await w.court.phaseOf(999)).to.equal(PHASE.None);
    });
  });

  describe("Early reveal and early finalize", () => {
    it("when every juror committed early, reveal opens at once, commitVote reverts CommitClosed and the reveal deadline is unchanged", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      const after = await w.court.getCase(id);
      expect(after.revealDeadline).to.equal(c.revealDeadline);
      expect(after.commitDeadline).to.equal(c.commitDeadline);
      expect(BigInt(await time.latest())).to.be.lessThan(c.commitDeadline);
      await reveal(w, id, jurors[0], 0); // not RevealNotOpen
      await expect(commit(w, id, jurors[1], 1)).to.be.revertedWithCustomError(w.court, "CommitClosed");
      expect((await w.court.getCase(id)).revealDeadline).to.equal(c.revealDeadline);
    });

    it("finalize is allowed immediately once all revealed, and reverts NotFinalizable before the last reveal", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await reveal(w, id, jurors[0], 0);
      await reveal(w, id, jurors[1], 0);
      await expect(w.court.finalize(id)).to.be.revertedWithCustomError(w.court, "NotFinalizable");
      await reveal(w, id, jurors[2], 0);
      await w.court.finalize(id);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Finalized);
      await assertConserved(w);
    });

    it("partial reveals stay NotFinalizable until the reveal deadline, then finalize works", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await reveal(w, id, jurors[0], 0);
      await reveal(w, id, jurors[1], 0);
      await time.increaseTo(Number(c.revealDeadline) - 30);
      await expect(w.court.finalize(id)).to.be.revertedWithCustomError(w.court, "NotFinalizable");
      await time.increaseTo(c.revealDeadline);
      await w.court.finalize(id);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.Choice0);
      await assertConserved(w);
    });

    it("exact boundary: one second before the reveal deadline is not finalizable, at the deadline it is", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await reveal(w, id, jurors[0], 0);
      await time.setNextBlockTimestamp(Number(c.revealDeadline) - 1);
      await expect(w.court.finalize(id)).to.be.revertedWithCustomError(w.court, "NotFinalizable");
      await time.setNextBlockTimestamp(Number(c.revealDeadline));
      await expect(w.court.finalize(id)).to.emit(w.court, "CaseFinalized");
      await assertConserved(w);
    });

    it("finalize on a case that is not in Voting reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(w.court.finalize(id))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Recruiting);
    });

    it("finalizing twice reverts WrongStatus(Finalized)", async () => {
      const w = await loadFixture(fx);
      const { id } = await openSolo(w);
      await runTrial(w, id, [0, 0, 0]);
      await expect(w.court.finalize(id)).to.be.revertedWithCustomError(w.court, "WrongStatus").withArgs(STATUS.Finalized);
    });
  });

  describe("Commit and reveal boundaries", () => {
    it("commit at commitDeadline-1 is accepted, at commitDeadline it reverts CommitClosed", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      await time.setNextBlockTimestamp(Number(c.commitDeadline) - 1);
      await commit(w, id, jurors[0], 0);
      await time.setNextBlockTimestamp(Number(c.commitDeadline));
      await expect(commit(w, id, jurors[1], 0)).to.be.revertedWithCustomError(w.court, "CommitClosed");
    });

    it("reveal before the commit deadline (not everyone committed) reverts RevealNotOpen", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      await commit(w, id, jurors[1], 0);
      await expect(reveal(w, id, jurors[0], 0)).to.be.revertedWithCustomError(w.court, "RevealNotOpen");
    });

    it("reveal at the commit deadline is accepted", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      await time.setNextBlockTimestamp(Number(c.commitDeadline));
      await reveal(w, id, jurors[0], 0);
      expect((await w.court.getCase(id)).revealed).to.equal(1);
    });

    it("reveal at the reveal deadline reverts RevealNotOpen, one second earlier it works", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      await commit(w, id, jurors[1], 0);
      await time.setNextBlockTimestamp(Number(c.revealDeadline) - 1);
      await reveal(w, id, jurors[0], 0);
      await time.setNextBlockTimestamp(Number(c.revealDeadline));
      await expect(reveal(w, id, jurors[1], 0)).to.be.revertedWithCustomError(w.court, "RevealNotOpen");
    });

    it("commitVote and revealVote revert WrongStatus outside Voting", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(commit(w, id, w.jurors[0], 0)).to.be.revertedWithCustomError(w.court, "WrongStatus");
      await expect(reveal(w, id, w.jurors[0], 0)).to.be.revertedWithCustomError(w.court, "WrongStatus");
    });

    it("re-committing replaces the commitment without changing the committed count", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      expect((await w.court.getCase(id)).committed).to.equal(1);
      const newSalt = ethers.id("fresh salt");
      const c2 = await w.court.commitmentOf(id, jurors[0].address, 1, newSalt);
      await expect(w.court.connect(jurors[0]).commitVote(id, c2)).to.emit(w.court, "VoteCommitted");
      expect((await w.court.getCase(id)).committed).to.equal(1);
      expect((await w.court.jurorOf(id, jurors[0].address)).commitment).to.equal(c2);
      await commit(w, id, jurors[1], 0);
      await commit(w, id, jurors[2], 0);
      // old salt + old choice no longer matches
      await expect(reveal(w, id, jurors[0], 0)).to.be.revertedWithCustomError(w.court, "CommitmentMismatch");
      await w.court.connect(jurors[0]).revealVote(id, 1, newSalt);
      expect((await w.court.getCase(id)).votes1).to.equal(1);
    });

    it("revealing with the old salt after re-commit with the same choice also fails", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      const newSalt = ethers.id("another");
      await w.court
        .connect(jurors[0])
        .commitVote(id, await w.court.commitmentOf(id, jurors[0].address, 0, newSalt));
      await commit(w, id, jurors[1], 0);
      await commit(w, id, jurors[2], 0);
      // commit() helper re-used jurors[1]/[2] fine; now old salt for jurors[0]
      await expect(reveal(w, id, jurors[0], 0)).to.be.revertedWithCustomError(w.court, "CommitmentMismatch");
      await w.court.connect(jurors[0]).revealVote(id, 0, newSalt);
    });
  });

  describe("Reveal and commit errors", () => {
    it("wrong choice reverts CommitmentMismatch", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await expect(reveal(w, id, jurors[0], 1)).to.be.revertedWithCustomError(w.court, "CommitmentMismatch");
    });

    it("wrong salt reverts CommitmentMismatch", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await expect(w.court.connect(jurors[0]).revealVote(id, 0, ethers.id("nope"))).to.be.revertedWithCustomError(
        w.court,
        "CommitmentMismatch",
      );
    });

    it("choice 2 reverts InvalidChoice", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await expect(w.court.connect(jurors[0]).revealVote(id, 2, saltFor(jurors[0].address, id))).to.be.revertedWithCustomError(
        w.court,
        "InvalidChoice",
      );
    });

    it("double reveal reverts AlreadyRevealed", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await reveal(w, id, jurors[0], 0);
      await expect(reveal(w, id, jurors[0], 0)).to.be.revertedWithCustomError(w.court, "AlreadyRevealed");
      expect((await w.court.getCase(id)).revealed).to.equal(1);
    });

    it("reveal without a commitment reverts NoCommitment", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      await commit(w, id, jurors[2], 0);
      await time.increaseTo(c.commitDeadline);
      await expect(reveal(w, id, jurors[1], 0)).to.be.revertedWithCustomError(w.court, "NoCommitment");
    });

    it("a non-juror cannot commit or reveal (NotJuror)", async () => {
      const w = await loadFixture(fx);
      const { id } = await openSolo(w);
      const outsider = w.jurors[5];
      await expect(commit(w, id, outsider, 0)).to.be.revertedWithCustomError(w.court, "NotJuror");
      await expect(reveal(w, id, outsider, 0)).to.be.revertedWithCustomError(w.court, "NotJuror");
    });

    it("a zero commitment reverts ZeroValue", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      await expect(w.court.connect(jurors[0]).commitVote(id, ethers.ZeroHash)).to.be.revertedWithCustomError(
        w.court,
        "ZeroValue",
      );
    });

    it("a commitment copied from another juror cannot be revealed by the copier (it binds the juror address)", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      const copied = await w.court.commitmentOf(id, jurors[0].address, 0, saltFor(jurors[0].address, id));
      await w.court.connect(jurors[0]).commitVote(id, copied);
      await w.court.connect(jurors[1]).commitVote(id, copied);
      await commit(w, id, jurors[2], 0);
      // copier knows choice and salt (e.g. observed after reveal) but the commitment still does not match
      await expect(
        w.court.connect(jurors[1]).revealVote(id, 0, saltFor(jurors[0].address, id)),
      ).to.be.revertedWithCustomError(w.court, "CommitmentMismatch");
      await reveal(w, id, jurors[0], 0);
    });

    it("commitmentOf binds the case id and the juror", async () => {
      const w = await loadFixture(fx);
      const salt = ethers.id("s");
      const a = await w.court.commitmentOf(1, w.jurors[0].address, 0, salt);
      expect(a).to.not.equal(await w.court.commitmentOf(2, w.jurors[0].address, 0, salt));
      expect(a).to.not.equal(await w.court.commitmentOf(1, w.jurors[1].address, 0, salt));
      expect(a).to.not.equal(await w.court.commitmentOf(1, w.jurors[0].address, 1, salt));
    });

    it("openCourt rejects a zero transcript hash and a non-Preparing case", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(openCourt(w, id)).to.be.revertedWithCustomError(w.court, "WrongStatus").withArgs(STATUS.Recruiting);
      await fillJury(w, id);
      await expect(w.court.connect(w.operator).openCourt(id, ethers.ZeroHash)).to.be.revertedWithCustomError(
        w.court,
        "ZeroValue",
      );
    });
  });

  describe("Timeouts and cancellations", () => {
    it("Versus consent expiry: cancelExpired reverts NotExpired early, joinVersus reverts DeadlinePassed after, Side A refunded 0.70", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const id = await w.court.caseCount();
      const c = await w.court.getCase(id);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.AwaitingCounterparty);
      await expect(w.court.cancelExpired(id)).to.be.revertedWithCustomError(w.court, "NotExpired");

      await time.increaseTo(Number(c.pendingDeadline) + 5);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Expired);
      await expect(w.court.connect(w.sideB).joinVersus(id, false))
        .to.be.revertedWithCustomError(w.court, "DeadlinePassed")
        .withArgs(c.pendingDeadline);
      await expect(w.court.cancelExpired(id))
        .to.emit(w.court, "CaseCancelled")
        .withArgs(id, CANCEL.ConsentExpired, 0);
      expect((await w.court.getCase(id)).cancelReason).to.equal(CANCEL.ConsentExpired);

      const before = await bal(w, w.creator.address);
      await w.court.connect(w.creator).claimRefund(id);
      expect((await bal(w, w.creator.address)) - before).to.equal(usdc("0.70"));
      await assertConserved(w);
    });

    it("joinVersus one second before the pending deadline still works", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const id = await w.court.caseCount();
      const c = await w.court.getCase(id);
      await time.setNextBlockTimestamp(Number(c.pendingDeadline) - 1);
      await w.court.connect(w.sideB).joinVersus(id, false);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Recruiting);
    });

    it("Side A can withdraw the invite (InviteWithdrawn) and is refunded in full", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const id = await w.court.caseCount();
      await expect(w.court.connect(w.sideB).withdrawInvite(id)).to.be.revertedWithCustomError(w.court, "NotCreator");
      await expect(w.court.connect(w.creator).withdrawInvite(id))
        .to.emit(w.court, "CaseCancelled")
        .withArgs(id, CANCEL.InviteWithdrawn, 0);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Cancelled);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.changeTokenBalance(
        w.usdcToken,
        w.creator,
        usdc("0.70"),
      );
      await assertConserved(w);
    });

    it("withdrawInvite after Side B joined reverts WrongStatus; on a Solo case reverts WrongMode", async () => {
      const w = await loadFixture(fx);
      const id = await openAndJoinVersus(w);
      await expect(w.court.connect(w.creator).withdrawInvite(id))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Recruiting);
      const solo = await fileSolo(w);
      await expect(w.court.connect(w.creator).withdrawInvite(solo)).to.be.revertedWithCustomError(w.court, "WrongMode");
    });

    it("Grand Jury funding expiry with partial contributions refunds each contributor exactly and credits the sponsor deposit back", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.curator).publishGrandJury(CONTENT, w.sponsor.address, usdc(2));
      const id = await w.court.caseCount();
      const paid = [usdc("1.5"), usdc("2.25"), usdc("0.1")];
      for (let i = 0; i < 3; i++) await w.court.connect(w.others[i]).contribute(id, paid[i]);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Crowdfunding);
      const c = await w.court.getCase(id);
      await time.increaseTo(Number(c.pendingDeadline) + 5);
      await w.court.cancelExpired(id);
      const after = await w.court.getCase(id);
      expect(after.status).to.equal(STATUS.Cancelled);
      expect(after.cancelReason).to.equal(CANCEL.FundingExpired);
      expect(await w.court.claimable(w.sponsor.address)).to.equal(usdc(2));
      for (let i = 0; i < 3; i++) {
        await expect(w.court.connect(w.others[i]).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.others[i], paid[i]);
      }
      await w.court.connect(w.sponsor).withdraw();
      await assertConserved(w);
      await drain(w);
    });

    it("jury not filled (2 of 3 seated): JuryNotFilled, bonds credited back, creator refunded in full", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await acceptSeat(w, id, w.jurors[0]);
      await acceptSeat(w, id, w.jurors[1]);
      const c = await w.court.getCase(id);
      await expect(w.court.cancelExpired(id)).to.be.revertedWithCustomError(w.court, "NotExpired");
      await time.increaseTo(c.recruitDeadline);
      await expect(w.court.cancelExpired(id)).to.emit(w.court, "CaseCancelled").withArgs(id, CANCEL.JuryNotFilled, 0);
      expect((await w.court.getCase(id)).cancelReason).to.equal(CANCEL.JuryNotFilled);
      expect(await w.court.claimable(w.jurors[0].address)).to.equal(usdc("0.40"));
      expect(await w.court.claimable(w.jurors[1].address)).to.equal(usdc("0.40"));
      expect(await w.court.claimable(w.jurors[2].address)).to.equal(0);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.creator, usdc("1.20"));
      await assertConserved(w);
      await drain(w);
    });

    it("preparation expiry: openCourt reverts DeadlinePassed, then cancelExpired gives PreparationExpired with bonds returned", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      const c = await w.court.getCase(id);
      await expect(w.court.cancelExpired(id)).to.be.revertedWithCustomError(w.court, "NotExpired");
      await time.increaseTo(Number(c.prepDeadline) + 3);
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Expired);
      await expect(openCourt(w, id)).to.be.revertedWithCustomError(w.court, "DeadlinePassed").withArgs(c.prepDeadline);
      await expect(w.court.cancelExpired(id)).to.emit(w.court, "CaseCancelled").withArgs(id, CANCEL.PreparationExpired, 0);
      for (const j of w.jurors.slice(0, 3)) expect(await w.court.claimable(j.address)).to.equal(usdc("0.40"));
      await w.court.connect(w.creator).claimRefund(id);
      await assertConserved(w);
      await drain(w);
    });

    it("openCourt one second before the prep deadline still works", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      const c = await w.court.getCase(id);
      await time.setNextBlockTimestamp(Number(c.prepDeadline) - 1);
      await openCourt(w, id);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Voting);
    });

    it("cancelExpired on a Voting case reverts NotExpired", async () => {
      const w = await loadFixture(fx);
      const { id, c } = await openSolo(w);
      await time.increaseTo(Number(c.revealDeadline) + 10);
      await expect(w.court.cancelExpired(id)).to.be.revertedWithCustomError(w.court, "NotExpired");
    });

    it("failPreparation by the operator: PreparationFailed, full refunds, no slashing", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await expect(w.court.connect(w.operator).failPreparation(id))
        .to.emit(w.court, "CaseCancelled")
        .withArgs(id, CANCEL.PreparationFailed, 0);
      for (const j of w.jurors.slice(0, 3)) expect(await w.court.claimable(j.address)).to.equal(usdc("0.40"));
      expect(await w.court.claimable(w.treasury.address)).to.equal(0);
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(0);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.creator, usdc("1.20"));
      expect(await w.court.reserveBalance()).to.equal(usdc(50));
      await assertConserved(w);
      await drain(w);
    });

    it("failPreparation outside Preparing reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(w.court.connect(w.operator).failPreparation(id))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Recruiting);
    });
  });

  describe("Protective cancel", () => {
    it("during Commit after 2 of 3 committed: committers get bond + 0.20 stipend, the third bond only, paid from the reserve", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      await commit(w, id, jurors[1], 1);
      expect(await w.court.reserveLocked()).to.equal(usdc("0.60"));
      const reserveBefore = await w.court.reserveBalance();

      const tx = await w.court.connect(w.operator).protectiveCancel(id);
      await expect(tx).to.emit(w.court, "IncidentStipendPaid").withArgs(id, jurors[0].address, usdc("0.20"));
      await expect(tx).to.emit(w.court, "IncidentStipendPaid").withArgs(id, jurors[1].address, usdc("0.20"));
      await expect(tx).to.emit(w.court, "CaseCancelled").withArgs(id, CANCEL.ProtectiveCancel, usdc("0.40"));
      const c = await w.court.getCase(id);
      expect(c.status).to.equal(STATUS.Cancelled);
      expect(c.cancelReason).to.equal(CANCEL.ProtectiveCancel);
      expect(c.stipendLocked).to.equal(0);
      expect(await w.court.claimable(jurors[0].address)).to.equal(usdc("0.60"));
      expect(await w.court.claimable(jurors[1].address)).to.equal(usdc("0.60"));
      expect(await w.court.claimable(jurors[2].address)).to.equal(usdc("0.40"));
      expect(reserveBefore - (await w.court.reserveBalance())).to.equal(usdc("0.40"));
      expect(await w.court.reserveLocked()).to.equal(0);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.creator, usdc("1.20"));
      await assertConserved(w);
      await drain(w);
    });

    it("with all jurors committed (Reveal phase, not yet finalizable) all three get the stipend", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      await reveal(w, id, jurors[0], 0);
      await expect(w.court.connect(w.operator).protectiveCancel(id))
        .to.emit(w.court, "CaseCancelled")
        .withArgs(id, CANCEL.ProtectiveCancel, usdc("0.60"));
      for (const j of jurors) expect(await w.court.claimable(j.address)).to.equal(usdc("0.60"));
      await assertConserved(w);
      await drain(w);
    });

    it("with nobody committed, no stipend is paid and the lock is released", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      await w.court.connect(w.operator).protectiveCancel(id);
      for (const j of jurors) expect(await w.court.claimable(j.address)).to.equal(usdc("0.40"));
      expect(await w.court.reserveLocked()).to.equal(0);
      expect(await w.court.reserveBalance()).to.equal(usdc(50));
      await assertConserved(w);
    });

    it("in Pending (Versus) there is no stipend and the payer is refunded", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const id = await w.court.caseCount();
      await expect(w.court.connect(w.operator).protectiveCancel(id))
        .to.emit(w.court, "CaseCancelled")
        .withArgs(id, CANCEL.ProtectiveCancel, 0);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.creator, usdc("0.70"));
      await assertConserved(w);
    });

    it("in Pending (Grand Jury) the sponsor deposit is credited back and contributors refunded", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.curator).publishGrandJury(CONTENT, w.sponsor.address, usdc(3));
      const id = await w.court.caseCount();
      await w.court.connect(w.others[0]).contribute(id, usdc(1));
      await w.court.connect(w.operator).protectiveCancel(id);
      expect(await w.court.claimable(w.sponsor.address)).to.equal(usdc(3));
      await expect(w.court.connect(w.others[0]).claimRefund(id)).to.changeTokenBalance(w.usdcToken, w.others[0], usdc(1));
      await assertConserved(w);
      await drain(w);
    });

    it("in Recruiting there is no stipend; seated jurors get their bond back", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await acceptSeat(w, id, w.jurors[0]);
      await expect(w.court.connect(w.operator).protectiveCancel(id))
        .to.emit(w.court, "CaseCancelled")
        .withArgs(id, CANCEL.ProtectiveCancel, 0);
      expect(await w.court.claimable(w.jurors[0].address)).to.equal(usdc("0.40"));
      await assertConserved(w);
      await drain(w);
    });

    it("in Preparing there is no stipend (the stipend is only locked when the court opens)", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      expect(await w.court.reserveLocked()).to.equal(0);
      await w.court.connect(w.operator).protectiveCancel(id);
      for (const j of w.jurors.slice(0, 3)) expect(await w.court.claimable(j.address)).to.equal(usdc("0.40"));
      expect(await w.court.reserveBalance()).to.equal(usdc(50));
      await assertConserved(w);
      await drain(w);
    });

    it("after the reveal deadline it reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const { id, jurors, c } = await openSolo(w);
      await commit(w, id, jurors[0], 0);
      await time.increaseTo(c.revealDeadline);
      await expect(w.court.connect(w.operator).protectiveCancel(id))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Voting);
    });

    it("after every juror revealed it reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const { id, jurors } = await openSolo(w);
      for (const j of jurors) await commit(w, id, j, 0);
      for (const j of jurors) await reveal(w, id, j, 0);
      await expect(w.court.connect(w.operator).protectiveCancel(id)).to.be.revertedWithCustomError(w.court, "WrongStatus");
    });

    it("on Finalized or already Cancelled cases it reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const { id } = await openSolo(w);
      await runTrial(w, id, [0, 0, 0]);
      await expect(w.court.connect(w.operator).protectiveCancel(id))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Finalized);
      const id2 = await fileSolo(w);
      await w.court.connect(w.operator).protectiveCancel(id2);
      await expect(w.court.connect(w.operator).protectiveCancel(id2))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Cancelled);
    });

    it("a non-operator is rejected with AccessControlUnauthorizedAccount", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(w.court.connect(w.others[0]).protectiveCancel(id))
        .to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount")
        .withArgs(w.others[0].address, await w.court.OPERATOR_ROLE());
    });
  });

  describe("Reserve", () => {
    it("openCourt with insufficient free reserve reverts InsufficientReserve", async () => {
      const w = await loadFixture(fxNoReserve);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await expect(openCourt(w, id))
        .to.be.revertedWithCustomError(w.court, "InsufficientReserve")
        .withArgs(usdc("0.60"), 0);
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Preparing);
    });

    it("topping up the reserve lets the court open; fundReserve(0) reverts ZeroValue", async () => {
      const w = await loadFixture(fxNoReserve);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await expect(w.court.connect(w.admin).fundReserve(0)).to.be.revertedWithCustomError(w.court, "ZeroValue");
      await expect(w.court.connect(w.admin).fundReserve(usdc("0.60")))
        .to.emit(w.court, "ReserveFunded")
        .withArgs(w.admin.address, usdc("0.60"));
      await openCourt(w, id);
      expect(await w.court.reserveLocked()).to.equal(usdc("0.60"));
    });

    it("reserve locking across two concurrent open courts, and withdrawReserve only takes unlocked reserve", async () => {
      const w = await loadFixture(fxSmallReserve); // 1.00 reserve, each court locks 0.60
      const a = await fileSolo(w);
      const b = await fileSolo(w);
      await fillJury(w, a);
      await fillJury(w, b);
      await openCourt(w, a);
      expect(await w.court.reserveLocked()).to.equal(usdc("0.60"));
      await expect(openCourt(w, b))
        .to.be.revertedWithCustomError(w.court, "InsufficientReserve")
        .withArgs(usdc("0.60"), usdc("0.40"));

      await expect(w.court.connect(w.admin).withdrawReserve(usdc("0.50"), w.admin.address))
        .to.be.revertedWithCustomError(w.court, "InsufficientReserve")
        .withArgs(usdc("0.50"), usdc("0.40"));
      await expect(w.court.connect(w.admin).withdrawReserve(usdc("0.40"), w.treasury.address))
        .to.emit(w.court, "ReserveWithdrawn")
        .withArgs(w.treasury.address, usdc("0.40"));
      expect(await w.court.reserveBalance()).to.equal(usdc("0.60"));

      // settling the first court releases its lock
      await runTrial(w, a, [0, 0, 0]);
      expect(await w.court.reserveLocked()).to.equal(0);
      await openCourt(w, b);
      expect(await w.court.reserveLocked()).to.equal(usdc("0.60"));
      await assertConserved(w);
      await runTrial(w, b, [0, 0, 0]);
      await w.court.connect(w.admin).withdrawReserve(usdc("0.60"), w.admin.address);
      expect(await w.court.reserveBalance()).to.equal(0);
      await assertConserved(w);
    });

    it("withdrawReserve rejects the zero address", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.admin).withdrawReserve(1, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        w.court,
        "ZeroAddress",
      );
    });
  });

  describe("Refund rules", () => {
    it("claimRefund on a verdict case reverts NotRefundable", async () => {
      const w = await loadFixture(fx);
      const { id } = await openSolo(w);
      await runTrial(w, id, [0, 0, 1]);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.be.revertedWithCustomError(w.court, "NotRefundable");
    });

    it("claimRefund on a case still in progress reverts NotRefundable", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.be.revertedWithCustomError(w.court, "NotRefundable");
    });

    it("double claim reverts NothingToClaim, and so does a claim by someone who paid nothing", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await w.court.connect(w.operator).protectiveCancel(id);
      await w.court.connect(w.creator).claimRefund(id);
      await expect(w.court.connect(w.creator).claimRefund(id)).to.be.revertedWithCustomError(w.court, "NothingToClaim");
      await expect(w.court.connect(w.others[0]).claimRefund(id)).to.be.revertedWithCustomError(w.court, "NothingToClaim");
      await assertConserved(w);
    });

    it("claimRefundFor sends the money to the payer, not to the caller", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await w.court.connect(w.operator).protectiveCancel(id);
      await expect(w.court.connect(w.others[0]).claimRefundFor(id, w.creator.address)).to.changeTokenBalances(
        w.usdcToken,
        [w.creator, w.others[0]],
        [usdc("1.20"), 0],
      );
      await expect(w.court.connect(w.others[0]).claimRefundFor(id, w.creator.address))
        .to.be.revertedWithCustomError(w.court, "NothingToClaim");
      expect(await w.court.paidBy(id, w.creator.address)).to.equal(0);
    });

    it("withdraw with nothing claimable reverts NothingToClaim; with a balance it pays and emits Withdrawn", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.others[0]).withdraw()).to.be.revertedWithCustomError(w.court, "NothingToClaim");
      const { id, jurors } = await openSolo(w);
      await runTrial(w, id, [0, 0, 0]);
      await expect(w.court.connect(jurors[0]).withdraw())
        .to.emit(w.court, "Withdrawn")
        .withArgs(jurors[0].address, usdc("0.70"));
      await expect(w.court.connect(jurors[0]).withdraw()).to.be.revertedWithCustomError(w.court, "NothingToClaim");
      await assertConserved(w);
    });

    it("NO VERDICT Solo refunds the creator in full and emits RefundClaimed", async () => {
      const w = await loadFixture(fx);
      const { id } = await openSolo(w);
      await runTrial(w, id, [0, 1, "absent"]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.NoVerdict);
      await expect(w.court.connect(w.creator).claimRefund(id))
        .to.emit(w.court, "RefundClaimed")
        .withArgs(id, w.creator.address, usdc("1.20"));
      await assertConserved(w);
      await drain(w);
    });
  });

  describe("Grand Jury crowdfunding", () => {
    async function publish(w: World, sponsorAmount = 0n) {
      await w.court
        .connect(w.curator)
        .publishGrandJury(CONTENT, sponsorAmount > 0n ? w.sponsor.address : ethers.ZeroAddress, sponsorAmount);
      return w.court.caseCount();
    }

    it("a contribution over the remaining amount takes only the remainder and returns it", async () => {
      const w = await loadFixture(fx);
      const id = await publish(w);
      const target = (await w.court.getCase(id)).target;
      expect(target).to.equal(usdc("7.30"));
      await w.court.connect(w.others[0]).contribute(id, usdc(5));
      const accepted = await w.court.connect(w.others[1]).contribute.staticCall(id, usdc(10));
      expect(accepted).to.equal(usdc("2.30"));
      await expect(w.court.connect(w.others[1]).contribute(id, usdc(10)))
        .to.emit(w.court, "PaymentReceived")
        .withArgs(id, w.others[1].address, usdc("2.30"), false);
      expect(await w.court.paidBy(id, w.others[1].address)).to.equal(usdc("2.30"));
      expect(await bal(w, w.others[1].address)).to.equal(usdc(1000) - usdc("2.30"));
      const c = await w.court.getCase(id);
      expect(c.raised).to.equal(target);
      expect(c.status).to.equal(STATUS.Recruiting);
      await assertConserved(w);
    });

    it("a contribution below minContribution reverts BelowMinContribution", async () => {
      const w = await loadFixture(fx);
      const id = await publish(w);
      await expect(w.court.connect(w.others[0]).contribute(id, usdc("0.05")))
        .to.be.revertedWithCustomError(w.court, "BelowMinContribution")
        .withArgs(100000);
      await expect(w.court.connect(w.others[0]).contribute(id, 0)).to.be.revertedWithCustomError(w.court, "BelowMinContribution");
      await expect(w.court.connect(w.others[0]).contribute(id, 99999)).to.be.revertedWithCustomError(w.court, "BelowMinContribution");
      await w.court.connect(w.others[0]).contribute(id, 100000); // exactly the minimum is fine
    });

    it("the final top-up may be smaller than the minimum", async () => {
      const w = await loadFixture(fx);
      const id = await publish(w);
      const target = (await w.court.getCase(id)).target;
      await w.court.connect(w.others[0]).contribute(id, target - usdc("0.05"));
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Pending);
      // 0.06 against 0.05 remaining -> accepts 0.05
      expect(await w.court.connect(w.others[1]).contribute.staticCall(id, usdc("0.06"))).to.equal(usdc("0.05"));
      await w.court.connect(w.others[1]).contribute(id, usdc("0.05"));
      const c = await w.court.getCase(id);
      expect(c.raised).to.equal(target);
      expect(c.status).to.equal(STATUS.Recruiting);
      await assertConserved(w);
    });

    it("contribute after the case is funded reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const { id } = await publishAndFundGrandJury(w);
      await expect(w.court.connect(w.others[4]).contribute(id, usdc(1)))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Recruiting);
    });

    it("recruitment opens automatically when the target is reached, holding pool, fee and AI fee", async () => {
      const w = await loadFixture(fx);
      const id = await publish(w);
      const target = (await w.court.getCase(id)).target;
      await w.court.connect(w.others[0]).contribute(id, usdc(3));
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Pending);
      const tx = await w.court.connect(w.others[1]).contribute(id, target - usdc(3));
      const at = await blockTime(tx);
      await expect(tx).to.emit(w.court, "RecruitmentOpened").withArgs(id, at + 1800);
      const c = await w.court.getCase(id);
      expect(c.poolHeld).to.equal(usdc("6.30")); // 7 * 0.90
      expect(c.protocolFeeHeld).to.equal(usdc("0.50"));
      expect(c.aiFeeHeld).to.equal(usdc("0.50"));
      expect(await w.court.phaseOf(id)).to.equal(PHASE.Recruiting);
    });

    it("contribute to a non-Grand-Jury case or a missing case reverts WrongMode", async () => {
      const w = await loadFixture(fx);
      const solo = await fileSolo(w);
      await expect(w.court.connect(w.others[0]).contribute(solo, usdc(1))).to.be.revertedWithCustomError(w.court, "WrongMode");
      await expect(w.court.connect(w.others[0]).contribute(99, usdc(1))).to.be.revertedWithCustomError(w.court, "WrongMode");
    });

    it("contribute after the funding deadline reverts DeadlinePassed", async () => {
      const w = await loadFixture(fx);
      const id = await publish(w);
      const c = await w.court.getCase(id);
      await time.increaseTo(c.pendingDeadline);
      await expect(w.court.connect(w.others[0]).contribute(id, usdc(1)))
        .to.be.revertedWithCustomError(w.court, "DeadlinePassed")
        .withArgs(c.pendingDeadline);
    });

    it("a funded Grand Jury runs a 7-juror trial and the sponsor deposit goes to the treasury", async () => {
      const w = await loadFixture(fx);
      const { id } = await publishAndFundGrandJury(w, { sponsorAmount: usdc(2) });
      await fillJury(w, id);
      await openCourt(w, id);
      await runTrial(w, id, [0, 0, 0, 0, 1, 1, 1]);
      expect((await w.court.getCase(id)).outcome).to.equal(OUTCOME.Choice0);
      expect(await w.court.claimable(w.treasury.address)).to.equal(usdc("2.50")); // 2.00 sponsor + 0.50 fee
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(usdc("0.50"));
      await assertConserved(w);
      await drain(w);
    });
  });

  describe("Full cycle with interleaved cases", () => {
    it("solo + versus + Grand Jury settle together; everyone withdraws and the court holds exactly the reserve", async () => {
      const w = await loadFixture(fx);
      const solo = await fileSolo(w);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const versus = await w.court.caseCount();
      await w.court.connect(w.curator).publishGrandJury(CONTENT, ethers.ZeroAddress, 0);
      const gj = await w.court.caseCount();
      await w.court.connect(w.sideB).joinVersus(versus, false);
      await w.court.connect(w.others[0]).contribute(gj, usdc(4));
      await w.court.connect(w.others[1]).contribute(gj, usdc(100));

      // interleave seat acceptance
      const soloJ = w.jurors.slice(0, 3);
      const verJ = w.jurors.slice(3, 6);
      const gjJ = w.jurors.slice(0, 7);
      for (let i = 0; i < 3; i++) {
        await acceptSeat(w, solo, soloJ[i]);
        await acceptSeat(w, versus, verJ[i]);
        await acceptSeat(w, gj, gjJ[i]);
      }
      for (let i = 3; i < 7; i++) await acceptSeat(w, gj, gjJ[i]);
      for (const id of [solo, versus, gj]) {
        expect((await w.court.getCase(id)).status).to.equal(STATUS.Preparing);
        await openCourt(w, id);
      }
      expect(await w.court.reserveLocked()).to.equal(usdc("0.60") * 2n + usdc("1.40"));

      const plan: [bigint, HardhatEthersSigner[], (0 | 1 | "absent")[]][] = [
        [solo, soloJ, [0, 0, 1]],
        [versus, verJ, [0, 1, "absent"]],
        [gj, gjJ, [0, 0, 0, 0, 1, 1, "absent"]],
      ];
      for (const [id, js, att] of plan) {
        for (let i = 0; i < js.length; i++) if (att[i] !== "absent") await commit(w, id, js[i], att[i] as number);
      }
      const maxCommit = Math.max(...(await Promise.all([solo, versus, gj].map(async (i) => Number((await w.court.getCase(i)).commitDeadline)))));
      await time.increaseTo(maxCommit);
      for (const [id, js, att] of plan) {
        for (let i = 0; i < js.length; i++) if (att[i] !== "absent") await reveal(w, id, js[i], att[i] as number);
      }
      const maxReveal = Math.max(...(await Promise.all([solo, versus, gj].map(async (i) => Number((await w.court.getCase(i)).revealDeadline)))));
      await time.increaseTo(maxReveal);
      for (const id of [solo, versus, gj]) await w.court.finalize(id);

      expect((await w.court.getCase(solo)).outcome).to.equal(OUTCOME.Choice0);
      expect((await w.court.getCase(versus)).outcome).to.equal(OUTCOME.NoVerdict);
      expect((await w.court.getCase(gj)).outcome).to.equal(OUTCOME.Choice0);
      expect(await w.court.reserveLocked()).to.equal(0);
      await assertConserved(w);
      await drain(w);
      await assertConserved(w);
      expect(await w.usdcToken.balanceOf(await w.court.getAddress())).to.equal(usdc(50));
    });
  });
});

describe("Solo with a chosen jury", () => {
  const CASES = [
    { jurors: 3, bond: "0.40", bonus: "0.30", price: "1.20" },
    { jurors: 5, bond: "0.80", bonus: "0.60", price: "3.30" },
    { jurors: 7, bond: "1.20", bonus: "0.90", price: "6.60" },
  ];

  for (const c of CASES) {
    it(`prices and seats a jury of ${c.jurors}`, async () => {
      const w = await deployWorld();
      const [price, bond, bonus] = await w.court.soloPrice(c.jurors);
      expect(price).to.equal(usdc(c.price));
      expect(bond).to.equal(usdc(c.bond));
      expect(bonus).to.equal(usdc(c.bonus));

      await w.court.connect(w.creator).fileSoloJury(CONTENT, c.jurors);
      const id = await w.court.caseCount();
      const stored = await w.court.getCase(id);
      expect(stored.jurySize).to.equal(c.jurors);
      expect(stored.target).to.equal(usdc(c.price));
      const terms = await w.court.caseTerms(id);
      expect(terms.bond).to.equal(usdc(c.bond));
      expect(terms.n).to.equal((c.jurors - 1) / 2);
    });
  }

  it("refuses an even or oversized jury", async () => {
    const w = await deployWorld();
    for (const jurors of [0, 1, 2, 4, 9]) {
      await expect(w.court.connect(w.creator).fileSoloJury(CONTENT, jurors)).to.be.revertedWithCustomError(w.court, "InvalidTerms");
    }
  });

  it("a full jury of 5 settles: each juror gets the bond back plus the 0.60 bonus", async () => {
    const w = await deployWorld();
    await w.court.connect(w.creator).fileSoloJury(CONTENT, 5);
    const id = await w.court.caseCount();
    const seated = await fillJury(w, id);
    expect(seated).to.have.length(5);
    await openCourt(w, id);
    const before = await bal(w, seated[0].address);
    await runTrial(w, id, [0, 0, 0, 1, 1]);
    expect(await w.court.claimable(seated[0].address)).to.equal(usdc("1.40"));
    await drain(w);
    expect((await bal(w, seated[0].address)) - before).to.equal(usdc("1.40"));
  });

  it("a no-show on a jury of 5: their bond pays the 0.20 to everyone else, and the books close", async () => {
    const w = await deployWorld();
    await w.court.connect(w.creator).fileSoloJury(CONTENT, 5);
    const id = await w.court.caseCount();
    const seated = await fillJury(w, id);
    await openCourt(w, id);
    await runTrial(w, id, [0, 1, 0, 1, "absent"]);
    const paid = await w.court.claimable(seated[0].address);
    expect(await w.court.claimable(seated[4].address)).to.equal(0n);
    expect(paid).to.equal(usdc("1.00"));
    await drain(w);
  });

  it("does not change the mode's own terms for the next case", async () => {
    const w = await deployWorld();
    await w.court.connect(w.creator).fileSoloJury(CONTENT, 7);
    expect((await w.court.termsOf(0)).n).to.equal(1);
  });
});
