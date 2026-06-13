// src/pages/FeaturesV2.jsx
//
// FeaturesV2 — the new Features page (Atlas + Features merged).
// 7 horizontal ribbons, 36 lifestyle-photo cards, modal on tap.
// Built mobile-first. No section nav. No scroll-to-section. The vertical
// scroll IS the navigation between categories.
//
// Currently lives at /features-v2 alongside the existing /features route.
// Once approved, swap the routes in App.js to make this the default.

import React, { useState, useCallback, useEffect } from "react";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import HelpWidget from "../components/HelpWidget";
import FeatureRibbon from "../components/FeatureRibbon";
import FeatureModal from "../components/FeatureModal";
import {
  RIBBONS,
  TOTAL_FEATURES,
  TOTAL_CATEGORIES,
} from "../data/featuresData";

export default function FeaturesV2() {
  const [activeCard, setActiveCard] = useState(null);
  const [activeRibbon, setActiveRibbon] = useState(null);

  const handleTap = useCallback((card, ribbon) => {
    setActiveCard(card);
    setActiveRibbon(ribbon);
  }, []);

  const handleClose = useCallback(() => {
    setActiveCard(null);
  }, []);

  // SEO: set page title
  useEffect(() => {
    const previous = document.title;
    document.title = "Features · MyBodyMap";
    return () => {
      document.title = previous;
    };
  }, []);

  // Scroll to ribbon anchor on mount or hash change.
  // Lets Home page deep-link to /features#ribbon-1 etc.
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      // Wait one frame so the ribbons have rendered.
      requestAnimationFrame(() => {
        const el = document.getElementById(hash.replace("#", ""));
        if (el) {
          // 90px offset to clear the fixed nav (~74px) + breathing.
          const top = el.getBoundingClientRect().top + window.pageYOffset - 90;
          window.scrollTo({ top, behavior: "smooth" });
        }
      });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="bm-features-v2">
      <Nav />

      <header className="bm-features-v2-head">
        <div className="bm-features-v2-eyebrow">Everything in one place</div>
        <h1 className="bm-features-v2-title">
          Keep every client <em>coming back.</em>
        </h1>
        <div className="bm-features-v2-stats">
          <span>
            <span className="bm-features-v2-stat-num">{TOTAL_FEATURES}</span>
            <span className="bm-features-v2-stat-label">features</span>
          </span>
          <span className="bm-features-v2-stat-divider">·</span>
          <span>
            <span className="bm-features-v2-stat-num">{TOTAL_CATEGORIES}</span>
            <span className="bm-features-v2-stat-label">categories</span>
          </span>
        </div>
        <p className="bm-features-v2-sub">
          One quiet platform built for therapists who would rather spend the
          hour on the table than at the desk.
        </p>
      </header>

      <main className="bm-features-v2-body">
        {RIBBONS.map((ribbon) => (
          <FeatureRibbon
            key={ribbon.id}
            ribbon={ribbon}
            onTap={(card) => handleTap(card, ribbon)}
          />
        ))}
      </main>

      <section className="bm-features-v2-closing">
        <h2>
          Built by therapists, for <em>therapists.</em>
        </h2>
        <p>
          Free for early therapists by invitation. Silver tier, all
          features, forever.
        </p>
        <a href="/signup" className="bm-features-v2-cta">
          Start free →
        </a>
      </section>

      <Footer />
      <HelpWidget />

      <FeatureModal
        card={activeCard}
        ribbon={activeRibbon}
        onClose={handleClose}
      />
    </div>
  );
}
