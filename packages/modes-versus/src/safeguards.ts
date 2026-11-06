/**
 * Couples-specific safeguards (GAME-MODES §3, V4 §12). Versus is for petty
 * fights: who left the group chat on read, whether a hot dog is a sandwich. A
 * story that looks like abuse, a money dispute, custody or self-harm is routed
 * out of the product with a calm notice, never into court.
 *
 * This is a keyword screen, deliberately cautious and easy to audit. It is a
 * first line, not moderation: the AI intake and the redaction pass run after it.
 */
export type RouteOutTopic = 'safety' | 'money' | 'custody' | 'self-harm';

export interface TopicScreen {
  ok: boolean;
  topics: readonly RouteOutTopic[];
}

const TOPIC_PATTERNS: Readonly<Record<RouteOutTopic, readonly RegExp[]>> = {
  safety: [
    /\b(?:abus(?:e|ed|es|ing|ive)|assault(?:ed)?|stalk(?:s|ed|ing|er)?|restraining order|domestic violence)\b/i,
    /\b(?:hits?|hit|punch(?:ed|es)?|slap(?:ped|s)?|chok(?:e|ed|es|ing)|beat(?:s)?) (?:me|her|him|them|my)\b/i,
    /\bthreat(?:en|ened|ening|s)? (?:to|me|her|him|them)\b/i,
    /\b(?:scared|afraid) (?:of|for) (?:my|her|his|their) (?:life|safety)\b/i,
  ],
  money: [
    /\b(?:owes?|owed) (?:me|her|him|them|us)\b.*(?:\$|€|£|usd|dollars?|rupees?|rent|money|loan)/i,
    /\b(?:pay (?:me|her|him|them) back|borrowed money|lent (?:him|her|them) money|unpaid loan|debt collector)\b/i,
    /\b(?:alimony|child support|small claims|lawsuit|sue|suing)\b/i,
  ],
  custody: [/\b(?:custody|visitation rights|divorce settlement|family court)\b/i],
  'self-harm': [/\b(?:kill myself|suicid(?:e|al)|self[- ]harm|hurt myself|end it all)\b/i],
};

export function screenTopic(...texts: readonly string[]): TopicScreen {
  const joined = texts.join('\n');
  const topics = (Object.keys(TOPIC_PATTERNS) as RouteOutTopic[]).filter((t) => TOPIC_PATTERNS[t].some((re) => re.test(joined)));
  return { ok: topics.length === 0, topics };
}

export const ROUTE_OUT_COPY: Readonly<Record<RouteOutTopic, { title: string; body: string }>> = {
  safety: {
    title: 'This sounds bigger than a comedy court',
    body: 'If someone has hurt or threatened you, CringeCourt is the wrong place for it. Please talk to someone you trust or a local support line. Nothing you typed has been saved or shared.',
  },
  money: {
    title: 'Money disputes stay out of court here',
    body: 'Versus is for bragging rights only: nobody wins the other side’s money, and real debts deserve a real conversation, not a jury of strangers. Nothing you typed has been saved or shared.',
  },
  custody: {
    title: 'Family matters are routed out',
    body: 'Custody and family-court topics are never put in front of a public jury. Nothing you typed has been saved or shared.',
  },
  'self-harm': {
    title: 'You matter more than this argument',
    body: 'If you are thinking about hurting yourself, please reach out to someone now: a friend, family member or your local crisis line. Nothing you typed has been saved or shared.',
  },
};
