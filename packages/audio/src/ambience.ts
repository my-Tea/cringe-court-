/**
 * The courtroom bed on the music bus. Layers run continuously and presets only
 * move their levels, so switching phase crossfades instead of restarting:
 *
 * - room:      brown noise under a low lowpass (the hall's air)
 * - hum:       a faint ventilation hum
 * - murmur:    synthetic talkers in the gallery, distant and filtered
 * - tension:   a low, slowly beating drone for deliberation and the verdict wait
 * - clock:     a soft wall clock during deliberation
 * - incidents: occasional coughs, chair creaks, footsteps and shuffled papers
 *
 * Automation is scheduled ahead in chunks by `schedule(until)`. The live engine
 * calls it from a timer; the offline renderer calls it once for the whole render.
 */
import { mtof, Synth, type Rng } from './dsp.ts';
import { glide, type Bus } from './mixer.ts';
import { speak, voiceRig, type VoiceRig } from './recipes/crowd.ts';
import { metalTick } from './recipes/instruments.ts';

export const AMBIENCE_PRESETS = ['off', 'lobby', 'session', 'deliberation', 'verdict'] as const;
export type AmbiencePreset = (typeof AMBIENCE_PRESETS)[number];

interface Levels {
  room: number;
  hum: number;
  murmur: number;
  murmurCutoff: number;
  tension: number;
  clock: number;
  /** Incidental sounds per second. */
  incidents: number;
}

export const AMBIENCE_LEVELS: Readonly<Record<Exclude<AmbiencePreset, 'off'>, Levels>> = {
  /** Before and between hearings: a full, chatty gallery. */
  lobby: { room: 0.5, hum: 0.3, murmur: 0.6, murmurCutoff: 1700, tension: 0, clock: 0, incidents: 0.22 },
  /** Arguments in progress: a hushed room that is still listening. */
  session: { room: 0.45, hum: 0.25, murmur: 0.14, murmurCutoff: 900, tension: 0, clock: 0, incidents: 0.08 },
  /** Ballots are sealed: near silence, a drone and the clock. */
  deliberation: { room: 0.4, hum: 0.2, murmur: 0.05, murmurCutoff: 700, tension: 0.5, clock: 0.55, incidents: 0.03 },
  /** The card is about to turn: held breath. */
  verdict: { room: 0.35, hum: 0.15, murmur: 0, murmurCutoff: 600, tension: 0.32, clock: 0, incidents: 0 },
};

const SILENT: Levels = { room: 0, hum: 0, murmur: 0, murmurCutoff: 600, tension: 0, clock: 0, incidents: 0 };

/** Never-ending sources still need a finite stop time; a day is plenty. */
const FOREVER = 24 * 3600;
const TALKERS = 7;
/** The bed sits well under the cues; the music slider scales it further. */
const BED_LEVEL = 0.5;

export class AmbienceBed {
  private readonly s: Synth;
  private readonly out: GainNode;
  private readonly layer: Record<'room' | 'hum' | 'murmur' | 'tension' | 'clock', GainNode>;
  private readonly murmurLp: BiquadFilterNode;
  private readonly talkers: { rig: VoiceRig; f0: number; rate: number }[] = [];
  private readonly incidents: Synth[] = [];
  private levels: Levels = SILENT;
  private scheduledUntil: number;
  private nextIncident: number;
  private stopped = false;
  preset: AmbiencePreset = 'off';

  constructor(
    private readonly ctx: BaseAudioContext,
    bus: Bus,
    private readonly rng: Rng,
    start: number,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = BED_LEVEL;
    this.out.connect(bus.input);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    this.out.connect(send);
    send.connect(bus.send);

    const s = new Synth(ctx, this.out, rng);
    this.s = s;
    this.layer = { room: s.gain(0), hum: s.gain(0), murmur: s.gain(0), tension: s.gain(0), clock: s.gain(0) };

    // Room air.
    s.noiseSource('brown', start, start + FOREVER, s.filter('lowpass', 320, 0.6, s.gain(0.5, this.layer.room)));
    s.noiseSource('pink', start, start + FOREVER, s.filter('lowpass', 2400, 0.5, s.gain(0.02, this.layer.room)));
    // Ventilation.
    s.osc('sine', 58, start, start + FOREVER, s.gain(0.03, this.layer.hum));
    s.osc('sine', 116.4, start, start + FOREVER, s.gain(0.012, this.layer.hum));
    s.noiseSource('pink', start, start + FOREVER, s.filter('bandpass', 190, 3, s.gain(0.05, this.layer.hum)));
    // Gallery talkers.
    this.murmurLp = s.filter('lowpass', 1200, 0.6, this.layer.murmur);
    for (let i = 0; i < TALKERS; i++) {
      const f0 = rng.chance(0.5) ? rng.range(95, 140) : rng.range(175, 240);
      const rig = voiceRig(s, start, start + FOREVER, f0, rng.range(-0.9, 0.9), this.murmurLp, 0.5);
      this.talkers.push({ rig, f0, rate: rng.range(3.2, 5.2) });
    }
    // Tension drone: D1 and A1, slightly detuned so they beat, under a slow filter.
    const tlp = s.filter('lowpass', 240, 2, this.layer.tension);
    for (const [n, cents] of [
      [26, -4],
      [26, 5],
      [33, 2],
    ] as const) {
      const o = s.osc('sawtooth', mtof(n), start, start + FOREVER, s.gain(0.09, tlp));
      o.detune.value = cents;
    }
    const lfoDepth = s.gain(110, tlp.frequency);
    s.osc('sine', 0.07, start, start + FOREVER, lfoDepth);
    s.osc('sine', mtof(74), start, start + FOREVER, s.gain(0.006, this.layer.tension));

    this.scheduledUntil = start;
    this.nextIncident = start + rng.range(1, 4);
  }

