# 04 · Viral Court

A public, **curator-approved** question is debated by both advocates, with a neutral judge. The court argues; it never resolves.

Resolution happens outside the AI: a jury vote or an approved resolver, through whatever process the app defines. Spectators may hold testnet predictions on the outcome, and that is none of the court's business. The AI layer contains **no market logic**, gives **no betting or financial advice**, and never mentions odds, stakes or payouts.

Sources:
- `plans.ts` (`VIRAL_PLAN`, `viral-trial@1`);
- `prompts.ts` (`MODE_RULES.viral`);
- `prepare.ts` (`prepareViral`);
- `checks.ts` (`viral-money-talk`).

## 1. Input

| Field | Rule |
|---|---|
| `mode` | `"viral"` |
| `approved` | **Must be literally `true`.** Unapproved cases are rejected before any inference |
| `question` | 10–200 chars. The resolution question, **shown verbatim** by the court (template line); the model may not rephrase it |
| `summary` | 20–800 chars, an approved neutral summary |
| `sideA` / `sideB` | `{ label: 2–40, position: 10–400 }` |
| `sources` | ≤ 8 × `{ id: "S1".., title, publisher?, date?, claim: 10–400, kind: "fact" \| "opinion" }`. Only these may be cited |
| `uncertainty` | ≤ 5 known open questions. The court says they are unknown and never resolves them |

## 2. Preparation

The steps are the same as Solo (sanitise, redact, screen). Then:

1. **Unresolvable questions are refused** with `CaseRejectedError('unresolvable')`. These are future predictions, price movements and "who will win" questions; the jury cannot settle them on argument.
2. **Elections and candidates are refused.**
3. **Facts are typed.**
   - The summary becomes `background`.
   - The positions become `position-a` and `position-b`.
   - Each source claim becomes `sourced-fact` or `sourced-opinion`, keeping its source id.
4. **Advocates are assigned by the same coin flip as Versus.**

## 3. Trial plan (`viral-trial@1`, target 70–110 s)

| Slot | Speaker | Segment | Job | Answers |
|---|---|---|---|---|
| L01 | Clerk | call-to-order | **Court-written:** "Public case: "…". The question before the court, exactly as approved: "…"" | |
| L02 | Judge | opening | Neutral background from the summary and sources; opinions labelled as opinions (≤ 260) | |
| L03 | Side A's advocate | opening | Side A's position at its most persuasive | |
| L04 | Side B's advocate | opening | Side B's position at its most persuasive | |
| L05 | Side B's advocate | rebuttal | Attack L03's reasoning | L03 |
| L06 | Side A's advocate | rebuttal | Attack L04's reasoning | L04 |
| L07 | Side A's advocate | rebuttal | Answer L05 with a new point | L05 |
| L08 | Side B's advocate | rebuttal | Answer L06 with a new point | L06 |
| L09 | Judge | rebuttal | Comedic, even-handed reaction | |
| L10 | Judge | closing | One fair sentence per side; no winner, no prediction, no money (≤ 260) | |
| L11 | Clerk | jury-out | **Court-written:** "Result pending…" | |

## 4. Rules specific to Viral

- **Money words are hard failures.** Bet, odds, stake, payout, profit, market, pool, USDC and similar words fail the check, unless the approved case text itself contains the word.
- **No new sources.** No source, statistic, study or quote may appear unless it is in the case data (`fabricated-evidence`, `invented-number`, `invented-quote`).
- **Opinions stay opinions.** Sourced opinions are presented as opinions, and sourced facts are attributed to their source title.
- **Uncertainty stays open.** The court never resolves a listed uncertainty.

## 5. After the verdict

| Outcome | Announcement must contain |
|---|---|
| `SIDE_A` / `SIDE_B` | SIDE A / SIDE B |
| `NO_VERDICT` / `CANCELLED` / `INVALID` | that exact phrase, and no winner/loser words |

**`marketSettled` is a fact the app reports, not one the AI decides.** It is accepted only for Viral.
- If it is absent or false, any money or settlement wording is rejected and the template is used.
- If the app confirms `marketSettled: true`, the commentary may say that settlement happened. It still may not give amounts or advice.

## 6. Acceptance criteria

