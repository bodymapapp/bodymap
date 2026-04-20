// src/components/ScrollToTop.js
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // Defensive: clear any stuck scroll lock from prior mobile drawer/modal
    // (iOS Safari can latch document.body.style.overflow='hidden' under race conditions)
    try {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    } catch (e) {}
  }, [pathname]);
  return null;
}
