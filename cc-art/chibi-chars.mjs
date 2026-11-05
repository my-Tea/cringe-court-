// Character definitions — every character as a box list at chibi proportions.
// Hair is built from overlapping chunky masses, never a single blob: that is
// what makes these read as designed characters instead of placeholder shapes.
import { C, H, b, pair, head, torso, legs, arms } from './chibi-base.mjs';

const V = (n) => Array.from({ length: n }, (_, i) => i);

/* ═══════════════════════════════════════════════ JUDGE GAVEL.exe ═══════ */
export const JUDGE = {
  id: 'judge',
  label: 'Judge Gavel.exe',
  parts: () => {
    const o = C.outline;
    const out = [];

    // ── hair: swept-back silver mane, 14 chunky masses ────────────────
    const hair = C.silver, hairD = C.silverD;
    out.push(b([-17, 70, -14], [17, 82, 12], hair));                    // crown mass
    out.push(...pair([-19, 60, -12], [-16, 80, 10], hair));             // side curtains
    out.push(b([-16, 46, 11], [16, 78, 15], hairD));                    // back mass
    out.push(...pair([-18, 52, 8], [-13, 74, 14], hair));               // side-back locks
    // swept strands on the crown — 6 blocks sweeping back
    for (const i of V(6)) {
      const x = -14 + i * 5;
      out.push(b([x, 80 - Math.abs(i - 2.5) * 1.2, -13 + i * 0.6], [x + 4.4, 84 - Math.abs(i - 2.5) * 1.2, 10], i % 2 ? hair : hairD));
    }
    // sideburns into the beard
    out.push(...pair([-16, 46, -8], [-13, 58, 6], hair));

    // ── beard: layered white mass, 10 blocks ─────────────────────────
    const bd = C.cream, bdD = C.creamD;
    out.push(b([-13, 30, -12], [13, 48, 8], bd));                       // main beard
    out.push(b([-11, 24, -10], [11, 32, 6], bd));                       // lower beard
    out.push(b([-8, 19, -8], [8, 26, 5], bd));                          // point
    out.push(...pair([-14, 34, -10], [-12, 48, 7], bdD));               // side shadow
    out.push(b([-12, 28, -13], [12, 46, -11.4], bd));                   // front face of beard
    // moustache
    out.push(b([-9, 44, -13.4], [9, 48, -11], bd));
    out.push(...pair([-11, 43, -13.4], [-7, 46, -11], bdD));
    // mouth gap
    out.push(b([-4, 42, -13.6], [4, 44, -12.6], C.mouth));

    out.push(...head({ faceCol: C.skin, mouth: 'grin' }));

    // ── black pixel shades (signature) ───────────────────────────────
    const gl = -H.headW - 0.9;
    out.push(b([-15.6, 62, gl], [15.6, 67, gl + 1.2], C.black));
    out.push(...pair([-15.6, 62, gl], [-12, 67, gl + 1.4], C.black));
    // glint pixels
    out.push(b([-12.4, 65.4, gl - 0.2], [-10.8, 66.8, gl + 0.4], C.white));
    out.push(b([11.2, 65.4, gl - 0.2], [12.8, 66.8, gl + 0.4], C.white));
    out.push(b([-2.4, 64, gl], [2.4, 65.2, gl + 1.0], C.black));        // bridge
    out.push(...pair([-16.4, 64, gl], [-15.6, 65.4, gl + 1.4], C.black)); // temples

    // ── body ─────────────────────────────────────────────────────────
    out.push(...torso({ col: C.burg, colL: C.burgL, style: 'robe' }));
    out.push(...arms({ col: C.burg, cuff: C.cream, pose: 'point' }));
    out.push(...legs({ col: C.burgD, shoe: C.black }));

    // ── gavel in raised hand ─────────────────────────────────────────
    const gx = H.torsoW + H.armW + 4;
    out.push(b([gx - 1.6, 60, -2], [gx + 1.6, 78, 2], C.brown));        // handle
    out.push(b([gx - 6, 76, -4], [gx + 6, 82, 4], C.brownL));           // head
    out.push(b([gx - 6.6, 78, -4.4], [gx + 6.6, 80, 4.4], C.gold));     // band
    out.push(...pair([gx - 7, 76, -4], [gx - 5.6, 82, 4], C.goldL));

    // ── gold chain + scales medallion ────────────────────────────────
    for (const i of V(14)) {
      const a = Math.PI * 0.12 + (i / 13) * Math.PI * 0.76;
      out.push(b([Math.cos(a) * 13 - 0.9, 40 + Math.sin(a) * 10, -7.6],
        [Math.cos(a) * 13 + 0.9, 41.4 + Math.sin(a) * 10, -6.9], C.gold));
    }

    // ── drape folds on the robe (5 subtle creases) ───────────────────
    for (const i of V(5)) {
      const x = -9 + i * 4.5;
      out.push(b([x, 6, -7.2], [x + 1.4, 20, -6.8], C.burgD));
    }
    out.push(b([-12, 2, -7.4], [12, 6, -6.9], C.gold));                 // hem trim
    return out;
  },
};

