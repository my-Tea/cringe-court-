# 06 · Comedy and narrative design

Sources:
- `plans.ts` (slot purposes and `answers` links);
- `prompts.ts` (`sharedSystemPrompt`, `CATEGORY_ANGLES`);
- `checks.ts` (`checkAnswer`, `checkTrialLevel`, `score`).

## 1. Shape of every trial

Every trial follows the same arc. It is fixed by the mode plan, so the model writes jokes, not structure.

1. **Call to order.** The clerk introduces the case.
   - Solo: one light, specific observation.
   - Viral: the verbatim question, as a template line.
2. **Openings.** Each side states its strongest claim, built on a concrete case detail.
3. **Exchanges.** Each rebuttal answers the *specific words* of the line before it. This is the heart of the trial.
4. **The judge's reaction.** A deadpan beat that releases tension and resets the rhythm, with no hint of a winner.
5. **Closings.** One memorable line each, calling back to an earlier detail or phrase.
6. **Jury out.** A court-written vote invitation.

## 2. Why it should be funny

The shared system prompt gives the model the techniques. In priority order:

- **Specificity over genre jokes.** "A dog in a tiny tie" beats "crypto is risky". The `generic-line` check flags counsel lines that share no words with the case.
- **Escalating logic.** Take the defendant's reasoning seriously, then one step further than it can bear.
- **Mock gravity.** Courtroom procedure applied to trivial things ("let the record reflect the court's fatigue").
- **Callbacks.** A closing reuses a phrase coined earlier in *this* trial. The humor estimate drops when no late line reuses a distinctive early word that is not from the case text itself.
- **Turnabouts.** A rebuttal flips the opponent's own words ("Nobody wears a tie to lose your money? Counsel, every scam in history wore a tie.").
- **Short punchlines.** A setup, then a short turn. Slot character ranges keep the lines tight.

**Category angles** (`CATEGORY_ANGLES`, 16 categories) suggest a frame for each kind of case:
- crypto: a whitepaper review;
- dating: a diplomatic incident;
- food: a health inspection.

The angle is a flavour, never a substitute for case details.

## 3. Rebuttal consistency

This is the main difference between a trial and four people reading monologues. Every reply slot has an `answers` link (for example, Solo L03 answers L02). For each one, the checker does the following:

1. It compares content-word stems between the reply and its target line.
2. It requires the model to put the few words it is answering in `answers`, and checks that the quote really comes from the target (≥ 60 % of its content words appear there).

| Situation | Finding |
|---|---|
| Reply shares no content words with its target | `non-responsive` **hard**: repaired or rejected |
| `answers` quote not found in the target | `misquoted-answer` soft |
| Reply engages but gives no `answers` quote | `missing-answer-quote` soft |
| Reply repeats the target word for word | `duplicate-line` hard |
| Reply copies ≥ 3 four-word runs from an earlier line (the answered line is excluded, since quoting it is the point) | `repetition` soft |

The game can show the `answers` quote as an "objection target" caption. The rebuttal then visibly lands on what was said.

## 4. Balance

- **Solo:** prosecution and defense are scored as separate rubric dimensions. A weak, generic or ungrounded defense costs as much as a weak prosecution.
- **Versus and Viral:** bench word totals must be within 1.4× (soft) or 2× (hard). The advocates are assigned by a coin flip, so neither character is always the "accuser".

## 5. Length and pacing

**Reading model:** 15 characters per second, plus 0.6 s per line. The checker and the transcript's `estimatedSeconds` use the same model, and so do the Director options the game should use ([09 §4](09_ANIMATION_CONTRACT.md#4-timing)).

**Line limits:**
- counsel lines: 70–300 characters;
- judge and clerk lines: 25–220;
- Viral judge background and close: up to 260.

**Penalties:**
- A line over its limit is soft; over 1.25× its limit is hard.
- A trial over its total budget is soft; over 1.4× the budget is hard.

## 6. Originality across trials

A model can drift into a single template with the nouns swapped. `crossTrialSimilarity` measures the average pairwise Jaccard similarity of counsel-line 4-gram sets across trials of the same mode. Each case's own words are masked first, so shared case vocabulary does not count.
- **Target:** below 0.08 on a live corpus run.
- **Reference:** the hand-written examples score below 0.05. The template mock scores above 0.2, which is exactly the failure the metric exists to catch.

## 7. Where comedy stops

- Roast decisions and situations, never identities, bodies or worth.
- **Gentle tone:** grief, health, break-ups, job loss, or insults in the input. The jokes stay on the situation and insults become hard failures.
- No real-world harm topics. These cases are refused at preparation; see [07 §3](07_ORCHESTRATION_ARCHITECTURE.md#3-case-preparation).
- Viral: no money talk, no predictions, no new facts.
