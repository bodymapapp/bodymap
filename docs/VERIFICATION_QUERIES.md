# Notification verification queries

HK May 29 2026: when HK finishes a test pass, Claude runs the queries below
via the Supabase MCP and reports findings. **Do not ask HK for a CSV.**

## 1. What fired in the last 4 hours for Joy Demo

```sql
select
  sent_at,
  audience,
  channel,
  notification_type,
  status,
  recipient,
  subject,
  case when error_message is null then null
       else left(error_message, 200) end as error_excerpt,
  booking_id
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '4 hours'
order by sent_at desc
limit 100;
```

## 2. Same, but grouped by booking so we see per-test outcomes

```sql
select
  b.id as booking_id,
  b.status as booking_status,
  b.client_name,
  b.booking_date::text || ' ' || b.start_time::text as when_local,
  b.notes,
  count(n.id) filter (where n.audience='therapist' and n.channel='email') as therapist_emails,
  count(n.id) filter (where n.audience='client'   and n.channel='email') as client_emails,
  count(n.id) filter (where n.status='failed') as failed_count,
  string_agg(distinct n.notification_type, ', ' order by n.notification_type) as types,
  string_agg(distinct n.error_message, ' | ' order by n.error_message) filter (where n.error_message is not null) as errors
from bookings b
left join notification_log n on n.booking_id = b.id
where b.therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and (b.notes like 'Joy Test %' or b.notes like '%C0%' or b.notes like '%C1%' or b.notes like '%C7%' or b.notes like '%C8%' or b.notes like '%C9%' or b.notes like '%C10%' or b.notes like '%C11%' or b.notes like '%C12%' or b.notes like '%C13%' or b.notes like '%C16%')
group by b.id, b.status, b.client_name, b.booking_date, b.start_time, b.notes
order by b.notes;
```

## 3. Double-fire detector (same booking, same type, same audience, >1 row in 60s)

```sql
select
  booking_id,
  notification_type,
  audience,
  count(*) as fire_count,
  min(sent_at) as first_fire,
  max(sent_at) as last_fire,
  extract(epoch from (max(sent_at) - min(sent_at))) as seconds_between
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '4 hours'
group by booking_id, notification_type, audience
having count(*) > 1
order by fire_count desc, last_fire desc;
```

## 4. Booking-state sanity (do statuses match what we expect?)

```sql
select
  notes,
  status,
  cancellation_charge_status,
  cancellation_charge_amount,
  cancellation_charge_fired_at::text,
  previous_booking_date::text,
  previous_start_time::text,
  rescheduled_at::text
from bookings
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and notes like 'Joy Test %'
order by notes;
```

## 5. Refund and payment receipt audit

```sql
select
  sp.id,
  sp.created_at,
  sp.amount_cents,
  sp.tip_cents,
  sp.refunded_cents,
  sp.refunded_at::text,
  sp.payment_method,
  sp.payment_method_detail,
  sp.status,
  b.notes as booking_notes,
  b.status as booking_status
from session_payments sp
left join bookings b on b.id = sp.booking_id
where sp.therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sp.created_at > now() - interval '4 hours'
order by sp.created_at desc;
```

## Reading the output

- **Pass:** booking has exactly the expected notifications (1 therapist email + 1 client email for cancel; 1 therapist + 1 client receipt for refund; 1 therapist + 1 client for reschedule).
- **Double-fire:** Query 3 returns rows. Fail.
- **Failed status:** any row in Query 1 with `status='failed'`, report the error_excerpt.
- **Missing trace:** Query 4 shows the trace columns. Reschedule must have `previous_booking_date` set; cancellation with fee must have `cancellation_charge_status='succeeded'` and amount.
