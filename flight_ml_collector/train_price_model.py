#!/usr/bin/env python3
"""
Example Machine Learning Script for Flight Price Trajectory Training.
Trains an XGBoost or Random Forest regressor to predict flight price given:
- airline
- route (source -> destination)
- days_left (lead time to departure: 1 to 49 days)
- stops
- departure_time
"""

import sys
from pathlib import Path

DATASET_PATH = Path(__file__).resolve().parent / "datasets" / "Clean_Dataset.csv"

def main():
    try:
        import pandas as pd
        import numpy as np
    except ImportError:
        print("To run ML training, install pandas & scikit-learn:")
        print("  pip install pandas scikit-learn")
        return

    print(f"📊 Loading dataset from {DATASET_PATH}...")
    df = pd.read_csv(DATASET_PATH, index_col=0)
    print(f"✅ Loaded {len(df):,} rows.")
    print("\nDataset Summary:")
    print(df.head())

    # Example: Average price as days_left counts down (The Price Trajectory)
    trajectory = df.groupby("days_left")["price"].mean()
    print("\nAverage Price vs Days Left (Sample Trajectory):")
    for d in [45, 30, 21, 14, 7, 3, 1]:
        if d in trajectory:
            print(f"  T-{d:2d} days: ₹{trajectory[d]:,.2f}")

if __name__ == "__main__":
    main()
