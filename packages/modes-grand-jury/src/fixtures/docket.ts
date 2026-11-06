/**
 * The demo docket: eight reviewed public cases on common, famous internet
 * arguments. No private people, no brands as defendants, no real-world harm
 * claims. The "Presented by" sponsors are fictional test sponsors (D10: the
 * hackathon shows the slot with a test sponsor; the budget assumes none).
 */
import type { Beat, BallotChoice, CourtLine, Segment, Speaker } from '@cringe-court/core';
import type { CaseFile } from '../catalog';

type Row = [speaker: 'J' | 'P' | 'D' | 'N', segment: Segment, text: string, beat?: Beat, exhibitId?: string];

const SPEAKER: Record<Row[0], { speaker: Speaker; bench?: BallotChoice }> = {
  J: { speaker: 'judge' },
  P: { speaker: 'prosecutor', bench: 0 },
  D: { speaker: 'defense', bench: 1 },
  N: { speaker: 'narrator' },
};

function script(rows: readonly Row[]): CourtLine[] {
  return rows.map(([who, segment, text, beat, exhibitId], i) => {
    const s = SPEAKER[who];
    const line: CourtLine = { id: `L${String(i + 1).padStart(2, '0')}`, speaker: s.speaker, segment, text };
    if (s.bench !== undefined) line.bench = s.bench;
    if (beat) line.beat = beat;
    if (exhibitId) line.exhibitId = exhibitId;
    return line;
  });
}

const review = (minutes: number, signedOff: string) => ({
  editor: 'clerk-of-court',
  signedOff,
  minutes,
  checks: ['No private individuals named', 'Both positions argued in good faith', 'Sources summarised, not quoted at length', 'Comedy punches at ideas, not people'],
});

