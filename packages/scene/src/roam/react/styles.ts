/**
 * HUD styles, injected once. Overlays use the design tokens (apps/web
 * ds/tokens.css) with palette fallbacks so the component also works outside
 * the app shell; the fallbacks are palette swatches (../palette), never raw
 * colours. Pixel UI: hard 0-blur shadows, square corners, the pixel face.
 */
import { alpha, C } from '../palette';

export const ROAM_CSS = `
.ccr-root{--ccr-dock:9.5rem;container:ccr / inline-size;position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:${C.neutral900};color:var(--cc-color-text,${C.neutral900});font-family:var(--cc-font-body,system-ui,sans-serif);outline:none;touch-action:none;user-select:none;-webkit-user-select:none;isolation:isolate}
.ccr-root:focus-visible{box-shadow:inset 0 0 0 3px var(--cc-color-highlight,${C.gold300})}
.ccr-canvas{position:absolute;inset:0}
.ccr-canvas canvas{image-rendering:pixelated;image-rendering:crisp-edges;display:block}
.ccr-hud{position:absolute;inset:0;pointer-events:none;z-index:1}
.ccr-hud *{box-sizing:border-box}
.ccr-pixel{font-family:var(--cc-font-pixel,'Pixelify Sans',ui-monospace,monospace);letter-spacing:.02em}
.ccr-panel{background:var(--cc-color-surface,${C.neutral100});border:3px solid ${C.neutral900};box-shadow:inset 0 0 0 2px var(--cc-color-frame,${C.gold500}),4px 4px 0 ${C.neutral900};border-radius:0}
.ccr-btn{pointer-events:auto;font:inherit;font-family:var(--cc-font-pixel,'Pixelify Sans',ui-monospace,monospace);font-size:15px;line-height:1;cursor:pointer;color:var(--cc-color-on-accent,${C.neutral100});background:var(--cc-color-accent,${C.royal900});border:3px solid ${C.neutral900};box-shadow:inset 0 -3px 0 ${alpha(C.neutral900, .28)},3px 3px 0 ${C.neutral900};padding:10px 14px;min-height:44px;border-radius:0}
.ccr-btn:hover{background:var(--cc-color-accent-hover,${C.royal700})}
.ccr-btn:active{transform:translate(2px,2px);box-shadow:inset 0 -1px 0 ${alpha(C.neutral900, .28)},1px 1px 0 ${C.neutral900}}
.ccr-btn:focus-visible{outline:3px solid var(--cc-color-highlight,${C.gold300});outline-offset:2px}
.ccr-btn--gold{color:${C.neutral900};background:var(--cc-color-highlight,${C.gold300})}
.ccr-btn--gold:hover{background:${C.royal100}}
.ccr-btn--ghost{color:${C.neutral900};background:var(--cc-color-surface,${C.neutral100})}
.ccr-btn--ghost:hover{background:${C.gold100}}
.ccr-btn--sm{font-size:13px;padding:7px 10px;min-height:36px}
.ccr-key{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 6px;margin-right:6px;font-family:var(--cc-font-pixel,'Pixelify Sans',ui-monospace,monospace);font-size:13px;color:${C.neutral900};background:${C.gold100};border:2px solid ${C.neutral900};box-shadow:0 3px 0 ${C.neutral900};vertical-align:middle}
.ccr-top{position:absolute;left:12px;right:12px;top:12px;display:flex;align-items:flex-start;gap:10px;justify-content:space-between}
.ccr-zone{padding:6px 10px 6px 8px;font-size:14px;white-space:nowrap;color:${C.neutral100};background:${alpha(C.neutral900, .78)};border:2px solid var(--cc-color-frame,${C.gold500});display:flex;gap:8px;align-items:center}
.ccr-zone b{color:var(--cc-color-highlight,${C.gold300});font-weight:400}
.ccr-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ccr-cross{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;opacity:.85}
.ccr-cross::before,.ccr-cross::after{content:'';position:absolute;background:${C.neutral100};box-shadow:0 0 0 1px ${C.neutral900}}
.ccr-cross::before{left:6px;top:0;width:2px;height:14px}
.ccr-cross::after{top:6px;left:0;height:2px;width:14px}
.ccr-cross--on::before,.ccr-cross--on::after{background:var(--cc-color-highlight,${C.gold300})}
.ccr-prompt{position:absolute;left:50%;top:calc(50% + 64px);transform:translateX(-50%);padding:8px 12px;font-size:16px;white-space:nowrap;display:flex;align-items:center;color:${C.neutral900}}
.ccr-dock{display:none}
.ccr-dialogue{pointer-events:auto;cursor:pointer;position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,calc(100% - 24px));padding:18px 18px 12px;min-height:96px}
.ccr-name{position:absolute;top:-17px;left:14px;padding:5px 10px;font-size:14px;color:${C.neutral100};background:var(--cc-color-accent,${C.royal900});border:3px solid ${C.neutral900};box-shadow:2px 2px 0 ${C.neutral900}}
.ccr-line{margin:0;font-size:17px;line-height:1.45;min-height:2.9em}
.ccr-more{display:block;text-align:right;margin-top:4px;font-size:12px;color:var(--cc-color-text-muted,${C.neutral700})}
.ccr-callout{position:absolute;left:50%;top:9%;transform:translateX(-50%) rotate(-3deg);padding:8px 20px;font-size:clamp(24px,5vw,46px);line-height:1;color:${C.neutral100};background:var(--cc-color-accent,${C.royal900});border:4px solid ${C.neutral900};box-shadow:inset 0 0 0 3px var(--cc-color-highlight,${C.gold300}),6px 6px 0 ${C.neutral900};white-space:nowrap;animation:ccr-pop var(--cc-duration-slow,320ms) var(--cc-ease-pixel,steps(4,end))}
.ccr-callout--verdict{background:var(--cc-color-highlight,${C.gold300});color:${C.neutral900};box-shadow:inset 0 0 0 3px var(--cc-color-accent,${C.royal900}),6px 6px 0 ${C.neutral900}}
.ccr-callout--order{background:${C.neutral900};color:var(--cc-color-highlight,${C.gold300})}
.ccr-callout--jury-out{background:var(--cc-teal-700,${C.teal900})}
@keyframes ccr-pop{0%{transform:translateX(-50%) rotate(-3deg) scale(.4)}100%{transform:translateX(-50%) rotate(-3deg) scale(1)}}
.ccr-beat{position:absolute;left:12px;top:56px;padding:6px 8px 6px 10px;font-size:13px;color:${C.neutral100};background:${alpha(C.royal900, .9)};border:2px solid var(--cc-color-frame,${C.gold500});display:flex;gap:10px;align-items:center;pointer-events:auto}
.ccr-legend{position:absolute;right:12px;top:64px;width:min(300px,calc(100% - 24px));max-height:calc(100% - 76px);overflow:auto;overscroll-behavior:contain;padding:12px 14px;font-size:14px;pointer-events:auto}
.ccr-legend--inline{position:static;width:auto;max-height:none;overflow:visible;padding:10px 0 0;border-top:2px dashed ${C.neutral500}}
.ccr-legend h2,.ccr-modal h2{margin:0 0 8px;font-size:16px;font-weight:400;color:var(--cc-color-accent,${C.royal900})}
.ccr-legend ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.ccr-legend li{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
.ccr-onboard{position:absolute;left:12px;top:58px;width:min(290px,42%);padding:10px 12px;display:grid;gap:6px;pointer-events:auto;z-index:1}
.ccr-onboard p{margin:0;font-size:13px;line-height:1.4}
.ccr-onboard .ccr-modal-row{gap:6px}
.ccr-onboard .ccr-key{min-width:22px;height:22px;font-size:12px}
.ccr-onboard-title{font-size:16px;color:var(--cc-color-accent,${C.royal900})}
.ccr-scrim{position:absolute;inset:0;display:grid;place-items:center;background:var(--cc-color-scrim,${alpha(C.neutral900, .62)});pointer-events:auto;z-index:2}
.ccr-modal{width:min(460px,calc(100% - 28px));max-height:calc(100% - 28px);overflow:auto;padding:20px;display:grid;gap:12px}
.ccr-modal-row{display:flex;gap:8px;flex-wrap:wrap}
.ccr-modal-row .ccr-btn{min-height:32px;flex:none}
.ccr-modal{align-content:start}
.ccr-field{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px}
.ccr-field select{font:inherit;min-height:36px;padding:4px 8px;border:2px solid ${C.neutral900};background:${C.gold100};color:${C.neutral900};border-radius:0}
.ccr-field input{width:20px;height:20px;accent-color:var(--cc-color-accent,${C.royal900})}
.ccr-exhibit{width:min(520px,calc(100% - 28px));display:grid;gap:0;padding:0;overflow:hidden}
.ccr-exhibit-tab{padding:12px 18px 10px;color:${C.neutral100};border-bottom:3px solid ${C.neutral900};display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.ccr-exhibit-tab span:first-child{font-size:22px}
.ccr-exhibit-body{padding:16px 18px 18px;display:grid;gap:14px;background:${C.gold100};background-image:repeating-linear-gradient(0deg,transparent 0 25px,${alpha(C.neutral500, .35)} 25px 26px)}
.ccr-exhibit-body p{margin:0;font-size:16px;line-height:26px}
.ccr-stamp{justify-self:end;padding:4px 10px;font-size:13px;color:var(--cc-color-accent,${C.royal900});border:3px solid currentColor;transform:rotate(-4deg)}
.ccr-touch{position:absolute;inset:0;pointer-events:none}
.ccr-look-zone{position:absolute;top:0;right:0;bottom:0;left:42%;pointer-events:auto}
.ccr-stick-zone{position:absolute;left:0;bottom:0;width:42%;height:62%;pointer-events:auto}
.ccr-stick{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;background:${alpha(C.neutral100, .18)};border:3px solid ${alpha(C.neutral100, .7)};box-shadow:0 0 0 3px ${alpha(C.neutral900, .5)}}
.ccr-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:var(--cc-color-highlight,${C.gold300});border:3px solid ${C.neutral900};box-shadow:inset 0 -4px 0 ${alpha(C.neutral900, .2)}}
.ccr-stick-hint{position:absolute;left:28px;bottom:34px;font-size:12px;color:${C.neutral100};text-shadow:1px 1px 0 ${C.neutral900};opacity:.9}
.ccr-touch-buttons{position:absolute;right:16px;bottom:22px;display:grid;grid-template-columns:auto auto;gap:12px;align-items:end;pointer-events:none}
.ccr-touch-buttons .ccr-btn{pointer-events:auto;min-width:64px;min-height:64px;font-size:14px}
.ccr-act{min-width:84px!important;min-height:84px!important;border-radius:0}
.ccr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ccr-loading{position:absolute;inset:0;display:grid;place-items:center;color:${C.neutral100};font-size:18px}
@media (prefers-reduced-motion: reduce){:root:not([data-reduced-motion]) .ccr-callout{animation:none}}
:root[data-reduced-motion="true"] .ccr-callout{animation:none}
/* Narrow rooms (phones): the dialogue docks below the 3D view as a sheet, so neither it nor the touch controls cover the action. */
@container ccr (max-width: 560px){
.ccr-canvas{bottom:var(--ccr-dock)}
.ccr-top{left:8px;right:8px;top:8px}
.ccr-zone{font-size:12px}
.ccr-btn--sm{font-size:12px;padding:6px 8px;min-height:32px}
.ccr-dock{display:block;position:absolute;left:0;right:0;bottom:0;height:var(--ccr-dock);padding:22px 14px 10px;background:var(--cc-color-surface,${C.neutral100});border-top:3px solid ${C.neutral900};box-shadow:inset 0 2px 0 var(--cc-color-frame,${C.gold500})}
.ccr-dock p{margin:0;font-size:14px;line-height:1.4;color:var(--cc-color-text-muted,${C.neutral700})}
.ccr-dialogue{left:0;right:0;bottom:0;top:auto;transform:none;width:auto;height:var(--ccr-dock);min-height:0;padding:10px 14px 8px;overflow:auto;overscroll-behavior:contain;border-width:3px 0 0;box-shadow:inset 0 2px 0 var(--cc-color-frame,${C.gold500})}
.ccr-name{position:static;display:inline-block;margin:0 0 6px;font-size:13px;padding:3px 8px;box-shadow:none}
.ccr-line{font-size:15px;line-height:1.4;min-height:0}
.ccr-more{margin-top:2px}
.ccr-touch{bottom:var(--ccr-dock)}
.ccr-stick-zone{height:70%}
.ccr-stick{width:96px;height:96px;margin:-48px 0 0 -48px}
.ccr-knob{width:44px;height:44px;margin:-22px 0 0 -22px}
.ccr-stick-hint{left:14px;bottom:10px}
.ccr-touch-buttons{right:10px;bottom:10px;gap:8px}
.ccr-touch-buttons .ccr-btn{min-width:48px;min-height:48px;padding:6px}
.ccr-act{min-width:60px!important;min-height:60px!important}
.ccr-prompt{top:auto;bottom:calc(var(--ccr-dock) + 144px);font-size:14px}
.ccr-callout{top:100px;font-size:clamp(20px,8cqw,34px);padding:6px 14px}
/* The beat name moves into the dock (and the host's bar); a chip would sit on the action. */
.ccr-beat{display:none}
.ccr-legend{top:96px;right:8px;max-height:calc(100% - var(--ccr-dock) - 104px)}
}
`;

let injected = false;
export function ensureRoamStyles(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!doc || injected || doc.getElementById('ccr-styles')) return;
  const el = doc.createElement('style');
  el.id = 'ccr-styles';
  el.textContent = ROAM_CSS;
  doc.head.appendChild(el);
  injected = true;
}
