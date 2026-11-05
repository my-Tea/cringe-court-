// Chibi character system — voxel characters matching the reference art.
//
// Proportions (chibi: big head, small body):
//   total 80 units · head 34 (42%) · torso 24 · legs 14
// Every character is built from the same skeleton so layers/expressions line up.
//
// Detail budget per character: 180–320 boxes. Hair is 8–20 overlapping masses,
// never one ellipsoid — that's what separates this from a placeholder blob.

export const H = {
  total: 80,
  headTop: 80, headBot: 46, headW: 15,      // half-width — chibi: head >= torso
  neck: 44,
  // torso is deliberately almost as wide as the head. At 11 it vanished
  // behind the head in the render; 14 keeps the body readable under a big head.
  torsoTop: 44, torsoBot: 20, torsoW: 14,
  hipBot: 16,
  legBot: 0, legW: 5.6,
  armTop: 42, armBot: 18, armW: 4.6,
  eyeY: 60, eyeX: 6.5,
  mouthY: 52,
};

/* ---------------------------------------------------------------- palette */
export const C = {
  outline: '#241A22',
  // universal skin family
  skin:   '#F2CDB0', skinShade: '#DDAB8C', skinDark: '#C08D6E',
  blush:  '#F09AA0',
  // eyes
  white:  '#FFFDF8', irisD: '#3B2A28', irisM: '#6B4A3C', irisL: '#A67C5E',
  // mouth
  mouth:  '#8E3B42', tongue: '#D2686E', teeth: '#FFFDF8',
  // metals
  gold:   '#D9A046', goldL: '#F6C75B', goldP: '#FFF2C7', goldD: '#A97C2A',
  silver: '#D8D4CE', silverD: '#A9A49D',
  // cloth
  cream:  '#FFF6E4', creamD: '#E8D6BC',
  burg:   '#6E1B2A', burgL: '#A32D3F', burgD: '#48101C',
  navy:   '#232A44', navyL: '#38425F', navyD: '#151A2C',
  pink:   '#F08CBE', pinkL: '#FFB4D8', pinkD: '#C05C90',
  brown:  '#6B4226', brownL: '#8E5A34', brownD: '#412716',
  blue:   '#3F6FB5', blueL: '#6FA3E0', blueD: '#264A85',
  purple: '#6B4CA8', purpleL: '#9B7BD6', purpleD: '#452F75',
  cyan:   '#5FD3E0', cyanL: '#A8F0F8',
  white:  '#FFFFFF',
  black:  '#1A1620',
};

const b = (f, t, m) => ({
  f: [Math.min(f[0], t[0]), Math.min(f[1], t[1]), Math.min(f[2], t[2])],
  t: [Math.max(f[0], t[0]), Math.max(f[1], t[1]), Math.max(f[2], t[2])],
  m,
});
const pair = (f, t, m) => [b(f, t, m), b([-t[0], f[1], f[2]], [-f[0], t[1], t[2]], m)];

/* --------------------------------------------------------- shared pieces */

