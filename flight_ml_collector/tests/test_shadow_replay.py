import csv
import gzip
import importlib.util
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'shadow_replay.py'
spec = importlib.util.spec_from_file_location('shadow_replay', MODULE)
replay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(replay)


def row(**overrides):
    data = {
        'profile_id': 'ATL-BOS|2022-09-15|AA|ANY', 'route': 'ATL-BOS',
        'searchDate': '2022-09-08', 'flightDate': '2022-09-15',
        'future_1_date': '2022-09-09', 'future_1_status': 'matching_quote_observed',
        'current_fare_usd': '200.00', 'future_1_fare_usd': '180.00',
        'fixed_wait_1_saving_usd': '20.00',
        'predicted_drop_probability': '0.70', 'action': 'WAIT_ONE_DAY',
        'entry_lead_days': 7,
    }
    data.update(overrides)
    return data


class ReplayTests(unittest.TestCase):
    def test_wait_refund_and_topup_are_separate(self):
        lower = replay.event(row(), 'frozen_model')
        higher = replay.event(row(future_1_fare_usd='235.00', fixed_wait_1_saving_usd='-35.00'), 'frozen_model')
        self.assertEqual(lower['customer_refund_proxy_usd'], '20.00')
        self.assertEqual(higher['platform_topup_proxy_usd'], '35.00')
        totals = replay.summarize([lower, higher])
        self.assertEqual(totals['known_net_fare_saving_usd'], -15.0)
        self.assertEqual(totals['customer_refund_proxy_usd'], 20.0)
        self.assertEqual(totals['platform_topup_proxy_usd'], 35.0)
        self.assertEqual(totals['platform_cash_before_fees_if_all_savings_refunded_usd'], -35.0)
        self.assertEqual(totals['actual_bookable_offers'], 0)

    def test_unresolved_is_not_a_made_up_price(self):
        missing = row(future_1_status='source_gap', future_1_fare_usd='', fixed_wait_1_saving_usd='')
        event = replay.event(missing, 'frozen_model')
        self.assertEqual(event['next_day_fare_usd'], '')
        self.assertEqual(event['observed_signed_saving_usd'], '')
        totals = replay.summarize([event])
        self.assertEqual(totals['unresolved_waits'], 1)
        self.assertEqual(totals['mean_advantage_per_start_by_unresolved_cost_usd']['100'], -100.0)

    def test_book_now_only_has_counterfactual_missed_drop(self):
        event = replay.event(row(), 'book_now')
        self.assertEqual(event['observed_signed_saving_usd'], '')
        self.assertEqual(event['missed_next_day_drop_proxy_usd'], '20.00')
        self.assertEqual(replay.summarize([event])['known_net_fare_saving_usd'], 0.0)

    def test_cohort_has_one_start_per_profile(self):
        first = row()
        second = row(searchDate='2022-09-09', future_1_date='2022-09-10',
                     current_fare_usd='180.00', future_1_fare_usd='170.00',
                     fixed_wait_1_saving_usd='10.00', entry_lead_days=6)
        self.assertEqual(replay.entry_cohort([first, second], 7), [first])
        with self.assertRaises(ValueError):
            replay.entry_cohort([first, first], 7)

    def test_saved_action_and_arithmetic_verified_on_load(self):
        original = row()
        original.pop('entry_lead_days')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'scores.csv.gz'
            def write(item):
                with gzip.open(path, 'wt', newline='') as stream:
                    writer = csv.DictWriter(stream, fieldnames=list(item))
                    writer.writeheader(); writer.writerow(item)
            write(original)
            self.assertEqual(replay.load_scores(path, .4)[0]['entry_lead_days'], 7)
            write({**original, 'action': 'BOOK_NOW'})
            with self.assertRaisesRegex(ValueError, 'saved action'):
                replay.load_scores(path, .4)
            write({**original, 'fixed_wait_1_saving_usd': '25.00'})
            with self.assertRaisesRegex(ValueError, 'does not reconcile'):
                replay.load_scores(path, .4)


if __name__ == '__main__':
    unittest.main()
