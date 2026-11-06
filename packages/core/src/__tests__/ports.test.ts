import { describe, expect, it } from 'vitest';
import {
  ANIMATION_SOUND_CUES,
  AUDIO_CUES,
  BASE_MODES,
  ChainError,
  MODE_IDS,
  ModeRegistry,
  briefsFor,
  createModeRegistry,
  extendMode,
  formatUsdc,
  usdc,
  type Filing,
} from '../index';
import { MockIdentity, createMockPorts, testAddress } from '../testing';

describe('ModeRegistry', () => {
  it('ships the three base modes and rejects duplicates', () => {
    const r = createModeRegistry();
    expect(r.list().map((m) => m.id)).toEqual([...MODE_IDS]);
    expect(() => r.register(BASE_MODES.solo)).toThrow(/already registered/);
    r.register(extendMode(BASE_MODES.solo, { rules: { maxExhibits: 3 } }), { replace: true });
    expect(r.get('solo').rules.maxExhibits).toBe(3);
    expect(() => new ModeRegistry().get('versus')).toThrow(/not registered/);
  });

  it('validates benches against sides', () => {
    const broken = extendMode(BASE_MODES.solo, { benches: [BASE_MODES.solo.benches[0], { ...BASE_MODES.solo.benches[1], client: 'b' }] });
    expect(() => new ModeRegistry().register(broken)).toThrow(/not a side/);
  });

  it('stages 3 or 7 jurors per mode', () => {
    for (const def of Object.values(BASE_MODES)) {
      const cast = def.staging(def.terms());
      expect(cast.filter((c) => c.character === 'juror')).toHaveLength(def.terms().jurySize);
      expect(cast.some((c) => c.actor === 'judge' && c.mark === 'bench')).toBe(true);
    }
  });
});

describe('information wall (D1)', () => {
  const filing: Filing = {
    category: 'dating-crimes',
    title: 'Ghosted after brunch',
    context: '',
    sides: {
      a: { account: null, story: 'A: I left brunch early.', privateNotes: 'SECRET-A', angle: 'Brunch was 4 hours', nickname: null },
      b: { account: null, story: 'B: They ghosted me.', privateNotes: 'SECRET-B', angle: null, nickname: 'Brunch Victim' },
    },
  };

  it('Solo: Miss Ratio (NPC) sees only public text', () => {
    const [p, d] = briefsFor(BASE_MODES.solo.benches, { ...filing, sides: { a: filing.sides.a! } });
    expect(p).toEqual({ choice: 0, role: 'prosecution', counsel: 'prosecutor', client: null, publicText: 'A: I left brunch early.' });
    expect(d).toMatchObject({ client: 'a', privateNotes: 'SECRET-A', angle: 'Brunch was 4 hours' });
  });

  it('Versus: each agent sees only its own private notes', () => {
    const briefs = briefsFor(BASE_MODES.versus.benches, filing);
    expect(JSON.stringify(briefs[0])).not.toContain('SECRET-B');
    expect(JSON.stringify(briefs[1])).not.toContain('SECRET-A');
    expect(briefs[1]).toMatchObject({ nickname: 'Brunch Victim', publicText: 'B: They ghosted me.' });
  });

  it('Grand Jury: both positions argue from the context card', () => {
    const briefs = briefsFor(BASE_MODES['grand-jury'].benches, { ...filing, sides: {}, context: 'Is cereal soup?' });
    expect(briefs.map((b) => b.publicText)).toEqual(['Is cereal soup?', 'Is cereal soup?']);
  });
});

