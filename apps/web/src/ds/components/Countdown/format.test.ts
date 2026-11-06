import { describe, expect, it } from 'vitest';
import { formatRemaining, speakRemaining, urgencyOf } from './format';

describe('formatRemaining', () => {
  it.each([
    [245_000, '4:05'],
    [3_729_000, '1:02:09'],
    [2 * 86_400_000, '2d 0h'],
    [86_400_000 + 3 * 3_600_000 + 5_000, '1d 3h'],
    [0, '0:00'],
    [-5000, '0:00'],
    [999, '0:00'],
    [59_000, '0:59'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});

describe('speakRemaining', () => {
  it.each([
    [245_000, '4 minutes 5 seconds'],
    [1000, '1 second'],
    [60_000, '1 minute'],
    [3_729_000, '1 hour 2 minutes'],
    [-1, '0 seconds'],
  ])('%i ms -> %s', (ms, text) => {
    expect(speakRemaining(ms)).toBe(text);
  });
});

describe('urgencyOf', () => {
  const total = 1000;
  it('is calm above 25% left', () => expect(urgencyOf(300, total)).toBe('calm'));
  it('is soon between 10% and 25%', () => {
    expect(urgencyOf(250, total)).toBe('soon');
    expect(urgencyOf(150, total)).toBe('soon');
  });
  it('is urgent at or below 10%', () => {
    expect(urgencyOf(100, total)).toBe('urgent');
    expect(urgencyOf(1, total)).toBe('urgent');
  });
  it('is ended at 0 or below', () => {
    expect(urgencyOf(0, total)).toBe('ended');
    expect(urgencyOf(-5, total)).toBe('ended');
  });
});