1. **Checks pass.** No hard issues, and the score thresholds are met.
2. **Runtime.** The estimated runtime is 70–110 s.
3. **The question is verbatim.** It appears exactly as approved (template L01). No model line restates it differently (human check).
4. **No market talk.** There are zero `viral-money-talk` findings, and nothing hints at which side "the money" or the crowd favours.
5. **Only listed sources.** Every factual claim traces to the summary, a position or a listed source. Opinions are labelled.
6. **Even-handed close.** L10 gives each side one fair sentence and declares nothing.
7. **Ungated cases never reach the AI.** Unapproved or unresolvable cases are rejected before inference.
8. **Replay is stable.** This is the same rule as Solo.

## 7. Complete examples

<!-- BEGIN GENERATED EXAMPLES (npm run court:prompts) -->

### Example 1: Pineapple on Pizza

Input (`CaseInput`):

```json
{
  "mode": "viral",
  "caseId": "example-viral-pineapple",
  "approved": true,
  "caseTitle": "Pineapple on Pizza",
  "question": "Should pineapple belong on pizza?",
  "summary": "The internet has argued about pineapple on pizza for years and neither side has backed down.",
  "sideA": {
    "label": "Team Pineapple",
    "position": "Pineapple adds sweetness that balances salty ingredients."
  },
  "sideB": {
    "label": "Team No Fruit",
    "position": "Fruit has no business interfering with pizza."
  }
}
```

Preparation (deterministic, no AI): category `public-debate`, tone `standard`, ballot SIDE_A / SIDE_B. Advocates (court coin flip on the case id): Counsel Chaos argues SIDE_A (Team Pineapple), Miss Ratio argues SIDE_B (Team No Fruit).

