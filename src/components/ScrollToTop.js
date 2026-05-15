// src/components/ScrollToTop.js
import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Scroll behavior across route changes:
// - Forward navigation (PUSH, REPLACE) -> scroll to top, fresh view
// - Browser back (POP) -> restore the position the user was at on that
//   route, so going Dashboard -> Settings 4.3 -> Edit Intake -> Back
//   lands you exactly where you left Settings 4.3, not at the top.
//
// HK May 14 2026: 'when I go to a page and hit back to come to settings
// page for example from setting 4.3, it takes me to top of settings
// when it should only go back to whatever I was viewing earlier.'
//
// Implementation: stash scrollY in sessionStorage keyed by pathname on
// every navigation away. On POP, restore from that key. On PUSH or
// REPLACE, scroll to top. sessionStorage so it survives reload but
// doesn't bloat localStorage forever.

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  // Save scroll position when leaving a route
  useEffect(() => {
    function save() {
      try {
        sessionStorage.setItem(`bm:scroll:${pathname}`, String(window.scrollY));
      } catch (e) {}
    }
    // Save on every scroll (debounced) and on unmount
    let timer = null;
    function onScroll() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 150);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
      save();
    };
  }, [pathname]);

  // On route change: restore on POP, otherwise scroll to top
  useEffect(() => {
    if (navType === 'POP') {
      // Browser back/forward. Restore saved position for this pathname.
      let saved = 0;
      try {
        saved = parseInt(sessionStorage.getItem(`bm:scroll:${pathname}`) || '0', 10) || 0;
      } catch (e) {}
      // Defer to next frame so the new route's DOM is laid out before
      // we attempt to scroll. Otherwise the page may still be 0-height.
      requestAnimationFrame(() => {
        window.scrollTo(0, saved);
      });
    } else {
      // PUSH or REPLACE: fresh navigation, start at top
      window.scrollTo(0, 0);
    }
    // Defensive: clear any stuck inline overflow on html/body. This heals
    // users who visited Features with the broken commit that set
    // overflowY:auto on both, which created nested scroll containers
    // and froze the whole site. Running on every navigation means
    // existing users are healed on their next page change without
    // needing any console command.
    try {
      document.body.style.overflow = '';
      document.body.style.overflowY = '';
      document.body.style.overflowX = '';
      document.body.style.position = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overflowY = '';
      document.documentElement.style.overflowX = '';
    } catch (e) {}
  }, [pathname, navType]);

  return null;
}
