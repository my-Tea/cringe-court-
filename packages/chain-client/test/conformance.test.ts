/**
 * The same suite against the in-memory mock and the real contracts:
 *  1. the hand-written settlement oracle (contracts/test/fixtures/settlement-scenarios.json),
 *  2. lifecycle, deadline and error-code behaviour the UI depends on.
 * If the mock ever drifts from the contracts, the EVM half and the memory half disagree.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, inject, it } from "vitest";
import { keccak256, toHex, zeroAddress } from "viem";
import {
  BALLOT_LABELS, buildTerms, CancelReason, isCourtError, Level, Mode, Outcome, Phase, Status, parseUsdc, sealBallot, decodeScroll,
  type Address, type Choice, type Hex,
} from "../src/index.js";
import { evmHarness, humanIdOf, memoryHarness, type Harness } from "./harness.js";

const scenarios = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../../contracts/test/fixtures/settlement-scenarios.json"), "utf8"),
).scenarios as Array<{
  name: string;
  mode: "solo" | "versus" | "grandJury";
  pricing?: "hackathon" | "launch";
  passEnabled?: boolean;
  passA?: boolean;
  passB?: boolean;
  sponsor?: string;
  attendance: (0 | 1 | "committed" | "absent")[];
  outcome: keyof typeof Outcome;
  payoutPerTimelyJuror: string;
  toTreasury: string;
  toAiTreasury: string;
  refunds: Record<string, string>;
  charges?: Record<string, string>;
}>;

const CONTENT: Hex = keccak256(toHex("approved public case text"));
const TRANSCRIPT: Hex = keccak256(toHex("frozen transcript v1"));
const evmUrl = inject("evmRpcUrl");

type Factory = (opts?: Parameters<typeof memoryHarness>[0]) => Promise<Harness>;
const worlds: [string, Factory][] = [["memory", (o) => memoryHarness(o)]];
if (evmUrl) worlds.push(["evm (hardhat node)", (o) => evmHarness(evmUrl, o)]);

async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    if (isCourtError(e, code)) return;
    throw new Error(`expected ${code}, got ${e instanceof Error ? `${e.name}: ${(e as { code?: string }).code ?? e.message}` : String(e)}`);
  }
  throw new Error(`expected ${code}, but it succeeded`);
}

async function fillJury(h: Harness, caseId: bigint) {
  const size = (await h.port(h.a.admin).getCase(caseId)).jurySize;
  const seated = h.a.jurors.slice(0, size);
  for (const j of seated) await h.port(j).acceptSeat(await h.seatOffer(caseId, j));
  return seated;
}

async function seal(h: Harness, caseId: bigint, juror: Address, choice: Choice) {
  const p = h.port(juror);
  const salt = keccak256(toHex(`salt:${juror}:${caseId}`));
  return sealBallot({ chainId: p.chainId, court: p.court, caseId, juror, choice, salt });
}

for (const [label, make] of worlds) {
  describe(`ChainPort conformance — ${label}`, () => {
    describe("settlement oracle", () => {
      for (const s of scenarios) {
        it(s.name, async () => {
          const h = await make({ pricing: s.pricing ?? "hackathon" });
          const admin = h.port(h.a.admin);
          if (s.passEnabled) {
            const m = s.mode === "solo" ? Mode.Solo : Mode.Versus;
            await h.setTerms(m, { ...buildTerms(m), passEnabled: true });
          }
          const before = new Map<Address, bigint>();
          const all = [h.a.creator, h.a.sideB, ...h.a.jurors, ...h.a.others];
          for (const x of all) before.set(x, await admin.usdcBalance(x));

          let caseId: bigint;
          let payers: [string, Address][];
          if (s.mode === "solo") {
            caseId = (await h.port(h.a.creator).fileSolo({ contentHash: CONTENT, usePass: !!s.passA })).caseId;
            payers = [["creator", h.a.creator]];
          } else if (s.mode === "versus") {
            caseId = (await h.port(h.a.creator).openVersus({ sideB: h.a.sideB, contentHash: CONTENT, usePass: !!s.passA })).caseId;
            await h.port(h.a.sideB).joinVersus(caseId, !!s.passB);
            payers = [["sideA", h.a.creator], ["sideB", h.a.sideB]];
          } else {
            const sponsorAmount = s.sponsor ? parseUsdc(s.sponsor) : 0n;
            caseId = (await h.port(h.a.curator).publishGrandJury({ contentHash: CONTENT, sponsor: sponsorAmount ? h.a.sponsor : undefined, sponsorAmount })).caseId;
            const target = (await admin.getCase(caseId)).target;
            if (s.charges?.target) expect(target).toBe(parseUsdc(s.charges.target));
            await h.port(h.a.others[0]).contribute(caseId, parseUsdc("5"));
            const { accepted } = await h.port(h.a.others[1]).contribute(caseId, parseUsdc("100"));
            expect(accepted).toBe(target - parseUsdc("5"));
            payers = [["contributors", h.a.others[0]], ["contributors", h.a.others[1]]];
          }
          for (const [lbl, addr] of payers) {
            if (s.charges?.[lbl]) expect(before.get(addr)! - (await admin.usdcBalance(addr))).toBe(parseUsdc(s.charges[lbl]));
          }

          const jurors = await fillJury(h, caseId);
          expect(await admin.phaseOf(caseId)).toBe(Phase.Preparing);
          await h.port(h.a.operator).openCourt(caseId, TRANSCRIPT);
          for (let i = 0; i < jurors.length; i++) {
            const a = s.attendance[i];
            if (a === "absent") continue;
            const { commitment } = await seal(h, caseId, jurors[i], a === "committed" ? 0 : a);
            await h.port(jurors[i]).commitVote(caseId, commitment);
          }
          let c = await admin.getCase(caseId);
          if (c.committed < c.jurySize) await h.advanceTo(c.commitDeadline);
          expect(await admin.phaseOf(caseId)).toBe(Phase.Reveal);
          for (let i = 0; i < jurors.length; i++) {
            const a = s.attendance[i];
            if (a === 0 || a === 1) await h.port(jurors[i]).revealVote(caseId, a, (await seal(h, caseId, jurors[i], a)).salt);
          }
          c = await admin.getCase(caseId);
          if (c.revealed < c.jurySize) await h.advanceTo(c.revealDeadline);
          expect(await admin.phaseOf(caseId)).toBe(Phase.Finalizable);
          const { settlement } = await h.port(h.a.others[5]).finalize(caseId);

          expect(settlement.outcome).toBe(Outcome[s.outcome]);
          expect(settlement.payoutPerTimelyJuror).toBe(parseUsdc(s.payoutPerTimelyJuror));
          expect(settlement.toTreasury).toBe(parseUsdc(s.toTreasury));
          expect(settlement.toAiTreasury).toBe(parseUsdc(s.toAiTreasury));
          expect(await admin.claimable(h.a.treasury)).toBe(parseUsdc(s.toTreasury));
          expect(await admin.claimable(h.a.aiTreasury)).toBe(parseUsdc(s.toAiTreasury));

          const refunds: Record<string, bigint> = {};
          for (const [lbl, addr] of payers) {
            refunds[lbl] ??= 0n;
            if (await admin.isRefundable(caseId)) refunds[lbl] += (await admin.claimRefund(caseId, addr)).amount;
            else await expectCode(admin.claimRefund(caseId, addr), "NotRefundable");
          }
          for (const [lbl, amt] of Object.entries(s.refunds)) if (lbl !== "sponsor") expect(refunds[lbl] ?? 0n).toBe(parseUsdc(amt));

          const bond = (await admin.caseTerms(caseId)).bond;
          for (let i = 0; i < jurors.length; i++) {
            const timely = s.attendance[i] === 0 || s.attendance[i] === 1;
            if (timely) expect((await h.port(jurors[i]).withdraw()).amount).toBe(parseUsdc(s.payoutPerTimelyJuror));
            else await expectCode(h.port(jurors[i]).withdraw(), "NothingToClaim");
            const net = (await admin.usdcBalance(jurors[i])) - before.get(jurors[i])!;
            expect(net).toBe(timely ? parseUsdc(s.payoutPerTimelyJuror) - bond : -bond);
          }
          for (const t of [h.a.treasury, h.a.aiTreasury]) if ((await admin.claimable(t)) > 0n) await h.port(t).withdraw();
          expect(await h.courtBalance()).toBe((await admin.reserve()).balance);
        });
      }
    });

    describe("lifecycle and error codes", () => {
      it("phases, early reveal and early verdict", async () => {
        const h = await make();
        const admin = h.port(h.a.admin);
        const { caseId } = await h.port(h.a.creator).fileSolo({ contentHash: CONTENT });
        expect(await admin.phaseOf(caseId)).toBe(Phase.Recruiting);
        expect(await admin.quote(Mode.Solo, true, false)).toBe(parseUsdc("1.20"));
        const jurors = await fillJury(h, caseId);
        await h.port(h.a.operator).openCourt(caseId, TRANSCRIPT);
        expect(await admin.phaseOf(caseId)).toBe(Phase.Commit);
        const c0 = await admin.getCase(caseId);
        for (const j of jurors) {
          await expectCode(h.port(j).revealVote(caseId, 0, (await seal(h, caseId, j, 0)).salt), "RevealNotOpen");
          await h.port(j).commitVote(caseId, (await seal(h, caseId, j, 1)).commitment);
        }
        // everyone committed: reveal opens early, deadlines unchanged
        expect(await admin.phaseOf(caseId)).toBe(Phase.Reveal);
        expect((await admin.getCase(caseId)).revealDeadline).toBe(c0.revealDeadline);
        await expectCode(h.port(jurors[0]).commitVote(caseId, (await seal(h, caseId, jurors[0], 0)).commitment), "CommitClosed");
        await expectCode(h.port(jurors[0]).revealVote(caseId, 0, (await seal(h, caseId, jurors[0], 1)).salt), "CommitmentMismatch");
        await expectCode(admin.finalize(caseId), "NotFinalizable");
        for (const j of jurors) await h.port(j).revealVote(caseId, 1, (await seal(h, caseId, j, 1)).salt);
        expect(await admin.phaseOf(caseId)).toBe(Phase.Finalizable);
        const { settlement } = await admin.finalize(caseId);
        expect(settlement.outcome).toBe(Outcome.Choice1);
        expect(BALLOT_LABELS[Mode.Solo]![1]).toBe("NOT COOKED");
        expect((await admin.getCase(caseId)).status).toBe(Status.Finalized);
      });

      it("seat gating: offers, verification, parties on other wallets, one seat per human", async () => {
        const h = await make();
        const { caseId } = await h.port(h.a.creator).fileSolo({ contentHash: CONTENT });
        const [j0, j1] = h.a.jurors;
        const stranger = h.a.others[3];
        // offer for someone else
        await expectCode(h.port(j1).acceptSeat({ ...(await h.seatOffer(caseId, j0)), juror: j1 }), "InvalidSeatOffer");
        // expired offer
        await expectCode(h.port(j0).acceptSeat(await h.seatOffer(caseId, j0, 0n)), "OfferExpired");
        // unverified wallet
        await expectCode(h.port(stranger).acceptSeat(await h.seatOffer(caseId, stranger)), "JurorNotVerified");
        // device-level is not enough for a paid seat
        await h.attest(stranger, humanIdOf("stranger"), Level.DEVICE);
        await expectCode(h.port(stranger).acceptSeat(await h.seatOffer(caseId, stranger)), "JurorNotVerified");
        // the filer, verified again on a fresh wallet, still can't judge their own case
        const alt = h.a.others[4];
        await h.attest(alt, humanIdOf("creator"), Level.ORB);
        await expectCode(h.port(alt).acceptSeat(await h.seatOffer(caseId, alt)), "PartyCannotServe");
        await expectCode(h.port(h.a.creator).acceptSeat(await h.seatOffer(caseId, h.a.creator)), "PartyCannotServe");
        // one seat per human, across wallets
        await h.port(j0).acceptSeat(await h.seatOffer(caseId, j0));
        await expectCode(h.port(j0).acceptSeat(await h.seatOffer(caseId, j0)), "AlreadySeated");
        const j0b = h.a.others[2];
        await h.attest(j0b, humanIdOf("juror0"), Level.ORB);
        await expectCode(h.port(j0b).acceptSeat(await h.seatOffer(caseId, j0b)), "HumanAlreadySeated");
      });

      it("timeouts refund everyone and slash nobody", async () => {
        const h = await make();
        const admin = h.port(h.a.admin);
        // Versus consent expires
        const v = (await h.port(h.a.creator).openVersus({ sideB: h.a.sideB, contentHash: CONTENT })).caseId;
        expect(await admin.phaseOf(v)).toBe(Phase.AwaitingCounterparty);
        await expectCode(admin.cancelExpired(v), "NotExpired");
        // jury not filled on a solo case
        const s = (await h.port(h.a.creator).fileSolo({ contentHash: CONTENT })).caseId;
        await h.port(h.a.jurors[0]).acceptSeat(await h.seatOffer(s, h.a.jurors[0]));
        const vc = await admin.getCase(v);
        await h.advanceTo(vc.pendingDeadline);
        expect(await admin.phaseOf(v)).toBe(Phase.Expired);
        await expectCode(h.port(h.a.sideB).joinVersus(v), "DeadlinePassed");
        expect((await admin.cancelExpired(v)).reason).toBe(CancelReason.ConsentExpired);
        expect((await admin.claimRefund(v, h.a.creator)).amount).toBe(parseUsdc("0.70"));
        expect((await admin.cancelExpired(s)).reason).toBe(CancelReason.JuryNotFilled);
        expect(await admin.claimable(h.a.jurors[0])).toBe(parseUsdc("0.40"));
        expect((await admin.claimRefund(s, h.a.creator)).amount).toBe(parseUsdc("1.20"));
        await expectCode(admin.claimRefund(s, h.a.creator), "NothingToClaim");
      });

      it("protective cancel pays committed jurors the stipend from the platform reserve", async () => {
        const h = await make();
        const admin = h.port(h.a.admin);
        const { caseId } = await h.port(h.a.creator).fileSolo({ contentHash: CONTENT });
        const jurors = await fillJury(h, caseId);
        await h.port(h.a.operator).openCourt(caseId, TRANSCRIPT);
        expect((await admin.reserve()).locked).toBe(parseUsdc("0.60"));
        await h.port(jurors[0]).commitVote(caseId, (await seal(h, caseId, jurors[0], 0)).commitment);
        await expectCode(h.port(h.a.creator).protectiveCancel(caseId), "AccessControlUnauthorizedAccount");
        await h.port(h.a.operator).protectiveCancel(caseId);
        expect(await admin.claimable(jurors[0])).toBe(parseUsdc("0.60"));
        expect(await admin.claimable(jurors[1])).toBe(parseUsdc("0.40"));
        expect(await admin.reserve()).toEqual({ balance: parseUsdc("49.80"), locked: 0n });
        expect((await admin.getCase(caseId)).cancelReason).toBe(CancelReason.ProtectiveCancel);
      });

      it("grand jury: marketing cap, sponsor floor, capped contributions, pass rules", async () => {
        const h = await make({ pricing: "launch" });
        const curator = h.port(h.a.curator);
        await expectCode(curator.publishGrandJury({ contentHash: CONTENT }), "SponsorRequired");
        await expectCode(h.port(h.a.creator).publishGrandJury({ contentHash: CONTENT }), "AccessControlUnauthorizedAccount");
        const { caseId } = await curator.publishGrandJury({ contentHash: CONTENT, sponsor: h.a.sponsor, sponsorAmount: parseUsdc("2.00") });
        const c = await curator.getCase(caseId);
        expect(c.sponsored).toBe(true);
        expect(c.target).toBe(parseUsdc("7.80"));
        await expectCode(h.port(h.a.others[0]).contribute(caseId, parseUsdc("0.05")), "BelowMinContribution");
        await h.port(h.a.others[0]).contribute(caseId, parseUsdc("7.75"));
        expect((await h.port(h.a.others[1]).contribute(caseId, parseUsdc("1"))).accepted).toBe(parseUsdc("0.05"));
        expect(await curator.phaseOf(caseId)).toBe(Phase.Recruiting);
        await expectCode(h.port(h.a.creator).fileSolo({ contentHash: CONTENT, usePass: true }), "PassDisabled");
        await expectCode(h.port(h.a.others[5]).fileSolo({ contentHash: CONTENT }), "PartyNotVerified");
        await expectCode(h.port(h.a.creator).openVersus({ sideB: zeroAddress, contentHash: CONTENT }), "ZeroAddress");
      });

      it("a sealed scroll round-trips and reveals", async () => {
        const h = await make();
        const { caseId } = await h.port(h.a.creator).fileSolo({ contentHash: CONTENT });
        const jurors = await fillJury(h, caseId);
        await h.port(h.a.operator).openCourt(caseId, TRANSCRIPT);
        const p = h.port(jurors[0]);
        const sealed = sealBallot({ chainId: p.chainId, court: p.court, caseId, juror: jurors[0], choice: 1 });
        expect(await p.commitmentOf(caseId, jurors[0], 1, sealed.salt)).toBe(sealed.commitment);
        await p.commitVote(caseId, sealed.commitment);
        await h.advanceTo((await p.getCase(caseId)).commitDeadline);
        const scroll = decodeScroll(sealed.scroll);
        await p.revealVote(scroll.caseId, scroll.choice, scroll.salt);
        expect((await p.jurorOf(caseId, jurors[0])).revealed).toBe(true);
      });
    });
  });
}
