import {
  AMBIENCE_PRESETS,
  CUES,
  CUE_CATEGORIES,
  CUE_IDS,
  cuesForEvent,
  createAudioEngine,
  sliderToGain,
} from '../src/index.ts';
import type {
  AmbiencePreset,
  AudioSnapshot,
  CaseAudioEvent,
  CueId,
  ReduceSoundPreference,
  VerdictOutcome,
  VolumeChannel,
} from '../src/index.ts';

const errors: string[] = [];
const engine = createAudioEngine({
  onError: (e, ctx) => {
    errors.push(`${ctx}: ${e instanceof Error ? e.message : String(e)}`);
    console.warn(ctx, e);
  },
});

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};
const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v !== undefined) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};

const selftest = new URLSearchParams(location.search).has('selftest');
const announce = $<HTMLDivElement>('#announce');
const say = (msg: string): void => {
  announce.textContent = '';
  window.setTimeout(() => (announce.textContent = msg), 30);
};

// ---------- mixer ----------
const fmtDb = (v: number): string => {
  const g = sliderToGain(v);
  return g === 0 ? '−∞ dB' : `${(20 * Math.log10(g)).toFixed(1).replace('-', '−')} dB`;
};

const sliderDefs: { ch: VolumeChannel; label: string }[] = [
  { ch: 'master', label: 'Master' },
  { ch: 'sfx', label: 'SFX' },
  { ch: 'music', label: 'Ambience' },
];
const sliderEls = new Map<VolumeChannel, { input: HTMLInputElement; out: HTMLElement }>();
for (const { ch, label } of sliderDefs) {
  const input = h('input', { type: 'range', min: '0', max: '1', step: '0.01', id: `vol-${ch}` });
  const out = h('output', { for: `vol-${ch}`, class: 'vol-out' });
  input.addEventListener('input', () => engine.setVolume(ch, Number(input.value)));
  input.addEventListener('change', () => {
    if (ch === 'sfx') engine.play('ui_confirm', { intensity: 0.6 });
  });
  sliderEls.set(ch, { input, out });
  $('#sliders').append(h('div', { class: 'slider-row' }, h('label', { for: `vol-${ch}` }, label), input, out));
}

function segmented<T extends string>(
  host: HTMLElement,
  name: string,
  options: readonly { value: T; label: string }[],
  onPick: (v: T) => void,
): (v: T) => void {
  const inputs = new Map<T, HTMLInputElement>();
  for (const o of options) {
    const input = h('input', { type: 'radio', name, value: o.value });
    input.addEventListener('change', () => input.checked && onPick(o.value));
    inputs.set(o.value, input);
    host.append(h('label', { class: 'seg-opt' }, input, h('span', {}, o.label)));
  }
  return (v) => {
    const i = inputs.get(v);
    if (i) i.checked = true;
  };
}

const setReduceUi = segmented<ReduceSoundPreference>(
  $('#reduce-seg'),
  'reduce',
  [
    { value: 'system', label: 'Follow device' },
    { value: 'reduced', label: 'Reduced' },
    { value: 'full', label: 'Full' },
  ],
  (v) => engine.setReduceSound(v),
);
const setAmbUi = segmented<AmbiencePreset>(
  $('#amb-seg'),
  'amb',
  AMBIENCE_PRESETS.map((p) => ({ value: p, label: p })),
  (v) => engine.setAmbience(v),
);

// ---------- cue board ----------
const COLORS: Record<string, string> = {
  gavel: '#F6C75B',
  drama: '#CE4A44',
  crowd: '#2E5F73',
  verdict: '#A32D3F',
  jury: '#3F8FA8',
  timer: '#E07A3F',
  foley: '#DCC8B0',
  ui: '#A9917D',
};
const pads = new Map<CueId, HTMLButtonElement>();
const padOrder: CueId[] = [];
let voteStep = 0;
let toggleStep = 1;
const padTimers = new Map<CueId, number>();

