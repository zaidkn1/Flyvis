#!/usr/bin/env python3
"""
==============================================================================
HEALTH MONITOR & AUDIT INSPECTOR FOR FIXED-DATE ML COLLECTION
==============================================================================
Monitors sweep continuity, detects missed sweeps, checks process health,
and audits prospective predictions and outcome reconciliation.

Usage:
    python monitor_health.py
"""

import datetime as dt
import json
import os
import subprocess
import sqlite3
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "live_quotes.sqlite"
CADENCE_HOURS = 12.0
MAX_PERMISSIBLE_GAP_HOURS = 13.5


def check_daemon_process():
    try:
        res = subprocess.run(["ps", "aux"], capture_output=True, text=True, check=True)
        lines = [line for line in res.stdout.splitlines() if "collect_fixed_dates.py" in line and "grep" not in line and "monitor_health.py" not in line]
        if lines:
            pids = [line.split()[1] for line in lines]
            return True, pids, lines[0]
        return False, [], ""
    except Exception as e:
        return False, [], str(e)


def inspect_collection_health(db_path: Path):
    print("=" * 80)
    print("FIXED-DATE REPEAT COLLECTION HEALTH & AUDIT INSPECTOR")
    print("=" * 80)

    # 1. Daemon Process Health
    is_running, pids, proc_line = check_daemon_process()
    if is_running:
        print(f"Process Status:      ✅ RUNNING (PID: {', '.join(pids)})")
    else:
        print(f"Process Status:      ❌ NOT RUNNING (Daemon appears to have terminated)")

    if not db_path.exists():
        print(f"Database Error: Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)

    # 2. Sweep Runs & Cadence Analysis
    runs = pd.read_sql_query("""
        SELECT id as run_id, started_at, finished_at, mode 
        FROM runs 
        WHERE mode = 'fixed_dates_sweep'
        ORDER BY started_at DESC
    """, conn)

    now_utc = dt.datetime.now(dt.timezone.utc)
    print(f"Current UTC Time:    {now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Total Sweeps Run:    {len(runs)}")

    if len(runs) == 0:
        print("No fixed-date sweeps recorded in database yet.")
        conn.close()
        return

    runs['started_at'] = pd.to_datetime(runs['started_at'], utc=True)
    runs['finished_at'] = pd.to_datetime(runs['finished_at'], utc=True)

    latest_run = runs.iloc[0]
    last_finish = latest_run['finished_at'] if pd.notna(latest_run['finished_at']) else latest_run['started_at']
    elapsed_hours = (now_utc - last_finish).total_seconds() / 3600.0

    print(f"Latest Sweep ID:     {latest_run['run_id']}")
    print(f"Latest Completed:    {last_finish.strftime('%Y-%m-%d %H:%M:%S UTC')} ({elapsed_hours:.2f}h ago)")

    if elapsed_hours > MAX_PERMISSIBLE_GAP_HOURS:
        print(f"\n⚠️  [ALERT: MISSED SWEEP DETECTED]")
        print(f"   {elapsed_hours:.1f} hours have elapsed since the last completed sweep.")
        print(f"   Expected cadence is {CADENCE_HOURS}h (permissible gap threshold: {MAX_PERMISSIBLE_GAP_HOURS}h).")
        print(f"   Possible causes: system sleep, machine restart, or process termination.")
    else:
        remaining_to_next = max(0.0, CADENCE_HOURS - elapsed_hours)
        next_dt = now_utc + dt.timedelta(hours=remaining_to_next)
        print(f"Cadence Status:      ✅ HEALTHY (Next sweep scheduled in ~{remaining_to_next:.2f}h at {next_dt.strftime('%H:%M UTC')})")

    # 3. Searches & Provider Error Rates
    searches = pd.read_sql_query("""
        SELECT status, http_status, count(*) as cnt 
        FROM searches 
        WHERE campaign_id = 'fixed-dates-12h'
        GROUP BY status, http_status
    """, conn)

    print("\n--- Search Execution Breakdown (Campaign: 'fixed-dates-12h') ---")
    for _, r in searches.iterrows():
        print(f"  Status: {r['status']:<22} | HTTP: {r['http_status']} | Count: {r['cnt']}")

    # 4. Prospective Predictions & Audit Trail
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='prospective_predictions'")
    has_audit_table = cur.fetchone()[0] > 0

    if has_audit_table:
        preds = pd.read_sql_query("""
            SELECT 
                model_name,
                count(*) as total_predictions,
                sum(CASE WHEN action = 'WAIT' THEN 1 ELSE 0 END) as wait_decisions,
                sum(CASE WHEN action = 'BUY_NOW' THEN 1 ELSE 0 END) as buy_now_decisions,
                sum(CASE WHEN outcome_status = 'VERIFIED' THEN 1 ELSE 0 END) as verified_outcomes,
                sum(CASE WHEN outcome_status IS NULL THEN 1 ELSE 0 END) as pending_outcomes
            FROM prospective_predictions
            GROUP BY model_name
        """, conn)

        print("\n--- Prospective Auditable Decisions Log ---")
        print(preds.to_string(index=False))

    conn.close()
    print("=" * 80 + "\n")


if __name__ == '__main__':
    inspect_collection_health(DB_PATH)
