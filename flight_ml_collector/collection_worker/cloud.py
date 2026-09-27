"""Supabase Cloud Sync Adapter for Flight ML Collector.
Uses Python Standard Library urllib.request to interact with Supabase PostgREST endpoints.
"""
import datetime as dt
import json
import os
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class Supabase:
    """Supabase REST client using standard library urllib."""

    def __init__(self, url=None, key=None):
        self.url = (url or os.environ.get("SUPABASE_URL", "")).rstrip("/")
        self.key = key or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    def check(self):
        """Preflight check validating Supabase URL, Key, and network connectivity."""
        if not self.url:
            raise ValueError("Missing SUPABASE_URL environment variable.")
        if not self.key:
            raise ValueError("Missing SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable.")

        endpoint = f"{self.url}/rest/v1/"
        req = urllib.request.Request(
            endpoint,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Accept": "application/json",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status not in (200, 204):
                    raise OSError(f"Supabase preflight check failed with HTTP {resp.status}")
        except urllib.error.HTTPError as e:
            # OpenAPI / schema endpoint might return 200 or 404 depending on table exposed
            if e.code in (401, 403):
                raise ValueError(f"Supabase authentication failed: HTTP {e.code}")
            elif e.code not in (200, 204, 404):
                raise OSError(f"Supabase endpoint returned HTTP {e.code}")
        except urllib.error.URLError as e:
            raise OSError(f"Cannot reach Supabase host: {e.reason}")

    def post(self, table, records):
        """Batch upsert records into a Supabase PostgREST table."""
        if not records:
            return 0

        endpoint = f"{self.url}/rest/v1/{urllib.parse.quote(table)}"
        payload = json.dumps(records).encode("utf-8")
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
            if resp.status not in (200, 201, 204):
                raise OSError(f"Supabase insert failed with HTTP {resp.status}")
        return len(records)


def _init_tracking(db):
    """Ensures local SQLite database has tracking table for sync status."""
    db.execute(
        """CREATE TABLE IF NOT EXISTS _synced_tracking (
            table_name TEXT,
            record_id TEXT,
            synced_at TEXT,
            PRIMARY KEY(table_name, record_id)
        );"""
    )
    db.commit()


def sync(db_path, campaign_id, mode, remote):
    """Syncs pending records from local SQLite database to Supabase cloud.

    Returns the count of successfully uploaded changes.
    """
    path = Path(db_path)
    if not path.exists():
        return 0

    db = sqlite3.connect(str(path))
    db.row_factory = sqlite3.Row
    _init_tracking(db)

    uploaded_changes = 0
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()

    try:
        # 1. Sync runs table
        cur = db.execute(
            """SELECT r.id, r.started_at, r.finished_at, r.mode, r.config_json
               FROM runs r
               LEFT JOIN _synced_tracking t ON t.table_name = 'runs' AND t.record_id = r.id
               WHERE t.record_id IS NULL"""
        )
        runs_rows = cur.fetchall()
        if runs_rows:
            batch = []
            for row in runs_rows:
                cfg = None
                try:
                    cfg = json.loads(row["config_json"]) if row["config_json"] else None
                except Exception:
                    cfg = None
                batch.append({
                    "id": row["id"],
                    "campaign_id": campaign_id,
                    "started_at": row["started_at"],
                    "finished_at": row["finished_at"],
                    "mode": row["mode"],
                    "config_json": cfg,
                })
            count = remote.post("runs", batch)
            db.executemany(
                "INSERT OR REPLACE INTO _synced_tracking VALUES('runs', ?, ?)",
                [(r["id"], now_iso) for r in runs_rows],
            )
            db.commit()
            uploaded_changes += count

        # 2. Sync searches table
        cur = db.execute(
            """SELECT s.id, s.run_id, s.query_key, s.started_at, s.completed_at, s.status, s.http_status, s.raw_json
               FROM searches s
               LEFT JOIN _synced_tracking t ON t.table_name = 'searches' AND t.record_id = s.id
               WHERE t.record_id IS NULL"""
        )
        searches_rows = cur.fetchall()
        if searches_rows:
            batch = []
            for row in searches_rows:
                raw = None
                try:
                    raw = json.loads(row["raw_json"]) if row["raw_json"] else None
                except Exception:
                    raw = None
                batch.append({
                    "id": row["id"],
                    "campaign_id": campaign_id,
                    "run_id": row["run_id"],
                    "query_key": row["query_key"],
                    "started_at": row["started_at"],
                    "completed_at": row["completed_at"],
                    "status": row["status"],
                    "http_status": row["http_status"],
                    "raw_json": raw,
                })
            # Chunk post into groups of 50
            for i in range(0, len(batch), 50):
                chunk = batch[i : i + 50]
                uploaded_changes += remote.post("searches", chunk)
            db.executemany(
                "INSERT OR REPLACE INTO _synced_tracking VALUES('searches', ?, ?)",
                [(r["id"], now_iso) for r in searches_rows],
            )
            db.commit()

        # 3. Sync observations table
        cur = db.execute(
            """SELECT o.search_id, o.offer_id, o.observed_at, o.stage, o.normalized_json, o.raw_json
               FROM observations o
               LEFT JOIN _synced_tracking t ON t.table_name = 'observations' 
                    AND t.record_id = (o.search_id || ':' || o.offer_id || ':' || o.stage)
               WHERE t.record_id IS NULL"""
        )
        obs_rows = cur.fetchall()
        if obs_rows:
            batch = []
            tracking_keys = []
            for row in obs_rows:
                norm = None
                raw = None
                try:
                    norm = json.loads(row["normalized_json"]) if row["normalized_json"] else None
                except Exception:
                    norm = None
                try:
                    raw = json.loads(row["raw_json"]) if row["raw_json"] else None
                except Exception:
                    raw = None

                composite_key = f"{row['search_id']}:{row['offer_id']}:{row['stage']}"
                tracking_keys.append((composite_key, now_iso))

                # Extract convenient columnar features from normalized JSON for easy SQL querying
                total_amount = None
                tax_amount = None
                currency = None
                if norm:
                    try:
                        total_amount = float(norm.get("quoted_total_amount") or 0)
                    except (ValueError, TypeError):
                        total_amount = None
                    try:
                        tax_amount = float(norm.get("tax_amount") or 0)
                    except (ValueError, TypeError):
                        tax_amount = None
                    currency = norm.get("currency")

                batch.append({
                    "search_id": row["search_id"],
                    "offer_id": row["offer_id"],
                    "stage": row["stage"],
                    "campaign_id": campaign_id,
                    "observed_at": row["observed_at"],
                    "total_amount": total_amount,
                    "tax_amount": tax_amount,
                    "currency": currency,
                    "normalized_json": norm,
                    "raw_json": raw,
                })

            for i in range(0, len(batch), 100):
                chunk = batch[i : i + 100]
                uploaded_changes += remote.post("observations", chunk)

            db.executemany(
                "INSERT OR REPLACE INTO _synced_tracking VALUES('observations', ?, ?)",
                tracking_keys,
            )
            db.commit()

        # 4. Sync detail_events table
        cur = db.execute(
            """SELECT d.search_id, d.offer_id, d.observed_at, d.status, d.http_status
               FROM detail_events d
               LEFT JOIN _synced_tracking t ON t.table_name = 'detail_events' 
                    AND t.record_id = (d.search_id || ':' || d.offer_id || ':' || d.observed_at)
               WHERE t.record_id IS NULL"""
        )
        detail_rows = cur.fetchall()
        if detail_rows:
            batch = []
            tracking_keys = []
            for row in detail_rows:
                composite_key = f"{row['search_id']}:{row['offer_id']}:{row['observed_at']}"
                tracking_keys.append((composite_key, now_iso))
                batch.append({
                    "search_id": row["search_id"],
                    "offer_id": row["offer_id"],
                    "campaign_id": campaign_id,
                    "observed_at": row["observed_at"],
                    "status": row["status"],
                    "http_status": row["http_status"],
                })

            for i in range(0, len(batch), 100):
                chunk = batch[i : i + 100]
                uploaded_changes += remote.post("detail_events", chunk)

            db.executemany(
                "INSERT OR REPLACE INTO _synced_tracking VALUES('detail_events', ?, ?)",
                tracking_keys,
            )
            db.commit()

    finally:
        db.close()

    return uploaded_changes
