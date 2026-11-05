// UI kit — dialogue box, buttons, panels, stamps, icons, callouts.
// Same warm palette as the courtroom: cream parchment, burgundy, gold.
import { Pen, mix, shade } from './pen3.mjs';
import { R, T } from './artkit.mjs';
import fs from 'node:fs';

const OUT = './dist/ui';
const INK = '#3A2A24';

const P = {
  paper: '#FFF8EC', paperMid: '#F5E6CE', paperLow: '#E4CFB0',
  ink: '#3A2A24', inkSoft: '#6B5646',
  burg: '#6E1B2A', burgLt: '#8E2A3C', burgDk: '#4A1020',
  gold: '#D9A046', goldLt: '#F6C75B', goldDk: '#A97C2A',
  green: '#3E7F50', greenLt: '#6EBF73',
  red: '#C0392B', redLt: '#E05C48',
  purple: '#6B4CA8', cyan: '#5FD3E0',
};

/* ───────────────────────────── 9-slice panel ───────────────────────────── */
function panel(w, h, { fill = P.paper, border = P.burg, inner = P.gold, r = 10 } = {}) {
  const p = new Pen(w, h);
  p.roundRect(0, 0, w, h, r, [border, border, border, border, border]);
  p.roundRect(3, 3, w - 6, h - 6, r - 2, [inner, inner, inner, inner, inner]);
  p.roundRect(6, 6, w - 12, h - 12, r - 4,
    [P.paperLow, P.paperMid, fill, fill, fill], { vertical: true });
  return p;
}

/* ───────────────────────────────── buttons ───────────────────────────────── */
function button(label, w, h, variant) {
  const p = new Pen(w, h);
  const V = {
    primary: { bg: [P.burgDk, P.burg, P.burgLt, P.burgLt, P.burgLt], ed: P.gold, tx: '#FFF6E4', sh: P.burgDk },
    secondary: { bg: [P.paperLow, P.paperMid, P.paper, P.paper, P.paper], ed: P.burg, tx: P.burg, sh: P.paperLow },
    danger: { bg: ['#7A1D14', P.red, P.redLt, P.redLt, P.redLt], ed: P.goldLt, tx: '#FFF6E4', sh: '#7A1D14' },
    dis: { bg: ['#C9BFAE', '#D8CFC0', '#E2DACC', '#E2DACC', '#E2DACC'], ed: '#A89C88', tx: '#8A7E6C', sh: '#C9BFAE' },
  }[variant || 'primary'];
  // drop shadow
  p.roundRect(2, 5, w - 4, h - 5, 10, [V.sh, V.sh, V.sh, V.sh, V.sh]);
  p.roundRect(2, 2, w - 4, h - 7, 10, V.bg, { vertical: true });
  p.roundRect(4, 4, w - 8, h - 11, 8, ['#00000000', '#00000000', '#FFFFFF18', '#FFFFFF20', '#FFFFFF20']);
  // border
  p.roundRect(2, 2, w - 4, h - 7, 10, [V.ed, V.ed]);
  p.roundRect(4, 4, w - 8, h - 11, 8, V.bg, { vertical: true });
  return { p, V };
}

function drawText(p, text, cx, cy, size, col, { bold = true, shadow = null } = {}) {
  // Tiny 5x7 bitmap font — enough for button labels and stamps.
  const GLYPHS = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
    '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
    ':': ['00000', '00100', '00000', '00000', '00100', '00000', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
    ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
    ',': ['00000', '00000', '00000', '00000', '00000', '00100', '01000'],
  };
  const chars = [...text.toUpperCase()];
  const gw = 5, gh = 7, gap = 1;
  const totalW = chars.length * (gw + gap) - gap;
  const s = size;
  const x0 = Math.round(cx - (totalW * s) / 2);
  const y0 = Math.round(cy - (gh * s) / 2);
  chars.forEach((ch, i) => {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        if (g[gy][gx] !== '1') continue;
        const px = x0 + (i * (gw + gap) + gx) * s;
        const py = y0 + gy * s;
        if (shadow) p.roundRect(px + 1, py + 1, s, s, 0, [shadow, shadow]);
        p.roundRect(px, py, s, s, 0, [col, col]);
      }
    }
  });
  return totalW * s;
}

