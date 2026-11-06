# CringeCourt — Decision Record (D1–D14)

**Status:** decided, 2026-11-02. The owner delegated every open decision to best
judgment ("take the best possible decision"). This record closes the 14 open
product decisions listed in `docs/GAME-MODES.md` §5. Later build phases (contracts,
AI adapters, World gating, app) implement what is decided here.

**Sources.** The V4 idea doc
([`idea/CringeCourt_V4_Product_Vision_Fairness_Fixes(1).md`](../idea/CringeCourt_V4_Product_Vision_Fairness_Fixes%281%29.md),
cited as **V4 §n**), [`GAME-MODES.md`](GAME-MODES.md) (mode specs, cited as
**GM §n**) and [`ECONOMICS.md`](ECONOMICS.md) (cited as **EC §n**). Every number
below comes from `docs/economics/cringe_econ.py`, re-run for this record, and
appears in `docs/economics/out/*.csv`. **A#** marks an assumption from EC §7.
None of the A-numbers are measured. They are planning inputs, not facts.

**Money.** All amounts are test USDC on Arc testnet, per case attempt, unless a
row says otherwise. Nothing in this record approves real money (D14).

---

## 0. Summary

| # | Question | Decision | vs. PR #18 default |
|---|---|---|---|
| D1 | Is Mode 1's defense the user's advocate? | **Yes.** Counsel Chaos works for the user; Miss Ratio is the NPC opponent, with the same model and budget | Kept; adds an information wall and a balance gate |
| D2 | How much can the user steer their advocate? | **One angle**: pick 1 of 3 suggestions or write one line (≤ 140 chars), plus **one** redraft before paying | Kept; adds the length cap and redraft limit |
| D3 | How does the free teaser end? | **Opening statements only, then "THE JURY IS OUT"**. No AI verdict. Openings carry into the paid case | Kept; adds carry-over and rate limits |
| D4 | Versus price | **1.40 = 0.70 per side** | Kept |
| D5 | Versus verdict labels | **SIDE A / SIDE B**, each with an optional self-approved nickname | Kept; one binary ballot for every mode |
| D6 | Who pays intake when Side B never consents? | **The platform** (0.0072 per abandoned case), with invite limits | Kept; adds abuse limits |
| D7 | Grand Jury size | **7 jurors (N = 3)**; contracts take N as a parameter | Kept; rationale changed (§D7) |
| D8 | Grand Jury verdict threshold | **N + 1 = 4 matching revealed votes of the 7 appointed** | Kept |
| D9 | Who funds the Grand Jury? | **Spectator crowdfund plus a sponsor slot**, pro-rata refund on any failure; nothing depends on the outcome | Extended with a sponsor slot |
| D10 | Mode 3 pricing | **Hackathon:** capped marketing budget (≤ 40 cases, ≈ 46 test USDC). **Launch:** *Sponsored Docket*: protocol fee 1.00, sponsor ≥ 2.00 per funded case, review ≤ 1.50, and it must pay even if every juror shows up | **Changed**: re-pricing is decided now, not deferred |
| D11 | Crowd vote | **Free, points-only, never binding**, and **hidden until the jury's reveal closes** | Kept; adds the hide-until-reveal rule |
| D12 | 0G Compute Pass in Versus | **Per side**. Off by default until V4 §17 gate 2 passes. No Pass in Mode 3 | Kept; adds the gate |
| D13 | Absence (forfeit) revenue in Modes 2–3 | **Kept per V4 §16, but no mode's pricing may need it**; disclosed per case | Kept; adds the no-dependence rule |
| D14 | Real money | **Testnet only, all modes**, with a permanent TESTNET badge | Kept |

Two rules came out of this work and bind every later phase:

1. **No pricing may need no-shows.** Every mode's contribution stays positive at
   100 % juror attendance (D10, D13). Modes 1–2 already meet it (+0.2187 and
   +0.2766). Mode 3 at V4-style fees does not (−1.6358). Its launch price does
   (+0.2749 to +0.0518 across the tested elasticities).
