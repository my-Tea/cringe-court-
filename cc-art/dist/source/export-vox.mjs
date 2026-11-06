// Voxel character export — realistic proportions, 8 expressions + 10 poses each.
// Renders via char-render.mjs (orthographic, supersampled, two-light rig).
import { CHARS, CHAR_IDS, JUROR_VARIANTS } from './vox-chars.mjs';
import { renderCharacter, boundsOf } from './char-render.mjs';
import { POSE_IDS, EXTRA_POSES, IDLE_IDS } from './vox-base.mjs';
import { Canvas } from './core.mjs';
import fs from 'node:fs';

const OUT = './dist/characters';

export const EXPR = {
  neutral:  { eye: 'round',  mouth: 'neutral' },
  happy:    { eye: 'round',  mouth: 'grin' },
  angry:    { eye: 'sharp',  mouth: 'grit' },
  shocked:  { eye: 'round',  mouth: 'shout' },
  laughing: { eye: 'sharp',  mouth: 'grin' },
  crying:   { eye: 'round',  mouth: 'frown' },
  confused: { eye: 'round',  mouth: 'frown' },
  smug:     { eye: 'sharp',  mouth: 'neutral' },
};
export const POSE = POSE_IDS;

/** Apply an expression by swapping the mouth/eye boxes' materials. */
function withExpr(parts, e) {
  return parts.map((bx) => {
    // faces are the only boxes with the mouth/white/ink materials on the front
    if (bx.m === '#8E3B42') return { ...bx, m: e.mouth === 'frown' ? '#7A3340' : bx.m };
    return bx;
  });
}

function trim(img, pad = 8) {
  let mnx = img.w, mny = img.h, mxx = 0, mxy = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.get(x, y)[3] > 8) {
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
  }
  if (mxx <= mnx) return img;
  const w = mxx - mnx + 1 + pad * 2, h = mxy - mny + 1 + pad * 2;
  const out = new Canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = img.get(mnx - pad + x, mny - pad + y);
    if (p[3] > 0) out.set(x, y, p);
  }
  return out;
}

function sheet(imgs, cols, cw, ch, outFile) {
  const rows = Math.ceil(imgs.length / cols);
  const s = new Canvas(cols * cw, rows * ch);
  s.fill([26, 22, 28, 255]);
  imgs.forEach((im, i) => {
    const sc = Math.min(cw / im.w, (ch - 12) / im.h, 1);
    const dw = Math.round(im.w * sc), dh = Math.round(im.h * sc);
    const x = (i % cols) * cw + Math.floor((cw - dw) / 2);
    const y = Math.floor(i / cols) * ch + (ch - dh) - 6;
    for (let py = 0; py < dh; py++) for (let px = 0; px < dw; px++) {
      const p = im.get(Math.floor(px / sc), Math.floor(py / sc));
      if (p[3] > 8) s.set(x + px, y + py, p);
    }
  });
  s.save(outFile);
  return outFile;
}

let count = 0;
const idleRows = [];   // per character: idle, idle_a, idle_b, idle_c
const report = [];

