// All 8 characters at realistic (non-chibi) proportions — voxel boxes.
// Head ≈ 23% of height, matching the Judge reference.
import { H, C, b, pair, head, torso, arms, legs, tag, posed } from './vox-base.mjs';
import { gavelBoxes, exhibitABoxes, popcornBoxes, papersBoxes, ANCHORS } from './held-props.mjs';

/** Idle variants per character, as rig deltas (same units as POSES in
 *  vox-base.mjs). Each stays an "idle": feet planted, no expression change,
 *  one small readable action. Played once after a few base-idle loops. */
export const IDLE = {
  judge: {
    idle_a: { armL: { fwd: 135, across: 38 }, head: { nod: 3 } },                  // adjusts shades
    idle_b: { armR: { out: 24, fwd: 8 }, head: { nod: 5 } },                    // taps the gavel
    idle_c: { armL: { fwd: 105, across: 30 }, head: { nod: 6, tilt: 3 } },        // strokes beard
  },
  prosecutor: {
    idle_a: { armR: { fwd: 85, across: 50 }, armL: { fwd: 85, across: 50 }, head: { tilt: -4 }, lean: -2 }, // arms crossed
    idle_b: { sway: 5, lean: 3, head: { tilt: 5 }, armR: { out: 8 }, armL: { out: 8 } },               // foot-tap lean
    idle_c: { armR: { fwd: 145, across: 22 }, head: { tilt: 7 } },                                       // flips hair
  },
  defense: {
    idle_a: { armR: { out: 30, fwd: 10 }, armL: { out: 30, fwd: 10 }, head: { tilt: -6 }, dy: 1.5, sway: 3 }, // shrug-lean
    idle_b: { armR: { fwd: 85, across: 38 }, head: { nod: 5 } },                                               // adjusts tie
    idle_c: { armL: { fwd: 75, out: -18 }, head: { nod: 14, tilt: 4 } },                                      // reads paper
  },
  bailiff: {
    idle_a: { armR: { fwd: 150, across: 26 }, head: { nod: -2 } },                // adjusts cap
    idle_b: { sway: 4, head: { tilt: -5 }, armR: { out: 6, fwd: -6 }, armL: { out: 6, fwd: -6 } }, // shifts weight
    idle_c: { armL: { fwd: 95, across: 45 }, head: { nod: 8 } },                 // checks watch
  },
  clerk: {
    idle_a: { armL: { fwd: 55, out: -8 }, head: { nod: 9 } },                   // flips papers
    idle_b: { armR: { fwd: 135, across: 36 }, head: { nod: 2 } },                  // pushes glasses up
    idle_c: { head: { nod: -8, tilt: 6 }, sway: 2, armR: { out: 5 } },          // glances up
  },
  'ai-narrator': {
    idle_a: { dy: 4, sway: 5 },                                                 // bob + tilt right
    idle_b: { dy: 2, lean: 7, sway: -4 },                                       // leans in
    idle_c: { dy: 5, sway: -6, lean: -4 },                                      // bob + tilt left
  },
  juror: {
    idle_a: { armL: { fwd: 120, across: 34 }, head: { nod: 4 } },                 // munches popcorn
    idle_b: { lean: -9, head: { nod: -6 }, armL: { out: 6 } },                  // leans back
    idle_c: { lean: 7, head: { nod: 7 }, armL: { fwd: 28, out: -4 } },          // leans in, engrossed
  },
  creator: {
    idle_a: { armR: { out: 6, fwd: 22 }, armL: { out: 6, fwd: 22 }, head: { tilt: 5 }, sway: 3 }, // hands in hoodie
    idle_b: { armR: { fwd: 150, across: 22 }, head: { tilt: 5, nod: 3 } },                          // scratches head
    idle_c: { sway: -6, head: { nod: 10 }, armR: { fwd: 12 }, armL: { fwd: 12 } },                // nervous sway
  },
  'side-a': {
    idle_a: { armR: { fwd: 85, across: 50 }, armL: { fwd: 85, across: 50 }, head: { tilt: 4 }, lean: -3 }, // arms crossed, unbothered
    idle_b: { armR: { fwd: 70, across: 24 }, head: { nod: 12 } },                                         // checks the receipts on their phone
    idle_c: { lean: -5, sway: 3, head: { nod: -4 }, armR: { out: 5 }, armL: { out: 5 } },                 // rocks back on the heels
  },
  'side-b': {
    idle_a: { armR: { out: 14, fwd: -12 }, armL: { out: 14, fwd: -12 }, sway: -3, head: { tilt: -5 } },   // hands on hips
    idle_b: { armR: { fwd: 150, across: 18 }, head: { tilt: -6, nod: 2 } },                                // tightens the ponytail
    idle_c: { sway: 5, lean: 3, head: { tilt: 6 }, armR: { out: 9 }, armL: { out: 9 } },                   // impatient lean
  },
};

