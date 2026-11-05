// All 8 characters at realistic (non-chibi) proportions — voxel boxes.
// Head ≈ 23% of height, matching the Judge reference.
import { H, C, b, pair, head, torso, arms, legs, tag, posed } from './vox-base.mjs';

export { head };

/** Replace the face boxes for a given expression.
 *  char.parts(pose, expr) passes `expr` through to head(), so the eye/mouth
 *  geometry is rebuilt per expression instead of recoloured. */
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
    out.push(...head({ eyeStyle: 'shades', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' ? 'grin' : expr === 'happy' ? 'grin' : 'neutral' }));

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
    const gx = H.torsoW + H.armW * 2 + 4, gy = H.armBot + 4;
    out.push(...tag('armR', [
      b([gx - 1.4, gy, -1.4], [gx + 1.4, gy + 26, 1.4], C.hairBr),
      b([gx - 6, gy + 24, -3], [gx + 6, gy + 32, 3], C.hairBrLt),
      b([gx - 6.6, gy + 26, -3.4], [gx + 6.6, gy + 29, 3.4], C.gold),
      ...pair([gx - 7, gy + 24, -3], [gx - 5.6, gy + 32, 3], C.goldLt),
    ]));

    // the Judge never points — he raises the gavel
    return posed(out, pose, {
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
    out.push(b([-hw - 2, H.headBot + 4, -hw - 1], [hw + 2, H.headTop + 3, hw], P));
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

    out.push(...head({ eyeStyle: expr === 'happy' || expr === 'laughing' ? 'round' : 'sharp', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'grit', hair: P }));
    // pink iris override
    for (const sx of [-1, 1]) {
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
    return posed(out, pose);
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
    out.push(b([-hw - 1, H.headBot + 8, -hw], [hw + 1, H.headTop + 2, hw + 1], Br));
    const spikes = [[-hw - 1, 6, 4], [-hw + 3, 9, 4], [-1, 11, 4], [hw - 6, 9, 4], [hw - 2, 6, 3.4]];
    for (const [x, h2, w2] of spikes) {
      out.push(b([x, H.headTop + 1, -hw + 2], [x + w2, H.headTop + 1 + h2, hw - 3], (x + h2) % 2 ? Bsh : Br));
    }
    for (let i = 0; i < 5; i++) {
      out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Br : Bsh));
    }
    out.push(b([2, H.headTop + 10, -3], [4, H.headTop + 15, 0], Blt)); // cowlick

    out.push(...head({ eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : expr === 'smug' ? 'smirk' : 'neutral', hair: Br }));
    // bandage on cheek
    out.push(b([4, H.mouthY + 6, -hw - 1.4], [9, H.mouthY + 9, -hw - 0.4], C.cream));
    tag('head', out);

    out.push(...torso({ col: C.navy, colSh: C.navySh, style: 'suit' }));
    out.push(...arms({ col: C.navy, colSh: C.navySh, cuff: C.cream }));
    out.push(...legs({ col: C.navySh, shoe: C.ink }));

    // EXHIBIT A paper
    out.push(...tag('armL', [
      b([-H.torsoW - H.armW * 2 - 3, H.armBot + 4, -6], [-H.torsoW - H.armW * 2 + 8, H.armBot + 16, -4.6], C.cream),
      b([-H.torsoW - H.armW * 2 - 1, H.armBot + 13, -6.2], [-H.torsoW - H.armW * 2 + 6, H.armBot + 14, -5], '#A32D3F'),
    ]));
    return posed(out, pose);
  },
};

/* ═══════════════════════════════ BAILIFF ═══════════════════════════════════ */
export const BAILIFF = {
  id: 'bailiff', label: 'Bailiff',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;

    // cropped hair
    out.push(b([-hw, H.headBot + 10, -hw], [hw, H.headTop + 1, hw + 1], C.hairBrSh));
    out.push(b([-hw + 1, H.headTop - 3, -hw - 1], [hw - 1, H.headTop + 1, -hw + 2], C.hairBr));

    out.push(...head({ eyeStyle: 'sharp', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' ? 'frown' : 'neutral', hair: C.hairBrSh }));

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
    return posed(out, pose);
  },
};

/* ════════════════════════════════ CLERK ════════════════════════════════════ */
export const CLERK = {
  id: 'clerk', label: 'Clerk',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = C.hairBr, Bsh = C.hairBrSh;

    out.push(b([-hw - 1, H.headBot + 8, -hw], [hw + 1, H.headTop + 2, hw + 1], Br));
    // bun
    out.push(b([-5, H.headTop + 2, hw - 4], [5, H.headTop + 9, hw + 2], Bsh));
    for (let i = 0; i < 5; i++) {
      out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Br : Bsh));
    }

    out.push(...head({ eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'neutral', hair: Br }));
    // round glasses
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      out.push(b([ex - 3.2, H.eyeY - 2.6, -hw - 1.8], [ex + 3.2, H.eyeY + 3.4, -hw - 1.2], C.goldDk));
      out.push(b([ex - 2.6, H.eyeY - 2, -hw - 2], [ex + 2.6, H.eyeY + 2.8, -hw - 1.4], '#EAF4FF'));
    }
    out.push(b([-2.6, H.eyeY - 0.4, -hw - 1.9], [2.6, H.eyeY + 0.6, -hw - 1.3], C.goldDk));
    tag('head', out);

    out.push(...torso({ col: C.cream, colSh: C.creamSh, style: 'blouse' }));
    out.push(...arms({ col: C.cream, colSh: C.creamSh, cuff: C.burg }));
    out.push(...legs({ col: C.burgSh, shoe: C.ink }));

    // armful of papers
    for (let i = 0; i < 4; i++) {
      out.push(...tag('armL', [b([-H.torsoW - 9 + i * 0.6, H.armBot + 2 + i * 1.6, -6], [-H.torsoW + 4 + i * 0.6, H.armBot + 4 + i * 1.6, -3], i % 2 ? C.cream : C.creamSh)]));
    }
    return posed(out, pose);
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
    out.push(...pair([-8, cy - 3, -14.1], [-4, cy + 2, -13.6], C.ink));
    out.push(b([-2.8, cy - 1, -14.1], [2.8, cy + 0.6, -13.6], C.ink));
    out.push(b([-2, cy - 5, -14.1], [2, cy - 3.8, -13.6], C.ink));
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
    return posed(out, pose);
  },
};

