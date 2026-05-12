import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { GIFT_CARD_THEMES, ORDERED_THEME_KEYS, getTheme } from '../lib/giftCardThemes';
import { DESIGNS, ORDERED_DESIGN_KEYS, getDesign, resolveCardBranding, renderCardReact, renderCardThumbnailReact } from '../lib/giftCardDesigns';

const C = { forest:'#2A5741', sage:'#6B9E80', blush:'#F9A8B4', rose:'#E85C79', rosePale:'#FCE7F3', cream:'#FFF9F3', white:'#FFFFFF', dark:'#1F2937', gray:'#6B7280', light:'#E8E4DC' };

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Botanical decoration SVG - subtle leaves & flowers
function BotanicalFlourish({ style, color = '#F9A8B4', opacity = 0.5 }) {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={style} fill="none">
      <g opacity={opacity}>
        <path d="M20 80 Q 30 50, 50 40 Q 70 50, 80 80" stroke="#6B9E80" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        <ellipse cx="30" cy="55" rx="5" ry="9" fill="#6B9E80" opacity="0.5" transform="rotate(-35 30 55)"/>
        <ellipse cx="70" cy="55" rx="5" ry="9" fill="#6B9E80" opacity="0.5" transform="rotate(35 70 55)"/>
        <circle cx="50" cy="38" r="4" fill={color}/>
        <circle cx="50" cy="38" r="2" fill="#fff"/>
        <circle cx="38" cy="30" r="2.5" fill={color} opacity="0.7"/>
        <circle cx="62" cy="30" r="2.5" fill={color} opacity="0.7"/>
      </g>
    </svg>
  );
}

// Visual gift card preview - the actual "card" recipients would feel excited to receive
// Visual gift card preview - dispatches to the design-specific renderer.
// Accepts a cert-shaped object (real cert from DB or form state for the
// create preview) plus the therapist row. Resolves theme/image/message
// falling back to therapist defaults when per-card columns are null.
function GiftCardPreview({ cert, therapist, compact = false }) {
  const branding = resolveCardBranding(cert, therapist);
  return renderCardReact({
    designKey: branding.designKey,
    theme: branding.theme,
    imageUrl: branding.imageUrl,
    brandMessage: branding.brandMessage,
    amount: cert?.amount || "___",
    recipient: cert?.recipient_name,
    purchaser: cert?.purchaser_name,
    message: cert?.message,
    code: cert?.code || "XXXX-XXXX-XXXX",
    businessName: therapist?.business_name,
    compact,
  });
}