export { head };

/** Replace the face boxes for a given expression.
 *  char.parts(pose, expr) passes `expr` through to head(), so the eye/mouth
 *  geometry is rebuilt per expression instead of recoloured. */
/** Mouth per expression, for characters whose shades hide the eyes. */
const MOUTH = { neutral: 'neutral', happy: 'grin', angry: 'grit', shocked: 'shout', laughing: 'grin', crying: 'frown', confused: 'frown', smug: 'smirk' };

const FACE_MATS = new Set(['#FFFFFF', '#3B2A28', '#241A22', '#5A4234', '#8E3B42', '#7A3340', '#D2686E', '#E8C4A8', '#D2A98C', '#B48A6C']);

/* ══════════════════════════════════ JUDGE ══════════════════════════════════ */
export const JUDGE = {
  id: 'judge', label: 'Judge Gavel.exe',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const fz = -hw;            // the face plane — nothing may be drawn in front of this

    // ── hair: TOP + BACK + SIDES only. The front plane stays clear so the
    //    face reads. (Drawing hair across the front buried the whole face.)
    out.push(b([-hw - 0.5, H.headTop - 4, -hw + 1], [hw + 0.5, H.headTop + 3, hw + 1.5], C.hairS));   // crown
    out.push(b([-hw - 1.5, H.headBot + 10, hw - 4], [hw + 1.5, H.headTop + 2, hw + 3], C.hairSSh));   // back mass
    out.push(...pair([-hw - 1.5, H.headBot + 12, -hw + 3], [-hw + 1, H.headTop + 1, hw], C.hairS));    // side curtains
    // swept crown steps (top face only)
    out.push(b([-hw + 1, H.headTop + 2, -hw + 2], [hw - 1, H.headTop + 4.4, hw], C.hairSSh));
    out.push(b([-hw + 3, H.headTop + 3.4, -hw + 4], [hw - 3, H.headTop + 5.6, hw - 2], C.hairS));
    // sideburns down the sides of the face (not across it)
    out.push(...pair([-hw - 1, H.headBot - 1, -hw + 1], [-hw + 1.5, H.headBot + 14, -hw + 5], C.hairSSh));

    // ── face (shades) ───────────────────────────────────────────────
    out.push(...head({ eyeStyle: 'shades', mouth: MOUTH[expr], hair: C.hairSDk, expr }));

    // ── beard: BELOW the face, tapering. Kept clear of the mouth line so the
    //    face stays readable (a beard over the mouth made every pose identical).
    const bd = C.cream, bdSh = C.creamSh;
    out.push(b([-hw + 2, H.headBot - 3, fz - 1.4], [hw - 2, H.headBot + 2, fz + 4], bd));       // jaw
    out.push(b([-hw + 3, H.headBot - 9, fz - 1], [hw - 3, H.headBot - 2, fz + 4], bd));        // mid
    out.push(b([-hw + 4.5, H.headBot - 13, fz - 0.6], [hw - 4.5, H.headBot - 8, fz + 3], bd)); // tip
    out.push(b([hw - 6, H.headBot - 3, fz - 1.4], [hw - 2, H.headBot + 2, fz + 4], bdSh));      // shade
    // moustache, tight under the nose
    out.push(b([-hw + 3, H.mouthY + 1, fz - 1.8], [hw - 3, H.mouthY + 3, fz + 0.5], bd));
    tag('head', out);

    // ── body ────────────────────────────────────────────────────────
    out.push(...torso({ col: C.burg, colSh: C.burgSh, style: 'robe' }));
    out.push(...arms({ col: C.burg, colSh: C.burgSh, cuff: C.cream }));
    out.push(...legs({ col: C.burgSh, shoe: C.ink }));

    // ── fur mantle: sits ON the shoulders, in front of the robe ─────
    const td = Math.round(H.torsoW * 0.62);
    out.push(b([-H.torsoW - 2.5, H.torsoTop - 3, -td - 2], [H.torsoW + 2.5, H.torsoTop + 2, td + 2], C.cream));
    out.push(b([-H.torsoW - 2.5, H.torsoTop - 4.4, -td - 2.4], [H.torsoW + 2.5, H.torsoTop - 2.6, -td + 1], C.creamSh));
    // shoulder tufts so the mantle reads as fur, not a box
    for (const sx of [-1, 1]) {
      out.push(b([sx * (H.torsoW - 0.5), H.torsoTop - 2, -td - 1.6], [sx * (H.torsoW + 3.5), H.torsoTop + 3, td + 1.4], C.cream));
      out.push(b([sx * (H.torsoW + 1), H.torsoTop - 3, -td - 1.8], [sx * (H.torsoW + 4), H.torsoTop + 1, td + 1.6], C.creamSh));
    }

    // ── gold chain + scales medallion ───────────────────────────────
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const a = Math.PI * (0.15 + t * 0.7);
      const x = Math.cos(a) * (H.torsoW - 3), y = H.torsoTop - 9 + Math.sin(a) * 10;
      out.push(b([x - 0.9, y - 0.9, -td - 2], [x + 0.9, y + 0.9, -td - 1.2], C.gold));
    }
    out.push(b([-3.2, H.torsoTop - 17, -td - 2.2], [3.2, H.torsoTop - 11, -td - 1.2], C.gold));
    out.push(b([-2, H.torsoTop - 16, -td - 2.4], [2, H.torsoTop - 12, -td - 1.4], C.goldLt));

    // ── gavel, held right — oversized ───────────────────────────────
    out.push(...tag('armR', gavelBoxes(...ANCHORS.gavel())));

    // the Judge never points — he raises the gavel
    return posed(out, pose, {
      ...IDLE.judge,
      objection: { armR: { out: 165, fwd: 10 }, armL: { out: 10 } },
      angry: { armR: { out: 120, fwd: 15 }, armL: { out: 22, fwd: 12 } },
    });
  },
};

