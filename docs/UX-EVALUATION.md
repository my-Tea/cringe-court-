# CringeCourt: playtest and UX evaluation

Playtest track, 2026-11-04. Written for the product owner.

**What was played.** The production build of `main` at `e2dc50a`, served with `vite preview` and driven in headless Chrome by Playwright (`apps/web/e2e/playtest/`, run with `npm run playtest -w @cringe-court/web`). Every scenario ran at 1280×800. Each mode also ran at 390×844 with touch emulation and once with `prefers-reduced-motion: reduce`. One Solo pass and one roam pass ran with WebGL disabled. I looked at the screenshots myself. This report is based on those images and on the measured timings, not only on whether the scripts passed.

**Where the evidence is.** Everything is under `~/cringe-court-v3/screenshots/playtest/`:

- `<scenario>/<variant>/NN-step.png`: one screenshot per step.
- `frames-*/` and `sheet-*.png`: frame sequences of 8–12 frames at 250 ms (1000 ms for the jury), each with a contact sheet.
- `timings.csv`: every run, including the failed ones.
- `console-and-network.log`, plus an `issues.txt` per variant.

Paths below are relative to that folder.

**What I could not do.** I did not hear any sound. Headless Chrome has no audio output that I can listen to. I did not see a real GPU: WebGL ran on SwiftShader, Chrome's software renderer, so no frame rate here says anything about real hardware. Real 0G, Arc and World ID are not used in any flow you can play. Every mode runs on its in-browser twin: a memory chain, scripted counsel and a mock verifier.

**Test environment caveat.** The test box is shared and was unreliable in two ways:

- **Wall-clock jumps.** The system clock jumped forward several times, by 446 s, 1166 s, 2790 s, 3252 s and 3549 s. Processes also froze for 7–124 s at a time. The harness now measures with the monotonic clock, logs both effects and excludes them from the timings. They still affected the app itself, because the demo deadlines read `Date.now`. One Versus invite expired while it was open on screen, and one Versus run became a mistrial.
- **Slow first person.** Under SwiftShader, one screenshot of the first-person view took 5–15 s. So `frame_sequence` durations for roam views are capture cost, not UX time.
- **Flaky WebGL2.** Late in the session WebGL2 also became unavailable at random. The last two Grand Jury runs fell back to the classic stage on their own.

---

## 1. How it works end to end (as actually experienced)

**Lobby (`/court`).** Three paper cards: Solo (1.20 USDC), Versus (1.40 for both sides), Grand Jury (7.30 crowdfund). There is a "Your cases" row and a "New here?" panel. It is clear, warm and readable. It took 0.8–1.0 s to become interactive in every run (`01-lobby.png`).

**Mode 1 Solo (`/solo`).**

1. A five-step wizard: Confess, Brief your lawyer, Counsel drafts, Review the script, Pay & open.
   - **Confess:** pick a crime category, then a title and a story. The private notes and the names to hide are optional.
   - **Brief your lawyer:** the public record after redaction, an optional evidence locker, and "Ask Counsel Chaos for angles". Three angles come back in about 1.5 s; you can also write your own.
   - **Counsel drafts:** takes about 1.5–2.3 s.
   - **Review the script:** a fairness meter plus the full scripted transcript, with Freeze, Redraft (once) or Withdraw.
   - **Pay & open:** pay 1.20 from a demo wallet.
2. The trial opens in the first-person courtroom. You are seated at the defendant's table and four beats play: All rise, Opening statements, Counsel arguing, Jury deliberating. There is a toggle to the classic stage and a "Skip to the jury" button.
3. The NPC jury box: three named NPCs seat themselves, seal their scrolls and open them. Each one gets a speech bubble. With normal pacing this takes about 18–20 s on desktop.
4. The verdict page:
   - a GUILTY or NOT COOKED stamp and the vote count;
   - Judge Gavel.exe's sentence and the three jurors' lines;
   - "Where your payment went" and "What the court kept" (D13);
   - a share card in landscape or square, with Download PNG, Copy caption and Post on X.
5. The docket lists decided cases.

Outcomes I got: GUILTY (`solo/desktop-B`, `solo/mobile`) and NOT COOKED (`solo/desktop-C`, `solo/reduced-motion`, `solo/no-webgl-classic`). **NO VERDICT could not be reached** (bug B1): the full-refund screen is in the code but no play path reaches it.

**Mode 2 Versus (`/versus`).**

1. Side A starts a case: a title and a category, then a private chat briefing with "Agent A" (what happened, why you're right, private notes, one angle). A review screen shows "What the jury will read" (redacted: the phone number became `[number removed]`) next to "Only Agent A sees". Then "File & get invite" with a mock World ID dialog, and you get an invite code and link.
2. Side B opens the link and gets "You have been summoned". They accept as Side B, verify with World ID, do the same private briefing and approve it.
3. Both sides approve their brief. The agents draft in about 2 s, both approve the draft, and each side pays 0.70.
4. The case goes to jury selection. A juror tab posts a 0.40 bond with World ID. The demo "Seat simulated jurors" control fills the other seats.
5. The juror watches the hearing (first person) and seals a Secret Verdict Scroll. "Skip to the deadline" moves things on, the juror opens the scroll, and the verdict appears.
   - I played a normal verdict (SIDE B WINS 2–1).
   - I played a MISTRIAL with full refunds, using the two-no-show plan.
   - I played a case where B never answers, which ends in CASE DISMISSED with nothing charged.
6. Claims: the juror can claim the bond plus the reward. In a mistrial both sides can claim 0.70.

**The big limitation is one browser only.** Every Versus case lives in this browser's `localStorage`. When B opened the invite in a separate browser context (a different person's browser), the result was "No case with that code here" (`versus/*/07-B-other-browser-opens-invite.png`). The app states this honestly. But it means two real people on two devices cannot play Mode 2 today. The flow is played with tabs of one browser, each tab acting as a demo persona.

**Mode 3 Grand Jury (`/grand-jury/docket`).**

1. A public docket with 8 seeded cases: a "Happening now" case, filters (All 8, Open to join 3, In session 1, Decided 4), topic chips, and search that keeps its state in the URL (`?q=pizza`).
2. Summoning means chipping into a case that is still raising its 7.30 target (1.00 in my run). You see "You have chipped in".
3. On a case that is seating jurors:
   1. Volunteer for the jury.
   2. Juror Screening with mock World ID.
   3. "A seat is offered to you".
   4. "I swear to show up" posts the bond.
   5. The hearing plays (first person) next to "Seal your ballot". Six simulated jurors have usually sealed by then ("6 of 7 ballots sealed").
