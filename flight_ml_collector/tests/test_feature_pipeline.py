#!/usr/bin/env python3
"""
==============================================================================
UNIT TESTS FOR LEAK-FREE FEATURE PIPELINE & EXPERIMENTAL HARNESS
==============================================================================
Validates:
1. Shuffled input order invariance across ALL features (including ratio_to_hist_mean)
2. Causal intra-batch quote isolation (earlier decisions strictly cannot see later quotes)
3. Interleaved trips isolation (zero cross-trip feature contamination)
4. Missing fields handling (graceful defaults without scalar attribute crashes)
5. Late-arriving quotes exclusion (quotes arriving after decision_time strictly excluded)
6. Different baggage requirements (isolated into distinct requirement keys)
7. Origin-local calendar lead days (no midnight truncation)
8. Refusal to invent outcomes (missing outcome column raises ValueError)
9. Full policy evaluation with penalty spectrum & breakdown of unresolved outcomes
"""

import sys
import unittest
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from feature_pipeline import (
    compute_calendar_lead_days,
    build_requirement_keys,
    extract_features,
    calculate_policy_simulation,
    run_three_model_ablation,
)


def _create_sample_dataset():
    """Generates synthetic multi-day observations across two routes."""
    records = []
    # Trip A: DEL -> DXB, Dep: 2026-11-01
    records.append({
        'observation_id': 'del_1',
        'decision_time': '2026-10-01 10:00:00+00:00',
        'quote_received_at': '2026-10-01 10:00:00+00:00',
        'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
        'departure_date': '2026-11-01', 'current_price': 12000.0,
        'checked_bags_qty': 1, 'checked_bag_weight_kg': 20,
        'search_batch_id': 'b1', 'label_wait': 1, 'label_status': 'VERIFIED',
        'price_outcome_24h': 11000.0
    })
    records.append({
        'observation_id': 'del_2',
        'decision_time': '2026-10-02 10:05:00+00:00',
        'quote_received_at': '2026-10-02 10:05:00+00:00',
        'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
        'departure_date': '2026-11-01', 'current_price': 11000.0,
        'checked_bags_qty': 1, 'checked_bag_weight_kg': 20,
        'search_batch_id': 'b2', 'label_wait': 0, 'label_status': 'VERIFIED',
        'price_outcome_24h': 11500.0
    })
    records.append({
        'observation_id': 'del_3',
        'decision_time': '2026-10-03 10:00:00+00:00',
        'quote_received_at': '2026-10-03 10:00:00+00:00',
        'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
        'departure_date': '2026-11-01', 'current_price': 11500.0,
        'checked_bags_qty': 1, 'checked_bag_weight_kg': 20,
        'search_batch_id': 'b3', 'label_wait': 0, 'label_status': 'VERIFIED',
        'price_outcome_24h': 11500.0
    })
    # Adjacent date in batch 1 to test cross-sectional comparison: 2026-11-02
    records.append({
        'observation_id': 'del_nov2_b1',
        'decision_time': '2026-10-01 10:00:00+00:00',
        'quote_received_at': '2026-10-01 10:00:00+00:00',
        'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
        'departure_date': '2026-11-02', 'current_price': 10500.0,
        'checked_bags_qty': 1, 'checked_bag_weight_kg': 20,
        'search_batch_id': 'b1', 'label_wait': 0, 'label_status': 'VERIFIED',
        'price_outcome_24h': 10500.0
    })
    # Adjacent date in batch 1: 2026-11-03
    records.append({
        'observation_id': 'del_nov3_b1',
        'decision_time': '2026-10-01 10:00:00+00:00',
        'quote_received_at': '2026-10-01 10:00:00+00:00',
        'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
        'departure_date': '2026-11-03', 'current_price': 9800.0,
        'checked_bags_qty': 1, 'checked_bag_weight_kg': 20,
        'search_batch_id': 'b1', 'label_wait': 1, 'label_status': 'VERIFIED',
        'price_outcome_24h': 9200.0
    })

    # Trip B: BOM -> LHR, Dep: 2026-11-15 (Interleaved)
    records.append({
        'observation_id': 'bom_1',
        'decision_time': '2026-10-01 12:00:00+00:00',
        'quote_received_at': '2026-10-01 12:00:00+00:00',
        'origin': 'BOM', 'destination': 'LHR', 'cabin': 'economy', 'currency': 'INR',
        'departure_date': '2026-11-15', 'current_price': 45000.0,
        'checked_bags_qty': 2, 'checked_bag_weight_kg': 23,
        'search_batch_id': 'bom_b1', 'label_wait': 0, 'label_status': 'UNRESOLVED',
        'price_outcome_24h': np.nan, 'unresolved_reason': 'collection_failure'
    })

    return pd.DataFrame(records)


