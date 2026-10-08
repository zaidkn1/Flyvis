# ✈️ Flyvis — Two-Tier Flight Intelligence & Autonomous Booking Platform

A high-performance flight booking and market intelligence platform combining **continuous consumer market trajectory tracking**, **machine-learned buy-vs-wait decision models**, and **autonomous B2B wholesale execution** with customer-first price protection.

---

## 🌟 Overview

Traditional flight booking platforms force users to choose between paying retail immediately or gambling on volatile future price swings. 

**Flyvis** solves this with a **Two-Tier Architecture**:
1. **Tier 1: Free Market Trajectory Monitoring**: Continuously tracks retail flight trajectories via Google Flights without consuming commercial API quotas, feeding a prospective machine learning decision engine.
2. **Tier 2: Authorized Wholesale Execution**: Executes autonomous B2B wholesale bookings via Tripjack (GDS / LCC gateway) under strict customer constraints, passing wholesale discounts back as cash refunds.
3. **🛡️ Flyvis Price Guarantee**: Absorbs small discrete price surges (up to ₹1,000) from a dedicated company margin reserve pool to guarantee seamless fulfillment without unexpected top-up requests.

---

## 🏗️ System Architecture

```text
                                  ┌───────────────────────────┐
                                  │      User Preference      │
                                  │  (Nonstop, 20kg, Morning) │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: CONTINUOUS MARKET INTELLIGENCE (Zero-Cost Scrape)                               │
│                                                                                         │
│  Google Flights Scraper ──► SQLite Observation Lake (800k+ Quotes)                      │
│                                       │                                                 │
│                                       ▼                                                 │
│                          Frozen ML Decision Engine                                      │
│                [Model 1: Trip-Only | Model 2: History | Model 3: Schedule Context]      │
│                                       │                                                 │
│                      Action Policy: BUY_NOW vs WAIT                                     │
└───────────────────────────────────────┬─────────────────────────────────────────────────┘
                                        │ (When Buy Triggered & User Authorizes)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: AUTONOMOUS WHOLESALE EXECUTION (Tripjack B2B Gateway)                           │
│                                                                                         │
│  1. Search & Filter        2. Live Review & Hold         3. OMS Autonomous Booking      │
│  (/fms/v1/air-search-all)   (/fms/v1/review)              (/oms/v1/air/book)            │
│  • Strict Pax Summation    • Revalidates True Rupee Total • Re-verifies E-Ticket No.   │
│  • Carrier Code Match      • Re-checks All Segments       • Never Assumes on PNR Alone  │
│  • Baggage Validation      • API Session TTL Tracking     • Pre-retry Reconciliation    │
│                                                                                         │
│  4. Settlement & Profit Refund:                                                         │
│     • Customer Cap: ₹10,000 | Booked Wholesale: ₹8,800 ──► Cash Refund: ₹1,200          │
│     • Surged to:    ₹10,750 ──► 🛡️ Absorbed by Flyvis Margin Pool (₹0 Extra to User)     │
│     • Catastrophic: ₹13,000 ──► Instant 100% Full Refund Back to Customer              │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
visa/
├── index.html                   # Main landing page & flight search wizard
├── flight-fares.html            # Interactive price trajectory & forecasting UI
├── dummy-ticket.html            # Verified flight reservation & itinerary generator
├── my-flights.html              # Customer booking management & refund tracking
├── admin-flight-bookings.html   # Operations portal for order reconciliation & PNRs
├── admin-flight-booking-detail.html
├── visas.html                   # Country visa guides & eligibility calculator
├── server.py                    # Local application server
│
├── css/                         # UI Themes & animations
│   ├── flight_wizard.css        # Flight booking wizard styles
│   ├── shadcn_theme.css         # Modern chart & component theme
│   └── style.css
│
├── js/                          # Frontend controllers
│   ├── flight_wizard.js         # Interactive step-by-step booking flow
│   ├── otter_mascot.js          # Otto the Otter interactive UI mascot
│   └── admin_flight_bookings.js # Admin order fulfillment script
│
└── flight_ml_collector/         # Flight ML & Autonomous Execution Engine
    ├── live_quotes.sqlite       # Local high-resolution observation lake (825k+ quotes)
    ├── collect_fixed_dates.py   # Background daemon running 12-hour automated sweeps
    ├── preference_engine.py     # Constraint slicing (Stops, Baggage, Windows, Carriers)
    ├── tripjack_client.py       # Tripjack B2B API client (Search, Review, Rules, OMS)
    ├── smart_booking_executor.py# Autonomous state machine, guarantee pool & refunds
    ├── evaluate_prospective_cohort.py # 24h prospective prediction validation benchmark
    ├── run_cohort_benchmark.py  # 3-model benchmark across penalty spectrums
    ├── monitor_health.py        # Real-time daemon health inspector
    ├── frozen_models/           # Route-specific frozen ML estimators (pure inference)
    └── tests/                   # 38 unit tests covering all edge cases
        ├── test_tripjack_client.py
        ├── test_smart_booking_executor.py
        ├── test_preference_engine.py
        ├── test_feature_pipeline.py
        └── test_shadow_replay.py
```