/* ───────────────────────────────── assets ───────────────────────────────── */
function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const made = [];

  // dialogue box 9-slice
  {
    const p = panel(640, 200, { r: 14 });
    p.roundRect(14, 14, 612, 6, 3, R.gold);
    drawText(p, 'THE COURT IS NOW IN SESSION', 320, 46, 3, P.burg);
    p.done().save(`${OUT}/dialogue_box.png`);
    made.push('dialogue_box');
  }
  // name plate
  {
    const p = new Pen(240, 52);
    p.roundRect(2, 2, 236, 46, 10, [P.burgDk, P.burg, P.burgLt, P.burgLt, P.burgLt]);
    p.roundRect(4, 4, 232, 42, 8, [P.burg, P.burgLt, P.burgLt, P.burgLt, P.burgLt]);
    p.roundRect(4, 4, 232, 3, 2, R.gold);
    drawText(p, 'JUDGE GAVEL', 120, 26, 3, R.gold[4]);
    p.done().save(`${OUT}/name_plate.png`);
    made.push('name_plate');
  }
  // buttons
  for (const v of ['primary', 'secondary', 'danger', 'disabled']) {
    const w = 240, h = 64;
    const { p } = button(v, w, h, v === 'disabled' ? 'dis' : v);
    const V = { primary: '#FFF6E4', secondary: P.burg, danger: '#FFF6E4', disabled: '#8A7E6C' }[v];
    drawText(p, v === 'disabled' ? 'DISABLED' : v.toUpperCase(), w / 2, h / 2 + 1, 3, V);
    p.done().save(`${OUT}/button_${v}.png`);
    made.push(`button_${v}`);
  }
  // panels
  for (const [name, w, h] of [['panel_journal', 480, 560], ['panel_notebook', 420, 480], ['panel_board', 560, 400]]) {
    const p = panel(w, h);
    // header bar
    p.roundRect(10, 10, w - 20, 44, 8, [P.burgDk, P.burg, P.burgLt, P.burgLt, P.burgLt]);
    drawText(p, name.replace('panel_', '').toUpperCase(), w / 2, 32, 3, R.gold[4]);
    // fake content rules
    for (let i = 0; i < Math.floor((h - 90) / 26); i++) {
      p.roundRect(24, 74 + i * 26, w - 60 - (i % 3) * 40, 8, 4, [P.paperLow, P.paperMid, P.paperMid, P.paperMid, P.paperMid]);
    }
    p.done().save(`${OUT}/${name}.png`);
    made.push(name);
  }
  // stamps
  const stamps = [
    ['stamp_guilty', 'GUILTY', P.red],
    ['stamp_not_cooked', 'NOT COOKED', P.green],
    ['stamp_no_verdict', 'NO VERDICT', P.inkSoft],
    ['stamp_charges_filed', 'CHARGES FILED', P.burg],
  ];
  for (const [name, text, col] of stamps) {
    const w = 360, h = 110;
    const p = new Pen(w, h);
    p.poly([[0, 18], [18, 0], [w, 0], [w, h - 18], [w - 18, h], [0, h]], [col, col]);
    p.poly([[10, 22], [24, 10], [w - 10, 10], [w - 10, h - 22], [w - 24, h - 10], [10, h - 10]], ['#00000000', '#00000000']);
    drawText(p, text, w / 2, h / 2, 5, '#FFF8EC', { shadow: col });
    p.done().save(`${OUT}/${name}.png`);
    made.push(name);
  }
  // callouts
  const callouts = [
    ['callout_order', 'ORDER!', P.burg],
    ['callout_objection', 'OBJECTION!', P.red],
    ['callout_counter', 'COUNTER!', P.purple],
  ];
  for (const [name, text, col] of callouts) {
    const w = 420, h = 150;
    const p = new Pen(w, h);
    // comic burst
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 62 : 78;
      const x = w / 2 + Math.cos(a) * r * 1.7, y = h / 2 + Math.sin(a) * r;
      p.poly([[w / 2, h / 2], [x, y], [w / 2 + Math.cos(a + 0.2) * r * 1.7, h / 2 + Math.sin(a + 0.2) * r]], col);
    }
    p.ellipse(w / 2, h / 2, 150, 62, [col, col, col, col, col]);
    drawText(p, text, w / 2, h / 2, 5, '#FFF8EC', { shadow: shade(col, 0.7) });
    p.done().save(`${OUT}/${name}.png`);
    made.push(name);
  }
  // icons
  const icons = {
    icon_journal: (p) => { p.roundRect(8, 4, 32, 44, 4, R.burg); p.roundRect(11, 7, 26, 38, 3, P.paper); for (let i = 0; i < 5; i++) p.roundRect(14, 12 + i * 7, 20, 3, 1, P.inkSoft); },
    icon_notebook: (p) => { p.roundRect(8, 4, 32, 44, 4, P.gold); p.roundRect(11, 7, 26, 38, 3, P.paper); for (let i = 0; i < 4; i++) p.roundRect(14, 14 + i * 8, 20, 3, 1, P.inkSoft); },
    icon_board: (p) => { p.roundRect(6, 6, 36, 40, 4, P.brown || R.brown[2]); p.roundRect(9, 9, 30, 34, 3, P.paperMid); for (let i = 0; i < 3; i++) p.roundRect(12 + (i % 2) * 10, 12 + i * 9, 14, 10, 2, P.paper); },
    icon_accuse: (p) => { p.ellipse(24, 24, 18, 18, R.burg); p.stroke(24, 12, 24, 34, '#FFF8EC', 4); p.stroke(20, 34, 28, 34, '#FFF8EC', 4); },
    icon_endday: (p) => { p.ellipse(24, 26, 18, 18, R.navy[2]); p.ellipse(30, 20, 15, 15, [P.paper, P.paper]); p.stroke(30, 6, 30, 12, R.gold[3], 3); },
    icon_menu: (p) => { for (let i = 0; i < 3; i++) p.roundRect(8, 12 + i * 10, 32, 5, 2, R.ink[1]); },
    icon_sound: (p) => { p.poly([[10, 18], [20, 18], [30, 8], [30, 40], [20, 30], [10, 30]], R.ink[1]); p.stroke(34, 16, 38, 24, R.ink[1], 3); p.stroke(38, 16, 42, 24, R.ink[1], 3); },
    badge_verified: (p) => { p.ellipse(24, 24, 20, 20, R.gold[3]); p.ellipse(24, 24, 15, 15, R.gold[4]); p.poly([[15, 24], [21, 31], [34, 15], [31, 13], [21, 26], [17, 22]], P.green); },
    icon_commit: (p) => { p.roundRect(10, 16, 28, 22, 3, P.paper); p.roundRect(10, 16, 28, 5, 2, R.burg); p.ellipse(24, 27, 5, 5, R.burg); },
    icon_reveal: (p) => { p.roundRect(10, 16, 28, 22, 3, P.paper); p.roundRect(24, 14, 6, 14, 3, R.gold[3]); p.ellipse(27, 16, 5, 4, R.gold[4]); },
    icon_bond: (p) => { p.ellipse(24, 24, 17, 17, R.gold[2]); p.ellipse(24, 24, 12, 12, R.gold[4]); drawText(p, 'B', 24, 24, 3, P.ink); },
    icon_refund: (p) => { p.ellipse(24, 24, 17, 17, P.green); p.ellipse(24, 24, 12, 12, P.greenLt); p.stroke(17, 24, 31, 24, '#FFF8EC', 3); p.stroke(24, 17, 24, 31, '#FFF8EC', 3); },
    icon_slashed: (p) => { p.ellipse(24, 24, 17, 17, P.red); p.stroke(14, 14, 34, 34, '#FFF8EC', 4); p.stroke(34, 14, 14, 34, '#FFF8EC', 4); },
  };
  for (const [name, fn] of Object.entries(icons)) {
    const p = new Pen(48, 48);
    fn(p);
    p.done().save(`${OUT}/${name}.png`);
    p.done().scale(2).save(`${OUT}/${name}@2x.png`);
    made.push(name);
  }
  // verdict cards
  for (const [name, text, col, sub] of [
    ['card_guilty', 'GUILTY', P.red, 'SENTENCE PENDING'],
    ['card_not_cooked', 'NOT COOKED', P.green, 'WALK FREE'],
    ['card_no_verdict', 'NO VERDICT', P.inkSoft, 'JURY FAILED'],
  ]) {
    const p = panel(360, 200, { r: 16 });
    p.roundRect(10, 10, 340, 120, 12, [col, col, col, col, col]);
    drawText(p, text, 180, 56, 6, '#FFF8EC', { shadow: shade(col, 0.68) });
    drawText(p, sub, 180, 100, 3, '#FFF8EC');
    drawText(p, 'CRINGECOURT', 180, 164, 3, P.burg);
    p.done().save(`${OUT}/${name}.png`);
    made.push(name);
  }
  // timer widget
  {
    const p = new Pen(320, 96);
    p.roundRect(2, 2, 316, 92, 12, [P.burgDk, P.burg, P.burgLt, P.burgLt, P.burgLt]);
    p.roundRect(8, 8, 304, 40, 8, [P.paperLow, P.paperMid, P.paper, P.paper, P.paper]);
    // gradient bar
    for (let i = 0; i < 60; i++) {
      const t = i / 59;
      const c = t < 0.5 ? mix(P.goldLt, P.gold, t * 2) : mix(P.gold, P.red, (t - 0.5) * 2);
      p.roundRect(12 + i * 5, 14, 5, 28, 0, [c, c]);
    }
    p.roundRect(180, 14, 3, 28, 0, ['#FFFFFF', '#FFFFFF']);
    drawText(p, 'MIDDAY   18:00', 160, 70, 2, R.gold[4]);
    p.done().save(`${OUT}/timer_widget.png`);
    made.push('timer_widget');
  }
  // receipt card
  {
    const p = new Pen(300, 260);
    p.roundRect(2, 2, 296, 256, 10, [P.paperLow, P.paperMid, P.paper, P.paper, P.paper]);
    p.roundRect(2, 2, 296, 6, 3, R.burg);
    drawText(p, 'SETTLEMENT', 150, 34, 3, P.burg);
    for (let i = 0; i < 5; i++) {
      p.stroke(20, 60 + i * 26, 280, 60 + i * 26, P.paperLow, 1.6);
      drawText(p, i % 2 ? 'REWARD' : 'BOND', 60, 54 + i * 26, 2, P.inkSoft);
    }
    p.stroke(20, 200, 280, 200, P.burg, 2);
    drawText(p, 'TOTAL', 60, 220, 3, P.burg);
    p.done().save(`${OUT}/receipt_card.png`);
    made.push('receipt_card');
  }
  return made;
}

const made = build();
console.log('UI assets:', made.length);
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  note: '9-slice panels, buttons at 240x64, icons at 48x48, stamps, callouts, verdict cards.',
  assets: made,
}, null, 2));
