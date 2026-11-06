# CringeCourt — Game Modes

**Document type:** product brief, same register as the V4 idea doc
(`idea/CringeCourt_V4_Product_Vision_Fairness_Fixes(1).md`, cited below as **V4**).
Not a contract or dApp spec. Companion: `docs/ECONOMICS.md` (the numbers).
**Status:** proposal, 2026-11-02. Nothing here overrides a V4 decision; where V4
is silent a default is chosen and listed under *Open decisions*.

The team works with three modes:

| # | Working name | One line |
|---|---|---|
| **1** | **Solo vs NPC** | One person + their AI advocate vs an AI (NPC) opponent; a human jury decides |
| **2** | **Versus** | Two real people (e.g. a couple's dispute), each with their own AI agent; a human jury decides |
| **3** | **Grand Jury** | A public or famous issue with crowd jurors, crowd voting and spectators |

---

## 1. Audit: which modes already exist in the repo?

Every doc in the repo was searched (`README.md`, `ART-BIBLE-AND-ASSET-MANIFEST.md`,
`cc-art/dist/*.md`, `judge/README.md`, `idea/*.md`, and the open PR branches).
Only V4 describes product modes. The art docs only cast characters for them.

| Mode | Exists? | Where | What is there | What is missing |
|---|---|---|---|---|
| **1 Solo vs NPC** | **Partly** — as V4 **Mode A "Solo / Confession Court"** | V4 §4 Mode A; §3; §5 (cast); §6 (journey); §9 (economics); §11 (AI roles); §14 Essential MVP #1; §16 | A single person files a confession; "the AI prosecution and defense turn it into a funny case"; a verified jury decides GUILTY / NOT COOKED (§4A). Miss Ratio prosecutes, Counsel Chaos defends (§5). A "free AI teaser" with usage limits and a paid "community jury trial" (§4A). Full jury economics (§9). | V4 never says the defense is **the user's** advocate or that the prosecutor is an **NPC opponent**; the AI writes both sides for the show (§11 "The prosecutor argues, the defense responds"). No user input to their advocate after filing. The teaser is one sentence, with no spec. |
| **2 Versus** | **Partly** — as V4 **Mode B "Versus Court"** | V4 §4 Mode B; §1 item 8; §2 (Agent Pass); §6 steps 1, 4; §12; §14 "Next"; §16 "Consent-based, 50/50 payment preferred; second-stage feature" | Two consenting people, private accounts, mutual approval, Side A / Side B pseudonyms, "AI produces balanced presentations", 50/50 fee split, refund if one side won't consent or fund, both excluded from the jury, no wager (§4B). Art: Side A/B characters (art bible Part 2 #5; PR `feat/versus-sides`). | **No per-party AI agent**: V4 has one AI producing "balanced presentations". No numbers at all: no price, no AI fee for two sides, no cost of the extra AI work, no consent-failure cost. |
| **3 Grand Jury** | **Only a precursor** — V4 **Mode C "Viral Cases"** | V4 §4 Mode C; §11 ("Daily featured trial"); §12; §14 Stretch; §16 "Sourced, safe, points-only initially" | A browsable feed of sourced public controversies, AI commentary, **points-only** audience predictions, "no real-money betting on celebrity cases" (§4C, §14). | **No jurors, no verdict, no spectating flow, no economics.** V4 Mode C is a prediction feed, not a trial. Crowd jurors and spectators appear nowhere. The art bible's gallery/audience NPCs (Part 2 #8) are set dressing, not a mode. |

**Economics found for Mode 1 (V4 §9, §11, §8, §1):**

| Item | V4 value | Section |
|---|---|---|
| Jury | 2N+1; MVP N = 1 → 3 jurors | §9, §16 |
| Bond per juror | 0.40 × N = **0.40 USDC**, refundable | §9 |
| Success bonus | 75 % of bond = **0.30 USDC** per timely juror | §1, §9 |
| Creator jury reward pool | (2N+1)(0.30N) = **0.90 USDC** | §9 |
| Protocol fee | **0.10 USDC** (illustrative) | §9 |
| Standard AI fee | **0.20 USDC** (illustrative); waived with 0G Compute Pass | §9, §11 |
| Creator total | **1.20 USDC** standard / **1.00 USDC** with Pass | §9, §11 |
| Failed-trial bonus | **0.20 USDC** per timely juror, from forfeited bonds | §1, §9 |
| Platform-fault stipend | **0.20 USDC** per completed juror, from platform funds | §8 |
| Protocol revenue | Fees on verdicts + forfeited bonds + unearned bonus; settlement table by branch | §1, §9 |
| No-verdict refund | Full creator USDC case charge, **including fees** | §1, §9 |

**What V4 does not model** for Mode 1: AI inference cost per trial, gas, World
verification cost, free-teaser cost, operating costs, margin and breakeven. V4
§9 says only "This is gross revenue, not guaranteed profit; operating costs
still exist", and V4 §8 that platform-fault compensation needs company funds.
`docs/ECONOMICS.md` fills these gaps.

---

## 2. Mode 1 — Solo vs NPC

*Extends V4 Mode A. V4 economics (§9) apply unchanged.*

**Fantasy:** "My lawyer is on my side, the prosecutor is out to cook me, and
real people decide."

| Role | Who | Notes |
|---|---|---|
| **Defendant / client** | The person filing (V4 "creator") | Shown via the anonymous defendant portrait, never their face (V4 §5, §12) |
| **Your advocate** | **Counsel Chaos**, an AI agent working *for* the user | Gets the user's private story and their chosen defense angle |
| **NPC opponent** | **Miss Ratio**, an AI agent working *against* the user | Sees only the approved public text, never the private notes |
| **Host** | **Judge Gavel.exe** | Introduces evidence, reads the human verdict, adds a sentence; cannot change votes (V4 §5) |
| **Jury** | 3 random World-verified humans | V4 §6, §7, §10 unchanged |

**Flow** (V4 §6 steps, with the Mode 1 additions in bold):

1. File the confession; pick a category (V4 §4A).
2. **Brief your advocate:** pick one of 3 AI-suggested defense angles
   ("it was a bullish keyboard", "market conditions", "emotional damages")
   or write one line. This is the only input that shapes "your" side.
3. Approve the sanitized public text. **The advocate's and opponent's
   arguments are generated once and frozen before voting** (V4 §6 step 5, §12).
   The user may reject the frozen draft once before paying, with no live
   steering after that.
4. Pay 1.20 USDC (1.00 with the 0G Compute Pass), recruit, vote, reveal, settle,
   share: all as V4 §6–§9.

**Free teaser (V4 §4A "lightweight free AI teaser"):** runs steps 1–2 plus the
opening statements only. **No AI verdict.** It ends on "THE JURY IS OUT"
with an upgrade button. Keeping the AI from deciding preserves V4 §15 ("the AI
doesn't decide who's right"). Rate-limited per verified human or device.

**Fairness note:** the opponent is an NPC, but it must not be a pushover.
The same model and token budget serve both sides, and a balance check runs
before freezing, so the jury judges the confession, not a rigged debate.

---

## 3. Mode 2 — Versus (two people, two agents)

*Extends V4 Mode B. Same three-juror court, same V4 §9 jury rules.*

**Fantasy:** "Settle it. My agent vs your agent, and strangers decide who's right."

| Role | Who |
|---|---|
| **Side A / Side B** | Two consenting people, pseudonymous (V4 §4B) |
| **Agent A / Agent B** | One AI advocate **per side**. Each interviews its own person privately, drafts that side's case and rebuttal, and never sees the other side's private notes |
| **Host** | Judge Gavel.exe; a neutral balance check runs before freezing |
| **Jury** | 3 random verified humans; both parties excluded (V4 §4B, §6 step 4, §10) |

**Flow:**

1. Side A opens a case and invites Side B. Nothing is public yet.
2. **Each side does a short private intake with its own agent** (about 4 turns).
3. Each side reads and approves **its own** sanitized argument, and sees the
   other side's approved public version before final consent (V4 §4B
   "Each reads and approves… before the court opens").
4. Each side funds **its half: 0.70 USDC** (see `ECONOMICS.md` §2). If either
   side declines or fails to fund by the consent deadline, the case dies
   privately and any paid half is refunded (V4 §4B).
5. Jury, ballots, verdict, settlement as V4 §6–§9. The verdict is **SIDE A** /
   **SIDE B** instead of GUILTY / NOT COOKED. No-verdict refunds each side its
   own 0.70.
6. Winner gets bragging rights and a share card only. **No wager, no transfer
   between the sides** (V4 §4B).

**Couples-specific safeguards:** a one-tap "withdraw consent" until funding
closes; no real names, photos or contact details in either intake (the agent
redacts them); a cooling-off notice on topics that look like abuse, money
disputes or custody. Those are routed out of the product, not into court
(V4 §12 "No doxxing… sensationalized real-world legal allegations").

**Optional (V4 §2, §4B):** World Agent Pass fresh human approval before an
agent publishes a side. It is not an MVP dependency.

---

## 4. Mode 3 — Grand Jury (public issues, crowd, spectators)

*New. Builds on V4 Mode C and keeps all of its constraints: sourced, safe, no
real-money betting on outcomes, no certifying allegations (V4 §4C, §12, §14).*

**Fantasy:** "The internet's biggest argument goes on trial live, and you're in
the gallery."

Three ways to take part, deliberately separated:

| Layer | Who | Money? | Counts toward the verdict? |
|---|---|---|---|
| **Grand jury** | **7** randomly selected World-verified jurors (N = 3) | Yes. V4 §9 formula with N = 3: bond 1.20, success bonus 0.90 | **Yes, the only binding verdict** |
| **Crowd vote** | Any signed-in spectator | **No.** Points only (V4 §4C) | No. Shown beside the jury result as "THE GALLERY SAYS…" |
| **Spectators** | Anyone | No | No. They watch the frozen trial and the reveal |

**Who pays?** There is no single creator. Spectators **summon the court**: a
crowdfund of small USDC contributions (min 0.10) covers the jury reward pool
and fees (7.30 USDC at default values). If the target isn't met by the deadline,
or the trial ends with NO VERDICT, contributions are refunded pro rata,
mirroring V4's full creator refund. Contributors get **nothing that depends on
the outcome**. That keeps it a ticket to summon a show, not a bet (V4 §4C, §14).
Legal review is still required (V4 §12).

**Case sourcing (V4 §4C, §12):** only sourced public controversies, harmless
memes, historical disputes or consenting community cases. Each case gets a
**human editorial check** before it opens for funding: sources, no allegation
presented as fact, no private individuals, no live legal proceedings. The AI
writes a neutral context card plus both sides; the verdict is framed as a jury
opinion on the *argument*, never on someone's guilt in law.

**Verdict rule:** the V4 §7 rule generalised. A verdict needs **N + 1 = 4
matching revealed votes** out of 7 appointed jurors. Otherwise it's NO VERDICT.

**Spectating:** the frozen transcript is played to everyone (cached, no
per-viewer AI). Live reactions, a sealed-ballot animation while jurors commit,
then the reveal. Gallery NPC sprites fill empty seats.

---

## 5. Open product decisions (with chosen defaults)

> **Resolved in [`DECISIONS.md`](DECISIONS.md).** The table below is the original
> proposal. Where they differ, DECISIONS.md wins. Notable changes: D9 adds a
> sponsor slot, D10 fixes the launch price (Sponsored Docket), D11 hides the
> gallery tally until the jury reveal closes, and D13 adds "no pricing may need
> no-shows".

| # | Decision | Chosen default | Why / alternative |
|---|---|---|---|
| D1 | Is Mode 1's defense the user's advocate? | **Yes, Counsel Chaos represents the user; Miss Ratio is the NPC opponent** | Matches the mode definition. V4 §11 treats both sides as show; this re-frames, it does not change the economics |
| D2 | User input to their advocate in Mode 1 | **One defense angle (pick 1 of 3 or one line), before freezing** | More steering means more inference cost and more prompt-injection risk |
| D3 | Free teaser end state | **Opening statements only, no AI verdict** | Preserves "AI doesn't decide" (V4 §15); alternative: AI "preliminary vibe", rejected |
| D4 | Versus price | **1.40 USDC total = 0.70 per side** (0.90 pool + 0.10 protocol + 0.20 AI × 2 agents) | V4 sets only "50/50 split" (§4B). Alternative: keep 1.20 (0.60 each) and absorb the second agent's cost (~0.03 USDC) |
| D5 | Versus verdict labels | **SIDE A / SIDE B** | GUILTY / NOT COOKED doesn't fit two claimants |
| D6 | Versus intake cost when the other side never consents | **Platform absorbs it; no charge to Side A** | V4 §4B refunds all paid contributions; the cost is about 0.007 USDC |
| D7 | Grand Jury size | **7 (N = 3)** | Larger jury for public cases (V4 §14 Stretch "larger juries"); 5 is cheaper to fund |
| D8 | Grand Jury verdict threshold | **N + 1 matching of the appointed jury (4 of 7)** | Generalises V4 §7 "two matching of three". Alternative: majority of *revealed* votes, which gives fewer NO VERDICTs |
| D9 | Who funds Grand Jury | **Spectator crowdfund ("summon the court"), pro-rata refund on failure / NO VERDICT** | Alternatives: platform-funded featured case, or brand sponsor |
| D10 | Grand Jury fees | **0.50 protocol + 0.50 AI per case — and it loses money at these values** (`ECONOMICS.md` §3) | Break-even needs a protocol fee of about 2.97, a sponsor of about 2.05 per funded case, or review cost ≤ 0.84. **Default: run Mode 3 as a capped marketing budget at hackathon, re-price before launch** |
| D11 | Crowd vote | **Free, points-only, shown beside the jury verdict, never binding** | V4 §4C / §14: no real-money predictions |
| D12 | 0G Compute Pass in Versus | **Per side**: each side that pays with its own credits has its 0.20 agent fee waived | Mirrors V4 §11 per person |
| D13 | Protocol revenue from absences in Modes 2–3 | **Kept, same rule as V4 §9, same disclosure** | V4 §1/§16 "Retained, fully disclosed". `ECONOMICS.md` §5 shows the effect is larger in Mode 3 |
| D14 | Real money | **Testnet only for all modes** | V4 §12, §16 "Production with real money: not approved" |
