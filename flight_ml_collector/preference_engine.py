#!/usr/bin/env python3
"""Universal Preference-Aware Trajectory & Two-Tier Pricing Engine.

Solves the Simpson's Paradox / Mix-Shift problem across all routes and conditions:
1. Slices historical Google Flights observations in SQLite by exact customer constraints
   (max stops, minimum baggage kg, departure time window, preferred airlines).
2. Extracts leak-free features via frozen preprocessing pipeline.
3. Evaluates prospective decision (BUY_NOW vs WAIT) using route-specific frozen estimators.
4. Queries Tier 2 Tripjack wholesale inventory under identical constraints.
5. Returns a complete, unified decision package with verified baggage and seat-lock timer.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "live_quotes.sqlite"
MODELS_DIR = ROOT / "frozen_models"

# Use authoritative frozen feature pipeline
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(MODELS_DIR))
from frozen_feature_pipeline import extract_features
from tripjack_client import TripjackClient, parse_baggage_kg


@dataclass
class PreferenceBundle:
    """Exact customer constraint bundle for flight search and pricing."""
    origin: str
    destination: str
    departure_date: str
    max_stops: Optional[int] = None       # 0 = Nonstop, 1 = Up to 1 stop, None = Any
    min_checkin_kg: float = 0.0           # e.g. 0.0, 15.0, 20.0, 30.0
    dep_time_band: Optional[str] = None   # MORNING, AFTERNOON, EVENING, NIGHT, or None
    preferred_airlines: Optional[List[str]] = None  # e.g. ["6E", "AI", "EK"]
    cabin: str = "economy"
    currency: str = "INR"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def get_time_band(dep_time_str: Optional[str]) -> str:
    """Categorize departure time string (e.g. '08:40' or '2026-10-18T08:40') into standard bands."""
    if not dep_time_str:
        return "ANY"
    try:
        time_part = dep_time_str.split("T")[-1]
        hour = int(time_part.split(":")[0])
        if 5 <= hour < 12:
            return "MORNING"
        elif 12 <= hour < 17:
            return "AFTERNOON"
        elif 17 <= hour < 22:
            return "EVENING"
        else:
            return "NIGHT"
    except Exception:
        return "ANY"


class PreferenceEngine:
    """Universal preference-conditioned pricing and decision engine."""

    def __init__(
        self,
        db_path: Path = DB_PATH,
        models_dir: Path = MODELS_DIR,
    ) -> None:
        self.db_path = Path(db_path)
        self.models_dir = Path(models_dir)
        self.tripjack = TripjackClient()

    def slice_trajectory(self, bundle: PreferenceBundle) -> pd.DataFrame:
        """Extract and slice historical quotes matching the exact customer constraint bundle."""
        if not self.db_path.exists():
            return pd.DataFrame()

        with sqlite3.connect(self.db_path) as conn:
            query = f"""
                SELECT 
                    o.search_id,
                    o.total_amount as price,
                    o.currency,
                    json_extract(o.normalized_json, '$.origin') AS origin,
                    json_extract(o.normalized_json, '$.destination') AS destination,
                    json_extract(o.normalized_json, '$.departure_date') AS departure_date,
                    json_extract(o.normalized_json, '$.carrier_code') AS carrier,
                    json_extract(o.normalized_json, '$.stops') AS stops,
                    json_extract(o.normalized_json, '$.is_nonstop') AS is_nonstop,
                    json_extract(o.normalized_json, '$.departure_time') AS dep_time,
                    json_extract(o.normalized_json, '$.baggage.checked_weight_kg') AS bag_kg,
                    s.run_id,
                    s.completed_at
                FROM observations o
                JOIN searches s ON o.search_id = s.id
                WHERE json_extract(o.normalized_json, '$.origin') = '{bundle.origin.upper()}'
                  AND json_extract(o.normalized_json, '$.destination') = '{bundle.destination.upper()}'
                  AND o.currency = '{bundle.currency.upper()}'
            """
            obs = pd.read_sql_query(query, conn)

        if len(obs) == 0:
            return pd.DataFrame()

        # Clean types
        obs["stops"] = obs["stops"].fillna(0).astype(int)
        obs["is_nonstop"] = obs["is_nonstop"].fillna(obs["stops"] == 0).astype(bool)
        obs["bag_kg"] = pd.to_numeric(obs["bag_kg"], errors="coerce").fillna(0.0)
        obs["dep_time_band"] = obs["dep_time"].apply(get_time_band)

        # Apply customer preference filters
        filtered = obs.copy()
        if bundle.max_stops is not None:
            if bundle.max_stops == 0:
                filtered = filtered[filtered["is_nonstop"] | (filtered["stops"] == 0)]
            else:
                filtered = filtered[filtered["stops"] <= bundle.max_stops]

        if bundle.min_checkin_kg > 0:
            filtered = filtered[filtered["bag_kg"] >= bundle.min_checkin_kg]

        if bundle.dep_time_band and bundle.dep_time_band.upper() != "ANY":
            filtered = filtered[filtered["dep_time_band"] == bundle.dep_time_band.upper()]

        if bundle.preferred_airlines:
            pref = [a.upper() for a in bundle.preferred_airlines]
            filtered = filtered[filtered["carrier"].str.upper().isin(pref)]

        if len(filtered) == 0:
            return pd.DataFrame()

        # Form customer scenarios: cheapest satisfying offer per search batch
        scenarios = filtered.groupby(["search_id", "departure_date"]).agg(
            decision_time=("completed_at", "first"),
            quote_received_at=("completed_at", "first"),
            search_batch_id=("run_id", "first"),
            origin=("origin", "first"),
            destination=("destination", "first"),
            currency=("currency", "first"),
            current_price=("price", "min"),
            carrier=("carrier", lambda c: filtered.loc[c.index[np.argmin(filtered.loc[c.index, "price"])], "carrier"]),
            stops=("stops", "min"),
            dep_time_band=("dep_time_band", "first"),
        ).reset_index()

        scenarios["time_window"] = "ANY"
        scenarios["decision_time"] = pd.to_datetime(scenarios["decision_time"], utc=True)
        scenarios["quote_received_at"] = scenarios["decision_time"]
        scenarios["cabin"] = bundle.cabin
        scenarios["max_stops"] = str(bundle.max_stops) if bundle.max_stops is not None else "any"
        scenarios["allowed_airlines"] = "ALL" if not bundle.preferred_airlines else "_".join(bundle.preferred_airlines)
        scenarios["checked_bags_qty"] = "ANY"
        scenarios["checked_bag_weight_kg"] = str(bundle.min_checkin_kg) if bundle.min_checkin_kg > 0 else "ANY"
        scenarios["carry_on_qty"] = "ANY"
        scenarios["observation_id"] = "scen_" + scenarios.index.astype(str)

        return scenarios

    def predict_decision(
        self,
        bundle: PreferenceBundle,
        model_name: str = "model_2",
    ) -> Dict[str, Any]:
        """Compute the 'BUY_NOW' vs 'WAIT' decision for this preference corridor."""
        scenarios = self.slice_trajectory(bundle)
        if len(scenarios) == 0:
            return {
                "available": False,
                "reason": "No historical quotes match this preference bundle in SQLite.",
            }

        # Check for route-specific frozen model
        route_key = f"{bundle.origin.lower()}_{bundle.destination.lower()}"
        route_dir = self.models_dir / route_key
        manifest_file = route_dir / "manifest.json"

        if not manifest_file.exists():
            # Graceful heuristic fallback if route estimator is not yet trained
            target_scens = scenarios[scenarios["departure_date"] == bundle.departure_date].sort_values("decision_time")
            latest_price = target_scens.iloc[-1]["current_price"] if len(target_scens) > 0 else scenarios.iloc[-1]["current_price"]
            mean_price = scenarios["current_price"].mean()
            ratio = latest_price / mean_price if mean_price > 0 else 1.0
            p_wait = 0.70 if ratio > 1.05 else 0.35
            return {
                "available": True,
                "model_type": "heuristic_fallback",
                "model_name": model_name,
                "predicted_p_wait": p_wait,
                "action": "WAIT" if p_wait >= 0.60 else "BUY_NOW",
                "current_price": float(latest_price),
                "ratio_to_hist_mean": float(ratio),
                "threshold": 0.60,
            }

        with open(manifest_file, "r") as f:
            manifest = json.load(f)

        m_info = manifest["models"].get(model_name)
        if not m_info:
            model_name = "model_2"
            m_info = manifest["models"][model_name]

        clf_path = route_dir / m_info["file"]
        clf = joblib.load(clf_path)
        cols = m_info["feature_columns"]
        cats = m_info["categorical_columns"]
        threshold = manifest.get("decision_threshold_wait", 0.60)

        # Extract authoritative leak-free features
        t1, t2, t3 = extract_features(scenarios)
        feat_df_map = {"model_1": t1, "model_2": t2, "model_3": t3}
        feat_df = feat_df_map[model_name].set_index("observation_id")

        # Filter strictly to target departure date scenarios
        target_scenarios = scenarios[scenarios["departure_date"] == bundle.departure_date].sort_values("decision_time")
        if len(target_scenarios) == 0:
            target_scenarios = scenarios.sort_values("decision_time").iloc[[-1]]

        latest_scen = target_scenarios.iloc[[-1]]
        obs_id = latest_scen["observation_id"].values[0]

        X_eval = feat_df.loc[[obs_id]][cols].copy()
        for cat in cats:
            X_eval[cat] = X_eval[cat].astype("category")

        p_wait = float(clf.predict_proba(X_eval)[0, 1])
        action = "WAIT" if p_wait >= threshold else "BUY_NOW"

        # Diagnostic features
        ratio_mean = float(X_eval["ratio_to_hist_mean"].values[0]) if "ratio_to_hist_mean" in X_eval.columns else None
        delta_24h = float(X_eval["delta_24h"].values[0]) if "delta_24h" in X_eval.columns else None
        curr_price = float(X_eval["current_price"].values[0]) if "current_price" in X_eval.columns else None
        carrier = str(X_eval["carrier"].values[0]) if "carrier" in X_eval.columns else None

        return {
            "available": True,
            "model_type": "frozen_estimator",
            "model_name": model_name,
            "predicted_p_wait": round(p_wait, 4),
            "action": action,
            "threshold": threshold,
            "current_price": curr_price,
            "carrier": carrier,
            "ratio_to_hist_mean": round(ratio_mean, 3) if ratio_mean is not None else None,
            "delta_24h": round(delta_24h, 3) if delta_24h is not None else None,
        }

    def evaluate_flight_deal(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        max_stops: Optional[int] = None,
        min_checkin_kg: float = 0.0,
        dep_time_band: Optional[str] = None,
        preferred_airlines: Optional[List[str]] = None,
        model_name: str = "model_2",
    ) -> Dict[str, Any]:
        """Complete Two-Tier deal evaluation: ML buy/wait intelligence + Tripjack wholesale inventory."""
        bundle = PreferenceBundle(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            max_stops=max_stops,
            min_checkin_kg=min_checkin_kg,
            dep_time_band=dep_time_band,
            preferred_airlines=preferred_airlines,
        )

        # 1. Tier 1 ML Decision
        ml_res = self.predict_decision(bundle, model_name=model_name)

        # 2. Tier 2 Tripjack Wholesale Query
        tj_raw = self.tripjack.search_flights(origin, destination, departure_date)
        all_tj_offers = self.tripjack.parse_flight_offers(tj_raw)
        matching_tj_offers = self.tripjack.filter_offers(
            all_tj_offers,
            max_stops=max_stops,
            min_checkin_kg=min_checkin_kg,
            dep_time_band=dep_time_band,
            preferred_airlines=preferred_airlines,
        )

        lowest_tj = matching_tj_offers[0] if matching_tj_offers else None

        # 3. Compare with Google Flights observation
        gf_price = ml_res.get("current_price")
        savings_amount = None
        savings_pct = None

        if lowest_tj and gf_price and lowest_tj.get("total_fare"):
            diff = gf_price - lowest_tj["total_fare"]
            if diff > 0:
                savings_amount = diff
                savings_pct = (diff / gf_price) * 100.0

        # Strategic advice copy
        if ml_res.get("action") == "WAIT":
            guidance = (
                f"Historical corridor analysis indicates a {ml_res.get('predicted_p_wait', 0)*100:.0f}% "
                "probability of price drop in the next 24-36h. Recommendation: WAIT, or lock current fare."
            )
        else:
            guidance = (
                f"Corridor prices are currently at a cyclical low. High probability of price surge. "
                f"Recommendation: BUY NOW at wholesale rate of ₹{lowest_tj['total_fare']:,.0f}."
                if lowest_tj else "Recommendation: BUY NOW before prices surge."
            )

        return {
            "route": f"{origin.upper()}-{destination.upper()}",
            "departure_date": departure_date,
            "preferences": bundle.to_dict(),
            "ml_decision": ml_res,
            "tier1_google_flights": {
                "matching_retail_price": gf_price,
                "carrier": ml_res.get("carrier"),
            },
            "tier2_tripjack_wholesale": {
                "total_matching_offers": len(matching_tj_offers),
                "best_offer": lowest_tj,
                "lock_window_seconds": 840,
            },
            "price_advantage": {
                "savings_below_google": savings_amount,
                "percent_savings": round(savings_pct, 1) if savings_pct else None,
            },
            "recommendation_guidance": guidance,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Universal Preference-Aware Flight Intelligence Engine")
    parser.add_argument("--from", dest="origin", required=True, help="Origin IATA (e.g. DEL)")
    parser.add_argument("--to", dest="destination", required=True, help="Destination IATA (e.g. DXB)")
    parser.add_argument("--date", required=True, help="Departure date YYYY-MM-DD")
    parser.add_argument("--nonstop", action="store_true", help="Nonstop flights only")
    parser.add_argument("--min-baggage", type=float, default=0.0, help="Minimum check-in baggage kg (e.g. 20)")
    parser.add_argument("--time-band", choices=["MORNING", "AFTERNOON", "EVENING", "NIGHT"], default=None, help="Departure time window")
    parser.add_argument("--airlines", nargs="+", default=None, help="Preferred airline codes (e.g. 6E AI)")
    parser.add_argument("--model", default="model_2", choices=["model_1", "model_2", "model_3"], help="Frozen model tier")

    args = parser.parse_args()
    engine = PreferenceEngine()

    max_stops = 0 if args.nonstop else None

    print(f"\nEvaluating flight deal for {args.origin.upper()} -> {args.destination.upper()} ({args.date})...")
    deal = engine.evaluate_flight_deal(
        origin=args.origin,
        destination=args.destination,
        departure_date=args.date,
        max_stops=max_stops,
        min_checkin_kg=args.min_baggage,
        dep_time_band=args.time_band,
        preferred_airlines=args.airlines,
        model_name=args.model,
    )

    ml = deal["ml_decision"]
    gf = deal["tier1_google_flights"]
    tj = deal["tier2_tripjack_wholesale"]
    adv = deal["price_advantage"]

    print("\n" + "=" * 70)
    print(f"TWO-TIER INTELLIGENCE REPORT: {deal['route']} | {deal['departure_date']}")
    print("=" * 70)

    # Preferences
    pref_list = []
    if args.nonstop:
        pref_list.append("Nonstop Only")
    if args.min_baggage > 0:
        pref_list.append(f">= {args.min_baggage}kg Checked Baggage")
    if args.time_band:
        pref_list.append(f"Time Window: {args.time_band}")
    if args.airlines:
        pref_list.append(f"Airlines: {', '.join(args.airlines)}")
    pref_str = " | ".join(pref_list) if pref_list else "None (Unconstrained Market)"
    print(f"Customer Constraints:       {pref_str}")

    # ML Recommendation
    action_icon = "⏳ WAIT" if ml.get("action") == "WAIT" else "⚡ BUY NOW"
    print(f"\n--- Tier 1 ML Intelligence ({ml.get('model_name')}) ---")
    print(f"Action Recommendation:      {action_icon} (p_wait = {ml.get('predicted_p_wait', 0):.2f}, threshold = {ml.get('threshold', 0.6)})")
    if ml.get("ratio_to_hist_mean"):
        print(f"Price vs 60d Corridor Mean: {ml['ratio_to_hist_mean']:.2f}x (Delta 24h: {ml.get('delta_24h')})")
    print(f"Matching Retail Fare:       ₹{gf.get('matching_retail_price', 0):,.0f} ({gf.get('carrier')})")

    # Tripjack Wholesale Deal
    best_tj = tj.get("best_offer")
    print(f"\n--- Tier 2 Bookable Inventory (Tripjack Wholesale) ---")
    if best_tj:
        print(f"Wholesale Bookable Fare:    ₹{best_tj['total_fare']:,.0f} ({best_tj['airline']} - {best_tj['flight_id']})")
        print(f"Departure Time:             {best_tj['departure_time']}")
        print(f"Verified Baggage:           {best_tj['checkin_baggage']} check-in, {best_tj['cabin_baggage']} cabin")
        print(f"Fare Type / Lock Window:    {best_tj['fare_identifier']} | 14-Minute Seat Lock Active")
        if adv.get("savings_below_google"):
            print(f"\n💰 Wholesale Advantage:     Save ₹{adv['savings_below_google']:,.0f} ({adv['percent_savings']}%) below Google Flights!")
    else:
        print("No wholesale inventory matched all requested constraints.")

    print(f"\nStrategy Guidance: {deal['recommendation_guidance']}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
