/**
 * MockInferenceClient: offline stand-in for local development and tests.
 *
 * It is NOT evidence of a 0G call: provider is "mock", trust mode "none", and
 * `requestId` is always null. The default responder reads only what a real
 * model would see (the <case_data> block and the TRIAL PLAN in the prompt) and
 * writes a valid, fact-grounded, template-based script, so the whole pipeline
 * (prompt -> parse -> validate -> stage) runs for free. Its jokes are templates;
 * judge trial quality on real 0G output (docs/ai/11).
 */
import { keccak256 } from '@cringe-court/core';
import type { InferenceClient, InferenceRequest, InferenceResult } from './inference';
import { contentWords, tokens } from './checks';

export type MockResponder = (request: InferenceRequest) => string | Promise<string>;

export interface MockOptions {
  /** Custom responder (tests). Default: the case-aware template writer. */
  responder?: MockResponder;
  /** Fixed responses consumed in order (tests); falls back to the responder when exhausted. */
  responses?: readonly string[];
}

export class MockInferenceClient implements InferenceClient {
  readonly provider = 'mock' as const;
  readonly model = 'mock-court-writer@1';
  readonly trustMode = 'none' as const;
  readonly calls: InferenceRequest[] = [];
  readonly #responder: MockResponder;
  readonly #queue: string[];

  constructor(options: MockOptions = {}) {
    this.#responder = options.responder ?? mockCourtResponder;
    this.#queue = [...(options.responses ?? [])];
  }

  async complete(request: InferenceRequest): Promise<InferenceResult> {
    this.calls.push(request);
    const content = this.#queue.length > 0 ? (this.#queue.shift() as string) : await this.#responder(request);
    return {
      content,
      provider: 'mock',
      model: this.model,
      requestId: null,
      trustMode: 'none',
      responseMeta: { mock: 'true' },
      latencyMs: 0,
      attempts: 1,
    };
  }
}

/* ── Default responder ───────────────────────────────────────────────────── */

interface Fact {
  id: string;
  status: string;
  text: string;
}

interface Slot {
  id: string;
  speaker: string;
  side: 'A' | 'B' | null;
  segment: string;
  min: number;
  max: number;
  answers: string | null;
}

function block(text: string, tag: string): unknown {
  const m = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`).exec(text);
  return m?.[1] ? JSON.parse(m[1]) : null;
}

function slotsFrom(text: string): Slot[] {
  const re = /^(L\d{2}) (prosecutor|defense|judge|clerk)(?: for Side ([AB]))? \(([\w-]+), (\d+)-(\d+) characters(?:, answers (L\d{2}))?\):/gm;
  return [...text.matchAll(re)].map((m) => ({
    id: m[1] as string,
    speaker: m[2] as string,
    side: (m[3] as 'A' | 'B' | undefined) ?? null,
    segment: m[4] as string,
    min: Number(m[5]),
    max: Number(m[6]),
    answers: m[7] ?? null,
  }));
}

const FUNCTION_WORDS = new Set('a an the and or but of to in on at by for with from as is are was were be it its this that my your his her their our i me he she they we so because him them no not'.split(' '));

/** First n words of a fact, ending on a content word: always a verbatim substring of the case. */
function frag(text: string, n: number): string {
  const words = text.split(/\s+/).slice(0, n);
  while (words.length > 3 && FUNCTION_WORDS.has((words.at(-1) ?? '').toLowerCase().replace(/[^a-z]/g, ''))) words.pop();
  return words.join(' ').replace(/[.,;:!?]+$/, '');
}

/** Lower-case a leading function word only ("My roommate" -> "my roommate"); names keep their capital. */
const lc = (s: string): string => {
  const first = s.split(/\s+/)[0] ?? '';
  return first !== 'I' && FUNCTION_WORDS.has(first.toLowerCase()) ? (s[0]?.toLowerCase() ?? '') + s.slice(1) : s;
};

const ADJECTIVE = /(ive|ous|ful|able|ible|al|y|ed|ing|ly)$|^(little|big|new|old|good|bad|full|whole|own|cheap|fancy)$/;

/** A noun-ish keyword: the head of the first noun phrase ("my expensive shampoo" -> shampoo), else the longest content word. */
function keyword(text: string, avoid: readonly string[] = []): string {
  const words = text.toLowerCase().replace(/[^a-z0-9' -]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    if (!/^(a|an|the|my|his|her|its|their|our|your|no)$/.test(words[i] ?? '')) continue;
    for (const w of words.slice(i + 1, i + 4)) {
      if (FUNCTION_WORDS.has(w) || w.length < 3) break;
      if (!ADJECTIVE.test(w) && !avoid.includes(w) && !w.includes("'")) return w;
    }
  }
  const pool = contentWords(text).filter((w) => !avoid.includes(w) && !/^\d/.test(w) && !w.includes("'") && !ADJECTIVE.test(w));
  return pool.sort((a, b) => b.length - a.length || a.localeCompare(b))[0] ?? 'decision';
}

function fit(text: string, min: number, max: number, pad: string): string {
  let out = text.replace(/\s+/g, ' ').trim();
  if (out.length < min) out = `${out} ${pad}`.trim();
  if (out.length > max) {
    const cut = out.slice(0, max);
    const sentence = cut.lastIndexOf('. ');
    out = sentence > min ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}.`;
  }
  return out;
}

