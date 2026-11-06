import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { CringeCourt, HumanRegistry, MockUSDC } from "../typechain-types";
import { buildTerms, MODE, type Pricing, type Timing, type ModeId, TERMS } from "../scripts/terms";

export { MODE, buildTerms, TERMS };

export const LEVEL = { NONE: 0, DEVICE: 1, DOCUMENT: 2, ORB: 3 } as const;
export const STATUS = { None: 0, Pending: 1, Recruiting: 2, Preparing: 3, Voting: 4, Finalized: 5, Cancelled: 6 } as const;
export const OUTCOME = { None: 0, Choice0: 1, Choice1: 2, NoVerdict: 3 } as const;
export const CANCEL = {
  None: 0,
  ConsentExpired: 1,
  InviteWithdrawn: 2,
  FundingExpired: 3,
  JuryNotFilled: 4,
  PreparationFailed: 5,
  PreparationExpired: 6,
  ProtectiveCancel: 7,
} as const;
export const PHASE = {
  None: 0,
  AwaitingCounterparty: 1,
  Crowdfunding: 2,
  Recruiting: 3,
  Preparing: 4,
  Commit: 5,
  Reveal: 6,
  Finalizable: 7,
  Expired: 8,
  Finalized: 9,
  Cancelled: 10,
} as const;

/** "0.70" -> 700000n (USDC base units). */
export function usdc(x: string | number): bigint {
  return ethers.parseUnits(String(x), 6);
}

export const CONTENT = ethers.id("approved public case text");
export const TRANSCRIPT = ethers.id("frozen transcript v1");
const FUND = usdc(1000);

export interface World {
  usdcToken: MockUSDC;
  registry: HumanRegistry;
  court: CringeCourt;
  admin: HardhatEthersSigner;
  operator: HardhatEthersSigner;
  assigner: HardhatEthersSigner;
  curator: HardhatEthersSigner;
  attester: HardhatEthersSigner;
  treasury: HardhatEthersSigner;
  aiTreasury: HardhatEthersSigner;
  sponsor: HardhatEthersSigner;
  creator: HardhatEthersSigner;
  sideB: HardhatEthersSigner;
  /** jurors[0..9], each ORB-attested as a distinct human */
  jurors: HardhatEthersSigner[];
  /** extra unattested wallets */
  others: HardhatEthersSigner[];
}

export function humanIdOf(persona: string): string {
  return ethers.id(`human:${persona}`);
}

export async function deployWorld(opts: { timing?: Timing; pricing?: Pricing; reserve?: bigint } = {}): Promise<World> {
  const signers = await ethers.getSigners();
  const [admin, operator, assigner, curator, attester, treasury, aiTreasury, sponsor, creator, sideB] = signers;
  const jurors = signers.slice(10, 20);
  const others = signers.slice(20, 26);

  const usdcToken = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const registry = await (await ethers.getContractFactory("HumanRegistry")).deploy(admin.address, attester.address);
  const court = await (await ethers.getContractFactory("CringeCourt")).deploy(
    await usdcToken.getAddress(),
    await registry.getAddress(),
    admin.address,
    treasury.address,
    aiTreasury.address,
  );

  await court.grantRole(await court.OPERATOR_ROLE(), operator.address);
  await court.grantRole(await court.ASSIGNER_ROLE(), assigner.address);
  await court.grantRole(await court.CURATOR_ROLE(), curator.address);
  const timing = opts.timing ?? "production";
  const pricing = opts.pricing ?? "hackathon";
  for (const m of [MODE.Solo, MODE.Versus, MODE.GrandJury] as ModeId[]) {
    await court.setTerms(m, buildTerms(m, timing, pricing));
  }
  await court.setMarketingCap(TERMS.marketingCap[pricing]);

  const courtAddr = await court.getAddress();
  for (const s of [admin, sponsor, creator, sideB, ...jurors, ...others]) {
    await usdcToken.mint(s.address, FUND);
    await usdcToken.connect(s).approve(courtAddr, ethers.MaxUint256);
  }

  const expiry = (await time.latest()) + 365 * 24 * 3600;
  await registry.connect(attester).attest(creator.address, humanIdOf("creator"), LEVEL.DEVICE, expiry);
  await registry.connect(attester).attest(sideB.address, humanIdOf("sideB"), LEVEL.DEVICE, expiry);
  for (let i = 0; i < jurors.length; i++) {
    await registry.connect(attester).attest(jurors[i].address, humanIdOf(`juror${i}`), LEVEL.ORB, expiry);
  }

  const reserve = opts.reserve ?? usdc(50);
  if (reserve > 0n) await court.connect(admin).fundReserve(reserve);

  return { usdcToken, registry, court, admin, operator, assigner, curator, attester, treasury, aiTreasury, sponsor, creator, sideB, jurors, others };
}

export async function signSeatOffer(w: World, caseId: bigint, juror: string, expiresAt?: number, signer?: HardhatEthersSigner) {
  const exp = expiresAt ?? (await time.latest()) + 600;
  const { chainId } = await ethers.provider.getNetwork();
  const sig = await (signer ?? w.assigner).signTypedData(
    { name: "CringeCourt", version: "1", chainId, verifyingContract: await w.court.getAddress() },
    { SeatOffer: [
      { name: "caseId", type: "uint256" },
      { name: "juror", type: "address" },
      { name: "expiresAt", type: "uint64" },
    ] },
    { caseId, juror, expiresAt: exp },
  );
  return { expiresAt: exp, sig };
}

export async function acceptSeat(w: World, caseId: bigint, juror: HardhatEthersSigner) {
  const { expiresAt, sig } = await signSeatOffer(w, caseId, juror.address);
  return w.court.connect(juror).acceptSeat(caseId, expiresAt, sig);
}

