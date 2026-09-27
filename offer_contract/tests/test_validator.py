import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from offer_contract.validator import evaluate_offer, evaluate_reprice


NOW = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)


def request():
    return {
        "origin": "DEL", "destination": "DXB", "departure_date": "2026-10-13",
        "departure_windows": ["16:00-20:00", "20:00-23:59"],
        "max_stops": 0, "allowed_airlines": ["AI"], "cabin": "economy",
        "passenger_ids": ["p1", "p2"], "checked_bags_per_passenger": 1,
        "min_kg_per_checked_bag": 25, "currency": "INR", "max_total_amount": "82000.00",
    }


def offer():
    return {
        "provider": "example_partner", "live_mode": True, "offer_id": "offer-1",
        "available": True, "single_ticket": True, "all_mandatory_charges_included": True,
        "observed_at": "2026-09-26T11:59:00Z", "expires_at": "2026-09-26T12:05:00Z",
        "passenger_ids": ["p1", "p2"], "currency": "INR",
        "price": {"base_amount": "70000.00", "taxes_fees_amount": "7000.00",
                  "baggage_amount": "3000.00", "other_required_services_amount": "0.00",
                  "total_amount": "80000.00"},
        "segments": [{"origin": "DEL", "destination": "DXB",
                      "departing_at": "2026-10-13T19:00:00+05:30",
                      "arriving_at": "2026-10-13T21:00:00+04:00",
                      "marketing_airline": "AI", "flight_number": "AI-915", "cabin": "economy",
                      "baggage_by_passenger": {
                          "p1": [{"max_weight_kg": 25, "confirmed_in_total": True}],
                          "p2": [{"max_weight_kg": 25, "confirmed_in_total": True}],
                      }}],
    }


class OfferGateTests(unittest.TestCase):
    def check_rejected(self, changed, reason):
        ok, reasons = evaluate_offer(request(), changed, now=NOW)
        self.assertFalse(ok)
        self.assertIn(reason, reasons)

    def test_complete_offer_passes(self):
        self.assertEqual(evaluate_offer(request(), offer(), now=NOW), (True, []))

    def test_missing_baggage_fails_closed(self):
        changed = offer()
        del changed["segments"][0]["baggage_by_passenger"]
        ok, reasons = evaluate_offer(request(), changed, now=NOW)
        self.assertFalse(ok)
        self.assertTrue(any("incomplete_or_invalid_offer" in r for r in reasons))

    def test_unconfirmed_paid_bag_rejected(self):
        changed = offer()
        changed["segments"][0]["baggage_by_passenger"]["p2"][0]["confirmed_in_total"] = False
        self.check_rejected(changed, "unconfirmed_or_underweight_bag")

    def test_price_components_must_reconcile(self):
        changed = offer()
        changed["price"]["baggage_amount"] = "0.00"
        self.check_rejected(changed, "incomplete_or_inconsistent_total")

    def test_expired_or_stale_quote_rejected(self):
        changed = offer()
        changed["expires_at"] = "2026-09-26T11:59:30Z"
        self.check_rejected(changed, "expired_offer")
        changed = offer()
        changed["observed_at"] = "2026-09-26T11:50:00Z"
        self.check_rejected(changed, "stale_or_future_quote")

    def test_test_mode_and_over_budget_rejected(self):
        changed = offer()
        changed["live_mode"] = False
        self.check_rejected(changed, "not_live_offer")
        changed = offer()
        changed["price"]["base_amount"] = "80000.00"
        changed["price"]["total_amount"] = "90000.00"
        self.check_rejected(changed, "over_budget")

    def test_availability_ticket_scope_and_full_total_are_required(self):
        for key, reason in (
            ("available", "availability_not_confirmed"),
            ("single_ticket", "separate_or_unconfirmed_tickets"),
            ("all_mandatory_charges_included", "incomplete_total_confirmation"),
        ):
            changed = offer()
            changed[key] = False
            self.check_rejected(changed, reason)

    def test_hard_schedule_and_carrier_constraints(self):
        changed = offer()
        changed["segments"][0]["departing_at"] = "2026-10-13T08:00:00+05:30"
        self.check_rejected(changed, "departure_window_mismatch")
        changed = offer()
        changed["segments"][0]["marketing_airline"] = "EK"
        self.check_rejected(changed, "airline_mismatch")

    def test_reprice_must_be_same_itinerary_and_within_cap(self):
        initial = offer()
        updated = copy.deepcopy(initial)
        updated["offer_id"] = "offer-2"
        updated["reprice_of_offer_id"] = initial["offer_id"]
        updated["observed_at"] = "2026-09-26T12:00:00Z"
        self.assertEqual(evaluate_reprice(request(), initial, updated, now=NOW), (True, []))
        updated["segments"][0]["flight_number"] = "AI-999"
        ok, reasons = evaluate_reprice(request(), initial, updated, now=NOW)
        self.assertFalse(ok)
        self.assertIn("itinerary_changed", reasons)

    def test_reprice_rejects_different_offer_and_currency(self):
        initial = offer()
        updated = copy.deepcopy(initial)
        updated["reprice_of_offer_id"] = "some-other-offer"
        updated["currency"] = "USD"
        ok, reasons = evaluate_reprice(request(), initial, updated, now=NOW)
        self.assertFalse(ok)
        self.assertIn("not_a_reprice_of_selected_offer", reasons)
        self.assertIn("currency_mismatch", reasons)


if __name__ == "__main__":
    unittest.main()
