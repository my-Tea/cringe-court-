/**
 * Hand-written reference trials (one per mode): what good output looks like.
 * Used as golden fixtures for the validator tests, as the "strong" examples in
 * docs/ai, and by the runner's `--scripted` mode. Speakers for Versus/Viral are
 * resolved from the court's advocate assignment so the fixtures stay valid.
 */
import { assignAdvocates } from '../prepare';
import type { CaseInput, CourtMode } from '../schema';

export const EXAMPLE_INPUTS: Readonly<Record<CourtMode, CaseInput>> = {
  solo: {
    mode: 'solo',
    caseId: 'example-solo-dog',
    caseTitle: 'The Financially Responsible Dog',
    confession: 'I bought a memecoin because the dog on the logo looked financially responsible. It was wearing a tiny tie.',
  },
  versus: {
    mode: 'versus',
    caseId: 'example-versus-shampoo',
    caseTitle: 'The Shampoo Incident',
    sideA: { name: 'Priya', account: 'My roommate used my expensive shampoo to clean his sneakers.' },
    sideB: { name: 'Dev', account: 'The bottle said deep cleaning, and my sneakers were extremely dirty.' },
    agreedFacts: ["Dev used Priya's shampoo on his sneakers."],
  },
  viral: {
    mode: 'viral',
    caseId: 'example-viral-pineapple',
    approved: true,
    caseTitle: 'Pineapple on Pizza',
    question: 'Should pineapple belong on pizza?',
    summary: 'The internet has argued about pineapple on pizza for years and neither side has backed down.',
    sideA: { label: 'Team Pineapple', position: 'Pineapple adds sweetness that balances salty ingredients.' },
    sideB: { label: 'Team No Fruit', position: 'Fruit has no business interfering with pizza.' },
  },
};

type L = [slot: string, role: 'clerk' | 'judge' | 'prosecutor' | 'defense' | 'A' | 'B', emotion: string, animation: string, text: string, refs: string[], answers?: string];

const SOLO: { analysis: Record<string, unknown>; lines: L[] } = {
  analysis: {
    core: 'Someone bought a memecoin based entirely on the mascot looking responsible.',
    tension: 'A cartoon dog in a tiny tie was treated as financial due diligence.',
    benchA: 'No research happened; the logo was the entire investment thesis.',
    benchB: 'The defendant bought honestly and openly, trusting the only signal the coin offered.',
    factRefs: ['F1', 'F2'],
  },
  lines: [
    ['L01', 'clerk', 'amused', 'talk', 'Case filed: The Financially Responsible Dog. The defendant bought a memecoin on the strength of a cartoon\'s posture.', ['F1']],
    ['L02', 'prosecutor', 'smug', 'point', 'Your Honor, the defendant did not research the team, the plan or the token. The defendant researched a dog. A dog on a logo, whose only credential is that it looked financially responsible.', ['F1']],
    ['L03', 'defense', 'confident', 'point', 'Miss Ratio says my client researched a dog. Correct, and a dog in a tiny tie. Nobody wears a tie to lose your money. My client read the only document this coin ever published: its dress code.', ['F1', 'F2'], 'The defendant researched a dog'],
    ['L04', 'prosecutor', 'angry', 'desk-slam', 'Nobody wears a tie to lose your money? Counsel, every scam in history wore a tie. The tie is not due diligence. The tie is the costume that due diligence would have seen straight through.', ['F2'], 'Nobody wears a tie to lose your money'],
    ['L05', 'defense', 'triumphant', 'present-evidence', 'So the prosecution agrees the tie was the whole pitch, and my client bought it honestly. No insider tip, just trust in good posture. That is optimism with excellent taste in neckwear.', ['F1', 'F2'], 'The tie is not due diligence'],
    ['L06', 'judge', 'exasperated', 'talk', 'The court has now heard more about a cartoon dog\'s neckwear than about any actual coin. Let the record reflect the court\'s fatigue.', ['F2']],
    ['L07', 'prosecutor', 'confident', 'desk-slam', 'Members of the jury: the dog had a tie, the defendant had a wallet, and only one of them was dressed for the meeting. Find this decision GUILTY.', ['F1', 'F2']],
    ['L08', 'defense', 'confident', 'point', 'Members of the jury: my client saw a tiny tie and believed in something. In this economy, that is practically a business degree. Find my client NOT COOKED.', ['F2']],
  ],
};