/* ═══════════════════════════════ PROSECUTOR ════════════════════════════════ */
export const PROSECUTOR = {
  id: 'prosecutor', label: 'Miss Ratio',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const P = C.hairPk, Psh = C.hairPkSh, Plt = C.hairPkLt;

    // long twin-tail hair
    out.push(b([-hw - 2, H.headBot + 4, -hw + 3], [hw + 2, H.headTop + 3, hw], P));
    out.push(b([-hw - 3, H.headBot - 2, hw - 4], [hw + 3, H.headTop, hw + 3], Psh));
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const y = H.headBot + 6 - i * 14;
        const w = 6 - i * 0.6;
        out.push(b([sx * (hw + 1) - w, y - 10, -6 + i], [sx * (hw + 1) + w, y + 4, 7 - i], i % 2 ? P : Psh));
      }
    }
    // fringe — stops above the eye line so the face stays visible
    for (let i = 0; i < 5; i++) {
      out.push(b([-hw + i * 4.6, H.eyeY + 5, -hw - 1.4], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Plt : P));
    }

    out.push(...head({ eyeStyle: expr === 'happy' || expr === 'laughing' ? 'round' : 'sharp', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'grit', hair: P, expr }));
    // pink iris override (not over closed or pinprick eyes)
    if (expr !== 'laughing' && expr !== 'shocked') for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      out.push(b([ex - 1.4, H.eyeY - 0.6, -hw - 1.1], [ex + 1.4, H.eyeY + 1.6, -hw - 0.4], Psh));
    }
    // sunglasses pushed up
    out.push(b([-hw + 1, H.headTop - 6, -hw - 1.6], [hw - 1, H.headTop - 3, -hw + 1], C.ink));
    // gold scales earrings
    out.push(...pair([-hw - 2, H.eyeY - 8, -2], [-hw + 0.2, H.eyeY - 1, 2], C.gold));
    tag('head', out);

    out.push(...torso({ col: C.burgSh, colSh: C.burg, style: 'suit' }));
    out.push(...arms({ col: C.burgSh, colSh: C.burg, cuff: C.cream }));
    out.push(...legs({ col: C.navySh, shoe: C.ink }));
    return posed(out, pose, IDLE.prosecutor);
  },
};

/* ═══════════════════════════════ DEFENSE ═══════════════════════════════════ */
export const DEFENSE = {
  id: 'defense', label: 'Counsel Chaos',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = C.hairBr, Bsh = C.hairBrSh, Blt = C.hairBrLt;

    // messy spiky hair
    out.push(b([-hw - 1, H.headBot + 8, -hw + 3], [hw + 1, H.headTop + 2, hw + 1], Br));   // mass sits behind the face plane
    const spikes = [[-hw - 1, 6, 4], [-hw + 3, 9, 4], [-1, 11, 4], [hw - 6, 9, 4], [hw - 2, 6, 3.4]];
    for (const [x, h2, w2] of spikes) {
      out.push(b([x, H.headTop + 1, -hw + 2], [x + w2, H.headTop + 1 + h2, hw - 3], (x + h2) % 2 ? Bsh : Br));
    }
    for (let i = 0; i < 5; i++) {
      out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Br : Bsh));
    }
    out.push(b([2, H.headTop + 10, -3], [4, H.headTop + 15, 0], Blt)); // cowlick

    out.push(...head({ eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : expr === 'smug' ? 'smirk' : 'neutral', hair: Br, expr }));
    // bandage on cheek
    out.push(b([5, H.mouthY + 1.4, -hw - 1.4], [9.4, H.mouthY + 3.8, -hw - 0.4], C.cream));
    tag('head', out);

    out.push(...torso({ col: C.navy, colSh: C.navySh, style: 'suit' }));
    out.push(...arms({ col: C.navy, colSh: C.navySh, cuff: C.cream }));
    out.push(...legs({ col: C.navySh, shoe: C.ink }));

    // EXHIBIT A paper (shared with the standalone prop, see held-props.mjs)
    out.push(...tag('armL', exhibitABoxes(...ANCHORS.exhibit())));
    return posed(out, pose, IDLE.defense);
  },
};

