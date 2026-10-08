#!/usr/bin/env python3
"""
==============================================================================
RESEARCH BENCHMARK: 3-MODEL ABLATION WITH CUSTOMER-DEFINED BASKETS
==============================================================================
Evaluates:
1. Baseline: Buy Immediately (BUY_NOW for all)
2. Baseline: Always Wait (WAIT for all)
3. Model 1: Current-Trip Only (Baseline features)
4. Model 2: Current-Trip + Trailing 60d History
5. Model 3: Current-Trip + Trailing 60d History + Cross-Sectional Schedule Context

Methodological Controls:
- Quotes are treated as observed public quotes (not partner-verified inventory).
- Customer profiles are defined first (e.g. Flexible Carrier, Max Stops <= 1).
  Baskets aggregate all satisfying offers within that search into the single cheapest available fare.
- Actual search batch timestamps: uses s.completed_at as decision timestamp and s.run_id as sweep batch.
- Missing baggage information remains UNKNOWN rather than imputed as 0 or 1.
- Fully elapsed matching window: requires decision_time + 30h <= t_max.
- Unresolved reasons are strictly classified using search logs:
  * no_matching_quote_observed: search completed (HTTP 200) in window, but offer was absent.
  * search_failed_or_errored: search attempted in window, but failed (network error, parse error, non-200).
  * no_search_conducted: no search attempted for that corridor/date in window.
- Out-of-time evaluation with strict temporal purging.
- Evaluates across penalty spectrum (0%, 5%, 10%, 20%) in consistent currency (INR).
"""

import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from feature_pipeline import run_three_model_ablation


WINDOW_MIN_HOURS = 18
WINDOW_MAX_HOURS = 30


@dataclass
class CustomerProfile:
    name: str
    origin: str
    destination: str
    currency: str = 'INR'
    cabin: str = 'economy'
    max_stops: int = 1
    allowed_airlines: str = 'ALL'  # 'ALL' or specific carrier like 'EK', 'AI'
    dep_time_band: str = 'ANY'


