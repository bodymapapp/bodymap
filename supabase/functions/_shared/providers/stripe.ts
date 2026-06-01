// supabase/functions/_shared/providers/stripe.ts
//
// Stripe implementation of PaymentProvider. Uses Stripe's REST API
// directly via fetch (no official Deno SDK — REST is plenty for our
// surface area).
//
// All Stripe calls go through connected accounts (Stripe Connect),
// using the Stripe-Account header. The platform secret key
// authenticates; the Stripe-Account header tells Stripe which
// connected merchant the operation is for.
//
// References:
//   https://docs.stripe.com/api/checkout/sessions
//   https://docs.stripe.com/api/payment_intents
//   https://docs.stripe.com/api/setup_intents
//   https://docs.stripe.com/api/refunds
//   https://docs.stripe.com/connect/authentication

import {
  PaymentProvider, ProviderName, Operation, Therapist,
  CheckoutLinkArgs, CheckoutLinkResult,
  VerifyResult, VerifiedLineItem,
  SetupIntentArgs, SetupIntentResult,
  SaveCardArgs, SaveCardResult,
  ChargeArgs, ChargeResult,
  RefundArgs, RefundResult,
  ProviderError, getSupabaseClient,
} from '../payment-provider.ts';
import { getStripeSecret } from '../paymentMode.ts';

const STRIPE_API = 'https://api.stripe.com/v1';

// Internal: build the form-encoded body that Stripe REST endpoints
// expect. Handles arrays via [n] indexing and nested objects via
// [key] notation.
//
// CRITICAL: when recursing into nested objects/arrays, the parent
// prefix must be preserved and combined with the child key. Earlier
// version of this helper passed only the current key as the new
// prefix, dropping the parent context. That produced keys like
// '0[price_data][unit_amount]' instead of
// 'line_items[0][price_data][unit_amount]', which Stripe rejected
// with 'Received unknown parameters: price_data, 0, product_data'.
// Fixed May 8, 2026.
function form(params: Record<string, unknown>, prefix = ''): URLSearchParams {
  const out = new URLSearchParams();
  const buildKey = (key: string) => prefix ? `${prefix}[${key}]` : key;
  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const fullKey = buildKey(key);
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse with the full path as the new prefix so child keys
      // build on top of the parent rather than overwriting it.
      for (const [k, v] of Object.entries(value)) {
        const sub = form({ [k]: v }, fullKey);
        for (const [sk, sv] of sub.entries()) out.append(sk, sv);
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        const sub = form({ [String(i)]: v }, fullKey);
        for (const [sk, sv] of sub.entries()) out.append(sk, sv);
      });
    } else {
      out.append(fullKey, String(value));
    }
  };
  for (const [k, v] of Object.entries(params)) append(k, v);
  return out;
}