---

## 🤖 Machine Learning Decision Engine

Flyvis trains and evaluates **3 tiered estimators** to forecast whether waiting 24–48 hours will yield a lower price:

* **Model 1 (Current-Trip Only)**: Baseline model utilizing lead days, current fare, and intra-trip offer dispersion.
* **Model 2 (+ Trailing History)**: Introduces historical 60-day corridor baseline, rolling price momentum, and ratio to historical mean.
* **Model 3 (+ Schedule & Full Context)**: Incorporates seasonal calendar context, day-of-week patterns, departure time windowing, and seat inventory depletion curves.

### 111-Hour Live Prospective Pilot Results
Benchmarked continuously over 10 automated sweeps (110.9h elapsed, 414 verified 24h outcomes):
* **Model 3 achieved superior calibration**: Brier score of **`0.3002`** (lowest error) and ROC-AUC of **`0.6131`** on genuine prospective market windows.
* **Risk Shield**: On high-demand routes like `DEL-DXB`, prices rose or stayed flat **70% of the time** with surges up to **+₹8,211**. The model's policy ($p_{\text{wait}} \ge 0.60$) decisively locked in cyclical lows, shielding customers from catastrophic price surges.

---

## 🛡️ Autonomous Execution & Flyvis Price Guarantee

Built into [`smart_booking_executor.py`](./flight_ml_collector/smart_booking_executor.py):

| Scenario | Market Fare | Customer Cost | System Behavior | Outcome |
| :--- | :---: | :---: | :--- | :--- |
| **1. Fare Drops / Stays Low** | **₹8,800** *(Paid ₹10,000)* | ₹0 extra | Books wholesale via OMS.<br>Dispatches cash refund via payment gateway. | 🏆 **Ticket + ₹1,200 Savings Refund** |
| **2. Small Price Surge** *(Up to +₹1,000)* | **₹10,750** *(Paid ₹10,000)* | ₹0 extra | 🛡️ **Flyvis Price Guarantee triggers!**<br>Absorbs ₹750 shortfall from Margin Reserve Pool. | 🛡️ **Confirmed Ticket Issued** *(Zero top-up friction)* |
| **3. Catastrophic Surge / Sold Out** | **₹12,500** *(Exceeds ₹11,000)* | ₹0 lost | Stops before loss.<br>Transitions to `SHORTFALL_EXCEPTION`. | 💸 **Instant 100% Full Refund** |

### Production Safeguards
1. **Strict Ticket Confirmation**: A PNR reservation alone **never** marks an order confirmed. The engine verifies actual carrier e-ticket numbers before notifying the user.
2. **Safe Timeout Reconciliation**: Network drops or gateway timeouts enter `PENDING_RECONCILIATION`. The system **never** refunds prematurely or retries blindly without provider verification.
3. **Reviewed Total Verification**: Always re-parses the live `/fms/v1/review` response to establish the authoritative rupee total, baggage alerts, and segment rules before purchase.
4. **Restart & Concurrency Immunity**: SQLite-backed atomic state transitions (`UPDATE ... WHERE order_id = ? AND state = ?`) prevent double-booking across concurrent workers.

---

## 🚀 Getting Started

### 1. Prerequisites
* Python 3.10+
* macOS / Linux

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/<your-username>/visa.git
cd visa

# Install dependencies (if running web scraper / ML pipeline)
pip install -r flight_ml_collector/requirements.txt # or requests, joblib, pandas, scikit-learn, python-dotenv

# Configure Tripjack API Key
cp flight_ml_collector/.env.example flight_ml_collector/.env
# Add TRIPJACK_API_KEY=your_key_here
```

### 3. Run the Test Suite
```bash
# Run all 38 automated unit tests
python3 -m unittest discover -s flight_ml_collector/tests -v
```

### 4. Launch Local Web Server
```bash
python3 server.py
# Open http://localhost:8000 in your browser
```

### 5. Inspect Daemon & Model Health
```bash
# View background collector status & sweep logs
python3 flight_ml_collector/monitor_health.py

# Evaluate 24-hour prospective prediction outcomes
python3 flight_ml_collector/evaluate_prospective_cohort.py
```

---

## 📜 License
Proprietary & Confidential. Developed for Flyvis.