export default function GiftCertificates({ therapist }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    recipient_name: '',
    recipient_email: '',
    purchaser_name: '',
    message: '',
    // Per-card branding overrides. Default to "use my defaults" (null)
    // except for design_template which always has to be set.
    design_template: 'just-because',
    theme: null,                 // null = inherit therapist's gift_card_theme
    card_image_url: null,        // null = inherit therapist's photo_url
    card_brand_message: '',      // empty = inherit therapist's gift_card_message
  });
  const [cardImageFile, setCardImageFile] = useState(null);   // raw File for upload
  const [cardImagePreview, setCardImagePreview] = useState(null);  // data: URL for instant preview
  const [uploadingImage, setUploadingImage] = useState(false);
  const cardImageInputRef = useRef();
  const [clients, setClients] = useState([]);
  const [purchaserSuggestions, setPurchaserSuggestions] = useState([]);
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(null);
  // Resend-email button state. resendingId tracks which row's button is
  // currently in-flight (for spinner). resendResult shows the most recent
  // success/failure feedback for ~4 seconds after a resend completes.
  const [resendingId, setResendingId] = useState(null);
  const [resendResult, setResendResult] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);
  // Thumbnail grid modal: which cert is currently expanded to full
  // size? null = no modal open. Modal renders the full GiftCardPreview
  // plus the action bar (copy code, print, resend email, cancel).
  const [selectedCertId, setSelectedCertId] = useState(null);

  useEffect(() => {
    load();
    loadClients();
  }, [therapist.id]);

  // Modal keyboard + scroll-lock. Escape closes the thumbnail expand
  // modal; body overflow is hidden so the page behind doesn't scroll
  // while the modal is open.
  useEffect(() => {
    if (!selectedCertId) return;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedCertId(null); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedCertId]);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,email,phone').eq('therapist_id', therapist.id).order('name');
    setClients(data || []);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('gift_certificates')
      .select('*')
      .eq('therapist_id', therapist.id)
      .order('created_at', { ascending: false });
    setCerts(data || []);
    setLoading(false);
  }

  // Sends (or re-sends) the recipient email for a given gift certificate row.
  // Returns { ok: true } on success, { ok: false, reason } on failure.
  // Logs every failure visibly to the browser console so HK can see what
  // is going wrong instead of silent swallowing.
  async function sendRecipientEmail(certId, { force = false } = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
      if (!accessToken) {
        console.error('[gift-card-email] no auth token, cannot send');
        return { ok: false, reason: 'no_auth' };
      }
      if (!supabaseUrl) {
        console.error('[gift-card-email] REACT_APP_SUPABASE_URL not set in build');
        return { ok: false, reason: 'no_url' };
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/send-gift-certificate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ gift_certificate_id: certId, force }),
      });
      if (!res.ok) {
        let body = '';
        try { body = await res.text(); } catch { /* ignore */ }
        console.error(`[gift-card-email] send failed: HTTP ${res.status}`, body);
        return { ok: false, reason: `http_${res.status}`, body };
      }
      const data = await res.json();
      if (data?.skipped) {
        console.info('[gift-card-email] already sent earlier; pass force:true to resend');
        return { ok: true, skipped: true };
      }
      console.info('[gift-card-email] sent successfully', data);
      return { ok: true };
    } catch (err) {
      console.error('[gift-card-email] exception:', err);
      return { ok: false, reason: 'exception', error: String(err) };
    }
  }

  async function create() {
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) return;
    setCreating(true);
    const code = genCode();

    // Step 1: upload per-card image if the therapist picked one. Goes
    // into the existing bodymap-assets bucket (same one Profile photo
    // uses). Path namespaced under the therapist id so each card has a
    // unique key.
    let cardImageUrl = form.card_image_url;
    if (cardImageFile) {
      try {
        setUploadingImage(true);
        const ext = (cardImageFile.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${therapist.id}/gift-cards/${code}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('bodymap-assets')
          .upload(path, cardImageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage
          .from('bodymap-assets')
          .getPublicUrl(path);
        cardImageUrl = publicUrl;
      } catch (e) {
        console.error('[gift-card] image upload failed:', e);
        // Fall through and create the card without the image so the
        // therapist is not blocked. They can edit later.
      } finally {
        setUploadingImage(false);
      }
    }

    const { data: inserted, error } = await supabase.from('gift_certificates').insert({
      therapist_id: therapist.id,
      code,
      amount: parseFloat(form.amount),
      remaining: parseFloat(form.amount),
      recipient_name: form.recipient_name || null,
      recipient_email: form.recipient_email || null,
      purchaser_name: form.purchaser_name || null,
      message: form.message || null,
      status: 'active',
      created_at: new Date().toISOString(),
      // Per-card branding overrides. theme/card_image_url/card_brand_message
      // pass null when the therapist left the field as "use my defaults".
      design_template: form.design_template || 'just-because',
      theme: form.theme || null,
      card_image_url: cardImageUrl || null,
      card_brand_message: form.card_brand_message?.trim() || null,
    }).select().single();

    if (error || !inserted) {
      console.error('[gift-card] insert failed:', error);
      setCreating(false);
      return;
    }

    // Fire email send. Awaited so we surface failures, but kept short
    // so the UX still feels snappy. If it takes >3s, the form already
    // cleared; that's acceptable.
    if (form.recipient_email && form.recipient_email.trim()) {
      const result = await sendRecipientEmail(inserted.id);
      if (!result.ok) {
        // Don't block the success state — gift card exists, email can
        // be resent from the row card. But surface a soft warning so
        // the user knows to retry.
        console.warn('[gift-card-email] create succeeded but email send failed; resend from the row card');
      }
    }

    setCreating(false);
    setForm({
      amount: '',
      recipient_name: '',
      recipient_email: '',
      purchaser_name: '',
      message: '',
      design_template: 'just-because',
      theme: null,
      card_image_url: null,
      card_brand_message: '',
    });
    setCardImageFile(null);
    setCardImagePreview(null);
    setShowForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  }

  // Resend the email for an existing gift certificate. Used by the
  // "Resend email" button on each active gift cert row card.
  // Sets per-row state so the button shows pending/sent feedback.
  async function resendEmail(certId) {
    setResendingId(certId);
    setResendResult(null);
    const result = await sendRecipientEmail(certId, { force: true });
    setResendingId(null);
    setResendResult({ certId, ok: result.ok, reason: result.reason });
    setTimeout(() => setResendResult(null), 4000);
  }

  async function deactivate(id) {
    await supabase.from('gift_certificates').update({ status: 'cancelled' }).eq('id', id);
    load();
  }

  function copy(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const active = certs.filter(c => c.status === 'active');
  const past = certs.filter(c => c.status !== 'active');

  const presetAmounts = [65, 85, 120, 150, 200];

  // Therapist's saved default theme drives the hero color tint. Per-card
  // overrides happen in the create form (form.theme) and are previewed
  // there directly without affecting this hero color.
  const activeTheme = getTheme(therapist?.gift_card_theme);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {/* Hero. Two states:
            - idle: full marketing band with title + tagline + CTA. Earns
              its space when the therapist lands on the page and might
              not know what gift cards do for them.
            - creating: thin bar with just title + close affordance.
              Marketing copy already did its job; now they need to focus
              on building the card. */}
      {!showForm && (
        <div style={{
          position: 'relative',
          background: activeTheme.bgGradient,
          borderRadius: 24,
          padding: '28px 24px',
          marginBottom: 24,
          border: `1.5px solid ${activeTheme.accent}33`,
          overflow: 'hidden',
          boxShadow: `0 2px 14px ${activeTheme.accent}26`,
        }}>
          <BotanicalFlourish style={{ position: 'absolute', top: -20, right: -10, transform: 'rotate(15deg)' }} color={activeTheme.accent} />
          <BotanicalFlourish style={{ position: 'absolute', bottom: -30, left: -20, transform: 'rotate(-160deg) scale(0.8)' }} color={activeTheme.accent} opacity={0.35} />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: 540 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: activeTheme.accent, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
              ♡ Gift Cards
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, color: activeTheme.ink, margin: '0 0 10px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              Give the gift of <em style={{ color: activeTheme.accent, fontStyle: 'italic' }}>feeling good.</em>
            </h2>
            <p style={{ fontSize: 14, color: activeTheme.inkSoft, margin: '0 0 22px', lineHeight: 1.65 }}>
              For the mother who gives everything. The friend going through a hard season. The partner who deserves to be cared for. A gift card from you is an hour of peace, wrapped in kindness.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setShowForm(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: activeTheme.accentSolid,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 24,
                  padding: '12px 22px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 4px 14px ${activeTheme.accent}59`,
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.01em',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <span style={{ fontSize: 16 }}>♡</span> Create a gift card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact bar shown only when creating: title + close. Replaces
          the marketing hero so the form has top-of-fold space. */}
      {showForm && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          padding: '14px 20px',
          marginBottom: 16,
          background: activeTheme.bgGradient,
          border: `1.5px solid ${activeTheme.accent}33`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              fontSize: 18, lineHeight: 1, color: activeTheme.accent,
            }}>♡</div>
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700,
              color: activeTheme.ink, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Create a gift card
            </div>
          </div>
          <button onClick={() => setShowForm(false)}
            type="button"
            aria-label="Close"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.7)',
              color: activeTheme.accent,
              border: `1.5px solid ${activeTheme.accent}66`,
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              WebkitTapHighlightColor: 'transparent',
            }}>
            × Close
          </button>
        </div>
      )}


      {/* ──────────── Create form: two-column on desktop, single column on mobile.
           Preview is sticky so it stays visible while the therapist fills in fields.
           Active gift card list is hidden while the form is open (the focus is
           on what they're creating now).                                          */}
      {showForm && (
        <div className="bm-gift-form" style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9F3 100%)',
          borderRadius: 20,
          padding: '24px 22px',
          marginBottom: 24,
          border: `1.5px solid ${activeTheme.accent}33`,
        }}>
          {/* Mobile-only sticky preview at the top of the form.
              Hidden on desktop where the sticky preview lives in the right column. */}
          <div className="bm-gift-form__mobile-preview" style={{
            display: 'none',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: 'linear-gradient(180deg, rgba(255,249,243,0.98) 0%, rgba(255,249,243,0.92) 85%, rgba(255,249,243,0) 100%)',
            margin: '-24px -22px 18px',
            padding: '14px 22px 18px',
          }}>
            <GiftCardPreview
              cert={{
                amount: form.amount || '___',
                recipient_name: form.recipient_name || 'friend',
                purchaser_name: form.purchaser_name || therapist?.full_name?.split(' ')[0],
                message: form.message || 'An hour of peace, just for you.',
                code: 'XXXX-XXXX-XXXX',
                design_template: form.design_template,
                theme: form.theme,
                card_image_url: cardImagePreview || form.card_image_url,
                card_brand_message: form.card_brand_message,
              }}
              therapist={therapist}
              compact
            />
          </div>

          <div className="bm-gift-form__grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 480px',
            gap: 28,
            alignItems: 'start',
          }}>

            {/* ───── LEFT COLUMN: all customization + gift details, vertical sections ───── */}
            <div className="bm-gift-form__left" style={{ minWidth: 0 }}>

              {/* Two-box row. On screens wider than 1280px they sit
                  side by side (50/50) so the form stops feeling top-
                  heavy. On narrower screens they stack vertically. */}
              <div className="bm-gift-form__boxes" style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 22,
                marginBottom: 18,
              }}>

              {/* SECTION 1: Design + color + image + brand message */}
              <div style={{
                padding: '18px 20px',
                background: '#fff',
                border: `1px solid ${activeTheme.accent}24`,
                borderRadius: 14,
              }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                  ✨ Customize this card
                </div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 16, lineHeight: 1.5 }}>
                  Each card can have its own design, color, image, and message. Leave a field alone to use your defaults.
                </div>

                {/* Design picker */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Design
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 18 }}>
                  {ORDERED_DESIGN_KEYS.map(key => {
                    const d = DESIGNS[key];
                    const selected = form.design_template === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => setForm(f => ({ ...f, design_template: key }))}
                        style={{
                          background: selected ? activeTheme.accent + '14' : '#fff',
                          border: `2px solid ${selected ? activeTheme.accent : C.light}`,
                          borderRadius: 10,
                          padding: '10px 10px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          outline: 'none',
                          WebkitTapHighlightColor: 'transparent',
                        }}>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 2 }}>{d.label}</div>
                        <div style={{ fontSize: 10, color: C.gray, lineHeight: 1.3 }}>{d.description}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Color picker */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Color
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, theme: null }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px',
                      border: `1.5px solid ${form.theme === null ? activeTheme.accent : C.light}`,
                      background: form.theme === null ? activeTheme.accent + '14' : '#fff',
                      borderRadius: 999,
                      fontSize: 12, fontWeight: 600,
                      color: form.theme === null ? activeTheme.accentDeep : C.gray,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    Default
                  </button>
                  {ORDERED_THEME_KEYS.map(key => {
                    const tt = GIFT_CARD_THEMES[key];
                    const selected = form.theme === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => setForm(f => ({ ...f, theme: key }))}
                        title={tt.label}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px 4px 4px',
                          border: `1.5px solid ${selected ? tt.accent : C.light}`,
                          background: selected ? tt.bgGradient : '#fff',
                          borderRadius: 999,
                          cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                        }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: tt.accentSolid }}/>
                        <span style={{ fontSize: 12, fontWeight: 600, color: selected ? tt.accentDeep : C.gray }}>{tt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Image upload */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Image for this card
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                  {(cardImagePreview || form.card_image_url || therapist?.photo_url) && (
                    <img
                      src={cardImagePreview || form.card_image_url || therapist?.photo_url}
                      alt="Card image"
                      style={{
                        width: 52, height: 52, borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${activeTheme.accent}66`,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input ref={cardImageInputRef} type="file" accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Image must be smaller than 5MB.');
                          return;
                        }
                        setCardImageFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setCardImagePreview(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                    <button type="button" onClick={() => cardImageInputRef.current?.click()}
                      style={{
                        display: 'inline-block',
                        padding: '8px 14px',
                        background: '#fff',
                        border: `1.5px solid ${C.light}`,
                        borderRadius: 10,
                        fontSize: 13, fontWeight: 600,
                        color: C.dark, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}>
                      {cardImagePreview || form.card_image_url ? 'Change image' : 'Upload image'}
                    </button>
                    {(cardImagePreview || form.card_image_url) && (
                      <button type="button"
                        onClick={() => { setCardImageFile(null); setCardImagePreview(null); setForm(f => ({ ...f, card_image_url: null })); }}
                        style={{
                          marginLeft: 8,
                          padding: '8px 12px',
                          background: 'transparent',
                          border: 'none',
                          fontSize: 12, color: C.gray, cursor: 'pointer',
                          textDecoration: 'underline',
                        }}>
                        Use my default
                      </button>
                    )}
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 6, lineHeight: 1.4 }}>
                      Max 5MB. Square images work best.
                    </div>
                  </div>
                </div>

                {/* Brand message override */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Brand message <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(optional, for this card only)</span>
                </div>
                <input type="text" value={form.card_brand_message}
                  onChange={e => setForm(f => ({ ...f, card_brand_message: e.target.value.slice(0, 120) }))}
                  placeholder={therapist?.gift_card_message ? `Default: "${therapist.gift_card_message}"` : 'e.g. From my hands to yours, with care.'}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: `1.5px solid ${C.light}`,
                    borderRadius: 10,
                    fontSize: 14, boxSizing: 'border-box',
                    outline: 'none',
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                  }}
                />
              </div>

              {/* SECTION 2: The gift itself (amount, recipient, giver, note) */}
              <div style={{
                padding: '18px 20px',
                background: '#fff',
                border: `1px solid ${activeTheme.accent}24`,
                borderRadius: 14,
              }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 14 }}>
                  💝 The gift
                </div>

                {/* Amount */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Amount</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {presetAmounts.map(amt => (
                      <button key={amt} type="button"
                        onClick={() => setForm(f => ({ ...f, amount: String(amt) }))}
                        style={{
                          padding: '7px 14px',
                          background: form.amount === String(amt) ? activeTheme.accent + '14' : '#fff',
                          border: `1.5px solid ${form.amount === String(amt) ? activeTheme.accent : C.light}`,
                          borderRadius: 999,
                          fontSize: 13, fontWeight: 600,
                          color: form.amount === String(amt) ? activeTheme.accentDeep : C.dark,
                          cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                          fontFamily: 'Georgia, serif',
                        }}>
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, color: C.gray }}>$</span>
                    <input type="number" min="1" step="1"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="Custom amount"
                      style={{ flex: 1, padding: '10px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'Georgia, serif' }}
                    />
                  </div>
                </div>

                {/* Recipient name */}
                <div style={{ marginBottom: 14, position: 'relative' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recipient Name</label>
                  <input type="text" value={form.recipient_name}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, recipient_name: v }));
                      const q = v.trim().toLowerCase();
                      if (q.length >= 2) {
                        setRecipientSuggestions(clients.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 5));
                      } else {
                        setRecipientSuggestions([]);
                      }
                    }}
                    placeholder="Who's this gift for?"
                    style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
                  {recipientSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${C.light}`, borderRadius: 10, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', zIndex: 5, maxHeight: 180, overflow: 'auto' }}>
                      {recipientSuggestions.map(c => (
                        <div key={c.id} onClick={() => { setForm(f => ({ ...f, recipient_name: c.name, recipient_email: c.email || '' })); setRecipientSuggestions([]); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.light}`, fontSize: 13 }}>
                          <div style={{ fontWeight: 600, color: C.dark }}>{c.name}</div>
                          {c.email && <div style={{ fontSize: 11, color: C.gray }}>{c.email}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recipient email */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recipient Email</label>
                  <input type="email" value={form.recipient_email}
                    onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))}
                    placeholder="So we can send her the beautiful card"
                    style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
                </div>

                {/* Giver name (purchaser) */}
                <div style={{ marginBottom: 14, position: 'relative' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>From <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(who's giving the gift)</span></label>
                  <input type="text" value={form.purchaser_name}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, purchaser_name: v }));
                      const q = v.trim().toLowerCase();
                      if (q.length >= 2) {
                        setPurchaserSuggestions(clients.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 5));
                      } else {
                        setPurchaserSuggestions([]);
                      }
                    }}
                    placeholder={therapist?.full_name?.split(' ')[0] || 'Your name'}
                    style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
                  {purchaserSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${C.light}`, borderRadius: 10, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', zIndex: 5, maxHeight: 180, overflow: 'auto' }}>
                      {purchaserSuggestions.map(c => (
                        <div key={c.id} onClick={() => { setForm(f => ({ ...f, purchaser_name: c.name })); setPurchaserSuggestions([]); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.light}`, fontSize: 13 }}>
                          <div style={{ fontWeight: 600, color: C.dark }}>{c.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Per-gift note from the giver */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Note to the recipient <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(from the giver)</span>
                  </label>
                  <textarea value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Thinking of you. You deserve this..."
                    rows={2}
                    style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.light}`, borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.5 }} />
                </div>
              </div>

              </div>
              {/* end .bm-gift-form__boxes */}

              {/* Action row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button onClick={create} disabled={creating || !form.amount}
                  style={{
                    flex: 1, minWidth: 180,
                    background: creating || !form.amount ? '#E5E1D8' : activeTheme.accentSolid,
                    color: creating || !form.amount ? '#9CA3AF' : '#fff',
                    border: 'none', borderRadius: 12,
                    padding: '13px 22px',
                    fontSize: 14, fontWeight: 700,
                    cursor: creating || !form.amount ? 'not-allowed' : 'pointer',
                    fontFamily: 'Georgia, serif',
                    boxShadow: creating || !form.amount ? 'none' : `0 4px 14px ${activeTheme.accent}4D`,
                  }}>
                  {creating ? 'Creating with love...' : '♡ Create this gift'}
                </button>
                <button onClick={() => setShowForm(false)}
                  style={{ background: 'transparent', color: C.gray, border: `1.5px solid ${C.light}`, borderRadius: 12, padding: '13px 22px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
              </div>
            </div>

            {/* ───── RIGHT COLUMN: sticky preview (desktop only) ───── */}
            <div className="bm-gift-form__right" style={{
              position: 'sticky',
              top: 16,
              alignSelf: 'start',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10, textAlign: 'left' }}>
                Live preview
              </div>
              <GiftCardPreview
                cert={{
                  amount: form.amount || '___',
                  recipient_name: form.recipient_name || 'friend',
                  purchaser_name: form.purchaser_name || therapist?.full_name?.split(' ')[0],
                  message: form.message || 'An hour of peace, just for you.',
                  code: 'XXXX-XXXX-XXXX',
                  design_template: form.design_template,
                  theme: form.theme,
                  card_image_url: cardImagePreview || form.card_image_url,
                  card_brand_message: form.card_brand_message,
                }}
                therapist={therapist}
              />
              <div style={{ marginTop: 10, fontSize: 11, color: C.gray, lineHeight: 1.45 }}>
                This is exactly what your client will see in their email, on the printable card, and in your dashboard.
              </div>
            </div>
          </div>

          {/* Responsive: stack columns on mobile, show mobile sticky preview, hide desktop preview */}
          <style>{`
            /* Wide desktop: two boxes (Customize + Gift) side-by-side
               in the left column. Threshold high enough that the
               combined form + 480px preview = ~1180px content width
               actually fits without crowding. */
            @media (min-width: 1280px) {
              .bm-gift-form__boxes {
                grid-template-columns: 1fr 1fr !important;
              }
            }
            /* Mobile: collapse the two-column outer grid, hide the
               right-side preview, show the mobile sticky preview. */
            @media (max-width: 820px) {
              .bm-gift-form__grid {
                grid-template-columns: 1fr !important;
              }
              .bm-gift-form__right {
                display: none !important;
              }
              .bm-gift-form__mobile-preview {
                display: block !important;
              }
            }
          `}</style>
        </div>
      )}


      {/* Active cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.gray, fontSize: 14 }}>Loading your gift cards...</div>
      ) : (
        <>
          {active.length > 0 && !showForm && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.dark, fontStyle: 'italic' }}>
                  Gifts, waiting to be opened
                </div>
                <div style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>{active.length} active</div>
              </div>
              {/* Responsive thumbnail grid. Each thumbnail is a click
                  target that opens the full card view in a modal with
                  actions (copy code, print, resend, cancel). Keeps the
                  list compact even when the therapist has 20+ gifts. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14,
              }}>
                {active.map(cert => {
                  const branding = resolveCardBranding(cert, therapist);
                  return (
                    <div key={cert.id}
                      onClick={() => setSelectedCertId(cert.id)}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                      {renderCardThumbnailReact({
                        designKey: branding.designKey,
                        theme: branding.theme,
                        amount: cert.amount,
                        recipient: cert.recipient_name,
                        status: cert.status,
                        redeemedAt: cert.redeemed_at,
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {active.length === 0 && !showForm && !loading && (
            <div style={{
              position: 'relative',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9F3 100%)',
              borderRadius: 18,
              padding: '48px 28px',
              textAlign: 'center',
              border: `1.5px dashed ${C.blush}`,
              overflow: 'hidden',
            }}>
              <BotanicalFlourish style={{ position: 'absolute', top: -25, right: 10, transform: 'rotate(20deg)' }} opacity={0.3} />
              <BotanicalFlourish style={{ position: 'absolute', bottom: -30, left: 10, transform: 'rotate(-150deg)' }} opacity={0.25} />

              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>💝</div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 8px', fontStyle: 'italic' }}>
                  Your first gift awaits
                </h3>
                <p style={{ fontSize: 14, color: C.gray, marginBottom: 22, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 22px' }}>
                  Someone on your list is having a hard week. A birthday. An anniversary. A "just because." Gift cards travel where flowers can't.
                </p>
                <button onClick={() => setShowForm(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #E85C79, #D14560)',
                    color: '#fff', border: 'none',
                    borderRadius: 24,
                    padding: '12px 24px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(232,92,121,0.3)',
                    fontFamily: 'Georgia, serif',
                  }}>
                  ♡ Create your first gift
                </button>
              </div>
            </div>
          )}

          {/* Past / redeemed, smaller, humble */}
          {past.length > 0 && !showForm && (
            <div style={{ marginTop: 32 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: C.gray, fontStyle: 'italic', marginBottom: 12 }}>
                Already opened ({past.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map(cert => (
                  <div key={cert.id}
                    onClick={() => setSelectedCertId(cert.id)}
                    style={{ background: '#FAFAF7', borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.light}`, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.75, cursor: 'pointer', transition: 'opacity 0.12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.75'; }}>
                    <span style={{ fontSize: 14 }}>{cert.status === 'redeemed' ? '✨' : '🗂'}</span>
                    <code style={{ fontSize: 13, fontWeight: 700, color: C.gray, letterSpacing: '0.06em', flex: 1, fontFamily: 'ui-monospace, Menlo, monospace' }}>{cert.code}</code>
                    {cert.recipient_name && <span style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>for {cert.recipient_name}</span>}
                    <div style={{ fontSize: 13, color: C.gray, fontWeight: 600 }}>${cert.amount?.toFixed(0)}</div>
                    <div style={{ background: cert.status === 'redeemed' ? '#F3F4F6' : '#FEF2F2', color: cert.status === 'redeemed' ? C.gray : '#DC2626', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                      {cert.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─────── Click-to-expand modal ───────
          Opens when a thumbnail in the active grid is clicked. Shows
          the full GiftCardPreview plus an action bar (copy code, copy
          as image, print, resend email, cancel). Backdrop click and
          Escape both close. */}
      {selectedCertId && (() => {
        const cert = certs.find(c => c.id === selectedCertId);
        if (!cert) return null;
        return (
          <div
            onClick={() => setSelectedCertId(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(28,43,34,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
              overflow: 'auto',
              animation: 'bm-modal-fade 0.12s ease-out',
            }}>
            <style>{`
              @keyframes bm-modal-fade {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes bm-modal-pop {
                from { opacity: 0; transform: scale(0.96) translateY(8px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: 540,
                width: '100%',
                background: '#fff',
                borderRadius: 18,
                padding: '22px 20px',
                boxShadow: '0 24px 70px rgba(0,0,0,0.25)',
                animation: 'bm-modal-pop 0.16s ease-out',
              }}>
              <button
                onClick={() => setSelectedCertId(null)}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 22, lineHeight: 1,
                  color: C.gray, cursor: 'pointer',
                  padding: 4,
                }}>
                ×
              </button>

              <GiftCardPreview cert={cert} therapist={therapist} />

              <div style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <button onClick={() => copy(cert.code)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: copied === cert.code ? '#F0FDF4' : '#fff',
                    border: `1.5px solid ${copied === cert.code ? '#86EFAC' : C.light}`,
                    color: copied === cert.code ? C.forest : C.gray,
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {copied === cert.code ? '✓ Code copied' : '📋 Copy code'}
                </button>
                <button onClick={() => window.open(`/gift-card/print/${cert.id}`, '_blank')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#fff',
                    border: `1.5px solid ${C.light}`,
                    color: C.gray,
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  🖨️ Print / share
                </button>
                {cert.recipient_email && (
                  <button onClick={() => resendEmail(cert.id)}
                    disabled={resendingId === cert.id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: (resendResult?.certId === cert.id && resendResult?.ok)
                        ? '#F0FDF4'
                        : (resendResult?.certId === cert.id && !resendResult?.ok)
                          ? '#FEF2F2'
                          : '#fff',
                      border: `1.5px solid ${
                        (resendResult?.certId === cert.id && resendResult?.ok)
                          ? '#86EFAC'
                          : (resendResult?.certId === cert.id && !resendResult?.ok)
                            ? '#FCA5A5'
                            : C.light
                      }`,
                      color: (resendResult?.certId === cert.id && resendResult?.ok)
                        ? C.forest
                        : (resendResult?.certId === cert.id && !resendResult?.ok)
                          ? '#DC2626'
                          : C.gray,
                      borderRadius: 20,
                      padding: '7px 14px',
                      fontSize: 12, fontWeight: 600,
                      cursor: resendingId === cert.id ? 'wait' : 'pointer',
                      opacity: resendingId === cert.id ? 0.7 : 1,
                    }}>
                    {resendingId === cert.id
                      ? '⏳ Sending...'
                      : (resendResult?.certId === cert.id && resendResult?.ok)
                        ? '✓ Email sent'
                        : (resendResult?.certId === cert.id && !resendResult?.ok)
                          ? '✗ Send failed'
                          : '✉️ Resend email'}
                  </button>
                )}
                {cert.status === 'active' && (
                  <button onClick={() => { deactivate(cert.id); setSelectedCertId(null); }}
                    style={{
                      marginLeft: 'auto',
                      background: 'transparent',
                      color: '#DC2626',
                      border: '1.5px solid #FECACA',
                      borderRadius: 20,
                      padding: '7px 14px',
                      fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    }}>
                    Cancel
                  </button>
                )}
              </div>

              {cert.remaining < cert.amount && (
                <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic', marginTop: 10 }}>
                  ${cert.remaining?.toFixed(0)} of ${cert.amount?.toFixed(0)} remaining
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
