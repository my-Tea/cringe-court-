#!/usr/bin/env python3
"""CringeCourt unit-economics calculator for the three game modes.

Stdlib only. Deterministic: outcomes are enumerated exactly (binomial juror
attendance x binomial vote split), no Monte Carlo.

    python3 docs/economics/cringe_econ.py            # writes docs/economics/out/*.csv
    python3 docs/economics/cringe_econ.py --check    # self-tests only

Every parameter is tagged REPO (quoted from the idea doc, with its section) or
ASSUMPTION (ours; see the assumptions table in ECONOMICS.md). All money is
USDC; token prices are treated as USD = USDC.
"""
import csv
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

# --------------------------------------------------------------------------
# Parameters. (value, source, note)
# --------------------------------------------------------------------------
P = {
    # --- jury formula, idea doc section 9 (REPO) ---
    "bond_per_n":        (0.40, "REPO §9", "stake per juror = 0.40 x N USDC"),
    "bonus_rate":        (0.75, "REPO §1/§9", "success bonus = 75% of bond"),
    "fail_bonus":        (0.20, "REPO §1/§9", "per timely juror on no-verdict, paid from forfeits"),
    "incident_stipend":  (0.20, "REPO §8", "per completed juror on protective cancel, platform-funded"),
    # --- Mode 1 fees, idea doc section 9 (REPO, illustrative) ---
    "m1_n":              (1, "REPO §9/§16", "three-juror MVP, J = 2N+1 = 3"),
    "m1_protocol_fee":   (0.10, "REPO §9", "illustrative protocol fee"),
    "m1_ai_fee":         (0.20, "REPO §9/§11", "illustrative standard AI fee; waived with 0G Compute Pass"),
    # --- behaviour (ASSUMPTION) ---
    "p_complete":        (0.90, "A1", "probability a seated juror commits AND reveals on time"),
    "g_guilty":          (0.65, "A2", "probability a revealed vote is GUILTY / Side A"),
    "r_recruit_fail":    (0.05, "A3", "jury not filled before recruitment deadline"),
    "f_incident":        (0.01, "A4", "platform-fault protective cancellation"),
    # --- 0G inference (ASSUMPTION, not checked against 0G's live price list) ---
    "price_in_per_m":    (0.50, "A5", "USD per 1M input tokens on 0G compute"),
    "price_out_per_m":   (1.50, "A6", "USD per 1M output tokens on 0G compute"),
    "retry_factor":      (1.5, "A8", "regenerations, moderation rejects, sanitize retries"),
    # --- chain / identity / infra (ASSUMPTION) ---
    "gas_per_tx":        (0.01, "A9", "Arc tx cost in USDC"),
    "platform_tx":       (2, "A9", "platform-paid tx per prepared trial (fingerprint + finalize/settle)"),
    "world_cost":        (0.00, "A10", "World ID verification cost per juror seat"),
    "infra_var":         (0.005, "A11", "storage/RPC/bandwidth per prepared trial"),
    "teasers_per_paid":  (4, "A12", "free AI teasers served per paid Mode 1 trial"),
    "pass_share":        (0.0, "A13", "share of trials paid with the 0G Compute Pass"),
    "fixed_infra_month": (500.0, "A14", "hosting, RPC, indexer, monitoring per month"),
    "fixed_team_month":  (15000.0, "A15", "lean team + ops + moderation per month"),
    # --- Mode 2 Versus (ASSUMPTION unless tagged) ---
    "m2_n":              (1, "A16", "same three-juror court as Mode 1"),
    "m2_protocol_fee":   (0.10, "A17", "same protocol fee as Mode 1"),
    "m2_ai_fee_per_side": (0.20, "A17", "each side pays for its own advocate agent"),
    "m2_abandon":        (0.30, "A18", "initiated Versus cases that never get both consents + funds"),
    # --- Mode 3 Grand Jury (ASSUMPTION) ---
    "m3_n":              (3, "A19", "grand jury of 7; verdict needs N+1 = 4 matching reveals"),
    "m3_protocol_fee":   (0.50, "A20", "protocol fee per public case"),
    "m3_ai_fee":         (0.50, "A20", "AI fee per public case"),
    "m3_fund_success":   (0.60, "A21", "published public cases that reach their crowdfund target"),
    "m3_avg_contrib":    (0.50, "A21", "average spectator contribution, USDC"),
    "m3_review_cost":    (2.00, "A23", "human sourcing/legal review per published public case"),
    "m3_spectators":     (2000, "A24", "spectator views per funded case"),
    "m3_cost_per_view":  (0.0001, "A24", "CDN/bandwidth per view (frozen transcript, cached)"),
    "m3_crowd_votes":    (500, "A24", "points-only crowd votes per funded case"),
    "m3_cost_per_vote":  (0.00005, "A24", "offchain vote storage per vote"),
    "m3_sponsor":        (0.0, "A25", "sponsorship revenue per funded case"),
    "m3_fund_elasticity": (0.0, "A26", "funding-success elasticity to the crowdfund target; 0 = price-insensitive"),
    "m3_fund_ref_target": (7.30, "A26", "crowdfund target at which A21 funding success was assumed"),
    "m3_hackathon_cap":  (40, "A27", "max published Mode 3 cases during the hackathon marketing budget"),
}

