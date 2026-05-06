// supabase/functions/_shared/providers/square.ts
//
// Public SquareProvider — thin facade that delegates every operation
// to a versioned SquareStrategy implementation. Today the strategy
// is hard-coded to V1; future revisions plug in a different strategy
// (V2, V3, etc) without changing call sites.
//
// Why this shape:
//   1. The PaymentProvider interface stays stable for edge functions
//      that import SquareProvider — they don't know or care about
//      versioning.
//   2. New strategies (e.g. when Square ships a unified payment
//      primitive in 2027) drop in alongside V1 in providers/square/.
//      We migrate therapists gradually via feature flag, never a
//      big-bang.
//   3. A/B-able. We can run V1 for some therapists and V2 for others
//      while measuring error rates.
//
// To add a future strategy:
//   1. Create providers/square/v2.ts implementing SquareStrategy
//   2. Import here, add to the strategy selector below
//   3. Use `therapist.payment_routing.square_strategy` (or similar
//      flag) to pick

import {
  PaymentProvider, ProviderName, Operation, Capability, Therapist,
  CheckoutLinkArgs, CheckoutLinkResult,
  VerifyResult,
  SetupIntentArgs, SetupIntentResult,
  SaveCardArgs, SaveCardResult,
  ChargeArgs, ChargeResult,
  RefundArgs, RefundResult,
} from '../payment-provider.ts';
import type { SquareStrategy } from './square/strategy.ts';
import { SquareV1Strategy } from './square/v1.ts';

// Strategy selector. Add cases here when a new SquareStrategy
// version ships. Default falls through to V1.
function selectStrategy(_therapist?: Therapist): SquareStrategy {
  // Future:
  //   if (therapist?.payment_routing?.square_strategy === 'v2') {
  //     return new SquareV2Strategy();
  //   }
  return new SquareV1Strategy();
}

export class SquareProvider implements PaymentProvider {
  readonly name: ProviderName = 'square';
  readonly version: string;
  private strategy: SquareStrategy;

  constructor(therapist?: Therapist) {
    this.strategy = selectStrategy(therapist);
    this.version = this.strategy.version;
  }

  getCapability(op: Operation): Capability {
    return this.strategy.getCapability(op);
  }

  createCheckoutLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult> {
    return this.strategy.createCheckoutLink(args);
  }

  verifyCheckout(args: { therapist: Therapist; paymentRefId: string }): Promise<VerifyResult> {
    return this.strategy.verifyCheckout(args);
  }

  createSetupIntent(args: SetupIntentArgs): Promise<SetupIntentResult> {
    return this.strategy.createSetupIntent(args);
  }

  saveCardOnFile(args: SaveCardArgs): Promise<SaveCardResult> {
    return this.strategy.saveCardOnFile(args);
  }

  chargeSavedCard(args: ChargeArgs): Promise<ChargeResult> {
    return this.strategy.chargeSavedCard(args);
  }

  refund(args: RefundArgs): Promise<RefundResult> {
    return this.strategy.refund(args);
  }
}
