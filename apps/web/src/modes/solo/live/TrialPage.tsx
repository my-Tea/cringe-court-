import { soloMode, soloTerms, NPC_PERSONAS } from '@cringe-court/modes-solo';
import { templateCommentary, type FinalizedCaseResult } from '@cringe-court/ai/court';
import type { ChainCase, CourtLine } from '@cringe-court/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Alert, Icon, PaperButton, Stamp, useReducedMotion } from '@/ds';
import { stagePose } from '@/art/art';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, type MessageKey } from '@/i18n';
import { appLedger } from '@/platform/ledger';
import { beatsFromLines } from '@/trial/beats';
import { JURY_SEAT_MS, JURY_SEATED_HOLD_MS, JuryGather } from '@/trial/JuryGather';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { soloPaths } from '../lib/paths';
import { Courtroom } from '../court/Courtroom';
import { soloAudioPort } from '../lib/sound';
import { fetchTrial, readCase, titleFrom } from './liveCase';
import styles from './live.module.css';

export { JURY_SEAT_MS, JURY_SEATED_HOLD_MS };

const SUMMON: readonly MessageKey[] = ['solo.live.trial.summon.0', 'solo.live.trial.summon.1', 'solo.live.trial.summon.2', 'solo.live.trial.summon.3'];
const SUMMON_MS = 2400;
const JURY_POLL_MS = 20000;
/** How long before the next juror seals their scroll on the voting page. */
export const VOTE_SEAL_MS = 1400;
/** Pause after the last vote before the judge speaks. */
export const VOTE_HOLD_MS = 900;

type Phase = 'gather' | 'trial' | 'voting' | 'verdict' | 'adjourned';

type Ballot = 0 | 1;

interface CastVote {
  seat: number;
  name: string;
  choice: Ballot;
  line: string;
}

/** Stable demo votes from the case number so a re-run of the same case looks the same. */
function demoVotes(caseNumber: string, jurors: number): CastVote[] {
  const size = Math.max(1, jurors);
  const out: CastVote[] = [];
  let seed = [...caseNumber].reduce((a, c) => a + c.charCodeAt(0), 7) || 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < size; i++) {
    const p = NPC_PERSONAS[i % NPC_PERSONAS.length]!;
    const lean = 0.5 + p.bias * 0.35;
    const choice: Ballot = next() < lean ? 0 : 1;
    out.push({ seat: i + 1, name: p.name, choice, line: p.says[choice] });
  }
  return out;
}

function tallyOf(votes: readonly CastVote[]): readonly [number, number] {
  let a = 0;
  let b = 0;
  for (const v of votes) {
    if (v.choice === 0) a += 1;
    else b += 1;
  }
  return [a, b];
}

function outcomeOf(tally: readonly [number, number]): 'GUILTY' | 'NOT_COOKED' | 'NO_VERDICT' {
  if (tally[0] === tally[1]) return 'NO_VERDICT';
  return tally[0] > tally[1] ? 'GUILTY' : 'NOT_COOKED';
}

