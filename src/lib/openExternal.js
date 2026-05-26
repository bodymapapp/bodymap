// openExternal.js
//
// Opens a URL in a new browser tab/window across desktop browsers,
// mobile Safari, and iOS PWAs added to the iOS home screen.
//
// THE iOS-PWA PROBLEM (HK reported multiple times May 24-26 2026):
// In a standalone iOS PWA, window.open(url, '_blank', ...) does NOT
// reliably escape the PWA shell. iOS treats the call as in-app
// navigation, evicting the page the user was on and replacing it
// with the booking page. The user loses their place in the dashboard.
// Symptom: 'I tap Open booking page, the dashboard disappears.'
//
// THE FIX (working approach that survives PWA shell):
// Synthesize a real anchor element with target='_blank' and rel set
// for popup safety, then programmatically click it. iOS treats a real
// anchor click as an explicit user-initiated external navigation and
// hands it off to Safari proper, leaving the PWA shell intact.
//
// This is the same trick libraries like FileSaver.js use to get
// downloads to escape PWAs reliably.
//
// HK May 26 2026: window.open approach failed despite the round 2
// hotfix. Switching to the anchor-click approach.

function clickAnchor(url) {
  // Build an anchor that simulates a deliberate user click. The
  // element is detached after click so it does not litter the DOM.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  // Some iOS Safari versions only treat the click as user-initiated
  // when the anchor is in the document. Attach, click, then remove.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Defer the remove so iOS finishes processing the click. Immediate
  // remove can race the navigation handoff on older WebKit.
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 100);
}

export function openExternal(url) {
  if (!url) return;
  try {
    clickAnchor(url);
  } catch (_) {
    // Last-resort fallback only if synthesized anchor click throws.
    // Better to navigate the current tab than to do nothing.
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (__) {
      window.location.href = url;
    }
  }
}

// Inline onClick handler factory for anchors. Use as:
//   <a href={url} target="_blank" rel="noopener noreferrer"
//      onClick={openExternalClick(url)}>...
// The href + target attributes stay as a non-JS fallback. The
// onClick takes priority and uses the anchor-click trick for
// reliable PWA behavior.
export function openExternalClick(url) {
  return (event) => {
    event.preventDefault();
    event.stopPropagation();
    openExternal(url);
  };
}
