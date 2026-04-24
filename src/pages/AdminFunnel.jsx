// Admin funnel dashboard. Only accessible to admin emails (hardcoded list below).
// Shows: signups this week/month, activation event counts, drip sends, referrals,
// flagged signups, and blocked attempts.

import React from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAILS = new Set([
  'bodymap01@gmail.com',
  'bodymapdemo@gmail.com',
  'harshk.mba@gmail.com',
]);

const C = { forest: '#2A5741', sage: '#6B9E80', cream: '#FFF9F3', dark: '#1F2937', gray: '#6B7280', light: '#E8E4DC' };

export default function AdminFunnel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // Kick anyone who isn't in the allowlist
  React.useEffect(() => {
    if (user && !ADMIN_EMAILS.has((user.email || '').toLowerCase())) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  React.useEffect(() => {
    if (!user || !ADMIN_EMAILS.has((user.email || '').toLowerCase())) return;
    (async () => {
      const now = new Date();
      const wk = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const mo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Signups this week and month
      const [{ count: signupsWeek }, { count: signupsMonth }, { count: signupsTotal }] = await Promise.all([
        supabase.from('therapists').select('id', { count: 'exact', head: true }).gte('created_at', wk),
        supabase.from('therapists').select('id', { count: 'exact', head: true }).gte('created_at', mo),
        supabase.from('therapists').select('id', { count: 'exact', head: true }),
      ]);

      // Activation counts (distinct therapists per event), scope to last 30 days of signups
      const { data: recentTherapists } = await supabase
        .from('therapists').select('id').gte('created_at', mo);
      const recentIds = (recentTherapists || []).map(r => r.id);

      const funnel = {
        signed_up: recentIds.length,
        imported_clients: 0,
        added_service: 0,
        set_availability: 0,
        shared_booking_link: 0,
        sent_first_intake: 0,
      };
      if (recentIds.length > 0) {
        const { data: events } = await supabase
          .from('activation_events')
          .select('therapist_id, event_name')
          .in('therapist_id', recentIds);
        const seen = {};
        for (const e of events || []) {
          seen[e.event_name] = seen[e.event_name] || new Set();
          seen[e.event_name].add(e.therapist_id);
        }
        for (const key of Object.keys(funnel)) {
          if (seen[key]) funnel[key] = seen[key].size;
        }
      }

      // Drip sends breakdown
      const { data: dripRows } = await supabase
        .from('drip_sends').select('drip_day, status').gte('sent_at', mo);
      const dripByDay = {};
      for (const r of dripRows || []) {
        dripByDay[r.drip_day] = dripByDay[r.drip_day] || { sent: 0, failed: 0 };
        if (r.status === 'sent') dripByDay[r.drip_day].sent++;
        else dripByDay[r.drip_day].failed++;
      }

      // Referrals
      const { count: refTotal } = await supabase
        .from('referrals').select('id', { count: 'exact', head: true });
      const { count: refWeek } = await supabase
        .from('referrals').select('id', { count: 'exact', head: true }).gte('created_at', wk);

      // Flagged signups last 7 days
      const { data: flagged } = await supabase
        .from('therapists')
        .select('full_name, email, business_name, signup_flag_reasons, created_at')
        .gte('created_at', wk)
        .not('signup_flag_reasons', 'is', null);

      // Blocked attempts last 7 days
      const { count: blockedCount } = await supabase
        .from('signup_attempts').select('id', { count: 'exact', head: true })
        .eq('outcome', 'blocked').gte('created_at', wk);

      setData({
        signups: { week: signupsWeek || 0, month: signupsMonth || 0, total: signupsTotal || 0 },
        funnel,
        drip: dripByDay,
        referrals: { total: refTotal || 0, week: refWeek || 0 },
        flagged: flagged || [],
        blockedCount: blockedCount || 0,
      });
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Loading…</div>;
  if (!data) return null;

  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.cream, padding: '32px 20px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: '0.14em', textTransform: 'uppercase' }}>🌿 Admin · Funnel</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, color: C.dark, margin: '6px 0 0' }}>Activation, drip, and referrals</h1>
        </div>

        {/* Topline signup stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          <Stat label="Signups this week" value={data.signups.week} />
          <Stat label="Last 30 days" value={data.signups.month} />
          <Stat label="All time" value={data.signups.total} />
          <Stat label="Blocked (7d)" value={data.blockedCount} tint="#991B1B" />
        </div>

        {/* Activation funnel */}
        <Section title="Activation funnel (last 30 days)">
          <p style={{ fontSize: 13, color: C.gray, margin: '0 0 14px' }}>Of the {data.funnel.signed_up} therapists who signed up, this is how many completed each step.</p>
          <FunnelRow label="Signed up" value={data.funnel.signed_up} base={data.funnel.signed_up} />
          <FunnelRow label="Imported clients" value={data.funnel.imported_clients} base={data.funnel.signed_up} />
          <FunnelRow label="Added a service" value={data.funnel.added_service} base={data.funnel.signed_up} />
          <FunnelRow label="Set availability" value={data.funnel.set_availability} base={data.funnel.signed_up} />
          <FunnelRow label="Shared booking link" value={data.funnel.shared_booking_link} base={data.funnel.signed_up} />
          <FunnelRow label="Sent first intake" value={data.funnel.sent_first_intake} base={data.funnel.signed_up} />
        </Section>

        {/* Drip performance */}
        <Section title="Drip emails (last 30 days)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {[2, 5, 10, 21, 30].map(day => {
              const d = data.drip[day] || { sent: 0, failed: 0 };
              return (
                <div key={day} style={{ padding: 12, border: `1.5px solid ${C.light}`, borderRadius: 10, background: '#fff' }}>
                  <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Day {day}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>{d.sent}</div>
                  {d.failed > 0 && <div style={{ fontSize: 11, color: '#991B1B' }}>{d.failed} failed</div>}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Referrals */}
        <Section title="Referrals">
          <div style={{ display: 'flex', gap: 20 }}>
            <Stat label="All-time" value={data.referrals.total} small />
            <Stat label="This week" value={data.referrals.week} small />
          </div>
        </Section>

        {/* Flagged signups */}
        {data.flagged.length > 0 && (
          <Section title={`Flagged signups last 7 days (${data.flagged.length})`}>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, overflow: 'hidden' }}>
              {data.flagged.map((f, i) => (
                <div key={i} style={{ padding: '10px 14px', borderBottom: i < data.flagged.length - 1 ? '1px solid #FDE68A' : 'none', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: C.dark }}>{f.business_name || f.full_name}</div>
                  <div style={{ color: C.gray, fontSize: 12 }}>{f.email} · {(f.signup_flag_reasons || []).join(', ')}</div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tint, small }) {
  return (
    <div style={{ padding: small ? 12 : 18, background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: small ? 22 : 30, fontWeight: 700, color: tint || C.dark, fontFamily: 'Georgia, serif' }}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${C.light}`, borderRadius: 14, padding: 22, marginBottom: 20 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 14px' }}>{title}</h2>
      {children}
    </div>
  );
}

function FunnelRow({ label, value, base }) {
  const pct = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: C.dark, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.gray }}>{value} ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: C.light, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.forest}, ${C.sage})`, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}
