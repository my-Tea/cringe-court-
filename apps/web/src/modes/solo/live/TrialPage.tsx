import { soloMode, soloTerms } from '@cringe-court/modes-solo';
import type { ChainCase, CourtLine } from '@cringe-court/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Alert, Icon, PaperButton, useReducedMotion } from '@/ds';
import { stagePose } from '@/art/art';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, type MessageKey } from '@/i18n';
import { appLedger } from '@/platform/ledger';
import { beatsFromLines } from '@/trial/beats';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { soloPaths } from '../lib/paths';
import { Courtroom } from '../court/Courtroom';
import { soloAudioPort } from '../lib/sound';
import { fetchTrial, readCase, titleFrom } from './liveCase';
import styles from './live.module.css';

const SUMMON: readonly MessageKey[] = ['solo.live.trial.summon.0', 'solo.live.trial.summon.1', 'solo.live.trial.summon.2', 'solo.live.trial.summon.3'];
const SUMMON_MS = 2400;
const JURY_POLL_MS = 20000;
/** How long each empty seat stays empty before the next juror sits. */
export const JURY_SEAT_MS = 1100;
/** Pause on a full bench before the trial starts. */
export const JURY_SEATED_HOLD_MS = 800;

/** Page three: the jury takes the seats the stake paid for, then the trial plays once. */
export function TrialPage() {
  const { caseNumber = '' } = useParams();
  const [live] = useState(() => readCase(caseNumber));
  useDocumentTitle(live ? titleFrom(live.story) : t('solo.live.confess.title'));
  const [lines, setLines] = useState<readonly CourtLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gathered, setGathered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const beginTrial = useCallback(() => setGathered(true), []);
  const cast = useMemo(() => soloMode.staging(soloTerms()), []);

  useEffect(() => {
    if (!live) return;
    let current = true;
    setError(null);
    fetchTrial(live, () => current).then(
      (l) => current && l && setLines(l),
      (e: unknown) => current && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      current = false;
    };
  }, [live, attempt]);

  if (!live) return <Navigate to={soloPaths.file} replace />;
  if (!gathered) return <JuryGather jurors={live.jurors} onSeated={beginTrial} />;
  if (finished) return <Adjourned caseNumber={caseNumber} explorerUrl={live.explorerUrl} />;
  if (error) {
    return (
      <div className={styles.page}>
        <Alert tone="danger" title={t('solo.live.trial.failed', { message: error })} live="assertive">
          {null}
        </Alert>
        <PaperButton onClick={() => setAttempt((n) => n + 1)}>{t('solo.live.trial.retry')}</PaperButton>
      </div>
    );
  }
  if (!lines) return <Summoning />;
  const title = titleFrom(live.story);
  return (
    <div className={styles.court}>
      <h1 className="cc-visually-hidden">{title}</h1>
      <TrialViewFrame
        roam={{
          beats: beatsFromLines(lines),
          label: t('solo.courtroom.region', { title }),
          role: 'defendant',
          spawn: 'defendant',
          avatar: { model: 'creator', name: t('solo.case.trial.you') },
          onDone: () => setFinished(true),
        }}
        classic={<Courtroom lines={lines} cast={cast} title={title} audio={soloAudioPort} onFinished={() => setFinished(true)} />}
        toolbar={
          <PaperButton size="sm" variant="maroon" onClick={() => setFinished(true)} iconEnd={<Icon name="arrow-right" />}>
            {t('solo.case.trial.skip')}
          </PaperButton>
        }
      />
    </div>
  );
}

function Summoning() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), SUMMON_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={styles.summon}>
      <div className={styles.vs} aria-hidden>
        <img className={styles.lawyerIn} src={stagePose('defense', 'objection')} alt="" />
        <span className={styles.vsMark}>{t('solo.live.trial.vs')}</span>
        <img className={styles.lawyerInFlip} src={stagePose('prosecutor', 'objection')} alt="" />
      </div>
      <p key={i} role="status" className={styles.summonLine}>
        {t(SUMMON[i % SUMMON.length]!)}
      </p>
    </div>
  );
}

/** The stake chose the jury size. Seats fill one by one, then the trial starts. */
function JuryGather({ jurors, onSeated }: { jurors: number; onSeated: () => void }) {
  const reduced = useReducedMotion();
  const size = Math.max(1, jurors);
  const [seated, setSeated] = useState(reduced ? size : 0);

  useEffect(() => {
    if (reduced || seated >= size) {
      const id = window.setTimeout(onSeated, reduced ? 400 : JURY_SEATED_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setSeated((n) => n + 1), JURY_SEAT_MS);
    return () => window.clearTimeout(id);
  }, [reduced, seated, size, onSeated]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('solo.live.jury.waitTitle')}</h1>
      <p className={styles.lede}>{t('solo.live.jury.waitBody', { jurors: size })}</p>
      <div className={styles.bench} aria-hidden>
        {Array.from({ length: size }, (_, i) => (
          <span key={i} className={i < seated ? styles.benchFull : styles.benchEmpty} />
        ))}
      </div>
      <p role="status">{seated >= size ? t('solo.live.jury.full') : t('solo.live.jury.seats', { seated, jurors: size })}</p>
    </div>
  );
}

function Adjourned({ caseNumber, explorerUrl }: { caseNumber: string; explorerUrl: string }) {
  const ledger = appLedger();
  const n = Number(caseNumber) as ChainCase['number'];
  const [chain, setChain] = useState<ChainCase | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void ledger.port.getCase(n).then(setChain).catch(() => undefined);
    setNow(Date.now());
  }, [ledger, n]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, JURY_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const deadline = chain?.deadlines.recruitment ?? null;

  const refund = async () => {
    setBusy(true);
    setError(null);
    try {
      await ledger.port.advance(n);
      await ledger.port.claim(n);
      setRefunded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('solo.live.trial.adjourned')}</h1>
      <p className={styles.lede}>{t('solo.live.trial.adjournedBody')}</p>
      {deadline ? <p className={styles.hint}>{t('solo.live.jury.deadline', { time: new Date(deadline * 1000).toLocaleTimeString() })}</p> : null}
      {error ? (
        <Alert tone="danger" title={t('solo.live.stake.failed', { message: error })}>
          {null}
        </Alert>
      ) : null}
      {refunded ? <p role="status">{t('solo.live.jury.refunded')}</p> : null}
      {deadline && now >= deadline * 1000 && !refunded ? (
        <PaperButton loading={busy} onClick={() => void refund()}>
          {t('solo.live.jury.refund')}
        </PaperButton>
      ) : null}
      <div className={styles.row}>
        <a className={styles.textButton} href={explorerUrl} target="_blank" rel="noreferrer">
          {t('solo.live.jury.tx')}
        </a>
        <Link className={styles.textButton} to={soloPaths.file}>
          {t('solo.live.jury.again')}
        </Link>
      </div>
    </div>
  );
}
