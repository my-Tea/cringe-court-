// First-person hands (art bible Part 2 #6): hands + forearms only, no body.
// Voxel box lists in a VIEW-LOCAL frame: +x screen-right, +y up, +z away from
// the camera. Forearms enter from the bottom edge and run forward, so the
// renderer's pitch tips the far end up the screen (FPS viewmodel framing).
// Right hand is authored; the left hand is an x-mirror.
import { C, b, shadeHex } from './vox-base.mjs';
import { gavelBoxes } from './held-props.mjs';
import { PLAYER, PLAYER_CFG_DEFAULT } from './player-vox.mjs';

export const SKIN_TONES = PLAYER.skin;
export const DEFAULT_SKIN = PLAYER_CFG_DEFAULT.skin;
export const DEFAULT_SLEEVE = PLAYER_CFG_DEFAULT.clothingColor;

/** Render framing shared by every hand frame so they align on the same anchor. */
export const FRAME = {
  w: 256, h: 256, ss: 3, yaw: 12, pitch: -24,
  scale: 4.0,                  // px per voxel at @1x
  center: [-12, 26, 10],           // model point that lands at frame centre
  // Where the forearm leaves the frame: the point the engine should pin to the
  // bottom-centre of the screen (frame px, @1x).
  anchor: { x: 128, y: 256, note: 'bottom-centre of frame = forearm exit; place at bottom-right of screen' },
};

const HAND_SCALE = 1.3;
const grow = (boxes, k) => boxes.map((o) => ({ f: o.f.map((v) => v * k), t: o.t.map((v) => v * k), m: o.m }));
const mirror = (boxes) => boxes.map((o) => b([-o.t[0], o.f[1], o.f[2]], [-o.f[0], o.t[1], o.t[2]], o.m));
const shift = (boxes, dx, dy, dz) => boxes.map((o) => ({
  f: [o.f[0] + dx, o.f[1] + dy, o.f[2] + dz], t: [o.t[0] + dx, o.t[1] + dy, o.t[2] + dz], m: o.m,
}));

function tones(skin) {
  return { sk: skin, lt: shadeHex(skin, 1.08), sh: shadeHex(skin, 0.84), dk: shadeHex(skin, 0.66) };
}

/** Sleeve + cuff + wrist. Wrist ends at z=0, hand-top at y=hy. Stair-steps up
 *  from below the frame so a raised/struck hand stays attached to its arm. */
function forearm(skin, sleeve, hy = 0) {
  const t = tones(skin);
  const sl = sleeve, ss = shadeHex(sleeve, 0.78), sc = shadeHex(sleeve, 1.2);
  const out = [];
  const N = 6, z0s = -100, zN = -9;
  for (let i = 0; i < N; i++) {
    const z0 = z0s + (zN - z0s) * (i / N), z1 = z0s + (zN - z0s) * ((i + 1) / N);
    const k = (N - 1 - i) / (N - 1);                  // 1 at the screen edge, 0 at the wrist
    const y = Math.round(-14 + (hy + 14) * (1 - k * k));
    const w = 4.4 + k * 1.2, lean = k * 16;
    out.push(b([-w + lean, y, z0], [w + lean, y + 7.4, z1 + 0.01], i % 2 ? ss : sl));
    out.push(b([-w + lean, y + 7.4, z0], [w + lean, y + 8.2, z1 + 0.01], sc)); // top seam, catches the key light
  }
  const y = hy;
  out.push(b([-5.2, y - 0.2, -9], [5.2, y + 8.6, -6.6], C.cream));            // shirt cuff
  out.push(b([-4.2, y + 0.8, -6.6], [4.2, y + 7.2, 0], t.sk));                // wrist
  out.push(b([-4.2, y + 0.8, -6.6], [-3.4, y + 7.6, 0], t.sh));
  return out;
}

