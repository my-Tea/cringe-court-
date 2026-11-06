import { describe, expect, it } from 'vitest';
import { CourtAI, TrialGenerationError, verifyTranscriptHash } from '../engine';
import { EXAMPLE_INPUTS, exampleScript } from '../eval/examples';
import { InferenceError, type InferenceClient, type InferenceRequest, type InferenceResult } from '../inference';
import { MockInferenceClient } from '../mock';
import { PLANS } from '../plans';
import { prepareCase } from '../prepare';
import { MemoryTranscriptStore, getOrGenerateTrial } from '../store';
import { OUTCOMES, type CourtMode, type CourtOutcome, type FinalizedCaseResult } from '../schema';

const NOW = () => new Date('2026-11-06T12:00:00Z');
const ai = (client: InferenceClient, extra = {}) => new CourtAI(client, { now: NOW, ...extra });
const prep = (mode: CourtMode) => prepareCase(EXAMPLE_INPUTS[mode]);

/** A client that answers like a live provider, with a real-looking request id. */
class ScriptedClient implements InferenceClient {
  readonly provider = '0g-router' as const;
  readonly model = 'test-model';
  readonly trustMode = 'standard' as const;
  readonly calls: InferenceRequest[] = [];
  constructor(private readonly answers: Array<string | Error>) {}
  async complete(request: InferenceRequest): Promise<InferenceResult> {
    this.calls.push(request);
    const next = this.answers.shift();
    if (next instanceof Error) throw next;
    return { content: next ?? '', provider: '0g-router', model: this.model, requestId: `req-${this.calls.length}`, trustMode: 'standard', responseMeta: {}, latencyMs: 5, attempts: 1, usage: { inputTokens: 100, outputTokens: 50 } };
  }
}

