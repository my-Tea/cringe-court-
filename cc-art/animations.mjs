// Animation definitions — keyframe timelines over pose + expression + transform.
// Sprite-swap only: pose/expression snap, transform interpolates linearly.
import fs from 'node:fs';
import { POSE_IDS, IDLE_IDS } from './vox-base.mjs';

const K = (t, pose, expression, x = 0, y = 0, scale = 1, rot = 0, fx = null) =>
  ({ t, pose, expression, transform: { x, y, scale, rot }, ...(fx ? { fx } : {}) });

/** Shared reaction set — every fixed character uses the same timings so beats
 *  feel consistent when cut together. */
const shared = {
  idle: {
    id: 'idle', loop: true, duration: 2.0,
    tracks: [K(0, 'idle', 'neutral'), K(1.0, 'idle', 'neutral', 0, -2), K(2.0, 'idle', 'neutral')],
  },
  talk: {
    id: 'talk', loop: true, duration: 1.2,
    tracks: [
      K(0, 'talking', 'neutral'), K(0.3, 'talking', 'smug', 0, -1),
      K(0.6, 'talking', 'neutral'), K(0.9, 'talking', 'happy', 1, 0), K(1.2, 'talking', 'neutral'),
    ],
  },
  react_happy: {
    id: 'react_happy', loop: false, duration: 0.9,
    tracks: [K(0, 'idle', 'neutral'), K(0.15, 'happy', 'happy', 0, -8, 1.05, 2), K(0.6, 'happy', 'happy', 0, -4, 1.02, 1), K(0.9, 'idle', 'neutral')],
  },
  react_angry: {
    id: 'react_angry', loop: false, duration: 0.9,
    tracks: [K(0, 'idle', 'neutral'), K(0.1, 'angry', 'angry', 0, -4, 1.04, -2, 'shake'), K(0.4, 'angry', 'angry', 2, -3, 1.03, 1, 'shake'), K(0.7, 'angry', 'angry', -2, -2, 1.02, -1), K(0.9, 'idle', 'neutral')],
  },
  react_shocked: {
    id: 'react_shocked', loop: false, duration: 0.8,
    tracks: [K(0, 'idle', 'neutral'), K(0.1, 'shocked', 'shocked', 0, -10, 1.08, 0, 'impact'), K(0.5, 'shocked', 'shocked', 0, -7, 1.05, 0), K(0.8, 'idle', 'neutral')],
  },
  objection: {
    id: 'objection', loop: false, duration: 1.4, interrupt: 'talk',
    tracks: [
      K(0, 'idle', 'neutral'),
      K(0.15, 'objection', 'angry', 0, -6, 1.06, -2, 'shake'),
      K(0.55, 'objection', 'angry', 0, -6, 1.06, -2),
      K(0.9, 'talking', 'smug'),
      K(1.4, 'idle', 'neutral'),
    ],
  },
  defeated: {
    id: 'defeated', loop: false, duration: 1.6,
    tracks: [K(0, 'idle', 'neutral'), K(0.3, 'defeated', 'crying', 0, 14, 0.94, 0), K(1.2, 'defeated', 'crying', 0, 16, 0.93, 0), K(1.6, 'defeated', 'crying', 0, 16, 0.93, 0)],
  },
};

/** Character-specific signature override for the objection pose. */
const SIGNATURES = {
  judge:      { pose: 'objection', expression: 'angry', fx: 'shake',   callout: 'ORDER!' },
  prosecutor: { pose: 'objection', expression: 'angry', fx: 'impact',  callout: 'OBJECTION!' },
  defense:    { pose: 'objection', expression: 'confused', fx: 'flash', callout: 'COUNTER!' },
  juror:      { pose: 'objection', expression: 'shocked', fx: 'sweat', callout: '...' },
  clerk:      { pose: 'objection', expression: 'confused', fx: 'sweat', callout: '' },
  bailiff:    { pose: 'objection', expression: 'angry', fx: 'shake',   callout: 'ORDER!' },
  creator:    { pose: 'defeated', expression: 'crying', fx: 'tears',   callout: 'IT WAS A JOKE BRO!' },
};

/** Idle variants. Each plays ONCE (idle -> variant pose -> idle) and is picked by
 *  the runtime between base-idle loops (see STATE_MACHINE.idleVariants). Poses are
 *  the idle_a/b/c rig deltas in vox-chars.mjs IDLE. Weights sum to 1 per character. */
