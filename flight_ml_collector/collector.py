#!/usr/bin/env python3
"""
==============================================================================
FLIGHT ML PRICE OBSERVER & 24/7 DATA COLLECTOR
==============================================================================
Standalone, zero-dependency Python service for collecting flight price movements
and training optimal booking window / yield curve Machine Learning models.

Features:
- Dual Persistence: Local SQLite database + Supabase PostgreSQL Cloud Sync.
- 24/7 Continuous Daemon Mode with smart pacing, randomized jitter, and backoff.
- Zero Bot Flagging: Uses Duffel's Official Airline GDS/NDC API (authenticated Bearer token).
- Automated Feature Extraction: Lead days (T-d), carrier, stops, total amount, taxes.
- Zero External Dependencies: Runs on 100% Python standard library.
"""

import argparse
import datetime as dt
import decimal
import hashlib
import json
import os
import random
import signal
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def now_utc():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def clean_pii(value):
    """Recursively strips private personal identifiable information and auth keys."""
    if isinstance(value, dict):
        return {
            k: clean_pii(v)
            for k, v in value.items()
            if k not in {
                "client_key", "access_token", "authorization",
                "given_name", "family_name", "email", "phone_number",
                "identity_documents"
            }
        }
    if isinstance(value, list):
        return [clean_pii(v) for v in value]
    return value


def initialize_manifest(config, manifest_path, start_date=None):
    """Generates an initial cohort manifest of routes and departure dates."""
    if manifest_path.exists():
        raise ValueError(f"Manifest already exists at {manifest_path}. Preserve fixed departure cohorts.")

    start = start_date or dt.datetime.now(dt.timezone.utc).date()
    jobs = []
    for origin, destination in config.get("routes", []):
        for lead in config.get("initial_lead_days", [1, 3, 7, 14, 21, 30, 45, 60]):
            dep_day = (start + dt.timedelta(days=lead)).isoformat()
            jobs.append({
                "key": f"{origin}-{destination}|{dep_day}",
                "origin": origin,
                "destination": destination,
                "departure_date": dep_day,
                "initial_lead_days": lead
            })

    config_hash = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    manifest = {
        "created_at": now_utc(),
        "cohort_start": start.isoformat(),
        "jobs": jobs,
        "config_sha256": config_hash
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"✅ Initialized cohort manifest with {len(jobs)} route-date jobs at: {manifest_path}")
    return manifest


def normalize_offer(offer, observed_at, has_detail, search_job=None):
    """Extracts structured time-series ML features from Duffel offer payloads."""
    segments = []
    carrier_code = None
    carrier_name = None
    fl_number = None
    stops_count = 0

    slices = offer.get("slices", [])
    for sl in slices:
        sl_segs = sl.get("segments", [])
        stops_count += max(0, len(sl_segs) - 1)
        for s in sl_segs:
            seg_dict = {
                k: s.get(k)
                for k in [
                    "id", "origin", "destination", "departing_at", "arriving_at",
                    "marketing_carrier", "operating_carrier",
                    "marketing_carrier_flight_number", "operating_carrier_flight_number",
                    "passengers", "stops"
                ]
            }
            segments.append(seg_dict)
            if not carrier_code and s.get("marketing_carrier"):
                carrier_code = s.get("marketing_carrier", {}).get("iata_code")
                carrier_name = s.get("marketing_carrier", {}).get("name")
                fl_number = s.get("marketing_carrier_flight_number")

    lead_days = None
    if search_job and search_job.get("departure_date"):
        try:
            dep_d = dt.date.fromisoformat(search_job["departure_date"])
            obs_d = dt.datetime.fromisoformat(observed_at.replace("Z", "+00:00")).date()
            lead_days = (dep_d - obs_d).days
        except Exception:
            lead_days = None

    return {
        "offer_id": offer.get("id"),
        "observed_at": observed_at,
        "lead_days": lead_days,
        "live_mode": offer.get("live_mode"),
        "expires_at": offer.get("expires_at"),
        "carrier_code": carrier_code,
        "carrier_name": carrier_name,
        "flight_number": fl_number,
        "stops_count": stops_count,
        "quoted_total_amount": offer.get("total_amount"),
        "currency": offer.get("total_currency"),
        "tax_amount": offer.get("tax_amount"),
        "segments": segments,
        "conditions": offer.get("conditions"),
        "available_services": offer.get("available_services") if has_detail else None,
        "detail_fetched": has_detail
    }


