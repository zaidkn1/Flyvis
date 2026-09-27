-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR 24-HOUR WORKER & FLIGHT ML DATASET
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. Runs Table (Tracks each collection cycle initiated by the worker)
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    mode TEXT NOT NULL,
    config_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Searches Table (Tracks each route & departure date search)
CREATE TABLE IF NOT EXISTS searches (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
    query_key TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT,
    http_status INTEGER,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Observations Table (Core dataset for Machine Learning price models)
CREATE TABLE IF NOT EXISTS observations (
    search_id TEXT REFERENCES searches(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL,
    stage TEXT NOT NULL, -- 'search' or 'detail'
    campaign_id TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    total_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    currency TEXT,
    normalized_json JSONB,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (search_id, offer_id, stage)
);

-- 4. Detail Events Table (Captures baggage, conditions, and service queries)
CREATE TABLE IF NOT EXISTS detail_events (
    search_id TEXT REFERENCES searches(id) ON DELETE CASCADE,
    offer_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    status TEXT,
    http_status INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (search_id, offer_id, observed_at)
);

-- 5. Time-Series Indexes for Fast ML Feature Extraction
CREATE INDEX IF NOT EXISTS idx_obs_campaign ON observations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_obs_observed_at ON observations(observed_at);
CREATE INDEX IF NOT EXISTS idx_obs_amount ON observations(total_amount);
CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query_key);

-- 6. Machine Learning Yield Curve Training View
-- Extracts clean ML features: route, departure date, lead days (T-d), price stats, carrier
CREATE OR REPLACE VIEW flight_yield_curve_view AS
SELECT 
    s.query_key,
    SPLIT_PART(s.query_key, '-', 1) AS origin,
    SPLIT_PART(SPLIT_PART(s.query_key, '-', 2), '|', 1) AS destination,
    SPLIT_PART(s.query_key, '|', 2)::DATE AS departure_date,
    (SPLIT_PART(s.query_key, '|', 2)::DATE - DATE(o.observed_at)) AS lead_days,
    DATE(o.observed_at) AS observation_date,
    MIN(o.total_amount) AS min_price,
    AVG(o.total_amount)::NUMERIC(10, 2) AS avg_price,
    MAX(o.total_amount) AS max_price,
    COUNT(DISTINCT o.offer_id) AS available_offers_count,
    o.currency
FROM observations o
JOIN searches s ON s.id = o.search_id
WHERE o.total_amount > 0
GROUP BY 
    s.query_key, 
    SPLIT_PART(s.query_key, '-', 1), 
    SPLIT_PART(SPLIT_PART(s.query_key, '-', 2), '|', 1), 
    SPLIT_PART(s.query_key, '|', 2)::DATE, 
    DATE(o.observed_at),
    o.currency
ORDER BY departure_date, lead_days DESC;