/* ═══════════════════════════════════════════════ MISS RATIO ════════════ */
export const PROSECUTOR = {
  id: 'prosecutor',
  label: 'Miss Ratio',
  parts: () => {
    const o = C.outline;
    const out = [];
    const hair = C.pink, hairL = C.pinkL, hairD = C.pinkD;

    // ── hair: long twin-tail volume, 16 masses ───────────────────────
    out.push(b([-17, 68, -15], [17, 84, 12], hair));                    // crown
    out.push(...pair([-20, 56, -13], [-15, 82, 11], hair));             // side volume
    out.push(b([-17, 50, 10], [17, 80, 16], hairD));                    // back
    // twin tails — 4 stacked masses each side
    for (const sx of [-1, 1]) {
      for (const i of V(4)) {
        const y = 66 - i * 13;
        const w = 7 - i * 0.7;
        out.push(b([sx * (17 + i * 1.4) - w, y - 10, -6 + i * 0.6], [sx * (17 + i * 1.4) + w, y + 2, 8 - i * 0.6], i % 2 ? hair : hairL));
      }
    }
    // swept fringe: 7 angled blocks across the brow
    for (const i of V(7)) {
      const x = -16 + i * 4.6;
      out.push(b([x, 72 - Math.abs(i - 3) * 1.4, -15.4], [x + 4.2, 78 - Math.abs(i - 3) * 1.4, -13], i % 3 === 0 ? hairL : hair));
    }
    // ahoge-ish side sweep
    out.push(b([-19, 70, -12], [-12, 78, -8], hairL));

    out.push(...head({ mouth: 'grin' }));

    // sharp pink eyes override (drawn over head whites)
    const gw = -H.headW - 1.0;
    for (const sx of [-1, 1]) {
      const x = sx * H.eyeX;
      out.push(b([x - 3.2, 55.4, gw], [x + 3.2, 57.4, gw + 0.8], C.pinkD));
      out.push(b([x - 1.6, 56.0, gw - 0.2], [x + 1.6, 58.4, gw + 0.6], C.pink));
    }
    // sunglasses pushed up on the head
    out.push(b([-12, 79, -14.6], [12, 82, -12.6], C.black));
    out.push(...pair([-12.6, 78.4, -14.8], [-9.4, 82, -12.4], C.black));
    // gold scales earrings
    out.push(...pair([-H.headW - 2.6, 50, -2], [-H.headW - 0.2, 56, 2], C.gold));
    out.push(...pair([-H.headW - 3.0, 52.6, -2.6], [-H.headW + 0.2, 54.4, 2.6], C.goldL));

    out.push(...torso({ col: C.burgD, colL: C.burg, style: 'suit' }));
    out.push(...arms({ col: C.burgD, cuff: C.cream, pose: 'point' }));
    out.push(...legs({ col: C.black, shoe: C.black }));

    // pointing hand + red tie already in torso; add shouting fx gap
    out.push(b([-3, 53.4, -13.8], [3, 55, -12.8], C.mouth));
    return out;
  },
};

