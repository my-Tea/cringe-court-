/**
 * In-memory CringeCourt: the same state machine, checks (in the same order),
 * custom-error names and settlement as contracts/src/CringeCourt.sol, plus a
 * tiny ERC-20 and HumanRegistry. Every write is atomic: a revert restores the
 * previous state, like the EVM. The shared settlement oracle
 * (contracts/test/fixtures/settlement-scenarios.json) and the conformance suite
 * run against both this and the real contracts.
 */
import { getAddress, keccak256, recoverTypedDataAddress, toHex } from "viem";
import { CourtError } from "./errors.js";
import { commitmentOf } from "./commitment.js";
import { SEAT_OFFER_TYPES, seatOfferDomain } from "./seat-offer.js";
import { jurySize, poolOf, settle, sideShare, MAX_N } from "./settlement.js";
import { buildTerms, type Pricing, type Timing, termsConfig } from "./terms.js";
import type { ChainPort, CourtEvent, TxResult } from "./port.js";
import {
  CancelReason, Mode, Outcome, Phase, Status, ZERO_ADDRESS, ZERO_HASH,
  type Address, type CaseView, type Choice, type Hex, type JurorView, type SeatOffer, type Settlement, type Terms,
} from "./types.js";

export const ROLES = {
  DEFAULT_ADMIN: ZERO_HASH,
  OPERATOR: keccak256(toHex("OPERATOR_ROLE")),
  ASSIGNER: keccak256(toHex("ASSIGNER_ROLE")),
  CURATOR: keccak256(toHex("CURATOR_ROLE")),
  ATTESTER: keccak256(toHex("ATTESTER_ROLE")),
} as const;

export const MOCK_COURT_ADDRESS: Address = "0x00000000000000000000000000000000C0DEC0DE";

interface Attestation {
  humanId: Hex;
  level: number;
  expiresAt: bigint;
}

interface State {
  time: bigint;
  txCount: number;
  balances: Map<Address, bigint>;
  allowances: Map<Address, bigint>; // owner -> allowance to the court
  roles: Map<Hex, Set<Address>>;
  attestations: Map<Address, Attestation>;
  walletOfHuman: Map<Hex, Address>;
  treasury: Address;
  aiTreasury: Address;
  caseCount: bigint;
  reserveBalance: bigint;
  reserveLocked: bigint;
  marketingCap: number;
  marketingUsed: number;
  terms: Map<Mode, Terms>;
  cases: Map<bigint, CaseView>;
  caseTerms: Map<bigint, Terms>;
  jurorList: Map<bigint, Address[]>;
  jurors: Map<string, JurorView>; // `${caseId}:${juror}`
  humanSeated: Set<string>; // `${caseId}:${humanId}`
  paidBy: Map<string, bigint>; // `${caseId}:${payer}`
  claimable: Map<Address, bigint>;
}

export interface MemoryChainOptions {
  chainId?: bigint;
  timing?: Timing;
  pricing?: Pricing;
  /** Starting unix time (seconds). Default 2026-11-03T00:00:00Z. */
  startTime?: bigint;
  admin?: Address;
  treasury?: Address;
  aiTreasury?: Address;
}

const norm = (a: string): Address => getAddress(a) as Address;
const k = (caseId: bigint, a: string) => `${caseId}:${a.toLowerCase()}`;
const err = (code: string, ...args: unknown[]) => new CourtError(code, args);

function emptyCase(): CaseView {
  return {
    mode: Mode.Solo, status: Status.None, outcome: Outcome.None, cancelReason: CancelReason.None,
    jurySize: 0, seated: 0, committed: 0, revealed: 0, votes0: 0, votes1: 0, sponsored: false,
    creator: ZERO_ADDRESS, counterparty: ZERO_ADDRESS, sponsor: ZERO_ADDRESS,
    creatorHuman: ZERO_HASH, counterpartyHuman: ZERO_HASH, contentHash: ZERO_HASH, transcriptHash: ZERO_HASH,
    createdAt: 0n, pendingDeadline: 0n, recruitDeadline: 0n, prepDeadline: 0n, commitDeadline: 0n, revealDeadline: 0n,
    target: 0n, raised: 0n, poolHeld: 0n, protocolFeeHeld: 0n, aiFeeHeld: 0n, sponsorDeposit: 0n, stipendLocked: 0n,
  };
}

const emptyTerms = (): Terms => ({
  n: 0, minJurorLevel: 0, minPartyLevel: 0, enabled: false, passEnabled: false, demoTiming: false,
  bond: 0n, successBonus: 0n, failedTrialBonus: 0n, protocolFee: 0n, aiFeePerAgent: 0n, incidentStipend: 0n,
  minContribution: 0n, sponsorFloor: 0n, pendingWindow: 0, recruitWindow: 0, prepWindow: 0, commitWindow: 0, revealWindow: 0,
});

const emptyJuror = (): JurorView => ({ seated: false, revealed: false, seat: 0, choice: 0, humanId: ZERO_HASH, commitment: ZERO_HASH });

export class MemoryChain {
  readonly chainId: bigint;
  readonly court: Address = norm(MOCK_COURT_ADDRESS);
  private s: State;
  private listeners = new Set<(e: CourtEvent) => void>();
  private pending: CourtEvent[] = [];