/** Four finger rows laid across x, with dark gaps so they read as fingers. */
function fingerRows(skin, { x0, x1, y0, rows = 4, rowH = 2.1, gap = 0.5, z0, z1 }) {
  const t = tones(skin), out = [];
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * (rowH + gap);
    out.push(b([x0, y - gap, z0], [x1, y, z1], t.dk));                       // gap line
    out.push(b([x0, y, z0], [x1, y + rowH, z1], i % 2 ? t.sk : t.lt));
  }
  return out;
}

/* ───────────────────────── poses (right hand) ───────────────────────── */

function gripFist(skin) {
  // Closed fist about a vertical handle at (0, *, 5). Back of hand faces the
  // camera-right, finger rows wrap the right/front, thumb crosses the top.
  const t = tones(skin), out = [];
  out.push(b([-4.6, 0, 0], [4.6, 9.4, 3.6], t.sk));                          // hand heel / back
  out.push(b([-4.6, 0, 0], [-3.8, 9.4, 3.6], t.sh));
  out.push(...fingerRows(skin, { x0: -5.8, x1: 1.4, y0: 0.6, rowH: 2.1, z0: 1.0, z1: 9.4 }));
  out.push(b([1.4, 0, 3.6], [4.6, 9.4, 8.6], t.sh));                         // far side (shadow)
  out.push(b([-4.8, 9.4, 1.4], [0.6, 11.8, 8.4], t.lt));                     // thumb across the top
  out.push(b([-4.8, 9.4, 7.4], [-1.4, 11.8, 9.2], t.sk));                    // thumb tip
  out.push(b([-3.6, 11.8, 7.8], [-2.2, 12.3, 9.0], shadeHex(skin, 1.22)));   // nail
  return out;
}

export function gavelHold(skin, sleeve, hy = 0, { handleLift = 0 } = {}) {
  const out = [...forearm(skin, sleeve, hy), ...shift(gripFist(skin), 0, hy, 0)];
  // brand gavel, handle centred in the fist; butt just below, head well above
  out.push(...gavelBoxes(-0.4, hy - 2.5 + handleLift, 5.4));
  return out;
}

export function pointHand(skin, sleeve) {
  const t = tones(skin), out = [...forearm(skin, sleeve, 0)];
  out.push(b([-4.6, 0, 0], [4.6, 9, 4], t.sk));                              // back of hand
  out.push(b([-4.6, 0, 0], [-3.8, 9, 4], t.sh));
  out.push(b([-4.6, 8.4, 0], [4.6, 9.2, 4], t.lt));                          // top plane catches key
  // curled fingers (middle/ring/little) as knuckle blocks, stepped down
  out.push(b([-1.2, 1, 4], [1.6, 8, 7.4], t.sk));
  out.push(b([1.6, 1, 4], [3.8, 7.4, 7.2], t.sk));
  out.push(b([3.8, 1.4, 4], [5.2, 6.6, 6.6], t.sh));
  out.push(b([-1.2, 0.2, 7.4], [1.6, 2.6, 8.6], t.dk));                      // curled tips
  out.push(b([1.6, 0.2, 7.2], [3.8, 2.6, 8.2], t.dk));
  // index finger: out and forward, three knuckle segments
  out.push(b([-4.4, 4.2, 4], [-1.2, 8.4, 11], t.lt));
  out.push(b([-4.2, 4.6, 11], [-1.4, 7.8, 19], t.sk));
  out.push(b([-4.0, 4.8, 19], [-1.6, 7.4, 26], t.lt));
  out.push(b([-3.4, 7.4, 21.4], [-2.2, 7.9, 25.2], shadeHex(skin, 1.22)));   // nail
  out.push(b([-4.2, 4.2, 11], [-3.6, 7.8, 19], t.sh));
  // thumb tucked along the near side
  out.push(b([2.6, 6.6, 0.4], [5.6, 9.6, 6.4], t.lt));
  out.push(b([4.2, 6.2, 5.8], [6, 9, 9.4], t.sk));
  return out;
}