# Token budgets per LLM call: (name, input tokens, output tokens). ASSUMPTION A7/A16/A22.
CALLS = {
    "m1": [("intake + sanitize", 1200, 400), ("prosecution (NPC opponent)", 1500, 600),
           ("defense (player advocate)", 2100, 600), ("objection x2", 5000, 300),
           ("judge intro", 1500, 200), ("sentence", 2000, 150)],
    "teaser": [("intake", 1200, 400), ("prosecution", 1500, 600), ("defense", 2100, 600)],
    "m2": [("side A intake interview (4 turns)", 6000, 1200), ("side B intake interview (4 turns)", 6000, 1200),
           ("side A argument", 2500, 600), ("side B argument", 2500, 600),
           ("side A rebuttal", 3500, 400), ("side B rebuttal", 3500, 400),
           ("side A approval draft", 2000, 500), ("side B approval draft", 2000, 500),
           ("balance check", 5000, 200), ("judge intro", 2000, 200), ("sentence", 2500, 150)],
    "m2_abandoned": [("side A intake interview (4 turns)", 6000, 1200)],
    "m3": [("sourcing + neutral context card", 8000, 1000), ("prosecution", 4000, 800),
           ("defense", 4800, 800), ("objection x4", 14000, 600), ("judge intro", 3000, 300),
           ("sentence", 3000, 200), ("spectator commentary x10", 30000, 1500)],
    "m3_unfunded": [("sourcing + neutral context card", 8000, 1000)],
}


def v(params, key):
    return params[key][0] if isinstance(params[key], tuple) else params[key]


def inference_cost(params, calls, retry=True):
    tin = sum(c[1] for c in calls)
    tout = sum(c[2] for c in calls)
    cost = tin * v(params, "price_in_per_m") / 1e6 + tout * v(params, "price_out_per_m") / 1e6
    return cost * (v(params, "retry_factor") if retry else 1.0), tin, tout


def binom(n, k, p):
    return math.comb(n, k) * p ** k * (1 - p) ** (n - k)


# --------------------------------------------------------------------------
# Settlement of one prepared trial, section 9 rules generalised to J = 2N+1.
# --------------------------------------------------------------------------
def jury_terms(n):
    j = 2 * n + 1
    bond = 0.40 * n
    bonus = 0.75 * bond
    return j, bond, bonus, j * bonus


def settle(n, k, verdict, fees, fail_bonus=0.20):
    """Money flows for k timely jurors. Returns dict; checked for conservation."""
    j, bond, bonus, pool = jury_terms(n)
    charge = pool + fees
    if verdict:
        juror_out = k * (bond + bonus)
        refund = 0.0
        protocol_fees = fees
        extra = (j - k) * bond + (j - k) * bonus      # forfeits + unearned bonus
    else:
        juror_out = k * (bond + fail_bonus) if k else 0.0
        refund = charge                              # full creator refund incl. fees
        protocol_fees = 0.0
        extra = (j - k) * bond - k * fail_bonus      # forfeits minus failed-trial bonuses
    inflow = charge + j * bond
    outflow = juror_out + refund + protocol_fees + extra
    assert abs(inflow - outflow) < 1e-9, (n, k, verdict, inflow, outflow)
    assert extra >= -1e-9, "failed-trial bonus not covered by forfeits"
    return {"k": k, "verdict": verdict, "per_timely_juror": (bond + bonus) if verdict else (bond + fail_bonus if k else 0.0),
            "creator_refund": refund, "protocol_fees": protocol_fees, "protocol_extra": extra,
            "inflow": inflow}


