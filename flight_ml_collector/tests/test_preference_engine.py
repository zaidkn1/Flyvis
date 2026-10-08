#!/usr/bin/env python3
"""Unit tests for PreferenceEngine."""

import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd

from flight_ml_collector.preference_engine import (
    PreferenceBundle,
    PreferenceEngine,
    get_time_band,
)


class TestPreferenceEngine(unittest.TestCase):
    """Test suite for universal preference engine."""

    def test_get_time_band(self):
        """Verify time window categorization from ISO and standard times."""
        self.assertEqual(get_time_band("2026-10-18T08:30:00"), "MORNING")
        self.assertEqual(get_time_band("14:15"), "AFTERNOON")
        self.assertEqual(get_time_band("19:45"), "EVENING")
        self.assertEqual(get_time_band("02:10"), "NIGHT")
        self.assertEqual(get_time_band(None), "ANY")

    def test_preference_bundle_defaults(self):
        """Verify PreferenceBundle default values."""
        b = PreferenceBundle(origin="DEL", destination="DXB", departure_date="2026-10-18")
        self.assertIsNone(b.max_stops)
        self.assertEqual(b.min_checkin_kg, 0.0)
        self.assertIsNone(b.dep_time_band)
        self.assertEqual(b.cabin, "economy")
        self.assertEqual(b.currency, "INR")

    @patch("flight_ml_collector.preference_engine.sqlite3.connect")
    def test_slice_trajectory_filters_nonstop(self, mock_connect):
        """Verify that slice_trajectory strictly filters out connecting flights when max_stops=0."""
        # Simulated raw DB dataframe
        raw_df = pd.DataFrame([
            {
                "search_id": "s1", "price": 15176.0, "currency": "INR", "origin": "DEL", "destination": "DXB",
                "departure_date": "2026-10-18", "carrier": "GF", "stops": 1, "is_nonstop": False,
                "dep_time": "04:55", "bag_kg": 23.0, "run_id": "r1", "completed_at": "2026-10-04 06:47:00+00:00"
            },
            {
                "search_id": "s1", "price": 20738.0, "currency": "INR", "origin": "DEL", "destination": "DXB",
                "departure_date": "2026-10-18", "carrier": "6E", "stops": 0, "is_nonstop": True,
                "dep_time": "08:40", "bag_kg": 30.0, "run_id": "r1", "completed_at": "2026-10-04 06:47:00+00:00"
            }
        ])

        with patch("flight_ml_collector.preference_engine.pd.read_sql_query", return_value=raw_df):
            engine = PreferenceEngine()
            bundle = PreferenceBundle(origin="DEL", destination="DXB", departure_date="2026-10-18", max_stops=0)
            scens = engine.slice_trajectory(bundle)

            self.assertEqual(len(scens), 1)
            self.assertEqual(scens.iloc[0]["carrier"], "6E")
            self.assertEqual(scens.iloc[0]["current_price"], 20738.0)
            self.assertEqual(scens.iloc[0]["stops"], 0)

    @patch("flight_ml_collector.preference_engine.sqlite3.connect")
    def test_slice_trajectory_filters_baggage(self, mock_connect):
        """Verify that slice_trajectory excludes flights below min_checkin_kg."""
        raw_df = pd.DataFrame([
            {
                "search_id": "s1", "price": 10510.0, "currency": "INR", "origin": "DEL", "destination": "DXB",
                "departure_date": "2026-10-18", "carrier": "SG", "stops": 0, "is_nonstop": True,
                "dep_time": "07:45", "bag_kg": 0.0, "run_id": "r1", "completed_at": "2026-10-04 06:47:00+00:00"
            },
            {
                "search_id": "s1", "price": 13560.0, "currency": "INR", "origin": "DEL", "destination": "DXB",
                "departure_date": "2026-10-18", "carrier": "6E", "stops": 0, "is_nonstop": True,
                "dep_time": "08:40", "bag_kg": 30.0, "run_id": "r1", "completed_at": "2026-10-04 06:47:00+00:00"
            }
        ])

        with patch("flight_ml_collector.preference_engine.pd.read_sql_query", return_value=raw_df):
            engine = PreferenceEngine()
            # Require at least 20kg baggage
            bundle = PreferenceBundle(origin="DEL", destination="DXB", departure_date="2026-10-18", min_checkin_kg=20.0)
            scens = engine.slice_trajectory(bundle)

            self.assertEqual(len(scens), 1)
            self.assertEqual(scens.iloc[0]["carrier"], "6E")
            self.assertEqual(scens.iloc[0]["current_price"], 13560.0)

    @patch("flight_ml_collector.preference_engine.TripjackClient.search_flights")
    @patch("flight_ml_collector.preference_engine.PreferenceEngine.predict_decision")
    def test_evaluate_flight_deal_end_to_end(self, mock_predict, mock_search):
        """Verify end-to-end deal evaluation with ML recommendation and Tripjack wholesale pricing."""
        mock_predict.return_value = {
            "available": True,
            "model_type": "frozen_estimator",
            "model_name": "model_2",
            "predicted_p_wait": 0.15,
            "action": "BUY_NOW",
            "threshold": 0.60,
            "current_price": 20738.0,
            "carrier": "6E",
            "ratio_to_hist_mean": 0.95,
        }

        mock_search.return_value = {
            "status": {"success": True, "httpStatus": 200},
            "searchResult": {
                "tripInfos": {
                    "ONWARD": [
                        {
                            "sI": [{"fD": {"aI": {"name": "IndiGo", "code": "6E"}, "fN": "1461"}, "da": {"code": "DEL"}, "aa": {"code": "DXB"}, "dt": "2026-10-18T08:40", "at": "2026-10-18T11:15", "duration": 155}],
                            "totalPriceList": [{"id": "price-1", "fareIdentifier": "UPFRONT", "fd": {"ADULT": {"fC": {"TF": 10300.0, "BF": 2000.0, "TAF": 8300.0}, "bI": {"iB": "30 Kg", "cB": "7 Kg"}, "rT": 1}}}]
                        }
                    ]
                }
            }
        }

        engine = PreferenceEngine()
        deal = engine.evaluate_flight_deal("DEL", "DXB", "2026-10-18", max_stops=0, min_checkin_kg=20.0)

        self.assertEqual(deal["route"], "DEL-DXB")
        self.assertEqual(deal["ml_decision"]["action"], "BUY_NOW")
        self.assertEqual(deal["tier1_google_flights"]["matching_retail_price"], 20738.0)
        self.assertEqual(deal["tier2_tripjack_wholesale"]["best_offer"]["total_fare"], 10300.0)
        self.assertEqual(deal["tier2_tripjack_wholesale"]["best_offer"]["checkin_baggage"], "30 Kg")
        self.assertEqual(deal["price_advantage"]["savings_below_google"], 10438.0)
        self.assertEqual(deal["price_advantage"]["percent_savings"], 50.3)


if __name__ == "__main__":
    unittest.main()
