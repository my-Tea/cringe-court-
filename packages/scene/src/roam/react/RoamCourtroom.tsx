import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';
import type { RoamController } from '../controller';
import { gamepadInput, lookDelta } from '../input';
import type { RoamData } from '../load';
import type { PerspectiveChoice } from '../perspective';
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
  /** `auto` is the trailing third person. Default auto. */
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
  /**
   * How the room is shown. `play` (default) is the walkable room with its HUD.
   * `attract` is a title-screen backdrop: a slow orbit, no HUD, no input.
   * `suspended` stops drawing (the last frame stays) while something covers it.
   */
  presentation?: 'play' | 'attract' | 'suspended';
  /** Extra entries in the pause menu (a game's Leaderboard, Settings, Quit…), after Resume. */
  pauseExtra?: ReactNode;
  /** Show "Back to the lobby" in the pause menu. Default true. */
  pauseLobby?: boolean;
  /**
   * The room is the whole screen, so a key with no focused target is the
   * player's. Off for a room embedded in a page, where such keys scroll it.
   */
  fullscreen?: boolean;
}

/** Keys a focused button acts on: these stay with the button. */
const BUTTON_KEYS: ReadonlySet<string> = new Set(['Enter', 'NumpadEnter', 'Space', 'Tab']);

/**
 * Does this key press belong to the room? Yes when the room has focus, or (full
 * screen) when focus fell to the page. Also on a HUD button the player clicked:
 * W means nothing to a button, so walking must not die because Controls kept
 * focus. Never while a menu is up, and never in a field or outside the room.
 */
function ownsKey(e: KeyboardEvent, room: HTMLElement, modal: boolean, fullscreen: boolean): boolean {
  const t = e.target as HTMLElement;
  if (t === room) return true;
  if (fullscreen && t === document.body) return true;
  return !modal && t.tagName === 'BUTTON' && room.contains(t) && !BUTTON_KEYS.has(e.code);
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
  presentation = 'play',
  pauseExtra,
  pauseLobby = true,
  fullscreen = false,
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
  const live = presentation === 'play';
  useEffect(() => {
    renderer.setAttract(presentation === 'attract');
    // Nothing drives the room from outside play: drop held keys and give the mouse back.
    if (presentation !== 'play') {
      controller.keys.clear();
      if (typeof document !== 'undefined' && document.pointerLockElement === root.current) document.exitPointerLock?.();
    }
  }, [renderer, controller, presentation]);
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
  // Back to play (from a title screen or a menu over the room): the keys belong to the room again.
  useEffect(() => {
    if (presentation === 'play') focusRoot();
  }, [presentation, focusRoot]);

  // Keyboard: listened for on the window, so no focus change can leave the player stuck.
  // `ownsKey` decides which presses belong to the room.
  useEffect(() => {
    const el = root.current;
    if (!el || !live) return;
    const down = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // A station panel closes on Escape wherever focus sits inside it.
      if (e.key === 'Escape' && controller.panel) {
        controller.closePanel();
        e.preventDefault();
        return;
      }
      const { paused, panel, exhibit } = controller.snapshot();
      if (!ownsKey(e, el, !!(paused || panel || exhibit), fullscreen)) return;
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
    // Releases always count: a key let go anywhere must not keep the player walking.
    const up = (e: KeyboardEvent) => controller.keyUp(e.code);
    const blur = () => controller.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [controller, live, fullscreen, setEngaged]);

  // Pointer lock: click to capture, Esc (browser) releases → pause menu.
  useEffect(() => {
    const onChange = () => {
      const isLocked = document.pointerLockElement === root.current;
      setLocked(isLocked);
      const snapNow = controller.snapshot();
      // Only the player pressing Esc in play means pause; anything else that took the mouse (a panel, a screen drawn over the room) does not.
      if (!isLocked && liveRef.current && engagedRef.current && !controller.paused && !snapNow.exhibit && !snapNow.panel) controller.setPaused(true);
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
  const liveRef = useRef(live);
  liveRef.current = live;

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
    if (isTouch) return;
    const el = root.current as (HTMLDivElement & { requestPointerLock?: () => Promise<void> | void }) | null;
    try {
      const r = el?.requestPointerLock?.();
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => undefined);
    } catch {
      /* pointer lock unavailable (iframe, headless): keyboard turning still works */
    }
  }, [focusRoot, isTouch, setEngaged]);

  // Pause, exhibits and station panels release the pointer so menus are usable.
  // A panel that took the mouse hands it back when it closes: focus returns to
  // the room (its button is gone, so focus would otherwise fall to the page) and
  // mouse look resumes if it was on.
  const panelTookMouse = useRef(false);
  const panelWasOpen = useRef(false);
  useEffect(() => {
    const held = !!(snap.paused || snap.exhibit || snap.panel);
    if (snap.panel && !panelWasOpen.current) panelTookMouse.current = document.pointerLockElement === root.current;
    if (held && document.pointerLockElement === root.current) document.exitPointerLock?.();
    if (panelWasOpen.current && !snap.panel && !snap.paused) {
      focusRoot();
      if (panelTookMouse.current) capture();
    }
    panelWasOpen.current = !!snap.panel;
  }, [snap.paused, snap.exhibit, snap.panel, focusRoot, capture]);

  const cinematic = snap.control === 'cinematic';
  // Non-blocking onboarding (B4): a corner card, never during a cinematic beat, gone once dismissed or used.
  const showOnboarding = !engaged && !onboarded && !isTouch && !snap.paused && !snap.exhibit && !snap.panel && !cinematic && !legend;

  return (
    <div
      ref={root}
      className={`ccr-root${className ? ` ${className}` : ''}`}
      style={style}
      tabIndex={live ? 0 : -1}
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
          if (!live) return;
          if (!isTouch && !locked && !snap.paused && !cinematic) capture();
          else focusRoot();
        }
      }}
    >
      <div className="ccr-canvas" aria-hidden="true">
        <Canvas
          dpr={1}
          flat
          shadows={{ type: THREE.PCFSoftShadowMap }}
          gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping }}
          // Suspended draws on demand: one frame on mount (a deep link still shows the world), then it holds.
          frameloop={presentation === 'suspended' ? 'demand' : 'always'}
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
          {live ? (
            <>
          {!snap.paused && snap.control !== 'cinematic' && !snap.exhibit && !snap.panel ? <div className={`ccr-cross${snap.focus ? ' ccr-cross--on' : ''}`} aria-hidden="true" /> : null}
          <TopBar snap={snap} touch={isTouch} onExit={onExit} onPause={() => controller.setPaused(true)} legendOpen={legend} onToggleLegend={() => setLegend((v) => !v)} />
          <BeatChip snap={snap} onSkip={() => controller.skipBeat()} />
          {legend && !snap.paused ? <ControlLegend touch={isTouch} onClose={() => setLegend(false)} /> : null}
          <Prompt snap={snap} touch={isTouch} />
          <Callout snap={snap} />
          <Dock snap={snap} touch={isTouch} />
          <Dialogue snap={snap} touch={isTouch} tapToContinue={isTouch && cinematic} onAdvance={() => controller.advanceDialogue()} />
          {/* B5: no joystick or buttons over a cinematic beat; they come back when the camera is yours. */}
          {isTouch && !snap.paused && !snap.exhibit && !snap.panel && !cinematic ? <TouchControls controller={controller} prompt={snap.focus?.prompt ?? null} /> : null}
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
            extra={pauseExtra}
            lobby={pauseLobby}
          />
            </>
          ) : null}
          {children}
        </div>
      </RoamStringsProvider>
    </div>
  );
}
