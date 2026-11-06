/**
 * Scripted trial beats. `beatScript` turns a beat id (+ mode-supplied lines)
 * into a flat list of steps; `BeatRunner` is the state machine that plays
 * them against a host (the controller). Pure: time only moves via `advance`.
 */
import type { AudioCueId } from '@cringe-court/core';
import { BUILTIN_LINES, VERDICT_TEXT } from './dialogue';
import type { BeatId, BeatOptions, BeatStep, DialogueLine, VerdictKind } from './types';

const VERDICT_MOOD = { guilty: 'guilty', 'not-cooked': 'acquitted', 'side-a': 'acquitted', 'side-b': 'acquitted', mistrial: 'mistrial' } as const;
const VERDICT_CUE: Readonly<Record<VerdictKind, AudioCueId>> = {
  guilty: 'stinger.verdict-guilty',
  'not-cooked': 'stinger.verdict-not-cooked',
  'side-a': 'stinger.verdict-side',
  'side-b': 'stinger.verdict-side',
  mistrial: 'stinger.mistrial',
};

function sayAll(lines: readonly DialogueLine[]): BeatStep[] {
  const out: BeatStep[] = [];
  let last = '';
  for (const l of lines) {
    if (l.speaker !== last && l.speaker !== 'player') out.push({ kind: 'look', at: l.speaker, seconds: 0.7 });
    last = l.speaker;
    out.push({ kind: 'say', speaker: l.speaker, text: l.text, pose: 'talk' });
  }
  return out;
}

export function beatScript(id: BeatId, opts: BeatOptions = {}): BeatStep[] {
  const lines = (fallback: readonly DialogueLine[]) => sayAll(opts.lines?.length ? opts.lines : fallback);
  const open: BeatStep[] = [{ kind: 'control', mode: 'cinematic' }, { kind: 'seat', seat: 'defendant' }];
  const close: BeatStep[] = [{ kind: 'control', mode: 'look' }];
  switch (id) {
    case 'all-rise':
      return [
        ...open,
        { kind: 'mood', mood: 'house' },
        { kind: 'stand' },
        { kind: 'cue', cue: 'sfx.crowd-murmur' },
        ...lines(BUILTIN_LINES.allRise.slice(0, 1)),
        { kind: 'look', at: 'judge', seconds: 0.9 },
        { kind: 'gavel' },
        ...lines(BUILTIN_LINES.allRise.slice(1)),
        { kind: 'seat', seat: 'defendant' },
        ...close,
      ];
    case 'opening':
      return [...open, { kind: 'mood', mood: 'spotlight' }, ...lines(BUILTIN_LINES.opening), { kind: 'mood', mood: 'house' }, ...close];
    case 'counsel-arguing': {
      const body = lines(BUILTIN_LINES.arguing);
      // The defence's first line is an objection: punctuate it.
      const i = body.findIndex((s) => s.kind === 'say' && s.speaker === 'defense');
      if (i >= 0 && !opts.lines) body.splice(i, 0, { kind: 'callout', text: 'OBJECTION!', style: 'objection' }, { kind: 'cue', cue: 'stinger.objection' });
      const j = body.findIndex((s) => s.kind === 'say' && s.speaker === 'judge');
      if (j >= 0 && !opts.lines) body.splice(j + 1, 0, { kind: 'gavel' }, { kind: 'callout', text: 'ORDER!', style: 'order' });
      return [...open, { kind: 'mood', mood: 'tense' }, ...body, { kind: 'mood', mood: 'house' }, ...close];
    }
    case 'jury-deliberating':
      return [
        ...open,
        ...lines(BUILTIN_LINES.deliberating.slice(0, 1)),
        { kind: 'callout', text: 'JURY IS OUT', style: 'jury-out' },
        { kind: 'cue', cue: 'stinger.jury-out' },
        { kind: 'mood', mood: 'tense' },
        { kind: 'look', at: 'jury', seconds: 1 },
        { kind: 'pose', npc: 'jury', pose: 'talk' },
        ...lines(BUILTIN_LINES.deliberating.slice(1)),
        { kind: 'cue', cue: 'sfx.crowd-murmur' },
        { kind: 'wait', seconds: 0.8 },
        { kind: 'pose', npc: 'jury', pose: 'sit' },
        ...close,
      ];
    case 'verdict': {
      const verdict = opts.verdict ?? 'guilty';
      const text = VERDICT_TEXT[verdict]!;
      return [
        ...open,
        { kind: 'stand' },
        { kind: 'mood', mood: 'spotlight' },
        { kind: 'look', at: 'judge', seconds: 0.9 },
        { kind: 'say', speaker: 'judge', text: 'The jury has reached a verdict. Defendant, please rise. You are already standing. Good.', pose: 'talk' },
        { kind: 'gavel' },
        { kind: 'mood', mood: VERDICT_MOOD[verdict] },
        { kind: 'callout', text: opts.verdictText ?? text.headline, style: 'verdict' },
        { kind: 'cue', cue: VERDICT_CUE[verdict] },
        { kind: 'say', speaker: 'judge', text: text.judge, pose: 'talk' },
        { kind: 'pose', npc: 'jury', pose: verdict === 'guilty' ? 'shock' : verdict === 'mistrial' ? 'facepalm' : 'cheer' },
        { kind: 'pose', npc: 'gallery', pose: verdict === 'guilty' ? 'shock' : 'cheer' },
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
    else if (s.kind === 'wait') this.#timer = s.seconds;
    else if (s.kind === 'look') this.#timer = s.seconds ?? 0.8;
    else if (s.kind === 'gavel') this.#timer = 0.45;
    else this.#timer = 0;
  }
}