// Internal: standard authenticated fetch. Returns parsed JSON or
// throws ProviderError with Stripe's error message.
async function stripeFetch(
  path: string,
  args: { method?: 'GET' | 'POST'; therapist: Therapist; body?: Record<string, unknown> },
): Promise<any> {
  let STRIPE_SECRET: string;
  try {
    STRIPE_SECRET = getStripeSecret();
  } catch (e) {
    throw new ProviderError('env_not_set', e.message);
  }
  if (!args.therapist.stripe_account_id) {
    throw new ProviderError('stripe_not_connected', 'Therapist has no stripe_account_id');
  }
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${STRIPE_SECRET}`,
    'Stripe-Account': args.therapist.stripe_account_id,
  };
  let bodyStr: string | undefined;
  if (args.body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    bodyStr = form(args.body).toString();
  }
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: args.method || 'GET',
    headers,
    body: bodyStr,
  });
  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.code || `http_${res.status}`;
    const message = data?.error?.message || `Stripe ${path} failed`;
    throw new ProviderError(code, message);
  }
  return data;
}

export class StripeProvider implements PaymentProvider {
  readonly name: ProviderName = 'stripe';
  readonly version: string = 'stripe-v1-2026-05';

  getCapability(op: Operation): Capability {
    // Stripe is the reference implementation. Everything is
    // first-class supported.
    const supported: Operation[] = [
      'createCheckoutLink',
      'createSubscriptionLink',
      'createSetupIntent',
      'verifyCheckout',
      'saveCardOnFile',
      'chargeSavedCard',
      'refund',
    ];
    if (supported.includes(op)) {
      return { status: 'supported', since: this.version };
    }
    return { status: 'unsupported' };
  }

  // ─── createCheckoutLink ──────────────────────────────────────────
  // Two modes: 'payment' (one-time) and 'subscription' (recurring).
  // Subscription path creates a Product + Price on the connected
  // account if no existingPriceId was passed, and persists the price
  // id back via the result so the caller can store it on the
  // membership row.
  async createCheckoutLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult> {
    const mode = args.mode || 'payment';

    if (mode === 'subscription') {
      return this.createSubscriptionLink(args);
    }

    // Payment mode: multi-line checkout session.
    const totalCents = args.items.reduce((s, it) => s + it.amountCents * (it.quantity || 1), 0);
    const body: Record<string, unknown> = {
      mode: 'payment',
      payment_method_types: ['card'],
      // HK May 31 2026: only include customer_email when actually
      // present. Empty string causes Stripe to reject with a
      // validation error, surfacing as "Invalid email address" when
      // the therapist chose SMS-only pay-link delivery.
      ...(args.customer?.email
        ? { customer_email: args.customer.email }
        : {}),
      success_url: `${args.redirectUrl}&checkout_complete=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl || `${args.redirectUrl}&checkout_canceled=1`,
      line_items: args.items.map((it) => ({
        price_data: {
          currency: 'usd',
          unit_amount: it.amountCents,
          product_data: {
            name: it.name,
            description: it.description || undefined,
            // CRITICAL: stamp itemId + caller metadata into the
            // product_data.metadata so verifyCheckout can recover
            // them. This is how the confirm step knows which
            // package_id each line was for.
            metadata: {
              ...(it.metadata || {}),
              item_id: it.itemId,
            },
          },
        },
        quantity: it.quantity || 1,
      })),
      metadata: args.metadata || {},
    };

    const session = await stripeFetch('/checkout/sessions', {
      method: 'POST',
      therapist: args.therapist,
      body,
    });

    return {
      url: session.url,
      providerSessionId: session.id,
      paymentRefId: session.id, // for Stripe payment mode, session id IS the verify key
      totalCents,
    };
  }

  // ─── createSubscriptionLink ───────────────────────────────────────
  // Internal helper, called when args.mode === 'subscription'.
  async createSubscriptionLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult> {
    if (!args.subscriptionPlan) {
      throw new ProviderError('missing_subscription_plan', 'mode=subscription requires subscriptionPlan');
    }
    const plan = args.subscriptionPlan;
    let priceId = plan.existingPriceId || null;
    let newPriceId: string | null = null;

    // Create the Stripe Product + Price on the fly if not reused.
    if (!priceId) {
      const product = await stripeFetch('/products', {
        method: 'POST',
        therapist: args.therapist,
        body: { name: plan.name },
      });
      const price = await stripeFetch('/prices', {
        method: 'POST',
        therapist: args.therapist,
        body: {
          product: product.id,
          unit_amount: plan.monthlyPriceCents,
          currency: 'usd',
          recurring: { interval: 'month' },
        },
      });
      priceId = price.id;
      newPriceId = price.id;
    }

    const body: Record<string, unknown> = {
      mode: 'subscription',
      payment_method_types: ['card'],
      // HK May 31 2026: omit customer_email when empty (SMS-only delivery)
      ...(args.customer?.email
        ? { customer_email: args.customer.email }
        : {}),
      success_url: `${args.redirectUrl}&checkout_complete=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl || `${args.redirectUrl}&checkout_canceled=1`,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: args.metadata || {},
      subscription_data: { metadata: args.metadata || {} },
    };

    const session = await stripeFetch('/checkout/sessions', {
      method: 'POST',
      therapist: args.therapist,
      body,
    });

    return {
      url: session.url,
      providerSessionId: session.id,
      paymentRefId: session.id,
      totalCents: plan.monthlyPriceCents,
      // Smuggle the new price id back so the caller can persist it.
      // (Returned on the result instead of via side-effect.)
      ...(newPriceId ? { newPriceId } : {}),
    } as CheckoutLinkResult;
  }

  // ─── verifyCheckout ──────────────────────────────────────────────
  // Pulls the session with line_items expanded so we can recover
  // itemIds. Differentiates payment vs subscription mode based on
  // session.mode.
  async verifyCheckout(args: { therapist: Therapist; paymentRefId: string }): Promise<VerifyResult> {
    const sessionId = args.paymentRefId;
    const session = await stripeFetch(
      `/checkout/sessions/${sessionId}?expand[]=line_items&expand[]=line_items.data.price.product&expand[]=subscription`,
      { therapist: args.therapist },
    );

    const paid = session.payment_status === 'paid';
    const status = session.payment_status;
    const totalCents = session.amount_total || 0;
    const customerEmail = session.customer_email || session.customer_details?.email || undefined;

    // Recover line items + their metadata.
    const lineItems: VerifiedLineItem[] = (session.line_items?.data || []).map((line: any) => {
      const productMeta = line.price?.product?.metadata || {};
      const itemId = productMeta.item_id || productMeta.package_id || '';
      return {
        itemId,
        amountCents: line.amount_total || (line.price?.unit_amount || 0) * (line.quantity || 1),
        metadata: productMeta,
      };
    }).filter((li: VerifiedLineItem) => li.itemId); // drop lines we can't identify

    const result: VerifyResult = {
      paid,
      status,
      totalCents,
      customerEmail,
      lineItems,
      paymentRefId: session.payment_intent || session.id,
    };

    // Subscription extras
    if (session.mode === 'subscription' && session.subscription) {
      const sub = typeof session.subscription === 'string'
        ? await stripeFetch(`/subscriptions/${session.subscription}`, { therapist: args.therapist })
        : session.subscription;
      result.subscriptionId = sub.id;
      result.subscriberCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (sub.current_period_end) {
        result.currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
      }
    }

    return result;
  }

  // ─── createSetupIntent ───────────────────────────────────────────
  // Creates a Stripe Customer if one doesn't exist for this email,
  // then issues a SetupIntent with off_session usage so the card
  // can be charged later (cancellation fees, etc.) without the
  // client present. Returns the client_secret for the frontend to
  // confirm via Stripe Elements.
  async createSetupIntent(args: SetupIntentArgs): Promise<SetupIntentResult> {
    const customerId = await this.findOrCreateCustomer(args.therapist, args.customer);
    const setupIntent = await stripeFetch('/setup_intents', {
      method: 'POST',
      therapist: args.therapist,
      body: {
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      },
    });
    return {
      clientSecret: setupIntent.client_secret,
      providerCustomerId: customerId,
      accountId: args.therapist.stripe_account_id!,
    };
  }

  // Helper: find by email or create. Used by both createSetupIntent
  // and saveCardOnFile.
  private async findOrCreateCustomer(therapist: Therapist, customer: { email: string; name?: string | null; phone?: string | null }): Promise<string> {
    const existing = await this.findCustomerByEmail(therapist, customer.email);
    if (existing) return existing;
    const created = await stripeFetch('/customers', {
      method: 'POST',
      therapist,
      body: {
        email: customer.email,
        name: customer.name || undefined,
        phone: customer.phone || undefined,
      },
    });
    return created.id;
  }

  // ─── saveCardOnFile ──────────────────────────────────────────────
  // Two-step: create or retrieve the customer, then attach the
  // payment method (or confirm a SetupIntent that already created
  // it).
  async saveCardOnFile(args: SaveCardArgs): Promise<SaveCardResult> {
    // Step 1: create or retrieve the customer.
    const customerId = await this.findOrCreateCustomer(args.therapist, args.customer);

    // Step 2: attach the payment method to the customer.
    // SetupIntent flow: the frontend has already confirmed the SetupIntent,
    // so the payment_method exists and is attached. We just verify and
    // pull its details.
    const pm = await stripeFetch(`/payment_methods/${args.paymentToken}`, {
      therapist: args.therapist,
    });

    if (pm.customer !== customerId) {
      // Attach if not already attached
      await stripeFetch(`/payment_methods/${args.paymentToken}/attach`, {
        method: 'POST',
        therapist: args.therapist,
        body: { customer: customerId },
      });
    }

    // Mark this PM as the default for invoices, future charges, etc.
    await stripeFetch(`/customers/${customerId}`, {
      method: 'POST',
      therapist: args.therapist,
      body: { invoice_settings: { default_payment_method: args.paymentToken } },
    });

    return {
      providerCustomerId: customerId,
      providerCardId: pm.id,
      last4: pm.card?.last4 || '????',
      brand: (pm.card?.brand || 'card').toLowerCase(),
    };
  }

  // Helper: find customer by email on the connected account.
  // Returns customer id or null.
  private async findCustomerByEmail(therapist: Therapist, email: string): Promise<string | null> {
    const result = await stripeFetch(`/customers?email=${encodeURIComponent(email)}&limit=1`, {
      therapist,
    });
    return result.data?.[0]?.id || null;
  }

  // ─── chargeSavedCard ─────────────────────────────────────────────
  // PaymentIntent with off_session=true to charge a saved card without
  // user action. Will fail with requires_action if the card needs SCA;
  // for cancellation fees on previously-set-up cards this is rare.
  async chargeSavedCard(args: ChargeArgs): Promise<ChargeResult> {
    const intent = await stripeFetch('/payment_intents', {
      method: 'POST',
      therapist: args.therapist,
      body: {
        amount: args.amountCents,
        currency: 'usd',
        customer: args.providerCustomerId,
        payment_method: args.providerCardId,
        confirm: true,
        off_session: true,
        description: args.description || undefined,
        receipt_email: args.receiptEmail || undefined,
        metadata: { idempotency_key: args.idempotencyKey },
      },
    });

    return {
      paid: intent.status === 'succeeded',
      paymentRefId: intent.id,
      amountCents: intent.amount_received || args.amountCents,
    };
  }

  // ─── refund ──────────────────────────────────────────────────────
  async refund(args: RefundArgs): Promise<RefundResult> {
    const body: Record<string, unknown> = {
      payment_intent: args.paymentRefId,
      reason: args.reason || undefined,
      metadata: { idempotency_key: args.idempotencyKey },
    };
    if (args.amountCents !== undefined) {
      body.amount = args.amountCents;
    }
    const refund = await stripeFetch('/refunds', {
      method: 'POST',
      therapist: args.therapist,
      body,
    });
    return {
      refunded: refund.status === 'succeeded' || refund.status === 'pending',
      refundId: refund.id,
      amountCents: refund.amount,
    };
  }
}
