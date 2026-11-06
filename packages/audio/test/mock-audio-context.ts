/**
 * A strict, recording fake of the Web Audio subset this package uses.
 *
 * It does not make sound. It records every connection, start/stop and param
 * automation, and it throws where browsers throw (exponential ramp to 0,
 * non-finite values, negative times, starting a source twice, connecting
 * across contexts), so recipe mistakes fail tests instead of failing in
 * Safari.
 */

export class MockParam {
  value: number;
  readonly events: { kind: string; value: number; time: number; extra?: number }[] = [];
  readonly inputs: MockNode[] = [];
  constructor(
    readonly owner: MockNode,
    readonly name: string,
    value: number,
  ) {
    this.value = value;
  }
  private check(value: number, time: number) {
    if (!Number.isFinite(value) || !Number.isFinite(time)) throw new TypeError(`${this.name}: non-finite value/time ${value} @ ${time}`);
    if (time < 0) throw new RangeError(`${this.name}: negative time ${time}`);
  }
  setValueAtTime(value: number, time: number) {
    this.check(value, time);
    this.events.push({ kind: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.check(value, time);
    this.events.push({ kind: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.check(value, time);
    if (Math.abs(value) < 1.4e-45) throw new RangeError(`${this.name}: exponential ramp to 0`);
    this.events.push({ kind: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, timeConstant: number) {
    this.check(value, time);
    if (!Number.isFinite(timeConstant)) throw new TypeError(`${this.name}: non-finite timeConstant`);
    if (timeConstant < 0) throw new RangeError(`${this.name}: negative timeConstant`);
    this.events.push({ kind: 'target', value, time, extra: timeConstant });
    return this;
  }
  cancelScheduledValues(time: number) {
    if (!Number.isFinite(time)) throw new TypeError('cancel: non-finite');
    if (time < 0) throw new RangeError('cancel: negative time');
    this.events.push({ kind: 'cancel', value: Number.NaN, time });
    return this;
  }
  /** The last value scheduled at or before `time` (ignoring curve shapes). */
  valueAt(time: number): number {
    let v = this.value;
    for (const e of this.events) if (e.kind !== 'cancel' && e.time <= time) v = e.value;
    return v;
  }
}

let nextId = 1;

export class MockNode {
  readonly id = nextId++;
  readonly outputs: (MockNode | MockParam)[] = [];
  readonly inputs: MockNode[] = [];
  disconnected = 0;
  channelInterpretation = 'speakers';
  constructor(
    readonly context: MockAudioContext,
    readonly kind: string,
  ) {
    context.created.push(this);
  }
  connect(dest: MockNode | MockParam) {
    const ctx = dest instanceof MockParam ? dest.owner.context : dest.context;
    if (ctx !== this.context) throw new DOMException('cross-context connect', 'InvalidAccessError');
    this.outputs.push(dest);
    dest.inputs.push(this);
    return dest;
  }
  disconnect() {
    this.disconnected++;
    for (const d of this.outputs) {
      const i = d.inputs.indexOf(this);
      if (i >= 0) d.inputs.splice(i, 1);
    }
    this.outputs.length = 0;
  }
}

class MockGain extends MockNode {
  readonly gain = new MockParam(this, 'gain', 1);
  constructor(c: MockAudioContext) {
    super(c, 'gain');
  }
}

class MockBiquad extends MockNode {
  type = 'lowpass';
  readonly frequency = new MockParam(this, 'frequency', 350);
  readonly Q = new MockParam(this, 'Q', 1);
  readonly gain = new MockParam(this, 'gain', 0);
  readonly detune = new MockParam(this, 'detune', 0);
  constructor(c: MockAudioContext) {
    super(c, 'biquad');
  }
}

class MockPanner extends MockNode {
  readonly pan = new MockParam(this, 'pan', 0);
  constructor(c: MockAudioContext) {
    super(c, 'panner');
  }
}

class MockShaper extends MockNode {
  curve: Float32Array | null = null;
  oversample = 'none';
  constructor(c: MockAudioContext) {
    super(c, 'shaper');
  }
}

class MockConvolver extends MockNode {
  buffer: MockBuffer | null = null;
  normalize = true;
  constructor(c: MockAudioContext) {
    super(c, 'convolver');
  }
}

class MockCompressor extends MockNode {
  readonly threshold = new MockParam(this, 'threshold', -24);
  readonly knee = new MockParam(this, 'knee', 30);
  readonly ratio = new MockParam(this, 'ratio', 12);
  readonly attack = new MockParam(this, 'attack', 0.003);
  readonly release = new MockParam(this, 'release', 0.25);
  constructor(c: MockAudioContext) {
    super(c, 'compressor');
  }
}

export class MockSource extends MockNode {
  startedAt: number | null = null;
  offset = 0;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(when = 0, offset = 0) {
    if (this.startedAt !== null) throw new DOMException('start() called twice', 'InvalidStateError');
    if (!Number.isFinite(when) || !Number.isFinite(offset)) throw new TypeError('start: non-finite');
    if (when < 0 || offset < 0) throw new RangeError('start: negative');
    this.startedAt = when;
    this.offset = offset;
  }
  stop(when = 0) {
    if (this.startedAt === null) throw new DOMException('stop() before start()', 'InvalidStateError');
    if (!Number.isFinite(when)) throw new TypeError('stop: non-finite');
    if (when < 0) throw new RangeError('stop: negative');
    this.stoppedAt = when;
  }
}

class MockOscillator extends MockSource {
  type = 'sine';
  readonly frequency = new MockParam(this, 'frequency', 440);
  readonly detune = new MockParam(this, 'detune', 0);
  constructor(c: MockAudioContext) {
    super(c, 'oscillator');
  }
}

class MockBufferSource extends MockSource {
  buffer: MockBuffer | null = null;
  loop = false;
  readonly playbackRate = new MockParam(this, 'playbackRate', 1);
  constructor(c: MockAudioContext) {
    super(c, 'buffer-source');
  }
}

export class MockBuffer {
  private readonly data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    if (numberOfChannels < 1 || length < 1 || sampleRate < 3000) throw new DOMException('bad buffer', 'NotSupportedError');
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(ch: number) {
    const d = this.data[ch];
    if (!d) throw new DOMException('bad channel', 'IndexSizeError');
    return d;
  }
}

type Listener = () => void;

export class MockAudioContext {
  readonly created: MockNode[] = [];
  readonly sampleRate: number;
  currentTime = 0;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination: MockNode;
  readonly calls: string[] = [];
  /** When set, the next `resume()` leaves the context suspended (autoplay blocked). */
  blockResume = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(opts: { sampleRate?: number } = {}) {
    this.sampleRate = opts.sampleRate ?? 48000;
    this.destination = new MockNode(this, 'destination');
  }

  createGain() {
    return new MockGain(this);
  }
  createBiquadFilter() {
    return new MockBiquad(this);
  }
  createStereoPanner() {
    return new MockPanner(this);
  }
  createWaveShaper() {
    return new MockShaper(this);
  }
  createConvolver() {
    return new MockConvolver(this);
  }
  createDynamicsCompressor() {
    return new MockCompressor(this);
  }
  createOscillator() {
    return new MockOscillator(this);
  }
  createBufferSource() {
    return new MockBufferSource(this);
  }
  createBuffer(ch: number, len: number, rate: number) {
    return new MockBuffer(ch, len, rate);
  }

  async resume() {
    this.calls.push('resume');
    if (this.state === 'closed') throw new DOMException('closed', 'InvalidStateError');
    if (!this.blockResume) this.setState('running');
  }
  async suspend() {
    this.calls.push('suspend');
    this.setState('suspended');
  }
  async close() {
    this.calls.push('close');
    this.setState('closed');
  }
  addEventListener(type: string, cb: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }
  removeEventListener(type: string, cb: Listener) {
    this.listeners.get(type)?.delete(cb);
  }
  setState(state: MockAudioContext['state']) {
    if (state === this.state) return;
    this.state = state;
    for (const cb of this.listeners.get('statechange') ?? []) cb();
  }

  // -- Inspection helpers for tests -------------------------------------------

  sources(): MockSource[] {
    return this.created.filter((n): n is MockSource => n instanceof MockSource);
  }

  /** True if `node` has a path of connections to the destination. */
  reaches(node: MockNode): boolean {
    const seen = new Set<MockNode>();
    const walk = (n: MockNode): boolean => {
      if (n === this.destination) return true;
      if (seen.has(n)) return false;
      seen.add(n);
      return n.outputs.some((o) => (o instanceof MockParam ? walk(o.owner) : walk(o)));
    };
    return walk(node);
  }

  params(): MockParam[] {
    const out: MockParam[] = [];
    for (const n of this.created) for (const v of Object.values(n)) if (v instanceof MockParam) out.push(v);
    return out;
  }
}

/** Typed as the real thing for code under test. */
export const asAudioContext = (c: MockAudioContext) => c as unknown as AudioContext;

export class FakeTimers {
  now = 0;
  private seq = 1;
  readonly pending = new Map<number, { at: number; cb: () => void; every?: number }>();
  setTimeout = (cb: () => void, ms: number) => {
    const id = this.seq++;
    this.pending.set(id, { at: this.now + ms, cb });
    return id;
  };
  clearTimeout = (id: unknown) => {
    this.pending.delete(id as number);
  };
  setInterval = (cb: () => void, ms: number) => {
    const id = this.seq++;
    this.pending.set(id, { at: this.now + ms, cb, every: ms });
    return id;
  };
  clearInterval = (id: unknown) => {
    this.pending.delete(id as number);
  };
  /** Runs everything due within `ms`, in time order. */
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      let next: [number, { at: number; cb: () => void; every?: number }] | null = null;
      for (const e of this.pending) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      const [id, t] = next;
      this.now = t.at;
      if (t.every) t.at += t.every;
      else this.pending.delete(id);
      t.cb();
    }
    this.now = end;
  }
  get intervals() {
    return [...this.pending.values()].filter((t) => t.every).length;
  }
}

export class FakeTarget {
  readonly listeners = new Map<string, Set<() => void>>();
  visibilityState: 'visible' | 'hidden' = 'visible';
  addEventListener(type: string, cb: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.listeners.get(type)?.delete(cb);
  }
  dispatch(type: string) {
    for (const cb of [...(this.listeners.get(type) ?? [])]) cb();
  }
  count(type?: string) {
    if (type) return this.listeners.get(type)?.size ?? 0;
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
}

export class FakeMedia {
  matches: boolean;
  private readonly cbs = new Set<() => void>();
  constructor(matches = false) {
    this.matches = matches;
  }
  addEventListener(_: 'change', cb: () => void) {
    this.cbs.add(cb);
  }
  removeEventListener(_: 'change', cb: () => void) {
    this.cbs.delete(cb);
  }
  set(matches: boolean) {
    this.matches = matches;
    for (const cb of this.cbs) cb();
  }
  get listenerCount() {
    return this.cbs.size;
  }
}
