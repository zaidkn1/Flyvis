# 🛫 Flyvis 24-Hour Bounded Flight ML Price Collector & Cloud Sync

A production-grade, bounded 24-hour flight price observation worker and pilot engine built using the **Python Standard Library** (zero pip dependencies required).

It collects structured airline fare dynamics across target routes over fixed departure cohorts, streaming all observations into **Supabase PostgreSQL** while maintaining a local SQLite state.

---

## 📁 Project Architecture

The runner is structured in modular components matching the internal worker design:

```text
flight_ml_collector/
├── collection_pilot/
│   ├── collector.py           # Bounded search-only collector (init, plan, collect)
│   └── config.json            # Target routes, lead days, and call budgets
│
├── collection_worker/
│   ├── worker.py              # 24-Hour bounded worker (plan, run, status, sync)
│   ├── cloud.py               # Supabase REST sync & preflight adapter (std lib)
│   └── state/                 # Created on run: state.json, worker.lock, quotes.sqlite
│
├── supabase_schema.sql        # Supabase SQL DDL (runs, searches, observations, ML view)
└── README.md                  # This operating guide
```

---

## ⏱️ How the 24-Hour Worker Operates

1. **8 Scheduled Slots over 24 Hours:**
   The 24-hour campaign is divided into eight 3-hour slots (`slot = int((stamp - start_epoch) // 10800)`). Each slot dispatches a fresh collector batch against the fixed departure cohorts.
2. **Crash & Replay Immunity:**
   The worker locks `worker.lock` via `fcntl.flock(fcntl.LOCK_EX | fcntl.LOCK_NB)` to ensure only one runner executes per state directory. It commits slot budget before spawning the child process so a crash never replays an already executed slot.
3. **Persistent Deadline & Hard Expiry:**
   A hard 24-hour deadline (`deadline_epoch = start_epoch + 86400`) terminates any running batch if time expires.
4. **Immediate Post-Batch Cloud Sync:**
   After every batch completes, the worker immediately calls `sync(...)` to stream new rows from `quotes.sqlite` to Supabase over PostgREST.
5. **Clean Operator Stop:**
   To stop the campaign cleanly at any time, simply create a `STOP` file in the state directory (`touch state/STOP`). The worker immediately detects it, flushes pending rows to Supabase, updates status to `stopped_by_user`, and exits.

---

## 🗄️ Supabase Setup (1-Click)

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** -> **New query**.
3. Copy and paste [`supabase_schema.sql`](./supabase_schema.sql) and click **Run**.
4. This creates:
   - `runs`: Stores campaign metadata and start/finish timestamps.
   - `searches`: Stores individual route-date query events and Duffel response summaries.
   - `observations`: Stores high-resolution price data points with quoted amounts, taxes, and raw payloads.
   - `detail_events`: Tracks baggage allowances and condition inspections.
   - `flight_yield_curve_view`: Pre-computed SQL view extracting clean ML features (`lead_days`, `min_price`, `avg_price`, `available_offers_count`).

---

## 🔑 Environment Variables

Set your credentials before starting:

```bash
export DUFFEL_ACCESS_TOKEN="duffel_test_..." # or duffel_live_...
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-or-service-role-key"
```

---

## 🚀 Worker Commands

All commands are run from the `flight_ml_collector/collection_worker` directory:

### 1. View Plan & Budget
```bash
python3 worker.py plan
```
Output:
```json
{
  "hours": 24,
  "interval_hours": 3,
  "scheduled_batches": 8,
  "searches_per_batch": 40,
  "max_http_calls_per_batch": 250,
  "max_http_calls_total": 2000,
  "database": "Supabase (not provisioned)",
  "source": "Duffel adapter (account required)",
  "live_started": false
}
```

### 2. Check Status
```bash
python3 worker.py status
```
Prints `NOT STARTED` or current `state.json` campaign details (campaign ID, completed batches, synced rows).

### 3. Run the 24-Hour Campaign
```bash
# In test mode:
python3 worker.py run --mode test

# In live mode (requires rights & budget confirmed in config.json):
python3 worker.py run --mode live
```

#### Run in Background (24/7 on Server or Mac)
```bash
nohup python3 worker.py run --mode test > worker.log 2>&1 &
```
Follow logs:
```bash
tail -f worker.log
```

### 4. Stop Cleanly
```bash
touch state/STOP
```
The worker finishes the in-flight operation, uploads remaining rows to Supabase, marks status as `stopped_by_user`, and exits.

### 5. Manual Cloud Sync
If offline or if pending records remain:
```bash
python3 worker.py sync
```

---

## 🧠 Querying Data for Machine Learning

Once your campaign has collected observations, query the ready-made view in Supabase:

```sql
SELECT 
    origin,
    destination,
    departure_date,
    lead_days,
    min_price,
    avg_price,
    max_price,
    available_offers_count,
    currency
FROM flight_yield_curve_view
ORDER BY departure_date, lead_days DESC;
```