const VERSUS: { analysis: Record<string, unknown>; lines: L[] } = {
  analysis: {
    core: 'Whether a cleaning promise on a label outranks who owns the bottle.',
    tension: 'The shampoo did exactly what the label said, just on the wrong customer.',
    benchA: 'The shampoo was hers, bought for hair, and nobody asked before using it.',
    benchB: 'The label promised deep cleaning and the sneakers genuinely needed it.',
    factRefs: ['F1', 'F2', 'F3'],
  },
  lines: [
    ['L01', 'clerk', 'neutral', 'talk', 'Next: The Shampoo Incident. Priya versus Dev, one bottle, one pair of sneakers, and two very different ideas of what deep cleaning means.', ['F1']],
    ['L02', 'A', 'confident', 'point', "Both sides agree Dev used Priya's shampoo on his sneakers. Priya says it was her expensive shampoo, bought for hair. Shampoo is a hair product with a job description, and that job does not include footwear.", ['F1', 'F2']],
    ['L03', 'B', 'confident', 'present-evidence', 'Dev says the bottle promised deep cleaning, and his sneakers were extremely dirty. He read the label, believed it, and applied it to the dirtiest thing he owned.', ['F3']],
    ['L04', 'B', 'smug', 'point', 'Priya says the job does not include footwear. Then the label should have said so. Nothing on that bottle named hair as the only customer.', ['F2', 'F3'], 'that job does not include footwear'],
    ['L05', 'A', 'smug', 'point', 'Dev says he read the label and believed it. Did he also read whose bathroom shelf it lived on? Labels describe what a product does, not whose product it is.', ['F1', 'F3'], 'He read the label, believed it'],
    ['L06', 'A', 'angry', 'desk-slam', 'Then the label should have said so, says Dev. The label never said help yourself either. Borrowing without asking is the one stain no bottle can deep clean.', ['F1', 'F2'], 'Then the label should have said so'],
    ['L07', 'B', 'confident', 'point', "Fair point on whose product it is. But was using a cleaner to clean a crime or an emergency? By Dev's account, those sneakers were an emergency.", ['F3'], 'not whose product it is'],
    ['L08', 'judge', 'exasperated', 'talk', 'The court has seen many disputes, but rarely one where the sneakers are the cleanest party involved. Closings, please.', ['F1']],
    ['L09', 'A', 'confident', 'point', 'The shampoo was bought for hair, used on shoes, and nobody asked first. Vote SIDE A for Priya.', ['F1', 'F2']],
    ['L10', 'B', 'confident', 'point', 'The bottle promised deep cleaning and Dev took it at its word. Honest, if a little loose about ownership. Vote SIDE B for Dev.', ['F3']],
  ],
};

const VIRAL: { analysis: Record<string, unknown>; lines: L[] } = {
  analysis: {
    core: 'Whether a sweet topping improves pizza or betrays it.',
    tension: 'Both sides claim to be protecting pizza from the other.',
    benchA: 'Sweetness balances salty ingredients.',
    benchB: 'Pizza needs no fruit to be complete.',
    factRefs: ['F1', 'F2', 'F3'],
  },
  lines: [
    ['L02', 'judge', 'neutral', 'talk', 'Approved summary: the internet has argued about pineapple on pizza for years and neither side has backed down. Everything that follows is opinion.', ['F1']],
    ['L03', 'A', 'confident', 'point', 'Team Pineapple says pineapple adds sweetness that balances salty ingredients. Pizza is a party of salty, savoury guests. Pineapple is the one guest who brings balance instead of more salt.', ['F2']],
    ['L04', 'B', 'confident', 'point', 'Team No Fruit says fruit has no business interfering with pizza. You do not improve a masterpiece by gluing dessert to it.', ['F3']],
    ['L05', 'B', 'smug', 'point', 'Brings balance? Pizza was never asking for balance. Nobody bites into a slice hoping to find a fruit salad halfway through. Balance belongs in a diet, not on a crust.', ['F2'], 'brings balance instead of more salt'],
    ['L06', 'A', 'smug', 'point', 'You do not improve a masterpiece, says Team No Fruit. Every topping you love was once a wild idea added to that masterpiece. The masterpiece survived. It got better.', ['F3'], 'you do not improve a masterpiece'],
    ['L07', 'A', 'triumphant', 'desk-slam', 'Pizza was never asking for balance? Crust, sauce and cheese in careful proportion is balance. Pizza invented balance. Pineapple simply read the room.', ['F2'], 'Pizza was never asking for balance'],
    ['L08', 'B', 'angry', 'desk-slam', 'It got better, says Team Pineapple, about a slice that now needs a napkin for syrup. Some wild ideas end in discoveries. This one ends in sticky fingers.', ['F3'], 'The masterpiece survived. It got better'],
    ['L09', 'judge', 'exasperated', 'talk', 'The court notes that both sides have described pizza with more passion than most of its actual cases. Order.', ['F1']],
    ['L10', 'judge', 'neutral', 'talk', 'For Team Pineapple: sweetness that balances salt. For Team No Fruit: a pizza that needs no rescuing. The question stays open.', ['F2', 'F3']],
  ],
};

const SCRIPTS = { solo: SOLO, versus: VERSUS, viral: VIRAL } as const;

/** The reference script for a mode as the model would return it (JSON text). */
export function exampleScript(mode: CourtMode): string {
  const input = EXAMPLE_INPUTS[mode];
  const adv = mode === 'solo' ? null : assignAdvocates(input.caseId as string);
  const s = SCRIPTS[mode];
  const lines = s.lines.map(([slot, role, emotion, animation, text, refs, answers]) => ({
    slot,
    speaker: role === 'A' ? adv?.A : role === 'B' ? adv?.B : role,
    emotion,
    animation,
    camera: 'auto',
    crowd: role === 'judge' ? 'laugh' : 'none',
    text,
    factRefs: refs,
    ...(answers ? { answers } : {}),
  }));
  return JSON.stringify({ analysis: s.analysis, lines }, null, 1);
}