/** Hand holding a flat object upright so its face looks at the camera. */
function holdFlat(skin, sleeve, { w, h, z, obj }) {
  const t = tones(skin), out = [...forearm(skin, sleeve, 0)];
  out.push(b([-4.6, 0, 0], [4.6, 7, 3], t.sk));                              // heel of hand
  out.push(b([-4.6, 0, 0], [-3.8, 7, 3], t.sh));
  out.push(b([-4.6, 6.4, 0], [4.6, 7.2, 3], t.lt));
  out.push(b([-4.6, 1, 3], [4.6, 7, z], t.sh));                              // palm under the object
  out.push(...obj);
  // fingertips peeking round the left edge, thumb pressing the face at lower right
  for (let i = 0; i < 3; i++) {
    const y = 2 + i * 2.7;
    out.push(b([-w / 2 - 2.4, y, z - 0.6], [-w / 2 + 0.8, y + 2.2, z + 2.6], i % 2 ? t.sk : t.lt));
  }
  out.push(b([w / 2 - 5.4, 0.8, z + 1.2], [w / 2 + 1.2, 3.6, z + 3.4], t.lt));
  out.push(b([w / 2 - 3.2, 3.6, z + 1.2], [w / 2 + 0.2, 6.6, z + 3.4], t.sk));
  out.push(b([w / 2 - 2.6, 5.8, z + 1.4], [w / 2 - 0.6, 6.4, z + 3.6], shadeHex(skin, 1.22)));
  return out;
}

export function phoneHold(skin, sleeve) {
  const w = 11, h = 21, z = 8;
  const obj = [
    b([-w / 2, 3, z], [w / 2, 3 + h, z + 1.4], C.ink),                       // body
    b([-w / 2 + 0.8, 3.8, z - 0.4], [w / 2 - 0.8, 3 + h - 1, z], C.navy),    // screen
    b([-w / 2 + 1.4, 3 + h - 4, z - 0.8], [w / 2 - 1.4, 3 + h - 1.8, z - 0.4], C.cyan),   // header bar
    b([-w / 2 + 1.4, 3 + h - 8, z - 0.8], [w / 2 - 3.2, 3 + h - 6, z - 0.4], C.pink),     // chat bubble
    b([-w / 2 + 3.2, 3 + h - 12, z - 0.8], [w / 2 - 1.4, 3 + h - 10, z - 0.4], C.cream),  // reply
    b([-w / 2 + 1.4, 3 + h - 15.4, z - 0.8], [w / 2 - 4, 3 + h - 13.6, z - 0.4], C.gold),
  ];
  return holdFlat(skin, sleeve, { w, h, z, obj });
}

export function evidenceHold(skin, sleeve) {
  const w = 15, h = 21, z = 8;
  const obj = [
    b([-w / 2, 3, z], [w / 2, 3 + h, z + 0.8], C.cream),                     // sheet
    b([-w / 2, 3 + h - 0.1, z - 0.1], [w / 2, 3 + h + 0.6, z + 0.9], C.creamSh),
    b([-w / 2 + 1.2, 3 + h - 5, z - 0.5], [w / 2 - 1.2, 3 + h - 1.4, z], C.burg),         // heading band
    b([-w / 2 + 2.2, 3 + h - 3.8, z - 0.9], [w / 2 - 4.6, 3 + h - 2.6, z - 0.5], C.cream),
    b([-w / 2 + 1.6, 3 + h - 8.4, z - 0.5], [w / 2 - 1.6, 3 + h - 7.2, z], C.navyLt),     // text lines
    b([-w / 2 + 1.6, 3 + h - 11.2, z - 0.5], [w / 2 - 3.4, 3 + h - 10, z], C.navyLt),
    b([-w / 2 + 1.6, 3 + h - 14, z - 0.5], [w / 2 - 2.2, 3 + h - 12.8, z], C.navyLt),
    b([w / 2 - 6.2, 3 + 2, z - 0.6], [w / 2 - 1.8, 3 + 6.4, z], C.gold),                  // seal
    b([w / 2 - 5.4, 3 + 2.8, z - 0.9], [w / 2 - 2.6, 3 + 5.6, z - 0.6], C.goldLt),
  ];
  return holdFlat(skin, sleeve, { w, h, z, obj });
}

