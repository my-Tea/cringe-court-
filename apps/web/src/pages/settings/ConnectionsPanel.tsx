import { formatUsdc } from '@cringe-court/core';
import { useEffect, useState } from 'react';
import { Alert, Badge, Icon, PaperPanel, Spinner } from '@/ds';
import { platformConfig, type PlatformConfig } from '@/platform/config';
import { identityInfo } from '@/platform/identity/createIdentity';
import styles from './Settings.module.css';

type Probe = Awaited<ReturnType<typeof import('@/platform/ledger').probeLedger>>;

type ProbeState = { status: 'loading' } | { status: 'ready'; rows: Probe } | { status: 'error'; message: string };

/** Reads the active ledger's on-chain terms and checks them against the terms the app shows players. */
function useLedgerProbe(config: PlatformConfig): ProbeState {
  const [state, setState] = useState<ProbeState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    import('@/platform/ledger')
      .then(async ({ createLedger, probeLedger }) => probeLedger(createLedger(config).port))
      .then((rows) => live && setState({ status: 'ready', rows }))
      .catch((err: unknown) => live && setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
    return () => {
      live = false;
    };
  }, [config]);
  return state;
}

const MODE_LABEL: Record<string, string> = { solo: 'Solo', versus: 'Versus', 'grand-jury': 'Grand Jury' };

/** Which adapters sit behind the court: ledger, identity and AI counsel, plus a live terms check. */
export function ConnectionsPanel({ config = platformConfig }: { config?: PlatformConfig }) {
  const identity = identityInfo(config);
  const probe = useLedgerProbe(config);
  const arc = config.ledger === 'arc-testnet' && config.arc;

  return (
    <div>
      <p className={styles.body}>
        Every court talks to three services through the same ports. This build uses the ones below; the demo stand-ins follow the
        real contract&apos;s rules exactly, so nothing changes for players when a real service is switched on.
      </p>

      {config.warnings.map((w) => (
        <Alert key={w} tone="warning" title="A service fell back to its demo stand-in">
          {w}
        </Alert>
      ))}

      <ul className={styles.services} role="list">
        <PaperPanel as="li" tone="cream" edge="cut" elevation={1} padding="md">
          <div className={styles.service}>
            <div className={styles.serviceHead}>
              <h3 className={styles.serviceName}>Ledger</h3>
              <Badge tone={arc ? 'success' : 'info'}>{arc ? 'Arc testnet' : 'Demo twin'}</Badge>
            </div>
            {arc ? (
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt>Chain</dt>
                  <dd>Arc testnet · {arc.chainId}</dd>
                </div>
                <div className={styles.row}>
                  <dt>Court contract</dt>
                  <dd className={styles.mono}>{arc.court}</dd>
                </div>
                <div className={styles.row}>
                  <dt>RPC</dt>
                  <dd className={styles.mono}>{arc.rpcUrl}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.serviceDetail}>
                An in-browser twin of the CringeCourt contract holds free test USDC. Same deadlines, bonds, commit–reveal and
                settlement maths as the Arc testnet contract.
              </p>
            )}
          </div>
        </PaperPanel>

        <PaperPanel as="li" tone="cream" edge="cut" elevation={1} padding="md">
          <div className={styles.service}>
            <div className={styles.serviceHead}>
              <h3 className={styles.serviceName}>Juror screening</h3>
              <Badge tone={identity.kind === 'world-idkit' ? 'success' : 'info'}>{identity.label}</Badge>
            </div>
            <p className={styles.serviceDetail}>
              {identity.kind === 'world-idkit'
                ? `${identity.detail}. Jurors need an Orb-level proof; case parties can never sit on their own jury.`
                : 'Demo personas stand in for World ID, under the real rules: jurors need the Orb level, and parties are excluded from their own jury.'}
            </p>
          </div>
        </PaperPanel>

        <PaperPanel as="li" tone="cream" edge="cut" elevation={1} padding="md">
          <div className={styles.service}>
            <div className={styles.serviceHead}>
              <h3 className={styles.serviceName}>AI counsel</h3>
              <Badge tone="info">Scripted demo</Badge>
            </div>
            <p className={styles.serviceDetail}>
              Scripted counsel stands in for 0G Compute. Each bench still only sees its own client&apos;s private notes, and the
              transcript is frozen and fingerprinted before anyone votes.
            </p>
          </div>
        </PaperPanel>
      </ul>

      {probe.status === 'loading' && (
        <p className={styles.serviceDetail} role="status">
          <Spinner size="sm" label={null} /> Reading the court&apos;s terms from the ledger…
        </p>
      )}
      {probe.status === 'error' && (
        <Alert tone="warning" title="Could not read the ledger" live="polite">
          {probe.message}
        </Alert>
      )}
      {probe.status === 'ready' && (
        <table className={styles.termsTable}>
          <caption>Terms on the ledger vs. what the app shows you</caption>
          <thead>
            <tr>
              <th scope="col">Court</th>
              <th scope="col">Case charge</th>
              <th scope="col">Juror bond</th>
              <th scope="col">Jurors</th>
              <th scope="col">Check</th>
            </tr>
          </thead>
          <tbody>
            {probe.rows.map((r) => (
              <tr key={r.mode}>
                <th scope="row">{MODE_LABEL[r.mode] ?? r.mode}</th>
                <td data-num>{formatUsdc(r.price)}</td>
                <td data-num>{formatUsdc(r.jurorBond)}</td>
                <td data-num>{r.seats}</td>
                <td>
                  {r.matches ? (
                    <span className={styles.match}>
                      <Icon name="check" /> Matches
                    </span>
                  ) : (
                    <span className={styles.mismatch} title={r.diffs.join('; ')}>
                      <Icon name="alert" /> {r.diffs.join('; ')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details className={styles.body}>
        <summary>Connecting real services (for deployers)</summary>
        <ul className={styles.envList}>
          <li>
            <code>VITE_LEDGER=arc-testnet</code> with <code>VITE_ARC_COURT</code>, <code>VITE_ARC_USDC</code>,{' '}
            <code>VITE_ARC_REGISTRY</code> (and optionally <code>VITE_ARC_RPC_URL</code>).
          </li>
          <li>
            <code>VITE_IDENTITY=world-idkit</code> with <code>VITE_WORLD_APP_ID</code> and <code>VITE_WORLD_BACKEND_URL</code> (the
            verifier that serves <code>/rp-context</code> and <code>/verify</code>).
          </li>
          <li>Testnet only: there is no mainnet setting in this build.</li>
        </ul>
      </details>
    </div>
  );
}