describe('MemoryChain', () => {
  it('runs a Solo case end to end with commit–reveal and exact payouts', async () => {
    const ports = createMockPorts();
    const { chain, clock, salts } = ports;
    const filer = testAddress('filer');
    const jurors = [1, 2, 3].map((i) => testAddress(`j${i}`));
    chain.mint(filer, usdc('5'));
    jurors.forEach((j) => chain.mint(j, usdc('1')));

    const terms = BASE_MODES.solo.terms();
    const { caseNumber } = await chain.as(filer).createCase({ terms, transcriptHash: `0x${'ab'.repeat(32)}`, payers: [filer], title: 'Reply-all' });
    expect(caseNumber).toBe(69);
    await expect(chain.as(filer).fund(caseNumber, usdc('1.00'))).rejects.toThrow(/share is 1.20/);
    await chain.as(filer).fund(caseNumber, usdc('1.20'));
    expect((await chain.getCase(caseNumber))?.phase).toBe('recruiting');
    await expect(chain.as(filer).acceptSeat(caseNumber, `0x${'01'.repeat(32)}`)).rejects.toThrow(ChainError);

    for (const [i, j] of jurors.entries()) await chain.as(j).acceptSeat(caseNumber, `0x${String(i + 10).repeat(32)}`);
    expect((await chain.getCase(caseNumber))?.phase).toBe('commit');

    const choices = [0, 0, 1] as const;
    for (const [i, j] of jurors.entries()) {
      const salt = salts.newSalt();
      const commitment = chain.commitmentFor(caseNumber, j, choices[i]!, salt);
      await salts.save({ caseNumber, juror: j, choice: choices[i]!, salt, commitment, savedAt: clock.now() });
      await chain.as(j).commit(caseNumber, commitment);
    }
    const midCommit = await chain.getCase(caseNumber);
    expect(midCommit?.seats.every((s) => s.committed && s.choice === undefined)).toBe(true);
    await expect(chain.as(jurors[0]!).reveal(caseNumber, 0, salts.newSalt())).rejects.toThrow(/not reveal/);

    clock.advance(terms.deadlines.commit);
    const wrong = await salts.load(caseNumber, jurors[0]!);
    await expect(chain.as(jurors[0]!).reveal(caseNumber, 1, wrong!.salt)).rejects.toThrow(/do not match/);
    for (const j of jurors) {
      const b = await salts.load(caseNumber, j);
      await chain.as(j).reveal(caseNumber, b!.choice, b!.salt);
    }
    clock.advance(terms.deadlines.reveal);
    await chain.finalize(caseNumber);
    const settled = await chain.getCase(caseNumber);
    expect(settled?.verdict).toMatchObject({ label: 'GUILTY', tally: [2, 1] });
    for (const j of jurors) await chain.as(j).claim(caseNumber);
    expect(formatUsdc(await chain.usdcBalance(jurors[0]!))).toBe('1.30 USDC');
    expect((await chain.receipts(caseNumber, jurors[2]!)).map((l) => l.kind)).toEqual(['bond-returned', 'reward']);
    await expect(chain.as(jurors[0]!).claim(caseNumber)).rejects.toThrow(/Already claimed/);
  });

  it('cancels and refunds when funding or recruitment misses its deadline', async () => {
    const { chain, clock } = createMockPorts();
    const c1 = testAddress('c1');
    chain.mint(c1, usdc('10'));
    const terms = BASE_MODES['grand-jury'].terms();
    const { caseNumber } = await chain.createCase({ terms, transcriptHash: `0x${'cd'.repeat(32)}`, payers: [], title: 'Soup?' });
    await expect(chain.as(c1).fund(caseNumber, usdc('0.05'))).rejects.toThrow(/Minimum/);
    await chain.as(c1).fund(caseNumber, usdc('3'));
    clock.advance(48 * 3600);
    expect((await chain.getCase(caseNumber))?.phase).toBe('cancelled');
    await chain.as(c1).claim(caseNumber);
    expect(await chain.usdcBalance(c1)).toBe(usdc('10'));
  });
});

describe('identity, jury pool and audio vocab', () => {
  it('MockIdentity: success, reuse, conflict and the unhappy paths', async () => {
    const id = new MockIdentity({ human: 'alice' });
    const req = { action: 'accept-jury-seat' as const, signal: 'case:69' };
    const r = await id.requestProof(req);
    if (!r.ok) throw new Error();
    expect(await id.verify(r.proof, req)).toMatchObject({ ok: true });
    expect(await id.verify(r.proof, req)).toMatchObject({ ok: false, reason: 'already-used' });
    expect(await id.verify(r.proof, { ...req, signal: 'case:70' }, { exclude: [r.proof.nullifierHash] })).toMatchObject({ reason: 'conflicted' });
    id.behaviour = 'cancelled';
    expect(await id.requestProof(req)).toMatchObject({ ok: false, reason: 'cancelled' });
  });

  it('MockJury: seeded draws exclude parties and are reproducible', async () => {
    const { jury } = createMockPorts();
    for (let i = 0; i < 10; i++) await jury.enlist({ juror: testAddress(`p${i}`), nullifier: `0x${String(i).padStart(64, '0')}`, modes: ['solo'] });
    const req = { caseNumber: 69 as never, mode: 'solo' as const, category: 'internet-crimes' as const, title: 't', bond: usdc('0.40'), seats: 3, exclude: [testAddress('p0')], seed: `0x${'11'.repeat(32)}` as const, expiresAt: 2e9 };
    const a = await jury.draw(req);
    const b = await new (jury.constructor as new () => typeof jury)().draw(req);
    expect(a).toHaveLength(6);
    expect(a.map((o) => o.juror)).not.toContain(testAddress('p0'));
    expect(b).toHaveLength(0);
    expect((await jury.respond(a[0]!.id, 'accepted')).status).toBe('accepted');
  });

  it('every animations.json sound maps to a known cue', () => {
    for (const cue of Object.values(ANIMATION_SOUND_CUES)) expect(AUDIO_CUES).toContain(cue);
  });
});
