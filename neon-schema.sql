-- Astrova — Neon (PostgreSQL) Schema
-- Run this against your Neon database to initialize all tables.
-- psql $DATABASE_URL -f neon-schema.sql

-- ── astrova_users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_id       TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  is_banned     BOOLEAN NOT NULL DEFAULT false,
  credits       INTEGER NOT NULL DEFAULT 20,
  credits_used  INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── astrova_credit_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_credit_log (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES astrova_users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  action      TEXT NOT NULL,
  description TEXT,
  admin_id    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_log_user ON astrova_credit_log(user_id);

-- ── astrova_knowledge_base ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_knowledge_base (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,
  content    TEXT NOT NULL,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── astrova_admin_config ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_admin_config (
  config_key   TEXT PRIMARY KEY,
  config_value JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── astrova_user_settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_user_settings (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES astrova_users(id) ON DELETE CASCADE,
  setting_key   TEXT NOT NULL,
  setting_value JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

-- ── astrova_chat_sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_chat_sessions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES astrova_users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'New Chat',
  messages     JSONB NOT NULL DEFAULT '[]',
  model_used   TEXT,
  session_type TEXT NOT NULL DEFAULT 'astrology' CHECK(session_type IN ('astrology','admin_article')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON astrova_chat_sessions(user_id, updated_at DESC);

-- ── astrova_saved_charts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astrova_saved_charts (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES astrova_users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  birth_data    JSONB NOT NULL,
  kundali_data  JSONB,
  location_name TEXT,
  coordinates   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charts_user ON astrova_saved_charts(user_id, created_at DESC);

-- ── enabled_models ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enabled_models (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id     TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider     TEXT NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 99
);

-- ── Increment credits function (replaces Supabase RPC) ──────────
CREATE OR REPLACE FUNCTION increment_credits(row_id TEXT, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE astrova_users
  SET credits = credits + amount, updated_at = now()
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;