- F1 *(background)*: The internet has argued about pineapple on pizza for years and neither side has backed down.
- F2 *(position-a)*: Pineapple adds sweetness that balances salty ingredients.
- F3 *(position-b)*: Fruit has no business interfering with pizza.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "Whether a sweet topping improves pizza or betrays it.",
  "tension": "Both sides claim to be protecting pizza from the other.",
  "benchA": "Sweetness balances salty ingredients.",
  "benchB": "Pizza needs no fruit to be complete.",
  "factRefs": [
   "F1",
   "F2",
   "F3"
  ]
 },
 "lines": [
  {
   "slot": "L02",
   "speaker": "judge",
   "emotion": "neutral",
   "animation": "talk",
   "camera": "auto",
   "crowd": "laugh",
   "text": "Approved summary: the internet has argued about pineapple on pizza for years and neither side has backed down. Everything that follows is opinion.",
   "factRefs": [
    "F1"
   ]
  },
  {
   "slot": "L03",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Team Pineapple says pineapple adds sweetness that balances salty ingredients. Pizza is a party of salty, savoury guests. Pineapple is the one guest who brings balance instead of more salt.",
   "factRefs": [
    "F2"
   ]
  },
  {
   "slot": "L04",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Team No Fruit says fruit has no business interfering with pizza. You do not improve a masterpiece by gluing dessert to it.",
   "factRefs": [
    "F3"
   ]
  },
  {
   "slot": "L05",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Brings balance? Pizza was never asking for balance. Nobody bites into a slice hoping to find a fruit salad halfway through. Balance belongs in a diet, not on a crust.",
   "factRefs": [
    "F2"
   ],
   "answers": "brings balance instead of more salt"
  },
  {
   "slot": "L06",
   "speaker": "defense",
   "emotion": "smug",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "You do not improve a masterpiece, says Team No Fruit. Every topping you love was once a wild idea added to that masterpiece. The masterpiece survived. It got better.",
   "factRefs": [
    "F3"
   ],
   "answers": "you do not improve a masterpiece"
  },
  {
   "slot": "L07",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "desk-slam",
   "camera": "auto",
   "crowd": "none",
   "text": "Pizza was never asking for balance? Crust, sauce and cheese in careful proportion is balance. Pizza invented balance. Pineapple simply read the room.",
   "factRefs": [
    "F2"
   ],
   "answers": "Pizza was never asking for balance"
  },
  {
   "slot": "L08",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "camera": "auto",
   "crowd": "none",
   "text": "It got better, says Team Pineapple, about a slice that now needs a napkin for syrup. Some wild ideas end in discoveries. This one ends in sticky fingers.",
   "factRefs": [
    "F3"
   ],
   "answers": "The masterpiece survived. It got better"
  },
  {
   "slot": "L09",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "camera": "auto",
   "crowd": "laugh",
   "text": "The court notes that both sides have described pizza with more passion than most of its actual cases. Order.",
   "factRefs": [
    "F1"
   ]
  },
  {
   "slot": "L10",
   "speaker": "judge",
   "emotion": "neutral",
   "animation": "talk",
   "camera": "auto",
   "crowd": "laugh",
   "text": "For Team Pineapple: sweetness that balances salt. For Team No Fruit: a pizza that needs no rescuing. The question stays open.",
   "factRefs": [
    "F2",
    "F3"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk *(court-written)* | Public case: "Pineapple on Pizza". The question before the court, exactly as approved: "Should pineapple belong on pizza?" |
| L02 | Judge Gavel.exe · neutral, talk | Approved summary: the internet has argued about pineapple on pizza for years and neither side has backed down. Everything that follows is opinion. |
| L03 | Counsel Chaos for SIDE_A · confident, point | Team Pineapple says pineapple adds sweetness that balances salty ingredients. Pizza is a party of salty, savoury guests. Pineapple is the one guest who brings balance instead of more salt. |
| L04 | Miss Ratio for SIDE_B · confident, point | Team No Fruit says fruit has no business interfering with pizza. You do not improve a masterpiece by gluing dessert to it. |
| L05 | Miss Ratio for SIDE_B · smug, point | Brings balance? Pizza was never asking for balance. Nobody bites into a slice hoping to find a fruit salad halfway through. Balance belongs in a diet, not on a crust. |
| L06 | Counsel Chaos for SIDE_A · smug, point | You do not improve a masterpiece, says Team No Fruit. Every topping you love was once a wild idea added to that masterpiece. The masterpiece survived. It got better. |
| L07 | Counsel Chaos for SIDE_A · triumphant, desk-slam | Pizza was never asking for balance? Crust, sauce and cheese in careful proportion is balance. Pizza invented balance. Pineapple simply read the room. |
| L08 | Miss Ratio for SIDE_B · angry, desk-slam | It got better, says Team Pineapple, about a slice that now needs a napkin for syrup. Some wild ideas end in discoveries. This one ends in sticky fingers. |
| L09 | Judge Gavel.exe · exasperated, talk | The court notes that both sides have described pizza with more passion than most of its actual cases. Order. |
| L10 | Judge Gavel.exe · neutral, talk | For Team Pineapple: sweetness that balances salt. For Team No Fruit: a pizza that needs no rescuing. The question stays open. |
| L11 | Court Clerk *(court-written)* | Arguments are closed. This case is resolved by its approved process, not by the court's AI. Result pending. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

### Example 2: The Hot Dog Question

Input (`CaseInput`):

```json
{
  "mode": "viral",
  "caseId": "doc-viral-hotdog",
  "caseTitle": "The Hot Dog Question",
  "question": "Is a hot dog a sandwich?",
  "summary": "A long-running internet argument about whether a hot dog, a sausage in a split roll, counts as a sandwich.",
  "sideA": {
    "label": "Sandwich",
    "position": "It is a filling between bread, which is what a sandwich is."
  },
  "sideB": {
    "label": "Not a sandwich",
    "position": "A hot dog is its own food with its own name, its own bun and its own rules."
  },
  "sources": [
    {
      "id": "S1",
      "title": "Community summary of the debate",
      "claim": "Supporters say any filling held in sliced bread is a sandwich, and the bun is sliced bread.",
      "kind": "opinion"
    },
    {
      "id": "S2",
      "title": "Community summary of the debate",
      "claim": "Opponents say nobody orders a hot dog by asking for a sausage sandwich, so everyday usage decides.",
      "kind": "opinion"
    }
  ],
  "approved": true
}
```

Preparation (deterministic, no AI): category `public-debate`, tone `standard`, ballot SIDE_A / SIDE_B. Advocates (court coin flip on the case id): Miss Ratio argues SIDE_A (Sandwich), Counsel Chaos argues SIDE_B (Not a sandwich).

- F1 *(background)*: A long-running internet argument about whether a hot dog, a sausage in a split roll, counts as a sandwich.
- F2 *(position-a)*: It is a filling between bread, which is what a sandwich is.
- F3 *(position-b)*: A hot dog is its own food with its own name, its own bun and its own rules.
- F4 *(sourced-opinion, S1)*: Supporters say any filling held in sliced bread is a sandwich, and the bun is sliced bread.
- F5 *(sourced-opinion, S2)*: Opponents say nobody orders a hot dog by asking for a sausage sandwich, so everyday usage decides.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "Whether a sausage in a split roll meets the definition of a sandwich or has earned its own category.",
  "tension": "Both sides agree on what a hot dog is and disagree on what a sandwich is.",
  "benchA": "A filling held in sliced bread is the plain definition of a sandwich, and the bun is sliced bread.",
  "benchB": "Everyday usage decides, and nobody orders a sausage sandwich when they want a hot dog.",
  "factRefs": [
   "F2",
   "F3",
   "F4",
   "F5"
  ]
 },
 "lines": [
  {
   "slot": "L02",
   "speaker": "judge",
   "emotion": "neutral",
   "animation": "talk",
   "text": "Background: the internet has argued for years about whether a hot dog, a sausage in a split roll, is a sandwich. Both views here are opinions. The court brought napkins.",
   "factRefs": [
    "F1"
   ]
  },
  {
   "slot": "L03",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "point",
   "text": "A filling between bread is a sandwich. A hot dog is a sausage in a split roll. Your Honor, it is held like a sandwich and it drips mustard like a sandwich.",
   "factRefs": [
    "F2",
    "F4"
   ]
  },
  {
   "slot": "L04",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "text": "Nobody has ever ordered a sausage sandwich at a stand. A hot dog has its own name, its own bun and its own rules. You do not get your own bun by accident. You earn it.",
   "factRefs": [
    "F3",
    "F5"
   ]
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "smug",
   "animation": "point",
   "text": "Held like a sandwich? So is a taco. By that logic half the menu is a sandwich, and a definition that covers everything decides nothing.",
   "factRefs": [
    "F4"
   ],
   "answers": "it is held like a sandwich"
  },
  {
   "slot": "L06",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "text": "You earn your own bun? A burger has its own bun and its own name, and people still call it a sandwich. A special bun is just a costume for bread.",
   "factRefs": [
    "F2",
    "F4"
   ],
   "answers": "You earn it"
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "This definition covers one thing: a filling held in sliced bread. The taco is not on trial today. The hot dog is, and the hot dog fits.",
   "factRefs": [
    "F4"
   ],
   "answers": "a definition that covers everything decides nothing"
  },
  {
   "slot": "L08",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "desk-slam",
   "text": "If the bun is a costume, it works, because nobody is fooled. Usage decides what words mean, and nobody orders a hot dog by asking for a sandwich.",
   "factRefs": [
    "F3",
    "F5"
   ],
   "answers": "A special bun is just a costume"
  },
  {
   "slot": "L09",
   "speaker": "judge",
   "emotion": "amused",
   "animation": "talk",
   "crowd": "laugh",
   "text": "The court has heard the word bun more times than it expected in its legal career, and is now hungry. Order.",
   "factRefs": []
  },
  {
   "slot": "L10",
   "speaker": "judge",
   "emotion": "neutral",
   "animation": "gavel",
   "text": "For the sandwich side: the bun is sliced bread with a filling inside. For the other side: everyday usage gives the hot dog its own name. The question stays open.",
   "factRefs": [
    "F4",
    "F5"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk *(court-written)* | Public case: "The Hot Dog Question". The question before the court, exactly as approved: "Is a hot dog a sandwich?" |
| L02 | Judge Gavel.exe · neutral, talk | Background: the internet has argued for years about whether a hot dog, a sausage in a split roll, is a sandwich. Both views here are opinions. The court brought napkins. |
| L03 | Miss Ratio for SIDE_A · confident, point | A filling between bread is a sandwich. A hot dog is a sausage in a split roll. Your Honor, it is held like a sandwich and it drips mustard like a sandwich. |
| L04 | Counsel Chaos for SIDE_B · confident, point | Nobody has ever ordered a sausage sandwich at a stand. A hot dog has its own name, its own bun and its own rules. You do not get your own bun by accident. You earn it. |
| L05 | Counsel Chaos for SIDE_B · smug, point | Held like a sandwich? So is a taco. By that logic half the menu is a sandwich, and a definition that covers everything decides nothing. |
| L06 | Miss Ratio for SIDE_A · smug, point | You earn your own bun? A burger has its own bun and its own name, and people still call it a sandwich. A special bun is just a costume for bread. |
| L07 | Miss Ratio for SIDE_A · angry, desk-slam | This definition covers one thing: a filling held in sliced bread. The taco is not on trial today. The hot dog is, and the hot dog fits. |
| L08 | Counsel Chaos for SIDE_B · triumphant, desk-slam | If the bun is a costume, it works, because nobody is fooled. Usage decides what words mean, and nobody orders a hot dog by asking for a sandwich. |
| L09 | Judge Gavel.exe · amused, talk | The court has heard the word bun more times than it expected in its legal career, and is now hungry. Order. |
| L10 | Judge Gavel.exe · neutral, gavel | For the sandwich side: the bun is sliced bread with a filling inside. For the other side: everyday usage gives the hot dog its own name. The question stays open. |
| L11 | Court Clerk *(court-written)* | Arguments are closed. This case is resolved by its approved process, not by the court's AI. Result pending. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

### Example 3: The GIF Pronunciation Hearing

Input (`CaseInput`):

```json
{
  "mode": "viral",
  "caseId": "doc-viral-gif",
  "caseTitle": "The GIF Pronunciation Hearing",
  "question": "Should GIF be pronounced with a hard G?",
  "summary": "People disagree about whether the image format GIF is said with a hard G, as in gift, or a soft G, as in giraffe.",
  "sideA": {
    "label": "Hard G",
    "position": "GIF stands for Graphics Interchange Format, and graphics starts with a hard G."
  },
  "sideB": {
    "label": "Soft G",
    "position": "The person who created the format said it is a soft G, and the creator gets to decide."
  },
  "sources": [
    {
      "id": "S1",
      "title": "Interview with the format's creator",
      "date": "2013-05-21",
      "claim": "The creator of the GIF format said it is pronounced with a soft G, like the word jif.",
      "kind": "fact"
    },
    {
      "id": "S2",
      "title": "Community summary of the debate",
      "claim": "Hard-G supporters say an acronym should sound like the words it stands for.",
      "kind": "opinion"
    }
  ],
  "uncertainty": [
    "Dictionaries list both pronunciations."
  ],
  "approved": true
}
```

Preparation (deterministic, no AI): category `public-debate`, tone `standard`, ballot SIDE_A / SIDE_B. Advocates (court coin flip on the case id): Miss Ratio argues SIDE_A (Hard G), Counsel Chaos argues SIDE_B (Soft G).

- F1 *(background)*: People disagree about whether the image format GIF is said with a hard G, as in gift, or a soft G, as in giraffe.
- F2 *(position-a)*: GIF stands for Graphics Interchange Format, and graphics starts with a hard G.
- F3 *(position-b)*: The person who created the format said it is a soft G, and the creator gets to decide.
- F4 *(sourced-fact, S1)*: The creator of the GIF format said it is pronounced with a soft G, like the word jif.
- F5 *(sourced-opinion, S2)*: Hard-G supporters say an acronym should sound like the words it stands for.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "Whether an acronym's pronunciation is set by the words it stands for or by the person who created it.",
  "tension": "The creator said soft G, while the letters themselves point to a hard G.",
  "benchA": "GIF stands for Graphics Interchange Format, and an acronym usually sounds like the words inside it.",
  "benchB": "The creator of the format said it is a soft G, and whoever names a thing gets to say how it sounds.",
  "factRefs": [
   "F2",
   "F3",
   "F4",
   "F5"
  ]
 },
 "lines": [
  {
   "slot": "L02",
   "speaker": "judge",
   "emotion": "neutral",
   "animation": "talk",
   "text": "Background: people disagree on whether GIF takes a hard G, as in gift, or a soft G, as in giraffe. The creator said soft; hard-G supporters point to the acronym.",
   "factRefs": [
    "F1",
    "F4",
    "F5"
   ]
  },
  {
   "slot": "L03",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "point",
   "text": "GIF stands for Graphics Interchange Format, and graphics starts with a hard G. Your Honor, this is not a mystery. It is a spelling lesson.",
   "factRefs": [
    "F2",
    "F5"
   ]
  },
  {
   "slot": "L04",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "text": "The creator of the format said it is a soft G, like the word jif. When you invent something, you get to say how its name sounds. Ask the inventor.",
   "factRefs": [
    "F3",
    "F4"
   ]
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "smug",
   "animation": "point",
   "text": "A spelling lesson? Then learn from giraffe and gin, where the G goes soft and nobody complains. English letters have never promised to behave.",
   "factRefs": [
    "F1"
   ],
   "answers": "It is a spelling lesson"
  },
  {
   "slot": "L06",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "text": "Ask the inventor? Once a word leaves its creator, everyone who says it gets a vote, and the internet reads the letters it is given.",
   "factRefs": [
    "F4",
    "F5"
   ],
   "answers": "Ask the inventor"
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "English letters never promised to behave, which is why we lean on the words inside the acronym. Graphics, hard G. Follow the clue written down on purpose.",
   "factRefs": [
    "F2",
    "F5"
   ],
   "answers": "English letters have never promised to behave"
  },
  {
   "slot": "L08",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "desk-slam",
   "text": "Everyone gets a vote? Then the creator's vote counts, and it is the only one cast by someone who was there when the name was chosen. That vote is soft.",
   "factRefs": [
    "F4"
   ],
   "answers": "everyone who says it gets a vote"
  },
  {
   "slot": "L09",
   "speaker": "judge",
   "emotion": "amused",
   "animation": "talk",
   "crowd": "laugh",
   "text": "The court has avoided saying the word aloud for this entire hearing and intends to keep that streak alive.",
   "factRefs": []
  },
  {
   "slot": "L10",
   "speaker": "judge",
   "emotion": "neutral",
   "animation": "gavel",
   "text": "For the hard G: the acronym starts with graphics. For the soft G: the creator of the format said soft. The question stays with the jury.",
   "factRefs": [
    "F2",
    "F4"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk *(court-written)* | Public case: "The GIF Pronunciation Hearing". The question before the court, exactly as approved: "Should GIF be pronounced with a hard G?" |
| L02 | Judge Gavel.exe · neutral, talk | Background: people disagree on whether GIF takes a hard G, as in gift, or a soft G, as in giraffe. The creator said soft; hard-G supporters point to the acronym. |
| L03 | Miss Ratio for SIDE_A · confident, point | GIF stands for Graphics Interchange Format, and graphics starts with a hard G. Your Honor, this is not a mystery. It is a spelling lesson. |
| L04 | Counsel Chaos for SIDE_B · confident, point | The creator of the format said it is a soft G, like the word jif. When you invent something, you get to say how its name sounds. Ask the inventor. |
| L05 | Counsel Chaos for SIDE_B · smug, point | A spelling lesson? Then learn from giraffe and gin, where the G goes soft and nobody complains. English letters have never promised to behave. |
| L06 | Miss Ratio for SIDE_A · smug, point | Ask the inventor? Once a word leaves its creator, everyone who says it gets a vote, and the internet reads the letters it is given. |
| L07 | Miss Ratio for SIDE_A · angry, desk-slam | English letters never promised to behave, which is why we lean on the words inside the acronym. Graphics, hard G. Follow the clue written down on purpose. |
| L08 | Counsel Chaos for SIDE_B · triumphant, desk-slam | Everyone gets a vote? Then the creator's vote counts, and it is the only one cast by someone who was there when the name was chosen. That vote is soft. |
| L09 | Judge Gavel.exe · amused, talk | The court has avoided saying the word aloud for this entire hearing and intends to keep that streak alive. |
| L10 | Judge Gavel.exe · neutral, gavel | For the hard G: the acronym starts with graphics. For the soft G: the creator of the format said soft. The question stays with the jury. |
| L11 | Court Clerk *(court-written)* | Arguments are closed. This case is resolved by its approved process, not by the court's AI. Result pending. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

<!-- END GENERATED EXAMPLES -->
