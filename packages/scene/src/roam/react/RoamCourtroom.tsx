import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';
import type { RoamController } from '../controller';
import { gamepadInput, lookDelta } from '../input';
import type { RoamData } from '../load';
import { cameraMode, type PerspectiveChoice } from '../perspective';
import { AutoQuality, QUALITY, type QualityLevel } from '../quality';
import { RoamRenderer } from '../three/renderer';
import { BeatChip, Callout, ControlLegend, Dialogue, Dock, ExhibitPanel, Onboarding, PauseMenu, Prompt, TopBar } from './Hud';
import { ensureRoamStyles } from './styles';
import { RoamStringsProvider, resolveRoamStrings, type RoamStrings } from './strings';
import { readOnboarded, writeOnboarded } from './onboarding';
import { TouchControls } from './TouchControls';
import { useRoamSnapshot } from './useRoamCourtroom';

export interface RoamCourtroomProps {
  controller: RoamController;
  data: RoamData;
  /** Initial quality (the pause menu can change it). Default medium. */
  quality?: QualityLevel;
  /** `auto` is third-person isometric. Default auto. */
  perspective?: PerspectiveChoice;
  onPerspectiveChange?: (p: PerspectiveChoice) => void;
  onQualityChange?: (q: QualityLevel) => void;
  /** Step quality down when frames run long. Default true. */
  autoQuality?: boolean;
  /** Low-res pixel render upscaled crisp (Minecraft look). Default true. */
  pixelated?: boolean;
  /** Show touch controls: 'auto' follows (pointer: coarse) and the first touch. */
  touch?: boolean | 'auto';
  /** "Skip to menu view": switch to the non-roam view. Omit to hide the button. */
  onExit?: () => void;
  /** Accessible name for the 3D view. Defaults to `strings.roomLabel`. */
  label?: string;
  /** Overrides for the HUD copy (translations); anything omitted stays English. */
  strings?: Partial<RoamStrings>;
  className?: string;
  style?: CSSProperties;
  /** Extra overlay content (e.g. a mode's beats panel), drawn above the HUD. */
  children?: ReactNode;
  /** Called with the renderer once it exists (debug / screenshots). */
  onRenderer?: (r: RoamRenderer) => void;
  /** Open the controls legend at start. Default false: the Controls button and the onboarding card cover it. */
  controlsOpen?: boolean;
}

function Driver({ controller, renderer, pixelated, auto, onDowngrade }: { controller: RoamController; renderer: RoamRenderer; pixelated: boolean; auto: AutoQuality | null; onDowngrade: (q: QualityLevel) => void }) {
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const level = renderer.preset.level;
  const pad = useRef({ interact: false, pause: false });

  useEffect(() => {
    renderer.setViewport(size.width, size.height);
    const p = QUALITY[level];
    const dpr = pixelated ? p.pixelHeight / Math.max(1, size.height) : Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, p.dprCap);
    setDpr(Math.max(0.1, Math.min(dpr, p.dprCap)));
  }, [renderer, size.width, size.height, pixelated, level, setDpr]);

  useFrame((state, dt) => {
    // Gamepad (optional): polled, not evented.
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      const g = gamepadInput(gp);
      controller.setExternalInput('gamepad', g);
      if (g.interact && !pad.current.interact) controller.interact();
      if (g.pause && !pad.current.pause) controller.setPaused(!controller.paused);
      pad.current = { interact: g.interact, pause: g.pause };
    }
    controller.update(dt);
    renderer.update(dt);
    renderer.render(state.gl);
    const next = auto?.sample(dt);
    if (next) onDowngrade(next);
  }, 1);
  return null;
}

function useCoarsePointer(mode: boolean | 'auto'): [boolean, () => void] {
  const [coarse, setCoarse] = useState(() => (mode === 'auto' ? typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches : mode));
  useEffect(() => {
    if (mode !== 'auto') setCoarse(mode);
  }, [mode]);
  return [coarse, () => mode === 'auto' && setCoarse(true)];
}

