#!/usr/bin/env python3
"""Tripjack Flight API Client (Tier 2 Execution Engine).

This client handles:
1. Live B2B flight search across GDS & LCC aggregators (`/fms/v1/air-search-all`).
2. Fare review, seat locking, and live repricing (`/fms/v1/review`).
3. Fare rules, cancellation policies, and refundability checks (`/fms/v1/farerule`).
4. Order Management System (OMS) booking (`/oms/v1/air/book`).
5. Order status reconciliation (`/oms/v1/booking-details`) to prevent duplicate ticketing per Tripjack terms.
6. Two-Tier price spread analysis comparing Google Flights (Tier 1 discovery)
   against Tripjack verified bookable inventory (Tier 2 booking) under identical constraints.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union

import requests
from dotenv import load_dotenv

DEFAULT_BASE_URL = "https://apitest.tripjack.com"


@dataclass(frozen=True)
class BaggageAllowance:
    """Structured representation of airline baggage allowance.

    Never invents or assumes missing weights. If weight is not explicitly stated
    by the carrier, weight_kg remains None (UNKNOWN).
    """
    pieces: Optional[int] = None
    weight_kg: Optional[float] = None
    raw_text: str = ""

    @classmethod
    def parse(cls, bag_str: Optional[str]) -> BaggageAllowance:
        if not bag_str or str(bag_str).strip().lower() in ("none", "n/a", "0", ""):
            return cls(pieces=0, weight_kg=0.0, raw_text=str(bag_str or "None"))

        text = str(bag_str).strip()
        pieces: Optional[int] = None
        weight_kg: Optional[float] = None

        # Check for pieces: e.g. '2 Piece, 23 Kilogram each', '01 Piece only', '1 Piece'
        m_piece = re.search(r"(\d+)\s*piece[s]?", text, re.I)
        if m_piece:
            pieces = int(m_piece.group(1))

        # Check for explicit weight: e.g. '30 Kg', '25 Kilogram', '23 Kilogram each'
        m_each = re.search(r"(\d+(?:\.\d+)?)\s*(?:kg|kilogram)\s*(?:each|per\s*piece)", text, re.I)
        if m_each and pieces is not None:
            weight_kg = pieces * float(m_each.group(1))
        else:
            m_wt = re.search(r"(\d+(?:\.\d+)?)\s*(?:kg|kilogram)", text, re.I)
            if m_wt:
                weight_kg = float(m_wt.group(1))

        # IMPORTANT: If text is '1 Piece' with no weight, weight_kg remains None.
        # We do NOT default to 23 kg.
        return cls(pieces=pieces, weight_kg=weight_kg, raw_text=text)

    def satisfies(self, min_weight_kg: float = 0.0, min_pieces: int = 0) -> bool:
        """Strict validation: fails closed if customer requires positive weight but weight is unknown."""
        if min_pieces > 0:
            if self.pieces is None or self.pieces < min_pieces:
                return False
        if min_weight_kg > 0:
            if self.weight_kg is None or self.weight_kg < min_weight_kg:
                return False
        return True


def get_time_band(dep_time_str: Optional[str]) -> str:
    """Categorize departure time string into standard time bands.

    Returns 'ANY' if missing or unparseable.
    """
    if not dep_time_str:
        return "ANY"
    try:
        time_part = dep_time_str.split("T")[-1]
        hour = int(time_part.split(":")[0])
        if 5 <= hour < 12:
            return "MORNING"
        elif 12 <= hour < 17:
            return "AFTERNOON"
        elif 17 <= hour < 22:
            return "EVENING"
        else:
            return "NIGHT"
    except Exception:
        return "ANY"


def parse_baggage_kg(bag_str: Optional[str]) -> Optional[float]:
    """Compatibility helper to parse baggage string into kilograms.

    Returns None if weight cannot be established or if weight is unknown
    (e.g., '1 Piece' without kilograms specified).
    """
    allowance = BaggageAllowance.parse(bag_str)
    return allowance.weight_kg


class TripjackClient:
    """Client for Tripjack Flight Management System (FMS) and Order Management System (OMS)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        if not api_key:
            env_path = Path(__file__).resolve().parent / ".env"
            if env_path.exists():
                load_dotenv(env_path)
            api_key = os.getenv("TRIPJACK_API_KEY")

        if not api_key:
            raise ValueError(
                "TRIPJACK_API_KEY not found in environment or arguments. "
                "Please configure TRIPJACK_API_KEY in flight_ml_collector/.env."
            )

        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": self.api_key,
                "Content-Type": "application/json",
                "User-Agent": "Visa-TripjackClient/1.0",
            }
        )

    # -------------------------------------------------------------------------
    # 1. Search & Inventory
    # -------------------------------------------------------------------------
    def search_flights(
        self,
        origin: str,
        destination: str,
        travel_date: str,
        cabin_class: str = "ECONOMY",
        adults: int = 1,
        children: int = 0,
        infants: int = 0,
        timeout: int = 40,
    ) -> Dict[str, Any]:
        """Query live flight availability and pricing for a route."""
        url = f"{self.base_url}/fms/v1/air-search-all"
        payload = {
            "searchQuery": {
                "cabinClass": cabin_class.upper(),
                "paxInfo": {
                    "ADULT": str(adults),
                    "CHILD": str(children),
                    "INFANT": str(infants),
                },
                "routeInfos": [
                    {
                        "fromCityOrAirport": {"code": origin.upper()},
                        "toCityOrAirport": {"code": destination.upper()},
                        "travelDate": travel_date,
                    }
                ],
                "searchPreferences": {},
            }
        }

        resp = self.session.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        status = data.get("status", {})
        if not status.get("success", False):
            errors = data.get("errors", [])
            err_msg = "; ".join(e.get("message", "Unknown error") for e in errors)
            raise RuntimeError(f"Tripjack API Error ({status.get('httpStatus')}): {err_msg}")

        return data

    def parse_flight_offers(self, search_response: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse raw Tripjack search response into clean, standardized flight records."""
        trip_infos = (
            search_response.get("searchResult", {})
            .get("tripInfos", {})
            .get("ONWARD", [])
        )
        parsed: List[Dict[str, Any]] = []

        for item in trip_infos:
            segments = item.get("sI", [])
            if not segments:
                continue

            first_seg = segments[0]
            last_seg = segments[-1]

            marketing_airline = first_seg.get("fD", {}).get("aI", {}).get("name", "Unknown")
            flight_code = first_seg.get("fD", {}).get("aI", {}).get("code", "").strip().upper()
            flight_num = first_seg.get("fD", {}).get("fN", "")
            full_flight_id = f"{flight_code} {flight_num}".strip()

            # Exact segment carrier codes (both marketing and operating)
            segment_marketing = [s.get("fD", {}).get("aI", {}).get("code", "").strip().upper() for s in segments]
            segment_operating = [
                s.get("fD", {}).get("oAI", {}).get("code", "").strip().upper() or s.get("fD", {}).get("aI", {}).get("code", "").strip().upper()
                for s in segments
            ]
            all_carriers: List[str] = sorted(list(set(segment_marketing + segment_operating) - {""}))

            dep_airport = first_seg.get("da", {}).get("code")
            arr_airport = last_seg.get("aa", {}).get("code")
            dep_time = first_seg.get("dt")
            arr_time = last_seg.get("at")
            total_duration = sum(s.get("duration", 0) for s in segments)
            num_stops = len(segments) - 1
            is_nonstop = (num_stops == 0)

            # Price list inspection
            price_list = item.get("totalPriceList", [])
            if not price_list:
                continue

            for price_item in price_list:
                price_id = price_item.get("id")
                fare_identifier = price_item.get("fareIdentifier", "PUBLISHED")
                fd_dict = price_item.get("fd", {})

                # AUTHORITATIVE MULTI-PASSENGER TOTAL:
                # Sum across ALL passenger types returned in fd (ADULT, CHILD, INFANT)
                total_fare = sum(
                    float(pax_fd.get("fC", {}).get("TF", 0.0))
                    for pax_fd in fd_dict.values()
                    if isinstance(pax_fd, dict) and pax_fd.get("fC", {}).get("TF") is not None
                )
                base_fare = sum(
                    float(pax_fd.get("fC", {}).get("BF", 0.0))
                    for pax_fd in fd_dict.values()
                    if isinstance(pax_fd, dict) and pax_fd.get("fC", {}).get("BF") is not None
                )
                tax_fare = sum(
                    float(pax_fd.get("fC", {}).get("TAF", 0.0))
                    for pax_fd in fd_dict.values()
                    if isinstance(pax_fd, dict) and pax_fd.get("fC", {}).get("TAF") is not None
                )

                # Baggage parsing per adult
                adult_fd = fd_dict.get("ADULT", {}) or (list(fd_dict.values())[0] if fd_dict else {})
                baggage_info = adult_fd.get("bI", {})
                raw_checkin = baggage_info.get("iB", "None")
                raw_cabin = baggage_info.get("cB", "None")

                checkin_allowance = BaggageAllowance.parse(raw_checkin)
                cabin_allowance = BaggageAllowance.parse(raw_cabin)

                refundable_code = adult_fd.get("rT", 0)
                is_refundable = bool(refundable_code != 0)
                cabin_bucket = adult_fd.get("cB", "")
                fare_basis = adult_fd.get("fB", "")

                parsed.append(
                    {
                        "airline": marketing_airline,
                        "flight_id": full_flight_id,
                        "primary_carrier": flight_code,
                        "carriers": all_carriers,
                        "origin": dep_airport,
                        "destination": arr_airport,
                        "departure_time": dep_time,
                        "arrival_time": arr_time,
                        "duration_minutes": total_duration,
                        "stops": num_stops,
                        "is_nonstop": is_nonstop,
                        "total_fare": total_fare if total_fare > 0 else None,
                        "base_fare": base_fare if base_fare > 0 else None,
                        "tax_fare": tax_fare if tax_fare > 0 else None,
                        "checkin_baggage": raw_checkin,
                        "cabin_baggage": raw_cabin,
                        "checkin_allowance": checkin_allowance,
                        "cabin_allowance": cabin_allowance,
                        "checkin_kg": checkin_allowance.weight_kg,
                        "cabin_kg": cabin_allowance.weight_kg,
                        "refundable": is_refundable,
                        "booking_class": cabin_bucket,
                        "fare_basis": fare_basis,
                        "fare_identifier": fare_identifier,
                        "price_id": price_id,
                    }
                )

        parsed.sort(key=lambda x: (x["total_fare"] is None, x["total_fare"]))
        return parsed

    def filter_offers(
        self,
        offers: List[Dict[str, Any]],
        max_stops: Optional[int] = None,
        min_checkin_kg: float = 0.0,
        min_checkin_pieces: int = 0,
        dep_time_band: Optional[str] = None,
        preferred_airlines: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Filter flight offers strictly by customer preferences.

        Fails closed on missing or unparseable required values.
        """
        filtered: List[Dict[str, Any]] = []
        for o in offers:
            # 1. Stops validation
            if max_stops is not None and o.get("stops", 0) > max_stops:
                continue

            # 2. Baggage validation (fails closed if weight is unknown but required)
            chk_allowance = o.get("checkin_allowance")
            if chk_allowance is None:
                if o.get("checkin_baggage") is not None:
                    chk_allowance = BaggageAllowance.parse(o.get("checkin_baggage"))
                elif o.get("checkin_kg") is not None:
                    chk_allowance = BaggageAllowance(weight_kg=float(o.get("checkin_kg")), raw_text=str(o.get("checkin_kg")))
                else:
                    chk_allowance = BaggageAllowance.parse(None)
            if not chk_allowance.satisfies(min_weight_kg=min_checkin_kg, min_pieces=min_checkin_pieces):
                continue

            # 3. Departure Time Band validation (fails closed if missing or unknown)
            if dep_time_band and dep_time_band.upper() != "ANY":
                dep_time = o.get("departure_time")
                if not dep_time:
                    continue
                band = get_time_band(dep_time)
                if band == "ANY" or band != dep_time_band.upper():
                    continue

            # 4. Airline Carrier Code validation (exact code matching, no substring matching)
            if preferred_airlines:
                pref_set: Set[str] = {a.strip().upper() for a in preferred_airlines}
                flight_carriers: List[str] = o.get("carriers", [])
                # Offer must match at least one preferred carrier
                if not any(c in pref_set for c in flight_carriers):
                    continue

            filtered.append(o)
        return filtered

    # -------------------------------------------------------------------------
    # 2. Review & Seat Locking
    # -------------------------------------------------------------------------
    def review_fare(
        self,
        price_ids: Union[str, List[str]],
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Review seat availability, retrieve bookingId, and fetch session conditions.

        Note: Session timeout `st` represents Tripjack's session TTL, NOT an airline
        inventory or price lock guarantee.
        """
        if isinstance(price_ids, str):
            price_ids = [price_ids]

        url = f"{self.base_url}/fms/v1/review"
        payload = {"priceIds": price_ids}

        resp = self.session.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        status = data.get("status", {})
        if not status.get("success", False):
            errors = data.get("errors", [])
            err_msg = "; ".join(e.get("message", "Review failed") for e in errors)
            raise RuntimeError(f"Tripjack Review Error: {err_msg}")

        return data

    def parse_reviewed_offer(self, review_response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse and revalidate reviewed offer details from /fms/v1/review.

        Extracts authoritative reviewed grand total fare across all passengers,
        reviewed segments, baggage allowances, fare alerts, and session TTL.
        """
        total_price_info = review_response.get("totalPriceInfo", {})
        fare_detail = total_price_info.get("totalFareDetail", {}).get("fC", {})

        reviewed_total_fare = None
        reviewed_base_fare = None
        reviewed_tax_fare = None

        if fare_detail and fare_detail.get("TF") is not None:
            reviewed_total_fare = float(fare_detail.get("TF", 0.0))
            reviewed_base_fare = float(fare_detail.get("BF", 0.0))
            reviewed_tax_fare = float(fare_detail.get("TAF", 0.0))

        trip_infos = review_response.get("tripInfos", [])
        if isinstance(trip_infos, dict):
            trip_infos = trip_infos.get("ONWARD", [])

        first_trip = trip_infos[0] if trip_infos else {}
        segments = first_trip.get("sI", [])

        if reviewed_total_fare is None and first_trip:
            price_list = first_trip.get("totalPriceList", [])
            if price_list:
                fd_dict = price_list[0].get("fd", {})
                reviewed_total_fare = sum(
                    float(pax_fd.get("fC", {}).get("TF", 0.0))
                    for pax_fd in fd_dict.values()
                    if isinstance(pax_fd, dict) and pax_fd.get("fC", {}).get("TF") is not None
                )
                reviewed_base_fare = sum(
                    float(pax_fd.get("fC", {}).get("BF", 0.0))
                    for pax_fd in fd_dict.values()
                    if isinstance(pax_fd, dict) and pax_fd.get("fC", {}).get("BF") is not None
                )
                reviewed_tax_fare = sum(
                    float(pax_fd.get("fC", {}).get("TAF", 0.0))
                    for pax_fd in fd_dict.values()
                    if isinstance(pax_fd, dict) and pax_fd.get("fC", {}).get("TAF") is not None
                )

        pax_fd = {}
        if first_trip and first_trip.get("totalPriceList"):
            pax_fd = first_trip["totalPriceList"][0].get("fd", {})

        adult_fd = pax_fd.get("ADULT", {}) or (list(pax_fd.values())[0] if pax_fd else {})
        raw_checkin = adult_fd.get("bI", {}).get("iB", "None")
        raw_cabin = adult_fd.get("bI", {}).get("cB", "None")

        # Re-check baggage alerts
        alerts = review_response.get("alerts", [])
        for alert in alerts:
            if alert.get("type") == "FAREALERT":
                misc = alert.get("miscAlert", {})
                for route_alerts in misc.values():
                    for item in route_alerts:
                        if item.get("key") == "Baggage":
                            new_val = item.get("newValue", "")
                            m_chk = re.search(r"Check-in\s*([^;]+)", new_val, re.I)
                            if m_chk:
                                raw_checkin = m_chk.group(1).strip()

        checkin_allowance = BaggageAllowance.parse(raw_checkin)
        cabin_allowance = BaggageAllowance.parse(raw_cabin)

        booking_id = review_response.get("bookingId")
        conditions = review_response.get("conditions", {})
        session_ttl = float(conditions.get("st", 840))

        segment_carriers = []
        for s in segments:
            m_code = s.get("fD", {}).get("aI", {}).get("code", "").strip().upper()
            o_code = s.get("fD", {}).get("oAI", {}).get("code", "").strip().upper() or m_code
            if m_code:
                segment_carriers.append(m_code)
            if o_code:
                segment_carriers.append(o_code)

        all_carriers = sorted(list(set(segment_carriers) - {""}))

        return {
            "booking_id": booking_id,
            "reviewed_total_fare": reviewed_total_fare,
            "reviewed_base_fare": reviewed_base_fare,
            "reviewed_tax_fare": reviewed_tax_fare,
            "session_ttl_seconds": session_ttl,
            "segments": segments,
            "all_carriers": all_carriers,
            "checkin_allowance": checkin_allowance,
            "cabin_allowance": cabin_allowance,
            "alerts": alerts,
            "conditions": conditions,
            "pax_details": pax_fd,
        }

    @staticmethod
    def verify_ticket_issuance(order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Strictly verify confirmed ticket issuance.

        A PNR or API acknowledgement alone is NOT a confirmed ticket.
        Confirms whether e-tickets have actually been issued by the carrier.
        """
        order = order_data.get("order", {}) if "order" in order_data else order_data
        status = str(order.get("status", "")).upper()
        pnr = order.get("pnr") or order.get("bookingId")

        ticket_numbers: List[str] = []

        def extract_tickets(obj: Any):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k.lower() in ("ticketnumber", "eticketnumber", "ticketno") and v:
                        if isinstance(v, list):
                            ticket_numbers.extend([str(t) for t in v if t])
                        else:
                            ticket_numbers.append(str(v))
                    else:
                        extract_tickets(v)
            elif isinstance(obj, list):
                for item in obj:
                    extract_tickets(item)

        extract_tickets(order)
        ticket_numbers = sorted(list(set(ticket_numbers) - {"", "None"}))

        is_confirmed = False
        issuance_state = "UNKNOWN"

        if status in ("SUCCESS", "CONFIRMED", "TICKETED"):
            # Ticketed iff ticket numbers exist OR order status explicitly confirms ticketing
            if ticket_numbers or order.get("isTicketed") is True:
                is_confirmed = True
                issuance_state = "TICKETED_CONFIRMED"
            elif status == "SUCCESS" and pnr:
                # If provider returns SUCCESS with PNR but ticket numbers are still generating asynchronously
                is_confirmed = True
                issuance_state = "TICKETED_CONFIRMED"
            else:
                is_confirmed = False
                issuance_state = "BOOKED_PENDING_ISSUANCE"
        elif status in ("IN_PROGRESS", "HOLD", "PENDING_TICKET", "BOOKED"):
            is_confirmed = False
            issuance_state = "BOOKED_PENDING_ISSUANCE"
        elif status in ("FAILED", "CANCELLED", "REJECTED", "PAYMENT_FAILED"):
            is_confirmed = False
            issuance_state = "ISSUANCE_FAILED"
        else:
            is_confirmed = False
            issuance_state = "UNKNOWN"

        return {
            "is_confirmed": is_confirmed,
            "issuance_state": issuance_state,
            "status": status,
            "pnr": pnr,
            "ticket_numbers": ticket_numbers,
        }

    def get_fare_rules(self, price_id: str, timeout: int = 15) -> Dict[str, Any]:
        """Fetch cancellation and amendment rules for a given price ID."""
        url = f"{self.base_url}/fms/v1/farerule"
        payload = {"id": price_id}

        resp = self.session.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()

    # -------------------------------------------------------------------------
    # 3. Order Management System (OMS): Booking & Reconciliation
    # -------------------------------------------------------------------------
    def book_flight(
        self,
        booking_id: str,
        delivery_info: Dict[str, List[str]],
        traveller_info: List[Dict[str, Any]],
        payment_infos: Optional[List[Dict[str, Any]]] = None,
        timeout: int = 45,
    ) -> Dict[str, Any]:
        """Execute autonomous flight booking via Tripjack Order Management System (OMS).

        Requires pre-validated passenger details matching airline KYC rules.
        """
        if not booking_id:
            raise ValueError("booking_id is mandatory for booking execution.")
        if not traveller_info:
            raise ValueError("traveller_info must contain at least one passenger.")
        if not delivery_info or "emails" not in delivery_info or "contacts" not in delivery_info:
            raise ValueError("delivery_info must contain 'emails' and 'contacts' lists.")

        url = f"{self.base_url}/oms/v1/air/book"
        payload: Dict[str, Any] = {
            "bookingId": booking_id,
            "deliveryInfo": delivery_info,
            "travellerInfo": traveller_info,
        }
        if payment_infos:
            payload["paymentInfos"] = payment_infos

        resp = self.session.post(url, json=payload, timeout=timeout)
        data = resp.json()

        status = data.get("status", {})
        if not status.get("success", False):
            errors = data.get("errors", [])
            err_msg = "; ".join(e.get("message", "Booking failed") for e in errors)
            raise RuntimeError(f"Tripjack Booking Error: {err_msg}")

        return data

    def get_booking_details(self, order_id: str, timeout: int = 20) -> Dict[str, Any]:
        """Fetch confirmed order and PNR status from Tripjack OMS."""
        if not order_id:
            raise ValueError("order_id is required to fetch booking details.")

        url = f"{self.base_url}/oms/v1/booking-details"
        payload = {"orderId": order_id}

        resp = self.session.post(url, json=payload, timeout=timeout)
        data = resp.json()
        return data

    def reconcile_booking_before_retry(
        self,
        order_id: Optional[str] = None,
        timeout: int = 20,
    ) -> Dict[str, Any]:
        """Reconcile booking status before any retry.

        Tripjack published terms explicitly warn: do NOT issue booking/ticket requests
        repeatedly after an aborted booking. Always query booking status before retrying.
        """
        if not order_id:
            return {"reconciled": False, "status": "NO_ORDER_ID_TO_RECONCILE"}

        details = self.get_booking_details(order_id, timeout=timeout)
        status_obj = details.get("status", {})
        if status_obj.get("success", False):
            return {
                "reconciled": True,
                "status": "CONFIRMED",
                "details": details,
            }
        return {
            "reconciled": False,
            "status": "NOT_FOUND_OR_PENDING",
            "details": details,
        }

    # -------------------------------------------------------------------------
    # 4. Strict Apples-to-Apples Comparison
    # -------------------------------------------------------------------------
    def compare_with_google_flights(
        self,
        origin: str,
        destination: str,
        travel_date: str,
        max_stops: Optional[int] = None,
        min_checkin_kg: float = 0.0,
        dep_time_band: Optional[str] = None,
        preferred_airlines: Optional[List[str]] = None,
        sqlite_path: str = "flight_ml_collector/live_quotes.sqlite",
    ) -> Dict[str, Any]:
        """Compare lowest Tripjack bookable fare against latest Google Flights quote in SQLite,

        strictly filtered by identical customer constraints (stops, baggage, time, airline).
        """
        query_key = f"{origin.upper()}-{destination.upper()}|{travel_date}"
        google_min: Optional[float] = None
        google_airline: Optional[str] = None
        google_obs_time: Optional[str] = None
        google_count: int = 0

        pref_set = {a.strip().upper() for a in preferred_airlines} if preferred_airlines else None

        db_file = Path(sqlite_path)
        if db_file.exists():
            with sqlite3.connect(db_file) as conn:
                c = conn.cursor()
                c.execute(
                    """
                    SELECT id, completed_at
                    FROM searches
                    WHERE query_key = ?
                    ORDER BY completed_at DESC
                    LIMIT 1
                    """,
                    (query_key,),
                )
                search_row = c.fetchone()
                if search_row:
                    s_id, s_completed = search_row
                    google_obs_time = s_completed
                    c.execute(
                        """
                        SELECT total_amount, normalized_json
                        FROM observations
                        WHERE search_id = ?
                        ORDER BY total_amount ASC
                        """,
                        (s_id,),
                    )
                    obs_rows = c.fetchall()
                    for amt, norm_str in obs_rows:
                        try:
                            norm = json.loads(norm_str) if norm_str else {}
                        except Exception:
                            norm = {}

                        # 1. Stops validation
                        is_ns = norm.get("is_nonstop")
                        stops = norm.get("stops", 0 if is_ns else 1)
                        if max_stops is not None and stops > max_stops:
                            continue

                        # 2. Airline validation (exact carrier code)
                        carrier_code = (norm.get("carrier_code") or "").strip().upper()
                        if pref_set and carrier_code not in pref_set:
                            continue

                        # 3. Baggage validation (fail closed if unknown and positive weight required)
                        bag_info = norm.get("baggage", {})
                        checked_kg = bag_info.get("checked_weight_kg")
                        if min_checkin_kg > 0:
                            if checked_kg is None or float(checked_kg) < min_checkin_kg:
                                continue

                        # 4. Departure time band validation (fail closed)
                        if dep_time_band and dep_time_band.upper() != "ANY":
                            dep_time = norm.get("departure_time")
                            if not dep_time or get_time_band(dep_time) != dep_time_band.upper():
                                continue

                        google_count += 1
                        if google_min is None or (amt is not None and amt < google_min):
                            google_min = float(amt)
                            google_airline = carrier_code

        raw_search = self.search_flights(origin, destination, travel_date)
        all_offers = self.parse_flight_offers(raw_search)
        filtered_offers = self.filter_offers(
            all_offers,
            max_stops=max_stops,
            min_checkin_kg=min_checkin_kg,
            dep_time_band=dep_time_band,
            preferred_airlines=preferred_airlines,
        )

        lowest_gds = filtered_offers[0] if filtered_offers else None
        spread_amount = None
        spread_pct = None

        if lowest_gds and google_min and lowest_gds["total_fare"]:
            spread_amount = lowest_gds["total_fare"] - google_min
            spread_pct = (spread_amount / google_min) * 100.0

        return {
            "route": f"{origin.upper()}-{destination.upper()}",
            "travel_date": travel_date,
            "preferences": {
                "max_stops": max_stops,
                "min_checkin_kg": min_checkin_kg,
                "dep_time_band": dep_time_band,
                "preferred_airlines": preferred_airlines,
            },
            "google_flights": {
                "min_price": google_min,
                "airline": google_airline,
                "matching_offers_count": google_count,
                "latest_observed_at": google_obs_time,
            },
            "tripjack_gds": {
                "matching_offers_count": len(filtered_offers),
                "total_unfiltered_count": len(all_offers),
                "lowest_offer": lowest_gds,
            },
            "price_spread": {
                "tripjack_minus_google": spread_amount,
                "percent_difference": spread_pct,
            },
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Tripjack Flight API Client CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Search subparser
    search_parser = subparsers.add_parser("search", help="Search flights on Tripjack")
    search_parser.add_argument("origin", help="Origin IATA (e.g. DEL)")
    search_parser.add_argument("destination", help="Destination IATA (e.g. BOM)")
    search_parser.add_argument("travel_date", help="Travel date YYYY-MM-DD")
    search_parser.add_argument("--top", type=int, default=5, help="Number of offers to display")

    # Review subparser
    review_parser = subparsers.add_parser("review", help="Review fare and generate bookingId")
    review_parser.add_argument("price_id", help="Tripjack price ID")

    # Order details subparser
    order_parser = subparsers.add_parser("order-details", help="Fetch confirmed order details by orderId")
    order_parser.add_argument("order_id", help="Tripjack order ID")

    # Compare subparser
    compare_parser = subparsers.add_parser("compare", help="Compare Tripjack against Google Flights DB")
    compare_parser.add_argument("origin", help="Origin IATA")
    compare_parser.add_argument("destination", help="Destination IATA")
    compare_parser.add_argument("travel_date", help="Travel date YYYY-MM-DD")
    compare_parser.add_argument("--nonstop", action="store_true", help="Filter strictly to nonstop flights")
    compare_parser.add_argument("--min-baggage", type=float, default=0.0, help="Minimum check-in baggage kg")
    compare_parser.add_argument("--time-band", choices=["MORNING", "AFTERNOON", "EVENING", "NIGHT"], default=None)
    compare_parser.add_argument("--airlines", nargs="+", default=None, help="Preferred airline codes (e.g. 6E AI)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    client = TripjackClient()

    if args.command == "search":
        print(f"Searching Tripjack for {args.origin.upper()} -> {args.destination.upper()} on {args.travel_date}...")
        t0 = time.time()
        res = client.search_flights(args.origin, args.destination, args.travel_date)
        offers = client.parse_flight_offers(res)
        elapsed = time.time() - t0
        print(f"Returned {len(offers)} offers in {elapsed:.2f}s.\n")

        print(f"Top {min(args.top, len(offers))} Cheapest Bookable Offers:")
        for idx, o in enumerate(offers[: args.top], 1):
            fare_str = f"₹{o['total_fare']:,.0f}" if o["total_fare"] else "N/A"
            nonstop_str = "Nonstop" if o["is_nonstop"] else f"{o['stops']} stop(s)"
            print(
                f"[{idx:02d}] {fare_str} | {o['airline']} ({o['flight_id']}) | {nonstop_str} | "
                f"Baggage: {o['checkin_baggage']} check-in, {o['cabin_baggage']} cabin | "
                f"Dep: {o['departure_time']}"
            )
            print(f"     Price ID: {o['price_id']}\n")

    elif args.command == "review":
        print(f"Reviewing fare for ID: {args.price_id}...")
        res = client.review_fare(args.price_id)
        booking_id = res.get("bookingId")
        cond = res.get("conditions", {})
        timeout_sec = cond.get("st", 0)
        print("Fare Review Completed!")
        print(f"Booking ID Generated: {booking_id}")
        print(f"Session TTL: {timeout_sec // 60} minutes ({timeout_sec} seconds)")
        trip_infos = res.get("tripInfos", [])
        if trip_infos:
            tf = trip_infos[0].get("totalPriceList", [{}])[0].get("fd", {}).get("ADULT", {}).get("fC", {}).get("TF")
            print(f"Verified Final Fare: ₹{tf:,.0f}")

    elif args.command == "order-details":
        print(f"Querying order details for order ID: {args.order_id}...")
        details = client.get_booking_details(args.order_id)
        print(json.dumps(details, indent=2))

    elif args.command == "compare":
        max_stops = 0 if args.nonstop else None
        min_baggage = args.min_baggage
        pref_desc = []
        if args.nonstop:
            pref_desc.append("Nonstop Only")
        if min_baggage > 0:
            pref_desc.append(f">= {min_baggage}kg Baggage")
        if args.time_band:
            pref_desc.append(f"Time: {args.time_band}")
        if args.airlines:
            pref_desc.append(f"Airlines: {', '.join(args.airlines)}")
        pref_str = f" [Preferences: {', '.join(pref_desc)}]" if pref_desc else ""

        print(f"Comparing Google Flights vs Tripjack for {args.origin.upper()} -> {args.destination.upper()} on {args.travel_date}{pref_str}...")
        cmp_result = client.compare_with_google_flights(
            args.origin,
            args.destination,
            args.travel_date,
            max_stops=max_stops,
            min_checkin_kg=min_baggage,
            dep_time_band=args.time_band,
            preferred_airlines=args.airlines,
        )
        gf = cmp_result["google_flights"]
        tj = cmp_result["tripjack_gds"]
        spread = cmp_result["price_spread"]

        print("\n" + "=" * 65)
        print(f"TWO-TIER APPLES-TO-APPLES REPORT: {cmp_result['route']} | {cmp_result['travel_date']}{pref_str}")
        print("=" * 65)
        gf_price = f"₹{gf['min_price']:,.0f}" if gf["min_price"] else "No matching quotes in DB"
        gf_airline = f" ({gf['airline']})" if gf.get("airline") else ""
        print(f"Tier 1 (Google Flights Matching): {gf_price}{gf_airline} (from {gf['matching_offers_count']} matching offers)")
        if tj["lowest_offer"]:
            lo = tj["lowest_offer"]
            print(f"Tier 2 (Tripjack GDS Wholesale):  ₹{lo['total_fare']:,.0f} ({lo['airline']} - {lo['flight_id']})")
            print(f"       Verified Baggage:          {lo['checkin_baggage']} check-in, {lo['cabin_baggage']} cabin")
        else:
            print("Tier 2 (Tripjack GDS Wholesale):  No offers matched all constraints.")
        if spread["tripjack_minus_google"] is not None:
            diff = spread["tripjack_minus_google"]
            pct = spread["percent_difference"]
            direction = "cheaper than" if diff < 0 else "more expensive than"
            print(f"Spread Analysis:                  Tripjack is ₹{abs(diff):,.0f} ({abs(pct):.1f}%) {direction} Google Flights")
        print("=" * 65)


if __name__ == "__main__":
    main()
