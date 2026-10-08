#!/usr/bin/env python3
"""
==============================================================================
FIXED-DATE 12-HOUR REPEAT COLLECTOR FOR UNBROKEN ML TRAJECTORIES
==============================================================================
Monitors 8-10 fixed calendar departure dates per route, keeping dates unchanged
as departure approaches to build continuous, comparable price trajectories.

Key Design:
- Pinned calendar dates (e.g. 2026-10-18 to 2026-12-05) polled every 12 hours.
- Strict 3-way search logging into SQLite:
    * 'offers_returned' (HTTP 200, parsed offers)
    * 'no_offers_returned' (HTTP 200, clean empty result)
    * 'network_error' / 'parse_error' / 'rate_limited' (failed search attempts)
- Chrome-145 TLS/HTTP-2 browser impersonation via primp with 2.5-4.5s jitter pacing.
- Reuses robust, verified parsing from live_google_collector.
- Budget-safe: 2 routes x 10 dates = 20 searches per sweep (40 searches / day).

Usage:
    python collect_fixed_dates.py --once
    python collect_fixed_dates.py --daemon --interval-hours 12
"""

import argparse
import datetime as dt
import json
import random
import sqlite3
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "live_quotes.sqlite"

try:
    from primp import Client
    from flight_ml_collector.live_google_collector import fetch_and_parse_route
except ImportError:
    # If running from inside flight_ml_collector directory
    try:
        from live_google_collector import fetch_and_parse_route
        from primp import Client
    except ImportError:
        print("Missing dependencies: pip install primp fast-flights selectolax")
        sys.exit(1)

# 10 Pinned Calendar Dates Per Corridor (Unchanged across sweeps)
FIXED_TARGETS = {
    ("DEL", "DXB"): [
        "2026-10-18", "2026-10-22", "2026-10-26", "2026-11-01",
        "2026-11-05", "2026-11-10", "2026-11-15", "2026-11-20",
        "2026-11-28", "2026-12-05"
    ],
    ("BOM", "LHR"): [
        "2026-10-18", "2026-10-22", "2026-10-26", "2026-11-01",
        "2026-11-05", "2026-11-10", "2026-11-15", "2026-11-20",
        "2026-11-28", "2026-12-05"
    ]
}


def get_client():
    return Client(
        impersonate="chrome_145",
        impersonate_os="macos",
        referer=True,
        cookie_store=True,
        timeout=25
    )


def execute_sweep(conn, run_id, dry_run=False):
    """Executes a single sweep over all fixed departure dates for all corridors."""
    client = get_client()
    cur = conn.cursor()

    total_searches = sum(len(dates) for dates in FIXED_TARGETS.values())
    now_utc = dt.datetime.now(dt.timezone.utc)
    print(f"\n[{now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}] Starting sweep (run_id: {run_id})")
    print(f"Targeting {len(FIXED_TARGETS)} routes across {total_searches} fixed departure dates.")

    # Record run entry
    if not dry_run:
        cur.execute("""
            INSERT INTO runs (id, started_at, mode, config_json)
            VALUES (?, ?, 'fixed_dates_sweep', ?)
        """, (run_id, now_utc.isoformat(), json.dumps({f"{k[0]}-{k[1]}": v for k, v in FIXED_TARGETS.items()})))
        conn.commit()

    s_count = 0
    success_count = 0
    empty_count = 0
    error_count = 0
    offers_total = 0

    today = dt.date.today()

    for (origin, dest), dates in FIXED_TARGETS.items():
        for dep_date_str in dates:
            s_count += 1
            search_id = str(uuid.uuid4())
            query_key = f"{origin}-{dest}|{dep_date_str}"
            started_at = dt.datetime.now(dt.timezone.utc).isoformat()

            dep_date = dt.date.fromisoformat(dep_date_str)
            lead_days = max(0, (dep_date - today).days)

            print(f"[{s_count:02d}/{total_searches:02d}] 🔍 {query_key} (T-{lead_days}d)...", end=" ", flush=True)

            # Jitter pacing: 2.5s - 4.5s
            time.sleep(random.uniform(2.5, 4.5))

            res = fetch_and_parse_route(
                origin=origin,
                dest=dest,
                dep_date_str=dep_date_str,
                lead_days=lead_days,
                currency="INR",
                client=client
            )

            completed_at = dt.datetime.now(dt.timezone.utc).isoformat()
            status = res.get("status", "unknown")
            http_status = res.get("http_status", 0)
            offers = res.get("offers", [])
            latency = res.get("latency_ms", 0)

            if status == "offers_returned" and len(offers) > 0:
                success_count += 1
                offers_total += len(offers)
                cheapest = min(o['price'] for o in offers)
                print(f"✅ {len(offers)} offers ({latency}ms, min ₹{cheapest:,.0f})")
            elif status == "no_offers_returned":
                empty_count += 1
                print(f"⚠️ Clean empty (0 offers, {latency}ms)")
            else:
                error_count += 1
                err_msg = res.get("error_message", status)
                print(f"❌ Error [{status}] ({err_msg[:40]})")

            if not dry_run:
                cur.execute("""
                    INSERT INTO searches (id, campaign_id, run_id, query_key, started_at, completed_at, status, http_status, raw_json)
                    VALUES (?, 'fixed-dates-12h', ?, ?, ?, ?, ?, ?, ?)
                """, (
                    search_id,
                    run_id,
                    query_key,
                    started_at,
                    completed_at,
                    status,
                    http_status,
                    json.dumps({'offers_count': len(offers), 'latency_ms': latency, 'error': res.get('error_message')})
                ))

                for o in offers:
                    offer_id = str(uuid.uuid4())
                    cur.execute("""
                        INSERT INTO observations (search_id, offer_id, stage, campaign_id, observed_at, total_amount, currency, normalized_json)
                        VALUES (?, ?, 'live', 'fixed-dates-12h', ?, ?, 'INR', ?)
                    """, (search_id, offer_id, completed_at, o['price'], json.dumps(o)))

                conn.commit()

    if not dry_run:
        cur.execute("""
            UPDATE runs SET finished_at = ? WHERE id = ?
        """, (dt.datetime.now(dt.timezone.utc).isoformat(), run_id))
        conn.commit()

        # Audit logging: record predictions with frozen models and reconcile past outcomes
        try:
            from audit_logger import score_and_audit_sweep, reconcile_outcomes
            n_preds = score_and_audit_sweep(conn, run_id)
            n_reconciled = reconcile_outcomes(conn)
            print(f"Audited Predictions: {n_preds} logged for run {run_id}. Reconciled Outcomes: {n_reconciled} updated.")
        except Exception as audit_err:
            print(f"Warning: Audit logging encountered error: {audit_err}")

    print(f"\nSweep Finished: {success_count} offers returned, {empty_count} clean empty, {error_count} errors. Total offers: {offers_total}\n")