/** Page three: gather → trial → voting → judge verdict → adjourned. Built for the multiplayer demo reel. */
export function TrialPage() {
  const { caseNumber = '' } = useParams();
  const [live] = useState(() => readCase(caseNumber));
  useDocumentTitle(live ? titleFrom(live.story) : t('solo.live.confess.title'));
  const [lines, setLines] = useState<readonly CourtLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('gather');
  const [attempt, setAttempt] = useState(0);
  const [votes, setVotes] = useState<CastVote[] | null>(null);
  const beginTrial = useCallback(() => setPhase('trial'), []);
  const cast = useMemo(() => soloMode.staging(soloTerms()), []);
  const terms = useMemo(() => soloTerms(), []);
  const planned = useMemo(() => (live ? demoVotes(caseNumber, live.jurors) : []), [live, caseNumber]);

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

  if (phase === 'gather') {
    return (
      <JuryGather
        jurors={live.jurors}
        onSeated={beginTrial}
        title={t('solo.live.jury.waitTitle')}
        body={t('solo.live.jury.waitBody', { jurors: live.jurors })}
      />
    );
  }

  if (phase === 'voting') {
    return (
      <VotingPage
        jurors={live.jurors}
        planned={planned}
        ballot={terms.ballot}
        onDone={(cast) => {
          setVotes(cast);
          setPhase('verdict');
        }}
      />
    );
  }

  if (phase === 'verdict' && votes) {
    return (
      <VerdictAnnounce
        caseNumber={caseNumber}
        title={titleFrom(live.story)}
        story={live.story}
        votes={votes}
        ballot={terms.ballot}
        onDone={() => setPhase('adjourned')}
      />
    );
  }

  if (phase === 'adjourned') {
    return <Adjourned caseNumber={caseNumber} explorerUrl={live.explorerUrl} votes={votes} ballot={terms.ballot} />;
  }

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
          avatar: { model: 'defendant', name: t('solo.case.trial.you') },
          onDone: () => setPhase('voting'),
        }}
        classic={<Courtroom lines={lines} cast={cast} title={title} audio={soloAudioPort} onFinished={() => setPhase('voting')} />}
        toolbar={
          <PaperButton size="sm" variant="maroon" onClick={() => setPhase('voting')} iconEnd={<Icon name="arrow-right" />}>
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

/** Multiplayer-looking vote reel: scrolls seal one by one, tally updates live. */
function VotingPage({
  jurors,
  planned,
  ballot,
  onDone,
}: {
  jurors: number;
  planned: readonly CastVote[];
  ballot: readonly [string, string];
  onDone: (votes: CastVote[]) => void;
}) {
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(reduced ? planned.length : 0);
  const revealed = planned.slice(0, opened);
  const tally = tallyOf(revealed);

  useEffect(() => {
    if (reduced) {
      const id = window.setTimeout(() => onDone([...planned]), VOTE_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    if (opened >= planned.length) {
      const id = window.setTimeout(() => onDone([...planned]), VOTE_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setOpened((n) => n + 1), VOTE_SEAL_MS);
    return () => window.clearTimeout(id);
  }, [reduced, opened, planned, onDone]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('solo.live.vote.title')}</h1>
      <p className={styles.lede}>{t('solo.live.vote.body', { jurors })}</p>
      <div className={styles.tallyBoard} role="status" aria-live="polite">
        <span>
          {ballot[0]} <strong>{tally[0]}</strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          {ballot[1]} <strong>{tally[1]}</strong>
        </span>
        <span className={styles.hint}>{t('solo.live.vote.progress', { sealed: opened, jurors: planned.length })}</span>
      </div>
      <ul className={styles.voteList} aria-label={t('solo.live.vote.list')}>
        {planned.map((v, i) => {
          const open = i < opened;
          return (
            <li key={v.seat} className={open ? styles.voteOpen : styles.voteSealed} data-choice={open ? v.choice : undefined}>
              <strong>{v.name}</strong>
              <span>{open ? `“${v.line}”` : t('solo.live.vote.sealed')}</span>
              <em>{open ? ballot[v.choice] : '…'}</em>
            </li>
          );
        })}
      </ul>
      {opened >= planned.length ? <p role="status">{t('solo.live.vote.done')}</p> : null}
    </div>
  );
}

/** Judge Gavel.exe announces the result (post-verdict prompt / template). */
function VerdictAnnounce({
  caseNumber,
  title,
  story,
  votes,
  ballot,
  onDone,
}: {
  caseNumber: string;
  title: string;
  story: string;
  votes: readonly CastVote[];
  ballot: readonly [string, string];
  onDone: () => void;
}) {
  const tally = tallyOf(votes);
  const outcome = outcomeOf(tally);
  const result = useMemo<FinalizedCaseResult>(
    () => ({
      caseId: `solo-live-${caseNumber}`,
      mode: 'solo',
      status: 'FINALIZED',
      outcome,
      title,
      summary: story.slice(0, 180),
    }),
    [caseNumber, outcome, title, story],
  );
  const commentary = useMemo(() => templateCommentary(result), [result]);
  const stamp = outcome === 'GUILTY' ? 'guilty' : outcome === 'NOT_COOKED' ? 'not-cooked' : 'no-verdict';

  return (
    <div className={styles.page}>
      <p className={styles.hint}>{t('solo.live.verdict.eyebrow')}</p>
      <Stamp tone={stamp} size="xl" animate>
        {outcome === 'NOT_COOKED' ? 'NOT COOKED' : outcome === 'GUILTY' ? 'GUILTY' : 'NO VERDICT'}
      </Stamp>
      <p className={styles.lede} role="status">
        {commentary.announcement}
      </p>
      <p className={styles.judgeQuip}>{commentary.quip}</p>
      <div className={styles.tallyBoard}>
        <span>
          {ballot[0]} <strong>{tally[0]}</strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          {ballot[1]} <strong>{tally[1]}</strong>
        </span>
      </div>
      <ul className={styles.reactList}>
        {commentary.prosecutorReaction ? <li data-side="p">{t('solo.live.verdict.ratio', { line: commentary.prosecutorReaction })}</li> : null}
        {commentary.defenseReaction ? <li data-side="d">{t('solo.live.verdict.chaos', { line: commentary.defenseReaction })}</li> : null}
      </ul>
      <PaperButton size="lg" onClick={onDone} iconEnd={<Icon name="arrow-right" />}>
        {t('solo.live.verdict.continue')}
      </PaperButton>
    </div>
  );
}

function Adjourned({
  caseNumber,
  explorerUrl,
  votes,
  ballot,
}: {
  caseNumber: string;
  explorerUrl: string;
  votes: CastVote[] | null;
  ballot: readonly [string, string];
}) {
  const ledger = appLedger();
  const n = Number(caseNumber) as ChainCase['number'];
  const [chain, setChain] = useState<ChainCase | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tally = votes ? tallyOf(votes) : null;

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
      {tally ? (
        <div className={styles.tallyBoard} role="status">
          <span>
            {ballot[0]} <strong>{tally[0]}</strong>
          </span>
          <span aria-hidden>·</span>
          <span>
            {ballot[1]} <strong>{tally[1]}</strong>
          </span>
        </div>
      ) : null}
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
