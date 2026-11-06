import { platformConfig } from '../config';
import { createLedger, type Ledger } from './createLedger';

let shared: Ledger | null = null;

/** The one ledger every screen shares, so a connected wallet stays connected. */
export function appLedger(): Ledger {
  shared ??= createLedger(platformConfig);
  return shared;
}