  constructor(opts: MemoryChainOptions = {}) {
    this.chainId = opts.chainId ?? 31337n;
    const admin = norm(opts.admin ?? "0x000000000000000000000000000000000000AD01");
    this.s = {
      time: opts.startTime ?? 1793750400n,
      txCount: 0,
      balances: new Map(),
      allowances: new Map(),
      roles: new Map([[ROLES.DEFAULT_ADMIN, new Set([admin])]]),
      attestations: new Map(),
      walletOfHuman: new Map(),
      treasury: norm(opts.treasury ?? "0x0000000000000000000000000000000000007EA5"),
      aiTreasury: norm(opts.aiTreasury ?? "0x00000000000000000000000000000000000000A1"),
      caseCount: 0n,
      reserveBalance: 0n,
      reserveLocked: 0n,
      marketingCap: termsConfig.marketingCap[opts.pricing ?? "hackathon"],
      marketingUsed: 0,
      terms: new Map(),
      cases: new Map(),
      caseTerms: new Map(),
      jurorList: new Map(),
      jurors: new Map(),
      humanSeated: new Set(),
      paidBy: new Map(),
      claimable: new Map(),
    };
    for (const m of [Mode.Solo, Mode.Versus, Mode.GrandJury]) {
      this.s.terms.set(m, buildTerms(m, opts.timing ?? "production", opts.pricing ?? "hackathon"));
    }
    this.adminAddress = admin;
  }

  readonly adminAddress: Address;

  // ------------------------------------------------------------------ harness

  /** A ChainPort acting as `account` over this shared state. */
  as(account: Address): ChainPort {
    return new MemoryPort(this, norm(account));
  }

  get treasury(): Address { return this.s.treasury; }
  get aiTreasury(): Address { return this.s.aiTreasury; }

  now(): bigint { return this.s.time; }
  advance(seconds: number | bigint): void { this.s.time += BigInt(seconds); }
  setTime(t: bigint): void {
    if (t < this.s.time) throw new Error("time only moves forward");
    this.s.time = t;
  }

  mint(to: Address, amount: bigint): void {
    const a = norm(to);
    this.s.balances.set(a, (this.s.balances.get(a) ?? 0n) + amount);
  }
  grantRole(role: Hex, account: Address): void {
    const set = this.s.roles.get(role) ?? new Set<Address>();
    set.add(norm(account));
    this.s.roles.set(role, set);
  }
  hasRole(role: Hex, account: Address): boolean {
    return this.s.roles.get(role)?.has(norm(account)) ?? false;
  }
  courtBalance(): bigint { return this.s.balances.get(this.court) ?? 0n; }

  /** Snapshot of all state (for assertions and time-travel in demos). */
  snapshot(): State { return structuredClone(this.s); }
  restore(snap: State): void { this.s = structuredClone(snap); }

  // ------------------------------------------------------------------ events

