#!/usr/bin/env python3
"""
==============================================================================
FLIGHT TRAJECTORY MATCHER & TIME-SERIES ALIGNMENT ENGINE
==============================================================================
Defines the formal matching methodology for tracking comparable flight products
across multiple search dates and lead times.

Provides two levels of alignment:
1. Canonical Flight Matching (exact physical aircraft journey)
2. Route-Window / Intent-Bucket Matching (substitutable flights for a travel window)

Generates time-series trajectories (P_t -> P_{t-k}) and computes ground-truth
optimal decisions (BUY_NOW vs WAIT) for ML policy training.
"""

import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent


@dataclass
class FlightMatchingKey:
    """Represents the canonical identity of a flight observation."""
    canonical_flight_id: str
    route_window_id: str
    carrier_code: str
    flight_number: str
    origin: str
    destination: str
    departure_date: str
    departure_time: str
    arrival_time: str
    time_window: str
    stops: int
    stops_bucket: str


class TrajectoryMatcher:
    """Engine for defining and computing comparable flight trajectories."""

    @staticmethod
    def get_time_window(hour: int) -> str:
        if 0 <= hour < 6:
            return "EARLY_MORNING"
        elif 6 <= hour < 12:
            return "MORNING"
        elif 12 <= hour < 17:
            return "AFTERNOON"
        elif 17 <= hour < 22:
            return "EVENING"
        return "NIGHT"

    @classmethod
    def derive_keys_from_norm(cls, norm: dict) -> FlightMatchingKey:
        origin = norm.get("origin", "")
        dest = norm.get("destination", "")
        dep_date = norm.get("departure_date", "")
        carrier = norm.get("carrier_code", "UNKNOWN")
        stops = norm.get("stops", 0)
        stops_bucket = "NONSTOP" if stops == 0 else (f"{stops}_STOP" if stops == 1 else "2+_STOPS")

        dep_time = norm.get("departure_time") or "00:00"
        arr_time = norm.get("arrival_time") or "00:00"
        flight_number = norm.get("flight_number")

        # Parse from segments if not directly provided
        if not flight_number or dep_time == "00:00":
            segments = norm.get("segments", [])
            fns = []
            if segments:
                for seg in segments:
                    fn = seg.get("flight_number") or carrier
                    fns.append(fn)
                if not dep_time or dep_time == "00:00":
                    dep_str = segments[0].get("departure", "")
                    m = re.search(r"time=\((\d+),\s*(\d+)\)", dep_str)
                    if m:
                        dep_time = f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"
                if not arr_time or arr_time == "00:00":
                    arr_str = segments[-1].get("arrival", "")
                    m = re.search(r"time=\((\d+),\s*(\d+)\)", arr_str)
                    if m:
                        arr_time = f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"
            flight_number = "/".join(fns) if fns else carrier

        hour = int(dep_time.split(":")[0]) if ":" in dep_time else 0
        time_window = cls.get_time_window(hour)
        dep_clean = dep_time.replace(":", "")

        # 1. Canonical Flight ID (Exact physical flight)
        canonical_flight_id = f"{flight_number}:{origin}->{dest}:{dep_date}:{dep_clean}:{stops}"

        # 2. Route Window ID (Market intent bucket)
        route_window_id = f"{origin}->{dest}:{dep_date}:{time_window}:{stops_bucket}:ECONOMY"

        return FlightMatchingKey(
            canonical_flight_id=canonical_flight_id,
            route_window_id=route_window_id,
            carrier_code=carrier,
            flight_number=flight_number,
            origin=origin,
            destination=dest,
            departure_date=dep_date,
            departure_time=dep_time,
            arrival_time=arr_time,
            time_window=time_window,
            stops=stops,
            stops_bucket=stops_bucket,
        )

    @staticmethod
    def create_sqlite_views(db_path: Path):
        """Creates time-series trajectory views in SQLite."""
        conn = sqlite3.connect(db_path)
        conn.executescript(
            """
            DROP VIEW IF EXISTS v_canonical_flight_trajectories;
            DROP VIEW IF EXISTS v_market_window_trajectories;
            DROP VIEW IF EXISTS v_flight_observations;

            -- View of normalized flight observations with extracted matching keys
            CREATE VIEW v_flight_observations AS
            SELECT 
                o.search_id,
                o.offer_id,
                o.observed_at,
                o.total_amount AS price,
                o.currency,
                json_extract(o.normalized_json, '$.canonical_flight_id') AS canonical_flight_id,
                json_extract(o.normalized_json, '$.route_window_id') AS route_window_id,
                json_extract(o.normalized_json, '$.flight_number') AS flight_number,
                json_extract(o.normalized_json, '$.carrier_code') AS carrier_code,
                json_extract(o.normalized_json, '$.carrier_name') AS carrier_name,
                json_extract(o.normalized_json, '$.origin') AS origin,
                json_extract(o.normalized_json, '$.destination') AS destination,
                json_extract(o.normalized_json, '$.departure_date') AS departure_date,
                json_extract(o.normalized_json, '$.departure_time') AS departure_time,
                json_extract(o.normalized_json, '$.lead_days') AS lead_days,
                json_extract(o.normalized_json, '$.stops') AS stops,
                json_extract(o.normalized_json, '$.time_window') AS time_window,
                json_extract(o.normalized_json, '$.baggage.corridor') AS baggage_corridor,
                json_extract(o.normalized_json, '$.baggage.carry_on_included') AS carry_on_included,
                json_extract(o.normalized_json, '$.baggage.carry_on_weight_kg') AS carry_on_weight_kg,
                json_extract(o.normalized_json, '$.baggage.checked_included') AS checked_included,
                json_extract(o.normalized_json, '$.baggage.checked_weight_kg') AS checked_weight_kg,
                json_extract(o.normalized_json, '$.baggage.checked_pieces') AS checked_pieces,
                json_extract(o.normalized_json, '$.baggage.policy_url') AS baggage_policy_url
            FROM observations o;

            -- Time-series price movement trajectory for canonical flights
            CREATE VIEW IF NOT EXISTS v_canonical_flight_trajectories AS
            WITH ordered AS (
                SELECT 
                    canonical_flight_id,
                    flight_number,
                    carrier_code,
                    origin,
                    destination,
                    departure_date,
                    lead_days,
                    observed_at,
                    price,
                    LAG(price) OVER (
                        PARTITION BY canonical_flight_id 
                        ORDER BY lead_days DESC
                    ) AS prior_lead_price,
                    LAG(lead_days) OVER (
                        PARTITION BY canonical_flight_id 
                        ORDER BY lead_days DESC
                    ) AS prior_lead_days,
                    MIN(price) OVER (
                        PARTITION BY canonical_flight_id 
                        ORDER BY lead_days ASC 
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS future_min_price
                FROM v_flight_observations
            )
            SELECT 
                canonical_flight_id,
                flight_number,
                carrier_code,
                origin,
                destination,
                departure_date,
                lead_days,
                price,
                prior_lead_price,
                prior_lead_days,
                (price - prior_lead_price) AS delta_p_from_prior,
                future_min_price,
                CASE 
                    WHEN future_min_price < price * 0.98 THEN 'WAIT'
                    ELSE 'BUY_NOW'
                END AS optimal_action
            FROM ordered;

            -- Route-Window Market-Clearing Trajectory (Cheapest flight in window over time)
            CREATE VIEW IF NOT EXISTS v_market_window_trajectories AS
            WITH window_summary AS (
                SELECT 
                    route_window_id,
                    origin,
                    destination,
                    departure_date,
                    lead_days,
                    MIN(price) AS min_window_price,
                    AVG(price) AS avg_window_price,
                    COUNT(*) AS flights_available
                FROM v_flight_observations
                GROUP BY route_window_id, origin, destination, departure_date, lead_days
            ),
            window_lagged AS (
                SELECT 
                    route_window_id,
                    origin,
                    destination,
                    departure_date,
                    lead_days,
                    min_window_price,
                    flights_available,
                    LAG(min_window_price) OVER (
                        PARTITION BY route_window_id 
                        ORDER BY lead_days DESC
                    ) AS prior_window_min_price,
                    MIN(min_window_price) OVER (
                        PARTITION BY route_window_id 
                        ORDER BY lead_days ASC 
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS future_min_window_price
                FROM window_summary
            )
            SELECT 
                route_window_id,
                origin,
                destination,
                departure_date,
                lead_days,
                min_window_price,
                flights_available,
                prior_window_min_price,
                (min_window_price - prior_window_min_price) AS delta_window_price,
                future_min_window_price,
                CASE 
                    WHEN future_min_window_price < min_window_price * 0.98 THEN 'WAIT'
                    ELSE 'BUY_NOW'
                END AS optimal_action
            FROM window_lagged;
            """
        )
        conn.commit()
        conn.close()

    @classmethod
    def get_trajectory_summary(cls, db_path: Path) -> dict:
        cls.create_sqlite_views(db_path)
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        c.execute("SELECT COUNT(DISTINCT canonical_flight_id) FROM v_flight_observations")
        total_unique_flights = c.fetchone()[0]

        c.execute("SELECT COUNT(DISTINCT route_window_id) FROM v_flight_observations")
        total_route_windows = c.fetchone()[0]

        c.execute("""
            SELECT COUNT(*) 
            FROM (
                SELECT canonical_flight_id 
                FROM v_flight_observations 
                GROUP BY canonical_flight_id 
                HAVING COUNT(DISTINCT lead_days) > 1
            )
        """)
        multi_observation_trajectories = c.fetchone()[0]

        c.execute("""
            SELECT optimal_action, COUNT(*)
            FROM v_canonical_flight_trajectories
            WHERE prior_lead_price IS NOT NULL
            GROUP BY optimal_action
        """)
        action_distribution = dict(c.fetchall())

        conn.close()
        return {
            "total_unique_canonical_flights": total_unique_flights,
            "total_route_windows": total_route_windows,
            "multi_observation_trajectories": multi_observation_trajectories,
            "action_distribution": action_distribution,
        }


if __name__ == "__main__":
    db = ROOT / "live_quotes.sqlite"
    print("🔬 Computing Flight Trajectories & Matching Views...")
    summary = TrajectoryMatcher.get_trajectory_summary(db)
    print("\n📊 Trajectory Alignment Summary:")
    print(f"  • Unique Canonical Flights: {summary['total_unique_canonical_flights']:,}")
    print(f"  • Unique Route Windows:     {summary['total_route_windows']:,}")
    print(f"  • Multi-Lead Trajectories:  {summary['multi_observation_trajectories']:,}")
    print(f"  • Action Distribution:      {summary['action_distribution']}")
