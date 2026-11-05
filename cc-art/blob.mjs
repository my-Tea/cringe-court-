// Deterministic blob geometry for voxel props — shared by every prop so the
// whole set has one construction logic and one palette.
export class Blob {
  constructor(palette) { this.boxes = []; this.P = palette; }
  /** from/to in units; col is a palette hex or key. */
  box(from, to, col) { this.boxes.push({ from, to, col }); return this; }
  mirrorX(from, to, col) { this.box(from, to, col); this.box([-to[0], from[1], from[2]], [-from[0], to[1], to[2]], col); return this; }
  /** Stamp a rectangle of boxes along one axis (for plank rows, steps, etc). */
  row(axis, count, from, to, col, step) {
    for (let i = 0; i < count; i++) {
      const f = from.slice(), t = to.slice();
      f[axis] += i * step; t[axis] += i * step;
      this.box(f, t, typeof col === 'function' ? col(i) : col);
    }
    return this;
  }
  get count() { return this.boxes.length; }
}