def sleep_until(target_dt: dt.datetime, label: str = "next sweep"):
    while True:
        now_utc = dt.datetime.now(dt.timezone.utc)
        remaining = (target_dt - now_utc).total_seconds()
        if remaining <= 0:
            break
        # Sleep in max 30s increments so waking from macOS system sleep resumes immediately
        time.sleep(min(30.0, max(0.5, remaining)))


def main():
    parser = argparse.ArgumentParser(description="Fixed-date 12-hour flight collector")
    parser.add_argument("--once", action="store_true", help="Run a single sweep and exit")
    parser.add_argument("--daemon", action="store_true", help="Run in continuous daemon mode")
    parser.add_argument("--interval-hours", type=float, default=12.0, help="Interval between sweeps (default: 12.0h)")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing to database")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)

    if args.once or not args.daemon:
        run_id = str(uuid.uuid4())
        execute_sweep(conn, run_id, dry_run=args.dry_run)
        conn.close()
    else:
        print(f"Starting Fixed-Date Daemon (Sweep interval: {args.interval_hours} hours)...")
        cur = conn.cursor()
        cur.execute("SELECT finished_at FROM runs WHERE mode = 'fixed_dates_sweep' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1")
        row = cur.fetchone()
        if row and row[0]:
            last_finished = dt.datetime.fromisoformat(row[0])
            elapsed = (dt.datetime.now(dt.timezone.utc) - last_finished).total_seconds()
            interval_sec = int(args.interval_hours * 3600)
            if elapsed < interval_sec:
                remaining = int(interval_sec - elapsed)
                next_dt = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=remaining)
                print(f"Previous sweep completed at {last_finished.strftime('%Y-%m-%d %H:%M:%S UTC')} ({int(elapsed/60)}m ago).")
                print(f"Sleeping for {remaining}s ({round(remaining/3600, 2)}h) until next scheduled sweep at {next_dt.strftime('%Y-%m-%d %H:%M:%S UTC')}...")
                sleep_until(next_dt)

        while True:
            run_id = str(uuid.uuid4())
            try:
                execute_sweep(conn, run_id, dry_run=args.dry_run)
            except Exception as e:
                print(f"Sweep run error: {e}")
            interval_sec = int(args.interval_hours * 3600)
            next_sweep = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=interval_sec)
            print(f"Sleeping for {args.interval_hours} hours until next sweep at {next_sweep.strftime('%Y-%m-%d %H:%M:%S UTC')}...")
            sleep_until(next_sweep)


if __name__ == '__main__':
    main()
