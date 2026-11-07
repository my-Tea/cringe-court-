import { useEffect, useRef, type ReactNode } from 'react';
import type { RoamController } from '../controller';
import { EXHIBIT_CARDS } from '../dialogue';
import { PERSPECTIVES, type PerspectiveChoice } from '../perspective';
import { QUALITY_LEVELS, type QualityLevel } from '../quality';
import type { BeatId, RoamSnapshot } from '../types';
import { C } from '../palette';
import { DEFAULT_ROAM_STRINGS, useRoamStrings } from './strings';

/** English beat names; hosts localise through `RoamStrings.beatLabels`. */
export const BEAT_LABELS: Readonly<Record<BeatId, string>> = DEFAULT_ROAM_STRINGS.beatLabels;

export function Key({ children }: { children: ReactNode }) {
  return <kbd className="ccr-key">{children}</kbd>;
}

export function ControlLegend({ touch, onClose, inline = false }: { touch: boolean; onClose?: () => void; inline?: boolean }) {
  const S = useRoamStrings();
  const rows = touch ? S.legendTouchRows : S.legendKeyboardRows;
  return (
    <section className={inline ? 'ccr-legend ccr-legend--inline' : 'ccr-panel ccr-legend'} aria-label={S.controlsTitle}>
      <h2 className="ccr-pixel">{S.controlsTitle}</h2>
      <ul>
        {rows.map((row, i) => (
          <li key={i}>{row((label) => <Key>{label}</Key>)}</li>
        ))}
      </ul>
      {onClose ? (
        <div className="ccr-modal-row" style={{ marginTop: 10 }}>
          <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onClose}>
            {S.controlsHide}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function TopBar({ snap, touch = false, onExit, onPause, legendOpen, onToggleLegend }: { snap: RoamSnapshot; touch?: boolean; onExit?: () => void; onPause: () => void; legendOpen: boolean; onToggleLegend: () => void }) {
  const S = useRoamStrings();
  return (
    <div className="ccr-top">
      <div className="ccr-zone ccr-pixel" aria-live="polite">
        <b aria-hidden="true">◆</b>
        <span>{snap.zone ? S.zoneLabels[snap.zone] : S.zoneFallback}</span>
      </div>
      <div className="ccr-actions">
        <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" aria-expanded={legendOpen} onClick={onToggleLegend}>
          {legendOpen ? S.controlsHide : S.controlsShow}
        </button>
        {touch ? null : (
          <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onPause}>
            {S.pause}
          </button>
        )}
        {onExit ? (
          <button type="button" className="ccr-btn ccr-btn--gold ccr-btn--sm" onClick={onExit}>
            {S.skipToMenuView}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Prompt({ snap, touch }: { snap: RoamSnapshot; touch: boolean }) {
  const S = useRoamStrings();
  if (!snap.focus || snap.exhibit || snap.paused || snap.control === 'cinematic') return null;
  return (
    <div className="ccr-panel ccr-prompt ccr-pixel" role="status">
      <Key>{touch ? '✋' : S.keyInteract}</Key>
      {snap.focus.prompt}
    </div>
  );
}

/** Speaker plate colours from the character design bible. */
const SPEAKER_TONE: Readonly<Record<string, string>> = {
  prosecutor: 'prosecutor',
  defense: 'defense',
  judge: 'judge',
  clerk: 'clerk',
  bailiff: 'bailiff',
  narrator: 'narrator',
};

function speakerTone(speaker: string): string {
  if (SPEAKER_TONE[speaker]) return SPEAKER_TONE[speaker]!;
  if (speaker.startsWith('juror')) return 'juror';
  return 'narrator';
}

export function Dialogue({ snap, touch, tapToContinue = false, onAdvance }: { snap: RoamSnapshot; touch: boolean; tapToContinue?: boolean; onAdvance?: () => void }) {
  const S = useRoamStrings();
  const d = snap.dialogue;
  if (!d) return null;
  const done = d.shown >= d.text.length;
  const tone = speakerTone(d.speaker);
  return (
    // A pointer shortcut only (finish the line / move on); keyboard players have E and X, so it is not a control.
    <div className="ccr-panel ccr-dialogue" data-speaker={tone} role="log" aria-live="polite" aria-atomic="true" onClick={onAdvance}>
      <div className="ccr-dialogue-head">
        <span className="ccr-portrait" data-speaker={tone} aria-hidden="true" />
        <div className="ccr-dialogue-id">
          {d.name ? <div className="ccr-name ccr-pixel">{d.name}</div> : null}
          {d.role ? <div className="ccr-role ccr-pixel">{d.role}</div> : null}
        </div>
      </div>
      <p className="ccr-line">
        <span aria-hidden="true">{d.text.slice(0, d.shown)}</span>
        <span className="ccr-sr">{d.text}</span>
        {!done ? <span className="ccr-caret" aria-hidden="true" /> : null}
      </p>
      <span className="ccr-more ccr-pixel" aria-hidden="true">
        {done ? (tapToContinue ? S.continueTap : touch ? S.continueTouch : S.continueKey) : '…'}
      </span>
    </div>
  );
}

/** The narrow-room sheet under the 3D view (CSS shows it only in narrow rooms); the dialogue docks over it. */
export function Dock({ snap, touch }: { snap: RoamSnapshot; touch: boolean }) {
  const S = useRoamStrings();
  if (snap.dialogue) return null;
  const text = snap.beat ? S.beatChip(S.beatLabels[snap.beat.id], snap.control === 'cinematic') : touch ? S.touchDragHint : (snap.zone ? S.zoneLabels[snap.zone] : S.zoneFallback);
  return (
    <div className="ccr-dock ccr-pixel" aria-hidden="true">
      <p>{text}</p>
    </div>
  );
}

/** First-visit hint in a corner: how to take the camera. Dismissible, never modal, never over a cinematic beat. */
export function Onboarding({ onCapture, onKeyboard, onDismiss }: { onCapture: () => void; onKeyboard: () => void; onDismiss: () => void }) {
  const S = useRoamStrings();
  return (
    <section className="ccr-panel ccr-onboard" aria-labelledby="ccr-onboard-title">
      <h2 id="ccr-onboard-title" className="ccr-onboard-title ccr-pixel" style={{ margin: 0, fontWeight: 400 }}>
        {S.captureTitle}
      </h2>
      <p>{S.captureMouse}</p>
      <p>{S.captureKeyboard((cap) => <kbd className="ccr-key">{cap}</kbd>)}</p>
      <div className="ccr-modal-row">
        <button type="button" className="ccr-btn ccr-btn--sm" onClick={onCapture}>
          {S.captureClick}
        </button>
        <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onKeyboard}>
          {S.captureKeyboardOnly}
        </button>
        <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onDismiss}>
          {S.captureDismiss}
        </button>
      </div>
    </section>
  );
}

export function Callout({ snap }: { snap: RoamSnapshot }) {
  const c = snap.callout;
  if (!c) return null;
  const impact =
    c.style === 'objection' ||
    c.style === 'order' ||
    c.style === 'counter' ||
    c.style === 'verdict' ||
    c.style === 'jury-out' ||
    c.style === 'let-bro-cook';
  // `id` remounts slam + impact on every new callout, including repeats.
  return (
    <>
      {impact ? <div className={`ccr-impact ccr-impact--${c.style}`} aria-hidden key={`impact:${c.id}`} /> : null}
      <div className={`ccr-callout ccr-pixel ccr-callout--${c.style}`} role="status" key={`callout:${c.id}`}>
        {c.text}
      </div>
    </>
  );
}

export function BeatChip({ snap, onSkip }: { snap: RoamSnapshot; onSkip: () => void }) {
  const S = useRoamStrings();
  if (!snap.beat) return null;
  return (
    <div className="ccr-beat ccr-pixel" role="status">
      <span>{S.beatChip(S.beatLabels[snap.beat.id], snap.control === 'cinematic')}</span>
      {/* The verdict is never skipped: it is what the hearing was for. */}
      {snap.beat.id === 'verdict' ? null : (
        <button type="button" className="ccr-btn ccr-btn--ghost ccr-btn--sm" onClick={onSkip}>
          {S.skipBeat}
        </button>
      )}
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
  const S = useRoamStrings();
  const base = snap.exhibit ? EXHIBIT_CARDS[snap.exhibit] : null;
  const card = base ? { ...base, ...S.exhibitCard(base) } : null;
  const ref = useModalFocus(!!card, restoreFocus);
  if (!card) return null;
  return (
    <div className="ccr-scrim" ref={ref} onKeyDown={(e) => (e.key === 'Escape' || e.key === 'e' || e.key === 'E') && (e.stopPropagation(), controller.closeExhibit())}>
      <div className="ccr-panel ccr-exhibit" role="dialog" aria-modal="true" aria-labelledby="ccr-exhibit-title">
        <div className="ccr-exhibit-tab ccr-pixel" style={{ background: card.color, color: card.color === C.gold500 ? C.neutral900 : C.neutral100 }}>
          <span id="ccr-exhibit-title">{card.title}</span>
          <span>{card.subtitle}</span>
        </div>
        <div className="ccr-exhibit-body">
          <p>{card.body}</p>
          <span className="ccr-stamp ccr-pixel" aria-hidden="true">
            {S.exhibitStamp}
          </span>
          <div className="ccr-modal-row">
            <button type="button" className="ccr-btn" data-autofocus onClick={() => controller.closeExhibit()}>
              {S.exhibitPutBack}
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
  perspective: PerspectiveChoice;
  onPerspective: (p: PerspectiveChoice) => void;
  pixelated: boolean;
  onPixelated: (on: boolean) => void;
  onExit?: () => void;
  restoreFocus: () => void;
  autoNote?: string | null;
  /** Host entries after Resume (a game's own menu). */
  extra?: ReactNode;
  /** Show "Back to the lobby". Default true. */
  lobby?: boolean;
}

export function PauseMenu({ snap, controller, touch, quality, onQuality, perspective, onPerspective, pixelated, onPixelated, onExit, restoreFocus, autoNote, extra, lobby = true }: PauseMenuProps) {
  const S = useRoamStrings();
  const ref = useModalFocus(snap.paused, restoreFocus);
  if (!snap.paused) return null;
  return (
    <div className="ccr-scrim" ref={ref} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), controller.setPaused(false))}>
      <div className="ccr-panel ccr-modal" role="dialog" aria-modal="true" aria-labelledby="ccr-pause-title">
        <h2 id="ccr-pause-title" className="ccr-pixel" style={{ fontSize: 22 }}>
          {S.pauseTitle}
        </h2>
        <div className="ccr-modal-row">
          <button type="button" className="ccr-btn" data-autofocus onClick={() => controller.setPaused(false)}>
            {S.pauseResume}
          </button>
          {lobby ? (
            <button
              type="button"
              className="ccr-btn ccr-btn--ghost"
              onClick={() => {
                controller.skipBeat();
                controller.teleport('lobby');
                controller.setPaused(false);
              }}
            >
              {S.pauseBackToLobby}
            </button>
          ) : null}
          {onExit ? (
            <button type="button" className="ccr-btn ccr-btn--gold" onClick={onExit}>
              {S.skipToMenuView}
            </button>
          ) : null}
        </div>
        {extra ? <div className="ccr-modal-row ccr-modal-menu">{extra}</div> : null}
        <label className="ccr-field">
          <span>{S.pausePerspective}</span>
          <select value={perspective} onChange={(e) => onPerspective(e.target.value as PerspectiveChoice)}>
            {PERSPECTIVES.map((p) => (
              <option key={p} value={p}>
                {S.perspectiveLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="ccr-field">
          <span>{S.pauseGraphicsQuality}</span>
          <select value={quality} onChange={(e) => onQuality(e.target.value as QualityLevel)}>
            {QUALITY_LEVELS.map((q) => (
              <option key={q} value={q}>
                {S.qualityLevel(q)}
              </option>
            ))}
          </select>
        </label>
        {autoNote ? <p style={{ margin: 0, fontSize: 13, color: `var(--cc-color-text-muted,${C.neutral700})` }}>{autoNote}</p> : null}
        <label className="ccr-field">
          <span>{S.pauseChunkyPixels}</span>
          <input type="checkbox" checked={pixelated} onChange={(e) => onPixelated(e.target.checked)} />
        </label>
        <label className="ccr-field">
          <span>{S.pauseReduceMotion}</span>
          <input type="checkbox" checked={snap.reducedMotion} onChange={(e) => controller.setReducedMotion(e.target.checked)} />
        </label>
        <ControlLegend touch={touch} inline />
      </div>
    </div>
  );
}
