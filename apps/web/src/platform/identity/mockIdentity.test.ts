import { describe, expect, it } from 'vitest';
import { JUROR_SCREENING_COPY } from './screeningCopy';
import { createMockIdentity, mockLevelFor } from './mockIdentity';

const seat = { action: 'accept-jury-seat', signal: 'case:1:seat' } as const;
const party = { action: 'case-party', signal: 'case:1:party' } as const;

async function proof(human: string, req: typeof seat | typeof party) {
  const id = createMockIdentity(human);
  const r = await id.requestProof(req);
  if (!r.ok) throw new Error('no proof');
  return { id, proof: r.proof };
}

describe('mock identity policy', () => {
  it('derives levels from persona names', () => {
    expect(mockLevelFor('p-abc')).toBe(3);
    expect(mockLevelFor('device-sam')).toBe(1);
    expect(mockLevelFor('passport-dee')).toBe(2);
  });

  it('seats an orb human once, then reports already seated', async () => {
    const { id, proof: p } = await proof('alice', seat);
    expect(await id.verify(p, seat)).toEqual({ ok: true, nullifier: p.nullifierHash });
    const again = await id.verify(p, seat);
    expect(again).toMatchObject({ ok: false, reason: 'already-used', message: JUROR_SCREENING_COPY.already_seated });
  });

  it('refuses a device-only human a jury seat with the ineligible_level copy', async () => {
    const { id, proof: p } = await proof('device-sam', seat);
    expect(p.verificationLevel).toBe('device');
    expect(await id.verify(p, seat)).toEqual({ ok: false, reason: 'not-verified', message: JUROR_SCREENING_COPY.ineligible_level });
  });

  it('lets a device-only human file or join a case', async () => {
    const { id, proof: p } = await proof('device-sam', party);
    expect(await id.verify(p, party)).toMatchObject({ ok: true });
  });

  it('excludes case parties', async () => {
    const { id, proof: p } = await proof('alice', seat);
    expect(await id.verify(p, seat, { exclude: [p.nullifierHash] })).toMatchObject({ ok: false, reason: 'conflicted', message: JUROR_SCREENING_COPY.is_party });
  });

  it('keeps the core mock proof behaviours', async () => {
    const id = createMockIdentity('x', { behaviour: 'cancelled' });
    expect(await id.requestProof(seat)).toMatchObject({ ok: false, reason: 'cancelled' });
  });
});
