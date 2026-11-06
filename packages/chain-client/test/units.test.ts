import { describe, expect, it } from "vitest";
import {
  decodeScroll, encodeScroll, formatUsdc, jurySize, Mode, Outcome, outcomeOf, parseUsdc, poolOf, priceBreakdown, quoteFor,
  buildTerms, sealBallot, settle, sideShare, termsConfig,
} from "../src/index.js";

describe("money", () => {
  it("parses and formats USDC exactly", () => {
    expect(parseUsdc("0.70")).toBe(700000n);
    expect(parseUsdc("1")).toBe(1000000n);
    expect(parseUsdc(0.1)).toBe(100000n);
    expect(parseUsdc("1.234567")).toBe(1234567n);
    expect(() => parseUsdc("1.2345678")).toThrow();
    expect(() => parseUsdc("abc")).toThrow();
    expect(formatUsdc(700000n)).toBe("0.70");
    expect(formatUsdc(1234567n)).toBe("1.234567");
    expect(formatUsdc(-400000n)).toBe("-0.40");
    expect(formatUsdc(7_300_000n)).toBe("7.30");
  });
});

describe("terms match DECISIONS", () => {
  it("charges", () => {
    expect(quoteFor(Mode.Solo, buildTerms(Mode.Solo))).toBe(BigInt(termsConfig.expectedCharges.solo));
    expect(quoteFor(Mode.Solo, buildTerms(Mode.Solo), true, true)).toBe(BigInt(termsConfig.expectedCharges.soloWithPass));
    expect(quoteFor(Mode.Versus, buildTerms(Mode.Versus), true)).toBe(BigInt(termsConfig.expectedCharges.versusSide));
    expect(quoteFor(Mode.Versus, buildTerms(Mode.Versus), false)).toBe(BigInt(termsConfig.expectedCharges.versusSide));
    expect(quoteFor(Mode.GrandJury, buildTerms(Mode.GrandJury))).toBe(BigInt(termsConfig.expectedCharges.grandJuryHackathonTarget));
    expect(quoteFor(Mode.GrandJury, buildTerms(Mode.GrandJury, "production", "launch"))).toBe(
      BigInt(termsConfig.expectedCharges.grandJuryLaunchTarget),
    );
    const b = priceBreakdown(Mode.GrandJury, buildTerms(Mode.GrandJury));
    expect([b.jurors, b.verdictThreshold, b.juryPool]).toEqual([7, 4, 6_300_000n]);
  });
  it("versus split gives Side A the odd unit and sums exactly", () => {
    for (const x of [0n, 1n, 2n, 3n, 100001n]) expect(sideShare(x, true) + sideShare(x, false)).toBe(x);
    expect(sideShare(3n, true)).toBe(2n);
  });
});

describe("settlement properties, N = 1..10", () => {
  it("conserves money and never needs no-shows to pay the failed-trial bonus", () => {
    for (let n = 1; n <= 10; n++) {
      const bond = 400_000n * BigInt(n);
      const bonus = 300_000n * BigInt(n);
      const fb = 200_000n;
      const pool = poolOf(n, bonus);
      const J = jurySize(n);
      for (let timely = 0; timely <= J; timely++) {
        for (let v0 = 0; v0 <= timely; v0++) {
          const v1 = timely - v0;
          const fee = 100_000n, ai = 200_000n, sponsor = 50_000n;
          const raised = pool + fee + ai;
          const s = settle({ n, timely, votes0: v0, votes1: v1, bond, successBonus: bonus, failedTrialBonus: fb, poolHeld: pool, protocolFeeHeld: fee, aiFeeHeld: ai, sponsorDeposit: sponsor, raised });
          expect(s.outcome).toBe(outcomeOf(n, v0, v1));
          if (timely === J) expect(s.outcome).not.toBe(Outcome.NoVerdict);
          const inflow = raised + BigInt(J) * bond + sponsor;
          const outflow = BigInt(timely) * s.payoutPerTimelyJuror + s.toTreasury + s.toAiTreasury + s.refundableToPayers;
          expect(outflow).toBe(inflow);
          expect(s.toTreasury).toBeGreaterThanOrEqual(sponsor);
        }
      }
    }
  });
});

describe("secret verdict scroll", () => {
  it("round-trips and rejects tampering", () => {
    const sealed = sealBallot({ chainId: 5042002n, court: "0x00000000000000000000000000000000c0dec0de", caseId: 7n, juror: "0x0000000000000000000000000000000000000001", choice: 1 });
    const back = decodeScroll(sealed.scroll);
    expect(back.choice).toBe(1);
    expect(back.caseId).toBe(7n);
    expect(encodeScroll(back)).toBe(sealed.scroll);
    expect(() => decodeScroll("hello")).toThrow();
    expect(() => decodeScroll(sealed.scroll.replace(/:1:0x/, ":2:0x"))).toThrow();
    expect(sealBallot({ ...back }).commitment).toBe(sealed.commitment);
  });
});
