#!/usr/bin/env python3
"""
==============================================================================
VERIFIED, LEAK-FREE DUAL-CONTEXT FEATURE PIPELINE & EXPERIMENTAL HARNESS
==============================================================================
Implements the 3-model ablation benchmark:
- Model 1: Current Trip Baseline Attributes (preserving all market categoricals)
- Model 2: Model 1 + Strictly Causal Trailing History [t - 60d, t)
- Model 3: Model 2 + Cross-Sectional Departure-Date Context at Decision Time t

Strict Design Constraints:
1. Zero lookahead leakage: all historical features bounded by [t - 60d, t).
2. Timezone-aware origin dates: prevents midnight truncation of lead days.
3. Stable join-by-ID: all feature matrices joined strictly by observation_id.
4. Leave-one-out cross-sectional comparisons: target date excluded from comparisons.
5. Strict information availability: only quotes received <= decision_time are used.
6. Full policy simulation: evaluates verified drops, price rises, and unresolved outcomes.
"""

import datetime as dt
import zoneinfo
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score


# Standard IATA Airport Timezone Registry
IATA_TIMEZONES = {
    # India Metro & Regional
    'DEL': 'Asia/Kolkata', 'BOM': 'Asia/Kolkata', 'BLR': 'Asia/Kolkata',
    'HYD': 'Asia/Kolkata', 'MAA': 'Asia/Kolkata', 'CCU': 'Asia/Kolkata',
    'COK': 'Asia/Kolkata', 'AMD': 'Asia/Kolkata', 'PNQ': 'Asia/Kolkata',
    'GOI': 'Asia/Kolkata', 'GOX': 'Asia/Kolkata', 'TRV': 'Asia/Kolkata',
    'CCJ': 'Asia/Kolkata', 'CNN': 'Asia/Kolkata', 'IXR': 'Asia/Kolkata',
    'GAU': 'Asia/Kolkata', 'PAT': 'Asia/Kolkata', 'LKO': 'Asia/Kolkata',
    # Middle East
    'DXB': 'Asia/Dubai', 'SHJ': 'Asia/Dubai', 'AUH': 'Asia/Dubai',
    'DOH': 'Asia/Qatar', 'KWI': 'Asia/Kuwait', 'BAH': 'Asia/Bahrain',
    'MCT': 'Asia/Muscat', 'JED': 'Asia/Riyadh', 'RUH': 'Asia/Riyadh',
    'DMM': 'Asia/Riyadh',
    # Southeast & East Asia
    'SIN': 'Asia/Singapore', 'BKK': 'Asia/Bangkok', 'HKT': 'Asia/Bangkok',
    'KUL': 'Asia/Kuala_Lumpur', 'DPS': 'Asia/Makassar', 'CGK': 'Asia/Jakarta',
    'NRT': 'Asia/Tokyo', 'HND': 'Asia/Tokyo', 'ICN': 'Asia/Seoul',
    'HKG': 'Asia/Hong_Kong',
    # Europe & UK
    'LHR': 'Europe/London', 'LGW': 'Europe/London', 'CDG': 'Europe/Paris',
    'FRA': 'Europe/Berlin', 'MUC': 'Europe/Berlin', 'AMS': 'Europe/Amsterdam',
    # North America
    'JFK': 'America/New_York', 'EWR': 'America/New_York', 'SFO': 'America/Los_Angeles',
    'ORD': 'America/Chicago',
}


def _safe_col(df, col_name, default_value):
    """Safely extracts a series with a fallback default, preventing scalar attribute errors."""
    if col_name in df.columns:
        return df[col_name].fillna(default_value)
    return pd.Series(default_value, index=df.index)


def compute_calendar_lead_days(df):
    """
    Computes origin-local calendar lead days without midnight truncation bugs.
    Converts decision_time to each flight's origin airport local timezone,
    then calculates (departure_local_date - decision_local_date).days.
    """
    origin_series = df['origin'].astype(str)
    decision_utc = pd.to_datetime(df['decision_time'], utc=True)
    dep_dates = pd.to_datetime(df['departure_date']).dt.date

    local_lead_days = np.zeros(len(df), dtype=int)

    # Vectorized per origin timezone
    for orig in origin_series.unique():
        idx_mask = (origin_series == orig)
        tz_name = IATA_TIMEZONES.get(orig, 'UTC')
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
            local_decision_dates = decision_utc.loc[idx_mask].dt.tz_convert(tz).dt.date
        except Exception:
            local_decision_dates = decision_utc.loc[idx_mask].dt.date

        diffs = (dep_dates.loc[idx_mask] - local_decision_dates).apply(lambda d: d.days)
        local_lead_days[idx_mask.values] = diffs.values

    return local_lead_days


