// src/pages/PracticeAgreementPrint.jsx
//
// Print-friendly view of the Client Agreement. Used for:
//   - "Download / Print PDF" button on the therapist editor
//     (browser print dialog -> Save as PDF)
//   - Older clients who want to sign on paper (therapist prints,
//     client signs with pen)
//
// Matches the editorial paper-feel design of the editor: branded
// header with monogram + business name, TOC, roman-numeral sections,
// proper signature block.

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AgreementRenderer } from '../components/PracticeAgreement';
import { renderAgreementForClient, DEFAULT_PRACTICE_AGREEMENT } from '../lib/practiceAgreement';

const C = {
  forest:       '#2A5741',
  forestInk:    '#1F3A2C',
  amber:        '#B87840',
  amberDeep:    '#A0612C',
  amberPale:    '#F5EDD8',
  amberLine:    '#D4B070',
  ink:          '#1F2937',
  inkSoft:      '#374151',
  gray:         '#6B7280',
  line:         '#E5E7EB',
  paper:        '#FDFBF6',
  paperEdge:    '#F2EDDF',
  cream:        '#FAF6EE',
};

export default function PracticeAgreementPrint() {
  const { user } = useAuth();
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user?.id) { setLoading(false); return; }
      const { data } = await supabase
        .from('therapists')
        .select('*')
        .eq('id', user.id)
        .single();
      setTherapist(data || null);
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (loading || !therapist) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === '1') {
      setTimeout(() => window.print(), 400);
    }
  }, [loading, therapist]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!therapist) return <div style={{ padding: 40 }}>Therapist record not found. Please sign in.</div>;

  const text = therapist.practice_agreement_text || DEFAULT_PRACTICE_AGREEMENT;
  const rendered = renderAgreementForClient(text, therapist);
  const businessName = therapist.business_name || therapist.full_name || '';
  const monogram = businessName.split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0.6in; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-doc { box-shadow: none !important; border: none !important; }
        }
        body { background: #F5EFE0; margin: 0; }
      `}</style>

      <div style={{
        maxWidth: 720,
        margin: '32px auto 60px',
        padding: '0 20px',
      }}>
        <div className="print-doc" style={{
          background: C.paper,
          border: `1px solid ${C.paperEdge}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 12px 36px rgba(31,58,44,0.10)',
        }}>
          {/* Branded header */}
          <div style={{
            background: `linear-gradient(180deg, ${C.forestInk} 0%, ${C.forest} 100%)`,
            color: '#fff',
            padding: '24px 32px 22px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, ${C.amber} 0%, ${C.amberDeep} 50%, ${C.amber} 100%)`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: `1.5px solid rgba(255,255,255,0.35)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Georgia, serif',
                fontSize: 18,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.05)',
              }}>
                {monogram}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.75)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  {businessName}
                </div>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.2,
                }}>
                  Client Agreement & Informed Consent
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 14,
              fontSize: 10.5,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 600,
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 11,
              fontFamily: 'system-ui, sans-serif',
            }}>
              Based on ABMP and AMTA professional standards
            </div>
          </div>

          {/* Body */}
          <div style={{
            padding: '30px 38px 36px',
            fontFamily: 'Georgia, serif',
            color: C.inkSoft,
            fontSize: 14,
            lineHeight: 1.75,
          }}>
            <AgreementRenderer text={rendered} />

            {/* Paper-style signature block */}
            <div style={{
              marginTop: 48,
              paddingTop: 26,
              borderTop: `2px double ${C.amberLine}`,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.amberDeep,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 10,
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
              }}>
                Client signature
              </div>
              <p style={{
                margin: '0 0 28px',
                textAlign: 'center',
                fontSize: 13,
                color: C.gray,
                fontStyle: 'italic',
              }}>
                By signing below, you confirm that you have read and understood this agreement, and that you agree to its terms.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 24 }}>
                <div>
                  <div style={{ borderBottom: `1.5px solid ${C.ink}`, height: 36 }} />
                  <div style={{ fontSize: 10.5, color: C.gray, marginTop: 6, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}>
                    Client name (printed)
                  </div>
                </div>
                <div>
                  <div style={{ borderBottom: `1.5px solid ${C.ink}`, height: 36 }} />
                  <div style={{ fontSize: 10.5, color: C.gray, marginTop: 6, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}>
                    Date
                  </div>
                </div>
              </div>

              <div>
                <div style={{ borderBottom: `1.5px solid ${C.ink}`, height: 48 }} />
                <div style={{ fontSize: 10.5, color: C.gray, marginTop: 6, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}>
                  Client signature
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            background: C.paperEdge,
            padding: '11px 32px',
            fontSize: 10,
            color: C.gray,
            textAlign: 'center',
            letterSpacing: '0.04em',
            borderTop: `1px solid ${C.line}`,
            fontFamily: 'system-ui, sans-serif',
          }}>
            {businessName} · Generated by MyBodyMap · Based on ABMP and AMTA standards
          </div>
        </div>

        {/* Screen-only print button */}
        <div className="no-print" style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          display: 'flex',
          gap: 8,
        }}>
          <button
            onClick={() => window.print()}
            style={{
              background: C.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '12px 24px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            }}
          >
            Print / Save PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{
              background: '#fff',
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '12px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: C.gray,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
