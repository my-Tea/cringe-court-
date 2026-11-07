import { soloMode, soloTerms, NPC_PERSONAS } from '@cringe-court/modes-solo';
import { templateCommentary, type FinalizedCaseResult } from '@cringe-court/ai/court';
import type { ChainCase, CourtLine } from '@cringe-court/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Alert, Icon, PaperButton, Stamp, useReducedMotion } from '@/ds';
import { stagePose } from '@/art/art';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, type MessageKey } from '@/i18n';
import { platformConfig } from '@/platform/config';
import { appLedger } from '@/platform/ledger';
import { beatsFromLines, type PlannedBeat } from '@/trial/beats';
import { JURY_SEAT_MS, JURY_SEATED_HOLD_MS, JuryGather } from '@/trial/JuryGather';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { canRoam, useTrialView } from '@/trial/trialView';
import { soloPaths } from '../lib/paths';
import { Courtroom } from '../court/Courtroom';
import { soloAudioPort } from '../lib/sound';
import { fetchTrial, juryStep, readCase, titleFrom, type JuryStatus } from './liveCase';
import styles from './live.module.css';

export { JURY_SEAT_MS, JURY_SEATED_HOLD_MS };

const SUMMON: readonly MessageKey[] = ['solo.live.trial.summon.0', 'solo.live.trial.summon.1', 'solo.live.trial.summon.2', 'solo.live.trial.summon.3'];
const SUMMON_MS = 2400;
const JURY_POLL_MS = 20000;
/** How long before the next juror seals their scroll on the voting page. */
export const VOTE_SEAL_MS = 1400;
/** Pause after the last vote before the judge speaks. */
export const VOTE_HOLD_MS = 900;

const JURY_STEP_MS = 900;
const EXPLORER_TX = 'https://testnet.arcscan.app/tx/';

type Phase = 'gather' | 'trial' | 'voting' | 'verdict' | 'adjourned';

/** A recording of the game hides the controls. */
const inCinema = () => {
  try {
    return window.localStorage.getItem('cc:cinema') === '1';
  } catch {
    return false;
  }
};

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

/** Keeps the demo jury moving on Arc while the page plays. Null means this server has none. */
function useDemoJury(live: ReturnType<typeof readCase>, step: 'seat' | 'open' | 'vote') {
  const [status, setStatus] = useState<JuryStatus | null>(null);
  const [absent, setAbsent] = useState(!platformConfig.backend);
  useEffect(() => {
    if (!live || absent) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const next = await juryStep(live, step).catch(() => undefined);
      if (!current) return;
      if (next === null) {
        setAbsent(true);
        return;
      }
      if (next) setStatus(next);
      if (next?.stage !== 'final' && next?.stage !== 'failed') timer = setTimeout(() => void tick(), JURY_STEP_MS);
    };
    void tick();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [live, step, absent]);
  return { status, absent };
}