/* ═══════════════════════════════════════════════ COUNSEL CHAOS ═════════ */
export const DEFENSE = {
  id: 'defense',
  label: 'Counsel Chaos',
  parts: () => {
    const out = [];
    const hair = C.brown, hairL = C.brownL, hairD = C.brownD;

    // ── hair: messy spiky mass, 18 blocks ───────────────────────────
    out.push(b([-16, 68, -14], [16, 82, 11], hair));
    out.push(...pair([-19, 58, -12], [-14, 80, 10], hair));
    out.push(b([-16, 52, 10], [16, 76, 15], hairD));
    // 9 spikes of varying height — the "chaotic" read
    const spikes = [[-16, 83, 5], [-10, 85, 4.4], [-4, 86, 4], [2, 84, 4.2], [8, 83, 4.6], [13, 82, 4], [-19, 78, 4], [18, 80, 4], [0, 84, 3.4]];
    for (const [x, y, w] of spikes) {
      out.push(b([x, y - 6, -10], [x + w, y, 6], (x + y) % 3 === 0 ? hairL : hair));
    }
    // fringe + ahoge
    for (const i of V(6)) {
      const x = -15 + i * 5;
      out.push(b([x, 70 - Math.abs(i - 2.5) * 1.6, -15.2], [x + 4.4, 77 - Math.abs(i - 2.5) * 1.6, -13], i % 2 ? hairL : hair));
    }
    out.push(b([1, 86, -6], [3, 91, -3], hairL));                       // cowlick

    out.push(...head({ mouth: 'grin' }));

    // bandage on cheek
    out.push(b([6, 55, -H.headW - 1.2], [11, 59, -H.headW - 0.2], C.cream));
    out.push(...[0, 1, 2].map((i) => b([7, 56 + i * 1.2, -H.headW - 1.5], [10, 56.6 + i * 1.2, -H.headW - 0.8], C.creamD)));

    out.push(...torso({ col: C.navy, colL: C.navyL, style: 'suit' }));
    // gold lapel pin
    out.push(...pair([3.4, 32, -8], [5, 34, -7.2], C.gold));
    out.push(...arms({ col: C.navy, cuff: C.cream }));
    out.push(...legs({ col: C.navyD, shoe: C.black }));

    // EXHIBIT A paper in the left hand
    out.push(b([-20, 20, -9], [-11, 30, -7.6], C.cream));
    out.push(b([-19, 27, -9.4], [-12, 28, -8.8], C.burgL));
    out.push(b([-19, 24, -9.4], [-13, 25, -8.8], C.skinDark));
    out.push(b([-19, 21, -9.4], [-14, 22, -8.8], C.skinDark));
    return out;
  },
};

/* ═══════════════════════════════════════════════ BAILIFF ═══════════════ */
export const BAILIFF = {
  id: 'bailiff',
  label: 'Bailiff',
  parts: () => {
    const out = [];
    const hair = C.brownD;

    // short cropped hair
    out.push(b([-15, 74, -14], [15, 82, 11], hair));
    out.push(...pair([-16, 64, -12], [-14, 80, 10], hair));
    out.push(b([-15, 58, 10], [15, 74, 14], hair));
    out.push(b([-14, 74, -14.6], [14, 78, -13], C.brown));              // fringe line

    out.push(...head({ mouth: 'neutral' }));

    // peaked cap with badge
    out.push(b([-16.4, 80, -15], [16.4, 85, 12], C.navyD));
    out.push(b([-16, 85, -14.6], [16, 87.4, 11.6], C.navy));
    out.push(b([-16.4, 78.6, -15.4], [16.4, 80.6, 12], C.black));       // brim band
    out.push(b([-17, 80, -17], [17, 81.4, -14.6], C.black));            // peak
    out.push(b([-3, 82, -15.2], [3, 85, -14.4], C.goldL));              // badge
    out.push(b([-1.4, 83, -15.6], [1.4, 84.4, -14.2], C.gold));

    out.push(...torso({ col: C.navy, style: 'uniform' }));
    // epaulettes
    out.push(...pair([-12, 40, -6], [-8, 42, 6], C.gold));
    out.push(...pair([-11, 41.6, -5], [-9, 43, 5], C.goldL));
    out.push(...arms({ col: C.navy, cuff: C.black }));
    out.push(...legs({ col: C.navyD, shoe: C.black }));

    // whistle on a lanyard
    out.push(b([-1, 30, -8], [1, 34, -7.2], C.gold));
    out.push(b([-2.4, 27.6, -8.2], [2.4, 30, -7.0], C.silver));
    return out;
  },
};

