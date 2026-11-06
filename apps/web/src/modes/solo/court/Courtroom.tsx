import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AudioPort, CastMember, CourtLine, PublicExhibit } from '@cringe-court/core';
import { SEGMENT_TITLES, directAll, type Shot, type StageActor } from '@cringe-court/modes-solo';
import { stagePose } from '@/art/art';
import { Button, DialogueBox, IconButton, ImpactText, PaperPanel, PaperRibbon, Stamp, cx, useReducedMotion, type ImpactKind } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import { sceneArt, setFor } from '../lib/art';
import { SoloIcon } from '../lib/SoloIcon';
import { SoundToggle } from '../lib/SoundToggle';
import { voxelTrialView, type TrialView } from './TrialView';
import styles from './Courtroom.module.css';

/** WebGL 2 present (jsdom and very old browsers get the illustrated stage). */
function webglAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.WebGL2RenderingContext === 'undefined') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

export interface CourtroomProps {
  lines: readonly CourtLine[];
  /** Who stands where (mode staging). With it, the trial can also play in `view`. */
  cast?: readonly CastMember[];
  /** The room rendered behind the dialogue (see TrialView.ts). Defaults to the voxel courtroom. */
  view?: TrialView;
  /** Case title, for the region label. */
  title: string;
  exhibits?: readonly PublicExhibit[];
  /** Start playing on mount (still pausable). Reduced motion starts paused on the first line. */
  autoPlay?: boolean;
  onFinished?: () => void;
  audio?: AudioPort;
  /** Extra buttons in the control bar ("Skip to the jury"). */
  actions?: ReactNode;
  className?: string;
}

const SPEAKER_NAME_KEY: Readonly<Record<StageActor, MessageKey>> = {
  judge: 'solo.courtroom.speaker.judge',
  prosecutor: 'solo.courtroom.speaker.prosecutor',
  defense: 'solo.courtroom.speaker.defense',
  defendant: 'solo.courtroom.speaker.defendant',
};
const speakerName = (actor: StageActor): string => t(SPEAKER_NAME_KEY[actor]);

const IMPACT: Partial<Record<NonNullable<Shot['callout']>['style'], ImpactKind>> = {
  objection: 'objection',
  counter: 'counter',
  order: 'order',
  'let-bro-cook': 'cook',
};

type Actor = Exclude<StageActor, 'defendant'> | 'defendant';

function actorArt(actor: Actor, pose: string): string {
  // The defendant is the anonymous "creator" figure, never the user's face (V4 §5, §12).
  const character = actor === 'defendant' ? 'creator' : actor;
  return stagePose(character as never, pose as never);
}

/**
 * The Solo trial, staged in the voxel courtroom. Every line of the frozen
 * transcript becomes a shot (see @cringe-court/modes-solo director). Keyboard:
 * Space/K play–pause, ←/→ previous/next line (while focus is in the courtroom).
 * Screen readers hear each line once, in full, from a polite live region.
 */
