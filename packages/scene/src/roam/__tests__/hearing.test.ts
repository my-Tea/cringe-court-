import { beforeAll, describe, expect, it } from 'vitest';
import { beatScript } from '../beats';
import { RoamController, ROLE_SEAT } from '../controller';
import { estimateSeconds, FAST_FORWARD, HEARING_PACE, type HearingPace } from '../pace';
import type { BeatId, BeatOptions, DialogueLine, PlayerRole, RoamWorld } from '../types';
import { PLAYER_JURY_SLOT } from '../world';
import { roamData } from './fixtures';

let world: RoamWorld;
beforeAll(async () => {
  world = (await roamData()).world;
});

const say = (speaker: string, text: string): DialogueLine => ({ speaker, text });

/**
 * A typical Solo hearing, line for line the shape DemoCounsel writes
 * (packages/modes-solo/src/demoCounsel.ts): 13 lines, ~1,400 characters,
 * grouped into beats the way apps/web/src/trial/beats.ts groups them.
 */
const HEARING: ReadonlyArray<{ id: BeatId; options: BeatOptions }> = [
  { id: 'all-rise', options: { lines: [say('judge', 'ORDER! Court is in session. The case of “The 3 a.m. Thread”. Miss Ratio, you may begin.')] } },
  {
    id: 'opening',
    options: {
      lines: [
        say('prosecutor', 'The facts, Your Honor: I posted a 14-part thread about why my microwave is sentient. The defendant had every chance to log off.'),
        say('defense', 'Counsel Chaos for the defense. Our position is simple: “Context is everything.” My client is not cooked. My client is marinating.'),
      ],
    },
  },
  {
    id: 'counsel-arguing',
    options: {
      lines: [
        say('prosecutor', 'I present Exhibit A, “The Post”: a screenshot timestamped 03:12 with two likes. The jury may gasp now.'),
        say('defense', 'Exhibit B, “The Receipts”, shows a human being doing their best: a laminated folder of replies.'),
        say('prosecutor', 'I present Exhibit C, “The Sticky Note”: it was a bit. The jury may gasp now.'),
        say('prosecutor', 'OBJECTION! The defense is calling a pattern of behaviour “context”. That is not context, that is a rap sheet.'),
        say('defense', 'Counter! A rap sheet needs a crime. Being a little bit cringe in public is called being alive, Miss Ratio.'),
        say('judge', 'The court notes a gasp from the gallery. The gallery will remain seated.'),
        say('prosecutor', 'Members of the jury: you saw it, you felt it, you cringed. Vote GUILTY and let the record show it.'),
        say('defense', 'Members of the jury: everyone has a day like this. Vote NOT COOKED. Let bro cook.'),
      ],
    },
  },
  { id: 'jury-deliberating', options: { lines: [say('judge', 'The jury will now seal its verdict in secret. THE JURY IS OUT.')] } },
  { id: 'verdict', options: { verdict: 'guilty' } },
];

const scripts = (pace: HearingPace, party = true) => HEARING.map((b) => beatScript(b.id, { ...b.options, pace, party }));

/** Play every beat with no input, the way a watching player sees it; returns simulated seconds. */
async function watch(c: RoamController, beats = HEARING, dt = 1 / 30): Promise<number> {
  let t = 0;
  for (const b of beats) {
    let done = false;
    void c.runBeat(b.id, b.options).then(() => (done = true));
    for (let i = 0; i < 20000 && !done; i++) {
      c.update(dt);
      t += dt;
      await Promise.resolve();
    }
    expect(done, `${b.id} finished`).toBe(true);
  }
  return t;
}

describe('hearing pace', () => {
  it('a standard first-person hearing is slow enough to read: 2 to 3 minutes for 13 lines', () => {
    const standard = estimateSeconds(scripts('standard'), HEARING_PACE.standard);
    const full = estimateSeconds(scripts('full'), HEARING_PACE.full);
    expect(standard).toBeGreaterThanOrEqual(120);
    expect(standard).toBeLessThanOrEqual(180);
    expect(full).toBeGreaterThan(standard * 1.3);
  });

  it('highlights keep the scene-setters and the punchlines, and run far shorter than the whole hearing', () => {
    const steps = scripts('highlights');
    const said = steps.flat().filter((s) => s.kind === 'say');
    const secs = estimateSeconds(steps, HEARING_PACE.highlights);
    expect(secs).toBeLessThan(estimateSeconds(scripts('standard'), HEARING_PACE.standard) * 0.7);
    expect(said.some((s) => s.kind === 'say' && s.text.startsWith('OBJECTION!'))).toBe(true);
    expect(said.some((s) => s.kind === 'say' && s.text.startsWith('ORDER!'))).toBe(true);
    // The verdict is never trimmed: both judge lines and the callout stay.
    const verdict = steps.at(-1)!;
    expect(verdict.filter((s) => s.kind === 'say')).toHaveLength(2);
    expect(verdict.some((s) => s.kind === 'callout' && s.style === 'verdict')).toBe(true);
  });

  it('the estimate matches a real watched run of the controller (within 5 %)', async () => {
    const c = new RoamController(world, { spawn: 'defendant', pace: 'standard' });
    const watched = await watch(c);
    const est = estimateSeconds(scripts('standard'), HEARING_PACE.standard);
    expect(Math.abs(watched - est) / est).toBeLessThan(0.05);
  });

  it('fast-forward plays the same lines about FAST_FORWARD× quicker, verdict included', async () => {
    const lines: string[] = [];
    const c = new RoamController(world, { spawn: 'defendant' });
    c.subscribe((e) => e.type === 'dialogue' && e.line && lines.push(e.line.text));
    c.setFastForward(true);
    const fast = await watch(c);
    const slow = await watch(new RoamController(world, { spawn: 'defendant' }));
    expect(fast).toBeLessThan(slow / (FAST_FORWARD - 0.5));
    expect(lines).toContain('The jury finds the defendant... GUILTY of cringe. Sentence: the post stays up.');
  });

  it('a transcript line is said once: all-rise and jury-out no longer repeat it', () => {
    for (const b of HEARING) {
      const said = beatScript(b.id, b.options).filter((s) => s.kind === 'say').map((s) => (s.kind === 'say' ? s.text : ''));
      expect(new Set(said).size, b.id).toBe(said.length);
    }
  });

  it('the hearing keeps real time on a slow device: long frames are not dropped from hearing time', async () => {
    const at = (dt: number) => watch(new RoamController(world, { spawn: 'defendant' }), HEARING.slice(0, 3), dt);
    const smooth = await at(1 / 60);
    const choppy = await at(0.5);
    // Each step rounds up to a frame, so a choppy run drifts a little. It must not lose whole lines.
    expect(Math.abs(choppy - smooth) / smooth).toBeLessThan(0.1);
  });

  it('the previous beat’s last line is gone when the next beat starts (B18)', async () => {
    const c = new RoamController(world, { spawn: 'defendant' });
    await watch(c, HEARING.slice(0, 2));
    expect(c.snapshot().dialogue).toBeNull();
  });
});

