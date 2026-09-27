#!/usr/bin/env python3
"""
==============================================================================
FLIGHT PRICE TRAJECTORY & "BUY OR WAIT" DECISION DATASET BUILDER
==============================================================================
Processes flight datasets that contain BOTH `searchDate` and `flightDate` 
(such as Kaggle's `itineraries-min-100k.csv`).

Transforms raw flight observations into a Markov Decision Process (MDP) / 
Optimal Stopping training set:
- State: (origin, destination, airline, days_to_departure, current_price, price_history)
- Action: BUY vs WAIT
- Label: Did the price drop further before departure? (1 = YES WAIT, 0 = NO BUY NOW)
- Reward: Money saved vs money lost by waiting
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "datasets"
INPUT_CSV = DATASET_DIR / "itineraries-min-100k.csv"
OUTPUT_CSV = DATASET_DIR / "buy_or_wait_training_set.csv"


def process_trajectories():
    try:
        import pandas as pd
        import numpy as np
    except ImportError:
        print("Please install pandas to process trajectories:")
        print("  pip install pandas")
        return

    if not INPUT_CSV.exists():
        print(f"⚠️  Input file not found at: {INPUT_CSV}")
        print("\nTo get this dataset:")
        print("1. Visit: https://www.kaggle.com/datasets/dilwong/flightprices")
        print("2. In the Data Explorer on the right, click 'itineraries-min-100k.csv' (~38 MB)")
        print(f"3. Download and place it at: {INPUT_CSV}")
        return

    print(f"📊 Loading {INPUT_CSV}...")
    df = pd.read_csv(INPUT_CSV)
    print(f"✅ Loaded {len(df):,} raw flight records.")

    # 1. Parse dates and calculate lead days
    print("⏳ Parsing searchDate and flightDate...")
    df["searchDate"] = pd.to_datetime(df["searchDate"])
    df["flightDate"] = pd.to_datetime(df["flightDate"])
    df["lead_days"] = (df["flightDate"] - df["searchDate"]).dt.days

    # Filter invalid dates
    df = df[df["lead_days"] >= 0].copy()

    # 2. Group by exact flight instance
    # A flight instance is defined by startingAirport, destinationAirport, flightDate, and legId
    print("🔗 Grouping price trajectories by exact flight instance...")
    flight_key = ["startingAirport", "destinationAirport", "flightDate", "legId"]
    
    # Sort chronologically by search date
    df = df.sort_values(by=flight_key + ["searchDate"])

    # 3. Calculate future price dynamics
    # Minimum price from this searchDate onwards until departure
    df["min_future_price"] = df.groupby(flight_key)["totalFare"].transform(
        lambda s: s.iloc[::-1].cummin().iloc[::-1]
    )
    
    # Final price before departure (last observed price)
    df["final_price"] = df.groupby(flight_key)["totalFare"].transform("last")

    # Decision Label: Should you BUY or WAIT?
    # If the price drops by more than $5 in any future searchDate before departure -> WAIT (1), else BUY (0)
    df["price_drop_potential"] = df["totalFare"] - df["min_future_price"]
    df["optimal_decision"] = np.where(df["price_drop_potential"] > 5.0, "WAIT", "BUY_NOW")
    df["label_wait"] = (df["price_drop_potential"] > 5.0).astype(int)

    # Clean subset of features for ML training
    feature_cols = [
        "searchDate",
        "flightDate",
        "startingAirport",
        "destinationAirport",
        "lead_days",
        "totalFare",
        "min_future_price",
        "price_drop_potential",
        "optimal_decision",
        "label_wait",
        "isNonStop",
        "isBasicEconomy",
        "isRefundable"
    ]
    existing_cols = [c for c in feature_cols if c in df.columns]
    training_df = df[existing_cols].copy()

    training_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n🎉 Successfully created Decision Training Set at: {OUTPUT_CSV}")
    print(f"Total Trajectory Samples: {len(training_df):,}")
    print("\nDecision Distribution:")
    print(training_df["optimal_decision"].value_counts(normalize=True).round(3))
    print("\nSample Rows:")
    print(training_df.head(5))


if __name__ == "__main__":
    process_trajectories()
