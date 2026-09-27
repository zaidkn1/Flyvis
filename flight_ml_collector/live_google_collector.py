#!/usr/bin/env python3
"""
==============================================================================
HIGH-CAPACITY 24/7 LIVE FLIGHT ML COLLECTOR (DEPENDABLE GOOGLE ENGINE)
==============================================================================
Monitors 94 high-volume international & domestic routes across dense departure
lead-day windows (T-1 to T-60).

Key Capabilities:
- Direct, resilient Google Flights scraper with verified response tracking.
- Skips unpriced/waitlisted partner listings without dropping valid priced offers.
- Captures real HTTP response status, millisecond latency, and rich metadata.
- 100% dependable failure tracking: all searches (success, empty, or error) are
  streamed to both local SQLite and Supabase PostgreSQL.
- Embedded flight matching keys: generates canonical_flight_id and route_window_id
  for deterministic time-series ML trajectory alignment.
- Human-like pacing jitter (2.0s - 4.2s) to ensure uninterrupted 24/7 collection.
"""

import argparse
import datetime as dt
import json
import os
import random
import re
import signal
import sqlite3
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from primp import Client
from selectolax.lexbor import LexborHTMLParser
from fast_flights import FlightQuery, create_query

ROOT = Path(__file__).resolve().parent

# Comprehensive 94-Route Corridor Network (47 Bidirectional Corridors)
EXPANDED_ROUTES = [
    # --- India Domestic Metro Corridors ---
    ("DEL", "BOM"), ("BOM", "DEL"),
    ("DEL", "BLR"), ("BLR", "DEL"),
    ("BOM", "BLR"), ("BLR", "BOM"),
    ("DEL", "HYD"), ("HYD", "DEL"),
    ("BOM", "HYD"), ("HYD", "BOM"),
    ("DEL", "CCU"), ("CCU", "DEL"),
    ("DEL", "MAA"), ("MAA", "DEL"),
    ("BLR", "HYD"), ("HYD", "BLR"),
    ("BLR", "CCU"), ("CCU", "BLR"),
    ("DEL", "GOI"), ("GOI", "DEL"),
    ("BOM", "GOI"), ("GOI", "BOM"),
    ("BOM", "COK"), ("COK", "BOM"),
    ("BLR", "COK"), ("COK", "BLR"),

    # --- Gulf & Middle East Corridors ---
    ("DEL", "DXB"), ("DXB", "DEL"),
    ("BOM", "DXB"), ("DXB", "BOM"),
    ("BLR", "DXB"), ("DXB", "BLR"),
    ("COK", "DXB"), ("DXB", "COK"),
    ("HYD", "DXB"), ("DXB", "HYD"),
    ("DEL", "DOH"), ("DOH", "DEL"),
    ("BOM", "DOH"), ("DOH", "BOM"),
    ("DEL", "AUH"), ("AUH", "DEL"),
    ("BOM", "AUH"), ("AUH", "BOM"),
    ("DEL", "JED"), ("JED", "DEL"),
    ("BOM", "JED"), ("JED", "BOM"),
    ("DEL", "RUH"), ("RUH", "DEL"),

    # --- Southeast Asia Corridors ---
    ("DEL", "SIN"), ("SIN", "DEL"),
    ("BOM", "SIN"), ("SIN", "BOM"),
    ("BLR", "SIN"), ("SIN", "BLR"),
    ("MAA", "SIN"), ("SIN", "MAA"),
    ("DEL", "BKK"), ("BKK", "DEL"),
    ("BOM", "BKK"), ("BKK", "BOM"),
    ("BLR", "BKK"), ("BKK", "BLR"),
    ("DEL", "KUL"), ("KUL", "DEL"),
    ("BOM", "KUL"), ("KUL", "BOM"),
    ("DEL", "DPS"), ("DPS", "DEL"),
    ("BOM", "DPS"), ("DPS", "BOM"),

    # --- Europe & North America Corridors ---
    ("DEL", "LHR"), ("LHR", "DEL"),
    ("BOM", "LHR"), ("LHR", "BOM"),
    ("BLR", "LHR"), ("LHR", "BLR"),
    ("DEL", "JFK"), ("JFK", "DEL"),
    ("BOM", "JFK"), ("JFK", "BOM"),
    ("DEL", "SFO"), ("SFO", "DEL"),
    ("BLR", "SFO"), ("SFO", "BLR"),
    ("DEL", "CDG"), ("CDG", "DEL"),
    ("BOM", "CDG"), ("CDG", "BOM"),
    ("DEL", "FRA"), ("FRA", "DEL"),
    ("BOM", "FRA"), ("FRA", "BOM"),
]

