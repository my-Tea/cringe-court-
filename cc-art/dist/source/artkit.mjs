// Shared art kit — 5-tone ramps for every material, plus reusable face parts.
// Every face part accepts { dx, dy } so it can follow a pose offset.
import { ramp, mix, shade } from './pen3.mjs';

/* ───────────────────────────── material ramps ───────────────────────────── */
export const R = {
  skin:    ramp('#F7D3B6', 5, { dark: 0.74, light: 1.08 }),
  skinSh:  ramp('#E4B08F', 5, { dark: 0.74, light: 1.08 }),
  hairS:   ramp('#E6E3DC', 5, { dark: 0.66, light: 1.14 }),
  beard:   ramp('#FCF8F0', 5, { dark: 0.80, light: 1.06 }),
  burg:    ramp('#6E1B2A', 5, { dark: 0.50, light: 1.55 }),
  burgD:   ramp('#4A1020', 5, { dark: 0.55, light: 1.45 }),
  gold:    ramp('#D9A046', 5, { dark: 0.60, light: 1.35 }),
  cream:   ramp('#FFF6E4', 5, { dark: 0.80, light: 1.04 }),
  ink:     ramp('#1A1620', 5, { dark: 0.70, light: 1.60 }),
  white:   ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'],
  hairBrown: ramp('#6B4226', 5, { dark: 0.55, light: 1.55 }),
  hairPink:  ramp('#F08CBE', 5, { dark: 0.62, light: 1.18 }),
  hairNavy:  ramp('#232A44', 5, { dark: 0.60, light: 1.90 }),
  hairBlue:  ramp('#3F6FB5', 5, { dark: 0.55, light: 1.45 }),
  hairPurple:ramp('#6B4CA8', 5, { dark: 0.55, light: 1.45 }),
  hairCyan:  ramp('#5FD3E0', 5, { dark: 0.55, light: 1.20 }),
  navy:    ramp('#232A44', 5, { dark: 0.55, light: 1.85 }),
  brown:   ramp('#6B4226', 5, { dark: 0.58, light: 1.55 }),
  pink:    ramp('#F08CBE', 5, { dark: 0.62, light: 1.16 }),
  blue:    ramp('#3F6FB5', 5, { dark: 0.55, light: 1.42 }),
  purple:  ramp('#6B4CA8', 5, { dark: 0.55, light: 1.42 }),
  cyan:    ramp('#5FD3E0', 5, { dark: 0.58, light: 1.18 }),
  teal:    ramp('#3F8FA8', 5, { dark: 0.55, light: 1.40 }),
};

export const T = {
  ink: '#241A22',
  gold: R.gold[3], goldHi: R.gold[4], goldLo: R.gold[1],
  mouth: '#8E3B42', tongue: '#D2686E',
  iris: '#4A342C', irisHi: '#8A6650', pupil: '#1E1614',
  blush: '#F5A3A9',
  white: '#FFFFFF',
};

/* ───────────────────────────── anatomy anchors ───────────────────────────── */
export const A = {
  cx: 128,
  headCy: 116, headRx: 50, headRy: 52,
  eyeY: 122, eyeDx: 22,
  mouthY: 152,
  neckY: 168,
  shY: 196, shDx: 44,
  hipY: 250,
  footY: 300,
};

/* ───────────────────────────────── face ───────────────────────────────── */
export function head(p, { dx = 0, dy = 0, light = [-0.5, -0.85] } = {}) {
  p.ellipse(A.cx + dx, A.headCy + dy, A.headRx, A.headRy,
    [R.skin[2], R.skin[3], R.skin[3], R.skin[4], R.skin[4]],
    { light, bands: [0.02, 0.46] });
  p.ellipse(A.cx + dx - 27, A.headCy + dy + 2, 14, 10, [R.skin[4], R.skin[4], R.skin[4], R.skin[4], R.skin[4]]);
  return p;
}

