import { trialId } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { INVITE_ALPHABET, invitePath, makeInviteCode, makeTrialId, normalizeInviteInput, parseInviteCode } from '../invite';

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
}

describe('makeInviteCode', () => {
  it('formats as XXXX-XXXX over the Crockford alphabet', () => {
    const rand = lcg(7);
    for (let i = 0; i < 200; i++) {
      const code = makeInviteCode(rand);
      expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      for (const c of code.replace('-', '')) expect(INVITE_ALPHABET).toContain(c);
    }
  });

  it('never uses I, L, O or U', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    for (const c of 'ILOU') expect(INVITE_ALPHABET).not.toContain(c);
  });

  it('is deterministic for a deterministic random source', () => {
    expect(makeInviteCode(lcg(3))).toBe(makeInviteCode(lcg(3)));
  });

  it('round-trips through parseInviteCode', () => {
    const rand = lcg(11);
    for (let i = 0; i < 100; i++) {
      const code = makeInviteCode(rand);
      expect(parseInviteCode(code)).toEqual({ ok: true, code });
    }
  });
});

describe('parseInviteCode forgiveness', () => {
  const code = makeInviteCode(lcg(5));
  const raw = code.replace('-', '');

  it('accepts lower case, spaces and a missing dash', () => {
    expect(parseInviteCode(code.toLowerCase())).toEqual({ ok: true, code });
    expect(parseInviteCode(`  ${raw.slice(0, 4)} ${raw.slice(4)}  `)).toEqual({ ok: true, code });
    expect(parseInviteCode(raw)).toEqual({ ok: true, code });
    expect(parseInviteCode(`${raw.slice(0, 4)}_${raw.slice(4)}`)).toEqual({ ok: true, code });
  });

  it('maps O to 0 and I/L to 1', () => {
    expect(normalizeInviteInput('o-iL')).toBe('011');
    // Find a code containing 0 and 1 and write them as look-alikes.
    const rand = lcg(1);
    let found: string | null = null;
    for (let i = 0; i < 5000 && !found; i++) {
      const c = makeInviteCode(rand);
      if (c.includes('0') && c.includes('1')) found = c;
    }
    expect(found).not.toBeNull();
    const sloppy = found!.replace(/0/g, 'o').replace(/1/g, 'l');
    expect(parseInviteCode(sloppy)).toEqual({ ok: true, code: found });
    expect(parseInviteCode(found!.replace(/1/g, 'I'))).toEqual({ ok: true, code: found });
  });
});

describe('parseInviteCode failures', () => {
  const code = makeInviteCode(lcg(9));
  const raw = code.replace('-', '');

  const substitutions = (positions: number[]) => {
    const out: string[] = [];
    for (const i of positions) {
      for (const sym of INVITE_ALPHABET) {
        if (sym !== raw[i]) out.push(raw.slice(0, i) + sym + raw.slice(i + 1));
      }
    }
    return out;
  };

  it('catches every single-character substitution at the check symbol and odd-weight positions', () => {
    for (const mutated of substitutions([0, 2, 4, 6, 7])) {
      const r = parseInviteCode(mutated);
      expect(r.ok, `${mutated} should be rejected`).toBe(false);
      if (!r.ok) expect(r.reason).toBe('checksum');
    }
  });

  // Regression: the check weights used to be (i + 1) * 7, even at positions 1, 3 and 5, so some typos slipped through.
  it('catches every single-character substitution at every position', () => {
    for (const mutated of substitutions([0, 1, 2, 3, 4, 5, 6, 7])) {
      expect(parseInviteCode(mutated).ok, `${mutated} should be rejected`).toBe(false);
    }
  });

  it('reports empty input', () => {
    for (const input of ['', '   ', '--']) {
      const r = parseInviteCode(input);
      expect(r).toMatchObject({ ok: false, reason: 'empty' });
    }
  });

  it('reports wrong length', () => {
    expect(parseInviteCode(raw.slice(0, 7))).toMatchObject({ ok: false, reason: 'length', message: expect.stringContaining('this one has 7') });
    expect(parseInviteCode(`${raw}2`)).toMatchObject({ ok: false, reason: 'length' });
  });

  it('reports invalid characters (U, symbols) before length', () => {
    expect(parseInviteCode('UUUU-UUUU')).toMatchObject({ ok: false, reason: 'characters' });
    expect(parseInviteCode('AB!D-1234')).toMatchObject({ ok: false, reason: 'characters' });
    expect(parseInviteCode('U')).toMatchObject({ ok: false, reason: 'characters' });
  });
});

describe('invitePath and makeTrialId', () => {
  it('builds the join path', () => {
    const code = makeInviteCode(lcg(2));
    expect(invitePath(code)).toBe(`/versus/join/${code}`);
  });

  it('makes URL-safe trial ids accepted by core trialId()', () => {
    const rand = lcg(4);
    for (let i = 0; i < 50; i++) {
      const id = makeTrialId(rand);
      expect(id).toMatch(/^vs-[0-9a-z]{10}$/);
      expect(trialId(id)).toBe(id);
    }
  });
});