def load_customer_cohort(
    db_path: Path,
    profile: CustomerProfile
):
    conn = sqlite3.connect(db_path)

    # 1. Load searches table
    searches = pd.read_sql_query(f"""
        SELECT id as search_id, run_id, query_key, started_at, completed_at, status, http_status 
        FROM searches 
        WHERE query_key LIKE '{profile.origin}-{profile.destination}%'
    """, conn)
    searches['started_at'] = pd.to_datetime(searches['started_at'], utc=True)
    searches['completed_at'] = pd.to_datetime(searches['completed_at'], utc=True)

    # 2. Load observations
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
            json_extract(o.normalized_json, '$.baggage.checked_pieces') AS checked_pieces,
            json_extract(o.normalized_json, '$.baggage.checked_weight_kg') AS checked_weight_kg,
            json_extract(o.normalized_json, '$.baggage.carry_on_included') AS carry_on_included
        FROM observations o
        WHERE json_extract(o.normalized_json, '$.origin') = '{profile.origin}' 
          AND json_extract(o.normalized_json, '$.destination') = '{profile.destination}'
          AND o.currency = '{profile.currency}'
    """, conn)
    conn.close()

    if len(obs) == 0:
        raise ValueError(f"No observations found for {profile.origin}->{profile.destination}")

    obs['stops'] = obs['stops'].fillna(0).astype(int)
    obs = obs.merge(searches[['search_id', 'run_id', 'completed_at']], on='search_id')

    # 3. Filter offers satisfying the customer profile constraints
    mask = (obs['stops'] <= profile.max_stops)
    if profile.allowed_airlines != 'ALL':
        mask &= (obs['carrier'] == profile.allowed_airlines)
    if profile.dep_time_band != 'ANY':
        mask &= (obs['time_window'] == profile.dep_time_band)

    sat = obs[mask].copy()
    if len(sat) == 0:
        raise ValueError(f"No offers satisfy customer profile {profile.name}")

    # 4. Define decision scenarios: cheapest satisfying offer per actual search batch
    scenarios = sat.groupby(['search_id', 'departure_date']).agg(
        decision_time=('completed_at', 'first'),
        quote_received_at=('completed_at', 'first'),
        search_batch_id=('run_id', 'first'),
        origin=('origin', 'first'),
        destination=('destination', 'first'),
        currency=('currency', 'first'),
        current_price=('price', 'min'),
        # Offer-level attributes of whichever carrier happened to be cheapest on this search
        carrier=('carrier', lambda c: sat.loc[c.index[np.argmin(sat.loc[c.index, 'price'])], 'carrier']),
        stops=('stops', 'min'),
        time_window=('time_window', 'first'),
        offer_checked_pieces=('checked_pieces', lambda b: b.iloc[np.argmin(sat.loc[b.index, 'price'])]),
        offer_checked_weight_kg=('checked_weight_kg', lambda w: w.iloc[np.argmin(sat.loc[w.index, 'price'])]),
        offer_carry_on=('carry_on_included', lambda co: co.iloc[np.argmin(sat.loc[co.index, 'price'])])
    ).reset_index()

    scenarios['decision_time'] = pd.to_datetime(scenarios['decision_time'], utc=True)
    scenarios['quote_received_at'] = scenarios['decision_time']
    scenarios['cabin'] = profile.cabin
    scenarios['max_stops'] = str(profile.max_stops)
    scenarios['allowed_airlines'] = profile.allowed_airlines
    scenarios['dep_time_band'] = profile.dep_time_band
    
    # Customer requirements vs offer attributes:
    # If the customer profile has no baggage constraints, requirement keys stay 'ANY'
    # so trailing history tracks the customer requirement bundle and does NOT fragment
    # when the cheapest offer's baggage allowance shifts across carriers!
    scenarios['checked_bags_qty'] = 'ANY'
    scenarios['checked_bag_weight_kg'] = 'ANY'
    scenarios['carry_on_qty'] = 'ANY'
    scenarios['observation_id'] = f"{profile.origin.lower()}_{profile.destination.lower()}_" + scenarios.index.astype(str)

    t_min = scenarios['decision_time'].min()
    t_max = scenarios['decision_time'].max()

    # 5. Fully Elapsed Matching Window: decision_time + 30h <= t_max
    evaluable = scenarios[scenarios['decision_time'] + pd.Timedelta(hours=WINDOW_MAX_HOURS) <= t_max].copy().reset_index(drop=True)
    evaluable['target_24h'] = evaluable['decision_time'] + pd.Timedelta(hours=24)

    # 6. Candidate next-day outcomes: matched against scenarios satisfying the same profile
    cand = scenarios[['departure_date', 'decision_time', 'current_price']].rename(
        columns={'decision_time': 'outcome_time', 'current_price': 'outcome_price'}
    ).sort_values('outcome_time')

    matched = pd.merge_asof(
        evaluable.sort_values('target_24h'),
        cand,
        left_on='target_24h',
        right_on='outcome_time',
        by='departure_date',
        direction='nearest',
        tolerance=pd.Timedelta(hours=6)
    ).sort_values('observation_id').reset_index(drop=True)

    matched['price_outcome_24h'] = matched['outcome_price']
    matched['label_status'] = np.where(matched['price_outcome_24h'].notna(), 'VERIFIED', 'UNRESOLVED')
    matched['label_wait'] = np.where(matched['price_outcome_24h'] < matched['current_price'], 1, 0)
    matched['label_available_at'] = np.where(
        matched['outcome_time'].notna(),
        matched['outcome_time'],
        matched['decision_time'] + pd.Timedelta(hours=24)
    )

    # 7. Unresolved Reason Classification Grounded in Search Logs
    # Disaggregate: offers_returned, no_offers_returned (clean empty search), and errors/failures
    matched['query_key'] = (
        matched['origin'] + '-' + matched['destination'] + '|' + 
        pd.to_datetime(matched['departure_date']).dt.strftime('%Y-%m-%d')
    )

    s_offers = searches[(searches['http_status'] == 200) & (searches['status'] == 'offers_returned')].sort_values('started_at')
    s_empty = searches[(searches['http_status'] == 200) & (searches['status'] == 'no_offers_returned')].sort_values('started_at')
    s_failed = searches[(searches['http_status'] != 200) | (searches['status'].isin(['network_error', 'parse_error']))].sort_values('started_at')

    chk_offers = pd.merge_asof(
        matched[['observation_id', 'query_key', 'target_24h']].sort_values('target_24h'),
        s_offers[['query_key', 'started_at']].rename(columns={'started_at': 'time_offers'}),
        left_on='target_24h', right_on='time_offers', by='query_key', direction='nearest', tolerance=pd.Timedelta(hours=6)
    )
    chk_empty = pd.merge_asof(
        matched[['observation_id', 'query_key', 'target_24h']].sort_values('target_24h'),
        s_empty[['query_key', 'started_at']].rename(columns={'started_at': 'time_empty'}),
        left_on='target_24h', right_on='time_empty', by='query_key', direction='nearest', tolerance=pd.Timedelta(hours=6)
    )
    chk_fail = pd.merge_asof(
        matched[['observation_id', 'query_key', 'target_24h']].sort_values('target_24h'),
        s_failed[['query_key', 'started_at']].rename(columns={'started_at': 'time_fail'}),
        left_on='target_24h', right_on='time_fail', by='query_key', direction='nearest', tolerance=pd.Timedelta(hours=6)
    )

    matched = matched.merge(chk_offers[['observation_id', 'time_offers']], on='observation_id')
    matched = matched.merge(chk_empty[['observation_id', 'time_empty']], on='observation_id')
    matched = matched.merge(chk_fail[['observation_id', 'time_fail']], on='observation_id')

    def _classify(r):
        if r['label_status'] == 'VERIFIED':
            return 'none'
        if pd.notna(r['time_offers']):
            return 'no_matching_quote_in_results'
        elif pd.notna(r['time_empty']):
            return 'empty_search_results'
        elif pd.notna(r['time_fail']):
            return 'search_failed_or_errored'
        else:
            return 'no_search_scheduled_or_conducted'

    matched['unresolved_reason'] = matched.apply(_classify, axis=1)

    unres_sub = matched[matched['label_status'] == 'UNRESOLVED']
    stats = {
        'total_raw_offers': len(sat),
        'total_scenarios': len(scenarios),
        'min_date': t_min,
        'max_date': t_max,
        'evaluable_scenarios': len(matched),
        'excluded_in_progress': len(scenarios) - len(matched),
        'verified_matches': int((matched['label_status'] == 'VERIFIED').sum()),
        'unresolved_cases': int((matched['label_status'] == 'UNRESOLVED').sum()),
        'no_matching_quote_in_results': int((unres_sub['unresolved_reason'] == 'no_matching_quote_in_results').sum()),
        'empty_search_results': int((unres_sub['unresolved_reason'] == 'empty_search_results').sum()),
        'search_failed_or_errored': int((unres_sub['unresolved_reason'] == 'search_failed_or_errored').sum()),
        'no_search_conducted': int((unres_sub['unresolved_reason'] == 'no_search_scheduled_or_conducted').sum()),
        'match_rate_pct': round((matched['label_status'] == 'VERIFIED').mean() * 100, 1),
    }

    return matched, stats


def print_benchmark_table(profile_name: str, currency: str, stats: dict, results: dict):
    print("=" * 102)
    print(f"RESEARCH BENCHMARK: {profile_name} ({currency})")
    print("=" * 102)
    print(f"Data Span: {stats['min_date'].strftime('%Y-%m-%d %H:%M')} to {stats['max_date'].strftime('%Y-%m-%d %H:%M')}")
    print(f"Evaluable Search Scenarios: {stats['evaluable_scenarios']} | Excluded (30h Window Not Yet Elapsed): {stats['excluded_in_progress']}")
    print(f"Verified Next-Day Quotes: {stats['verified_matches']} ({stats['match_rate_pct']}%)")
    print(
        f"Unresolved Total: {stats['unresolved_cases']} "
        f"[No Match in Results: {stats['no_matching_quote_in_results']} | "
        f"Empty Results (HTTP 200): {stats['empty_search_results']} | "
        f"Search Errored: {stats['search_failed_or_errored']} | "
        f"No Search Scheduled: {stats['no_search_conducted']}]"
    )
    print("-" * 102)

    # 1. Supervised Quality
    print("\n[PART 1: SUPERVISED PROBABILITY CALIBRATION (VERIFIED OUTCOMES)]")
    print(f"{'Model / Policy':<36} {'Brier (lower)':<14} {'Log-Loss':<12} {'ECE (lower)':<12} {'ROC-AUC':<10}")
    print("-" * 102)
    for name, m in results.items():
        brier = f"{m['Brier Score']:.4f}" if not np.isnan(m['Brier Score']) else "N/A"
        loss = f"{m['Log-Loss']:.4f}" if not np.isnan(m['Log-Loss']) else "N/A"
        ece = f"{m['ECE']:.4f}" if not np.isnan(m['ECE']) else "N/A"
        auc = f"{m['ROC-AUC']:.4f}" if not np.isnan(m['ROC-AUC']) else "N/A"
        print(f"{name:<36} {brier:<14} {loss:<12} {ece:<12} {auc:<10}")

    # 2. Decision & Outcome Breakdown
    print("\n[PART 2: DECISIONS & WAIT OUTCOME BREAKDOWN (ALL OUT-OF-TIME VALIDATION CASES)]")
    print(f"{'Model / Policy':<36} {'Buy Now':<9} {'Wait':<7} {'Drops':<7} {'Rises':<7} {'Flat':<6} {'NoSearch':<10} {'NoMatch':<8}")
    print("-" * 102)
    for name, m in results.items():
        print(
            f"{name:<36} {m['Actions_BUY_NOW']:<9} {m['Actions_WAIT']:<7} "
            f"{m['Wait_Drops']:<7} {m['Wait_Rises']:<7} {m['Wait_Flat']:<6} "
            f"{m['Wait_Collection_Failures']:<10} {m['Wait_Confirmed_Unavailable']:<8}"
        )

    # 3. Policy P&L Spectrum
    print(f"\n[PART 3: NET POLICY PAYOFF SPECTRUM ({currency})]")
    print(f"{'Model / Policy':<36} {'0% Penalty':<14} {'5% Penalty':<14} {'10% Penalty':<14} {'20% Penalty':<14}")
    print("-" * 102)
    for name, m in results.items():
        p0 = f"{currency} {m['Net_Payoff_0pct_penalty']:>10,.2f}"
        p5 = f"{currency} {m['Net_Payoff_5pct_penalty']:>10,.2f}"
        p10 = f"{currency} {m['Net_Payoff_10pct_penalty']:>10,.2f}"
        p20 = f"{currency} {m['Net_Payoff_20pct_penalty']:>10,.2f}"
        print(f"{name:<36} {p0:<14} {p5:<14} {p10:<14} {p20:<14}")
    print("=" * 102 + "\n")


def run_benchmark():
    db_path = ROOT / "live_quotes.sqlite"
    if not db_path.exists():
        print(f"Error: {db_path} does not exist.")
        sys.exit(1)

    profiles = [
        CustomerProfile(
            name="DEL->DXB | Flexible Airline (Up to 1 Stop)",
            origin="DEL",
            destination="DXB",
            max_stops=1,
            allowed_airlines="ALL"
        ),
        CustomerProfile(
            name="BOM->LHR | Flexible Airline (Up to 1 Stop)",
            origin="BOM",
            destination="LHR",
            max_stops=1,
            allowed_airlines="ALL"
        ),
    ]

    all_summaries = {}

    for prof in profiles:
        df_eval, stats = load_customer_cohort(db_path, prof)
        res = run_three_model_ablation(df_eval, policy_threshold=0.60)
        print_benchmark_table(prof.name, prof.currency, stats, res)
        all_summaries[prof.name] = {'stats': stats, 'results': res}

    return all_summaries


if __name__ == '__main__':
    run_benchmark()