4. Seal your ballot, skip to the deadline, open your scroll ("Your vote is counted"), skip again, then "Settle and read the verdict". The verdict reads "4 of 7 strangers agreed: PINEAPPLE BELONGS 4–3", followed by a jury duty receipt, "Collect 2.10 USDC", the gallery's 48/52 split and the share card.
5. "My court" lists your seats; "Who pays" explains the pricing.

The other six jurors and the crowd are simulated by the demo ledger twin. **There are not 7 humans in 7 browsers.** The court is in memory per tab: a second browser context showed `0.60 / 7.30` raised where my tab showed `1.60 / 7.30`, and it did not say "You have chipped in" (`grand-jury/desktop/08-other-browser-same-case.png`). Settlement is permissionless, and the simulated bailiff sometimes settles before you can press the button. That is fine, and arguably good.

**First-person roam (`/court/walk` and inside every trial).**

- **Walking:** WASD and the arrow keys walk, the mouse or arrows look, E interacts, Esc pauses. Walking forward from the lobby crosses into "Well of the court" in under 3 s. Walking into the bench stops cleanly (3% view change between the last frames), and backing out works with no stuck states. "Approach the bench" makes the judge speak.
- **Beats:** All five beats play with dialogue and camera work. The verdict beat ends with a "GUILTY OF CRINGE" stamp.
- **Touch:** on a phone, a drag-to-walk joystick works; I walked from the lobby to the well with real touch events.
- **Fallbacks:** "Skip to menu view" works. With no WebGL, trial pages fall back to the classic stage cleanly, but `/court/walk` crashes (bug B7).

## 2. First-time-player walkthrough per mode: what you'd feel

**Solo.**

1. The lobby feels inviting. The papercraft chrome is the best-looking part of the product.
2. The Solo landing explains the numbers before you pay. That is reassuring.
3. If you hit "File the confession" with nothing filled in, you get a friendly error list. The category examples are funny ("you too" to the waiter).
4. "Brief your lawyer" is the first moment of delight: three generated angles that actually riff on what you wrote.
5. **Confusing:** "It is the only steer your lawyer gets (D2)". A player will not know what D2 means.
6. "Review the script" is long but fun to read, and the fairness meter builds trust.
7. You pay and then land in a **3D courtroom looking up at the rafters**, with a "Step into the courtroom" modal in the middle and a large Controls panel on the right (`solo/desktop-B/10-trial-start-roam.png`).
   - If you just want to watch, you never dismiss the modal. **It stays over the whole hearing for about three minutes** (`solo/desktop-A/12-trial-watch-2.png`). The dialogue box is visible below it but dimmed.
   - A first-timer would either click "Skip to the jury" or feel lost.
8. The jury box is cute and quick (about 20 s): speech bubbles, then SEALED and OPEN.
9. The verdict stamp page is satisfying and clear, and the money breakdown is excellent.
10. The share card is genuinely shareable. This is the hook.

**Versus.**

1. "Settle it in court" is a strong headline. The chat-style briefing is friendly. The review page ("What the jury will read" next to "Only Agent A sees") is the clearest privacy UI in the app.
2. Then you hit the wall: **the invite does not work for your friend on their own phone**. If you follow the in-app hint ("open the invite in a new tab"), playing both sides yourself is fun once, but it is not the product.
3. The case room (rail, stepper, "Your move", activity log) is well organised.
4. **As a juror** you are put "at the Defendant's table". The Secret Verdict Scroll sits below the hearing, and the 3-minute demo commit window starts as you are seated. In one run, a juror who watched the hearing missed the window: "You missed the commit window… Your bond will be forfeited" (`versus/desktop-juror-watched-trial-missed-window/18-J-trial-later.png`). That feels like being punished for paying attention.
5. The verdict screens (SIDE B WINS, MISTRIAL · FULL REFUND, CASE DISMISSED · NOTHING CHARGED) are the strongest result screens in the app.

**Grand Jury.**

1. The docket is a great front page: a "Happening now" case, live countdowns, progress bars and verdict stamps on decided cases. Filters and search feel solid.
2. Chipping in is instant and rewarding (you appear in the summoners list).
3. Jury duty takes four clicks to get seated and is easy to follow.
4. During the hearing, the first-person view sits in a narrow column. It still shows the modal and the legend, and the HUD says "Defendant's table" although you are a juror.
5. **The worst moment:** you press "Settle and read the verdict", and nothing visible happens. The verdict is drawn 1,499 px above where you are looking (`grand-jury/desktop/sheet-verdict-reveal.png`: twelve frames of the transcript). You have to scroll up to find out who won.
6. Once you find it, the verdict panel, the receipt and the gallery comparison are lovely.

**Roam (as a toy).** Walking around is charming for a minute. The voxel cast is cute, the stained glass is nice, and the judge's sunglasses line lands. But beats are mostly the camera looking at people while text plays. Without the onboarding modal fixed, the first-person view gets in the way more than it adds to the trial. Honestly, the classic stage (`solo/no-webgl-classic/10-trial-start-classic.png`) is more legible and more charming than the first-person hearing at 1280×800.

## 3. Pacing and wait times (from `timings.csv`)

**Solo**

| Moment | Measured |
|---|---|
| Lobby interactive | 0.80–0.99 s in 13 runs |
| Each wizard step after a click | 0.09–0.95 s |
| Angles from Counsel Chaos | 1.37–1.77 s |
| Counsel drafting | 1.36–2.31 s |
| Pay → trial visible | 1.4–5.5 s (roam chunk + 3D world build) |
| Watching the whole hearing, first person | **174 s** (`solo/desktop-A`, SwiftShader) |
| Watching the whole hearing, classic stage | **55 s** (auto-advancing) |
| Jury box → verdict (NPCs, normal pacing) | 18–21 s desktop; 46 s on mobile emulation |
| Verdict reveal | Stamp already settled in the first captured frame (no visible motion over 3 s) |
| Docket | 0.6–1.1 s |

**Versus**

| Moment | Measured |
|---|---|
| Landing interactive | 0.85–0.88 s |
| Angles | 1.4–2.2 s |
| Verify & file → invite | 0.22–0.60 s |
| B's summons interactive | 0.77–0.95 s |
| Agents drafting | 1.5–2.4 s |
| Demo commit window | **180 s** (`VERSUS_DEMO_DEADLINES.commit`) |
| Commit time left after a short look at the hearing | 1:26–2:02 |
| Reveal → verdict | 8–13 s |

**Grand Jury**