/** Head block + face features. `opts` tunes per character. */
function head({ faceCol = C.skin, o = C.outline, nose = true, mouth = 'neutral' } = {}) {
  const out = [];
  const { headW: w, headBot: lo, headTop: hi } = H;
  // skull with a slight chamfer: wide middle, narrower crown + jaw
  out.push(b([-w, lo + 3, -w + 1], [w, hi - 4, w - 1], faceCol));
  out.push(b([-w + 2, hi - 4, -w + 3], [w - 2, hi, w - 3], faceCol));       // crown
  out.push(b([-w + 2, lo, -w + 3], [w - 2, lo + 3, w - 3], faceCol));        // jaw
  // outline rim (the bold outline look)
  out.push(b([-w - 0.6, lo + 3, -w], [-w, hi - 4, w], o));
  out.push(b([w, lo + 3, -w], [w + 0.6, hi - 4, w], o));
  out.push(b([-w, hi - 4, -w - 0.6], [w, hi, w + 0.6], o));
  out.push(b([-w + 1, lo - 0.6, -w], [w - 1, lo + 3, w], o));
  // ears
  out.push(...pair([w - 0.4, lo + 12, -2], [w + 2.6, lo + 19, 2], C.skinShade));
  // eyes: white → iris → pupil → highlight, both sides
  for (const sx of [-1, 1]) {
    const x = sx * H.eyeX, y = H.eyeY - lo;
    out.push(b([x - 3.4, lo + y - 3.8, -w - 0.4], [x + 3.4, lo + y + 3.8, -w + 0.8], C.white));
    out.push(b([x - 2.6, lo + y - 3.0, -w - 0.7], [x + 2.6, lo + y + 3.0, -w + 0.4], C.irisM));
    out.push(b([x - 1.4, lo + y - 1.8, -w - 0.9], [x + 1.4, lo + y + 1.8, -w + 0.2], C.irisD));
    out.push(b([x - 1.0, lo + y + 0.4, -w - 1.0], [x + 0.2, lo + y + 2.0, -w + 0.2], C.white));
    // upper lash
    out.push(b([x - 3.6, lo + y + 3.4, -w - 0.9], [x + 3.6, lo + y + 4.6, -w + 0.6], o));
  }
  // brows
  out.push(...pair([-H.eyeX - 3.6, lo + 68 - lo - 6, -w - 0.8], [-0.8, lo + 68 - lo - 3.4, -w + 0.4], C.brownD));
  // nose
  if (nose) out.push(b([-1.2, H.mouthY - lo + 5, -w - 0.7], [1.2, H.mouthY - lo + 7, -w + 0.2], C.skinDark));
  // mouth
  const my = H.mouthY - lo;
  if (mouth === 'smile') out.push(b([-3, my, -w - 0.6], [3, my + 1, -w + 0.3], C.mouth));
  else if (mouth === 'grin') {
    out.push(b([-4, my - 1, -w - 0.6], [4, my + 2, -w + 0.3], C.mouth));
    out.push(b([-3, my, -w - 0.7], [3, my + 1, -w + 0.3], C.teeth));
  } else out.push(b([-2.4, my, -w - 0.6], [2.4, my + 1, -w + 0.3], C.mouth));
  return out;
}