describe('seating by role (B6)', () => {
  const roles: PlayerRole[] = ['defendant', 'side-a', 'side-b', 'juror', 'spectator'];
  const expected: Record<PlayerRole, { seat: string; zone: string }> = {
    defendant: { seat: 'defendant', zone: 'defendant-table' },
    'side-a': { seat: 'prosecution', zone: 'prosecution-table' },
    'side-b': { seat: 'defendant', zone: 'defendant-table' },
    juror: { seat: 'jury-box', zone: 'jury-box' },
    spectator: { seat: 'gallery-left', zone: 'gallery' },
  };

  for (const role of roles) {
    it(`a ${role} is seated at the ${expected[role].seat} for every beat, and the HUD says so`, () => {
      expect(ROLE_SEAT[role]).toBe(expected[role].seat);
      const c = new RoamController(world, { role, spawn: 'aisle' });
      for (const b of HEARING) {
        void c.runBeat(b.id, b.options);
        expect(c.seat, b.id).toBe(expected[role].seat);
        expect(c.snapshot().zone).toBe(expected[role].zone);
        c.skipBeat();
      }
    });
  }

  it('a juror in the box watches the bench when the jury retires, not a neighbour at point-blank range', () => {
    const c = new RoamController(world, { role: 'juror', spawn: 'aisle' });
    const judge = world.marks.judge!;
    const jury = world.marks.jury!;
    const off = (target: readonly number[]) => {
      const v = c.view();
      const yaw = Math.atan2(-(target[0]! - v.eye[0]), -(target[2]! - v.eye[2]));
      return Math.abs(Math.atan2(Math.sin(v.yaw - yaw), Math.cos(v.yaw - yaw)));
    };
    let sawJuryOut = false;
    c.subscribe((e) => e.type === 'callout' && e.style === 'jury-out' && (sawJuryOut = true));
    void c.runBeat('jury-deliberating', { lines: [say('judge', 'THE JURY IS OUT.')] });
    // Play to the "look at the jury" step: just after the JURY IS OUT callout.
    for (let i = 0; i < 600 && !sawJuryOut; i++) c.update(1 / 30);
    for (let i = 0; i < 20; i++) c.update(1 / 30);
    expect(off(judge)).toBeLessThan(0.3);
    expect(off(jury)).toBeGreaterThan(0.5);
  });

  it('only parties rise for the verdict; jurors and spectators are not called "Defendant"', () => {
    const party = beatScript('verdict', { party: true });
    const juror = beatScript('verdict', { party: false });
    expect(party.some((s) => s.kind === 'stand')).toBe(true);
    expect(juror.some((s) => s.kind === 'stand')).toBe(false);
    const opener = (steps: typeof party) => steps.find((s) => s.kind === 'say')!;
    expect(opener(juror)).toMatchObject({ text: expect.not.stringContaining('Defendant') });
  });
});

describe('jury size', () => {
  const visibleJurors = (c: RoamController) => c.npcStates.filter((n) => n.id.startsWith('juror-') && !n.hidden).map((n) => n.id);

  it('shows a full box of seven by default (the sandbox, Grand Jury)', () => {
    expect(visibleJurors(new RoamController(world))).toHaveLength(7);
  });

  it('Solo and Versus fill only the front row with three', () => {
    expect(visibleJurors(new RoamController(world, { jurors: 3 }))).toEqual(['juror-1', 'juror-2', 'juror-3']);
  });

  it('a player juror takes a seat: six NPCs plus you in Grand Jury, two plus you in Versus', () => {
    const gj = new RoamController(world, { role: 'juror', jurors: 7 });
    expect(visibleJurors(gj)).toHaveLength(6);
    expect(visibleJurors(gj)).not.toContain(`juror-${PLAYER_JURY_SLOT + 1}`);
    expect(visibleJurors(new RoamController(world, { role: 'juror', jurors: 3 }))).toEqual(['juror-1', 'juror-2']);
  });

  it('whoever sits in the player seat takes it from that NPC juror, and gives it back on standing', () => {
    const c = new RoamController(world, { jurors: 7 });
    const third = () => c.npcStates.find((n) => n.id === `juror-${PLAYER_JURY_SLOT + 1}`)!;
    expect(third().hidden).toBeFalsy();
    c.sit('jury-box');
    expect(third().hidden).toBe(true);
    c.stand();
    expect(third().hidden).toBeFalsy();
  });
});