  onEvent(listener: (e: CourtEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(name: string, args: Record<string, unknown>) {
    this.pending.push({ name, args });
  }

  /** Runs `fn` atomically as one transaction. */
  tx<T>(fn: () => T): T & TxResult {
    const snap = structuredClone(this.s);
    this.pending = [];
    try {
      const out = fn();
      this.s.txCount += 1;
      const txHash = keccak256(toHex(`memory-tx-${this.s.txCount}`));
      const events = this.pending;
      this.pending = [];
      for (const e of events) {
        e.txHash = txHash;
        for (const l of this.listeners) l(e);
      }
      return { ...(out as object), txHash } as T & TxResult;
    } catch (e) {
      this.s = snap;
      this.pending = [];
      throw e;
    }
  }

  // ------------------------------------------------------------------ ERC-20 (court-facing)

  balanceOf(a: Address): bigint { return this.s.balances.get(norm(a)) ?? 0n; }
  allowance(owner: Address): bigint { return this.s.allowances.get(norm(owner)) ?? 0n; }
  approve(owner: Address, amount: bigint) {
    return this.tx(() => {
      this.s.allowances.set(norm(owner), amount);
      return {};
    });
  }
  private transferFrom(from: Address, amount: bigint) {
    const allowance = this.allowance(from);
    if (allowance < amount) throw err("ERC20InsufficientAllowance", this.court, allowance, amount);
    const bal = this.balanceOf(from);
    if (bal < amount) throw err("ERC20InsufficientBalance", from, bal, amount);
    if (allowance !== 2n ** 256n - 1n) this.s.allowances.set(from, allowance - amount);
    this.s.balances.set(from, bal - amount);
    this.s.balances.set(this.court, this.courtBalance() + amount);
  }
  private transferOut(to: Address, amount: bigint) {
    this.s.balances.set(this.court, this.courtBalance() - amount);
    this.s.balances.set(to, this.balanceOf(to) + amount);
  }

  // ------------------------------------------------------------------ HumanRegistry

  attest(attester: Address, wallet: Address, humanId: Hex, level: number, expiresAt: bigint) {
    return this.tx(() => {
      this.onlyRole(ROLES.ATTESTER, attester);
      const w = norm(wallet);
      if (w === ZERO_ADDRESS) throw err("ZeroWallet");
      if (humanId === ZERO_HASH) throw err("ZeroHumanId");
      if (level === 0 || level > 3) throw err("InvalidLevel", level);
      if (expiresAt <= this.s.time) throw err("AlreadyExpired", expiresAt);
      const current = this.s.attestations.get(w)?.humanId;
      if (current && current !== humanId) throw err("WalletBoundToOtherHuman", w, current);
      const previous = this.s.walletOfHuman.get(humanId);
      if (previous && previous !== w) {
        this.s.attestations.delete(previous);
        this.emit("Revoked", { wallet: previous, humanId });
      }
      this.s.attestations.set(w, { humanId, level, expiresAt });
      this.s.walletOfHuman.set(humanId, w);
      this.emit("Attested", { wallet: w, humanId, level, expiresAt });
      return {};
    });
  }

  revoke(attester: Address, wallet: Address) {
    return this.tx(() => {
      this.onlyRole(ROLES.ATTESTER, attester);
      const w = norm(wallet);
      const a = this.s.attestations.get(w);
      if (!a) throw err("NotAttested", w);
      this.s.attestations.delete(w);
      this.s.walletOfHuman.delete(a.humanId);
      this.emit("Revoked", { wallet: w, humanId: a.humanId });
      return {};
    });
  }

  humanOf(wallet: Address): { humanId: Hex; level: number } {
    const a = this.s.attestations.get(norm(wallet));
    if (!a || a.expiresAt <= this.s.time) return { humanId: ZERO_HASH, level: 0 };
    return { humanId: a.humanId, level: a.level };
  }

  // ------------------------------------------------------------------ admin

  private onlyRole(role: Hex, account: Address) {
    if (!this.hasRole(role, account)) throw err("AccessControlUnauthorizedAccount", account, role);
  }

  setTerms(sender: Address, mode: Mode, t: Terms) {
    return this.tx(() => {
      this.onlyRole(ROLES.DEFAULT_ADMIN, sender);
      validateTerms(mode, t);
      this.s.terms.set(mode, { ...t });
      this.emit("TermsUpdated", { mode, terms: t });
      return {};
    });
  }

  setTreasuries(sender: Address, treasury: Address, aiTreasury: Address) {
    return this.tx(() => {
      this.onlyRole(ROLES.DEFAULT_ADMIN, sender);
      if (norm(treasury) === ZERO_ADDRESS || norm(aiTreasury) === ZERO_ADDRESS) throw err("ZeroAddress");
      this.s.treasury = norm(treasury);
      this.s.aiTreasury = norm(aiTreasury);
      this.emit("TreasuryUpdated", { treasury, aiTreasury });
      return {};
    });
  }

  setMarketingCap(sender: Address, cap: number) {
    return this.tx(() => {
      this.onlyRole(ROLES.DEFAULT_ADMIN, sender);
      this.s.marketingCap = cap;
      this.emit("MarketingCapUpdated", { cap });
      return {};
    });
  }

  withdrawReserve(sender: Address, amount: bigint, to: Address) {
    return this.tx(() => {
      this.onlyRole(ROLES.DEFAULT_ADMIN, sender);
      if (norm(to) === ZERO_ADDRESS) throw err("ZeroAddress");
      const free = this.s.reserveBalance - this.s.reserveLocked;
      if (amount > free) throw err("InsufficientReserve", amount, free);
      this.s.reserveBalance -= amount;
      this.transferOut(norm(to), amount);
      this.emit("ReserveWithdrawn", { to, amount });
      return {};
    });
  }

  fundReserve(sender: Address, amount: bigint) {
    return this.tx(() => {
      if (amount === 0n) throw err("ZeroValue");
      this.s.reserveBalance += amount;
      this.transferFrom(sender, amount);
      this.emit("ReserveFunded", { from: sender, amount });
      return {};
    });
  }

  // ------------------------------------------------------------------ cases

  private requireEnabled(mode: Mode): Terms {
    const t = this.s.terms.get(mode)!;
    if (!t.enabled) throw err("ModeDisabled", mode);
    return t;
  }

  private requireParty(party: Address, t: Terms): Hex {
    const { humanId, level } = this.humanOf(party);
    if (t.minPartyLevel > 0 && (humanId === ZERO_HASH || level < t.minPartyLevel)) throw err("PartyNotVerified", party);
    return humanId;
  }

  private createCase(mode: Mode, t: Terms, contentHash: Hex): bigint {
    if (contentHash === ZERO_HASH) throw err("ZeroValue");
    const id = ++this.s.caseCount;
    this.s.caseTerms.set(id, { ...t });
    const c = emptyCase();
    c.mode = mode;
    c.jurySize = jurySize(t.n);
    c.contentHash = contentHash;
    c.createdAt = this.s.time;
    this.s.cases.set(id, c);
    this.s.jurorList.set(id, []);
    return id;
  }

  private case(id: bigint): CaseView {
    let c = this.s.cases.get(id);
    if (!c) {
      c = emptyCase();
      this.s.cases.set(id, c);
    }
    return c;
  }

  private collect(id: bigint, payer: Address, amount: bigint, passUsed: boolean) {
    if (amount === 0n) throw err("ZeroValue");
    const c = this.case(id);
    c.raised += amount;
    this.s.paidBy.set(k(id, payer), (this.s.paidBy.get(k(id, payer)) ?? 0n) + amount);
    this.emit("PaymentReceived", { caseId: id, payer, amount, passUsed });
    this.transferFrom(payer, amount);
  }

  private openRecruitment(c: CaseView, id: bigint, t: Terms) {
    c.status = Status.Recruiting;
    c.recruitDeadline = this.s.time + BigInt(t.recruitWindow);
    this.emit("RecruitmentOpened", { caseId: id, recruitDeadline: c.recruitDeadline });
  }

  fileSolo(sender: Address, contentHash: Hex, usePass: boolean) {
    return this.tx(() => {
      const t = this.requireEnabled(Mode.Solo);
      if (usePass && !t.passEnabled) throw err("PassDisabled");
      const human = this.requireParty(sender, t);
      const caseId = this.createCase(Mode.Solo, t, contentHash);
      const c = this.case(caseId);
      c.creator = sender;
      c.creatorHuman = human;
      c.poolHeld = poolOf(t.n, t.successBonus);
      c.protocolFeeHeld = t.protocolFee;
      c.aiFeeHeld = usePass ? 0n : t.aiFeePerAgent;
      c.target = c.poolHeld + c.protocolFeeHeld + c.aiFeeHeld;
      this.emit("CaseCreated", { caseId, mode: Mode.Solo, creator: sender, counterparty: ZERO_ADDRESS, contentHash });
      this.collect(caseId, sender, c.target, usePass);
      this.openRecruitment(c, caseId, t);
      return { caseId };
    });
  }

  private payVersusSide(c: CaseView, id: bigint, t: Terms, payer: Address, sideA: boolean, usePass: boolean) {
    const poolPart = sideShare(poolOf(t.n, t.successBonus), sideA);
    const feePart = sideShare(t.protocolFee, sideA);
    const aiPart = usePass ? 0n : t.aiFeePerAgent;
    c.poolHeld += poolPart;
    c.protocolFeeHeld += feePart;
    c.aiFeeHeld += aiPart;
    const amount = poolPart + feePart + aiPart;
    c.target += amount;
    this.collect(id, payer, amount, usePass);
  }

  openVersus(sender: Address, sideB: Address, contentHash: Hex, usePass: boolean) {
    return this.tx(() => {
      const t = this.requireEnabled(Mode.Versus);
      const b = norm(sideB);
      if (b === ZERO_ADDRESS) throw err("ZeroAddress");
      if (b === sender) throw err("SamePerson");
      if (usePass && !t.passEnabled) throw err("PassDisabled");
      const human = this.requireParty(sender, t);
      const caseId = this.createCase(Mode.Versus, t, contentHash);
      const c = this.case(caseId);
      c.creator = sender;
      c.counterparty = b;
      c.creatorHuman = human;
      c.status = Status.Pending;
      c.pendingDeadline = this.s.time + BigInt(t.pendingWindow);
      this.emit("CaseCreated", { caseId, mode: Mode.Versus, creator: sender, counterparty: b, contentHash });
      this.payVersusSide(c, caseId, t, sender, true, usePass);
      return { caseId };
    });
  }

  joinVersus(sender: Address, id: bigint, usePass: boolean) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.mode !== Mode.Versus || c.status === Status.None) throw err("WrongMode");
      if (sender !== c.counterparty) throw err("NotCounterparty");
      if (c.status !== Status.Pending) throw err("WrongStatus", c.status);
      if (this.s.time >= c.pendingDeadline) throw err("DeadlinePassed", c.pendingDeadline);
      const t = this.s.caseTerms.get(id)!;
      if (usePass && !t.passEnabled) throw err("PassDisabled");
      const human = this.requireParty(sender, t);
      if (human !== ZERO_HASH && human === c.creatorHuman) throw err("SamePerson");
      c.counterpartyHuman = human;
      this.payVersusSide(c, id, t, sender, false, usePass);
      this.openRecruitment(c, id, t);
      return {};
    });
  }

  withdrawInvite(sender: Address, id: bigint) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.mode !== Mode.Versus || c.status === Status.None) throw err("WrongMode");
      if (sender !== c.creator) throw err("NotCreator");
      if (c.status !== Status.Pending) throw err("WrongStatus", c.status);
      this.cancel(c, id, CancelReason.InviteWithdrawn);
      return {};
    });
  }

  publishGrandJury(sender: Address, contentHash: Hex, sponsor: Address, sponsorAmount: bigint) {
    return this.tx(() => {
      this.onlyRole(ROLES.CURATOR, sender);
      const t = this.requireEnabled(Mode.GrandJury);
      const sp = norm(sponsor);
      if (sponsorAmount > 0n && sp === ZERO_ADDRESS) throw err("ZeroAddress");
      const sponsored = t.sponsorFloor > 0n && sponsorAmount >= t.sponsorFloor;
      if (t.sponsorFloor > 0n && !sponsored) {
        if (this.s.marketingUsed >= this.s.marketingCap) {
          if (this.s.marketingCap === 0) throw err("SponsorRequired", t.sponsorFloor);
          throw err("MarketingCapReached", this.s.marketingCap);
        }
        this.s.marketingUsed += 1;
      }
      const caseId = this.createCase(Mode.GrandJury, t, contentHash);
      const c = this.case(caseId);
      c.creator = sender;
      c.status = Status.Pending;
      c.pendingDeadline = this.s.time + BigInt(t.pendingWindow);
      c.target = poolOf(t.n, t.successBonus) + t.protocolFee + t.aiFeePerAgent;
      c.sponsored = sponsored;
      this.emit("CaseCreated", { caseId, mode: Mode.GrandJury, creator: sender, counterparty: ZERO_ADDRESS, contentHash });
      if (sponsorAmount > 0n) {
        c.sponsor = sp;
        c.sponsorDeposit = sponsorAmount;
        this.transferFrom(sp, sponsorAmount);
        this.emit("SponsorDeposited", { caseId, sponsor: sp, amount: sponsorAmount, sponsored });
      }
      return { caseId };
    });
  }

  contribute(sender: Address, id: bigint, amount: bigint) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.mode !== Mode.GrandJury || c.status === Status.None) throw err("WrongMode");
      if (c.status !== Status.Pending) throw err("WrongStatus", c.status);
      if (this.s.time >= c.pendingDeadline) throw err("DeadlinePassed", c.pendingDeadline);
      const t = this.s.caseTerms.get(id)!;
      const remaining = c.target - c.raised;
      const accepted = amount < remaining ? amount : remaining;
      if (accepted < t.minContribution && accepted < remaining) throw err("BelowMinContribution", t.minContribution);
      this.collect(id, sender, accepted, false);
      if (c.raised === c.target) {
        c.poolHeld = poolOf(t.n, t.successBonus);
        c.protocolFeeHeld = t.protocolFee;
        c.aiFeeHeld = t.aiFeePerAgent;
        this.openRecruitment(c, id, t);
      }
      return { accepted };
    });
  }

  /** Recovers the EIP-712 signer outside the synchronous transaction. */
  async recoverSeatOfferSigner(offer: SeatOffer): Promise<Address | null> {
    try {
      return norm(
        await recoverTypedDataAddress({
          domain: seatOfferDomain(this.chainId, this.court),
          types: SEAT_OFFER_TYPES,
          primaryType: "SeatOffer",
          message: { caseId: offer.caseId, juror: offer.juror, expiresAt: offer.expiresAt },
          signature: offer.signature,
        }),
      );
    } catch {
      return null;
    }
  }

  acceptSeat(sender: Address, id: bigint, expiresAt: bigint, signer: Address | null, offerJuror: Address, offerCaseId: bigint) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.status !== Status.Recruiting) throw err("WrongStatus", c.status);
      if (this.s.time >= c.recruitDeadline) throw err("DeadlinePassed", c.recruitDeadline);
      if (this.s.time >= expiresAt) throw err("OfferExpired");
      // The contract hashes (caseId, msg.sender, expiresAt): an offer for another juror or case recovers a different signer.
      const valid = signer !== null && norm(offerJuror) === sender && offerCaseId === id && this.hasRole(ROLES.ASSIGNER, signer);
      if (!valid) {
        if (signer === null) throw err("ECDSAInvalidSignature");
        throw err("InvalidSeatOffer");
      }
      const key = k(id, sender);
      const j = this.s.jurors.get(key) ?? emptyJuror();
      if (j.seated) throw err("AlreadySeated");
      if (sender === c.creator || sender === c.counterparty || sender === c.sponsor) throw err("PartyCannotServe");
      const t = this.s.caseTerms.get(id)!;
      const { humanId, level } = this.humanOf(sender);
      if (humanId === ZERO_HASH || level < t.minJurorLevel) throw err("JurorNotVerified");
      if (humanId === c.creatorHuman || humanId === c.counterpartyHuman) throw err("PartyCannotServe");
      if (this.s.humanSeated.has(k(id, humanId))) throw err("HumanAlreadySeated");
      j.seated = true;
      j.seat = c.seated;
      j.humanId = humanId;
      this.s.jurors.set(key, j);
      this.s.humanSeated.add(k(id, humanId));
      this.s.jurorList.get(id)!.push(sender);
      c.seated += 1;
      this.emit("SeatAccepted", { caseId: id, juror: sender, seat: j.seat });
      this.transferFrom(sender, t.bond);
      if (c.seated === c.jurySize) {
        c.status = Status.Preparing;
        c.prepDeadline = this.s.time + BigInt(t.prepWindow);
        this.emit("JuryFilled", { caseId: id, prepDeadline: c.prepDeadline });
      }
      return {};
    });
  }

  openCourt(sender: Address, id: bigint, transcriptHash: Hex) {
    return this.tx(() => {
      this.onlyRole(ROLES.OPERATOR, sender);
      const c = this.case(id);
      if (c.status !== Status.Preparing) throw err("WrongStatus", c.status);
      if (this.s.time >= c.prepDeadline) throw err("DeadlinePassed", c.prepDeadline);
      if (transcriptHash === ZERO_HASH) throw err("ZeroValue");
      const t = this.s.caseTerms.get(id)!;
      const stipends = BigInt(c.jurySize) * t.incidentStipend;
      const free = this.s.reserveBalance - this.s.reserveLocked;
      if (stipends > free) throw err("InsufficientReserve", stipends, free);
      this.s.reserveLocked += stipends;
      c.stipendLocked = stipends;
      c.transcriptHash = transcriptHash;
      c.status = Status.Voting;
      c.commitDeadline = this.s.time + BigInt(t.commitWindow);
      c.revealDeadline = c.commitDeadline + BigInt(t.revealWindow);
      this.emit("CourtOpened", { caseId: id, transcriptHash, commitDeadline: c.commitDeadline, revealDeadline: c.revealDeadline });
      return {};
    });
  }

  failPreparation(sender: Address, id: bigint) {
    return this.tx(() => {
      this.onlyRole(ROLES.OPERATOR, sender);
      const c = this.case(id);
      if (c.status !== Status.Preparing) throw err("WrongStatus", c.status);
      this.cancel(c, id, CancelReason.PreparationFailed);
      return {};
    });
  }

  commitVote(sender: Address, id: bigint, commitment: Hex) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.status !== Status.Voting) throw err("WrongStatus", c.status);
      const j = this.s.jurors.get(k(id, sender));
      if (!j?.seated) throw err("NotJuror");
      if (commitment === ZERO_HASH) throw err("ZeroValue");
      if (this.s.time >= c.commitDeadline || c.committed === c.jurySize) throw err("CommitClosed");
      if (j.commitment === ZERO_HASH) c.committed += 1;
      j.commitment = commitment;
      this.emit("VoteCommitted", { caseId: id, juror: sender });
      return {};
    });
  }

  revealVote(sender: Address, id: bigint, choice: number, salt: Hex) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.status !== Status.Voting) throw err("WrongStatus", c.status);
      const j = this.s.jurors.get(k(id, sender));
      if (!j?.seated) throw err("NotJuror");
      if (!this.revealOpen(c)) throw err("RevealNotOpen");
      if (j.commitment === ZERO_HASH) throw err("NoCommitment");
      if (j.revealed) throw err("AlreadyRevealed");
      if (choice > 1) throw err("InvalidChoice");
      if (this.commitmentOf(id, sender, choice as Choice, salt) !== j.commitment) throw err("CommitmentMismatch");
      j.revealed = true;
      j.choice = choice;
      c.revealed += 1;
      if (choice === 0) c.votes0 += 1;
      else c.votes1 += 1;
      this.emit("VoteRevealed", { caseId: id, juror: sender, choice });
      return {};
    });
  }

  finalize(id: bigint) {
    return this.tx(() => {
      const c = this.case(id);
      if (c.status !== Status.Voting) throw err("WrongStatus", c.status);
      if (!this.finalizable(c)) throw err("NotFinalizable");
      const t = this.s.caseTerms.get(id)!;
      const settlement = settle({
        n: t.n, timely: c.revealed, votes0: c.votes0, votes1: c.votes1,
        bond: t.bond, successBonus: t.successBonus, failedTrialBonus: t.failedTrialBonus,
        poolHeld: c.poolHeld, protocolFeeHeld: c.protocolFeeHeld, aiFeeHeld: c.aiFeeHeld,
        sponsorDeposit: c.sponsorDeposit, raised: c.raised,
      });
      c.status = Status.Finalized;
      c.outcome = settlement.outcome;
      this.s.reserveLocked -= c.stipendLocked;
      c.stipendLocked = 0n;
      for (const juror of this.s.jurorList.get(id)!) {
        if (this.s.jurors.get(k(id, juror))!.revealed) this.credit(juror, settlement.payoutPerTimelyJuror);
      }
      this.credit(this.s.treasury, settlement.toTreasury);
      this.credit(this.s.aiTreasury, settlement.toAiTreasury);
      this.emit("CaseFinalized", { caseId: id, settlement });
      return { settlement };
    });
  }

  cancelExpired(id: bigint) {
    return this.tx(() => {
      const c = this.case(id);
      let reason: CancelReason;
      if (c.status === Status.Pending && this.s.time >= c.pendingDeadline) {
        reason = c.mode === Mode.Versus ? CancelReason.ConsentExpired : CancelReason.FundingExpired;
      } else if (c.status === Status.Recruiting && this.s.time >= c.recruitDeadline) {
        reason = CancelReason.JuryNotFilled;
      } else if (c.status === Status.Preparing && this.s.time >= c.prepDeadline) {
        reason = CancelReason.PreparationExpired;
      } else {
        throw err("NotExpired");
      }
      this.cancel(c, id, reason);
      return { reason };
    });
  }

  protectiveCancel(sender: Address, id: bigint) {
    return this.tx(() => {
      this.onlyRole(ROLES.OPERATOR, sender);
      const c = this.case(id);
      const st = c.status;
      if (st !== Status.Pending && st !== Status.Recruiting && st !== Status.Preparing && st !== Status.Voting) {
        throw err("WrongStatus", st);
      }
      if (st === Status.Voting && this.finalizable(c)) throw err("WrongStatus", st);
      this.cancel(c, id, CancelReason.ProtectiveCancel);
      return {};
    });
  }

  claimRefund(id: bigint, payer: Address) {
    return this.tx(() => {
      if (!this.isRefundable(id)) throw err("NotRefundable");
      const p = norm(payer);
      const amount = this.s.paidBy.get(k(id, p)) ?? 0n;
      if (amount === 0n) throw err("NothingToClaim");
      this.s.paidBy.set(k(id, p), 0n);
      this.transferOut(p, amount);
      this.emit("RefundClaimed", { caseId: id, payer: p, amount });
      return { amount };
    });
  }

  withdraw(sender: Address) {
    return this.tx(() => {
      const amount = this.s.claimable.get(sender) ?? 0n;
      if (amount === 0n) throw err("NothingToClaim");
      this.s.claimable.set(sender, 0n);
      this.transferOut(sender, amount);
      this.emit("Withdrawn", { account: sender, amount });
      return { amount };
    });
  }

  // ------------------------------------------------------------------ views

  termsOf(mode: Mode): Terms { return { ...this.s.terms.get(mode)! }; }
  caseTerms(id: bigint): Terms { return { ...(this.s.caseTerms.get(id) ?? emptyTerms()) }; }
  caseCount(): bigint { return this.s.caseCount; }
  getCase(id: bigint): CaseView { return { ...(this.s.cases.get(id) ?? emptyCase()) }; }
  jurorsOf(id: bigint): Address[] { return [...(this.s.jurorList.get(id) ?? [])]; }
  jurorOf(id: bigint, juror: Address): JurorView { return { ...(this.s.jurors.get(k(id, juror)) ?? emptyJuror()) }; }
  claimableOf(a: Address): bigint { return this.s.claimable.get(norm(a)) ?? 0n; }
  paidByOf(id: bigint, a: Address): bigint { return this.s.paidBy.get(k(id, a)) ?? 0n; }
  reserve() { return { balance: this.s.reserveBalance, locked: this.s.reserveLocked }; }
  marketing() { return { cap: this.s.marketingCap, used: this.s.marketingUsed }; }

  isRefundable(id: bigint): boolean {
    const c = this.s.cases.get(id);
    if (!c) return false;
    return c.status === Status.Cancelled || (c.status === Status.Finalized && c.outcome === Outcome.NoVerdict);
  }

  phaseOf(id: bigint): Phase {
    const c = this.s.cases.get(id);
    if (!c || c.status === Status.None) return Phase.None;
    const now = this.s.time;
    if (c.status === Status.Finalized) return Phase.Finalized;
    if (c.status === Status.Cancelled) return Phase.Cancelled;
    if (c.status === Status.Pending) {
      if (now >= c.pendingDeadline) return Phase.Expired;
      return c.mode === Mode.Versus ? Phase.AwaitingCounterparty : Phase.Crowdfunding;
    }
    if (c.status === Status.Recruiting) return now >= c.recruitDeadline ? Phase.Expired : Phase.Recruiting;
    if (c.status === Status.Preparing) return now >= c.prepDeadline ? Phase.Expired : Phase.Preparing;
    if (this.finalizable(c)) return Phase.Finalizable;
    return this.revealOpen(c) ? Phase.Reveal : Phase.Commit;
  }

  quote(mode: Mode, sideA: boolean, usePass: boolean): bigint {
    const t = this.s.terms.get(mode)!;
    const pool = poolOf(t.n, t.successBonus);
    if (mode === Mode.GrandJury) return pool + t.protocolFee + t.aiFeePerAgent;
    const ai = usePass ? 0n : t.aiFeePerAgent;
    if (mode === Mode.Versus) return sideShare(pool, sideA) + sideShare(t.protocolFee, sideA) + ai;
    return pool + t.protocolFee + ai;
  }

  commitmentOf(id: bigint, juror: Address, choice: Choice, salt: Hex): Hex {
    return commitmentOf({ chainId: this.chainId, court: this.court, caseId: id, juror: norm(juror), choice, salt });
  }

  // ------------------------------------------------------------------ internals

  private credit(a: Address, amount: bigint) {
    this.s.claimable.set(a, (this.s.claimable.get(a) ?? 0n) + amount);
  }

  private revealOpen(c: CaseView): boolean {
    return (this.s.time >= c.commitDeadline || c.committed === c.jurySize) && this.s.time < c.revealDeadline;
  }

  private finalizable(c: CaseView): boolean {
    return this.s.time >= c.revealDeadline || c.revealed === c.jurySize;
  }

  private cancel(c: CaseView, id: bigint, reason: CancelReason) {
    const voting = c.status === Status.Voting;
    c.status = Status.Cancelled;
    c.cancelReason = reason;
    const t = this.s.caseTerms.get(id)!;
    let stipendsPaid = 0n;
    for (const juror of this.s.jurorList.get(id)!) {
      let amount = t.bond;
      if (voting && reason === CancelReason.ProtectiveCancel && this.s.jurors.get(k(id, juror))!.commitment !== ZERO_HASH) {
        amount += t.incidentStipend;
        stipendsPaid += t.incidentStipend;
        this.emit("IncidentStipendPaid", { caseId: id, juror, amount: t.incidentStipend });
      }
      this.credit(juror, amount);
    }
    this.s.reserveLocked -= c.stipendLocked;
    this.s.reserveBalance -= stipendsPaid;
    c.stipendLocked = 0n;
    if (c.sponsorDeposit > 0n) this.credit(c.sponsor, c.sponsorDeposit);
    this.emit("CaseCancelled", { caseId: id, reason, stipendsPaid });
  }
}

