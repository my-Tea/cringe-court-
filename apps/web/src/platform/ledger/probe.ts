/**
 * Settings "Ledger" panel data: does the connected court contract charge what
 * the app says it charges? Reads `termsOf` for every mode and compares money
 * and seats with core's terms. Windows are not compared (demo timing is short on purpose).
 */
import type { Mode} from '@cringe-court/chain-client';
import { quoteFor, type Terms } from '@cringe-court/chain-client';
import { MODES, MODE_IDS, termsFor, type ModeId, type Usdc } from '@cringe-court/core';
import { chainModeOf, diffTerms, termsFromChain, toChainError, usdcOf } from './mapping';
import { t } from '@/i18n';

export interface ModeProbe {
  mode: ModeId;
  /** What one payer owes (Versus: Side A's share; Grand Jury: the whole target). */
  price: Usdc;
  jurorBond: Usdc;
  seats: number;
  enabled: boolean;
  matches: boolean;
  diffs: string[];
}

export interface LedgerTermsSource {
  termsOf(mode: Mode): Promise<Terms>;
}

export async function probeLedger(port: LedgerTermsSource): Promise<readonly ModeProbe[]> {
  try {
    return await Promise.all(
      MODE_IDS.map(async (mode): Promise<ModeProbe> => {
        const m = chainModeOf(mode);
        const onChain = await port.termsOf(m);
        const chain = termsFromChain(mode, onChain);
        const diffs = diffTerms(termsFor(MODES[mode]), chain);
        if (!onChain.enabled) diffs.push(t('shell.ledger.diff.disabled'));
        return {
          mode,
          price: usdcOf(quoteFor(m, onChain, true, false)),
          jurorBond: usdcOf(onChain.bond),
          seats: chain.jurySize,
          enabled: onChain.enabled,
          matches: diffs.length === 0,
          diffs,
        };
      }),
    );
  } catch (e) {
    throw toChainError(e);
  }
}