/* ═══════════════════════════════ BAILIFF ═══════════════════════════════════ */
export const BAILIFF = {
  id: 'bailiff', label: 'Bailiff',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;

    // cropped hair
    out.push(b([-hw, H.headBot + 10, -hw + 3], [hw, H.headTop + 1, hw + 1], C.hairBrSh));
    out.push(b([-hw + 1, H.headTop - 3, -hw - 1], [hw - 1, H.headTop + 1, -hw + 2], C.hairBr));

    out.push(...head({ eyeStyle: 'sharp', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' ? 'frown' : 'neutral', hair: C.hairBrSh, expr }));

    // peaked cap
    out.push(b([-hw - 2, H.headTop + 1, -hw - 1], [hw + 2, H.headTop + 5, hw + 1], C.navy));
    out.push(b([-hw - 2.5, H.headTop + 5, -hw - 1.5], [hw + 2.5, H.headTop + 6.4, hw + 1.5], C.navySh));
    out.push(b([-hw - 2, H.headTop - 1, -hw - 4], [hw + 2, H.headTop + 1.4, -hw + 1], C.ink)); // brim
    out.push(b([-hw - 2, H.headTop + 1, -hw - 1.2], [hw + 2, H.headTop + 2, -hw + 1], C.gold)); // band
    out.push(b([-2.4, H.headTop + 2, -hw - 2], [2.4, H.headTop + 4.6, -hw], C.goldLt));        // badge
    tag('head', out);

    out.push(...torso({ col: C.navy, colSh: C.navySh, style: 'uniform' }));
    // epaulettes
    out.push(...pair([-H.torsoW, H.torsoTop - 2, -5], [-H.torsoW + 6, H.torsoTop + 0.6, 5], C.gold));
    out.push(...arms({ col: C.navy, colSh: C.navySh, cuff: C.ink }));
    out.push(...legs({ col: C.navySh, shoe: C.ink }));
    return posed(out, pose, IDLE.bailiff);
  },
};

/* ════════════════════════════════ CLERK ════════════════════════════════════ */
export const CLERK = {
  id: 'clerk', label: 'Clerk',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = C.hairBr, Bsh = C.hairBrSh;

    out.push(b([-hw - 1, H.headBot + 8, -hw + 3], [hw + 1, H.headTop + 2, hw + 1], Br));   // mass sits behind the face plane
    // bun
    out.push(b([-5, H.headTop + 2, hw - 4], [5, H.headTop + 9, hw + 2], Bsh));
    for (let i = 0; i < 5; i++) {
      out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Br : Bsh));
    }

    out.push(...head({ eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'neutral', hair: Br, expr }));
    // round glasses
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      out.push(...rims(ex, H.eyeY + 0.4, 3.2, 3, -hw - 1.9, C.goldDk));
    }
    out.push(b([-2.6, H.eyeY - 0.4, -hw - 1.9], [2.6, H.eyeY + 0.6, -hw - 1.3], C.goldDk));
    tag('head', out);

    out.push(...torso({ col: C.cream, colSh: C.creamSh, style: 'blouse' }));
    out.push(...arms({ col: C.cream, colSh: C.creamSh, cuff: C.burg }));
    out.push(...legs({ col: C.burgSh, shoe: C.ink }));

    // armful of papers
    out.push(...tag('armL', papersBoxes(...ANCHORS.papers())));
    return posed(out, pose, IDLE.clerk);
  },
};