class TestFeaturePipeline(unittest.TestCase):

    def test_shuffled_input_invariance_all_features(self):
        """Verify that row order shuffling leaves EVERY feature (including ratio_to_hist_mean) identical."""
        df = _create_sample_dataset()
        _, _, t3_orig = extract_features(df)
        t3_orig = t3_orig.sort_values('observation_id').reset_index(drop=True)

        # Permute rows randomly
        shuffled_df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
        _, _, t3_shuf = extract_features(shuffled_df)
        t3_shuf = t3_shuf.sort_values('observation_id').reset_index(drop=True)

        # Specifically assert ratio_to_hist_mean
        self.assertIn('ratio_to_hist_mean', t3_orig.columns)
        np.testing.assert_allclose(
            t3_orig['ratio_to_hist_mean'].fillna(-999).values,
            t3_shuf['ratio_to_hist_mean'].fillna(-999).values,
            err_msg="Shuffle bug: ratio_to_hist_mean changed after input shuffling!"
        )

        # Check all numeric columns
        for col in t3_orig.select_dtypes(include=[np.number]).columns:
            np.testing.assert_allclose(
                t3_orig[col].fillna(-999).values,
                t3_shuf[col].fillna(-999).values,
                err_msg=f"Shuffled mismatch in column {col}"
            )

    def test_earlier_decision_cannot_see_later_quote(self):
        """Verify that a decision at 10:00 cannot access a quote arriving at 10:30 within the same batch."""
        df = pd.DataFrame([
            {
                'observation_id': 'target_10am',
                'decision_time': '2026-10-01 10:00:00+00:00',
                'quote_received_at': '2026-10-01 10:00:00+00:00',
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-11-01', 'current_price': 10000.0,
                'search_batch_id': 'batch_1'
            },
            {
                'observation_id': 'later_1030am',
                'decision_time': '2026-10-01 10:30:00+00:00',
                'quote_received_at': '2026-10-01 10:30:00+00:00',
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-11-02', 'current_price': 5000.0,
                'search_batch_id': 'batch_1'
            }
        ])
        _, _, t3 = extract_features(df)
        res = t3.set_index('observation_id')

        # target_10am was decided at 10:00. The 5000 fare arrived at 10:30.
        # target_10am MUST NOT see the 5000 fare! Its nearby median must be NaN.
        self.assertTrue(np.isnan(res.loc['target_10am', 'ratio_to_nearby_median']))
        self.assertEqual(res.loc['target_10am', 'n_nearby_dates_available'], 0)

        # later_1030am was decided at 10:30. It CAN see target_10am (arrived at 10:00).
        # Its ratio_to_nearby_median is 5000 / 10000 = 0.5.
        self.assertEqual(res.loc['later_1030am', 'ratio_to_nearby_median'], 0.5)

    def test_interleaved_trips_isolation(self):
        """Verify that trailing history for Trip A never pollutes Trip B."""
        df = _create_sample_dataset()
        _, t2, _ = extract_features(df)
        t2 = t2.set_index('observation_id')

        # bom_1 is first quote for BOM-LHR; must have 0 prior quotes and NaN min/mean
        bom_count = t2.loc['bom_1', 'hist_n_prior_quotes']
        self.assertTrue(bom_count == 0 or np.isnan(bom_count))
        self.assertTrue(np.isnan(t2.loc['bom_1', 'hist_min_60d']))

        # del_2 is second quote for DEL-DXB 2026-11-01; prior quotes must be 1 (del_1 at 12000)
        self.assertEqual(t2.loc['del_2', 'hist_n_prior_quotes'], 1)
        self.assertEqual(t2.loc['del_2', 'hist_min_60d'], 12000.0)

        # del_3 is third quote; prior quotes must be 2, min must be 11000.0
        self.assertEqual(t2.loc['del_3', 'hist_n_prior_quotes'], 2)
        self.assertEqual(t2.loc['del_3', 'hist_min_60d'], 11000.0)
        self.assertEqual(t2.loc['del_3', 'hist_mean_60d'], 11500.0)

    def test_missing_optional_fields(self):
        """Verify graceful handling when optional columns are omitted."""
        minimal_df = pd.DataFrame([{
            'observation_id': 'min_1',
            'decision_time': '2026-10-01 10:00:00+00:00',
            'origin': 'DEL', 'destination': 'BOM', 'cabin': 'economy', 'currency': 'INR',
            'departure_date': '2026-10-15', 'current_price': 5000.0
        }])
        t1, t2, t3 = extract_features(minimal_df)
        self.assertEqual(len(t1), 1)
        self.assertEqual(len(t2), 1)
        self.assertEqual(len(t3), 1)
        self.assertEqual(t1['calendar_lead_days'].iloc[0], 14)

    def test_late_arriving_quotes_exclusion(self):
        """Verify that quotes arriving after decision_time are strictly excluded."""
        df = pd.DataFrame([
            {
                'observation_id': 'valid_quote',
                'decision_time': '2026-10-01 10:00:00+00:00',
                'quote_received_at': '2026-10-01 09:59:00+00:00',
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-10-20', 'current_price': 10000.0
            },
            {
                'observation_id': 'late_quote',
                'decision_time': '2026-10-01 10:00:00+00:00',
                'quote_received_at': '2026-10-01 10:05:00+00:00',
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-10-20', 'current_price': 9000.0
            }
        ])
        t1, _, _ = extract_features(df)
        self.assertIn('valid_quote', t1['observation_id'].values)
        self.assertNotIn('late_quote', t1['observation_id'].values)

    def test_different_baggage_requirements_separation(self):
        """Verify that different baggage bundles result in distinct requirement keys."""
        df = pd.DataFrame([
            {
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-11-01',
                'checked_bags_qty': 0, 'checked_bag_weight_kg': 0,
            },
            {
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-11-01',
                'checked_bags_qty': 2, 'checked_bag_weight_kg': 23,
            }
        ])
        req_keys, _ = build_requirement_keys(df)
        self.assertNotEqual(req_keys.iloc[0], req_keys.iloc[1])
        self.assertIn('CB0x0kg', req_keys.iloc[0])
        self.assertIn('CB2x23kg', req_keys.iloc[1])

    def test_origin_local_lead_days(self):
        """Verify that origin-local calendar lead days avoid midnight truncation."""
        df = pd.DataFrame([
            {
                'origin': 'DEL',
                'decision_time': '2026-10-04 18:45:00+00:00',
                'departure_date': '2026-10-06'
            }
        ])
        lead_days = compute_calendar_lead_days(df)
        self.assertEqual(lead_days[0], 1)

    def test_refuse_to_invent_missing_outcome_prices(self):
        """Verify that omitting price_outcome_24h raises ValueError instead of inventing today's price."""
        df = _create_sample_dataset().drop(columns=['price_outcome_24h'])
        with self.assertRaises(ValueError):
            run_three_model_ablation(df, val_start_date='2026-10-18 00:00:00+00:00')

    def test_full_policy_simulation_with_penalty_spectrum(self):
        """Verify that the 3-model benchmark executes across a penalty spectrum and reports breakdown."""
        df = _create_sample_dataset()
        expanded_rows = []
        for day in range(1, 25):
            expanded_rows.append({
                'observation_id': f'sim_{day}',
                'decision_time': f'2026-10-{day:02d} 10:00:00+00:00',
                'quote_received_at': f'2026-10-{day:02d} 10:00:00+00:00',
                'origin': 'DEL', 'destination': 'DXB', 'cabin': 'economy', 'currency': 'INR',
                'departure_date': '2026-11-20', 'current_price': 10000.0 + (day % 3) * 500,
                'label_wait': day % 2,
                'label_status': 'VERIFIED' if day < 20 else 'UNRESOLVED',
                'label_available_at': f'2026-10-{day+1:02d} 10:00:00+00:00',
                'price_outcome_24h': 9500.0 if day % 2 == 1 else (np.nan if day >= 20 else 10500.0),
                'unresolved_reason': 'collection_failure' if day == 20 else 'confirmed_unavailable',
                'search_batch_id': f'batch_{day}'
            })
        df_eval = pd.concat([df, pd.DataFrame(expanded_rows)], ignore_index=True)

        results = run_three_model_ablation(df_eval, val_start_date='2026-10-18 00:00:00+00:00')
        self.assertIn('Baseline (Buy Immediately)', results)
        self.assertIn('Baseline (Always Wait)', results)
        self.assertIn('Model 1 (Current-Trip Only)', results)
        self.assertIn('Model 2 (+ Trailing History)', results)
        self.assertIn('Model 3 (+ Both History & Schedule)', results)

        # Baseline (Buy Immediately) must have exactly 0 payoff across all penalty tiers
        self.assertEqual(results['Baseline (Buy Immediately)']['Net_Payoff_0pct_penalty'], 0.0)
        self.assertEqual(results['Baseline (Buy Immediately)']['Net_Payoff_5pct_penalty'], 0.0)
        self.assertEqual(results['Baseline (Buy Immediately)']['Net_Payoff_10pct_penalty'], 0.0)
        self.assertEqual(results['Baseline (Buy Immediately)']['Net_Payoff_20pct_penalty'], 0.0)

        for m_name, res in results.items():
            self.assertIn('Net_Payoff_0pct_penalty', res)
            self.assertIn('Net_Payoff_5pct_penalty', res)
            self.assertIn('Net_Payoff_10pct_penalty', res)
            self.assertIn('Net_Payoff_20pct_penalty', res)
            self.assertIn('Wait_Collection_Failures', res)
            self.assertIn('Wait_Confirmed_Unavailable', res)

    def test_penalty_spectrum_arithmetic_exact(self):
        """Independently verify hand-calculated arithmetic of the penalty spectrum across verified and unresolved outcomes."""
        val_df = pd.DataFrame([
            # Row 0: Verified price drop (10,000 -> 9,000 = +1,000 gain)
            {'current_price': 10000.0, 'price_outcome_24h': 9000.0, 'label_status': 'VERIFIED', 'unresolved_reason': 'none'},
            # Row 1: Verified price rise (10,000 -> 11,500 = -1,500 loss)
            {'current_price': 10000.0, 'price_outcome_24h': 11500.0, 'label_status': 'VERIFIED', 'unresolved_reason': 'none'},
            # Row 2: Unresolved outcome (10,000 baseline price, confirmed unavailable)
            {'current_price': 10000.0, 'price_outcome_24h': np.nan, 'label_status': 'UNRESOLVED', 'unresolved_reason': 'confirmed_unavailable'},
            # Row 3: Verified price drop (10,000 -> 8,000 = +2,000 gain)
            {'current_price': 10000.0, 'price_outcome_24h': 8000.0, 'label_status': 'VERIFIED', 'unresolved_reason': 'none'},
        ])

        # Test Case A: Policy actions = ['WAIT', 'WAIT', 'WAIT', 'BUY_NOW']
        # Row 0: WAIT -> +1,000.0
        # Row 1: WAIT -> -1,500.0
        # Row 2: WAIT -> -penalty_pct * 10,000.0
        # Row 3: BUY_NOW -> 0.0
        #
        # Hand calculations:
        # 0% penalty:   +1000 - 1500 + 0     + 0 = -500.0
        # 5% penalty:   +1000 - 1500 - 500   + 0 = -1000.0
        # 10% penalty:  +1000 - 1500 - 1000  + 0 = -1500.0
        # 20% penalty:  +1000 - 1500 - 2000  + 0 = -2500.0
        actions_a = ['WAIT', 'WAIT', 'WAIT', 'BUY_NOW']
        sim_a = calculate_policy_simulation(val_df, actions_a)

        self.assertEqual(sim_a['Actions_BUY_NOW'], 1)
        self.assertEqual(sim_a['Actions_WAIT'], 3)
        self.assertEqual(sim_a['Wait_Drops'], 1)
        self.assertEqual(sim_a['Wait_Rises'], 1)
        self.assertEqual(sim_a['Wait_Flat'], 0)
        self.assertEqual(sim_a['Wait_Confirmed_Unavailable'], 1)
        self.assertEqual(sim_a['Wait_Collection_Failures'], 0)

        self.assertAlmostEqual(sim_a['Net_Payoff_0pct_penalty'], -500.0, places=2)
        self.assertAlmostEqual(sim_a['Net_Payoff_5pct_penalty'], -1000.0, places=2)
        self.assertAlmostEqual(sim_a['Net_Payoff_10pct_penalty'], -1500.0, places=2)
        self.assertAlmostEqual(sim_a['Net_Payoff_20pct_penalty'], -2500.0, places=2)

        # Test Case B: Buy Immediately ('BUY_NOW' for all) -> strictly 0.0 across all penalties
        sim_buy = calculate_policy_simulation(val_df, ['BUY_NOW', 'BUY_NOW', 'BUY_NOW', 'BUY_NOW'])
        self.assertEqual(sim_buy['Actions_BUY_NOW'], 4)
        self.assertEqual(sim_buy['Actions_WAIT'], 0)
        self.assertEqual(sim_buy['Net_Payoff_0pct_penalty'], 0.0)
        self.assertEqual(sim_buy['Net_Payoff_5pct_penalty'], 0.0)
        self.assertEqual(sim_buy['Net_Payoff_10pct_penalty'], 0.0)
        self.assertEqual(sim_buy['Net_Payoff_20pct_penalty'], 0.0)

        # Test Case C: Always Wait ('WAIT' for all)
        # Includes Row 3 (+2,000.0):
        # 0% penalty:   -500.0  + 2000.0 = +1500.0
        # 5% penalty:   -1000.0 + 2000.0 = +1000.0
        # 10% penalty:  -1500.0 + 2000.0 = +500.0
        # 20% penalty:  -2500.0 + 2000.0 = -500.0
        sim_wait = calculate_policy_simulation(val_df, ['WAIT', 'WAIT', 'WAIT', 'WAIT'])
        self.assertEqual(sim_wait['Actions_WAIT'], 4)
        self.assertEqual(sim_wait['Wait_Drops'], 2)
        self.assertAlmostEqual(sim_wait['Net_Payoff_0pct_penalty'], 1500.0, places=2)
        self.assertAlmostEqual(sim_wait['Net_Payoff_5pct_penalty'], 1000.0, places=2)
        self.assertAlmostEqual(sim_wait['Net_Payoff_10pct_penalty'], 500.0, places=2)
        self.assertAlmostEqual(sim_wait['Net_Payoff_20pct_penalty'], -500.0, places=2)


if __name__ == '__main__':
    unittest.main()
