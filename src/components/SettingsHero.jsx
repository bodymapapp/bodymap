// src/components/SettingsHero.jsx
//
// Top-of-Settings personal hero: avatar, italic Fraunces greeting, three
// quick practice stats, a botanical leaf that fills as setup completes, and
// a "recently touched" chips strip. Replaces the old Profile Completion bar
// with something that feels like a command center, not a checklist.
//
// Designed at 380px mobile width as the persona is mobile-first, but holds
// up on desktop with its own max-width inside a centered container.

import React from "react";
import { supabase } from "../lib/supabase";

const C = {
  cream: '#FAF4E8',
  creamDeep: '#F0EAD9',
  forest: '#2A5741',
  forestInk: '#1F3A2C',
  sage: '#6B9E80',
  sageMute: '#98A395',
  gold: '#C9A84C',
  goldText: '#8B6F25',
  ink: '#1F3A2C',
  inkSoft: '#6B7C68',
  border: 'rgba(31,58,44,0.08)',
};

function initials(name) {
  if (!name) return 'M';
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

function timeSince(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SettingsHero({ therapist }) {
  const [stats, setStats] = React.useState({ clients: 0, sessionsThisMonth: 0, revenueThisMonth: 0 });
  const [completion, setCompletion] = React.useState({ done: 0, total: 22 });
  const [recent, setRecent] = React.useState([]);

  React.useEffect(() => {
    if (!therapist?.id) return;
    let cancelled = false;
    (async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();

      const [
        { count: clientsCount },
        { data: monthlySessions },
      ] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('therapist_id', therapist.id),
        supabase.from('sessions').select('id, created_at').eq('therapist_id', therapist.id).gte('created_at', startIso),
      ]);

      const sessionsThisMonth = monthlySessions?.length || 0;

      const { data: paidThisMonth } = await supabase.from('bookings')
        .select('addon_total_price, services(price)')
        .eq('therapist_id', therapist.id)
        .eq('status', 'confirmed')
        .gte('booking_date', startIso.slice(0, 10));

      let revenue = 0;
      (paidThisMonth || []).forEach(b => {
        revenue += Number(b?.services?.price || 0);
        revenue += Number(b?.addon_total_price || 0);
      });

      if (!cancelled) {
        setStats({
          clients: clientsCount || 0,
          sessionsThisMonth,
          revenueThisMonth: Math.round(revenue),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [therapist?.id]);

  React.useEffect(() => {
    if (!therapist) return;
    const checks = [
      !!therapist.full_name,
      !!therapist.business_name,
      !!therapist.phone,
      !!therapist.photo_url,
      !!therapist.custom_url,
      therapist.deposit_enabled === true,
      therapist.buffer_enabled !== false,
      therapist.practice_pulse_enabled !== false,
      therapist.ai_enabled !== false,
      !!therapist.cal_connected || !!therapist.cal_api_key,
      !!therapist.stripe_account_id,
      !!therapist.twilio_phone_number,
      !!therapist.waiver_text,
      !!therapist.referral_code,
    ];
    const done = checks.filter(Boolean).length;
    setCompletion({ done, total: checks.length });
  }, [therapist]);

  React.useEffect(() => {
    if (!therapist?.id) return;
    let cancelled = false;
    (async () => {
      const items = [];
      const [
        { data: addons },
        { data: services },
        { data: packages },
      ] = await Promise.all([
        supabase.from('service_addons').select('name, created_at').eq('therapist_id', therapist.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('services').select('name, created_at').eq('therapist_id', therapist.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('packages').select('name, created_at').eq('therapist_id', therapist.id).order('created_at', { ascending: false }).limit(1),
      ]);
      if (addons?.[0]) items.push({ label: 'Add-ons', when: addons[0].created_at });
      if (services?.[0]) items.push({ label: 'Services', when: services[0].created_at });
      if (packages?.[0]) items.push({ label: 'Packages', when: packages[0].created_at });
      items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      if (!cancelled) setRecent(items.slice(0, 3));
    })();
    return () => { cancelled = true; };
  }, [therapist?.id]);

  const pct = completion.total > 0 ? completion.done / completion.total : 0;
  const remainingSetup = completion.total - completion.done;

  const formatRevenue = (n) => {
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
    return '$' + n;
  };

  const greetingFirst = (therapist?.full_name || '').split(/\s+/)[0] || 'there';

  return (
    <div className="bm-settings-hero" style={{
      background: C.cream,
      borderRadius: 22,
      padding: '20px 18px',
      marginBottom: 20,
      border: `0.5px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: therapist?.photo_url ? `url(${therapist.photo_url}) center/cover` : C.forest,
          color: C.creamDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Georgia, serif', fontStyle: 'italic',
          fontSize: 22, flexShrink: 0,
          border: `2px solid ${C.cream}`,
          boxShadow: '0 0 0 1px rgba(31,58,44,0.08)',
        }}>
          {!therapist?.photo_url && initials(therapist?.full_name || therapist?.business_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            fontSize: 19, color: C.forestInk, margin: 0, lineHeight: 1.15,
          }}>
            Welcome back, <span style={{ color: C.forest }}>{greetingFirst}.</span>
          </p>
          {therapist?.custom_url && (
            <p style={{ fontSize: 11, color: C.sageMute, margin: '2px 0 0' }}>
              mybodymap.app/{therapist.custom_url}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '9px 6px', textAlign: 'center', border: `0.5px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: C.forest, lineHeight: 1, marginBottom: 2 }}>{stats.clients}</div>
          <div style={{ fontSize: 9.5, color: C.sageMute, letterSpacing: '0.04em', textTransform: 'uppercase' }}>clients</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '9px 6px', textAlign: 'center', border: `0.5px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: C.forest, lineHeight: 1, marginBottom: 2 }}>{stats.sessionsThisMonth}</div>
          <div style={{ fontSize: 9.5, color: C.sageMute, letterSpacing: '0.04em', textTransform: 'uppercase' }}>sessions</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '9px 6px', textAlign: 'center', border: `0.5px solid ${C.border}` }}>
          <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: C.forest, lineHeight: 1, marginBottom: 2 }}>{formatRevenue(stats.revenueThisMonth)}</div>
          <div style={{ fontSize: 9.5, color: C.sageMute, letterSpacing: '0.04em', textTransform: 'uppercase' }}>this month</div>
        </div>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: recent.length > 0 ? 14 : 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: `0.5px solid ${C.border}`,
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
          <defs>
            <clipPath id={`leafclip-${therapist?.id || 'x'}`}>
              <path d="M22 6 C 32 6, 38 14, 38 24 C 38 34, 30 38, 22 38 C 14 38, 6 34, 6 24 C 6 14, 12 6, 22 6 Z"/>
            </clipPath>
          </defs>
          <path d="M22 6 C 32 6, 38 14, 38 24 C 38 34, 30 38, 22 38 C 14 38, 6 34, 6 24 C 6 14, 12 6, 22 6 Z" fill={C.creamDeep} stroke={C.sage} strokeWidth="0.5"/>
          <g clipPath={`url(#leafclip-${therapist?.id || 'x'})`}>
            <rect x="0" y={44 - (33 * pct)} width="44" height={33 * pct + 11} fill={C.sage} />
          </g>
          <path d="M22 6 L 22 38" stroke={C.cream} strokeWidth="0.6"/>
          <path d="M22 14 L 16 18 M22 20 L 14 24 M22 26 L 16 30 M22 14 L 28 18 M22 20 L 30 24 M22 26 L 28 30" stroke={C.cream} strokeWidth="0.5" opacity="0.7"/>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
            fontSize: 14, color: C.forestInk, margin: '0 0 2px',
          }}>
            {pct >= 1 ? 'Your practice is in full bloom.' : pct > 0.7 ? 'Your practice is taking root.' : pct > 0.3 ? 'Setup is underway.' : 'Let\'s get you set up.'}
          </p>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: 0 }}>
            {completion.done} of {completion.total} things tended{remainingSetup > 0 ? ` · ${remainingSetup} quiet whisper${remainingSetup === 1 ? '' : 's'} below` : ' · all set'}
          </p>
        </div>
      </div>

      {recent.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: C.sageMute, letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 2 }}>
            Last touched
          </span>
          {recent.map((r, i) => (
            <span key={i} style={{
              background: 'rgba(201,168,76,0.18)',
              color: C.goldText,
              fontSize: 10.5,
              padding: '3px 9px',
              borderRadius: 99,
            }}>
              {r.label} · {timeSince(r.when)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
