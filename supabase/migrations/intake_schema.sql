-- Intake schema customization
--
-- Lets each therapist customize the intake form their clients see:
-- hide questions, edit labels, edit options, add new questions, remove
-- questions. Plus turn on a structured medical conditions checklist
-- and a HIPAA-compliant intake mode.
--
-- Schema shape stored in therapists.intake_schema jsonb:
-- {
--   "version": 1,
--   "fields": [
--     { "id": "pressure", "type": "chips", "label": "Pressure",
--       "options": [{"v":"light","label":"Light"},...],
--       "hidden": false, "required": false, "kind": "default" },
--     ...
--   ],
--   "medical_checklist_enabled": true,
--   "hipaa_mode": false
-- }
--
-- NULL = use built-in default schema (the 10 fields baked into the
-- intakeSchema.js library). Once a therapist saves any change, the
-- entire schema is persisted so we have a stable structure.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS intake_schema jsonb;

-- Sessions need to be able to store custom medical-checklist answers.
-- We add a generic medical_conditions text[] column so structured data
-- can land somewhere even if the therapist's schema evolves.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS medical_conditions text[],
  ADD COLUMN IF NOT EXISTS custom_intake_answers jsonb;