/* ═════════════════════════════ AI NARRATOR (0G) ════════════════════════════ */
export const NARRATOR = {
  id: 'ai-narrator', label: 'AI Narrator (0G)',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const cy = 56;
    // floating chassis — no legs
    out.push(b([-16, cy - 14, -12], [16, cy + 16, 12], C.cream));
    out.push(b([-16.6, cy - 14, -12.6], [16.6, cy + 16, 12.6], C.creamSh)); // rim
    out.push(b([-17, cy + 14, -13], [17, cy + 19, 13], C.purple));          // top plate
    out.push(b([-6, cy + 19, -6], [6, cy + 23, 6], C.purpleSh));
    out.push(b([-1.6, cy + 23, -1.6], [1.6, cy + 28, 1.6], C.gold));        // antenna
    out.push(b([-2.6, cy + 28, -2.6], [2.6, cy + 32, 2.6], C.cyan));
    // screen face
    out.push(b([-13, cy - 8, -13.4], [13, cy + 8, -12.4], C.ink));
    out.push(b([-12, cy - 7, -13.8], [12, cy + 7, -13.2], C.cyanLt));
    out.push(...screenFace(expr, cy));
    // side pods
    out.push(...pair([-19, cy - 8, -6], [-16, cy + 10, 6], C.purple));
    out.push(...pair([-19.4, cy - 4, -4], [-18.8, cy + 6, 4], C.cyan));
    // thruster
    out.push(b([-9, cy - 20, -8], [9, cy - 14, 8], C.purpleSh));
    out.push(b([-6, cy - 26, -5], [6, cy - 20, 5], C.cyan));
    out.push(b([-3.4, cy - 30, -3], [3.4, cy - 26, 3], C.cyanLt));
    // orbiting papers
    for (const [x, y, z] of [[20, cy - 4, 4], [-22, cy - 10, -3], [17, cy + 8, -6]]) {
      out.push(b([x, y, z], [x + 5, y + 6.4, z + 0.8], C.cream));
      out.push(b([x + 0.8, y + 4.4, z + 0.8], [x + 4.2, y + 5.4, z + 1.2], C.skinSh));
    }
    // no limbs: the body lean/sway/bob carries the pose
    return posed(out, pose, IDLE['ai-narrator']);
  },
};

/** Open glasses frame (four bars) so the eyes behind stay readable. */
function rims(cx, cy, hw, hh, z, m) {
  const t = 0.8;
  return [
    b([cx - hw, cy + hh - t, z], [cx + hw, cy + hh, z + 0.6], m),
    b([cx - hw, cy - hh, z], [cx + hw, cy - hh + t, z + 0.6], m),
    b([cx - hw, cy - hh, z], [cx - hw + t, cy + hh, z + 0.6], m),
    b([cx + hw - t, cy - hh, z], [cx + hw, cy + hh, z + 0.6], m),
  ];
}

/** The narrator's screen face: pixel glyphs on the -z display plane. */
function screenFace(expr, cy) {
  const z0 = -14.1, z1 = -13.6, px = (x0, y0, x1, y1, m = C.ink) => b([x0, cy + y0, z0], [x1, cy + y1, z1], m);
  const eyes = {
    neutral:  () => pair([-8, cy - 3, z0], [-4, cy + 2, z1], C.ink),
    happy:    () => [px(-9, 0, -7, 1.4), px(-7, 1.4, -5, 2.8), px(-5, 0, -3, 1.4), px(3, 0, 5, 1.4), px(5, 1.4, 7, 2.8), px(7, 0, 9, 1.4)],
    angry:    () => [px(-9, 2, -6, 3.2), px(-6, 1, -3, 2.2), px(-8, -3, -4, 0.6), px(3, 1, 6, 2.2), px(6, 2, 9, 3.2), px(4, -3, 8, 0.6)],
    shocked:  () => [px(-9, -3, -3, 3), px(-7.6, -1.6, -4.4, 1.6, C.cyanLt), px(3, -3, 9, 3), px(4.4, -1.6, 7.6, 1.6, C.cyanLt)],
    laughing: () => [px(-9, 1, -6, 2.2), px(-6, -0.2, -4, 1), px(-9, -1.4, -6, -0.2), px(6, 1, 9, 2.2), px(4, -0.2, 6, 1), px(6, -1.4, 9, -0.2)],
    crying:   () => [...pair([-8, cy - 1, z0], [-4, cy + 2, z1], C.ink), px(-7, -6.6, -5.6, -1, C.blue), px(5.6, -6.6, 7, -1, C.blue)],
    confused: () => [px(-8, -3, -4, 2), px(4.6, -1, 7.4, 1)],
    smug:     () => [px(-8.6, -0.6, -3.4, 1), px(-8, -2, -4, -0.6), px(3.4, -0.6, 8.6, 1), px(4, -2, 8, -0.6)],
  };
  const mouths = {
    neutral:  () => [px(-2.8, -6, 2.8, -4.8)],
    happy:    () => [px(-3.6, -5, -2.4, -3.8), px(-2.4, -6.2, 2.4, -5), px(2.4, -5, 3.6, -3.8)],
    angry:    () => [px(-3.4, -6.2, 3.4, -4.4), px(-2.6, -5.6, 2.6, -5, C.cyanLt)],
    shocked:  () => [px(-1.8, -6.8, 1.8, -3.6), px(-0.9, -6, 0.9, -4.4, C.cyanLt)],
    laughing: () => [px(-3.6, -6.8, 3.6, -4.2), px(-2.6, -6.2, 2.6, -5.2, C.cyanLt)],
    crying:   () => [px(-3.6, -6.2, -2.4, -5), px(-2.4, -5, 2.4, -3.8), px(2.4, -6.2, 3.6, -5)],
    confused: () => [px(-3, -5.4, -1, -4.2), px(-1, -6.2, 1, -5), px(1, -5.4, 3, -4.2)],
    smug:     () => [px(-2.8, -6, 2, -4.8), px(2, -4.8, 3.4, -3.6)],
  };
  const e = eyes[expr] ? expr : 'neutral';
  return [...eyes[e](), ...mouths[e]()];
}