/** Relaxed, empty, loosely curled hand. */
export function relaxedHand(skin, sleeve) {
  const t = tones(skin), out = [...forearm(skin, sleeve, 0)];
  out.push(b([-4.6, 0, 0], [4.6, 7.6, 5], t.sk));
  out.push(b([-4.6, 0, 0], [-3.8, 7.6, 5], t.sh));
  out.push(b([-4.6, 7, 0], [4.6, 7.8, 5], t.lt));
  const lens = [9, 11, 10, 8];                                              // index..little, slightly uneven
  for (let i = 0; i < 4; i++) {
    const x0 = -4.4 + i * 2.35;
    const l = lens[i];
    out.push(b([x0, 2.8, 5], [x0 + 1.9, 7, 5 + l * 0.62], i % 2 ? t.sk : t.lt));
    out.push(b([x0 + 1.9, 2.8, 5], [x0 + 2.35, 7, 5 + l * 0.62], t.dk));                   // finger gap
    out.push(b([x0, 0.8, 5 + l * 0.62], [x0 + 2.0, 5, 5 + l * 0.62 + 2.2], t.sh));   // curled-down tip
  }
  out.push(b([4.6, 2.4, 0.6], [7, 6.2, 5.2], t.lt));                          // thumb at rest
  out.push(b([4.6, 1.4, 4.6], [6.6, 4.8, 8.2], t.sk));
  return out;
}

export function relaxedPair(skin, sleeve) {
  const R = shift(relaxedHand(skin, sleeve), 10, 0, 0);
  const L = shift(mirror(relaxedHand(skin, sleeve)), -10, 0, 0);
  return [...L, ...R];
}

/** Pose registry. anchor is the wrist in model space; `side` is the hand(s). */
export const FP_POSES = {
  relaxed:        { side: 'both', center: [-1, 20, 10], desc: 'Both hands empty, loosely curled (idle / walking)', build: relaxedPair },
  gavel_hold:     { side: 'right', desc: 'Gavel gripped upright, resting',                 build: (s, c) => gavelHold(s, c, 0) },
  gavel_raised:   { side: 'right', desc: 'Gavel wound up high (anticipation frame)',       build: (s, c) => gavelHold(s, c, 8) },
  gavel_strike:   { side: 'right', desc: 'Gavel driven down (impact frame)',               build: (s, c) => gavelHold(s, c, -4) },
  point:          { side: 'right', desc: 'Index finger extended — OBJECTION / accuse',     build: pointHand },
  phone_hold:     { side: 'right', desc: 'Holding a phone, screen toward the player',      build: phoneHold },
  evidence_hold:  { side: 'right', desc: 'Holding an evidence sheet toward the player',    build: evidenceHold },
};

export function buildHands(pose, { skin = DEFAULT_SKIN, sleeve = DEFAULT_SLEEVE, side = null } = {}) {
  const p = FP_POSES[pose];
  if (!p) throw new Error(`unknown fp pose: ${pose}`);
  let boxes = grow(p.build(skin, sleeve), HAND_SCALE);
  if (side === 'left' && p.side === 'right') boxes = mirror(boxes);
  return boxes;
}

/** Frame centre for a pose (relaxed pair is centred, single hands sit right). */
export const poseCenter = (pose) => FP_POSES[pose].center || FRAME.center;

/** Project a model-space point to @1x frame pixels (same maths as char-render). */
export function projectPoint(p, center, left = false) {
  const ry = ((left ? -FRAME.yaw : FRAME.yaw) * Math.PI) / 180, rp = (FRAME.pitch * Math.PI) / 180;
  const x = p[0] - center[0], y = p[1] - center[1], z = p[2] - center[2];
  const x1 = x * Math.cos(ry) - z * Math.sin(ry), z1 = x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rp) - z1 * Math.sin(rp);
  return [Math.round(FRAME.w / 2 + x1 * FRAME.scale), Math.round(FRAME.h / 2 - y2 * FRAME.scale)];
}
