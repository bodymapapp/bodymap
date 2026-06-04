// supabase/functions/_shared/providers/square/v1.ts
//
// SquareV1Strategy — first full implementation of Square parity.
// Uses:
//   - Square Online Checkout API for one-time hosted payments
//     (deposits, package purchases, cart)
//   - Square Cards API for card-on-file (saveCardOnFile via
//     Web Payments SDK token + chargeSavedCard via Payments API)
//   - Square Subscriptions API for memberships (limited compared
//     to Stripe — no proration, manual dunning, monthly only)
//   - Square Refunds API
//   - Square Locations API for self-healing missing location_id
//
// Capability declarations (see getCapability):
//   - createCheckoutLink: supported
//   - verifyCheckout: supported
//   - saveCardOnFile: limited (browser support narrower than Stripe
//     Elements; needs Square Web Payments SDK on the frontend)
//   - chargeSavedCard: supported (off-session via stored card_id)
//   - createSubscriptionLink: limited (no proration, weaker dunning,
//     monthly cadence only)
//   - createSetupIntent: supported (returns Web Payments SDK
//     application id rather than a Stripe-style client_secret;
//     the frontend mounts Square's card form against it)
//   - refund: supported
//
// Future SquareV2Strategy will likely replace some of these when
// Square ships a unified payment primitive. The strategy interface
// stays stable; therapists migrate via feature flag.

import type {
  Therapist,
  CheckoutLinkArgs, CheckoutLinkResult,
  VerifyResult, VerifiedLineItem,
  SetupIntentArgs, SetupIntentResult,
  SaveCardArgs, SaveCardResult,
  ChargeArgs, ChargeResult,
  RefundArgs, RefundResult,
  Capability, Operation,
} from '../../payment-provider.ts';
import { ProviderError, getSupabaseClient } from '../../payment-provider.ts';
import type { SquareStrategy } from './strategy.ts';
import { getSquareAppId } from '../../paymentMode.ts';

// HK May 31 2026: Square API enforces a 45-char limit on every
// idempotency_key field across all endpoints. Callers historically
// constructed keys like `refund_${uuid}_${cents}` (47+ chars) which
// the API rejected with "Field must not be greater than 45 length".
// Defensive helper: any passed-in key longer than 45 chars is
// replaced with a fresh UUID (36 chars). Lossy but safer than failing
// the API call. Idempotency for legitimate retries is lost in that
// path, but the UI already guards against rapid double-tap, and a
// stale key triggering a duplicate charge is rarer than the previous
// "always fails" state.
function safeSquareIdempotencyKey(key: string | undefined): string {
  if (!key || key.length > 45) return crypto.randomUUID();
  return key;
}

// Square API base URL. Auto-detects sandbox vs production from the
// SQUARE_APP_ID prefix:
//   sandbox-sq0idb-...  -> sandbox API
//   sq0idp-...          -> production API
// With test mode active, getSquareAppId() returns the sandbox app id
// which starts with 'sandbox-', so this auto-routes correctly.
// Production stays on the live SQUARE_APP_ID env var unchanged.
function squareApiBase(): string {
  let appId = '';
  try {
    appId = getSquareAppId();
  } catch {
    // Fall back to direct env read if helper throws (env vars not set).
    // The actual API call will fail with a clearer message later.
    appId = Deno.env.get('SQUARE_APP_ID') || '';
  }
  return appId.startsWith('sandbox-')
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}
const SQUARE_API = squareApiBase();
const SQUARE_VERSION = '2024-01-18';

