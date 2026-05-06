// supabase/functions/_shared/payment-provider.ts
//
// PaymentProvider abstraction. Every payment edge function should
// route through this interface rather than calling Stripe or Square
// directly.
//
// Design philosophy:
//   - One internal interface, two (today) implementations
//   - Edge functions know nothing about Stripe or Square specifics
//   - Adding a third processor = adding one provider file, no other
//     code touches
//   - Each provider is self-contained: imports its own SDK helpers,
//     handles its own self-healing (Square location_id, Stripe
//     account verification, etc.)
//
// Strategic context (May 2026):
//   Stripe is the online engine, Square is the in-person companion.
//   That distinction lives in the BUSINESS logic (which providers
//   support which operations), not in the abstraction. The interface
//   declares every operation; each provider says whether it
//   implements that operation. saveCardOnFile() throws on Square
//   today because Square Web Payments SDK is not implemented and
//   not on the roadmap. That's fine — the interface is honest about
//   its current capability via supportsOperation().
//
// This file is the contract. Provider files implement it. Edge
// functions call it.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ProviderName = 'stripe' | 'square';

export type Therapist = {
  id: string;
  full_name?: string | null;
  business_name?: string | null;
  custom_url?: string | null;
  stripe_account_id?: string | null;
  square_access_token?: string | null;
  square_location_id?: string | null;
  square_merchant_id?: string | null;
  square_connected?: boolean | null;
  stripe_account_connected?: boolean | null;
  [k: string]: unknown;
};

export type CartItem = {
  // Generic identifier the calling code understands. The provider
  // copies this into its own metadata (Stripe product metadata,
  // Square line metadata) so the confirm step can recover it.
  itemId: string;
  // Display name for the line item on the checkout page.
  name: string;
  // Optional sub-description (for cart context).
  description?: string;
  // Per-unit amount in cents.
  amountCents: number;
  // Quantity, defaults to 1.
  quantity?: number;
  // Free-form metadata the provider should attach to this line.
  // Used by confirm to know what was bought.
  metadata?: Record<string, string>;
};

export type CustomerInfo = {
  name?: string | null;
  email: string;
  phone?: string | null;
};

export type CheckoutLinkArgs = {
  therapist: Therapist;
  items: CartItem[];
  customer: CustomerInfo;
  // Where the checkout returns the customer after success.
  // Provider appends its session/order id as a query param.
  redirectUrl: string;
  // Optional cancel redirect. Defaults to redirectUrl + ?canceled=1.
  cancelUrl?: string;
  // Free-form metadata attached to the session/order, available to
  // the verify step.
  metadata?: Record<string, string>;
  // Mode: one-time payment vs recurring. Square only supports
  // 'payment'. Calling 'subscription' on Square throws.
  mode?: 'payment' | 'subscription';
  // Subscription-only: the recurring price configuration.
  // Required when mode === 'subscription'.
  subscriptionPlan?: {
    name: string;
    monthlyPriceCents: number;
    // If the therapist already has a Stripe Price id for this plan
    // (membership table column stripe_price_id), pass it here to
    // reuse instead of creating a new Stripe Product+Price.
    existingPriceId?: string | null;
    // Where to write the new price id back if we create one. Caller
    // owns the persistence; we hand back the id in the result.
  };
};

export type CheckoutLinkResult = {
  url: string;
  // Provider-agnostic id the confirm step uses to look up the result.
  // Stripe: checkout session id. Square: payment link id (NOT order
  // id; the order id is more useful for verification).
  providerSessionId: string;
  // Stripe: same as session id. Square: order id (used by verify).
  // The confirm function doesn't need to know which provider this
  // came from; it just hands it back to provider.verifyCheckout().
  paymentRefId: string;
  // Total in cents, for logging / receipt sanity.
  totalCents: number;
};

export type VerifiedLineItem = {
  itemId: string;
  amountCents: number;
  metadata: Record<string, string>;
};

