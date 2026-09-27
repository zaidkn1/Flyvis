#!/usr/bin/env python3
"""
==============================================================================
TRAINS "BUY TODAY VS. WAIT" OPTIMAL DECISION MODEL
==============================================================================
Loads the 100,000 paired trajectory dataset from:
  flight_ml_collector/datasets/buy_or_wait_paired_trajectories.csv

Trains a Gradient Boosting / Random Forest model to predict:
  P(Price will drop in the future | route, airline, lead_days, current_price, seats)
"""

from pathlib import Path

TRAIN_CSV = Path(__file__).resolve().parent / "datasets" / "buy_or_wait_paired_trajectories.csv"


def main():
    try:
        import pandas as pd
        from sklearn.ensemble import HistGradientBoostingClassifier
        from sklearn.metrics import classification_report, roc_auc_score
        from sklearn.model_selection import train_test_split
    except ImportError:
        print("To run model training, install scikit-learn & pandas:")
        print("  pip install pandas scikit-learn")
        return

    print(f"📊 Loading Paired Trajectory Dataset from {TRAIN_CSV}...")
    df = pd.read_csv(TRAIN_CSV)
    print(f"✅ Loaded {len(df):,} samples.")

    # Features and Target
    X = df[[
        "origin",
        "destination",
        "airline",
        "lead_days",
        "current_price",
        "is_non_stop",
        "seats_remaining"
    ]].copy()

    # Convert categoricals
    for col in ["origin", "destination", "airline", "is_non_stop"]:
        X[col] = X[col].astype("category")

    y = df["label_wait"]

    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("\n🧠 Training HistGradientBoostingClassifier...")
    clf = HistGradientBoostingClassifier(categorical_features=["origin", "destination", "airline", "is_non_stop"], random_state=42)
    clf.fit(X_train, y_train)

    # Evaluate
    preds = clf.predict(X_test)
    probs = clf.predict_proba(X_test)[:, 1]

    print("\n🎯 Model Evaluation:")
    print(classification_report(y_test, preds, target_names=["BUY_NOW", "WAIT"]))
    try:
        print(f"ROC AUC Score: {roc_auc_score(y_test, probs):.4f}")
    except Exception:
        pass


if __name__ == "__main__":
    main()
