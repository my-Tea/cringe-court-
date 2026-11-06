import type { CalloutStyle, CourtLine, ScenePort, Speaker } from '@cringe-court/core';
import type { PlayerEvent, ShowPlayer } from '@cringe-court/engine';
import { Courtroom } from '@cringe-court/scene/react';
import type { CourtroomRuntime } from '@cringe-court/scene';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CharacterId } from '@/art/art';
import { DialogueBox, ImpactText, Stamp, cx, type ImpactKind, type StampTone } from '@/ds';
import styles from './TrialStage.module.css';

const SPEAKER: Readonly<Record<Speaker, CharacterId>> = {
  judge: 'judge',
  prosecutor: 'prosecutor',
  defense: 'defense',
  'side-a': 'side-a',
  'side-b': 'side-b',
  narrator: 'ai-narrator',
};

const IMPACT: Readonly<Record<CalloutStyle, ImpactKind | null>> = {
  objection: 'objection',
  order: 'order',
  counter: 'counter',
  'let-bro-cook': 'cook',
  'jury-out': null,
  verdict: null,
};

type Card = { id: number; tone: StampTone; text: string; sub?: string; size: 'lg' | 'xl' };

function cardFor(e: Extract<PlayerEvent, { type: 'card' }>, id: number): Card | null {
  switch (e.card) {
    case 'case-number':
      return { id, tone: 'case-number', text: e.text ?? 'CASE', size: 'lg' };
    case 'charges-filed':
      return { id, tone: 'filed', text: 'CHARGES FILED', size: 'lg' };
    case 'jury-out':
      return { id, tone: 'case-number', text: 'THE JURY IS OUT', sub: 'Verdict by a human jury', size: 'lg' };
    case 'mistrial':
      return { id, tone: 'no-verdict', text: 'MISTRIAL', sub: 'No verdict · full refund', size: 'xl' };
    case 'verdict': {
      const label = e.text ?? '';
      const tone: StampTone = label === 'GUILTY' ? 'guilty' : label === 'NOT COOKED' ? 'not-cooked' : label === 'SIDE A' ? 'side-a' : label === 'SIDE B' ? 'side-b' : 'filed';
      return { id, tone, text: label, sub: 'The jury has spoken', size: 'xl' };
    }
    case 'receipt':
      return null;
    default:
      return null;
  }
}

export interface TrialStageProps {
  runtime: CourtroomRuntime;
  scene: ScenePort;
  player: ShowPlayer;
  /** Badge shown top-left ("CASE #0069"). */
  caseLabel?: string | null;
  /** Small status chip top-right. */
  status?: ReactNode;
  /** Plate overrides (Versus nicknames). */
  speakerNames?: Partial<Record<Speaker, string>>;
  children?: ReactNode;
}

/**
 * The trial stage: the 3D courtroom with the show's overlays (dialogue, callouts,
 * stamps, flashes) and playback controls. Modes reuse this; it renders whatever
 * the ShowPlayer performs and never knows which mode it is in.
 */
