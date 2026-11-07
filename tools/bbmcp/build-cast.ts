/**
 * Build the rest of the Blockbench cast (Chaos, Judge, Clerk, Bailiff,
 * Defendant/player, Jurors) at Miss-Ratio density.
 *
 *   npx tsx tools/bbmcp/build-cast.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHARED_SKIN,
  anim,
  basicArms,
  basicFace,
  basicLegs,
  bipedGroups,
  boot,
  box,
  exportHero,
  group,
  id,
  kf,
  put,
  shot,
} from './hero-kit.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const HEROES = path.join(ROOT, 'packages/scene/assets/roam/heroes');
const SHOTS = path.join(ROOT, '.bbshots/heroes');

async function writeManifest(
  outDir: string,
  data: { id: string; name: string; revision: string; clips: { id: string; exportName: string; loop: boolean; seconds: number }[]; notes: string[] },
) {
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        ...data,
        source: 'Blockbench MCP free-format',
        files: { glb: 'hero.glb', bbmodel: 'hero.bbmodel' },
        rebuild: 'npx tsx tools/bbmcp/build-cast.ts',
      },
      null,
      2,
    ),
  );
}

async function finishShots(prefix: string) {
  const dir = path.join(SHOTS, prefix);
  await shot(dir, 'front', [0, 21, 56], [0, 19, 0]);
  await shot(dir, 'threequarter', [38, 23, 38], [0, 19, 0]);
  await shot(dir, 'iso', [34, 32, 34], [0, 16, 0], 'orthographic');
}

async function standardClips(role: string, extra?: 'gavel' | 'point') {
  await anim(`${role}_idle`, 2.6, true, {
    hips: [kf(0, undefined, [0, 0, 0]), kf(1.3, undefined, [0, 0.2, 0]), kf(2.6)],
    torso: [kf(0, [1, 3, 0]), kf(1.3, [-1, 5, 0]), kf(2.6, [1, 3, 0])],
    head: [kf(0, [0, 4, 0]), kf(1.3, [2, 8, 0]), kf(2.6, [0, 4, 0])],
    armR: [kf(0, [10, 0, 10]), kf(1.3, [12, 0, 12]), kf(2.6, [10, 0, 10])],
    armL: [kf(0, [10, 0, -10]), kf(1.3, [12, 0, -12]), kf(2.6, [10, 0, -10])],
  });
  await anim(`${role}_talk`, 1.35, true, {
    head: [kf(0), kf(0.35, [3, 8, 0]), kf(0.7, [0, -4, 0]), kf(1.05, [3, 6, 0]), kf(1.35)],
    torso: [kf(0, [1, 3, 0]), kf(0.5, [4, 5, 0]), kf(1.35, [1, 3, 0])],
    forearmR: [kf(0, [-12, 0, 0]), kf(0.35, [-28, 0, 6]), kf(0.7, [-14, 0, 0]), kf(1.05, [-30, 0, 4]), kf(1.35, [-12, 0, 0])],
  });
  if (extra === 'point' || !extra) {
    await anim(`${role}_point`, 1.15, false, {
      torso: [kf(0, [1, 3, 0]), kf(0.2, [6, -6, 0]), kf(0.5, [9, -10, 0]), kf(0.9, [7, -8, 0]), kf(1.15, [1, 3, 0])],
      armR: [kf(0, [10, 0, 10]), kf(0.2, [-30, 0, 12]), kf(0.45, [-82, 10, 8]), kf(0.9, [-85, 10, 8]), kf(1.15, [10, 0, 10])],
      head: [kf(0, [0, 4, 0]), kf(0.45, [-4, -10, 0]), kf(1.15, [0, 4, 0])],
    });
  }
  await anim(`${role}_objection`, 1.25, false, {
    torso: [kf(0, [1, 3, 0]), kf(0.12, [-5, 0, 0]), kf(0.32, [12, -6, 0]), kf(0.7, [10, -8, 0]), kf(1.25, [1, 3, 0])],
    armR: [kf(0, [10, 0, 10]), kf(0.12, [20, 0, 14]), kf(0.35, [-90, 12, 6]), kf(0.75, [-94, 12, 6]), kf(1.25, [10, 0, 10])],
    armL: [kf(0, [10, 0, -10]), kf(0.35, [-18, 0, -16]), kf(1.25, [10, 0, -10])],
    head: [kf(0), kf(0.35, [-10, -8, 0]), kf(1.25)],
  });
  if (extra === 'gavel') {
    await anim(`${role}_gavel`, 1.2, false, {
      armR: [kf(0, [10, 0, 10]), kf(0.2, [-50, 0, 20]), kf(0.45, [-110, 0, 10]), kf(0.55, [-40, 0, 8]), kf(0.85, [-40, 0, 8]), kf(1.2, [10, 0, 10])],
      torso: [kf(0), kf(0.45, [8, 0, 0]), kf(0.55, [-4, 0, 0]), kf(1.2)],
      head: [kf(0), kf(0.45, [-6, 0, 0]), kf(0.55, [4, 0, 0]), kf(1.2)],
      prop: [kf(0), kf(0.45, [20, 0, 0]), kf(0.55, [-10, 0, 0]), kf(1.2)],
    });
  }
}

// ── Counsel Chaos ─────────────────────────────────────────────────────────
async function buildDefense() {
  const colours = {
    ...SHARED_SKIN,
    primary: '#1F4D3A',
    primaryDeep: '#143628',
    primaryHi: '#2E6A4E',
    hair: '#2B1F14',
    hairHi: '#3E2E20',
    hairEdge: '#4A3828',
    iris: '#2A4A38',
    irisDeep: '#1A3024',
    bandage: '#F0E6D2',
    case: '#3A2E22',
  };
  await boot('CC_CounselChaos_v1', colours);
  await bipedGroups({ wide: true });
  await group('quiff', [0, 36.2, -0.4], 'head');
  await basicLegs();
  await put('primary', 'torso', [
    box(id('body'), -4.1, 13.3, -2.15, 4.1, 26.8, 2.15),
    box(id('chest'), -3.7, 21.5, 0.4, 3.7, 26.5, 2.5),
    box(id('shR'), 2.5, 24.5, -1.7, 5.5, 27.4, 1.85),
    box(id('shL'), -5.5, 24.5, -1.7, -2.5, 27.4, 1.85),
  ]);
  await put('primaryDeep', 'torso', [box(id('under'), -3.6, 13.5, -2.4, 3.6, 21.5, -1.7)]);
  await put('accent', 'torso', [
    box(id('shirt'), -1.6, 24.2, 1.1, 1.6, 27.3, 2.55),
    box(id('colR'), 0.1, 26.1, 0.4, 2.6, 28.1, 2.7),
    box(id('colL'), -2.6, 26.1, 0.4, -0.1, 28.1, 2.7),
  ]);
  await put('trim', 'torso', [
    box(id('tie'), -0.45, 18.0, 2.15, 0.45, 26.2, 2.7),
    box(id('knot'), -0.55, 25.6, 2.4, 0.55, 26.8, 3.0),
    box(id('pin'), 2.0, 23.2, 2.5, 2.7, 24.0, 3.05),
  ]);
  await basicArms('primary', 'accent', 'skin', true);
  await basicFace({ iris: 'iris' });
  await put('bandage', 'head', [
    box(id('band'), 1.6, 30.2, 2.9, 3.0, 31.4, 3.7),
    box(id('bandL1'), 1.8, 30.5, 3.4, 2.8, 30.7, 3.75),
    box(id('bandL2'), 1.8, 30.9, 3.4, 2.8, 31.1, 3.75),
  ]);
  await put('hair', 'head', [
    box(id('crown'), -4.1, 33.3, -3.4, 4.1, 36.6, 1.9),
    box(id('back'), -3.8, 29.4, -4.0, 3.8, 34.8, -1.4),
    box(id('sideR'), 2.9, 29.6, -1.8, 4.5, 34.4, 2.2),
    box(id('sideL'), -4.5, 29.6, -1.8, -2.9, 34.4, 2.2),
  ]);
  // Messy spikes / quiff
  for (let i = 0; i < 7; i++) {
    const x = -2.8 + i * 0.9;
    await put('hair', 'quiff', [box(id(`sp${i}`), x, 35.5 + (i % 3) * 0.4, -1.2, x + 0.7, 38.2 + (i % 2) * 0.8, 0.8)]);
  }
  await put('hairHi', 'quiff', [box(id('qHi'), -0.6, 36.5, -0.4, 1.2, 38.5, 0.6)]);
  await put('case', 'prop', [
    box(id('case'), 3.6, 11.6, 0.4, 7.0, 15.4, 2.0),
    box(id('latch'), 4.9, 13.2, 1.85, 5.7, 13.9, 2.25),
  ]);
  await put('trim', 'prop', [box(id('latchHi'), 5.05, 13.35, 2.1, 5.55, 13.75, 2.35)]);
  await anim('defense_idle', 2.6, true, {
    hips: [kf(0), kf(1.3, undefined, [0, 0.25, 0]), kf(2.6)],
    torso: [kf(0, [2, -4, 0]), kf(1.3, [-1, -6, 0]), kf(2.6, [2, -4, 0])],
    head: [kf(0, [0, -4, 0]), kf(1.3, [2, -8, 0]), kf(2.6, [0, -4, 0])],
    quiff: [kf(0), kf(1.3, [8, 6, 0]), kf(2.6)],
    armR: [kf(0, [12, 0, 12]), kf(1.3, [14, 0, 14]), kf(2.6, [12, 0, 12])],
    armL: [kf(0, [10, 0, -12]), kf(1.3, [12, 0, -14]), kf(2.6, [10, 0, -12])],
  });
  await anim('defense_talk', 1.35, true, {
    head: [kf(0), kf(0.35, [3, -6, 0]), kf(0.7, [0, 4, 0]), kf(1.05, [3, -4, 0]), kf(1.35)],
    forearmR: [kf(0, [-12, 0, 0]), kf(0.35, [-28, 0, 6]), kf(0.7, [-14, 0, 0]), kf(1.05, [-30, 0, 4]), kf(1.35, [-12, 0, 0])],
    quiff: [kf(0), kf(0.4, [10, 0, 0]), kf(1.35)],
  });
  await anim('defense_point', 1.15, false, {
    torso: [kf(0, [2, -4, 0]), kf(0.45, [8, 8, 0]), kf(1.15, [2, -4, 0])],
    armL: [kf(0, [10, 0, -12]), kf(0.45, [-80, -10, -8]), kf(1.15, [10, 0, -12])],
    quiff: [kf(0), kf(0.45, [16, 0, 0]), kf(1.15)],
  });
  await anim('defense_objection', 1.25, false, {
    torso: [kf(0, [2, -4, 0]), kf(0.15, [-4, 0, 0]), kf(0.35, [6, 12, 0]), kf(0.75, [4, 10, 0]), kf(1.25, [2, -4, 0])],
    armR: [kf(0, [12, 0, 12]), kf(0.35, [-70, 0, 20]), kf(0.75, [-75, 0, 22]), kf(1.25, [12, 0, 12])],
    armL: [kf(0, [10, 0, -12]), kf(0.35, [-70, 0, -20]), kf(0.75, [-75, 0, -22]), kf(1.25, [10, 0, -12])],
    quiff: [kf(0), kf(0.35, [22, 12, 0]), kf(1.25)],
  });
  await finishShots('defense');
  const out = path.join(HEROES, 'defense');
  await exportHero(out);
  await writeManifest(out, {
    id: 'defense',
    name: 'Counsel Chaos',
    revision: 'v1-dense',
    clips: [
      { id: 'defense_idle', exportName: 'animation.defense_idle', loop: true, seconds: 2.6 },
      { id: 'defense_talk', exportName: 'animation.defense_talk', loop: true, seconds: 1.35 },
      { id: 'defense_point', exportName: 'animation.defense_point', loop: false, seconds: 1.15 },
      { id: 'defense_objection', exportName: 'animation.defense_objection', loop: false, seconds: 1.25 },
    ],
    notes: ['Forest jacket, gold tie, cheek bandage, wild quiff, case prop.'],
  });
  console.error('# done defense');
}

// ── Judge Gavel.exe ───────────────────────────────────────────────────────
async function buildJudge() {
  const colours = {
    ...SHARED_SKIN,
    primary: '#121826',
    primaryDeep: '#0A0E16',
    primaryHi: '#2C3344',
    hair: '#D8D4CC',
    hairHi: '#E8E4DC',
    hairEdge: '#B8B4AC',
    iris: '#3A4050',
    irisDeep: '#222830',
    fur: '#F4F0E8',
    gavel: '#C9A84E',
  };
  await boot('CC_JudgeGavel_v1', colours);
  await bipedGroups({ wide: true });
  await group('beard', [0, 29.2, 1.2], 'head');
  await basicLegs('primaryDeep', 'secondary');
  await put('primary', 'torso', [
    box(id('robe'), -4.6, 13.2, -2.4, 4.6, 27.2, 2.3),
    box(id('chest'), -4.0, 21.0, 0.3, 4.0, 26.8, 2.6),
    box(id('shR'), 2.8, 24.4, -1.8, 5.8, 27.6, 1.9),
    box(id('shL'), -5.8, 24.4, -1.8, -2.8, 27.6, 1.9),
  ]);
  await put('primaryDeep', 'torso', [box(id('under'), -4.0, 13.3, -2.6, 4.0, 22.0, -1.8)]);
  await put('fur', 'torso', [
    box(id('collar'), -3.2, 25.8, 0.2, 3.2, 28.4, 2.9),
    box(id('ring'), -3.6, 26.2, -0.4, 3.6, 28.0, 1.6),
  ]);
  await put('trim', 'torso', [box(id('chain'), -0.35, 18.0, 2.3, 0.35, 26.0, 2.8), box(id('medal'), -0.7, 17.2, 2.5, 0.7, 18.6, 3.1)]);
  await basicArms('primary', 'fur', 'skin', true);
  await basicFace({ iris: 'iris' });
  await put('hair', 'head', [
    box(id('crown'), -4.0, 33.2, -3.3, 4.0, 36.4, 1.8),
    box(id('sideR'), 2.8, 30.0, -1.6, 4.4, 34.6, 2.0),
    box(id('sideL'), -4.4, 30.0, -1.6, -2.8, 34.6, 2.0),
    box(id('back'), -3.6, 29.6, -3.9, 3.6, 34.5, -1.5),
  ]);
  await put('hairHi', 'head', [box(id('shine'), -1.2, 34.8, -0.5, 1.6, 36.2, 1.1)]);
  await put('hair', 'beard', [
    box(id('b1'), -2.2, 27.6, 1.4, 2.2, 30.2, 3.4),
    box(id('b2'), -1.6, 26.8, 2.0, 1.6, 28.4, 3.5),
    box(id('must'), -1.5, 30.0, 3.2, 1.5, 30.7, 3.9),
  ]);
  await put('gavel', 'prop', [
    box(id('handle'), 4.5, 12.2, 0.7, 5.3, 18.5, 1.5),
    box(id('head'), 3.9, 17.6, 0.2, 5.9, 19.8, 2.0),
  ]);
  await put('trimHi', 'prop', [box(id('gHi'), 4.1, 18.0, 1.6, 5.7, 19.4, 2.15)]);
  await standardClips('judge', 'gavel');
  await finishShots('judge');
  const out = path.join(HEROES, 'judge');
  await exportHero(out);
  await writeManifest(out, {
    id: 'judge',
    name: 'Judge Gavel.exe',
    revision: 'v1-dense',
    clips: [
      { id: 'judge_idle', exportName: 'animation.judge_idle', loop: true, seconds: 2.6 },
      { id: 'judge_talk', exportName: 'animation.judge_talk', loop: true, seconds: 1.35 },
      { id: 'judge_point', exportName: 'animation.judge_point', loop: false, seconds: 1.15 },
      { id: 'judge_objection', exportName: 'animation.judge_objection', loop: false, seconds: 1.25 },
      { id: 'judge_gavel', exportName: 'animation.judge_gavel', loop: false, seconds: 1.2 },
    ],
    notes: ['Navy robe, ivory fur collar, silver hair/beard, oversized gavel.'],
  });
  console.error('# done judge');
}

// ── Clerk Ctrl+S ──────────────────────────────────────────────────────────
async function buildClerk() {
  const colours = {
    ...SHARED_SKIN,
    primary: '#5B7A8C',
    primaryDeep: '#3D5160',
    primaryHi: '#6F8FA0',
    hair: '#3A2E28',
    hairHi: '#4A3C34',
    hairEdge: '#5A4A40',
    iris: '#3A5060',
    irisDeep: '#243440',
    board: '#F0EADF',
  };
  await boot('CC_ClerkCtrlS_v1', colours);
  await bipedGroups();
  await group('bun', [0, 35.8, -1.2], 'head');
  await basicLegs();
  await put('primary', 'torso', [
    box(id('body'), -3.5, 13.3, -2.0, 3.5, 26.6, 2.05),
    box(id('chest'), -3.2, 21.6, 0.4, 3.2, 26.3, 2.45),
    box(id('shR'), 2.3, 24.6, -1.6, 5.0, 27.3, 1.75),
    box(id('shL'), -5.0, 24.6, -1.6, -2.3, 27.3, 1.75),
  ]);
  await put('accent', 'torso', [
    box(id('blouse'), -1.5, 24.4, 1.1, 1.5, 27.3, 2.55),
    box(id('colR'), 0.1, 26.2, 0.5, 2.5, 28.1, 2.7),
    box(id('colL'), -2.5, 26.2, 0.5, -0.1, 28.1, 2.7),
  ]);
  await put('trim', 'torso', [
    box(id('btn1'), -0.25, 23.8, 2.4, 0.25, 24.3, 2.9),
    box(id('btn2'), -0.25, 21.4, 2.4, 0.25, 21.9, 2.9),
    box(id('btn3'), -0.25, 19.0, 2.4, 0.25, 19.5, 2.9),
  ]);
  await basicArms();
  await basicFace({ iris: 'iris' });
  await put('hair', 'head', [
    box(id('crown'), -3.7, 33.4, -3.2, 3.7, 36.2, 1.7),
    box(id('sideR'), 2.7, 30.0, -1.5, 4.2, 34.2, 2.0),
    box(id('sideL'), -4.2, 30.0, -1.5, -2.7, 34.2, 2.0),
    box(id('bang'), -2.8, 33.4, 1.4, 2.8, 35.4, 3.7),
  ]);
  await put('hair', 'bun', [
    box(id('bun1'), -1.4, 34.8, -2.4, 1.4, 37.2, -0.2),
    box(id('bun2'), -1.1, 36.4, -2.0, 1.1, 37.8, 0.2),
  ]);
  await put('board', 'prop', [
    box(id('clip'), 3.7, 11.8, 0.6, 6.9, 17.2, 1.2),
    box(id('paper'), 3.85, 12.2, 1.1, 6.75, 16.8, 1.45),
  ]);
  await put('trim', 'prop', [box(id('clipTop'), 4.7, 16.6, 0.5, 5.9, 17.5, 1.5)]);
  await put('ink', 'prop', [
    box(id('ln1'), 4.2, 15.2, 1.35, 6.3, 15.45, 1.55),
    box(id('ln2'), 4.2, 14.2, 1.35, 6.0, 14.45, 1.55),
  ]);
  await standardClips('clerk', 'point');
  await finishShots('clerk');
  const out = path.join(HEROES, 'clerk');
  await exportHero(out);
  await writeManifest(out, {
    id: 'clerk',
    name: 'Clerk Ctrl+S',
    revision: 'v1-dense',
    clips: [
      { id: 'clerk_idle', exportName: 'animation.clerk_idle', loop: true, seconds: 2.6 },
      { id: 'clerk_talk', exportName: 'animation.clerk_talk', loop: true, seconds: 1.35 },
      { id: 'clerk_point', exportName: 'animation.clerk_point', loop: false, seconds: 1.15 },
      { id: 'clerk_objection', exportName: 'animation.clerk_objection', loop: false, seconds: 1.25 },
    ],
    notes: ['Dusty-blue suit, neat bun, clipboard always in hand.'],
  });
  console.error('# done clerk');
}

// ── Bailiff ───────────────────────────────────────────────────────────────
async function buildBailiff() {
  const colours = {
    ...SHARED_SKIN,
    primary: '#1C2430',
    primaryDeep: '#121820',
    primaryHi: '#2C3644',
    hair: '#2B1F14',
    hairHi: '#3A2E22',
    iris: '#2A3040',
    irisDeep: '#181E28',
    badge: '#C9A84E',
  };
  await boot('CC_Bailiff_v1', colours);
  await bipedGroups({ wide: true });
  await group('cap', [0, 35.6, 0.2], 'head');
  await basicLegs('primaryDeep', 'secondary');
  await put('primary', 'torso', [
    box(id('body'), -4.0, 13.3, -2.1, 4.0, 26.8, 2.15),
    box(id('chest'), -3.6, 21.4, 0.4, 3.6, 26.5, 2.5),
    box(id('shR'), 2.5, 24.5, -1.7, 5.4, 27.4, 1.85),
    box(id('shL'), -5.4, 24.5, -1.7, -2.5, 27.4, 1.85),
  ]);
  await put('badge', 'torso', [box(id('badge'), 1.8, 22.8, 2.4, 2.9, 24.2, 2.95)]);
  await put('trimHi', 'torso', [box(id('badgeHi'), 2.0, 23.1, 2.8, 2.7, 23.9, 3.1)]);
  await basicArms('primary', 'accent', 'skin', true);
  await basicFace({ iris: 'iris' });
  await put('hair', 'head', [
    box(id('crop'), -3.6, 33.2, -3.0, 3.6, 35.6, 1.5),
    box(id('sideR'), 2.8, 30.4, -1.4, 4.1, 34.0, 1.8),
    box(id('sideL'), -4.1, 30.4, -1.4, -2.8, 34.0, 1.8),
  ]);
  await put('primary', 'cap', [
    box(id('hat'), -3.6, 34.8, -2.8, 3.6, 36.8, 2.2),
    box(id('brim'), -4.0, 34.7, -3.4, 4.0, 35.3, 2.6),
  ]);
  await put('badge', 'cap', [box(id('hatBadge'), -0.6, 35.4, 2.0, 0.6, 36.4, 2.5)]);
  await put('secondary', 'prop', [box(id('baton'), 4.4, 11.5, 0.7, 5.3, 17.8, 1.5)]);
  await standardClips('bailiff', 'point');
  await finishShots('bailiff');
  const out = path.join(HEROES, 'bailiff');
  await exportHero(out);
  await writeManifest(out, {
    id: 'bailiff',
    name: 'Officer Bonk',
    revision: 'v1-dense',
    clips: [
      { id: 'bailiff_idle', exportName: 'animation.bailiff_idle', loop: true, seconds: 2.6 },
      { id: 'bailiff_talk', exportName: 'animation.bailiff_talk', loop: true, seconds: 1.35 },
      { id: 'bailiff_point', exportName: 'animation.bailiff_point', loop: false, seconds: 1.15 },
      { id: 'bailiff_objection', exportName: 'animation.bailiff_objection', loop: false, seconds: 1.25 },
    ],
    notes: ['Navy uniform, peaked cap, gold badge, baton.'],
  });
  console.error('# done bailiff');
}

// ── Defendant / player (entering you) ─────────────────────────────────────
async function buildDefendant() {
  const colours = {
    ...SHARED_SKIN,
    primary: '#3D5160',
    primaryDeep: '#2A3844',
    primaryHi: '#5B7A8C',
    hair: '#1A1410',
    hairHi: '#2A221C',
    hairEdge: '#3A322C',
    iris: '#3A5A6A',
    irisDeep: '#243844',
    hoodie: '#2C3344',
  };
  await boot('CC_Defendant_v1', colours);
  await bipedGroups();
  await group('hood', [0, 34.5, -0.6], 'head');
  await basicLegs('skirt', 'secondary');
  await put('hoodie', 'torso', [
    box(id('body'), -3.7, 13.3, -2.1, 3.7, 26.7, 2.15),
    box(id('chest'), -3.4, 21.5, 0.4, 3.4, 26.4, 2.5),
    box(id('shR'), 2.4, 24.5, -1.65, 5.2, 27.35, 1.8),
    box(id('shL'), -5.2, 24.5, -1.65, -2.4, 27.35, 1.8),
    box(id('pocket'), -2.2, 15.0, 1.9, 2.2, 17.6, 2.45),
  ]);
  await put('accent', 'torso', [box(id('drawR'), 0.3, 15.2, 2.3, 1.8, 15.6, 2.6), box(id('drawL'), -1.8, 15.2, 2.3, -0.3, 15.6, 2.6)]);
  await put('trim', 'torso', [box(id('zip'), -0.2, 16.0, 2.2, 0.2, 26.0, 2.65)]);
  await basicArms('hoodie', 'accent', 'skin');
  await basicFace({ iris: 'iris' });
  await put('hair', 'head', [
    box(id('crown'), -3.8, 33.3, -3.3, 3.8, 36.4, 1.8),
    box(id('bang'), -2.9, 33.4, 1.3, 2.9, 35.5, 3.75),
    box(id('sideR'), 2.8, 29.8, -1.5, 4.3, 34.4, 2.1),
    box(id('sideL'), -4.3, 29.8, -1.5, -2.8, 34.4, 2.1),
  ]);
  await put('hoodie', 'hood', [
    box(id('hood'), -3.5, 33.0, -3.6, 3.5, 37.0, 1.2),
    box(id('hoodRim'), -3.7, 32.8, 0.6, 3.7, 35.5, 2.4),
  ]);
  await put('paper', 'prop', [box(id('phone'), 3.9, 12.6, 0.8, 5.6, 15.2, 1.3)]);
  await put('ink', 'prop', [box(id('screen'), 4.05, 12.9, 1.2, 5.45, 14.9, 1.4)]);
  await standardClips('defendant', 'point');
  await finishShots('defendant');
  const out = path.join(HEROES, 'defendant');
  await exportHero(out);
  // Also mirror as creator for default wardrobe fallbacks.
  const creator = path.join(HEROES, 'creator');
  fs.mkdirSync(creator, { recursive: true });
  for (const f of ['hero.glb', 'hero.bbmodel', 'manifest.json']) {
    const src = path.join(out, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(creator, f));
  }
  await writeManifest(out, {
    id: 'defendant',
    name: 'You (Defendant)',
    revision: 'v1-dense',
    clips: [
      { id: 'defendant_idle', exportName: 'animation.defendant_idle', loop: true, seconds: 2.6 },
      { id: 'defendant_talk', exportName: 'animation.defendant_talk', loop: true, seconds: 1.35 },
      { id: 'defendant_point', exportName: 'animation.defendant_point', loop: false, seconds: 1.15 },
      { id: 'defendant_objection', exportName: 'animation.defendant_objection', loop: false, seconds: 1.25 },
    ],
    notes: ['Hoodie hero for the entering player — readable, modern, courtroom-ready.'],
  });
  console.error('# done defendant (+ creator mirror)');
}

// ── Jurors (3 variants, reused across seats) ──────────────────────────────
async function buildJuror(variant: 'a' | 'b' | 'c') {
  const palettes = {
    a: { primary: '#6B4F3A', hair: '#1A1210', iris: '#4A3020', top: '#8B5E2A' },
    b: { primary: '#3D5160', hair: '#3A2E28', iris: '#2A4050', top: '#5B7A8C' },
    c: { primary: '#4A3A55', hair: '#D8D0C4', iris: '#4A3A60', top: '#6B5A7A' },
  } as const;
  const p = palettes[variant];
  const colours = {
    ...SHARED_SKIN,
    primary: p.primary,
    primaryDeep: p.top,
    primaryHi: p.top,
    hair: p.hair,
    hairHi: p.hair,
    hairEdge: p.hair,
    iris: p.iris,
    irisDeep: p.iris,
    skirt: '#2A2430',
  };
  await boot(`CC_Juror_${variant}_v1`, colours);
  await bipedGroups();
  await basicLegs();
  await put('primary', 'torso', [
    box(id('body'), -3.5, 13.3, -2.0, 3.5, 26.5, 2.05),
    box(id('chest'), -3.2, 21.5, 0.35, 3.2, 26.2, 2.4),
    box(id('shR'), 2.3, 24.5, -1.55, 5.0, 27.2, 1.7),
    box(id('shL'), -5.0, 24.5, -1.55, -2.3, 27.2, 1.7),
  ]);
  await put('accent', 'torso', [box(id('shirt'), -1.4, 24.3, 1.05, 1.4, 27.1, 2.5)]);
  await basicArms('primary', 'accent', 'skin');
  await basicFace({ iris: 'iris' });
  await put('hair', 'head', [
    box(id('crown'), -3.7, 33.2, -3.2, 3.7, 36.2, 1.7),
    box(id('bang'), -2.8, 33.3, 1.3, 2.8, 35.3, 3.7),
    box(id('sideR'), 2.7, 29.8, -1.4, 4.2, 34.2, 2.0),
    box(id('sideL'), -4.2, 29.8, -1.4, -2.7, 34.2, 2.0),
  ]);
  if (variant === 'c') {
    await put('hair', 'head', [box(id('bun'), -1.3, 35.0, -2.6, 1.3, 37.4, -0.4)]);
  }
  if (variant === 'a') {
    await put('trim', 'torso', [box(id('necklace'), -0.9, 25.0, 2.35, 0.9, 26.2, 2.85)]);
  }
  await put('paper', 'prop', [box(id('card'), 3.8, 12.8, 0.7, 6.0, 15.4, 1.15)]);
  await put('ink', 'prop', [box(id('stamp'), 4.3, 13.6, 1.05, 5.5, 14.5, 1.25)]);
  await standardClips(`juror_${variant}`, 'point');
  await finishShots(`juror-${variant}`);
  const out = path.join(HEROES, `juror-${variant}`);
  await exportHero(out);
  await writeManifest(out, {
    id: `juror-${variant}`,
    name: `Juror ${variant.toUpperCase()}`,
    revision: 'v1-dense',
    clips: [
      { id: `juror_${variant}_idle`, exportName: `animation.juror_${variant}_idle`, loop: true, seconds: 2.6 },
      { id: `juror_${variant}_talk`, exportName: `animation.juror_${variant}_talk`, loop: true, seconds: 1.35 },
      { id: `juror_${variant}_point`, exportName: `animation.juror_${variant}_point`, loop: false, seconds: 1.15 },
      { id: `juror_${variant}_objection`, exportName: `animation.juror_${variant}_objection`, loop: false, seconds: 1.25 },
    ],
    notes: [`Juror variant ${variant} — distinct palette, ballot card prop.`],
  });
  // Alias extras used by world (juror, juror-d/e/f) to cycle variants.
  console.error(`# done juror-${variant}`);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  await buildDefense();
  await buildJudge();
  await buildClerk();
  await buildBailiff();
  await buildDefendant();
  await buildJuror('a');
  await buildJuror('b');
  await buildJuror('c');
  // Mirror juror aliases for world ids.
  for (const [alias, src] of [
    ['juror', 'juror-a'],
    ['juror-d', 'juror-a'],
    ['juror-e', 'juror-b'],
    ['juror-f', 'juror-c'],
  ] as const) {
    const from = path.join(HEROES, src);
    const to = path.join(HEROES, alias);
    fs.mkdirSync(to, { recursive: true });
    for (const f of ['hero.glb', 'hero.bbmodel', 'manifest.json']) {
      const s = path.join(from, f);
      if (fs.existsSync(s)) fs.copyFileSync(s, path.join(to, f));
    }
  }
  console.error('# cast build complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
