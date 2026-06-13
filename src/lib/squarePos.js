// src/lib/squarePos.js
//
// Square Point of Sale "Tap to Pay" handoff from our mobile web app.
//
// There is no way to tap a card directly on the phone from a website (that
// is an Apple/Google operating-system feature reached only from a native
// app). Square's Point of Sale API is the supported path: we open the
// therapist's installed Square Point of Sale app pre-filled with the
// amount, they tap the client's card, and Square hands control back to our
// callback URL with a transaction id. We then confirm that charge
// server-side (square-pos-reconcile) before recording anything as paid.
//
// This module only builds the handoff link and reads the result. It never
// decides that money changed hands; that is the server's job.

const POS_API_VERSION_IOS = '1.3';
const POS_API_VERSION_ANDROID = 'v2.0';

export function isAndroid() {
  return /android/i.test(navigator.userAgent || '');
}
export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
}
export function isMobileDevice() {
  return isAndroid() || isIOS();
}

// Build the deep link that opens Square Point of Sale to charge a card in
// person. `state` is our own reference string echoed back on return so we
// can tie the result to the right booking.
export function buildSquarePosDeepLink({ applicationId, locationId, amountCents, callbackUrl, note, state }) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  const currency = 'USD';
  const safeNote = (note || 'MyBodyMap session').slice(0, 500);

  if (isAndroid()) {
    // Android uses an Intent URL with typed extras (S. = string, i. = int).
    const extras = [
      'action=com.squareup.pos.action.CHARGE',
      'package=com.squareup',
      `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(callbackUrl)}`,
      `S.com.squareup.pos.CLIENT_ID=${encodeURIComponent(applicationId)}`,
      `S.com.squareup.pos.API_VERSION=${POS_API_VERSION_ANDROID}`,
      `i.com.squareup.pos.TOTAL_AMOUNT=${amount}`,
      `S.com.squareup.pos.CURRENCY_CODE=${currency}`,
      'S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CARD_ON_FILE',
      `S.com.squareup.pos.LOCATION_ID=${encodeURIComponent(locationId)}`,
      `S.com.squareup.pos.NOTE=${encodeURIComponent(safeNote)}`,
      `S.com.squareup.pos.REQUEST_METADATA=${encodeURIComponent(state)}`,
    ].join(';');
    return `intent:#Intent;${extras};end`;
  }

  // iOS (and the default): the square-commerce-v1 scheme with a JSON data
  // payload. Card-present tender types only; this is an in-person charge.
  const data = {
    amount_money: { amount, currency_code: currency },
    callback_url: callbackUrl,
    client_id: applicationId,
    version: POS_API_VERSION_IOS,
    notes: safeNote,
    options: { supported_tender_types: ['CREDIT_CARD', 'CARD_ON_FILE'] },
    location_id: locationId,
    state,
  };
  return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
}

// Read Square's result out of the callback URL's query string. Handles both
// the iOS `data` JSON payload and the Android typed query params. Returns
// { ok, transactionId, state, errorCode } where ok means Square reported a
// completed transaction. ok:true here still gets verified server-side; we
// never treat it as proof of payment on its own.
export function parseSquarePosReturn(search) {
  const params = new URLSearchParams(search || '');

  // iOS web callback: a single `data` param holding JSON.
  const dataRaw = params.get('data');
  if (dataRaw) {
    try {
      const j = JSON.parse(dataRaw);
      const errorCode = j.error_code || j.errorCode || null;
      const txn = j.transaction_id || j.transactionId || null;
      const status = (j.status || '').toLowerCase();
      return {
        ok: !errorCode && !!txn && (status === '' || status === 'ok'),
        transactionId: txn,
        state: j.state || null,
        errorCode,
      };
    } catch {
      return { ok: false, transactionId: null, state: null, errorCode: 'parse_error' };
    }
  }

  // Android web callback: typed query params.
  const serverTxn = params.get('com.squareup.pos.SERVER_TRANSACTION_ID');
  const androidError = params.get('com.squareup.pos.ERROR_CODE');
  const androidState = params.get('com.squareup.pos.REQUEST_METADATA');
  if (serverTxn || androidError || androidState) {
    return {
      ok: !androidError && !!serverTxn,
      transactionId: serverTxn || null,
      state: androidState || null,
      errorCode: androidError || null,
    };
  }

  return null; // not a Square return
}

// sessionStorage bridge: the page reloads when Square hands back, so the
// in-flight booking context is stashed under a fixed key and recovered on
// return. The nonce in `state` must match what we stored.
const PENDING_KEY = 'mbm_square_pos_pending';

export function stashSquarePosPending(ctx) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...ctx, ts: Date.now() }));
  } catch { /* ignore */ }
}
export function readSquarePosPending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearSquarePosPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}