def build_requirement_keys(df):
    """
    Constructs a comprehensive customer requirement key representing the
    exact journey constraint bundle, including baggage and passenger profiles.
    """
    pax_a = _safe_col(df, 'pax_adults', 1).astype(str)
    pax_c = _safe_col(df, 'pax_children', 0).astype(str)
    pax_i = _safe_col(df, 'pax_infants', 0).astype(str)
    
    cb_qty = _safe_col(df, 'checked_bags_qty', 'UNKNOWN').fillna('UNKNOWN').astype(str)
    cb_wt = _safe_col(df, 'checked_bag_weight_kg', 'UNKNOWN').fillna('UNKNOWN').astype(str)
    co_qty = _safe_col(df, 'carry_on_qty', 'UNKNOWN').fillna('UNKNOWN').astype(str)
    
    stops = _safe_col(df, 'max_stops', 'any').astype(str)
    t_band = _safe_col(df, 'dep_time_band', 'any').astype(str)
    al = _safe_col(df, 'allowed_airlines', 'ALL').astype(str)
    cabin = _safe_col(df, 'cabin', 'economy').astype(str)
    currency = _safe_col(df, 'currency', 'INR').astype(str)

    req_key = (
        df['origin'].astype(str) + '_' +
        df['destination'].astype(str) + '_' +
        cabin + '_' +
        currency + '_' +
        'A' + pax_a + '_C' + pax_c + '_I' + pax_i + '_' +
        'CB' + cb_qty + 'x' + cb_wt + 'kg_CO' + co_qty + '_' +
        'S' + stops + '_T' + t_band + '_AL' + al
    )
    req_date_key = req_key + '_' + pd.to_datetime(df['departure_date']).dt.strftime('%Y-%m-%d')
    return req_key, req_date_key


