-- supabase/migrations/practice_agreement.sql
--
-- HK May 14 2026: 'I dont like 4 policies in our site and multiple
-- check boxes. There should be an intake form and then everything
-- else on policies on just one document.'
--
-- Practice agreement: one document. Replaces the conceptual mess
-- of {waiver_text, booking_policies, cancellation_policy_text,
-- service_termination_policy, draping_policy, ...} from the
-- therapist's perspective. The therapist edits ONE document. The
-- client signs ONE signature.
--
-- We keep the old separate fields intact for backward compatibility:
--   - cancellation_policy_text + cancellation_policy_enabled still
--     drive the cancellation-fee charging logic AND the booking-time
--     re-acknowledgement gate
--   - waiver_text + waiver_enabled still drive legacy intake flows
--     for therapists who haven't migrated to the new document yet
-- New therapists default to using practice_agreement_text. Existing
-- therapists see a one-time prompt to consolidate their separate
-- policies into the new document.
--
-- Synthesized from ABMP, AMTA, and MassageBook standard packets.
-- Source attribution is part of the default text so therapists and
-- clients see it.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS practice_agreement_text text,
  ADD COLUMN IF NOT EXISTS practice_agreement_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS practice_agreement_updated_at timestamptz;

-- Audit trail on bookings/clients. The signature record stores who
-- signed what document version when, with name + IP for ESIGN Act
-- compliance.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS practice_agreement_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS practice_agreement_signer_name text,
  ADD COLUMN IF NOT EXISTS practice_agreement_signer_ip text,
  ADD COLUMN IF NOT EXISTS practice_agreement_text_snapshot text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS practice_agreement_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS practice_agreement_signer_name text,
  ADD COLUMN IF NOT EXISTS practice_agreement_signer_ip text,
  ADD COLUMN IF NOT EXISTS practice_agreement_text_snapshot text;

COMMENT ON COLUMN therapists.practice_agreement_text IS
  'One unified agreement combining policies + guidelines + consent + waiver. Therapist edits one document, client signs one signature. Synthesized from ABMP and AMTA standards.';
COMMENT ON COLUMN therapists.practice_agreement_enabled IS
  'When true, the practice agreement is shown at intake and client e-signs once. When false, the legacy separate fields (waiver_text, booking_policies, etc.) drive intake. Default true so new signups use the unified flow.';
COMMENT ON COLUMN bookings.practice_agreement_text_snapshot IS
  'The exact text the client signed at THIS booking. Snapshotted so a later policy edit does not retroactively change what the client agreed to.';
COMMENT ON COLUMN clients.practice_agreement_text_snapshot IS
  'Most recent agreement snapshot for this client. Updated when client signs (typically at first intake).';