export type VerifyResult = {
  paid: boolean;
  // If paid=false, why. 'pending', 'canceled', 'expired', etc.
  status?: string;
  // The amount actually paid, in cents.
  totalCents: number;
  // Email Stripe/Square confirmed (after checkout). Often differs
  // from what was passed in; trust this one.
  customerEmail?: string;
  // Line items recovered from the provider, with their itemId
  // metadata. Caller uses these to create package_purchases rows.
  lineItems: VerifiedLineItem[];
  // The unique payment reference id from the processor (Stripe
  // payment_intent_id, Square payment_id or order_id). Use this as
  // the idempotency key when persisting purchases.
  paymentRefId: string;
  // Subscription mode only: the resulting subscription + customer
  // ids. Null for payment mode.
  subscriptionId?: string | null;
  subscriberCustomerId?: string | null;
  // Subscription mode only: when the current period ends. Caller
  // uses this to set member_subscriptions.current_period_end.
  currentPeriodEnd?: string | null;
  // Subscription mode only: if we created a new Price during
  // checkout creation, return its id so the caller can persist it
  // on the membership row for reuse.
  newPriceId?: string | null;
};

export type SaveCardArgs = {
  therapist: Therapist;
  customer: CustomerInfo;
  // The frontend-collected payment method token (Stripe payment_method
  // id from Elements, or Square nonce from Web Payments SDK).
  paymentToken: string;
  // For Stripe: pass the SetupIntent client_secret so we can confirm
  // server-side. Skipped if we already confirmed client-side.
  setupIntentSecret?: string | null;
};

export type SaveCardResult = {
  providerCustomerId: string;
  providerCardId: string; // payment_method id (Stripe), card id (Square)
  last4: string;
  brand: string; // 'visa', 'mastercard', etc. — provider-normalized
};

export type ChargeArgs = {
  therapist: Therapist;
  // The provider customer + card ids (returned earlier from saveCardOnFile).
  providerCustomerId: string;
  providerCardId: string;
  amountCents: number;
  // Use this for idempotency. Recommended: a stable id like
  // `cancel-${booking_id}` so retrying doesn't double-charge.
  idempotencyKey: string;
  description?: string;
  // Optional: send the customer a receipt email. Provider-specific.
  receiptEmail?: string;
};

export type ChargeResult = {
  paid: boolean;
  paymentRefId: string;
  amountCents: number;
};

export type RefundArgs = {
  therapist: Therapist;
  // The original paymentRefId from the charge (or a CheckoutLinkResult).
  paymentRefId: string;
  // Amount to refund, in cents. Pass undefined for full refund.
  amountCents?: number;
  reason?: string;
  idempotencyKey: string;
};

export type RefundResult = {
  refunded: boolean;
  refundId: string;
  amountCents: number;
};

export type SetupIntentArgs = {
  therapist: Therapist;
  customer: CustomerInfo;
};

export type SetupIntentResult = {
  // Stripe SetupIntent client_secret. Frontend calls
  // stripe.confirmCardSetup(client_secret, ...). After success,
  // the frontend has a payment_method id ready to persist.
  clientSecret: string;
  // The provider's customer id (Stripe Customer id). Persist this
  // on the clients row so future charges can attach to it.
  providerCustomerId: string;
  // Mostly for diagnostic/UI. Stripe connected account id.
  accountId: string;
};

// Operations every provider claims to support or not. The interface
// declares every operation; getCapability() says how well each one
// works on a given provider today.
export type Operation =
  | 'createCheckoutLink'        // both
  | 'createSubscriptionLink'    // both (after chunk δ); stripe today
  | 'createSetupIntent'         // both (after chunk α); stripe today
  | 'verifyCheckout'            // both
  | 'saveCardOnFile'            // both (after chunk α); stripe today
  | 'chargeSavedCard'           // both (after chunk β); stripe today
  | 'refund';                   // both

// Capability describes how well a provider supports an operation.
// Replaces the old binary supportsOperation() so we can express
// "supported but with these limitations" or "deprecated, migrating
// to V2" — necessary for the agile, modernizable architecture HK
// asked for.
export type CapabilityStatus =
  | 'supported'      // first-class, no caveats
  | 'limited'        // works, with documented limitations the UI
                     // should surface to the therapist
  | 'deprecated'     // works today but being sunset; new code should
                     // route to recommendedAlternative when present
  | 'unsupported';   // throws ProviderError if called