function reasonFor(cue: CueId): string {
  const snap = engine.getSnapshot();
  if (snap.state !== 'running') return 'locked';
  if (snap.settings.muted) return 'muted';
  if (sliderToGain(snap.settings.master) === 0 || sliderToGain(snap.settings.sfx) === 0) return 'volume at zero';
  if (snap.reduced && CUES[cue].reduced === 'skip') return 'reduced';
  return 'too soon';
}

function stepFor(cue: CueId): number | undefined {
  if (cue === 'vote_tick') return voteStep;
  if (cue === 'ui_toggle') return toggleStep;
  return undefined;
}

function updateStepTag(cue: CueId): void {
  const tag = pads.get(cue)?.querySelector('.step');
  if (!tag) return;
  tag.textContent = `step ${stepFor(cue)}`;
}

function triggerPad(cue: CueId): boolean {
  const pad = pads.get(cue);
  const step = stepFor(cue);
  const handle = engine.play(cue, step === undefined ? {} : { step });
  if (cue === 'vote_tick') voteStep = (voteStep + 1) % 8;
  if (cue === 'ui_toggle') toggleStep = toggleStep === 1 ? 0 : 1;
  updateStepTag(cue);
  if (!pad) return handle !== null;
  const note = pad.querySelector('.note');
  window.clearTimeout(padTimers.get(cue));
  pad.classList.remove('playing', 'rejected');
  void pad.offsetWidth;
  if (handle) {
    pad.classList.add('playing');
    if (note) note.textContent = '';
    padTimers.set(cue, window.setTimeout(() => pad.classList.remove('playing'), CUES[cue].duration * 1000));
  } else {
    const why = reasonFor(cue);
    pad.classList.add('rejected');
    if (note) note.textContent = why;
    say(`${CUES[cue].label} did not play: ${why}`);
    padTimers.set(cue, window.setTimeout(() => {
      pad.classList.remove('rejected');
      if (note) note.textContent = '';
    }, 1600));
  }
  return handle !== null;
}

