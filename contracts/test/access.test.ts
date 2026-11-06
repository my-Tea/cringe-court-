import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  CONTENT, LEVEL, MODE, STATUS, TRANSCRIPT, buildTerms, usdc, deployWorld, fileSolo, openAndJoinVersus,
  fillJury, openCourt, runTrial, acceptSeat, signSeatOffer, assertConserved, humanIdOf, type World,
} from "./helpers";

const fx = () => deployWorld();

async function expiry(secs = 100000) {
  return (await time.latest()) + secs;
}

describe("Access control, eligibility and parties", () => {
  describe("Seat offers", () => {
    it("an offer signed by a non-assigner reverts InvalidSeatOffer", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const { expiresAt, sig } = await signSeatOffer(w, id, w.jurors[0].address, undefined, w.others[0]);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, expiresAt, sig)).to.be.revertedWithCustomError(
        w.court,
        "InvalidSeatOffer",
      );
    });

    it("an offer signed for juror X cannot be used by juror Y", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const { expiresAt, sig } = await signSeatOffer(w, id, w.jurors[0].address);
      await expect(w.court.connect(w.jurors[1]).acceptSeat(id, expiresAt, sig)).to.be.revertedWithCustomError(
        w.court,
        "InvalidSeatOffer",
      );
      await w.court.connect(w.jurors[0]).acceptSeat(id, expiresAt, sig); // the intended holder still can
    });

    it("an offer for another caseId reverts InvalidSeatOffer", async () => {
      const w = await loadFixture(fx);
      const a = await fileSolo(w);
      const b = await fileSolo(w);
      const { expiresAt, sig } = await signSeatOffer(w, b, w.jurors[0].address);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(a, expiresAt, sig)).to.be.revertedWithCustomError(
        w.court,
        "InvalidSeatOffer",
      );
    });

    it("tampering with expiresAt invalidates the signature (InvalidSeatOffer)", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const { expiresAt, sig } = await signSeatOffer(w, id, w.jurors[0].address);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, expiresAt + 1000, sig)).to.be.revertedWithCustomError(
        w.court,
        "InvalidSeatOffer",
      );
    });

    it("an offer signed by an account whose ASSIGNER role was revoked is rejected", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const { expiresAt, sig } = await signSeatOffer(w, id, w.jurors[0].address);
      await w.court.connect(w.admin).revokeRole(await w.court.ASSIGNER_ROLE(), w.assigner.address);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, expiresAt, sig)).to.be.revertedWithCustomError(
        w.court,
        "InvalidSeatOffer",
      );
    });

    it("an expired offer reverts OfferExpired (expiresAt <= now)", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const past = (await time.latest()) - 1;
      const o = await signSeatOffer(w, id, w.jurors[0].address, past);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, o.expiresAt, o.sig)).to.be.revertedWithCustomError(
        w.court,
        "OfferExpired",
      );
    });

    it("an offer whose expiresAt equals the block timestamp is expired; one second later it is valid", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const t = (await time.latest()) + 100;
      const o = await signSeatOffer(w, id, w.jurors[0].address, t);
      await time.setNextBlockTimestamp(t);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, o.expiresAt, o.sig)).to.be.revertedWithCustomError(
        w.court,
        "OfferExpired",
      );
      const t2 = (await time.latest()) + 100;
      const o2 = await signSeatOffer(w, id, w.jurors[0].address, t2 + 1);
      await time.setNextBlockTimestamp(t2);
      await w.court.connect(w.jurors[0]).acceptSeat(id, o2.expiresAt, o2.sig);
      expect((await w.court.getCase(id)).seated).to.equal(1);
    });

    it("accepting after the recruit deadline reverts DeadlinePassed", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const c = await w.court.getCase(id);
      const o = await signSeatOffer(w, id, w.jurors[0].address, Number(c.recruitDeadline) + 1000);
      await time.increaseTo(c.recruitDeadline);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, o.expiresAt, o.sig))
        .to.be.revertedWithCustomError(w.court, "DeadlinePassed")
        .withArgs(c.recruitDeadline);
    });

    it("accepting at recruitDeadline-1 still works", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const c = await w.court.getCase(id);
      const o = await signSeatOffer(w, id, w.jurors[0].address, Number(c.recruitDeadline) + 1000);
      await time.setNextBlockTimestamp(Number(c.recruitDeadline) - 1);
      await w.court.connect(w.jurors[0]).acceptSeat(id, o.expiresAt, o.sig);
    });

    it("accepting while the Versus case is still Pending reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const id = await w.court.caseCount();
      await expect(acceptSeat(w, id, w.jurors[0]))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Pending);
    });

    it("accepting on a missing case reverts WrongStatus(None)", async () => {
      const w = await loadFixture(fx);
      await expect(acceptSeat(w, 42n, w.jurors[0]))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.None);
    });

    it("accepting when the jury is already full reverts WrongStatus(Preparing)", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await expect(acceptSeat(w, id, w.jurors[3]))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Preparing);
    });

    it("the same wallet twice reverts AlreadySeated", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await acceptSeat(w, id, w.jurors[0]);
      await expect(acceptSeat(w, id, w.jurors[0])).to.be.revertedWithCustomError(w.court, "AlreadySeated");
    });

    it("accepting takes the bond from the juror", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const { expiresAt, sig } = await signSeatOffer(w, id, w.jurors[0].address);
      await expect(w.court.connect(w.jurors[0]).acceptSeat(id, expiresAt, sig)).to.changeTokenBalances(
        w.usdcToken,
        [w.jurors[0], w.court],
        [-usdc("0.40"), usdc("0.40")],
      );
      expect((await w.court.jurorOf(id, w.jurors[0].address)).humanId).to.equal(humanIdOf("juror0"));
    });
  });

  describe("Juror eligibility", () => {
    it("an unattested wallet reverts JurorNotVerified", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(acceptSeat(w, id, w.others[0])).to.be.revertedWithCustomError(w.court, "JurorNotVerified");
    });

    it("a DEVICE-level wallet reverts JurorNotVerified (jurors need ORB)", async () => {
      const w = await loadFixture(fx);
      await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("dev"), LEVEL.DEVICE, await expiry());
      const id = await fileSolo(w);
      await expect(acceptSeat(w, id, w.others[0])).to.be.revertedWithCustomError(w.court, "JurorNotVerified");
    });

    it("a DOCUMENT-level wallet is also below the ORB requirement", async () => {
      const w = await loadFixture(fx);
      await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("doc"), LEVEL.DOCUMENT, await expiry());
      const id = await fileSolo(w);
      await expect(acceptSeat(w, id, w.others[0])).to.be.revertedWithCustomError(w.court, "JurorNotVerified");
    });

    it("an expired attestation reverts JurorNotVerified", async () => {
      const w = await loadFixture(fx);
      const exp = await expiry(200);
      await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("exp"), LEVEL.ORB, exp);
      const id = await fileSolo(w);
      await time.increaseTo(exp + 1);
      await expect(acceptSeat(w, id, w.others[0])).to.be.revertedWithCustomError(w.court, "JurorNotVerified");
    });

    it("a revoked attestation reverts JurorNotVerified", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await w.registry.connect(w.attester).revoke(w.jurors[0].address);
      await expect(acceptSeat(w, id, w.jurors[0])).to.be.revertedWithCustomError(w.court, "JurorNotVerified");
    });

    it("an ORB wallet can serve", async () => {
      const w = await loadFixture(fx);
      await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("orb"), LEVEL.ORB, await expiry());
      const id = await fileSolo(w);
      await acceptSeat(w, id, w.others[0]);
      expect((await w.court.jurorOf(id, w.others[0].address)).seated).to.equal(true);
    });

    it("the Solo filer's wallet cannot serve (PartyCannotServe)", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(acceptSeat(w, id, w.creator)).to.be.revertedWithCustomError(w.court, "PartyCannotServe");
    });

    it("Side A and Side B wallets cannot serve on their Versus case", async () => {
      const w = await loadFixture(fx);
      const id = await openAndJoinVersus(w);
      await expect(acceptSeat(w, id, w.creator)).to.be.revertedWithCustomError(w.court, "PartyCannotServe");
      await expect(acceptSeat(w, id, w.sideB)).to.be.revertedWithCustomError(w.court, "PartyCannotServe");
    });

    it("the sponsor wallet cannot serve on its Grand Jury case, even when ORB attested", async () => {
      const w = await loadFixture(fx);
      await w.registry.connect(w.attester).attest(w.sponsor.address, humanIdOf("sponsor"), LEVEL.ORB, await expiry());
      await w.court.connect(w.curator).publishGrandJury(CONTENT, w.sponsor.address, usdc(2));
      const id = await w.court.caseCount();
      await w.court.connect(w.others[0]).contribute(id, usdc("7.30"));
      await expect(acceptSeat(w, id, w.sponsor)).to.be.revertedWithCustomError(w.court, "PartyCannotServe");
      // an unrelated Solo case does not exclude the sponsor
      const solo = await fileSolo(w);
      await acceptSeat(w, solo, w.sponsor);
    });

    it("the creator's humanId re-attested on a NEW wallet cannot serve on the creator's case but can on an unrelated case", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const fresh = w.others[0];
      await w.registry.connect(w.attester).attest(fresh.address, humanIdOf("creator"), LEVEL.ORB, await expiry());
      await expect(acceptSeat(w, id, fresh)).to.be.revertedWithCustomError(w.court, "PartyCannotServe");

      // unrelated case: filed by Side B (different human)
      await w.court.connect(w.sideB).fileSolo(CONTENT, false);
      const other = await w.court.caseCount();
      await acceptSeat(w, other, fresh);
      expect((await w.court.jurorOf(other, fresh.address)).seated).to.equal(true);
    });

    it("Side B's humanId on a new wallet cannot serve on that Versus case", async () => {
      const w = await loadFixture(fx);
      const id = await openAndJoinVersus(w);
      const fresh = w.others[0];
      await w.registry.connect(w.attester).attest(fresh.address, humanIdOf("sideB"), LEVEL.ORB, await expiry());
      await expect(acceptSeat(w, id, fresh)).to.be.revertedWithCustomError(w.court, "PartyCannotServe");
    });

    it("the same human seated with wallet1 then re-attested to wallet2: wallet2 reverts HumanAlreadySeated", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await acceptSeat(w, id, w.jurors[0]);
      const w2 = w.others[0];
      await w.registry.connect(w.attester).attest(w2.address, humanIdOf("juror0"), LEVEL.ORB, await expiry());
      await expect(acceptSeat(w, id, w2)).to.be.revertedWithCustomError(w.court, "HumanAlreadySeated");
      // on a different case the new wallet is a fresh seat
      const other = await fileSolo(w);
      await acceptSeat(w, other, w2);
    });
  });

  describe("Parties", () => {
    it("filing Solo without an attestation reverts PartyNotVerified", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.others[0]).fileSolo(CONTENT, false))
        .to.be.revertedWithCustomError(w.court, "PartyNotVerified")
        .withArgs(w.others[0].address);
    });

    it("opening Versus without an attestation reverts PartyNotVerified", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.others[0]).openVersus(w.sideB.address, CONTENT, false))
        .to.be.revertedWithCustomError(w.court, "PartyNotVerified")
        .withArgs(w.others[0].address);
    });

    it("joining Versus without an attestation reverts PartyNotVerified", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.others[0].address, CONTENT, false);
      const id = await w.court.caseCount();
      await expect(w.court.connect(w.others[0]).joinVersus(id, false))
        .to.be.revertedWithCustomError(w.court, "PartyNotVerified")
        .withArgs(w.others[0].address);
    });

    it("an expired party attestation reverts PartyNotVerified", async () => {
      const w = await loadFixture(fx);
      const exp = await expiry(50);
      await w.registry.connect(w.attester).attest(w.others[0].address, humanIdOf("brief"), LEVEL.DEVICE, exp);
      await time.increaseTo(exp + 1);
      await expect(w.court.connect(w.others[0]).fileSolo(CONTENT, false)).to.be.revertedWithCustomError(
        w.court,
        "PartyNotVerified",
      );
    });

    it("a party below the configured minPartyLevel reverts PartyNotVerified", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), minPartyLevel: LEVEL.ORB });
      await expect(w.court.connect(w.creator).fileSolo(CONTENT, false)).to.be.revertedWithCustomError(
        w.court,
        "PartyNotVerified",
      );
    });

    it("with minPartyLevel 0 an unattested party can file (Grand Jury style rule)", async () => {
      const w = await loadFixture(fx);
      await w.court.setTerms(MODE.Solo, { ...buildTerms(MODE.Solo), minPartyLevel: 0 });
      await w.court.connect(w.others[0]).fileSolo(CONTENT, false);
      expect((await w.court.getCase(await w.court.caseCount())).status).to.equal(STATUS.Recruiting);
    });

    it("joinVersus by a non-counterparty reverts NotCounterparty", async () => {
      const w = await loadFixture(fx);
      await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, false);
      const id = await w.court.caseCount();
      await expect(w.court.connect(w.others[0]).joinVersus(id, false)).to.be.revertedWithCustomError(w.court, "NotCounterparty");
      await expect(w.court.connect(w.creator).joinVersus(id, false)).to.be.revertedWithCustomError(w.court, "NotCounterparty");
    });

    it("joinVersus on a Solo or missing case reverts WrongMode; a second join reverts WrongStatus", async () => {
      const w = await loadFixture(fx);
      const solo = await fileSolo(w);
      await expect(w.court.connect(w.sideB).joinVersus(solo, false)).to.be.revertedWithCustomError(w.court, "WrongMode");
      await expect(w.court.connect(w.sideB).joinVersus(77, false)).to.be.revertedWithCustomError(w.court, "WrongMode");
      const id = await openAndJoinVersus(w);
      await expect(w.court.connect(w.sideB).joinVersus(id, false))
        .to.be.revertedWithCustomError(w.court, "WrongStatus")
        .withArgs(STATUS.Recruiting);
    });

    it("openVersus with sideB = self reverts SamePerson; with the zero address reverts ZeroAddress", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.creator).openVersus(w.creator.address, CONTENT, false)).to.be.revertedWithCustomError(
        w.court,
        "SamePerson",
      );
      await expect(w.court.connect(w.creator).openVersus(ethers.ZeroAddress, CONTENT, false)).to.be.revertedWithCustomError(
        w.court,
        "ZeroAddress",
      );
    });

    it("a Side B wallet attested to the same humanId as Side A reverts SamePerson on join", async () => {
      const w = await loadFixture(fx);
      const second = w.others[0];
      await w.court.connect(w.creator).openVersus(second.address, CONTENT, false);
      const id = await w.court.caseCount();
      await w.registry.connect(w.attester).attest(second.address, humanIdOf("creator"), LEVEL.DEVICE, await expiry());
      await expect(w.court.connect(second).joinVersus(id, false)).to.be.revertedWithCustomError(w.court, "SamePerson");
      expect((await w.court.getCase(id)).status).to.equal(STATUS.Pending);
    });

    it("an empty content hash reverts ZeroValue on every entry point", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.creator).fileSolo(ethers.ZeroHash, false)).to.be.revertedWithCustomError(w.court, "ZeroValue");
      await expect(w.court.connect(w.creator).openVersus(w.sideB.address, ethers.ZeroHash, false)).to.be.revertedWithCustomError(
        w.court,
        "ZeroValue",
      );
      await expect(
        w.court.connect(w.curator).publishGrandJury(ethers.ZeroHash, ethers.ZeroAddress, 0),
      ).to.be.revertedWithCustomError(w.court, "ZeroValue");
    });
  });

  describe("Roles", () => {
    const unauthorized = (w: World, who: string, role: string) => ({ who, role, court: w.court });

    it("only CURATOR can publishGrandJury", async () => {
      const w = await loadFixture(fx);
      const role = await w.court.CURATOR_ROLE();
      for (const who of [w.others[0], w.admin, w.operator]) {
        await expect(w.court.connect(who).publishGrandJury(CONTENT, ethers.ZeroAddress, 0))
          .to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount")
          .withArgs(who.address, role);
      }
      await w.court.connect(w.curator).publishGrandJury(CONTENT, ethers.ZeroAddress, 0);
      void unauthorized;
    });

    it("only OPERATOR can openCourt", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      for (const who of [w.others[0], w.admin, w.curator, w.creator]) {
        await expect(w.court.connect(who).openCourt(id, TRANSCRIPT))
          .to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount")
          .withArgs(who.address, await w.court.OPERATOR_ROLE());
      }
      await openCourt(w, id);
    });

    it("only OPERATOR can failPreparation", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await expect(w.court.connect(w.others[0]).failPreparation(id))
        .to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount")
        .withArgs(w.others[0].address, await w.court.OPERATOR_ROLE());
      await w.court.connect(w.operator).failPreparation(id);
    });

    it("only OPERATOR can protectiveCancel (the admin cannot)", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await expect(w.court.connect(w.admin).protectiveCancel(id))
        .to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount")
        .withArgs(w.admin.address, await w.court.OPERATOR_ROLE());
    });

    it("only the admin can setTerms", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.connect(w.operator).setTerms(MODE.Solo, buildTerms(MODE.Solo)))
        .to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount")
        .withArgs(w.operator.address, ethers.ZeroHash);
      await expect(w.court.connect(w.admin).setTerms(MODE.Solo, buildTerms(MODE.Solo))).to.emit(w.court, "TermsUpdated");
    });

    it("only the admin can setTreasuries, setRegistry, setMarketingCap and withdrawReserve", async () => {
      const w = await loadFixture(fx);
      const who = w.others[0];
      const c = w.court.connect(who);
      const err = (p: Promise<unknown>) =>
        expect(p).to.be.revertedWithCustomError(w.court, "AccessControlUnauthorizedAccount").withArgs(who.address, ethers.ZeroHash);
      await err(c.setTreasuries(who.address, who.address));
      await err(c.setRegistry(who.address));
      await err(c.setMarketingCap(5));
      await err(c.withdrawReserve(1, who.address));
    });

    it("admin setters validate inputs and emit events", async () => {
      const w = await loadFixture(fx);
      await expect(w.court.setTreasuries(ethers.ZeroAddress, w.aiTreasury.address)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(w.court.setTreasuries(w.treasury.address, ethers.ZeroAddress)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(w.court.setTreasuries(w.others[0].address, w.others[1].address))
        .to.emit(w.court, "TreasuryUpdated")
        .withArgs(w.others[0].address, w.others[1].address);
      await expect(w.court.setRegistry(ethers.ZeroAddress)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(w.court.setRegistry(w.others[2].address)).to.emit(w.court, "RegistryUpdated").withArgs(w.others[2].address);
      await expect(w.court.setMarketingCap(7)).to.emit(w.court, "MarketingCapUpdated").withArgs(7);
      expect(await w.court.marketingCap()).to.equal(7);
    });

    it("the constructor rejects zero addresses", async () => {
      const w = await loadFixture(fx);
      const f = await ethers.getContractFactory("CringeCourt");
      const a = w.others[0].address;
      const u = await w.usdcToken.getAddress();
      const r = await w.registry.getAddress();
      await expect(f.deploy(ethers.ZeroAddress, r, a, a, a)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(f.deploy(u, ethers.ZeroAddress, a, a, a)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(f.deploy(u, r, ethers.ZeroAddress, a, a)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(f.deploy(u, r, a, ethers.ZeroAddress, a)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
      await expect(f.deploy(u, r, a, a, ethers.ZeroAddress)).to.be.revertedWithCustomError(w.court, "ZeroAddress");
    });

    it("swapping the registry to an empty one makes previously attested jurors unverified", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      const empty = await (await ethers.getContractFactory("HumanRegistry")).deploy(w.admin.address, w.attester.address);
      await w.court.setRegistry(await empty.getAddress());
      await expect(acceptSeat(w, id, w.jurors[0])).to.be.revertedWithCustomError(w.court, "JurorNotVerified");
    });
  });

  describe("Treasury changes", () => {
    it("settlement pays the treasury address current at finalize, not the one at case creation", async () => {
      const w = await loadFixture(fx);
      const id = await fileSolo(w);
      await fillJury(w, id);
      await openCourt(w, id);
      const [newT, newAi] = [w.others[0], w.others[1]];
      await w.court.setTreasuries(newT.address, newAi.address);
      await runTrial(w, id, [0, 0, 0]);
      expect(await w.court.claimable(w.treasury.address)).to.equal(0);
      expect(await w.court.claimable(w.aiTreasury.address)).to.equal(0);
      expect(await w.court.claimable(newT.address)).to.equal(usdc("0.10"));
      expect(await w.court.claimable(newAi.address)).to.equal(usdc("0.20"));
      await assertConserved(w);
    });
  });
});