def extract_features(df_input):
    """
    Extracts nested Model 1, Model 2, and Model 3 feature matrices.
    Every operation is leak-free and merged strictly by observation_id.
    """
    df = df_input.copy()
    if 'observation_id' not in df.columns:
        df['observation_id'] = [f"obs_{i}" for i in range(len(df))]

    # If batch_completed_at is provided, decision_time defaults to batch completion
    if 'batch_completed_at' in df.columns and df['batch_completed_at'].notna().any():
        df['decision_time'] = pd.to_datetime(df['batch_completed_at'], utc=True)
    else:
        df['decision_time'] = pd.to_datetime(df['decision_time'], utc=True)

    df['quote_received_at'] = pd.to_datetime(_safe_col(df, 'quote_received_at', df['decision_time']), utc=True)
    df['departure_date'] = pd.to_datetime(df['departure_date'])

    # Enforce strict quote availability at decision time
    # (Any quote received after decision_time cannot be used by that decision)
    df = df[df['quote_received_at'] <= df['decision_time']].copy()

    # Lead days & requirement keys
    df['calendar_lead_days'] = compute_calendar_lead_days(df)
    df['req_key'], df['req_date_key'] = build_requirement_keys(df)

    # =========================================================================
    # MODEL 1: Current-Trip Baseline (Strictly preserving market predictors)
    # =========================================================================
    m1 = pd.DataFrame({
        'observation_id': df['observation_id'],
        # Market and requirement predictors
        'origin': df['origin'].astype('category'),
        'destination': df['destination'].astype('category'),
        'cabin': _safe_col(df, 'cabin', 'economy').astype('category'),
        'currency': _safe_col(df, 'currency', 'INR').astype('category'),
        'carrier': _safe_col(df, 'carrier', 'UNKNOWN').astype('category'),
        'max_stops': _safe_col(df, 'max_stops', 'any').astype('category'),
        'dep_time_band': _safe_col(df, 'dep_time_band', 'any').astype('category'),
        # Trip specifics
        'calendar_lead_days': df['calendar_lead_days'],
        'current_price': df['current_price'].astype(float),
        'dep_day_of_week': df['departure_date'].dt.dayofweek.astype('category'),
        'is_weekend_dep': df['departure_date'].dt.dayofweek.isin([4, 6]).astype(int),
        'is_nonstop': _safe_col(df, 'is_nonstop', 0).astype(int),
    })

    # =========================================================================
    # MODEL 2: Causal Trailing History [t - 60d, t) Joined Strictly by ID
    # =========================================================================
    # Sort strictly by (req_date_key, decision_time)
    sub = df[['observation_id', 'req_date_key', 'decision_time', 'current_price']].copy()
    sub_sorted = sub.sort_values(['req_date_key', 'decision_time']).reset_index(drop=True)

    # Rolling 60-day window with closed='left' strictly enforces [t - 60d, t)
    sub_timed = sub_sorted.set_index('decision_time')
    roll_grp = sub_timed.groupby('req_date_key')['current_price'].rolling('60D', closed='left')
    
    roll_stats = roll_grp.agg(['count', 'min', 'max', 'mean', 'std']).reset_index()
    # Align observation_id exactly matching sub_sorted order
    roll_stats['observation_id'] = sub_sorted['observation_id'].values

    # True 24-hour lookback join via merge_asof
    sub_24h_query = sub[['observation_id', 'req_date_key', 'decision_time', 'current_price']].copy()
    sub_24h_query['target_24h_time'] = sub_24h_query['decision_time'] - pd.Timedelta(hours=24)

    sub_candidates = sub[['req_date_key', 'decision_time', 'current_price']].rename(
        columns={'decision_time': 'time_24h_obs', 'current_price': 'price_24h_ago'}
    )

    asof_24h = pd.merge_asof(
        sub_24h_query.sort_values('target_24h_time'),
        sub_candidates.sort_values('time_24h_obs'),
        left_on='target_24h_time',
        right_on='time_24h_obs',
        by='req_date_key',
        direction='nearest',
        tolerance=pd.Timedelta(hours=6)
    )
    # Strictly exclude quotes landing on or after decision_time
    asof_24h.loc[asof_24h['time_24h_obs'] >= asof_24h['decision_time'], 'price_24h_ago'] = np.nan
    asof_24h['delta_24h'] = asof_24h['current_price'] - asof_24h['price_24h_ago']

    # Merge rolling and 24h metrics strictly by observation_id
    m2_features = roll_stats[['observation_id', 'count', 'min', 'max', 'mean', 'std']].rename(
        columns={
            'count': 'hist_n_prior_quotes',
            'min': 'hist_min_60d',
            'max': 'hist_max_60d',
            'mean': 'hist_mean_60d',
            'std': 'hist_std_60d'
        }
    ).merge(asof_24h[['observation_id', 'delta_24h']], on='observation_id', how='left')

    # Merge current_price strictly by observation_id (fixes shuffle alignment bug!)
    m2_features = m2_features.merge(df[['observation_id', 'current_price']], on='observation_id', how='left')
    m2_features['hist_has_history'] = (m2_features['hist_n_prior_quotes'].fillna(0) > 0).astype(int)
    m2_features['ratio_to_hist_mean'] = np.where(
        m2_features['hist_mean_60d'] > 0,
        m2_features['current_price'] / m2_features['hist_mean_60d'],
        np.nan
    )
    m2_features = m2_features.drop(columns=['current_price'])

    # =========================================================================
    # MODEL 3: Cross-Sectional Departure Context at Decision Time t
    # =========================================================================
    # Strict causal availability:
    # A candidate quote from another departure date is eligible for target decision i iff:
    # 1. Same search_batch_id (or same route sweep)
    # 2. Same req_key (same travel requirement constraints)
    # 3. Different departure_date (exclude target departure date)
    # 4. quote_received_at <= target.decision_time (strictly available when target decided)
    # 5. Lead days relative to target decision_time in (0, 60]
    
    if 'search_batch_id' not in df.columns:
        df['search_batch_id'] = df['decision_time'].dt.strftime('%Y%m%d_%H')

    candidates = df[[
        'search_batch_id', 'req_key', 'departure_date', 'quote_received_at', 'current_price'
    ]].rename(columns={
        'departure_date': 'dep_other',
        'quote_received_at': 'quote_received_at_other',
        'current_price': 'price_other'
    })

    merged_comp = pd.merge(
        df[['observation_id', 'search_batch_id', 'req_key', 'decision_time', 'departure_date', 'current_price']],
        candidates,
        on=['search_batch_id', 'req_key']
    )

    # Enforce causal conditions:
    # 1. Exclude self
    merged_comp = merged_comp[merged_comp['departure_date'] != merged_comp['dep_other']]
    # 2. Strictly received before or at target decision_time
    merged_comp = merged_comp[merged_comp['quote_received_at_other'] <= merged_comp['decision_time']]
    # 3. Upcoming 60-day horizon relative to target decision date
    merged_comp['lead_other'] = (merged_comp['dep_other'].dt.date - merged_comp['decision_time'].dt.date).apply(lambda d: d.days)
    merged_comp = merged_comp[(merged_comp['lead_other'] > 0) & (merged_comp['lead_other'] <= 60)]

    if len(merged_comp) > 0:
        # Collapse to minimum available price per (target observation_id, dep_other)
        benchmarks_per_target = merged_comp.groupby(['observation_id', 'dep_other'], as_index=False).agg(
            price_other=('price_other', 'min'),
            decision_time=('decision_time', 'first'),
            departure_date=('departure_date', 'first'),
            current_price=('current_price', 'first')
        )

        # Forward 60-day stats per target observation
        fwd_stats = benchmarks_per_target.groupby('observation_id')['price_other'].agg(
            fwd_other_median='median',
            fwd_other_count='count'
        ).reset_index()

        # Nearby departures (+/- 3 calendar days, excluding self)
        benchmarks_per_target['day_diff'] = (benchmarks_per_target['dep_other'] - benchmarks_per_target['departure_date']).dt.days.abs()
        nearby_stats = benchmarks_per_target[benchmarks_per_target['day_diff'] <= 3].groupby('observation_id')['price_other'].agg(
            nearby_other_median='median',
            nearby_other_count='count'
        ).reset_index()

        # Same day-of-week forward departures (excluding self)
        benchmarks_per_target['same_dow'] = (benchmarks_per_target['dep_other'].dt.dayofweek == benchmarks_per_target['departure_date'].dt.dayofweek)
        dow_stats = benchmarks_per_target[benchmarks_per_target['same_dow']].groupby('observation_id')['price_other'].agg(
            same_dow_other_median='median',
            same_dow_other_count='count'
        ).reset_index()

        df_m3 = (
            df[['observation_id', 'current_price']]
            .merge(fwd_stats, on='observation_id', how='left')
            .merge(nearby_stats, on='observation_id', how='left')
            .merge(dow_stats, on='observation_id', how='left')
        )
    else:
        df_m3 = df[['observation_id', 'current_price']].copy()
        df_m3['fwd_other_median'] = np.nan
        df_m3['fwd_other_count'] = 0
        df_m3['nearby_other_median'] = np.nan
        df_m3['nearby_other_count'] = 0
        df_m3['same_dow_other_median'] = np.nan
        df_m3['same_dow_other_count'] = 0

    m3_features = pd.DataFrame({
        'observation_id': df_m3['observation_id'],
        'ratio_to_forward_60d_median': np.where(df_m3['fwd_other_median'] > 0, df_m3['current_price'] / df_m3['fwd_other_median'], np.nan),
        'ratio_to_nearby_median': np.where(df_m3['nearby_other_median'] > 0, df_m3['current_price'] / df_m3['nearby_other_median'], np.nan),
        'ratio_to_same_dow_median': np.where(df_m3['same_dow_other_median'] > 0, df_m3['current_price'] / df_m3['same_dow_other_median'], np.nan),
        'n_other_forward_dates': df_m3['fwd_other_count'].fillna(0),
        'n_nearby_dates_available': df_m3['nearby_other_count'].fillna(0),
    })

    # Assemble nested feature tiers strictly joined on observation_id
    tier1 = m1
    tier2 = tier1.merge(m2_features, on='observation_id', how='left')
    tier3 = tier2.merge(m3_features, on='observation_id', how='left')

    return tier1, tier2, tier3


