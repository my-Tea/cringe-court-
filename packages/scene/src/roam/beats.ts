/**
 * Scripted trial beats. `beatScript` turns a beat id (+ mode-supplied lines)
 * into a flat list of steps; `BeatRunner` is the state machine that plays
 * them against a host (the controller). Pure: time only moves via `advance`.
 */
import type { AudioCueId } from '@cringe-court/core';
import { BUILTIN_LINES, VERDICT_TEXT } from './dialogue';
import { DEFAULT_PACE, HEARING_PACE, highlightLines, linesKept, stepSeconds, type PaceSpec } from './pace';
import type { BeatId, BeatOptions, BeatStep, DialogueLine, NpcPose, VerdictKind } from './types';

const VERDICT_MOOD = { guilty: 'guilty', 'not-cooked': 'acquitted', 'side-a': 'acquitted', 'side-b': 'acquitted', mistrial: 'mistrial' } as const;
const VERDICT_CUE: Readonly<Record<VerdictKind, AudioCueId>> = {
  guilty: 'stinger.verdict-guilty',
  'not-cooked': 'stinger.verdict-not-cooked',
  'side-a': 'stinger.verdict-side',
  'side-b': 'stinger.verdict-side',
  mistrial: 'stinger.mistrial',
};

/** Signature poses from line text + optional court-ai `beat` tag. */
export function poseForLine(speaker: string, text: string, beat?: string): NpcPose {
  const tag = (beat ?? '').toLowerCase();
  // Live transcripts often set beat:"objection" without saying the word (GJ fixtures, AI).
  if (tag === 'objection' || /\bobjection\b/i.test(text)) return 'objection';
  if (tag === 'gavel' || (/\border\b/i.test(text) && speaker === 'judge')) return 'gavel';
  if (tag === 'counter' || tag === 'desk-slam' || /\bcounter\b/i.test(text)) return 'point';
  if (tag === 'smug' || /let (?:bro|him|her|them) cook/i.test(text)) return 'smug';
  if (tag === 'point') return 'point';
  if (tag === 'explain') return 'explain';
  if (/\boverruled\b|\bsustained\b/i.test(text) && speaker === 'judge') return 'point';
  if (/\bexhibit\b/i.test(text)) return speaker === 'judge' ? 'talk' : 'explain';
  if (/\byour honour\b|\byour honor\b/i.test(text) && (speaker === 'prosecutor' || speaker === 'defense')) return 'lean';
  if (speaker === 'prosecutor' && /\bprove\b|\bevidence\b|\bposted\b|\bfourteen\b/i.test(text)) return 'point';
  if (speaker === 'defense' && /\bcook(?:ing)?\b|\bcontext\b|\bloophole\b|\bmeme\b/i.test(text)) return 'explain';
  if (speaker === 'judge') return 'talk';
  if (speaker === 'clerk') return 'explain';
  return 'talk';
}

function otherCounsel(speaker: string): 'prosecutor' | 'defense' | null {
  if (speaker === 'prosecutor') return 'defense';
  if (speaker === 'defense') return 'prosecutor';
  return null;
}

/**
 * Cast reactions around a dramatic beat — opposing counsel, gallery, clerk,
 * and a light judge tell — so objections feel like a room event, not a solo.
 */
