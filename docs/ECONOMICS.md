# CringeCourt — Economics Model, All Three Modes

**Companion to** `docs/GAME-MODES.md`. **Extends** V4 §9 "Original revenue model:
unchanged" (`idea/CringeCourt_V4_Product_Vision_Fairness_Fixes(1).md`), keeping its
rules and format.

**Figures are USDC-denominated test values, not promised real-money returns**
(V4 §9). Every number not quoted from V4 is labelled **ASSUMPTION (A#)** and listed
in §7. All derived figures come from `docs/economics/cringe_econ.py` (stdlib
Python, exact enumeration, no randomness). Its output is in
`docs/economics/out/*.csv`. Re-run it after changing any assumption (§8).

> **Principle carried over from V4 §1:** this model does not change the jury
> rules. It adds what V4 leaves out: costs, margin, breakeven and sensitivity.

**Unit of account:** one **case attempt** = one case filed (Mode 1), one Versus
case initiated (Mode 2), or one public case published for crowdfunding (Mode 3).
Expected values per attempt include the attempts that never reach a verdict.

---

## 1. Mode 1 — Solo vs NPC (V4 Mode A)

### Rules — unchanged from V4 §9

For a jury of **2N + 1**, N = 1:

| Rule | Amount | Source |
|---|---|---|
| Stake / attendance bond per juror | **0.40 × N = 0.40 USDC** | V4 §9 |
| Additional successful-trial reward to each timely juror | **75 % of bond = 0.30 USDC** | V4 §9 |
| Creator's jury reward pool | **(2N + 1) × 0.30N = 0.90 USDC** | V4 §9 |
| Failed-trial reward to a timely juror (no verdict due to absences) | **0.20 USDC**, from forfeited bonds | V4 §9 |
| Protocol fee | **0.10 USDC** (illustrative) | V4 §9 |
| Standard AI fee | **0.20 USDC** (illustrative); **0** with 0G Compute Pass | V4 §9, §11 |
| **Creator total** | **1.20 USDC** standard / **1.00 USDC** with Pass | V4 §9, §11 |

The V4 §9 settlement table applies verbatim. The calculator reproduces it in its
self-test: protocol gross on top of fees is 0.00 / 0.70 / 0.00 / 0.60 / 1.20 for
3 votes / 2 agree + 1 absent / 2 split + 1 absent / 1 vote / 0 votes.

### Revenue sources

1. Protocol fee 0.10 and AI fee 0.20, **kept only when there is a verdict**.
   No-verdict refunds the full charge including fees (V4 §1, §9).
2. Forfeited bonds plus unearned bonus allocations in the absentee branches (V4 §9).

### Cost per trial

| Cost line | Per prepared trial | Expected per attempt | Basis |
|---|---:|---:|---|
| **0G inference** (6 calls: intake/sanitize, NPC prosecution, user's advocate, 2 objections, judge intro, sentence; 13,300 in / 2,250 out tokens × 1.5 retries) | 0.0150 | 0.0143 | A5–A8. Runs only after the jury fills (V4 §6 step 5), so 0.95 × 0.0150 |
| Free AI teasers (4 per paid trial, 3 calls each) | — | 0.0192 | A12 |
| Arc gas paid by platform (fingerprint + finalize/settle; refund tx on failed recruitment) | 0.0200 | 0.0195 | A9. Jurors and creator pay their own tx |
| World ID verification | 0.0000 | 0.0000 | A10 |
| Variable infra | 0.0050 | 0.0047 | A11 |
| Platform-fault stipends (V4 §8, 0.20 × completed jurors × 1 % incidents) | — | 0.0051 | A4 |
| **Total variable cost** | | **0.0629** | |

### Expected unit economics (per attempt, default assumptions)

| | USDC |
|---|---:|
| Case charges escrowed (GMV) | 1.1286 |
| Fees kept (verdict cases only) | 0.2431 |
| Forfeits + unearned bonus | 0.1036 |
| **Platform revenue** | **0.3466** |
| Variable cost | 0.0629 |
| **Contribution** | **0.2837** |
| **Contribution margin** (of platform revenue) | **81.9 %** |
| Share of revenue from absences | 29.9 % |
| Verdict rate per attempt | 81.0 % |

**Breakeven:** **1,763 trials / month** to cover A14 fixed infra (500 USDC/month);
**52,866 trials / month** to cover A15 lean team + ops (15,000 USDC/month).

**Reading it:** inference is cheap (about 0.015 USDC, 5 % of the 0.30 fees).
The cost that matters is the **free teaser funnel**, which at 4 teasers per paid
trial costs more than the paid trial's own inference. The margin looks high only
because fixed costs sit outside it. At test-value prices Mode 1 needs about 1,800
trials a month just to keep the lights on.

---

## 2. Mode 2 — Versus (V4 Mode B, one AI agent per side)

### Rules

| Rule | Amount | Source |
|---|---|---|
| Jury | 3 jurors; bond 0.40, success bonus 0.30, pool 0.90, failed-trial bonus 0.20 | V4 §9 (same court as Mode 1) |
| Protocol fee | **0.10 USDC** | ASSUMPTION A17 (same as Mode 1) |
| AI fee | **0.20 USDC per side = 0.40** (one advocate agent each) | ASSUMPTION A17 |
| **Case total** | **1.40 USDC** | derived |
| Split | **50/50: 0.70 USDC each** | V4 §4B |
| No consent / not funded | Case never goes public; paid halves refunded | V4 §4B |
| No verdict | Each side gets its own 0.70 back | V4 §9 full-refund rule, split |
| Winner | Bragging rights only; no transfer between sides | V4 §4B |

### Settlement table (after final deadline), N = 1

| What happened? | Verdict? | Timely juror's payout | Each side's outcome | Protocol gross **in addition to fees** |
|---|---|---|---|---:|
| 3 jurors vote | Yes | 0.40 back + 0.30 | Verdict; no refund | 0.00 |
| 2 vote alike; 1 absent | Yes | 0.40 back + 0.30 | Verdict; no refund | 0.70 |
| 2 vote oppositely; 1 absent | No | 0.40 back + 0.20 | **0.70 refund each** | 0.00 |
| 1 votes; 2 absent | No | 0.40 back + 0.20 | 0.70 refund each | 0.60 |
| 0 vote | No | — | 0.70 refund each | 1.20 |
| Platform-caused inability to vote | Cancel | Bonds back; 0.20 from platform funds | 0.70 refund each | none |

### Cost per trial

| Cost line | Per prepared trial | Expected per attempt | Basis |
|---|---:|---:|---|
| **0G inference** (11 calls: 2 private intake interviews, 2 arguments, 2 rebuttals, 2 approval drafts, balance check, judge intro, sentence; 37,500 in / 5,950 out × 1.5) | 0.0415 | 0.0298 | A16; incl. abandoned-case intake (A18) |
| Arc gas | 0.0200 | 0.0152 | A9 |
| World ID | 0.0000 | 0.0000 | A10 |
| Infra | 0.0050 | 0.0036 | A11 |
| Fault stipends | — | 0.0036 | A4 |
| **Total variable cost** | | **0.0521** | |

### Expected unit economics (per initiated Versus case)

| | USDC |
|---|---:|
| Case charges escrowed | 0.9217 |
| Fees kept | 0.2836 |
| Forfeits + unearned bonus | 0.0725 |
| **Platform revenue** | **0.3561** |
| Variable cost | 0.0521 |
| **Contribution** | **0.3039** |
| **Contribution margin** | **85.4 %** |
| Verdict rate per initiated case | 56.7 % (30 % never get both consents, A18) |

**Breakeven:** **1,646 initiated cases / month** (infra) · **49,356** (team).

**Reading it:** two agents cost about 2.8× Mode 1's inference, but at 0.04 USDC it
is still small next to an extra 0.20 fee. The real swing factor is **consent
abandonment** (A18): at 60 % abandonment contribution falls to 0.168 (§5).

---

## 3. Mode 3 — Grand Jury (public issue, crowd, spectators)

### Rules

| Rule | Amount | Source |
|---|---|---|
| Jury | **2N + 1 = 7**, N = 3 | ASSUMPTION A19; formula V4 §9 |
| Bond per juror | 0.40 × 3 = **1.20 USDC** | V4 §9 formula |
| Success bonus | 75 % = **0.90 USDC** | V4 §9 formula |
| Jury reward pool | 7 × 0.90 = **6.30 USDC** | V4 §9 formula |
| Failed-trial bonus | **0.20 USDC** per timely juror, from forfeits | V4 §9 |
| Verdict needs | **N + 1 = 4 matching revealed votes** | ASSUMPTION A19 (generalises V4 §7 "two of three") |
| Protocol fee / AI fee | **0.50 / 0.50 USDC** | ASSUMPTION A20 |
| **Crowdfund target** | **7.30 USDC** (≈ 14.6 contributors at 0.50 average) | derived; A21 |
| Crowd vote, spectating | Free, points-only, not binding | V4 §4C, §14 |
| Not funded / no verdict | Contributions refunded pro rata | mirrors V4 §1 creator refund |

**Coverage check (V4 §9 "Why the failed-trial minimum is covered"), any N:** one
absent bond of 0.40N exactly covers 0.20 for each of the other 2N timely jurors,
so forfeits always cover the failed-trial bonus. The calculator asserts this for
N = 1…7.

### Settlement table, N = 3 (7 jurors), after final deadline

| Timely jurors | Verdict? | Timely juror's payout | Funders' outcome | Protocol gross **in addition to fees** |
|---|---|---|---|---:|
| 7 | Yes | 1.20 back + 0.90 | No refund | 0.00 |
| 6 | Yes (≥ 4 agree) | 1.20 back + 0.90 | No refund | 2.10 |
| 6 | No (3–3) | 1.20 back + 0.20 | Full 7.30 refund | 0.00 |
| 5 | Yes (≥ 4 agree) | 1.20 back + 0.90 | No refund | 4.20 |
| 5 | No (3–2) | 1.20 back + 0.20 | Full refund | 1.40 |
| 4 | Yes (4–0) | 1.20 back + 0.90 | No refund | 6.30 |
| 4 | No | 1.20 back + 0.20 | Full refund | 2.80 |
| 3 / 2 / 1 | No | 1.20 back + 0.20 | Full refund | 4.20 / 5.60 / 7.00 |
| 0 | No | — | Full refund | 8.40 |

### Cost per case

| Cost line | Expected per published case | Basis |
|---|---:|---|
| **0G inference** (sourcing + context card for every case; then prosecution, defense, 4 objections, judge, sentence, 10 spectator commentary beats; 66,800 in / 5,200 out × 1.5 = 0.0618 per prepared trial) | 0.0388 | A22 |
| **Human sourcing / legal review** | **2.0000** | A23. Every published case, funded or not |
| Spectator delivery (2,000 views) | 0.1129 | A24 |
| Crowd votes (500, offchain) | 0.0141 | A24 |
| Arc gas | 0.0214 | A9 |
| World ID, infra, fault stipends | 0.0122 | A10, A11, A4 |
| **Total variable cost** | **2.1993** | |

### Expected unit economics (per published case)

| | USDC |
|---|---:|
| Crowdfund escrowed | 4.1194 |
| Fees kept | 0.4667 |
| Forfeits + unearned bonus | 0.5812 |
| **Platform revenue** | **1.0478** |
| Variable cost | 2.1993 |
| **Contribution** | **−1.1515** |
| Contribution margin | −109.9 % |
| Share of revenue from absences | **55.5 %** |
| Verdict rate per published case | 46.7 % |

**Breakeven: never at default values; each case loses money before fixed
costs.** Solved by the calculator (`out/mode3_breakeven.csv`), each holding
everything else at default:

| Lever | Break-even value | Default |
|---|---:|---:|
| Protocol fee per case | **≥ 2.97 USDC** | 0.50 |
| Sponsor revenue per funded case | **≥ 2.05 USDC** | 0 |
| Human review cost per published case | **≤ 0.84 USDC** | 2.00 |

**Reading it:** the AI is not the problem (0.04). **Human review of public-figure
cases is.** That review is required by V4 §12, so don't cut it to rescue the
margin. Mode 3 is also the most absence-dependent mode: 55 % of its revenue comes
from forfeits, which sharpens V4 §9's disclosed conflict (§5). **Default decision
(GAME-MODES D10):** run Mode 3 at the hackathon as a capped marketing cost
(≈ 1.15 USDC per published case), and re-price before any launch.

---

## 4. Side-by-side headline (default assumptions, per attempt)

| | Mode 1 Solo vs NPC | Mode 2 Versus | Mode 3 Grand Jury |
|---|---:|---:|---:|
| Jury | 3 | 3 | 7 |
| Price | 1.20 (1.00 Pass) | 1.40 (0.70 / side) | 7.30 crowdfund |
| 0G inference per prepared trial | 0.0150 | 0.0415 | 0.0618 |
| Platform revenue | 0.3466 | 0.3561 | 1.0478 |
| Variable cost | 0.0629 | 0.0521 | 2.1993 |
| **Contribution** | **0.2837** | **0.3039** | **−1.1515** |
| Contribution margin | 81.9 % | 85.4 % | −109.9 % |
| Revenue from absences | 29.9 % | 20.4 % | 55.5 % |
| Breakeven, 500/mo infra | 1,763 / mo | 1,646 / mo | never |
| Breakeven, 15,000/mo team | 52,866 / mo | 49,356 / mo | never |

---

## 5. Sensitivity

One-at-a-time, all others at default. Contribution per attempt, USDC
(full table: `out/sensitivity.csv`).

| Assumption | Low → high | Mode 1 | Mode 2 | Mode 3 |
|---|---|---|---|---|
| A1 juror completion `p` | 0.70 → 0.98 | 0.398 → 0.232 | 0.347 → 0.283 | −0.447 → −1.530 |
| A2 guilty lean `g` | 0.50 → 0.85 | 0.274 → 0.329 | 0.295 → 0.342 | −1.234 → −0.912 |
| A5 0G input price /1M | 0.10 → 5.00 | 0.299 → 0.112 | 0.320 → 0.123 | −1.127 → −1.432 |
| A6 0G output price /1M | 0.30 → 15.00 | 0.295 → 0.154 | 0.312 → 0.217 | −1.145 → −1.220 |
| A8 retry factor | 1.0 → 3.0 | 0.288 → 0.270 | 0.314 → 0.274 | −1.139 → −1.190 |
| A3 recruitment failure | 0 → 25 % | 0.300 → 0.218 | 0.321 → 0.238 | −1.106 → −1.335 |
| A4 platform incidents | 0 → 5 % | 0.292 → 0.249 | 0.311 → 0.275 | −1.135 → −1.217 |
| A13 0G Pass share | 0 → 50 % | 0.284 → 0.210 | 0.304 → 0.205 | n/a |
| A9 gas per tx | 0.001 → 0.10 | 0.301 → 0.108 | 0.318 → 0.168 | −1.132 → −1.344 |
| A10 World cost / seat | 0 → 0.05 | 0.284 → 0.134 | 0.304 → 0.199 | −1.152 → −1.362 |
| Protocol fee (M1) | 0.05 → 0.50 | 0.243 → 0.608 | — | — |
| A18 Versus abandonment | 10 → 60 % | — | 0.395 → 0.168 | — |
| A21 Mode 3 funding success | 30 → 90 % | — | — | −1.587 → −0.716 |
| A23 Mode 3 review cost | 0.50 → 6.00 | — | — | **+0.349** → −5.152 |
| A24 spectators / case | 200 → 50,000 | — | — | −1.050 → −3.860 |
| A20 Mode 3 protocol fee | 0.25 → 3.00 | — | — | −1.268 → +0.015 |
| A25 sponsor / funded case | 0 → 5.00 | — | — | −1.152 → **+1.670** |

**What moves the answer:**

1. **Attendance, in the wrong direction (V4 §9's disclosed conflict, quantified).**
   From `out/attendance_sweep.csv`: Mode 1 contribution is 0.219 USDC if every
   juror shows up, and **0.520** if only half do. The platform earns more from
   worse juries in every mode. This is why V4's safeguards (immutable deadlines,
   direct vote path, auditable assignment) are not optional.
2. **Per-seat and per-tx costs scale with jury size.** World verification at
   0.05 per seat, or gas at 0.10 per tx, halves Mode 1's contribution. Confirm
   both prices (V4 §17 gates 1 and 3) before committing to fees.
3. **The 0G Compute Pass discount costs more than it saves:** it waives a 0.20
   fee to avoid about 0.015 of inference. Every Pass trial lowers contribution by
   about 0.15–0.20. That is fine as a sponsor-track feature (V4 §2), but it is a
   subsidy, not a saving.
4. **Mode 3 lives or dies on review cost and sponsorship**, not on inference.
   Spectators are a pure cost (no per-viewer revenue): 50,000 viewers cost about
   2.8 USDC per case.
5. **Inference pricing is a second-order risk**: even 10× the assumed 0G output
   price leaves Modes 1–2 positive.

---

## 6. Sanity checks performed

- V4 §9 numbers reproduced exactly by the code's self-test: 0.40 / 0.30 / 0.90 /
  1.20 / 1.00, per-juror 0.70 and 0.60, protocol extras 0.00 / 0.70 / 0.00 / 0.60
  / 1.20, creator refund 1.20.
- **Money conservation** asserted on every settlement branch: charge + bonds in =
  juror payouts + refunds + protocol fees + protocol extra out.
- Failed-trial bonus coverage asserted for N = 1…7 and every k < 2N + 1.
- Outcome probabilities sum to 1. Three revealed binary votes always produce a
  2-of-3 verdict.
- Mode 1 checked by hand: fees 0.9405 × 0.8614 × 0.30 = 0.2431; forfeits
  0.9405 × (0.243 × 0.545 × 0.70 + 0.027 × 0.60 + 0.001 × 1.20) = 0.1036; costs
  0.0143 + 0.0192 + 0.0195 + 0.0047 + 0.0051 = 0.0629 (rounded per line).

---

## 7. Assumptions table

Numbers marked **REPO** come from V4. Everything else is an **ASSUMPTION**:
plausible, not verified, and meant to be replaced with measured values.

| ID | Assumption | Default | Range tested | Why this value |
|---|---|---:|---|---|
| — | Bond 0.40N, bonus 75 %, failed bonus 0.20, stipend 0.20, protocol fee 0.10, AI fee 0.20, N = 1 | — | — | **REPO** V4 §1, §8, §9, §11 |
| A1 | Juror completes both commit and reveal on time | 0.90 | 0.70–0.98 (sweep 0.50–1.00) | Bonded, opted-in, reminded (V4 §7 UX) |
| A2 | Probability a revealed vote goes GUILTY / Side A | 0.65 | 0.50–0.85 | Confessions lean guilty; drives 2-juror agreement |
| A3 | Recruitment fails to fill the jury | 5 % | 0–25 % | 30-minute window, waiting pool (V4 §8) |
| A4 | Platform-fault protective cancellation | 1 % | 0–5 % | |
| A5 | 0G input price, USD per 1M tokens | 0.50 | 0.10–5.00 | Open-weight 70B-class pricing; **not checked against 0G's live price list** |
| A6 | 0G output price, USD per 1M tokens | 1.50 | 0.30–15.00 | as A5 |
| A7 | Mode 1 token budget | 13,300 in / 2,250 out | — | `out/token_budgets.csv` |
| A8 | Retry / regeneration factor | 1.5 | 1.0–3.0 | Moderation rejects, sanitize retries |
| A9 | Arc gas per tx; platform pays 2 tx per prepared trial (+1 refund tx) | 0.01 USDC | 0.001–0.10 | Jurors/creator pay their own tx |
| A10 | World ID verification cost per seat | 0.00 | 0–0.05 | Assumed free for developers; confirm (V4 §17.1) |
| A11 | Variable infra per prepared trial | 0.005 | — | Storage, RPC, bandwidth |
| A12 | Free teasers per paid Mode 1 trial | 4 | — | Funnel guess; 3 calls each, no retries |
| A13 | Share of trials using 0G Compute Pass | 0 % | 0–50 % | Feature unconfirmed (V4 §17.2) |
| A14 | Fixed infra per month | 500 USDC | — | Hosting, RPC, indexer, monitoring |
| A15 | Lean team + ops + moderation per month | 15,000 USDC | — | Post-hackathon scenario |
| A16 | Mode 2 token budget | 37,500 in / 5,950 out | — | Two 4-turn intakes + per-side drafts |
| A17 | Mode 2 protocol fee 0.10; AI fee 0.20 per side | 0.10 / 0.40 | — | Mirrors Mode 1 per agent (GAME-MODES D4) |
| A18 | Initiated Versus cases that never get both consents and funds | 30 % | 10–60 % | Side A intake still costs inference |
| A19 | Grand jury N = 3 (7 jurors), verdict needs N + 1 matching | — | — | GAME-MODES D7, D8 |
| A20 | Mode 3 protocol fee / AI fee | 0.50 / 0.50 | protocol 0.25–3.00 | |
| A21 | Mode 3 crowdfund success; average contribution | 60 %; 0.50 | 30–90 % | |
| A22 | Mode 3 token budget | 66,800 in / 5,200 out | — | Incl. 10 spectator commentary beats |
| A23 | Human sourcing/legal review per published case | 2.00 | 0.50–6.00 | ~10 min editor time; required by V4 §12 |
| A24 | Spectators 2,000 × 0.0001; crowd votes 500 × 0.00005 | — | 200–50,000 viewers | Cached frozen transcript, no per-view AI |
| A25 | Sponsor revenue per funded Mode 3 case | 0 | 0–5.00 | No ads by default |

---

## 8. Reproduce

```bash
python3 docs/economics/cringe_econ.py          # self-test + writes out/*.csv
python3 docs/economics/cringe_econ.py --check  # self-test only
```

| Output | Contents |
|---|---|
| `out/summary.csv` | Per-mode revenue, costs by line, contribution, margin, breakeven |
| `out/outcomes.csv` | Every settlement branch with probability and money flows |
| `out/sensitivity.csv` | One-at-a-time low/high for 17 assumptions × 3 modes |
| `out/attendance_sweep.csv` | Fees vs forfeits as juror attendance varies |
| `out/mode3_breakeven.csv` | Solved break-even fee / sponsor / review cost |
| `out/parameters.csv` | Every parameter with REPO/ASSUMPTION source |
| `out/token_budgets.csv` | Per-call token budgets per mode |

To change an assumption, edit the `P` table at the top of the script and re-run.
Then update the numbers in this doc. They are copied from `out/summary.csv`, not
computed in the doc.

*Not a financial guarantee, legal opinion or audited model. Real-money operation
remains unapproved (V4 §16).*
