import { describe, expect, it } from 'vitest';
import { keccak256, stringToBytes } from 'viem';
import { confessionHash, titleFrom } from './liveCase';

describe('confessionHash', () => {
  it('matches what the server recomputes, so a stake commits to this exact confession', () => {
    expect(confessionHash({ title: 'T', story: 'S' })).toBe(keccak256(stringToBytes('T\nS')));
  });

  it('changes when a single word of the confession does', () => {
    expect(confessionHash({ title: 'T', story: 'I did it' })).not.toBe(confessionHash({ title: 'T', story: 'I did not' }));
  });
});

describe('titleFrom', () => {
  it('keeps a short first sentence and drops its full stop', () => {
    expect(titleFrom('I clapped on the bus. Everyone stared.')).toBe('I clapped on the bus');
  });

  it('cuts a long one on a word', () => {
    expect(titleFrom(`${'word '.repeat(30)}`).endsWith('word…')).toBe(true);
  });
});
