import React from 'react';

const C = { forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8', gray: '#9CA3AF' };

const TABS = [
  { id: 'clients',   label: 'Clients',   icon: ClientsIcon  },
  { id: 'schedule',  label: 'Schedule',  icon: ScheduleIcon },
  { id: 'billing',   label: 'Billing',   icon: BillingIcon  },
  { id: 'outreach',  label: 'Outreach',  icon: OutreachIcon },
  { id: 'settings',  label: 'Settings',  icon: SettingsIcon },
];

export default function MobileBottomNav({ active, onChange, unreadCount }) {
  return (
    <div className="bm-bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
      background: '#fff',
      borderTop: '1px solid #E8E4DC',
      display: 'flex', alignItems: 'stretch',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '10px 4px 8px',
              background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative', gap: 4,
              transition: 'all 0.15s ease',
            }}>
            <div style={{ position: 'relative' }}>
              <Icon color={isActive ? C.forest : C.gray} size={22} />
              {tab.id === 'outreach' && unreadCount > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -6,
                  background: '#DC2626', color: '#fff',
                  borderRadius: 10, minWidth: 16, height: 16,
                  fontSize: 9, fontWeight: 800, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', fontFamily: 'system-ui',
                }}>{unreadCount}</div>
              )}
            </div>
            <span style={{
              fontSize: 10, fontWeight: isActive ? 700 : 500,
              color: isActive ? C.forest : C.gray,
              fontFamily: 'system-ui', letterSpacing: isActive ? '-0.01em' : 0,
              transition: 'all 0.15s ease',
            }}>{tab.label}</span>
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 2, background: C.forest, borderRadius: '0 0 2px 2px',
              }} />
            )}
          </button>
        );
      })}
    </div>
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

function SettingsIcon({ color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