export function TrialStage({ runtime, scene, player, caseLabel, status, speakerNames, children }: TrialStageProps) {
  const [line, setLine] = useState<CourtLine | null>(null);
  const [said, setSaid] = useState<CourtLine[]>([]);
  const [callout, setCallout] = useState<{ id: number; kind: ImpactKind; text: string } | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [flash, setFlash] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const counter = useRef(0);

  useEffect(
    () =>
      player.subscribe((e) => {
        if (e.type === 'start') setPlaying(true);
        if (e.type === 'done') {
          setPlaying(false);
          setLine(null);
        }
        if (e.type === 'line') {
          setLine(e.line);
          setSaid((all) => (all.some((l) => l.id === e.line.id) ? all : [...all, e.line]));
        }
        if (e.type === 'card') {
          const next = cardFor(e, ++counter.current);
          if (next) setCard(next);
        }
      }),
    [player],
  );

  useEffect(
    () =>
      scene.subscribe((s) => {
        if (s.type === 'callout') {
          const kind = IMPACT[s.style];
          if (kind) setCallout({ id: ++counter.current, kind, text: s.text });
        }
        if (s.type === 'overlay' && s.effect === 'flash') setFlash((n) => n + 1);
      }),
    [scene],
  );

  useEffect(() => {
    if (!callout) return;
    const id = window.setTimeout(() => setCallout(null), 1400);
    return () => window.clearTimeout(id);
  }, [callout]);

  useEffect(() => {
    if (!card) return;
    const id = window.setTimeout(() => setCard(null), card.size === 'xl' ? 4200 : 2600);
    return () => window.clearTimeout(id);
  }, [card]);

  const togglePause = () => {
    if (paused) player.resume();
    else player.pause();
    setPaused(!paused);
  };
  const changeSpeed = (value: number) => {
    setSpeed(value);
    player.setSpeed(value);
  };

  return (
    <section className={styles.stage} aria-label="Courtroom">
      <div className={styles.screen}>
        <div className={styles.frame}>
          <Courtroom runtime={runtime} paused={paused} className={styles.canvas} label="The voxel courtroom. Every line spoken is in the transcript below." />
          <div className={styles.vignette} aria-hidden />
          {flash > 0 && <div key={flash} className={styles.flash} aria-hidden />}
          <div className={styles.hud}>
            {caseLabel && <span className={styles.caseBadge}>{caseLabel}</span>}
            <span className={styles.testnet}>TESTNET · demo data</span>
            {status && <span className={styles.status}>{status}</span>}
          </div>
          {callout && (
            <div key={callout.id} className={styles.callout} aria-hidden>
              <ImpactText kind={callout.kind} size="lg" animate>
                {callout.text}
              </ImpactText>
            </div>
          )}
          {card && (
            <div key={card.id} className={styles.card} role="status">
              <Stamp tone={card.tone} size={card.size} animate sub={card.sub}>
                {card.text}
              </Stamp>
            </div>
          )}
          {children}
        </div>
        {line && (
          <div className={styles.dialogue}>
            <DialogueBox
              key={line.id}
              speaker={SPEAKER[line.speaker]}
              text={line.text}
              {...(speakerNames?.[line.speaker] ? { speakerName: speakerNames[line.speaker]! } : {})}
              speed={Math.round(45 * speed)}
            />
          </div>
        )}
      </div>

      <div className={styles.controls} role="group" aria-label="Playback">
        <button type="button" className={styles.control} onClick={togglePause} disabled={!playing} aria-pressed={paused}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className={styles.control} onClick={() => player.skipLine()} disabled={!playing || !line}>
          Next line
        </button>
        <fieldset className={styles.speed}>
          <legend className="cc-visually-hidden">Speed</legend>
          {[1, 1.5, 2].map((v) => (
            <label key={v} className={cx(styles.speedOption, speed === v && styles.speedOn)}>
              <input type="radio" name="stage-speed" value={v} checked={speed === v} onChange={() => changeSpeed(v)} />
              {v}×
            </label>
          ))}
        </fieldset>
      </div>

      <details className={styles.transcript} open={said.length > 0 && !playing}>
        <summary>Transcript ({said.length} {said.length === 1 ? 'line' : 'lines'})</summary>
        <ol className={styles.lines} role="list">
          {said.map((l) => (
            <li key={l.id} className={styles.lineItem} data-bench={l.bench ?? 'court'}>
              <span className={styles.lineSpeaker}>{speakerNames?.[l.speaker] ?? SPEAKER_NAMES[l.speaker]}</span>
              <span>{l.text}</span>
            </li>
          ))}
        </ol>
      </details>
      <p className="cc-visually-hidden" aria-live="polite">
        {line ? `${speakerNames?.[line.speaker] ?? SPEAKER_NAMES[line.speaker]}: ${line.text}` : ''}
      </p>
    </section>
  );
}

const SPEAKER_NAMES: Readonly<Record<Speaker, string>> = {
  judge: 'Judge Gavel.exe',
  prosecutor: 'Miss Ratio',
  defense: 'Counsel Chaos',
  'side-a': 'Side A',
  'side-b': 'Side B',
  narrator: 'AI Narrator',
};
