"""Regression tests for cringe_econ.py. Stdlib only.

    python3 -B -m unittest discover -s docs/economics -v

Pins the numbers quoted in docs/ECONOMICS.md and docs/DECISIONS.md, and checks
that the committed CSVs in out/ are exactly what the calculator writes today.
"""
import contextlib
import io
import os
import tempfile
import unittest

import cringe_econ as c


def contribution(mode, **overrides):
    return mode(c.with_params(c.P, overrides))["contribution"]


class Baseline(unittest.TestCase):
    def test_self_test(self):
        self.assertEqual(c.check(), "ok")

    def test_mode_contributions_match_docs(self):
        self.assertAlmostEqual(contribution(c.mode1), 0.2837, places=4)
        self.assertAlmostEqual(contribution(c.mode2), 0.3039, places=4)
        self.assertAlmostEqual(contribution(c.mode3), -1.1515, places=4)

    def test_mode3_break_even_levers_match_docs(self):
        self.assertEqual(c.solve_m3(c.P, "m3_protocol_fee"), 2.97)
        self.assertEqual(c.solve_m3(c.P, "m3_sponsor"), 2.05)
        self.assertEqual(c.max_review_m3(c.P), 0.84)

    def test_case_charges(self):
        self.assertAlmostEqual(c.mode1(c.P)["case_charge"], 1.20)
        self.assertAlmostEqual(c.mode2(c.P)["case_charge"], 1.40)
        self.assertAlmostEqual(c.mode3(c.P)["case_charge"], 7.30)
        self.assertAlmostEqual(c.mode3(c.with_params(c.P, c.LAUNCH))["case_charge"], 7.80)

    def test_modes_1_and_2_do_not_need_forfeits(self):
        self.assertGreater(contribution(c.mode1, p_complete=1.0), 0)
        self.assertGreater(contribution(c.mode2, p_complete=1.0), 0)


class Elasticity(unittest.TestCase):
    def test_zero_elasticity_is_baseline(self):
        for fee in (0.5, 1.0, 2.97):
            self.assertEqual(contribution(c.mode3, m3_protocol_fee=fee),
                             contribution(c.mode3, m3_protocol_fee=fee, m3_fund_elasticity=0.0))

    def test_one_sided(self):
        q = c.with_params(c.P, {"m3_fund_elasticity": 2.0})
        self.assertEqual(c.m3_fund_success(q, 4.00), c.v(c.P, "m3_fund_success"))
        self.assertLess(c.m3_fund_success(q, 9.77), c.v(c.P, "m3_fund_success"))

    def test_fee_only_fix_fails_once_price_matters(self):
        self.assertGreaterEqual(contribution(c.mode3, m3_protocol_fee=2.97), 0)
        self.assertLess(contribution(c.mode3, m3_protocol_fee=2.97, m3_fund_elasticity=0.5), 0)


class LaunchPricing(unittest.TestCase):
    """D10: the chosen launch pricing must survive every tested elasticity."""

    def test_launch_positive_at_all_elasticities(self):
        for e in c.ELASTICITIES:
            self.assertGreater(contribution(c.mode3, **c.LAUNCH, m3_fund_elasticity=e), 0, e)

    def test_launch_positive_without_forfeits(self):
        for e in c.ELASTICITIES:
            res = c.mode3(c.with_params(c.P, {**c.LAUNCH, "p_complete": 1.0, "m3_fund_elasticity": e}))
            self.assertEqual(res["revenue_forfeits"], 0.0)
            self.assertGreater(res["contribution"], 0, e)

    def test_launch_needs_its_sponsor(self):
        self.assertLess(contribution(c.mode3, **{**c.LAUNCH, "m3_sponsor": 0.0}), 0)

    def test_launch_needs_cheaper_review(self):
        # at today's 2.00 review cost the launch price only works if some jurors no-show
        self.assertGreater(contribution(c.mode3, **{**c.LAUNCH, "m3_review_cost": 2.00}), 0)
        self.assertLess(contribution(c.mode3, **{**c.LAUNCH, "m3_review_cost": 2.00, "p_complete": 1.0}), 0)

    def test_sponsor_floor_rises_with_review_cost(self):
        floors = [c.solve_m3(c.with_params(c.P, {**c.LAUNCH, "m3_review_cost": r, "m3_fund_elasticity": 1.0,
                                                 "p_complete": 1.0}), "m3_sponsor")
                  for r in (1.00, 1.50, 2.00)]
        self.assertEqual(floors, sorted(floors))
        self.assertLessEqual(floors[1], c.LAUNCH["m3_sponsor"])


class CommittedOutputs(unittest.TestCase):
    def test_out_csvs_are_current(self):
        committed = c.OUT
        with tempfile.TemporaryDirectory() as tmp:
            c.OUT = tmp
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    c.main()
            finally:
                c.OUT = committed
            for name in sorted(os.listdir(tmp)):
                with open(os.path.join(tmp, name)) as fresh, open(os.path.join(committed, name)) as old:
                    self.assertEqual(fresh.read(), old.read(), f"out/{name} is stale; re-run cringe_econ.py")


if __name__ == "__main__":
    unittest.main()
