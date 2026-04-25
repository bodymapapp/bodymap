// src/components/FeatureModal.jsx
import { useEffect, useCallback } from "react";
import { photoForId } from "../data/featuresData";

/**
 * FeatureModal — bottom-sheet modal that opens when a card is tapped.
 * Shows a full-bleed photo hero, automated badge if applicable,
 * the category tag, the feature title, body paragraphs, and a meta line.
 *
 * Future-proofed: if card.supademo is set, the photo hero is replaced with
 * an iframe pointing to that URL. Same dimensions, no design changes.
 *
 * Props:
 *   card     : the card to display, or null if modal is closed
 *   ribbon   : the parent ribbon (used for category label)
 *   onClose  : function to close the modal
 */
export default function FeatureModal({ card, ribbon, onClose }) {
  const isOpen = !!card;

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  const handleKey = useCallback(
    (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    },
    [isOpen, onClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Close when backdrop is tapped (but not when the modal itself is tapped)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={`bm-feature-modal-backdrop${isOpen ? " is-open" : ""}`}
      onClick={handleBackdropClick}
      aria-hidden={!isOpen}
    >
      {card && (
        <div
          className="bm-feature-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bm-feature-modal-title"
        >
          <div className="bm-feature-modal__visual">
            {card.supademo ? (
              <iframe
                src={card.supademo}
                title={card.name}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <div
                className="bm-feature-modal__photo"
                style={{
                  backgroundImage: `url(${photoForId(card.id)})`,
                }}
              />
            )}
            <div className="bm-feature-modal__overlay" />
            {card.automated && (
              <span className="bm-feature-modal__badge">
                <SparkleIcon /> automated
              </span>
            )}
            <div className="bm-feature-modal__visual-tag">
              {ribbon?.name} · {card.id}
            </div>
            <div className="bm-feature-modal__handle" />
            <button
              type="button"
              className="bm-feature-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="bm-feature-modal__content">
            <div className="bm-feature-modal__category">{ribbon?.name}</div>
            <h2 id="bm-feature-modal-title" className="bm-feature-modal__title">
              {card.name}
            </h2>
            <div className="bm-feature-modal__body">
              {card.body.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
            {card.meta && (
              <div className="bm-feature-modal__meta">{card.meta}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0l1.2 4.8L12 6l-4.8 1.2L6 12l-1.2-4.8L0 6l4.8-1.2z" />
    </svg>
  );
}
