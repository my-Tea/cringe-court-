import { CATEGORIES, formatCaseNumber, formatUsdc } from '@cringe-court/core';
import { VERSUS_STEPS, casesFor, jurorStake, nextStep, stepIndex, viewerOf, type VersusCase } from '@cringe-court/modes-versus';
import { Link } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Badge, EmptyState, Icon, LoadingState, PaperButtonLink, Portrait, Skeleton } from '@/ds';
import { PageHead } from '../components/PageHead';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

function CaseCard({ c }: { c: VersusCase }) {
  const { persona } = useVersus();
  const viewer = viewerOf(c, persona.account);
  const step = nextStep(c, viewer, persona.account);
  const s = c.state;
  const index = stepIndex(s);
  const closed = s.stage === 'closed';
  return (
    <li className={styles.caseCard} data-your-move={step.yourMove || undefined} data-closed={closed || undefined}>
      <Portrait character={viewer === 'b' ? 'side-b' : viewer === 'a' ? 'side-a' : 'juror'} size="sm" ring={viewer === 'b' ? 'side-b' : viewer === 'a' ? 'side-a' : 'highlight'} alt="" />
      <div className={styles.caseCardBody}>
        <p className={styles.caseCardMeta}>
          {c.caseNumber !== null ? formatCaseNumber(c.caseNumber) : 'Private'} · {CATEGORIES[s.filing.category]} · {viewer === 'a' ? 'Side A' : viewer === 'b' ? 'Side B' : viewer === 'juror' ? 'Juror' : 'Watching'}
        </p>
        <h3 className={styles.caseCardTitle}>
          <Link to={versusPaths.case(c.trialId)} className={styles.stretched}>
            “{s.filing.title}”
          </Link>
        </h3>
        <p className={styles.caseCardStep}>
          {step.yourMove && <span className={styles.yourMove}>Your move</span>}
          {step.label}
        </p>
      </div>
      <div className={styles.caseCardProgress} aria-label={closed ? 'Closed' : `Step ${index + 1} of ${VERSUS_STEPS.length}: ${VERSUS_STEPS[index]}`} role="img">
        {VERSUS_STEPS.map((label, i) => (
          <span key={label} data-done={i < index || (i === index && (s.stage === 'verdict' || s.stage === 'share')) || undefined} data-current={(i === index && !closed) || undefined} />
        ))}
      </div>
      <Icon name="chevron-right" aria-hidden className={styles.caseCardChevron} />
    </li>
  );
}

/** Your cases on this device, and juries that need a verified human. */
export function CasesPage() {
  useDocumentTitle('My Versus cases');
  const { snapshot, persona } = useVersus();
  if (!snapshot) {
    return (
      <>
        <PageHead eyebrow="Versus Court" title="My cases" />
        <div className={styles.page}>
          <LoadingState title="Fetching the docket…">
            <Skeleton height="4rem" />
          </LoadingState>
        </div>
      </>
    );
  }
  const mine = casesFor(snapshot.cases, persona.account);
  const duty = snapshot.cases.filter((c) => c.state.stage === 'jury' && c.state.step === 'recruiting' && viewerOf(c, persona.account) === 'spectator');
  const open = mine.filter((c) => c.state.stage !== 'closed' && c.state.stage !== 'share');
  const done = mine.filter((c) => !open.includes(c));
  return (
    <>
      <PageHead
        eyebrow="Versus Court"
        title="My cases"
        lede="Every case this persona is part of, in this browser’s demo court."
        aside={
          <PaperButtonLink to={versusPaths.newCase} size="lg" iconStart={<Icon name="gavel" />}>
            Start a case
          </PaperButtonLink>
        }
      />
      <div className={styles.page}>
        {mine.length === 0 ? (
          <EmptyState
            title="No cases yet"
            character="side-a"
            expression="smug"
            headingLevel={2}
            actions={
              <>
                <PaperButtonLink to={versusPaths.newCase}>Start a Versus case</PaperButtonLink>
                <PaperButtonLink to={versusPaths.join} variant="maroon">
                  I have an invite code
                </PaperButtonLink>
              </>
            }
          >
            Got a petty argument that needs settling? File it, send the invite, and let a jury of strangers decide. Switched tabs? Use “Switch persona” above to pick yourself up.
          </EmptyState>
        ) : (
          <>
            {open.length > 0 && (
              <section aria-labelledby="open-title" className={styles.listSection}>
                <h2 id="open-title" className={styles.listTitle}>
                  In progress <Badge tone="accent">{open.length}</Badge>
                </h2>
                <ul className={styles.caseList} role="list">
                  {open.map((c) => (
                    <CaseCard key={c.trialId} c={c} />
                  ))}
                </ul>
              </section>
            )}
            {done.length > 0 && (
              <section aria-labelledby="done-title" className={styles.listSection}>
                <h2 id="done-title" className={styles.listTitle}>
                  Closed
                </h2>
                <ul className={styles.caseList} role="list">
                  {done.map((c) => (
                    <CaseCard key={c.trialId} c={c} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <section aria-labelledby="duty-title" className={styles.listSection}>
          <h2 id="duty-title" className={styles.listTitle}>
            Jury duty open now
          </h2>
          {duty.length === 0 ? (
            <p className={styles.muted}>No Versus case on this device is looking for jurors right now.</p>
          ) : (
            <ul className={styles.caseList} role="list">
              {duty.map((c) => (
                <li key={c.trialId} className={styles.caseCard}>
                  <Portrait character="juror" size="sm" ring="highlight" alt="" />
                  <div className={styles.caseCardBody}>
                    <p className={styles.caseCardMeta}>
                      {c.caseNumber !== null && formatCaseNumber(c.caseNumber)} · {c.state.stage === 'jury' ? `${c.state.seats.length} of ${c.state.terms.jurySize} seats taken` : ''}
                    </p>
                    <h3 className={styles.caseCardTitle}>
                      <Link to={versusPaths.case(c.trialId)} className={styles.stretched}>
                        “{c.state.filing.title}”
                      </Link>
                    </h3>
                    <p className={styles.caseCardStep}>
                      Bond {formatUsdc(jurorStake(c.state.terms).bond)}, earn {formatUsdc(jurorStake(c.state.terms).reward)} for finishing
                    </p>
                  </div>
                  <Icon name="chevron-right" aria-hidden className={styles.caseCardChevron} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
