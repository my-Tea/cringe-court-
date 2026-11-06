/**
 * court:test: run one case through the court AI without the rest of the game.
 *
 *   npm run court:test -- --example solo
 *   npm run court:test -- --case packages/ai/court-cases/solo-dog.json
 *   npm run court:test -- --case my-case.json --provider 0g --env-file .env.court
 *   npm run court:test -- --example versus --verdict SIDE_B --cues
 *   npm run court:test -- --list-models
 *
 * Options:
 *   --example solo|versus|viral   use a built-in reference case
 *   --case <file.json>            case input (see packages/ai/court-cases/*.json)
 *   --provider mock|0g            default: COURT_AI_PROVIDER, else mock
 *   --env-file <path>             load KEY=VALUE lines before reading configuration
 *   --scripted                    with --example: replay the hand-written reference script (no model)
 *   --verdict <OUTCOME>           also generate post-verdict commentary for an external result
 *   --save <dir>                  write-once transcript store; re-running replays instead of regenerating
 *   --cues                        print the Director cue sequence the game would perform
 *   --json-out                    print the full transcript JSON at the end
 *   --log                         structured provider logs (no case text) on stderr
 */
import { readFile } from 'node:fs/promises';
import { directTrial, directVerdict } from '@cringe-court/engine';
import {
  CaseRejectedError,
  CourtAI,
  CourtConfigError,
  InferenceError,
  MockInferenceClient,
  OUTCOMES,
  PERSONAS,
  TrialGenerationError,
  chatModels,
  commentaryToCourtLines,
  courtCast,
  courtDirectorOptions,
  createInferenceClient,
  getOrGenerateTrial,
  jsonLineLogger,
  listOgModels,
  loadCourtAIConfig,
  prepareCase,
  silentLogger,
  toCourtLines,
  type CourtMode,
  type CourtOutcome,
  type FinalizedCaseResult,
  type InferenceClient,
  type JudgeCommentary,
  type Transcript,
} from '../src/court/index';
import { FileTranscriptStore } from '../src/court/node';
import { EXAMPLE_INPUTS, exampleScript } from '../src/court/eval/examples';

/* ── Arguments ───────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

async function loadEnvFile(path: string): Promise<void> {
  const text = await readFile(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = (m[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
    process.env[m[1] as string] ??= value;
  }
}

/* ── Output helpers ──────────────────────────────────────────────────────── */

const WIDTH = 96;
const rule = (title: string) => console.log(`\n── ${title} ${'─'.repeat(Math.max(3, WIDTH - title.length - 4))}`);
function wrap(text: string, indent: string): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > WIDTH - indent.length) {
      out.push(line);
      line = w;
    } else line = `${line} ${w}`.trim();
  }
  if (line) out.push(line);
  return out.map((l) => indent + l).join('\n');
}

const NAME: Record<string, string> = { prosecutor: PERSONAS.prosecutor.name, defense: PERSONAS.defense.name, judge: PERSONAS.judge.name, clerk: 'Court Clerk' };

function printBanner(client: InferenceClient): void {
  console.log('═'.repeat(WIDTH));
  console.log(' CRINGECOURT · court:test   "Your Honor, Bro Is Cooked."');
  if (client.provider === 'mock') {
    console.log(' Provider: MOCK. Offline template writer. NOT a 0G call; no request ids; jokes are templates.');
  } else {
    console.log(` Provider: 0G Compute Router · model ${client.model} · trust mode ${client.trustMode}`);
  }
  console.log('═'.repeat(WIDTH));
}

