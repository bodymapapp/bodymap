// src/components/FeatureRibbon.jsx
import FeatureCard from "./FeatureCard";

/**
 * FeatureRibbon — one horizontal row of cards for a single category.
 * Shows the category number, title, tagline, and feature count.
 * Scrolls horizontally on touch and trackpad.
 *
 * Props:
 *   ribbon  : ribbon object (id, name, tagline, cards)
 *   onTap   : function called with the tapped card
 */
export default function FeatureRibbon({ ribbon, onTap }) {
  return (
    <section className="bm-feature-ribbon">
      <header className="bm-feature-ribbon__head">
        <span className="bm-feature-ribbon__num">{ribbon.id}</span>
        <div className="bm-feature-ribbon__titles">
          <h2 className="bm-feature-ribbon__title">{ribbon.name}</h2>
          <p className="bm-feature-ribbon__tag">{ribbon.tagline}</p>
          <p className="bm-feature-ribbon__count">
            {ribbon.cards.length} features
          </p>
        </div>
      </header>
      <div className="bm-feature-ribbon__scroller">
        {ribbon.cards.map((card) => (
          <FeatureCard key={card.id} card={card} onTap={onTap} />
        ))}
      </div>
    </section>
  );
}
