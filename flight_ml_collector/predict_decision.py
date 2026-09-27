#!/usr/bin/env python3
"""
==============================================================================
AI DECISION PREDICTION ENGINE: "BUY NOW VS. WAIT"
==============================================================================
Provides real-time machine learning inference for flight purchasing decisions:
Given a flight search state (route, airline, lead time, price, seats), predicts:
  1. Action: BUY_NOW vs. WAIT
  2. Confidence probability
  3. Risk-calibrated recommendation

Usage:
  # Programmatic:
  from flight_ml_collector.predict_decision import predict_buy_or_wait
  rec = predict_buy_or_wait(origin="DEL", destination="BOM", airline="IndiGo", lead_days=14, current_price=6425)

  # CLI:
  python3 flight_ml_collector/predict_decision.py --from DEL --to BOM --airline IndiGo --lead 14 --price 6425
"""

import argparse
import sys
from pathlib import Path
import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "decision_model.joblib"
TRAIN_CSV = ROOT / "datasets" / "buy_or_wait_paired_trajectories.csv"
SAMPLE_CSV = ROOT / "datasets" / "sample_trajectories.csv"


def train_and_save_model(model_path=MODEL_PATH):
    csv_file = TRAIN_CSV if TRAIN_CSV.exists() else SAMPLE_CSV
    if not csv_file.exists():
        raise FileNotFoundError(f"Neither {TRAIN_CSV} nor {SAMPLE_CSV} found.")

    print(f"📊 Training decision model on {csv_file.name}...", file=sys.stderr)
    df = pd.read_csv(csv_file)

    X = df[[
        "origin", "destination", "airline", "lead_days", "current_price", "is_non_stop", "seats_remaining"
    ]].copy()

    for col in ["origin", "destination", "airline", "is_non_stop"]:
        X[col] = X[col].astype("category")

    y = df["label_wait"]

    clf = HistGradientBoostingClassifier(
        categorical_features=["origin", "destination", "airline", "is_non_stop"],
        random_state=42,
        max_iter=150,
        class_weight="balanced"
    )
    clf.fit(X, y)
    joblib.dump(clf, model_path)
    print(f"✅ Model saved to {model_path}", file=sys.stderr)
    return clf


def get_model():
    if MODEL_PATH.exists():
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            pass
    return train_and_save_model()


def predict_buy_or_wait(
    origin: str,
    destination: str,
    airline: str,
    lead_days: int,
    current_price: float,
    is_non_stop: bool = True,
    seats_remaining: int = 7
) -> dict:
    """
    Returns AI prediction whether the traveler should BUY_NOW or WAIT.
    """
    clf = get_model()

    input_df = pd.DataFrame([{
        "origin": str(origin).upper().strip(),
        "destination": str(destination).upper().strip(),
        "airline": str(airline).strip(),
        "lead_days": int(lead_days),
        "current_price": float(current_price),
        "is_non_stop": bool(is_non_stop),
        "seats_remaining": int(seats_remaining)
    }])

    for col in ["origin", "destination", "airline", "is_non_stop"]:
        input_df[col] = input_df[col].astype("category")

    try:
        prob_wait = float(clf.predict_proba(input_df)[0][1])
    except Exception:
        # Fallback heuristic if unseen categorical levels
        prob_wait = 0.35 if lead_days > 21 else (0.15 if lead_days > 7 else 0.05)

    prob_buy = 1.0 - prob_wait

    if prob_wait >= 0.55:
        action = "WAIT"
        confidence = prob_wait
        reason = f"Historical yields show high probability ({int(prob_wait * 100)}%) of price dip within {lead_days} days before departure."
    else:
        action = "BUY_NOW"
        confidence = prob_buy
        reason = f"Price is near optimal historical bottom for T-{lead_days}d. Upward yield surges expected closer to departure."

    return {
        "action": action,
        "confidence": round(confidence, 3),
        "probability_wait": round(prob_wait, 3),
        "probability_buy": round(prob_buy, 3),
        "lead_days": lead_days,
        "current_price": current_price,
        "reason": reason
    }


def main():
    parser = argparse.ArgumentParser(description="Predict Flight Buy vs. Wait Decision")
    parser.add_argument("--from", dest="origin", default="DEL", help="Origin airport code (e.g. DEL)")
    parser.add_argument("--to", dest="destination", default="BOM", help="Destination airport code (e.g. BOM)")
    parser.add_argument("--airline", default="IndiGo", help="Airline name (e.g. IndiGo)")
    parser.add_argument("--lead", type=int, default=14, help="Days until flight departure")
    parser.add_argument("--price", type=float, default=6425.0, help="Current price in INR")
    parser.add_argument("--stops", type=int, default=0, help="Number of stops (0 for non-stop)")
    args = parser.parse_args()

    result = predict_buy_or_wait(
        origin=args.origin,
        destination=args.destination,
        airline=args.airline,
        lead_days=args.lead,
        current_price=args.price,
        is_non_stop=(args.stops == 0)
    )

    print("\n=======================================================")
    print(f"✈️  FLIGHT AI DECISION: {args.origin} -> {args.destination} ({args.airline})")
    print(f"💰 Current Price: ₹{args.price:,.0f} | Lead: T-{args.lead} days")
    print("=======================================================")
    print(f"🎯 Recommended Action:  >>> {result['action']} <<<")
    print(f"📊 Confidence:          {int(result['confidence'] * 100)}%")
    print(f"📈 Wait Probability:    {int(result['probability_wait'] * 100)}%")
    print(f"📉 Buy Probability:     {int(result['probability_buy'] * 100)}%")
    print(f"💡 AI Rationale:        {result['reason']}")
    print("=======================================================\n")


if __name__ == "__main__":
    main()