/** Big anime eye. */
export function eye(p, sx, style = 'round', tone = R.hairBrown, { dx = 0, dy = 0 } = {}) {
  const ex = A.cx + dx + sx * A.eyeDx, ey = A.eyeY + dy;
  const lid = T.ink;
  const W5 = (c) => [c, c, c, c, c];
  if (style === 'sharp') {
    p.ellipse(ex, ey + 2, 13, 12, W5(T.white));
    p.ellipse(ex, ey + 3, 8, 10, [T.pupil, T.iris, T.irisHi, T.irisHi, T.irisHi]);
    p.dot(ex - sx * 3, ey - 1, 3, T.white);
    p.stroke(ex - 15 * sx, ey - 9, ex + 13 * sx, ey - 9, lid, 4, 3);
  } else if (style === 'sleepy') {
    p.ellipse(ex, ey + 4, 13, 8, W5(T.white));
    p.ellipse(ex, ey + 4, 8, 7, [T.pupil, T.iris, T.irisHi, T.irisHi, T.irisHi]);
    p.dot(ex - 2, ey + 2, 2.4, T.white);
    p.stroke(ex - 14 * sx, ey - 1, ex + 14 * sx, ey - 1, lid, 4.4);
  } else if (style === 'sparkle') {
    p.ellipse(ex, ey, 15, 15, W5(T.white));
    p.ellipse(ex, ey + 2, 10, 12, [T.pupil, T.iris, T.irisHi, T.irisHi, T.irisHi]);
    p.dot(ex - sx * 4, ey - 4, 4, T.white);
    p.dot(ex + sx * 5, ey + 6, 2.4, T.white);
    p.stroke(ex - 16 * sx, ey - 11, ex + 14 * sx, ey - 11, lid, 4.6, 3.4);
  } else {
    p.ellipse(ex, ey, 14, 15, W5(T.white));
    p.ellipse(ex, ey + 1, 10, 12, [T.pupil, T.iris, T.irisHi, T.irisHi, T.irisHi]);
    p.ellipse(ex, ey + 2, 5, 7, [T.pupil, T.pupil, T.pupil, T.pupil, T.iris]);
    p.dot(ex - sx * 4, ey - 4, 3.6, T.white);
    p.dot(ex + sx * 5, ey + 6, 2, T.white);
    p.stroke(ex - 15 * sx, ey - 11, ex + 14 * sx, ey - 11, lid, 4.4, 3.2);
    p.stroke(ex - 9 * sx, ey + 14, ex + 7 * sx, ey + 15, lid, 1.6);
  }
  return p;
}

/** Brow: level by default. A slant reads as a scowl. */
export function brow(p, sx, { tilt = 0, tone = R.hairBrown, dx = 0, dy = 0 } = {}) {
  const cx = A.cx + dx + sx * A.eyeDx, cy = A.eyeY + dy - 26;
  const innerX = cx - 12 * sx, outerX = cx + 12 * sx;
  p.curve(innerX, cy + tilt, cx, cy - 3, outerX, cy - tilt, tone[1], 3, 2.2);
  return p;
}

export function nose(p, { dx = 0, dy = 0 } = {}) {
  p.stroke(A.cx + dx + 2, A.mouthY + dy - 12, A.cx + dx + 5, A.mouthY + dy - 7, R.skin[1], 2.2);
  p.dot(A.cx + dx + 5, A.mouthY + dy - 6, 1.8, R.skin[0]);
  return p;
}

export function mouth(p, kind = 'neutral', { dx = 0, dy = 0 } = {}) {
  const x = A.cx + dx, y = A.mouthY + dy;
  const W5 = (c) => [c, c, c, c, c];
  if (kind === 'smile') p.curve(x - 11, y, x, y + 8, x + 11, y, T.mouth, 3.2, 2.4);
  else if (kind === 'grin') {
    p.shape(x, y + 3, (a) => 12 + 3 * Math.cos(a), (xx, yy) => (yy > y + 7 ? T.tongue : T.mouth));
    p.poly([[x - 10, y - 1], [x + 10, y - 1], [x + 7, y + 3], [x - 7, y + 3]], R.white[0]);
  } else if (kind === 'shout') {
    p.ellipse(x, y + 4, 13, 12, [T.pupil, T.mouth, T.mouth, T.mouth, T.mouth]);
    p.ellipse(x, y + 10, 8, 5, W5(T.tongue));
  } else if (kind === 'frown') p.curve(x - 11, y + 4, x, y - 5, x + 11, y + 4, T.mouth, 3.2, 2.4);
  else if (kind === 'smirk') p.curve(x - 10, y + 2, x + 2, y + 6, x + 12, y - 3, T.mouth, 3.2, 2.4);
  else if (kind === 'grit') {
    p.poly([[x - 10, y], [x + 10, y], [x + 9, y + 6], [x - 9, y + 6]], R.white[0]);
    for (let i = 0; i < 4; i++) p.stroke(x - 8 + i * 5, y + 1, x - 8 + i * 5, y + 5, R.skin[1], 1.2);
  } else p.stroke(x - 6, y, x + 6, y, T.mouth, 3);
  return p;
}

export function blush(p, alpha = 0.55, { dx = 0, dy = 0 } = {}) {
  if (alpha <= 0) return p;
  const c = mix(R.skin[2], T.blush, alpha);
  p.ellipse(A.cx + dx - 33, A.headCy + dy + 22, 10, 5, [c, c, c, c, c]);
  p.ellipse(A.cx + dx + 33, A.headCy + dy + 22, 10, 5, [c, c, c, c, c]);
  return p;
}