export function Courtroom({
  lines,
  cast,
  view: trialView = voxelTrialView,
  title,
  exhibits = [],
  autoPlay = true,
  onFinished,
  audio,
  actions,
  className,
}: CourtroomProps) {
  const reduced = useReducedMotion();
  const shots = useMemo(() => directAll(lines), [lines]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [typed, setTyped] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [view, setView] = useState<'3d' | '2d'>('2d');
  const [voxelReady, setVoxelReady] = useState(false);
  const [voxelFailed, setVoxelFailed] = useState(false);
  const finishedRef = useRef(false);
  const onVoxelReady = useCallback(() => setVoxelReady(true), []);
  const onVoxelError = useCallback(() => {
    setVoxelFailed(true);
    setView('2d');
  }, [setView]);
  const rootRef = useRef<HTMLElement>(null);
  const shot = shots[index];
  const last = index === shots.length - 1;

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(shots.length - 1, next));
      setIndex(clamped);
      setTyped(false);
    },
    [shots.length],
  );

  // Sound cues for the new shot.
  useEffect(() => {
    if (!shot || !audio || (view === '3d' && trialView.ownsSound)) return;
    for (const cue of shot.cues) audio.play(cue);
  }, [shot, audio, view, trialView.ownsSound]);

  // Auto-advance once the line is typed out and has been held long enough to read.
  useEffect(() => {
    if (!typed || !shot) return;
    if (last) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        setPlaying(false);
        onFinished?.();
      }
      return;
    }
    if (!playing) return;
    const id = window.setTimeout(() => go(index + 1), reduced ? Math.max(1800, shot.holdMs) : shot.holdMs);
    return () => window.clearTimeout(id);
  }, [typed, playing, last, index, shot, go, onFinished, reduced]);

  const onDone = useCallback(() => setTyped(true), []);

  // Keyboard shortcuts while focus is anywhere inside the courtroom.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        if (target.closest('button, a')) return; // let buttons handle their own Space
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(index - 1);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [go, index]);

  if (!shot) return null;
  const exhibit = shot.exhibitId ? exhibits.find((x) => x.id === shot.exhibitId) : undefined;
  const exhibitLetter = exhibit ? String.fromCharCode(65 + exhibits.indexOf(exhibit)) : '';
  const set = setFor(shot.camera);
  const impact = shot.callout ? IMPACT[shot.callout.style] : undefined;
  const segments = [...new Set(lines.map((l) => l.segment))];
  const speakerCharacter = shot.speaker === 'defendant' ? 'creator' : shot.speaker;

  return (
    <section ref={rootRef} className={cx(styles.courtroom, className)} aria-label={t('solo.courtroom.region', { title })} data-surface="wood">
      <div className={styles.viewport} data-view={view} data-voxel-ready={(view === '3d' && voxelReady) || undefined}>
        {view === '3d' && cast && (
          <div className={styles.voxelLayer} aria-hidden>
            <Suspense fallback={null}>
              <trialView.Component
                line={shot.line}
                index={index}
                cast={cast}
                audio={audio}
                reducedMotion={reduced}
                onError={onVoxelError}
                onReady={onVoxelReady}
              />
            </Suspense>
          </div>
        )}
        <div key={`fx-${index}`} className={styles.camera} data-camera={shot.camera} data-fx={shot.fx ?? undefined} aria-hidden>
          <img className={styles.set} src={sceneArt(set)} alt="" data-pixel />
          <div className={styles.judgeBox}>
            <img
              className={styles.judge}
              src={actorArt('judge', shot.poses.judge)}
              alt=""
              data-pixel
              data-speaking={shot.speaker === 'judge' || undefined}
            />
          </div>
          <img
            className={cx(styles.actor, styles.prosecutor)}
            src={actorArt('prosecutor', shot.poses.prosecutor)}
            alt=""
            data-pixel
            data-speaking={shot.speaker === 'prosecutor' || undefined}
          />
          <img className={cx(styles.actor, styles.defendant)} src={actorArt('defendant', shot.poses.defendant)} alt="" data-pixel />
          <img
            className={cx(styles.actor, styles.defense)}
            src={actorArt('defense', shot.poses.defense)}
            alt=""
            data-pixel
            data-speaking={shot.speaker === 'defense' || undefined}
          />
          <span className={cx(styles.nameplate, styles.plateP)}>{t('solo.courtroom.plate.prosecution')}</span>
          <span className={cx(styles.nameplate, styles.plateD)}>{t('solo.courtroom.plate.defense')}</span>
        </div>
        <div className={styles.light} data-mood={shot.lighting} aria-hidden />
        {shot.fx === 'flash' && <div key={`flash-${index}`} className={styles.flash} aria-hidden />}
        {impact && (
          <div key={`callout-${index}`} className={styles.callout} data-speaker={shot.speaker} aria-hidden>
            <ImpactText kind={impact} size="lg" animate>
              {shot.callout!.text}
            </ImpactText>
          </div>
        )}
        {shot.callout?.style === 'jury-out' && (
          <div key={`out-${index}`} className={styles.juryOut} aria-hidden>
            <Stamp tone="filed" size="xl" animate sub={t('solo.courtroom.juryOutSub')}>
              {t('solo.courtroom.juryOut')}
            </Stamp>
          </div>
        )}
        {exhibit && (
          <figure key={`ex-${index}`} className={styles.exhibit} aria-hidden>
            <PaperPanel tone="cream" edge="torn" elevation={3} backing="gold" padding="sm">
              <figcaption>
                {t('solo.courtroom.exhibit', { letter: exhibitLetter, title: exhibit.title })}
              </figcaption>
              <p>{exhibit.body}</p>
            </PaperPanel>
          </figure>
        )}
        <PaperRibbon as="div" tone="maroon" size="sm" className={styles.segmentTag} aria-hidden>
          {SEGMENT_TITLES[shot.line.segment]}
        </PaperRibbon>
      </div>

      <PaperPanel tone="cream" edge="cut" elevation={3} backing="gold" padding="none" className={styles.dialogueSheet} data-surface="parchment">
        <DialogueBox
          key={shot.line.id + index}
          className={styles.dialogue}
          speaker={speakerCharacter}
          expression={shot.mood}
          speakerName={speakerName(shot.speaker)}
          text={shot.line.text}
          speed={52}
          onDone={onDone}
        />
      </PaperPanel>
      <p className="cc-visually-hidden" aria-live="polite" aria-atomic>
        {t('solo.courtroom.speech', { speaker: speakerName(shot.speaker), text: shot.line.text })}
      </p>

      <PaperPanel tone="maroon" edge="cut" elevation={2} padding="sm" className={styles.controlsSheet}>
        <div className={styles.controls}>
          <div className={styles.transport}>
            <IconButton
              size="sm"
              variant="secondary"
              label={t('solo.courtroom.prev')}
              icon={<SoloIcon name="prev" />}
              onClick={() => go(index - 1)}
              disabled={index === 0}
            />
            <IconButton
              size="md"
              variant="gold"
              label={playing ? t('solo.courtroom.pause') : last && typed ? t('solo.courtroom.replay') : t('solo.courtroom.play')}
              icon={<SoloIcon name={playing ? 'pause' : 'play'} />}
              onClick={() => {
                if (!playing && last && typed) {
                  finishedRef.current = true;
                  go(0);
                }
                setPlaying((p) => !p);
              }}
            />
            <IconButton
              size="sm"
              variant="secondary"
              label={t('solo.courtroom.next')}
              icon={<SoloIcon name="next" />}
              onClick={() => go(index + 1)}
              disabled={last}
            />
          </div>
          <div className={styles.progress}>
            <span className={styles.counter}>
              {t('solo.courtroom.counter', { n: index + 1, total: shots.length })}
            </span>
            <div className={styles.chapters} role="group" aria-label={t('solo.courtroom.chapters')}>
              {segments.map((seg) => {
                const first = lines.findIndex((l) => l.segment === seg);
                const active = shot.line.segment === seg;
                return (
                  <button key={seg} type="button" className={styles.chapter} aria-current={active ? 'step' : undefined} onClick={() => go(first)}>
                    {SEGMENT_TITLES[seg]}
                  </button>
                );
              })}
            </div>
            <div className={styles.bar} aria-hidden>
              <span
                style={{
                  inlineSize: `${((index + (typed ? 1 : 0.5)) / shots.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className={styles.extra}>
            {audio && <SoundToggle />}
            {cast && !voxelFailed && (!trialView.requiresWebGL || webglAvailable()) && (
              <Button size="sm" variant="ghost" aria-pressed={view === '3d'} onClick={() => setView((v) => (v === '3d' ? '2d' : '3d'))}>
                {trialView.label}
              </Button>
            )}
            <Button size="sm" variant="ghost" aria-expanded={showTranscript} onClick={() => setShowTranscript((s) => !s)}>
              {showTranscript ? t('solo.courtroom.transcript.hide') : t('solo.courtroom.transcript.show')}
            </Button>
            {actions}
          </div>
        </div>
      </PaperPanel>
      <p className={styles.hint}>
        {voxelFailed ? t('solo.courtroom.hintFailed', { label: trialView.label }) : t('solo.courtroom.hint')}
      </p>

      {showTranscript && (
        <ol className={styles.transcript} aria-label={t('solo.courtroom.transcript.label')} role="list">
          {shots.map((s, i) => (
            <li key={s.line.id} aria-current={i === index ? 'true' : undefined}>
              <button type="button" onClick={() => go(i)}>
                <strong>{speakerName(s.speaker)}</strong> {s.line.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