describe('generateTrial', () => {
  it.each(['solo', 'versus', 'viral'] as const)('%s: one call, plan order, templates, provenance', async (mode) => {
    const client = new ScriptedClient([exampleScript(mode)]);
    const t = await ai(client).generateTrial(prep(mode));
    expect(client.calls).toHaveLength(1);
    expect(t.lines.map((l) => l.id)).toEqual(PLANS[mode].slots.map((s) => s.id));
    expect(t.lines.filter((l) => l.source === 'template').map((l) => l.id)).toEqual(PLANS[mode].slots.filter((s) => s.template).map((s) => s.id));
    expect(t.inference).toMatchObject({ provider: '0g-router', model: 'test-model', requestIds: ['req-1'], calls: 1, trustMode: 'standard', verification: 'none' });
    expect(t.validation.ok).toBe(true);
    expect(t.scriptVersion).toBe(PLANS[mode].version);
    expect(t.ballot).toEqual(mode === 'solo' ? ['GUILTY', 'NOT_COOKED'] : ['SIDE_A', 'SIDE_B']);
    expect(verifyTranscriptHash(t)).toBe(true);
  });

  it('places the verbatim viral question and the neutral vote/resolution lines', async () => {
    const t = await ai(new ScriptedClient([exampleScript('viral')])).generateTrial(prep('viral'));
    expect(t.lines[0]?.text).toContain('"Should pineapple belong on pizza?"');
    expect(t.lines.at(-1)?.text).toMatch(/Result pending/);
    const solo = await ai(new ScriptedClient([exampleScript('solo')])).generateTrial(prep('solo'));
    expect(solo.lines.at(-1)?.text).toMatch(/GUILTY, or NOT COOKED\? The jury is out\./);
  });

  it('runs one repair turn with the findings, then succeeds', async () => {
    const client = new ScriptedClient(['Sorry, here is the trial: {not json', exampleScript('solo')]);
    const t = await ai(client).generateTrial(prep('solo'));
    expect(client.calls.map((c) => c.purpose)).toEqual(['trial', 'repair']);
    const repairPrompt = client.calls[1]?.messages.at(-1)?.content ?? '';
    expect(repairPrompt).toMatch(/not valid JSON/);
    expect(t.validation.attempts).toBe(2);
    expect(t.inference.requestIds).toEqual(['req-1', 'req-2']);
  });

  it('stops after the attempt budget and reports why', async () => {
    const client = new ScriptedClient(['nope', 'still nope', 'never called']);
    const err = await ai(client).generateTrial(prep('solo')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TrialGenerationError);
    expect((err as TrialGenerationError).code).toBe('invalid-output');
    expect(client.calls).toHaveLength(2);
  });

  it('accepts soft-only output after the budget, flagged below threshold', async () => {
    const weak = JSON.parse(exampleScript('solo')) as { lines: { slot: string; factRefs: string[]; answers?: string }[] };
    for (const l of weak.lines) {
      l.factRefs = [];
      delete l.answers;
    }
    const client = new ScriptedClient([JSON.stringify(weak), JSON.stringify(weak)]);
    const t = await ai(client, { minOverall: 4.9 }).generateTrial(prep('solo'));
    expect(t.validation.belowThreshold).toBe(true);
    expect(client.calls).toHaveLength(2);
  });

  it('turns a model refusal into a clear error without retrying', async () => {
    const client = new ScriptedClient(['{"refusal":"unsuitable","reason":"harassment"}']);
    const err = await ai(client).generateTrial(prep('solo')).catch((e: unknown) => e);
    expect((err as TrialGenerationError).code).toBe('refused');
    expect(client.calls).toHaveLength(1);
  });

  it('repairs output with an unknown speaker', async () => {
    const bad = exampleScript('solo').replace('"speaker": "clerk"', '"speaker": "narrator"');
    const client = new ScriptedClient([bad, exampleScript('solo')]);
    const t = await ai(client).generateTrial(prep('solo'));
    expect(t.lines[0]?.speaker).toBe('clerk');
    expect(client.calls[1]?.messages.at(-1)?.content).toMatch(/Unknown speaker "narrator"/);
  });

  it('repairs excessively long output', async () => {
    const long = JSON.parse(exampleScript('solo')) as { lines: { text: string }[] };
    for (const l of long.lines) l.text = `${l.text} ${l.text} ${l.text}`;
    const client = new ScriptedClient([JSON.stringify(long), exampleScript('solo')]);
    await ai(client).generateTrial(prep('solo'));
    expect(client.calls[1]?.messages.at(-1)?.content).toMatch(/limit is|too long/);
  });

  it('propagates provider failures (after the client\'s own retries)', async () => {
    const client = new ScriptedClient([new InferenceError('insufficient-balance', 'balance too low', false, 402)]);
    await expect(ai(client).generateTrial(prep('solo'))).rejects.toMatchObject({ code: 'insufficient-balance' });
  });

  it('mock runs are labelled and never carry a request id', async () => {
    const t = await ai(new MockInferenceClient()).generateTrial(prep('versus'));
    expect(t.inference).toMatchObject({ provider: 'mock', requestIds: [], trustMode: 'none' });
  });

  it('records verified/private trust mode without claiming verification', async () => {
    const client = new ScriptedClient([exampleScript('solo')]);
    Object.defineProperty(client, 'trustMode', { value: 'verified' });
    const original = client.complete.bind(client);
    client.complete = async (r) => ({ ...(await original(r)), trustMode: 'verified' });
    const t = await ai(client).generateTrial(prep('solo'));
    expect(t.inference).toMatchObject({ trustMode: 'verified', verification: 'not-verified-by-harness' });
  });
});

describe('transcript stability', () => {
  it('hash is stable across generation time and metadata, and detects tampering', async () => {
    const a = await ai(new ScriptedClient([exampleScript('solo')])).generateTrial(prep('solo'));
    const b = await new CourtAI(new ScriptedClient([exampleScript('solo')]), { now: () => new Date('2030-01-01') }).generateTrial(prep('solo'));
    expect(a.contentHash).toBe(b.contentHash);
    const tampered = { ...a, lines: a.lines.map((l, i) => (i === 1 ? { ...l, text: 'Edited.' } : l)) };
    expect(verifyTranscriptHash(tampered)).toBe(false);
  });

  it('generates once per case and replays from the store', async () => {
    const client = new ScriptedClient([exampleScript('solo')]);
    const court = ai(client);
    const store = new MemoryTranscriptStore();
    const [x, y] = await Promise.all([getOrGenerateTrial(store, court, prep('solo')), getOrGenerateTrial(store, court, prep('solo'))]);
    const z = await getOrGenerateTrial(store, court, prep('solo'));
    expect(client.calls).toHaveLength(1);
    expect(x.contentHash).toBe(y.contentHash);
    expect(z.contentHash).toBe(x.contentHash);
  });

  it('refuses to overwrite a stored transcript with different content', async () => {
    const store = new MemoryTranscriptStore();
    const t = await ai(new ScriptedClient([exampleScript('solo')])).generateTrial(prep('solo'));
    await store.put(t);
    await expect(store.put({ ...t, contentHash: '0xdifferent' })).rejects.toThrow(/different transcript/);
  });
});

