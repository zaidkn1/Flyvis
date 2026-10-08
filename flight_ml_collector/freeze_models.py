#!/usr/bin/env python3
"""
==============================================================================
FREEZE TRAINED ML BENCHMARK MODELS, METADATA & TRAINING CUTOFFS
==============================================================================
Locks the fitted estimators, feature definitions, decision thresholds, and
training cutoffs from the historical 9-day sample into frozen artifacts.

Guarantees:
- Prospective cohorts (e.g. 'fixed-dates-12h') are NEVER used to fit or retrain.
- Pure inference evaluation without data leakage or threshold adaptation.
- Full serialisation of Model 1, Model 2, Model 3 for DEL-DXB and BOM-LHR.
"""

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier

from feature_pipeline import extract_features
from run_cohort_benchmark import load_customer_cohort, CustomerProfile

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "live_quotes.sqlite"
MODELS_DIR = ROOT / "frozen_models"


def freeze_route_models(origin: str, destination: str):
    route_name = f"{origin.lower()}_{destination.lower()}"
    target_dir = MODELS_DIR / route_name
    target_dir.mkdir(parents=True, exist_ok=True)

    profile = CustomerProfile(
        name=f"{origin}->{destination} | Flexible Airline (Up to 1 Stop)",
        origin=origin,
        destination=destination,
        currency="INR",
        max_stops=1,
        allowed_airlines="ALL",
        dep_time_band="ANY"
    )

    print(f"\n=======================================================")
    print(f"FREEZING MODELS FOR {origin}->{destination}")
    print(f"=======================================================")

    matched, stats = load_customer_cohort(DB_PATH, profile)
    tier1, tier2, tier3 = extract_features(matched)

    # Historical split point used in benchmark (75th percentile)
    val_start = matched['decision_time'].quantile(0.75)
    train_mask = (matched['label_available_at'] <= val_start) & (matched['label_status'] == 'VERIFIED')
    val_mask = matched['decision_time'] >= val_start

    print(f"Historical span: {stats['min_date']} to {stats['max_date']}")
    print(f"Training cutoff (val_start UTC): {val_start.isoformat()}")
    print(f"Verified training instances: {int(train_mask.sum())}")
    print(f"Validation instances: {int(val_mask.sum())}")

    models_data = {
        'model_1': (tier1, 'Model 1 (Current-Trip Only)'),
        'model_2': (tier2, 'Model 2 (+ Trailing History)'),
        'model_3': (tier3, 'Model 3 (+ History & Schedule Context)')
    }

    manifest = {
        'route': f"{origin}->{destination}",
        'customer_profile': {
            'origin': origin,
            'destination': destination,
            'cabin': 'economy',
            'currency': 'INR',
            'max_stops': 1,
            'allowed_airlines': 'ALL',
            'baggage_constraint': 'ANY'
        },
        'training_cutoff_utc': val_start.isoformat(),
        'n_train_verified': int(train_mask.sum()),
        'n_val_cases': int(val_mask.sum()),
        'decision_threshold_wait': 0.60,
        'random_state': 42,
        'models': {}
    }

    target_data = matched[['observation_id', 'label_wait']].copy()
    y_train = target_data.loc[train_mask, 'label_wait'].values

    for m_key, (feat_df, m_label) in models_data.items():
        X_all = feat_df.set_index('observation_id')
        cat_cols = X_all.select_dtypes(include=['category', 'object']).columns.tolist()

        train_obs = target_data.loc[train_mask, 'observation_id']
        X_train = X_all.loc[train_obs].copy()

        # Drop degenerate columns with < 2 unique non-null values
        valid_cols = [c for c in X_train.columns if X_train[c].nunique(dropna=True) >= 2]
        X_train = X_train[valid_cols]
        cat_cols = [c for c in cat_cols if c in valid_cols]

        clf = HistGradientBoostingClassifier(categorical_features=cat_cols, random_state=42)
        clf.fit(X_train, y_train)

        # Save model artifact
        model_file = target_dir / f"{m_key}.joblib"
        joblib.dump(clf, model_file)

        manifest['models'][m_key] = {
            'label': m_label,
            'file': model_file.name,
            'feature_columns': valid_cols,
            'categorical_columns': cat_cols,
            'n_features': len(valid_cols)
        }
        print(f"Saved {m_label} -> {model_file} ({len(valid_cols)} features)")

    manifest_file = target_dir / "manifest.json"
    with open(manifest_file, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest written to {manifest_file}")


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    freeze_route_models("DEL", "DXB")
    freeze_route_models("BOM", "LHR")
    print("\n✅ All models, feature schemas, and training cutoffs successfully frozen.\n")


if __name__ == '__main__':
    main()