def outcome_distribution(n, p, g):
    """Yield (k, verdict, probability) over attendance and vote split."""
    j = 2 * n + 1
    need = n + 1
    for k in range(j + 1):
        pk = binom(j, k, p)
        p_verdict = sum(binom(k, a, g) for a in range(k + 1) if max(a, k - a) >= need)
        p_verdict = min(1.0, p_verdict) if abs(1 - p_verdict) > 1e-12 else 1.0   # float noise
        if p_verdict > 0:
            yield k, True, pk * p_verdict
        if p_verdict < 1:
            yield k, False, pk * (1 - p_verdict)


def prepared_trial(params, n, fees):
    """Expected platform revenue for one prepared (fully seated) trial."""
    p, g = v(params, "p_complete"), v(params, "g_guilty")
    rows, rev_fees, rev_extra, p_verdict = [], 0.0, 0.0, 0.0
    for k, verdict, pr in outcome_distribution(n, p, g):
        s = settle(n, k, verdict, fees, v(params, "fail_bonus"))
        rows.append({**s, "probability": pr})
        rev_fees += pr * s["protocol_fees"]
        rev_extra += pr * s["protocol_extra"]
        p_verdict += pr * verdict
    return rows, rev_fees, rev_extra, p_verdict


# --------------------------------------------------------------------------
# Mode models. Each returns expected values per case ATTEMPT (one case filed).
# --------------------------------------------------------------------------
def mode1(params):
    n = v(params, "m1_n")
    j, bond, bonus, pool = jury_terms(n)
    pass_share = v(params, "pass_share")
    ai_fee = v(params, "m1_ai_fee") * (1 - pass_share)       # Pass waives the AI fee
    fees = v(params, "m1_protocol_fee") + ai_fee
    rows, rev_fees, rev_extra, p_verdict = prepared_trial(params, n, fees)
    r, f = v(params, "r_recruit_fail"), v(params, "f_incident")
    p_prep = 1 - r                                           # inference runs only after seats fill (§6 step 5)
    p_run = p_prep * (1 - f)
    infer, tin, tout = inference_cost(params, CALLS["m1"])
    infer_platform = infer * (1 - pass_share)
    teaser = inference_cost(params, CALLS["teaser"], retry=False)[0] * v(params, "teasers_per_paid")
    gas = v(params, "gas_per_tx")
    rev = p_run * (rev_fees + rev_extra)
    cost = {
        "inference_0g": p_prep * infer_platform,
        "free_teasers": teaser,
        "gas": p_prep * v(params, "platform_tx") * gas + r * gas,     # r: one refund tx
        "world_id": j * v(params, "world_cost"),
        "infra": p_prep * v(params, "infra_var"),
        "incident_stipends": p_prep * f * j * v(params, "p_complete") * v(params, "incident_stipend"),
    }
    return summarise("Mode 1 Solo vs NPC", params, n, pool + fees, rev, p_run * rev_fees, p_run * rev_extra,
                     cost, p_run * p_verdict, infer, tin, tout, rows, gmv=p_run * (pool + fees))


def mode2(params):
    n = v(params, "m2_n")
    j, bond, bonus, pool = jury_terms(n)
    pass_share = v(params, "pass_share")
    ai_fee = 2 * v(params, "m2_ai_fee_per_side") * (1 - pass_share)
    fees = v(params, "m2_protocol_fee") + ai_fee
    rows, rev_fees, rev_extra, p_verdict = prepared_trial(params, n, fees)
    a, r, f = v(params, "m2_abandon"), v(params, "r_recruit_fail"), v(params, "f_incident")
    p_funded = 1 - a
    p_prep = p_funded * (1 - r)
    p_run = p_prep * (1 - f)
    infer, tin, tout = inference_cost(params, CALLS["m2"])
    abandoned = inference_cost(params, CALLS["m2_abandoned"])[0]
    gas = v(params, "gas_per_tx")
    rev = p_run * (rev_fees + rev_extra)
    cost = {
        # intake interviews run before funding; the rest after seats fill
        "inference_0g": (p_prep * infer + a * abandoned) * (1 - pass_share),
        "free_teasers": 0.0,
        "gas": p_prep * v(params, "platform_tx") * gas + (a * 0.5 + p_funded * r) * gas,
        "world_id": p_funded * j * v(params, "world_cost"),
        "infra": (p_prep + a * 0.2) * v(params, "infra_var"),
        "incident_stipends": p_prep * f * j * v(params, "p_complete") * v(params, "incident_stipend"),
    }
    return summarise("Mode 2 Versus", params, n, pool + fees, rev, p_run * rev_fees, p_run * rev_extra,
                     cost, p_run * p_verdict, infer, tin, tout, rows, gmv=p_run * (pool + fees))


