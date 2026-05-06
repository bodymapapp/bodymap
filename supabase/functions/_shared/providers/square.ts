// supabase/functions/_shared/providers/square.ts
//
// Square implementation of PaymentProvider.
//
// What Square supports today (per the strategic reframe):
//   ✓ createCheckoutLink (payment mode only)
//   ✓ verifyCheckout
//   ✗ createSubscriptionLink — no clean Square equivalent of Stripe
//     subscription mode
//   ✗ saveCardOnFile — would need Square Web Payments SDK on the
//     frontend; not on the roadmap (Stripe is the online engine)
//   ✗ chargeSavedCard — depends on saveCardOnFile
//   ✓ refund (eventually) — currently throws; can be implemented
//     when the first refund use case ships
//
// Self-healing:
//   Square's online OAuth gives us an access_token but historically
//   did not always persist a location_id on the therapist row.
//   loadLocation() heals this transparently on first use by hitting
//   /v2/locations and writing back.

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

const SQUARE_API = 'https://connect.squareup.com';
const SQUARE_VERSION = '2024-01-18';

// Internal: standard authenticated fetch.
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
  if (args.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${SQUARE_API}${path}`, {
    method: args.method || 'GET',
    headers,
    body: args.body ? JSON.stringify(args.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const code = data?.errors?.[0]?.code || `http_${res.status}`;
    const detail = data?.errors?.[0]?.detail || `Square ${path} failed`;
    throw new ProviderError(code, detail);
  }
  return data;
}

// Internal: ensure therapist has square_location_id, healing if not.
// Returns the location id. Persists back to the therapists row when
// healing.
async function loadLocation(therapist: Therapist): Promise<string> {
  if (therapist.square_location_id) return therapist.square_location_id;

  // Heal: fetch from Square API + persist.
  console.log('[square-provider] location_id missing, healing via /v2/locations');
  const data = await squareFetch('/v2/locations', { therapist });
  const locs = data.locations || [];
  const active = locs.find((l: any) => l.status === 'ACTIVE') || locs[0];
  if (!active?.id) {
    throw new ProviderError('no_locations', 'Square account has no locations');
  }

  const supabase = getSupabaseClient();
  await supabase
    .from('therapists')
    .update({ square_location_id: active.id })
    .eq('id', therapist.id);

  // Mutate the local therapist object so subsequent uses in this
  // request don't re-fetch.
  (therapist as any).square_location_id = active.id;

  return active.id;
}

export class SquareProvider implements PaymentProvider {
  readonly name: ProviderName = 'square';

  supportsOperation(op: Operation): boolean {
    // Honest about gaps. Card-on-file and subscriptions are not
    // implemented today by strategic choice (Stripe = online engine).
    return ['createCheckoutLink', 'verifyCheckout', 'refund'].includes(op);
  }

  // ─── createCheckoutLink ──────────────────────────────────────────
  // Subscription mode is not supported. Caller should check
  // supportsOperation('createSubscriptionLink') first.
  async createCheckoutLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult> {
    if (args.mode === 'subscription') {
      throw new ProviderError(
        'subscription_unsupported',
        'Square does not support subscription mode in this integration. Memberships require Stripe.'
      );
    }

    const locationId = await loadLocation(args.therapist);
    const totalCents = args.items.reduce((s, it) => s + it.amountCents * (it.quantity || 1), 0);

    // Single-line: use quick_pay (simpler API, single product on
    // checkout page). Multi-line: use order with line_items.
    const isSingleLine = args.items.length === 1 && (args.items[0].quantity || 1) === 1;
    let body: Record<string, unknown>;

    if (isSingleLine) {
      const it = args.items[0];
      body = {
        idempotency_key: `chk-${args.therapist.id}-${args.customer.email}-${Date.now()}`,
        quick_pay: {
          name: it.name,
          price_money: { amount: it.amountCents, currency: 'USD' },
          location_id: locationId,
        },
        checkout_options: {
          ask_for_shipping_address: false,
          // Square will append `?orderId=...` on success. We don't
          // need to inject a placeholder like Stripe does.
          redirect_url: `${args.redirectUrl}&checkout_complete=1&processor=square`,
        },
        pre_populated_data: { buyer_email: args.customer.email },
        description: it.description || undefined,
      };
    } else {
      body = {
        idempotency_key: `chk-${args.therapist.id}-${args.customer.email}-${Date.now()}`,
        order: {
          location_id: locationId,
          line_items: args.items.map((it) => ({
            name: it.name,
            quantity: String(it.quantity || 1),
            base_price_money: { amount: it.amountCents, currency: 'USD' },
            note: it.description || undefined,
            // CRITICAL: stamp itemId + caller metadata into the line
            // metadata so verifyCheckout can recover them.
            metadata: { ...(it.metadata || {}), item_id: it.itemId },
          })),
        },
        checkout_options: {
          ask_for_shipping_address: false,
          redirect_url: `${args.redirectUrl}&checkout_complete=1&processor=square`,
        },
        pre_populated_data: { buyer_email: args.customer.email },
      };
    }

    const data = await squareFetch('/v2/online-checkout/payment-links', {
      method: 'POST',
      therapist: args.therapist,
      body,
    });

    const link = data.payment_link;
    if (!link?.url) {
      throw new ProviderError('no_url_returned', 'Square returned no checkout URL');
    }

    return {
      url: link.url,
      providerSessionId: link.id,
      // For verifyCheckout, we need the order id (NOT the link id) —
      // /v2/orders/{id} is what tells us payment status.
      paymentRefId: link.order_id,
      totalCents,
    };
  }

  // ─── verifyCheckout ──────────────────────────────────────────────
  // Pull the Order, check state=COMPLETED. Walk line_items for our
  // metadata so we can recover itemIds.
  //
  // Note for single-line checkouts (quick_pay): Square's quick_pay
  // does NOT preserve our item_id metadata on the line item. For
  // those, the caller has to know what was bought from session-level
  // metadata or context. Multi-line orders DO preserve it. Calling
  // code should prefer multi-line when itemId recovery matters.
  async verifyCheckout(args: { therapist: Therapist; paymentRefId: string }): Promise<VerifyResult> {
    const orderId = args.paymentRefId;
    const data = await squareFetch(`/v2/orders/${orderId}`, { therapist: args.therapist });
    const order = data.order;
    if (!order) {
      throw new ProviderError('order_not_found', `Square order ${orderId} not found`);
    }

    const paid = order.state === 'COMPLETED';
    const totalCents = order.total_money?.amount || 0;

    const lineItems: VerifiedLineItem[] = (order.line_items || []).map((line: any) => ({
      itemId: line.metadata?.item_id || line.metadata?.package_id || '',
      amountCents: line.total_money?.amount || 0,
      metadata: line.metadata || {},
    })).filter((li: VerifiedLineItem) => li.itemId);

    return {
      paid,
      status: order.state,
      totalCents,
      lineItems,
      paymentRefId: orderId,
      // No customerEmail field on Square orders by default; would
      // require fetching the associated payment. Left undefined.
    };
  }

  // ─── saveCardOnFile ──────────────────────────────────────────────
  // Not implemented. Stripe is the online engine for card-on-file.
  async createSetupIntent(_args: SetupIntentArgs): Promise<SetupIntentResult> {
    throw new ProviderError(
      'square_setup_intent_unsupported',
      'Card-on-file capture is handled by Stripe in this integration. Square is for in-person work.'
    );
  }

  async saveCardOnFile(_args: SaveCardArgs): Promise<SaveCardResult> {
    throw new ProviderError(
      'square_save_card_unsupported',
      'Card-on-file is handled by Stripe in this integration. Square is for in-person work.'
    );
  }

  // ─── chargeSavedCard ─────────────────────────────────────────────
  // Not implemented. Depends on saveCardOnFile being available.
  async chargeSavedCard(_args: ChargeArgs): Promise<ChargeResult> {
    throw new ProviderError(
      'square_charge_unsupported',
      'Card-on-file charging is handled by Stripe. Square is for in-person work.'
    );
  }

  // ─── refund ──────────────────────────────────────────────────────
  // Implemented placeholder. The Square refund API requires a
  // payment_id (NOT order_id), which we'd need to fetch first. Wired
  // for the day we ship Square refunds; throws today.
  async refund(args: RefundArgs): Promise<RefundResult> {
    // Step 1: order -> first payment id
    const orderData = await squareFetch(`/v2/orders/${args.paymentRefId}`, { therapist: args.therapist });
    const tenders = orderData.order?.tenders || [];
    const paymentId = tenders[0]?.payment_id;
    if (!paymentId) {
      throw new ProviderError('no_payment_for_order', 'Square order has no associated payment');
    }

    // Step 2: refund the payment
    const refundBody: Record<string, unknown> = {
      idempotency_key: args.idempotencyKey,
      payment_id: paymentId,
      reason: args.reason || undefined,
    };
    if (args.amountCents !== undefined) {
      refundBody.amount_money = { amount: args.amountCents, currency: 'USD' };
    } else {
      // Square requires amount_money even for full refunds. Default
      // to the order total.
      refundBody.amount_money = orderData.order?.total_money || { amount: 0, currency: 'USD' };
    }
    const refundData = await squareFetch('/v2/refunds', {
      method: 'POST',
      therapist: args.therapist,
      body: refundBody,
    });
    const refund = refundData.refund;
    return {
      refunded: refund?.status === 'COMPLETED' || refund?.status === 'PENDING',
      refundId: refund?.id || '',
      amountCents: refund?.amount_money?.amount || 0,
    };
  }
}
