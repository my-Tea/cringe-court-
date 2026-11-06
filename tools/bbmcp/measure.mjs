// Measure the opaque extent of a PNG, for the Blockbench framing feedback loop.
//
// The orthographic zoom that frames a model is not derivable from the model's
// size alone: Blockbench applies `zoom` on top of a viewport frustum whose scale
// depends on the window. Rather than guess a constant, the preview script takes
// a shot, measures how much of the frame the model actually fills, and corrects.
// This module is that measurement.
//
//   node tools/bbmcp/measure.mjs <png> [--json]
import fs from 'node:fs';
import { PNG } from 'pngjs';

/**
 * Bounding box of pixels that differ from the image's background.
 *
 * Blockbench renders on a flat background (white in the default theme), so
 * "content" is anything meaningfully off that colour. Returns normalized
 * fractions so the caller does not care about the pixel size.
 */
export function contentBounds(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width, height, data } = png;

  // The background is whatever the corner pixels are; sample all four in case a
  // model touches one corner.
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ].map(([x, y]) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  });
  const bg = corners[0];
  const isBg = (i) =>
    Math.abs(data[i] - bg[0]) <= 6 &&
    Math.abs(data[i + 1] - bg[1]) <= 6 &&
    Math.abs(data[i + 2] - bg[2]) <= 6 &&
    Math.abs(data[i + 3] - bg[3]) <= 6;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isBg(i)) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { empty: true, width, height, coverage: 0, fillW: 0, fillH: 0, centreX: 0.5, centreY: 0.5, touchesEdge: false };
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  return {
    empty: false,
    width,
    height,
    /** Longest on-screen dimension as a fraction of the frame. */
    coverage: Math.max(bw / width, bh / height),
    fillW: bw / width,
    fillH: bh / height,
    /** Content centre as a fraction of the frame (0.5 = centred). */
    centreX: (minX + maxX + 1) / 2 / width,
    centreY: (minY + maxY + 1) / 2 / height,
    /** True when the model is clipped by the viewport. */
    touchesEdge: minX <= 1 || minY <= 1 || maxX >= width - 2 || maxY >= height - 2,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/bbmcp/measure.mjs <png> [--json]');
    process.exit(2);
  }
  const r = contentBounds(file);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else
    console.log(
      `${file}: ${r.width}×${r.height} content ${(r.fillW * 100).toFixed(1)}%×${(r.fillH * 100).toFixed(1)}%` +
        ` centre (${r.centreX.toFixed(2)}, ${r.centreY.toFixed(2)})${r.touchesEdge ? ' CLIPPED' : ''}`,
    );
}
