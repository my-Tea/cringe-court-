import { formatAmount } from '@/i18n/domain';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Badge, Icon, PaperPanel, Spinner } from '@/ds';
import { t, tRich } from '@/i18n';
import { platformConfig, type PlatformConfig } from '@/platform/config';
import { identityInfo } from '@/platform/identity/createIdentity';
import type { ModeProbe } from '@/platform/ledger';
import { COURT_LABEL_KEY } from '../modeText';
import styles from './Settings.module.css';

type Probe = readonly ModeProbe[];

const code = { c: (chunk: ReactNode) => <code>{chunk}</code> };

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

/** Which adapters sit behind the court: ledger, identity and AI counsel, plus a live terms check. */
export function ConnectionsPanel({ config = platformConfig }: { config?: PlatformConfig }) {
  const identity = identityInfo(config);
  const probe = useLedgerProbe(config);
  const arc = config.ledger === 'arc-testnet' && config.arc;

  return (
    <div>
      <p className={styles.body}>{t('shell.connections.intro')}</p>

      {config.warnings.map((w) => (
        <Alert key={w.key} tone="warning" title={t('shell.connections.warning.title')}>
          {t(w.key, w.params)}
        </Alert>
      ))}

      <ul className={styles.services} role="list">
        <PaperPanel as="li" tone="cream" edge="cut" elevation={1} padding="md">
          <div className={styles.service}>
            <div className={styles.serviceHead}>
              <h3 className={styles.serviceName}>{t('shell.connections.ledger')}</h3>
              <Badge tone={arc ? 'success' : 'info'}>{arc ? t('shell.connections.ledger.arc') : t('shell.connections.ledger.demo')}</Badge>
            </div>
            {arc ? (
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt>{t('shell.connections.chain')}</dt>
                  <dd>{t('shell.connections.chainValue', { id: String(arc.chainId) })}</dd>
                </div>
                <div className={styles.row}>
                  <dt>{t('shell.connections.contract')}</dt>
                  <dd className={styles.mono}>{arc.court}</dd>
                </div>
                <div className={styles.row}>
                  <dt>{t('shell.connections.rpc')}</dt>
                  <dd className={styles.mono}>{arc.rpcUrl}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.serviceDetail}>{t('shell.connections.ledger.demoBody')}</p>
            )}
          </div>
        </PaperPanel>

        <PaperPanel as="li" tone="cream" edge="cut" elevation={1} padding="md">
          <div className={styles.service}>
            <div className={styles.serviceHead}>
              <h3 className={styles.serviceName}>{t('shell.connections.screening')}</h3>
              <Badge tone={identity.kind === 'world-idkit' ? 'success' : 'info'}>{identity.label}</Badge>
            </div>
            <p className={styles.serviceDetail}>
              {identity.kind === 'world-idkit' ? t('shell.connections.screening.world', { detail: identity.detail }) : t('shell.connections.screening.demo')}
            </p>
          </div>
        </PaperPanel>

        <PaperPanel as="li" tone="cream" edge="cut" elevation={1} padding="md">
          <div className={styles.service}>
            <div className={styles.serviceHead}>
              <h3 className={styles.serviceName}>{t('shell.connections.ai')}</h3>
              <Badge tone="info">{t('shell.connections.ai.badge')}</Badge>
            </div>
            <p className={styles.serviceDetail}>{t('shell.connections.ai.body')}</p>
          </div>
        </PaperPanel>
      </ul>

      {probe.status === 'loading' && (
        <p className={styles.serviceDetail} role="status">
          <Spinner size="sm" label={null} /> {t('shell.connections.probe.loading')}
        </p>
      )}
      {probe.status === 'error' && (
        <Alert tone="warning" title={t('shell.connections.probe.error')} live="polite">
          {probe.message}
        </Alert>
      )}
      {probe.status === 'ready' && (
        <table className={styles.termsTable}>
          <caption>{t('shell.connections.terms.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('shell.connections.terms.court')}</th>
              <th scope="col" data-num>
                {t('shell.connections.terms.charge')}
              </th>
              <th scope="col" data-num>
                {t('shell.connections.terms.bond')}
              </th>
              <th scope="col" data-num>
                {t('shell.connections.terms.jurors')}
              </th>
              <th scope="col">{t('shell.connections.terms.check')}</th>
            </tr>
          </thead>
          <tbody>
            {probe.rows.map((r) => (
              <tr key={r.mode}>
                <th scope="row">{t(COURT_LABEL_KEY[r.mode])}</th>
                <td data-num>{formatAmount(r.price)}</td>
                <td data-num>{formatAmount(r.jurorBond)}</td>
                <td data-num>{r.seats}</td>
                <td>
                  {r.matches ? (
                    <span className={styles.match}>
                      <Icon name="check" /> {t('shell.connections.terms.matches')}
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
        <summary>{t('shell.connections.deployers')}</summary>
        <ul className={styles.envList}>
          <li>{tRich('shell.connections.env.ledger', code)}</li>
          <li>{tRich('shell.connections.env.identity', code)}</li>
          <li>{t('shell.connections.env.testnetOnly')}</li>
        </ul>
      </details>
    </div>
  );
}