  /** Crossfades to a preset. `fade` is the approximate transition time in seconds. */
  setPreset(preset: AmbiencePreset, now: number, fade = 2.5): void {
    this.preset = preset;
    this.levels = preset === 'off' ? SILENT : AMBIENCE_LEVELS[preset];
    const tc = Math.max(0.01, fade / 3);
    for (const key of ['room', 'hum', 'murmur', 'tension', 'clock'] as const) {
      glide(this.layer[key].gain, this.levels[key], now, tc);
    }
    glide(this.murmurLp.frequency, this.levels.murmurCutoff, now, tc);
  }

  /** Schedules talker syllables, clock ticks and incidents up to `until`. */
  schedule(until: number): void {
    if (this.stopped || until <= this.scheduledUntil) return;
    const from = this.scheduledUntil;
    for (const t of this.talkers) speak(this.s, t.rig, from, until, t.f0, 0.38, t.rate);
    if (this.levels.clock > 0) {
      for (let k = Math.ceil(from); k < until; k++) {
        metalTick(this.s, k, k % 2 ? 1900 : 1650, 0.25, this.layer.clock);
      }
    }
    this.pruneIncidents(from);
    while (this.nextIncident < until) {
      if (this.levels.incidents > 0) this.incident(this.nextIncident);
      const rate = Math.max(0.02, this.levels.incidents);
      this.nextIncident += (1 / rate) * this.rng.range(0.5, 1.5);
    }
    this.scheduledUntil = until;
  }

  stop(now: number, fade = 0.8): void {
    if (this.stopped) return;
    this.stopped = true;
    glide(this.out.gain, 0, now, fade / 4);
    const end = now + fade + 0.05;
    for (const src of [...this.s.sources, ...this.incidents.flatMap((s) => s.sources)]) {
      try {
        src.stop(end);
      } catch {
        // already ended
      }
    }
  }

  dispose(): void {
    for (const n of [...this.s.nodes, ...this.incidents.flatMap((s) => s.nodes), this.out]) n.disconnect();
    this.incidents.length = 0;
  }

  private pruneIncidents(now: number): void {
    for (let i = this.incidents.length - 1; i >= 0; i--) {
      const s = this.incidents[i]!;
      if (s.end < now - 2) {
        for (const n of s.nodes) n.disconnect();
        this.incidents.splice(i, 1);
      }
    }
  }

  private incident(t: number): void {
    const s = new Synth(this.ctx, this.out, this.rng);
    const p = s.pan(this.rng.range(-0.9, 0.9));
    const lp = s.filter('lowpass', 2200, 0.6, s.gain(this.rng.range(0.5, 0.9), p));
    switch (this.rng.int(0, 3)) {
      case 0: // cough
        for (const dt of [0, this.rng.range(0.16, 0.24)]) {
          s.burst(t + dt, 0.35, 0.13, 'bandpass', this.rng.range(450, 900), 1.2, 'pink', lp);
          s.thump(t + dt, 150, 110, 0.12, 0.08, lp);
        }
        break;
      case 1: {
        // chair creak
        const res = s.filter('bandpass', this.rng.range(700, 1300), 12, s.gain(1.6, lp));
        const g = s.gain(0, res);
        s.line(g.gain, [
          [t, 0],
          [t + 0.05, 0.5],
          [t + 0.3, 0],
        ]);
        const o = s.osc('sawtooth', 45, t, t + 0.32, g);
        o.frequency.linearRampToValueAtTime(this.rng.range(60, 90), t + 0.3);
        break;
      }
      case 2: // footsteps
        for (let k = 0; k < this.rng.int(3, 5); k++) {
          const at = t + k * this.rng.range(0.48, 0.56);
          s.thump(at, 110, 70, 0.25, 0.09, lp);
          s.burst(at, 0.1, 0.03, 'bandpass', 1400, 1, 'white', lp);
        }
        break;
      default: // shuffled papers
        for (let k = 0; k < 10; k++) {
          s.burst(t + this.rng.range(0, 0.35), this.rng.range(0.05, 0.14), this.rng.range(0.008, 0.025), 'bandpass', this.rng.range(1800, 4500), 1, 'white', lp);
        }
    }
    this.incidents.push(s);
  }
}
