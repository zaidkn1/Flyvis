#!/usr/bin/env python3
"""
==============================================================================
STEALTH GOOGLE FLIGHTS 60-DAY ROUTE COLLECTOR & ML FEATURE EXTRACTOR
==============================================================================
Scrapes flight fare trajectories across a 60-day forward horizon (T+1 to T+60)
for any origin-destination route using browser TLS/HTTP2 impersonation (undetected).

Outputs directly to CSV / SQLite formatted for AI/ML price prediction models.

Usage:
    python scrape_route_60d.py --origin DEL --dest DXB --days 60 --currency INR
    python scrape_route_60d.py --origin BOM --dest LHR --days 30 --output my_dataset.csv
"""

import argparse
import datetime as dt
import json
import os
import random
import sys
import time
from pathlib import Path

try:
    from primp import Client
    from selectolax.lexbor import LexborHTMLParser
    from fast_flights import FlightQuery, create_query
except ImportError:
    print("❌ Missing required dependencies. Install them with:")
    print("   pip install primp fast-flights selectolax pandas")
    sys.exit(1)


def parse_time_tuple(val):
    padded = [*(val or []), None, None]
    return f"{(padded[0] or 0):02d}:{(padded[1] or 0):02d}"


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


def scrape_route_lead_day(client, origin, dest, dep_date_str, lead_days, currency="INR"):
    """
    Queries Google Flights with full Chrome 145 TLS/HTTP-2 impersonation.
    Extracts structured JSON payload directly from the response DOM.
    """
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
    except Exception as e:
        return {"status": "network_error", "error": str(e), "offers": []}

    if res.status_code != 200:
        return {"status": f"http_{res.status_code}", "error": f"HTTP {res.status_code}", "offers": []}

    try:
        parser = LexborHTMLParser(res.text)
        script = parser.css_first(r"script.ds\:1")
        if not script or "data:" not in script.text():
            return {"status": "parse_error", "error": "script.ds:1 data payload not found", "offers": []}

        raw_js = script.text()
        data_str = raw_js.split("data:", 1)[1].rsplit(",", 1)[0]
        if data_str.endswith("errorHasStatus: true"):
            return {"status": "no_flights", "error": "No flights available on this date", "offers": []}

        payload = json.loads(data_str)
        raw_items = payload[3][0] if len(payload) > 3 and payload[3] and payload[3][0] else []

        offers = []
        for item in raw_items:
            try:
                # Price extraction
                if not item or len(item) < 2 or not item[1] or not item[1][0] or len(item[1][0]) < 2:
                    continue
                price = float(item[1][0][1])

                flight_meta = item[0]
                carrier_code = flight_meta[0] or "UNKNOWN"
                carrier_names = flight_meta[1] or []
                carrier_name = carrier_names[0] if carrier_names else carrier_code

                segments = flight_meta[2] if len(flight_meta) > 2 else []
                num_stops = max(0, len(segments) - 1)
                
                # First leg departure & Last leg arrival
                first_seg = segments[0]
                last_seg = segments[-1]
                
                dep_hour = first_seg[8][0] if len(first_seg) > 8 and first_seg[8] else 0
                dep_time = parse_time_tuple(first_seg[8] if len(first_seg) > 8 else None)
                arr_time = parse_time_tuple(last_seg[10] if len(last_seg) > 10 else None)
                
                # Flight numbers
                flight_numbers = []
                total_duration_mins = 0
                for s in segments:
                    if len(s) > 22 and s[22]:
                        flight_numbers.append(f"{s[22][0]} {s[22][1]}")
                    if len(s) > 11 and s[11]:
                        total_duration_mins += s[11]

                flight_no = ", ".join(flight_numbers) if flight_numbers else f"{carrier_code} Flight"

                offers.append({
                    "search_date": dt.date.today().isoformat(),
                    "departure_date": dep_date_str,
                    "lead_days": lead_days,
                    "origin": origin,
                    "destination": dest,
                    "airline_code": carrier_code,
                    "airline_name": carrier_name,
                    "flight_number": flight_no,
                    "departure_time": dep_time,
                    "arrival_time": arr_time,
                    "dep_time_window": get_time_window(dep_hour),
                    "stops": num_stops,
                    "duration_mins": total_duration_mins,
                    "price": price,
                    "currency": currency,
                    "is_nonstop": 1 if num_stops == 0 else 0,
                    "day_of_week": dt.date.fromisoformat(dep_date_str).strftime("%A"),
                    "is_weekend": 1 if dt.date.fromisoformat(dep_date_str).weekday() in (5, 6) else 0,
                })
            except Exception:
                continue

        return {"status": "success", "offers": offers, "latency_ms": latency_ms}
    except Exception as e:
        return {"status": "error", "error": str(e), "offers": []}


