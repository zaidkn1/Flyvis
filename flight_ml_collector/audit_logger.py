#!/usr/bin/env python3
"""
==============================================================================
AUDIT LOGGER FOR PROSPECTIVE DECISIONS & OUTCOME RECONCILIATION
==============================================================================
Guarantees complete prospective auditability:
1. Loads full historical observations up to decision_time t so Model 2 receives
   authentic trailing history and Model 3 receives intra-batch schedule context.
2. Strictly uses the frozen preprocessing pipeline (frozen_feature_pipeline).
3. Logs predictions at decision time t (BEFORE outcomes are known):
   - timestamp, model name/version, exact input feature vector, p_wait, action.
4. Marks initial backfilled predictions explicitly with is_backfilled=1.
5. Reconciles outcomes when t_max reaches the evaluable window (t + 36h).
"""

import json
import sqlite3
import uuid
import datetime as dt
import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "live_quotes.sqlite"
MODELS_DIR = ROOT / "frozen_models"

# Strict use of frozen preprocessing pipeline
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(MODELS_DIR))
from frozen_feature_pipeline import extract_features


def init_audit_table(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS prospective_predictions (
            prediction_id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            observation_id TEXT NOT NULL,
            route TEXT NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            departure_date TEXT NOT NULL,
            decision_time TEXT NOT NULL,
            model_name TEXT NOT NULL,
            model_version TEXT NOT NULL,
            current_price REAL NOT NULL,
            predicted_p_wait REAL NOT NULL,
            action TEXT NOT NULL,
            threshold REAL NOT NULL,
            features_json TEXT NOT NULL,
            is_backfilled INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            outcome_price_24h REAL,
            outcome_time TEXT,
            outcome_label INTEGER,
            outcome_status TEXT,
            outcome_reason TEXT,
            resolved_at TEXT
        )
    """)
    # Check if is_backfilled column exists (for migrations)
    cur.execute("PRAGMA table_info(prospective_predictions)")
    cols = [col[1] for col in cur.fetchall()]
    if 'is_backfilled' not in cols:
        cur.execute("ALTER TABLE prospective_predictions ADD COLUMN is_backfilled INTEGER DEFAULT 0")

    cur.execute("CREATE INDEX IF NOT EXISTS idx_prosp_pred_lookup ON prospective_predictions(route, departure_date, decision_time)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prosp_pred_run ON prospective_predictions(run_id)")
    conn.commit()


MAX_TIMELY_DELAY_MINUTES = 15.0  # Max permitted delay between batch completion and prediction logging


def score_and_audit_sweep(conn: sqlite3.Connection, run_id: str, is_backfilled: int = None):
    """
    Called upon sweep completion.
    Enforces delay check: if delay between decision_time and scoring > 15 minutes,
    strictly enforces is_backfilled=1 to protect headline prospective results.
    """
    init_audit_table(conn)
    cur = conn.cursor()

    # Get target sweep timing
    cur.execute(f"SELECT completed_at FROM searches WHERE run_id = ? ORDER BY completed_at DESC LIMIT 1", (run_id,))
    row = cur.fetchone()
    if not row or not row[0]:
        return 0
    t_curr = row[0]
    t_curr_dt = pd.to_datetime(t_curr, utc=True)
    now_dt = dt.datetime.now(dt.timezone.utc)
    delay_minutes = (now_dt - t_curr_dt).total_seconds() / 60.0

    # Determine backfilled status:
    # 1. If explicit backfill requested, honor it.
    # 2. If delay exceeds 15 minutes, strictly enforce is_backfilled = 1.
    # 3. Only if delay <= 15 minutes AND not explicitly marked backfilled, allow is_backfilled = 0.
    if is_backfilled == 1 or delay_minutes > MAX_TIMELY_DELAY_MINUTES:
        actual_backfilled = 1
        if delay_minutes > MAX_TIMELY_DELAY_MINUTES:
            print(f"[Audit Notice] Run {run_id}: Scoring delay is {delay_minutes:.1f}m (> {MAX_TIMELY_DELAY_MINUTES}m threshold). Enforcing is_backfilled=1.")
        else:
            print(f"[Audit Notice] Run {run_id}: Explicitly marked as backfilled (is_backfilled=1).")
    else:
        actual_backfilled = 0 if is_backfilled is None else is_backfilled
        print(f"[Audit Notice] Run {run_id}: Timely scoring ({delay_minutes:.1f}m <= {MAX_TIMELY_DELAY_MINUTES}m). Marking as genuine prospective (is_backfilled=0).")

    total_logged = 0
    now_utc = now_dt.isoformat()

    for (origin, dest) in [("DEL", "DXB"), ("BOM", "LHR")]:
        route_key = f"{origin.lower()}_{dest.lower()}"
        model_dir = MODELS_DIR / route_key
        manifest_file = model_dir / "manifest.json"

        if not manifest_file.exists():
            continue

        with open(manifest_file, "r") as f:
            manifest = json.load(f)

        # 1. Load historical observations available up to t_curr (prior sweeps + trailing history)
        obs = pd.read_sql_query(f"""
            SELECT 
                o.search_id,
                o.total_amount as price,
                o.currency,
                json_extract(o.normalized_json, '$.origin') AS origin,
                json_extract(o.normalized_json, '$.destination') AS destination,
                json_extract(o.normalized_json, '$.departure_date') AS departure_date,
                json_extract(o.normalized_json, '$.carrier_code') AS carrier,
                json_extract(o.normalized_json, '$.stops') AS stops,
                json_extract(o.normalized_json, '$.time_window') AS time_window,
                s.run_id,
                s.completed_at
            FROM observations o
            JOIN searches s ON o.search_id = s.id
            WHERE json_extract(o.normalized_json, '$.origin') = '{origin}'
              AND json_extract(o.normalized_json, '$.destination') = '{dest}'
              AND o.currency = 'INR'
              AND s.completed_at <= '{t_curr}'
        """, conn)

        if len(obs) == 0:
            continue

        obs['stops'] = obs['stops'].fillna(0).astype(int)
        sat = obs[obs['stops'] <= 1].copy()

        # 2. Form customer scenarios: cheapest satisfying offer per search batch
        scenarios = sat.groupby(['search_id', 'departure_date']).agg(
            decision_time=('completed_at', 'first'),
            quote_received_at=('completed_at', 'first'),
            search_batch_id=('run_id', 'first'),
            origin=('origin', 'first'),
            destination=('destination', 'first'),
            currency=('currency', 'first'),
            current_price=('price', 'min'),
            carrier=('carrier', lambda c: sat.loc[c.index[np.argmin(sat.loc[c.index, 'price'])], 'carrier']),
            stops=('stops', 'min'),
            time_window=('time_window', 'first')
        ).reset_index()

        scenarios['decision_time'] = pd.to_datetime(scenarios['decision_time'], utc=True)
        scenarios['quote_received_at'] = scenarios['decision_time']
        scenarios['cabin'] = 'economy'
        scenarios['max_stops'] = '1'
        scenarios['allowed_airlines'] = 'ALL'
        scenarios['dep_time_band'] = 'ANY'
        scenarios['checked_bags_qty'] = 'ANY'
        scenarios['checked_bag_weight_kg'] = 'ANY'
        scenarios['carry_on_qty'] = 'ANY'
        scenarios['observation_id'] = f"{route_key}_scen_" + scenarios.index.astype(str)

        # 3. Identify target scenarios belonging strictly to current run_id
        target_mask = (scenarios['search_batch_id'] == run_id)
        if not target_mask.any():
            continue

        # 4. Extract features using frozen pipeline on full historical pool
        tier1, tier2, tier3 = extract_features(scenarios)
        feature_tiers = {'model_1': tier1, 'model_2': tier2, 'model_3': tier3}

        threshold = manifest.get('decision_threshold_wait', 0.60)
        route_str = f"{origin}->{dest}"

        target_scenarios = scenarios[target_mask].copy().reset_index(drop=True)

        for m_key in ['model_1', 'model_2', 'model_3']:
            m_info = manifest['models'][m_key]
            clf_path = model_dir / m_info['file']
            if not clf_path.exists():
                continue
            clf = joblib.load(clf_path)

            cols = m_info['feature_columns']
            feat_df = feature_tiers[m_key].set_index('observation_id')
            
            # Assert authoritative columns exist
            missing_cols = [c for c in cols if c not in feat_df.columns]
            if missing_cols:
                raise KeyError(f"Feature schema mismatch for {m_key}: missing columns {missing_cols}")

            # Filter strictly to target scenarios
            X_eval = feat_df.loc[target_scenarios['observation_id']][cols]
            probs = clf.predict_proba(X_eval)[:, 1]

            for i in range(len(target_scenarios)):
                row_scen = target_scenarios.iloc[i]
                obs_id = row_scen['observation_id']

                # Avoid duplicate insertion for same run, route, departure_date, and model
                cur.execute("""
                    SELECT 1 FROM prospective_predictions 
                    WHERE run_id = ? AND route = ? AND departure_date = ? AND model_name = ?
                """, (run_id, route_str, str(row_scen['departure_date']), m_key))
                if cur.fetchone():
                    continue

                p_wait = float(probs[i])
                action = 'WAIT' if p_wait >= threshold else 'BUY_NOW'

                features_dict = {
                    col: (
                        None if pd.isna(X_eval.iloc[i][col])
                        else str(X_eval.iloc[i][col]) if isinstance(X_eval.iloc[i][col], (pd.CategoricalDtype, str))
                        else float(X_eval.iloc[i][col]) if isinstance(X_eval.iloc[i][col], (int, float, np.integer, np.floating))
                        else str(X_eval.iloc[i][col])
                    )
                    for col in cols
                }

                pred_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO prospective_predictions (
                        prediction_id, run_id, observation_id, route, origin, destination,
                        departure_date, decision_time, model_name, model_version, current_price,
                        predicted_p_wait, action, threshold, features_json, is_backfilled, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'frozen_v1_20261003', ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pred_id,
                    run_id,
                    obs_id,
                    route_str,
                    origin,
                    dest,
                    str(row_scen['departure_date']),
                    row_scen['decision_time'].isoformat(),
                    m_key,
                    float(row_scen['current_price']),
                    round(p_wait, 4),
                    action,
                    threshold,
                    json.dumps(features_dict),
                    actual_backfilled,
                    now_utc
                ))
                total_logged += 1

    conn.commit()
    return total_logged


def reconcile_outcomes(conn: sqlite3.Connection):
    """
    Scans prospective_predictions with outcome_status IS NULL,
    checks if candidate offers exist within target_24h (+- 6h) in the fixed-dates-12h campaign,
    and attaches verified outcome fields.
    """
    init_audit_table(conn)
    cur = conn.cursor()

    preds = pd.read_sql_query("""
        SELECT prediction_id, route, origin, destination, departure_date, decision_time, current_price
        FROM prospective_predictions
        WHERE outcome_status IS NULL
    """, conn)

    if len(preds) == 0:
        return 0

    preds['decision_time'] = pd.to_datetime(preds['decision_time'], utc=True)
    preds['target_24h'] = preds['decision_time'] + pd.Timedelta(hours=24)

    # Load searches from fixed-dates-12h
    searches = pd.read_sql_query("""
        SELECT id as search_id, completed_at, status, http_status 
        FROM searches 
        WHERE campaign_id = 'fixed-dates-12h'
    """, conn)

    if len(searches) == 0:
        return 0

    searches['completed_at'] = pd.to_datetime(searches['completed_at'], utc=True)
    t_max = searches['completed_at'].max()

    obs = pd.read_sql_query("""
        SELECT 
            o.search_id,
            o.total_amount as price,
            json_extract(o.normalized_json, '$.origin') AS origin,
            json_extract(o.normalized_json, '$.destination') AS destination,
            json_extract(o.normalized_json, '$.departure_date') AS departure_date,
            json_extract(o.normalized_json, '$.stops') AS stops
        FROM observations o
        WHERE o.campaign_id = 'fixed-dates-12h'
    """, conn)

    obs['stops'] = obs['stops'].fillna(0).astype(int)
    cand_obs = obs[obs['stops'] <= 1].merge(searches[['search_id', 'completed_at']], on='search_id')

    cand = cand_obs.groupby(['origin', 'destination', 'departure_date', 'completed_at']).agg(
        outcome_price=('price', 'min')
    ).reset_index().rename(columns={'completed_at': 'outcome_time'}).sort_values('outcome_time')

    now_utc = dt.datetime.now(dt.timezone.utc).isoformat()
    reconciled_count = 0

    for idx, row in preds.iterrows():
        # Enforce full 30h window rule (requires 36h sweep to elapse for 12h intervals)
        if row['decision_time'] + pd.Timedelta(hours=30) > t_max:
            continue

        c_match = cand[
            (cand['origin'] == row['origin']) & 
            (cand['destination'] == row['destination']) & 
            (cand['departure_date'] == row['departure_date'])
        ].copy()

        matched_offer = None
        if len(c_match) > 0:
            diffs = (c_match['outcome_time'] - row['target_24h']).abs()
            nearest_idx = diffs.idxmin()
            if diffs.loc[nearest_idx] <= pd.Timedelta(hours=6):
                matched_offer = c_match.loc[nearest_idx]

        if matched_offer is not None:
            out_price = float(matched_offer['outcome_price'])
            out_time = matched_offer['outcome_time'].isoformat()
            out_label = 1 if out_price < row['current_price'] else 0
            cur.execute("""
                UPDATE prospective_predictions
                SET outcome_price_24h = ?, outcome_time = ?, outcome_label = ?, outcome_status = 'VERIFIED', resolved_at = ?
                WHERE prediction_id = ?
            """, (out_price, out_time, out_label, now_utc, row['prediction_id']))
            reconciled_count += 1
        else:
            cur.execute("""
                UPDATE prospective_predictions
                SET outcome_status = 'UNRESOLVED', outcome_reason = 'no_search_or_match_in_window', resolved_at = ?
                WHERE prediction_id = ?
            """, (now_utc, row['prediction_id']))
            reconciled_count += 1

    conn.commit()
    return reconciled_count


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Audit logger and outcome reconciler")
    parser.add_argument("--score-unscored", action="store_true", help="Score any fixed-date sweeps that lack predictions without deleting existing ones")
    parser.add_argument("--reconcile-only", action="store_true", help="Reconcile outcomes for decisions whose 36h window has elapsed")
    args = parser.parse_args()

    conn = sqlite3.connect(DB_PATH)
    init_audit_table(conn)

    cur = conn.cursor()
    cur.execute("SELECT DISTINCT run_id FROM searches WHERE campaign_id = 'fixed-dates-12h'")
    runs = [r[0] for r in cur.fetchall()]
    print(f"Checking {len(runs)} fixed-date sweep runs in database...")

    if not args.reconcile_only:
        for rid in runs:
            # Check how many predictions exist for this run
            cur.execute("SELECT count(*) FROM prospective_predictions WHERE run_id = ?", (rid,))
            existing = cur.fetchone()[0]
            if existing == 0:
                print(f"Run {rid} has 0 stored predictions. Performing historical catch-up scoring (defaults to is_backfilled=1)...")
                n = score_and_audit_sweep(conn, rid, is_backfilled=1)
                print(f"Run {rid}: logged {n} new auditable model predictions (is_backfilled=1).")
            else:
                print(f"Run {rid}: already has {existing} stored predictions (preserving original records).")

    rec = reconcile_outcomes(conn)
    print(f"Reconciliation: {rec} outcomes updated.")
    conn.close()
