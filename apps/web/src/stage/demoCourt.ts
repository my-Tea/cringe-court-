/**
 * The demo court: one complete Solo case run through the real engine, the real
 * AI service (with its offline fixture client), the in-memory ledger twin and the
 * mock World ID. Nothing here is a mode UI; it proves the engine end to end and
 * gives every mode track a reference for wiring a trial to the stage.
 */
import { t, type MessageKey } from '@/i18n';
import { createFixtureCounsel } from '@cringe-court/ai';
import { BASE_MODES, formatCaseNumber, trialId, usdc, type AudioPort, type BallotChoice, type CaseNumber, type Hex, type ReceiptLine, type ScenePort, type TrialState } from '@cringe-court/core';
import { ManualClock, MemoryChain, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import type {
  ShowPlayer} from '@cringe-court/engine';
import {
  JurorSession,
  TrialEngine,
  directBallotCommitted,
  directCaseOpened,
  directJurySeated,
  directReveal,
  directSettlement,
  directTrial,
  directVerdict,
} from '@cringe-court/engine';

/** Demo content: the text fields resolve through the catalog each time they are read, so they follow the active locale. */
export interface SampleCase {
  id: string;
  title: string;
  category: 'crypto-crimes' | 'dating-crimes' | 'npc-behavior' | 'internet-crimes';
  story: string;
  privateNotes: string;
  angle: string;
  exhibit: { title: string; body: string };
}

type SampleKey = 'replyAll' | 'diamondHands' | 'ghosted';

function sample(id: string, key: SampleKey, category: SampleCase['category']): SampleCase {
  const k = (field: string) => `solo.stage.sample.${key}.${field}` as MessageKey;
  return {
    id,
    category,
    get title() {
      return t(k('title'));
    },
    get story() {
      return t(k('story'));
    },
    get privateNotes() {
      return t(k('notes'));
    },
    get angle() {
      return t(k('angle'));
    },
    get exhibit() {
      return { title: t(k('exhibitTitle')), body: t(k('exhibitBody')) };
    },
  };
}

export const SAMPLE_CASES: readonly SampleCase[] = [
  sample('reply-all', 'replyAll', 'internet-crimes'),
  sample('diamond-hands', 'diamondHands', 'crypto-crimes'),
  sample('ghosted', 'ghosted', 'dating-crimes'),
];

/** How the simulated jury votes, so every verdict screen can be shown. */
export type JuryPlan = 'guilty' | 'not-cooked' | 'mistrial';

const PLANS: Readonly<Record<JuryPlan, readonly (BallotChoice | null)[]>> = {
  guilty: [0, 0, 1],
  'not-cooked': [1, 1, 0],
  // One juror never commits and the other two split: NO VERDICT, full refund.
  mistrial: [0, 1, null],
};

export type DemoPhase = 'preparing' | 'opening' | 'trial' | 'jury' | 'verdict' | 'done';

export interface DemoUpdate {
  phase: DemoPhase;
  state: TrialState;
  caseLabel: string | null;
  caseNumber: CaseNumber | null;
  /** Sealed-ballot count only during commit; no choices until reveal. */
  sealed: number;
  revealed: number;
  receipts: { party: string; lines: readonly ReceiptLine[] }[];
  log: string;
}

export interface DemoOptions {
  sample: SampleCase;
  plan: JuryPlan;
  scene: ScenePort;
  audio: AudioPort;
  player: ShowPlayer;
  onUpdate: (update: DemoUpdate) => void;
  signal: AbortSignal;
}

export async function runDemoCourt({ sample, plan, scene, player, onUpdate, signal }: DemoOptions): Promise<void> {
  const clock = new ManualClock();
  const chain = new MemoryChain({ clock: clock.now, firstCase: 69 + SAMPLE_CASES.indexOf(sample) });
  const filer = testAddress('demo-filer');
  const jurors = [1, 2, 3].map((i) => testAddress(`demo-juror-${i}`));
  chain.mint(filer, usdc('5'));
  jurors.forEach((j) => chain.mint(j, usdc('2')));
  const salts = new MemorySaltVault('demo');
  const mode = BASE_MODES.solo;
  const engine = new TrialEngine({
    id: trialId(`demo-${sample.id}`),
    mode,
    ports: { counsel: createFixtureCounsel(), chain: chain.as(filer) },
    category: sample.category,
    title: sample.title,
    filer,
    clock: clock.now,
  });
  let phase: DemoPhase = 'preparing';
  let sealed = 0;
  let revealed = 0;
  let receipts: DemoUpdate['receipts'] = [];
  const update = (log: string) => onUpdate({ phase, state: engine.state, caseLabel: engine.caseLabel, caseNumber: engine.caseNumber, sealed, revealed, receipts, log });
  const check = () => {
    if (signal.aborted) throw new DOMException(t('solo.stage.run.stopped'), 'AbortError');
  };
  const play = async (show: Parameters<ShowPlayer['play']>[0]) => {
    check();
    await player.play(show, { signal });
    check();
  };

  try {
    update(t('solo.stage.run.filing'));
    engine.editFiling('a', { story: sample.story, privateNotes: sample.privateNotes, angle: sample.angle });
    engine.submitFiling();
    engine.addExhibit({ id: 'exhibit-a', submittedBy: 'a', kind: 'quote', title: sample.exhibit.title, body: sample.exhibit.body, redacted: true });
    update(t('solo.stage.run.drafting'));
    await engine.approveEvidence('a', signal);
    await engine.approveDraft('a');
    await engine.fund();
    const caseNumber = engine.caseNumber as CaseNumber;
    phase = 'opening';
    update(t('solo.stage.run.opened', { caseNumber: formatCaseNumber(caseNumber) }));

    scene.setCast(mode.staging(engine.state.terms));
    await play(directCaseOpened(formatCaseNumber(caseNumber)));

    const s = engine.state;
    if (s.stage !== 'jury') throw new Error(`Expected the jury stage, got ${s.stage}`);
    phase = 'trial';
    update(t('solo.stage.run.trial'));
    await play(directTrial(`trial-${sample.id}`, s.transcript.lines, mode.staging(s.terms)));

    phase = 'jury';
    update(t('solo.stage.run.seats'));
    const sessions = jurors.map(
      (j, i) => new JurorSession({ caseNumber, ports: { chain: chain.as(j), identity: new MockIdentity({ human: `demo-human-${i}` }), salts }, clock: clock.now }),
    );
    for (const session of sessions) {
      const screened = await session.screen();
      if (!screened.ok) throw new Error(screened.message);
      const seated = await session.takeSeat();
      if (!seated.ok) throw new Error(seated.message);
    }
    await engine.sync();
    await play(directJurySeated(3));

    const votes = PLANS[plan];
    for (const [i, session] of sessions.entries()) {
      const choice = votes[i];
      if (choice === null || choice === undefined) continue;
      await session.commit(choice);
      sealed++;
      update(t('solo.stage.run.sealed', { n: i + 1 }));
      await play(directBallotCommitted());
    }
    clock.advance(s.terms.deadlines.commit);
    await engine.tick();
    update(t('solo.stage.run.commitClosed'));
    await play(directReveal());
    for (const [i, session] of sessions.entries()) {
      if (votes[i] === null) continue;
      await session.reveal();
      revealed++;
    }
    clock.advance(s.terms.deadlines.reveal);
    await engine.tick();

    phase = 'verdict';
    const sentence = await engine.readSentence(signal);
    const v = engine.state;
    if (v.stage !== 'verdict') throw new Error(`Expected a verdict, got ${v.stage}`);
    update(t('solo.stage.run.verdict', { label: v.verdict.label }));
    await play(directVerdict(v.verdict, mode.staging(v.terms), sentence));

    for (const [i, session] of sessions.entries()) {
      const claimed = await session.claim();
      receipts.push({ party: t('solo.stage.run.juror', { n: i + 1 }), lines: claimed.ok ? claimed.value : await chain.receipts(caseNumber, jurors[i]!) });
    }
    if (v.verdict.kind === 'no-verdict') await chain.as(filer).claim(caseNumber);
    receipts = [{ party: t('solo.stage.run.filer'), lines: await chain.receipts(caseNumber, filer as Hex) }, ...receipts];
    await play(directSettlement());
    phase = 'done';
    update(t('solo.stage.run.done'));
  } finally {
    engine.dispose();
  }
}