/* ═══════════════════════════════════════════════ CLERK ═════════════════ */
export const CLERK = {
  id: 'clerk',
  label: 'Clerk',
  parts: () => {
    const out = [];
    const hair = C.brown, hairL = C.brownL;

    // hair in a messy bun with escaping strands
    out.push(b([-16, 70, -14], [16, 82, 11], hair));
    out.push(...pair([-18, 60, -12], [-14, 80, 10], hair));
    out.push(b([-16, 54, 10], [16, 76, 15], hair));
    out.push(b([-6, 80, 6], [6, 88, 18], hairL));                       // bun
    out.push(b([-5, 86, 7], [5, 90, 17], hair));
    for (const i of V(6)) {
      const x = -15 + i * 5;
      out.push(b([x, 72 - Math.abs(i - 2.5) * 1.2, -15.2], [x + 4.2, 78 - Math.abs(i - 2.5) * 1.2, -13], i % 2 ? hair : hairL));
    }
    // escaped strand
    out.push(b([14, 60, -9], [17, 74, -5], hairL));

    out.push(...head({ mouth: 'neutral' }));

    // round glasses
    const gw = -H.headW - 1.1;
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      for (const [dx, dy] of V(0).concat([])) {}
      // ring
      out.push(b([ex - 4.6, 56.4, gw], [ex + 4.6, 57.6, gw + 0.8], C.silverD));
      out.push(b([ex - 4.6, 61.4, gw], [ex + 4.6, 62.6, gw + 0.8], C.silverD));
      out.push(b([ex - 4.6, 57.6, gw], [ex - 3.4, 61.4, gw + 0.8], C.silverD));
      out.push(b([ex + 3.4, 57.6, gw], [ex + 4.6, 61.4, gw + 0.8], C.silverD));
      // lens tint
      out.push(b([ex - 3.4, 57.6, gw + 0.4], [ex + 3.4, 61.4, gw + 0.7], C.cream));
    }
    out.push(b([-3.4, 58.6, gw], [3.4, 59.8, gw + 0.8], C.silverD));    // bridge

    out.push(...torso({ col: C.cream, colD: C.creamD, style: 'blouse' }));
    out.push(...arms({ col: C.cream, cuff: C.burg }));
    out.push(...legs({ col: C.burgD, shoe: C.black }));

    // stack of papers clutched in the left arm
    for (const i of V(5)) {
      out.push(b([-19 + i * 0.3, 18 + i * 1.6, -9], [-8 + i * 0.3, 20 + i * 1.6, -5], i % 2 ? C.cream : C.creamD));
    }
    out.push(b([-18, 22, -9.4], [-9, 23.4, -8.6], C.burgL));
    return out;
  },
};