/** First 6-10 words of a line, used as the "answers" quote. */
const quoteOf = (line: string) => tokens(line).length > 0 ? line.split(/\s+/).slice(0, 8).join(' ').replace(/[.,;:!?"]+$/, '') : line;

type Lines = Record<string, string>;

function soloLines(title: string, facts: readonly Fact[], defendant: string): Lines {
  const f1 = facts[0]?.text ?? title;
  const f2 = facts[1]?.text ?? f1;
  const key = keyword(f1);
  const key2 = keyword(`${f2} ${title}`, [key]);
  return {
    L01: `Next on the docket: "${title}". ${defendant[0]?.toUpperCase()}${defendant.slice(1)} confesses to it in writing. The clerk has filed stranger things, but not many.`,
    L02: `The record will show the defendant's own words: "${frag(f1, 9)}". Your Honor, that is not a decision. That is a ${key} in a trench coat, and the prosecution intends to unbutton it.`,
    L03: `My learned colleague sees a ${key} in a trench coat. I see instinct. Every bold choice looks silly from the outside, and my client chose bold over boring with the ${key2} in plain view.`,
    L04: `Instinct? The defense just admitted there was no plan, only instinct. If instinct is the method, then ${lc(frag(f2, 12))} is the result, and that is the whole case.`,
    L05: `Miss Ratio says there was no plan. There was: optimism, the most underrated plan in this courtroom. My client looked at the ${key2} and saw potential where others saw a punchline.`,
    L06: `The court has now heard the word "${key}" more times than it would like. Counsel, wrap this up before the court starts to understand it.`,
    L07: `Members of the jury, remember the trench coat. Take it off and you find "${frag(f1, 7)}". Optimism is not a plan. Find this decision GUILTY.`,
    L08: `Remember the optimism instead. My client trusted a ${key} and then confessed it in public, which takes more courage than most plans. Find my client NOT COOKED.`,
  };
}

function versusLines(title: string, facts: readonly Fact[], a: string, b: string): Lines {
  const fa = facts.find((f) => f.status === 'claimed-by-a')?.text ?? title;
  const fb = facts.find((f) => f.status === 'claimed-by-b')?.text ?? title;
  const agreed = facts.find((f) => f.status === 'agreed')?.text;
  const keyA = keyword(fa);
  const keyB = keyword(fb, [keyA]);
  return {
    L01: `The court calls "${title}": ${a} versus ${b}. One situation, two versions of events, and a clerk who has picked no side.`,
    L02: `${a} says: "${frag(fa, 9)}". ${agreed ? `Both sides agree that ${lc(frag(agreed, 10))}. ` : ''}My client asks for one thing: that the ${keyA} still means what it meant yesterday.`,
    L03: `${b} tells it differently: "${frag(fb, 9)}". Context is not an excuse, it is the whole story, and my client's story has ${keyB} in it.`,
    L04: `Side A says the ${keyA} still means what it meant yesterday. Did anyone write that rule down? ${b} cannot break a rule nobody announced.`,
    L05: `Side B says context is the whole story. Convenient, because the context arrived after the fact. ${a} had the ${keyA} first, and first is not nothing.`,
    L06: `Nobody wrote the rule down because nobody needed to. Some rules are so obvious they only appear once broken, like this one about the ${keyA}.`,
    L07: `First is not nothing, agreed. But first is not forever either. ${b} saw the ${keyB} and acted in good faith, which is more than this courtroom usually gets.`,
    L08: `Two people, one ${keyA}, and a dispute this court will remember for the wrong reasons. Proceed to closings.`,
    L09: `Jurors, remember who had the ${keyA} first and which rule was too obvious to write down. Vote SIDE A for ${a}.`,
    L10: `Jurors, remember good faith and a story with ${keyB} in it. No announced rule, no broken rule. Vote SIDE B for ${b}.`,
  };
}

function viralLines(title: string, facts: readonly Fact[], a: string, b: string, sources: readonly { id: string; title: string }[]): Lines {
  const background = facts.find((f) => f.status === 'background')?.text ?? title;
  const posA = facts.find((f) => f.status === 'position-a')?.text ?? a;
  const posB = facts.find((f) => f.status === 'position-b')?.text ?? b;
  const sourced = facts.find((f) => f.status === 'sourced-fact');
  const src = sourced ? sources.find((s) => s.id === (sourced as Fact & { source?: string }).source) : undefined;
  const keyA = keyword(posA);
  const keyB = keyword(posB, [keyA]);
  const evidence = sourced && src ? ` According to ${src.title}, ${lc(frag(sourced.text, 12))}.` : '';
  return {
    L02: `The court has read the approved summary: ${lc(frag(background, 14))}.${evidence} Everything else tonight is opinion, and the court will label it as such.`,
    L03: `${a} stands for a simple idea: ${lc(frag(posA, 16))}. Tradition is just yesterday's experiment that worked, and ${keyA} is that experiment.`,
    L04: `${b} answers plainly: ${lc(frag(posB, 16))}. Some experiments should stay in the lab, and ${keyB} is the reason labs have doors.`,
    L05: `Yesterday's experiment that worked? Most experiments failed and we stopped eating them. ${a} is defending one survivor and calling it a law of nature.`,
    L06: `Some experiments should stay in the lab, says the side that has never left the lab. ${b} treats ${keyB} like a plot twist instead of a choice.`,
    L07: `Defending a survivor? Proudly. Survivors are what we call good ideas, and ${keyA} has survived every complaint in this room so far.`,
    L08: `Never left the lab? We left, we tried it, and we came back with notes. The notes say ${keyB}, underlined twice.`,
    L09: `The court notes that this debate has more passion than most of its actual cases, and fewer facts. Proceed.`,
    L10: `For ${a}: tradition earned by survival. For ${b}: the right to keep the lab door closed. The question stays open until the approved process closes it.`,
  };
}

function commentary(user: string): string {
  const phrase = /REQUIRED PHRASE: ([A-Z ]+)/.exec(user)?.[1]?.trim() ?? 'NO VERDICT';
  const data = (block(user, 'result_data') ?? {}) as { title?: string; summary?: string };
  const title = data.title ?? 'this case';
  const noWinner = ['NO VERDICT', 'CANCELLED', 'INVALID'].includes(phrase);
  return JSON.stringify({
    announcement: noWinner ? `Order. This matter ends with ${phrase}. The court thanks everyone for their patience.` : `Order! The jury has spoken: ${phrase}.`,
    quip: `Let the record show that "${title}" will be read aloud at future clerk trainings.`,
    ...(noWinner ? {} : { prosecutorReaction: 'The prosecution accepts the decision of the jury, dramatically.', defenseReaction: 'The defense thanks the jury and will be framing this moment.' }),
  });
}

/** Deterministic, case-aware default responder. */
export async function mockCourtResponder(request: InferenceRequest): Promise<string> {
  const user = request.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const first = request.messages.find((m) => m.role === 'user')?.content ?? '';
  if (request.purpose === 'commentary') return commentary(user);

  const data = block(first, 'case_data') as { title: string; mode: string; facts: Fact[]; defendant?: string; sides?: { A: string; B: string }; sources?: { id: string; title: string }[] } | null;
  if (!data) return '{"refusal":"insufficient-facts"}';
  const slots = slotsFrom(first);
  const texts =
    data.mode === 'solo'
      ? soloLines(data.title, data.facts, data.defendant ?? 'the defendant')
      : data.mode === 'versus'
        ? versusLines(data.title, data.facts, data.sides?.A ?? 'Side A', data.sides?.B ?? 'Side B')
        : viralLines(data.title, data.facts, data.sides?.A ?? 'Side A', data.sides?.B ?? 'Side B', data.sources ?? []);

  const seed = Number.parseInt(keccak256(`${data.title}:mock`).slice(2, 6), 16);
  const EMO = { prosecutor: ['smug', 'confident', 'angry'], defense: ['confident', 'amused', 'triumphant'], judge: ['exasperated', 'neutral'], clerk: ['neutral', 'amused'] } as const;
  const lines: Record<string, unknown>[] = [];
  const written: Record<string, string> = {};
  for (const [i, slot] of slots.entries()) {
    const raw = texts[slot.id];
    if (!raw) continue;
    const text = fit(raw, slot.min, slot.max, 'The court notes it for the record.');
    written[slot.id] = text;
    const pool = EMO[slot.speaker as keyof typeof EMO] ?? ['neutral'];
    const emotion = pool[(seed + i) % pool.length];
    const animation = slot.speaker === 'judge' ? (i % 2 === 0 ? 'gavel' : 'talk') : slot.answers ? 'point' : slot.segment === 'closing' ? 'desk-slam' : slot.speaker === 'clerk' ? 'talk' : 'present-evidence';
    const refs = data.facts.filter((f) => contentWords(text).some((w) => contentWords(f.text).includes(w))).map((f) => f.id).slice(0, 3);
    lines.push({
      slot: slot.id,
      speaker: slot.speaker,
      emotion,
      animation,
      camera: 'auto',
      crowd: slot.segment === 'closing' ? 'murmur' : slot.speaker === 'judge' ? 'laugh' : 'none',
      text,
      factRefs: refs.length ? refs : [data.facts[0]?.id ?? 'F1'],
      ...(slot.answers && written[slot.answers] ? { answers: quoteOf(written[slot.answers] as string) } : {}),
    });
  }
  const f1 = data.facts[0];
  return JSON.stringify({
    analysis: {
      core: `MOCK analysis of "${data.title}": ${f1 ? frag(f1.text, 12) : data.title}.`,
      tension: 'MOCK: the gap between the plan and what happened.',
      benchA: 'MOCK: the strongest point for ballot option one.',
      benchB: 'MOCK: the strongest point for ballot option two.',
      factRefs: f1 ? [f1.id] : [],
    },
    lines,
  });
}