/** Torso + hips. `style` picks the silhouette. */
function torso({ col, colD = null, colL = null, style = 'suit', o = C.outline }) {
  const out = [];
  const { torsoW: w, torsoBot: lo, torsoTop: hi } = H;
  const dark = colD || C.outline;
  // Main mass is wider than the head silhouette reads, so the body is not
  // swallowed under a big chibi head.
  out.push(b([-w, lo, -8], [w, hi, 8], col));
  out.push(b([-w + 1, lo - 2, -7], [w - 1, lo + 2, 7], col));  // skirt/hem flare
  // shoulders slightly wider
  out.push(b([-w - 1.6, hi - 5, -7.6], [w + 1.6, hi, 7.6], col));
  out.push(b([-w - 1.2, lo - 0.6, -8.2], [w + 1.2, lo, 8.2], dark)); // belt line
  // side outline
  for (const sx of [-1, 1]) out.push(b([sx * w - 0.7, lo - 2, -8], [sx * w + 0.7, hi, 8], o));
  if (style === 'suit') {
    // lapels + shirt + tie
    out.push(b([-4, hi - 16, -7.6], [4, hi, -6.8], C.cream));
    out.push(b([-1.6, hi - 15, -8.0], [1.6, hi - 5, -7.2], C.burgL));
    out.push(b([-2.2, hi - 17, -8.0], [2.2, hi - 15, -7.2], C.burgL));
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        out.push(b([sx * (4 + i * 0.9), hi - 2 - i * 2, -7.8], [sx * (7 + i * 0.9), hi - i * 2, -7.0], colL || col));
      }
    }
  } else if (style === 'robe') {
    // fur mantle + gold trim + medallion
    out.push(b([-w - 3, hi - 8, -8], [w + 3, hi + 2, 8], C.cream));
    out.push(b([-w - 3.4, hi - 9, -8.4], [w + 3.4, hi - 7, 8.4], C.creamD));
    out.push(b([-2, hi - 22, -7.8], [2, hi, -7.0], C.gold));
    out.push(b([-5, hi - 13, -7.8], [5, hi - 12, -7.1], C.goldL));
    // scales medallion
    out.push(b([-3.4, hi - 26, -7.8], [3.4, hi - 22, -7.1], C.gold));
    out.push(...pair([-4.6, hi - 31, -7.8], [-0.8, hi - 26, -7.1], C.goldL));
  } else if (style === 'hoodie') {
    out.push(b([-w - 2, hi - 4, -7.8], [w + 2, hi + 1, 7.8], col));  // hood bunched
    out.push(b([-w, lo, -7.8], [w, hi - 6, -7.0], col));              // front panel
    out.push(...pair([-4.4, lo + 2, -8.2], [-2.6, hi - 8, -7.6], C.cream)); // drawstrings
    out.push(b([-5, lo + 2, -8.0], [5, lo + 9, -7.4], colD || col));  // pocket
  } else if (style === 'uniform') {
    out.push(b([-w - 1, hi - 4, -7.6], [w + 1, hi - 2.6, 7.6], C.gold)); // collar braid
    out.push(...pair([-3.2, hi - 9, -8.0], [-1.4, hi - 5, -7.4], C.goldL)); // buttons
    out.push(b([-w, lo + 2, -7.6], [w, lo + 4, -7.0], C.black));      // belt
    out.push(b([-2, lo + 2.4, -7.9], [2, lo + 4, -7.2], C.gold));     // buckle
  } else if (style === 'blouse') {
    out.push(b([-w, lo, -7.6], [w, hi - 12, -7.0], col));
    out.push(b([-w + 2, hi - 14, -7.8], [w - 2, hi - 4, -7.2], C.burg)); // waistcoat
    for (let i = 0; i < 4; i++) out.push(b([-0.9, hi - 13 + i * 3, -8.0], [0.9, hi - 12 + i * 3, -7.3], C.gold));
  }
  return out;
}

function legs({ col = C.navy, shoe = C.black, o = C.outline }) {
  const out = [];
  const lw = H.legW;
  for (const sx of [-1, 1]) {
    const x0 = sx * 5.6;
    out.push(b([x0 - lw, 2, -4.6], [x0 + lw, 16, 4.6], col));
    out.push(b([x0 - lw - 0.6, 2, -4.6], [x0 - lw, 16, 4.6], o));
    out.push(b([x0 + lw, 2, -4.6], [x0 + lw + 0.6, 16, 4.6], o));
    // shoe
    out.push(b([x0 - lw - 0.6, 0, -6.4], [x0 + lw + 0.6, 2.4, 5.4], shoe));
  }
  return out;
}

function arms({ col, cuff = null, handCol = C.skin, o = C.outline, pose = 'down' }) {
  const out = [];
  const aw = H.armW;
  for (const sx of [-1, 1]) {
    const x = sx * (H.torsoW + aw);
    if (pose === 'point' && sx === 1) {
      // raised pointing arm
      out.push(b([x - aw, 40, -3], [x + aw, 52, 3], col));
      out.push(b([x - aw, 50, -2], [x + aw, 60, 2], col));
      out.push(b([x - aw, 58, -2], [x + aw + 6, 62, 2], handCol));
    } else {
      out.push(b([x - aw, 20, -3.4], [x + aw, 42, 3.4], col));
      out.push(b([x - aw - 0.6, 20, -3.4], [x - aw, 42, 3.4], o));
      out.push(b([x + aw, 20, -3.4], [x + aw + 0.6, 42, 3.4], o));
      if (cuff) out.push(b([x - aw - 0.4, 20, -3.8], [x + aw + 0.4, 23, 3.8], cuff));
      out.push(b([x - aw, 12, -3], [x + aw, 20, 3], handCol));
    }
  }
  return out;
}

export { b, pair, head, torso, legs, arms };
