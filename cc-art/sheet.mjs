import { Canvas } from './core.mjs';
import { BLOCKS } from './blocks.mjs';
export function blockSheet(outFile, scale = 4) {
  const names = Object.keys(BLOCKS);
  const cols = 5;
  const cell = 16 * scale * 2 + 8;
  const rows = Math.ceil(names.length / cols);
  const s = new Canvas(cols * cell + 8, rows * cell + 8);
  s.fill([26, 22, 24, 255]);
  names.forEach((n, i) => {
    const t = BLOCKS[n]().scale(scale);
    const x = 8 + (i % cols) * cell;
    const y = 8 + Math.floor(i / cols) * cell;
    s.blit(t, x, y); s.blit(t, x + 16 * scale, y);
    s.blit(t, x, y + 16 * scale); s.blit(t, x + 16 * scale, y + 16 * scale);
  });
  return s.save(outFile);
}