const board = $('#board');
for (const cat of CUE_CATEGORIES) {
  const ids = CUE_IDS.filter((id) => CUES[id].category === cat.id);
  if (!ids.length) continue;
  const grid = h('div', { class: 'pads' });
  for (const id of ids) {
    const spec = CUES[id];
    const index = padOrder.length;
    padOrder.push(id);
    const meta = h('span', { class: 'pad-meta' }, h('code', { class: 'cue-id' }, id));
    if (id === 'vote_tick' || id === 'ui_toggle') meta.append(h('span', { class: 'tag step' }, `step ${stepFor(id)}`));
    if (spec.reduced === 'skip') meta.append(h('span', { class: 'tag skip' }, 'skipped when reduced'));
    const pad = h(
      'button',
      { class: 'pad', type: 'button', 'data-cue': id, title: spec.description, ...(index < 9 ? { 'aria-keyshortcuts': String(index + 1) } : {}) },
      h('span', { class: 'pad-top' }, h('span', { class: 'pad-label' }, spec.label), index < 9 ? h('kbd', {}, String(index + 1)) : ''),
      h('span', { class: 'pad-desc' }, spec.description),
      meta,
      h('span', { class: 'note', 'aria-hidden': 'true' }),
      h('span', { class: 'bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
    );
    pad.addEventListener('click', () => triggerPad(id));
    pads.set(id, pad);
    grid.append(pad);
  }
  board.append(
    h(
      'section',
      { class: 'cat', style: `--cat:${COLORS[cat.id] ?? '#A9917D'}`, 'aria-labelledby': `cat-${cat.id}` },
      h('h3', { id: `cat-${cat.id}`, class: 'pixel cat-title' }, cat.label),
      grid,
    ),
  );
}

// ---------- trial ----------
interface Step {
  gap: number; // seconds after previous step
  event: CaseAudioEvent;
}
function buildTrial(outcome: VerdictOutcome): Step[] {
  const s: Step[] = [];
  const add = (gap: number, event: CaseAudioEvent): void => void s.push({ gap, event });
  add(0, { type: 'phase.entered', phase: 'pre-trial' });
  add(1.2, { type: 'court.entered' });
  add(1.4, { type: 'case.stamped' });
  add(1.4, { type: 'hearing.opened' });
  add(1.6, { type: 'statement.started', by: 'prosecution' });
  add(1.6, { type: 'crowd', reaction: 'laugh' });
  add(1.6, { type: 'statement.started', by: 'defense' });
  add(1.6, { type: 'objection', by: 'prosecution' });
  add(1.6, { type: 'order' });
  add(1.6, { type: 'phase.entered', phase: 'recruiting' });
  add(1.0, { type: 'juror.seated', index: 0 });
  add(0.8, { type: 'juror.seated', index: 1 });
  add(0.8, { type: 'juror.seated', index: 2 });
  add(1.0, { type: 'bond.posted' });
  add(1.0, { type: 'phase.entered', phase: 'commit' });
  add(1.0, { type: 'ballot.committed' });
  for (let sec = 12; sec >= 0; sec--) add(sec === 12 ? 0.8 : 0.35, { type: 'deadline.tick', secondsLeft: sec });
  add(1.0, { type: 'phase.entered', phase: 'reveal' });
  add(1.0, { type: 'ballot.revealed' });
  for (let i = 0; i < 3; i++) add(i === 0 ? 1.0 : 0.7, { type: 'vote.counted', index: i });
  add(1.0, { type: 'phase.entered', phase: 'finalizing' });
  add(1.2, { type: 'verdict.read', outcome });
  add(3.0, { type: 'settlement', kind: 'payout' });
  return s;
}

const label = (e: CaseAudioEvent): string => {
  const { type, ...rest } = e;
  const body = Object.entries(rest).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
  return body ? `${type} { ${body} }` : type;
};

const logEl = $<HTMLOListElement>('#trial-log');
const runBtn = $<HTMLButtonElement>('#trial-run');
const stopBtn = $<HTMLButtonElement>('#trial-stop');
const statusEl = $('#trial-status');
const verdictSel = $<HTMLSelectElement>('#verdict-sel');
let trialTimer: number | undefined;
let trialSteps: Step[] = [];
let rows: HTMLLIElement[] = [];

function renderLog(): void {
  logEl.replaceChildren();
  rows = trialSteps.map((st, i) => {
    const cues = cuesForEvent(st.event).cues.map((c) => c.cue);
    const li = h(
      'li',
      { class: 'log-row' },
      h('span', { class: 'log-n' }, String(i + 1).padStart(2, '0')),
      h('code', { class: 'log-ev' }, label(st.event)),
      h('span', { class: 'log-cues' }, ...(cues.length ? cues.map((c) => h('code', { class: 'chip' }, c)) : [h('span', { class: 'none' }, 'no cue')])),
    );
    logEl.append(li);
    return li;
  });
}

function endTrial(msg: string): void {
  window.clearTimeout(trialTimer);
  trialTimer = undefined;
  runBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = msg;
  rows.forEach((r) => r.removeAttribute('aria-current'));
}

function stepTrial(i: number): void {
  const st = trialSteps[i];
  if (!st) {
    endTrial('Trial finished.');
    return;
  }
  rows.forEach((r, j) => {
    r.classList.toggle('done', j < i);
    if (j === i) r.setAttribute('aria-current', 'step');
    else r.removeAttribute('aria-current');
  });
  rows[i]?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  engine.handle(st.event);
  statusEl.textContent = `Step ${i + 1} of ${trialSteps.length}: ${label(st.event)}`;
  const next = trialSteps[i + 1];
  trialTimer = window.setTimeout(() => stepTrial(i + 1), next ? next.gap * 1000 : 1200);
  if (!next) rows.forEach((r, j) => r.classList.toggle('done', j <= i));
}

runBtn.addEventListener('click', () => {
  trialSteps = buildTrial(verdictSel.value as VerdictOutcome);
  renderLog();
  runBtn.disabled = true;
  stopBtn.disabled = false;
  void engine.unlock().then(() => stepTrial(0));
});
stopBtn.addEventListener('click', () => {
  engine.stopAll();
  endTrial('Stopped.');
});
verdictSel.addEventListener('change', () => {
  if (trialTimer === undefined) {
    trialSteps = buildTrial(verdictSel.value as VerdictOutcome);
    renderLog();
  }
});
trialSteps = buildTrial('guilty');
renderLog();

// ---------- header / state ----------
const badge = $('#state-badge');
const muteBtn = $<HTMLButtonElement>('#mute-btn');
function render(s: AudioSnapshot): void {
  badge.textContent = s.state;
  badge.dataset.state = s.state;
  muteBtn.setAttribute('aria-pressed', String(s.settings.muted));
  $('#mute-label').textContent = s.settings.muted ? 'Unmute' : 'Mute';
  for (const { ch } of sliderDefs) {
    const e = sliderEls.get(ch);
    if (!e) continue;
    const v = s.settings[ch];
    if (document.activeElement !== e.input || Number(e.input.value) !== v) e.input.value = String(v);
    e.input.style.setProperty('--fill', `${v * 100}%`);
    const text = `${Math.round(v * 100)}% · ${fmtDb(v)}`;
    e.out.textContent = text;
    e.input.setAttribute('aria-valuetext', text);
  }
  setReduceUi(s.settings.reduceSound);
  setAmbUi(s.ambience);
  $('#reduce-effective').textContent = s.reduced ? 'Right now: sound is reduced.' : 'Right now: full sound.';
  document.body.classList.toggle('is-reduced', s.reduced);
}
engine.subscribe(() => render(engine.getSnapshot()));
render(engine.getSnapshot());
muteBtn.addEventListener('click', () => engine.toggleMuted());

// ---------- gate ----------
const gate = $('#gate');
const gateMsg = $('#gate-msg');
const gateBtn = $<HTMLButtonElement>('#gate-btn');
function closeGate(): void {
  gate.hidden = true;
  document.body.classList.remove('gated');
}
function showUnavailable(): void {
  gateMsg.hidden = false;
  gateMsg.textContent = 'Web Audio is not available in this browser, so the page cannot make sound. You can still browse the board.';
  gateBtn.textContent = 'Continue without sound';
}
gateBtn.addEventListener('click', () => {
  if (engine.getSnapshot().state === 'unavailable') {
    closeGate();
    return;
  }
  void engine.unlock().then((ok) => {
    if (!ok && engine.getSnapshot().state === 'unavailable') {
      showUnavailable();
      return;
    }
    closeGate();
    engine.play('door_creak');
    engine.setAmbience('lobby');
  });
});
if (engine.getSnapshot().state === 'unavailable') showUnavailable();
else {
  document.body.classList.add('gated');
  window.setTimeout(() => gateBtn.focus(), 0);
}

// ---------- keys & hover ----------
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text'))) return;
  if (!gate.hidden) return;
  if (e.key === 'm' || e.key === 'M') {
    engine.toggleMuted();
  } else if (/^[1-9]$/.test(e.key)) {
    const id = padOrder[Number(e.key) - 1];
    if (id) triggerPad(id);
  }
});
document.addEventListener(
  'pointerenter',
  (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    const t = e.target;
    if (t instanceof HTMLElement && t.matches('.pad, .btn') && !(t as HTMLButtonElement).disabled && !selftest) engine.play('ui_hover');
  },
  true,
);

// ---------- selftest ----------
if (selftest) {
  gate.hidden = true;
  document.body.classList.remove('gated');
  const results: { cue: CueId; played: boolean }[] = [];
  void (async () => {
    await engine.unlock();
    engine.setReduceSound('full');
    for (const cue of CUE_IDS) {
      results.push({ cue, played: engine.play(cue) !== null });
      await new Promise((r) => setTimeout(r, 250));
    }
    (window as unknown as { __selftest: unknown }).__selftest = { state: engine.getSnapshot().state, results, errors };
    document.body.dataset.selftest = 'done';
  })();
}
