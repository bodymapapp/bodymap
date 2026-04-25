// src/components/FeatureCard.jsx
import { memo } from "react";
import { photoForId } from "../data/featuresData";

/**
 * FeatureCard — single tile inside a horizontal ribbon.
 * Shows a full-bleed photo, the feature ID/name overlaid on a gradient,
 * and an optional "automated" pill badge in the top-right.
 *
 * Props:
 *   card    : feature card object (id, name, automated)
 *   onTap   : function called with the card when user taps
 */
function FeatureCard({ card, onTap }) {
  const photo = photoForId(card.id);

  return (
    <button
      type="button"
      className="bm-feature-card"
      onClick={() => onTap(card)}
      aria-label={`${card.name}. Tap to learn more.`}
    >
      {card.automated && (
        <span className="bm-feature-card__badge">
          <SparkleIcon /> automated
        </span>
      )}
      <div
        className="bm-feature-card__photo"
        style={{ backgroundImage: `url(${photo})` }}
      />
      <div className="bm-feature-card__body">
        <div className="bm-feature-card__id">{card.id}</div>
        <div className="bm-feature-card__title">{card.name}</div>
      </div>
    </button>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0l1.2 4.8L12 6l-4.8 1.2L6 12l-1.2-4.8L0 6l4.8-1.2z" />
    </svg>
  );
}

export default memo(FeatureCard);