function printTranscript(t: Transcript): void {
  rule('Normalized case');
  console.log(`  caseId   ${t.caseId}\n  mode     ${t.mode}   category ${t.category}   tone ${t.tone}   ballot ${t.ballot.join(' / ')}`);
  if (t.mode === 'solo') console.log(`  defendant ${t.parties.defendant}`);
  else console.log(`  Side A   ${t.parties.sideA} (argued by ${NAME[t.advocates?.A ?? '']})\n  Side B   ${t.parties.sideB} (argued by ${NAME[t.advocates?.B ?? '']})`);
  for (const f of t.facts) console.log(wrap(`${f.id} [${f.status}${f.sourceId ? ` ${f.sourceId}` : ''}] ${f.text}`, '  '));

  rule('Case understanding (model analysis)');
  console.log(wrap(`Core: ${t.analysis.core}`, '  '));
  console.log(wrap(`Tension: ${t.analysis.tension}`, '  '));
  console.log(wrap(`Best for ${t.ballot[0]}: ${t.analysis.benchA}`, '  '));
  console.log(wrap(`Best for ${t.ballot[1]}: ${t.analysis.benchB}`, '  '));

  rule(`Courtroom (about ${t.estimatedSeconds} s)`);
  for (const l of t.lines) {
    const tag = l.source === 'template' ? ' · court-written' : '';
    const stage = [l.emotion, l.animation, l.camera, l.crowd !== 'none' ? `crowd:${l.crowd}` : ''].filter(Boolean).join(' · ');
    console.log(`\n  ${l.id}  ${(NAME[l.speaker] ?? l.speaker).toUpperCase()}${l.bench !== undefined ? ` [for ${t.ballot[l.bench]}]` : ''}   (${stage}${tag})`);
    console.log(wrap(l.text, '      '));
    if (l.answers) console.log(wrap(`↳ answers: "${l.answers}"`, '      '));
    if (l.factRefs.length) console.log(`      facts: ${l.factRefs.join(', ')}`);
  }

  rule('Validation');
  const v = t.validation;
  console.log(`  accepted ${v.ok}   heuristic estimate ${v.overall}/5${v.belowThreshold ? '   (BELOW THRESHOLD: accepted after the attempt budget)' : ''}   attempts ${v.attempts}`);
  console.log(`  ${Object.entries(v.scores).map(([k, s]) => `${k} ${s}`).join(' · ')}`);
  for (const i of v.issues) console.log(wrap(`${i.severity.toUpperCase()} ${i.code}${i.slot ? ` [${i.slot}]` : ''}: ${i.message}`, '  - '));
  for (const c of v.coercions) console.log(wrap(`coerced: ${c}`, '  - '));
  if (!v.issues.length && !v.coercions.length) console.log('  no issues');

  rule('Inference');
  const m = t.inference;
  console.log(`  provider ${m.provider}   model ${m.model}   calls ${m.calls}   latency ${m.latencyMs} ms`);
  console.log(`  request ids ${m.requestIds.length ? m.requestIds.join(', ') : m.provider === 'mock' ? '(none: mock run)' : '(none returned by provider)'}`);
  console.log(`  trust mode ${m.trustMode}   verification ${m.verification}`);
  if (m.usage) console.log(`  tokens in ${m.usage.inputTokens} / out ${m.usage.outputTokens}`);
  for (const [k, val] of Object.entries(m.responseMeta)) console.log(`  ${k}: ${val}`);
  console.log(`\n  content hash ${t.contentHash}\n  generated ${t.generatedAt}`);
}

function printCommentary(c: JudgeCommentary): void {
  const by = c.source === 'template' ? 'template fallback' : c.inference?.provider === 'mock' ? 'MOCK writer' : 'model-written';
  rule(`Post-verdict (${c.outcome}, ${by})`);
  for (const l of c.lines) {
    console.log(`  ${(NAME[l.speaker] ?? l.speaker).toUpperCase()}   (${l.emotion} · ${l.animation})`);
    console.log(wrap(l.text, '      '));
  }
  for (const i of c.issues) console.log(wrap(`${i.severity} ${i.code}: ${i.message}`, '  - '));
  if (c.inference?.requestIds.length) console.log(`  request ids ${c.inference.requestIds.join(', ')}`);
}