def m3_fund_success(params, target):
    """A21 funding success, cut by (reference target / target) ** A26 elasticity when the target rises.

    One-sided on purpose: a target above the reference lowers success, a cheaper target never raises it
    above A21. Rewarding discounts would rest on extrapolating a guessed curve.
    """
    s0, e = v(params, "m3_fund_success"), v(params, "m3_fund_elasticity")
    return s0 * min(1.0, (v(params, "m3_fund_ref_target") / target) ** e)


def mode3(params):
    n = v(params, "m3_n")
    j, bond, bonus, pool = jury_terms(n)
    fees = v(params, "m3_protocol_fee") + v(params, "m3_ai_fee")
    rows, rev_fees, rev_extra, p_verdict = prepared_trial(params, n, fees)
    s = m3_fund_success(params, pool + fees)
    r, f = v(params, "r_recruit_fail"), v(params, "f_incident")
    p_prep = s * (1 - r)
    p_run = p_prep * (1 - f)
    infer, tin, tout = inference_cost(params, CALLS["m3"])
    unfunded = inference_cost(params, CALLS["m3_unfunded"])[0]
    gas = v(params, "gas_per_tx")
    rev = p_run * (rev_fees + rev_extra + v(params, "m3_sponsor"))
    cost = {
        # the sourcing card is produced for every published case; it is reused
        # when the case is funded, so funded cases pay infer - unfunded more.
        "inference_0g": unfunded + p_prep * (infer - unfunded),
        "human_review": v(params, "m3_review_cost"),
        "spectators": p_run * v(params, "m3_spectators") * v(params, "m3_cost_per_view"),
        "crowd_votes": p_run * v(params, "m3_crowd_votes") * v(params, "m3_cost_per_vote"),
        "gas": p_prep * v(params, "platform_tx") * gas + gas,          # + crowdfund open tx
        "world_id": s * j * v(params, "world_cost"),
        "infra": v(params, "infra_var"),
        "incident_stipends": p_prep * f * j * v(params, "p_complete") * v(params, "incident_stipend"),
    }
    out = summarise("Mode 3 Grand Jury", params, n, pool + fees, rev, p_run * rev_fees, p_run * rev_extra,
                    cost, p_run * p_verdict, infer, tin, tout, rows, gmv=p_run * (pool + fees))
    out["contributors_per_funded_case"] = (pool + fees) / v(params, "m3_avg_contrib")
    out["sponsor_revenue"] = p_run * v(params, "m3_sponsor")
    out["fund_success"] = s
    return out


def summarise(name, params, n, charge, rev, rev_fees, rev_extra, cost, p_verdict, infer, tin, tout, rows, gmv):
    total_cost = sum(cost.values())
    contrib = rev - total_cost
    out = {
        "mode": name, "jury_size": 2 * n + 1, "case_charge": charge,
        "gmv_per_attempt": gmv,
        "revenue_fees": rev_fees, "revenue_forfeits": rev_extra, "revenue_total": rev,
        "forfeit_share_of_revenue": rev_extra / rev if rev else 0.0,
        **{"cost_" + k: c for k, c in cost.items()}, "cost_total": total_cost,
        "contribution": contrib, "margin": contrib / rev if rev else float("nan"),
        "p_verdict_per_attempt": p_verdict,
        "inference_cost_per_prepared_trial": infer, "tokens_in": tin, "tokens_out": tout,
        "breakeven_infra_cases_month": breakeven(v(params, "fixed_infra_month"), contrib),
        "breakeven_team_cases_month": breakeven(v(params, "fixed_team_month"), contrib),
    }
    out["_rows"] = rows
    return out