/* ═══════════════════════════════════════════════ AI NARRATOR 0G ════════ */
export const NARRATOR = {
  id: 'ai-narrator',
  label: 'AI Narrator (0G)',
  parts: () => {
    const out = [];
    // floating chassis — no legs
    out.push(b([-13, 22, -11], [13, 46, 11], C.cream));                 // body
    out.push(b([-13.6, 22, -11.6], [13.6, 46, 11.6], C.creamD));        // rim
    out.push(b([-14, 44, -12], [14, 48, 12], C.purple));                // top plate
    out.push(b([-9, 46, -8], [9, 50, 8], C.purpleL));                   // crown
    out.push(b([-2, 48, -6], [2, 52, 6], C.goldL));                     // antenna
    out.push(b([-3, 51, -3], [3, 54, 3], C.cyan));                      // antenna tip
    // screen face
    out.push(b([-11, 28, -12.2], [11, 42, -11.2], C.black));
    out.push(b([-10, 29, -12.6], [10, 41, -12.0], C.cyanL));
    // digital eyes
    out.push(...pair([-7, 34, -12.9], [-3.4, 38, -12.4], C.black));
    out.push(b([-2.4, 35.4, -12.9], [2.4, 36.6, -12.4], C.black));      // mouth bar
    out.push(b([-1.6, 33.4, -12.9], [1.6, 34.2, -12.4], C.black));
    // side pods with cyan glow
    out.push(...pair([-16, 28, -5], [-13, 40, 5], C.purple));
    out.push(...pair([-16.2, 31, -3.4], [-15.6, 37, 3.4], C.cyan));
    // bottom thruster
    out.push(b([-8, 18, -7], [8, 22, 7], C.purpleD));
    out.push(b([-5, 14, -4.6], [5, 18, 4.6], C.cyan));
    out.push(b([-3, 11, -3], [3, 14, 3], C.cyanL));
    // floating papers orbiting
    for (const [x, y, z] of [[16, 30, 4], [-17, 24, -3], [13, 40, -6]]) {
      out.push(b([x, y, z], [x + 4, y + 5.4, z + 0.6], C.cream));
      out.push(b([x + 0.6, y + 3.6, z + 0.6], [x + 3.4, y + 4.4, z + 1.0], C.skinDark));
    }
    return out;
  },
};

/* ═══════════════════════════════════════════════ JUROR / VOTER ═════════ */
export const JUROR = {
  id: 'juror',
  label: 'Juror / Voter',
  parts: () => {
    const out = [];
    const hair = C.brown, hairL = C.brownL;

    out.push(b([-15, 72, -13], [15, 80, 10], hair));
    out.push(...pair([-16, 64, -11], [-13, 78, 9], hair));
    out.push(b([-15, 60, 9], [15, 74, 13], hair));
    for (const i of V(5)) {
      const x = -13 + i * 5.4;
      out.push(b([x, 74 - Math.abs(i - 2) * 1.4, -14.4], [x + 4, 79 - Math.abs(i - 2) * 1.4, -12.6], i % 2 ? hairL : hair));
    }

    out.push(...head({ mouth: 'smile' }));

    // oversized round glasses
    const gw = -H.headW - 1.2;
    for (const sx of [-1, 1]) {
      const ex = sx * H.eyeX;
      out.push(b([ex - 5.4, 55.6, gw], [ex + 5.4, 56.8, gw + 0.8], C.brownD));
      out.push(b([ex - 5.4, 62.4, gw], [ex + 5.4, 63.6, gw + 0.8], C.brownD));
      out.push(b([ex - 5.4, 56.8, gw], [ex - 4.2, 62.4, gw + 0.8], C.brownD));
      out.push(b([ex + 4.2, 56.8, gw], [ex + 5.4, 62.4, gw + 0.8], C.brownD));
      out.push(b([ex - 4.2, 56.8, gw + 0.3], [ex + 4.2, 62.4, gw + 0.7], C.cyanL));
    }
    out.push(b([-3.6, 58.6, gw], [3.6, 59.8, gw + 0.8], C.brownD));

    // cap
    out.push(b([-16.6, 78, -14], [16.6, 84, 11], C.blue));
    out.push(b([-16, 84, -13.6], [16, 86.4, 10.6], C.blueL));
    out.push(b([-17, 78, -15.4], [10, 79.6, -8], C.blueD));             // brim
    out.push(b([-3, 80, -16], [3, 83.4, -15.2], C.cyan));               // cat motif

    // headphones
    for (const sx of [-1, 1]) {
      out.push(b([sx * 16.4 - 2.6, 58, -6], [sx * 16.4 + 2.6, 70, 6], C.navyD));
      out.push(b([sx * 16.4 - 2.0, 60, -6.6], [sx * 16.4 + 2.0, 68, -5.8], C.cyan));
    }
    out.push(b([-15, 84, -6], [15, 86, 4], C.navyD));                   // headband

    out.push(...torso({ col: C.blue, colD: C.blueD, style: 'hoodie' }));
    out.push(...arms({ col: C.blue, cuff: C.blueD }));
    out.push(...legs({ col: C.navy, shoe: C.black }));

    // popcorn bucket
    out.push(b([-20, 16, -8], [-11, 28, -2], C.white));
    out.push(b([-20, 24, -8.4], [-11, 28, -1.6], C.burgL));
    for (const i of V(7)) {
      out.push(b([-19 + i * 1.3, 27.6, -7], [-18.4 + i * 1.3, 30, -3], i % 2 ? C.goldL : C.cream));
    }
    return out;
  },
};