export function validateTerms(mode: Mode, t: Terms): void {
  const bad = (why: string) => new CourtError("InvalidTerms", [why]);
  if (t.n === 0 || t.n > MAX_N) throw bad("n");
  if (t.bond === 0n) throw bad("bond");
  if (t.failedTrialBonus * 2n * BigInt(t.n) > t.bond) throw bad("failedTrialBonus");
  if (t.recruitWindow === 0 || t.prepWindow === 0 || t.commitWindow === 0 || t.revealWindow === 0) throw bad("window");
  if (mode === Mode.Solo) {
    if (t.pendingWindow !== 0 || t.minContribution !== 0n || t.sponsorFloor !== 0n) throw bad("solo");
  } else if (mode === Mode.Versus) {
    if (t.pendingWindow === 0) throw bad("pendingWindow");
    if (t.minContribution !== 0n || t.sponsorFloor !== 0n) throw bad("versus");
  } else {
    if (t.pendingWindow === 0) throw bad("pendingWindow");
    if (t.passEnabled) throw bad("pass");
    if (poolOf(t.n, t.successBonus) + t.protocolFee + t.aiFeePerAgent === 0n) throw bad("target");
  }
}

class MemoryPort implements ChainPort {
  readonly kind = "memory" as const;
  constructor(private readonly m: MemoryChain, readonly account: Address) {}
  get chainId() { return this.m.chainId; }
  get court() { return this.m.court; }

