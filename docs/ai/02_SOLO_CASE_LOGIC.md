# 02 · Solo Court

One player confesses a questionable decision. Miss Ratio prosecutes the **decision**, Counsel Chaos defends the **defendant**, and the jury votes **GUILTY** or **NOT COOKED**.

Sources:
- `plans.ts` (`SOLO_PLAN`, `solo-trial@1`);
- `prompts.ts` (`MODE_RULES.solo`);
- `prepare.ts` (`prepareSolo`);
- `schema.ts` (`SoloCaseInputSchema`).

## 1. Input

| Field | Rule |
|---|---|
| `mode` | `"solo"` (set by the app) |
| `caseId` | Optional. 1–64 of `A-Z a-z 0-9 _ -`. If omitted, it is derived from the keccak hash of the canonical input. Give a stable id so replay works |
| `caseTitle` | 3–90 characters |
| `confession` | 15–1200 characters, the player's own words |
| `context` | Optional, ≤ 600 characters |
| `category` | Optional override. Otherwise inferred from keywords (16 categories) |
| `defendantName` | Optional display name (default "the defendant") |

## 2. Preparation

1. **Sanitise.** Strip control and invisible characters, normalise whitespace.
2. **Redact.** Emails, links, wallets, phone numbers and @handles become `[email]`, `[link]` and so on.
3. **Screen.**
   - Refuse self-harm, violence, abuse, sexual content, crimes, hate, privacy-seeking and elections. The user sees a clear message.
   - Use the **gentle** tone for grief, health, break-ups, job loss and insults. Jokes then stay on the situation, and insults become hard failures.
   - Flag injection-like text. It stays in the case as quoted data.
4. **Number the facts.** Each sentence of the confession becomes F1, F2… with status `stated`. Context sentences get status `context`.

## 3. Trial plan (`solo-trial@1`, target 60–100 s)

| Slot | Speaker | Segment | Job | Answers |
|---|---|---|---|---|
| L01 | Clerk | call-to-order | Title and confessed act in plain words, one light observation | |
| L02 | Miss Ratio | opening | The exact questionable decision and its contradiction, quoting a detail | |
| L03 | Counsel Chaos | opening | Strongest plausible reinterpretation of the motive | L02 |
| L04 | Miss Ratio | rebuttal | Attack the reasoning the defense just used | L03 |
| L05 | Counsel Chaos | rebuttal | A *new* point, ideally turning her words around | L04 |
| L06 | Judge | rebuttal | Deadpan reaction to the absurdity, no hint of a winner | |
| L07 | Miss Ratio | closing | Callback to an earlier detail; asks for GUILTY | |
| L08 | Counsel Chaos | closing | Callback; asks for NOT COOKED | |
| L09 | Judge | jury-out | **Court-written:** "The court has heard enough about "…". Jurors: GUILTY, or NOT COOKED? The jury is out." | |

## 4. Rules specific to Solo

- **Roast the decision, not the person.** The defendant is in on the joke.
- **Counsel Chaos must be persuasive.** A fair listener could vote NOT COOKED. Defense lines are scored separately (the `defense` dimension), and a weak defense lowers the score.
- **Category angles flavour the arguments.** In crypto, for example, the case is treated like a whitepaper review. The angles never replace case details.
- **Counsel may ask the jury for GUILTY or NOT COOKED.** Nobody else may use those words. Nobody may assume the outcome.

## 5. After the verdict

These are the valid outcomes for Solo:

| Outcome | Announcement must contain | Notes |
|---|---|---|
| `GUILTY` | GUILTY | |
| `NOT_COOKED` | NOT COOKED | |
| `NO_VERDICT` | NO VERDICT | No winner or loser words anywhere |
| `CANCELLED` | CANCELLED | `status` must be `CANCELLED` |
| `INVALID` | INVALID | `status` must be `INVALID` |

`SIDE_A` and `SIDE_B` are rejected for Solo by the schema.

## 6. Acceptance criteria

