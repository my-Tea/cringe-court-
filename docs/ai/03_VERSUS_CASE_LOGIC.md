# 03 · Versus Court

Two consenting participants disagree. Each side gets an advocate, and the jury votes **SIDE A** or **SIDE B**. The trial is about the dispute, never about humiliating either person.

Sources:
- `plans.ts` (`VERSUS_PLAN`, `versus-trial@1`);
- `prompts.ts` (`MODE_RULES.versus`);
- `prepare.ts` (`prepareVersus`, `assignAdvocates`).

## 1. Input

| Field | Rule |
|---|---|
| `mode` | `"versus"` |
| `caseId`, `caseTitle`, `category` | As in Solo |
| `sideA` / `sideB` | `{ name?: ≤24-char nickname, account: 15–1200 chars }`: each participant's own account |
| `agreedFacts` | Optional, ≤ 8 × 240 chars. **Only facts both participants confirmed in the app.** These are the only facts stated as true |

## 2. Preparation

The steps are the same as Solo (sanitise, redact, screen). Then:

1. **Facts keep their provenance.**
   - Agreed facts come first, with status `agreed`.
   - Then Side A's sentences, with status `claimed-by-a`.
   - Then Side B's sentences, with status `claimed-by-b`.
   - The prompt requires claims to be attributed ("Side A says…"), never presented as proven.
2. **Advocates are assigned by the court, not the model.**
   - The rule is `assignAdvocates(caseId)`: a keccak-based coin flip on the case id. For any given case, either Miss Ratio or Counsel Chaos may argue Side A.
   - The result is stable for a given `caseId`.
   - Neither advocate is "the prosecution in spirit".
3. **Staging follows the assignment.** Each advocate stays at their own desk, and the camera follows the advocate. See [09](09_ANIMATION_CONTRACT.md).

## 3. Trial plan (`versus-trial@1`, target 70–110 s)

| Slot | Speaker | Segment | Job | Answers |
|---|---|---|---|---|
| L01 | Clerk | call-to-order | Names the dispute and both participants; neutral | |
| L02 | Side A's advocate | opening | Side A's strongest claim; agreed facts first | |
| L03 | Side B's advocate | opening | Side B's strongest claim | |
| L04 | Side B's advocate | rebuttal | Probe the weakest assumption in L02 | L02 |
| L05 | Side A's advocate | rebuttal | Probe the weakest assumption in L03 | L03 |
| L06 | Side A's advocate | rebuttal | Answer L04 with a new point | L04 |
| L07 | Side B's advocate | rebuttal | Answer L05 with a new point | L05 |
| L08 | Judge | rebuttal | Deadpan, even-handed reaction | |
| L09 | Side A's advocate | closing | Callback; asks for SIDE A | |
| L10 | Side B's advocate | closing | Callback; asks for SIDE B | |
| L11 | Judge | jury-out | **Court-written:** "Both sides have been heard. Jurors: SIDE A, ⟨name⟩, or SIDE B, ⟨name⟩? The jury is out." | |

## 4. Rules specific to Versus

- **Balance is measured.** If one side's lines total more than 1.4× the other's words, the check fails soft. Above 2× it fails hard.
- **Both sides get credit.** The `prosecution` and `defense` dimensions score Side A's bench and Side B's bench respectively.
- **Writing more earns nothing.** The prompt tells the model not to favour the side that wrote more, filed first or sounds more sympathetic.
- **Insults in the accounts make the tone gentle.** Insults in the output then become hard failures. See adversarial case A05 in [11](11_TESTING_AND_EVALUATION.md).
- **Neutral characters stay neutral.** The judge and clerk may not use winner language (`neutrality` hard check).

## 5. After the verdict

| Outcome | Announcement must contain |
|---|---|
| `SIDE_A` | SIDE A |
| `SIDE_B` | SIDE B |
| `NO_VERDICT` / `CANCELLED` / `INVALID` | that exact phrase, and no winner/loser words |

`GUILTY` and `NOT_COOKED` are rejected for Versus.

## 6. Acceptance criteria

