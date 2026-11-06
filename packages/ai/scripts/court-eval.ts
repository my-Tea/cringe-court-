/**
 * court:eval: run the evaluation corpus through the court AI and report the
 * automated signals (docs/ai/11). Live runs cost 0G credits: one or two calls
 * per case.
 *
 *   npm run court:eval                                  mock, all 60 cases
 *   npm run court:eval -- --provider 0g --env-file .env.court --mode solo --limit 5
 *   npm run court:eval -- --provider 0g --env-file .env.court --out eval-report.json
 *
 * Exit code 1 when a live run misses the automated gates (hard-pass < 95 %,
 * any forbidden term, mean estimate < 3.5, or cross-trial similarity >= 0.08).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { CourtAI, TrialGenerationError, createInferenceClient, loadCourtAIConfig, prepareCase, type Transcript } from '../src/court/index';
import { FULL_CORPUS, type CorpusCase } from '../src/court/eval/corpus';
import { summarize } from '../src/court/eval/evaluate';

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const envFile = opt('env-file');
if (envFile) {
  for (const line of (await readFile(envFile, 'utf8')).split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) process.env[m[1] as string] ??= (m[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
  }
}
const provider = opt('provider') as 'mock' | '0g' | undefined;
const mode = opt('mode') ?? 'all';
const limit = Number(opt('limit') ?? 20);
const concurrency = Math.max(1, Number(opt('concurrency') ?? 2));
const cases = FULL_CORPUS.filter((c) => mode === 'all' || c.input.mode === mode)
  .filter((c, _i, all) => all.filter((x) => x.input.mode === c.input.mode).indexOf(c) < limit);

const client = createInferenceClient(loadCourtAIConfig(process.env, provider ? { provider } : {}));
const court = new CourtAI(client);
console.log(`court:eval · ${client.provider === 'mock' ? 'MOCK (template writer; quality numbers are not meaningful)' : `0G ${client.model}`} · ${cases.length} cases`);

const results: { c: CorpusCase; t?: Transcript; error?: string }[] = [];
let next = 0;
async function worker(): Promise<void> {
  while (next < cases.length) {
    const c = cases[next++] as CorpusCase;
    try {
      const t = await court.generateTrial(prepareCase(c.input));
      results.push({ c, t });
      process.stdout.write(`  ${c.id} ok   estimate ${t.validation.overall}  calls ${t.inference.calls}\n`);
    } catch (e) {
      const reason = e instanceof TrialGenerationError ? `${e.code}: ${e.issues.filter((i) => i.severity === 'hard').map((i) => i.code).join(', ')}` : e instanceof Error ? e.message : String(e);
      results.push({ c, error: reason });
      process.stdout.write(`  ${c.id} FAIL ${reason}\n`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

const report = summarize(client.provider, client.model, cases.length, results);
console.log(`\nhard-pass ${(report.hardPassRate * 100).toFixed(0)} %   first-attempt ${(report.firstAttemptRate * 100).toFixed(0)} %   mean estimate ${report.meanOverall}   mention coverage ${report.meanMention}   forbidden hits ${report.forbiddenHits}`);
console.log(`cross-trial similarity (lower = more original; target < 0.08): ${JSON.stringify(report.similarity)}`);
const out = opt('out');
if (out) {
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`report written to ${out}`);
}
if (client.provider !== 'mock') {
  const failed = report.hardPassRate < 0.95 || report.forbiddenHits > 0 || report.meanOverall < 3.5 || Object.values(report.similarity).some((s) => s >= 0.08);
  if (failed) {
    console.log('Automated gates: FAILED (see docs/ai/11 §5).');
    process.exit(1);
  }
  console.log('Automated gates: passed. Human review (docs/ai/11 §4) is still required before release.');
}