  async now() { return this.m.now(); }
  async termsOf(mode: Mode) { return this.m.termsOf(mode); }
  async caseTerms(id: bigint) { return this.m.caseTerms(id); }
  async caseCount() { return this.m.caseCount(); }
  async getCase(id: bigint) { return this.m.getCase(id); }
  async jurorsOf(id: bigint) { return this.m.jurorsOf(id); }
  async jurorOf(id: bigint, juror: Address) { return this.m.jurorOf(id, juror); }
  async phaseOf(id: bigint) { return this.m.phaseOf(id); }
  async quote(mode: Mode, sideA: boolean, usePass: boolean) { return this.m.quote(mode, sideA, usePass); }
  async claimable(a: Address) { return this.m.claimableOf(a); }
  async paidBy(id: bigint, a: Address) { return this.m.paidByOf(id, a); }
  async isRefundable(id: bigint) { return this.m.isRefundable(id); }
  async commitmentOf(id: bigint, juror: Address, choice: Choice, salt: Hex) { return this.m.commitmentOf(id, juror, choice, salt); }
  async humanOf(w: Address) { return this.m.humanOf(w); }
  async usdcBalance(a: Address) { return this.m.balanceOf(a); }
  async usdcAllowance(owner: Address) { return this.m.allowance(owner); }
  async reserve() { return this.m.reserve(); }
  async marketing() { return this.m.marketing(); }

