-- Client-facing coupon codes, scoped per therapist (HK Jun 9 2026).
-- Codes the therapist creates and clients enter at booking. The discount
-- applies to the service price, so both the deposit and the remaining
-- balance drop. Validation and the discounted charge are enforced
-- server-side (validate-coupon + create-deposit / square-create-deposit)
-- so a code can never be faked from the browser.

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric not null check (discount_value > 0),
  active boolean not null default true,
  new_clients_only boolean not null default false,
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  times_redeemed integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists coupons_therapist_code_uniq
  on public.coupons (therapist_id, upper(code));
create index if not exists coupons_therapist_idx on public.coupons (therapist_id);

alter table public.coupons enable row level security;

-- Therapist (authenticated) manages only their own coupons. therapists.id = auth.uid().
drop policy if exists "therapist manages own coupons" on public.coupons;
create policy "therapist manages own coupons" on public.coupons
  for all to authenticated
  using (therapist_id = auth.uid())
  with check (therapist_id = auth.uid());
-- No anon access: booking-time validation goes through an edge function
-- (service role), so the public can never read or enumerate codes.

-- Record what was applied on each booking.
alter table public.bookings
  add column if not exists coupon_id uuid references public.coupons(id),
  add column if not exists coupon_code text,
  add column if not exists discount_cents integer not null default 0;

-- Count a redemption exactly once, server-side, when a coupon booking's
-- deposit is actually paid (not on abandoned attempts).
create or replace function public.tg_count_coupon_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.coupon_id is not null
     and coalesce(NEW.deposit_paid, false) = true
     and coalesce(OLD.deposit_paid, false) = false then
    update public.coupons set times_redeemed = times_redeemed + 1 where id = NEW.coupon_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_count_coupon_redemption on public.bookings;
create trigger trg_count_coupon_redemption
  after update of deposit_paid on public.bookings
  for each row execute function public.tg_count_coupon_redemption();
