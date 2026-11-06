import { useEffect, useRef, type ReactNode } from 'react';
import type { RoamController } from '../controller';
import { EXHIBIT_CARDS } from '../dialogue';
import { QUALITY_LEVELS, type QualityLevel } from '../quality';
import type { BeatId, RoamSnapshot, ZoneId } from '../types';

export const BEAT_LABELS: Readonly<Record<BeatId, string>> = {
  'all-rise': 'All rise',
  opening: 'Opening statements',
  'counsel-arguing': 'Counsel arguing',
  'jury-deliberating': 'Jury deliberating',
  verdict: 'The verdict',
};

const ZONE_LABELS: Readonly<Record<ZoneId, string>> = {
  lobby: 'Lobby',
  doorway: 'Courtroom doors',
  gallery: 'Public gallery',
  aisle: 'Centre aisle',
  well: 'Well of the court',
  dais: 'Before the bench',
  'defendant-table': "Defendant's table",
  'prosecution-table': 'Prosecution table',
  'witness-stand': 'Witness stand',
};

export function Key({ children }: { children: ReactNode }) {
  return <kbd className="ccr-key">{children}</kbd>;
}

export function ControlLegend({ touch, onClose, inline = false }: { touch: boolean; onClose?: () => void; inline?: boolean }) {
  return (
    <section className={inline ? 'ccr-legend ccr-legend--inline' : 'ccr-panel ccr-legend'} aria-label="Controls">
      <h2 className="ccr-pixel">Controls</h2>
      {touch ? (
        <ul>
          <li>Left thumb: drag to walk (push past the ring to run)</li>
          <li>Right side: drag to look around</li>
          <li>
            <Key>✋</Key> interact · <Key>⤒</Key> hop · <Key>II</Key> pause
          </li>
        </ul>
      ) : (
        <ul>
          <li>
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key> walk · <Key>↑</Key>
            <Key>↓</Key> walk
          </li>
          <li>
            Mouse look (click the room) · <Key>←</Key>
            <Key>→</Key> turn
          </li>
          <li>
            <Key>R</Key>
            <Key>F</Key> or <Key>PgUp</Key>
            <Key>PgDn</Key> look up / down
          </li>
          <li>
            <Key>Shift</Key> run · <Key>Space</Key> hop
          </li>
          <li>
            <Key>E</Key> or <Key>Enter</Key> interact / continue
          </li>
          <li>
            <Key>Tab</Key> skip a line · <Key>Esc</Key> pause
          </li>
        </ul>
      )}
      {onClose ? (
        <div className="ccr-modal-row" style={{ marginTop: 10 }}>
          <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onClose}>
            Hide controls
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function TopBar({ snap, touch = false, onExit, onPause, legendOpen, onToggleLegend }: { snap: RoamSnapshot; touch?: boolean; onExit?: () => void; onPause: () => void; legendOpen: boolean; onToggleLegend: () => void }) {
  return (
    <div className="ccr-top">
      <div className="ccr-zone ccr-pixel" aria-live="polite">
        <b aria-hidden="true">◆</b>
        <span>{snap.zone ? ZONE_LABELS[snap.zone] : 'Courthouse'}</span>
      </div>
      <div className="ccr-actions">
        <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" aria-expanded={legendOpen} onClick={onToggleLegend}>
          {legendOpen ? 'Hide controls' : 'Controls'}
        </button>
        {touch ? null : (
          <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onPause}>
            Pause
          </button>
        )}
        {onExit ? (
          <button type="button" className="ccr-btn ccr-btn--gold ccr-btn--sm" onClick={onExit}>
            Skip to menu view
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Prompt({ snap, touch }: { snap: RoamSnapshot; touch: boolean }) {
  if (!snap.focus || snap.exhibit || snap.paused || snap.control === 'cinematic') return null;
  return (
    <div className="ccr-panel ccr-prompt ccr-pixel" role="status">
      <Key>{touch ? '✋' : 'E'}</Key>
      {snap.focus.prompt}
    </div>
  );
}

export function Dialogue({ snap, touch }: { snap: RoamSnapshot; touch: boolean }) {
  const d = snap.dialogue;
  if (!d) return null;
  const done = d.shown >= d.text.length;
  return (
    <div className="ccr-panel ccr-dialogue" role="log" aria-live="polite" aria-atomic="true">
      {d.name ? <div className="ccr-name ccr-pixel">{d.name}</div> : null}
      <p className="ccr-line">
        <span aria-hidden="true">{d.text.slice(0, d.shown)}</span>
        <span className="ccr-sr">{d.text}</span>
      </p>
      <span className="ccr-more ccr-pixel" aria-hidden="true">
        {done ? `▶ ${touch ? 'tap ✋' : 'E'} to continue` : '…'}
      </span>
    </div>
  );
}

export function Callout({ snap }: { snap: RoamSnapshot }) {
  const c = snap.callout;
  if (!c) return null;
  return (
    <div className={`ccr-callout ccr-pixel ccr-callout--${c.style}`} role="status" key={`${c.text}:${c.style}`}>
      {c.text}
    </div>
  );
}

export function BeatChip({ snap, onSkip }: { snap: RoamSnapshot; onSkip: () => void }) {
  if (!snap.beat) return null;
  return (
    <div className="ccr-beat ccr-pixel" role="status">
      <span>
        ● {BEAT_LABELS[snap.beat.id]}
        {snap.control === 'cinematic' ? ' · cinematic' : ''}
      </span>
      <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onSkip}>
        Skip beat
      </button>
    </div>
  );
}

/** Keep keyboard focus inside a modal while it is open; restore it after. */
function useModalFocus(open: boolean, returnTo: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const back = useRef(returnTo);
  back.current = returnTo;
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('button, select, input, [tabindex="0"]')].filter((n) => !n.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      back.current();
    };
  }, [open]);
  return ref;
}

export function ExhibitPanel({ snap, controller, restoreFocus }: { snap: RoamSnapshot; controller: RoamController; restoreFocus: () => void }) {
  const card = snap.exhibit ? EXHIBIT_CARDS[snap.exhibit] : null;
  const ref = useModalFocus(!!card, restoreFocus);
  if (!card) return null;
  return (
    <div className="ccr-scrim" ref={ref} onKeyDown={(e) => (e.key === 'Escape' || e.key === 'e' || e.key === 'E') && (e.stopPropagation(), controller.closeExhibit())}>
      <div className="ccr-panel ccr-exhibit" role="dialog" aria-modal="true" aria-labelledby="ccr-exhibit-title">
        <div className="ccr-exhibit-tab ccr-pixel" style={{ background: card.color, color: card.color === '#D9A046' ? '#4A3A32' : '#FFF9ED' }}>
          <span id="ccr-exhibit-title">{card.title}</span>
          <span>{card.subtitle}</span>
        </div>
        <div className="ccr-exhibit-body">
          <p>{card.body}</p>
          <span className="ccr-stamp ccr-pixel" aria-hidden="true">
            ENTERED INTO EVIDENCE
          </span>
          <div className="ccr-modal-row">
            <button type="button" className="ccr-btn" data-autofocus onClick={() => controller.closeExhibit()}>
              Put it back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface PauseMenuProps {
  snap: RoamSnapshot;
  controller: RoamController;
  touch: boolean;
  quality: QualityLevel;
  onQuality: (q: QualityLevel) => void;
  pixelated: boolean;
  onPixelated: (on: boolean) => void;
  onExit?: () => void;
  restoreFocus: () => void;
  autoNote?: string | null;
}

export function PauseMenu({ snap, controller, touch, quality, onQuality, pixelated, onPixelated, onExit, restoreFocus, autoNote }: PauseMenuProps) {
  const ref = useModalFocus(snap.paused, restoreFocus);
  if (!snap.paused) return null;
  return (
    <div className="ccr-scrim" ref={ref} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), controller.setPaused(false))}>
      <div className="ccr-panel ccr-modal" role="dialog" aria-modal="true" aria-labelledby="ccr-pause-title">
        <h2 id="ccr-pause-title" className="ccr-pixel" style={{ fontSize: 22 }}>
          Court in recess
        </h2>
        <div className="ccr-modal-row">
          <button type="button" className="ccr-btn" data-autofocus onClick={() => controller.setPaused(false)}>
            Resume
          </button>
          <button
            type="button"
            className="ccr-btn ccr-btn--ghost"
            onClick={() => {
              controller.skipBeat();
              controller.teleport('lobby');
              controller.setPaused(false);
            }}
          >
            Back to the lobby
          </button>
          {onExit ? (
            <button type="button" className="ccr-btn ccr-btn--gold" onClick={onExit}>
              Skip to menu view
            </button>
          ) : null}
        </div>
        <label className="ccr-field">
          <span>Graphics quality</span>
          <select value={quality} onChange={(e) => onQuality(e.target.value as QualityLevel)}>
            {QUALITY_LEVELS.map((q) => (
              <option key={q} value={q}>
                {q[0]!.toUpperCase() + q.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {autoNote ? <p style={{ margin: 0, fontSize: 13, color: 'var(--cc-color-text-muted,#7B645A)' }}>{autoNote}</p> : null}
        <label className="ccr-field">
          <span>Chunky pixels (low-res render)</span>
          <input type="checkbox" checked={pixelated} onChange={(e) => onPixelated(e.target.checked)} />
        </label>
        <label className="ccr-field">
          <span>Reduce motion (no head-bob or shake)</span>
          <input type="checkbox" checked={snap.reducedMotion} onChange={(e) => controller.setReducedMotion(e.target.checked)} />
        </label>
        <ControlLegend touch={touch} inline />
      </div>
    </div>
  );
}