def breakeven(fixed, contrib):
    return math.ceil(fixed / contrib) if contrib > 0 else float("inf")


MODES = [mode1, mode2, mode3]

# One-at-a-time sensitivity: (param, low, high)
SENS = [
    ("p_complete", 0.70, 0.98),
    ("g_guilty", 0.50, 0.85),
    ("price_in_per_m", 0.10, 5.00),
    ("price_out_per_m", 0.30, 15.00),
    ("retry_factor", 1.0, 3.0),
    ("r_recruit_fail", 0.0, 0.25),
    ("f_incident", 0.0, 0.05),
    ("pass_share", 0.0, 0.50),
    ("gas_per_tx", 0.001, 0.10),
    ("world_cost", 0.0, 0.05),
    ("m1_protocol_fee", 0.05, 0.50),
    ("m2_abandon", 0.10, 0.60),
    ("m3_fund_success", 0.30, 0.90),
    ("m3_review_cost", 0.50, 6.00),
    ("m3_spectators", 200, 50000),
    ("m3_protocol_fee", 0.25, 3.00),
    ("m3_sponsor", 0.0, 5.0),
]


# Mode 3 pricing options for decision D10 (docs/DECISIONS.md). Overrides on P.
# LAUNCH must stay contribution-positive at 100% juror attendance (no forfeit revenue) at every
# tested elasticity: the public mode may not depend on jurors failing (D10, D13).
LAUNCH = {"m3_protocol_fee": 1.00, "m3_sponsor": 2.00, "m3_review_cost": 1.50}
SCENARIOS = [
    ("hackathon: V4-style defaults, capped marketing budget", {}),
    ("fee only: protocol fee raised to break-even", {"m3_protocol_fee": 2.97}),
    ("sponsor only: sponsor at break-even", {"m3_sponsor": 2.05}),
    ("review only: review cut to break-even", {"m3_review_cost": 0.84}),
    ("launch: sponsored docket (fee 1.00, sponsor 2.00, review 1.50)", LAUNCH),
    ("launch, every juror shows up (no forfeit revenue)", {**LAUNCH, "p_complete": 1.0}),
    ("launch, sponsor at 1.50", {**LAUNCH, "m3_sponsor": 1.50}),
    ("launch, sponsor falls through (sponsor 0)", {**LAUNCH, "m3_sponsor": 0.0}),
    ("launch, review stays at 2.00", {**LAUNCH, "m3_review_cost": 2.00}),
    ("launch, 5-juror grand jury (D7 alternative)", {**LAUNCH, "m3_n": 2}),
    ("hackathon, 5-juror grand jury (D7 alternative)", {"m3_n": 2}),
]
ELASTICITIES = (0.0, 0.5, 1.0, 2.0)


def with_params(base, overrides):
    q = dict(base)
    for key, value in overrides.items():
        q[key] = (value,) + base[key][1:]
    return q


def with_param(key, value):
    return with_params(P, {key: value})


def solve_m3(params, key):
    """Smallest value of `key` (0.01 steps up to 50) giving Mode 3 contribution >= 0."""
    for cents in range(0, 5001):
        q = dict(params)
        q[key] = (cents / 100,) + params[key][1:]
        if mode3(q)["contribution"] >= 0:
            return cents / 100
    return float("inf")


def max_review_m3(params):
    """Largest m3_review_cost (0.01 steps) giving Mode 3 contribution >= 0."""
    best = None
    for cents in range(0, 1001):
        q = dict(params)
        q["m3_review_cost"] = (cents / 100,) + params["m3_review_cost"][1:]
        if mode3(q)["contribution"] >= 0:
            best = cents / 100
    return best


