/**
 * FixtureChatClient: a deterministic, offline ChatClient. It reads the prompt it
 * is given and writes valid, in-character JSON that quotes the story text it
 * sees, so tests can prove what each bench saw. Every request is recorded.
 */
import { CounselError } from '@cringe-court/core';
import { estimateMessagesTokens, estimateTokens } from './chat';
import type { ChatClient, ChatRequest, ChatResponse } from './chat';
import { CounselService } from './service';
import { DATA_CLOSE, DATA_OPEN } from './prompts';

export interface FixtureChatOptions {
  /** Throw a retryable CounselError('unavailable') for the first n calls. */
  failFirst?: number;
  /** Return non-JSON for the next n calls after the failures. */
  invalidJsonFirst?: number;
  latencyMs?: number;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (typeof v === 'object' && v !== null ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function snip(text: string, max: number): string {
  const first = text.trim().split(/(?<=[.!?])\s/)[0] ?? text;
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

function readBlocks(req: ChatRequest): { name: string; task: Obj; data: Obj } {
  const system = req.messages.find((m) => m.role === 'system')?.content ?? '';
  const user = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const taskRaw = /<task>([\s\S]*?)<\/task>/.exec(user)?.[1] ?? '{}';
  const start = user.indexOf(DATA_OPEN);
  const end = user.lastIndexOf(DATA_CLOSE);
  const dataRaw = start >= 0 && end > start ? user.slice(start + DATA_OPEN.length, end) : '{}';
  return { name: /^You are ([^,]+),/.exec(system)?.[1] ?? 'Counsel', task: asObj(JSON.parse(taskRaw)), data: asObj(JSON.parse(dataRaw)) };
}

function benchLines(name: string, task: Obj, data: Obj): unknown[] {
  const you = asObj(data.you);
  const opp = asObj(data.opponent);
  const bench = Number(task.bench);
  const segments = (task.segments as string[] | undefined) ?? [];
  const exhibits = (data.exhibits as Obj[] | undefined) ?? [];
  const label = str(you.speakingFor);
  const angle = str(you.angle);
  const lines: unknown[] = [];
  if (segments.includes('opening')) {
    lines.push({
      segment: 'opening',
      beat: bench === 0 ? 'desk-slam' : 'smug',
      text: `${name} for ${label}: "${snip(str(you.story), 80)}" ${angle ? `${snip(angle, 90)} ` : ''}The facts are cooked.`,
    });
  }
  if (segments.includes('exhibit')) {
    exhibits.forEach((x, i) => {
      if (i % 2 !== bench) return;
      lines.push({
        segment: 'exhibit',
        beat: 'present-evidence',
        exhibitId: str(x.id),
        text: `I present "${snip(str(x.title), 50)}": ${snip(str(x.body), 80)}`,
      });
    });
  }
  // Each bench has its own voice, so a fixture trial reads like two lawyers, not one.
  const theirs = snip(str(opp.publicStory), 70);
  if (segments.includes('rebuttal')) {
    lines.push(
      bench === 0
        ? { segment: 'rebuttal', beat: 'objection', text: `${name}: OBJECTION. "Context" is not a defence, it is a cope. The record says it plainly: "${theirs}"` }
        : { segment: 'rebuttal', beat: 'point', text: `${name}: my learned colleague read "${theirs}" and heard a crime. I heard a cry for help, and also a bit.` },
    );
  }
  if (segments.includes('closing')) {
    lines.push(
      bench === 0
        ? { segment: 'closing', beat: 'desk-slam', text: `Members of the jury: the ratio is undeniable. Vote ${label}, and let the record show the cringe.` }
        : { segment: 'closing', beat: 'laugh', text: `Members of the jury: we have all been there. Vote ${label}. Let bro cook.` },
    );
  }
  return lines;
}

export class FixtureChatClient implements ChatClient {
  readonly provider = 'fixture' as const;
  readonly requests: ChatRequest[] = [];
  readonly #options: FixtureChatOptions;
  #calls = 0;

  constructor(options: FixtureChatOptions = {}) {
    this.#options = options;
  }

  async complete(req: ChatRequest): Promise<ChatResponse> {
    this.requests.push(req);
    const n = ++this.#calls;
    if (req.signal?.aborted) throw new CounselError('aborted', 'Aborted');
    if (this.#options.latencyMs) await new Promise((r) => setTimeout(r, this.#options.latencyMs));
    const failFirst = this.#options.failFirst ?? 0;
    if (n <= failFirst) throw new CounselError('unavailable', 'Fixture chat is set to fail', true);
    const content = n <= failFirst + (this.#options.invalidJsonFirst ?? 0) ? 'Sorry, I cannot do JSON today.' : this.#content(req);
    return {
      content,
      requestId: `fixture-${n}`,
      model: 'fixture-chat-v1',
      usage: { inputTokens: estimateMessagesTokens(req.messages), outputTokens: estimateTokens(content) },
    };
  }

  #content(req: ChatRequest): string {
    const { name, task, data } = readBlocks(req);
    if (req.tag === 'angles') {
      const topic = snip(str(data.story), 50).replace(/[.!?…]$/, '');
      return JSON.stringify({
        angles: [`Argue that "${topic}" was a bold strategic pivot.`, 'Blame the vibes, the algorithm, and the group chat, in that order.', 'Concede nothing and apologise to no one.'],
      });
    }
    if (req.tag === 'sentence') {
      const label = str(data.verdictLabel);
      return JSON.stringify({ lines: [{ segment: 'sentence', beat: 'gavel', text: `The jury says ${label}. The court sentences all parties to one (1) hour of touching grass.` }] });
    }
    return JSON.stringify({ lines: benchLines(name, task, data) });
  }
}

/** A CounselService backed by the deterministic fixture client (tests, demos, offline play). */
export function createFixtureCounsel(options: FixtureChatOptions = {}): CounselService {
  return new CounselService({ client: new FixtureChatClient(options), model: 'fixture-chat-v1' });
}
