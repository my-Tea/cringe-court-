// Exports first-person hands (fp-hands.mjs) -> dist/characters/player/hands/
// Per pose: <pose>.png/@2x (default skin), left/ mirrors for one-handed poses,
// skin/<hex>/<pose>.png for all 6 player tones, _skin-sheet.png, hands-manifest.json.
import { FP_POSES, FRAME, SKIN_TONES, DEFAULT_SKIN, DEFAULT_SLEEVE, buildHands, poseCenter, projectPoint } from './fp-hands.mjs';
import { renderCharacter } from './char-render.mjs';
import { Canvas } from './core.mjs';
import fs from 'node:fs';

const OUT = './dist/characters/player/hands';
fs.mkdirSync(`${OUT}/left`, { recursive: true });

// left-hand frames mirror the centre too, so the left hand sits left of screen centre
const mc = (c) => [-c[0], c[1], c[2]];
const render = (pose, opts = {}) => renderCharacter(buildHands(pose, opts), {
  w: FRAME.w, h: FRAME.h, ss: FRAME.ss, yaw: opts.side === 'left' ? -FRAME.yaw : FRAME.yaw, pitch: FRAME.pitch,
  bg: [0, 0, 0, 0], fixedScale: FRAME.scale, center: opts.side === 'left' ? mc(poseCenter(pose)) : poseCenter(pose),
});
const save = (img, base) => { img.save(`${base}.png`); img.scale(2).save(`${base}@2x.png`); };

const poses = Object.keys(FP_POSES);
const manifest = {
  style: 'voxel first-person viewmodel hands, hands + forearms only (art bible Part 2 #6)',
  frame: { w: FRAME.w, h: FRAME.h, scale2x: [FRAME.w * 2, FRAME.h * 2], transparent: true },
  view: { yaw: FRAME.yaw, pitch: FRAME.pitch, projection: 'orthographic, same two-light rig as the cast' },
  note: 'All frames share one framing so they swap in place. Anchor = wrist pixel (@1x, multiply by 2 for @2x); the forearm runs off the bottom edge, so pin the frame to the bottom of the screen. Left-hand files are x-mirrors of the right.',
  defaults: { skin: DEFAULT_SKIN, sleeve: DEFAULT_SLEEVE },
  skins: SKIN_TONES,
  poses: {},
};

let n = 0;
for (const pose of poses) {
  const p = FP_POSES[pose];
  save(render(pose), `${OUT}/${pose}`); n++;
  const c = poseCenter(pose);
  const entry = {
    file: `${pose}.png`, file2x: `${pose}@2x.png`, size: [FRAME.w, FRAME.h], side: p.side, desc: p.desc,
    anchor: p.side === 'both'
      ? { left: projectPoint([-10 * 1.3, 0, 0], c), right: projectPoint([10 * 1.3, 0, 0], c) }
      : { wrist: projectPoint([0, 0, 0], c) },
    skinFiles: `skin/<hex>/${pose}.png`,
  };
  if (p.side === 'right') {
    save(render(pose, { side: 'left' }), `${OUT}/left/${pose}`); n++;
    entry.leftFile = `left/${pose}.png`;
    entry.leftAnchor = { wrist: projectPoint([0, 0, 0], mc(c), true) };
  }
  manifest.poses[pose] = entry;
}

// skin tones: every pose x every tone
for (const skin of SKIN_TONES) {
  const dir = `${OUT}/skin/${skin.replace('#', '')}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const pose of poses) { save(render(pose, { skin }), `${dir}/${pose}`); n++; }
}
for (const e of Object.values(manifest.poses)) e.skinFiles = e.skinFiles.replace('<hex>', '<hex-without-#>');

// poses x tones sheet
const cw = 128, ch = 128;
const sheet = new Canvas(cw * poses.length, ch * SKIN_TONES.length);
sheet.fill([26, 20, 28, 255]);
SKIN_TONES.forEach((skin, r) => poses.forEach((pose, i) => {
  const img = render(pose, { skin }).scale(1);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    // 2x2 box downsample of the 256 frame into the 128 cell, composited over the sheet bg
    let R = 0, G = 0, B = 0, A = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const q = img.get(x * 2 + dx, y * 2 + dy); R += q[0] * q[3]; G += q[1] * q[3]; B += q[2] * q[3]; A += q[3];
    }
    if (!A) continue;
    const a = A / 1020, bg = sheet.get(i * cw + x, r * ch + y);
    sheet.set(i * cw + x, r * ch + y, [R / A * a + bg[0] * (1 - a), G / A * a + bg[1] * (1 - a), B / A * a + bg[2] * (1 - a), 255]);
  }
}));
sheet.save(`${OUT}/_skin-sheet.png`);

fs.writeFileSync(`${OUT}/hands-manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`first-person hands: ${poses.length} poses, ${n} PNGs (+@2x), ${SKIN_TONES.length} skin tones`);
