import { RecordingAudio, RecordingScene } from '@cringe-court/core/testing';
import { ShowPlayer } from '@cringe-court/engine';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CASES, runDemoCourt, type DemoUpdate, type JuryPlan } from './demoCourt';

async function run(plan: JuryPlan) {
  const scene = new RecordingScene();
  const audio = new RecordingAudio();
  const player = new ShowPlayer({ scene, audio, sleep: () => Promise.resolve() });
  const updates: DemoUpdate[] = [];
  await runDemoCourt({ sample: SAMPLE_CASES[0]!, plan, scene, audio, player, onUpdate: (u) => updates.push(u), signal: new AbortController().signal });
  return { scene, audio, updates, last: updates.at(-1)! };
}

const net = (lines: readonly { kind: string; amount: bigint }[]) => lines.filter((l) => l.kind !== 'forfeit').reduce((s, l) => s + l.amount, 0n);

describe('demo court (engine + AI fixture + memory ledger, headless)', () => {
  it('guilty: verdict ceremony, sentence and V4 §9 receipts', async () => {
    const { scene, last, updates } = await run('guilty');
    expect(last.phase).toBe('done');
    expect(last.state).toMatchObject({ stage: 'verdict', verdict: { label: 'GUILTY', tally: [2, 1] } });
    expect(scene.of('system').map((c) => c.animation)).toEqual(
      expect.arrayContaining(['enter_court', 'case_accepted', 'jury_seated', 'ballot_commit', 'ballot_reveal', 'verdict_guilty', 'settlement']),
    );
    // The filer pays 1.20 and gets nothing back on a verdict; each juror gets 0.70.
    expect(last.receipts[0]!.lines).toEqual([]);
    for (const r of last.receipts.slice(1)) expect(net(r.lines)).toBe(700_000n);
    // While ballots were sealed the demo never reported a choice.
    expect(updates.filter((u) => u.phase === 'jury').every((u) => u.revealed === 0 || u.sealed === 3)).toBe(true);
  });

  it('mistrial: no verdict, full refund, the no-show forfeits', async () => {
    const { scene, last } = await run('mistrial');
    expect(last.state).toMatchObject({ stage: 'verdict', verdict: { kind: 'no-verdict' } });
    expect(scene.of('system').map((c) => c.animation)).toContain('verdict_none');
    expect(net(last.receipts[0]!.lines)).toBe(1_200_000n);
    expect(last.receipts.map((r) => net(r.lines))).toEqual([1_200_000n, 600_000n, 600_000n, 0n]);
  });

  it('not cooked: the defense wins', async () => {
    const { last } = await run('not-cooked');
    expect(last.state).toMatchObject({ verdict: { label: 'NOT COOKED', tally: [1, 2] } });
  });

  it('stops cleanly when aborted', async () => {
    const scene = new RecordingScene();
    const audio = new RecordingAudio();
    const player = new ShowPlayer({ scene, audio, sleep: () => Promise.resolve() });
    const ctrl = new AbortController();
    const p = runDemoCourt({
      sample: SAMPLE_CASES[1]!,
      plan: 'guilty',
      scene,
      audio,
      player,
      onUpdate: (u) => {
        if (u.phase === 'trial') ctrl.abort();
      },
      signal: ctrl.signal,
    });
    await expect(p).rejects.toThrow(/stopped/);
  });
});
