/**
 * Output parsing. The model must answer with `{ "lines": [...] }`; everything
 * else is rejected as a retryable `invalid-output`. Parsing is strict about the
 * shape (Segment and Beat unions from core) but tolerant about packaging: code
 * fences and prose around the JSON are fine.
 */
import { CounselError } from '@cringe-court/core';
import type { Beat, Segment } from '@cringe-court/core';

export const MAX_LINE_CHARS = 280;
export const MAX_ANGLE_CHARS = 140;
const MAX_LINES = 16;

export const SEGMENTS: readonly Segment[] = ['call-to-order', 'opening', 'exhibit', 'rebuttal', 'closing', 'jury-out', 'sentence'];
export const BEATS: readonly Beat[] = [
  'desk-slam',
  'objection',
  'point',
  'gasp',
  'laugh',
  'smug',
  'sweat',
  'cry',
  'gavel',
  'present-evidence',
  'dramatic-pause',
];

export interface ParsedLine {
  segment: Segment;
  beat?: Beat;
  text: string;
  exhibitId?: string;
}

const invalid = (message: string): CounselError => new CounselError('invalid-output', message, true);

export function clampText(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Find the first balanced `{…}` in `text` that parses as JSON. */
function scanForObject(text: string): unknown {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return undefined;
}

/** Pull a JSON value out of raw model output: bare JSON, fenced JSON, or JSON inside prose. */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    // fall through to the tolerant paths
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      const inner = scanForObject(fenced[1]);
      if (inner !== undefined) return inner;
    }
  }
  const found = scanForObject(text);
  if (found === undefined) throw invalid('Model output contained no JSON object');
  return found;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseLine(value: unknown, index: number): ParsedLine {
  if (!isRecord(value)) throw invalid(`Line ${index} is not an object`);
  const { segment, beat, text, exhibitId } = value;
  if (typeof segment !== 'string' || !SEGMENTS.includes(segment as Segment)) throw invalid(`Line ${index} has an unknown segment`);
  if (typeof text !== 'string') throw invalid(`Line ${index} has no text`);
  const clamped = clampText(text, MAX_LINE_CHARS);
  if (!clamped) throw invalid(`Line ${index} is empty`);
  const line: ParsedLine = { segment: segment as Segment, text: clamped };
  if (beat !== undefined && beat !== null) {
    if (typeof beat !== 'string' || !BEATS.includes(beat as Beat)) throw invalid(`Line ${index} has an unknown beat`);
    line.beat = beat as Beat;
  }
  if (exhibitId !== undefined && exhibitId !== null) {
    if (typeof exhibitId !== 'string' || !exhibitId) throw invalid(`Line ${index} has a bad exhibitId`);
    line.exhibitId = exhibitId;
  }
  if (line.segment === 'exhibit' && !line.exhibitId) throw invalid(`Line ${index} is an exhibit line without exhibitId`);
  return line;
}

export interface ParseLinesOptions {
  /** Segments a bench may speak; anything else is rejected. */
  allowedSegments?: readonly Segment[];
  /** Exhibit ids the bench was shown; citing any other is rejected. */
  knownExhibitIds?: readonly string[];
}

/** Parse and validate `{ "lines": [...] }`. Throws CounselError('invalid-output') otherwise. */
export function parseLines(raw: string, options: ParseLinesOptions = {}): ParsedLine[] {
  const json = extractJson(raw);
  if (!isRecord(json) || !Array.isArray(json.lines)) throw invalid('Model output has no "lines" array');
  if (json.lines.length === 0) throw invalid('Model output has no lines');
  const lines = json.lines.slice(0, MAX_LINES).map(parseLine);
  for (const line of lines) {
    if (options.allowedSegments && !options.allowedSegments.includes(line.segment)) {
      throw invalid(`Segment "${line.segment}" is not allowed here`);
    }
    if (line.exhibitId && options.knownExhibitIds && !options.knownExhibitIds.includes(line.exhibitId)) {
      throw invalid(`Unknown exhibit "${line.exhibitId}"`);
    }
  }
  return lines;
}

/** Parse `{ "angles": ["…", …] }` (strings or `{ text }` objects, or a bare array) into clamped, de-duplicated texts. */
export function parseAngles(raw: string): string[] {
  const json = extractJson(raw);
  const list = Array.isArray(json) ? json : isRecord(json) ? json.angles : undefined;
  if (!Array.isArray(list)) throw invalid('Model output has no "angles" array');
  const texts = list
    .map((a) => (typeof a === 'string' ? a : isRecord(a) && typeof a.text === 'string' ? a.text : ''))
    .map((t) => clampText(t, MAX_ANGLE_CHARS))
    .filter(Boolean);
  const unique = [...new Set(texts)];
  if (unique.length === 0) throw invalid('Model output has no usable angles');
  return unique;
}
