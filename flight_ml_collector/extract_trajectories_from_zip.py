#!/usr/bin/env python3
"""
==============================================================================
HIGH-SPEED TRAJECTORY EXTRACTOR FROM EXPEDIA ZIP
==============================================================================
Streams directly from `/Users/zaidkhaleel/Downloads/itineraries.csv.zip` without
unzipping 31GB to disk.

Identifies the exact same flight departures tracked across multiple searchDates,
calculates the ground-truth price movement (ΔP), and outputs a labeled dataset
for training "Buy Today vs. Wait" decision models.
"""

import collections
import csv
import datetime as dt
import io
import sys
import time
import zipfile
from pathlib import Path

ZIP_PATH = Path("/Users/zaidkhaleel/Downloads/itineraries.csv.zip")
OUTPUT_CSV = Path(__file__).resolve().parent / "datasets" / "buy_or_wait_paired_trajectories.csv"

TARGET_PAIRS_COUNT = 100000


def main():
    if not ZIP_PATH.exists():
        print(f"❌ Zip file not found at: {ZIP_PATH}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    print(f"📦 Streaming directly from {ZIP_PATH} (Zero 31GB unzipping needed)...")
    start_time = time.time()

    # Dictionary mapping flight_instance_key -> list of observations
    # key: (startingAirport, destinationAirport, flightDate, airline, dep_time)
    flight_trajectories = collections.defaultdict(list)

    total_scanned = 0

    with zipfile.ZipFile(ZIP_PATH) as z:
        with z.open("itineraries.csv") as f:
            text_f = io.TextIOWrapper(f, encoding="utf-8")
            reader = csv.reader(text_f)
            header = next(reader)
            # Find column indices
            col_map = {col: i for i, col in enumerate(header)}
            idx_search_date = col_map["searchDate"]
            idx_flight_date = col_map["flightDate"]
            idx_origin = col_map["startingAirport"]
            idx_dest = col_map["destinationAirport"]
            idx_fare = col_map["totalFare"]
            idx_non_stop = col_map["isNonStop"]
            idx_airline = col_map["segmentsAirlineName"]
            idx_dep_time = col_map["segmentsDepartureTimeRaw"]
            idx_seats = col_map["seatsRemaining"]

            print("🔍 Collecting flight observations across search dates...")

            for row in reader:
                total_scanned += 1
                try:
                    s_date = row[idx_search_date]
                    f_date = row[idx_flight_date]
                    origin = row[idx_origin]
                    dest = row[idx_dest]
                    fare = float(row[idx_fare])
                    non_stop = row[idx_non_stop]
                    airline = row[idx_airline].split("||")[0].strip()
                    dep_time = row[idx_dep_time].split("||")[0].split("T")[-1] if "T" in row[idx_dep_time] else ""
                    seats = row[idx_seats]
                except (ValueError, IndexError):
                    continue

                # Group by exact physical flight instance
                flight_key = (origin, dest, f_date, airline, dep_time)
                flight_trajectories[flight_key].append({
                    "search_date": s_date,
                    "flight_date": f_date,
                    "origin": origin,
                    "destination": dest,
                    "airline": airline,
                    "fare": fare,
                    "is_non_stop": non_stop,
                    "seats_remaining": seats,
                })

                # Once we have enough trajectories, break
                if total_scanned % 500000 == 0:
                    multi_obs = sum(1 for obs in flight_trajectories.values() if len(obs) >= 2)
                    print(f"  Scanned {total_scanned:,} rows... Found {multi_obs:,} flights tracked on 2+ dates.")
                    if multi_obs >= TARGET_PAIRS_COUNT:
                        break

    print(f"\n⚡ Finished reading in {round(time.time() - start_time, 1)}s. Building decision labels...")

    # Now compute the ground truth "BUY or WAIT" labels
    records = []

    for flight_key, obs_list in flight_trajectories.items():
        if len(obs_list) < 2:
            continue

        # Sort observations by search date (chronological)
        obs_list.sort(key=lambda x: x["search_date"])

        # Compute future minimum price for each observation
        prices = [x["fare"] for x in obs_list]
        n = len(prices)

        for i in range(n):
            current = obs_list[i]
            cur_price = current["fare"]
            future_prices = prices[i + 1:] if i + 1 < n else []

            # If there are future observations:
            if future_prices:
                min_future = min(future_prices)
                price_drop = cur_price - min_future

                # If price drops by more than $5 in the future -> WAIT (1), else BUY_NOW (0)
                optimal_action = "WAIT" if price_drop > 5.0 else "BUY_NOW"
                action_label = 1 if price_drop > 5.0 else 0
                max_savings = max(0.0, price_drop)
                price_delta_next = future_prices[0] - cur_price
            else:
                min_future = cur_price
                price_drop = 0.0
                optimal_action = "BUY_NOW"
                action_label = 0
                max_savings = 0.0
                price_delta_next = 0.0

            s_dt = dt.date.fromisoformat(current["search_date"])
            f_dt = dt.date.fromisoformat(current["flight_date"])
            lead_days = (f_dt - s_dt).days

            records.append({
                "origin": current["origin"],
                "destination": current["destination"],
                "airline": current["airline"],
                "search_date": current["search_date"],
                "flight_date": current["flight_date"],
                "lead_days": lead_days,
                "current_price": cur_price,
                "min_future_price": min_future,
                "price_drop_potential": round(price_drop, 2),
                "price_change_next": round(price_delta_next, 2),
                "optimal_decision": optimal_action,
                "label_wait": action_label,
                "max_savings_if_wait": round(max_savings, 2),
                "is_non_stop": current["is_non_stop"],
                "seats_remaining": current["seats_remaining"],
            })

            if len(records) >= TARGET_PAIRS_COUNT:
                break
        if len(records) >= TARGET_PAIRS_COUNT:
            break

    # Save to CSV
    fieldnames = list(records[0].keys())
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    total_time = round(time.time() - start_time, 1)
    wait_count = sum(1 for r in records if r["label_wait"] == 1)
    buy_count = len(records) - wait_count

    print(f"\n🎉 Successfully created Paired Trajectory Decision Dataset!")
    print(f"📁 Saved to: {OUTPUT_CSV}")
    print(f"Total Trajectory Decision Points: {len(records):,}")
    print(f"Decisions: WAIT = {wait_count:,} ({round(wait_count/len(records)*100, 1)}%) | BUY_NOW = {buy_count:,} ({round(buy_count/len(records)*100, 1)}%)")
    print(f"⏱️ Total Execution Time: {total_time}s")


if __name__ == "__main__":
    main()
