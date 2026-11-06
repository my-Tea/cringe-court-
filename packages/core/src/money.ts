/**
 * Money is test USDC on Arc testnet (D14). USDC has 6 decimals, so every amount
 * is held as an integer count of micro-USDC in a `bigint`. Floats never touch
 * money: 0.1 + 0.2 must not be a juror's refund.
 */
declare const usdcBrand: unique symbol;

/** An amount of test USDC, in micro-USDC (1 USDC = 1_000_000n). */
export type Usdc = bigint & { readonly [usdcBrand]: true };

export const USDC_DECIMALS = 6;
const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** Wrap a raw micro-USDC integer. Rejects negatives: debts are modelled as flows, not signs. */
export function micro(value: bigint): Usdc {
  if (value < 0n) throw new RangeError(`USDC amount cannot be negative: ${value}`);
  return value as Usdc;
}

/**
 * Parse a decimal string such as "1.20" or "0.7" into micro-USDC.
 * Strings, not numbers, so a literal like 0.1 never passes through a float.
 */
export function usdc(decimal: string): Usdc {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(decimal.trim());
  if (!match) throw new SyntaxError(`Not a USDC amount: "${decimal}"`);
  const whole = BigInt(match[1] ?? '0');
  const frac = BigInt((match[2] ?? '').padEnd(USDC_DECIMALS, '0'));
  return micro(whole * SCALE + frac);
}

export const ZERO_USDC = micro(0n);

export function addUsdc(...amounts: Usdc[]): Usdc {
  return micro(amounts.reduce<bigint>((sum, a) => sum + a, 0n));
}

export function subUsdc(a: Usdc, b: Usdc): Usdc {
  return micro(a - b);
}

export function mulUsdc(a: Usdc, times: number): Usdc {
  if (!Number.isInteger(times) || times < 0) throw new RangeError(`Multiplier must be a non-negative integer: ${times}`);
  return micro(a * BigInt(times));
}

export interface FormatUsdcOptions {
  /** Minimum fraction digits to show. Defaults to 2 ("1.20"). */
  minFractionDigits?: number;
  /** Append the " USDC" unit. Defaults to true. */
  unit?: boolean;
}

/** "1.20 USDC". Trailing zeros past `minFractionDigits` are trimmed, never rounded. */
export function formatUsdc(amount: Usdc, options: FormatUsdcOptions = {}): string {
  const { minFractionDigits = 2, unit = true } = options;
  const whole = amount / SCALE;
  let frac = (amount % SCALE).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '');
  if (frac.length < minFractionDigits) frac = frac.padEnd(minFractionDigits, '0');
  const text = frac.length > 0 ? `${whole.toLocaleString('en-US')}.${frac}` : whole.toLocaleString('en-US');
  return unit ? `${text} USDC` : text;
}
