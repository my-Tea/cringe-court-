import termsJson from "../config/terms.json";

export type Timing = keyof typeof termsJson.timing;
export type Pricing = "hackathon" | "launch";
export const MODE = { Solo: 0, Versus: 1, GrandJury: 2 } as const;
export type ModeId = (typeof MODE)[keyof typeof MODE];

export interface TermsStruct {
  n: number;
  minJurorLevel: number;
  minPartyLevel: number;
  enabled: boolean;
  passEnabled: boolean;
  demoTiming: boolean;
  bond: bigint;
  successBonus: bigint;
  failedTrialBonus: bigint;
  protocolFee: bigint;
  aiFeePerAgent: bigint;
  incidentStipend: bigint;
  minContribution: bigint;
  sponsorFloor: bigint;
  pendingWindow: number;
  recruitWindow: number;
  prepWindow: number;
  commitWindow: number;
  revealWindow: number;
}

export const TERMS = termsJson;

/** Builds the on-chain Terms struct for a mode from config/terms.json. */
export function buildTerms(mode: ModeId, timing: Timing = "production", pricing: Pricing = "hackathon"): TermsStruct {
  const key = mode === MODE.Solo ? "solo" : mode === MODE.Versus ? "versus" : pricing === "launch" ? "grandJuryLaunch" : "grandJuryHackathon";
  const m = termsJson.modes[key];
  const w = termsJson.timing[timing];
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
    pendingWindow: mode === MODE.Solo ? 0 : mode === MODE.Versus ? w.consentWindow : w.fundingWindow,
    recruitWindow: w.recruitWindow,
    prepWindow: w.prepWindow,
    commitWindow: w.commitWindow,
    revealWindow: w.revealWindow,
  };
}