export function reactionSteps(speaker: string, pose: NpcPose): BeatStep[] {
  const other = otherCounsel(speaker);
  const out: BeatStep[] = [];
  if (pose === 'objection') {
    if (other) out.push({ kind: 'pose', npc: other, pose: 'shock' });
    out.push({ kind: 'pose', npc: 'judge', pose: 'thinking' });
    out.push({ kind: 'pose', npc: 'clerk', pose: 'shock' });
    out.push({ kind: 'pose', npc: 'gallery', pose: 'shock' });
    return out;
  }
  if (pose === 'point' && (speaker === 'prosecutor' || speaker === 'defense')) {
    if (other) out.push({ kind: 'pose', npc: other, pose: 'cross_arms' });
    out.push({ kind: 'pose', npc: 'clerk', pose: 'thinking' });
    return out;
  }
  if (pose === 'smug') {
    if (other) out.push({ kind: 'pose', npc: other, pose: 'facepalm' });
    out.push({ kind: 'pose', npc: 'gallery', pose: 'cheer' });
    return out;
  }
  if (pose === 'gavel') {
    out.push({ kind: 'pose', npc: 'prosecutor', pose: 'cross_arms' });
    out.push({ kind: 'pose', npc: 'defense', pose: 'cross_arms' });
    out.push({ kind: 'pose', npc: 'gallery', pose: 'shock' });
    out.push({ kind: 'pose', npc: 'clerk', pose: 'thinking' });
    return out;
  }
  if (pose === 'explain' && other) {
    out.push({ kind: 'pose', npc: other, pose: 'thinking' });
  }
  return out;
}

/** Staging + dialogue for one line (callouts, cues, reactions, then say). */
export function stageLine(speaker: string, text: string, beat?: string): BeatStep[] {
  const pose = poseForLine(speaker, text, beat);
  const tag = (beat ?? '').toLowerCase();
  const out: BeatStep[] = [];
  if (pose === 'objection') {
    out.push(
      { kind: 'pose', npc: speaker, pose: 'objection' },
      { kind: 'callout', text: 'OBJECTION!', style: 'objection' },
      { kind: 'cue', cue: 'stinger.objection' },
      { kind: 'cue', cue: 'sfx.crowd-gasp' },
      ...reactionSteps(speaker, 'objection'),
      { kind: 'wait', seconds: 0.55 },
    );
  } else if (tag === 'counter' || /\bcounter\b/i.test(text) || (pose === 'point' && speaker === 'prosecutor' && /\banyway|evidence|calls it\b/i.test(text))) {
    out.push(
      { kind: 'pose', npc: speaker, pose: 'point' },
      { kind: 'callout', text: 'COUNTER!', style: 'counter' },
      { kind: 'cue', cue: 'sfx.crowd-murmur' },
      ...reactionSteps(speaker, 'point'),
      { kind: 'wait', seconds: 0.4 },
    );
  } else if (pose === 'smug' && (tag === 'smug' || /let (?:bro|him|her|them) cook/i.test(text))) {
    out.push({ kind: 'callout', text: 'LET BRO COOK', style: 'let-bro-cook' }, ...reactionSteps(speaker, 'smug'), { kind: 'wait', seconds: 0.4 });
  } else if (pose === 'gavel') {
    // Judge gavel / ORDER on live transcripts (not only builtin walk lines).
    out.push(
      { kind: 'gavel' },
      { kind: 'callout', text: 'ORDER!', style: 'order' },
      { kind: 'cue', cue: 'sfx.crowd-murmur' },
      ...reactionSteps(speaker, 'gavel'),
      { kind: 'wait', seconds: 0.45 },
    );
  } else if (pose === 'point' || pose === 'explain' || pose === 'smug') {
    out.push(...reactionSteps(speaker, pose));
  }
  out.push({ kind: 'say', speaker, text, pose });
  return out;
}

function sayAll(lines: readonly DialogueLine[]): BeatStep[] {
  const out: BeatStep[] = [];
  let last = '';
  for (const l of lines) {
    if (l.speaker !== last && l.speaker !== 'player') out.push({ kind: 'look', at: l.speaker, seconds: 0.7 });
    last = l.speaker;
    out.push(...stageLine(l.speaker, l.text, l.beat));
  }
  return out;
}

/** The judge's verdict opener: parties are asked to rise (and already are); jurors and the gallery are not. */
export const VERDICT_OPENER = {
  party: 'The jury has reached a verdict. Defendant, please rise. You are already standing. Good.',
  others: 'The jury has reached a verdict. Will the parties please rise.',
} as const;

