/** USDC on Arc's ERC-20 interface uses 6 decimals. Testnet only (D14). */
export const USDC_DECIMALS = 6;
const UNIT = 10n ** BigInt(USDC_DECIMALS);

/** "0.70" | 0.7 -> 700000n. Rejects more than 6 decimals rather than rounding. */
export function parseUsdc(value: string | number): bigint {
  const s = typeof value === "number" ? value.toFixed(USDC_DECIMALS) : value.trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`not a USDC amount: ${value}`);
  const [, neg, whole, frac = ""] = m;
  if (frac.replace(/0+$/, "").length > USDC_DECIMALS) throw new Error(`more than ${USDC_DECIMALS} decimals: ${value}`);
  const units = BigInt(whole) * UNIT + BigInt((frac + "000000").slice(0, USDC_DECIMALS));
  return neg ? -units : units;
}

/** 700000n -> "0.70" (at least `minDecimals`, trailing zeros beyond that trimmed). */
export function formatUsdc(units: bigint, minDecimals = 2): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const whole = abs / UNIT;
  let frac = (abs % UNIT).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, "0");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}
