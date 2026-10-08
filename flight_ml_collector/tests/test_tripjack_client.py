#!/usr/bin/env python3
"""Comprehensive Unit Tests for TripjackClient (Tier 2 Execution Engine).

Verifies:
1. Strict BaggageAllowance parsing: never invents 23kg for '1 Piece'; preserves None weight;
   fails closed when customer requires positive weight.
2. Complete Multi-Passenger Fare Summation: sums TF, BF, TAF across all passenger types (ADULT, CHILD, INFANT).
3. Exact Carrier Code Matching: prevents substring matches and supports segment operating/marketing codes.
4. Fail-Closed Departure Time Filtering: rejects missing or unparseable departure times.
5. Order Management System (OMS): validation guards, booking execution, and order status reconciliation.
6. Apples-to-Apples Google Flights Comparison: verifies strict preference filtering in SQLite queries.
"""

from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from flight_ml_collector.tripjack_client import (
    BaggageAllowance,
    TripjackClient,
    get_time_band,
    parse_baggage_kg,
)


class TestTripjackClient(unittest.TestCase):
    """Test suite for Tripjack API client and strict constraint verification."""

    def setUp(self):
        self.mock_key = "313662test-api-key"
        self.client = TripjackClient(api_key=self.mock_key)

    def test_init_sets_headers(self):
        """Verify initialization sets required authentication headers."""
        self.assertEqual(self.client.session.headers.get("apikey"), self.mock_key)
        self.assertEqual(self.client.session.headers.get("Content-Type"), "application/json")

    # -------------------------------------------------------------------------
    # 1. Strict Baggage Parsing & Fail-Closed Validation
    # -------------------------------------------------------------------------
    def test_baggage_allowance_strict_no_invented_weight(self):
        """Verify '1 Piece' preserves weight_kg as None and fails closed when positive kg required."""
        one_piece = BaggageAllowance.parse("1 Piece")
        self.assertEqual(one_piece.pieces, 1)
        self.assertIsNone(one_piece.weight_kg)
        # Strictly fails closed: cannot guarantee >= 20kg when weight is unknown
        self.assertFalse(one_piece.satisfies(min_weight_kg=20.0))
        # Satisfies piece count requirement
        self.assertTrue(one_piece.satisfies(min_pieces=1))

        # Two pieces with explicit per-piece weight
        two_pieces = BaggageAllowance.parse("2 Piece, 23 Kilogram each")
        self.assertEqual(two_pieces.pieces, 2)
        self.assertEqual(two_pieces.weight_kg, 46.0)
        self.assertTrue(two_pieces.satisfies(min_weight_kg=30.0))
        self.assertTrue(two_pieces.satisfies(min_pieces=2))

        # Explicit total weight
        thirty_kg = BaggageAllowance.parse("30 Kg")
        self.assertIsNone(thirty_kg.pieces)
        self.assertEqual(thirty_kg.weight_kg, 30.0)
        self.assertTrue(thirty_kg.satisfies(min_weight_kg=20.0))

        # None / 0 kg formats
        self.assertEqual(BaggageAllowance.parse("None").weight_kg, 0.0)
        self.assertEqual(BaggageAllowance.parse(None).weight_kg, 0.0)
        self.assertEqual(BaggageAllowance.parse("").weight_kg, 0.0)

    def test_parse_baggage_kg_helper(self):
        """Verify compatibility helper parse_baggage_kg returns exact weight or None."""
        self.assertEqual(parse_baggage_kg("30 Kg"), 30.0)
        self.assertEqual(parse_baggage_kg("25 Kilogram"), 25.0)
        self.assertEqual(parse_baggage_kg("2 Piece, 23 Kilogram each"), 46.0)
        self.assertIsNone(parse_baggage_kg("1 Piece"))  # Weight unknown, NEVER 23kg
        self.assertEqual(parse_baggage_kg("None"), 0.0)
        self.assertEqual(parse_baggage_kg(None), 0.0)

    # -------------------------------------------------------------------------
    # 2. Authoritative Multi-Passenger Fare Summation
    # -------------------------------------------------------------------------
    def test_multi_passenger_total_fare_summation(self):
        """Verify parsing sums total_fare across ADULT, CHILD, and INFANT passenger types."""
        sample_response = {
            "status": {"success": True, "httpStatus": 200},
            "searchResult": {
                "tripInfos": {
                    "ONWARD": [
                        {
                            "sI": [
                                {
                                    "fD": {"aI": {"name": "Air India", "code": "AI"}, "fN": "995"},
                                    "da": {"code": "DEL"},
                                    "aa": {"code": "DXB"},
                                    "dt": "2026-10-18T10:00",
                                    "at": "2026-10-18T12:30",
                                    "duration": 150,
                                }
                            ],
                            "totalPriceList": [
                                {
                                    "id": "price-family-123",
                                    "fareIdentifier": "PUBLISHED",
                                    "fd": {
                                        "ADULT": {
                                            "fC": {"TF": 10300.0, "BF": 8000.0, "TAF": 2300.0},
                                            "bI": {"iB": "25 Kg", "cB": "7 Kg"},
                                            "rT": 1,
                                            "cB": "Y",
                                        },
                                        "CHILD": {
                                            "fC": {"TF": 7500.0, "BF": 6000.0, "TAF": 1500.0},
                                            "bI": {"iB": "25 Kg", "cB": "7 Kg"},
                                            "rT": 1,
                                            "cB": "Y",
                                        },
                                        "INFANT": {
                                            "fC": {"TF": 1200.0, "BF": 1000.0, "TAF": 200.0},
                                            "bI": {"iB": "10 Kg", "cB": "0 Kg"},
                                            "rT": 1,
                                            "cB": "Y",
                                        },
                                    },
                                }
                            ],
                        }
                    ]
                }
            },
        }

        offers = self.client.parse_flight_offers(sample_response)
        self.assertEqual(len(offers), 1)
        o = offers[0]
        # Multi-pax total: 10300 + 7500 + 1200 = 19000.0
        self.assertEqual(o["total_fare"], 19000.0)
        self.assertEqual(o["base_fare"], 15000.0)
        self.assertEqual(o["tax_fare"], 4000.0)
        self.assertEqual(o["airline"], "Air India")
        self.assertEqual(o["primary_carrier"], "AI")
        self.assertEqual(o["carriers"], ["AI"])
        self.assertEqual(o["checkin_baggage"], "25 Kg")

    # -------------------------------------------------------------------------
    # 3. Exact Carrier Code Matching (Operating & Marketing)
    # -------------------------------------------------------------------------
    def test_exact_carrier_code_matching(self):
        """Verify exact carrier matching and prevention of false substring matches."""
        offers = [
            {"flight_id": "AI 101", "primary_carrier": "AI", "carriers": ["AI"], "stops": 0, "checkin_kg": 25.0},
            {"flight_id": "TG 316", "primary_carrier": "TG", "carriers": ["TG"], "stops": 0, "checkin_kg": 20.0},
            {"flight_id": "LH 760", "primary_carrier": "LH", "carriers": ["LH", "AI"], "stops": 1, "checkin_kg": 30.0},
            {"flight_id": "6E 1461", "primary_carrier": "6E", "carriers": ["6E"], "stops": 0, "checkin_kg": 30.0},
        ]

        # Preferred airline "AI" should match AI 101 and LH 760 (codeshare with AI), but NOT TG (Thai)
        ai_offers = self.client.filter_offers(offers, preferred_airlines=["AI"])
        self.assertEqual(len(ai_offers), 2)
        self.assertEqual([o["flight_id"] for o in ai_offers], ["AI 101", "LH 760"])

        # Preferred airline "6E" should match only IndiGo
        indigo_offers = self.client.filter_offers(offers, preferred_airlines=["6E"])
        self.assertEqual(len(indigo_offers), 1)
        self.assertEqual(indigo_offers[0]["flight_id"], "6E 1461")

        # Substring safety: "E" or "6" should not match "6E" unless explicitly specified as "6E"
        no_match = self.client.filter_offers(offers, preferred_airlines=["E"])
        self.assertEqual(len(no_match), 0)

    # -------------------------------------------------------------------------
    # 4. Fail-Closed Departure Time Validation
    # -------------------------------------------------------------------------
    def test_fail_closed_departure_time(self):
        """Verify missing or invalid departure times fail closed."""
        self.assertEqual(get_time_band("2026-10-18T08:40"), "MORNING")
        self.assertEqual(get_time_band("2026-10-18T13:30"), "AFTERNOON")
        self.assertEqual(get_time_band("2026-10-18T18:45"), "EVENING")
        self.assertEqual(get_time_band("2026-10-18T23:15"), "NIGHT")
        self.assertEqual(get_time_band(None), "ANY")
        self.assertEqual(get_time_band("invalid-iso-string"), "ANY")

        offers = [
            {"flight_id": "F1", "departure_time": "2026-10-18T08:40", "stops": 0},
            {"flight_id": "F2", "departure_time": "2026-10-18T19:00", "stops": 0},
            {"flight_id": "F3", "departure_time": None, "stops": 0},
            {"flight_id": "F4", "departure_time": "", "stops": 0},
            {"flight_id": "F5", "departure_time": "corrupt_time", "stops": 0},
        ]

        # Require MORNING departure: F1 passes, all others fail closed
        morning = self.client.filter_offers(offers, dep_time_band="MORNING")
        self.assertEqual(len(morning), 1)
        self.assertEqual(morning[0]["flight_id"], "F1")

    # -------------------------------------------------------------------------
    # 5. Order Management System (OMS) Booking & Reconciliation
    # -------------------------------------------------------------------------
    def test_book_flight_validations(self):
        """Verify client-side validation guards before making OMS booking calls."""
        with self.assertRaises(ValueError):
            self.client.book_flight("", {"emails": ["a@b.com"], "contacts": ["123"]}, [{"fn": "John"}])

        with self.assertRaises(ValueError):
            self.client.book_flight("TJ123", {"emails": ["a@b.com"], "contacts": ["123"]}, [])

        with self.assertRaises(ValueError):
            self.client.book_flight("TJ123", {"emails": ["a@b.com"]}, [{"fn": "John"}])

    @patch("flight_ml_collector.tripjack_client.requests.Session.post")
    def test_book_flight_success(self, mock_post):
        """Verify successful booking payload and response parsing."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status": {"success": True, "httpStatus": 200},
            "order": {"orderId": "TJ-ORD-9999", "status": "CONFIRMED", "pnr": "ABCDEF"},
        }
        mock_post.return_value = mock_resp

        res = self.client.book_flight(
            booking_id="TJS101603118652",
            delivery_info={"emails": ["flyvis@example.com"], "contacts": ["+919876543210"]},
            traveller_info=[{"ti": "Mr", "fN": "Rahul", "lN": "Sharma", "pt": "ADULT"}],
        )
        self.assertTrue(res["status"]["success"])
        self.assertEqual(res["order"]["orderId"], "TJ-ORD-9999")

    @patch("flight_ml_collector.tripjack_client.requests.Session.post")
    def test_reconcile_booking_before_retry(self, mock_post):
        """Verify order reconciliation before retrying per Tripjack terms."""
        # Case 1: No order ID
        res_no_order = self.client.reconcile_booking_before_retry(None)
        self.assertFalse(res_no_order["reconciled"])
        self.assertEqual(res_no_order["status"], "NO_ORDER_ID_TO_RECONCILE")

        # Case 2: Order exists and confirmed
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status": {"success": True, "httpStatus": 200},
            "order": {"orderId": "TJ-ORD-111", "status": "CONFIRMED"},
        }
        mock_post.return_value = mock_resp
        res_confirmed = self.client.reconcile_booking_before_retry("TJ-ORD-111")
        self.assertTrue(res_confirmed["reconciled"])
        self.assertEqual(res_confirmed["status"], "CONFIRMED")

    # -------------------------------------------------------------------------
    # 6. Apples-to-Apples Google Flights Comparison
    # -------------------------------------------------------------------------
    def test_compare_with_google_flights_apples_to_apples(self):
        """Verify comparison strictly filters Google observations by identical constraints."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test_live_quotes.sqlite"
            with sqlite3.connect(db_path) as conn:
                c = conn.cursor()
                c.execute("""
                    CREATE TABLE searches (
                        id TEXT PRIMARY KEY,
                        query_key TEXT,
                        completed_at TEXT
                    )
                """)
                c.execute("""
                    CREATE TABLE observations (
                        id TEXT PRIMARY KEY,
                        search_id TEXT,
                        total_amount REAL,
                        normalized_json TEXT
                    )
                """)
                c.execute("INSERT INTO searches VALUES ('s1', 'DEL-DXB|2026-10-18', '2026-10-04 10:00:00')")
                # Quote 1: Connecting GF flight without requested baggage
                c.execute("""
                    INSERT INTO observations VALUES ('o1', 's1', 15176.0,
                    '{"carrier_code": "GF", "is_nonstop": false, "stops": 1, "baggage": {"checked_weight_kg": 0.0}, "departure_time": "2026-10-18T04:55"}')
                """)
                # Quote 2: Nonstop IndiGo flight with 30kg baggage
                c.execute("""
                    INSERT INTO observations VALUES ('o2', 's1', 20738.0,
                    '{"carrier_code": "6E", "is_nonstop": true, "stops": 0, "baggage": {"checked_weight_kg": 30.0}, "departure_time": "2026-10-18T08:40"}')
                """)
                conn.commit()

            with patch.object(self.client, "search_flights") as mock_search:
                mock_search.return_value = {
                    "status": {"success": True, "httpStatus": 200},
                    "searchResult": {
                        "tripInfos": {
                            "ONWARD": [
                                {
                                    "sI": [{"fD": {"aI": {"name": "IndiGo", "code": "6E"}, "fN": "1461"}, "da": {"code": "DEL"}, "aa": {"code": "DXB"}, "dt": "2026-10-18T08:40", "at": "2026-10-18T11:15", "duration": 155}],
                                    "totalPriceList": [{"id": "p1", "fd": {"ADULT": {"fC": {"TF": 10300.0}, "bI": {"iB": "30 Kg"}}}}],
                                }
                            ]
                        }
                    },
                }

                # When user requires Nonstop and >= 20kg checked baggage:
                # GF connecting flight (₹15,176) MUST BE EXCLUDED!
                # Google benchmark MUST be the nonstop IndiGo flight (₹20,738)
                res = self.client.compare_with_google_flights(
                    origin="DEL",
                    destination="DXB",
                    travel_date="2026-10-18",
                    max_stops=0,
                    min_checkin_kg=20.0,
                    sqlite_path=str(db_path),
                )

                self.assertEqual(res["google_flights"]["min_price"], 20738.0)
                self.assertEqual(res["google_flights"]["airline"], "6E")
                self.assertEqual(res["google_flights"]["matching_offers_count"], 1)
                self.assertEqual(res["tripjack_gds"]["lowest_offer"]["total_fare"], 10300.0)
                # True saving below comparable retail: 20738 - 10300 = 10438
                self.assertEqual(res["price_spread"]["tripjack_minus_google"], -10438.0)

    # -------------------------------------------------------------------------
    # 7. Reviewed Offer & Ticket Issuance Verification
    # -------------------------------------------------------------------------
    def test_parse_reviewed_offer(self):
        """Verify parsing authoritative revalidated totals, baggage alerts, and session TTL from review response."""
        review_resp = {
            "bookingId": "TJ-REV-12345",
            "totalPriceInfo": {
                "totalFareDetail": {
                    "fC": {"TF": 10550.0, "BF": 2500.0, "TAF": 8050.0}
                }
            },
            "tripInfos": [
                {
                    "sI": [
                        {
                            "fD": {"aI": {"name": "IndiGo", "code": "6E"}, "fN": "1461"},
                            "da": {"code": "DEL"},
                            "aa": {"code": "DXB"},
                            "dt": "2026-10-18T08:40",
                        }
                    ],
                    "totalPriceList": [
                        {
                            "fd": {
                                "ADULT": {
                                    "bI": {"iB": "30 Kg", "cB": "7 Kg"}
                                }
                            }
                        }
                    ]
                }
            ],
            "alerts": [
                {
                    "type": "FAREALERT",
                    "miscAlert": {
                        "DEL-DXB": [{"key": "Baggage", "newValue": "Check-in 35 Kilogram ; Cabin 7 Kg"}]
                    }
                }
            ],
            "conditions": {"st": 720},
        }

        parsed = self.client.parse_reviewed_offer(review_resp)
        self.assertEqual(parsed["booking_id"], "TJ-REV-12345")
        self.assertEqual(parsed["reviewed_total_fare"], 10550.0)
        self.assertEqual(parsed["session_ttl_seconds"], 720.0)
        self.assertEqual(parsed["all_carriers"], ["6E"])
        # Baggage alert updated 30kg -> 35kg
        self.assertEqual(parsed["checkin_allowance"].weight_kg, 35.0)

    def test_verify_ticket_issuance(self):
        """Verify that PNR alone does not trigger confirmed ticket issuance."""
        # Case 1: PNR exists, but status is IN_PROGRESS without ticket numbers
        pending_order = {
            "status": "IN_PROGRESS",
            "pnr": "ABCDEF",
            "orderId": "TJ-123",
        }
        res_pending = self.client.verify_ticket_issuance(pending_order)
        self.assertFalse(res_pending["is_confirmed"])
        self.assertEqual(res_pending["issuance_state"], "BOOKED_PENDING_ISSUANCE")

        # Case 2: Status SUCCESS with ticket numbers
        success_order = {
            "status": "SUCCESS",
            "pnr": "ABCDEF",
            "orderId": "TJ-123",
            "ticketNumber": "098-1234567890",
        }
        res_success = self.client.verify_ticket_issuance(success_order)
        self.assertTrue(res_success["is_confirmed"])
        self.assertEqual(res_success["issuance_state"], "TICKETED_CONFIRMED")
        self.assertEqual(res_success["ticket_numbers"], ["098-1234567890"])


if __name__ == "__main__":
    unittest.main()
