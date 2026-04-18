import React, { useState } from 'react';

const C = { forest: '#2A5741', sage: '#6B9E80', gray: '#9CA3AF' };

const TABS = [
  { id: 'clients',  label: 'Clients',  icon: ClientsIcon  },
  { id: 'schedule', label: 'Schedule', icon: ScheduleIcon },
  { id: 'billing',  label: 'Billing',  icon: BillingIcon  },
  { id: 'outreach', label: 'Outreach', icon: OutreachIcon },
  { id: 'more',     label: 'More',     icon: MoreIcon     },
];

export default function MobileBottomNav({ active, onChange, unreadCount, onSignOut, therapist }) {
  const [showMore, setShowMore] = useState(false);
  const activeTab = ['ai','gifts','settings'].includes(active) ? 'more' : active;

  const handleTab = (id) => {
    if (id === 'more') { setShowMore(v => !v); return; }
    setShowMore(false);
    onChange(id);
  };

  return (
    <>
      {/* Overlay to close More drawer */}
      {showMore && (
        <div onClick={() => setShowMore(false)}
          style={{ position:'fixed', inset:0, zIndex:998, background:'rgba(0,0,0,0.2)' }} />
      )}

      {/* More drawer — slides up */}
      <div style={{
        position: 'fixed',
        bottom: 66,
        left: 0, right: 0,
        zIndex: 999,
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        borderTop: '1px solid #E8E4DC',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        maxHeight: showMore ? '50vh' : 0,
        overflow: 'hidden',
        transition: 'max-height 0.25s ease',
      }}>
        <div style={{ overflowY: 'auto', maxHeight: '50vh', paddingBottom: 8 }}>
          {[
            { id: 'settings', label: 'Settings',   emoji: '⚙️' },
            { id: 'ai',       label: 'AI Briefs',  emoji: '🧠' },
            { id: 'gifts',    label: 'Gift Cards', emoji: '🎁' },
          ].map(item => (
            <button key={item.id} onClick={() => { onChange(item.id); setShowMore(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '15px 20px',
                background: active === item.id ? '#F0FDF4' : 'none',
                border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: active === item.id ? 700 : 500,
                color: active === item.id ? C.forest : '#374151',
                textAlign: 'left',
              }}>
              <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{item.emoji}</span>
              {item.label}
              {active === item.id && <span style={{ marginLeft: 'auto', color: C.forest, fontSize: 16 }}>✓</span>}
            </button>
          ))}
          <div style={{ height: 1, background: '#F3F4F6', margin: '4px 20px' }} />
          <button onClick={() => { onSignOut?.(); setShowMore(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', padding: '15px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, color: '#EF4444', textAlign: 'left',
            }}>
            <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>🚪</span>
            Sign Out
          </button>
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
                position: 'relative', gap: 3, minWidth: 0,
              }}>
              <div style={{ position: 'relative' }}>
                <Icon color={isActive ? C.forest : C.gray} size={22} />
                {tab.id === 'outreach' && unreadCount > 0 && (
                  <div style={{
                    position: 'absolute', top: -4, right: -6,
                    background: '#DC2626', color: '#fff',
                    borderRadius: 10, minWidth: 16, height: 16,
                    fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px',
                  }}>{unreadCount}</div>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 400,
                color: isActive ? C.forest : C.gray,
                fontFamily: 'system-ui', whiteSpace: 'nowrap',
                overflow: 'hidden', maxWidth: '100%',
              }}>{tab.label}</span>
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 2,
                  background: C.forest,
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ClientsIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.8"/>
      <path d="M2 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.6"/>
      <path d="M14 20c0-2.761 1.79-5 4-5s4 2.239 4 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function ScheduleIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="3" stroke={color} strokeWidth="1.8"/>
      <path d="M3 9h18" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M8 2v3M16 2v3" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="6.5" y="12" width="3" height="2.5" rx="0.5" fill={color} opacity="0.6"/>
      <rect x="10.5" y="12" width="3" height="2.5" rx="0.5" fill={color}/>
      <rect x="14.5" y="12" width="3" height="2.5" rx="0.5" fill={color} opacity="0.4"/>
    </svg>
  );
}
function BillingIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke={color} strokeWidth="1.8"/>
      <path d="M2 10h20" stroke={color} strokeWidth="1.8"/>
      <path d="M6 15h4M14 15h4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function OutreachIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 4L3 11l7 3 3 7 7-17z" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M10 14l4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function MoreIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.5" fill={color}/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
      <circle cx="19" cy="12" r="1.5" fill={color}/>
    </svg>
  );
}
