-- Stage 1 of closing the public read exposure (HK approved Jun 8 2026).
-- The clients table has broad public read policies left from the booking
-- flow. Rather than break booking by removing them, we restrict the
-- anonymous role at the column level: anon may read only non-clinical
-- columns. The five clinical fields become unreadable by the public key.
-- The authenticated (therapist) and service roles are untouched and keep
-- full access. No public page reads the clinical columns, and the only
-- public read of the full row (the intake match) was first narrowed to
-- id + match fields, so this change is non-breaking.
revoke select on public.clients from anon;
grant select (
  id, therapist_id, name, phone, email, total_sessions, loyalty_points,
  created_at, updated_at, imported_from, notes, do_not_rebook, dnr_reason,
  stripe_customer_id, payment_method_id, card_last4, card_brand,
  square_customer_id, square_card_id, sms_opted_in, sms_opted_in_at,
  outreach_unsubscribed, outreach_unsubscribed_at, card_saved_at,
  card_mandate_text, card_mandate_agreed_at, card_mandate_ip_hash,
  practice_agreement_signed_at, practice_agreement_signer_name,
  practice_agreement_signer_ip, practice_agreement_text_snapshot,
  sms_opted_out_at, sms_opted_out_via, address_line1, address_line2,
  city, state, zip, country, import_batch_id, platform_terms_accepted_at,
  platform_terms_version, birthday, gender, referral_source, customer_since, alt_phone
) on public.clients to anon;
