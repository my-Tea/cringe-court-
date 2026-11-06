import { useState, type FormEvent } from 'react';
import type { EvidenceState, PublicExhibit } from '@cringe-court/core';
import { ANGLE_MAX, soloMode, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { Alert, Badge, Button, Icon, PaperButton, PaperField, PaperPanel, PaperRibbon, Portrait, Select, Skeleton, TextArea, cx } from '@/ds';
import { t } from '@/i18n';
import { Courtroom } from '../court/Courtroom';
import styles from './FilePage.module.css';
import { soloRedactionLabel } from '@/i18n/domain';

export interface BriefStepProps {
  session: SoloSession;
  snap: SoloSnapshot & { trial: EvidenceState };
  hiddenNames: readonly string[];
  teaserAllowance: { remaining: number; limit: number };
}

const OWN = 'own';

/** Step 2: approve what the public sees, add evidence, brief Counsel Chaos (D2), and optionally watch the free teaser (D3). */
export function BriefStep({ session, snap, hiddenNames, teaserAllowance }: BriefStepProps) {
  const tState = snap.trial;
  const side = tState.filing.sides.a!;
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

  const exhibitsLeft = tState.rules.maxExhibits - tState.exhibits.length;

  return (
    <div className={styles.brief}>
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>{t('solo.file.stepOf', { n: 2, total: 5 })}</p>
        <PaperRibbon as="h2" className={styles.stepTitle}>
          {t('solo.brief.title')}
        </PaperRibbon>
        <p className={styles.lede}>{t('solo.brief.lede')}</p>
      </header>

      <div className={styles.briefGrid}>
        <PaperPanel as="section" edge="cut" elevation={2} aria-labelledby="public-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>{t('solo.brief.public.eyebrow')}</p>
              <h3 id="public-title" className={styles.panelTitle}>
                {t('solo.brief.public.heading')}
              </h3>
            </header>
            <p className={styles.publicTitle}>“{tState.filing.title}”</p>
            <p className={styles.publicStory}>{side.story}</p>
            {snap.redactions.length > 0 ? (
              <ul className={styles.redactions} role="list" aria-label={t('solo.brief.public.redactions')}>
                {snap.redactions.map((r, i) => (
                  <li key={i}>
                    <Badge tone="info">{soloRedactionLabel(r.kind)}</Badge> {t('solo.brief.public.hidden')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>{t('solo.brief.public.nothing')}</p>
            )}
            <Button size="sm" variant="ghost" onClick={() => session.withdraw()}>
              {t('solo.brief.startOver')}
            </Button>
          </div>
        </PaperPanel>

        <PaperPanel as="section" edge="cut" elevation={2} aria-labelledby="evidence-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>{t('solo.brief.exhibits.eyebrow', { left: exhibitsLeft, max: tState.rules.maxExhibits })}</p>
              <h3 id="evidence-title" className={styles.panelTitle}>
                {t('solo.brief.exhibits.heading')}
              </h3>
            </header>
            {tState.exhibits.length > 0 && (
              <ol className={styles.exhibits} role="list">
                {tState.exhibits.map((x, i) => (
                  <li key={x.id}>
                    <span className={styles.exhibitLetter}>{String.fromCharCode(65 + i)}</span>
                    <div>
                      <strong>{x.title}</strong>
                      <p>{x.body}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => session.removeExhibit(x.id)}
                      aria-label={t('solo.brief.exhibit.removeAria', { letter: String.fromCharCode(65 + i), title: x.title })}
                    >
                      {t('solo.brief.exhibit.remove')}
                    </Button>
                  </li>
                ))}
              </ol>
            )}
            {exhibitsLeft > 0 && (
              <form className={styles.exhibitForm} onSubmit={addExhibit} aria-label={t('solo.brief.exhibit.formLabel')}>
                <Select
                  label={t('solo.brief.exhibit.kind')}
                  value={exhibit.kind}
                  onChange={(e) => setExhibit({ ...exhibit, kind: e.target.value as PublicExhibit['kind'] })}
                  options={[
                    { value: 'text', label: t('solo.brief.exhibit.kind.text') },
                    { value: 'quote', label: t('solo.brief.exhibit.kind.quote') },
                    { value: 'screenshot', label: t('solo.brief.exhibit.kind.screenshot') },
                    { value: 'link', label: t('solo.brief.exhibit.kind.link') },
                  ]}
                />
                <PaperField label={t('solo.brief.exhibit.titleField')} value={exhibit.title} maxLength={80} onChange={(e) => setExhibit({ ...exhibit, title: e.target.value })} />
                <TextArea
                  label={t('solo.brief.exhibit.bodyField')}
                  value={exhibit.body}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => setExhibit({ ...exhibit, body: e.target.value })}
                />
                <Button type="submit" size="sm" variant="secondary" iconStart={<Icon name="plus" />}>
                  {t('solo.brief.exhibit.add')}
                </Button>
              </form>
            )}
          </div>
        </PaperPanel>
      </div>

      <section className={styles.angles} aria-labelledby="angle-title">
        <div className={styles.anglesHead}>
          <Portrait character="defense" expression="smug" size="lg" ring="accent" alt="" />
          <div>
            <h3 id="angle-title" className={styles.sectionTitle}>
              {t('solo.brief.angle.heading')}
            </h3>
            <p className={styles.small}>{t('solo.brief.angle.hint', { max: ANGLE_MAX })}</p>
          </div>
        </div>
        {!snap.angles ? (
          busy === 'angles' ? (
            <div className={styles.angleGrid} aria-busy="true" aria-label={t('solo.brief.angle.thinking')}>
              <Skeleton height="6rem" />
              <Skeleton height="6rem" />
              <Skeleton height="6rem" />
            </div>
          ) : (
            <PaperButton variant="maroon" onClick={() => void session.suggestAngles()} iconStart={<Icon name="sparkle" />}>
              {t('solo.brief.angle.ask')}
            </PaperButton>
          )
        ) : (
          <fieldset className={styles.angleFieldset}>
            <legend className="cc-visually-hidden">{t('solo.brief.angle.legend')}</legend>
            <div className={styles.angleGrid}>
              {snap.angles.map((a) => (
                <label key={a.id} className={cx(styles.angle, choice === a.id && styles.angleOn)}>
                  <input type="radio" name="angle" value={a.id} checked={choice === a.id} onChange={() => setChoice(a.id)} />
                  <span>{a.text}</span>
                </label>
              ))}
              <label className={cx(styles.angle, choice === OWN && styles.angleOn)}>
                <input type="radio" name="angle" value={OWN} checked={choice === OWN} onChange={() => setChoice(OWN)} />
                <span>{t('solo.brief.angle.own')}</span>
              </label>
            </div>
          </fieldset>
        )}
        {choice === OWN && (
          <TextArea
            label={t('solo.brief.angle.ownLabel')}
            value={own}
            maxLength={ANGLE_MAX}
            rows={2}
            onChange={(e) => setOwn(e.target.value)}
            placeholder={t('solo.brief.angle.ownPlaceholder')}
          />
        )}
      </section>

      {snap.error && (
        <Alert
          tone={snap.error.code === 'quota' ? 'warning' : 'danger'}
          title={snap.error.code === 'quota' ? t('solo.brief.error.quota') : t('solo.brief.error.generic')}
          live="assertive"
        >
          {snap.error.message}
        </Alert>
      )}

      {snap.teaser && watching && (
        <section aria-labelledby="teaser-title" className={styles.teaser}>
          <h3 id="teaser-title" className={styles.sectionTitle}>
            {t('solo.brief.teaser.heading')}
          </h3>
          <Courtroom lines={snap.teaser} cast={soloMode.staging(tState.terms)} title={tState.filing.title} exhibits={tState.exhibits} />
          <Alert tone="info" title={t('solo.brief.teaser.alertTitle')}>
            {t('solo.brief.teaser.alertBody')}
          </Alert>
        </section>
      )}

      <div className={styles.formActions}>
        <PaperButton
          size="lg"
          disabled={!angleText.trim() || angleText.trim().length > ANGLE_MAX}
          loading={busy === 'drafting'}
          onClick={() => {
            if (commitAngle()) void session.approveAndDraft();
          }}
          iconEnd={<Icon name="arrow-right" />}
        >
          {t('solo.brief.approve')}
        </PaperButton>
        {snap.teaser ? (
          !watching && (
            <PaperButton variant="maroon" size="lg" onClick={() => setWatching(true)}>
              {t('solo.brief.teaser.again')}
            </PaperButton>
          )
        ) : (
          <PaperButton
            variant="maroon"
            size="lg"
            disabled={!angleText.trim() || teaserAllowance.remaining === 0}
            loading={busy === 'teaser'}
            onClick={async () => {
              if (!commitAngle()) return;
              await session.watchTeaser();
              setWatching(true);
            }}
          >
            {teaserAllowance.remaining > 0 ? t('solo.brief.teaser.watch') : t('solo.brief.teaser.used')}
          </PaperButton>
        )}
        <p className={styles.small}>{t('solo.brief.teaser.count', { remaining: teaserAllowance.remaining, limit: teaserAllowance.limit })}</p>
      </div>
    </div>
  );
}