/** Page three, in the courtroom from first to last: gather → trial → voting → verdict → adjourned. */
export function TrialPage() {
  const { caseNumber = '' } = useParams();
  const [live] = useState(() => readCase(caseNumber));
  useDocumentTitle(live ? titleFrom(live.story) : t('solo.live.confess.title'));
  const [lines, setLines] = useState<readonly CourtLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('gather');
  const [attempt, setAttempt] = useState(0);
  const [votes, setVotes] = useState<CastVote[] | null>(null);
  const [spoke, setSpoke] = useState(false);
  const cast = useMemo(() => soloMode.staging(soloTerms()), []);
  const terms = useMemo(() => soloTerms(), []);
  const [cinema] = useState(inCinema);
  const { view, available } = useTrialView();
  const inRoom = available && view === 'roam' && canRoam();
  const planned = useMemo(() => (live ? demoVotes(caseNumber, live.jurors) : []), [live, caseNumber]);
  const juryAction = phase === 'voting' ? 'vote' : lines && phase !== 'gather' ? 'open' : 'seat';
  const { status: jury, absent } = useDemoJury(live, juryAction);
  const onChain = !absent && !!jury;
  const seated = onChain ? jury.jurors.filter((j) => j.seatTx).length : undefined;

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

  // The bots' ballots are final on Arc: the judge can speak.
  useEffect(() => {
    if (phase !== 'voting' || !onChain || jury.stage !== 'final') return;
    const id = window.setTimeout(() => {
      setVotes(jury.jurors.map((j) => ({ seat: j.seat, name: j.name, choice: j.choice ?? 0, line: j.line ?? '' })));
      setPhase('verdict');
    }, VOTE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [phase, onChain, jury]);

  // No room to play the verdict in: go straight to the judge's card.
  useEffect(() => {
    if (phase === 'verdict' && !inRoom) setSpoke(true);
  }, [phase, inRoom]);

  const seatedOnChain = onChain && jury.stage !== 'seating';
  useEffect(() => {
    if (phase !== 'gather' || !seatedOnChain) return;
    const id = window.setTimeout(() => setPhase('trial'), JURY_SEATED_HOLD_MS * 2);
    return () => window.clearTimeout(id);
  }, [phase, seatedOnChain]);

  const finale = useMemo<readonly PlannedBeat[] | null>(() => {
    if (phase === 'voting') return [{ id: 'jury-deliberating', options: { lines: [{ speaker: 'judge', text: t('solo.live.vote.call') }] } }];
    if (phase !== 'verdict' || !votes) return null;
    const outcome = onChain && jury.outcome ? jury.outcome : outcomeOf(tallyOf(votes));
    return [
      { id: 'counsel-arguing', options: { lines: votes.map((v) => ({ speaker: `juror-${v.seat}`, text: v.line })) } },
      { id: 'verdict', options: { verdict: outcome === 'NOT_COOKED' ? 'not-cooked' : outcome === 'GUILTY' ? 'guilty' : 'mistrial' } },
    ];
  }, [phase, votes, onChain, jury?.outcome]);

  if (!live) return <Navigate to={soloPaths.file} replace />;

  const title = titleFrom(live.story);
  const overlay =
    phase === 'gather' ? (
      absent ? (
        <JuryGather jurors={live.jurors} onSeated={() => setPhase('trial')} title={t('solo.live.jury.waitTitle')} body={t('solo.live.jury.waitBody', { jurors: live.jurors })} />
      ) : (
        <SeatHud jury={jury} jurors={live.jurors} />
      )
    ) : phase === 'voting' ? (
      <VotingPage
        jurors={live.jurors}
        planned={onChain ? jury.jurors.map((j) => ({ seat: j.seat, name: j.name, choice: j.choice ?? 0, line: j.line ?? '' })) : planned}
        opened={onChain ? jury.jurors.filter((j) => j.revealTx).length : null}
        ballot={terms.ballot}
        onChain={onChain}
        onDone={(c) => {
          setVotes(c);
          setPhase('verdict');
        }}
      />
    ) : phase === 'verdict' && votes && spoke ? (
      <VerdictAnnounce
        caseNumber={caseNumber}
        title={title}
        story={live.story}
        votes={votes}
        ballot={terms.ballot}
        said={onChain ? jury : null}
        onDone={() => setPhase('adjourned')}
      />
    ) : phase === 'adjourned' ? (
      <Adjourned caseNumber={caseNumber} explorerUrl={live.explorerUrl} votes={votes} ballot={terms.ballot} jury={onChain ? jury : null} />
    ) : error ? (
      <div className={styles.page}>
        <Alert tone="danger" title={t('solo.live.trial.failed', { message: error })} live="assertive">
          {null}
        </Alert>
        <PaperButton onClick={() => setAttempt((n) => n + 1)}>{t('solo.live.trial.retry')}</PaperButton>
      </div>
    ) : !lines && phase === 'trial' ? (
      <Summoning />
    ) : null;

  return (
    <div className={styles.court}>
      <h1 className="cc-visually-hidden">{title}</h1>
      <TrialViewFrame
        bare={cinema}
        roam={{
          beats: beatsFromLines(lines ?? []),
          label: t('solo.courtroom.region', { title }),
          role: 'defendant',
          spawn: 'defendant',
          jurors: live.jurors,
          avatar: { model: 'defendant', name: t('solo.case.trial.you') },
          hold: phase === 'gather' || !lines,
          ...(seated !== undefined ? { seated } : {}),
          stayInSession: true,
          finale,
          onFinale: () => {
            if (phase === 'verdict') setSpoke(true);
          },
          chromeless: cinema,
          bleed: true,
          onDone: () => setPhase('voting'),
        }}
        classic={lines ? <Courtroom lines={lines} cast={cast} title={title} audio={soloAudioPort} onFinished={() => setPhase('voting')} /> : null}
        toolbar={
          <PaperButton size="sm" variant="maroon" onClick={() => setPhase('voting')} iconEnd={<Icon name="arrow-right" />}>
            {t('solo.case.trial.skip')}
          </PaperButton>
        }
      />
      {overlay ? <div className={styles.hud}>{overlay}</div> : null}
    </div>
  );
}

/** The jury box filling for real: each seat is one transaction on Arc. */
function SeatHud({ jury, jurors }: { jury: JuryStatus | null; jurors: number }) {
  const seats = jury?.jurors ?? [];
  const taken = seats.filter((j) => j.seatTx).length;
  return (
    <section className={styles.seatHud} aria-labelledby="seat-hud">
      <h2 id="seat-hud" className={styles.hudTitle}>
        {t('solo.live.jury.waitTitle')}
      </h2>
      <p role="status" className={styles.hudLine}>
        {taken >= jurors ? t('solo.live.jury.full') : t('solo.live.jury.seats', { seated: taken, jurors })}
      </p>
      <ul className={styles.seatList}>
        {seats.map((j) => (
          <li key={j.seat} data-taken={j.seatTx ? true : undefined}>
            <strong>{j.seatTx ? j.name : t('solo.live.jury.empty')}</strong>
            {j.seatTx ? <span>{t('solo.live.jury.bonded', { tx: `${j.seatTx.slice(0, 10)}…` })}</span> : <span>{t('solo.live.jury.waiting')}</span>}
          </li>
        ))}
      </ul>
      <p className={styles.botNote}>{t('solo.live.jury.botNote')}</p>
    </section>
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

/** The scrolls, over the room. `opened` comes from Arc when the jury is real; otherwise they open on a timer. */
function VotingPage({
  jurors,
  planned,
  opened: arcOpened,
  ballot,
  onChain,
  onDone,
}: {
  jurors: number;
  planned: readonly CastVote[];
  opened: number | null;
  ballot: readonly [string, string];
  onChain: boolean;
  onDone: (votes: CastVote[]) => void;
}) {
  const reduced = useReducedMotion();
  const [timerOpened, setOpened] = useState(reduced ? planned.length : 0);
  const opened = arcOpened ?? timerOpened;
  const revealed = planned.slice(0, opened);
  const tally = tallyOf(revealed);

  useEffect(() => {
    if (onChain) return;
    if (reduced || opened >= planned.length) {
      const id = window.setTimeout(() => onDone([...planned]), VOTE_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setOpened((n) => n + 1), VOTE_SEAL_MS);
    return () => window.clearTimeout(id);
  }, [onChain, reduced, opened, planned, onDone]);

  return (
    <section className={styles.voteHud} aria-labelledby="vote-hud">
      <h2 id="vote-hud" className={styles.hudTitle}>
        {t('solo.live.vote.title')}
      </h2>
      <p className={styles.hudLine}>{t('solo.live.vote.body', { jurors })}</p>
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
    </section>
  );
}

/** Judge Gavel.exe announces the result (post-verdict prompt / template). */
function VerdictAnnounce({
  caseNumber,
  title,
  story,
  votes,
  ballot,
  said,
  onDone,
}: {
  caseNumber: string;
  title: string;
  story: string;
  votes: readonly CastVote[];
  ballot: readonly [string, string];
  said: JuryStatus | null;
  onDone: () => void;
}) {
  const tally = tallyOf(votes);
  const outcome = said?.outcome ?? outcomeOf(tally);
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
  const template = useMemo(() => templateCommentary(result), [result]);
  const commentary = { ...template, announcement: said?.announcement ?? template.announcement, quip: said?.quip ?? template.quip };
  const stamp = outcome === 'GUILTY' ? 'guilty' : outcome === 'NOT_COOKED' ? 'not-cooked' : 'no-verdict';

  return (
    <div className={styles.verdictCard}>
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
  jury,
}: {
  caseNumber: string;
  explorerUrl: string;
  votes: CastVote[] | null;
  ballot: readonly [string, string];
  jury: JuryStatus | null;
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
    <div className={styles.verdictCard}>
      <h2 className={styles.heading}>{t('solo.live.trial.adjourned')}</h2>
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
      {jury?.finalizeTx ? <p className={styles.hint}>{t('solo.live.trial.settled')}</p> : null}
      {deadline && !jury && now >= deadline * 1000 && !refunded ? (
        <PaperButton loading={busy} onClick={() => void refund()}>
          {t('solo.live.jury.refund')}
        </PaperButton>
      ) : null}
      <div className={styles.row}>
        <a className={styles.textButton} href={explorerUrl} target="_blank" rel="noreferrer">
          {t('solo.live.jury.tx')}
        </a>
        {jury?.finalizeTx ? (
          <a className={styles.textButton} href={`${EXPLORER_TX}${jury.finalizeTx}`} target="_blank" rel="noreferrer">
            {t('solo.live.trial.settleTx')}
          </a>
        ) : null}
        <Link className={styles.textButton} to={soloPaths.file}>
          {t('solo.live.jury.again')}
        </Link>
      </div>
    </div>
  );
}
