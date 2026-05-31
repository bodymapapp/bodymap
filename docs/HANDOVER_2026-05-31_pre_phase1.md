# Pre-Phase-1 Checkpoint — Sun May 31 2026, 9:16am CT

## Why this doc exists

Before starting the architectural migration from side-panel to full-page navigation, we're capturing the exact production state so we can compare against it after each Phase ships, and roll back if needed.

## Production state at this moment

**Git commit:** `7bfe1a6d`
**Tag:** `pre-phase1-checkpoint`
**Branch:** `pre-phase1-backup`
**Vercel bundle hash:** `main.57db544a.js`
**Service worker:** `bodymap-v29`

## Three rollback mechanisms

1. **Git tag** (permanent, can never move):
   ```
   git checkout pre-phase1-checkpoint
   ```
2. **Git branch** (visible in GitHub UI, browsable):
   ```
   git checkout pre-phase1-backup
   ```
3. **Vercel dashboard**: redeploy the deployment matching commit `7bfe1a6d`.

## What works at this checkpoint

- Schedule with day, week, month views
- Side panel opens on booking click, persists across data refetches via URL `?b=` + sessionStorage + localStorage
- Side panel closes only on X button or backdrop tap (Save/Reschedule/Cancel/NoShow keep it open)
- Send agreement SMS uses appt.client name, says "Hi Joy" not "Hi Lapse"
- Send agreement Email goes via Resend directly (no Outlook)
- Send intake SMS uses appt.client name
- Send intake Email goes via Resend directly through new `send-intake-email` edge fn
- CheckoutModal opens for Square-only therapists, picks Square processor via `init-card-setup`
- Square card-on-file routing through `square-charge-card`
- Cancellation policy works
- Square Connect connected for Joy Demo (merchant `ML3MHT2SBPYN9`)

## Known issues at this checkpoint

1. **Side panel disappears for ~1s on tab return / clients-table refetch.** Visual flicker even though state is preserved. Diagnostic logs `[PANEL] selectedBookingId = (empty)` then restore.
2. **CheckoutModal closes when "Enter new card" is tapped.** Customer-blocking. Root cause: `init-card-setup` upserts the clients row → realtime `clients` subscription fires → `scheduleRefresh` → `fetchBookings` → DetailPanel re-renders and CheckoutModal (inside DetailPanel) unmounts briefly.
3. **`package_purchases?order=created_at.desc` returns 400.** Same anti-pattern as the earlier `member_subscriptions` bug. Column is `purchased_at`, not `created_at`. Cosmetic in console but customer-visible.
4. **A2P 10DLC Brand registration still "in review" with TCR.** Blocks US SMS for everyone except via mailto:/sms: handoffs.

## Architecture being replaced (so we know what's leaving)

Side panel + nested modal pattern:
```
ScheduleDashboard
  └─ TimelineView/WeeklyView/MonthlyView
       └─ {selected && <DetailPanel>}            ← conditional on freshness
            └─ {showCheckout && <CheckoutModal>}  ← local state, dies on unmount
            └─ {showChargeModal && <ChargeModal>} ← same fragility
            └─ {refundTarget && <RefundModal>}    ← same fragility
            └─ {drawerDoc && <DocumentDrawer>}    ← same fragility
```

Replacement: route-based pages where each booking detail, checkout, charge, refund, and document drawer is its own URL. Survives data refetches because Routes don't unmount on parent re-render.

## Migration phases (committed plan)

| Phase | Scope | Estimate | State at end |
|---|---|---|---|
| 1 | Move CheckoutModal to stable parent (ScheduleDashboard root). Loads own data from booking ID. Survives clients refetch. | 2-3 hrs | Customer can pay through Square. Side panel still exists, but checkout no longer dies inside it. |
| 2 | Add `/dashboard/schedule/:date/booking/:id` route. Lift DetailPanel JSX into BookingDetailPage. Schedule navigates instead of opening side panel. | 1 day | Booking detail is a real page. Back button works. Browser refresh keeps user where they were. |
| 3 | Convert remaining modals to routes: `/dashboard/booking/:id/checkout`, `/cancel-charge`, `/refund`. | 1 day | Modals become pages. Each survives independently. |
| 4 | Delete side panel, slide-over backdrop, `selectedBookingId` URL state, cache refs, diagnostic logs. | 2 hrs | Codebase cleaner. ~300 lines deleted. |

## Phase 1 specific scope (to be confirmed before code)

**Files to touch:**
- `src/components/ScheduleDashboard.js` (move CheckoutModal render out of DetailPanel)
- `src/components/CheckoutModal.jsx` (accept booking ID, load own appt + client data instead of via props)

**What I will do:**
1. Add `showCheckoutFor` state (booking ID) at ScheduleDashboard root.
2. Render `<CheckoutModal>` at the root level, conditionally on `showCheckoutFor`.
3. DetailPanel receives `onCheckoutRequest(bookingId)` instead of local setShowCheckout.
4. CheckoutModal loads its own appt and client data using the booking ID prop.
5. Test: open booking → open checkout → tap Enter new card → verify modal stays open through the inevitable clients-table refetch.

**What I will not do in Phase 1:**
- Touch ChargeModal, RefundModal, DocumentDrawer (those still die, but they're not customer-blocking and we'll fix them in Phase 3).
- Remove any URL state, caches, or diagnostic logs yet.
- Touch the side panel itself.

## Open questions for HK before Phase 1 starts

None blocking. Will confirm with one ping when scope is clear, then ship.