# ==============================================================================
# LOCAL SQLITE DATABASE
# ==============================================================================
def connect_sqlite(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS runs(
        id TEXT PRIMARY KEY, 
        started_at TEXT, 
        finished_at TEXT, 
        mode TEXT, 
        config_json TEXT
    );
    CREATE TABLE IF NOT EXISTS searches(
        id TEXT PRIMARY KEY, 
        run_id TEXT, 
        query_key TEXT, 
        started_at TEXT, 
        completed_at TEXT, 
        status TEXT, 
        http_status INTEGER, 
        raw_json TEXT
    );
    CREATE TABLE IF NOT EXISTS observations(
        search_id TEXT, 
        offer_id TEXT, 
        observed_at TEXT, 
        stage TEXT, 
        normalized_json TEXT, 
        raw_json TEXT, 
        PRIMARY KEY(search_id, offer_id, stage)
    );
    CREATE TABLE IF NOT EXISTS detail_events(
        search_id TEXT, 
        offer_id TEXT, 
        observed_at TEXT, 
        status TEXT, 
        http_status INTEGER
    );
    """)
    return db


# ==============================================================================
# SUPABASE POSTGREST CLIENT (Zero Dependencies via Python Standard Library)
# ==============================================================================
class SupabaseClient:
    def __init__(self, url, key):
        self.url = (url or "").rstrip("/")
        self.key = key or ""
        self.enabled = bool(self.url and self.key)
        if self.enabled:
            print(f"🔗 Supabase Cloud Sync: ACTIVE ({self.url})")
        else:
            print("ℹ️  Supabase Cloud Sync: DISABLED (No SUPABASE_URL / SUPABASE_KEY set). Storing to local SQLite only.")

    def insert(self, table, records):
        if not self.enabled:
            return
        if not records:
            return
        if isinstance(records, dict):
            records = [records]

        endpoint = f"{self.url}/rest/v1/{table}"
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }

        try:
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(records).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                pass
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"⚠️  Supabase insert error on {table} (HTTP {e.code}): {err_body[:200]}")
        except Exception as ex:
            print(f"⚠️  Supabase sync warning on {table}: {ex}")


# ==============================================================================
# DUFFEL FLIGHT API CLIENT (Polite, Rate-Limit Protected)
# ==============================================================================
class DuffelAPI:
    def __init__(self, token, call_budget=250, pacing_min=3.0, pacing_max=8.0):
        self.token = token
        self.call_budget = call_budget
        self.calls = 0
        self.pacing_min = pacing_min
        self.pacing_max = pacing_max

    def call(self, method, path, payload=None):
        if self.calls >= self.call_budget:
            raise RuntimeError(f"HTTP call budget ({self.call_budget}) exhausted for this run.")

        # Randomized Anti-Rate-Limit Pacing
        if self.calls > 0:
            sleep_sec = random.uniform(self.pacing_min, self.pacing_max)
            time.sleep(sleep_sec)

        self.calls += 1
        url = "https://api.duffel.com" + path
        body_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None

        req = urllib.request.Request(
            url,
            data=body_bytes,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Duffel-Version": "v2",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "FlyvisML-PriceYieldObserver/1.0"
            }
        )

        # Exponential backoff for HTTP 429
        max_retries = 3
        backoff = 15.0
        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=45) as response:
                    return json.load(response)
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < max_retries - 1:
                    print(f"⏳ Rate limited by provider (429). Backing off for {backoff:.1f}s (Attempt {attempt+1}/{max_retries})...")
                    time.sleep(backoff)
                    backoff *= 2.5
                    continue
                raise


# ==============================================================================
# COLLECTION PIPELINE
# ==============================================================================
def run_collection(config, manifest, dbpath, mode, supabase=None):
    token = os.environ.get("DUFFEL_ACCESS_TOKEN")
    if not token:
        raise ValueError(
            "DUFFEL_ACCESS_TOKEN environment variable not set.\n"
            "Run: export DUFFEL_ACCESS_TOKEN='duffel_test_...' before running collection."
        )

    # Validate config integrity
    manifest_hash = manifest.get("config_sha256")
    current_hash = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    if manifest_hash and manifest_hash != current_hash:
        raise ValueError("Config file has changed since manifest creation. Create a new cohort manifest.")

    pacing_min = float(config.get("pacing_delay_min_seconds", 3.0))
    pacing_max = float(config.get("pacing_delay_max_seconds", 8.0))
    max_calls = int(config.get("max_http_calls_per_run", 200))
    max_searches = int(config.get("max_searches_per_run", 60))

    api = DuffelAPI(token, call_budget=max_calls, pacing_min=pacing_min, pacing_max=pacing_max)
    db = connect_sqlite(dbpath)
    run_id = str(uuid.uuid4())
    start_iso = now_utc()

    # Log Run in SQLite & Supabase
    db.execute("INSERT INTO runs VALUES(?,?,?,?,?)", (run_id, start_iso, None, mode, json.dumps(config)))
    db.commit()

    if supabase:
        supabase.insert("ml_flight_runs", {
            "id": run_id,
            "started_at": start_iso,
            "mode": mode,
            "config_json": config
        })

    search_count = 0
    total_offers_saved = 0
    today_utc = dt.datetime.now(dt.timezone.utc).date()

    print(f"\n🚀 [RUN {run_id[:8]}] Started collection pass (Mode: {mode.upper()}). Jobs: {len(manifest.get('jobs', []))}")

    try:
        for job in manifest.get("jobs", []):
            dep_date = dt.date.fromisoformat(job["departure_date"])
            if dep_date <= today_utc:
                # Past flight: skip
                continue

            if search_count >= max_searches:
                print(f"🛑 Reached max_searches_per_run limit ({max_searches}). Ending run.")
                break

            search_count += 1
            search_id = str(uuid.uuid4())
            search_start = now_utc()
            route_str = f"{job['origin']} → {job['destination']} on {job['departure_date']}"
            lead_days = (dep_date - today_utc).days

            print(f"  [{search_count:02d}] 📡 Querying: {route_str} (T-{lead_days}d)...", end="", flush=True)

            db.execute("INSERT INTO searches VALUES(?,?,?,?,?,?,?,?)",
                       (search_id, run_id, job["key"], search_start, None, "started", None, None))
            db.commit()

            try:
                offer_payload = {
                    "data": {
                        "slices": [{
                            "origin": job["origin"],
                            "destination": job["destination"],
                            "departure_date": job["departure_date"]
                        }],
                        "passengers": config.get("passengers", [{"type": "adult"}]),
                        "cabin_class": config.get("cabin_class", "economy"),
                        "max_connections": config.get("max_connections", 1)
                    }
                }

                endpoint = f"/air/offer_requests?return_offers=true&supplier_timeout={config.get('supplier_timeout_ms', 15000)}"
                response = api.call("POST", endpoint, offer_payload)
                data = response.get("data", {})

                # Safety check live mode
                if data.get("live_mode") is not (mode == "live"):
                    raise ValueError(f"Duffel returned live_mode={data.get('live_mode')}, but requested mode was '{mode}'")

                offers = data.get("offers", [])
                safe_resp = clean_pii(response)

                db.execute(
                    "UPDATE searches SET completed_at=?, status=?, http_status=?, raw_json=? WHERE id=?",
                    (now_utc(), "offers_returned" if offers else "no_offers_returned", 200, json.dumps(safe_resp), search_id)
                )
                db.commit()

                if supabase:
                    supabase.insert("ml_flight_searches", {
                        "id": search_id,
                        "run_id": run_id,
                        "query_key": job["key"],
                        "origin": job["origin"],
                        "destination": job["destination"],
                        "departure_date": job["departure_date"],
                        "lead_days": lead_days,
                        "started_at": search_start,
                        "completed_at": now_utc(),
                        "status": "offers_returned" if offers else "no_offers",
                        "http_status": 200,
                        "offers_count": len(offers),
                        "raw_json": safe_resp
                    })

                print(f" ✓ ({len(offers)} offers)")

                # Store Offers in SQLite & Supabase
                supabase_obs_batch = []
                for offer in offers:
                    total_offers_saved += 1
                    stamp = now_utc()
                    safe_offer = clean_pii(offer)
                    norm_data = normalize_offer(safe_offer, stamp, False, job)

                    db.execute(
                        "INSERT OR REPLACE INTO observations VALUES(?,?,?,?,?,?)",
                        (search_id, offer["id"], stamp, "search", json.dumps(norm_data), json.dumps(safe_offer))
                    )

                    if supabase:
                        try:
                            amt = float(offer.get("total_amount") or 0)
                            tax = float(offer.get("tax_amount") or 0)
                        except (ValueError, TypeError):
                            amt, tax = 0.0, 0.0

                        supabase_obs_batch.append({
                            "search_id": search_id,
                            "offer_id": offer["id"],
                            "observed_at": stamp,
                            "stage": "search",
                            "origin": job["origin"],
                            "destination": job["destination"],
                            "departure_date": job["departure_date"],
                            "lead_days": lead_days,
                            "carrier_code": norm_data.get("carrier_code"),
                            "carrier_name": norm_data.get("carrier_name"),
                            "flight_number": norm_data.get("flight_number"),
                            "stops_count": norm_data.get("stops_count", 0),
                            "currency": norm_data.get("currency") or "INR",
                            "total_amount": amt,
                            "tax_amount": tax,
                            "cabin_class": config.get("cabin_class", "economy"),
                            "is_live_mode": (mode == "live"),
                            "normalized_json": norm_data,
                            "raw_json": safe_offer
                        })

                if supabase and supabase_obs_batch:
                    supabase.insert("ml_flight_observations", supabase_obs_batch)

                # Fetch available services detail for top cheapest offers
                def sort_rank(o):
                    try:
                        amt = Decimal(o.get("total_amount", "Infinity"))
                    except (InvalidOperation, TypeError):
                        amt = Decimal("Infinity")
                    return (o.get("total_currency") or "", amt, o.get("id"))

                top_offers = sorted(offers, key=sort_rank)[:config.get("max_offer_details_per_search", 2)]
                for top_o in top_offers:
                    try:
                        det_resp = api.call("GET", f"/air/offers/{urllib.parse.quote(top_o['id'], safe='')}?return_available_services=true")
                        det_data = clean_pii(det_resp.get("data", {}))
                        det_norm = normalize_offer(det_data, now_utc(), True, job)

                        db.execute(
                            "INSERT OR REPLACE INTO observations VALUES(?,?,?,?,?,?)",
                            (search_id, top_o["id"], now_utc(), "detail", json.dumps(det_norm), json.dumps(det_data))
                        )
                        db.execute(
                            "INSERT INTO detail_events VALUES(?,?,?,?,?)",
                            (search_id, top_o["id"], now_utc(), "success", 200)
                        )
                    except urllib.error.HTTPError as e:
                        db.execute("INSERT INTO detail_events VALUES(?,?,?,?,?)", (search_id, top_o["id"], now_utc(), "http_error", e.code))
                    except Exception:
                        db.execute("INSERT INTO detail_events VALUES(?,?,?,?,?)", (search_id, top_o["id"], now_utc(), "detail_failed", None))
                    db.commit()

            except urllib.error.HTTPError as e:
                print(f" ⚠️ HTTP Error {e.code}")
                db.execute("UPDATE searches SET completed_at=?, status=?, http_status=? WHERE id=?", (now_utc(), "http_error", e.code, search_id))
                db.commit()
                if e.code in [401, 403, 429]:
                    print(f"🛑 Critical HTTP {e.code} received. Pausing collection cycle.")
                    break
            except Exception as e:
                print(f" ⚠️ Request failed: {e}")
                db.execute("UPDATE searches SET completed_at=?, status=? WHERE id=?", (now_utc(), "failed", search_id))
                db.commit()

    finally:
        finish_iso = now_utc()
        db.execute("UPDATE runs SET finished_at=? WHERE id=?", (finish_iso, run_id))
        db.commit()
        db.close()

        if supabase:
            supabase.insert("ml_flight_runs", {
                "id": run_id,
                "started_at": start_iso,
                "finished_at": finish_iso,
                "mode": mode,
                "search_attempts": search_count,
                "http_calls": api.calls
            })

    result_summary = {
        "run_id": run_id,
        "mode": mode,
        "search_attempts": search_count,
        "total_offers_captured": total_offers_saved,
        "http_calls": api.calls,
        "sqlite_db": str(dbpath),
        "supabase_synced": bool(supabase and supabase.enabled)
    }
    print(f"\n📊 [RUN {run_id[:8]} COMPLETE] Captured {total_offers_saved} fare observations in {api.calls} API calls.")
    return result_summary


# ==============================================================================
# 24/7 DAEMON LOOP WITH SIGNAL HANDLING
# ==============================================================================
keep_running = True

def handle_shutdown(signum, frame):
    global keep_running
    print("\n🛑 Shutdown signal received. Finishing active cycle and exiting gracefully...")
    keep_running = False

def run_daemon(config, manifest, dbpath, mode, supabase=None):
    global keep_running
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    interval_hours = float(config.get("daemon_interval_hours", 6.0))
    interval_seconds = interval_hours * 3600.0

    print("=" * 72)
    print("🌙 FLYVIS 24/7 DAEMON MODE INITIALIZED")
    print(f"• Cadence: Every {interval_hours:.1f} hours ({interval_seconds/60:.0f} mins)")
    print(f"• Jitter: ±5% interval randomization")
    print(f"• Database: {dbpath}")
    print(f"• Cloud Sync: {'Supabase Active' if supabase and supabase.enabled else 'Local SQLite Only'}")
    print("=" * 72)

    cycle = 0
    while keep_running:
        cycle += 1
        print(f"\n⏰ Starting 24/7 Collection Cycle #{cycle} at {dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        try:
            summary = run_collection(config, manifest, dbpath, mode, supabase)
            print(f"Cycle #{cycle} finished: {summary['total_offers_captured']} fares logged.")
        except Exception as e:
            print(f"❌ Error during collection cycle #{cycle}: {e}")

        if not keep_running:
            break

        # Randomized sleep interval to prevent rhythmic clock-second detection
        jitter = random.uniform(-0.05, 0.05) * interval_seconds
        sleep_dur = max(60.0, interval_seconds + jitter)
        wake_time = dt.datetime.now() + dt.timedelta(seconds=sleep_dur)
        print(f"\n💤 Sleeping for {sleep_dur/3600:.2f}h. Next cycle at: {wake_time.strftime('%Y-%m-%d %H:%M:%S')} (Press Ctrl+C to stop)")

        # Chunked sleep allowing prompt shutdown on SIGINT
        step = 5.0
        elapsed = 0.0
        while elapsed < sleep_dur and keep_running:
            time.sleep(min(step, sleep_dur - elapsed))
            elapsed += step


# ==============================================================================
# CLI ENTRYPOINT
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="Flyvis Flight ML Price Collector & 24/7 Observer")
    parser.add_argument("command", choices=["init", "plan", "collect", "daemon"], help="Action to execute")
    parser.add_argument("--config", type=Path, default=ROOT / "config.json", help="Path to config.json")
    parser.add_argument("--manifest", type=Path, default=ROOT / "manifest.json", help="Path to manifest.json")
    parser.add_argument("--db", type=Path, help="Custom SQLite db destination path")
    parser.add_argument("--mode", choices=["test", "live"], default="test", help="Duffel API mode (test or live)")
    parser.add_argument("--start", type=dt.date.fromisoformat, help="Cohort start date (YYYY-MM-DD)")

    args = parser.parse_args()

    if not args.config.exists():
        raise FileNotFoundError(f"Config file not found at {args.config}. Create config.json first.")

    cfg = json.loads(args.config.read_text())

    # Resolve Supabase Credentials from config or environment
    sb_url = os.environ.get("SUPABASE_URL") or cfg.get("supabase_url")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY") or cfg.get("supabase_key")
    supabase = SupabaseClient(sb_url, sb_key)

    if args.command == "init":
        m = initialize_manifest(cfg, args.manifest, args.start)
        print(json.dumps(m, indent=2))

    elif args.command == "plan":
        routes_count = len(cfg.get("routes", []))
        leads_count = len(cfg.get("initial_lead_days", []))
        total_jobs = routes_count * leads_count
        daemon_h = cfg.get("daemon_interval_hours", 6.0)
        cycles_per_day = 24.0 / daemon_h
        print(json.dumps({
            "routes_count": routes_count,
            "lead_windows": cfg.get("initial_lead_days"),
            "jobs_per_cohort": total_jobs,
            "daemon_interval_hours": daemon_h,
            "cycles_per_day": cycles_per_day,
            "estimated_daily_searches": int(total_jobs * cycles_per_day),
            "estimated_daily_api_calls": int(total_jobs * 2 * cycles_per_day),
            "supabase_configured": supabase.enabled,
            "local_sqlite_destination": str(args.db or ROOT / f"quotes_{args.mode}.sqlite")
        }, indent=2))

    elif args.command == "collect":
        if not args.manifest.exists():
            print(f"⚠️  Manifest not found at {args.manifest}. Auto-initializing new cohort...")
            initialize_manifest(cfg, args.manifest, args.start)
        manifest = json.loads(args.manifest.read_text())
        db_dest = args.db or ROOT / f"quotes_{args.mode}.sqlite"
        res = run_collection(cfg, manifest, db_dest, args.mode, supabase)
        print(json.dumps(res, indent=2))

    elif args.command == "daemon":
        if not args.manifest.exists():
            print(f"⚠️  Manifest not found at {args.manifest}. Auto-initializing new cohort...")
            initialize_manifest(cfg, args.manifest, args.start)
        manifest = json.loads(args.manifest.read_text())
        db_dest = args.db or ROOT / f"quotes_{args.mode}.sqlite"
        run_daemon(cfg, manifest, db_dest, args.mode, supabase)


if __name__ == "__main__":
    main()