| Moment | Measured |
|---|---|
| Docket interactive | 0.88–0.96 s |
| Chip-in confirmed | 0.02–2.2 s |
| World ID → seat offer | 0.06–3.7 s |
| Bond → ballot | 0.02–7.8 s |
| Settle → verdict text | 6.4–6.5 s |
| Demo windows | 4 min commit, 3 min reveal |

**Roam**

| Moment | Measured |
|---|---|
| Canvas ready on `/court/walk` | 1.7–2.5 s |
| Each beat with no input | 15–23 s (frame capture included) |
| Whole hearing | 2.5–3 minutes |

**Takeaways.**

- Everything that is not 3D is fast: almost every screen is under 1 s.
- The two pacing problems are both about the hearing:
  1. At about 3 minutes in first person (versus 55 s classic), the hearing is too long for a joke format.
  2. The hearing is longer than or equal to the Versus commit window.
- A human typing a real confession would spend about 2–4 minutes in the wizard. That is fine.

## 4. Clarity: confusing copy, labels and flows

1. **Internal decision IDs leak into player copy:** "(D2)" on the angle step, "Fairness gate (D1)", "Disclosed on every case (D13)", "No real names (D5)", "absorbed the AI intake (D6)", "Demo controls (D14)". A player cannot decode them. Remove them.
2. **The Versus invite looks shareable but only works in the same browser.** The fine print explains it, but "Copy invite link" and "Share…" invite the wrong action.
3. **Mistrial copy contradicts itself.** The header says "Verdict is in. Claim your payout." and the eyebrow says "THE JURY HAS SPOKEN" over a MISTRIAL stamp. The judge says "The jury could not agree" when the real cause was two no-shows (`versus/desktop-mistrial/22-A-verdict.png`).
4. **The redaction note contradicts itself.** The review screen says "Redaction pass: Removed 1 phone number". The same brief in the case room says "Redaction pass: Nothing needed removing" (`versus/desktop/04` vs `11`).
5. **A closed invite page still shouts "You have been summoned"** above "This invite is closed" or "No case with that code here" (`versus/desktop/07`).
6. **Grand Jury:** "7.30 USDC summons a court (about 14.6 people at 0.50)". Fractional people.
7. **Grand Jury topics reuse Solo's crime categories.** "Does pineapple belong on pizza?" is filed under "NPC Behavior", and most cases are "Internet Crimes".
8. **The roam onboarding asks for a choice before you can watch** ("Click to look around" or "Use keyboard only"). It is the wrong question during a hearing, where the player wants to watch.
9. **The ModePage notice is generic.** Solo and Grand Jury share one "Testnet demo court" notice that says "NPC jurors stand in for World ID–verified humans". That is wrong for Grand Jury, where you are a juror verified by the mock World ID and the others are simulated. Versus has its own correct notice. (From reading `apps/web/src/pages/ModePage.tsx:110-120`; not screenshotted.)
10. **The Solo landing lists deadlines of "30 min jury · 20 min seal · 10 min reveal".** The demo jury uses 5/15/5. The jury stage says so, but the landing does not.

## 5. Moments that feel good

- **The papercraft 2D chrome.** The lobby, wizard, docket and verdict pages look designed and consistent (`solo/desktop-B/01-lobby.png`, `grand-jury/desktop/01-docket.png`).
- **The verdict stamps and result pages in all three modes.** GUILTY, SIDE B WINS, MISTRIAL · FULL REFUND and CASE DISMISSED · NOTHING CHARGED are funny, clear and honest about the money.
- **Money transparency.** "Where your payment went", "What the court kept" and the settlement receipts make the revenue model legible to a player. This is rare and good.
- **The share cards** (Solo landscape and square, Versus, Grand Jury). This is the most viral asset in the product.
- **Counsel Chaos angles and the scripted transcript.** These are really funny ("If cringe were a crime, everyone in this room would be serving life").
- **The Grand Jury docket and the gallery's split** ("THE GALLERY SAYS… 48% / 52%").
- **The Solo NPC jurors' one-liners** ("Bro is cooked. Log off.").
- **Roam walking.** It does not get stuck, and collisions are clean. The touch joystick actually works on phone emulation.
- **Reduced motion is respected.** The Solo jury goes straight to fast pacing and the flows complete identically.

## 6. Moments that feel bad

- **The first-person hearing.** For about 3 minutes you look past a modal and a controls panel, with the camera often pointed at rafters or the backs of heads (`solo/desktop-B/10`, `solo/desktop-A/12`). On mobile, the dialogue box, joystick, pause, hop and interact buttons cover nearly the whole small canvas (`versus/mobile/17-J-trial-roam.png`).
- **Being punished for watching.** As a Versus juror, the commit window can close during the hearing.
- **The Grand Jury verdict happens off-screen.**
- **Versus "invite your friend" turns out to mean "open another tab yourself".**
- **The Solo "jury hit a snag" loop.** If the seal deadline passes (a laptop sleeping or a tab in the background long enough), Resume never works (B1).
- **Everyone is "at the Defendant's table".** That includes jurors and the Grand Jury.

## 7. Sound and animation quality

- **Sound: not judged.** I could not hear anything. Here is what I verified:
  - The header sound button, the per-mode Sound toggles, and the Sound row in the Versus persona bar render.
  - Case-state cues are wired in the code (`caseSound` calls on seat, seal, open and verdict).
  - Nothing crashed with autoplay allowed.

  Volume, mix, timing against the visuals, and whether it is fun are all untested. A person must listen.
- **Frame rate: not judged.** SwiftShader only. Roam auto-lowered its quality to "Low" ("Quality lowered to low to keep the frame rate up", `roam/desktop` pause menu). That is a software-rendering effect, not evidence about real GPUs.
- **2D animation.** By the time the first frame was captured, the Solo and Versus verdict stamps had already landed. Over 3 s (12 frames) nothing moved, so the reveal is either very fast or happens before the panel is visible. Either way, there is no "drumroll" moment.
  - The Solo jury box animates step by step (seat, SEALED, OPEN, bubbles) and reads well (`solo/desktop-B/sheet-jury.png`).
  - The Grand Jury verdict reveal could not be seen at all, because it is off-screen.
- **Roam animation.**
  - The NPCs are rigged voxel figures. They read well in the jury box and at the bench.
  - The verdict beat's "GUILTY OF CRINGE" impact text is good.
  - Cinematic framing is weak. "All rise" opens looking up into the rafters.
  - Some lines from one beat still show at the start of the next.
  - Camera comfort: no nausea triggers were visible (no head-bob was seen with reduced motion on), but I cannot judge motion comfort from stills.

## 8. Bugs found

Severity: **blocker** (stops a core flow), **major** (hurts a core experience), **minor**.