def main():
    parser = argparse.ArgumentParser(description="Stealth Google Flights 60-Day Scraper for ML")
    parser.add_argument("--origin", default="DEL", help="Origin IATA airport code (e.g. DEL, BOM)")
    parser.add_argument("--dest", default="DXB", help="Destination IATA airport code (e.g. DXB, LHR)")
    parser.add_argument("--days", type=int, default=60, help="Number of lead days to scrape (default: 60)")
    parser.add_argument("--currency", default="INR", help="Currency code (e.g. INR, USD, EUR)")
    parser.add_argument("--output", default="", help="Output CSV path (default: <origin>_<dest>_60d_dataset.csv)")
    args = parser.parse_args()

    origin = args.origin.strip().upper()
    dest = args.dest.strip().upper()
    total_days = max(1, min(120, args.days))
    out_file = args.output or f"{origin}_{dest}_{total_days}d_dataset.csv"

    print("=" * 70)
    print(f"🛫 STEALTH GOOGLE FLIGHTS 60-DAY ML DATASET COLLECTOR")
    print(f"   Route: {origin} ➔ {dest} | Horizon: T+1 to T+{total_days} | Currency: {args.currency}")
    print(f"   Engine: Rust primp Chrome-145 TLS Fingerprint Impersonation")
    print("=" * 70)

    # Initialize Chrome-145 TLS impersonation client (avoids Google Bot/TLS detection)
    client = Client(impersonate="chrome_145", impersonate_os="macos", referer=True, cookie_store=True)

    today = dt.date.today()
    all_records = []
    
    for lead in range(1, total_days + 1):
        dep_date = today + dt.timedelta(days=lead)
        dep_str = dep_date.strftime("%Y-%m-%d")

        print(f"[{lead:02d}/{total_days:02d}] Scraping {origin}➔{dest} on {dep_str} (T+{lead:02d}d)...", end=" ", flush=True)

        res = scrape_route_lead_day(client, origin, dest, dep_str, lead_days=lead, currency=args.currency)

        if res["status"] == "success" and res["offers"]:
            min_p = min(o["price"] for o in res["offers"])
            print(f"✅ Found {len(res['offers']):2d} flights (min {args.currency} {min_p:,.0f}) [{res.get('latency_ms', 0)}ms]")
            all_records.extend(res["offers"])
        else:
            print(f"⚠️  {res.get('error', 'No offers found')}")

        # Human-like random jitter to avoid IP rate-limiting
        if lead < total_days:
            delay = round(random.uniform(2.2, 4.0), 2)
            time.sleep(delay)

    # Save to CSV
    if all_records:
        try:
            import pandas as pd
            df = pd.DataFrame(all_records)
            df.to_csv(out_file, index=False)
            print("\n" + "=" * 70)
            print(f"🎉 SUCCESS! Collected {len(df):,} flight price records.")
            print(f"💾 Saved clean ML training dataset to: {out_file}")
            print("=" * 70)
            print("\nSample Feature Vectors for AI Model:")
            print(df[["departure_date", "lead_days", "airline_name", "price", "is_nonstop", "day_of_week"]].head(10).to_string(index=False))
        except ImportError:
            # Fallback simple CSV writer if pandas not installed
            import csv
            keys = all_records[0].keys()
            with open(out_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(all_records)
            print(f"\n🎉 Saved {len(all_records):,} records to {out_file}")
    else:
        print("\n⚠️ No records collected.")


if __name__ == "__main__":
    main()
