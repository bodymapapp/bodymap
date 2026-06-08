-- Stage 2 (bookings) of the read lockdown (HK approved Jun 8 2026).
-- The bookings table had a broad public read policy left from the booking
-- flow. The public booking page legitimately needs to see when slots are
-- taken, so scheduling fields stay readable by the anonymous role, but
-- contact details, notes, payment identifiers, signer info, and partner
-- contacts are blocked. The three public reads that needed contact data
-- (returning-client check, intake next-booking, manage-page details) now
-- go through the booking-lookup edge function (service role, minimal
-- output). authenticated (therapist) and service roles keep full access.
do $$
declare cols text;
begin
  revoke select on public.bookings from anon;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name='bookings'
    and column_name not in (
      'client_name','client_email','client_phone','notes',
      'partner_name','partner_email','decline_reason','cancellation_charge_reason',
      'booking_policies_text_snapshot','practice_agreement_signer_name',
      'practice_agreement_signer_ip','practice_agreement_text_snapshot','booked_by',
      'card_on_file_payment_method_id','card_on_file_customer_id','card_on_file_square_customer_id',
      'square_deposit_order_id','square_deposit_link_id','deposit_payment_intent',
      'cancellation_charge_payment_intent_id'
    );
  execute format('grant select (%s) on public.bookings to anon', cols);
end $$;
