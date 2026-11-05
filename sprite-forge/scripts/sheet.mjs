// sheet.mjs — pack frames into a uniform grid sheet on transparent background.
// Uniform cells + reading order is what every engine and Aseprite expect.
import { Canvas } from './core.mjs';

/** @param frames [{name, canvas}] in reading order. Pads all to a common cell. */
export function packSheet(frames, { cols = null, padding = 0, cell = null } = {}) {
  const cw = cell ? cell[0] : Math.max(...frames.map((f) => f.canvas.w));
  const ch = cell ? cell[1] : Math.max(...frames.map((f) => f.canvas.h));
  const n = frames.length;
  const colCount = cols ?? Math.ceil(Math.sqrt(n));
  const rowCount = Math.ceil(n / colCount);
  const sheet = new Canvas(colCount * (cw + padding) + padding, rowCount * (ch + padding) + padding);
  const cells = [];
  frames.forEach((f, i) => {
    const cx = i % colCount, cy = Math.floor(i / colCount);
    const ox = padding + cx * (cw + padding);
    const oy = padding + cy * (ch + padding);
    // bottom-align so taller sprites stand on a shared baseline
    const dx = ox + Math.floor((cw - f.canvas.w) / 2);
    const dy = oy + (ch - f.canvas.h);
    sheet.blit(f.canvas, dx, dy);
    cells.push({ name: f.name, x: ox, y: oy, w: cw, h: ch });
  });
  return { sheet, cells, cols: colCount, rows: rowCount, cell: [cw, ch] };
}

/** Strip: single row, for animation cycles consumed by a shader or timeline. */
export function packStrip(frames) {
  return packSheet(frames, { cols: frames.length });
}
