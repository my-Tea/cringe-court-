/**
 * `<IsoTown>`: the explorable isometric town in a canvas, with its HUD.
 *
 * Input is screen-relative, which is the whole difference from the first-person
 * courtroom: WASD and the arrow keys both move W/A/S/D through the world at the
 * iso angle, so "up" always walks toward the top of the screen and the camera
 * never needs steering. Every key the game needs is reachable without a mouse,
 * and Tab always leaves the view (no keyboard trap).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';
import type { IsoController } from '../controller';
import type { MoveIntent } from '../physics';
import type { CastFile } from '../../roam/cast';
import type { BeatId } from '../../roam/types';
import { ensureRoamStyles } from '../../roam/react/styles';
import { IsoTrial } from '../trial';
import { IsoRenderer } from '../three/renderer';
import { ControlLegend, DialogueBox, FocusPrompt, Minimap, TownBar, TrialOverlay } from './Hud';

export interface IsoTownProps {
  controller: IsoController;
  cast: CastFile;
  /** Accessible name for the 3D view. */
  label?: string;
  /** "Leave town": omit to hide the button. */
  onExit?: () => void;
  /** Extra overlay (a map panel, a debug bar) drawn above the HUD. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Called once the renderer exists, for screenshots and debugging. */
  onRenderer?: (r: IsoRenderer) => void;
}

/** Which keys count as movement, and in which direction. */
const KEY_INTENT: Readonly<Record<string, { f: number; s: number }>> = {
  KeyW: { f: 1, s: 0 },
  ArrowUp: { f: 1, s: 0 },
  KeyS: { f: -1, s: 0 },
  ArrowDown: { f: -1, s: 0 },
  KeyA: { f: 0, s: -1 },
  ArrowLeft: { f: 0, s: -1 },
  KeyD: { f: 0, s: 1 },
  ArrowRight: { f: 0, s: 1 },
};

/** Keys that must not scroll the page while the town has focus. */
const SWALLOW = new Set(Object.keys(KEY_INTENT));

function useSnapshot(controller: IsoController) {
  const [snap, setSnap] = useState(() => controller.snapshot());
  useEffect(() => {
    let queued = false;
    const read = () => {
      queued = false;
      setSnap(controller.snapshot());
    };
    // Coalesce: the controller bumps on every visible change, which can be many
    // times per frame during movement. One render per frame is plenty.
    controller.onChange(() => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(read);
      }
    });
    // Catch changes that happened between construction and subscription.
    read();
    return () => controller.onChange(null);
  }, [controller]);
  return snap;
}

/** The scene driver: one place that advances the controller and draws. */
const TRIAL_BEATS: readonly BeatId[] = ['all-rise', 'opening', 'counsel-arguing', 'jury-deliberating', 'verdict'];

interface TrialView {
  speaker: string | null;
  text: string | null;
  callout: string | null;
}

function groundPoint(camera: THREE.Camera, canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  const origin = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
  const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
  const dir = far.sub(origin);
  if (Math.abs(dir.y) < 1e-5) return null;
  const t = -origin.y / dir.y;
  if (t < 0) return null;
  return [origin.x + dir.x * t, origin.z + dir.z * t];
}

function Driver({
  controller,
  renderer,
  intent,
  trial,
  onTrial,
}: {
  controller: IsoController;
  renderer: IsoRenderer;
  intent: React.RefObject<MoveIntent>;
  trial: IsoTrial;
  onTrial: (view: TrialView) => void;
}) {
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    renderer.setViewport(size.width, size.height);
  }, [renderer, size.width, size.height]);

  const trialKey = useRef('');
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    trial.update(step);
    const line = trial.line;
    const callout = trial.state.callout?.text ?? null;
    const key = `${line?.speaker ?? ''}|${line?.text ?? ''}|${Math.floor(line?.shown ?? 0)}|${callout ?? ''}|${trial.state.verdict ?? ''}`;
    if (key !== trialKey.current) {
      trialKey.current = key;
      onTrial({
        speaker: line?.speaker ?? null,
        text: line ? line.text.slice(0, Math.ceil(line.shown)) : null,
        callout,
      });
    }
    controller.update(step, intent.current);
    renderer.update(step);
    renderer.setViewport(size.width, size.height);
    gl.render(renderer.scene, renderer.camera);
  }, 1);
  return null;
}