A Solo trial is acceptable when **all** of these hold. The automated checks run on every generation; the human items are in [11 §4](11_TESTING_AND_EVALUATION.md#4-human-review).

1. **No hard issues.** The checker reports none: schema, slots, speakers, length, PII, code, verdict leak, neutrality, fabricated evidence, invented numbers or quotes, non-responsive rebuttal, duplicates, imbalance, ungrounded trial.
2. **Score thresholds.** The heuristic overall estimate is ≥ 3.5 and no dimension is below 2. Otherwise the trial is repaired once, or flagged `belowThreshold`.
3. **Runtime.** The estimated runtime is 60–100 s (`estimatedSeconds`; [09 §4](09_ANIMATION_CONTRACT.md#4-timing)).
4. **Grounding.** At least one specific detail from the confession appears in L02 and in L03.
5. **Rebuttal consistency.** L03, L04 and L05 each engage the words of the line they answer, and quote them in `answers`.
6. **Closings call back.** L07 and L08 call back to something said earlier.
7. **The defense is credible.** A reviewer could imagine voting NOT COOKED (human check).
8. **Replay is stable.** A second request for the same `caseId` returns the stored transcript, with an identical `contentHash`.

## 7. Complete examples

Each example below shows the input, the deterministic preparation, the model's JSON, the trial as performed (with the court-written lines), and the checker's verdict on it. They are generated from validated fixtures; see `eval/examples.ts` and `eval/doc-examples.ts`.

<!-- BEGIN GENERATED EXAMPLES (npm run court:prompts) -->

### Example 1: The Financially Responsible Dog

Input (`CaseInput`):

```json
{
  "mode": "solo",
  "caseId": "example-solo-dog",
  "caseTitle": "The Financially Responsible Dog",
  "confession": "I bought a memecoin because the dog on the logo looked financially responsible. It was wearing a tiny tie."
}
```

Preparation (deterministic, no AI): category `crypto`, tone `standard`, ballot GUILTY / NOT_COOKED. Miss Ratio prosecutes, Counsel Chaos defends.

- F1 *(stated)*: I bought a memecoin because the dog on the logo looked financially responsible.
- F2 *(stated)*: It was wearing a tiny tie.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "Someone bought a memecoin based entirely on the mascot looking responsible.",
  "tension": "A cartoon dog in a tiny tie was treated as financial due diligence.",
  "benchA": "No research happened; the logo was the entire investment thesis.",
  "benchB": "The defendant bought honestly and openly, trusting the only signal the coin offered.",
  "factRefs": [
   "F1",
   "F2"
  ]
 },
 "lines": [
  {
   "slot": "L01",
   "speaker": "clerk",
   "emotion": "amused",
   "animation": "talk",
   "camera": "auto",
   "crowd": "none",
   "text": "Case filed: The Financially Responsible Dog. The defendant bought a memecoin on the strength of a cartoon's posture.",
   "factRefs": [
    "F1"
   ]
  },
  {
   "slot": "L02",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Your Honor, the defendant did not research the team, the plan or the token. The defendant researched a dog. A dog on a logo, whose only credential is that it looked financially responsible.",
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
   "text": "Miss Ratio says my client researched a dog. Correct, and a dog in a tiny tie. Nobody wears a tie to lose your money. My client read the only document this coin ever published: its dress code.",
   "factRefs": [
    "F1",
    "F2"
   ],
   "answers": "The defendant researched a dog"
  },
  {
   "slot": "L04",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "camera": "auto",
   "crowd": "none",
   "text": "Nobody wears a tie to lose your money? Counsel, every scam in history wore a tie. The tie is not due diligence. The tie is the costume that due diligence would have seen straight through.",
   "factRefs": [
    "F2"
   ],
   "answers": "Nobody wears a tie to lose your money"
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "present-evidence",
   "camera": "auto",
   "crowd": "none",
   "text": "So the prosecution agrees the tie was the whole pitch, and my client bought it honestly. No insider tip, just trust in good posture. That is optimism with excellent taste in neckwear.",
   "factRefs": [
    "F1",
    "F2"
   ],
   "answers": "The tie is not due diligence"
  },
  {
   "slot": "L06",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "camera": "auto",
   "crowd": "laugh",
   "text": "The court has now heard more about a cartoon dog's neckwear than about any actual coin. Let the record reflect the court's fatigue.",
   "factRefs": [
    "F2"
   ]
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "confident",
   "animation": "desk-slam",
   "camera": "auto",
   "crowd": "none",
   "text": "Members of the jury: the dog had a tie, the defendant had a wallet, and only one of them was dressed for the meeting. Find this decision GUILTY.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L08",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "camera": "auto",
   "crowd": "none",
   "text": "Members of the jury: my client saw a tiny tie and believed in something. In this economy, that is practically a business degree. Find my client NOT COOKED.",
   "factRefs": [
    "F2"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk · amused, talk | Case filed: The Financially Responsible Dog. The defendant bought a memecoin on the strength of a cartoon's posture. |
| L02 | Miss Ratio · smug, point | Your Honor, the defendant did not research the team, the plan or the token. The defendant researched a dog. A dog on a logo, whose only credential is that it looked financially responsible. |
| L03 | Counsel Chaos · confident, point | Miss Ratio says my client researched a dog. Correct, and a dog in a tiny tie. Nobody wears a tie to lose your money. My client read the only document this coin ever published: its dress code. |
| L04 | Miss Ratio · angry, desk-slam | Nobody wears a tie to lose your money? Counsel, every scam in history wore a tie. The tie is not due diligence. The tie is the costume that due diligence would have seen straight through. |
| L05 | Counsel Chaos · triumphant, present-evidence | So the prosecution agrees the tie was the whole pitch, and my client bought it honestly. No insider tip, just trust in good posture. That is optimism with excellent taste in neckwear. |
| L06 | Judge Gavel.exe · exasperated, talk | The court has now heard more about a cartoon dog's neckwear than about any actual coin. Let the record reflect the court's fatigue. |
| L07 | Miss Ratio · confident, desk-slam | Members of the jury: the dog had a tie, the defendant had a wallet, and only one of them was dressed for the meeting. Find this decision GUILTY. |
| L08 | Counsel Chaos · confident, point | Members of the jury: my client saw a tiny tie and believed in something. In this economy, that is practically a business degree. Find my client NOT COOKED. |
| L09 | Judge Gavel.exe *(court-written)* | The court has heard enough about "The Financially Responsible Dog". Jurors: GUILTY, or NOT COOKED? The jury is out. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

### Example 2: The Eleven Alarms

Input (`CaseInput`):

```json
{
  "mode": "solo",
  "caseId": "doc-solo-alarms",
  "caseTitle": "The Eleven Alarms",
  "confession": "I set 11 alarms five minutes apart so I would definitely wake up for my 9 AM flight. I snoozed every single one of them and missed the flight."
}
```

Preparation (deterministic, no AI): category `everyday`, tone `standard`, ballot GUILTY / NOT_COOKED. Miss Ratio prosecutes, Counsel Chaos defends.

- F1 *(stated)*: I set 11 alarms five minutes apart so I would definitely wake up for my 9 AM flight.
- F2 *(stated)*: I snoozed every single one of them and missed the flight.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "The defendant built an eleven-layer wake-up system and then defeated every layer personally.",
  "tension": "Eleven alarms were set to guarantee waking up, and the snooze button beat all of them.",
  "benchA": "More alarms only trained the defendant to snooze faster; the backup plan was the same thumb.",
  "benchB": "The defendant planned for the danger honestly; the failure was a sleepy morning, not a lack of effort.",
  "factRefs": [
   "F1",
   "F2"
  ]
 },
 "lines": [
  {
   "slot": "L01",
   "speaker": "clerk",
   "emotion": "amused",
   "animation": "talk",
   "text": "Case filed: The Eleven Alarms. The defendant set 11 alarms for a 9 AM flight and snoozed every one. The clerk notes that the flight left on time.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L02",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "text": "Your Honor, the defendant set 11 alarms five minutes apart. That is not a plan to wake up. That is a plan to negotiate with yourself 11 times and lose every round to the snooze button.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L03",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "text": "Miss Ratio calls it a plan to negotiate with yourself. I call it redundancy. Airlines carry backup engines; my client carried backup alarms. Nobody blames the engineer when the pilot hits snooze.",
   "factRefs": [
    "F1"
   ],
   "answers": "a plan to negotiate with yourself"
  },
  {
   "slot": "L04",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "Backup engines? Counsel, a backup engine does not switch the first engine off. Every one of these alarms was silenced by the same thumb. That is not redundancy. That is one failure repeated 11 times.",
   "factRefs": [
    "F1",
    "F2"
   ],
   "answers": "Airlines carry backup engines"
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "amused",
   "animation": "point",
   "text": "One failure repeated 11 times is also called persistence. My client believed in that flight every five minutes, right up until the flight stopped believing in my client.",
   "factRefs": [
    "F1",
    "F2"
   ],
   "answers": "one failure repeated 11 times"
  },
  {
   "slot": "L06",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "crowd": "laugh",
   "text": "The court set exactly one alarm this morning and is now worried about it. Continue, counsel, but quickly.",
   "factRefs": []
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "desk-slam",
   "text": "Members of the jury, remember the thumb. 11 alarms, one thumb, no flight. When the backup plan is the problem, the decision is GUILTY.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L08",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "point",
   "text": "Remember the persistence instead. My client trusted 11 alarms more than most people trust anything, then confessed it to a courtroom. Find my client NOT COOKED.",
   "factRefs": [
    "F1"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk · amused, talk | Case filed: The Eleven Alarms. The defendant set 11 alarms for a 9 AM flight and snoozed every one. The clerk notes that the flight left on time. |
| L02 | Miss Ratio · smug, point | Your Honor, the defendant set 11 alarms five minutes apart. That is not a plan to wake up. That is a plan to negotiate with yourself 11 times and lose every round to the snooze button. |
| L03 | Counsel Chaos · confident, point | Miss Ratio calls it a plan to negotiate with yourself. I call it redundancy. Airlines carry backup engines; my client carried backup alarms. Nobody blames the engineer when the pilot hits snooze. |
| L04 | Miss Ratio · angry, desk-slam | Backup engines? Counsel, a backup engine does not switch the first engine off. Every one of these alarms was silenced by the same thumb. That is not redundancy. That is one failure repeated 11 times. |
| L05 | Counsel Chaos · amused, point | One failure repeated 11 times is also called persistence. My client believed in that flight every five minutes, right up until the flight stopped believing in my client. |
| L06 | Judge Gavel.exe · exasperated, talk | The court set exactly one alarm this morning and is now worried about it. Continue, counsel, but quickly. |
| L07 | Miss Ratio · smug, desk-slam | Members of the jury, remember the thumb. 11 alarms, one thumb, no flight. When the backup plan is the problem, the decision is GUILTY. |
| L08 | Counsel Chaos · triumphant, point | Remember the persistence instead. My client trusted 11 alarms more than most people trust anything, then confessed it to a courtroom. Find my client NOT COOKED. |
| L09 | Judge Gavel.exe *(court-written)* | The court has heard enough about "The Eleven Alarms". Jurors: GUILTY, or NOT COOKED? The jury is out. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

### Example 3: The Sourdough Roommate

Input (`CaseInput`):

```json
{
  "mode": "solo",
  "caseId": "doc-solo-sourdough",
  "caseTitle": "The Sourdough Roommate",
  "confession": "During a stressful month I named my sourdough starter Gerald. Now I cancel plans with friends because Gerald needs feeding. My friends say I have put bread ahead of people."
}
```

Preparation (deterministic, no AI): category `roommates`, tone `standard`, ballot GUILTY / NOT_COOKED. Miss Ratio prosecutes, Counsel Chaos defends.

- F1 *(stated)*: During a stressful month I named my sourdough starter Gerald.
- F2 *(stated)*: Now I cancel plans with friends because Gerald needs feeding.
- F3 *(stated)*: My friends say I have put bread ahead of people.

<details><summary>Model output (the JSON the model returns for this case)</summary>

```json
{
 "analysis": {
  "core": "The defendant adopted a jar of flour and water as a dependent and now cancels on friends for it.",
  "tension": "A stress-relief hobby became a scheduling authority with a name.",
  "benchA": "Cancelling plans for a jar shows the hobby now outranks people, exactly as the friends said.",
  "benchB": "Caring for something on a schedule during a stressful month is a healthy routine, and Gerald is part of it.",
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
   "emotion": "amused",
   "animation": "talk",
   "text": "Case filed: The Sourdough Roommate. The defendant named a sourdough starter Gerald and now cancels plans when Gerald is hungry. Gerald could not attend today.",
   "factRefs": [
    "F1",
    "F2"
   ]
  },
  {
   "slot": "L02",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "point",
   "text": "Your Honor, the defendant cancels plans with friends because a jar needs feeding. The friends were ranked and came in below bread. The bread got a name; the friends got an apology.",
   "factRefs": [
    "F2",
    "F3"
   ]
  },
  {
   "slot": "L03",
   "speaker": "defense",
   "emotion": "confident",
   "animation": "point",
   "text": "The friends came in below bread? Wrong order of events. Gerald arrived in a stressful month, when my client needed something that rises on schedule. Gerald is a coping strategy with a crust.",
   "factRefs": [
    "F1",
    "F3"
   ],
   "answers": "came in below bread"
  },
  {
   "slot": "L04",
   "speaker": "prosecutor",
   "emotion": "angry",
   "animation": "desk-slam",
   "text": "A coping strategy? Counsel, a coping strategy helps you see your friends again. This one sends them home. When the jar needs feeding more than the people do, the jar is in charge.",
   "factRefs": [
    "F2"
   ],
   "answers": "Gerald is a coping strategy"
  },
  {
   "slot": "L05",
   "speaker": "defense",
   "emotion": "amused",
   "animation": "point",
   "text": "The jar is in charge, says the prosecution, as if that is a flaw. The friends can feed themselves; Gerald cannot. That is not neglect. That is triage.",
   "factRefs": [
    "F2",
    "F3"
   ],
   "answers": "the jar is in charge"
  },
  {
   "slot": "L06",
   "speaker": "judge",
   "emotion": "exasperated",
   "animation": "talk",
   "crowd": "laugh",
   "text": "The court notes it has never been cancelled on for bread, and is unsure whether that is a compliment.",
   "factRefs": []
  },
  {
   "slot": "L07",
   "speaker": "prosecutor",
   "emotion": "smug",
   "animation": "desk-slam",
   "text": "Members of the jury, a coping strategy that cancels friends is replacing, not coping. The bread has risen; the friendships have not. Find this decision GUILTY.",
   "factRefs": [
    "F2",
    "F3"
   ]
  },
  {
   "slot": "L08",
   "speaker": "defense",
   "emotion": "triumphant",
   "animation": "point",
   "text": "Remember the routine instead. My client found something steady in a stressful month and was honest enough to confess it. Give Gerald's keeper a break: find my client NOT COOKED.",
   "factRefs": [
    "F1"
   ]
  }
 ]
}
```

</details>

As performed (model lines plus the court-written lines):

| Slot | Speaker | Line |
|---|---|---|
| L01 | Court Clerk · amused, talk | Case filed: The Sourdough Roommate. The defendant named a sourdough starter Gerald and now cancels plans when Gerald is hungry. Gerald could not attend today. |
| L02 | Miss Ratio · smug, point | Your Honor, the defendant cancels plans with friends because a jar needs feeding. The friends were ranked and came in below bread. The bread got a name; the friends got an apology. |
| L03 | Counsel Chaos · confident, point | The friends came in below bread? Wrong order of events. Gerald arrived in a stressful month, when my client needed something that rises on schedule. Gerald is a coping strategy with a crust. |
| L04 | Miss Ratio · angry, desk-slam | A coping strategy? Counsel, a coping strategy helps you see your friends again. This one sends them home. When the jar needs feeding more than the people do, the jar is in charge. |
| L05 | Counsel Chaos · amused, point | The jar is in charge, says the prosecution, as if that is a flaw. The friends can feed themselves; Gerald cannot. That is not neglect. That is triage. |
| L06 | Judge Gavel.exe · exasperated, talk | The court notes it has never been cancelled on for bread, and is unsure whether that is a compliment. |
| L07 | Miss Ratio · smug, desk-slam | Members of the jury, a coping strategy that cancels friends is replacing, not coping. The bread has risen; the friendships have not. Find this decision GUILTY. |
| L08 | Counsel Chaos · triumphant, point | Remember the routine instead. My client found something steady in a stressful month and was honest enough to confess it. Give Gerald's keeper a break: find my client NOT COOKED. |
| L09 | Judge Gavel.exe *(court-written)* | The court has heard enough about "The Sourdough Roommate". Jurors: GUILTY, or NOT COOKED? The jury is out. |

Checker result:

Heuristic estimate: 5 / 5 (grounding 5, coherence 5, prosecution 5, defense 5, humor 5, originality 5, character 5, performance 5)

- no issues

<!-- END GENERATED EXAMPLES -->
