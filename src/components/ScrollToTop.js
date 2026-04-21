// src/components/ScrollToTop.js
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
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
  }, [pathname]);
  return null;
}
