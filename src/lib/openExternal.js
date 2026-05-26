// openExternal.js
//
// Opens a URL across desktop browsers, mobile Safari, and iOS PWAs.
//
// THE iOS-PWA PROBLEM (HK reported multiple times May 24-26 2026):
// In a standalone iOS PWA, NEITHER window.open(url, '_blank') NOR a
// synthesized anchor click with target='_blank' reliably hands the
// URL off to Safari. iOS hijacks the navigation, kills the dashboard
// page the therapist was on, and replaces it with the booking page
// inside the same PWA shell. The user has no way back.
//
// THE FIX (May 26 2026 round 3, after the anchor-click trick also
// failed to escape on HK's iPhone):
// Detect standalone PWA mode and use IN-APP navigation instead of
// attempting to escape to Safari. iOS users expect back-gesture or
// in-app back navigation; respecting that pattern preserves the
// therapist's place because the dashboard sits in the history stack.
//
// In a regular browser tab, keep the new-tab behavior because users
// there expect a separate tab they can return to via tab switcher.

function isStandalonePwa() {
  // iOS Safari sets navigator.standalone when added to home screen.
  // Modern browsers expose the display-mode media query.
  try {
    if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    }
  } catch (_) {}
  return false;
}

function clickAnchorBlank(url) {
  // For non-PWA: build an anchor with target='_blank' and click it.
  // Browsers honor this as a new-tab request. The anchor is detached
  // after click so it does not litter the DOM.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 100);
}

export function openExternal(url) {
  if (!url) return;

  if (isStandalonePwa()) {
    // In-PWA navigation. Pushes to the history stack so the iOS back
    // gesture or any in-page Back button returns the therapist to
    // their previous page (the dashboard). This is the iOS-native
    // pattern and the only path that reliably preserves the user's
    // place in a standalone PWA.
    //
    // The query param `from=pwa` lets the destination page render an
    // in-app Back affordance if it wants to.
    const sep = url.includes('?') ? '&' : '?';
    window.location.href = `${url}${sep}from=pwa`;
    return;
  }

  // Regular browser: open in a new tab. Anchor click trick is more
  // reliable than window.open across browsers and respects popup
  // blockers correctly when called from a real user gesture.
  try {
    clickAnchorBlank(url);
  } catch (_) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (__) {
      window.location.href = url;
    }
  }
}

export function openExternalClick(url) {
  return (event) => {
    event.preventDefault();
    event.stopPropagation();
    openExternal(url);
  };
}
