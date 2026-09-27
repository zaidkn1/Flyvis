#!/usr/bin/env python3
"""
Uploads the 300,000+ historical flight price trajectory dataset into Supabase.
"""
import csv
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "datasets" / "Clean_Dataset.csv"

# Load .env
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_KEY", "")

if not URL or not KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_KEY not set.", file=sys.stderr)
    sys.exit(1)

BATCH_SIZE = 500


def main():
    if not CSV_PATH.exists():
        print(f"❌ Error: Dataset file not found at {CSV_PATH}")
        sys.exit(1)

    print(f"📊 Reading {CSV_PATH}...")
    endpoint = f"{URL}/rest/v1/historical_flight_trajectories"

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)

        batch = []
        total_uploaded = 0
        start_time = time.time()

        for idx, row in enumerate(reader):
            # Header: ['', 'airline', 'flight', 'source_city', 'departure_time', 'stops', 'arrival_time', 'destination_city', 'class', 'duration', 'days_left', 'price']
            try:
                row_id = int(row[0])
                airline = row[1]
                flight_code = row[2]
                source = row[3]
                departure_time = row[4]
                stops = row[5]
                arrival_time = row[6]
                dest = row[7]
                travel_class = row[8]
                duration = float(row[9])
                days_left = int(row[10])
                price = float(row[11])
            except (ValueError, IndexError):
                continue

            batch.append({
                "id": row_id,
                "airline": airline,
                "flight_code": flight_code,
                "source_city": source,
                "destination_city": dest,
                "departure_time": departure_time,
                "stops": stops,
                "arrival_time": arrival_time,
                "travel_class": travel_class,
                "duration_hours": duration,
                "days_left": days_left,
                "price": price,
            })

            if len(batch) >= BATCH_SIZE:
                payload = json.dumps(batch).encode("utf-8")
                req = urllib.request.Request(
                    endpoint,
                    data=payload,
                    headers={
                        "apikey": KEY,
                        "Authorization": f"Bearer {KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates,return=minimal",
                    },
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        total_uploaded += len(batch)
                        if total_uploaded % 5000 == 0:
                            elapsed = time.time() - start_time
                            rate = round(total_uploaded / elapsed, 1)
                            print(f"🚀 Uploaded {total_uploaded:,} / 300,153 records ({rate} rec/sec)...")
                except Exception as e:
                    print(f"⚠️ Upload error at row {idx}: {e}")
                    time.sleep(2)
                batch = []

        # Upload final chunk
        if batch:
            payload = json.dumps(batch).encode("utf-8")
            req = urllib.request.Request(
                endpoint,
                data=payload,
                headers={
                    "apikey": KEY,
                    "Authorization": f"Bearer {KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30):
                total_uploaded += len(batch)

    print(f"🎉 Complete! Successfully uploaded {total_uploaded:,} historical flight trajectory records to Supabase.")


if __name__ == "__main__":
    main()
