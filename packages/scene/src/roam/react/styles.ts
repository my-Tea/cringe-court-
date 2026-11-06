/**
 * HUD styles, injected once. Overlays use the design tokens (apps/web
 * ds/tokens.css) with palette fallbacks so the component also works outside
 * the app shell. Pixel UI: hard 0-blur shadows, square corners, the pixel face.
 */
export const ROAM_CSS = `
.ccr-root{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#4A3A32;color:var(--cc-color-text,#4A3A32);font-family:var(--cc-font-body,system-ui,sans-serif);outline:none;touch-action:none;user-select:none;-webkit-user-select:none;isolation:isolate}
.ccr-root:focus-visible{box-shadow:inset 0 0 0 3px var(--cc-color-highlight,#F6C75B)}
.ccr-canvas{position:absolute;inset:0}
.ccr-canvas canvas{image-rendering:pixelated;image-rendering:crisp-edges;display:block}
.ccr-hud{position:absolute;inset:0;pointer-events:none;z-index:1}
.ccr-hud *{box-sizing:border-box}
.ccr-pixel{font-family:var(--cc-font-pixel,'Pixelify Sans',ui-monospace,monospace);letter-spacing:.02em}
.ccr-panel{background:var(--cc-color-surface,#FFF9ED);border:3px solid #4A3A32;box-shadow:inset 0 0 0 2px var(--cc-color-frame,#D9A046),4px 4px 0 #4A3A32;border-radius:0}
.ccr-btn{pointer-events:auto;font:inherit;font-family:var(--cc-font-pixel,'Pixelify Sans',ui-monospace,monospace);font-size:15px;line-height:1;cursor:pointer;color:var(--cc-color-on-accent,#FFF9ED);background:var(--cc-color-accent,#7A1C2E);border:3px solid #4A3A32;box-shadow:inset 0 -3px 0 rgb(0 0 0 / .28),3px 3px 0 #4A3A32;padding:10px 14px;min-height:44px;border-radius:0}
.ccr-btn:hover{background:var(--cc-color-accent-hover,#A32D3F)}
.ccr-btn:active{transform:translate(2px,2px);box-shadow:inset 0 -1px 0 rgb(0 0 0 / .28),1px 1px 0 #4A3A32}
.ccr-btn:focus-visible{outline:3px solid var(--cc-color-highlight,#F6C75B);outline-offset:2px}
.ccr-btn--gold{color:#4A3A32;background:var(--cc-color-highlight,#F6C75B)}
.ccr-btn--gold:hover{background:#FFD79A}
.ccr-btn--ghost{color:#4A3A32;background:var(--cc-color-surface,#FFF9ED)}
.ccr-btn--ghost:hover{background:#FFF2C7}
.ccr-btn--sm{font-size:13px;padding:7px 10px;min-height:36px}
.ccr-key{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 6px;margin-right:6px;font-family:var(--cc-font-pixel,'Pixelify Sans',ui-monospace,monospace);font-size:13px;color:#4A3A32;background:#FFF2C7;border:2px solid #4A3A32;box-shadow:0 3px 0 #4A3A32;vertical-align:middle}
.ccr-top{position:absolute;left:12px;right:12px;top:12px;display:flex;align-items:flex-start;gap:10px;justify-content:space-between}
.ccr-zone{padding:6px 10px 6px 8px;font-size:14px;white-space:nowrap;color:#FFF9ED;background:rgb(74 58 50 / .78);border:2px solid var(--cc-color-frame,#D9A046);display:flex;gap:8px;align-items:center}
.ccr-zone b{color:var(--cc-color-highlight,#F6C75B);font-weight:400}
.ccr-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ccr-cross{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;opacity:.85}
.ccr-cross::before,.ccr-cross::after{content:'';position:absolute;background:#FFF9ED;box-shadow:0 0 0 1px #4A3A32}
.ccr-cross::before{left:6px;top:0;width:2px;height:14px}
.ccr-cross::after{top:6px;left:0;height:2px;width:14px}
.ccr-cross--on::before,.ccr-cross--on::after{background:var(--cc-color-highlight,#F6C75B)}
.ccr-prompt{position:absolute;left:50%;top:calc(50% + 64px);transform:translateX(-50%);padding:8px 12px;font-size:16px;white-space:nowrap;display:flex;align-items:center;color:#4A3A32}
.ccr-dialogue{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,calc(100% - 24px));padding:18px 18px 12px;min-height:96px}
.ccr-name{position:absolute;top:-17px;left:14px;padding:5px 10px;font-size:14px;color:#FFF9ED;background:var(--cc-color-accent,#7A1C2E);border:3px solid #4A3A32;box-shadow:2px 2px 0 #4A3A32}
.ccr-line{margin:0;font-size:17px;line-height:1.45;min-height:2.9em}
.ccr-more{display:block;text-align:right;margin-top:4px;font-size:12px;color:var(--cc-color-text-muted,#7B645A)}
.ccr-callout{position:absolute;left:50%;top:9%;transform:translateX(-50%) rotate(-3deg);padding:8px 20px;font-size:clamp(24px,5vw,46px);line-height:1;color:#FFF9ED;background:var(--cc-color-accent,#7A1C2E);border:4px solid #4A3A32;box-shadow:inset 0 0 0 3px var(--cc-color-highlight,#F6C75B),6px 6px 0 #4A3A32;white-space:nowrap;animation:ccr-pop .32s steps(4,end)}
.ccr-callout--verdict{background:var(--cc-color-highlight,#F6C75B);color:#4A3A32;box-shadow:inset 0 0 0 3px var(--cc-color-accent,#7A1C2E),6px 6px 0 #4A3A32}
.ccr-callout--order{background:#4A3A32;color:var(--cc-color-highlight,#F6C75B)}
.ccr-callout--jury-out{background:var(--cc-teal-700,#2E5F73)}
@keyframes ccr-pop{0%{transform:translateX(-50%) rotate(-3deg) scale(.4)}100%{transform:translateX(-50%) rotate(-3deg) scale(1)}}
.ccr-beat{position:absolute;left:12px;top:56px;padding:6px 8px 6px 10px;font-size:13px;color:#FFF9ED;background:rgb(122 28 46 / .9);border:2px solid var(--cc-color-frame,#D9A046);display:flex;gap:10px;align-items:center;pointer-events:auto}
.ccr-legend{position:absolute;right:12px;top:64px;width:min(300px,calc(100% - 24px));padding:12px 14px;font-size:14px;pointer-events:auto}
.ccr-legend--inline{position:static;width:auto;padding:10px 0 0;border-top:2px dashed #A9917D}
.ccr-legend h2,.ccr-modal h2{margin:0 0 8px;font-size:16px;font-weight:400;color:var(--cc-color-accent,#7A1C2E)}
.ccr-legend ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.ccr-legend li{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
.ccr-capture{position:absolute;inset:0;display:grid;place-items:center;background:rgb(74 58 50 / .42);pointer-events:auto}
.ccr-capture-card{padding:20px 22px;max-width:min(440px,calc(100% - 32px));text-align:center;display:grid;gap:12px}
.ccr-capture-card p{margin:0;font-size:15px;line-height:1.45}
.ccr-capture-title{font-size:22px;color:var(--cc-color-accent,#7A1C2E)}
.ccr-scrim{position:absolute;inset:0;display:grid;place-items:center;background:var(--cc-color-scrim,rgb(74 58 50 / .62));pointer-events:auto;z-index:2}
.ccr-modal{width:min(460px,calc(100% - 28px));max-height:calc(100% - 28px);overflow:auto;padding:20px;display:grid;gap:12px}
.ccr-modal-row{display:flex;gap:8px;flex-wrap:wrap}
.ccr-field{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px}
.ccr-field select{font:inherit;min-height:36px;padding:4px 8px;border:2px solid #4A3A32;background:#FFF2C7;color:#4A3A32;border-radius:0}
.ccr-field input{width:20px;height:20px;accent-color:var(--cc-color-accent,#7A1C2E)}
.ccr-exhibit{width:min(520px,calc(100% - 28px));display:grid;gap:0;padding:0;overflow:hidden}
.ccr-exhibit-tab{padding:12px 18px 10px;color:#FFF9ED;border-bottom:3px solid #4A3A32;display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.ccr-exhibit-tab span:first-child{font-size:22px}
.ccr-exhibit-body{padding:16px 18px 18px;display:grid;gap:14px;background:#FFF2C7;background-image:repeating-linear-gradient(0deg,transparent 0 25px,rgb(169 145 125 / .35) 25px 26px)}
.ccr-exhibit-body p{margin:0;font-size:16px;line-height:26px}
.ccr-stamp{justify-self:end;padding:4px 10px;font-size:13px;color:var(--cc-color-accent,#7A1C2E);border:3px solid currentColor;transform:rotate(-4deg)}
.ccr-touch{position:absolute;inset:0;pointer-events:none}
.ccr-look-zone{position:absolute;top:0;right:0;bottom:0;left:42%;pointer-events:auto}
.ccr-stick-zone{position:absolute;left:0;bottom:0;width:42%;height:62%;pointer-events:auto}
.ccr-stick{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;background:rgb(255 249 237 / .18);border:3px solid rgb(255 249 237 / .7);box-shadow:0 0 0 3px rgb(74 58 50 / .5)}
.ccr-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:var(--cc-color-highlight,#F6C75B);border:3px solid #4A3A32;box-shadow:inset 0 -4px 0 rgb(0 0 0 / .2)}
.ccr-stick-hint{position:absolute;left:28px;bottom:34px;font-size:12px;color:#FFF9ED;text-shadow:1px 1px 0 #4A3A32;opacity:.9}
.ccr-touch-buttons{position:absolute;right:16px;bottom:22px;display:grid;grid-template-columns:auto auto;gap:12px;align-items:end;pointer-events:none}
.ccr-touch-buttons .ccr-btn{pointer-events:auto;min-width:64px;min-height:64px;font-size:14px}
.ccr-act{min-width:84px!important;min-height:84px!important;border-radius:0}
.ccr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ccr-loading{position:absolute;inset:0;display:grid;place-items:center;color:#FFF9ED;font-size:18px}
@media (prefers-reduced-motion: reduce){.ccr-callout{animation:none}}
@media (max-width:560px){.ccr-top{left:8px;right:8px;top:8px}.ccr-zone{font-size:12px}.ccr-btn--sm{font-size:12px;padding:6px 8px}.ccr-dialogue{bottom:auto;top:58px}.ccr-line{font-size:15px}.ccr-prompt{top:auto;bottom:122px}}
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
