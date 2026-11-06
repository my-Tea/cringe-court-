/**
 * The Grand Jury case file: the reviewed public context card an editor signs
 * off before a case is published (V4 §12, D8, D10). Everything here is public.
 * Grand Jury cases are about common or famous *issues*, never private people:
 * the review rejects anything that names a private individual.
 */
import type { BallotLabels, Category, CourtLine } from '@cringe-court/core';

export interface CasePosition {
  /** The ballot title, in caps ("TEAM CEREAL IS SOUP"). */
  title: string;
  /** One or two sentences: the strongest fair version of this side. */
  summary: string;
}

export interface CaseSource {
  id: string;
  kind: 'definition' | 'poll' | 'history' | 'quote' | 'rule';
  /** Short label for the source chip ("Dictionary definition of soup"). */
  label: string;
  /** What the source says, in the editor's words. Approved text only. */
  note: string;
}

export interface EditorialReview {
  /** Editor's handle (never a real name in the demo). */
  editor: string;
  /** ISO date of the human sign-off. */
  signedOff: string;
  /** Minutes spent (A23 measures this; D10 targets ≤ 1.50 USDC of review per case). */
  minutes: number;
  checks: readonly string[];
}

export interface CaseSponsor {
  name: string;
  /** "Presented by" line. The sponsor has no say over selection, content or verdict (D9). */
  line: string;
}

export interface CaseFile {
  /** URL-safe id, stable across reloads. */
  slug: string;
  /** Card title. */
  title: string;
  /** The question the jury answers. */
  question: string;
  category: Category;
  /** Short hook for the docket card. */
  hook: string;
  /** Neutral context paragraph. */
  context: string;
  positions: readonly [CasePosition, CasePosition];
  sources: readonly CaseSource[];
  review: EditorialReview;
  sponsor: CaseSponsor | null;
  /** Tags for search and filters. */
  tags: readonly string[];
  /**
   * The scripted show for the fixture counsel adapter (no network). Production
   * drafts come from 0G Compute through AiCounselPort with the same shape.
   */
  script: readonly CourtLine[];
}

export function ballotOf(file: CaseFile): BallotLabels {
  return [file.positions[0].title, file.positions[1].title];
}

/** A catalog keyed by slug, with the reverse index from the on-chain title. */
export class CaseCatalog {
  readonly #bySlug = new Map<string, CaseFile>();

  constructor(files: readonly CaseFile[]) {
    for (const f of files) {
      if (this.#bySlug.has(f.slug)) throw new Error(`Duplicate case slug ${f.slug}`);
      validateCaseFile(f);
      this.#bySlug.set(f.slug, f);
    }
  }

  get(slug: string): CaseFile | undefined {
    return this.#bySlug.get(slug);
  }

  list(): readonly CaseFile[] {
    return [...this.#bySlug.values()];
  }
}

const TITLE_MAX = 32;

/** The editor checks the tooling enforces before sign-off. */
export function validateCaseFile(f: CaseFile): void {
  const fail = (m: string) => {
    throw new Error(`Case file ${f.slug}: ${m}`);
  };
  if (!/^[a-z0-9-]+$/.test(f.slug)) fail('slug must be kebab-case');
  if (!f.question.trim().endsWith('?')) fail('the question must be a question');
  for (const p of f.positions) {
    if (p.title !== p.title.toUpperCase()) fail(`ballot title "${p.title}" must be in caps`);
    if (p.title.length > TITLE_MAX) fail(`ballot title "${p.title}" is longer than ${TITLE_MAX}`);
  }
  if (f.positions[0].title === f.positions[1].title) fail('ballot titles must differ');
  if (f.sources.length === 0) fail('a reviewed case cites at least one source');
  const ids = new Set<string>();
  for (const line of f.script) {
    if (ids.has(line.id)) fail(`duplicate line id ${line.id}`);
    ids.add(line.id);
    if (line.exhibitId && !f.sources.some((s) => s.id === line.exhibitId)) fail(`line ${line.id} cites unknown source ${line.exhibitId}`);
  }
  const segments = new Set(f.script.map((l) => l.segment));
  for (const s of ['call-to-order', 'opening', 'closing', 'jury-out'] as const) if (!segments.has(s)) fail(`script needs a ${s}`);
  for (const bench of [0, 1] as const) {
    if (!f.script.some((l) => l.segment === 'opening' && l.bench === bench)) fail(`bench ${bench} needs an opening`);
  }
}