const IDLE_VARIANT_META = {
  judge:         [['idle_a', 'adjusts shades', 0.4], ['idle_b', 'taps gavel', 0.35], ['idle_c', 'strokes beard', 0.25]],
  prosecutor:    [['idle_a', 'arms crossed', 0.4], ['idle_b', 'foot-tap lean', 0.35], ['idle_c', 'flips hair', 0.25]],
  defense:       [['idle_a', 'shrug-lean', 0.4], ['idle_b', 'adjusts tie', 0.35], ['idle_c', 'reads paper', 0.25]],
  bailiff:       [['idle_a', 'adjusts cap', 0.35], ['idle_b', 'shifts weight', 0.4], ['idle_c', 'checks watch', 0.25]],
  clerk:         [['idle_a', 'flips papers', 0.4], ['idle_b', 'pushes glasses up', 0.35], ['idle_c', 'glances up', 0.25]],
  'ai-narrator': [['idle_a', 'hover bob, tilt right', 0.35], ['idle_b', 'leans in', 0.3], ['idle_c', 'hover bob, tilt left', 0.35]],
  juror:         [['idle_a', 'munches popcorn', 0.4], ['idle_b', 'leans back', 0.35], ['idle_c', 'leans in, engrossed', 0.25]],
  creator:       [['idle_a', 'hands in hoodie', 0.4], ['idle_b', 'scratches head', 0.3], ['idle_c', 'nervous sway', 0.3]],
};

function idleVariant(ch, [id, note, weight]) {
  return {
    id, character: ch, variantOf: 'idle', loop: false, interruptible: true, weight, duration: 2.4, note,
    tracks: [K(0, 'idle', 'neutral'), K(0.4, id, 'neutral'), K(1.8, id, 'neutral', 0, -1), K(2.4, 'idle', 'neutral')],
  };
}

const CHARACTERS = ['judge', 'prosecutor', 'defense', 'bailiff', 'clerk', 'juror', 'creator'];
const ANIM_ORDER = ['idle', 'talk', 'react_happy', 'react_angry', 'react_shocked', 'objection', 'defeated'];

/** Global scene animations — driven by the game loop, not a character. */
const SYSTEM = {
  enter_court: {
    id: 'enter_court', duration: 2.4,
    steps: [
      { t: 0.0, action: 'doors_open', sound: 'door_creak' },
      { t: 0.5, action: 'spotlight_on' },
      { t: 1.2, action: 'case_number_stamp', sound: 'stamp' },
      { t: 2.4, action: 'idle' },
    ],
  },
  case_accepted: { id: 'case_accepted', duration: 1.6, steps: [
    { t: 0.0, action: 'portrait_pop' }, { t: 0.4, action: 'stamp_charges_filed', sound: 'stamp' }, { t: 1.6, action: 'idle' }] },
  jury_seated: { id: 'jury_seated', duration: 2.0, steps: [
    { t: 0.0, action: 'seat_1' }, { t: 0.5, action: 'seat_2' }, { t: 1.0, action: 'seat_3' },
    { t: 1.5, action: 'badges_glow' }, { t: 2.0, action: 'idle' }] },
  bond_committed: { id: 'bond_committed', duration: 1.4, steps: [
    { t: 0.0, action: 'receipt_in', sound: 'coin' }, { t: 1.4, action: 'idle' }] },
  ballot_commit: { id: 'ballot_commit', duration: 1.6, steps: [
    { t: 0.0, action: 'ballot_rise' }, { t: 0.5, action: 'ballot_drop', sound: 'paper' },
    { t: 1.0, action: 'sealed_box_shut' }, { t: 1.6, action: 'idle' }] },
  ballot_reveal: { id: 'ballot_reveal', duration: 1.8, steps: [
    { t: 0.0, action: 'seals_unlock', sound: 'unlock' }, { t: 0.8, action: 'ballots_reveal' }, { t: 1.8, action: 'idle' }] },
  verdict_guilty: { id: 'verdict_guilty', duration: 2.2, steps: [
    { t: 0.0, action: 'gavel_strike', sound: 'gavel' }, { t: 0.3, action: 'lighting_shift_red', fx: 'flash' },
    { t: 0.6, action: 'card_guilty', fx: 'impact' }, { t: 2.2, action: 'idle' }] },
  verdict_not_cooked: { id: 'verdict_not_cooked', duration: 2.2, steps: [
    { t: 0.0, action: 'gavel_strike', sound: 'gavel' }, { t: 0.3, action: 'lighting_shift_green', fx: 'flash' },
    { t: 0.6, action: 'card_not_cooked', fx: 'impact' }, { t: 2.2, action: 'idle' }] },
  verdict_none: { id: 'verdict_none', duration: 2.0, steps: [
    { t: 0.0, action: 'card_no_verdict' }, { t: 2.0, action: 'idle' }] },
  settlement: { id: 'settlement', duration: 1.2, steps: [
    { t: 0.0, action: 'receipt_slide_in', sound: 'paper' }, { t: 1.2, action: 'idle' }] },
};