/* ═══════════════════════════════════════════════ CREATOR / DEFENDANT ═══ */
export const CREATOR = {
  id: 'creator',
  label: 'Creator / Defendant',
  parts: () => {
    const out = [];
    const hair = C.brownD, hairL = C.brown;

    out.push(b([-16, 70, -14], [16, 82, 11], hair));
    out.push(...pair([-19, 58, -12], [-14, 80, 10], hair));
    out.push(b([-16, 54, 10], [16, 76, 15], hair));
    const spikes = [[-17, 82, 4.6], [-11, 85, 4], [-5, 86, 4.4], [1, 85, 4], [7, 83, 4.4], [13, 82, 4]];
    for (const [x, y, w] of spikes) out.push(b([x, y - 5, -11], [x + w, y, 6], (x + y) % 3 ? hair : hairL));
    out.push(b([3, 86, -5], [5, 90, -2], hairL));

    out.push(...head({ mouth: 'grin' }));

    // pixel shades
    const gl = -H.headW - 1.0;
    out.push(b([-15, 61.4, gl], [15, 66.4, gl + 1.2], C.black));
    out.push(...pair([-15, 61.4, gl], [-11.6, 66.4, gl + 1.4], C.black));
    out.push(b([-8.6, 63.4, gl - 0.2], [-6.8, 64.8, gl + 0.4], C.white));
    out.push(b([7.0, 63.4, gl - 0.2], [8.8, 64.8, gl + 0.4], C.white));
    out.push(b([-2.2, 63, gl], [2.2, 64.2, gl + 1.0], C.black));

    out.push(...torso({ col: C.pink, colD: C.pinkD, style: 'hoodie' }));
    out.push(...arms({ col: C.pink, cuff: C.pinkD }));
    out.push(...legs({ col: C.pinkD, shoe: C.white }));

    // hoodie pixel-heart graphic
    const hx = -3, hy = 30;
    out.push(b([hx, hy + 3, -8.2], [hx + 1.6, hy + 6.4, -7.4], C.white));
    out.push(b([hx + 3.4, hy + 3, -8.2], [hx + 5, hy + 6.4, -7.4], C.white));
    out.push(b([hx, hy, -8.2], [hx + 1.6, hy + 4.6, -7.4], C.white));
    out.push(b([hx + 3.4, hy, -8.2], [hx + 5, hy + 4.6, -7.4], C.white));
    out.push(b([hx + 1.6, hy + 1.6, -8.2], [hx + 3.4, hy + 4.6, -7.4], C.white));
    out.push(b([hx + 1.6, hy + 4.6, -8.2], [hx + 3.4, hy + 5.6, -7.4], C.white));
    return out;
  },
};

export const CHARACTERS = { judge: JUDGE, prosecutor: PROSECUTOR, defense: DEFENSE, bailiff: BAILIFF, clerk: CLERK, 'ai-narrator': NARRATOR, juror: JUROR, creator: CREATOR };
export const CHARACTER_IDS = Object.keys(CHARACTERS);
