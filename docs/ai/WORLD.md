# World

How the AI courtroom world is built, who stands in it, and how a 0G script becomes a performance. Source: `docs/ai` [01](01_AI_COURTROOM_VISION.md) through [06](06_COMEDY_AND_NARRATIVE_DESIGN.md) and [09](09_ANIMATION_CONTRACT.md). This is the trial world, not the roam plaza.

## The world in one pass

A player or a curator supplies a case. The app picks the mode. Preparation turns that case into numbered facts and a tone, with no model call. One open model on the 0G Compute Router then writes the dialogue for four fixed characters. The existing three.js stage performs the lines. Humans vote. Only after that vote is final does the judge speak the result, in a second short call or a template if the call fails.

The world is a pixel-art courtroom. The model chooses named shots and beats. Positions, rigs, sound files and timing stay with the game.

## Three rooms, one cast

| | Solo | Versus | Viral |
|---|---|---|---|
| Who files | One player confesses a decision | Two people, each in their own words | Curators approve a public question (`approved` must be true) |
| Ballot | GUILTY or NOT COOKED | SIDE A or SIDE B | SIDE A or SIDE B, decided outside the model |
| What is argued | The decision, not the person | The dispute. Agreed facts are the only facts stated as true | The approved question, shown verbatim |
| Length | 60–100 s, 9 slots | 70–110 s, 11 slots | 70–110 s, 11 slots |
| Staging | Judge, both desks, bailiff, clerk, three jurors, creator at the witness mark | Grand-jury staging: seven jurors, plus the narrator | Same grand-jury staging |

Miss Ratio stands at the prosecution desk and Counsel Chaos at the defense desk. They do not swap places. In Versus and Viral a keccak coin flip on the case id decides which character argues which side, and that assignment is stable for the case. The camera follows the advocate. The side they argue is in the dialogue and the `bench` field.

Viral never resolves a listed uncertainty, never invents a source, and never mentions bets, odds, stakes or payouts. Price questions, “who will win”, and elections are refused before any compute is spent.

## The four people the model may speak as

| Character | Engine id | Job in the room |
|---|---|---|
| Miss Ratio | `prosecutor` | Notices a specific detail and turns it into a pattern. Sarcastic, precise, mock-grave. “Bro is cooked” at most once |
| Counsel Chaos | `defense` | Reframes the same facts so a fair listener could side with him. He answers her words. He is never a straw man |
| Judge Gavel.exe | `judge` | Short deadpan lines. He reacts to the absurdity and does not hint at a winner. After the result exists, he announces that exact phrase |
| Court Clerk | `clerk` | One or two plain sentences that name the case. In Viral the clerk’s lines are templates, including the question |

Any other speaker is rejected. If a cast has no clerk actor, the Director falls back to the narrator, then the judge. The clerk currently uses the narrator voice.

## The shape of a hearing

The plan fixes the structure. The model only writes the jokes and the arguments.

1. **Call to order.** The clerk names the case. Solo adds one light observation. Viral states the approved question exactly.
2. **Openings.** Each side’s strongest claim, built on a concrete fact.
3. **Exchanges.** Every rebuttal answers a named earlier line and quotes 3–12 words from it. A reply that shares no content words with its target is a hard failure.
4. **The judge.** One deadpan beat. No winner language.
5. **Closings.** Each side calls back to a phrase from this trial and asks for its ballot. In Viral the judge closes with one fair sentence per side and declares nothing.
6. **Jury out.** Court-written. The model does not invite the vote.

Counsel lines run 70–300 characters. Judge and clerk lines run 25–220, with the Viral judge allowed 260. The read-aloud model is 15 characters per second plus 0.6 seconds per line. That same pace is what the Director should use, or a long line gets crushed into 7 seconds.

Comedy is supposed to come from the case itself: specificity, taking a bad reason one step too far, courtroom language on a trivial subject, and a callback. Category labels (crypto as a whitepaper review, dating as a diplomatic incident, food as a health inspection) are flavour. They do not replace the facts. Gentle tone, used for grief, health, break-ups, job loss or insults in the input, keeps the jokes on the situation. Insults in the output then fail the check.

## Facts the room is allowed to know

Preparation numbers every usable sentence.

| Mode | Fact status | How the room may use it |
|---|---|---|
| Solo | `stated` from the confession, `context` from the optional background | Quote it. Do not add receipts, screenshots or witnesses |
| Versus | `agreed`, then `claimed-by-a`, then `claimed-by-b` | Only agreed facts are stated as true. Claims are attributed |
| Viral | `background`, `position-a`, `position-b`, `sourced-fact`, `sourced-opinion` | Opinions stay opinions. Unknowns stay open. No source outside the curator’s list |

Wallets, emails, phones, links and handles are redacted before the prompt. The model is not a path for personal data into the world, and it is not a path for a verdict into the chain. See [CONTRACTS](CONTRACTS.md) for that wall and [OG-ARC](OG-ARC.md) for the compute that writes the lines.

## What the stage still owes

The transcript can already be turned into a show with `directTrial` and `courtCast`. These pieces are still on the game side:

- Map `emotion` onto a face or a pose. The field is stored and ignored.
- Give the clerk a voice of their own.
- Fetch the stored transcript in the app and hand it to `ShowPlayer`.
- Put the platform’s moderation in front of `prepareCase`. The keyword screen is a backstop, not a moderator.

The renderer is the existing three.js `ScenePort`. This layer does not depend on Phaser, and it does not choose where the camera rig sits. It only names the shot.
