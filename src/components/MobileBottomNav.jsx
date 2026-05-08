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
  { id: 'settings', label: 'Settings',    sub: 'Hours, services, integrations',     emoji: '⚙️', gradient: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)', border: '#C7D2FE' },
  { id: 'ai',       label: 'Practice Assistant', sub: 'Ask anything about your practice', emoji: '🌿', gradient: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '#86EFAC' },
  { id: 'gifts',    label: 'Gift Cards',  sub: 'Send joy to your clients',          emoji: '💝', gradient: 'linear-gradient(135deg,#FFF1F5,#FCE7F3)', border: '#FBCFE8' },
];

export default function MobileBottomNav({ active, onChange, unreadCount, onSignOut, therapist }) {
  const [showMore, setShowMore] = useState(false);
  const activeTab = ['ai','gifts','settings'].includes(active) ? 'more' : active;

  // Hide Practice Assistant item when the therapist has turned Platform features off
  // in Settings. Other items stay visible. Defaults to visible when the
  // flag is undefined (existing therapists not yet migrated).
  const aiOff = therapist?.ai_enabled === false;
  const moreItems = MORE_ITEMS.filter(item => !(aiOff && item.id === 'ai'));

  // Close drawer on back navigation
  useEffect(() => {
    const handler = () => setShowMore(false);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // NOTE: we intentionally do NOT lock body scroll. iOS Safari has a known
  // issue where document.body.style.overflow='hidden' can get stuck after
  // navigation or animation races, leaving the whole app un-scrollable.
  // The overlay div (zIndex 998) already blocks taps to content behind it.

  const handleTab = (id) => {
    if (id === 'more') { setShowMore(v => !v); return; }
    setShowMore(false);
    onChange(id);
  };

  const navHeight = 74;

  return (
    <>
      {/* Overlay */}
      {showMore && (
        <div onClick={() => setShowMore(false)}
          style={{ position:'fixed', inset:0, zIndex:998, background:'rgba(26,26,46,0.5)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', animation:'bmFadeIn 0.25s ease' }} />
      )}

      {/* Premium More Sheet */}
      <div style={{
        position: 'fixed',
        bottom: showMore ? navHeight : -600,
        left: 0, right: 0,
        zIndex: 999,
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAF7 100%)',
        borderRadius: '24px 24px 0 0',
        borderTop: '1px solid #E8E4DC',
        boxShadow: '0 -16px 48px rgba(42,87,65,0.12), 0 -2px 8px rgba(0,0,0,0.04)',
        maxHeight: '78vh',
        overflow: 'hidden',
        transition: 'bottom 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{ padding: '12px 18px 20px', overflowY: 'auto', maxHeight: '78vh' }}>
          {/* Handle bar */}
          <div style={{ width: 44, height: 5, background: '#E5E1D8', borderRadius: 3, margin: '0 auto 18px' }} />

          {/* Time-of-day greeting. First name only for warmth.
              Falls back gracefully if name is missing. Per HK
              direction May 8, 2026: 'their name should be on top
              saying Hi Sarah as an example'. */}
          {(() => {
            const firstName = (therapist?.full_name || '').trim().split(/\s+/)[0] || '';
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
            return (
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 22,
                fontWeight: 700,
                color: '#1F2937',
                margin: '0 0 14px 0',
                lineHeight: 1.2,
              }}>
                {greeting}{firstName ? `, ${firstName}` : ''}.
              </div>
            );
          })()}

          {/* Therapist header card. Shows business name and full
              name on separate lines so the older-LMT persona can
              clearly see both their practice identity and their
              own name. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', marginBottom: 16,
            background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
            borderRadius: 14,
            border: '1px solid #BBF7D0',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2A5741, #4B8A6A)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, fontFamily: 'Georgia,serif',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(42,87,65,0.25)',
            }}>
              {(therapist?.full_name || 'B')[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {therapist?.business_name && (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {therapist.business_name}
                </div>
              )}
              {therapist?.full_name && therapist.full_name !== therapist?.business_name && (
                <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {therapist.full_name}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🌿</span> Silver
              </div>
            </div>
          </div>

          {/* Menu cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {moreItems.map(item => {
              const isActive = active === item.id;
              return (
                <button key={item.id} onClick={() => { onChange(item.id); setShowMore(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '14px 16px',
                    background: isActive ? item.gradient : '#fff',
                    border: `1.5px solid ${isActive ? item.border : '#F3F4F6'}`,
                    borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                    boxShadow: isActive ? '0 3px 12px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: item.gradient,
                    border: `1px solid ${item.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, flexShrink: 0,
                  }}>
                    {item.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', marginBottom: 2, fontFamily: 'Georgia, serif', letterSpacing: '-0.01em' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.3 }}>{item.sub}</div>
                  </div>
                  <span style={{ color: isActive ? C.forest : '#D1D5DB', fontSize: 20, fontWeight: 300, flexShrink: 0 }}>
                    {isActive ? '●' : '›'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sign out, clean row, not loud */}
          <button onClick={() => { onSignOut?.(); setShowMore(false); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 16px',
              background: '#fff',
              border: '1.5px solid #F3F4F6',
              borderRadius: 14, cursor: 'pointer',
              marginBottom: 12,
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ fontSize: 15 }}>👋</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>Sign out</span>
          </button>

          {/* Safe area spacer, ensures Sign Out never gets cut off on iPhone */}
          <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 8px)' }} />
        </div>
      </div>

      {/* Modern bottom nav bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 20px rgba(42,87,65,0.06)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: `calc(${navHeight}px + env(safe-area-inset-bottom, 0px))`,
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id || (tab.id === 'more' && showMore);
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => handleTab(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '10px 2px 8px',
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative', gap: 4, minWidth: 0,
                WebkitTapHighlightColor: 'transparent',
              }}>
              <div style={{
                width: 44, height: 32, borderRadius: 16,
                background: isActive
                  ? 'linear-gradient(135deg, #DCFCE7, #BBF7D0)'
                  : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s ease, transform 0.2s ease',
                transform: isActive ? 'translateY(-1px)' : 'none',
                position: 'relative',
                boxShadow: isActive ? '0 2px 6px rgba(42,87,65,0.15)' : 'none',
              }}>
                <Icon color={isActive ? C.forest : '#9CA3AF'} size={22} />
                {tab.id === 'outreach' && unreadCount > 0 && (
                  <div style={{
                    position: 'absolute', top: -2, right: 6,
                    minWidth: 18, height: 18,
                    padding: '0 5px',
                    background: '#EF4444', borderRadius: 20,
                    border: '2px solid #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                    lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isActive ? C.forest : '#6B7280',
                fontFamily: '-apple-system, system-ui',
                letterSpacing: '-0.01em',
                transition: 'color 0.15s ease, font-weight 0.15s ease',
              }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes bmFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
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
    <circle cx="5" cy="12" r="1.8" fill={color}/>
    <circle cx="12" cy="12" r="1.8" fill={color}/>
    <circle cx="19" cy="12" r="1.8" fill={color}/>
  </svg>;
}
