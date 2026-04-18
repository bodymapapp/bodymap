-- Push notification subscriptions for therapists
-- Stores Web Push endpoint + keys so send-push edge function can notify devices

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_therapist ON push_subscriptions(therapist_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Therapists manage own push subscriptions" ON push_subscriptions
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- Optional preferences column on therapists (nullable, defaults on)
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT true;
