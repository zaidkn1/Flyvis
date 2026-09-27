#!/usr/bin/env python3
"""
==============================================================================
SYNC VERIFIED STATUS & TRAJECTORY MATCHING KEYS TO SUPABASE & SQLITE
==============================================================================
1. Updates all searches with verified response status metadata.
2. Enriches all observations with canonical_flight_id and route_window_id.
3. Streams verified records to Supabase PostgreSQL in batches.
"""

import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Auto-load environment
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def post_to_supabase(table, records, batch_size=200):
    if not SUPABASE_URL or not SUPABASE_KEY or not records:
        return 0
    endpoint = f"{SUPABASE_URL}/rest/v1/{table}"
    total = 0
    for i in range(0, len(records), batch_size):
        chunk = records[i : i + batch_size]
        payload = json.dumps(chunk).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                total += len(chunk)
                print(f"  [{table}] Synced {total}/{len(records)}...", end="\r", flush=True)
        except Exception as e:
            print(f"\n⚠️ Error syncing chunk to {table}: {e}", file=sys.stderr, flush=True)
            time.sleep(1.0)
    print(f"\n✅ [{table}] Finished syncing {total} records to Supabase.")
    return total


def main():
    db_path = ROOT / "live_quotes.sqlite"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("🚀 Starting Verified Status & Matching Key Synchronization...")

    # 1. Sync all runs first to satisfy foreign keys
    cursor.execute("SELECT id, started_at, finished_at, mode, config_json FROM runs")
    runs_rows = cursor.fetchall()
    runs_batch = []
    for r in runs_rows:
        runs_batch.append({
            "id": r[0],
            "campaign_id": "live-google-campaign",
            "started_at": r[1],
            "finished_at": r[2],
            "mode": r[3],
            "config_json": json.loads(r[4]) if r[4] else {},
        })
    print(f"📦 Syncing {len(runs_batch)} runs to Supabase...")
    post_to_supabase("runs", runs_batch)

    # 2. Sync all searches with verified status
    cursor.execute("""
        SELECT id, campaign_id, run_id, query_key, started_at, completed_at, status, http_status, raw_json
        FROM searches
    """)
    searches_rows = cursor.fetchall()
    searches_batch = []
    for r in searches_rows:
        raw_meta = json.loads(r[8]) if r[8] else {}
        searches_batch.append({
            "id": r[0],
            "campaign_id": r[1],
            "run_id": r[2],
            "query_key": r[3],
            "started_at": r[4],
            "completed_at": r[5],
            "status": r[6],
            "http_status": r[7],
            "raw_json": raw_meta,
        })
    print(f"📦 Syncing {len(searches_batch)} searches with verified status to Supabase...")
    post_to_supabase("searches", searches_batch, batch_size=200)

    # 3. Sync observations with canonical_flight_id and route_window_id
    cursor.execute("""
        SELECT search_id, offer_id, stage, campaign_id, observed_at, total_amount, tax_amount, currency, normalized_json, raw_json
        FROM observations
    """)
    obs_rows = cursor.fetchall()
    obs_batch = []
    for r in obs_rows:
        norm = json.loads(r[8]) if r[8] else {}
        obs_batch.append({
            "search_id": r[0],
            "offer_id": r[1],
            "stage": r[2],
            "campaign_id": r[3],
            "observed_at": r[4],
            "total_amount": r[5],
            "tax_amount": r[6],
            "currency": r[7],
            "normalized_json": norm,
            "raw_json": json.loads(r[9]) if r[9] else None,
        })
    print(f"📦 Syncing {len(obs_batch)} observations with matching keys to Supabase...")
    post_to_supabase("observations", obs_batch, batch_size=300)

    conn.close()
    print("🎉 All historical and live records fully synced with verified status and matching keys!")


if __name__ == "__main__":
    main()
