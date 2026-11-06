/**
 * Quality presets and the auto-downgrade monitor. The renderer reads a preset;
 * the monitor watches frame times and steps the preset down when the frame
 * budget is missed for a sustained stretch (never up: no oscillation).
 */
export type QualityLevel = 'low' | 'medium' | 'high';
export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

export interface QualityPreset {
  level: QualityLevel;
  /** Internal render height in pixels when pixel mode is on (width follows the aspect). */
  pixelHeight: number;
  /** Device-pixel-ratio cap when pixel mode is off. */
  dprCap: number;
  /** Shadow map size for the single shadow-casting key light; 0 disables shadows. */
  shadowMap: number;
  /** Point lights (sconces) kept on. */
  pointLights: number;
  /** Distance fog far plane. */
  fogFar: number;
  /** Camera far plane (frustum culling does the rest). */
  far: number;
  /** Animate remote avatars and NPC heads every frame (else every other). */
  fullRateAnimation: boolean;
}

export const QUALITY: Readonly<Record<QualityLevel, QualityPreset>> = {
  low: { level: 'low', pixelHeight: 200, dprCap: 1, shadowMap: 0, pointLights: 2, fogFar: 300, far: 360, fullRateAnimation: false },
  medium: { level: 'medium', pixelHeight: 270, dprCap: 1.5, shadowMap: 1024, pointLights: 4, fogFar: 420, far: 480, fullRateAnimation: true },
  high: { level: 'high', pixelHeight: 360, dprCap: 2, shadowMap: 2048, pointLights: 8, fogFar: 520, far: 560, fullRateAnimation: true },
};

export function lowerQuality(level: QualityLevel): QualityLevel | null {
  const i = QUALITY_LEVELS.indexOf(level);
  return i > 0 ? QUALITY_LEVELS[i - 1]! : null;
}

export interface AutoQualityOptions {
  /** Frame time considered "missed" (seconds). Default: 1/50 (below 50 fps). */
  budget?: number;
  /** Seconds of sustained misses before stepping down. */
  window?: number;
  /** Ignore the first seconds (shader compile, asset upload). */
  warmup?: number;
}

/** Exponential moving average of frame time; reports a new level when it should drop. */
export class AutoQuality {
  #avg = 1 / 60;
  #bad = 0;
  #age = 0;
  readonly #budget: number;
  readonly #window: number;
  readonly #warmup: number;

  constructor(
    public level: QualityLevel,
    opts: AutoQualityOptions = {},
  ) {
    this.#budget = opts.budget ?? 1 / 50;
    this.#window = opts.window ?? 3;
    this.#warmup = opts.warmup ?? 2;
  }

  get averageFps(): number {
    return 1 / this.#avg;
  }

  /** Feed one frame. Returns the new level when it downgrades, else null. */
  sample(dt: number): QualityLevel | null {
    if (!(dt > 0) || dt > 0.5) return null; // tab switches, breakpoints
    this.#age += dt;
    this.#avg += (dt - this.#avg) * 0.1;
    if (this.#age < this.#warmup) return null;
    this.#bad = this.#avg > this.#budget ? this.#bad + dt : 0;
    if (this.#bad < this.#window) return null;
    const next = lowerQuality(this.level);
    this.#bad = 0;
    this.#age = 0;
    if (!next) return null;
    this.level = next;
    return next;
  }
}
