create table if not exists gift_certificates (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references therapists(id) on delete cascade,
  code text not null unique,
  amount numeric(10,2) not null,
  remaining numeric(10,2) not null,
  recipient_name text,
  recipient_email text,
  purchaser_name text,
  message text,
  status text not null default 'active',
  redeemed_at timestamptz,
  redeemed_by_booking_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists gift_certificates_therapist_id_idx on gift_certificates(therapist_id);
create index if not exists gift_certificates_code_idx on gift_certificates(code);

alter table gift_certificates enable row level security;

create policy "Therapist owns their certificates"
  on gift_certificates for all
  using (therapist_id = auth.uid())
  with check (therapist_id = auth.uid());

create policy "Public can read by code"
  on gift_certificates for select
  using (true);
