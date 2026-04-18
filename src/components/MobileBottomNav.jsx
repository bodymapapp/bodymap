import React, { useState, useEffect } from 'react';

const C = { forest: '#2A5741', sage: '#6B9E80', gray: '#9CA3AF', beige: '#F5F0E8' };

const TABS = [
  { id: 'clients',  label: 'Clients',  icon: ClientsIcon  },
  { id: 'schedule', label: 'Schedule', icon: ScheduleIcon },
  { id: 'billing',  label: 'Billing',  icon: BillingIcon  },
  { id: 'outreach', label: 'Outreach', icon: OutreachIcon },
  { id: 'more',     label: 'More',     icon: MoreIcon     },
];

const MORE_ITEMS = [
  { id: 'settings', label: 'Settings',    sub: 'Hours, services, integrations', emoji: '⚙️', color: '#F3F4F6' },
  { id: 'ai',       label: 'AI Briefs',   sub: 'Ask anything about your practice', emoji: '🧠', color: '#F0FDF4' },
  { id: 'gifts',    label: 'Gift Cards',  sub: 'Send joy to your clients',         emoji: '🎁', color: '#FFF7ED' },
];

export default function MobileBottomNav({ active, onChange, unreadCount, onSignOut, therapist }) {
  const [showMore, setShowMore] = useState(false);
  const activeTab = ['ai','gifts','settings'].includes(active) ? 'more' : active;

  // Close drawer on back navigation
  useEffect(() => {
    const handler = () => setShowMore(false);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const handleTab = (id) => {
    if (id === 'more') { setShowMore(v => !v); return; }
    setShowMore(false);
    onChange(id);
  };

  const navHeight = 66;

  return (
    <>
      {/* Overlay */}
      {showMore && (
        <div onClick={() => setShowMore(false)}
          style={{ position:'fixed', inset:0, zIndex:998, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(2px)' }} />
      )}

      {/* Modern More Sheet */}
      <div style={{
        position: 'fixed',
        bottom: navHeight,
        left: 0, right: 0,
        zIndex: 999,
        background: '#FAFAF8',
        borderRadius: showMore ? '20px 20px 0 0' : '0',
        borderTop: showMore ? '1px solid #E8E4DC' : 'none',
        boxShadow: showMore ? '0 -12px 40px rgba(0,0,0,0.15)' : 'none',
        maxHeight: showMore ? '70vh' : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), border-radius 0.3s ease',
      }}>
        <div style={{ padding: '16px 16px 8px', overflowY: 'auto', maxHeight: '70vh' }}>
          {/* Handle bar */}
          <div style={{ width: 36, height: 4, background: '#D1D5DB', borderRadius: 2, margin: '0 auto 20px' }} />

          {/* Menu cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {MORE_ITEMS.map(item => (
              <button key={item.id} onClick={() => { onChange(item.id); setShowMore(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', padding: '14px 16px',
                  background: active === item.id ? '#F0FDF4' : '#fff',
                  border: active === item.id ? '1.5px solid #86EFAC' : '1.5px solid #F3F4F6',
                  borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s',
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: item.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {item.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: active === item.id ? C.forest : '#1F2937', marginBottom: 1 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray }}>{item.sub}</div>
                </div>
                {active === item.id
                  ? <span style={{ color: C.forest, fontSize: 16, fontWeight: 700 }}>✓</span>
                  : <span style={{ color: '#D1D5DB', fontSize: 16 }}>›</span>
                }
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#E8E4DC', margin: '8px 0 12px' }} />

          {/* Sign out */}
          <button onClick={() => { onSignOut?.(); setShowMore(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '14px 16px',
              background: '#FFF1F2', border: '1.5px solid #FFE4E6',
              borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              marginBottom: 8,
            }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              🚪
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626' }}>Sign Out</div>
              <div style={{ fontSize: 12, color: '#F87171' }}>See you soon</div>
            </div>
          </button>

          {/* Therapist tag at bottom */}
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <span style={{ fontSize: 11, color: C.gray }}>
              {therapist?.business_name || 'BodyMap'} · 🌿 Silver · Free
            </span>
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        background: '#fff',
        borderTop: '1px solid #E8E4DC',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: navHeight,
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id || (tab.id === 'more' && showMore);
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => handleTab(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '8px 2px 6px',
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative', gap: 3, minWidth: 0,
                transition: 'opacity 0.1s',
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isActive ? '#F0FDF4' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                position: 'relative',
              }}>
                <Icon color={isActive ? C.forest : C.gray} size={20} />
                {tab.id === 'outreach' && unreadCount > 0 && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 8, height: 8,
                    background: '#DC2626', borderRadius: '50%',
                    border: '1.5px solid #fff',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 400,
                color: isActive ? C.forest : C.gray,
                fontFamily: 'system-ui',
              }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ClientsIcon({ color, size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.8"/>
    <path d="M2 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.6"/>
    <path d="M14 20c0-2.761 1.79-5 4-5s4 2.239 4 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>;
}
function ScheduleIcon({ color, size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="17" rx="3" stroke={color} strokeWidth="1.8"/>
    <path d="M3 9h18" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 2v3M16 2v3" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="7" y="12" width="2.5" height="2" rx="0.5" fill={color} opacity="0.7"/>
    <rect x="11" y="12" width="2.5" height="2" rx="0.5" fill={color}/>
    <rect x="15" y="12" width="2.5" height="2" rx="0.5" fill={color} opacity="0.4"/>
  </svg>;
}
function BillingIcon({ color, size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="5" width="20" height="14" rx="3" stroke={color} strokeWidth="1.8"/>
    <path d="M2 10h20" stroke={color} strokeWidth="1.8"/>
    <path d="M6 15h4M14 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>;
}
function OutreachIcon({ color, size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 4L3 11l7 3 3 7 7-17z" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M10 14l4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>;
}
function MoreIcon({ color, size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="5" cy="12" r="1.5" fill={color}/>
    <circle cx="12" cy="12" r="1.5" fill={color}/>
    <circle cx="19" cy="12" r="1.5" fill={color}/>
  </svg>;
}