1. **No hard issues, and the score thresholds are met.** This is the same rule as Solo.
2. **Runtime.** The estimated runtime is 70–110 s.
3. **Correct advocates.** Every bench line is spoken by the advocate the court assigned (`wrong-speaker` is hard).
4. **Claims are attributed.** No `claimed-by-*` fact is stated as agreed (human check). Agreed facts are used before claims in L02 and L03.
5. **Engaged exchanges.** L04–L07 engage and quote the line they answer.
6. **Balance.** Bench word totals are within 1.4× of each other, and a reviewer cannot tell which side the writer prefers (human check).
7. **Nobody is humiliated.** Neither participant is humiliated. In gentle tone there are no insults at all.
8. **Replay is stable.** This is the same rule as Solo.

## 7. Complete examples

<!-- BEGIN GENERATED EXAMPLES (npm run court:prompts) -->

### Example 1: The Shampoo Incident

Input (`CaseInput`):

```json
{
  "mode": "versus",
  "caseId": "example-versus-shampoo",
  "caseTitle": "The Shampoo Incident",
  "sideA": {
    "name": "Priya",
    "account": "My roommate used my expensive shampoo to clean his sneakers."
  },
  "sideB": {
    "name": "Dev",
    "account": "The bottle said deep cleaning, and my sneakers were extremely dirty."
  },
  "agreedFacts": [
    "Dev used Priya's shampoo on his sneakers."
  ]
}
```

Preparation (deterministic, no AI): category `roommates`, tone `standard`, ballot SIDE_A / SIDE_B. Advocates (court coin flip on the case id): Miss Ratio argues SIDE_A (Priya), Counsel Chaos argues SIDE_B (Dev).

