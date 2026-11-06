/** Test helpers: build CounselRequests from core's real mode definitions and briefsFor. */
import { BASE_MODES, briefsFor } from '@cringe-court/core';
import type { CounselRequest, Filing, ModeId, PublicExhibit } from '@cringe-court/core';

export const SECRET_A = 'SECRET-A-NOTES: client A once sent a 3am voice memo';
export const SECRET_B = 'SECRET-B-NOTES: client B owns forty-one fedoras';

export function filingFor(mode: ModeId): Filing {
  if (mode === 'versus') {
    return {
      category: 'dating-crimes',
      title: 'The Ghosting of Brunch',
      context: '',
      sides: {
        a: { account: null, story: 'STORY-A: Side B ghosted me after brunch.', privateNotes: SECRET_A, angle: 'ANGLE-A: brunch is sacred', nickname: 'Brunchy' },
        b: { account: null, story: 'STORY-B: I left because the eggs were cold.', privateNotes: SECRET_B, angle: 'ANGLE-B: cold eggs are a red flag', nickname: null },
      },
    };
  }
  if (mode === 'solo') {
    return {
      category: 'internet-crimes',
      title: 'The Group Chat Incident',
      context: '',
      sides: { a: { account: null, story: 'STORY-A: I replied-all to the whole company.', privateNotes: SECRET_A, angle: 'ANGLE-A: reply-all is a lifestyle', nickname: 'Replyall' } },
    };
  }
  return { category: 'crypto-crimes', title: 'The Rug', context: 'CONTEXT: a token went to zero.', sides: {} };
}

export const EXHIBITS: PublicExhibit[] = [
  { id: 'x1', submittedBy: 'a', kind: 'text', title: 'The Receipt', body: 'Receipt: two eggs, one regret.' },
  { id: 'x2', submittedBy: 'b', kind: 'quote', title: 'The Text', body: 'Text: "k."' },
];

export function requestFor(mode: ModeId, patch: Partial<CounselRequest> = {}): CounselRequest {
  const def = BASE_MODES[mode];
  return {
    trialId: 'trial-001',
    mode,
    category: filingFor(mode).category,
    title: filingFor(mode).title,
    ballot: ['GUILTY', 'NOT GUILTY'],
    benches: def.benches,
    briefs: briefsFor(def.benches, filingFor(mode)),
    exhibits: [],
    scope: 'full',
    payer: ['platform', 'platform'],
    budget: { maxInputTokens: 4000, maxOutputTokens: 600 },
    attempt: 1,
    ...patch,
  };
}