// Internal: standard authenticated fetch with consistent error mapping.
async function squareFetch(
  path: string,
  args: { method?: 'GET' | 'POST'; therapist: Therapist; body?: unknown },
): Promise<any> {
  if (!args.therapist.square_access_token) {
    throw new ProviderError('square_not_connected', 'Therapist has no square_access_token');
  }
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${args.therapist.square_access_token}`,
    'Square-Version': SQUARE_VERSION,
  };
  if (args.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${SQUARE_API}${path}`, {
    method: args.method || 'GET',
    headers,
    body: args.body ? JSON.stringify(args.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const code = data?.errors?.[0]?.code || `http_${res.status}`;
    const detail = data?.errors?.[0]?.detail || `Square ${path} failed`;

    // Specific mapping for INSUFFICIENT_SCOPES — surfaces a friendly
    // 'reconnect Square' message instead of Square's verbatim error.
    // This happens when a therapist connected Square BEFORE we added
    // a new scope to the OAuth list. Since Square does not auto-
    // upgrade saved tokens, the therapist has to disconnect +
    // reconnect to grant the new permissions. The frontend can read
    // code='insufficient_scopes' to show a 'Reconnect Square' button.
    if (code === 'INSUFFICIENT_SCOPES' || /sufficient permissions/i.test(detail)) {
      throw new ProviderError(
        'insufficient_scopes',
        'Square needs additional permissions for this. Please disconnect Square in Settings → Payments and reconnect (takes 30 seconds). The new connection will have everything we need.'
      );
    }

    throw new ProviderError(code, detail);
  }
  return data;
}

// Self-heal: ensure therapist has square_location_id, fetching it
// if missing. Persists to the therapists row + mutates the local
// object so subsequent uses in this request don't refetch.
async function loadLocation(therapist: Therapist): Promise<string> {
  if (therapist.square_location_id) return therapist.square_location_id;
  console.log('[square-v1] location_id missing, healing via /v2/locations');
  const data = await squareFetch('/v2/locations', { therapist });
  const locs = data.locations || [];
  const active = locs.find((l: any) => l.status === 'ACTIVE') || locs[0];
  if (!active?.id) throw new ProviderError('no_locations', 'Square account has no locations');
  const supabase = getSupabaseClient();
  await supabase.from('therapists').update({ square_location_id: active.id }).eq('id', therapist.id);
  (therapist as any).square_location_id = active.id;
  return active.id;
}

// Internal: find or create a Square Customer for an email. Returns
// the customer id. Used by saveCardOnFile + chargeSavedCard.
async function findOrCreateCustomer(
  therapist: Therapist,
  customer: { email: string; name?: string | null; phone?: string | null },
): Promise<string> {
  // Search first
  const search = await squareFetch('/v2/customers/search', {
    method: 'POST',
    therapist,
    body: {
      query: { filter: { email_address: { exact: customer.email } } },
      limit: 1,
    },
  });
  const existing = search.customers?.[0];
  if (existing?.id) return existing.id;

  // Create
  const created = await squareFetch('/v2/customers', {
    method: 'POST',
    therapist,
    body: {
      email_address: customer.email,
      given_name: customer.name?.split(' ')[0] || undefined,
      family_name: customer.name?.split(' ').slice(1).join(' ') || undefined,
      phone_number: customer.phone || undefined,
    },
  });
  return created.customer.id;
}

// Internal: ensure a Square Catalog Object (Subscription Plan + Plan
// Variation) exists for the given membership. Square subscriptions
// require a Catalog reference; Stripe creates Products+Prices on the
// fly but Square wants them upserted via the Catalog API. We hide
// this from the therapist by creating-on-demand the first time a
// client signs up for a given membership.
async function ensureCatalogPlan(
  therapist: Therapist,
  plan: { name: string; monthlyPriceCents: number; existingPlanVariationId?: string | null },
): Promise<{ planVariationId: string; created: boolean }> {
  if (plan.existingPlanVariationId) {
    return { planVariationId: plan.existingPlanVariationId, created: false };
  }

  // Upsert a new plan + variation in a single batch request.
  // HK May 31 2026: Square idempotency_key has a 45-char limit. The
  // previous `plan-${therapist.id}-${plan.name}-${cents}` ran 60+ chars
  // and was rejected. crypto.randomUUID is 36 chars and unique.
  const idempotencyKey = crypto.randomUUID();
  const body = {
    idempotency_key: idempotencyKey,
    batches: [{
      objects: [
        {
          type: 'SUBSCRIPTION_PLAN',
          id: '#plan',
          subscription_plan_data: {
            name: plan.name,
            phases: [{
              cadence: 'MONTHLY',
              periods: 0, // 0 = no end, recurring forever
              recurring_price_money: { amount: plan.monthlyPriceCents, currency: 'USD' },
            }],
          },
        },
        {
          type: 'SUBSCRIPTION_PLAN_VARIATION',
          id: '#variation',
          subscription_plan_variation_data: {
            name: plan.name,
            phases: [{
              cadence: 'MONTHLY',
              periods: 0,
              pricing: {
                type: 'STATIC',
                price_money: { amount: plan.monthlyPriceCents, currency: 'USD' },
              },
            }],
            subscription_plan_id: '#plan',
          },
        },
      ],
    }],
  };

  const result = await squareFetch('/v2/catalog/batch-upsert', {
    method: 'POST',
    therapist,
    body,
  });

  // Find the variation in the id_mappings (Square assigns real ids).
  const mappings = result.id_mappings || [];
  const variationMapping = mappings.find((m: any) => m.client_object_id === '#variation');
  if (!variationMapping?.object_id) {
    throw new ProviderError('catalog_creation_failed', 'Square did not return a plan variation id');
  }
  return { planVariationId: variationMapping.object_id, created: true };
}

export class SquareV1Strategy implements SquareStrategy {
  readonly version = 'square-v1-2026-05';

  getCapability(op: Operation): Capability {
    const cap: Record<Operation, Capability> = {
      createCheckoutLink: { status: 'supported', since: this.version },
      verifyCheckout: { status: 'supported', since: this.version },
      refund: { status: 'supported', since: this.version },
      chargeSavedCard: { status: 'supported', since: this.version },

      // Card-on-file capture is 'limited' rather than 'supported'
      // because Square Web Payments SDK has narrower browser support
      // than Stripe Elements. Older Safari and some embedded webviews
      // can fail to mount the card form. UI surfaces this so therapists
      // know what they're signing up for.
      saveCardOnFile: {
        status: 'limited',
        since: this.version,
        limitations: [
          'Square Web Payments SDK requires modern browsers; older Safari and some webview environments may not mount the card form.',
          'No fingerprinting-based fraud protection at parity with Stripe Radar.',
        ],
        recommendedAlternative: 'stripe',
      },
      createSetupIntent: {
        status: 'limited',
        since: this.version,
        limitations: [
          'Returns a Square application id and location id (not a Stripe-style client_secret).',
          'Frontend must use Square Web Payments SDK to mount the card form.',
        ],
        recommendedAlternative: 'stripe',
      },

      // Subscriptions are 'limited' because Square's primitive is
      // genuinely weaker than Stripe's: no proration on plan changes,
      // weaker built-in dunning (failed payment retry), monthly only
      // Square subscriptions are technically possible via the
      // Subscriptions API, but our current SquareV1 implementation
      // produces malformed requests (subscription_periods=0,
      // idempotency-key conflicts) when the membership flow is
      // exercised end-to-end (HK confirmed in production testing
      // May 8, 2026).
      //
      // Until SquareV2 properly implements subscriptions, mark this
      // as 'unsupported' so the booking page hides the path and the
      // purchase-membership edge function returns a clear
      // 'subscription_not_supported_on_provider' error rather than
      // letting a bad request reach Square's API.
      //
      // Memberships ride on Stripe exclusively per the capability
      // matrix in docs/BILLING_STRATEGY.md.
      createSubscriptionLink: {
        status: 'unsupported',
        since: this.version,
        recommendedAlternative: 'stripe',
      },
    };
    return cap[op] || { status: 'unsupported' };
  }

  // ─── createCheckoutLink ──────────────────────────────────────────
  async createCheckoutLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult> {
    if (args.mode === 'subscription') {
      return this.createSubscriptionLink(args);
    }

    const locationId = await loadLocation(args.therapist);
    const totalCents = args.items.reduce((s, it) => s + it.amountCents * (it.quantity || 1), 0);

    const isSingleLine = args.items.length === 1 && (args.items[0].quantity || 1) === 1;
    let body: Record<string, unknown>;

    if (isSingleLine) {
      const it = args.items[0];
      body = {
        idempotency_key: crypto.randomUUID(),
        quick_pay: {
          name: it.name,
          price_money: { amount: it.amountCents, currency: 'USD' },
          location_id: locationId,
        },
        checkout_options: {
          ask_for_shipping_address: false,
          redirect_url: `${args.redirectUrl}&checkout_complete=1&processor=square`,
        },
        // HK May 31 2026: only include buyer_email when one is actually
        // present. Square's API rejects an empty-string email with
        // "Invalid email address" which surfaces as a confusing error
        // when the therapist chose SMS-only delivery (no email on
        // file). Omitting the field entirely is valid.
        ...(args.customer?.email
          ? { pre_populated_data: { buyer_email: args.customer.email } }
          : {}),
        description: it.description || undefined,
      };
    } else {
      body = {
        idempotency_key: crypto.randomUUID(),
        order: {
          location_id: locationId,
          line_items: args.items.map((it) => ({
            name: it.name,
            quantity: String(it.quantity || 1),
            base_price_money: { amount: it.amountCents, currency: 'USD' },
            note: it.description || undefined,
            metadata: { ...(it.metadata || {}), item_id: it.itemId },
          })),
        },
        checkout_options: {
          ask_for_shipping_address: false,
          redirect_url: `${args.redirectUrl}&checkout_complete=1&processor=square`,
        },
        // HK May 31 2026: same fix as quick_pay path above.
        ...(args.customer?.email
          ? { pre_populated_data: { buyer_email: args.customer.email } }
          : {}),
      };
    }

    const data = await squareFetch('/v2/online-checkout/payment-links', {
      method: 'POST', therapist: args.therapist, body,
    });

    const link = data.payment_link;
    if (!link?.url) throw new ProviderError('no_url_returned', 'Square returned no checkout URL');

    return {
      url: link.url,
      providerSessionId: link.id,
      paymentRefId: link.order_id,
      totalCents,
    };
  }

  // ─── createSubscriptionLink ──────────────────────────────────────
  // Square subscriptions need a Catalog Object (plan variation) to
  // exist before /v2/subscriptions can reference it. We create it on
  // demand and persist the planVariationId on the membership row so
  // future signups reuse it.
  async createSubscriptionLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult> {
    if (!args.subscriptionPlan) {
      throw new ProviderError('missing_subscription_plan', 'mode=subscription requires subscriptionPlan');
    }
    const plan = args.subscriptionPlan;
    const locationId = await loadLocation(args.therapist);

    // Step 1: ensure the plan + variation exist in Square Catalog.
    // Note: existingPriceId on the args is reused for Square as the
    // plan variation id (same conceptual slot — caller persists it
    // on memberships.square_plan_variation_id).
    const { planVariationId, created } = await ensureCatalogPlan(args.therapist, {
      name: plan.name,
      monthlyPriceCents: plan.monthlyPriceCents,
      existingPlanVariationId: plan.existingPriceId, // reused field
    });

    // Step 2: ensure customer exists.
    const customerId = await findOrCreateCustomer(args.therapist, {
      email: args.customer.email,
      name: args.customer.name,
      phone: args.customer.phone,
    });

    // Step 3: create the subscription. Square does NOT have a hosted
    // checkout for subscriptions, so we generate a hosted checkout
    // for the FIRST month + use the saved card to enroll the customer
    // in the subscription post-payment.
    //
    // Strategy: use a Payment Link with a Save-Card option to capture
    // the card, then set up the subscription with that card. Square's
    // `subscription_plan_id` requires the variation id. The actual
    // subscription is created in confirm-membership-purchase, after
    // the first payment succeeds.
    //
    // For the redirect URL, we include enough context that the
    // confirm step can pull customer_id + card_id and set up the
    // subscription server-side.
    const startDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // We return a Payment Link for the FIRST payment + indicate
    // subscription mode. The confirm step will create the
    // subscription post-payment.
    const idempotencyKey = crypto.randomUUID();
    const data = await squareFetch('/v2/online-checkout/payment-links', {
      method: 'POST',
      therapist: args.therapist,
      body: {
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: `${plan.name} (first month)`,
          price_money: { amount: plan.monthlyPriceCents, currency: 'USD' },
          location_id: locationId,
        },
        checkout_options: {
          ask_for_shipping_address: false,
          redirect_url: `${args.redirectUrl}&checkout_complete=1&processor=square&mode=subscription&plan_variation_id=${planVariationId}&customer_id=${customerId}&start_date=${startDate}`,
        },
        // HK May 31 2026: omit buyer_email when empty (SMS-only delivery)
        ...(args.customer?.email
          ? { pre_populated_data: { buyer_email: args.customer.email } }
          : {}),
      },
    });

    const link = data.payment_link;
    if (!link?.url) throw new ProviderError('no_url_returned', 'Square returned no checkout URL');

    return {
      url: link.url,
      providerSessionId: link.id,
      paymentRefId: link.order_id,
      totalCents: plan.monthlyPriceCents,
      // Smuggle the plan variation id back so the caller can persist
      // it on the membership row for reuse. Lives on the optional
      // newPriceId field (same semantic slot as Stripe's price id).
      ...(created ? { newPriceId: planVariationId } : {}),
    } as CheckoutLinkResult;
  }

  // ─── verifyCheckout ──────────────────────────────────────────────
  async verifyCheckout(args: { therapist: Therapist; paymentRefId: string }): Promise<VerifyResult> {
    const orderId = args.paymentRefId;
    const data = await squareFetch(`/v2/orders/${orderId}`, { therapist: args.therapist });
    const order = data.order;
    if (!order) throw new ProviderError('order_not_found', `Square order ${orderId} not found`);

    const paid = order.state === 'COMPLETED';
    const totalCents = order.total_money?.amount || 0;
    const lineItems: VerifiedLineItem[] = (order.line_items || []).map((line: any) => ({
      itemId: line.metadata?.item_id || line.metadata?.package_id || '',
      amountCents: line.total_money?.amount || 0,
      metadata: line.metadata || {},
    })).filter((li: VerifiedLineItem) => li.itemId);

    return {
      paid, status: order.state, totalCents,
      lineItems, paymentRefId: orderId,
    };
  }

  // ─── createSetupIntent ───────────────────────────────────────────
  // Square doesn't have a SetupIntent primitive. Closest equivalent:
  // the frontend uses Web Payments SDK to tokenize a card with the
  // application id + location id, then calls saveCardOnFile with
  // the resulting nonce. So this method returns the application id
  // + location id rather than a client_secret. Frontend code
  // handles the difference.
  async createSetupIntent(args: SetupIntentArgs): Promise<SetupIntentResult> {
    const locationId = await loadLocation(args.therapist);
    const customerId = await findOrCreateCustomer(args.therapist, {
      email: args.customer.email,
      name: args.customer.name,
      phone: args.customer.phone,
    });
    // Square Web Payments SDK needs the application id (the OAuth
    // app's id, not the merchant id) on the frontend. With test mode
    // active, this returns the sandbox app id; production returns the
    // live one. Same env vars used by square-oauth flows.
    let applicationId = '';
    try {
      applicationId = getSquareAppId();
    } catch (e) {
      throw new ProviderError('square_app_id_missing', e.message);
    }
    if (!applicationId) {
      throw new ProviderError('square_app_id_missing', 'SQUARE_APP_ID env var not set');
    }
    return {
      // We pack Square's two-piece identity into the clientSecret
      // field as a JSON string. The frontend parses it back. Using
      // the existing field (rather than adding a new one) keeps the
      // PaymentProvider interface stable across providers — both
      // return a single string the frontend uses to mount its SDK.
      clientSecret: JSON.stringify({
        applicationId,
        locationId,
        customerId,
      }),
      providerCustomerId: customerId,
      accountId: args.therapist.square_merchant_id || '',
    };
  }

  // ─── saveCardOnFile ──────────────────────────────────────────────
  // The frontend has tokenized a card via Web Payments SDK. The token
  // (Square calls it a 'source_id' or 'nonce') is passed in as
  // paymentToken. We attach it to the customer via /v2/cards.
  async saveCardOnFile(args: SaveCardArgs): Promise<SaveCardResult> {
    const customerId = await findOrCreateCustomer(args.therapist, args.customer);
    const cardData = await squareFetch('/v2/cards', {
      method: 'POST',
      therapist: args.therapist,
      body: {
        idempotency_key: crypto.randomUUID(),
        source_id: args.paymentToken,
        card: { customer_id: customerId },
      },
    });
    const card = cardData.card;
    if (!card?.id) throw new ProviderError('card_save_failed', 'Square did not return a card');

    return {
      providerCustomerId: customerId,
      providerCardId: card.id,
      last4: card.last_4 || '????',
      brand: (card.card_brand || 'card').toLowerCase(),
    };
  }

  // ─── chargeSavedCard ─────────────────────────────────────────────
  async chargeSavedCard(args: ChargeArgs): Promise<ChargeResult> {
    const locationId = await loadLocation(args.therapist);
    const data = await squareFetch('/v2/payments', {
      method: 'POST',
      therapist: args.therapist,
      body: {
        idempotency_key: safeSquareIdempotencyKey(args.idempotencyKey),
        source_id: args.providerCardId,
        customer_id: args.providerCustomerId,
        amount_money: { amount: args.amountCents, currency: 'USD' },
        location_id: locationId,
        note: args.description || undefined,
        ...(args.receiptEmail ? { buyer_email_address: args.receiptEmail } : {}),
      },
    });
    const payment = data.payment;
    return {
      paid: payment?.status === 'COMPLETED' || payment?.status === 'APPROVED',
      paymentRefId: payment?.id || '',
      amountCents: payment?.amount_money?.amount || args.amountCents,
    };
  }

  // ─── refund ──────────────────────────────────────────────────────
  async refund(args: RefundArgs): Promise<RefundResult> {
    // Square refunds operate on PAYMENTS, not orders. The stored
    // paymentRefId may be either an order id (online-checkout and
    // payment-link flows store link.order_id) or a payment id directly
    // (direct card charges via /v2/payments: chargeSavedCard and the
    // in-app card-on-file save flow). HK Jun 3 2026: the order lookup
    // used to be unconditional and threw "Order not found for id ..."
    // whenever paymentRefId was actually a payment id, so refunds of
    // direct card charges always failed. Now the order lookup is
    // best-effort and we fall back to using paymentRefId as the payment
    // id when it is not an order.
    let paymentId: string | undefined;
    let orderTotal: { amount: number; currency: string } | undefined;
    try {
      const orderData = await squareFetch(`/v2/orders/${args.paymentRefId}`, { therapist: args.therapist });
      paymentId = orderData.order?.tenders?.[0]?.payment_id;
      orderTotal = orderData.order?.total_money;
    } catch (_) {
      // Not an order id (the common case for direct card charges).
      // Fall through to treating paymentRefId as a payment id.
    }
    if (!paymentId && args.paymentRefId.length > 10) {
      paymentId = args.paymentRefId;
    }
    if (!paymentId) throw new ProviderError('no_payment_for_order', 'Square order has no associated payment');

    const refundBody: Record<string, unknown> = {
      idempotency_key: safeSquareIdempotencyKey(args.idempotencyKey),
      payment_id: paymentId,
      reason: args.reason || undefined,
    };
    if (args.amountCents !== undefined) {
      refundBody.amount_money = { amount: args.amountCents, currency: 'USD' };
    } else {
      refundBody.amount_money = orderTotal || { amount: 0, currency: 'USD' };
    }
    const refundData = await squareFetch('/v2/refunds', {
      method: 'POST', therapist: args.therapist, body: refundBody,
    });
    const refund = refundData.refund;
    return {
      refunded: refund?.status === 'COMPLETED' || refund?.status === 'PENDING',
      refundId: refund?.id || '',
      amountCents: refund?.amount_money?.amount || 0,
    };
  }
}