| # | Severity | Bug | Repro | Evidence | Suspected file |
|---|---|---|---|---|---|
| B1 | **major** | Solo NO VERDICT is unreachable, and the jury loops on an error after a deadline: "The jury hit a snag" with technical details "Case 69 is in reveal, not commit". "Resume the jury" fails every time, so the full-refund screen is never shown. | Pay a Solo case, then pause the jury when it appears (1 of 3 sealed). Advance the clock 16 min (sleep the laptop, or Playwright `clock.fastForward`), then press Resume. | `solo/desktop-noverdict/13-…`, `14-jury-snag-details.png`, `15-jury-snag-after-retry.png` | `apps/web/src/modes/solo/court/useJuryDirector.ts`; `packages/modes-solo/src/session.ts` (`commitBallot`/`closeCommit`/`#passDeadline` do not reconcile with a ledger that has already advanced) |
| B2 | **major** | A Versus human juror can miss the 3-min demo commit window while watching the hearing, and forfeits the bond. The first-person hearing lasts about 2.5–3 min, and the ballot is below it with no warning in the HUD. | Seat yourself plus the simulated jurors, then watch the first-person hearing without voting. | `versus/desktop-juror-watched-trial-missed-window/18-J-trial-later.png` (this run's frame capture was slow; the window maths stands on its own: 180 s window vs 174 s hearing) | `packages/modes-versus/src/definition.ts` (`VERSUS_DEMO_DEADLINES.commit`); `apps/web/src/modes/versus/components/JuryPanels.tsx` |
| B3 | **major** | After "Settle and read the verdict", the Grand Jury verdict renders 1,499 px above the viewport, so nothing seems to happen. | Play a Grand Jury seat to settlement, then click Settle. | `grand-jury/desktop/sheet-verdict-reveal.png`, timings `verdict_position_after_settle` | `apps/web/src/modes/grand-jury/pages/CasePage.tsx` (no scroll or focus to the verdict) |
| B4 | **major** | The roam "Step into the courtroom" overlay and the Controls legend stay over the entire hearing for a player who just watches. The legend opens by default on every non-touch width, 1280 included. | Open any trial in first person and don't click. | `solo/desktop-A/11…13-trial-watch-*.png`, `solo/desktop-B/sheet-trial-roam.png`, `roam/narrow-760/01-…png` | `packages/scene/src/roam/react/RoamCourtroom.tsx` (legend `useState(() => !isTouch)` line 104; capture overlay at about line 245) |
| B5 | **major** | Mobile first-person trial: the dialogue box plus the touch controls cover about 80% of the canvas, and the trial toolbar is clipped ("REPLAY HEARING" cut off, Full screen off the edge). | 390×844 with touch, any trial. | `versus/mobile/17-J-trial-roam.png`, `solo/mobile/10-trial-start-roam.png` | `packages/scene/src/roam/react/styles.ts`, `TouchControls.tsx`; `apps/web/src/trial/Trial.module.css` |
| B6 | **major** | Roam seats every role at the defendant's table during the hearing, including Versus jurors and Grand Jury jurors and spectators (HUD: "Defendant's table"). | Join as a juror and watch the hearing. | `versus/mobile/17-J-trial-roam.png`, `grand-jury/mobile/12-hearing-juror-roam.png` | `packages/scene/src/roam` beat runner (seat target; the walk sandbox says "Each beat seats you at the defendant's table"); `apps/web/src/trial/RoamTrial.tsx` |
| B7 | **major** | `/court/walk` without WebGL2 crashes to the route error page "The court hit a snag" instead of a fallback message. | Chrome with `--disable-webgl --disable-3d-apis`, then open `/court/walk`. | `roam/no-webgl/01-walk-without-webgl.png` | `apps/web/src/roam/WalkPage.tsx` (no `canRoam()` guard or error boundary, unlike `TrialViewFrame`) |
| B8 | **major** (known limitation) | Versus and Grand Jury state is per browser: invites and contributions are not visible to anyone else. | Open the invite in a second browser context. | `versus/*/07-B-other-browser-opens-invite.png`, `grand-jury/desktop/08-other-browser-same-case.png` | `apps/web/src/modes/versus/runtime/localStore.ts`; `apps/web/src/modes/grand-jury/state/context.ts` |
| B9 | minor | The Grand Jury simulated crowd throws unhandled `Minimum contribution is 0.10 USDC` page errors (4 per run). | Leave a raising case open for a minute. | `grand-jury/*/issues.txt` | `packages/modes-grand-jury/src/demo.ts` (pre-trial NPC funding, about lines 446–453); `state/CourtProvider.tsx` (`void demo.sim.tick()` with no catch) |
| B10 | minor | Redaction misses first names: "Ask Priya." reached Side B's public story. | As Side B, write a name into the briefing. | `versus/desktop/11-A-case-room-B-joined.png` | `packages/modes-versus` intake and redaction |
| B11 | minor | The redaction note contradicts itself ("Removed 1 phone number" vs "Nothing needed removing"). | File as A with a phone number, then open the case room. | `versus/desktop/04` vs `11` | `apps/web/src/modes/versus/components/BriefPanel.tsx` (likely: the report is recomputed on the already-redacted text) |
| B12 | minor | The angle is quoted twice: “A deal is a deal, and “We agreed to split…” broke it.” | Pick the suggested angle. | `versus/desktop/04-A-review-redaction.png` | `packages/modes-versus` angle suggestions |
| B13 | minor | Mistrial copy: "Verdict is in. Claim your payout.", "THE JURY HAS SPOKEN", and the judge's "could not agree" on a no-show mistrial. Share-card punctuation `cold.". Listen` | Two-no-show plan. | `versus/desktop-mistrial/22-A-verdict.png` | `apps/web/src/modes/versus/components/VerdictPanel.tsx`, `CaseHeader.tsx`, `ShareCard.tsx` |
| B14 | minor | Solo step-1 ribbon overlaps the intro text at 390 px. | Open `/solo/file` on a phone. | `solo/mobile/04-file-1-validation.png` | `apps/web/src/modes/solo/file/FilePage.module.css` |
| B15 | minor | The trial section heading ("All rise") sits under the sticky header when the trial scrolls into view. | Pay a Solo case. | `solo/desktop-B/10-trial-start-roam.png` (top-left "All r…") | Missing `scroll-margin-top` in `apps/web/src/modes/solo/case/CasePage.module.css` |
| B16 | minor | A closed or unknown invite still shows the "You have been summoned" hero. | Open an expired or other-browser invite. | `versus/desktop/07-…png` | `apps/web/src/modes/versus/pages/JoinPage.tsx` |
| B17 | minor | The roam zone label doesn't update at the "Jury box" viewpoint (stays "Before the bench"). | Walk sandbox, Jump to Jury box. | `roam/desktop/07-place-jury-box.png` | `packages/scene/src/roam/world/index.ts` zones |
| B18 | minor | The previous beat's dialogue line is still on screen when the next beat starts. | Walk sandbox, run beats in order. | `roam/desktop/sheet-beat-*.png`, `timings.csv` beat rows | `packages/scene/src/roam` beat runner |
| B19 | minor | Demo deadlines follow the wall clock, so a sleeping device or clock jump expires invites mid-acceptance and turns cases into mistrials. Correct for live cases, harsh for a demo. | Observed on this host (clock jumps of 446–3549 s). | `versus/desktop-juror-watched-trial-missed-window/`, the first `versus/desktop` attempts in `timings.csv` | Demo clocks in each mode (`DemoClock` and friends) |
| B20 | minor | Console noise on every page: `THREE.Clock … deprecated` and React Router `No HydrateFallback`. | Any page. | `console-and-network.log` | `packages/scene` (THREE.Clock → THREE.Timer); `apps/web/src/app/router.tsx` |

**Not reproduced: "a Mode 1 verdict-step walkthrough once timed out."** None of the 6 Solo runs that played the jury normally timed out (the seventh was the deliberate deadline-jump run, B1). A plausible cause is the same as B1 and B19: a wall-clock jump on the test host during the jury expires a window, and the Solo jury then loops on an error. That is plausible, not proven.

## 9. Rough edges and missing pieces vs the brief

| Brief item | State as played |
|---|---|
| 3 modes | All three are playable end to end on the demo twins. |
| Revenue models | Present and clearly disclosed:<br>• **Solo:** 1.20 = 0.90 jury pool + 0.10 court fee + 0.20 AI; full refund without a verdict.<br>• **Versus:** 0.70 per side (0.45 pool, 0.05 fee, 0.20 AI); refunds shown on mistrial or dismissal.<br>• **Grand Jury:** 7.30 crowdfund, sponsor credit ("Presented by Gavel & Grain Bakery"), and "Who pays".<br>Not verified: real payment rails. |
| 0G AI | **Not live.** "Scripted demo counsel" / "demo fixture counsel (0G Compute in production)" in every flow. |
| Arc testnet | **Not live in play.** The in-browser memory twin is used everywhere ("Arc testnet memory twin"). |
| World ID gating | **Mock only.** The dialogs exist and gate seats; no real IDKit. |
| Real multiplayer | **Missing.** Versus is same-browser tabs, and Grand Jury's other jurors are simulated. "Two real people" and "anyone can join" are not true yet on separate devices. |
| Papercraft theme | Strong in all 2D chrome. The first-person roam is a pixel-voxel look with its own panel styling (339 raw hex literals under `packages/scene/src/roam`). It reads as a different game. |
| First-person roam | Works for walking, interacting and beats. Weak as a way to watch a trial: overlay, length, seating and mobile layout. The jury box has 3 seats while Grand Jury needs 7. |

**Known issues: confirmed or refuted**

| Known issue | Status | Evidence |
|---|---|---|
| Jury box seats 3, Grand Jury needs 7 | **Confirmed** | `packages/scene/src/roam/world/index.ts:118-120` (juror-1..3); `roam/desktop/07-place-jury-box.png` |
| Cinematics always seat the player at the defendant's table | **Confirmed** | B6 |
| Dialogue box visibility in roam | **Refuted on desktop** (readable, bottom-centred: `roam/desktop/sheet-beat-the-verdict.png`). **Confirmed as a problem on mobile** (B5), and dimmed behind the onboarding overlay (B4). | |
| Mode 1 verdict walkthrough timed out | **Not reproduced** | See the note under §8 |
| Versus Side A view never captured | **Refuted, now captured** | `versus/desktop/11-A-case-room-B-joined.png`, `12-A-draft-review`, `13-A-funding`, `21-A-deliberating`, `22-A-verdict` |
| Roam raw hex | **Confirmed: 339** literals across 10 files in `packages/scene/src/roam` | |
| `packages/audio/demo` raw hex | **Still 46** hex literals across `index.html`, `main.ts` and `style.css` (it also uses 68 `var(--…)`), so the recolour is partial | |
| Control legend opens by default on narrow non-touch windows | **Confirmed and broader** (every non-touch width) | B4 |
| ModePage per-mode notices | **Partly confirmed:** Versus has its own; Solo and Grand Jury share one, which is inaccurate for Grand Jury | §4.9 |
| Roam not on a real GPU | **Still true** | |

## 10. Ranked fix list (top 15)

Effort: **S** is under half a day, **M** is half a day to 2 days, **L** is more than 2 days.

1. **B1: Solo deadline error loop and the missing NO VERDICT path.** When the ledger has passed a window, the director should call `closeCommit`/`closeReveal` (or reconcile from `getCase`) instead of retrying `commitBallot`. Then the refund screen is reachable. Add a session test that sleeps past each window. **M**
2. **B2: Versus juror vs. the commit window.** Start the demo commit clock when the hearing ends (or make it at least hearing length + 2 min). Put the ballot beside the hearing or as a HUD chip with a countdown, and warn at 60 s. **M**
3. **B4: Roam onboarding over the hearing.** In trial mode, show no capture modal until the player tries to move. Keep the legend closed by default and give it a small "Controls" chip. **S**
4. **B3: Grand Jury verdict off-screen.** After settle, scroll to and focus the verdict heading; under reduced motion, jump without smooth scroll. **S**
5. **Hearing length.** About 3 min in first person vs 55 s classic. Cut the first-person beats to about 60–75 s, or offer "Watch highlights", and make "Skip to the jury" more prominent. **M**
6. **B5: Mobile first-person layout.** Hide the touch controls during cinematic beats, make the dialogue a compact bottom sheet, give the canvas at least 70vh or a full-screen prompt, and fix the clipped toolbar. **M**
7. **B6: Seat by role in cinematics.** Jurors go to the jury box and spectators to the gallery; fix the HUD label. **M**
8. **B8: Cross-device play.** A networked FactStore for Versus and a shared Grand Jury court (or the real Arc adapter). Without this, Modes 2 and 3 are single-player simulations. **L**
9. **Jury box with 7 seats** for Grand Jury in the roam world (art and layout). **M–L**
10. **B7:** Give `/court/walk` a WebGL2 guard or error boundary with the classic and menu fallback. **S**
11. **Copy pass.** Remove the D-numbers (§4.1); fix the mistrial status and eyebrow (B13), the closed-invite hero (B16), the Grand Jury "14.6 people", the Grand Jury topics and the ModePage Grand Jury notice; fix the share-card punctuation (B13) and the angle quoting (B12). **S**
12. **B10/B11: Redaction.** Catch first names in Versus briefs, and store the redaction report with the brief so the two screens agree. **M**
13. **B9:** Clamp the Grand Jury sim contributions to the minimum or remaining amount, and catch errors in the tick. **S**
14. **B19: Demo clocks.** On visibility return or a large clock jump, show "Time moved on: this case's window closed" instead of silently expiring, or pause the demo clock while hidden. **S–M**
15. **Visual consistency.** Move the 339 roam hex literals and the 46 audio-demo literals to tokens; fix the 390 px ribbon overlap (B14), add `scroll-margin-top` under the sticky header (B15), and fix the stale zone label (B17). **M**

## Status after fixes (track A: game logic and flows)

Track UX-FIXES A, branch `v3/ux-fixes-a`, 2026-11-04. Every fix has a regression test that failed before the fix and passes after it. Playtest re-runs used the production build. "Before" evidence is copied to `~/cringe-court-v3/screenshots/ux-fixes-a/before/`. "After" runs are in `~/cringe-court-v3/screenshots/ux-fixes-a/after/`. The host still had wall-clock jumps of 2–27 min and freezes during these runs. See the notes.

| Bug | Status | Fix | Evidence |
|---|---|---|---|
| B1 Solo deadline loop, NO VERDICT unreachable | **Fixed** | `SoloSession` applies every jury deadline the ledger has already passed before each jury step, and again after a step that loses the race. Covers recruitment → dismissed, commit → reveal, reveal → finalizing. A paused or backgrounded jury reaches NO VERDICT, or a dismissal with a claimable full refund. A note says which window ran out. Settlement maths unchanged: core `settle()`, and the recorded refund equals the ledger twin's settlement (tested). | `session.test.ts` "deadlines that pass while nobody is watching" (5 tests); `deadlines.test.tsx`. Playtest `solo/desktop-noverdict` now passes: NO VERDICT, 1.20 refunded, claimed (`~/cringe-court-v3/screenshots/ux-fixes-a/after/solo/desktop-noverdict/14-verdict.png`, `15-refund-claimed.png`). |
| B2 Versus juror misses the commit window | **Fixed** | The demo commit window goes from 3 to 6 min, longer than the ~174 s hearing plus time to decide. The demo clerk closes a window as soon as every seated juror has acted, so nobody waits longer. A sticky ballot HUD above the hearing shows the time left, turns urgent under 60 s, and jumps to the ballot (or opens the scroll in one press). The Grand Jury demo commit window also goes from 4 to 6 min, for the same reason. | `jury-window.test.ts`, `ballotHud.test.tsx`, GJ `demo.test.ts`. New playtest variant `versus/desktop-juror-watches-hearing`: the juror watches 327 s of the window, still seals, opens the scroll, and a verdict lands (`18…21-J-watching-*.png`). |
| B3 GJ verdict off-screen after Settle | **Fixed** | A live settle scrolls the verdict into view (instant under reduced motion) and focuses its heading. Adds `scroll-margin-top`. | `GrandJury.test.tsx`. Playtest `grand-jury/desktop`: `verdict_position_after_settle = in viewport` (was 1,499 px above). |
| B7 `/court/walk` without WebGL2 | **Fixed** | `canRoam()` guard plus an error boundary. A paper fallback page links to the courts. | `WalkPage.test.tsx`; `~/cringe-court-v3/screenshots/ux-fixes-a/after/roam/no-webgl/01-walk-without-webgl.png`. |
| B8 Cross-device play | **Not fixed (out of scope: needs a backend)** | Copy is now honest. Missing invite/case pages say the demo keeps cases in this browser and to open the link in the same browser. Invite and jury-link buttons say "(same browser)", with a visible note. | `versus.test.tsx`; `~/cringe-court-v3/screenshots/ux-fixes-a/after/versus/desktop-mistrial/07-B-other-browser-opens-invite.png`. |
| B9 GJ sim contribution errors | **Fixed** | Simulated contributions never leave a remainder below the minimum, and the tick catches errors. The memory twin now accepts an exact below-minimum final top-up, as `CringeCourt.sol` does. That turned the existing `it.fails` gap test into a passing test. | `demo.test.ts`, `GrandJury.test.tsx`, `court.test.ts`. GJ desktop and mobile after-runs: 0 "Minimum contribution" page errors (mobile had 6 before). |
| B10 Redaction misses first names | **Fixed** | Cue words ("ask/tell/text …", "my roommate …") plus a list of common given names. The chosen nickname is exempt. | `redact.test.ts`, `briefing.test.ts`; `11-A-case-room-B-joined.png` shows "Ask [name removed]". |
| B11 Contradictory redaction note | **Fixed** | The report counts placeholders already in stored text, so both screens agree after a reload and on Side B's tab. | `redact.test.ts`, `versus.test.tsx`; screens 04 and 11 both say "Removed 1 phone number". |
| B12 Angle quoted twice | **Fixed** | Inner quotes become single quotes. | `counsel.test.ts`; `11-A-case-room-B-joined.png`. |
| B13 Mistrial copy | **Fixed** | Versus: no-verdict header, eyebrow, body and judge line, telling no-shows apart from a split. Share-card punctuation fixed. Solo: a NO VERDICT can only come from missed windows (3 seats, 2 needed), so the judge line and share caption now say so. The fixture and 0G fallback sentences no longer claim "could not agree". | `versus.test.tsx`, `flow.test.ts`, `counsel.test.ts`, Solo `session.test.ts`. |
| B14 Solo ribbon at 390 px | **Not touched here** | Left to track B (visual). | — |
| B15 Trial heading under the sticky header | **Fixed (CSS)** | `scroll-margin-top` on the Solo trial, verdict and closed sections. | CSS only; no screenshot re-taken. |
| B16 Closed invite still says "summoned" | **Fixed** | A hero per state: not found, closed, taken, your own, already joined. | `versus.test.tsx`; `07-B-other-browser-opens-invite.png` ("We can't find that invite"). |
| B19 Demo clocks follow the wall clock | **Fixed (in-page)** | `monotonicUnixClock()` (core): the wall clock once, then `performance.now()`. Used by the Solo, Versus and Grand Jury demo clocks and the demo ledger. A reload re-anchors. Note: Playwright's real-speed fake clock passes host clock jumps through to `performance.now`, so playtest runs can still see them. | `clock.test.ts`, Solo `deadlines.test.tsx`, GJ `demo.test.ts`, Versus `jury-window.test.ts` (each fails with the old wall clock). |
| B20 Console noise | **Partly fixed** | Router `hydrateFallbackElement` removes the `HydrateFallback` warning, which is absent from all after-run logs. `THREE.Clock` lives in `packages/scene`, which belongs to track B. | after-run `issues.txt`. |
| B4, B5, B6, B17, B18 | Track B (roam) | — | — |

**Copy pass (§4).**
- 4.1: internal decision IDs are removed from every catalog and from two player-visible package strings. `noInternalIds.test.ts` scans all catalogs.
- 4.2: same-browser invite wording.
- 4.3: mistrial copy (B13).
- 4.5: closed-invite hero (B16).
- 4.6: "about 15 people at 0.50": whole people, rounded up.
- 4.7: Grand Jury topics (Food fight, Etiquette, Tech and internet, Style, Everyday life) instead of Solo's crime categories.
- 4.9: a Grand Jury notice ("you are a verified juror; the rest are simulated").
- 4.10: mode landings show "Deadlines (live cases)" and "Deadlines (this demo court)". `ModeFacts.test.tsx` covers this.
- 4.8 (roam onboarding) belongs to track B.

**Not verified.** The Grand Jury mobile re-run could not finish on this host: screenshot timeouts, and three wall-clock jumps of 11–24 min in one run. Its B9 result comes from the partial run, and B3 is verified on desktop. The other Solo, Versus and roam variants were not re-run. Sound, real GPUs and real phones remain untested.

## Status after fixes (track B)

Branch `v3/ux-fixes-b` covers the first-person roam, mobile and visual consistency. Screenshots: `~/cringe-court-v3/screenshots/ux-fixes-b/{before,after}/`. "Real GPU, sound, real phones" are still untested for every row.

| Item | Status | Root cause | Fix | Regression test | Evidence (after) |
|---|---|---|---|---|---|
| **B4** onboarding modal and legend over the hearing | **Fixed** | A full-room capture overlay until the first click, and the legend opened on every non-touch width (`useState(() => !isTouch)`). | The overlay became a compact corner card. It never shows during a cinematic beat, has a **Got it** button, and stays dismissed (`cc:roam-onboarded`). The legend starts closed everywhere; the **Controls** button opens it. Clicking the room captures the mouse directly (not during a beat). | `scene/roam/__tests__/room.test.tsx` (no modal, dismissal remembered, hidden during a beat, legend closed) | `after/b4-01…03`, `after/playtest/solo/desktop-A/10-trial-start-roam.png`, `after/playtest/roam/narrow-760/01-…png` |
| **Hearing length** (174 s first-person vs 55 s classic) | **Fixed** | Slow full pace (48 cps typewriter, 1.4 s + 25 ms/char holds). Also a bug: `all-rise` and `jury-deliberating` said the mode's transcript lines **twice** (`lines()` was called twice and returned `opts.lines` both times). | `pace.ts`: **Standard** (default), **Highlights** and **Full** paces, with every constant in `HEARING_PACE`. Fast-forward (`FAST_FORWARD` = 3×) and **Skip to the verdict** are in the trial bar; Skip is hidden during the verdict, and nothing skips the verdict beat. The pace is saved per browser (`cc:hearing-pace`). Hearing time keeps real time on slow devices. | `scene/roam/__tests__/hearing.test.ts`: Standard 60–75 s (62.7 s estimated for a 13-line DemoCounsel-shaped hearing), Highlights < 45 s (40.6 s), estimate within 5 % of a watched run, fast-forward, lines said once, slow frames | In-browser on SwiftShader: Standard **63.6 s** and **77.4 s** (two runs; the host is noisy), Highlights 42.2 s, Full 93 s / 159 s |
| **B5** mobile: dialogue and touch controls cover the canvas; toolbar clipped | **Fixed** | Dialogue and touch controls are overlays on a 3:4 canvas, and the trial bar did not wrap. | Narrow rooms (≤ 560 px, a container query) dock the dialogue as a sheet *under* the 3D view. Touch controls are hidden during cinematic beats (tap the line to move on) and are smaller otherwise. The phone room is taller (`min(76svh, 38rem)`). The bar wraps. | `room.test.tsx` (touch controls hidden in a beat, tap to advance); a geometry probe in a real browser: canvas 318–818 px, dialogue 818–970 px, no overlap, 15 px text | `after/b5-01/02`, `after/playtest/versus/mobile/17-J-trial-roam.png`, `after/playtest/grand-jury/mobile/sheet-hearing-juror-roam.png` |
| **B6** everyone seated at the defendant's table | **Fixed** | Every beat began with `{ kind: 'seat', seat: 'defendant' }`. `RoamTrial` also kept the first controller, so a Grand Jury spectator who took a seat stayed a spectator. | Seat by role (`ROLE_SEAT`): defendant and Side B at the defendant's table, Side A at a new prosecution-table chair, a juror in the jury box, a spectator in the gallery. Only parties rise for the verdict, and the judge addresses "the parties" otherwise. `RoamTrial` rebuilds the room when the role or the jury size changes. A juror watches the bench, not a neighbour, when the jury retires. | `hearing.test.ts` (all 5 roles × every beat, seat and HUD zone), `trial/RoamTrial.test.tsx` (remount per role), Versus and Grand Jury tests updated (they encoded the old seating) | `after/role-*.png`, `after/playtest/versus/mobile/17-…`, `after/playtest/grand-jury/mobile/sheet-…` |
| **7-seat jury box** | **Done** | The cutaway box had one row of 3 seats, with a wall pilaster in the middle seat. | `world/jury.ts`: a two-tier box along the right wall, lengthened toward the well. The front row has 3 seats (filled first: Solo and Versus); the riser 17.4 higher has 4 (Grand Jury fills all 7). Collision and barrier follow the new footprint, and there is a jury-box zone. Counsel Chaos moved out of the defendant's sightline. `jurors` is a controller option; seats not in this hearing are empty, and the player juror takes slot 2. The 12 original NPCs and all interactables still work (now 16 NPCs and 32 interactables). | `world.test.ts` (7 slots, row spacing, staff-only, sightlines: every back-row face clears the front-row heads from 5 viewpoints), `hearing.test.ts` (jury size 7 / 3, player juror) | `after/jury-01…03.png`, `after/roam-shots/roam-witness.png` |
| **Visual consistency**: 339 roam hex, 46 audio-demo hex, roam CSS `var()` fallbacks | **Fixed** | Literal colours were scattered through the world, renderer, HUD and demo. | Roam: every colour comes from `palette.ts` (`C.royal900`…, `alpha()`, `ART` for source-art colours). The HUD CSS and its `var()` fallbacks interpolate those tokens. Audio demo: it `@import`s the app's `tokens.css` and uses `var(--cc-…)`. Non-palette colours mapped to the nearest swatch: neon pink → royal-700, near-black and black → neutral-900. | `apps/web/src/ds/tokens.test.ts`: a new scan of `packages/scene/src/roam` (everything but `palette.ts`) and `packages/audio/demo`, plus roam `PALETTE` == web `palette` | `before/` vs `after/roam-shots/*` and `audio-demo*.png`. Colours are identical; pixel diffs come from moving mock players, the new jury box and the HUD changes |
| **B14** Solo step-1 ribbon over the intro at 390 px | **Fixed** | The three-line ribbon's tails hang 22 % of its height below the band; the margin was 16 px. | `margin-block-end: calc(space-4 + 1.5em)` under 30rem. | Screenshot only (layout is not testable in jsdom) | `after/playtest/solo/mobile/04-file-1-validation.png` |
| **B15** trial heading under the sticky header | **Fixed for in-app scrolls** | No `scroll-margin-top`. The evaluation's screenshot was scrolled by the harness itself (Playwright `scrollIntoViewIfNeeded`, which ignores scroll margins); the app does not scroll there itself. | `scroll-margin-top` on the Solo trial section and on every mode's trial frame. | Built CSS contains the rule. **Not verified in a browser** (the Grand Jury probe found no hearing on screen) | — |
| **B17** zone label at the "Jury box" viewpoint | **Fixed** | There was no jury-box zone, and the viewpoint stood on the dais ("Before the bench" was accurate). | A `jury-box` zone (translated). The viewpoint moved to the well, facing all seven seats, and labels its real zone ("Well of the court"). Seated in the box, the HUD says "Jury box". | `world.test.ts` | `after/jury-01…`, `after/role-juror-*` |
| **B18** previous beat's line opens the next beat | **Fixed** | A beat line finishes its hold while the beat runs, so the "fade when not in a beat" branch never fired after the beat ended. | A finished line leaves with its beat. | `hearing.test.ts` | — |
| **Roam performance** | **Changed, not measured on a GPU** | Lighting mood re-blended and re-applied every frame (allocating 16 `THREE.Color`s). NPC specs used a linear search per NPC per frame. | Mood is applied only while a change or gavel flash is in progress. NPC specs come from a map. Hidden jurors are not animated. | Existing renderer and controller tests | SwiftShader 10–25 fps (software, not meaningful) |
| B20 `THREE.Clock` warning | Not fixed | Comes from @react-three/fiber's own clock, not roam code | — | — | — |

## 11. Remaining weaknesses, stated plainly

- **None of the three integrations is live in the product as played.** Not 0G, not Arc, not World ID. It is a convincing, honest demo running on in-browser twins.
- **Modes 2 and 3 are not yet multiplayer.** Versus needs both people in one browser, and Grand Jury's jury is six simulated strangers plus you.
- **The first-person courtroom is the headline feature but the weakest way to watch a trial.** It is too long, the HUD gets in the way, it puts everyone at the defendant's table, and it is cramped on phones. The classic stage is better today.
- **Solo has no reachable refund path in play** (B1), although the refund UI exists.
- **Outcomes vary from run to run.** The same Solo confession came out GUILTY in one run and NOT COOKED in another, because the NPC votes hash the frozen transcript. That is fine for a game, but don't promise deterministic demos.
- **Unverified here:** sound (nobody has listened), real-GPU frame rate and comfort, Safari and Firefox, real phones, screen readers.
- **The test host was unstable** (wall-clock jumps, freezes, flaky WebGL2). The harness logs and excludes this, but some runs were affected and needed reruns. `timings.csv` keeps every attempt, including the failed ones.

---

### Re-running

```
npm run build -w @cringe-court/web
npm run playtest -w @cringe-court/web                         # all scenarios
npm run playtest -w @cringe-court/web -- solo --variant=desktop-B,mobile
npm run playtest -w @cringe-court/web -- versus grand-jury roam
```

- Uses system Chrome (`CHROME_PATH` to override) through `playwright-core`.
- Output goes to `~/cringe-court-v3/screenshots/playtest` (`PLAYTEST_OUT` to override).
- The preview server starts on a free port and is always stopped.
- Not part of `npm run check`.
- Variants:
  - **solo:** desktop-A (watches the whole hearing; about 10 min), desktop-B, desktop-C, desktop-noverdict (NO VERDICT and the refund; passes since track A's B1 fix), mobile, reduced-motion, no-webgl-classic.
  - **versus:** desktop, desktop-mistrial, desktop-juror-watches-hearing, desktop-B-never-joins, mobile, reduced-motion.
  - **grand-jury:** desktop, mobile, reduced-motion.
  - **roam:** desktop, narrow-760, mobile-touch, no-webgl.

## Status after backend (v3/backend)

**B8 (cross-device play): fixed when a court server is configured.** The local
browser-only demo is still the default.

- `apps/server` holds Versus and Grand Jury courts for every device; the web app
  opts in with `VITE_BACKEND_URL` (`npm run dev:full` wires both). See docs/BACKEND.md.
- **Versus.** A Versus invite opened in another browser now shows the summons,
  instead of "No case with that code here".
  - Checked with A, B (mobile) and a juror in three separate Playwright contexts
    (`npm run e2e:backend`, screenshots in `screenshots/backend/versus/`). The
    run covers the signed link, B's live arrival on A's screen, a reload
    mid-case, the server's clerk drafting counsel, payments, seal, reveal, the
    verdict on both devices, and claims.
  - B's device never received A's private notes. This is asserted on raw HTTP
    responses in `apps/server` tests, and on screen in the e2e.
- **Grand Jury.** Every device sees the same docket. Seven jurors in seven
  contexts funded, screened, took seats, sealed, opened their scrolls, settled
  4–3 and collected (`screenshots/backend/grand-jury/`).
  - The second-browser contribution check from §8 now passes: same raised
    total, same court record.
- **Failure UX.** If the configured server is unreachable, an i18n'd error
  offers retry or an explicit local-demo choice. A lost connection shows a
  banner, and actions fail with "Nothing was sent". A server reset gives a fresh
  session with a notice (`screenshots/backend/offline/`).
- **Still open.**
  - Single-node, demo-grade bearer tokens, World ID still mocked, fixture AI
    counsel, no real chain by default.
  - The demo clock skip is shared by every case on one server (it can be
    switched off with `CC_DEMO_CLOCK=off`).
  - The Grand Jury summoning crowd is still simulated.
  - B19 (demo deadlines vs sleeping devices) now follows the server's clock
    rather than each device's, but is otherwise unchanged.