export function beatScript(id: BeatId, opts: BeatOptions = {}): BeatStep[] {
  const pace = HEARING_PACE[opts.pace ?? DEFAULT_PACE];
  const seat = opts.seat ?? 'defendant';
  const party = opts.party ?? true;
  const custom = opts.lines?.length ? opts.lines : null;
  // Mode lines replace the built-in ones once (never twice), trimmed for highlights.
  const said = custom ? (pace.linesPerBeat === null ? custom : highlightLines(custom, linesKept(custom.length, pace))) : null;
  const open: BeatStep[] = [{ kind: 'control', mode: 'cinematic' }, { kind: 'seat', seat }];
  const close: BeatStep[] = [{ kind: 'control', mode: 'look' }];
  switch (id) {
    case 'all-rise': {
      const [first, ...rest] = said ?? BUILTIN_LINES.allRise;
      return [
        ...open,
        { kind: 'mood', mood: 'house' },
        { kind: 'stand' },
        { kind: 'cue', cue: 'sfx.crowd-murmur' },
        ...(first ? sayAll([first]) : []),
        { kind: 'look', at: 'judge', seconds: 0.9 },
        { kind: 'gavel' },
        { kind: 'pose', npc: 'gallery', pose: 'shock' },
        ...sayAll(rest),
        { kind: 'seat', seat },
        ...close,
      ];
    }
    case 'opening':
      return [...open, { kind: 'mood', mood: 'spotlight' }, ...sayAll(said ?? BUILTIN_LINES.opening), { kind: 'mood', mood: 'house' }, ...close];
    case 'counsel-arguing': {
      // stageLine inserts OBJECTION / ORDER / COUNTER from text and from `beat` tags.
      const body = sayAll(said ?? BUILTIN_LINES.arguing);
      return [...open, { kind: 'mood', mood: 'tense' }, ...body, { kind: 'mood', mood: 'house' }, ...close];
    }
    case 'jury-deliberating': {
      const [first, ...rest] = said ?? BUILTIN_LINES.deliberating;
      return [
        ...open,
        ...(first ? sayAll([first]) : []),
        { kind: 'callout', text: 'JURY IS OUT', style: 'jury-out' },
        { kind: 'cue', cue: 'stinger.jury-out' },
        { kind: 'cue', cue: 'sfx.crowd-gasp' },
        { kind: 'wait', seconds: 0.55 },
        { kind: 'mood', mood: 'tense' },
        { kind: 'look', at: 'jury', seconds: 1 },
        { kind: 'pose', npc: 'jury', pose: 'talk' },
        { kind: 'pose', npc: 'prosecutor', pose: 'cross_arms' },
        { kind: 'pose', npc: 'defense', pose: 'thinking' },
        ...sayAll(rest),
        { kind: 'cue', cue: 'sfx.crowd-murmur' },
        { kind: 'wait', seconds: 0.8 },
        { kind: 'pose', npc: 'jury', pose: 'sit' },
        ...close,
      ];
    }
    case 'verdict': {
      const verdict = opts.verdict ?? 'guilty';
      const text = VERDICT_TEXT[verdict]!;
      const counselReact: NpcPose = verdict === 'guilty' ? 'defeat' : verdict === 'mistrial' ? 'facepalm' : 'victory';
      const otherReact: NpcPose = verdict === 'guilty' ? 'smug' : verdict === 'mistrial' ? 'facepalm' : 'defeat';
      return [
        ...open,
        ...(party ? [{ kind: 'stand' } as const] : []),
        { kind: 'mood', mood: 'spotlight' },
        { kind: 'look', at: 'judge', seconds: 0.9 },
        { kind: 'say', speaker: 'judge', text: party ? VERDICT_OPENER.party : VERDICT_OPENER.others, pose: 'talk' },
        { kind: 'gavel' },
        { kind: 'mood', mood: VERDICT_MOOD[verdict] },
        { kind: 'callout', text: opts.verdictText ?? text.headline, style: 'verdict' },
        { kind: 'cue', cue: VERDICT_CUE[verdict] },
        { kind: 'say', speaker: 'judge', text: text.judge, pose: 'talk' },
        { kind: 'pose', npc: 'jury', pose: verdict === 'guilty' ? 'shock' : verdict === 'mistrial' ? 'facepalm' : 'cheer' },
        { kind: 'pose', npc: 'gallery', pose: verdict === 'guilty' ? 'shock' : 'cheer' },
        { kind: 'pose', npc: 'defense', pose: counselReact },
        { kind: 'pose', npc: 'prosecutor', pose: otherReact },
        { kind: 'pose', npc: 'clerk', pose: 'thinking' },
        { kind: 'cue', cue: verdict === 'guilty' ? 'sfx.crowd-gasp' : 'music.verdict' },
        // Free look while seated-standing: turn around and watch the jury react.
        { kind: 'control', mode: 'look' },
      ];
    }
  }
}