function printCues(t: Transcript, commentary: JudgeCommentary | null): void {
  rule('Director cues (what the game performs)');
  const show = directTrial(t.caseId, toCourtLines(t), courtCast(t.mode), courtDirectorOptions());
  for (const c of show.cues) {
    const { kind, ...rest } = c;
    const detail = kind === 'say' ? `${c.actor}: ${c.line.id} (${c.seconds.toFixed(1)} s, emotion ${c.line.emotion ?? 'neutral'})` : JSON.stringify(rest);
    console.log(`  ${kind.padEnd(8)} ${detail}`);
  }
  console.log(`  total ${show.seconds.toFixed(1)} s scripted`);
  if (commentary) {
    const label = commentary.outcome.replace('_', ' ');
    const kind = commentary.outcome === 'GUILTY' || commentary.outcome === 'SIDE_A' ? 'ballot-0' : commentary.outcome === 'NOT_COOKED' || commentary.outcome === 'SIDE_B' ? 'ballot-1' : 'no-verdict';
    const v = directVerdict({ kind, label, tally: [0, 0], completedDuty: 0, appointed: 0 }, courtCast(t.mode), commentaryToCourtLines(commentary)[0] ?? null);
    console.log(`  verdict ceremony: ${v.cues.length} cues, ${v.seconds.toFixed(1)} s`);
  }
}

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main(): Promise<number> {
  const envFile = opt('env-file');
  if (envFile) await loadEnvFile(envFile);

  if (flag('list-models')) {
    const models = chatModels(await listOgModels({ ...(process.env.OG_BASE_URL ? { baseUrl: process.env.OG_BASE_URL } : {}) }));
    console.log(`0G Router chat models (live catalog, ${models.length}):`);
    for (const m of models) console.log(`  ${m.id.padEnd(34)} ${m.json ? 'json-mode' : '         '}  ${m.context ? `${Math.round(m.context / 1000)}k ctx` : ''}`);
    console.log('\nSet OG_MODEL to one of these. json-mode = supports response_format (recommended).');
    return 0;
  }

  const example = opt('example') as CourtMode | undefined;
  const casePath = opt('case');
  if (!example && !casePath) {
    console.error('Give a case: --example solo|versus|viral or --case <file.json>. See the header of packages/ai/scripts/court-test.ts.');
    return 2;
  }
  if (example && !EXAMPLE_INPUTS[example]) {
    console.error('--example must be solo, versus or viral');
    return 2;
  }
  const input: unknown = example ? EXAMPLE_INPUTS[example] : JSON.parse((await readFile(casePath as string, 'utf8')).replace(/^\uFEFF/, ''));

  const provider = opt('provider') as 'mock' | '0g' | undefined;
  const logger = flag('log') ? jsonLineLogger((l) => process.stderr.write(`${l}\n`)) : silentLogger;
  let client: InferenceClient;
  if (flag('scripted')) {
    if (!example) throw new Error('--scripted needs --example');
    client = new MockInferenceClient({ responses: [exampleScript(example)] });
  } else {
    client = createInferenceClient(loadCourtAIConfig(process.env, provider ? { provider } : {}), { logger });
  }
  printBanner(client);
  if (flag('scripted')) console.log(' Scripted: replaying the hand-written reference script (no model involved).');

  const prepared = prepareCase(input);
  const court = new CourtAI(client, { logger });
  const save = opt('save');
  const transcript = save ? await getOrGenerateTrial(new FileTranscriptStore(save), court, prepared) : await court.generateTrial(prepared);
  if (save) console.log(` Stored at ${save}/${transcript.caseId}.json (re-runs replay this file; delete it to regenerate).`);
  printTranscript(transcript);

  let commentary: JudgeCommentary | null = null;
  const verdict = opt('verdict')?.toUpperCase() as CourtOutcome | undefined;
  if (verdict) {
    if (!OUTCOMES.includes(verdict)) throw new Error(`--verdict must be one of ${OUTCOMES.join(', ')}`);
    const result: FinalizedCaseResult = {
      caseId: transcript.caseId,
      mode: transcript.mode,
      status: verdict === 'CANCELLED' ? 'CANCELLED' : verdict === 'INVALID' ? 'INVALID' : 'FINALIZED',
      outcome: verdict,
      summary: transcript.analysis.core.slice(0, 300),
      title: transcript.title,
    };
    commentary = await court.generateVerdictCommentary(result, transcript);
    printCommentary(commentary);
  }
  if (flag('cues')) printCues(transcript, commentary);
  if (flag('json-out')) {
    rule('Transcript JSON');
    console.log(JSON.stringify(transcript, null, 2));
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    if (e instanceof CourtConfigError) console.error(`\n${e.message}\n\nSee docs/ai/10_0G_PROVIDER_INTEGRATION.md for setup.`);
    else if (e instanceof CaseRejectedError) console.error(`\nCase not filed (${e.code}): ${e.userMessage}${e.details.length ? `\n  - ${e.details.join('\n  - ')}` : ''}`);
    else if (e instanceof TrialGenerationError) {
      console.error(`\nTrial not generated (${e.code}): ${e.userMessage}`);
      for (const i of e.issues) console.error(`  - ${i.severity} ${i.code}${i.slot ? ` [${i.slot}]` : ''}: ${i.message}`);
      if (e.inference.requestIds.length) console.error(`  request ids: ${e.inference.requestIds.join(', ')}`);
    } else if (e instanceof InferenceError) console.error(`\n0G request failed (${e.code}${e.status ? `, HTTP ${e.status}` : ''}): ${e.message}${e.requestId ? `\n  request id: ${e.requestId}` : ''}`);
    else console.error(e);
    process.exit(1);
  });