def calculate_policy_simulation(val_df, actions, penalties=(0.0, 0.05, 0.10, 0.20)):
    """
    Evaluates policy actions against observed next-day outcomes across a penalty spectrum.
    
    Parameters:
    - val_df: DataFrame containing ['current_price', 'price_outcome_24h', 'label_status', 'unresolved_reason']
    - actions: Iterable / Series of 'BUY_NOW' or 'WAIT' aligned with val_df
    - penalties: Sequence of penalty fractions for unresolved outcomes when action is WAIT
    
    Returns:
    dict of action counts, outcome breakdown, and net payoffs by penalty tier.
    """
    actions_arr = np.asarray(actions)
    if len(actions_arr) != len(val_df):
        raise ValueError("actions length does not match val_df length")
    
    actions_buy_now = int(np.sum(actions_arr == 'BUY_NOW'))
    actions_wait = int(np.sum(actions_arr == 'WAIT'))
    
    wait_mask = (actions_arr == 'WAIT')
    wait_df = val_df[wait_mask]
    
    verified_wait = wait_df[wait_df['label_status'] == 'VERIFIED']
    drops = int(np.sum(verified_wait['price_outcome_24h'] < verified_wait['current_price']))
    rises = int(np.sum(verified_wait['price_outcome_24h'] > verified_wait['current_price']))
    flats = int(np.sum(verified_wait['price_outcome_24h'] == verified_wait['current_price']))
    
    unres_wait = wait_df[wait_df['label_status'] == 'UNRESOLVED']
    coll_fails = int(np.sum(unres_wait['unresolved_reason'] != 'confirmed_unavailable'))
    unavail = int(np.sum(unres_wait['unresolved_reason'] == 'confirmed_unavailable'))
    
    payoffs_by_penalty = {}
    for p in penalties:
        payoffs = np.zeros(len(val_df), dtype=float)
        
        # verified wait payoff: current_price - outcome_price (positive when price drops)
        ver_idx = np.where(wait_mask & (val_df['label_status'] == 'VERIFIED').values)[0]
        payoffs[ver_idx] = val_df['current_price'].iloc[ver_idx].values - val_df['price_outcome_24h'].iloc[ver_idx].values
        
        # unresolved wait payoff: -p * current_price
        unres_idx = np.where(wait_mask & (val_df['label_status'] == 'UNRESOLVED').values)[0]
        payoffs[unres_idx] = -p * val_df['current_price'].iloc[unres_idx].values
        
        pct_key = f'Net_Payoff_{int(round(p * 100))}pct_penalty'
        payoffs_by_penalty[pct_key] = round(float(np.sum(payoffs)), 2)
        
    return {
        'Actions_BUY_NOW': actions_buy_now,
        'Actions_WAIT': actions_wait,
        'Wait_Drops': drops,
        'Wait_Rises': rises,
        'Wait_Flat': flats,
        'Wait_Collection_Failures': coll_fails,
        'Wait_Confirmed_Unavailable': unavail,
        **payoffs_by_penalty
    }