export async function lastCaseId(w: World): Promise<bigint> {
  return w.court.caseCount();
}

export async function fileSolo(w: World, usePass = false): Promise<bigint> {
  await w.court.connect(w.creator).fileSolo(CONTENT, usePass);
  return lastCaseId(w);
}

export async function openAndJoinVersus(w: World, passA = false, passB = false): Promise<bigint> {
  await w.court.connect(w.creator).openVersus(w.sideB.address, CONTENT, passA);
  const id = await lastCaseId(w);
  await w.court.connect(w.sideB).joinVersus(id, passB);
  return id;
}

/** Publishes a Grand Jury case and funds it fully from `contributors` (split as given). */
export async function publishAndFundGrandJury(
  w: World,
  opts: { sponsorAmount?: bigint; contributions?: bigint[] } = {},
): Promise<{ id: bigint; contributors: HardhatEthersSigner[]; amounts: bigint[] }> {
  const sponsorAmount = opts.sponsorAmount ?? 0n;
  await w.court
    .connect(w.curator)
    .publishGrandJury(CONTENT, sponsorAmount > 0n ? w.sponsor.address : ethers.ZeroAddress, sponsorAmount);
  const id = await lastCaseId(w);
  const target = (await w.court.getCase(id)).target;
  const amounts = opts.contributions ?? [usdc(5), target - usdc(5)];
  const contributors = w.others.slice(0, amounts.length);
  for (let i = 0; i < amounts.length; i++) await w.court.connect(contributors[i]).contribute(id, amounts[i]);
  return { id, contributors, amounts };
}

export async function fillJury(w: World, caseId: bigint): Promise<HardhatEthersSigner[]> {
  const size = Number((await w.court.getCase(caseId)).jurySize);
  const seated = w.jurors.slice(0, size);
  for (const j of seated) await acceptSeat(w, caseId, j);
  return seated;
}

export async function openCourt(w: World, caseId: bigint) {
  return w.court.connect(w.operator).openCourt(caseId, TRANSCRIPT);
}

export function saltFor(juror: string, caseId: bigint): string {
  return ethers.id(`salt:${juror}:${caseId}`);
}

export async function commit(w: World, caseId: bigint, juror: HardhatEthersSigner, choice: number) {
  const c = await w.court.commitmentOf(caseId, juror.address, choice, saltFor(juror.address, caseId));
  return w.court.connect(juror).commitVote(caseId, c);
}

export async function reveal(w: World, caseId: bigint, juror: HardhatEthersSigner, choice: number) {
  return w.court.connect(juror).revealVote(caseId, choice, saltFor(juror.address, caseId));
}

/** Seat behaviour for one juror: reveal a choice, commit but never reveal, or never commit. */
export type Attendance = 0 | 1 | "committed" | "absent";

/**
 * Runs a seated, open court to settlement: commits, advances past the commit
 * deadline, reveals, advances past the reveal deadline, finalizes.
 */
export async function runTrial(w: World, caseId: bigint, attendance: Attendance[]) {
  const c0 = await w.court.getCase(caseId);
  const jurors = (await w.court.jurorsOf(caseId)).map((a) => w.jurors.find((j) => j.address === a)!);
  if (attendance.length !== jurors.length) throw new Error(`attendance has ${attendance.length} seats, jury has ${jurors.length}`);
  for (let i = 0; i < jurors.length; i++) {
    const a = attendance[i];
    if (a === "absent") continue;
    await commit(w, caseId, jurors[i], a === "committed" ? 0 : a);
  }
  const c = await w.court.getCase(caseId);
  if ((await time.latest()) < Number(c.commitDeadline) && Number(c.committed) < jurors.length) {
    await time.increaseTo(c.commitDeadline);
  }
  for (let i = 0; i < jurors.length; i++) {
    const a = attendance[i];
    if (a === 0 || a === 1) await reveal(w, caseId, jurors[i], a);
  }
  const after = await w.court.getCase(caseId);
  if (Number(after.revealed) < jurors.length) await time.increaseTo(after.revealDeadline);
  void c0;
  return { jurors, tx: await w.court.finalize(caseId) };
}

/**
 * Money the court still owes somebody: every claimable balance, every
 * outstanding refundable payment, live escrow and the reserve. After each
 * scenario it must equal the court's USDC balance exactly.
 */
export async function assertConserved(w: World, extraAccounts: string[] = []) {
  const courtAddr = await w.court.getAddress();
  const balance = await w.usdcToken.balanceOf(courtAddr);
  const accounts = new Set<string>([
    w.treasury.address, w.aiTreasury.address, w.sponsor.address, w.creator.address, w.sideB.address,
    ...w.jurors.map((j) => j.address), ...w.others.map((o) => o.address), ...extraAccounts,
  ]);
  let owed = await w.court.reserveBalance();
  for (const a of accounts) owed += await w.court.claimable(a);
  const count = await w.court.caseCount();
  for (let id = 1n; id <= count; id++) {
    const c = await w.court.getCase(id);
    const t = await w.court.caseTerms(id);
    const st = Number(c.status);
    const refundable = st === STATUS.Cancelled || (st === STATUS.Finalized && Number(c.outcome) === OUTCOME.NoVerdict);
    if (refundable) {
      for (const a of accounts) owed += await w.court.paidBy(id, a);
    } else if (st !== STATUS.Finalized) {
      owed += c.raised + c.sponsorDeposit + BigInt(c.seated) * t.bond;
    }
  }
  if (balance !== owed) throw new Error(`conservation broken: court holds ${balance}, owes ${owed}`);
}
