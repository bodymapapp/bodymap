// src/pages/GiftLandingPage.jsx
//
// PUBLIC gift card purchase landing page. Accessible at:
//   /gift/:customUrl   (e.g. /gift/healinghands)
//
// Phase 1 (this commit): visual flow only. No Stripe, no DB writes,
// no emails. The page exercises the full user experience end-to-end
// so HK can review the design and copy before any production wiring.
//
// Reuses extensively:
//   - giftCardDesigns.js (6 polished designs)
//   - giftCardThemes.js (6 color themes)
//   - renderCardReact() for the live preview
//
// What WILL be wired in Phase 2 (tomorrow, after HK approves):
//   - Stripe Connect PaymentIntent for the purchase
//   - Webhook that creates the gift_certificates row on success
//   - 3 emails (recipient, purchaser, therapist)
//   - Scheduled delivery cron
//   - Entry point on BookingPage
//
// Until Phase 2, the "Pay & Send Gift" button shows a placeholder
// success screen explaining the next step.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  DESIGNS,
  ORDERED_DESIGN_KEYS,
  getDesign,
  renderCardReact,
  resolveCardBranding,
} from '../lib/giftCardDesigns';
import {
  GIFT_CARD_THEMES,
  ORDERED_THEME_KEYS,
  getTheme,
} from '../lib/giftCardThemes';

// MyBodyMap design tokens. Same palette as the rest of the app.
const C = {
  forest: '#1C2B22',
  forestSoft: '#2A5741',
  sage: '#6B9E80',
  sageBg: '#EEF3EE',
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  inkMute: '#8A9690',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

const SUGGESTED_AMOUNTS = [50, 100, 150, 200];
const MIN_AMOUNT = 25;
const MAX_AMOUNT = 1000;

// ─── Step components ──────────────────────────────────────────────

function Hero({ therapist }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 700,
        color: C.sage, letterSpacing: '1.6px',
        textTransform: 'uppercase', marginBottom: 12,
      }}>
        A gift from {therapist?.business_name || therapist?.full_name || 'MyBodyMap'}
      </div>
      <h1 style={{
        fontFamily: C.serif, fontSize: 34, fontWeight: 700,
        color: C.forest, lineHeight: 1.1, letterSpacing: '-0.5px',
        margin: '0 0 12px',
      }}>
        Give the gift of healing
      </h1>
      <p style={{
        fontFamily: C.sans, fontSize: 15, color: C.inkSoft,
        lineHeight: 1.55, margin: '0 auto', maxWidth: 420,
      }}>
        A personalized gift card for someone who deserves a moment
        of care. Sent instantly, or scheduled for the perfect day.
      </p>
    </div>
  );
}

