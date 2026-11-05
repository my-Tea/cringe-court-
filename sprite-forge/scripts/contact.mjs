// contact.mjs — lay tiles into one review sheet so quality is judgeable at a glance.
import { Canvas } from './core.mjs';
import { TILES } from './tiles.mjs';

export function contactSheet(outFile, scale = 6, cols = 4) {
  const names = Object.keys(TILES);
  const cell = 16 * scale + 8;
  const rows = Math.ceil(names.length / cols);
  const sheet = new Canvas(cols * cell + 8, rows * cell + 8);
  sheet.fill([22, 20, 28, 255]); // dark grey backdrop, like an engine viewport
  names.forEach((name, i) => {
    const t = TILES[name]().scale(scale);
    const x = 8 + (i % cols) * cell;
    const y = 8 + Math.floor(i / cols) * cell;
    // 2x2 repeat to expose tile seams
    sheet.blit(t, x, y); sheet.blit(t, x + 16 * scale, y); sheet.blit(t, x, y + 16 * scale); sheet.blit(t, x + 16 * scale, y + 16 * scale);
  });
  return sheet.save(outFile);
}
