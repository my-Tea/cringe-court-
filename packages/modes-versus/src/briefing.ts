/**
 * Each side's private briefing with its own AI agent (GAME-MODES §3 step 2:
 * "a short private intake with its own agent, about 4 turns").
 *
 *   1. What happened?           → public story (part 1)
 *   2. Why are you right?       → public story (part 2)
 *   3. Lawyer-only context      → private notes (this side's agent only, D1)
 *   4. One angle                → pick 1 of 3 suggestions or write one line ≤ 140 (D2)
 *   + optional nickname ≤ 24 (D5)
 *
 * Everything public passes the redaction pass, and the side reviews and
 * approves the exact text before it can reach the other side or the jury.
 */
import type { FilingPatch, TrialRules } from '@cringe-court/core';
import { redact, type RedactionHit } from './redact';
import { screenTopic, type TopicScreen } from './safeguards';

export type BriefingStep = 'happened' | 'why' | 'private' | 'angle';

export const BRIEFING_STEPS: readonly BriefingStep[] = ['happened', 'why', 'private', 'angle'];

export interface BriefingQuestion {
  step: BriefingStep;
  /** What the agent asks. */
  ask: string;
  /** Placeholder / example answer. */
  example: string;
  /** Who will ever see the answer. */
  visibility: 'public' | 'private';
  minChars: number;
  maxChars: number;
  optional?: boolean;
}

export const BRIEFING_QUESTIONS: Readonly<Record<BriefingStep, BriefingQuestion>> = {
  happened: {
    step: 'happened',
    ask: 'Tell me what happened, like you’d tell the group chat. No real names, I’ll call you both Side A and Side B.',
    example: 'We agreed to split the last dumpling. I went to get napkins and came back to an empty plate and a guilty smile.',
    visibility: 'public',
    minChars: 40,
    maxChars: 700,
  },
  why: {
    step: 'why',
    ask: 'Now the important part: why are you right? Give me the argument you want the jury to remember.',
    example: 'A split is a contract. Napkin duty is a public service, not an abandonment of the dumpling.',
    visibility: 'public',
    minChars: 20,
    maxChars: 450,
  },
  private: {
    step: 'private',
    ask: 'Anything only I should know? Context that helps me argue but you’d rather not say in open court. The other side, the jury and the public never see this.',
    example: 'This is the third dumpling incident this year. I am not over the spring roll.',
    visibility: 'private',
    minChars: 0,
    maxChars: 600,
    optional: true,
  },
  angle: {
    step: 'angle',
    ask: 'Last thing: pick one angle for me to lead with, or write your own in one line.',
    example: 'Napkin duty is a public service.',
    visibility: 'private',
    minChars: 0,
    maxChars: 140,
  },
};

export interface BriefingDraft {
  happened: string;
  why: string;
  privateNotes: string;
  angle: string;
  nickname: string;
}

export const EMPTY_BRIEFING: BriefingDraft = { happened: '', why: '', privateNotes: '', angle: '', nickname: '' };

/** The public story the other side and the jury will read. */
export function composeStory(d: Pick<BriefingDraft, 'happened' | 'why'>): string {
  const a = d.happened.trim();
  const b = d.why.trim();
  return [a, b].filter(Boolean).join('\n\n');
}

export type BriefingIssue = { field: keyof BriefingDraft; message: string };

export function briefingIssues(d: BriefingDraft, rules: Pick<TrialRules, 'storyMaxChars' | 'angleMaxChars' | 'nicknameMaxChars'>): readonly BriefingIssue[] {
  const issues: BriefingIssue[] = [];
  const q = BRIEFING_QUESTIONS;
  if (d.happened.trim().length < q.happened.minChars) issues.push({ field: 'happened', message: `Give your agent a little more to work with (at least ${q.happened.minChars} characters).` });
  if (d.happened.length > q.happened.maxChars) issues.push({ field: 'happened', message: `Keep it under ${q.happened.maxChars} characters.` });
  if (d.why.trim().length < q.why.minChars) issues.push({ field: 'why', message: `Tell the jury why you’re right (at least ${q.why.minChars} characters).` });
  if (d.why.length > q.why.maxChars) issues.push({ field: 'why', message: `Keep it under ${q.why.maxChars} characters.` });
  if (composeStory(d).length > rules.storyMaxChars) issues.push({ field: 'why', message: `Your story is over ${rules.storyMaxChars} characters in total.` });
  if (d.privateNotes.length > q.private.maxChars) issues.push({ field: 'privateNotes', message: `Keep private notes under ${q.private.maxChars} characters.` });
  if (!d.angle.trim()) issues.push({ field: 'angle', message: 'Pick an angle or write your own.' });
  if (d.angle.trim().length > rules.angleMaxChars) issues.push({ field: 'angle', message: `One line: ${rules.angleMaxChars} characters at most (D2).` });
  if (d.nickname.trim().length > rules.nicknameMaxChars) issues.push({ field: 'nickname', message: `Nicknames are ${rules.nicknameMaxChars} characters at most.` });
  return issues;
}

export interface PreparedBriefing {
  /** What goes into the case (FILING_EDITED patch), already redacted. */
  patch: Required<Pick<FilingPatch, 'story' | 'privateNotes' | 'angle' | 'nickname'>>;
  /** What the redaction pass removed, by field. */
  redactions: { story: readonly RedactionHit[]; privateNotes: readonly RedactionHit[]; angle: readonly RedactionHit[]; nickname: readonly RedactionHit[] };
  /** Route-out screen over everything the side typed. */
  screen: TopicScreen;
}

/** Run the redaction pass and the topic screen over a briefing. Pure. */
export function prepareBriefing(d: BriefingDraft): PreparedBriefing {
  const story = redact(composeStory(d));
  const privateNotes = redact(d.privateNotes.trim());
  const angle = redact(d.angle.trim());
  const nickname = redact(d.nickname.trim());
  return {
    patch: {
      story: story.text,
      privateNotes: privateNotes.text,
      angle: angle.text || null,
      nickname: nickname.text || null,
    },
    redactions: { story: story.hits, privateNotes: privateNotes.hits, angle: angle.hits, nickname: nickname.hits },
    screen: screenTopic(d.happened, d.why, d.privateNotes, d.angle, d.nickname),
  };
}

/**
 * The agent's short reply after each answer. Scripted and deterministic in the
 * offline build (the 0G intake call replaces it); it never repeats private notes.
 */
export function agentReply(step: BriefingStep, answer: string, side: 'a' | 'b'): string {
  const n = answer.trim().length;
  const agent = `Agent ${side.toUpperCase()}`;
  switch (step) {
    case 'happened':
      return n > 300
        ? `${agent} here. That’s a full case file. I’ll trim it for the jury and keep every name out of it.`
        : `${agent} here. Got it. I’ll keep names and handles out of it; the jury only ever hears “Side ${side.toUpperCase()}”.`;
    case 'why':
      return n > 200 ? 'Strong. I can build a closing out of that.' : 'Short and punchy. Juries like that.';
    case 'private':
      return n === 0 ? 'No secrets? Respect. We argue clean.' : 'Noted, and locked. That stays between us; it shapes how I argue but I will never quote it.';
    case 'angle':
      return 'That’s the angle. Review your brief below, then approve it when it reads right.';
    default:
      return '';
  }
}
