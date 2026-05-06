// supabase/functions/_shared/providers/square/strategy.ts
//
// Internal strategy interface for SquareProvider versioning. The
// public SquareProvider class delegates every method to a
// SquareStrategy instance. Today there's only V1; tomorrow when
// Square ships a better recurring billing primitive (or deprecates
// Web Payments SDK), we add V2 alongside V1 and migrate therapists
// gradually via feature flag.
//
// This is the "way out" HK asked for: never paint ourselves into a
// corner with one rigid implementation.
//
// Why a separate file:
//   - Keeps the public SquareProvider class small and readable
//   - Each strategy version lives in its own file (square-v1.ts,
//     square-v2.ts) — diff between versions is clean
//   - Strategy modules can share helpers via this file or its
//     siblings without polluting the public API
//
// Naming convention:
//   SquareV1Strategy = current implementation (Web Payments SDK +
//     Subscriptions API + Payment Links + Locations API)
//   Future SquareV2Strategy might use Square's newer In-Person
//     SDK, a unified Catalog approach, etc.
//
// The interface mirrors PaymentProvider but works on therapist-
// scoped operations only (no name/version property — those belong
// to the public provider class).

import type {
  Therapist,
  CheckoutLinkArgs, CheckoutLinkResult,
  VerifyResult, SetupIntentArgs, SetupIntentResult,
  SaveCardArgs, SaveCardResult,
  ChargeArgs, ChargeResult,
  RefundArgs, RefundResult,
  Capability, Operation,
} from '../../payment-provider.ts';

export interface SquareStrategy {
  // Version string. Surfaced to the capability matrix so the UI
  // can show "Square card-on-file (v1)".
  readonly version: string;

  // Capability matrix for this specific Square strategy version.
  // V1 today: card-on-file 'limited' (Web Payments SDK has stricter
  // browser support than Stripe Elements), subscriptions 'limited'
  // (no proration, weaker dunning).
  getCapability(op: Operation): Capability;

  createCheckoutLink(args: CheckoutLinkArgs): Promise<CheckoutLinkResult>;
  verifyCheckout(args: { therapist: Therapist; paymentRefId: string }): Promise<VerifyResult>;
  createSetupIntent(args: SetupIntentArgs): Promise<SetupIntentResult>;
  saveCardOnFile(args: SaveCardArgs): Promise<SaveCardResult>;
  chargeSavedCard(args: ChargeArgs): Promise<ChargeResult>;
  refund(args: RefundArgs): Promise<RefundResult>;
}
