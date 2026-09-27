"""Fail-closed reference checks for partner-normalized flight offers.

No network, payment, provider order, or ticketing calls occur here.
"""

from datetime import datetime, date, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
import re


IATA = re.compile(r"^[A-Z]{3}$")
CARRIER = re.compile(r"^[A-Z0-9]{2}$")
MONEY_FIELDS = (
    "base_amount", "taxes_fees_amount", "baggage_amount",
    "other_required_services_amount", "total_amount",
)


def _instant(value):
    if not isinstance(value, str):
        raise ValueError("timestamp missing")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp must have UTC offset")
    return parsed


def _amount(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d+(?:\.\d{1,2})?", value):
        raise ValueError("amount must be a nonnegative decimal string with at most 2 places")
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("invalid amount") from exc


def _local_time(value):
    return time.fromisoformat(value)


def _in_window(departure, window):
    start_s, end_s = window.split("-", 1)
    start, end = _local_time(start_s), _local_time(end_s)
    clock = departure.timetz().replace(tzinfo=None)
    return start <= clock < end if start < end else (clock >= start or clock < end)


def _itinerary_key(offer):
    return tuple(
        (s["origin"], s["destination"], s["departing_at"],
         s["arriving_at"], s["marketing_airline"], s["flight_number"])
        for s in offer["segments"]
    )


def evaluate_offer(request, offer, *, now=None, max_age_seconds=300, allow_test_mode=False):
    """Return (eligible: bool, reasons: list[str]); every missing fact fails closed."""
    reasons = []
    now = now or datetime.now(timezone.utc)
    try:
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("now must have UTC offset")
        for airport in (request["origin"], request["destination"]):
            if not IATA.fullmatch(airport):
                raise ValueError("invalid request airport")
        requested_day = date.fromisoformat(request["departure_date"])
        cabin = request["cabin"]
        if not isinstance(cabin, str) or not cabin:
            raise ValueError("missing cabin")
        passengers = request["passenger_ids"]
        if not isinstance(passengers, list) or not passengers or len(passengers) != len(set(passengers)):
            raise ValueError("passenger IDs missing or duplicated")
        bag_count = request["checked_bags_per_passenger"]
        bag_kg = Decimal(str(request["min_kg_per_checked_bag"]))
        max_stops = request["max_stops"]
        if type(bag_count) is not int or bag_count < 0 or bag_kg < 0 or type(max_stops) is not int or max_stops < 0:
            raise ValueError("invalid baggage or stop constraint")
        windows = request["departure_windows"]
        allowed_airlines = request["allowed_airlines"]
        required_flight_number = request.get("required_flight_number")
        if required_flight_number is not None and (not isinstance(required_flight_number, str) or not required_flight_number.strip()):
            raise ValueError("invalid exact flight requirement")
        if not isinstance(windows, list) or not isinstance(allowed_airlines, list):
            raise ValueError("invalid windows or airline constraint")
        for w in windows:
            _in_window(now, w)  # format check
        if any(not CARRIER.fullmatch(a) for a in allowed_airlines):
            raise ValueError("invalid marketing carrier")
        budget = _amount(request["max_total_amount"])
        if not re.fullmatch(r"^[A-Z]{3}$", request["currency"]):
            raise ValueError("invalid request currency")
    except (KeyError, TypeError, ValueError, InvalidOperation, OverflowError) as exc:
        return False, [f"invalid_request:{type(exc).__name__}"]

    try:
        if not offer["provider"] or not offer["offer_id"]:
            reasons.append("missing_provider_or_offer_id")
        if offer["live_mode"] is not True and not (allow_test_mode and offer["live_mode"] is False):
            reasons.append("not_live_offer")
        if offer["available"] is not True:
            reasons.append("availability_not_confirmed")
        if offer["single_ticket"] is not True:
            reasons.append("separate_or_unconfirmed_tickets")
        if offer["all_mandatory_charges_included"] is not True:
            reasons.append("incomplete_total_confirmation")
        observed, expiry = _instant(offer["observed_at"]), _instant(offer["expires_at"])
        if observed > now + timedelta(seconds=30) or (now - observed).total_seconds() > max_age_seconds:
            reasons.append("stale_or_future_quote")
        if expiry <= now or expiry <= observed:
            reasons.append("expired_offer")
        if offer["currency"] != request["currency"]:
            reasons.append("currency_mismatch")
        if offer["passenger_ids"] != passengers:
            reasons.append("passenger_mismatch")
        price = offer["price"]
        amounts = {name: _amount(price[name]) for name in MONEY_FIELDS}
        if sum(amounts[name] for name in MONEY_FIELDS[:-1]) != amounts["total_amount"]:
            reasons.append("incomplete_or_inconsistent_total")
        if amounts["total_amount"] > budget:
            reasons.append("over_budget")
        segments = offer["segments"]
        if not isinstance(segments, list) or not segments:
            reasons.append("missing_segments")
        else:
            if segments[0]["origin"] != request["origin"] or segments[-1]["destination"] != request["destination"]:
                reasons.append("route_mismatch")
            if len(segments) - 1 > max_stops:
                reasons.append("too_many_stops")
            if required_flight_number and (len(segments) != 1 or segments[0]["flight_number"] != required_flight_number):
                reasons.append("exact_flight_mismatch")
            previous_arrival = None
            for index, segment in enumerate(segments):
                dep, arr = _instant(segment["departing_at"]), _instant(segment["arriving_at"])
                if dep >= arr or (previous_arrival and dep <= previous_arrival):
                    reasons.append("invalid_timing")
                if index and segments[index - 1]["destination"] != segment["origin"]:
                    reasons.append("disconnected_itinerary")
                previous_arrival = arr
                if not IATA.fullmatch(segment["origin"]) or not IATA.fullmatch(segment["destination"]):
                    reasons.append("invalid_segment_airport")
                if not CARRIER.fullmatch(segment["marketing_airline"]) or not segment["flight_number"]:
                    reasons.append("missing_flight_identity")
                if allowed_airlines and segment["marketing_airline"] not in allowed_airlines:
                    reasons.append("airline_mismatch")
                if segment["cabin"] != cabin:
                    reasons.append("cabin_mismatch")
                bags = segment["baggage_by_passenger"]
                if set(bags) != set(passengers):
                    reasons.append("baggage_passenger_mismatch")
                else:
                    for pid in passengers:
                        entitled = bags[pid]
                        if not isinstance(entitled, list) or len(entitled) < bag_count:
                            reasons.append("insufficient_checked_bags")
                            continue
                        for bag in entitled[:bag_count]:
                            if bag["confirmed_in_total"] is not True or Decimal(str(bag["max_weight_kg"])) < bag_kg:
                                reasons.append("unconfirmed_or_underweight_bag")
            first_dep = _instant(segments[0]["departing_at"])
            if first_dep.date() != requested_day:
                reasons.append("departure_date_mismatch")
            if windows and not any(_in_window(first_dep, w) for w in windows):
                reasons.append("departure_window_mismatch")
    except (KeyError, TypeError, ValueError, InvalidOperation, OverflowError, AttributeError) as exc:
        reasons.append(f"incomplete_or_invalid_offer:{type(exc).__name__}")
    return not reasons, list(dict.fromkeys(reasons))


def evaluate_reprice(request, original, repriced, *, now=None, max_age_seconds=120, allow_test_mode=False):
    """Pre-order gate; does not create a hold, order, charge, or ticket."""
    eligible, reasons = evaluate_offer(request, repriced, now=now, max_age_seconds=max_age_seconds, allow_test_mode=allow_test_mode)
    try:
        if repriced["provider"] != original["provider"]:
            reasons.append("provider_changed")
        if repriced["reprice_of_offer_id"] != original["offer_id"]:
            reasons.append("not_a_reprice_of_selected_offer")
        if _itinerary_key(repriced) != _itinerary_key(original):
            reasons.append("itinerary_changed")
    except (KeyError, TypeError, ValueError):
        reasons.append("missing_reprice_identity")
    return eligible and not reasons, list(dict.fromkeys(reasons))