2. **Fees are fixed per case.** Every fee, bond, deadline and threshold is written
   into the case when it is created and can't change for that case. A fee-schedule
   change affects only cases created afterwards (V4 §8 "fixed before the active
   trial starts").

---

## D1 — Mode 1: the defense is the user's advocate

**Context.** V4 §4A and §11 have the AI write prosecution and defense as one show.
The Mode 1 brief is "one person + AI + NPC AI", which needs the user to have a
side (GM §1 audit).

**Decision.** Counsel Chaos is **the user's advocate**. Miss Ratio is an **NPC
opponent** who argues against the user. Judge Gavel.exe hosts and cannot touch
votes (V4 §5).

**Alternatives considered.**
- *Keep V4's neutral show* (the AI writes both sides for laughs). Rejected: the
  user has no stake in either side and Mode 1 stops being "me + my AI".
- *User argues in person, with no advocate.* Rejected: it needs live input during
  the trial, which breaks the frozen transcript (V4 §12), and most people won't
  write a closing argument.
- *User picks which side the AI argues.* Rejected: same economics, more confusion.

**Rationale.** It matches the mode, doesn't change V4 §9 economics, and gives the
user a reason to share ("my lawyer cooked").

**Consequences.**
- **AI interface:** roles are `advocate` and `opponent`, not `defense` and
  `prosecution`. The advocate's prompt gets the user's private story and angle
  (D2). **The opponent only ever gets the approved public text.** Adapter tests
  must assert that private notes never reach an opponent prompt.
- **Fairness gate:** same model, same token budget (A7) for both sides. A
  balance check runs before freezing. If it fails, the opponent is redrafted
  once; if it still fails, the case is cancelled as "AI could not prepare a fair
  case" with a full refund (V4 §8).
- **UI:** the user's side is visually "yours" (Counsel Chaos portrait on the
  user's side of the bench). The jury UI shows both sides neutrally.

## D2 — Mode 1: one angle, chosen before freezing

**Decision.** The user gives their advocate exactly **one angle**: tap one of 3
AI-suggested angles, or write **one line of at most 140 characters**. They see
the frozen draft and may **redraft once** before paying. After payment nothing
changes (V4 §6 step 5, §12).

**Alternatives considered.**
- *No steering.* Rejected: it undoes D1.
- *Multi-turn chat with the advocate.* Rejected: it multiplies inference (the
  Mode 2 intake is 6,000 / 1,200 tokens per side, A16, vs 1,200 / 400 for Mode 1
  intake), widens prompt-injection surface, and delays the jury.
- *Live steering during the trial.* Rejected: breaks the frozen transcript and
  the content fingerprint (V4 §12).

**Rationale.** One choice gives the user ownership at about zero cost. The 3
suggestions come from the intake call that already runs (A7), so the token budget
is unchanged.

**Consequences.** The user line goes into the prompt as quoted data with a length
cap, never as instructions. A redraft is one extra advocate+opponent pass, which
the A8 retry factor of 1.5 already covers. The UI is a three-card picker with a
"write your own" field and a character counter.

## D3 — Free teaser: openings only, no AI verdict

**Decision.** The teaser runs intake plus both opening statements, then ends on
**"THE JURY IS OUT"** with an upgrade button. **There is no AI verdict.** If the
user upgrades, the teaser's openings carry into the paid case as the first draft;
the user still approves before freezing. Rate limit: **1 teaser a day per device
without sign-in, 3 a day per signed-in account.** World ID is not required to
watch a teaser.

**Alternatives considered.**
- *AI "preliminary vibe" verdict.* Rejected: it breaks V4 §15 ("the AI doesn't
  decide") and anchors the jury.
- *No teaser.* Rejected: V4 §4A asks for one, and the funnel needs it.
- *World ID required for teasers.* Rejected: verification friction before any
  value is shown. World gates the jury seat, not watching (V4 §10).

**Rationale.** The cliffhanger is the conversion moment. EC §1 shows the teaser
funnel (A12: 4 teasers per paid trial) costs 0.0192 per paid trial, more than the
paid trial's own inference (0.0143). Carry-over reuses 3 calls, and the rate
limits bound the funnel. The model doesn't count carry-over savings, so the
numbers here are conservative.

**Consequences.** Teaser and paid case share one draft object. Rate limits sit in
the app layer, not on-chain. Teasers never touch the contracts.

## D4 — Versus price: 1.40, split 0.70 / 0.70

**Decision.** A Versus case costs **1.40 test USDC = 0.90 jury pool + 0.10
protocol fee + 0.20 AI fee per side**. Each side pays **0.70**.

**Alternatives considered.**
- *1.20 total (0.60 each), platform absorbs the second agent.* The calculator
  gives **0.1905** contribution vs **0.3039** at 1.40. That gives up 37 % of
  margin to save each side 0.10.
- *Side A pays everything.* Rejected: V4 §4B prefers 50/50, and paying is part of
  consent.

**Rationale.** Each side pays for its own advocate, the same per-agent rule as
Mode 1. At 1.40, Mode 2 earns **0.3561** revenue (fees 0.2836, forfeits 0.0725)
against **0.0521** cost: **+0.3039** per initiated case, **+0.2766** at 100 %
attendance. Breakeven is **1,646 initiated cases/month** for A14 infra. The swing
factor is consent abandonment, not price: 60 % abandonment (A18) gives 0.168.

**Consequences.** The escrow takes **two payers per case** with per-side refunds.
The case stays private until both halves are funded by the consent deadline:
**24 hours** from invite (demo builds may use shorter windows, labelled as such,
V4 §8). On no verdict, each side gets its own 0.70 back.

## D5 — Versus labels: SIDE A / SIDE B

**Decision.** The verdict reads **SIDE A** or **SIDE B**. Each side may attach an
optional nickname (≤ 24 chars), approved by that side only and checked by the
same redaction pass as the case text. No real names or wallet addresses in the
entertainment UI (V4 §4B).

**Alternatives.** *GUILTY / NOT COOKED* doesn't fit two claimants. *Free-form
labels* invite doxxing.

**Consequences.** **One ballot contract for every mode**: a binary choice
`{0, 1}` plus `NO_VERDICT` as an outcome. The labels live in mode/case metadata:
GUILTY / NOT COOKED (Mode 1), SIDE A / SIDE B (Mode 2), two reviewed position
titles (Mode 3, D8). The art already has Side A/B characters
(`feat/versus-sides`).

## D6 — Abandoned Versus intake: the platform pays

**Decision.** If Side B never consents or funds, **Side A pays nothing** and the
platform absorbs Side A's intake: **0.0072** of inference per abandoned case
(6,000 in / 1,200 out tokens × 1.5 at A5/A6). Abuse limits: **at most 3 open
unconsented invites per signed-in Side A**, and invites expire with the 24-hour
consent deadline (D4).

**Alternatives.** *Charge Side A a non-refundable intake fee.* Rejected: it
contradicts V4 §4B ("paid contributions are refunded") and punishes the person
who tried. *Charge Side A only after Side B consents.* That is what the decision
already does.

**Rationale.** At A18 (30 % abandonment), absorbed intake is part of Mode 2's
0.0298 inference per attempt (EC §2), which is already in the +0.3039.

**Consequences.** The invite rate limit is in the app layer. Nothing goes
on-chain until both sides fund.

## D7 — Grand Jury size: 7 (N = 3)

**Decision.** **7 jurors**, bond 1.20, success bonus 0.90, pool 6.30 by the V4 §9
formula. Contracts take **N as a per-case parameter** (Mode 1/2: N = 1; Mode 3:
N = 3), so the size can be retuned without a redeploy.

**Alternatives considered.** *5 jurors (N = 2).* Pool 3.00, crowdfund target 4.50
at launch pricing. *Larger than 7.* More recruitment risk on a small verified
pool and a bigger crowdfund.

**Rationale, and an honest correction.** The calculator favours 7 at launch
pricing (**+0.7105** vs **+0.3954** for 5). But almost all of that gap is
**forfeit revenue** (0.5812 vs 0.2533, a 0.3279 difference against a 0.3151
contribution gap). Fees are the same (0.7000 vs 0.7109). Under D13 that is not a
reason to pick 7. The real reasons:
- **Legitimacy of a public verdict.** "4 of 7 strangers agreed" is a much stronger
  public statement than 2 or 3 people, and public cases are what get screenshotted.
- **Capture resistance.** Public cases attract brigading. With random seats from
  a verified waiting pool (V4 §10), a coordinated group has to land 4 seats
  instead of 3.
- V4 §14 lists "larger juries" as the stretch direction.

**Consequences.** Recruitment needs 7 verified jurors per case. That is the main
hackathon risk, since the verified pool will be small. If the measured fill rate
in the demo is poor, **N = 2 is the documented fallback**. It is a parameter
change only, and it is still positive at launch pricing (+0.3954).

## D8 — Grand Jury threshold: 4 matching of 7 appointed

**Decision.** A verdict needs **N + 1 = 4 matching revealed votes out of the 7
appointed jurors**. Fewer is NO VERDICT (V4 §7 generalised: for N = 1 it is the
V4 rule exactly, 2 of 3). The two positions on the ballot are titles written in
the reviewed context card, e.g. "TEAM CEREAL IS SOUP" / "TEAM NOT SOUP".

**Alternatives.** *Majority of revealed votes.* Rejected: with 3 reveals, 2
people would decide a public case. *Supermajority (5 of 7).* Rejected: more NO
VERDICTs and more refunds, for little extra legitimacy.

**Rationale.** It keeps one rule across modes: appointed jury 2N+1, N+1 matching.
At default attendance, **82.7 % of seated Mode 3 trials reach a verdict**
(0.4667 verdicts per published case ÷ 0.5643 seated).

**Consequences.** The contract computes the threshold as `N + 1` from the case's
N. There is no separate per-mode constant.

## D9 — Grand Jury funding: crowdfund + sponsor slot

**Decision.** Spectators **"summon the court"** with contributions of at least
0.10 test USDC toward the case's target. A **sponsor slot** (D10) can add a
per-case sponsor deposit. Contributions are **refunded pro rata** if the target
isn't reached by the **48-hour funding deadline**, the jury doesn't fill, AI
preparation fails, a protective cancellation happens, or the trial ends NO
VERDICT. **Contributors get nothing that depends on the outcome**: a cosmetic
"Summoner" credit on the case page, the same whatever the verdict.

**Alternatives.** *Platform-funded only.* Fine for a demo, but there is no path
off subsidy (that is D10's hackathon phase). *Sponsor-only.* Puts all risk on
one counterparty and gives fans no stake in summoning. *Outcome-linked rewards
for contributors.* Rejected outright: that is betting on public controversies
(V4 §4C, §14).

**Rationale.** It mirrors V4's creator refund (§1, §9) for a crowd, and keeps the
contribution a ticket to a show, not a wager. Legal review is still required
before real money (V4 §12, §17.6).

**Consequences.** The contract has a crowdfund escrow with per-contributor
accounting, permissionless refund claims, and a separate **sponsor deposit**. The
sponsor fee is earned when the trial is seated and runs (verdict or not) and is
refunded if the case is cancelled before voting. **The sponsor has no say over
case selection, content or verdict.** The page shows "Presented by …" and nothing
else.

## D10 — Mode 3 pricing

**Context.** At V4-style fees (protocol 0.50, AI 0.50; crowdfund 7.30), Mode 3
**loses 1.1515 per published case**. Human sourcing/legal review (A23, 2.00 per
published case, required by V4 §12) is the driver. Inference is 0.0388. PR #18's
default was "capped marketing budget at the hackathon, re-price before launch",
with break-even at a protocol fee of **2.97**, a sponsor of **2.05** per funded
case, or review ≤ **0.84** (re-run, `out/mode3_breakeven.csv`).

**Decision: two phases, both decided now.**

**Phase 1, hackathon (testnet): capped marketing budget.** Fees as in PR #18
(0.50 + 0.50, target 7.30). **At most 40 published cases (A27)**, editorially
chosen. Expected modelled loss: **46.06 test USDC** (40 × 1.1515). The only real
cost is editor time (about 10 minutes per case, A23) and 0G testnet compute. The
sponsor slot is built and shown with a test sponsor, but the budget assumes none.

**Phase 2, launch pricing: the Sponsored Docket.**

| Term | Value |
|---|---|
| Protocol fee | **1.00** (from 0.50) |
| AI fee | 0.50 (unchanged) |
| Crowdfund target | **7.80** (6.30 pool + 1.50 fees; about 15.6 contributors at 0.50) |
| Sponsor | **≥ 2.00 per funded case**, committed **before** the case is published |
| Review cost | **≤ 1.50 per published case** target (from 2.00), via AI-prepared source packs; a human still signs off every case |
| Publication rule | A case is published only with a sponsor commitment, or inside an explicit marketing cap |
| Hard constraint | Contribution > 0 **at 100 % attendance** (no forfeit revenue) at every tested funding elasticity |

**Results** (contribution per published case; elasticity e is A26, a new
assumption: funding success scales by (7.30 / target)^e when the target rises
above 7.30; e = 0 is PR #18's price-blind model):

| Option | Target | e = 0 | e = 0.5 | e = 1 | e = 2 | At 100 % attendance, e = 1 |
|---|---:|---:|---:|---:|---:|---:|
| Hackathon defaults (PR #18) | 7.30 | −1.1515 | −1.1515 | −1.1515 | −1.1515 | −1.6358 |
| Fee only (protocol 2.97) | 9.77 | +0.0012 | −0.2733 | −0.5106 | −0.8930 | — |
| Sponsor only (2.05) | 7.30 | +0.0053 | +0.0053 | +0.0053 | +0.0053 | — |
| Review only (0.84) | 7.30 | +0.0085 | +0.0085 | +0.0085 | +0.0085 | — |
| **Sponsored Docket (chosen)** | **7.80** | **+0.7105** | **+0.6377** | **+0.5673** | **+0.4333** | **+0.1597** |
| … sponsor at 1.50 instead | 7.80 | +0.4283 | +0.3647 | +0.3032 | +0.1861 | fails (needs 1.70) |
| … review stays at 2.00 | 7.80 | +0.2105 | +0.1377 | +0.0673 | −0.0667 | fails (needs 2.65) |
| … sponsor falls through (0) | 7.80 | −0.4181 | −0.4542 | −0.4890 | −0.5553 | — |

Sources: `out/mode3_scenarios.csv`, `out/mode3_pricing_grid.csv`, `out/mode3_breakeven.csv`.

At the chosen launch price (e = 0) revenue is **2.4098 per published case**:
fees 0.7000, forfeits 0.5812, sponsor 1.1286. Cost is 1.6993. **Forfeits are 24.1 %
of revenue, down from 55.5 %.** Across e = 0 … 2, between 0.0518 and 0.2749 of
contribution survives with zero forfeit revenue.

**Why not the single-lever fixes.**
- **Fee only** works only if funders ignore a 34 % higher target (7.30 → 9.77).
  At e = 0.5 it is already −0.2733. It also charges fans for a safety review they
  never see.
- **Sponsor only** breaks even with +0.0053 to spare. One sponsor slipping sinks
  the case, and at 100 % attendance it is negative.
- **Review only** means cutting V4 §12's safety review by 58 %, to under 5 minutes
  of editor time per public-figure case. That is the review that keeps Mode 3
  out of defamation territory. Not acceptable as the main lever.
- **A permanent marketing budget** has no path to sustainability, and cost grows
  with success: at 50,000 viewers a case costs **−3.86** (EC §5, A24).

**Why the blend.** Three moderate moves beat one extreme move. The fee rises 0.50
(+6.8 % target), the sponsor ask is **1.00 USDC per 1,000 views** at A24's 2,000
viewers, and review falls 25 % through tooling, not by cutting the human
sign-off. It is the only option in the table that stays positive at every tested
elasticity *and* without forfeits.

**Launch gate (measure before re-pricing goes live).** Measure A21 (funding
success), A23 (review minutes), A24 (views) and A26 (elasticity) from the
hackathon's 40 cases. Then re-solve the sponsor floor with the calculator at the
**measured** review cost. Re-run (100 % attendance, e = 1): review 1.00 → floor
**0.76**; 1.50 → **1.70**; 2.00 → **2.65**. If review stays near 2.00, the
sponsor ask rises to 2.65 or Mode 3 stays a capped marketing line.

**Consequences.**
- **Contracts:** the Mode 3 case stores (N, crowdfund target, protocol fee, AI
  fee, sponsor deposit, deadlines) at creation, and they are immutable for that
  case. The fee schedule is per mode and admin-set for *future* cases only.
- **Ops:** the hackathon cap of 40 cases is enforced in the publishing tool, and
  the dashboard shows the remaining marketing budget.
- **UI:** the case page shows the target, contributors, deadline, "Presented by"
  slot and refund promise. No odds, no payouts.

## D11 — Crowd vote: free, points-only, hidden until reveal

**Decision.** Any signed-in spectator gets **one free, points-only vote** per
case, shown as **"THE GALLERY SAYS …"** next to the jury result. **The gallery
tally stays hidden until the jury's reveal window closes**, so it can't anchor
jurors. Appointed jurors can't cast a gallery vote on their own case. It never
counts toward the verdict.

**Alternatives.** *Paid or staked crowd votes.* Rejected: a prediction market on
public controversies (V4 §4C, §14). *World-verified crowd votes.* Not needed for
a non-binding, points-only vote; an optional "verified gallery" split can come
later. *Live tally during voting.* Rejected: it biases the binding vote.

**Consequences.** Votes are stored offchain (A24: 500 votes × 0.00005). Points
feed the "Rap Sheet" and streaks (V4 §11), never anything with money.

## D12 — 0G Compute Pass: per side, gated

**Decision.** In Versus, **each side that funds its own agent with its own 0G
credits has its own 0.20 AI fee waived.** The Pass is **off by default** in every
mode until V4 §17 gate 2 (supported, secure delegated credit use) is confirmed.
Mode 3 has **no Pass**: there is no single payer.

**Rationale.** It mirrors V4 §11 per person. The calculator shows the Pass is a
**subsidy, not a saving**: it waives 0.20 to avoid about 0.015–0.02 of inference.
At a 50 % Pass share, contribution falls to 0.210 (Mode 1) and 0.205 (Mode 2).
Both are still positive, so it is affordable as a sponsor-track feature (V4 §2)
but is not presented as a cost saving.

**Consequences.** The AI adapter interface takes a `payer` field (`platform` |
`user-credits`). The fixture adapter supports both. The Pass UI shows real credit
usage (V4 §11 "No fake discount").

## D13 — Absence revenue: kept, disclosed, never needed

**Decision.** In Modes 2 and 3, forfeited bonds and unearned bonus allocations go
to the protocol **under the same rule and disclosure as V4 §9**, because V4 §16
retains it. Three safeguards on top:
1. **No pricing may need it.** Every mode's contribution must stay positive at
   100 % attendance (see §0). Re-run: Mode 1 **+0.2187**, Mode 2 **+0.2766**,
   Mode 3 launch **+0.2749 … +0.0518** (e = 0 … 2). Mode 3 at hackathon fees fails
   this (−1.6358), which is one more reason it stays a capped budget.
2. **Per-case disclosure.** The case page shows forfeits taken and attendance.
   The ops dashboard tracks attendance as a quality metric, never as revenue.
3. **No platform levers over no-shows.** Deadlines are immutable once duty is
   slashable, finalization is permissionless, jurors have a direct transaction
   path, and reminders are mandatory (V4 §7, §8).

**Alternatives.** *Send forfeits to funders or a juror pool in Mode 3.* That costs
0.5812 per published case at default attendance and e = 0 (0.5439 at e = 1,
0.5091 at e = 2). Subtracting that from the
launch scenarios (simple arithmetic on the CSVs, not a separate model run) leaves
+0.1293 at e = 0 and +0.0234 at e = 1, and goes negative at e = 2 (−0.0758). That
is too thin to commit to. Rejected for now; revisit once A21/A26 are measured or
if the disclosure draws pushback. *Drop forfeits in all modes.* Rejected: it
contradicts V4 §16.

**Rationale, quantified.** The conflict is real. From `out/attendance_sweep.csv`,
contribution at 100 % vs 50 % attendance: Mode 1 **0.2187 vs 0.5196**, Mode 2
**0.2766 vs 0.3990**, Mode 3 **−1.6358 vs +0.1667**. In Mode 3 at hackathon fees,
the platform only makes money if half the jury disappears. Rule 1 exists so the
business is never built on that.

## D14 — Testnet only, all modes

**Decision.** **All modes run on Arc testnet with test USDC.** World ID uses
staging/IDKit in the demo and a mock verifier in tests. 0G runs through the AI
adapter interface, with a fixture adapter in tests. **Every screen that involves
money carries a TESTNET badge.** Demo-speed deadlines are labelled as demo
settings (V4 §8).

**Rationale.** V4 §12 and §16 ("Production with real money: not approved"), and
V4 §17.6 (legal review by jurisdiction). Mode 3's crowdfund especially needs a
legal opinion.

**Consequences.** No mainnet addresses or config anywhere in the repo. Real money
is a separate future decision that needs the V4 §17 gates closed and legal sign-off.

---

## Per-mode revenue model

All figures per attempt at default assumptions, from `out/summary.csv` and
`out/mode3_scenarios.csv`. *Contribution* = platform revenue − variable cost,
before fixed costs.

### Mode 1 — Solo vs NPC (one person + their AI vs an NPC AI)

| | |
|---|---|
| **Who pays** | The person filing: **1.20** (1.00 with the 0G Pass) = 0.90 jury pool + 0.10 protocol + 0.20 AI |
| **Platform keeps** | Protocol + AI fee **only on a verdict**; forfeits + unearned bonus when jurors no-show (V4 §9) |
| **Refunds** | Full 1.20 on NO VERDICT, recruitment failure, AI failure or protective cancel |
| **Free tier** | Teaser (D3), a funnel cost of 0.0192 per paid trial |
| **Revenue** | **0.3466** = fees 0.2431 + forfeits 0.1036 (29.9 %) |
| **Variable cost** | **0.0629** (0G 0.0143 · teasers 0.0192 · gas 0.0195 · infra 0.0047 · stipends 0.0051) |
| **Contribution** | **+0.2837** (81.9 %); **+0.2187** at 100 % attendance |
| **Breakeven** | 1,763 trials/month (A14 infra) · 52,866 (A15 team) |
| **Not modelled** | Cosmetic upsells (share-card styles, Rap Sheet themes) are possible later revenue. They are deliberately left out of the numbers |

### Mode 2 — Versus (two people, one AI agent each)

| | |
|---|---|
| **Who pays** | Both sides, **0.70 each** (D4); 0.20 per side waived with that side's Pass (D12) |
| **Platform keeps** | 0.10 protocol + 0.40 AI on a verdict; forfeits per V4 §9 (D13) |
| **Refunds** | Each side's own 0.70 on any failure; nothing charged if the other side never consents (D6) |
| **Revenue** | **0.3561** = fees 0.2836 + forfeits 0.0725 (20.4 %) |
| **Variable cost** | **0.0521** (0G 0.0298 incl. abandoned intakes · gas 0.0152 · infra 0.0036 · stipends 0.0036) |
| **Contribution** | **+0.3039** (85.4 %); **+0.2766** at 100 % attendance |
| **Breakeven** | 1,646 initiated cases/month · 49,356 |
| **Main risk** | Consent abandonment (A18): 60 % → +0.168 |

### Mode 3 — Grand Jury (public issue, anyone can join)

| | Hackathon (capped budget) | Launch (Sponsored Docket) |
|---|---:|---:|
| **Who pays** | Spectator crowdfund, 7.30 target | Spectator crowdfund, 7.80 target + sponsor ≥ 2.00 per funded case |
| **Platform keeps** | 0.50 + 0.50 fees on a verdict; forfeits | 1.00 + 0.50 fees on a verdict; sponsor fee per seated trial; forfeits |
| **Refunds** | Pro rata on any failure or NO VERDICT (D9) | same; sponsor refunded if cancelled before voting |
| **Revenue / published case** | **1.0478** (forfeits 55.5 %) | **2.4098** (forfeits 24.1 %) |
| **Variable cost** | **2.1993** (review 2.00) | **1.6993** (review 1.50) |
| **Contribution** | **−1.1515** | **+0.7105** (e = 0) · **+0.5673** (e = 1) |
| **At 100 % attendance** | −1.6358 | +0.2749 (e = 0) · +0.1597 (e = 1) |
| **Cap / gate** | ≤ 40 cases ≈ 46.06 test USDC | Sponsor committed before publication; launch gate in D10 |

The crowd vote and spectating are free and earn nothing (D11). Spectators are a
pure cost (A24), which is why Mode 3's revenue has to come from summoners and
sponsors, not views.

---

## Implementation constants (for the contract, AI and app phases)

| Constant | Mode 1 | Mode 2 | Mode 3 (hackathon) | Mode 3 (launch) | Source |
|---|---:|---:|---:|---:|---|
| N / jurors | 1 / 3 | 1 / 3 | 3 / 7 | 3 / 7 | V4 §9, D7 |
| Bond per juror | 0.40 | 0.40 | 1.20 | 1.20 | 0.40 × N |
| Success bonus per juror | 0.30 | 0.30 | 0.90 | 0.90 | 75 % of bond |
| Failed-trial bonus per timely juror | 0.20 | 0.20 | 0.20 | 0.20 | V4 §9 |
| Jury pool | 0.90 | 0.90 | 6.30 | 6.30 | (2N+1) × bonus |
| Protocol fee | 0.10 | 0.10 | 0.50 | 1.00 | V4 §9, D4, D10 |
| AI fee | 0.20 | 0.20 × 2 | 0.50 | 0.50 | V4 §9, D4, D10 |
| Case charge | 1.20 | 1.40 (0.70 + 0.70) | 7.30 | 7.80 | sum |
| Sponsor deposit | — | — | optional | ≥ 2.00 | D9, D10 |
| Verdict threshold | 2 of 3 | 2 of 3 | 4 of 7 | 4 of 7 | N + 1, D8 |
| Ballot labels | GUILTY / NOT COOKED | SIDE A / SIDE B | reviewed titles | reviewed titles | D5, D8 |
| Pass waiver | 0.20 | 0.20 per side | none | none | D12 |
| Incident stipend (platform funds) | 0.20 | 0.20 | 0.20 | 0.20 | V4 §8 |
| Recruitment / commit / reveal | 30 / 20 / 10 min | 30 / 20 / 10 min | 30 / 20 / 10 min | 30 / 20 / 10 min | V4 §8 |
| Pre-trial window | — | 24 h consent | 48 h funding | 48 h funding | D4, D9 |
| Min contribution | — | — | 0.10 | 0.10 | D9 |
| Network | Arc testnet | Arc testnet | Arc testnet | Arc testnet | D14 |

All values are written into each case at creation and are immutable for that case.

---

## What is verified, and what is not

**Verified (for this record):**
- `python3 docs/economics/cringe_econ.py` reproduces every PR #18 number unchanged
  (1.20 / 1.40 / 7.30 charges; +0.2837 / +0.3039 / −1.1515; break-evens 2.97 /
  2.05 / 0.84) and passes its V4 §9 self-test.
- 14 unit tests (`docs/economics/test_cringe_econ.py`) pin those numbers and the
  D10 properties: launch pricing positive at every tested elasticity and at
  100 % attendance, single-lever failures, and committed CSVs equal to fresh output.
- Every number in this record was copied from the regenerated CSVs.

**Not verified:**
- **Every A-number is an assumption.** That includes the new **A26** (funding
  elasticity: the shape is a guess, so it is tested at 0 / 0.5 / 1 / 2) and
  **A27** (hackathon cap), the 1.50 review target and the 2.00 sponsor ask. No
  sponsor has been asked; whether one pays 1.00 per 1,000 views is unknown.
- 0G prices (A5/A6), Arc gas (A9) and World ID cost (A10) are **not checked
  against live price lists** (V4 §17 gates 1–3).
- **No legal review** of the Mode 3 crowdfund, the sponsor slot or the juror
  payment model (V4 §12, §17.6).
- The decisions are product judgments. They are not tested with users.

## Reproduce

```bash
python3 docs/economics/cringe_econ.py                     # self-test, regenerate out/*.csv, print scenarios
python3 -B -m unittest discover -s docs/economics -v      # 14 regression tests
```
