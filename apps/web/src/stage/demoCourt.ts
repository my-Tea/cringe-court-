/**
 * The demo court: one complete Solo case run through the real engine, the real
 * AI service (with its offline fixture client), the in-memory ledger twin and the
 * mock World ID. Nothing here is a mode UI; it proves the engine end to end and
 * gives every mode track a reference for wiring a trial to the stage.
 */
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

export interface SampleCase {
  id: string;
  title: string;
  category: 'crypto-crimes' | 'dating-crimes' | 'npc-behavior' | 'internet-crimes';
  story: string;
  privateNotes: string;
  angle: string;
  exhibit: { title: string; body: string };
}

export const SAMPLE_CASES: readonly SampleCase[] = [
  {
    id: 'reply-all',
    title: 'Replied-all with a frog meme',
    category: 'internet-crimes',
    story: 'I replied-all to a 400-person company thread with a dancing frog GIF. It was the CEO’s retirement announcement.',
    privateNotes: 'I thought it was the team chat. The frog was wearing a tiny tie.',
    angle: 'The frog was a tribute to a long and hoppy career.',
    exhibit: { title: 'The frog', body: 'A 3-second GIF of a frog in a tie, dancing. Sent 09:02, read by 400.' },
  },
  {
    id: 'diamond-hands',
    title: 'Bought the top, called it a strategy',
    category: 'crypto-crimes',
    story: 'I bought a dog-themed coin at its all-time high and told my group chat it was “a long-term position”.',
    privateNotes: 'I panic-sold 40 minutes later.',
    angle: 'Market conditions were emotionally unavailable.',
    exhibit: { title: 'The group chat', body: '“Zoom out, boys. Generational wealth.” — sent 2 minutes before the dip.' },
  },
  {
    id: 'ghosted',
    title: 'Left on read for 6 business days',
    category: 'dating-crimes',
    story: 'I left a second date on read for six business days, then replied “haha sorry just saw this”.',
    privateNotes: 'I had been composing the perfect reply the whole time.',
    angle: 'Perfection takes time. Six business days, to be exact.',
    exhibit: { title: 'Read receipt', body: 'Read Tue 19:14. Replied the following Wednesday, 23:58.' },
  },
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
    if (signal.aborted) throw new DOMException('Demo stopped', 'AbortError');
  };
  const play = async (show: Parameters<ShowPlayer['play']>[0]) => {
    check();
    await player.play(show, { signal });
    check();
  };

  try {
    update('Filing the confession…');
    engine.editFiling('a', { story: sample.story, privateNotes: sample.privateNotes, angle: sample.angle });
    engine.submitFiling();
    engine.addExhibit({ id: 'exhibit-a', submittedBy: 'a', kind: 'quote', title: sample.exhibit.title, body: sample.exhibit.body, redacted: true });
    update('Counsel Chaos and Miss Ratio are drafting…');
    await engine.approveEvidence('a', signal);
    await engine.approveDraft('a');
    await engine.fund();
    const caseNumber = engine.caseNumber as CaseNumber;
    phase = 'opening';
    update(`${formatCaseNumber(caseNumber)} opened. 1.20 test USDC in escrow.`);

    scene.setCast(mode.staging(engine.state.terms));
    await play(directCaseOpened(formatCaseNumber(caseNumber)));

    const s = engine.state;
    if (s.stage !== 'jury') throw new Error(`Expected the jury stage, got ${s.stage}`);
    phase = 'trial';
    update('The trial is in session.');
    await play(directTrial(`trial-${sample.id}`, s.transcript.lines, mode.staging(s.terms)));

    phase = 'jury';
    update('Three verified jurors take their seats.');
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
      update(`Juror ${i + 1} sealed a ballot.`);
      await play(directBallotCommitted());
    }
    clock.advance(s.terms.deadlines.commit);
    await engine.tick();
    update('The commit window closed. Opening the scrolls…');
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
    update(`The jury says ${v.verdict.label}.`);
    await play(directVerdict(v.verdict, mode.staging(v.terms), sentence));

    for (const [i, session] of sessions.entries()) {
      const claimed = await session.claim();
      receipts.push({ party: `Juror ${i + 1}`, lines: claimed.ok ? claimed.value : await chain.receipts(caseNumber, jurors[i]!) });
    }
    if (v.verdict.kind === 'no-verdict') await chain.as(filer).claim(caseNumber);
    receipts = [{ party: 'You (the filer)', lines: await chain.receipts(caseNumber, filer as Hex) }, ...receipts];
    await play(directSettlement());
    phase = 'done';
    update('Case closed. Receipts are below.');
  } finally {
    engine.dispose();
  }
}
