import { termsConfig } from "./generated/terms.js";
import { Mode, type Terms } from "./types.js";
import { poolOf, sideShare } from "./settlement.js";

export { termsConfig };
export type Timing = keyof typeof termsConfig.timing;
export type Pricing = "hackathon" | "launch";

/** The on-chain Terms for a mode, from contracts/config/terms.json (same as scripts/terms.ts). */
export function buildTerms(mode: Mode, timing: Timing = "production", pricing: Pricing = "hackathon"): Terms {
  const key =
    mode === Mode.Solo ? "solo" : mode === Mode.Versus ? "versus" : pricing === "launch" ? "grandJuryLaunch" : "grandJuryHackathon";
  const m = termsConfig.modes[key];
  const w = termsConfig.timing[timing];
  return {
    n: m.n,
    minJurorLevel: m.minJurorLevel,
    minPartyLevel: m.minPartyLevel,
    enabled: true,
    passEnabled: m.passEnabled,
    demoTiming: w.demoTiming,
    bond: BigInt(m.bond),
    successBonus: BigInt(m.successBonus),
    failedTrialBonus: BigInt(m.failedTrialBonus),
    protocolFee: BigInt(m.protocolFee),
    aiFeePerAgent: BigInt(m.aiFeePerAgent),
    incidentStipend: BigInt(m.incidentStipend),
    minContribution: BigInt(m.minContribution),
    sponsorFloor: BigInt(m.sponsorFloor),
    pendingWindow: mode === Mode.Solo ? 0 : mode === Mode.Versus ? w.consentWindow : w.fundingWindow,
    recruitWindow: w.recruitWindow,
    prepWindow: w.prepWindow,
    commitWindow: w.commitWindow,
    revealWindow: w.revealWindow,
  };
}

/** Same as CringeCourt.quote: what one payer owes under `t`. */
export function quoteFor(mode: Mode, t: Terms, sideA = true, usePass = false): bigint {
  const pool = poolOf(t.n, t.successBonus);
  if (mode === Mode.GrandJury) return pool + t.protocolFee + t.aiFeePerAgent;
  const ai = usePass ? 0n : t.aiFeePerAgent;
  if (mode === Mode.Versus) return sideShare(pool, sideA) + sideShare(t.protocolFee, sideA) + ai;
  return pool + t.protocolFee + ai;
}

/** Itemised price for the "see price and risks" screen (V4 §6 step 2). */
export function priceBreakdown(mode: Mode, t: Terms, sideA = true, usePass = false) {
  const pool = poolOf(t.n, t.successBonus);
  const versus = mode === Mode.Versus;
  const juryPool = versus ? sideShare(pool, sideA) : pool;
  const protocolFee = versus ? sideShare(t.protocolFee, sideA) : t.protocolFee;
  const aiFee = mode !== Mode.GrandJury && usePass ? 0n : t.aiFeePerAgent;
  return {
    juryPool,
    protocolFee,
    aiFee,
    total: juryPool + protocolFee + aiFee,
    jurors: 2 * t.n + 1,
    verdictThreshold: t.n + 1,
    bond: t.bond,
    successBonus: t.successBonus,
    failedTrialBonus: t.failedTrialBonus,
    refundedOnNoVerdict: true,
  };
}
