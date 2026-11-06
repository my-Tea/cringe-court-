/**
 * Structured-response parsing. Model text -> ModelScript, with the documented
 * safe-default rules (docs/ai/08 §5):
 *
 * | Field      | Unknown / invalid value            | Becomes         |
 * |------------|------------------------------------|-----------------|
 * | emotion    | not in EMOTIONS                    | "neutral"       |
 * | animation  | not in ANIMATIONS                  | "talk"          |
 * | animation  | "gavel" by a non-judge             | "point"         |
 * | animation  | "objection" by judge or clerk      | "talk"          |
 * | camera     | not in CAMERAS                     | "auto"          |
 * | crowd      | not in CROWD_REACTIONS             | "none"          |
 * | factRefs   | not an array / unknown ids         | dropped         |
 * | speaker    | not in COURT_SPEAKERS              | **rejected**    |
 * | text       | missing / not a string             | **rejected**    |
 *
 * Every replacement is reported in `coercions`. Nothing in the output is ever
 * executed: text is plain text, enums are allow-listed, there are no asset
 * paths, URLs or commands.
 */
import {
  ANIMATIONS,
  CAMERAS,
  COURT_SPEAKERS,
  CROWD_REACTIONS,
  EMOTIONS,
  ModelCommentarySchema,
  ModelScriptSchema,
  RefusalSchema,
  type ModelScript,
} from './schema';
import type { z } from 'zod';

export type ParseResult =
  | { kind: 'script'; script: ModelScript; coercions: string[] }
  | { kind: 'refusal'; refusal: 'unsuitable' | 'insufficient-facts'; reason?: string }
  | { kind: 'error'; code: 'empty' | 'invalid-json' | 'schema'; message: string };

/** Pull one JSON object out of model text: tolerates code fences and prose around it. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new SyntaxError('empty response');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('no JSON object found');
  return JSON.parse(body.slice(start, end + 1));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T, label: string, coercions: string[]): T {
  if (value === undefined || value === null) return fallback;
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const candidates = [raw, raw.replace(/[\s_]+/g, '-'), raw.replace(/[\s-]+/g, '_'), raw.replace(/!+$/, '')];
  const hit = candidates.find((c) => (allowed as readonly string[]).includes(c));
  if (hit) return hit as T;
  coercions.push(`${label}: unknown value ${JSON.stringify(value)} -> "${fallback}"`);
  return fallback;
}

/** Apply the coercion table to one raw line object (in place on a copy). */
function coerceLine(raw: unknown, index: number, coercions: string[], validFacts: ReadonlySet<string>): unknown {
  if (!isRecord(raw)) return raw;
  const slot = typeof raw.slot === 'string' ? raw.slot.trim().toUpperCase() : raw.slot;
  const where = typeof slot === 'string' ? slot : `line ${index + 1}`;
  const speaker = typeof raw.speaker === 'string' ? raw.speaker.trim().toLowerCase() : raw.speaker;
  const line: Record<string, unknown> = { ...raw, slot, speaker };
  line.emotion = pick(raw.emotion, EMOTIONS, 'neutral', `${where} emotion`, coercions);
  let animation = pick(raw.animation, ANIMATIONS, 'talk', `${where} animation`, coercions);
  if (animation === 'gavel' && speaker !== 'judge') {
    coercions.push(`${where} animation: "gavel" is judge-only -> "point"`);
    animation = 'point';
  }
  if (animation === 'objection' && (speaker === 'judge' || speaker === 'clerk')) {
    coercions.push(`${where} animation: "objection" is counsel-only -> "talk"`);
    animation = 'talk';
  }
  if (animation === 'present-evidence' && speaker === 'clerk') {
    coercions.push(`${where} animation: clerk does not present evidence -> "talk"`);
    animation = 'talk';
  }
  line.animation = animation;
  line.camera = pick(raw.camera, CAMERAS, 'auto', `${where} camera`, coercions);
  line.crowd = pick(raw.crowd, CROWD_REACTIONS, 'none', `${where} crowd`, coercions);
  if (typeof raw.text === 'string') line.text = raw.text.replace(/\s+/g, ' ').trim();
  const refs = Array.isArray(raw.factRefs) ? raw.factRefs.filter((r): r is string => typeof r === 'string').map((r) => r.trim().toUpperCase()) : [];
  if (raw.factRefs !== undefined && !Array.isArray(raw.factRefs)) coercions.push(`${where} factRefs: not a list -> []`);
  const known = refs.filter((r) => validFacts.has(r));
  if (known.length !== refs.length) coercions.push(`${where} factRefs: dropped unknown ${refs.filter((r) => !validFacts.has(r)).join(', ')}`);
  line.factRefs = [...new Set(known)].slice(0, 6);
  if (typeof raw.answers === 'string') line.answers = raw.answers.replace(/\s+/g, ' ').trim().slice(0, 160) || undefined;
  else delete line.answers;
  return line;
}

function zodMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
    .join('; ');
}

export function parseModelScript(text: string, validFacts: ReadonlySet<string>): ParseResult {
  if (!text.trim()) return { kind: 'error', code: 'empty', message: 'The model returned an empty response.' };
  let json: unknown;
  try {
    json = extractJson(text);
  } catch (e) {
    return { kind: 'error', code: 'invalid-json', message: `Response is not valid JSON (${e instanceof Error ? e.message : 'parse error'}).` };
  }
  const refusal = RefusalSchema.safeParse(json);
  if (refusal.success) return { kind: 'refusal', refusal: refusal.data.refusal, ...(refusal.data.reason ? { reason: refusal.data.reason } : {}) };
  if (!isRecord(json)) return { kind: 'error', code: 'schema', message: 'Response must be a JSON object.' };

  const coercions: string[] = [];
  const lines = Array.isArray(json.lines) ? json.lines.map((l, i) => coerceLine(l, i, coercions, validFacts)) : json.lines;
  for (const l of Array.isArray(lines) ? lines : []) {
    if (isRecord(l) && typeof l.speaker === 'string' && !(COURT_SPEAKERS as readonly string[]).includes(l.speaker)) {
      return { kind: 'error', code: 'schema', message: `Unknown speaker "${l.speaker}" in ${String(l.slot)}: speakers must be ${COURT_SPEAKERS.join(', ')}.` };
    }
  }
  const analysis = isRecord(json.analysis)
    ? {
        ...json.analysis,
        factRefs: Array.isArray(json.analysis.factRefs)
          ? json.analysis.factRefs.filter((r): r is string => typeof r === 'string' && validFacts.has(r.trim().toUpperCase())).map((r) => r.trim().toUpperCase())
          : [],
      }
    : json.analysis;
  const parsed = ModelScriptSchema.safeParse({ analysis, lines });
  if (!parsed.success) return { kind: 'error', code: 'schema', message: zodMessage(parsed.error) };
  return { kind: 'script', script: parsed.data, coercions };
}

export type CommentaryParse =
  | { kind: 'ok'; value: z.infer<typeof ModelCommentarySchema> }
  | { kind: 'error'; message: string };

export function parseCommentary(text: string): CommentaryParse {
  let json: unknown;
  try {
    json = extractJson(text);
  } catch (e) {
    return { kind: 'error', message: `Response is not valid JSON (${e instanceof Error ? e.message : 'parse error'}).` };
  }
  if (isRecord(json)) {
    for (const k of ['announcement', 'quip', 'prosecutorReaction', 'defenseReaction']) {
      const v = json[k];
      if (typeof v === 'string') json[k] = v.replace(/\s+/g, ' ').trim();
      if (v === '' || v === null) delete json[k];
    }
  }
  const parsed = ModelCommentarySchema.safeParse(json);
  return parsed.success ? { kind: 'ok', value: parsed.data } : { kind: 'error', message: zodMessage(parsed.error) };
}