/* ═══════════════════════════════ JUROR ═════════════════════════════════════ */
/** Juror builder. The defaults are the base juror; variants change hair,
 *  skin, clothing colour, headwear and props so a jury of three (and the
 *  gallery) never looks cloned. */
function juror(v = {}) {
  const {
    skin = C.skin, hair = C.hairBr, hairSh = C.hairBrSh, hairStyle = 'short',
    top = C.blue, topSh = C.blueSh, topLt = C.blueLt, style = 'hoodie',
    legs: legCol = C.navy, hat = 'cap', glasses = true, phones = true, popcorn = true,
  } = v;
  return (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = hair, Bsh = hairSh;

    if (hairStyle === 'buzz') {
      out.push(b([-hw - 0.4, H.headBot + 12, -hw + 2], [hw + 0.4, H.headTop + 0.8, hw + 0.6], Bsh));
    } else {
      // mass sits behind the face plane (skin front is -hw + 1) so the face reads
      out.push(b([-hw - 1, H.headBot + 8, -hw + 3], [hw + 1, H.headTop + 2, hw + 1], Br));
      for (let i = 0; i < 5; i++) {
        out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Br : Bsh));
      }
    }
    if (hairStyle === 'long') {
      // falls past the shoulders at the back and sides
      out.push(b([-hw - 1.6, H.headBot - 14, hw - 5], [hw + 1.6, H.headBot + 10, hw + 2], Bsh));
      out.push(...pair([-hw - 1.8, H.headBot - 8, -hw + 4], [-hw + 0.4, H.headBot + 10, hw - 2], Br));
    } else if (hairStyle === 'bun') {
      out.push(b([-5, H.headTop + 1, hw - 5], [5, H.headTop + 9, hw + 2], Bsh));
    } else if (hairStyle === 'afro') {
      out.push(b([-hw - 4, H.headBot + 8, -hw + 4], [hw + 4, H.headTop + 8, hw + 4], Br));
      out.push(b([-hw - 2.6, H.headTop + 6, -hw + 2], [hw + 2.6, H.headTop + 10, hw + 2], Bsh));
    }

    out.push(...head({ skin, eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'neutral', hair: Br, expr }));
    if (glasses) {
      // oversized round glasses (open rims, so the eyes behind stay readable)
      for (const sx of [-1, 1]) {
        const ex = sx * H.eyeX;
        out.push(...rims(ex, H.eyeY + 0.4, 4, 3.8, -hw - 2.1, C.hairBrSh));
      }
      out.push(b([-3.2, H.eyeY - 0.6, -hw - 2.1], [3.2, H.eyeY + 0.6, -hw - 1.3], C.hairBrSh));
    }

    if (hat === 'cap') {
      out.push(b([-hw - 2, H.headTop, -hw - 1], [hw + 2, H.headTop + 4, hw + 1], top));
      out.push(b([-hw - 2.4, H.headTop + 4, -hw - 1.4], [hw + 2.4, H.headTop + 5.4, hw + 1.4], topLt));
      out.push(b([-hw - 2, H.headTop - 1.4, -hw - 4], [hw - 1, H.headTop + 1, -hw + 1], topSh));
      out.push(b([-2, H.headTop + 1, -hw - 2], [2, H.headTop + 3.4, -hw], C.cyan));
    } else if (hat === 'beanie') {
      out.push(b([-hw - 1.6, H.headTop - 3, -hw - 1.4], [hw + 1.6, H.headTop + 5, hw + 1.6], topLt));
      out.push(b([-hw - 2, H.headTop - 4, -hw - 1.8], [hw + 2, H.headTop - 1, hw + 2], topSh));  // cuff
      out.push(b([-2, H.headTop + 5, -2], [2, H.headTop + 8, 2], C.cream));                     // pompom
    }

    if (phones) {
      out.push(...pair([-hw - 4.4, H.headBot + 2, -5], [-hw - 1.6, H.headBot + 14, 5], C.ink));
      out.push(...pair([-hw - 4.6, H.headBot + 4, -4], [-hw - 2.6, H.headBot + 12, 4], C.cyan));
    }
    tag('head', out);

    out.push(...torso({ col: top, colSh: topSh, style }));
    out.push(...arms({ col: top, colSh: topSh, cuff: topSh, hand: skin }));
    out.push(...legs({ col: legCol, shoe: C.ink, seat: pose === 'seated' }));

    // popcorn (shared with the standalone prop, see held-props.mjs); follows the left hand
    if (popcorn) out.push(...tag('armL', popcornBoxes(...ANCHORS.popcorn())));
    return posed(out, pose, IDLE.juror);
  };
}

