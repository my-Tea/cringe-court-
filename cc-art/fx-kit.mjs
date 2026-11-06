// FX sprites + verdict words — the effects the animation timelines reference.
import { Pen, mix, shade } from './pen3.mjs';
import { R } from './artkit.mjs';
import fs from 'node:fs';

const OUT = './dist/fx';
fs.mkdirSync(OUT, { recursive: true });
const made = [];

/* impact star — 4 frames expanding */
for (let f = 0; f < 4; f++) {
  const p = new Pen(160, 160);
  const k = 0.45 + f * 0.19;
  const spikes = 10;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = (i % 2 ? 32 : 72) * k;
    pts.push([80 + Math.cos(a) * r, 80 + Math.sin(a) * r]);
  }
  p.poly(pts, ['#FFF2C7', '#F6C75B', '#D9A046', '#D9A046', '#D9A046']);
  p.ellipse(80, 80, 30 * k, 30 * k, ['#FFFFFF', '#FFF9ED', '#FFF9ED', '#FFF9ED', '#FFF9ED']);
  p.done().save(`${OUT}/impact_${f}.png`);
  made.push(`impact_${f}`);
}

/* flash — radial burst */
{
  const p = new Pen(200, 200);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const len = i % 2 ? 70 : 96;
    p.poly([[100, 100], [100 + Math.cos(a) * len, 100 + Math.sin(a) * len],
      [100 + Math.cos(a + 0.16) * len, 100 + Math.sin(a + 0.16) * len]], '#FFF2C7');
  }
  p.ellipse(100, 100, 46, 46, ['#F6C75B', '#F6C75B', '#FFF2C7', '#FFF2C7', '#FFFFFF']);
  p.done().save(`${OUT}/flash.png`);
  made.push('flash');
}

/* sweat drop */
{
  const p = new Pen(48, 64);
  p.poly([[24, 4], [38, 34], [36, 48], [24, 56], [12, 48], [10, 34]], ['#8ED8F0', '#8ED8F0', '#A8E4F4', '#C8F0FA', '#E8FAFF']);
  p.ellipse(18, 30, 5, 8, ['#E8FAFF', '#E8FAFF', '#FFFFFF', '#FFFFFF', '#FFFFFF']);
  p.done().save(`${OUT}/sweat.png`);
  made.push('sweat');
}

/* tear drop */
{
  const p = new Pen(40, 56);
  p.poly([[20, 4], [32, 30], [30, 42], [20, 50], [10, 42], [8, 30]], ['#7FC4E8', '#8ED8F0', '#A8E4F4', '#C8F0FA', '#E8FAFF']);
  p.ellipse(15, 26, 4, 7, ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF']);
  p.done().save(`${OUT}/tear.png`);
  made.push('tear');
}

/* blush patch */
{
  const p = new Pen(80, 32);
  p.ellipse(40, 16, 36, 12, ['#F5A3A9', '#F5A3A9', '#F8B8BD', '#FAD0D3', '#FCE4E6']);
  for (let i = 0; i < 5; i++) {
    p.stroke(16 + i * 12, 8, 12 + i * 12, 24, '#E08088', 2);
  }
  p.done().save(`${OUT}/blush.png`);
  made.push('blush');
}

/* sparkle */
{
  const p = new Pen(48, 48);
  p.poly([[24, 2], [28, 20], [46, 24], [28, 28], [24, 46], [20, 28], [2, 24], [20, 20]],
    ['#FFF2C7', '#F6C75B', '#FFF9ED', '#FFFFFF', '#FFFFFF']);
  p.done().save(`${OUT}/sparkle.png`);
  made.push('sparkle');
}

/* shake indicator */
{
  const p = new Pen(64, 64);
  for (let i = 0; i < 3; i++) {
    p.stroke(10 + i * 6, 16, 24 + i * 6, 32, R.ink[1], 3);
    p.stroke(24 + i * 6, 32, 10 + i * 6, 48, R.ink[1], 3);
  }
  p.done().save(`${OUT}/shake.png`);
  made.push('shake');
}

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  note: 'FX overlays, additively blended. impact_0..3 is a 4-frame burst at 12fps.',
  assets: made,
}, null, 2));
console.log('FX assets:', made.length);