/* ═══════════════════════════════ JUROR ═════════════════════════════════════ */
export const JUROR = {
  id: 'juror', label: 'Juror / Voter',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = C.hairBr, Bsh = C.hairBrSh;

    out.push(b([-hw - 1, H.headBot + 8, -hw], [hw + 1, H.headTop + 2, hw + 1], Br));
    for (let i = 0; i < 5; i++) {
      out.push(b([-hw + i * 4.6, H.eyeY + 6, -hw - 1.3], [-hw + 4.2 + i * 4.6, H.headTop + 1, -hw + 2], i % 2 ? Br : Bsh));
    }

    out.push(...head({ eyeStyle: 'round', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : expr === 'crying' || expr === 'confused' ? 'frown' : 'neutral', hair: Br }));
    // oversized round glasses
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      out.push(b([ex - 4, H.eyeY - 3.4, -hw - 2], [ex + 4, H.eyeY + 4.2, -hw - 1.2], C.hairBrSh));
      out.push(b([ex - 3.2, H.eyeY - 2.8, -hw - 2.2], [ex + 3.2, H.eyeY + 3.6, -hw - 1.4], '#E8F6FF'));
    }
    out.push(b([-3.2, H.eyeY - 0.6, -hw - 2.1], [3.2, H.eyeY + 0.6, -hw - 1.3], C.hairBrSh));

    // cap
    out.push(b([-hw - 2, H.headTop, -hw - 1], [hw + 2, H.headTop + 4, hw + 1], C.blue));
    out.push(b([-hw - 2.4, H.headTop + 4, -hw - 1.4], [hw + 2.4, H.headTop + 5.4, hw + 1.4], C.blueLt));
    out.push(b([-hw - 2, H.headTop - 1.4, -hw - 4], [hw - 1, H.headTop + 1, -hw + 1], C.blueSh));
    out.push(b([-2, H.headTop + 1, -hw - 2], [2, H.headTop + 3.4, -hw], C.cyan));

    // headphones
    out.push(...pair([-hw - 4.4, H.headBot + 2, -5], [-hw - 1.6, H.headBot + 14, 5], C.ink));
    out.push(...pair([-hw - 4.6, H.headBot + 4, -4], [-hw - 2.6, H.headBot + 12, 4], C.cyan));
    tag('head', out);

    out.push(...torso({ col: C.blue, colSh: C.blueSh, style: 'hoodie' }));
    out.push(...arms({ col: C.blue, colSh: C.blueSh, cuff: C.blueSh }));
    out.push(...legs({ col: C.navy, shoe: C.ink }));

    // popcorn
    out.push(b([-H.torsoW - 12, H.armBot + 2, -5], [-H.torsoW - 2, H.armBot + 13, -1], C.cream));
    out.push(b([-H.torsoW - 12, H.armBot + 10, -5.4], [-H.torsoW - 2, H.armBot + 13, -0.6], C.burg));
    for (let i = 0; i < 4; i++) out.push(b([-H.torsoW - 11 + i * 2.6, H.armBot + 13, -4], [-H.torsoW - 9.4 + i * 2.6, H.armBot + 16, -1.6], i % 2 ? C.goldLt : C.cream));
    tag('armL', out.slice(-6));
    return posed(out, pose);
  },
};

/* ══════════════════════════════ CREATOR / DEFENDANT ════════════════════════ */
export const CREATOR = {
  id: 'creator', label: 'Creator / Defendant',
  parts: (pose = 'idle', expr = 'neutral') => {
    const out = [];
    const hw = H.headW;
    const Br = C.hairBr, Bsh = C.hairBrSh;

    out.push(b([-hw - 1, H.headBot + 8, -hw], [hw + 1, H.headTop + 2, hw + 1], Bsh));
    const spikes = [[-hw - 1, 6, 4], [-hw + 3, 9, 4], [-1, 11, 4], [hw - 6, 9, 4], [hw - 2, 6, 3.4]];
    for (const [x, h2, w2] of spikes) {
      out.push(b([x, H.headTop + 1, -hw + 2], [x + w2, H.headTop + 1 + h2, hw - 3], (x + h2) % 2 ? Br : Bsh));
    }

    out.push(...head({ eyeStyle: 'shades', mouth: expr === 'shocked' ? 'shout' : expr === 'laughing' || expr === 'happy' ? 'grin' : 'neutral', hair: Br }));
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
    return posed(out, pose);
  },
};

export const CHARS = { judge: JUDGE, prosecutor: PROSECUTOR, defense: DEFENSE, bailiff: BAILIFF, clerk: CLERK, 'ai-narrator': NARRATOR, juror: JUROR, creator: CREATOR };
export const CHAR_IDS = Object.keys(CHARS);