export const JUROR = { id: 'juror', label: 'Juror / Voter', parts: juror() };

/** Background-cast variants: distinct silhouettes first (hair + headwear),
 *  then colour. Skin tones match the player palette. */
export const JUROR_VARIANTS = {
  a: { label: 'Juror A — long hair, beanie', skin: '#F5D2B4', hair: '#1A1A1A', hairSh: '#0E0E0E', hairStyle: 'long', top: '#3E7F50', topSh: '#2A5A37', topLt: '#6EBF73', style: 'suit', legs: C.ink, hat: 'beanie', glasses: false, phones: false, popcorn: false },
  b: { label: 'Juror B — afro, no hat', skin: '#7C5842', hair: '#1A1A1A', hairSh: '#2A2422', hairStyle: 'afro', top: C.gold, topSh: C.goldDk, topLt: C.goldLt, style: 'hoodie', legs: C.navy, hat: 'none', glasses: false, phones: true, popcorn: true },
  c: { label: 'Juror C — bun, glasses', skin: '#C49A7A', hair: '#6B4226', hairSh: '#4E2F1A', hairStyle: 'bun', top: C.purple, topSh: C.purpleSh, topLt: '#8E72C8', style: 'blouse', legs: C.ink, hat: 'none', glasses: true, phones: false, popcorn: false },
  d: { label: 'Juror D — buzz cut, cap', skin: '#A87B5C', hair: '#2A2422', hairSh: '#1A1A1A', hairStyle: 'buzz', top: '#C0392B', topSh: '#7A1D14', topLt: '#E05C48', style: 'hoodie', legs: C.navySh, hat: 'cap', glasses: false, phones: false, popcorn: true },
  e: { label: 'Juror E — blonde, long', skin: '#FBE0C8', hair: '#E6D08A', hairSh: '#C4AE68', hairStyle: 'long', top: C.pink, topSh: C.pinkSh, topLt: '#FFB4D8', style: 'suit', legs: C.navy, hat: 'none', glasses: true, phones: true, popcorn: false },
  f: { label: 'Juror F — silver, beanie', skin: '#E8C4A8', hair: '#DCD9D3', hairSh: '#B8B4AC', hairStyle: 'short', top: C.cyan, topSh: '#3A9AA6', topLt: C.cyanLt, style: 'suit', legs: C.ink, hat: 'beanie', glasses: true, phones: false, popcorn: false },
};
for (const [id, v] of Object.entries(JUROR_VARIANTS)) JUROR_VARIANTS[id] = { id: `juror-${id}`, label: v.label, parts: juror(v) };

/* ══════════════════════════════ CREATOR / DEFENDANT ════════════════════════ */
export const CREATOR = {
  id: 'creator', label: 'Creator / Defendant',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = C.hairBr, Bsh = C.hairBrSh;

    out.push(b([-hw - 1, H.headBot + 8, -hw + 3], [hw + 1, H.headTop + 2, hw + 1], Bsh));
    const spikes = [[-hw - 1, 6, 4], [-hw + 3, 9, 4], [-1, 11, 4], [hw - 6, 9, 4], [hw - 2, 6, 3.4]];
    for (const [x, h2, w2] of spikes) {
      out.push(b([x, H.headTop + 1, -hw + 2], [x + w2, H.headTop + 1 + h2, hw - 3], (x + h2) % 2 ? Br : Bsh));
    }

    out.push(...head({ eyeStyle: 'shades', mouth: MOUTH[expr], hair: Br, expr }));
    tag('head', out);

    out.push(...torso({ col: C.pink, colSh: C.pinkSh, style: 'hoodie' }));
    out.push(...arms({ col: C.pink, colSh: C.pinkSh, cuff: C.pinkSh }));
    out.push(...legs({ col: C.pinkSh, shoe: C.white }));

    // pixel heart on the chest
    const hz = -(Math.round(H.torsoW * 0.62)) - 1.2;
    const hx = -4, hy = H.torsoBot + 12;
    for (const [dx, dy2, w2, h2] of [[0, 3, 3, 3], [6, 3, 3, 3], [0, 0, 3, 4], [6, 0, 3, 4], [3, 1, 3, 4], [3, 5, 3, 2]]) {
      out.push(b([hx + dx, hy + dy2, hz], [hx + dx + w2, hy + dy2 + h2, hz + 1], C.white));
    }
    return posed(out, pose, IDLE.creator);
  },
};

