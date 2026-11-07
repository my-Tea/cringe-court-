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
.ccr-dialogue{pointer-events:auto;cursor:pointer;position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,calc(100% - 24px));padding:22px 18px 12px;min-height:108px;border-left-width:10px}
.ccr-dialogue[data-speaker='prosecutor']{border-left-color:#6B1C2E}
.ccr-dialogue[data-speaker='defense']{border-left-color:#1F4D3A}
.ccr-dialogue[data-speaker='judge']{border-left-color:#121826}
.ccr-dialogue[data-speaker='clerk']{border-left-color:#5B7A8C}
.ccr-dialogue[data-speaker='bailiff']{border-left-color:#3D5160}
.ccr-dialogue[data-speaker='juror']{border-left-color:#8B7355}
.ccr-dialogue[data-speaker='narrator']{border-left-color:var(--cc-color-frame,${C.gold500})}
.ccr-dialogue-head{display:flex;align-items:center;gap:10px;margin:0 0 8px}
.ccr-dialogue-id{display:grid;gap:3px;min-width:0}
.ccr-role{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--cc-color-text-muted,${C.neutral700})}
.ccr-dialogue[data-speaker='prosecutor'] .ccr-role{color:#6B1C2E}
.ccr-dialogue[data-speaker='defense'] .ccr-role{color:#1F4D3A}
.ccr-dialogue[data-speaker='judge'] .ccr-role{color:#121826}
.ccr-dialogue[data-speaker='clerk'] .ccr-role{color:#5B7A8C}
.ccr-portrait{width:28px;height:28px;flex:none;border:3px solid ${C.neutral900};box-shadow:2px 2px 0 ${C.neutral900};background:#6B1C2E}
.ccr-portrait[data-speaker='prosecutor']{background:#6B1C2E}
.ccr-portrait[data-speaker='defense']{background:#1F4D3A}
.ccr-portrait[data-speaker='judge']{background:#121826}
.ccr-portrait[data-speaker='clerk']{background:#5B7A8C}
.ccr-portrait[data-speaker='bailiff']{background:#3D5160}
.ccr-portrait[data-speaker='juror']{background:#8B7355}
.ccr-portrait[data-speaker='narrator']{background:var(--cc-color-frame,${C.gold500})}
.ccr-name{position:static;padding:5px 10px;font-size:14px;color:${C.neutral100};background:var(--cc-color-accent,${C.royal900});border:3px solid ${C.neutral900};box-shadow:2px 2px 0 ${C.neutral900}}
.ccr-dialogue[data-speaker='prosecutor'] .ccr-name{background:#6B1C2E}
.ccr-dialogue[data-speaker='defense'] .ccr-name{background:#1F4D3A}
.ccr-dialogue[data-speaker='judge'] .ccr-name{background:#121826}
.ccr-dialogue[data-speaker='clerk'] .ccr-name{background:#5B7A8C}
.ccr-line{margin:0;font-size:17px;line-height:1.45;min-height:2.9em}
.ccr-caret{display:inline-block;width:8px;height:1.1em;margin-left:2px;vertical-align:text-bottom;background:currentColor;animation:ccr-blink var(--cc-duration-slower,480ms) var(--cc-ease-blink,steps(2,jump-none)) infinite}
@keyframes ccr-blink{50%{opacity:0}}
.ccr-more{display:block;text-align:right;margin-top:4px;font-size:12px;color:var(--cc-color-text-muted,${C.neutral700})}
.ccr-callout{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%) rotate(-4deg);padding:clamp(14px,2.5vw,28px) clamp(22px,5vw,56px);font-size:clamp(42px,11vw,108px);font-weight:700;line-height:0.95;color:${C.neutral100};background:var(--cc-color-accent,${C.royal900});border:6px solid ${C.neutral900};box-shadow:inset 0 0 0 4px var(--cc-color-highlight,${C.gold300}),14px 14px 0 ${C.neutral900};white-space:nowrap;z-index:20;text-transform:uppercase;letter-spacing:.04em;animation:ccr-pop var(--cc-duration-slow,320ms) var(--cc-ease-pixel,steps(4,end));pointer-events:none;text-shadow:3px 3px 0 ${C.neutral900}}
.ccr-callout--verdict{background:var(--cc-color-highlight,${C.gold300});color:${C.neutral900};box-shadow:inset 0 0 0 4px var(--cc-color-accent,${C.royal900}),14px 14px 0 ${C.neutral900};animation-name:ccr-slam;text-shadow:none}
.ccr-callout--order{background:${C.neutral900};color:var(--cc-color-highlight,${C.gold300});animation-name:ccr-slam;letter-spacing:.1em}
.ccr-callout--objection{background:#6B1C2E;box-shadow:inset 0 0 0 5px ${C.gold300},16px 16px 0 ${C.neutral900},0 0 0 999px rgb(107 28 46 / .28);animation-name:ccr-slam;font-size:clamp(52px,14vw,128px);padding:clamp(16px,3vw,36px) clamp(28px,6vw,72px);letter-spacing:.06em}
.ccr-callout--counter{background:#1F4D3A;box-shadow:inset 0 0 0 5px ${C.gold300},14px 14px 0 ${C.neutral900},0 0 0 999px rgb(31 77 58 / .22);animation-name:ccr-slam;font-size:clamp(48px,12vw,112px)}
.ccr-callout--let-bro-cook{background:#1F4D3A;color:var(--cc-color-highlight,${C.gold300});box-shadow:inset 0 0 0 4px ${C.gold300},14px 14px 0 ${C.neutral900};animation-name:ccr-slam;transform:translate(-50%,-50%) rotate(3deg);letter-spacing:.03em;font-size:clamp(36px,9vw,88px)}
.ccr-callout--jury-out{background:var(--cc-teal-700,${C.teal900});box-shadow:inset 0 0 0 5px ${C.gold300},16px 16px 0 ${C.neutral900},0 0 0 999px rgb(20 90 90 / .28);animation-name:ccr-slam;font-size:clamp(44px,12vw,112px);padding:clamp(16px,3vw,32px) clamp(26px,5vw,64px);letter-spacing:.08em}
.ccr-callout--objection,.ccr-callout--counter,.ccr-callout--let-bro-cook,.ccr-callout--order,.ccr-callout--verdict,.ccr-callout--jury-out{animation-duration:640ms;animation-timing-function:cubic-bezier(.15,1.6,.35,1);animation-fill-mode:both}
.ccr-impact{position:absolute;inset:0;pointer-events:none;z-index:19;animation:ccr-impact-flash var(--cc-duration-dramatic,720ms) var(--cc-ease-exit,ease-out) forwards;animation-duration:780ms}
.ccr-impact--objection{background:radial-gradient(ellipse at 50% 45%,rgb(107 28 46 / .85) 0%,rgb(107 28 46 / .4) 35%,transparent 68%)}
.ccr-impact--order{background:radial-gradient(ellipse at 50% 40%,${alpha(C.gold300, .7)} 0%,${alpha(C.neutral900, .5)} 38%,transparent 70%)}
.ccr-impact--counter{background:radial-gradient(ellipse at 50% 45%,rgb(31 77 58 / .78) 0%,transparent 68%)}
.ccr-impact--let-bro-cook{background:radial-gradient(ellipse at 50% 45%,rgb(31 77 58 / .7) 0%,transparent 70%)}
.ccr-impact--jury-out{background:radial-gradient(ellipse at 50% 42%,rgb(20 110 110 / .78) 0%,rgb(12 40 50 / .45) 42%,transparent 72%)}
.ccr-impact--verdict{background:radial-gradient(ellipse at 50% 45%,${alpha(C.gold300, .8)} 0%,transparent 68%)}
.ccr-caret{animation-duration:480ms}
@keyframes ccr-pop{0%{transform:translate(-50%,-50%) rotate(-4deg) scale(.25);opacity:0}100%{transform:translate(-50%,-50%) rotate(-4deg) scale(1);opacity:1}}
@keyframes ccr-slam{0%{transform:translate(-50%,-50%) rotate(-16deg) scale(2.2);filter:brightness(2.2) contrast(1.2);opacity:0}14%{opacity:1}38%{transform:translate(-50%,-50%) rotate(5deg) scale(.9);filter:brightness(1.3)}68%{transform:translate(-50%,-50%) rotate(-5deg) scale(1.06)}100%{transform:translate(-50%,-50%) rotate(-4deg) scale(1);filter:none;opacity:1}}
@keyframes ccr-impact-flash{0%{opacity:1}40%{opacity:.9}100%{opacity:0}}
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
.ccr-modal-menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:8px 0;border-block:1px dashed currentColor}
.ccr-modal-menu .ccr-btn{min-height:40px;width:100%;justify-content:flex-start}
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
/* Scoped to the roam root so the pause-menu toggle (not only the OS flag) owns HUD slam/impact. */
.ccr-root[data-reduced-motion="true"] .ccr-callout,.ccr-root[data-reduced-motion="true"] .ccr-caret,.ccr-root[data-reduced-motion="true"] .ccr-impact{animation:none}
/* Narrow rooms (phones): the dialogue docks below the 3D view as a sheet, so neither it nor the touch controls cover the action. */
@container ccr (max-width: 560px){
.ccr-canvas{bottom:var(--ccr-dock)}
.ccr-top{left:8px;right:8px;top:8px}
.ccr-zone{font-size:12px}
.ccr-btn--sm{font-size:12px;padding:6px 8px;min-height:32px}
.ccr-dock{display:block;position:absolute;left:0;right:0;bottom:0;height:var(--ccr-dock);padding:22px 14px 10px;background:var(--cc-color-surface,${C.neutral100});border-top:3px solid ${C.neutral900};box-shadow:inset 0 2px 0 var(--cc-color-frame,${C.gold500})}
.ccr-dock p{margin:0;font-size:14px;line-height:1.4;color:var(--cc-color-text-muted,${C.neutral700})}
.ccr-dialogue{left:0;right:0;bottom:0;top:auto;transform:none;width:auto;height:var(--ccr-dock);min-height:0;padding:10px 14px 8px;overflow:auto;overscroll-behavior:contain;border-width:3px 0 0;border-left-width:8px;box-shadow:inset 0 2px 0 var(--cc-color-frame,${C.gold500})}
.ccr-dialogue-head{margin:0 0 4px}
.ccr-portrait{width:22px;height:22px}
.ccr-name{position:static;display:inline-block;margin:0;font-size:13px;padding:3px 8px;box-shadow:none}
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
.ccr-callout{top:38%;font-size:clamp(32px,14cqw,72px);padding:10px 18px;border-width:5px}
/* The beat name moves into the dock (and the host's bar); a chip would sit on the action. */
.ccr-beat{display:none}
.ccr-legend{top:96px;right:8px;max-height:calc(100% - var(--ccr-dock) - 104px)}
}
`;

let injected = false;
export function ensureRoamStyles(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!doc) return;
  const existing = doc.getElementById('ccr-styles');
  if (existing) {
    // HMR / hot module reload: refresh so slam/impact CSS actually lands.
    if (existing.textContent !== ROAM_CSS) existing.textContent = ROAM_CSS;
    injected = true;
    return;
  }
  if (injected) return;
  const el = doc.createElement('style');
  el.id = 'ccr-styles';
  el.textContent = ROAM_CSS;
  doc.head.appendChild(el);
  injected = true;
}
