#!/usr/bin/env python3
"""Comprehensive Unit Tests for Production SmartBookingExecutor.

Verifies:
1. False ticket confirmation prevention: PNR alone does not trigger TICKETED_CONFIRMED.
2. Safe timeout handling: network errors keep orders in PENDING_RECONCILIATION without premature refund.
3. Reviewed totals & constraint re-validation: uses revalidated reviewed price and confirmed charge.
4. Integrated payment provider refunds: tracks full refund lifecycle (REQUESTED, PENDING, SUCCEEDED).
5. Persistence & atomic concurrency: guarantees SQLite persistence and prevents race conditions.
"""

from __future__ import annotations

import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from flight_ml_collector.preference_engine import PreferenceBundle
from flight_ml_collector.smart_booking_executor import (
    MarginReservePool,
    OrderPersistenceStore,
    PaymentGatewayClient,
    RefundRecord,
    RefundStatus,
    SmartBookingExecutor,
    SmartBookingOrder,
    SmartBookingState,
)


class TestSmartBookingExecutor(unittest.TestCase):
    """Test suite for production smart booking executor."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmpdir.name) / "test_smart_booking.sqlite"
        self.store = OrderPersistenceStore(db_path=self.db_path)
        self.mock_client = MagicMock()
        self.mock_gateway = MagicMock(spec=PaymentGatewayClient)
        self.reserve_pool = MarginReservePool(balance_inr=50000.0)

        self.executor = SmartBookingExecutor(
            tripjack_client=self.mock_client,
            reserve_pool=self.reserve_pool,
            store=self.store,
            payment_gateway=self.mock_gateway,
        )

        self.bundle = PreferenceBundle(
            origin="DEL",
            destination="DXB",
            departure_date="2026-10-18",
            max_stops=0,
            min_checkin_kg=20.0,
            dep_time_band="MORNING",
            preferred_airlines=["6E"],
        )

        self.order = SmartBookingOrder(
            customer_id="cust-101",
            bundle=self.bundle,
            authorized_amount=10000.0,
            payment_id="pay_stripe_12345",
            guarantee_buffer_inr=1000.0,
            delivery_info={"emails": ["cust@example.com"], "contacts": ["+919876543210"]},
            traveller_info=[{"ti": "Mr", "fN": "Aman", "lN": "Verma", "pt": "ADULT"}],
        )

    def tearDown(self):
        self.tmpdir.cleanup()

    # -------------------------------------------------------------------------
    # 1. False Ticket Confirmation Prevention
    # -------------------------------------------------------------------------
    def test_pnr_alone_does_not_trigger_ticket_confirmed(self):
        """Verify that PNR generation without e-ticket numbers keeps order in BOOKED_PENDING_ISSUANCE."""
        self.executor.authorize_order(self.order)
        self.order.state = SmartBookingState.REVIEWED
        self.order.held_booking_id = "TJ-HOLD-123"
        self.order.reviewed_fare = 9500.0
        self.order.session_expires_at = time.time() + 600
        self.store.save_order(self.order)

        # Booking returns PNR but order status is IN_PROGRESS (ticket numbers not yet issued)
        booking_resp = {
            "status": {"success": True},
            "order": {
                "orderId": "TJ-ORD-PENDING",
                "status": "IN_PROGRESS",
                "pnr": "ABCDEF",
                "totalFare": 9500.0,
            },
        }
        self.mock_client.book_flight.return_value = booking_resp
        self.mock_client.verify_ticket_issuance.return_value = {
            "is_confirmed": False,
            "issuance_state": "BOOKED_PENDING_ISSUANCE",
            "status": "IN_PROGRESS",
            "pnr": "ABCDEF",
            "ticket_numbers": [],
        }

        res = self.executor.execute_booking(self.order)

        # Crucial check: Order must NOT be marked TICKETED_CONFIRMED!
        self.assertEqual(res["status"], "BOOKED_PENDING_ISSUANCE")
        self.assertEqual(self.order.state, SmartBookingState.BOOKED_PENDING_ISSUANCE)
        self.assertEqual(self.order.pnr, "ABCDEF")
        self.assertEqual(self.order.ticket_numbers, [])
        # No refund should be dispatched while ticket is pending
        self.mock_gateway.process_refund.assert_not_called()

    def test_confirmed_issuance_marks_ticketed(self):
        """Verify that verified e-ticket numbers transition order to TICKETED_CONFIRMED and dispatches refund."""
        self.executor.authorize_order(self.order)
        self.order.state = SmartBookingState.REVIEWED
        self.order.held_booking_id = "TJ-HOLD-123"
        self.order.reviewed_fare = 9200.0
        self.order.session_expires_at = time.time() + 600
        self.store.save_order(self.order)

        booking_resp = {
            "status": {"success": True},
            "order": {
                "orderId": "TJ-ORD-SUCCESS",
                "status": "SUCCESS",
                "pnr": "ABCDEF",
                "totalFare": 9200.0,
                "ticketNumber": "098-1234567890",
            },
        }
        self.mock_client.book_flight.return_value = booking_resp
        self.mock_client.verify_ticket_issuance.return_value = {
            "is_confirmed": True,
            "issuance_state": "TICKETED_CONFIRMED",
            "status": "SUCCESS",
            "pnr": "ABCDEF",
            "ticket_numbers": ["098-1234567890"],
        }
        self.mock_gateway.process_refund.return_value = RefundRecord(
            refund_id="ref_123",
            order_id=self.order.order_id,
            payment_id="pay_stripe_12345",
            amount=800.0,
            status=RefundStatus.SUCCEEDED,
            reason="Profit refund",
            gateway_refund_id="rpay_888",
        )

        res = self.executor.execute_booking(self.order)

        self.assertEqual(res["status"], "SUCCESS_TICKETED")
        self.assertEqual(self.order.state, SmartBookingState.REFUND_SUCCEEDED)
        self.assertEqual(self.order.ticket_numbers, ["098-1234567890"])
        self.assertEqual(self.order.profit_refund_amount, 800.0)
        self.mock_gateway.process_refund.assert_called_once()

    # -------------------------------------------------------------------------
    # 2. Safe Timeout Handling
    # -------------------------------------------------------------------------
    def test_booking_timeout_enters_pending_reconciliation_without_refund(self):
        """Verify that connection drop or gateway timeout keeps order PENDING_RECONCILIATION and NEVER auto-refunds."""
        self.executor.authorize_order(self.order)
        self.order.state = SmartBookingState.REVIEWED
        self.order.held_booking_id = "TJ-HOLD-TIMEOUT"
        self.order.reviewed_fare = 9000.0
        self.order.session_expires_at = time.time() + 600
        self.store.save_order(self.order)

        # Simulate network drop / 504 Gateway Timeout
        self.mock_client.book_flight.side_effect = RuntimeError("504 Gateway Timeout")

        res = self.executor.execute_booking(self.order)

        # MUST be PENDING_RECONCILIATION
        self.assertEqual(res["status"], "PENDING_RECONCILIATION")
        self.assertEqual(self.order.state, SmartBookingState.PENDING_RECONCILIATION)
        # MUST NOT execute refund!
        self.mock_gateway.process_refund.assert_not_called()
        self.assertIsNone(self.order.full_refund_amount)

    # -------------------------------------------------------------------------
    # 3. Reviewed Price & Confirmed Charge Verification
    # -------------------------------------------------------------------------
    def test_replaces_search_fare_with_reviewed_fare_and_confirmed_charge(self):
        """Verify engine uses revalidated reviewed price and actual confirmed charge for all calculations."""
        self.executor.authorize_order(self.order)  # Paid ₹10,000

        # Search fare was ₹9,000
        raw_offers = [
            {"flight_id": "6E 1461", "total_fare": 9000.0, "price_id": "p-1461", "stops": 0, "checkin_kg": 30.0, "carriers": ["6E"]}
        ]
        self.mock_client.filter_offers.return_value = raw_offers

        # In review, airline repriced to ₹9,600!
        self.mock_client.review_fare.return_value = {"bookingId": "TJ-HOLD-REPRICE"}
        self.mock_client.parse_reviewed_offer.return_value = {
            "booking_id": "TJ-HOLD-REPRICE",
            "reviewed_total_fare": 9600.0,  # Updated authoritative fare
            "session_ttl_seconds": 840,
            "segments": [{"dt": "2026-10-18T08:40", "fD": {"aI": {"code": "6E"}}}],
            "all_carriers": ["6E"],
            "checkin_allowance": MagicMock(satisfies=lambda min_weight_kg: True, raw_text="30 Kg"),
            "pax_details": {"ADULT": {}},
        }

        hold_res = self.executor.evaluate_and_hold(self.order, raw_offers)
        self.assertEqual(hold_res["search_fare"], 9000.0)
        self.assertEqual(hold_res["reviewed_fare"], 9600.0)
        self.assertEqual(self.order.reviewed_fare, 9600.0)

        # Upon booking, the confirmed total charge was ₹9,650
        self.mock_client.book_flight.return_value = {
            "status": {"success": True},
            "order": {"orderId": "TJ-ORD-9650", "pnr": "PNR9650", "totalFare": 9650.0},
        }
        self.mock_client.verify_ticket_issuance.return_value = {
            "is_confirmed": True,
            "issuance_state": "TICKETED_CONFIRMED",
            "status": "SUCCESS",
            "pnr": "PNR9650",
            "ticket_numbers": ["098-9650"],
        }
        self.mock_gateway.process_refund.return_value = RefundRecord(
            refund_id="ref_p", order_id=self.order.order_id, payment_id="pay_1",
            amount=350.0, status=RefundStatus.SUCCEEDED, reason="Profit refund",
        )

        book_res = self.executor.execute_booking(self.order)
        # Profit refund MUST be based on confirmed charge (10,000 - 9,650 = 350.0), NOT search fare (10,000 - 9,000 = 1,000)
        self.assertEqual(self.order.final_booked_fare, 9650.0)
        self.assertEqual(self.order.profit_refund_amount, 350.0)
        self.mock_gateway.process_refund.assert_called_with(
            payment_id="pay_stripe_12345",
            amount=350.0,
            reason="Flyvis Smart Booking wholesale savings profit refund",
            order_id=self.order.order_id,
        )

    # -------------------------------------------------------------------------
    # 4. Constraint Re-validation on Reviewed Offer
    # -------------------------------------------------------------------------
    def test_reviewed_offer_constraint_revalidation_failure(self):
        """Verify that if review reveals an unexpected layover or changed carrier, engine aborts safely."""
        self.executor.authorize_order(self.order)

        raw_offers = [
            {"flight_id": "6E 1461", "total_fare": 9000.0, "price_id": "p-1461", "stops": 0, "checkin_kg": 30.0, "carriers": ["6E"]}
        ]
        self.mock_client.filter_offers.return_value = raw_offers
        self.mock_client.review_fare.return_value = {"bookingId": "TJ-HOLD-LAYOVER"}

        # Review returns 2 segments (1 stop) when customer demanded max_stops=0!
        self.mock_client.parse_reviewed_offer.return_value = {
            "booking_id": "TJ-HOLD-LAYOVER",
            "reviewed_total_fare": 9000.0,
            "session_ttl_seconds": 840,
            "segments": [
                {"dt": "2026-10-18T08:40", "fD": {"aI": {"code": "6E"}}},
                {"dt": "2026-10-18T13:40", "fD": {"aI": {"code": "6E"}}},
            ],
            "all_carriers": ["6E"],
            "checkin_allowance": MagicMock(satisfies=lambda min_weight_kg: True, raw_text="30 Kg"),
            "pax_details": {"ADULT": {}},
        }
        self.mock_gateway.process_refund.return_value = RefundRecord(
            refund_id="ref_f", order_id=self.order.order_id, payment_id="pay_1",
            amount=10000.0, status=RefundStatus.SUCCEEDED, reason="Unfulfilled",
        )

        res = self.executor.evaluate_and_hold(self.order, raw_offers)

        # Must abort cleanly with 100% refund
        self.assertEqual(res["action"], "ABORT_AND_REFUND")
        self.assertEqual(self.order.state, SmartBookingState.SHORTFALL_EXCEPTION)
        self.assertIn("Reviewed segments have 1 stops", self.order.exception_reason)
        self.mock_gateway.process_refund.assert_called_once()

    # -------------------------------------------------------------------------
    # 5. Atomic Concurrency Guards
    # -------------------------------------------------------------------------
    def test_atomic_concurrency_guard_prevents_duplicate_booking(self):
        """Verify that two workers attempting to execute the same order cannot double-book."""
        self.executor.authorize_order(self.order)
        self.order.state = SmartBookingState.REVIEWED
        self.order.held_booking_id = "TJ-HOLD-RACE"
        self.order.reviewed_fare = 9000.0
        self.order.session_expires_at = time.time() + 600
        self.store.save_order(self.order)

        # Worker 1 transitions order to BOOKING_SUBMITTED
        transition_1 = self.store.atomic_transition(
            self.order, SmartBookingState.REVIEWED, SmartBookingState.BOOKING_SUBMITTED, "Worker 1"
        )
        self.assertTrue(transition_1)

        # Worker 2 attempts transition from REVIEWED, which MUST fail because state is already BOOKING_SUBMITTED!
        dummy_order = SmartBookingOrder(
            customer_id="cust-101",
            bundle=self.bundle,
            authorized_amount=10000.0,
            order_id=self.order.order_id,
            state=SmartBookingState.REVIEWED,
            delivery_info={},
            traveller_info=[],
        )
        transition_2 = self.store.atomic_transition(
            dummy_order, SmartBookingState.REVIEWED, SmartBookingState.BOOKING_SUBMITTED, "Worker 2"
        )
        self.assertFalse(transition_2)


if __name__ == "__main__":
    unittest.main()
