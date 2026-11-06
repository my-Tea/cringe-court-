import { usdc } from '@cringe-court/core';
import { describe, expect, it, vi } from 'vitest';
import { MemoryFactStore, decodeFacts, encodeFacts } from '../store';
import type { Fact } from '../world';

const fact = (seq: number, extra: Partial<Fact> = {}): Fact => ({ type: 'finalize', trialId: `vs-${seq}`, seq, at: 1000 + seq, by: 'clerk', ...extra }) as Fact;

describe('MemoryFactStore', () => {
  it('starts empty, or with initial facts that are copied', () => {
    expect(new MemoryFactStore().read()).toEqual([]);
    const initial = [fact(0)];
    const store = new MemoryFactStore(initial);
    initial.push(fact(1));
    expect(store.read()).toHaveLength(1);
  });

  it('appends when expectedLength matches', () => {
    const store = new MemoryFactStore();
    expect(store.append([fact(0), fact(1)], 0)).toBe(true);
    expect(store.read().map((f) => f.seq)).toEqual([0, 1]);
    expect(store.append([fact(2)], 2)).toBe(true);
    expect(store.read()).toHaveLength(3);
  });

  it('rejects a stale expectedLength and leaves the log untouched', () => {
    const store = new MemoryFactStore();
    store.append([fact(0)], 0);
    expect(store.append([fact(1)], 0)).toBe(false);
    expect(store.append([fact(1)], 5)).toBe(false);
    expect(store.read().map((f) => f.seq)).toEqual([0]);
  });

  it('lets only one of two racing writers win', () => {
    const store = new MemoryFactStore();
    const first = store.append([fact(0, { by: 'p-a' })], 0);
    const second = store.append([fact(0, { by: 'p-b' })], 0);
    expect([first, second]).toEqual([true, false]);
    expect(store.read()[0]!.by).toBe('p-a');
  });

  it('does not mutate a previously returned snapshot', () => {
    const store = new MemoryFactStore();
    const before = store.read();
    store.append([fact(0)], 0);
    expect(before).toHaveLength(0);
  });

  it('notifies subscribers on success only, and unsubscribe stops notifications', () => {
    const store = new MemoryFactStore();
    const one = vi.fn();
    const two = vi.fn();
    const off = store.subscribe(one);
    store.subscribe(two);
    store.append([fact(0)], 0);
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
    store.append([fact(1)], 0); // stale
    expect(one).toHaveBeenCalledTimes(1);
    off();
    store.append([fact(1)], 1);
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(2);
  });

  it('shows the new facts to a subscriber when it is notified', () => {
    const store = new MemoryFactStore();
    let seen = 0;
    store.subscribe(() => (seen = store.read().length));
    store.append([fact(0), fact(1)], 0);
    expect(seen).toBe(2);
  });
});

describe('encodeFacts / decodeFacts', () => {
  it('round-trips bigints nested in objects and arrays', () => {
    const facts = [
      { type: 'faucet', account: '0x00000000000000000000000000000000000000aa', amount: usdc('2.50'), seq: 0, at: 1, by: 'p' },
      { type: 'nested', value: { deep: [1n, { x: 2n ** 80n }, [3n]], plain: 'text', n: 4, flag: true, nothing: null }, seq: 1, at: 2, by: 'p' },
    ] as unknown as Fact[];
    const decoded = decodeFacts(encodeFacts(facts));
    expect(decoded).toEqual(facts);
    expect((decoded[0] as unknown as { amount: bigint }).amount).toBe(2_500_000n);
    expect(typeof (decoded[1] as unknown as { value: { deep: [bigint] } }).value.deep[0]).toBe('bigint');
  });

  it('round-trips an empty log and zero bigints', () => {
    expect(decodeFacts(encodeFacts([]))).toEqual([]);
    const zero = [{ type: 'z', v: 0n, seq: 0, at: 0, by: 'p' }] as unknown as Fact[];
    expect(decodeFacts(encodeFacts(zero))).toEqual(zero);
  });

  it('encodes bigints as tagged strings, not numbers', () => {
    expect(encodeFacts([{ v: 5n } as unknown as Fact])).toBe('[{"v":{"$big":"5"}}]');
  });

  it('leaves look-alike objects with extra keys alone', () => {
    const odd = [{ v: { $big: '5', other: 1 } }] as unknown as Fact[];
    expect(decodeFacts(encodeFacts(odd))).toEqual(odd);
  });

  it('throws on a payload that is not a log', () => {
    expect(() => decodeFacts('{"a":1}')).toThrow(SyntaxError);
    expect(() => decodeFacts('not json')).toThrow();
  });
});
