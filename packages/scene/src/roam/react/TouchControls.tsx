import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { RoamController } from '../controller';
import { joystickIntent, joystickKnob, lookDelta } from '../input';

import { useRoamStrings } from './strings';

const RADIUS = 52;

/** Left: floating virtual joystick. Right: drag to look. Buttons: interact, hop, pause. */
export function TouchControls({ controller, prompt }: { controller: RoamController; prompt: string | null }) {
  const S = useRoamStrings();
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const [ui, setUi] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);

  const zone = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const stickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stick.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = zone(e);
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setUi({ x: p.x, y: p.y, kx: 0, ky: 0 });
  };
  const stickMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    controller.setExternalInput('touch', { intent: joystickIntent(dx, dy, RADIUS) });
    const k = joystickKnob(dx, dy, RADIUS);
    setUi((u) => (u ? { ...u, kx: k.x, ky: k.y } : u));
  };
  const stickUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = null;
    controller.setExternalInput('touch', null);
    setUi(null);
  };

  const lookDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (look.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const l = look.current;
    if (!l || l.id !== e.pointerId) return;
    const d = lookDelta(e.clientX - l.x, e.clientY - l.y, 0.0055);
    controller.look(d.yaw, d.pitch);
    l.x = e.clientX;
    l.y = e.clientY;
  };
  const lookUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (look.current?.id === e.pointerId) look.current = null;
  };

  return (
    <div className="ccr-touch" data-testid="roam-touch">
      <div className="ccr-look-zone" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} aria-hidden="true" />
      <div className="ccr-stick-zone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} aria-hidden="true">
        {ui ? (
          <div className="ccr-stick" style={{ left: ui.x, top: ui.y }}>
            <div className="ccr-knob" style={{ transform: `translate(${ui.kx}px, ${ui.ky}px)` }} />
          </div>
        ) : (
          <>
            <div className="ccr-stick" style={{ left: 92, bottom: 30, top: 'auto', marginTop: 0, marginBottom: 0 }}>
              <div className="ccr-knob" />
            </div>
            <span className="ccr-stick-hint ccr-pixel">{S.touchDragHint}</span>
          </>
        )}
      </div>
      <div className="ccr-touch-buttons">
        <button type="button" className="ccr-btn ccr-btn--ghost" aria-label={S.touchPause} onClick={() => controller.setPaused(true)}>
          {/* i18n-ignore: pause glyph */}
          II
        </button>
        <span />
        <button type="button" className="ccr-btn ccr-btn--ghost" aria-label={S.touchHop} onClick={() => controller.jump()}>
          ⤒
        </button>
        <button type="button" className={`ccr-btn ccr-act ${prompt ? 'ccr-btn--gold' : ''}`} aria-label={prompt ? S.touchInteractWith(prompt) : S.touchInteract} onClick={() => controller.interact()}>
          ✋
        </button>
      </div>
    </div>
  );
}