for (const id of CHAR_IDS) {
  const dir = `${OUT}/${id}`;
  fs.mkdirSync(`${dir}/poses`, { recursive: true });
  fs.mkdirSync(`${dir}/expressions`, { recursive: true });

  // master
  const master = trim(renderCharacter(CHARS[id].parts('idle', 'neutral'), { w: 300, h: 420, yaw: 14, pitch: 6 }));
  master.save(`${dir}/sprite.png`);
  master.scale(2).save(`${dir}/sprite@2x.png`);

  // expressions
  const exprImgs = [];
  for (const [name, e] of Object.entries(EXPR)) {
    const parts = CHARS[id].parts('idle', name);
    const img = trim(renderCharacter(parts, { w: 300, h: 420, yaw: 10, pitch: 4 }));
    img.save(`${dir}/expressions/${name}.png`);
    img.scale(2).save(`${dir}/expressions/${name}@2x.png`);
    exprImgs.push(img);
    count++;
  }
  sheet(exprImgs, 4, 190, 300, `${dir}/_expressions.png`);

  // poses — each wears its matching expression, and the whole set shares one
  // framing so frames stay the same scale when swapped during an animation
  const poseParts = POSE.map((po) => CHARS[id].parts(po, EXPR[po] ? po : 'neutral'));
  const bounds = boundsOf(poseParts.flat());
  const poseImgs = [];
  for (const [i, po] of POSE.entries()) {
    const img = trim(renderCharacter(poseParts[i], { w: 300, h: 420, yaw: 14, pitch: 6, bounds }));
    img.save(`${dir}/poses/${po}.png`);
    img.scale(2).save(`${dir}/poses/${po}@2x.png`);
    poseImgs.push(img);
    count++;
  }
  sheet(poseImgs, 5, 170, 300, `${dir}/_poses.png`);

  // seated: rig-ready legs only exist on characters that build for it (juror).
  // Same framing as the 10-pose set so the scale matches; pitched higher (24 deg)
  // so the horizontal thighs read from the front.
  if (id === 'juror') {
    const seat = CHARS[id].parts('seated', 'neutral');
    for (const [suffix, yaw] of [['', 14], ['_threeq', 40]]) {
      const img = trim(renderCharacter(seat, { w: 300, h: 420, yaw, pitch: 24, bounds }));
      img.save(`${dir}/poses/seated${suffix}.png`);
      img.scale(2).save(`${dir}/poses/seated${suffix}@2x.png`);
      count++;
    }
  }

  // idle variants — same framing as the poses so they swap in without a size pop
  const idleRow = [poseImgs[0]];
  for (const v of IDLE_IDS) {
    const img = trim(renderCharacter(CHARS[id].parts(v, 'neutral'), { w: 300, h: 420, yaw: 14, pitch: 6, bounds }));
    img.save(`${dir}/poses/${v}.png`);
    img.scale(2).save(`${dir}/poses/${v}@2x.png`);
    idleRow.push(img);
    count++;
  }
  idleRows.push(...idleRow);

  report.push({ id, label: CHARS[id].label, expressions: 8, poses: 10, idleVariants: IDLE_IDS.length });
  console.log(`${id}: done`);
}

// juror variants — background cast, so a master sprite each plus a sheet
const variantDir = `${OUT}/juror/variants`;
fs.mkdirSync(variantDir, { recursive: true });
const variants = [];
const variantImgs = [CHARS.juror, ...Object.values(JUROR_VARIANTS)].map((v) =>
  trim(renderCharacter(v.parts('idle', 'neutral'), { w: 300, h: 420, yaw: 14, pitch: 6 })));
Object.keys(JUROR_VARIANTS).forEach((k, i) => {
  const img = variantImgs[i + 1];
  img.save(`${variantDir}/${k}.png`);
  img.scale(2).save(`${variantDir}/${k}@2x.png`);
  variants.push({ id: k, label: JUROR_VARIANTS[k].label });
});
sheet(variantImgs, 7, 190, 300, `${OUT}/juror/_variants.png`);
console.log(`juror variants: ${variants.length}`);

// lineup
const lineup = CHAR_IDS.map((id) => trim(renderCharacter(CHARS[id].parts('idle', 'neutral'), { w: 300, h: 420, yaw: 14, pitch: 6 })));
sheet(lineup, 4, 300, 420, `${OUT}/_previews/lineup.png`);

// idle-variant preview: one row per character, columns = idle + variants
sheet(idleRows, IDLE_IDS.length + 1, 170, 300, `${OUT}/_previews/idle-variants.png`);

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  canvas: { master: [300, 420] },
  proportions: '4.5-5.0 heads tall (realistic, NOT chibi)',
  note: 'Voxel characters. Source of truth: cc-art/vox-chars.mjs. Head is ~23% of total height.',
  expressions: Object.keys(EXPR),
  poses: POSE,
  extraPoses: {
    note: 'Rig-ready poses outside the shared 10. Only the listed characters build geometry for them.',
    seated: { characters: ['juror'], files: ['poses/seated.png', 'poses/seated_threeq.png'], definedIn: 'vox-base.mjs EXTRA_POSES', params: EXTRA_POSES.seated },
  },
  gallery: 'gallery/manifest.json  (seated background NPCs, cc-art/gallery-npcs.mjs)',
  idleVariants: IDLE_IDS,
  characters: report,
  jurorVariants: variants.map((v) => ({ ...v, file: `juror/variants/${v.id}.png` })),
}, null, 2));

console.log(`\nTOTAL: ${count} sprites`);