def run_three_model_ablation(df, label_col='label_wait', val_start_date=None, policy_threshold=0.60):
    """
    Executes the 3-model benchmark under strict temporal purging and scenario-based policy simulation.
    
    Refuses to invent outcomes:
    - Requires explicit 'price_outcome_24h' column; does NOT substitute today's price.
    - Missing price outcomes are strictly categorized as 'UNRESOLVED'.
    - Reports policy P&L across a spectrum of penalties (0%, 5%, 10%, 20%).
    - Reports breakdown: verified drops, verified rises, collection failures, confirmed unavailable.
    - Compares all models against 'Baseline (Buy Immediately)' and 'Baseline (Always Wait)'.
    """
    if 'price_outcome_24h' not in df.columns:
        raise ValueError("Evaluation requires explicit 'price_outcome_24h' column; refusing to invent unchanged outcomes.")

    tier1, tier2, tier3 = extract_features(df)
    
    target_data = df[['observation_id', 'decision_time', label_col, 'current_price', 'price_outcome_24h']].copy()
    target_data['decision_time'] = pd.to_datetime(target_data['decision_time'], utc=True)
    
    # Track label status: VERIFIED vs UNRESOLVED
    if 'label_status' in df.columns:
        target_data['label_status'] = df['label_status']
    else:
        target_data['label_status'] = np.where(target_data['price_outcome_24h'].notna(), 'VERIFIED', 'UNRESOLVED')

    # Automatically flag NaN outcomes as UNRESOLVED
    target_data.loc[target_data['price_outcome_24h'].isna(), 'label_status'] = 'UNRESOLVED'

    # Unresolved reason (collection failure vs confirmed unavailable)
    target_data['unresolved_reason'] = _safe_col(df, 'unresolved_reason', 'collection_failure')

    if 'label_available_at' not in df.columns:
        target_data['label_available_at'] = target_data['decision_time'] + pd.Timedelta(hours=24)
    else:
        target_data['label_available_at'] = pd.to_datetime(df['label_available_at'], utc=True)

    # Set validation split point
    if val_start_date is None:
        val_start = target_data['decision_time'].quantile(0.75)
    else:
        val_start = pd.to_datetime(val_start_date, utc=True)

    # PURGING: Training samples whose outcome window extends past val_start are purged
    train_mask = (target_data['label_available_at'] <= val_start) & (target_data['label_status'] == 'VERIFIED')
    val_mask = target_data['decision_time'] >= val_start

    val_full = target_data[val_mask].copy().reset_index(drop=True)

    results = {}

    # Deterministic Baselines
    if len(val_full) > 0:
        results['Baseline (Buy Immediately)'] = {
            'ROC-AUC': np.nan,
            'Brier Score': np.nan,
            'Log-Loss': np.nan,
            'ECE': np.nan,
            **calculate_policy_simulation(val_full, np.full(len(val_full), 'BUY_NOW'))
        }
        results['Baseline (Always Wait)'] = {
            'ROC-AUC': np.nan,
            'Brier Score': np.nan,
            'Log-Loss': np.nan,
            'ECE': np.nan,
            **calculate_policy_simulation(val_full, np.full(len(val_full), 'WAIT'))
        }

    models = {
        'Model 1 (Current-Trip Only)': tier1,
        'Model 2 (+ Trailing History)': tier2,
        'Model 3 (+ Both History & Schedule)': tier3
    }

    for name, feat_df in models.items():
        # Clean feature matrix
        X_all = feat_df.set_index('observation_id')
        cat_cols = X_all.select_dtypes(include=['category', 'object']).columns.tolist()

        train_obs = target_data[train_mask]['observation_id']
        val_ver_obs = target_data[val_mask & (target_data['label_status'] == 'VERIFIED')]['observation_id']
        val_all_obs = target_data[val_mask]['observation_id']

        X_train = X_all.loc[train_obs].copy()
        y_train = target_data.loc[train_mask, label_col].values
        X_val_ver = X_all.loc[val_ver_obs].copy()
        y_val_ver = target_data.loc[val_mask & (target_data['label_status'] == 'VERIFIED'), label_col].values

        # Drop degenerate columns with < 2 unique non-null values in train set to prevent binning crashes
        valid_cols = [c for c in X_train.columns if X_train[c].nunique(dropna=True) >= 2]
        X_train = X_train[valid_cols]
        X_val_ver = X_val_ver[valid_cols]
        X_val_all = X_all.loc[val_all_obs][valid_cols]
        cat_cols = [c for c in cat_cols if c in valid_cols]

        clf = HistGradientBoostingClassifier(categorical_features=cat_cols, random_state=42)
        clf.fit(X_train, y_train)

        probs_ver = clf.predict_proba(X_val_ver)[:, 1]

        # 1. Supervised metrics on verified outcomes
        brier = brier_score_loss(y_val_ver, probs_ver)
        loss = log_loss(y_val_ver, probs_ver)
        try:
            auc = roc_auc_score(y_val_ver, probs_ver)
        except Exception:
            auc = np.nan

        # 2. Expected Calibration Error (ECE - 10 decile bins)
        bins = np.linspace(0, 1, 11)
        bin_idx = np.digitize(probs_ver, bins) - 1
        ece = 0.0
        for b in range(10):
            in_bin = bin_idx == b
            if np.sum(in_bin) > 0:
                bin_acc = np.mean(y_val_ver[in_bin])
                bin_conf = np.mean(probs_ver[in_bin])
                ece += (np.sum(in_bin) / len(y_val_ver)) * np.abs(bin_acc - bin_conf)

        # 3. Full Policy Simulation on ALL validation cases (including UNRESOLVED)
        probs_all = clf.predict_proba(X_val_all)[:, 1]
        model_actions = np.where(probs_all >= policy_threshold, 'WAIT', 'BUY_NOW')
        sim_metrics = calculate_policy_simulation(val_full, model_actions)

        results[name] = {
            'ROC-AUC': round(auc, 4),
            'Brier Score': round(brier, 4),
            'Log-Loss': round(loss, 4),
            'ECE': round(ece, 4),
            **sim_metrics
        }

    return results