function AmountPicker({ amount, onChange }) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const applyCustom = () => {
    const n = parseInt(customValue, 10);
    if (!isNaN(n) && n >= MIN_AMOUNT && n <= MAX_AMOUNT) {
      onChange(n);
    }
  };

  return (
    <div>
      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 700,
        color: C.inkMute, letterSpacing: '1.2px',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        Choose an amount
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8, marginBottom: 12,
      }}>
        {SUGGESTED_AMOUNTS.map(n => {
          const selected = !customMode && amount === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => { setCustomMode(false); onChange(n); }}
              style={{
                background: selected ? C.forestSoft : C.white,
                color: selected ? C.white : C.forest,
                border: `1.5px solid ${selected ? C.forestSoft : C.lineFaint}`,
                borderRadius: 12, padding: '14px 6px',
                fontFamily: C.serif, fontSize: 17, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ${n}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setCustomMode(v => !v)}
        style={{
          background: customMode ? C.creamAlt : C.cream,
          border: `1.5px solid ${customMode ? C.forestSoft : C.lineFaint}`,
          borderRadius: 12, padding: '12px 14px',
          width: '100%', textAlign: 'left',
          fontFamily: C.sans, fontSize: 13, fontWeight: 600,
          color: C.forest, cursor: 'pointer',
        }}
      >
        {customMode ? '✓ Custom amount' : 'Or enter a custom amount →'}
      </button>

      {customMode && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 10,
          alignItems: 'center',
        }}>
          <span style={{
            fontFamily: C.serif, fontSize: 18, fontWeight: 700,
            color: C.forest,
          }}>$</span>
          <input
            type="number"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onBlur={applyCustom}
            placeholder={`${MIN_AMOUNT}–${MAX_AMOUNT}`}
            style={{
              flex: 1, padding: '12px 14px',
              border: `1.5px solid ${C.lineFaint}`,
              borderRadius: 10,
              fontFamily: C.serif, fontSize: 17, fontWeight: 700,
              color: C.forest, outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={applyCustom}
            style={{
              padding: '12px 18px',
              background: C.forestSoft, color: C.white,
              border: 'none', borderRadius: 10,
              fontFamily: C.sans, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}

function DesignPicker({ designKey, themeKey, onPickDesign, onPickTheme }) {
  return (
    <div>
      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 700,
        color: C.inkMute, letterSpacing: '1.2px',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        Choose a design
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, marginBottom: 18,
      }}>
        {ORDERED_DESIGN_KEYS.map(key => {
          const d = DESIGNS[key];
          const selected = key === designKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDesign(key)}
              style={{
                background: selected ? C.forestSoft : C.white,
                color: selected ? C.white : C.forest,
                border: `1.5px solid ${selected ? C.forestSoft : C.lineFaint}`,
                borderRadius: 12, padding: '10px 6px',
                fontFamily: C.sans, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 700,
        color: C.inkMute, letterSpacing: '1.2px',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        Color
      </div>
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        {ORDERED_THEME_KEYS.map(key => {
          const t = GIFT_CARD_THEMES[key];
          const selected = key === themeKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickTheme(key)}
              title={t.label}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: `linear-gradient(135deg, ${t.headerStart}, ${t.headerEnd})`,
                border: `2.5px solid ${selected ? C.forestSoft : 'transparent'}`,
                boxShadow: selected
                  ? `0 0 0 1.5px ${C.white}, 0 2px 6px rgba(0,0,0,0.12)`
                  : '0 1px 3px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function CardPreview({ designKey, themeKey, amount, recipient, purchaser, message, therapist }) {
  const theme = getTheme(themeKey);
  return (
    <div style={{
      background: C.creamAlt, borderRadius: 16, padding: 20,
      marginBottom: 20,
    }}>
      <div style={{
        fontFamily: C.sans, fontSize: 10, fontWeight: 700,
        color: C.inkMute, letterSpacing: '1.4px',
        textTransform: 'uppercase', marginBottom: 12, textAlign: 'center',
      }}>
        Live preview
      </div>
      {renderCardReact({
        designKey,
        theme,
        imageUrl: therapist?.photo_url || null,
        brandMessage: therapist?.gift_card_message || null,
        amount: amount || '___',
        recipient: recipient || null,
        purchaser: purchaser || null,
        message: message || null,
        code: 'XXXX-XXXX-XXXX',
        businessName: therapist?.business_name,
        compact: true,
      })}
    </div>
  );
}

function PersonalizeForm({ form, onChange }) {
  const update = (field) => (e) => onChange({ ...form, [field]: e.target.value });

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    border: `1.5px solid ${C.lineFaint}`,
    borderRadius: 10, background: C.white,
    fontFamily: C.sans, fontSize: 14,
    color: C.forest, outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block',
    fontFamily: C.sans, fontSize: 11, fontWeight: 700,
    color: C.inkMute, letterSpacing: '1.2px',
    textTransform: 'uppercase', marginBottom: 6,
  };
  const fieldStyle = { marginBottom: 14 };

  return (
    <div>
      <div style={{
        fontFamily: C.serif, fontSize: 18, fontWeight: 700,
        color: C.forest, marginBottom: 14,
      }}>
        Who is this for?
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Recipient name</label>
        <input
          style={inputStyle}
          placeholder="Mom, partner, friend's name..."
          value={form.recipientName}
          onChange={update('recipientName')}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Recipient email</label>
        <input
          style={inputStyle}
          type="email"
          placeholder="They'll receive the gift here"
          value={form.recipientEmail}
          onChange={update('recipientEmail')}
        />
      </div>

      <div style={{
        fontFamily: C.serif, fontSize: 18, fontWeight: 700,
        color: C.forest, marginTop: 24, marginBottom: 14,
      }}>
        Your details
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Your name</label>
        <input
          style={inputStyle}
          placeholder="The gift will say it's from you"
          value={form.purchaserName}
          onChange={update('purchaserName')}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Your email</label>
        <input
          style={inputStyle}
          type="email"
          placeholder="For your receipt"
          value={form.purchaserEmail}
          onChange={update('purchaserEmail')}
        />
      </div>

      <div style={{
        fontFamily: C.serif, fontSize: 18, fontWeight: 700,
        color: C.forest, marginTop: 24, marginBottom: 14,
      }}>
        A personal message
      </div>
      <div style={fieldStyle}>
        <textarea
          style={{
            ...inputStyle, minHeight: 90, resize: 'vertical',
            fontFamily: C.serif, fontSize: 14,
            fontStyle: form.message ? 'normal' : 'italic',
          }}
          placeholder="Happy birthday, Mom 💕  /  Thank you for everything you do."
          maxLength={240}
          value={form.message}
          onChange={update('message')}
        />
        <div style={{
          textAlign: 'right',
          fontFamily: C.sans, fontSize: 11,
          color: C.inkMute, marginTop: 4,
        }}>
          {form.message.length}/240
        </div>
      </div>

      <div style={{
        fontFamily: C.serif, fontSize: 18, fontWeight: 700,
        color: C.forest, marginTop: 24, marginBottom: 10,
      }}>
        When should it arrive?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { key: 'now',       label: 'Send now',                    sub: 'Recipient gets the email immediately.' },
          { key: 'scheduled', label: 'Schedule for a specific date', sub: 'For a birthday, anniversary, holiday.' },
          { key: 'self',      label: 'Send to me to forward',       sub: "I'll print or share it myself." },
        ].map(opt => {
          const selected = form.delivery === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange({ ...form, delivery: opt.key })}
              style={{
                background: selected ? C.sageBg : C.white,
                border: `1.5px solid ${selected ? C.sage : C.lineFaint}`,
                borderRadius: 12, padding: '12px 14px',
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              <div style={{
                fontFamily: C.sans, fontSize: 14, fontWeight: 600,
                color: C.forest, marginBottom: 2,
              }}>
                {selected ? '✓ ' : ''}{opt.label}
              </div>
              <div style={{
                fontFamily: C.sans, fontSize: 12, color: C.inkSoft,
              }}>
                {opt.sub}
              </div>
            </button>
          );
        })}
      </div>

      {form.delivery === 'scheduled' && (
        <div style={{ marginTop: 12, ...fieldStyle }}>
          <label style={labelStyle}>Delivery date</label>
          <input
            type="date"
            style={inputStyle}
            min={new Date().toISOString().slice(0, 10)}
            value={form.scheduledDate}
            onChange={update('scheduledDate')}
          />
        </div>
      )}
    </div>
  );
}

function MockCheckout({ amount, onBack, onPretendPay }) {
  return (
    <div style={{
      background: C.cream, border: `1.5px dashed ${C.gold}`,
      borderRadius: 14, padding: 24, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 700,
        color: C.goldBg ? '#92660E' : C.gold, letterSpacing: '1.4px',
        textTransform: 'uppercase', marginBottom: 12,
      }}>
        🚧 Preview mode
      </div>
      <h3 style={{
        fontFamily: C.serif, fontSize: 22, fontWeight: 700,
        color: C.forest, margin: '0 0 8px',
      }}>
        Stripe payment goes here
      </h3>
      <p style={{
        fontFamily: C.sans, fontSize: 13, color: C.inkSoft,
        lineHeight: 1.55, margin: '0 auto 18px', maxWidth: 360,
      }}>
        Tomorrow this connects to Stripe Connect Express. The
        purchaser will pay <strong style={{ color: C.forest }}>${amount}</strong>,
        the therapist receives it directly, and on success the
        three emails fire. For now you can preview the success
        screen below.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: C.white, border: `1.5px solid ${C.lineFaint}`,
            color: C.ink, padding: '12px 20px', borderRadius: 10,
            fontFamily: C.sans, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onPretendPay}
          style={{
            background: C.forestSoft, color: C.white, border: 'none',
            padding: '12px 22px', borderRadius: 10,
            fontFamily: C.sans, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Preview success screen →
        </button>
      </div>
    </div>
  );
}

function SuccessScreen({ form, amount, designKey, themeKey, therapist }) {
  const mockCode = 'XXXX-XXXX-XXXX';
  const recipientFirst = form.recipientName?.split(' ')[0] || 'them';
  const theme = getTheme(themeKey);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: C.sageBg, margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'bmGiftSuccess 0.5s ease-out',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.forestSoft} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <style>{`
        @keyframes bmGiftSuccess {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <h2 style={{
        fontFamily: C.serif, fontSize: 26, fontWeight: 700,
        color: C.forest, margin: '0 0 10px', letterSpacing: '-0.3px',
      }}>
        Your gift is ready
      </h2>
      <p style={{
        fontFamily: C.sans, fontSize: 14, color: C.inkSoft,
        lineHeight: 1.55, maxWidth: 420, margin: '0 auto 24px',
      }}>
        {form.delivery === 'now' && `${recipientFirst} will receive their gift email in the next minute.`}
        {form.delivery === 'scheduled' && `${recipientFirst} will receive their gift email on ${form.scheduledDate || 'the date you chose'}.`}
        {form.delivery === 'self' && `We've sent the gift to your email so you can forward or print it.`}
        {' '}You'll also get a receipt at your email.
      </p>

      <div style={{
        background: C.creamAlt, borderRadius: 16, padding: 20,
        marginBottom: 20,
      }}>
        {renderCardReact({
          designKey,
          theme,
          imageUrl: therapist?.photo_url || null,
          brandMessage: therapist?.gift_card_message || null,
          amount,
          recipient: form.recipientName,
          purchaser: form.purchaserName,
          message: form.message,
          code: mockCode,
          businessName: therapist?.business_name,
          compact: true,
        })}
      </div>

      <div style={{
        background: C.white, border: `1.5px dashed ${C.gold}`,
        borderRadius: 12, padding: 14, marginBottom: 24,
        fontFamily: C.sans, fontSize: 12, color: C.inkSoft,
        textAlign: 'left',
      }}>
        <div style={{
          fontWeight: 700, color: '#92660E', marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: '1px', fontSize: 10,
        }}>
          🚧 Preview note
        </div>
        In production, the code above will be a real one (like
        <code style={{
          background: C.cream, padding: '1px 6px', borderRadius: 4,
          margin: '0 4px', fontFamily: 'monospace',
        }}>A8K3-9MFP-2X7Q</code>), and three emails will fire
        automatically: one to the recipient, one to you, one to
        the therapist.
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: C.white, border: `1.5px solid ${C.lineFaint}`,
          color: C.ink, padding: '12px 22px', borderRadius: 10,
          fontFamily: C.sans, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Send another gift
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function GiftLandingPage() {
  const { customUrl } = useParams();
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [step, setStep] = useState('compose');  // 'compose' | 'checkout' | 'success'

  const [amount, setAmount] = useState(100);
  const [designKey, setDesignKey] = useState('just-because');
  const [themeKey, setThemeKey] = useState('sage');

  const [form, setForm] = useState({
    recipientName: '',
    recipientEmail: '',
    purchaserName: '',
    purchaserEmail: '',
    message: '',
    delivery: 'now',
    scheduledDate: '',
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error: e } = await supabase
          .from('therapists')
          .select('id, full_name, business_name, custom_url, photo_url, gift_card_theme, gift_card_message')
          .eq('custom_url', customUrl)
          .maybeSingle();
        if (!alive) return;
        if (e || !data) {
          setError('Therapist not found.');
          return;
        }
        setTherapist(data);
        if (data.gift_card_theme && GIFT_CARD_THEMES[data.gift_card_theme]) {
          setThemeKey(data.gift_card_theme);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customUrl]);

  const canProceed = useMemo(() => {
    return (
      amount >= MIN_AMOUNT && amount <= MAX_AMOUNT &&
      form.recipientName.trim().length > 0 &&
      form.recipientEmail.trim().includes('@') &&
      form.purchaserName.trim().length > 0 &&
      form.purchaserEmail.trim().includes('@') &&
      (form.delivery !== 'scheduled' || !!form.scheduledDate)
    );
  }, [amount, form]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: C.cream,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: C.sans, fontSize: 14, color: C.inkSoft,
        }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error || !therapist) {
    return (
      <div style={{
        minHeight: '100vh', background: C.cream,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center',
      }}>
        <div>
          <h2 style={{
            fontFamily: C.serif, fontSize: 24, color: C.forest,
            margin: '0 0 8px',
          }}>
            Page not found
          </h2>
          <p style={{
            fontFamily: C.sans, fontSize: 14, color: C.inkSoft,
            margin: 0,
          }}>
            We could not find that therapist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.cream,
      paddingTop: 32, paddingBottom: 80,
      fontFamily: C.sans, color: C.ink,
    }}>
      {/* Preview-mode banner */}
      <div style={{
        background: '#FFF8E1', borderBottom: `1.5px solid ${C.gold}`,
        padding: '10px 16px', textAlign: 'center',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        fontFamily: C.sans, fontSize: 12, color: '#92660E',
        fontWeight: 600,
      }}>
        🚧 Preview mode, no real payments are processed. Tomorrow we wire up Stripe.
      </div>

      <div style={{
        maxWidth: 540, margin: '0 auto', padding: '60px 18px 0',
      }}>
        <Hero therapist={therapist} />

        {step === 'compose' && (
          <>
            <CardPreview
              designKey={designKey}
              themeKey={themeKey}
              amount={amount}
              recipient={form.recipientName}
              purchaser={form.purchaserName}
              message={form.message}
              therapist={therapist}
            />

            <div style={{
              background: C.white, borderRadius: 16, padding: 22,
              marginBottom: 20, border: `1px solid ${C.lineFaint}`,
            }}>
              <AmountPicker amount={amount} onChange={setAmount} />
            </div>

            <div style={{
              background: C.white, borderRadius: 16, padding: 22,
              marginBottom: 20, border: `1px solid ${C.lineFaint}`,
            }}>
              <DesignPicker
                designKey={designKey}
                themeKey={themeKey}
                onPickDesign={setDesignKey}
                onPickTheme={setThemeKey}
              />
            </div>

            <div style={{
              background: C.white, borderRadius: 16, padding: 22,
              marginBottom: 20, border: `1px solid ${C.lineFaint}`,
            }}>
              <PersonalizeForm form={form} onChange={setForm} />
            </div>

            <button
              type="button"
              disabled={!canProceed}
              onClick={() => setStep('checkout')}
              style={{
                width: '100%',
                background: canProceed ? C.forestSoft : C.lineFaint,
                color: canProceed ? C.white : C.inkMute,
                border: 'none', borderRadius: 12,
                padding: '16px 22px',
                fontFamily: C.sans, fontSize: 15, fontWeight: 700,
                cursor: canProceed ? 'pointer' : 'not-allowed',
                letterSpacing: '0.2px',
              }}
            >
              Continue to payment →
            </button>

            <p style={{
              textAlign: 'center', marginTop: 14,
              fontFamily: C.sans, fontSize: 11, color: C.inkMute,
            }}>
              Secure payment by Stripe. Payment goes directly to the
              therapist's account.
            </p>
          </>
        )}

        {step === 'checkout' && (
          <MockCheckout
            amount={amount}
            onBack={() => setStep('compose')}
            onPretendPay={() => setStep('success')}
          />
        )}

        {step === 'success' && (
          <SuccessScreen
            form={form}
            amount={amount}
            designKey={designKey}
            themeKey={themeKey}
            therapist={therapist}
          />
        )}
      </div>
    </div>
  );
}