  async approveUsdc(amount: bigint) { return this.m.approve(this.account, amount); }
  async fileSolo(p: { contentHash: Hex; usePass?: boolean }) { return this.m.fileSolo(this.account, p.contentHash, !!p.usePass); }
  async openVersus(p: { sideB: Address; contentHash: Hex; usePass?: boolean }) {
    return this.m.openVersus(this.account, p.sideB, p.contentHash, !!p.usePass);
  }
  async joinVersus(id: bigint, usePass = false) { return this.m.joinVersus(this.account, id, usePass); }
  async withdrawInvite(id: bigint) { return this.m.withdrawInvite(this.account, id); }
  async publishGrandJury(p: { contentHash: Hex; sponsor?: Address; sponsorAmount?: bigint }) {
    return this.m.publishGrandJury(this.account, p.contentHash, p.sponsor ?? ZERO_ADDRESS, p.sponsorAmount ?? 0n);
  }
  async contribute(id: bigint, amount: bigint) { return this.m.contribute(this.account, id, amount); }
  async acceptSeat(offer: SeatOffer) {
    const signer = await this.m.recoverSeatOfferSigner(offer);
    return this.m.acceptSeat(this.account, offer.caseId, offer.expiresAt, signer, offer.juror, offer.caseId);
  }
  async openCourt(id: bigint, transcriptHash: Hex) { return this.m.openCourt(this.account, id, transcriptHash); }
  async failPreparation(id: bigint) { return this.m.failPreparation(this.account, id); }
  async protectiveCancel(id: bigint) { return this.m.protectiveCancel(this.account, id); }
  async commitVote(id: bigint, commitment: Hex) { return this.m.commitVote(this.account, id, commitment); }
  async revealVote(id: bigint, choice: Choice, salt: Hex) { return this.m.revealVote(this.account, id, choice, salt); }
  async finalize(id: bigint) { return this.m.finalize(id); }
  async cancelExpired(id: bigint) { return this.m.cancelExpired(id); }
  async claimRefund(id: bigint, payer?: Address) { return this.m.claimRefund(id, payer ?? this.account); }
  async withdraw() { return this.m.withdraw(this.account); }
  async fundReserve(amount: bigint) { return this.m.fundReserve(this.account, amount); }
  onEvent(listener: (e: CourtEvent) => void) { return this.m.onEvent(listener); }
}

export function createMemoryChain(opts: MemoryChainOptions = {}): MemoryChain {
  return new MemoryChain(opts);
}

export type { Settlement };