# --------------------------------------------------------------------------
# Self-tests: reproduce the idea doc's own numbers before trusting anything.
# --------------------------------------------------------------------------
def check():
    j, bond, bonus, pool = jury_terms(1)
    assert (j, round(bond, 2), round(bonus, 2), round(pool, 2)) == (3, 0.40, 0.30, 0.90)   # §9 MVP example
    assert round(pool + 0.10 + 0.20, 2) == 1.20 and round(pool + 0.10, 2) == 1.00          # §9/§11 totals
    fees = 0.30
    # §9 settlement table, column "Protocol gross amount in addition to its stated fees"
    assert round(settle(1, 3, True, fees)["protocol_extra"], 2) == 0.00
    assert round(settle(1, 2, True, fees)["protocol_extra"], 2) == 0.70
    assert round(settle(1, 2, False, fees)["protocol_extra"], 2) == 0.00
    assert round(settle(1, 1, False, fees)["protocol_extra"], 2) == 0.60
    assert round(settle(1, 0, False, fees)["protocol_extra"], 2) == 1.20
    # §9 per-juror payouts
    assert round(settle(1, 2, True, fees)["per_timely_juror"], 2) == 0.70
    assert round(settle(1, 1, False, fees)["per_timely_juror"], 2) == 0.60
    # creator refund on no verdict is the full 1.20 charge
    assert round(settle(1, 1, False, fees)["creator_refund"], 2) == 1.20
    # failed-trial bonus coverage holds for every N and every k < J (§9 "Why the
    # minimum is covered"); k = J cannot be a no-verdict: an odd jury of binary
    # votes always has a majority.
    for n in range(1, 8):
        for k in range(2 * n + 1):
            settle(n, k, False, 1.0)
    # probabilities sum to 1
    for n in (1, 3):
        tot = sum(pr for _, _, pr in outcome_distribution(n, 0.9, 0.65))
        assert abs(tot - 1) < 1e-12
    # three revealed binary votes always yield a 2-of-3 majority
    assert all(vd for k, vd, _ in outcome_distribution(1, 0.9, 0.65) if k == 3)
    # A26 elasticity is a no-op at the reference target and at elasticity 0
    assert abs(m3_fund_success(P, 7.30) - v(P, "m3_fund_success")) < 1e-12
    assert m3_fund_success(with_params(P, {"m3_fund_elasticity": 1.0}), 7.30 * 2) < v(P, "m3_fund_success")
    return "ok"


def fmt(x):
    if isinstance(x, float):
        if math.isinf(x):
            return "inf"
        return f"{x:.4f}"
    return x


def write_csv(path, rows, fields):
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({k: fmt(r.get(k, "")) for k in fields})


