import { useState, type FormEvent } from 'react';
import type { EvidenceState, PublicExhibit } from '@cringe-court/core';
import { ANGLE_MAX, REDACTION_LABELS, soloMode, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, Icon, Portrait, Select, Skeleton, TextArea, TextField, cx } from '@/ds';
import { Courtroom } from '../court/Courtroom';
import styles from './FilePage.module.css';

export interface BriefStepProps {
  session: SoloSession;
  snap: SoloSnapshot & { trial: EvidenceState };
  hiddenNames: readonly string[];
  teaserAllowance: { remaining: number; limit: number };
}

const OWN = 'own';

/** Step 2: approve what the public sees, add evidence, brief Counsel Chaos (D2), and optionally watch the free teaser (D3). */
export function BriefStep({ session, snap, hiddenNames, teaserAllowance }: BriefStepProps) {
  const t = snap.trial;
  const side = t.filing.sides.a!;
  const [choice, setChoice] = useState<string | null>(() => {
    if (!side.angle) return null;
    return snap.angles?.find((a) => a.text === side.angle)?.id ?? OWN;
  });
  const [own, setOwn] = useState(choice === OWN ? (side.angle ?? '') : '');
  const [exhibit, setExhibit] = useState<{ kind: PublicExhibit['kind']; title: string; body: string }>({ kind: 'text', title: '', body: '' });
  const [watching, setWatching] = useState(false);
  const busy = snap.busy;

  const angleText = choice === OWN ? own : (snap.angles?.find((a) => a.id === choice)?.text ?? '');

  const commitAngle = () => (angleText.trim() && angleText.trim() !== side.angle ? session.setAngle(angleText) : Boolean(side.angle));

  const addExhibit = (e: FormEvent) => {
    e.preventDefault();
    if (session.addExhibit(exhibit, hiddenNames)) setExhibit({ kind: 'text', title: '', body: '' });
  };

  const exhibitsLeft = t.rules.maxExhibits - t.exhibits.length;

  return (
    <div className={styles.brief}>
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>Step 2 of 5</p>
        <h2 className={styles.stepTitle}>Brief your lawyer</h2>
        <p className={styles.lede}>Check what the court will see, add evidence if you have any, then give Counsel Chaos one angle to run with.</p>
      </header>

      <div className={styles.briefGrid}>
        <Card tone="parchment" as="section" aria-labelledby="public-title">
          <CardHeader eyebrow="Public record">
            <CardTitle id="public-title" as="h3">
              What Miss Ratio and the jury will read
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className={styles.publicTitle}>“{t.filing.title}”</p>
            <p className={styles.publicStory}>{side.story}</p>
            {snap.redactions.length > 0 ? (
              <ul className={styles.redactions} role="list" aria-label="Hidden by the redaction pass">
                {snap.redactions.map((r, i) => (
                  <li key={i}>
                    <Badge tone="info">{REDACTION_LABELS[r.kind]}</Badge> hidden
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>Nothing needed hiding. Your private notes stay with Counsel Chaos.</p>
            )}
            <Button size="sm" variant="ghost" onClick={() => session.withdraw()}>
              Start over
            </Button>
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="evidence-title">
          <CardHeader eyebrow={`Optional · ${exhibitsLeft} of ${t.rules.maxExhibits} left`}>
            <CardTitle id="evidence-title" as="h3">
              Evidence locker
            </CardTitle>
          </CardHeader>
          <CardBody>
            {t.exhibits.length > 0 && (
              <ol className={styles.exhibits} role="list">
                {t.exhibits.map((x, i) => (
                  <li key={x.id}>
                    <span className={styles.exhibitLetter}>{String.fromCharCode(65 + i)}</span>
                    <div>
                      <strong>{x.title}</strong>
                      <p>{x.body}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => session.removeExhibit(x.id)} aria-label={`Remove exhibit ${String.fromCharCode(65 + i)}, ${x.title}`}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ol>
            )}
            {exhibitsLeft > 0 && (
              <form className={styles.exhibitForm} onSubmit={addExhibit} aria-label="Add an exhibit">
                <Select
                  label="Kind"
                  value={exhibit.kind}
                  onChange={(e) => setExhibit({ ...exhibit, kind: e.target.value as PublicExhibit['kind'] })}
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'quote', label: 'Quote (a message, a post)' },
                    { value: 'screenshot', label: 'Screenshot caption' },
                    { value: 'link', label: 'Link (redacted)' },
                  ]}
                />
                <TextField label="Exhibit title" value={exhibit.title} maxLength={80} onChange={(e) => setExhibit({ ...exhibit, title: e.target.value })} />
                <TextArea label="What it shows" value={exhibit.body} maxLength={400} rows={2} onChange={(e) => setExhibit({ ...exhibit, body: e.target.value })} />
                <Button type="submit" size="sm" variant="secondary" iconStart={<Icon name="plus" />}>
                  Add exhibit
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>

      <section className={styles.angles} aria-labelledby="angle-title">
        <div className={styles.anglesHead}>
          <Portrait character="defense" expression="smug" size="lg" ring="accent" alt="" />
          <div>
            <h3 id="angle-title" className={styles.sectionTitle}>
              One angle for Counsel Chaos
            </h3>
            <p className={styles.small}>Pick one of three or write your own line ({ANGLE_MAX} characters). It is the only steer your lawyer gets (D2).</p>
          </div>
        </div>
        {!snap.angles ? (
          busy === 'angles' ? (
            <div className={styles.angleGrid} aria-busy="true" aria-label="Counsel Chaos is thinking of angles">
              <Skeleton height="6rem" />
              <Skeleton height="6rem" />
              <Skeleton height="6rem" />
            </div>
          ) : (
            <Button variant="secondary" onClick={() => void session.suggestAngles()} iconStart={<Icon name="sparkle" />}>
              Ask Counsel Chaos for angles
            </Button>
          )
        ) : (
          <fieldset className={styles.angleFieldset}>
            <legend className="cc-visually-hidden">Defense angle</legend>
            <div className={styles.angleGrid}>
              {snap.angles.map((a) => (
                <label key={a.id} className={cx(styles.angle, choice === a.id && styles.angleOn)}>
                  <input type="radio" name="angle" value={a.id} checked={choice === a.id} onChange={() => setChoice(a.id)} />
                  <span>{a.text}</span>
                </label>
              ))}
              <label className={cx(styles.angle, choice === OWN && styles.angleOn)}>
                <input type="radio" name="angle" value={OWN} checked={choice === OWN} onChange={() => setChoice(OWN)} />
                <span>Write my own line</span>
              </label>
            </div>
          </fieldset>
        )}
        {choice === OWN && (
          <TextArea label="Your angle" value={own} maxLength={ANGLE_MAX} rows={2} onChange={(e) => setOwn(e.target.value)} placeholder="Market conditions made it inevitable." />
        )}
      </section>

      {snap.error && (
        <Alert tone={snap.error.code === 'quota' ? 'warning' : 'danger'} title={snap.error.code === 'quota' ? 'Teaser limit reached' : 'Not yet'} live="assertive">
          {snap.error.message}
        </Alert>
      )}

      {snap.teaser && watching && (
        <section aria-labelledby="teaser-title" className={styles.teaser}>
          <h3 id="teaser-title" className={styles.sectionTitle}>
            Free teaser: opening statements
          </h3>
          <Courtroom lines={snap.teaser} cast={soloMode.staging(t.terms)} title={t.filing.title} exhibits={t.exhibits} />
          <Alert tone="info" title="The jury is out, and the AI never decides">
            The teaser stops here on purpose (D3). Real people decide the verdict. These openings carry over into your case.
          </Alert>
        </section>
      )}

      <div className={styles.formActions}>
        <Button
          size="lg"
          disabled={!angleText.trim() || angleText.trim().length > ANGLE_MAX}
          loading={busy === 'drafting'}
          onClick={() => {
            if (commitAngle()) void session.approveAndDraft();
          }}
          iconEnd={<Icon name="arrow-right" />}
        >
          Approve and send to counsel
        </Button>
        {snap.teaser ? (
          !watching && (
            <Button variant="secondary" size="lg" onClick={() => setWatching(true)}>
              Watch the teaser again
            </Button>
          )
        ) : (
          <Button
            variant="secondary"
            size="lg"
            disabled={!angleText.trim() || teaserAllowance.remaining === 0}
            loading={busy === 'teaser'}
            onClick={async () => {
              if (!commitAngle()) return;
              await session.watchTeaser();
              setWatching(true);
            }}
          >
            {teaserAllowance.remaining > 0 ? 'Watch the free teaser' : 'Free teaser used today'}
          </Button>
        )}
        <p className={styles.small}>
          Free teasers today: {teaserAllowance.remaining} of {teaserAllowance.limit}. Approving freezes the public text above.
        </p>
      </div>
    </div>
  );
}
