/**
 * The town HUD: location name, control legend, focus prompt, dialogue box and a
 * minimap.
 *
 * Styling reuses the roam HUD's `ccr-*` classes (and therefore the `--cc-*`
 * design tokens) rather than introducing a second visual language — the town
 * should feel like the same game as the courtroom, not a different one bolted on.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import type { IsoSnapshot } from '../controller';
import type { MapId, TownWorld } from '../world';
import { CELL, LEGEND } from '../world';

const MAP_LABELS: Readonly<Record<MapId, string>> = {
  square: 'Town Square',
  market: 'Market Row',
  archive: 'Evidence Archive',
  tavern: 'The Gavel & Goat',
  streets: 'Lantern Row',
  courthouse: 'The Courtroom',
};

export interface HudProps {
  snap: IsoSnapshot;
  world: TownWorld;
  onPause: () => void;
  onExit?: () => void;
  onChoose: (index: number) => void;
  onEndDialogue: () => void;
}

/** Where the player is, and a one-line reminder of the controls. */
export function TownBar({ snap, onPause, onExit }: Omit<HudProps, 'world' | 'onChoose' | 'onEndDialogue'>) {
  return (
    <div className="ccr-top" style={{ pointerEvents: 'none' }}>
      <div className="ccr-panel ccr-chip" style={chip}>
        <span className="ccr-pixel" style={{ fontWeight: 700 }}>
          {snap.mapName}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
        <button className="ccr-btn" onClick={onPause} aria-label="Pause">
          II
        </button>
        {onExit ? (
          <button className="ccr-btn" onClick={onExit}>
            Leave town
          </button>
        ) : null}
      </div>
    </div>
  );
}

const chip: CSSProperties = {
  padding: '6px 12px',
  fontSize: 15,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

/**
 * Minimap.
 *
 * Drawn from the tile grid rather than the geometry: at one pixel per tile it is
 * already a readable plan, and it costs a 34×26 canvas instead of a second scene.
 * Rebuilt only when the map changes.
 */
export function Minimap({ world, snap }: { world: TownWorld; snap: IsoSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  // The courthouse is hundreds of cells across. One pixel per cell keeps the
  // HUD small, and the terrain is cached so walking does not repaint it.
  const scale = world.cols > 180 ? 1 : world.cols > 40 ? 3 : 5;
  const display = Math.min(168, world.cols * scale);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const w = world.cols * scale;
    const h = world.rows * scale;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    for (let r = 0; r < world.rows; r++) {
      let c = 0;
      while (c < world.cols) {
        const src = world.spec.floor[r]?.[c] ?? '.';
        const tile = world.tiles[r]?.[c];
        if (!tile || src === '.' || src === ' ') {
          c++;
          continue;
        }
        const color = tile.walk ? shade(tile.m) : '#4A3A32';
        let end = c;
        while (end + 1 < world.cols) {
          const nextSrc = world.spec.floor[r]?.[end + 1] ?? '.';
          const next = world.tiles[r]?.[end + 1];
          if (!next || nextSrc === '.' || nextSrc === ' ') break;
          if ((next.walk ? shade(next.m) : '#4A3A32') !== color) break;
          end++;
        }
        ctx.fillStyle = color;
        ctx.fillRect(c * scale, r * scale, (end - c + 1) * scale, scale);
        c = end + 1;
      }
    }

    for (const p of world.portals) {
      ctx.fillStyle = '#F6C75B';
      ctx.fillRect(p.tile[0] * scale, p.tile[1] * scale, Math.max(scale, 2), Math.max(scale, 2));
    }
    for (const n of world.npcs) {
      ctx.fillStyle = '#A32D3F';
      ctx.fillRect((n.pos[0] / CELL) * scale - 1, (n.pos[2] / CELL) * scale - 1, Math.max(scale, 2), Math.max(scale, 2));
    }

    base.current = off;
    canvas.width = w;
    canvas.height = h;
  }, [world, scale]);

  useEffect(() => {
    const canvas = ref.current;
    const off = base.current;
    if (!canvas || !off) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0);

    // The player, as an arrow so facing is legible.
    const px = (snap.pos[0] / CELL) * scale;
    const py = (snap.pos[2] / CELL) * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-snap.yaw);
    ctx.fillStyle = '#FFF9ED';
    ctx.strokeStyle = '#4A3A32';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(3, 3);
    ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [world, scale, snap.pos, snap.yaw]);

  return (
    <div className="ccr-panel" style={mapFrame} aria-hidden="true">
      <canvas ref={ref} style={{ display: 'block', imageRendering: 'pixelated', width: display, height: 'auto' }} />
    </div>
  );
}

const mapFrame: CSSProperties = {
  position: 'absolute',
  right: 12,
  bottom: 12,
  padding: 6,
  lineHeight: 0,
};

