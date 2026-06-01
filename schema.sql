-- ============================================================
-- SnuggleState Nest — Schema
-- Uses a separate 'nest' schema to avoid conflicts
-- Run this in the Neon SQL editor
-- ============================================================

CREATE SCHEMA IF NOT EXISTS nest;

-- ─────────────────────────────────────────────────────────────
-- HOUSEHOLDS (created before users reference it)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT UNIQUE NOT NULL,
  name                 TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  household_id         UUID REFERENCES nest.households(id) ON DELETE SET NULL,
  role                 TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  monthly_income       NUMERIC(10,2) DEFAULT 0,
  email_notifications  BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK back from households to users
ALTER TABLE nest.households
  ADD CONSTRAINT fk_households_created_by
  FOREIGN KEY (created_by) REFERENCES nest.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID NOT NULL REFERENCES nest.households(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  monthly_limit NUMERIC(10,2) NOT NULL CHECK (monthly_limit >= 0),
  period        TEXT NOT NULL DEFAULT 'monthly',
  created_by    UUID REFERENCES nest.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category)
);

-- ─────────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES nest.households(id) ON DELETE CASCADE,
  user_email   TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  date         DATE NOT NULL,
  notes        TEXT,
  is_imported  BOOLEAN DEFAULT FALSE,
  created_by   UUID REFERENCES nest.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nest_transactions_household_date ON nest.transactions(household_id, date DESC);
CREATE INDEX idx_nest_transactions_household_category ON nest.transactions(household_id, category);

-- ─────────────────────────────────────────────────────────────
-- BILLS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.bills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES nest.households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_day      SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  frequency    TEXT NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'fortnightly', 'yearly')),
  category     TEXT NOT NULL,
  is_paid      BOOLEAN DEFAULT FALSE,
  paid_date    DATE,
  created_by   UUID REFERENCES nest.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- SAVINGS GOALS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.savings_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES nest.households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  target_amount NUMERIC(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date  DATE,
  description  TEXT,
  created_by   UUID REFERENCES nest.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- SAVINGS CONTRIBUTIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE nest.savings_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES nest.savings_goals(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES nest.households(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  date         DATE NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES nest.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nest.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON nest.users         FOR EACH ROW EXECUTE FUNCTION nest.set_updated_at();
CREATE TRIGGER trg_households_updated_at    BEFORE UPDATE ON nest.households    FOR EACH ROW EXECUTE FUNCTION nest.set_updated_at();
CREATE TRIGGER trg_budgets_updated_at       BEFORE UPDATE ON nest.budgets       FOR EACH ROW EXECUTE FUNCTION nest.set_updated_at();
CREATE TRIGGER trg_transactions_updated_at  BEFORE UPDATE ON nest.transactions  FOR EACH ROW EXECUTE FUNCTION nest.set_updated_at();
CREATE TRIGGER trg_bills_updated_at         BEFORE UPDATE ON nest.bills         FOR EACH ROW EXECUTE FUNCTION nest.set_updated_at();
CREATE TRIGGER trg_savings_goals_updated_at BEFORE UPDATE ON nest.savings_goals FOR EACH ROW EXECUTE FUNCTION nest.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- HELPER: generate invite code
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nest.generate_invite_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  attempt INT := 0;
BEGIN
  LOOP
    code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM nest.households WHERE invite_code = code);
    attempt := attempt + 1;
    IF attempt > 20 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;
  RETURN code;
END;
$$;
