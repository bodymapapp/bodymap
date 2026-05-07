-- Migration: fix ai_usage_monthly RLS policy
-- Date: May 7, 2026
-- Purpose: The earlier migration (2026-05-07-ai-usage-monthly.sql) used
--          a WHERE auth_user_id = auth.uid() pattern in the RLS policy.
--          The actual schema uses therapists.id = auth.uid() directly
--          (no separate auth_user_id column). This caused all client-side
--          reads of ai_usage_monthly to fail silently, which is why the
--          rate-limit counter was not appearing in the Practice Assistant.
--
-- This migration drops and recreates the policy with the correct join.
-- Safe to run if the earlier migration succeeded; it just replaces the
-- policy.

DROP POLICY IF EXISTS "therapist_read_own_ai_usage" ON ai_usage_monthly;

CREATE POLICY "therapist_read_own_ai_usage"
  ON ai_usage_monthly
  FOR SELECT
  USING (
    therapist_id = auth.uid()
  );
