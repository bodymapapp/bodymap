// openExternal.js
//
// Opens a URL in a new browser tab/window across desktop browsers,
// mobile Safari, and PWAs added to the iOS home screen.
//
// Why this exists: iOS PWAs (added to home screen) hijack anchor tags
// with target="_blank" and open them in the same PWA window, breaking
// the user's flow when they tap "Open booking page" to see the public
// page and can't get back to their Dashboard. window.open() with the
// '_blank' target forces iOS to delegate to the system browser (Safari)
// which opens a fresh window the user can switch between via the OS
// app switcher.
//
// Use this helper anywhere you'd previously have used
// <a target="_blank" rel="noopener noreferrer">. Call it from an
// onClick handler and call event.preventDefault() so the default
// anchor navigation does not also fire.
//
// HK May 25 2026: PWA confirmed as HK's iPhone access pattern.
// 'Everyone has PWA downloaded as far as clients are concerned' so
// the bug applies to therapists AND their clients in the PWA shell.

export function openExternal(url) {
  if (!url) return;
  try {
    // window.open with the noopener feature flag prevents the new
    // window from accessing window.opener, matching the security
    // posture of rel="noopener noreferrer" on anchors.
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) return;
  } catch (_) { /* fall through to location fallback */ }
  // If popup was blocked or window.open returned null (rare on iOS
  // with strict popup blocking), fall back to a same-tab navigation
  // so the user still reaches the page rather than getting stuck.
  // This is not the desired UX but is better than silent failure.
  window.location.href = url;
}

// Inline onClick handler factory for anchors. Use as:
//   <a href={url} target="_blank" rel="noopener noreferrer"
//      onClick={openExternalClick(url)}>...
// The href + target attributes stay as a non-JS fallback. The
// onClick takes priority and uses window.open for reliable PWA
// behavior.
export function openExternalClick(url) {
  return (event) => {
    event.preventDefault();
    event.stopPropagation();
    openExternal(url);
  };
}