const STATE_MACHINE = {
  states: ['idle', 'talk', 'action', 'react'],
  looping: ['idle', 'talk'],
  idleVariants: {
    base: 'idle',
    variants: IDLE_IDS,
    selection: 'weighted-random',
    baseLoopsBeforeVariant: [2, 4],   // play base idle 2-4 full loops, then one variant
    noImmediateRepeat: true,          // never the same variant twice in a row
    afterVariant: 'idle',             // each variant is one-shot, returns to base idle
    perCharacter: 'animations[].weight (variantOf: "idle") gives each character its own weights',
  },
  oneShot: ['react_happy', 'react_angry', 'react_shocked', 'objection', 'defeated'],
  rules: [
    'idle and talk loop; everything else is one-shot.',
    'A one-shot interrupts any loop and blocks new triggers until it ends.',
    'objection may interrupt talk; other one-shots may not.',
    'Never leave a character mid-one-shot across a scene transition — snap to idle.',
    'Idle variants (idle_a/b/c) are NOT one-shots for blocking purposes: any trigger, talk, or reaction interrupts them immediately and snaps to the new state.',
    'Idle variants only start from base idle, never from talk or after a reaction without at least one fresh base-idle loop.',
    'While dialogue streams, alternate talk <-> idle on a 1.2-2.4s random interval.',
  ],
};

export function buildAnimationLibrary() {
  const lib = { schemaVersion: 1, characters: {}, system: SYSTEM, stateMachine: STATE_MACHINE };

  for (const ch of CHARACTERS) {
    const anims = ANIM_ORDER.map((id) => {
      const a = JSON.parse(JSON.stringify(shared[id]));
      a.character = ch;
      // apply the character's signature to their objection beat
      if (id === 'objection' && SIGNATURES[ch]) {
        const s = SIGNATURES[ch];
        a.tracks[1].pose = s.pose;
        a.tracks[1].expression = s.expression;
        if (s.fx) a.tracks[1].fx = s.fx;
        a.callout = s.callout;
      }
      return a;
    });
    anims.push(...IDLE_VARIANT_META[ch].map((m) => idleVariant(ch, m)));
    lib.characters[ch] = { id: ch, fixed: true, animations: anims };
  }

  // AI narrator is non-humanoid: state-driven, no poses
  lib.characters['ai-narrator'] = {
    id: 'ai-narrator', fixed: true, humanoid: false,
    animations: ['idle', 'loading', 'processing', 'success', 'failure', 'narration'].map((s) => ({
      id: s, loop: s === 'idle' || s === 'loading' || s === 'processing', states: [s],
      note: 'Sprite-state animator, not pose-based. Frame-swap the screen face.',
    })),
  };

  lib.characters['ai-narrator'].animations.push(...IDLE_VARIANT_META['ai-narrator'].map((m) => idleVariant('ai-narrator', m)));

  // player uses the same reaction set, gender-neutral
  lib.characters['player'] = {
    id: 'player', fixed: false, layered: true,
    animations: ANIM_ORDER.filter((x) => x !== 'objection').map((id) => ({ ...shared[id], character: 'player', id })),
  };

  return lib;
}

/** Throws if any keyframe references a pose that has no source, any idle
 *  variant set is incomplete, or weights are not a probability distribution.
 *  With `dir` (the dist/characters folder) it also checks the PNGs exist. */
export function validateAnimationLibrary(lib, dir = null) {
  const poses = new Set([...POSE_IDS, ...IDLE_IDS]);
  const errs = [];
  for (const [cid, c] of Object.entries(lib.characters)) {
    if (c.humanoid === false && !c.animations.some((a) => a.tracks)) continue;
    for (const a of c.animations) {
      for (const k of a.tracks || []) {
        if (!poses.has(k.pose)) errs.push(`${cid}/${a.id}: unknown pose ${k.pose}`);
        else if (dir && cid !== 'player' && !fs.existsSync(`${dir}/${cid}/poses/${k.pose}.png`)) errs.push(`${cid}/${a.id}: missing ${cid}/poses/${k.pose}.png`);
      }
    }
    if (cid !== 'player') {
      const v = c.animations.filter((a) => a.variantOf === 'idle');
      if (v.map((a) => a.id).join() !== IDLE_IDS.join()) errs.push(`${cid}: idle variants are ${v.map((a) => a.id)}`);
      const w = v.reduce((t, a) => t + a.weight, 0);
      if (Math.abs(w - 1) > 1e-6) errs.push(`${cid}: idle weights sum to ${w}`);
    }
  }
  if (errs.length) throw new Error('animation validation failed:\n  ' + errs.join('\n  '));
}

export function writeAnimationLibrary(outFile) {
  const lib = buildAnimationLibrary();
  validateAnimationLibrary(lib, outFile.replace(/animation\/[^/]*$/, 'characters'));
  fs.writeFileSync(outFile, JSON.stringify(lib, null, 2));
  const n = Object.values(lib.characters).reduce((a, c) => a + c.animations.length, 0);
  return { file: outFile, characters: Object.keys(lib.characters).length, animations: n, system: Object.keys(lib.system).length };
}