export function IsoTown({ controller, cast, label = 'The town', onExit, children, className, style, onRenderer }: IsoTownProps) {
  // The town reuses the roam HUD classes, so it needs that stylesheet present.
  ensureRoamStyles();
  const snap = useSnapshot(controller);
  const root = useRef<HTMLDivElement>(null);
  const intent = useRef<MoveIntent>({ forward: 0, strafe: 0, run: false });
  const held = useRef(new Set<string>());
  const [legend, setLegend] = useState(false);

  const renderer = useMemo(() => new IsoRenderer({ controller, cast }), [controller, cast]);
  const trial = useMemo(() => new IsoTrial({ controller }), [controller]);
  const playing = useRef(false);
  const abortTrial = useRef(false);
  const [trialView, setTrialView] = useState<TrialView>({ speaker: null, text: null, callout: null });
  useEffect(() => () => renderer.dispose(), [renderer]);
  useEffect(() => onRenderer?.(renderer), [renderer, onRenderer]);

  const playTrial = useCallback(async () => {
    if (playing.current) return;
    playing.current = true;
    abortTrial.current = false;
    controller.setPaused(true);
    try {
      for (const beat of TRIAL_BEATS) {
        if (abortTrial.current) break;
        await trial.run(beat, beat === 'verdict' ? { verdict: 'not-cooked' } : {});
      }
    } finally {
      playing.current = false;
      controller.setPaused(false);
      setTrialView({ speaker: null, text: null, callout: null });
    }
  }, [controller, trial]);

  useEffect(() => controller.subscribe((e) => {
    if (e.type === 'action' && e.id === 'trial') void playTrial();
  }), [controller, playTrial]);

  /** Recompute the movement vector from every key currently down. */
  const syncIntent = useCallback(() => {
    let f = 0;
    let s = 0;
    for (const code of held.current) {
      const move = KEY_INTENT[code];
      if (!move) continue;
      f += move.f;
      s += move.s;
    }
    intent.current = {
      forward: Math.max(-1, Math.min(1, f)),
      strafe: Math.max(-1, Math.min(1, s)),
      run: held.current.has('ShiftLeft') || held.current.has('ShiftRight'),
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Tab must always leave the view; never trap it.
      if (e.key === 'Tab') return;
      if (SWALLOW.has(e.code) || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        held.current.add(e.code);
        syncIntent();
        return;
      }
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        const state = controller.snapshot();
        if (state.control === 'dialogue' && state.dialogue) {
          if (state.dialogue.choices.length === 0) controller.advanceDialogue();
        } else {
          controller.interact();
        }
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        controller.setPaused(controller.control !== 'paused');
        return;
      }
      // Number keys pick a dialogue choice.
      if (controller.control === 'dialogue' && /^Digit[1-9]$/.test(e.code)) {
        e.preventDefault();
        controller.choose(Number(e.code.slice(5)) - 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (held.current.delete(e.code)) {
        e.preventDefault();
        syncIntent();
      }
    };

    // Losing focus must not leave the player walking forever.
    const onBlur = () => {
      held.current.clear();
      syncIntent();
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('keyup', onKeyUp);
    el.addEventListener('blur', onBlur);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('blur', onBlur);
      window.removeEventListener('blur', onBlur);
    };
  }, [controller, syncIntent]);

  // Movement must stop the moment a conversation opens.
  useEffect(() => {
    if (snap.control !== 'free') {
      held.current.clear();
      syncIntent();
    }
  }, [snap.control, syncIntent]);

  return (
    <div
      ref={root}
      className={`ccr-root${className ? ` ${className}` : ''}`}
      style={style}
      tabIndex={0}
      role="application"
      aria-label={label}
      aria-roledescription="explorable isometric map"
      data-town-map={snap.map}
      data-town-control={snap.control}
      onPointerDown={(e) => {
        root.current?.focus();
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, label, .ccr-dialogue, .ccr-legend')) return;
        const canvas = root.current?.querySelector('canvas');
        if (!canvas || target !== canvas) return;
        const point = groundPoint(renderer.camera, canvas, e.clientX, e.clientY);
        if (!point) return;
        const [x, z] = point;
        let goalX = x;
        let goalZ = z;
        let interact = false;
        let best = 22;
        for (const item of controller.world.interactables) {
          const d = Math.hypot(item.at[0] - x, item.at[2] - z);
          if (d < best) {
            best = d;
            goalX = item.at[0];
            goalZ = item.at[2];
            interact = true;
          }
        }
        controller.setMoveGoal(goalX, goalZ, interact);
      }}
    >
      <div className="ccr-canvas" aria-hidden="true">
        <Canvas
          dpr={1}
          flat
          shadows={{ type: 1 }}
          gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, outputColorSpace: undefined, toneMapping: 0 }}
          frameloop="always"
          orthographic
          style={{ width: '100%', height: '100%' }}
        >
          <Driver controller={controller} renderer={renderer} intent={intent} trial={trial} onTrial={setTrialView} />
        </Canvas>
      </div>

      <div className="ccr-hud">
        <TownBar snap={snap} onPause={() => controller.setPaused(snap.control !== 'paused')} onExit={onExit} />
        <FocusPrompt snap={snap} />
        <DialogueBox snap={snap} onChoose={(i) => controller.choose(i)} onContinue={() => controller.advanceDialogue()} onEndDialogue={() => controller.endDialogue()} />
        <TrialOverlay
          speaker={trialView.speaker}
          text={trialView.text}
          callout={trialView.callout}
          onSkip={() => {
            abortTrial.current = true;
            trial.skip();
          }}
        />
        {legend && snap.control === 'free' ? <ControlLegend onClose={() => setLegend(false)} /> : null}
        {!legend && snap.control === 'free' ? (
          <button className="ccr-btn" style={{ position: 'absolute', left: 12, bottom: 12, pointerEvents: 'auto', minHeight: 36, padding: '6px 10px' }} onClick={() => setLegend(true)}>
            Controls
          </button>
        ) : null}
        <Minimap world={controller.world} snap={snap} />
        {children}
      </div>
    </div>
  );
}
