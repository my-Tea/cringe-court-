// break.mjs — the 10-stage crack overlay used by first-person mining.
// In a Minecraft-like game this is drawn on top of the targeted block and is
// therefore the animation the player sees more than any other.
import { Canvas, mulberry32 } from './core.mjs';
import { packStrip } from './sheet.mjs';

export const STAGES = 10;

/** Deterministic crack growth: start from a seed point, grow a branching
 *  fracture into the block. Each stage is a superset of the previous one, so
 *  the overlay reads as progressive damage rather than flickering noise. */
export function crackFrames(size = 16) {
  const rnd = mulberry32(20261);
  const cells = [];
  // grow a set of fracture paths
  const paths = [];
  for (let p = 0; p < 5; p++) {
    let x = 3 + Math.floor(rnd() * (size - 6));
    let y = 3 + Math.floor(rnd() * (size - 6));
    const path = [[x, y]];
    const steps = 7 + Math.floor(rnd() * 6);
    let angle = rnd() * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      angle += (rnd() - 0.5) * 1.5;
      x += Math.round(Math.cos(angle));
      y += Math.round(Math.sin(angle));
      if (x < 0 || y < 0 || x >= size || y >= size) break;
      path.push([x, y]);
      // occasional branch → cracks look shattered, not drawn with a pen
      if (rnd() > 0.72) {
        const len = 2 + Math.floor(rnd() * 3);
        let bx = x, by = y, ba = angle + (rnd() > 0.5 ? 1 : -1) * (0.7 + rnd());
        const br = [];
        for (let k = 0; k < len; k++) {
          bx += Math.round(Math.cos(ba)); by += Math.round(Math.sin(ba));
          if (bx < 0 || by < 0 || bx >= size || by >= size) break;
          br.push([bx, by]);
        }
        if (br.length) paths.push(br);
      }
    }
    paths.push(path);
  }

  const total = paths.reduce((a, p) => a + p.length, 0);
  const dark = [24, 20, 30, 220];
  const light = [255, 255, 255, 90]; // faint highlight on the crack lip

  for (let stage = 0; stage < STAGES; stage++) {
    const c = new Canvas(size, size);
    const budget = Math.round(((stage + 1) / STAGES) * total);
    let drawn = 0;
    for (const path of paths) {
      for (const [x, y] of path) {
        if (drawn++ >= budget) break;
        c.set(x, y, dark);
        // 1px highlight on the right/below lip gives the fracture depth
        if (c.get(x + 1, y)[3] === 0 && (x + y) % 3 === 0) c.set(x + 1, y, light);
      }
      if (drawn >= budget) break;
    }
    cells.push({ name: `break_${stage}`, canvas: c });
  }
  return cells;
}

export function buildBreak(outDir, size = 16) {
  const frames = crackFrames(size);
  const made = [];
  // individual frames @1x and @4x
  for (const f of frames) {
    made.push(f.canvas.save(`${outDir}/break/${f.name}.png`));
    f.canvas.scale(4).save(`${outDir}/break/@4x/${f.name}.png`);
  }
  // strip + sheet
  const { sheet, cells } = packStrip(frames);
  made.push(sheet.save(`${outDir}/break/break_strip.png`));
  sheet.scale(4).save(`${outDir}/break/@4x/break_strip.png`);
  return { made, cells };
}
