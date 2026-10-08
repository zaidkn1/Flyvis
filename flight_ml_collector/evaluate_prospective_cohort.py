#!/usr/bin/env python3
"""
==============================================================================
PROSPECTIVE COHORT EVALUATION (CAMPAIGN: 'fixed-dates-12h')
==============================================================================
Evaluates prospective performance strictly using the auditable decisions and
probabilities stored in prospective_predictions at decision time.

Audit Guarantees:
1. Primary evaluation: Measures already-logged decisions and predicted probabilities
   against reconciled 24-hour outcomes (NO on-the-fly recomputation).
2. Strict separation of backfilled vs genuine prospective records:
   - Headline prospective results require is_backfilled == 0.
   - Initial Sweep 1 backfilled records (is_backfilled == 1) are reported separately.
3. Strict window discipline:
   - Evaluates ONLY completed outcome windows (VERIFIED or UNRESOLVED).
   - Pending decisions (outcome_status IS NULL) are NEVER converted to UNRESOLVED losses.
4. Optional --recheck-reproducibility flag: verifies that re-running inference on
   frozen models exactly reproduces the logged probabilities.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, roc_auc_score

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "frozen_models"
DB_PATH = ROOT / "live_quotes.sqlite"

# Ensure frozen pipeline is used
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(MODELS_DIR))
from frozen_feature_pipeline import extract_features, calculate_policy_simulation
from audit_logger import reconcile_outcomes


def _evaluate_decision_block(df_sub: pd.DataFrame, block_title: str, manifest: dict):
    print("\n" + "-" * 100)
    print(block_title)
    print("-" * 100)

    if len(df_sub) == 0:
        print("No decisions recorded in this category yet.")
        return

    # Strict separation: completed windows vs pending windows
    completed = df_sub[df_sub['outcome_status'].isin(['VERIFIED', 'UNRESOLVED'])].copy().reset_index(drop=True)
    pending = df_sub[df_sub['outcome_status'].isna()].copy().reset_index(drop=True)

    print(f"Total Decisions in Cohort:         {len(df_sub)}")
    print(f"Completed Outcome Windows:         {len(completed)} (Verified: {int((completed['outcome_status'] == 'VERIFIED').sum())}, Unresolved: {int((completed['outcome_status'] == 'UNRESOLVED').sum())})")
    print(f"Pending Decisions (Active Window): {len(pending)} (Excluded from loss metrics until 36h sweep completes)")

    if len(completed) == 0:
        print("\n[Status]: 0 completed outcome windows yet. All decisions remain within the active 36-hour outcome window.")
        return

    print("\n[Performance Metrics (Completed Windows Only)]")
    for m_key in ['model_1', 'model_2', 'model_3']:
        m_comp = completed[completed['model_name'] == m_key].copy().reset_index(drop=True)
        if len(m_comp) == 0:
            continue
        m_ver = m_comp[m_comp['outcome_status'] == 'VERIFIED']

        # Calibration metrics on verified outcomes
        brier = brier_score_loss(m_ver['outcome_label'], m_ver['predicted_p_wait']) if len(m_ver) > 0 else np.nan
        auc = roc_auc_score(m_ver['outcome_label'], m_ver['predicted_p_wait']) if (len(m_ver) > 0 and len(np.unique(m_ver['outcome_label'])) > 1) else np.nan

        # Policy simulation strictly on completed cases (never penalizing pending decisions)
        val_format = pd.DataFrame({
            'current_price': m_comp['current_price'],
            'price_outcome_24h': m_comp['outcome_price_24h'],
            'label_status': m_comp['outcome_status'],
            'unresolved_reason': m_comp['outcome_reason'].fillna('collection_failure')
        })
        sim = calculate_policy_simulation(val_format, m_comp['action'].values)
        label = manifest['models'][m_key]['label']

        print(f"\n{label}:")
        print(f"  Decisions Evaluated: {len(m_comp)} | Actions: {sim['Actions_BUY_NOW']} BUY_NOW | {sim['Actions_WAIT']} WAIT (Drops: {sim['Wait_Drops']}, Rises: {sim['Wait_Rises']}, Flat: {sim['Wait_Flat']})")
        print(f"  Calibration (Verified): Brier = {brier:.4f} | ROC-AUC = {auc if np.isnan(auc) else round(auc, 4)}")
        print(f"  Net Payoffs: 0% = INR {sim['Net_Payoff_0pct_penalty']:,.2f} | 5% = INR {sim['Net_Payoff_5pct_penalty']:,.2f} | 10% = INR {sim['Net_Payoff_10pct_penalty']:,.2f} | 20% = INR {sim['Net_Payoff_20pct_penalty']:,.2f}")


def evaluate_stored_decisions(origin: str, destination: str, db_path: Path, recheck_reproducibility: bool = False):
    route_str = f"{origin}->{destination}"
    route_key = f"{origin.lower()}_{destination.lower()}"
    model_dir = MODELS_DIR / route_key
    manifest_file = model_dir / "manifest.json"

    if not manifest_file.exists():
        print(f"Error: Manifest not found at {manifest_file}")
        return

    with open(manifest_file, "r") as f:
        manifest = json.load(f)

    conn = sqlite3.connect(db_path)

    # 1. First trigger reconciliation for any outcomes that have fully elapsed
    n_rec = reconcile_outcomes(conn)

    # 2. Query stored predictions
    preds = pd.read_sql_query("""
        SELECT 
            prediction_id, run_id, observation_id, route, departure_date,
            decision_time, model_name, model_version, current_price,
            predicted_p_wait, action, threshold, features_json, is_backfilled,
            created_at, outcome_price_24h, outcome_time, outcome_label,
            outcome_status, outcome_reason, resolved_at
        FROM prospective_predictions
        WHERE route = ?
        ORDER BY decision_time ASC, departure_date ASC, model_name ASC
    """, conn, params=(route_str,))

    # 3. Check collection timeline in searches
    searches = pd.read_sql_query("""
        SELECT id, started_at, completed_at, status, http_status 
        FROM searches 
        WHERE campaign_id = 'fixed-dates-12h' AND query_key LIKE ?
        ORDER BY started_at ASC
    """, conn, params=(f"{origin}-{destination}%",))

    print("\n" + "=" * 100)
    print(f"PROSPECTIVE BENCHMARK: {route_str} (Campaign: 'fixed-dates-12h')")
    print("=" * 100)
    print(f"Total Sweep Searches Recorded:     {len(searches)} (Runs: {preds['run_id'].nunique() if len(preds) else 0})")
    print(f"Total Stored Decisions:            {len(preds)} (Genuine Prospective: {int((preds['is_backfilled'] == 0).sum()) if len(preds) else 0} | Backfilled: {int((preds['is_backfilled'] == 1).sum()) if len(preds) else 0})")

    if len(preds) == 0:
        print("No stored predictions found for this route. Run audit_logger.py or collect_fixed_dates.py first.")
        conn.close()
        return

    searches['completed_at'] = pd.to_datetime(searches['completed_at'], utc=True)
    t_min = searches['completed_at'].min()
    t_max = searches['completed_at'].max()
    span_hours = (t_max - t_min).total_seconds() / 3600.0

    print(f"Active Collection Window:          {t_min.strftime('%Y-%m-%d %H:%M UTC')} to {t_max.strftime('%Y-%m-%d %H:%M UTC')} ({span_hours:.1f}h elapsed)")

    # Display Pinned Dates Status Snapshot (Most Recent Sweep)
    print("\n--- Current Pinned Dates Status (Most Recent Sweep) ---")
    latest_run_id = preds['run_id'].iloc[-1]
    latest_preds = preds[(preds['run_id'] == latest_run_id) & (preds['model_name'] == 'model_3')]
    for _, r in latest_preds.iterrows():
        p_m1 = preds[(preds['run_id'] == latest_run_id) & (preds['departure_date'] == r['departure_date']) & (preds['model_name'] == 'model_1')]['predicted_p_wait'].values[0]
        p_m2 = preds[(preds['run_id'] == latest_run_id) & (preds['departure_date'] == r['departure_date']) & (preds['model_name'] == 'model_2')]['predicted_p_wait'].values[0]
        p_m3 = r['predicted_p_wait']
        print(f"  Dep: {r['departure_date']} | Price: INR {r['current_price']:>8,.0f} | p_wait: [M1: {p_m1:.3f} | M2: {p_m2:.3f} | M3: {p_m3:.3f}] | Action: {r['action']}")

    # PART A: HEADLINE PROSPECTIVE EVALUATION (is_backfilled == 0)
    headline_preds = preds[preds['is_backfilled'] == 0].copy().reset_index(drop=True)
    _evaluate_decision_block(
        headline_preds,
        f"HEADLINE PROSPECTIVE BENCHMARK: {route_str} (Genuine Prospective Decisions, is_backfilled == 0)",
        manifest
    )

    # PART B: REFERENCE / CALIBRATION PILOT (is_backfilled == 1)
    backfilled_preds = preds[preds['is_backfilled'] == 1].copy().reset_index(drop=True)
    if len(backfilled_preds) > 0:
        _evaluate_decision_block(
            backfilled_preds,
            f"REFERENCE PILOT: {route_str} (Sweep 1 Backfill, is_backfilled == 1)",
            manifest
        )

    # PART C: Optional Reproducibility Verification Check
    if recheck_reproducibility:
        print("\n" + "-" * 100)
        print("REPRODUCIBILITY CHECK: RECOMPUTING PREDICTIONS FROM FROZEN ESTIMATORS")
        print("-" * 100)

        obs = pd.read_sql_query(f"""
            SELECT 
                o.search_id, o.total_amount as price, o.currency,
                json_extract(o.normalized_json, '$.origin') AS origin,
                json_extract(o.normalized_json, '$.destination') AS destination,
                json_extract(o.normalized_json, '$.departure_date') AS departure_date,
                json_extract(o.normalized_json, '$.carrier_code') AS carrier,
                json_extract(o.normalized_json, '$.stops') AS stops,
                json_extract(o.normalized_json, '$.time_window') AS time_window,
                s.run_id, s.completed_at
            FROM observations o
            JOIN searches s ON o.search_id = s.id
            WHERE json_extract(o.normalized_json, '$.origin') = '{origin}'
              AND json_extract(o.normalized_json, '$.destination') = '{destination}'
              AND o.currency = 'INR'
              AND s.completed_at <= '{t_max.isoformat()}'
        """, conn)

        obs['stops'] = obs['stops'].fillna(0).astype(int)
        sat = obs[obs['stops'] <= 1].copy()

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

        tier1, tier2, tier3 = extract_features(scenarios)
        feature_tiers = {'model_1': tier1, 'model_2': tier2, 'model_3': tier3}

        for m_key in ['model_1', 'model_2', 'model_3']:
            m_info = manifest['models'][m_key]
            clf = joblib.load(model_dir / m_info['file'])
            cols = m_info['feature_columns']
            feat_df = feature_tiers[m_key].set_index('observation_id')

            run_scenarios = scenarios[scenarios['search_batch_id'].isin(preds['run_id'].unique())]
            X_eval = feat_df.loc[run_scenarios['observation_id']][cols]
            probs_recomputed = clf.predict_proba(X_eval)[:, 1]

            stored_probs = []
            for _, r_scen in run_scenarios.iterrows():
                row_match = preds[
                    (preds['run_id'] == r_scen['search_batch_id']) & 
                    (preds['departure_date'] == str(r_scen['departure_date'])) & 
                    (preds['model_name'] == m_key)
                ]
                stored_probs.append(row_match['predicted_p_wait'].values[0])

            diffs = np.abs(np.array(probs_recomputed) - np.array(stored_probs))
            max_diff = np.max(diffs)
            print(f"{m_info['label']:<36} | Max Absolute Difference: {max_diff:.8f} | {'✅ 100% REPRODUCIBLE' if max_diff < 1e-4 else '❌ MISMATCH'}")

    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Evaluate prospective fixed-dates-12h cohort")
    parser.add_argument("--db-path", type=str, default=str(DB_PATH))
    parser.add_argument("--recheck-reproducibility", action="store_true", help="Recompute predictions and verify exact match with logged decisions")
    args = parser.parse_args()

    evaluate_stored_decisions("DEL", "DXB", Path(args.db_path), recheck_reproducibility=args.recheck_reproducibility)
    evaluate_stored_decisions("BOM", "LHR", Path(args.db_path), recheck_reproducibility=args.recheck_reproducibility)


if __name__ == '__main__':
    main()
