import { addUsdc, formatCaseNumber, subUsdc, type CaseNumber, type ReceiptKind, type ReceiptLine, type Usdc } from '@cringe-court/core';
import { cx } from '../../lib/cx';
import { Amount } from '../Amount/Amount';
import { Icon } from '../Icon/Icon';
import styles from './Receipt.module.css';

const CREDIT: ReadonlySet<ReceiptKind> = new Set(['bond-returned', 'reward', 'refund', 'stipend']);

export interface ReceiptProps {
  caseNumber: CaseNumber;
  title?: string;
  lines: readonly ReceiptLine[];
  /** Arc explorer link for the settlement transaction. */
  explorerUrl?: string;
  /** Honest footnote: what this receipt does and does not mean. */
  note?: string;
  className?: string;
}

/** Net = credits − debits. Never negative in display: a net loss shows as a debit. */
function net(lines: readonly ReceiptLine[]): { value: Usdc; direction: 'credit' | 'debit' } {
  const credits = addUsdc(...lines.filter((l) => CREDIT.has(l.kind)).map((l) => l.amount));
  const debits = addUsdc(...lines.filter((l) => !CREDIT.has(l.kind)).map((l) => l.amount));
  return credits >= debits ? { value: subUsdc(credits, debits), direction: 'credit' } : { value: subUsdc(debits, credits), direction: 'debit' };
}

/** Settlement receipt: every money movement, labelled honestly (V4 §5, §13). */
export function Receipt({ caseNumber, title = 'Settlement receipt', lines, explorerUrl, note, className }: ReceiptProps) {
  const total = net(lines);
  return (
    <section className={cx(styles.receipt, className)} data-surface="parchment" aria-label={`${title}, ${formatCaseNumber(caseNumber)}`}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.case}>{formatCaseNumber(caseNumber)}</span>
      </div>
      <dl className={styles.lines}>
        {lines.map((line, i) => (
          <div key={`${line.kind}-${i}`} style={{ display: 'contents' }}>
            <dt>{line.label}</dt>
            <dd>
              <Amount value={line.amount} size="sm" direction={CREDIT.has(line.kind) ? 'credit' : 'debit'} />
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.total}>
        <span>Net</span>
        <Amount value={total.value} direction={total.direction} />
      </div>
      {note && <p className={styles.note}>{note}</p>}
      {explorerUrl && (
        <a className={styles.tx} href={explorerUrl} target="_blank" rel="noreferrer">
          View on Arc testnet explorer
          <Icon name="external" />
          <span className="cc-visually-hidden">(opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}