/** Lighten a hex so walkable tiles read brighter than blockers on a tiny map. */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40);
  const g = Math.min(255, ((n >> 8) & 255) + 40);
  const b = Math.min(255, (n & 255) + 40);
  return `rgb(${r}, ${g}, ${b})`;
}

/** "E: Talk to Vera" when something is in reach. */
export function FocusPrompt({ snap }: { snap: IsoSnapshot }) {
  if (!snap.focus || snap.control !== 'free') return null;
  return (
    <div className="ccr-prompt" role="status" aria-live="polite">
      <span className="ccr-panel ccr-pixel" style={{ padding: '8px 14px', fontSize: 15 }}>
        <kbd className="ccr-key">E</kbd> {snap.focus.prompt}
      </span>
    </div>
  );
}

/** The conversation box: one speaker, one line, then choices or a continue. */
export function DialogueBox({
  snap,
  onChoose,
  onContinue,
  onEnd,
}: Pick<HudProps, 'snap' | 'onChoose' | 'onEndDialogue'> & { onContinue?: () => void; onEnd?: () => void }) {
  const view = snap.dialogue;
  if (!view?.node || snap.control !== 'dialogue') return null;
  const name = snap.speakerName ?? view.node.speaker;
  return (
    <div className="ccr-dialogue" role="dialog" aria-modal="false" aria-label={`Conversation with ${name}`} style={dialogueWrap}>
      <div className="ccr-panel" style={{ padding: 16, maxWidth: 720, width: '100%' }}>
        <div className="ccr-pixel" style={{ fontSize: 14, color: '#7A1C2E', marginBottom: 6, letterSpacing: '.04em' }}>
          {name.toUpperCase()}
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 17, lineHeight: 1.5 }}>{view.node.text}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {view.choices.length ? (
            view.choices.map((choice, i) => (
              <button key={`${choice.text}-${i}`} className="ccr-btn" onClick={() => onChoose(i)}>
                {i + 1}. {choice.text}
              </button>
            ))
          ) : (
            <>
              <button className="ccr-btn" onClick={onContinue ?? onEnd}>
                E. Continue
              </button>
              <button className="ccr-btn" onClick={onEnd} style={{ background: '#4A3A32' }}>
                Leave
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const dialogueWrap: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  padding: 16,
  pointerEvents: 'auto',
};

/** The controls, in one line, dismissible. */
export function ControlLegend({ onClose }: { onClose: () => void }) {
  return (
    <div className="ccr-legend ccr-panel" style={legendBox}>
      <div style={{ display: 'grid', gap: 4, fontSize: 13 }}>
        <div>
          <kbd className="ccr-key">W</kbd> <kbd className="ccr-key">A</kbd> <kbd className="ccr-key">S</kbd> <kbd className="ccr-key">D</kbd> or arrows — walk
        </div>
        <div>
          <kbd className="ccr-key">Shift</kbd> — run · click the ground to walk · <kbd className="ccr-key">E</kbd> — talk, open, inspect ·{' '}
          <kbd className="ccr-key">Esc</kbd> — pause
        </div>
      </div>
      <button className="ccr-btn" onClick={onClose} style={{ marginTop: 8, minHeight: 36, padding: '6px 10px' }} aria-label="Hide controls">
        Hide
      </button>
    </div>
  );
}

const legendBox: CSSProperties = {
  position: 'absolute',
  left: 12,
  bottom: 12,
  padding: '8px 10px',
  // Wide enough for one wrapped line, not a panel that eats the viewport.
  maxWidth: 300,
  fontSize: 12,
  pointerEvents: 'auto',
};

/** The trial, spoken over the town: the same beats as the first-person court. */
export function TrialOverlay({
  speaker,
  text,
  callout,
  onSkip,
}: {
  speaker: string | null;
  text: string | null;
  callout: string | null;
  onSkip: () => void;
}) {
  if (!text && !callout) return null;
  return (
    <div className="ccr-dialogue" role="status" aria-live="polite" style={dialogueWrap}>
      <div className="ccr-panel" style={{ padding: 16, maxWidth: 720, width: '100%' }}>
        {callout ? (
          <div className="ccr-pixel" style={{ fontSize: 22, letterSpacing: '.08em', color: '#7A1C2E', marginBottom: text ? 8 : 0 }}>
            {callout}
          </div>
        ) : null}
        {text ? (
          <>
            <div className="ccr-pixel" style={{ fontSize: 14, color: '#7A1C2E', marginBottom: 6, letterSpacing: '.04em' }}>
              {(speaker ?? 'The court').toUpperCase()}
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 17, lineHeight: 1.5 }}>{text}</p>
          </>
        ) : null}
        <button className="ccr-btn" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

export { MAP_LABELS, LEGEND };
