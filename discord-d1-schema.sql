-- ============================================================
-- ALIBI PROTOCOL — Discord Bot D1 Schema
-- Database: alibi-discord  (create separately from alibi-waitlist)
-- Run via: wrangler d1 execute alibi-discord --file=discord-d1-schema.sql
-- ============================================================

-- ──────────────────────────────────────────────────────
-- 1. DISCORD USERS — maps Discord IDs to Solana wallets
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discord_users (
  discord_id   TEXT PRIMARY KEY,
  wallet       TEXT NOT NULL UNIQUE,
  tier         TEXT NOT NULL DEFAULT 'RECRUIT',
  referred_by  TEXT,                          -- referrer wallet (nullable)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_discord_users_wallet ON discord_users(wallet);
CREATE INDEX IF NOT EXISTS idx_discord_users_tier   ON discord_users(tier);

-- ──────────────────────────────────────────────────────
-- 2. SHIELD POINTS — all-time activity accumulator per wallet
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shield_points (
  wallet          TEXT PRIMARY KEY,
  total_points    INTEGER NOT NULL DEFAULT 0,
  drive_miles     REAL    NOT NULL DEFAULT 0.0,  -- GPS-verified miles
  hazard_reports  INTEGER NOT NULL DEFAULT 0,    -- verified hazard reports
  verified_events INTEGER NOT NULL DEFAULT 0,    -- police encounters + recordings
  referral_count  INTEGER NOT NULL DEFAULT 0,    -- qualified referrals
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shield_points_total   ON shield_points(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_shield_points_updated ON shield_points(updated_at);

-- ──────────────────────────────────────────────────────
-- 3. REFERRALS — tracks recruiter-recruit relationships
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_wallet  TEXT NOT NULL,
  referee_wallet   TEXT NOT NULL UNIQUE,          -- one referrer per referee
  qualified        INTEGER NOT NULL DEFAULT 0,    -- 1 = drove 10+ miles, reported 1+ hazard
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_qualified ON referrals(qualified);

-- ──────────────────────────────────────────────────────
-- 4. SNAPSHOT COMMITMENT — Switchboard VRF commit-reveal
-- One row per snapshot event. Immutable once committed.
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshot_commitment (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  commitment_hash  TEXT NOT NULL UNIQUE,   -- SHA-256(secret_timestamp_salt)
  memo_tx_sig      TEXT,                   -- Solana tx anchoring the hash
  committed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  revealed_at      TEXT,                   -- NULL until snapshot fires
  snapshot_block   TEXT,                   -- Solana slot at reveal
  total_wallets    INTEGER,                -- network size at snapshot
  total_miles      REAL                    -- total network miles at snapshot
);

-- ──────────────────────────────────────────────────────
-- 5. SEED STAKERS — launch-day multiplier registry
--
-- Multiplier tiers (based on $ALIBI staked):
--   < 1,000     → 1.25×  (Uncommon boost)
--   1,000-9,999 → 1.50×  (Rare boost)
--   10,000-49,999→ 2.00×  (Legendary boost)
--   50,000+     → 2.50×  (Mythical boost)
--
-- amount_staked is tracked off-chain (Solana on-chain source of truth).
-- This table caches verified stake amounts for bot queries.
-- Multiplier is READ-ONLY after staked_at — no retroactive changes.
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seed_stakers (
  wallet          TEXT PRIMARY KEY,
  amount_staked   REAL    NOT NULL DEFAULT 0.0,  -- $ALIBI tokens staked
  multiplier      REAL    NOT NULL DEFAULT 1.0,  -- computed at stake time, immutable
  tier_at_stake   TEXT    NOT NULL DEFAULT 'RECRUIT',
  staked_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  verified_tx_sig TEXT                            -- on-chain confirmation
);

CREATE INDEX IF NOT EXISTS idx_seed_stakers_multiplier ON seed_stakers(multiplier DESC);
CREATE INDEX IF NOT EXISTS idx_seed_stakers_staked_at  ON seed_stakers(staked_at);

-- ──────────────────────────────────────────────────────
-- VIEW: full user snapshot (used by /stats and /package)
-- ──────────────────────────────────────────────────────
CREATE VIEW IF NOT EXISTS user_full_stats AS
SELECT
  du.discord_id,
  du.wallet,
  du.tier,
  du.created_at                              AS member_since,
  sp.total_points,
  sp.drive_miles,
  sp.hazard_reports,
  sp.verified_events,
  sp.referral_count,
  COALESCE(ss.amount_staked,  0.0)           AS amount_staked,
  COALESCE(ss.multiplier,     1.0)           AS stake_multiplier,
  COALESCE(ss.tier_at_stake,  'NONE')        AS tier_at_stake,
  CASE
    WHEN ss.amount_staked >= 50000 THEN 'MYTHICAL'
    WHEN ss.amount_staked >= 10000 THEN 'LEGENDARY'
    WHEN ss.amount_staked >=  1000 THEN 'RARE'
    WHEN ss.amount_staked >      0 THEN 'UNCOMMON'
    ELSE 'NOT STAKED'
  END                                        AS stake_tier_label
FROM discord_users du
LEFT JOIN shield_points sp ON sp.wallet = du.wallet
LEFT JOIN seed_stakers  ss ON ss.wallet = du.wallet;