/** What the runner needs from its host. */
export interface BeatHost {
  apply(step: BeatStep): void;
  /** True while a dialogue line is still being shown (typewriter + hold). */
  dialogueBusy(): boolean;
  /** Skip/fast-forward: drop the line on screen. */
  clearDialogue(): void;
  /** Current pace (timed steps scale with it). Optional: full pace when absent. */
  paceSpec?(): PaceSpec;
}

export type BeatRunnerState = 'idle' | 'running' | 'done' | 'skipped';

export class BeatRunner {
  state: BeatRunnerState = 'idle';
  index = 0;
  #timer = 0;
  #waitingLine = false;

  constructor(
    readonly id: BeatId,
    readonly steps: readonly BeatStep[],
    readonly host: BeatHost,
  ) {}

  get finished(): boolean {
    return this.state === 'done' || this.state === 'skipped';
  }

  start(): void {
    if (this.state !== 'idle') return;
    this.state = 'running';
    this.#enter();
    // Apply the leading instant steps now (seat, camera lock) so callers see them synchronously.
    this.advance(0);
  }

  /** Move time forward; returns true once finished. */
  advance(dt: number): boolean {
    if (this.state !== 'running') return this.finished;
    let budget = dt;
    // Several instant steps can run in one frame; waits consume the budget.
    for (let guard = 0; guard < 256 && this.state === 'running'; guard++) {
      if (this.#waitingLine) {
        if (this.host.dialogueBusy()) return false;
        this.#waitingLine = false;
        this.#next();
        continue;
      }
      if (this.#timer > 0) {
        const used = Math.min(this.#timer, budget);
        this.#timer -= used;
        budget -= used;
        if (this.#timer > 1e-9) return false;
        this.#next();
        continue;
      }
      this.#next();
    }
    return this.finished;
  }

  /** Jump to the end: apply every remaining non-timed step so the world lands in the beat's final state. */
  skip(): void {
    if (this.finished) return;
    if (this.state === 'idle') this.state = 'running';
    this.host.clearDialogue();
    for (let i = this.index + 1; i < this.steps.length; i++) {
      const s = this.steps[i]!;
      if (s.kind === 'say' || s.kind === 'wait' || s.kind === 'look' || s.kind === 'cue' || s.kind === 'gavel' || s.kind === 'callout') continue;
      this.host.apply(s);
    }
    this.index = this.steps.length;
    this.state = 'skipped';
  }

  #next(): void {
    this.index++;
    if (this.index >= this.steps.length) {
      this.state = 'done';
      return;
    }
    this.#enter();
  }

  #enter(): void {
    const s = this.steps[this.index];
    if (!s) {
      this.state = 'done';
      return;
    }
    this.host.apply(s);
    if (s.kind === 'say') this.#waitingLine = true;
    else this.#timer = stepSeconds(s, this.host.paceSpec?.() ?? HEARING_PACE.full);
  }
}