def main():
    print("self-test:", check())
    if "--check" in sys.argv:
        return
    os.makedirs(OUT, exist_ok=True)
    base = [m(P) for m in MODES]

    fields = []
    for res in base:
        fields += [k for k in res if not k.startswith("_") and k not in fields]
    write_csv(os.path.join(OUT, "summary.csv"), base, fields)

    outcomes = []
    for res in base:
        for r in res["_rows"]:
            outcomes.append({"mode": res["mode"], **r})
    write_csv(os.path.join(OUT, "outcomes.csv"), outcomes,
              ["mode", "k", "verdict", "probability", "per_timely_juror", "creator_refund",
               "protocol_fees", "protocol_extra", "inflow"])

    sens = []
    for key, lo, hi in SENS:
        for label, val in (("low", lo), ("high", hi)):
            q = with_param(key, val)
            for m, b in zip(MODES, base):
                res = m(q)
                sens.append({"param": key, "case": label, "value": val, "mode": res["mode"],
                             "contribution": res["contribution"], "delta_vs_base": res["contribution"] - b["contribution"],
                             "margin": res["margin"], "breakeven_infra_cases_month": res["breakeven_infra_cases_month"]})
    write_csv(os.path.join(OUT, "sensitivity.csv"), sens,
              ["param", "case", "value", "mode", "contribution", "delta_vs_base", "margin", "breakeven_infra_cases_month"])

    # attendance sweep: shows the disclosed incentive (§9 "Conflict disclosed")
    sweep = []
    for pc in (0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 1.00):
        for m in MODES:
            res = m(with_param("p_complete", pc))
            sweep.append({"p_complete": pc, "mode": res["mode"], "revenue_fees": res["revenue_fees"],
                          "revenue_forfeits": res["revenue_forfeits"], "contribution": res["contribution"],
                          "p_verdict_per_attempt": res["p_verdict_per_attempt"]})
    write_csv(os.path.join(OUT, "attendance_sweep.csv"), sweep,
              ["p_complete", "mode", "revenue_fees", "revenue_forfeits", "contribution", "p_verdict_per_attempt"])

    params = [{"key": k, "value": val[0], "source": val[1], "note": val[2]} for k, val in P.items()]
    write_csv(os.path.join(OUT, "parameters.csv"), params, ["key", "value", "source", "note"])

    tokens = []
    for mode, calls in CALLS.items():
        for name, tin, tout in calls:
            tokens.append({"budget": mode, "call": name, "tokens_in": tin, "tokens_out": tout})
    write_csv(os.path.join(OUT, "token_budgets.csv"), tokens, ["budget", "call", "tokens_in", "tokens_out"])

    for res in base:
        print(f"{res['mode']:<20} charge {res['case_charge']:.2f}  rev {res['revenue_total']:.4f}  "
              f"cost {res['cost_total']:.4f}  contrib {res['contribution']:.4f}  margin {res['margin']:.1%}  "
              f"BE(infra) {res['breakeven_infra_cases_month']}  BE(team) {res['breakeven_team_cases_month']}")
    solve = [{"question": "Mode 3 protocol fee for contribution >= 0", "value": solve_m3(P, "m3_protocol_fee")},
             {"question": "Mode 3 sponsor revenue per funded case for contribution >= 0", "value": solve_m3(P, "m3_sponsor")},
             {"question": "Mode 3 max human review cost per published case for contribution >= 0", "value": max_review_m3(P)}]
    for review in (1.00, 1.50, 2.00):
        q = with_params(P, {**LAUNCH, "m3_review_cost": review, "m3_fund_elasticity": 1.0, "p_complete": 1.0})
        solve.append({"question": f"Launch sponsor floor per funded case (protocol fee 1.00, review {review:.2f}, "
                                  f"elasticity 1.0, 100% attendance)", "value": solve_m3(q, "m3_sponsor")})
    write_csv(os.path.join(OUT, "mode3_breakeven.csv"), solve, ["question", "value"])
    for r in solve:
        print(f"{r['question']}: {r['value']}")

    scen = []
    for name, overrides in SCENARIOS:
        for e in ELASTICITIES:
            res = mode3(with_params(P, {**overrides, "m3_fund_elasticity": e}))
            scen.append({"scenario": name, "elasticity": e, "crowdfund_target": res["case_charge"],
                         "fund_success": res["fund_success"], "contributors_per_funded_case": res["contributors_per_funded_case"],
                         "revenue_fees": res["revenue_fees"], "revenue_forfeits": res["revenue_forfeits"],
                         "sponsor_revenue": res["sponsor_revenue"], "revenue_total": res["revenue_total"],
                         "forfeit_share_of_revenue": res["forfeit_share_of_revenue"], "cost_total": res["cost_total"],
                         "contribution": res["contribution"], "p_verdict_per_attempt": res["p_verdict_per_attempt"],
                         "hackathon_budget_at_cap": max(0.0, -res["contribution"]) * v(P, "m3_hackathon_cap")})
    write_csv(os.path.join(OUT, "mode3_scenarios.csv"), scen,
              ["scenario", "elasticity", "crowdfund_target", "fund_success", "contributors_per_funded_case",
               "revenue_fees", "revenue_forfeits", "sponsor_revenue", "revenue_total", "forfeit_share_of_revenue",
               "cost_total", "contribution", "p_verdict_per_attempt", "hackathon_budget_at_cap"])
    print("Mode 3 scenarios (elasticity 0 / 0.5 / 1 / 2 -> contribution):")
    for name, _ in SCENARIOS:
        cs = [r["contribution"] for r in scen if r["scenario"] == name]
        print(f"  {name:<66} " + " / ".join(f"{c:+.4f}" for c in cs))

    grid = []
    for review in (2.00, 1.50, 1.00):
        for fee in (0.50, 1.00, 1.50, 2.00):
            for sponsor in (0.0, 0.50, 1.00, 1.50, 2.00):
                res = mode3(with_params(P, {"m3_protocol_fee": fee, "m3_sponsor": sponsor, "m3_review_cost": review}))
                grid.append({"review_cost": review, "protocol_fee": fee, "sponsor": sponsor,
                             "crowdfund_target": res["case_charge"], "contribution": res["contribution"]})
    write_csv(os.path.join(OUT, "mode3_pricing_grid.csv"), grid,
              ["review_cost", "protocol_fee", "sponsor", "crowdfund_target", "contribution"])


if __name__ == "__main__":
    main()
