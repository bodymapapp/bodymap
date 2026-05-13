# demo-data

Files for seeding a populated demo of MyBodyMap so the dashboard
counters, client list, and packages/memberships look realistic in
screen recordings.

## Order of operations

**Step 1: Upload `demo-clients.csv`**

In MyBodyMap dashboard:
1. Open Settings or Clients (wherever Import Clients lives)
2. Pick `demo-clients.csv`
3. Confirm the column mapping (it should auto-detect First Name,
   Last Name, Email, Phone, Notes, Last Visit, Visit Count,
   Service, Price)
4. Click Import

This creates 30 clients plus historical sessions tied to a service
with a price. Result: dashboard's New Clients, Sessions, and
Earnings counters all show real numbers in last 7d / 30d.

**Step 2: Paste `seed-packages-memberships.sql`**

In Supabase Dashboard → SQL Editor → New query:
1. Open `seed-packages-memberships.sql` in this folder
2. Copy the entire file
3. Paste into the SQL Editor
4. Click Run

This adds packages, memberships, and gift cards. Auto-finds your
therapist id from `auth.uid()`, so no manual UUID pasting. Safe to
re-run (idempotent).

Result:
- 1 package: 5-pack Swedish 60 @ $540
- 1 membership: Monthly Member @ $95/mo
- 3 active package_purchases (Sarah, Tom, Christina) with varied
  remaining counts so the Active Balance card on client profiles
  shows interesting states
- 2 active member_subscriptions (Linda, Patrick)
- 4 gift cards in varied states

## What you should see after both steps

| Screen | Before | After |
|---|---|---|
| /dashboard | 0 sessions, $0 earnings | ~30-50 sessions, $3-6k earnings in 30d |
| /dashboard/clients | empty or just real clients | 30 demo clients with varied service histories |
| /dashboard/clients/sarah | no Active Balance card | "🎟 Active balance: 5 of 5 remaining" |
| /dashboard/clients/tom | no Active Balance card | "🎟 Active balance: 3 of 5 remaining" |
| /dashboard/clients/linda | no Active Balance card | "🎟 Monthly Member · 1 session/month" |
| /dashboard/gifts | empty | 4 gift cards in varied states |

## Re-running / cleanup

Both files are idempotent. Re-uploading the CSV will mark all 30
clients as "skipped" (already exist by email). Re-running the SQL
won't duplicate packages, memberships, purchases, or gift cards.

To wipe the demo data:

```sql
-- Find your therapist id
SELECT id FROM therapists
WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid());

-- Then in a new query, use the result above as the therapist id
DELETE FROM gift_certificates WHERE therapist_id = '...' AND recipient_name LIKE '%(demo)%';
DELETE FROM member_subscriptions WHERE therapist_id = '...' AND client_email LIKE '%@example.com';
DELETE FROM package_purchases WHERE therapist_id = '...' AND client_email LIKE '%@example.com';
DELETE FROM sessions WHERE therapist_id = '...' AND client_id IN (
  SELECT id FROM clients WHERE therapist_id = '...' AND email LIKE '%@example.com'
);
DELETE FROM clients WHERE therapist_id = '...' AND email LIKE '%@example.com';
DELETE FROM packages WHERE therapist_id = '...' AND name = '5-pack Swedish 60';
DELETE FROM memberships WHERE therapist_id = '...' AND name = 'Monthly Member';
-- Auto-created services from CSV import:
DELETE FROM services WHERE therapist_id = '...' AND is_active = false AND name IN (
  'Swedish Massage 60 min', 'Deep Tissue 60 min', 'Deep Tissue 90 min',
  'Sports Massage 60 min', 'Prenatal Massage 60 min', 'Lymphatic Drainage 60 min',
  'Aromatherapy Massage 60 min'
);
```
