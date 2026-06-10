// supabase/functions/_shared/coupon.ts
//
// Shared coupon logic so validation and the discount math live in ONE
// place, used by both validate-coupon (preview for the booking page) and
// create-deposit / square-create-deposit (the authoritative charge). The
// browser never decides the discount; it only displays what the server
// returns, and the charge is recomputed server-side from the real service
// price at payment time.

export interface CouponRow {
  id: string;
  therapist_id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  active: boolean;
  new_clients_only: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
}

export interface CouponValidation {
  valid: boolean;
  reason?: 'not_found' | 'inactive' | 'expired' | 'used_up' | 'new_clients_only';
}

// Validate a coupon row. isNewClient is only consulted for new-client-only
// codes; pass true when unknown so a code is not wrongly blocked.
export function validateCoupon(
  c: CouponRow | null,
  opts: { isNewClient?: boolean } = {},
): CouponValidation {
  if (!c) return { valid: false, reason: 'not_found' };
  if (!c.active) return { valid: false, reason: 'inactive' };
  if (c.expires_at && new Date(c.expires_at).getTime() <= Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  if (c.max_redemptions != null && c.times_redeemed >= c.max_redemptions) {
    return { valid: false, reason: 'used_up' };
  }
  if (c.new_clients_only && opts.isNewClient === false) {
    return { valid: false, reason: 'new_clients_only' };
  }
  return { valid: true };
}

// Apply a coupon to a pre-discount price in CENTS. Never goes below zero.
export function applyDiscountCents(
  fullPriceCents: number,
  c: CouponRow,
): { discountCents: number; discountedCents: number } {
  const base = Math.max(0, Math.round(fullPriceCents));
  let discountCents = 0;
  if (c.discount_type === 'percent') {
    discountCents = Math.round(base * (Number(c.discount_value) / 100));
  } else {
    discountCents = Math.round(Number(c.discount_value) * 100);
  }
  if (discountCents < 0) discountCents = 0;
  if (discountCents > base) discountCents = base;
  return { discountCents, discountedCents: base - discountCents };
}

// Plain-English reason for a declined code, in the Joy voice (no em dashes).
export function reasonMessage(reason?: string): string {
  switch (reason) {
    case 'not_found': return 'That code was not recognized.';
    case 'inactive': return 'That code is no longer active.';
    case 'expired': return 'That code has expired.';
    case 'used_up': return 'That code has reached its limit.';
    case 'new_clients_only': return 'That code is for first-time clients only.';
    default: return 'That code could not be applied.';
  }
}
