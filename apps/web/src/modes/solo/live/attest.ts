import type { Hex } from '@cringe-court/core';
import { backendClient } from '@/platform/backend';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity';
import { appLedger } from '@/platform/ledger';

/** World ID, then one signature, then the relayer puts this wallet on Arc's HumanRegistry. */
export async function attestOnArc(account: Hex): Promise<void> {
  const config = platformConfig.backend;
  if (!config) throw new Error('This build has no court server.');
  const client = backendClient(config);
  await client.connect();
  // World gives one proof per person, ever: someone already verified here must not be asked again.
  const { verified } = await client.connection.get<{ verified: boolean }>('/api/v1/chain/human');
  if (!verified) {
    const identity = identityFor(platformConfig, 'player', { token: () => client.connection.token, wallet: () => client.account ?? undefined });
    const request = { action: 'accept-jury-seat' as const, signal: 'cringecourt:juror', minLevel: 'orb' as const };
    const proof = await identity.requestProof(request);
    if (!proof.ok) throw new Error(proof.message);
    const screened = await identity.verify(proof.proof, request);
    if (!screened.ok) throw new Error(screened.message);
  }
  const { persona } = await client.connection.get<{ persona: { id: string } }>('/api/v1/sessions/me');
  const message = `CringeCourt: I own this wallet.\nWallet: ${account.toLowerCase()}\nSession: ${persona.id}`;
  const signature = await appLedger().sign!(account, message);
  await client.connection.post('/api/v1/chain/attest', { wallet: account, signature });
}
