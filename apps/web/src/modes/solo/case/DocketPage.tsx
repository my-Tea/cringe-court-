import { useState } from 'react';
import { CATEGORIES, formatCaseNumber } from '@cringe-court/core';
import { verdictTone } from '@cringe-court/modes-solo';
import { Link } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { ButtonLink, Card, EmptyState, Icon, Stamp } from '@/ds';
import { demoCourt, readDocket } from '../lib/demoCourt';
import { soloPaths } from '../lib/paths';
import styles from './CasePage.module.css';

/** /solo/docket — decided Solo cases kept in this browser. */
export function DocketPage() {
  useDocumentTitle('Your docket · Solo Court');
  const [entries] = useState(readDocket);
  const live = demoCourt().session;
  const liveCase = live && (live.trial.stage === 'jury' ? live.trial : null);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <ButtonLink to={soloPaths.landing} variant="ghost" size="sm" iconStart={<Icon name="arrow-left" />}>
          Solo Court
        </ButtonLink>
        <h1 className={styles.title}>Your docket</h1>
        <p className={styles.small}>Decided cases from this browser. Open one to see the verdict, the receipt and the share card again.</p>
        {entries.length > 0 && (
          <ButtonLink to={soloPaths.file} iconStart={<Icon name="plus" />}>
            File another confession
          </ButtonLink>
        )}
      </header>

      {liveCase && (
        <Card tone="ornate" padding="md">
          <p className={styles.eyebrow}>In session now</p>
          <Link className={styles.docketLink} to={soloPaths.case(liveCase.id)}>
            {formatCaseNumber(liveCase.caseNumber)} · {liveCase.filing.title}
          </Link>
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="No verdicts yet"
          headingLevel={2}
          character="clerk"
          actions={
            <ButtonLink to={soloPaths.file} iconStart={<Icon name="plus" />}>
              File your first confession
            </ButtonLink>
          }
        >
          The docket fills up as juries decide your cases.
        </EmptyState>
      ) : (
        <ul className={styles.docket} role="list">
          {entries.map(({ id, snapshot }) => {
            const t = snapshot.trial;
            if (t.stage !== 'verdict' && t.stage !== 'share') return null;
            return (
              <li key={id}>
                <Card interactive as="article" className={styles.docketCard}>
                  <Stamp tone={verdictTone(t)} size="sm">
                    {t.verdict.label}
                  </Stamp>
                  <div>
                    <p className={styles.eyebrow}>
                      {formatCaseNumber(t.caseNumber)} · {CATEGORIES[t.filing.category]}
                    </p>
                    <h2 className={styles.docketTitle}>
                      <Link className={styles.docketLink} to={soloPaths.case(id)}>
                        {t.filing.title}
                      </Link>
                    </h2>
                    <p className={styles.small}>
                      {t.verdict.tally[0]}–{t.verdict.tally[1]} · {t.sentence?.text ?? ''}
                    </p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