/* ═══════════════════════════ VERSUS: SIDE A / SIDE B ═════════════════════════ */
/** Pixel letter for the chest badge (5x7, same shapes as the UI font). */
const BADGE = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
};

/** Versus-mode parties. Pseudonymous by design (idea md 4B): a domino mask
 *  and a team letter instead of a face and a name, colour-coded so the two
 *  sides never read as the same person. */
function side({ id, label, letter, team, teamSh, teamLt, hair, hairSh, hairStyle, skin }) {
  return {
    id, label,
    parts: (pose = 'idle', expr = 'neutral') => {
      const out = [];
      const hw = H.headW;
      // hair: mass behind the face plane, fringe above the brow
      out.push(b([-hw - 1, H.headBot + 8, -hw + 3], [hw + 1, H.headTop + 2, hw + 1], hair));
      for (let i = 0; i < 5; i++) {
        out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? hair : hairSh));
      }
      if (hairStyle === 'ponytail') {
        out.push(b([-3, H.headTop - 4, hw], [3, H.headTop + 1, hw + 4], hairSh));
        out.push(b([-2.4, H.headBot - 10, hw + 2], [2.4, H.headTop - 3, hw + 5], hair));
      } else {
        // swept quiff
        out.push(b([-hw + 2, H.headTop + 1, -hw + 1], [hw - 4, H.headTop + 5, hw - 4], hairSh));
      }
      out.push(...head({ skin, eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'neutral', hair: hairSh, expr }));
      // domino mask, built AROUND the eyes (not one slab behind them) so no
      // draw order can bury an eye
      const fz = -hw - 0.6, my0 = H.eyeY - 2.6, my1 = H.eyeY + 3.4, mz = [fz + 0.2, -hw + 0.2];
      for (const [x0, x1] of [[-hw + 0.4, -H.eyeX - 2.2], [-H.eyeX + 2.2, H.eyeX - 2.2], [H.eyeX + 2.2, hw - 0.4]]) {
        out.push(b([x0, my0, mz[0]], [x1, my1, mz[1]], teamSh));
      }
      for (const sx of [-1, 1]) {
        out.push(b([sx * H.eyeX - 2.2, my0, mz[0]], [sx * H.eyeX + 2.2, H.eyeY - 1.2, mz[1]], teamSh));
        out.push(b([sx * H.eyeX - 2.2, H.eyeY + 3, mz[0]], [sx * H.eyeX + 2.2, my1, mz[1]], teamSh));
      }
      out.push(...pair([-hw - 0.6, H.eyeY - 0.6, fz + 0.3], [-hw + 0.6, H.eyeY + 1.6, hw - 2], teamSh)); // strap
      tag('head', out);

      out.push(...torso({ col: team, colSh: teamSh, style: 'hoodie' }));
      out.push(...arms({ col: team, colSh: teamSh, cuff: teamLt, hand: skin }));
      out.push(...legs({ col: C.navySh, shoe: C.white }));

      // team letter on the chest
      const td = Math.round(H.torsoW * 0.62);
      const g = BADGE[letter], px = 1.6, x0 = -2.5 * px, y0 = H.torsoBot + 26;
      out.push(b([x0 - 1.4, y0 - 7 * px - 1.4, -td - 0.8], [x0 + 5 * px + 1.4, y0 + 1.4, -td - 0.3], C.cream));
      g.forEach((row, gy) => [...row].forEach((on, gx) => {
        if (on === '1') out.push(b([x0 + gx * px, y0 - (gy + 1) * px, -td - 2.2], [x0 + (gx + 1) * px, y0 - gy * px, -td - 1.4], teamSh));
      }));
      return posed(out, pose, IDLE[id]);
    },
  };
}

export const SIDE_A = side({ id: 'side-a', label: 'Side A (Versus)', letter: 'A', team: '#3FB8C9', teamSh: '#1F6F7C', teamLt: '#A8F0F8', hair: '#232A44', hairSh: '#151A2C', hairStyle: 'quiff', skin: '#C49A7A' });
export const SIDE_B = side({ id: 'side-b', label: 'Side B (Versus)', letter: 'B', team: '#F08A3C', teamSh: '#A8521C', teamLt: '#FFC890', hair: '#8B5A34', hairSh: '#6B4226', hairStyle: 'ponytail', skin: '#F5D2B4' });

export const CHARS = { judge: JUDGE, prosecutor: PROSECUTOR, defense: DEFENSE, bailiff: BAILIFF, clerk: CLERK, 'ai-narrator': NARRATOR, juror: JUROR, creator: CREATOR, 'side-a': SIDE_A, 'side-b': SIDE_B };
export const CHAR_IDS = Object.keys(CHARS);
