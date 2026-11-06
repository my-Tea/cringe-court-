import type { CalloutStyle, CourtLine, ScenePort, Speaker } from '@cringe-court/core';
import type { PlayerEvent, ShowPlayer } from '@cringe-court/engine';
import { Courtroom } from '@cringe-court/scene/react';
import type { CourtroomRuntime } from '@cringe-court/scene';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CharacterId } from '@/art/art';
import { DialogueBox, ImpactText, Stamp, cx, type ImpactKind, type StampTone } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import styles from './TrialStage.module.css';

const SPEAKER: Readonly<Record<Speaker, CharacterId>> = {
  judge: 'judge',
  prosecutor: 'prosecutor',
  defense: 'defense',
  'side-a': 'side-a',
  'side-b': 'side-b',
  narrator: 'ai-narrator',
  clerk: 'clerk',
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
      return { id, tone: 'case-number', text: e.text ?? t('solo.stage.card.case'), size: 'lg' };
    case 'charges-filed':
      return { id, tone: 'filed', text: t('solo.stage.card.charges'), size: 'lg' };
    case 'jury-out':
      return { id, tone: 'case-number', text: t('solo.stage.card.juryOut'), sub: t('solo.stage.card.juryOutSub'), size: 'lg' };
    case 'mistrial':
      return { id, tone: 'no-verdict', text: t('solo.stage.card.mistrial'), sub: t('solo.stage.card.mistrialSub'), size: 'xl' };
    case 'verdict': {
      const label = e.text ?? '';
      const tone: StampTone = label === 'GUILTY' ? 'guilty' : label === 'NOT COOKED' ? 'not-cooked' : label === 'SIDE A' ? 'side-a' : label === 'SIDE B' ? 'side-b' : 'filed';
      const text = label === 'GUILTY' ? t('solo.stage.card.guilty') : label === 'NOT COOKED' ? t('solo.stage.card.notCooked') : label === 'SIDE A' ? t('solo.stage.card.sideA') : label === 'SIDE B' ? t('solo.stage.card.sideB') : label;
      return { id, tone, text, sub: t('solo.stage.card.spoken'), size: 'xl' };
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
    <section className={styles.stage} aria-label={t('solo.stage.label')}>
      <div className={styles.screen}>
        <div className={styles.frame}>
          <Courtroom runtime={runtime} paused={paused} className={styles.canvas} label={t('solo.stage.canvas')} />
          <div className={styles.vignette} aria-hidden />
          {flash > 0 && <div key={flash} className={styles.flash} aria-hidden />}
          <div className={styles.hud}>
            {caseLabel && <span className={styles.caseBadge}>{caseLabel}</span>}
            <span className={styles.testnet}>{t('solo.stage.testnet')}</span>
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

      <div className={styles.controls} role="group" aria-label={t('solo.stage.controls')}>
        <button type="button" className={styles.control} onClick={togglePause} disabled={!playing} aria-pressed={paused}>
          {paused ? t('solo.stage.resume') : t('solo.stage.pause')}
        </button>
        <button type="button" className={styles.control} onClick={() => player.skipLine()} disabled={!playing || !line}>
          {t('solo.stage.nextLine')}
        </button>
        <fieldset className={styles.speed}>
          <legend className="cc-visually-hidden">{t('solo.stage.speed')}</legend>
          {[1, 1.5, 2].map((v) => (
            <label key={v} className={cx(styles.speedOption, speed === v && styles.speedOn)}>
              <input type="radio" name="stage-speed" value={v} checked={speed === v} onChange={() => changeSpeed(v)} />
              {t('solo.stage.speedOption', { v })}
            </label>
          ))}
        </fieldset>
      </div>

      <details className={styles.transcript} open={said.length > 0 && !playing}>
        <summary>{t('solo.stage.transcript', { count: said.length })}</summary>
        <ol className={styles.lines} role="list">
          {said.map((l) => (
            <li key={l.id} className={styles.lineItem} data-bench={l.bench ?? 'court'}>
              <span className={styles.lineSpeaker}>{speakerNames?.[l.speaker] ?? speakerLabel(l.speaker)}</span>
              <span>{l.text}</span>
            </li>
          ))}
        </ol>
      </details>
      <p className="cc-visually-hidden" aria-live="polite">
        {line ? t('solo.courtroom.speech', { speaker: speakerNames?.[line.speaker] ?? speakerLabel(line.speaker), text: line.text }) : ''}
      </p>
    </section>
  );
}

const SPEAKER_NAME_KEYS: Readonly<Record<Speaker, MessageKey>> = {
  judge: 'solo.stage.speaker.judge',
  prosecutor: 'solo.stage.speaker.prosecutor',
  defense: 'solo.stage.speaker.defense',
  'side-a': 'common.role.sideA',
  'side-b': 'common.role.sideB',
  narrator: 'solo.stage.speaker.narrator',
  clerk: 'solo.stage.speaker.clerk',
};

const speakerLabel = (speaker: Speaker): string => t(SPEAKER_NAME_KEYS[speaker]);
