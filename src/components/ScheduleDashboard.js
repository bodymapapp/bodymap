// src/components/ScheduleDashboard.js
import React, { useState } from 'react';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF', gold: '#C9A84C',
  red: '#DC2626', amber: '#D97706', green: '#16A34A'
};

const TODAY = new Date();
const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const DUMMY_APPOINTMENTS = [
  { id: 1, client: 'Sarah M.', time: '9:00 AM', duration: 60, date: TODAY, status: 'intake-done', focus: 'Neck & Shoulders', sessions: 7 },
  { id: 2, client: 'Jennifer K.', time: '10:30 AM', duration: 90, date: TODAY, status: 'pending-intake', focus: '—', sessions: 2 },
  { id: 3, client: 'Maria L.', time: '12:00 PM', duration: 60, date: TODAY, status: 'complete', focus: 'Lower Back', sessions: 14 },
  { id: 4, client: 'Rachel T.', time: '2:00 PM', duration: 60, date: TODAY, status: 'pending-intake', focus: '—', sessions: 1 },
  { id: 5, client: 'Amy W.', time: '3:30 PM', duration: 90, date: TODAY, status: 'intake-done', focus: 'Full Back', sessions: 5 },
  { id: 6, client: 'Dana P.', time: '9:00 AM', duration: 90, date: addDays(TODAY, 1), status: 'pending-intake', focus: '—', sessions: 3 },
  { id: 7, client: 'Christine B.', time: '11:00 AM', duration: 60, date: addDays(TODAY, 1), status: 'pending-intake', focus: '—', sessions: 9 },
  { id: 8, client: 'Lisa N.', time: '2:00 PM', duration: 90, date: addDays(TODAY, 2), status: 'pending-intake', focus: '—', sessions: 1 },
  { id: 9, client: 'Tanya R.', time: '4:00 PM', duration: 60, date: addDays(TODAY, 2), status: 'pending-intake', focus: '—', sessions: 6 },
  { id: 10, client: 'Monica G.', time: '10:00 AM', duration: 60, date: addDays(TODAY, 4), status: 'pending-intake', focus: '—', sessions: 11 },
];

const STATUS_CONFIG = {
  'intake-done':    { label: '🧭 Intake Done',    bg: '#DCFCE7', color: '#16A34A' },
  'pending-intake': { label: '🔔 Pending Intake', bg: '#FEF3C7', color: '#D97706' },
  'complete':       { label: '✅ Complete',         bg: '#F0FDF4', color: '#16A34A' },
};

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 120, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || '#2A5741', fontFamily: 'Georgia, serif' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function AppointmentCard({ appt, intakeUrl }) {
  const [copied, setCopied] = useState(false);
  const sc = STATUS_CONFIG[appt.status];
  const firstName = appt.client.split(' ')[0];

  const copyLink = () => {
    navigator.clipboard.writeText(intakeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const smsLink = `sms:&body=${encodeURIComponent(`Hi ${firstName}! Please fill out your intake form before your session: ${intakeUrl}`)}`;

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12, padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex',
      alignItems: 'center', gap: 16, flexWrap: 'wrap',
      borderLeft: `4px solid ${sc.color}`
    }}>
      <div style={{ minWidth: 70 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937' }}>{appt.time}</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>{appt.duration} min</div>
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: '#2A5741', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, flexShrink: 0
      }}>
        {appt.client.split(' ').map(w => w[0]).join('')}
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937' }}>{appt.client}</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>{appt.sessions} sessions · {appt.focus !== '—' ? `Focus: ${appt.focus}` : 'No intake yet'}</div>
      </div>
      <div style={{
        background: sc.bg, color: sc.color,
        borderRadius: 20, padding: '4px 12px',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
      }}>
        {sc.label}
      </div>
      {appt.status === 'pending-intake' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={smsLink} style={{
            background: '#6B9E80', color: '#FFFFFF', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 600,
            textDecoration: 'none', display: 'inline-block'
          }}>💬 SMS</a>
          <button onClick={copyLink} style={{
            background: 'transparent', color: '#6B9E80',
            border: '1.5px solid #6B9E80', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>{copied ? '✓ Copied' : '📋 Copy'}</button>
        </div>
      )}
      {appt.status === 'intake-done' && (
        <button style={{
          background: '#2A5741', color: '#FFFFFF', border: 'none',
          borderRadius: 8, padding: '7px 14px', fontSize: 12,
          fontWeight: 600, cursor: 'pointer'
        }}>📋 Review Brief</button>
      )}
    </div>
  );
}

export default function ScheduleDashboard({ therapist }) {
  const [selectedDay, setSelectedDay] = useState(0);
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url || 'demo'}`;
  const days = [0, 1, 2, 3, 4].map(n => addDays(TODAY, n));

  const todayAppts = DUMMY_APPOINTMENTS.filter(a => a.date.toDateString() === TODAY.toDateString());
  const intakeDone = todayAppts.filter(a => a.status === 'intake-done').length;
  const pendingCount = todayAppts.filter(a => a.status === 'pending-intake').length;
  const selectedDate = days[selectedDay];
  const filtered = DUMMY_APPOINTMENTS.filter(a => a.date.toDateString() === selectedDate.toDateString());

  return (
    <div style={{ maxWidth: 860, width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#1F2937', margin: '0 0 4px 0' }}>
          📅 Schedule
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>{fmt(TODAY)}</p>
      </div>

      <div style={{
        background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10,
        padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#92400E',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        🔗 <strong>Cal.com integration coming soon.</strong>&nbsp;This preview uses sample data. Your real appointments will sync automatically.
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="Today's Sessions" value={todayAppts.length} sub="scheduled" color="#2A5741" />
        <StatCard label="Intake Done" value={intakeDone} sub="ready to review" color="#16A34A" />
        <StatCard label="Pending Intake" value={pendingCount} sub="send link now" color="#D97706" />
        <StatCard label="This Week" value={DUMMY_APPOINTMENTS.length} sub="total sessions" color="#6B9E80" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {days.map((d, i) => {
          const count = DUMMY_APPOINTMENTS.filter(a => a.date.toDateString() === d.toDateString()).length;
          const isSelected = i === selectedDay;
          return (
            <button key={i} onClick={() => setSelectedDay(i)} style={{
              background: isSelected ? '#2A5741' : '#FFFFFF',
              color: isSelected ? '#FFFFFF' : '#1F2937',
              border: `1.5px solid ${isSelected ? '#2A5741' : '#E5E7EB'}`,
              borderRadius: 10, padding: '10px 18px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
            }}>
              <div>{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{count} session{count !== 1 ? 's' : ''}</div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        {fmtShort(selectedDate)} — {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
          No appointments scheduled for this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(appt => <AppointmentCard key={appt.id} appt={appt} intakeUrl={intakeUrl} />)}
        </div>
      )}
    </div>
  );
}