describe('generateVerdictCommentary', () => {
  const result = (outcome: CourtOutcome, mode: CourtMode): FinalizedCaseResult => ({
    caseId: EXAMPLE_INPUTS[mode].caseId as string,
    mode,
    status: outcome === 'CANCELLED' ? 'CANCELLED' : outcome === 'INVALID' ? 'INVALID' : 'FINALIZED',
    outcome,
    summary: 'A short neutral summary of the case.',
  });
  const modeFor = (o: CourtOutcome): CourtMode => (o === 'GUILTY' || o === 'NOT_COOKED' ? 'solo' : 'versus');
  const phrase = (o: CourtOutcome) => o.replace('_', ' ');

  it.each(OUTCOMES)('%s: announcement states the external result exactly', async (outcome) => {
    const c = await ai(new MockInferenceClient()).generateVerdictCommentary(result(outcome, modeFor(outcome)));
    expect(c.outcome).toBe(outcome);
    expect(c.lines[0]?.text.toUpperCase()).toContain(phrase(outcome));
    expect(c.lines[0]?.speaker).toBe('judge');
  });

  it.each(OUTCOMES)('%s: a model that contradicts the result falls back to the template', async (outcome) => {
    const wrong = outcome === 'GUILTY' ? 'NOT COOKED' : 'GUILTY';
    const client = new ScriptedClient([JSON.stringify({ announcement: `Order! The jury has spoken: ${wrong}.`, quip: 'What a case this was for everyone.' })]);
    const c = await ai(client).generateVerdictCommentary(result(outcome, modeFor(outcome)));
    expect(c.source).toBe('template');
    expect(c.lines[0]?.text.toUpperCase()).toContain(phrase(outcome));
    expect(c.lines[0]?.text.toUpperCase()).not.toContain(wrong);
  });

  it('never names a winner when there is none', async () => {
    for (const outcome of ['NO_VERDICT', 'CANCELLED', 'INVALID'] as const) {
      const c = await ai(new MockInferenceClient()).generateVerdictCommentary(result(outcome, 'versus'));
      expect(c.lines.map((l) => l.text).join(' ')).not.toMatch(/\b(wins?|won|winner)\b/i);
    }
  });

  it('uses the template when the provider fails', async () => {
    const client = new ScriptedClient([new InferenceError('no-provider', 'none', false, 503)]);
    const c = await ai(client).generateVerdictCommentary(result('SIDE_A', 'versus'));
    expect(c).toMatchObject({ source: 'template', outcome: 'SIDE_A' });
    expect(c.issues[0]?.code).toBe('provider:no-provider');
  });

  it('rejects outcomes that do not belong to the mode and mismatched transcripts', async () => {
    await expect(ai(new MockInferenceClient()).generateVerdictCommentary({ ...result('GUILTY', 'solo'), mode: 'versus' })).rejects.toThrow(/not valid for mode versus/);
    const t = await ai(new ScriptedClient([exampleScript('solo')])).generateTrial(prep('solo'));
    await expect(ai(new MockInferenceClient()).generateVerdictCommentary({ ...result('SIDE_A', 'versus'), caseId: 'other' }, t)).rejects.toThrow(/does not match/);
  });

  it('blocks settlement talk unless the app confirmed settlement', async () => {
    const client = new ScriptedClient([JSON.stringify({ announcement: 'Order! The jury has spoken: SIDE B.', quip: 'Winners, collect your payouts at the door.' })]);
    const c = await ai(client).generateVerdictCommentary({ ...result('SIDE_B', 'viral'), caseId: 'example-viral-pineapple' });
    expect(c.source).toBe('template');
  });
});