- F1 *(agreed)*: Dev used Priya's shampoo on his sneakers.
- F2 *(claimed-by-a)*: My roommate used my expensive shampoo to clean his sneakers.
- F3 *(claimed-by-b)*: The bottle said deep cleaning, and my sneakers were extremely dirty.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "Whether a cleaning promise on a label outranks who owns the bottle.",
  "tension": "The shampoo did exactly what the label said, just on the wrong customer.",
  "benchA": "The shampoo was hers, bought for hair, and nobody asked before using it.",
  "benchB": "The label promised deep cleaning and the sneakers genuinely needed it.",
  "factRefs": [
   "F1",
   "F2",
   "F3"
  ]
 },
 "lines": [
  {
   "slot": "L01",
   "speaker": "clerk",
   "emotion": "neutral",
   "animation": "talk",
   "camera": "auto",
   "crowd": "none",
   "text": "Next: The Shampoo Incident. Priya versus Dev, one bottle, one pair of sneakers, and two very different ideas of what deep cleaning means.",
   "factRefs": [
    "F1"
   ]
  },
  {
   "slot": "L02",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Both sides agree Dev used Priya's shampoo on his sneakers. Priya says it was her expensive shampoo, bought for hair. Shampoo is a hair product with a job description, and that job does not include footwear.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L03",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "present-evidence",
   "camera": "auto",
   "crowd": "none",
   "text": "Dev says the bottle promised deep cleaning, and his sneakers were extremely dirty. He read the label, believed it, and applied it to the dirtiest thing he owned.",
   "factRefs": [
    "F3"
   ]
  },
  {
   "slot": "L04",
   "speaker": "defense",
   "emotion": "smug",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Priya says the job does not include footwear. Then the label should have said so. Nothing on that bottle named hair as the only customer.",
   "factRefs": [
    "F2",
    "F3"
   ],
   "answers": "that job does not include footwear"
  },
  {
   "slot": "L05",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Dev says he read the label and believed it. Did he also read whose bathroom shelf it lived on? Labels describe what a product does, not whose product it is.",
   "factRefs": [
    "F1",
    "F3"
   ],
   "answers": "He read the label, believed it"
  },
  {
   "slot": "L06",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "camera": "auto",
   "crowd": "none",
   "text": "Then the label should have said so, says Dev. The label never said help yourself either. Borrowing without asking is the one stain no bottle can deep clean.",
   "factRefs": [
    "F1",
    "F2"
   ],
   "answers": "Then the label should have said so"
  },
  {
   "slot": "L07",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Fair point on whose product it is. But was using a cleaner to clean a crime or an emergency? By Dev's account, those sneakers were an emergency.",
   "factRefs": [
    "F3"
   ],
   "answers": "not whose product it is"
  },
  {
   "slot": "L08",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "camera": "auto",
   "crowd": "laugh",
   "text": "The court has seen many disputes, but rarely one where the sneakers are the cleanest party involved. Closings, please.",
   "factRefs": [
    "F1"
   ]
  },
  {
   "slot": "L09",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "The shampoo was bought for hair, used on shoes, and nobody asked first. Vote SIDE A for Priya.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L10",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "The bottle promised deep cleaning and Dev took it at its word. Honest, if a little loose about ownership. Vote SIDE B for Dev.",
   "factRefs": [
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
| L01 | Court Clerk · neutral, talk | Next: The Shampoo Incident. Priya versus Dev, one bottle, one pair of sneakers, and two very different ideas of what deep cleaning means. |
| L02 | Miss Ratio for SIDE_A · confident, point | Both sides agree Dev used Priya's shampoo on his sneakers. Priya says it was her expensive shampoo, bought for hair. Shampoo is a hair product with a job description, and that job does not include footwear. |
| L03 | Counsel Chaos for SIDE_B · confident, present-evidence | Dev says the bottle promised deep cleaning, and his sneakers were extremely dirty. He read the label, believed it, and applied it to the dirtiest thing he owned. |
| L04 | Counsel Chaos for SIDE_B · smug, point | Priya says the job does not include footwear. Then the label should have said so. Nothing on that bottle named hair as the only customer. |
| L05 | Miss Ratio for SIDE_A · smug, point | Dev says he read the label and believed it. Did he also read whose bathroom shelf it lived on? Labels describe what a product does, not whose product it is. |
| L06 | Miss Ratio for SIDE_A · angry, desk-slam | Then the label should have said so, says Dev. The label never said help yourself either. Borrowing without asking is the one stain no bottle can deep clean. |
| L07 | Counsel Chaos for SIDE_B · confident, point | Fair point on whose product it is. But was using a cleaner to clean a crime or an emergency? By Dev's account, those sneakers were an emergency. |
| L08 | Judge Gavel.exe · exasperated, talk | The court has seen many disputes, but rarely one where the sneakers are the cleanest party involved. Closings, please. |
| L09 | Miss Ratio for SIDE_A · confident, point | The shampoo was bought for hair, used on shoes, and nobody asked first. Vote SIDE A for Priya. |
| L10 | Counsel Chaos for SIDE_B · confident, point | The bottle promised deep cleaning and Dev took it at its word. Honest, if a little loose about ownership. Vote SIDE B for Dev. |
| L11 | Judge Gavel.exe *(court-written)* | Both sides have been heard. Jurors: SIDE A, Priya, or SIDE B, Dev? The jury is out. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

### Example 2: The Container Swap

Input (`CaseInput`):

```json
{
  "mode": "versus",
  "caseId": "doc-versus-tupperware",
  "caseTitle": "The Container Swap",
  "sideA": {
    "name": "Maya",
    "account": "I lent Sam my good glass container with soup in it. Three weeks later Sam gave back a different, cheaper plastic one and called it a fair swap."
  },
  "sideB": {
    "name": "Sam",
    "account": "The glass container cracked in the microwave, which was an accident. I replaced it the same day with the best container the corner shop had, and I washed it first."
  },
  "agreedFacts": [
    "Sam borrowed Maya's glass container with soup in it.",
    "Sam returned a different, plastic container."
  ]
}
```

Preparation (deterministic, no AI): category `everyday`, tone `standard`, ballot SIDE_A / SIDE_B. Advocates (court coin flip on the case id): Counsel Chaos argues SIDE_A (Maya), Miss Ratio argues SIDE_B (Sam).

- F1 *(agreed)*: Sam borrowed Maya's glass container with soup in it.
- F2 *(agreed)*: Sam returned a different, plastic container.
- F3 *(claimed-by-a)*: I lent Sam my good glass container with soup in it.
- F4 *(claimed-by-a)*: Three weeks later Sam gave back a different, cheaper plastic one and called it a fair swap.
- F5 *(claimed-by-b)*: The glass container cracked in the microwave, which was an accident.
- F6 *(claimed-by-b)*: I replaced it the same day with the best container the corner shop had, and I washed it first.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "A borrowed glass container broke and came back as a cheaper plastic one, and the two friends disagree about whether that is a fair swap.",
  "tension": "The replacement came the same day, but it was the corner shop's best, which was not glass.",
  "benchA": "Maya lent glass and got plastic; nobody asked Maya whether a downgrade counts as a replacement.",
  "benchB": "The crack was an accident, and Sam replaced and washed the container without being asked.",
  "factRefs": [
   "F1",
   "F2",
   "F5",
   "F6"
  ]
 },
 "lines": [
  {
   "slot": "L01",
   "speaker": "clerk",
   "emotion": "amused",
   "animation": "talk",
   "text": "The court calls The Container Swap: Maya versus Sam. A glass container left full of soup and came back as plastic. The clerk has picked no side.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L02",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "present-evidence",
   "text": "Both sides agree: Sam borrowed Maya's glass container and returned a plastic one. My client lent glass, received plastic, and asks when exactly she agreed to a downgrade.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L03",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "present-evidence",
   "text": "My client adds what Maya left out: the glass cracked in the microwave by accident, and Sam replaced it the same day, washed. Same-day replacements almost never happen.",
   "factRefs": [
    "F5",
    "F6"
   ]
  },
  {
   "slot": "L04",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "text": "When did Maya agree to a downgrade? When Maya lent glass to someone with a microwave. Glass breaks. Sam chose the cleanup, not the crack.",
   "factRefs": [
    "F1",
    "F5"
   ],
   "answers": "when exactly she agreed to a downgrade"
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "smug",
   "animation": "point",
   "text": "Same-day replacements almost never happen, and neither do downgrades called a fair swap. The best plastic in the corner shop is still not glass.",
   "factRefs": [
    "F4",
    "F6"
   ],
   "answers": "Same-day replacements almost never happen"
  },
  {
   "slot": "L06",
   "speaker": "defense",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "Glass breaks, yes, and Maya accepted that risk. Maya never accepted glass coming back as plastic and being called fair.",
   "factRefs": [
    "F3",
    "F4"
   ],
   "answers": "Glass breaks"
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "The best plastic in the corner shop, says counsel, about a container that came back washed and unasked. That is not a downgrade. That is a friend with a sponge.",
   "factRefs": [
    "F6"
   ],
   "answers": "The best plastic in the corner shop"
  },
  {
   "slot": "L08",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "crowd": "laugh",
   "text": "The court has heard more about soup containers today than in its entire career. It remains neutral on plastic.",
   "factRefs": []
  },
  {
   "slot": "L09",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "point",
   "text": "Remember the downgrade. Maya lent glass and got plastic plus the word fair. If that is fair, nobody's good container is safe. Vote SIDE A.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L10",
   "speaker": "prosecutor",
   "emotion": "triumphant",
   "animation": "point",
   "text": "Remember the sponge. An accident, a replacement and a wash, all unasked. If that is not enough, nobody should ever lend soup again. Vote SIDE B.",
   "factRefs": [
    "F5",
    "F6"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk · amused, talk | The court calls The Container Swap: Maya versus Sam. A glass container left full of soup and came back as plastic. The clerk has picked no side. |
| L02 | Counsel Chaos for SIDE_A · confident, present-evidence | Both sides agree: Sam borrowed Maya's glass container and returned a plastic one. My client lent glass, received plastic, and asks when exactly she agreed to a downgrade. |
| L03 | Miss Ratio for SIDE_B · confident, present-evidence | My client adds what Maya left out: the glass cracked in the microwave by accident, and Sam replaced it the same day, washed. Same-day replacements almost never happen. |
| L04 | Miss Ratio for SIDE_B · smug, point | When did Maya agree to a downgrade? When Maya lent glass to someone with a microwave. Glass breaks. Sam chose the cleanup, not the crack. |
| L05 | Counsel Chaos for SIDE_A · smug, point | Same-day replacements almost never happen, and neither do downgrades called a fair swap. The best plastic in the corner shop is still not glass. |
| L06 | Counsel Chaos for SIDE_A · angry, desk-slam | Glass breaks, yes, and Maya accepted that risk. Maya never accepted glass coming back as plastic and being called fair. |
| L07 | Miss Ratio for SIDE_B · angry, desk-slam | The best plastic in the corner shop, says counsel, about a container that came back washed and unasked. That is not a downgrade. That is a friend with a sponge. |
| L08 | Judge Gavel.exe · exasperated, talk | The court has heard more about soup containers today than in its entire career. It remains neutral on plastic. |
| L09 | Counsel Chaos for SIDE_A · triumphant, point | Remember the downgrade. Maya lent glass and got plastic plus the word fair. If that is fair, nobody's good container is safe. Vote SIDE A. |
| L10 | Miss Ratio for SIDE_B · triumphant, point | Remember the sponge. An accident, a replacement and a wash, all unasked. If that is not enough, nobody should ever lend soup again. Vote SIDE B. |
| L11 | Judge Gavel.exe *(court-written)* | Both sides have been heard. Jurors: SIDE A, Maya, or SIDE B, Sam? The jury is out. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

### Example 3: The Thermostat Cold War

Input (`CaseInput`):

```json
{
  "mode": "versus",
  "caseId": "doc-versus-thermostat",
  "caseTitle": "The Thermostat Cold War",
  "sideA": {
    "name": "Leo",
    "account": "My flatmate keeps the heating at 26 degrees all winter and then opens a window when it gets too warm. We split the heating bill, so I pay for the window too."
  },
  "sideB": {
    "name": "Nadia",
    "account": "Leo sets the heating to 17 degrees and wears a coat indoors, which is not a way to live. I open the window for fresh air, not because it is too warm."
  },
  "agreedFacts": [
    "Leo and Nadia share one thermostat.",
    "They split the heating bill equally."
  ]
}
```

Preparation (deterministic, no AI): category `roommates`, tone `standard`, ballot SIDE_A / SIDE_B. Advocates (court coin flip on the case id): Counsel Chaos argues SIDE_A (Leo), Miss Ratio argues SIDE_B (Nadia).

- F1 *(agreed)*: Leo and Nadia share one thermostat.
- F2 *(agreed)*: They split the heating bill equally.
- F3 *(claimed-by-a)*: My flatmate keeps the heating at 26 degrees all winter and then opens a window when it gets too warm.
- F4 *(claimed-by-a)*: We split the heating bill, so I pay for the window too.
- F5 *(claimed-by-b)*: Leo sets the heating to 17 degrees and wears a coat indoors, which is not a way to live.
- F6 *(claimed-by-b)*: I open the window for fresh air, not because it is too warm.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "Two flatmates share one thermostat and one bill, and each thinks the other's temperature is the unreasonable one.",
  "tension": "One heats the flat to 26 degrees and opens a window; the other sets 17 and wears a coat indoors.",
  "benchA": "Leo pays half of every warm breeze that leaves through the open window.",
  "benchB": "A coat indoors means the flat is too cold, and fresh air is not waste.",
  "factRefs": [
   "F1",
   "F2",
   "F3",
   "F5",
   "F6"
  ]
 },
 "lines": [
  {
   "slot": "L01",
   "speaker": "clerk",
   "emotion": "amused",
   "animation": "talk",
   "text": "The court calls The Thermostat Cold War: Leo versus Nadia. One thermostat, two climates, one shared bill. The clerk brought a cardigan and an open mind.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L02",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "present-evidence",
   "text": "Both sides agree they share one thermostat and split the heating bill. My client says the heating runs at 26 degrees and then a window opens. My client is paying to heat the street.",
   "factRefs": [
    "F1",
    "F2",
    "F3",
    "F4"
   ]
  },
  {
   "slot": "L03",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "present-evidence",
   "text": "My client has a number too: Leo sets the heating to 17 degrees and wears a coat indoors. A flat that needs a coat is not a home. It is a bus stop with a sofa.",
   "factRefs": [
    "F5"
   ]
  },
  {
   "slot": "L04",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "text": "Paying to heat the street? My client opens the window for fresh air, not because it is too warm. Fresh air is free, counsel.",
   "factRefs": [
    "F2",
    "F6"
   ],
   "answers": "paying to heat the street"
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "amused",
   "animation": "point",
   "text": "A bus stop with a sofa, maybe, but the coat costs nothing to run. The heating at 26 degrees does, and it shows up on the shared bill.",
   "factRefs": [
    "F3",
    "F4",
    "F5"
   ],
   "answers": "a bus stop with a sofa"
  },
  {
   "slot": "L06",
   "speaker": "defense",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "Fresh air is free. Warm air is not, and the window lets out both at once. My client asks only that the heating and the window stop fighting.",
   "factRefs": [
    "F3",
    "F6"
   ],
   "answers": "Fresh air is free"
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "The coat costs nothing to run? Neither does being cold. My client wants a home where nobody dresses for the outdoors to sit on the sofa.",
   "factRefs": [
    "F5"
   ],
   "answers": "the coat costs nothing to run"
  },
  {
   "slot": "L08",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "crowd": "laugh",
   "text": "The court has heard two numbers, a window and a coat, and has adjusted its own thermostat twice. Carry on.",
   "factRefs": []
  },
  {
   "slot": "L09",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "point",
   "text": "Remember the street. Every time that window opens, my client pays half the heat it lets out. Close the window and everyone is warm enough. Vote SIDE A.",
   "factRefs": [
    "F2",
    "F3"
   ]
  },
  {
   "slot": "L10",
   "speaker": "prosecutor",
   "emotion": "triumphant",
   "animation": "point",
   "text": "Remember the bus stop. A home should not need a coat, and fresh air should not need permission. Let my client be warm and breathe. Vote SIDE B.",
   "factRefs": [
    "F5",
    "F6"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk · amused, talk | The court calls The Thermostat Cold War: Leo versus Nadia. One thermostat, two climates, one shared bill. The clerk brought a cardigan and an open mind. |
| L02 | Counsel Chaos for SIDE_A · confident, present-evidence | Both sides agree they share one thermostat and split the heating bill. My client says the heating runs at 26 degrees and then a window opens. My client is paying to heat the street. |
| L03 | Miss Ratio for SIDE_B · confident, present-evidence | My client has a number too: Leo sets the heating to 17 degrees and wears a coat indoors. A flat that needs a coat is not a home. It is a bus stop with a sofa. |
| L04 | Miss Ratio for SIDE_B · smug, point | Paying to heat the street? My client opens the window for fresh air, not because it is too warm. Fresh air is free, counsel. |
| L05 | Counsel Chaos for SIDE_A · amused, point | A bus stop with a sofa, maybe, but the coat costs nothing to run. The heating at 26 degrees does, and it shows up on the shared bill. |
| L06 | Counsel Chaos for SIDE_A · angry, desk-slam | Fresh air is free. Warm air is not, and the window lets out both at once. My client asks only that the heating and the window stop fighting. |
| L07 | Miss Ratio for SIDE_B · angry, desk-slam | The coat costs nothing to run? Neither does being cold. My client wants a home where nobody dresses for the outdoors to sit on the sofa. |
| L08 | Judge Gavel.exe · exasperated, talk | The court has heard two numbers, a window and a coat, and has adjusted its own thermostat twice. Carry on. |
| L09 | Counsel Chaos for SIDE_A · triumphant, point | Remember the street. Every time that window opens, my client pays half the heat it lets out. Close the window and everyone is warm enough. Vote SIDE A. |
| L10 | Miss Ratio for SIDE_B · triumphant, point | Remember the bus stop. A home should not need a coat, and fresh air should not need permission. Let my client be warm and breathe. Vote SIDE B. |
| L11 | Judge Gavel.exe *(court-written)* | Both sides have been heard. Jurors: SIDE A, Leo, or SIDE B, Nadia? The jury is out. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

<!-- END GENERATED EXAMPLES -->
