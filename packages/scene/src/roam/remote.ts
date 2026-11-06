/**
 * Multiplayer-ready shape, no network. A RemotePlayerFeed pushes PlayerState
 * samples (what Mode 2 / Mode 3 transports will send); RemoteInterpolator
 * renders each remote a little in the past and interpolates between samples.
 * MockRemotePlayers is a feed that walks fake avatars around the gallery.
 */
import type { AvatarSpec, PlayerRole, PlayerState, Unsubscribe, Vec3 } from './types';
import { ROOM_SCALE } from './scale';

const xz = (x: number, y: number, z: number): Vec3 => [x * ROOM_SCALE, y, z * ROOM_SCALE];

/** A remote participant as the transport knows them. */
export interface RemotePlayer {
  readonly id: string;
  readonly avatar: AvatarSpec;
  readonly role: PlayerRole;
}

export interface RemotePlayerFeed {
  /** Called with every batch of samples (any subset of players). */
  subscribe(listener: (samples: readonly PlayerState[]) => void): Unsubscribe;
  /** Players who left. */
  onLeave?(listener: (id: string) => void): Unsubscribe;
  /** Mocks advance on the controller's clock; real transports omit this. */
  tick?(dt: number, now: number): void;
}

/** Interpolation delay (ms): render remotes this far behind the newest sample. */
export const INTERP_DELAY = 120;
const MAX_SAMPLES = 20;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export class RemoteInterpolator {
  readonly #buffers = new Map<string, PlayerState[]>();

  push(samples: readonly PlayerState[]): void {
    for (const s of samples) {
      const buf = this.#buffers.get(s.id) ?? [];
      if (buf.length && s.t <= buf[buf.length - 1]!.t) continue;
      buf.push(s);
      if (buf.length > MAX_SAMPLES) buf.shift();
      this.#buffers.set(s.id, buf);
    }
  }

  remove(id: string): void {
    this.#buffers.delete(id);
  }

  get size(): number {
    return this.#buffers.size;
  }

  /** States at `now - INTERP_DELAY` (clamped to the oldest/newest sample: no extrapolation). */
  sample(now: number, delay = INTERP_DELAY): PlayerState[] {
    const t = now - delay;
    const out: PlayerState[] = [];
    for (const buf of this.#buffers.values()) {
      if (!buf.length) continue;
      let i = buf.length - 1;
      while (i > 0 && buf[i - 1]!.t > t) i--;
      const b = buf[i]!;
      const a = buf[Math.max(0, i - 1)]!;
      if (t >= b.t || a === b) {
        out.push(b);
        continue;
      }
      if (t <= a.t) {
        out.push(a);
        continue;
      }
      const k = (t - a.t) / (b.t - a.t);
      out.push({
        ...b,
        pos: [lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k)],
        yaw: lerpAngle(a.yaw, b.yaw, k),
        pitch: lerp(a.pitch, b.pitch, k),
        speed: lerp(a.speed, b.speed, k),
        t,
      });
    }
    return out;
  }
}

export interface MockWalker extends RemotePlayer {
  /** Closed loop of feet positions (walkable, checked by tests). */
  path: readonly Vec3[];
  speed: number;
  /** Seconds to idle at each waypoint. */
  pause?: number;
}

/** Default fake crowd for the sandbox: a Side B visitor pacing the aisle, a juror browsing the lobby. */
export const DEMO_WALKERS: readonly MockWalker[] = [
  {
    id: 'remote-side-b',
    avatar: { model: 'side-b', name: 'Side B (remote)' },
    role: 'side-b',
    speed: 34,
    pause: 1.5,
    path: [xz(-8, 0, 60), xz(-8, 0, 26), xz(8, 0, 26), xz(8, 0, 60)],
  },
  {
    id: 'remote-juror',
    avatar: { model: 'juror-d', name: 'Grand juror (remote)' },
    role: 'juror',
    speed: 28,
    pause: 2.5,
    path: [xz(-80, 0, 106), xz(-56, 0, 104), xz(-56, 0, 116), xz(-80, 0, 114)],
  },
  {
    id: 'remote-side-a',
    avatar: { model: 'side-a', name: 'Side A (remote)' },
    role: 'side-a',
    speed: 30,
    pause: 2,
    path: [xz(-62, 0, 112), xz(-20, 0, 112), xz(-20, 0, 124), xz(-62, 0, 124)],
  },
];

interface WalkerState {
  w: MockWalker;
  leg: number;
  pos: [number, number, number];
  yaw: number;
  wait: number;
  speed: number;
}

/** A deterministic feed: walkers follow their loops and publish a sample every `interval` seconds (like a 10 Hz network). */
export class MockRemotePlayers implements RemotePlayerFeed {
  readonly #listeners = new Set<(s: readonly PlayerState[]) => void>();
  readonly #walkers: WalkerState[];
  #since = 0;

  constructor(
    walkers: readonly MockWalker[] = DEMO_WALKERS,
    readonly interval = 0.1,
  ) {
    this.#walkers = walkers.map((w) => ({ w, leg: 0, pos: [...w.path[0]!] as [number, number, number], yaw: 0, wait: 0, speed: 0 }));
  }

  subscribe(listener: (s: readonly PlayerState[]) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get players(): readonly RemotePlayer[] {
    return this.#walkers.map((s) => s.w);
  }

  tick(dt: number, now: number): void {
    for (const s of this.#walkers) {
      if (s.wait > 0) {
        s.wait -= dt;
        s.speed = 0;
        continue;
      }
      const target = s.w.path[(s.leg + 1) % s.w.path.length]!;
      const dx = target[0] - s.pos[0];
      const dz = target[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      const step = s.w.speed * dt;
      if (d <= step) {
        s.pos = [target[0], target[1], target[2]];
        s.leg = (s.leg + 1) % s.w.path.length;
        s.wait = s.w.pause ?? 0;
      } else {
        s.pos[0] += (dx / d) * step;
        s.pos[2] += (dz / d) * step;
      }
      s.yaw = Math.atan2(-dx, -dz);
      s.speed = s.w.speed;
    }
    this.#since += dt;
    if (this.#since + 1e-9 < this.interval) return;
    this.#since = 0;
    const samples = this.#walkers.map<PlayerState>((s) => ({
      id: s.w.id,
      avatar: s.w.avatar,
      role: s.w.role,
      pos: [s.pos[0], s.pos[1], s.pos[2]],
      yaw: s.yaw,
      pitch: 0,
      seat: null,
      speed: s.speed,
      t: now,
    }));
    for (const l of this.#listeners) l(samples);
  }
}