export type Capability = {
  status: CapabilityStatus;
  // Human-readable limitations the UI can surface verbatim. Empty
  // for 'supported'; required for 'limited'.
  limitations?: string[];
  // 'use Stripe instead' style guidance for therapists when they
  // try to opt into a 'limited' or 'deprecated' path.
  recommendedAlternative?: ProviderName;
  // Implementation version this capability landed in. Bumped when a
  // provider's strategy module changes (e.g. SquareProviderV2).
  since?: string;
  // When status='deprecated', the version it was deprecated in. UI
  // can show this so the therapist knows it's a sunset path.
  deprecatedSince?: string;
};

// ─────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────

export interface PaymentProvider {
  readonly name: ProviderName;
  // Strategy version. Bumped when we ship a new internal
  // implementation (e.g. SquareProviderV2). Surfaced for
  // diagnostics and for the capability matrix's `since`/
  // `deprecatedSince` fields.
  readonly version: string;

  // Capability matrix lookup. Returns how this provider supports
  // the given operation, with limitations + recommended alternatives.
  // Replaces the older boolean supportsOperation(). UI uses this to
  // show honest tradeoffs; routing logic uses .status to decide
  // whether to call vs redirect to a recommendedAlternative.
  getCapability(op: Operation): Capability;

  createCheckoutLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult>;

  verifyCheckout(args: {
    therapist: Therapist;
    paymentRefId: string;
  }): Promise<VerifyResult>;

  // Create a SetupIntent (Stripe) for capturing a card off-session
  // for future charges. Square does not support this in our roadmap.
  createSetupIntent(args: SetupIntentArgs): Promise<SetupIntentResult>;

  saveCardOnFile(args: SaveCardArgs): Promise<SaveCardResult>;

  chargeSavedCard(args: ChargeArgs): Promise<ChargeResult>;

  refund(args: RefundArgs): Promise<RefundResult>;
}

// ─────────────────────────────────────────────────────────────────
// Provider selection
// ─────────────────────────────────────────────────────────────────

export type ProviderSelectionPolicy =
  | 'auto'                          // pick whichever is connected, prefer Stripe
  | 'stripe-required'               // throw if Stripe not connected
  | 'online-only';                  // alias for stripe-required (semantic clarity)

export class ProviderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

// Which provider does this therapist use? In auto mode, Stripe wins
// when both are connected (per the strategic reframe: Stripe is the
// online engine). For operations that are Stripe-only (memberships,
// card-on-file), use 'stripe-required' to fail loud + early.
export async function getProvider(
  therapist: Therapist,
  policy: ProviderSelectionPolicy = 'auto',
): Promise<PaymentProvider> {
  const stripeConnected = !!therapist.stripe_account_id;
  const squareConnected = !!therapist.square_access_token;

  if (policy === 'stripe-required' || policy === 'online-only') {
    if (!stripeConnected) {
      throw new ProviderError(
        'stripe_required',
        'This operation requires Stripe. The therapist has not connected Stripe yet.'
      );
    }
    const { StripeProvider } = await import('./providers/stripe.ts');
    return new StripeProvider();
  }

  // auto policy
  if (stripeConnected) {
    const { StripeProvider } = await import('./providers/stripe.ts');
    return new StripeProvider();
  }
  if (squareConnected) {
    const { SquareProvider } = await import('./providers/square.ts');
    return new SquareProvider(therapist);
  }

  throw new ProviderError(
    'no_provider_connected',
    'This therapist has not connected Stripe or Square. Connect one in Settings → Payments.'
  );
}

// ─────────────────────────────────────────────────────────────────
// Helpers usable by all providers
// ─────────────────────────────────────────────────────────────────

// Standard CORS for every payment edge function.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standard JSON response. Use this in every edge function for
// consistency — same shape, same headers.
export function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Standard Supabase client. Every edge function needs one with the
// service role key; this saves the boilerplate.
export function getSupabaseClient(): SupabaseClient {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Load the therapist row by id. Throws if not found. Selects all
// columns so any provider has what it needs.
export async function loadTherapist(supabase: SupabaseClient, therapistId: string): Promise<Therapist> {
  const { data, error } = await supabase
    .from('therapists')
    .select('*')
    .eq('id', therapistId)
    .single();
  if (error || !data) {
    throw new ProviderError('therapist_not_found', `Therapist ${therapistId} not found`);
  }
  return data as Therapist;
}