/** The first-person, walkable pixel-art courtroom with its HUD. */
export function RoamCourtroom({
  controller,
  data,
  quality: initialQuality = 'medium',
  onQualityChange,
  perspective: initialPerspective = 'auto',
  onPerspectiveChange,
  autoQuality = true,
  pixelated: initialPixelated = true,
  touch = 'auto',
  onExit,
  label,
  strings,
  className,
  style,
  children,
  onRenderer,
  controlsOpen = false,
}: RoamCourtroomProps) {
  ensureRoamStyles();
  const S = resolveRoamStrings(strings);
  const root = useRef<HTMLDivElement>(null);
  const snap = useRoamSnapshot(controller);
  const [quality, setQuality] = useState<QualityLevel>(initialQuality);
  const [perspective, setPerspective] = useState<PerspectiveChoice>(initialPerspective);
  const [pixelated, setPixelated] = useState(initialPixelated);
  const [engaged, setEngagedState] = useState(false);
  const [onboarded, setOnboarded] = useState(readOnboarded);
  // Engaging (clicking in, pressing a key) or dismissing the card is remembered: it never comes back over a hearing.
  const setEngaged = useCallback((on: boolean) => {
    setEngagedState(on);
    if (on) {
      setOnboarded(true);
      writeOnboarded();
    }
  }, []);
  const [locked, setLocked] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [isTouch, markTouch] = useCoarsePointer(touch);
  // The legend starts closed (B4): open it would sit over the hearing. The Controls button and the onboarding card point to it.
  const [legend, setLegend] = useState(controlsOpen);

  const renderer = useMemo(() => new RoamRenderer({ boxes: data.world.boxes, cast: data.cast, controller, quality: initialQuality }), [data, controller]);
  useEffect(() => () => renderer.dispose(), [renderer]);
  useEffect(() => onRenderer?.(renderer), [renderer, onRenderer]);
  const auto = useMemo(() => (autoQuality ? new AutoQuality(initialQuality) : null), [autoQuality, initialQuality]);

  useEffect(() => setQuality(initialQuality), [initialQuality]);
  useEffect(() => setPerspective(initialPerspective), [initialPerspective]);
  useEffect(() => {
    controller.setPerspective(perspective);
    renderer.setPerspective(perspective);
  }, [controller, renderer, perspective]);
  useEffect(() => {
    renderer.setQuality(quality);
    if (auto) auto.level = quality;
  }, [renderer, quality, auto]);

  const changeQuality = useCallback(
    (q: QualityLevel, reason?: string) => {
      setQuality(q);
      setAutoNote(reason ?? null);
      onQualityChange?.(q);
    },
    [onQualityChange],
  );

  const focusRoot = useCallback(() => root.current?.focus({ preventScroll: true }), []);

  // Keyboard: the root element owns the keys while it has focus.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const down = (e: KeyboardEvent) => {
      if (e.target !== el) return; // buttons/menus keep their own keys
      if (e.key === 'Escape' && controller.paused) {
        controller.setPaused(false);
        e.preventDefault();
        return;
      }
      if (controller.keyDown(e.code, e.repeat)) {
        e.preventDefault();
        setEngaged(true);
      }
    };
    const up = (e: KeyboardEvent) => controller.keyUp(e.code);
    const blur = () => controller.keys.clear();
    el.addEventListener('keydown', down);
    el.addEventListener('keyup', up);
    el.addEventListener('blur', blur);
    window.addEventListener('blur', blur);
    return () => {
      el.removeEventListener('keydown', down);
      el.removeEventListener('keyup', up);
      el.removeEventListener('blur', blur);
      window.removeEventListener('blur', blur);
    };
  }, [controller]);

  // Pointer lock: click to capture, Esc (browser) releases → pause menu.
  useEffect(() => {
    const onChange = () => {
      const isLocked = document.pointerLockElement === root.current;
      setLocked(isLocked);
      if (!isLocked && engagedRef.current && !controller.paused && !controller.snapshot().exhibit) controller.setPaused(true);
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== root.current) return;
      const d = lookDelta(e.movementX, e.movementY);
      controller.look(d.yaw, d.pitch);
    };
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('mousemove', onMove);
    };
  }, [controller, setEngaged]);
  const engagedRef = useRef(engaged);
  engagedRef.current = engaged;

  // Pause and exhibits release the pointer so menus are usable.
  useEffect(() => {
    if ((snap.paused || snap.exhibit) && document.pointerLockElement === root.current) document.exitPointerLock?.();
  }, [snap.paused, snap.exhibit]);

  const changePerspective = useCallback(
    (p: PerspectiveChoice) => {
      setPerspective(p);
      onPerspectiveChange?.(p);
    },
    [onPerspectiveChange],
  );

  const capture = useCallback(() => {
    setEngaged(true);
    focusRoot();
    if (isTouch || cameraMode(perspective) === 'iso') return;
    const el = root.current as (HTMLDivElement & { requestPointerLock?: () => Promise<void> | void }) | null;
    try {
      const r = el?.requestPointerLock?.();
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => undefined);
    } catch {
      /* pointer lock unavailable (iframe, headless): keyboard turning still works */
    }
  }, [focusRoot, isTouch, perspective, setEngaged]);

  const cinematic = snap.control === 'cinematic';
  // Non-blocking onboarding (B4): a corner card, never during a cinematic beat, gone once dismissed or used.
  const showOnboarding = !engaged && !onboarded && !isTouch && !snap.paused && !snap.exhibit && !cinematic && !legend;

  return (
    <div
      ref={root}
      className={`ccr-root${className ? ` ${className}` : ''}`}
      style={style}
      tabIndex={0}
      role="application"
      aria-label={label ?? S.roomLabel}
      aria-roledescription={S.roomRoleDescription}
      data-roam-zone={snap.zone ?? ''}
      data-roam-control={snap.control}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') markTouch();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'CANVAS') {
          // Clicking the room captures the mouse, except during a cinematic beat (the camera is not yours yet).
          if (!isTouch && !locked && !snap.paused && !cinematic) capture();
          else focusRoot();
        }
      }}
    >
      <div className="ccr-canvas" aria-hidden="true">
        <Canvas
          dpr={1}
          flat
          shadows={{ type: THREE.PCFShadowMap }}
          gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping }}
          frameloop="always"
          style={{ width: '100%', height: '100%' }}
        >
          <Driver
            controller={controller}
            renderer={renderer}
            pixelated={pixelated}
            auto={auto}
            onDowngrade={(q) => changeQuality(q, S.autoQualityNote(q))}
          />
        </Canvas>
      </div>

      <RoamStringsProvider strings={S}>
        <div className="ccr-hud">
          {cameraMode(perspective) === 'first' && !snap.paused && snap.control !== 'cinematic' && !snap.exhibit ? <div className={`ccr-cross${snap.focus ? ' ccr-cross--on' : ''}`} aria-hidden="true" /> : null}
          <TopBar snap={snap} touch={isTouch} onExit={onExit} onPause={() => controller.setPaused(true)} legendOpen={legend} onToggleLegend={() => setLegend((v) => !v)} />
          <BeatChip snap={snap} onSkip={() => controller.skipBeat()} />
          {legend && !snap.paused ? <ControlLegend touch={isTouch} onClose={() => setLegend(false)} /> : null}
          <Prompt snap={snap} touch={isTouch} />
          <Callout snap={snap} />
          <Dock snap={snap} touch={isTouch} />
          <Dialogue snap={snap} touch={isTouch} tapToContinue={isTouch && cinematic} onAdvance={() => controller.advanceDialogue()} />
          {/* B5: no joystick or buttons over a cinematic beat; they come back when the camera is yours. */}
          {isTouch && !snap.paused && !snap.exhibit && !cinematic ? <TouchControls controller={controller} prompt={snap.focus?.prompt ?? null} /> : null}
          {showOnboarding ? (
            <Onboarding
              onCapture={capture}
              onKeyboard={() => {
                setEngaged(true);
                focusRoot();
              }}
              onDismiss={() => {
                setOnboarded(true);
                writeOnboarded();
                focusRoot();
              }}
            />
          ) : null}
          <ExhibitPanel snap={snap} controller={controller} restoreFocus={focusRoot} />
          <PauseMenu
            snap={snap}
            controller={controller}
            touch={isTouch}
            quality={quality}
            onQuality={(q) => changeQuality(q)}
            perspective={perspective}
            onPerspective={changePerspective}
            pixelated={pixelated}
            onPixelated={setPixelated}
            onExit={onExit}
            restoreFocus={focusRoot}
            autoNote={autoNote}
          />
          {children}
        </div>
      </RoamStringsProvider>
    </div>
  );
}
