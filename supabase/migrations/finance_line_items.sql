-- Founder Income Statement: living line items for costs & revenue.
-- HK May 25 2026.
-- Run this in Supabase SQL editor on rmnqfrljoknmellbnpiy.
-- The FounderIncomeStatement page seeds itself on first load with
-- everything Claude knows from chats. HK confirms or corrects inline.

CREATE TABLE IF NOT EXISTS finance_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  category    TEXT NOT NULL,
  label       TEXT NOT NULL,
  monthly_cost NUMERIC(10,2),
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT,
  source      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at touch trigger
CREATE OR REPLACE FUNCTION finance_line_items_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_line_items_updated_at ON finance_line_items;
CREATE TRIGGER trg_finance_line_items_updated_at
BEFORE UPDATE ON finance_line_items
FOR EACH ROW EXECUTE FUNCTION finance_line_items_touch_updated_at();

ALTER TABLE finance_line_items ENABLE ROW LEVEL SECURITY;

-- Founder-only access. The /founder route is already auth-gated at the
-- FounderRoute component level. RLS here is a second line: only
-- authenticated users can read/write. Tighten later to founder-uuid
-- if multiple users get founder-level access.
DROP POLICY IF EXISTS "finance_line_items_authed_read" ON finance_line_items;
CREATE POLICY "finance_line_items_authed_read"
  ON finance_line_items FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "finance_line_items_authed_write" ON finance_line_items;
CREATE POLICY "finance_line_items_authed_write"
  ON finance_line_items FOR ALL
  USING (auth.role() = 'authenticated');
