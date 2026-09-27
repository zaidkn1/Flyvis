import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from offer_contract.mock_partner import MockPartnerAdapter, choose_simulated_offer, example_request
from offer_contract.validator import evaluate_offer

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)


class MockPartnerTests(unittest.TestCase):
    def choose(self, scenario, request=None):
        return choose_simulated_offer(MockPartnerAdapter(scenario), request or example_request(), now=NOW)

    def test_stable_selects_cheapest_baggage_compliant_flight(self):
        result = self.choose('stable')
        self.assertEqual(result['selected_offer']['reprice_of_offer_id'], 'mock-first')
        self.assertEqual(result['selected_offer']['price']['total_amount'], '38000.00')
        self.assertIn('insufficient_checked_bags', result['rejected'][0]['reasons'])
        self.assertEqual(result['repriced_eligible'], 2)

    def test_cheaper_alternative_after_reprice_wins(self):
        result = self.choose('alternative_cheaper_after_reprice')
        self.assertEqual(result['selected_offer']['reprice_of_offer_id'], 'mock-alternative')
        self.assertEqual(result['selected_offer']['price']['total_amount'], '39000.00')

    def test_sold_out_expired_or_missing_baggage_falls_back(self):
        for scenario, reason in (
            ('cheapest_sold_out', 'availability_not_confirmed'),
            ('cheapest_expired', 'expired_offer'),
            ('cheapest_baggage_missing', 'insufficient_checked_bags'),
            ('insufficient_seats', 'availability_not_confirmed'),
        ):
            with self.subTest(scenario=scenario):
                result = self.choose(scenario)
                self.assertEqual(result['selected_offer']['reprice_of_offer_id'], 'mock-alternative')
                self.assertTrue(any(reason in item['reasons'] for item in result['rejected']))

    def test_exact_flight_blocks_switch_to_alternative(self):
        request = example_request()
        request['required_flight_number'] = 'AI-915'
        result = self.choose('cheapest_sold_out', request)
        self.assertIsNone(result['selected_offer'])
        self.assertTrue(any('exact_flight_mismatch' in x['reasons'] for x in result['rejected']))

    def test_airline_rule_blocks_unapproved_alternative(self):
        request = example_request()
        request['allowed_airlines'] = ['AI']
        result = self.choose('cheapest_sold_out', request)
        self.assertIsNone(result['selected_offer'])
        self.assertTrue(any('airline_mismatch' in x['reasons'] for x in result['rejected']))

    def test_no_available_offer_fails_closed(self):
        self.assertIsNone(self.choose('all_unavailable')['selected_offer'])
        self.assertIsNone(self.choose('no_offers')['selected_offer'])

    def test_mock_cannot_be_used_as_real_booking_evidence(self):
        adapter = MockPartnerAdapter()
        offer = adapter.search_offers(example_request(), now=NOW)[1]
        self.assertFalse(evaluate_offer(example_request(), offer, now=NOW)[0])
        result = choose_simulated_offer(adapter, example_request(), now=NOW)
        self.assertTrue(result['simulation_only'])
        self.assertFalse(result['eligible_for_real_booking'])
        with self.assertRaises(RuntimeError):
            adapter.create_order('mock-first')

    def test_unsupported_route_returns_no_offers(self):
        request = example_request()
        request['origin'] = 'JFK'
        result = self.choose('stable', request)
        self.assertEqual(result['searched'], 0)
        self.assertIsNone(result['selected_offer'])


if __name__ == '__main__':
    unittest.main()