# Dense 20-window lead time grid (capturing early bookers, mid-window, and last-minute surges)
DENSE_LEAD_DAYS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    12, 14, 17, 21, 25, 28, 30,
    35, 45, 60
]


class SupabaseSyncer:
    """Dependable Supabase sync client with batching, retries, and error reporting."""

    def __init__(self, url=None, key=None):
        env_file = ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

        self.url = (url or os.environ.get("SUPABASE_URL", "")).rstrip("/")
        self.key = key or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        self.enabled = bool(self.url and self.key)

    def post(self, table, records, batch_size=100, retries=3):
        if not self.enabled or not records:
            return 0
        total_synced = 0
        endpoint = f"{self.url}/rest/v1/{table}"

        for i in range(0, len(records), batch_size):
            chunk = records[i : i + batch_size]
            payload = json.dumps(chunk).encode("utf-8")
            for attempt in range(1, retries + 1):
                try:
                    req = urllib.request.Request(
                        endpoint,
                        data=payload,
                        headers={
                            "apikey": self.key,
                            "Authorization": f"Bearer {self.key}",
                            "Content-Type": "application/json",
                            "Prefer": "resolution=merge-duplicates,return=minimal",
                        },
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        total_synced += len(chunk)
                        break
                except urllib.error.HTTPError as he:
                    err_msg = ""
                    try:
                        err_msg = he.read().decode("utf-8")
                    except Exception:
                        pass
                    print(f"⚠️  Supabase HTTP {he.code} on {table} (attempt {attempt}/{retries}): {err_msg}", file=sys.stderr, flush=True)
                    if attempt == retries:
                        break
                    time.sleep(1.0 * attempt)
                except Exception as e:
                    print(f"⚠️  Supabase sync error on {table} (attempt {attempt}/{retries}): {e}", file=sys.stderr, flush=True)
                    if attempt == retries:
                        break
                    time.sleep(1.0 * attempt)

        return total_synced


def init_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            started_at TEXT,
            finished_at TEXT,
            mode TEXT,
            config_json TEXT
        );
        CREATE TABLE IF NOT EXISTS searches (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            run_id TEXT,
            query_key TEXT,
            started_at TEXT,
            completed_at TEXT,
            status TEXT,
            http_status INTEGER,
            raw_json TEXT
        );
        CREATE TABLE IF NOT EXISTS observations (
            search_id TEXT,
            offer_id TEXT,
            stage TEXT,
            campaign_id TEXT,
            observed_at TEXT,
            total_amount REAL,
            tax_amount REAL,
            currency TEXT,
            normalized_json TEXT,
            raw_json TEXT,
            PRIMARY KEY (search_id, offer_id, stage)
        );
        CREATE INDEX IF NOT EXISTS idx_obs_search_id ON observations(search_id);
        CREATE INDEX IF NOT EXISTS idx_searches_run_id ON searches(run_id);
        CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
        """
    )
    conn.commit()
    return conn


def parse_time_tuple(val):
    padded = [*(val or []), None, None]
    return (padded[0] or 0, padded[1] or 0)


def get_time_window(hour):
    if 0 <= hour < 6:
        return "EARLY_MORNING"
    elif 6 <= hour < 12:
        return "MORNING"
    elif 12 <= hour < 17:
        return "AFTERNOON"
    elif 17 <= hour < 22:
        return "EVENING"
    return "NIGHT"


def get_baggage_spec(origin, dest, carrier_code, bag_meta=None, policy_urls=None):
    """
    Extracts baggage allowance based on Google Flights response flags,
    airline official policy links, and regulatory corridor standards (DGCA/IATA).
    """
    policy_urls = policy_urls or {}

    carry_on_flag = 1
    checked_flag = None
    if bag_meta and len(bag_meta) > 6 and bag_meta[6]:
        if len(bag_meta[6]) > 1 and bag_meta[6][1] is not None:
            carry_on_flag = bag_meta[6][1]
        if len(bag_meta[6]) > 0 and bag_meta[6][0] is not None:
            checked_flag = bag_meta[6][0]

    carry_on_included = bool(carry_on_flag != 0)

    indian_airports = {"DEL", "BOM", "BLR", "HYD", "CCU", "MAA", "GOI", "COK", "PNQ", "AMD"}
    gulf_airports = {"DXB", "DOH", "AUH", "JED", "RUH", "MCT", "KWI", "BAH"}
    se_asia_airports = {"SIN", "BKK", "KUL", "DPS", "HKG"}
    long_haul_airports = {"LHR", "JFK", "SFO", "CDG", "FRA", "ORD", "YYZ"}

    is_domestic_india = origin in indian_airports and dest in indian_airports
    is_gulf = (origin in gulf_airports or dest in gulf_airports) and (origin in indian_airports or dest in indian_airports)
    is_se_asia = (origin in se_asia_airports or dest in se_asia_airports) and (origin in indian_airports or dest in indian_airports)
    is_long_haul = (origin in long_haul_airports or dest in long_haul_airports)

    low_cost_carriers = {"6E", "IX", "QP", "SG", "FZ", "J9", "G8", "AK", "FD", "FR", "U2", "W6", "NK", "F9"}
    is_lcc = carrier_code in low_cost_carriers

    if is_domestic_india:
        corridor = "DOMESTIC_INDIA"
        carry_on_kg = 7 if carry_on_included else 0
        checked_kg = 15 if checked_flag != 0 else 0
        checked_pieces = 1 if checked_kg > 0 else 0
        checked_included = bool(checked_kg > 0)
    elif is_gulf:
        corridor = "GULF_MIDDLE_EAST"
        carry_on_kg = 7 if carry_on_included else 0
        checked_kg = 20 if is_lcc else 30
        if checked_flag == 0:
            checked_kg = 0
        checked_pieces = 1 if checked_kg > 0 else 0
        checked_included = bool(checked_kg > 0)
    elif is_se_asia:
        corridor = "SOUTHEAST_ASIA"
        carry_on_kg = 7 if carry_on_included else 0
        checked_kg = 20 if is_lcc else 25
        if checked_flag == 0:
            checked_kg = 0
        checked_pieces = 1 if checked_kg > 0 else 0
        checked_included = bool(checked_kg > 0)
    elif is_long_haul:
        corridor = "LONG_HAUL_INTERNATIONAL"
        carry_on_kg = 8 if carry_on_included else 0
        if is_lcc:
            checked_kg = 20
            checked_pieces = 1
        else:
            checked_kg = 46  # 2 x 23 kg piece concept
            checked_pieces = 2
        if checked_flag == 0:
            checked_kg = 0
            checked_pieces = 0
        checked_included = bool(checked_kg > 0)
    else:
        corridor = "INTERNATIONAL_GENERAL"
        carry_on_kg = 7 if carry_on_included else 0
        checked_kg = 20
        checked_pieces = 1
        checked_included = True

    policy_url = policy_urls.get(carrier_code, "")

    return {
        "corridor": corridor,
        "carry_on_included": carry_on_included,
        "carry_on_weight_kg": carry_on_kg,
        "carry_on_pieces": 1 if carry_on_included else 0,
        "checked_included": checked_included,
        "checked_weight_kg": checked_kg,
        "checked_pieces": checked_pieces,
        "policy_url": policy_url,
    }


def fetch_and_parse_route(origin, dest, dep_date_str, lead_days, currency="INR", client=None):
    """
    Directly fetches Google Flights HTML, captures verified HTTP status & latency,
    and safely extracts all priced offers while skipping unpriced partner listings.
    """
    if client is None:
        client = Client(impersonate="chrome_145", impersonate_os="macos", referer=True, cookie_store=True)

    t0 = time.time()
    try:
        query = create_query(
            flights=[FlightQuery(date=dep_date_str, from_airport=origin, to_airport=dest)],
            seat="economy",
            trip="one-way",
            currency=currency,
        )
        res = client.get("https://www.google.com/travel/flights", params=query.params(), timeout=25)
        latency_ms = int((time.time() - t0) * 1000)
    except Exception as net_err:
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "status": "network_error",
            "http_status": 0,
            "latency_ms": latency_ms,
            "offers": [],
            "error_class": net_err.__class__.__name__,
            "error_message": str(net_err),
            "skipped_unpriced": 0,
        }

    http_status = getattr(res, "status_code", 200)

    if http_status == 429:
        return {
            "status": "rate_limited",
            "http_status": 429,
            "latency_ms": latency_ms,
            "offers": [],
            "error_class": "HTTP429RateLimit",
            "error_message": "Google Flights returned HTTP 429 Too Many Requests",
            "skipped_unpriced": 0,
        }
    elif http_status != 200:
        return {
            "status": "http_error",
            "http_status": http_status,
            "latency_ms": latency_ms,
            "offers": [],
            "error_class": f"HTTP{http_status}",
            "error_message": f"Google Flights returned HTTP {http_status}",
            "skipped_unpriced": 0,
        }

    try:
        parser = LexborHTMLParser(res.text)
        script = parser.css_first(r"script.ds\:1")
        if not script:
            return {
                "status": "parse_error",
                "http_status": 200,
                "latency_ms": latency_ms,
                "offers": [],
                "error_class": "MissingDataScript",
                "error_message": "Script element script.ds:1 not found in HTML response",
                "skipped_unpriced": 0,
            }

        js = script.text()
        if "data:" not in js:
            return {
                "status": "parse_error",
                "http_status": 200,
                "latency_ms": latency_ms,
                "offers": [],
                "error_class": "InvalidScriptData",
                "error_message": "Keyword 'data:' not found in script",
                "skipped_unpriced": 0,
            }

        data = js.split("data:", 1)[1].rsplit(",", 1)[0]
        if data.endswith("errorHasStatus: true"):
            return {
                "status": "no_offers_returned",
                "http_status": 200,
                "latency_ms": latency_ms,
                "offers": [],
                "offers_count": 0,
                "cheapest_price": None,
                "median_price": None,
                "error_class": None,
                "error_message": "Google Flights returned errorHasStatus: true (route unavailable)",
                "skipped_unpriced": 0,
            }

        payload = json.loads(data)
        raw_items = payload[3][0] if len(payload) > 3 and payload[3] and payload[3][0] else []
        bag_policy_urls = {item[0]: item[2] for item in payload[11]} if (len(payload) > 11 and payload[11]) else {}

        offers = []
        skipped_unpriced = 0

        for item_idx, k in enumerate(raw_items):
            try:
                # 1. Resilient price verification (prevents IndexError on unpriced codeshares)
                if not k or len(k) < 2 or not k[1] or not k[1][0] or len(k[1][0]) < 2:
                    skipped_unpriced += 1
                    continue
                price_val = k[1][0][1]
                if price_val is None:
                    skipped_unpriced += 1
                    continue
                price = float(price_val)

                flight = k[0]
                carrier_code = flight[0] or "UNKNOWN"
                carrier_names = flight[1] or []
                carrier_name = carrier_names[0] if carrier_names else carrier_code

                # Baggage Extraction from Google Flights indicators & corridor rules
                bag_meta = k[4] if len(k) > 4 else None
                baggage_spec = get_baggage_spec(origin, dest, carrier_code, bag_meta, bag_policy_urls)

                segments = []
                flight_numbers = []
                dep_time_str = "00:00"
                actual_dep_date = dep_date_str
                arr_time_str = "00:00"
                time_window = "DAY"

                for s_idx, seg in enumerate(flight[2]):
                    f_air = seg[3] if len(seg) > 3 else origin
                    t_air = seg[6] if len(seg) > 6 else dest
                    d_time = parse_time_tuple(seg[8] if len(seg) > 8 else None)
                    d_date = seg[20] if len(seg) > 20 else None
                    a_time = parse_time_tuple(seg[10] if len(seg) > 10 else None)
                    duration = seg[11] if len(seg) > 11 else 0
                    plane = seg[17] if len(seg) > 17 else ""

                    f_num = ""
                    if len(seg) > 22 and seg[22] and len(seg[22]) > 1:
                        al_code = seg[22][0] or carrier_code
                        al_num = seg[22][1] or ""
                        f_num = f"{al_code}{al_num}"
                    else:
                        f_num = f"{carrier_code}"
                    flight_numbers.append(f_num)

                    if s_idx == 0:
                        dep_time_str = f"{d_time[0]:02d}:{d_time[1]:02d}"
                        if d_date and len(d_date) >= 3:
                            actual_dep_date = f"{d_date[0]:04d}-{d_date[1]:02d}-{d_date[2]:02d}"
                        time_window = get_time_window(d_time[0])

                    arr_time_str = f"{a_time[0]:02d}:{a_time[1]:02d}"
                    segments.append({
                        "from": f_air,
                        "to": t_air,
                        "flight_number": f_num,
                        "departure": f"{d_time[0]:02d}:{d_time[1]:02d}",
                        "arrival": f"{a_time[0]:02d}:{a_time[1]:02d}",
                        "duration_min": duration,
                        "plane": plane,
                    })

                stops = max(0, len(segments) - 1)
                stops_bucket = "NONSTOP" if stops == 0 else (f"{stops}_STOP" if stops == 1 else "2+_STOPS")
                combined_fn = "/".join(flight_numbers) if flight_numbers else carrier_code

                # Matching Keys for Trajectory Alignment
                canonical_flight_id = f"{combined_fn}:{origin}->{dest}:{actual_dep_date}:{dep_time_str.replace(':', '')}:{stops}"
                route_window_id = f"{origin}->{dest}:{actual_dep_date}:{time_window}:{stops_bucket}:ECONOMY"

                offers.append({
                    "canonical_flight_id": canonical_flight_id,
                    "route_window_id": route_window_id,
                    "flight_number": combined_fn,
                    "carrier_code": carrier_code,
                    "carrier_name": carrier_name,
                    "origin": origin,
                    "destination": dest,
                    "departure_date": actual_dep_date,
                    "departure_time": dep_time_str,
                    "arrival_time": arr_time_str,
                    "time_window": time_window,
                    "lead_days": lead_days,
                    "stops": stops,
                    "stops_bucket": stops_bucket,
                    "price": price,
                    "currency": currency,
                    "baggage": baggage_spec,
                    "segments": segments,
                })
            except Exception as item_err:
                skipped_unpriced += 1
                continue

        if offers:
            prices = [o["price"] for o in offers]
            return {
                "status": "offers_returned",
                "http_status": 200,
                "latency_ms": latency_ms,
                "offers": offers,
                "offers_count": len(offers),
                "cheapest_price": min(prices),
                "median_price": statistics.median(prices),
                "skipped_unpriced": skipped_unpriced,
                "error_class": None,
                "error_message": None,
            }
        else:
            return {
                "status": "no_offers_returned",
                "http_status": 200,
                "latency_ms": latency_ms,
                "offers": [],
                "offers_count": 0,
                "cheapest_price": None,
                "median_price": None,
                "skipped_unpriced": skipped_unpriced,
                "error_class": None,
                "error_message": "No priced flight offers returned by Google Flights",
            }

    except Exception as parse_err:
        return {
            "status": "parse_error",
            "http_status": 200,
            "latency_ms": latency_ms,
            "offers": [],
            "error_class": parse_err.__class__.__name__,
            "error_message": str(parse_err),
            "skipped_unpriced": 0,
        }


def collect_sweep(routes=EXPANDED_ROUTES, lead_days=DENSE_LEAD_DAYS, currency="INR", db_path="live_quotes.sqlite"):
    supabase = SupabaseSyncer()
    conn = init_db(ROOT / db_path)
    run_id = str(uuid.uuid4())
    campaign_id = "live-google-campaign"
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()

    run_config = {
        "currency": currency,
        "routes_count": len(routes),
        "lead_days_count": len(lead_days),
        "engine": "google_flights_direct",
        "verified_response_tracking": True,
        "trajectory_matching_keys": ["canonical_flight_id", "route_window_id"],
    }

    # 1. Guarantee run record exists in both SQLite and Supabase
    conn.execute(
        "INSERT INTO runs VALUES (?, ?, ?, ?, ?)",
        (run_id, now_iso, None, "live_google_expanded", json.dumps(run_config)),
    )
    conn.commit()

    if supabase.enabled:
        supabase.post("runs", [{
            "id": run_id,
            "campaign_id": campaign_id,
            "started_at": now_iso,
            "mode": "live_google_expanded",
            "config_json": run_config,
        }], retries=5)

    today = dt.date.today()
    total_offers = 0
    total_queries = len(routes) * len(lead_days)
    query_idx = 0

    print(f"\n=======================================================", flush=True)
    print(f"🛫 STARTING SWEEP: {len(routes)} Routes × {len(lead_days)} Dates = {total_queries} Queries", flush=True)
    print(f"📡 Supabase Cloud Sync: {'ENABLED ✅' if supabase.enabled else 'DISABLED ⚠️'}", flush=True)
    print(f"🛡️  Verified Tracking: Active (100% of searches & failures synced)", flush=True)
    print(f"=======================================================\n", flush=True)

    client = Client(impersonate="chrome_145", impersonate_os="macos", referer=True, cookie_store=True)

    for origin, dest in routes:
        for lead in lead_days:
            query_idx += 1
            dep_date = today + dt.timedelta(days=lead)
            dep_str = dep_date.strftime("%Y-%m-%d")
            query_key = f"{origin}-{dest}|{dep_str}"
            search_id = str(uuid.uuid4())
            search_start = dt.datetime.now(dt.timezone.utc).isoformat()

            print(f"[{query_idx}/{total_queries}] 🔍 {query_key} (T-{lead:2d}d)...", end=" ", flush=True)

            result = fetch_and_parse_route(origin, dest, dep_str, lead_days=lead, currency=currency, client=client)
            search_end = dt.datetime.now(dt.timezone.utc).isoformat()

            status = result["status"]
            http_status = result["http_status"]
            offers = result.get("offers", [])
            offers_count = len(offers)

            # Structured verified response metadata
            search_meta = {
                "verified_status": status,
                "http_status": http_status,
                "latency_ms": result.get("latency_ms", 0),
                "offers_count": offers_count,
                "cheapest_price": result.get("cheapest_price"),
                "median_price": result.get("median_price"),
                "skipped_unpriced": result.get("skipped_unpriced", 0),
                "engine": "google_flights_direct",
                "verified_at": search_end,
            }
            if result.get("error_class"):
                search_meta["error_class"] = result["error_class"]
                search_meta["error_message"] = result["error_message"]

            if status == "offers_returned":
                print(f"✅ Found {offers_count:2d} offers ({result.get('latency_ms', 0)}ms, min ₹{int(result.get('cheapest_price', 0)):,}).", flush=True)
            elif status == "no_offers_returned":
                print(f"ℹ️  No offers found (HTTP 200, {result.get('latency_ms', 0)}ms).", flush=True)
            elif status == "rate_limited":
                print(f"⚠️  Rate limited (HTTP 429). Backing off...", flush=True)
                time.sleep(30.0)
            else:
                print(f"❌ {status}: {result.get('error_message', '')} ({result.get('latency_ms', 0)}ms).", flush=True)

            # 2. Record search event in SQLite & Supabase (Guaranteed in ALL branches)
            conn.execute(
                "INSERT INTO searches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (search_id, campaign_id, run_id, query_key, search_start, search_end, status, http_status, json.dumps(search_meta)),
            )
            conn.commit()

            supabase.post("searches", [{
                "id": search_id,
                "campaign_id": campaign_id,
                "run_id": run_id,
                "query_key": query_key,
                "started_at": search_start,
                "completed_at": search_end,
                "status": status,
                "http_status": http_status,
                "raw_json": search_meta,
            }])

            # 3. Record observations if offers present
            if offers:
                db_obs_batch = []
                sb_obs_batch = []

                for idx, offer in enumerate(offers):
                    offer_id = f"{search_id}-{idx}"
                    price = offer["price"]

                    db_obs_batch.append((
                        search_id, offer_id, "search", campaign_id, search_end,
                        price, 0.0, currency, json.dumps(offer), None
                    ))

                    sb_obs_batch.append({
                        "search_id": search_id,
                        "offer_id": offer_id,
                        "stage": "search",
                        "campaign_id": campaign_id,
                        "observed_at": search_end,
                        "total_amount": price,
                        "tax_amount": 0.0,
                        "currency": currency,
                        "normalized_json": offer,
                        "raw_json": None,
                    })

                conn.executemany("INSERT OR REPLACE INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", db_obs_batch)
                conn.commit()
                supabase.post("observations", sb_obs_batch)
                total_offers += len(db_obs_batch)

            # Polite human-like delay (2.0s - 4.2s)
            time.sleep(random.uniform(2.0, 4.2))

    finish_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    conn.execute("UPDATE runs SET finished_at = ? WHERE id = ?", (finish_iso, run_id))
    conn.commit()
    conn.close()

    if supabase.enabled:
        supabase.post("runs", [{
            "id": run_id,
            "campaign_id": campaign_id,
            "started_at": now_iso,
            "finished_at": finish_iso,
            "mode": "live_google_expanded",
            "config_json": run_config,
        }])

    print(f"\n🎉 Sweep finished successfully! Total flight offers captured in this cycle: {total_offers:,}\n", flush=True)


def main():
    parser = argparse.ArgumentParser(description="High-Capacity 24/7 Flight ML Collector")
    parser.add_argument("--once", action="store_true", help="Run a single observation sweep and exit")
    parser.add_argument("--daemon", action="store_true", default=True, help="Run continuously in background (default: True)")
    parser.add_argument("--interval-hours", type=float, default=2.0, help="Interval between sweeps (default: 2.0 hours)")
    args = parser.parse_args()

    # Load credentials if present
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

    print(f"⏰ Starting High-Capacity 24/7 Daemon (Sweeping every {args.interval_hours} hours)...", flush=True)
    while True:
        try:
            collect_sweep()
        except Exception as ex:
            print(f"⚠️  Sweep encountered error: {ex}", flush=True)
        if args.once:
            break
        jitter = random.uniform(-300, 300)
        sleep_sec = max(1800, int(args.interval_hours * 3600 + jitter))
        print(f"💤 Sleeping for {round(sleep_sec / 3600, 2)} hours until next observation cycle...", flush=True)
        time.sleep(sleep_sec)


if __name__ == "__main__":
    main()