export const DEMO_CASE_FILES: readonly CaseFile[] = [
  {
    slug: 'cereal-is-soup',
    title: 'The Cereal Question',
    question: 'Is cereal a soup?',
    category: 'internet-crimes',
    hook: 'Solids. Liquid. A bowl. A spoon. The internet has been at war since 2016.',
    context:
      'Soup is usually defined as a liquid food with solid ingredients, served in a bowl and eaten with a spoon. Cereal checks every box, yet almost nobody orders it at a restaurant as “soup”. The court asks the jury to settle it.',
    positions: [
      { title: 'TEAM CEREAL IS SOUP', summary: 'If it walks like soup and spoons like soup, it is cold, sweet soup. The definition does not care about breakfast.' },
      { title: 'TEAM NOT SOUP', summary: 'Soup is cooked, savoury and served as soup. Cereal is its own category, and words mean what people use them to mean.' },
    ],
    sources: [
      { id: 'S1', kind: 'definition', label: 'Dictionary definition of soup', note: 'A liquid dish, typically made by boiling meat, fish or vegetables in stock or water.' },
      { id: 'S2', kind: 'poll', label: 'Group-chat poll, 2016–forever', note: 'Every poll ever run on this ends in a near tie and at least one muted thread.' },
      { id: 'S3', kind: 'rule', label: 'The Cube Rule (folk taxonomy)', note: 'Classifies food by where the starch is. Cereal lands next to soup, which proves nothing and everything.' },
    ],
    review: review(9, '2026-10-28'),
    sponsor: { name: 'Testnet Toast Co.', line: 'Presented by Testnet Toast Co. (fictional test sponsor)' },
    tags: ['food', 'definitions', 'classic'],
    script: script([
      ['J', 'call-to-order', 'Order! The Grand Jury convenes on a matter of national breakfast security. Is cereal a soup?', 'gavel'],
      ['P', 'opening', 'Members of the jury: liquid, solids, bowl, spoon. I rest my case. Actually no, I am just getting started.', 'desk-slam'],
      ['D', 'opening', 'My learned friend has described soup the way a toddler describes a car: "has wheels". So does a shopping trolley.', 'smug'],
      ['P', 'exhibit', 'Exhibit S1. The dictionary says "liquid dish". Milk is a liquid. The bowl is a dish. Checkmate, breakfast.', 'present-evidence', 'S1'],
      ['D', 'rebuttal', 'Same dictionary: "made by boiling". Name one person who boils their cornflakes. I will wait.', 'objection', 'S1'],
      ['P', 'rebuttal', 'Gazpacho. Cold, unboiled, universally called soup. Your honour, the defence just got served. Chilled.', 'point'],
      ['D', 'rebuttal', 'Exhibit S2: every poll is a tie. If cereal were obviously soup, why does half the planet refuse? Language is a vote.', 'present-evidence', 'S2'],
      ['P', 'closing', 'Definitions do not care about your feelings or your Saturday cartoons. It is soup. Sweet, cold, crunchy soup.', 'desk-slam'],
      ['D', 'closing', 'Nobody has ever said "pass the soup" and meant the cornflakes. Words mean what we mean. Vote NOT SOUP.', 'dramatic-pause'],
      ['J', 'jury-out', 'THE JURY IS OUT. Seal your ballots. The gallery may sip quietly.', 'gavel'],
    ]),
  },
  {
    slug: 'hot-dog-sandwich',
    title: 'The Hot Dog Hearing',
    question: 'Is a hot dog a sandwich?',
    category: 'internet-crimes',
    hook: 'One bun, one hinge, one sausage, a thousand broken friendships.',
    context:
      'A sandwich is often described as a filling between two pieces of bread. A hot dog bun is usually one piece, hinged. Food regulators, dictionaries and street vendors have all weighed in, and none of them agree.',
    positions: [
      { title: 'IT IS A SANDWICH', summary: 'Bread, filling, handheld. A hinge does not change the species; nobody says a sub roll is not a sandwich.' },
      { title: 'IT IS ITS OWN THING', summary: 'A hot dog is a hot dog. Ask for a sandwich and get a hot dog, and you will feel betrayed.' },
    ],
    sources: [
      { id: 'S1', kind: 'definition', label: 'Common dictionary sense of "sandwich"', note: 'Two or more slices of bread with a filling between them.' },
      { id: 'S2', kind: 'rule', label: 'Sub roll precedent', note: 'Hinged, single-piece rolls are routinely sold as sandwiches.' },
    ],
    review: review(8, '2026-10-29'),
    sponsor: null,
    tags: ['food', 'definitions'],
    script: script([
      ['J', 'call-to-order', 'Court is in session. Today: the bun, the hinge, and the truth.', 'gavel'],
      ['P', 'opening', 'Bread. Filling. Held in one hand while you make poor life choices at a stadium. That is a sandwich.', 'point'],
      ['D', 'opening', 'If a hot dog is a sandwich, is a taco a sandwich? Is a hug a sandwich? Where does it end, Miss Ratio?', 'objection'],
      ['P', 'exhibit', 'Exhibit S2, the sub roll. Hinged. One piece. Everybody calls it a sandwich. The hinge is not a loophole.', 'present-evidence', 'S2'],
      ['D', 'rebuttal', 'Exhibit S1 says "two or more slices". Count them. I count one. One lonely bun.', 'smug', 'S1'],
      ['P', 'closing', 'Category error is not a defence. Taxonomy wins. It is a sandwich wearing a costume.', 'desk-slam'],
      ['D', 'closing', 'Nobody ever ordered "a sausage sandwich" and was handed a hot dog. Respect the dog.', 'dramatic-pause'],
      ['J', 'jury-out', 'THE JURY IS OUT. Ketchup is not evidence.', 'gavel'],
    ]),
  },
  {
    slug: 'pineapple-pizza',
    title: 'People v. Pineapple',
    question: 'Does pineapple belong on pizza?',
    category: 'npc-behavior',
    hook: 'Sweet, tangy, controversial. The fruit that split the toppings menu.',
    context:
      'Pineapple on pizza has been around for decades and sells well, while also being one of the most argued-about toppings online. The question is not whether you like it, but whether it belongs.',
    positions: [
      { title: 'PINEAPPLE BELONGS', summary: 'Sweet and salty is a classic pairing. Pizza is a canvas, and popularity is its own argument.' },
      { title: 'PINEAPPLE IS A CRIME', summary: 'Wet fruit ruins the crust and the balance. Some traditions exist for a reason.' },
    ],
    sources: [
      { id: 'S1', kind: 'history', label: 'Origin story', note: 'The topping was popularised decades ago by a cook experimenting with sweet-and-sour flavours.' },
      { id: 'S2', kind: 'poll', label: 'Topping polls', note: 'Regularly ranks among the most loved and most hated toppings at the same time.' },
    ],
    review: review(7, '2026-10-30'),
    sponsor: { name: 'Gavel & Grain Bakery', line: 'Presented by Gavel & Grain Bakery (fictional test sponsor)' },
    tags: ['food', 'taste', 'classic'],
    script: script([
      ['J', 'call-to-order', 'Order. The fruit has been brought before the court. It is visibly sweating.', 'gavel'],
      ['P', 'opening', 'Salty ham. Sweet pineapple. This is not chaos, it is chemistry. Ask any sweet-and-sour dish.', 'smug'],
      ['D', 'opening', 'Pineapple is ninety percent water. You are putting a fruit-flavoured puddle on bread and calling it progress.', 'objection'],
      ['P', 'exhibit', 'Exhibit S2: it is loved and hated at the same time. That is not a crime. That is a celebrity.', 'present-evidence', 'S2'],
      ['D', 'rebuttal', 'Popular is not proper. Lots of popular things are crimes. See: replying all.', 'point'],
      ['P', 'closing', 'Pizza adapted to every country on earth. Let it adapt one more time.', 'desk-slam'],
      ['D', 'closing', 'Protect the crust. Protect the culture. Pineapple is a crime.', 'dramatic-pause'],
      ['J', 'jury-out', 'THE JURY IS OUT. Please keep your slices to yourselves.', 'gavel'],
    ]),
  },
  {
    slug: 'airplane-recline',
    title: 'The Recline Dispute',
    question: 'Is it fine to recline your seat on a plane?',
    category: 'npc-behavior',
    hook: 'The button is there. So are the knees behind you.',
    context:
      'Most economy seats recline a few inches. Some travellers see it as part of the ticket; others see it as taking space from the person behind. Airlines mostly stay out of it.',
    positions: [
      { title: 'RECLINE IS A RIGHT', summary: 'The seat reclines because you paid for a seat that reclines. Use it politely, but use it.' },
      { title: 'RECLINE IS RUDE', summary: 'The space behind you is someone else’s space. Shared cabins need shared restraint.' },
    ],
    sources: [
      { id: 'S1', kind: 'rule', label: 'Typical seat design', note: 'Economy seats commonly recline a few inches; some newer cabins are "pre-reclined" and do not move.' },
      { id: 'S2', kind: 'quote', label: 'Etiquette columns', note: 'Advice ranges from "always ask first" to "never ask, just do it slowly".' },
    ],
    review: review(10, '2026-10-26'),
    sponsor: null,
    tags: ['travel', 'etiquette'],
    script: script([
      ['J', 'call-to-order', 'Court is in session. Please return your opinions to the upright position.', 'gavel'],
      ['P', 'opening', 'The button exists. The ticket includes the button. The button is legal.', 'point'],
      ['D', 'opening', 'Legal is not the same as kind. Behind every recline is a laptop being folded in half.', 'cry'],
      ['P', 'exhibit', 'Exhibit S1: it was designed to recline. Engineers did not include a "just for decoration" lever.', 'present-evidence', 'S1'],
      ['D', 'rebuttal', 'Exhibit S2: even the etiquette columns say ask first. My client the knee has never been asked.', 'objection', 'S2'],
      ['P', 'closing', 'Recline slowly, recline kindly, but recline. You paid for those inches.', 'smug'],
      ['D', 'closing', 'Shared space, shared courtesy. Stay upright, stay beloved.', 'dramatic-pause'],
      ['J', 'jury-out', 'THE JURY IS OUT. Seatbelts remain fastened.', 'gavel'],
    ]),
  },
  {
    slug: 'k-reply',
    title: 'The "k" Affair',
    question: 'Is replying "k" to a long message rude?',
    category: 'internet-crimes',
    hook: 'You wrote four paragraphs. They wrote one letter.',
    context:
      'Short replies are efficient, and some people simply text like that. Others read a lone "k" as cold or passive-aggressive, especially after a long, emotional message.',
    positions: [
      { title: '"K" IS VIOLENCE', summary: 'Tone matters in text. One letter after four paragraphs says "I did not read this" or worse.' },
      { title: '"K" IS FINE', summary: 'It means okay. Reading hostility into one letter is the reader’s problem, not the sender’s.' },
    ],
    sources: [
      { id: 'S1', kind: 'quote', label: 'Texting tone guides', note: 'Short replies are often read as colder than the sender intends.' },
      { id: 'S2', kind: 'rule', label: 'The "kk" doctrine', note: 'Doubling the letter is widely read as friendlier. Nobody knows why.' },
    ],
    review: review(6, '2026-10-31'),
    sponsor: null,
    tags: ['texting', 'etiquette'],
    script: script([
      ['J', 'call-to-order', 'Order. Exhibit A is a single letter. The court has read it several times.', 'gavel'],
      ['P', 'opening', 'Four paragraphs. Feelings. A meme for balance. And the reply? "k". No full stop. No mercy.', 'desk-slam'],
      ['D', 'opening', '"k" means okay. It is the most efficient word in the language. My client is not cold, just busy.', 'smug'],
      ['P', 'exhibit', 'Exhibit S2, the kk doctrine: one extra k turns ice into a hug. The sender chose ice.', 'present-evidence', 'S2'],
      ['D', 'rebuttal', 'You want a crime? Reading tone into one letter. That is fan fiction.', 'objection'],
      ['P', 'closing', 'Effort deserves effort. "k" is violence with extra steps. Fewer steps, actually.', 'point'],
      ['D', 'closing', 'Let people text like people. "k" is fine. k?', 'laugh'],
      ['J', 'jury-out', 'THE JURY IS OUT. Kindly do not reply "k" to the court.', 'gavel'],
    ]),
  },
  {
    slug: 'socks-sandals',
    title: 'Socks & Sandals',
    question: 'Are socks with sandals acceptable?',
    category: 'npc-behavior',
    hook: 'Comfort or crime? Fashion keeps changing its plea.',
    context:
      'Long mocked, socks with sandals keep coming back on runways and in cold-weather campsites. The jury decides whether it is acceptable in everyday life.',
    positions: [
      { title: 'ICONIC', summary: 'Warm toes, no blisters, and fashion keeps proving it right. Comfort is a valid aesthetic.' },
      { title: 'FASHION CRIME', summary: 'Sandals exist to let feet breathe. Socks undo the entire point and the look.' },
    ],
    sources: [{ id: 'S1', kind: 'history', label: 'Runway revivals', note: 'The look has been revived by several fashion houses in recent seasons.' }],
    review: review(5, '2026-10-20'),
    sponsor: null,
    tags: ['fashion'],
    script: script([
      ['J', 'call-to-order', 'Court is in session. The defendant’s feet are present and warm.', 'gavel'],
      ['P', 'opening', 'Warm toes. Zero blisters. Runways agree. It is iconic and you are just cold.', 'smug'],
      ['D', 'opening', 'A sandal is a shoe that chose freedom. Socks are a prison.', 'objection'],
      ['P', 'exhibit', 'Exhibit S1: fashion houses keep reviving it. The people are behind on the trend.', 'present-evidence', 'S1'],
      ['P', 'closing', 'Comfort is a look. Wear it proudly.', 'point'],
      ['D', 'closing', 'Choose a shoe or choose a sandal. Not both. Fashion crime.', 'desk-slam'],
      ['J', 'jury-out', 'THE JURY IS OUT.', 'gavel'],
    ]),
  },
  {
    slug: 'gif-pronunciation',
    title: 'The GIF Tribunal',
    question: 'Is GIF pronounced with a hard G?',
    category: 'internet-crimes',
    hook: 'Graphics or giraffe? The format’s oldest flame war goes to trial.',
    context:
      'The format’s creator said it is a soft G, like the peanut butter brand. Most people say it with a hard G, like "graphics". Dictionaries now list both.',
    positions: [
      { title: 'HARD G', summary: 'It stands for Graphics. Usage wins, and most people say it hard.' },
      { title: 'SOFT G', summary: 'The creator named it, and he said soft G. Creators get to name their creations.' },
    ],
    sources: [
      { id: 'S1', kind: 'history', label: 'The creator’s statement', note: 'The format’s creator has repeatedly said the soft-G pronunciation is correct.' },
      { id: 'S2', kind: 'definition', label: 'Dictionaries', note: 'Major dictionaries list both pronunciations.' },
    ],
    review: review(6, '2026-10-18'),
    sponsor: null,
    tags: ['internet', 'language', 'classic'],
    script: script([
      ['J', 'call-to-order', 'Order. Both pronunciations will be tolerated in this courtroom. Barely.', 'gavel'],
      ['P', 'opening', 'Graphics. Interchange. Format. The G is hard because graphics is hard. Simple.', 'point'],
      ['D', 'opening', 'The creator named it. You do not get to rename someone’s baby because you like the sound.', 'objection'],
      ['D', 'exhibit', 'Exhibit S1: the creator said soft G. Repeatedly. On stage. With a slide.', 'present-evidence', 'S1'],
      ['P', 'rebuttal', 'Exhibit S2: dictionaries list both. The people have spoken, and they spoke with a hard G.', 'present-evidence', 'S2'],
      ['P', 'closing', 'Language belongs to its speakers. Hard G.', 'desk-slam'],
      ['D', 'closing', 'Respect the creator. Soft G.', 'dramatic-pause'],
      ['J', 'jury-out', 'THE JURY IS OUT.', 'gavel'],
    ]),
  },
  {
    slug: 'tabs-vs-spaces',
    title: 'Tabs v. Spaces',
    question: 'Should code be indented with tabs?',
    category: 'internet-crimes',
    hook: 'One keystroke, four keystrokes, infinite pull-request comments.',
    context:
      'Tabs let each reader choose their indent width; spaces look the same everywhere. Most projects pick one in a formatter and move on, but the argument never quite ends.',
    positions: [
      { title: 'TABS', summary: 'One character, one level, every reader picks their own width. Accessibility and semantics win.' },
      { title: 'SPACES', summary: 'What you see is what everyone sees. Consistency beats configurability.' },
    ],
    sources: [{ id: 'S1', kind: 'rule', label: 'Formatter defaults', note: 'Popular formatters ship with one default and let teams change it.' }],
    review: review(4, '2026-10-12'),
    sponsor: null,
    tags: ['code', 'classic'],
    script: script([
      ['J', 'call-to-order', 'Court is in session. Indentation will be strictly enforced.', 'gavel'],
      ['P', 'opening', 'One tab, one level. Readers choose their width. That is accessibility, not opinion.', 'point'],
      ['D', 'opening', 'Spaces look the same in every editor on earth. Consistency is kindness.', 'smug'],
      ['P', 'closing', 'Semantics matter. Tabs.', 'desk-slam'],
      ['D', 'closing', 'Predictability matters more. Spaces.', 'dramatic-pause'],
      ['J', 'jury-out', 'THE JURY IS OUT. Please do not reformat the transcript.', 'gavel'],
    ]),
  },
];
