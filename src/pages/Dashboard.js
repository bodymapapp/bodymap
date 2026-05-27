// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, supabase } from '../lib/supabase';
import { openExternalClick } from '../lib/openExternal';
import { isSampleId, isSampleSessionId, getSampleClient, getSampleSession, buildSampleProfile } from '../data/sampleClients';
import ClientList from '../components/ClientList';
import SessionList from '../components/SessionList';
import ClientProfile from '../components/ClientProfile';
import SessionDetail from '../components/SessionDetail';
import ScheduleDashboard from '../components/ScheduleDashboard';
import BillingDashboard from '../components/BillingDashboard';
import AIDashboard from '../components/AIDashboard';
import NotificationsBell from '../components/NotificationsBell';
import GiftCertificates from '../components/GiftCertificates';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import PackagesCard from '../components/PackagesCard';
import MembershipsCard from '../components/MembershipsCard';
import EventsCard from '../components/EventsCard';
import SettingsHero from '../components/SettingsHero';
import SettingsSectionHeader from '../components/SettingsSectionHeader';
import InlineSaveNumberInput from '../components/InlineSaveNumberInput';
import DisclosureRow from '../components/DisclosureRow';
import CollapsibleSection from '../components/CollapsibleSection';
import SettingsGroup from '../components/SettingsGroup';
import StatsStrip from '../components/StatsStrip';
import SeedDefaults from '../components/SeedDefaults';
import InlineEditField from '../components/InlineEditField';
import InlineEditDescription from '../components/InlineEditDescription';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { buildOnboardingNavigate } from '../lib/onboardingNavigate';
import CycleScheduling from '../components/CycleScheduling';
import Outreach from '../components/Outreach';
import ImportClients from '../components/ImportClients';
import UnifiedImport from '../components/UnifiedImport';
import BMLogo from '../components/BMLogo';
import MobileBottomNav from '../components/MobileBottomNav';
import PWAInstallBanner from '../components/PWAInstallBanner';
import FloatingBookingChip from '../components/FloatingBookingChip';
import { ActivationNudge, LapsedClientAlert, BookingLinkNudge } from '../components/MarketingNudges';
import PurchasesPanel from '../components/PurchasesPanel';
import PaymentRouting from '../components/PaymentRouting';
import { useMobile } from '../hooks/useMobile';
import usePushNotifications from '../hooks/usePushNotifications';
import WaiverCard from '../components/WaiverCard';
import NotificationSettingsTable from '../components/NotificationSettingsTable';
import QRCodesCard from '../components/QRCodesCard';
import CancellationPolicy from '../components/CancellationPolicy';
import BookingPolicies from '../components/BookingPolicies';
import PracticeAgreement from '../components/PracticeAgreement';
import CloseButton from '../components/CloseButton';

// Soft banner shown on the dashboard for therapists who pre-date the
// phone verification feature (created before PHONE_GATE_FROM). Encourages
// verification without blocking access. New signups (after PHONE_GATE_FROM)
// are hard-gated and never see this banner because the dashboard
// redirects them to /verify-phone first.
function PhoneVerifyBanner({ therapist, navigate }) {
  const PHONE_GATE_FROM = '2026-05-12T00:00:00Z';
  if (!therapist) return null;
  if (therapist.phone_verified_at) return null;
  if (therapist.created_at && therapist.created_at >= PHONE_GATE_FROM) return null;
  return (
    <div style={{
      background: '#FFF7E6',
      border: '1px solid #F0C75A',
      borderRadius: 12,
      padding: '14px 18px',
      marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ fontSize: 22, lineHeight: 1 }}>📱</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, color: '#5C4708', marginBottom: 2, fontSize: 14 }}>
          Verify your phone
        </div>
        <div style={{ fontSize: 12.5, color: '#785D14', lineHeight: 1.45 }}>
          Unlock SMS reminders, gift cards, and client check-ins. Takes 30 seconds.
        </div>
      </div>
      <button
        onClick={() => navigate('/verify-phone')}
        style={{
          background: '#92660E', color: 'white',
          border: 'none', padding: '9px 16px', borderRadius: 8,
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
        Verify now
      </button>
    </div>
  );
}

// Mobile page-end indicator
function PageEnd() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'28px 0 12px', opacity:0.25 }}>
      <div style={{ flex:1, height:1, background:'#9CA3AF' }} />
      <div style={{ width:4, height:4, borderRadius:'50%', background:'#9CA3AF' }} />
      <div style={{ flex:1, height:1, background:'#9CA3AF' }} />
    </div>
  );
}

// Compact link row with copy + preview buttons. Used in Section 1.3
// for both the booking link and intake link. Replaces the previous
// big-green-card hero treatment which was visually too heavy and
// had its preview pointed at the wrong URL.
function LinkRow({ label, sublabel, url, C2 }) {
  const [copied, setCopied] = useState(false);
  const displayUrl = url.replace(/^https?:\/\//, '');
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C2.lightGray}`,
      borderRadius: 10,
      padding: '11px 14px',
    }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C2.darkGray }}>{label}</div>
        <div style={{ fontSize: 11, color: C2.gray, marginTop: 1 }}>{sublabel}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1,
          minWidth: 0,
          background: '#F9FAFB',
          border: `1px solid ${C2.lightGray}`,
          borderRadius: 8,
          padding: '7px 10px',
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: C2.darkGray,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayUrl}
        </div>
        <button onClick={copy} style={{
          background: copied ? C2.forest : '#fff',
          color: copied ? '#fff' : C2.darkGray,
          border: `1px solid ${copied ? C2.forest : C2.lightGray}`,
          borderRadius: 8,
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openExternalClick(url)}
          style={{
            background: '#fff',
            color: C2.darkGray,
            border: `1px solid ${C2.lightGray}`,
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Preview →
        </a>
      </div>
    </div>
  );
}

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF'
};



function ServicesAndAvailability({ therapist }) {
  const C2 = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', darkGray:'#1A1A2E', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };
  const { updateProfile } = useAuth();
  const [depositEnabled, setDepositEnabled] = React.useState(therapist?.deposit_enabled || false);
  const [depositPercent, setDepositPercent] = React.useState(therapist?.deposit_percent || 20);
  const [bufferEnabled, setBufferEnabled] = React.useState(therapist?.buffer_enabled || false);
  const [bufferMinutes, setBufferMinutes] = React.useState(therapist?.buffer_minutes || 15);
  // Booking lead-time minimum (Lindsey #5, May 9 2026): how far ahead
  // the client must book. 0 = no restriction (client can book the
  // next slot, even 30 minutes from now). Common values: 4 hours,
  // 24 hours, 48 hours.
  const [minLeadHours, setMinLeadHours] = React.useState(therapist?.minimum_advance_hours ?? 0);
  // Maximum advance window: how far in the future the client can
  // book. 0 = unlimited. Common values: 30, 60, 90 days.
  const [maxAdvanceDays, setMaxAdvanceDays] = React.useState(therapist?.maximum_advance_days ?? 0);
  // Daily hands-on minutes cap (HK May 27 2026, Jacquie's ask).
  // Limits how many minutes of bookable session time the public
  // booking page will offer per day. 0 = no cap. Independent of
  // working hours. Therapist can still book past the cap from her
  // own dashboard; the cap only restricts the public booking page.
  const [maxHandsOnMinutes, setMaxHandsOnMinutes] = React.useState(therapist?.max_hands_on_minutes_per_day ?? 0);
  // Week start preference (HK May 27 2026). 0 = Sunday (default per
  // HK, matches most US calendars), 1 = Monday. Affects calendar
  // grid layout in Schedule and Settings tabs.
  const [weekStartsOn, setWeekStartsOn] = React.useState(therapist?.week_starts_on ?? 0);
  // Efficient scheduling (Lindsey #7, May 10 2026). Two-level toggle:
  //   schedulingMode: 'normal' | 'efficient'
  //   efficientStrictness: 'soft' | 'hard' (only used when efficient)
  const [schedulingMode, setSchedulingMode] = React.useState(therapist?.scheduling_mode || 'normal');
  const [efficientStrictness, setEfficientStrictness] = React.useState(therapist?.efficient_strictness || 'soft');
  // Tips + pay-in-full (Lindsey #2, May 10 2026).
  const [acceptTips, setAcceptTips] = React.useState(therapist?.accept_tips ?? true);
  const [payInFullEnabled, setPayInFullEnabled] = React.useState(therapist?.pay_in_full_enabled || false);
  const [tipPreset1, setTipPreset1] = React.useState(therapist?.tip_preset_1 ?? 15);
  const [tipPreset2, setTipPreset2] = React.useState(therapist?.tip_preset_2 ?? 18);
  const [tipPreset3, setTipPreset3] = React.useState(therapist?.tip_preset_3 ?? 20);
  const [depositSaving, setDepositSaving] = React.useState(false);
  // HK May 19 2026: opt-in service grouping. Therapist can choose to
  // organize her services into named groups. Default is off, flat
  // list (matches the simpler experience most therapists want). When
  // on, each service has a service_group text field and the menu
  // renders grouped sections with their own ordering.
  const [useGroups, setUseGroups] = React.useState(therapist?.use_service_groups || false);
  const [groupOrder, setGroupOrder] = React.useState(
    Array.isArray(therapist?.service_group_order) ? therapist.service_group_order : []
  );
  // Which service's 'Move to...' menu is currently open. null = none.
  const [moveMenuFor, setMoveMenuFor] = React.useState(null);
  // Inline 'New group' prompt state. null = prompt closed.
  const [newGroupDraft, setNewGroupDraft] = React.useState(null);
  // Which groups are collapsed. Set of group names ('Prenatal &
  // Postnatal', '__UNGROUPED__', etc.). Default empty = all expanded.
  const [collapsedGroups, setCollapsedGroups] = React.useState(new Set());
  const [services, setServices] = React.useState([]);
  const [availability, setAvailability] = React.useState([]);
  // Multi-location support (HK May 18 2026): list of therapist
  // locations. Empty array if therapist has none (the most common
  // case, including most current accounts). When length >= 2 the
  // per-service location picker shows up + booking pages add a
  // location step.
  const [locations, setLocations] = React.useState([]);
  const [locDraft, setLocDraft] = React.useState({ name: '', street1: '', street2: '', city: '', state: '', postal_code: '', notes: '' });
  const [locSaving, setLocSaving] = React.useState(false);
  const [locError, setLocError] = React.useState('');
  const [editingLocId, setEditingLocId] = React.useState(null);
  // Track which service the therapist is being asked to confirm
  // deletion for. null = no confirm pending. Inline-confirm pattern,
  // not a modal or window.confirm (per house rules + 70yo persona).
  const [pendingDeleteId, setPendingDeleteId] = React.useState(null);
  // Disclosure-row pattern for the "What I offer -> Services & hours"
  // panel (HK May 10 2026). Only one sub-row open at a time keeps the
  // Settings page short. Default 'services' since that's the daily-edit
  // setting; null collapses everything.
  const [openSubRow, setOpenSubRow] = React.useState('services');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(null);

  // Re-sync local state whenever therapist reloads (e.g. page refresh)
  React.useEffect(() => {
    setDepositEnabled(therapist?.deposit_enabled || false);
    setDepositPercent(therapist?.deposit_percent || 20);
    setMinLeadHours(therapist?.minimum_advance_hours ?? 0);
    setMaxAdvanceDays(therapist?.maximum_advance_days ?? 0);
    setMaxHandsOnMinutes(therapist?.max_hands_on_minutes_per_day ?? 0);
    setWeekStartsOn(therapist?.week_starts_on ?? 0);
    setSchedulingMode(therapist?.scheduling_mode || 'normal');
    setEfficientStrictness(therapist?.efficient_strictness || 'soft');
    setAcceptTips(therapist?.accept_tips ?? true);
    setPayInFullEnabled(therapist?.pay_in_full_enabled || false);
    setTipPreset1(therapist?.tip_preset_1 ?? 15);
    setTipPreset2(therapist?.tip_preset_2 ?? 18);
    setTipPreset3(therapist?.tip_preset_3 ?? 20);
  }, [therapist?.deposit_enabled, therapist?.deposit_percent, therapist?.minimum_advance_hours, therapist?.maximum_advance_days, therapist?.scheduling_mode, therapist?.efficient_strictness, therapist?.accept_tips, therapist?.pay_in_full_enabled, therapist?.tip_preset_1, therapist?.tip_preset_2, therapist?.tip_preset_3]);

  const PRESETS = [
    { name:'Swedish Massage', duration:60, price:85 },
    { name:'Deep Tissue', duration:60, price:100 },
    { name:'Hot Stone', duration:90, price:130 },
    { name:'Sports Massage', duration:60, price:95 },
    { name:'Prenatal Massage', duration:60, price:90 },
    { name:'Relaxation Massage', duration:60, price:80 },
    { name:'Chair Massage', duration:30, price:45 },
    { name:'Couples Massage', duration:90, price:180, is_couples:true },
    { name:'Custom...', duration:60, price:85 },
  ];

  const [draft, setDraft] = React.useState({ preset:'', name:'', duration:60, price:85, is_couples:false });
  const DAYS = [{id:1,label:'Mon'},{id:2,label:'Tue'},{id:3,label:'Wed'},{id:4,label:'Thu'},{id:5,label:'Fri'},{id:6,label:'Sat'},{id:0,label:'Sun'}];

  React.useEffect(() => { if (therapist?.id) load(); }, [therapist?.id]);

  // Pre-defined groups + keyword match. Defined ABOVE load() so load
  // can reference them when auto-classifying on initial fetch. The
  // toggleUseGroups and other group functions later in the component
  // also reference these via closure.
  const PREDEFINED_GROUPS = [
    'Prenatal & Postnatal',
    'Couples',
    'Therapeutic & Recovery',
    'Relaxation & Spa',
    'Energy & Modalities',
    'Add-ons',
  ];

  function classifyService(name) {
    const n = (name || '').toLowerCase();
    if (!n) return null;
    if (/pre[\s-]?natal|post[\s-]?natal|pregnan|maternity/.test(n)) return 'Prenatal & Postnatal';
    if (/couple|duo|two\s?person|partner massage/.test(n)) return 'Couples';
    if (/deep tissue|sports|recovery|trigger point|myofascial|neuromuscular|orthopedic|injury|rehab/.test(n)) return 'Therapeutic & Recovery';
    if (/swedish|hot stone|aromatherapy|relax|spa|lomi|hot towel|warm/.test(n)) return 'Relaxation & Spa';
    if (/reiki|cup|reflex|cranial|sacral|lymphatic|thai|shiatsu|energy|chakra/.test(n)) return 'Energy & Modalities';
    if (/add[\s-]?on|enhancement|upgrade|booster|extra/.test(n)) return 'Add-ons';
    return null;
  }

  async function load() {
    const [{ data: svcs }, { data: avail }, { data: locs }] = await Promise.all([
      // is_('archived_at', null) filters out soft-deleted services so
      // they don't reappear in the management list after Remove. The
      // archived rows still exist for FK integrity but the therapist
      // never sees them again.
      supabase.from('services').select('*').eq('therapist_id', therapist.id).is('archived_at', null).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('availability').select('*').eq('therapist_id', therapist.id),
      // Locations (HK May 18 2026): only active rows. Sorted by
      // sort_order so primary surfaces first.
      supabase.from('therapist_locations').select('*').eq('therapist_id', therapist.id).eq('active', true).order('sort_order', { ascending: true }),
    ]);
    let loadedSvcs = svcs || [];
    // HK May 19 2026: if therapist already has groups ON but services
    // were created before the auto-classify shipped (or somehow have
    // a null group), classify them now. Idempotent: services with a
    // group set are never touched.
    if ((therapist?.use_service_groups) && loadedSvcs.length > 0) {
      const unassigned = loadedSvcs.filter(s => !s.service_group);
      const updates = unassigned
        .map(s => ({ id: s.id, group: classifyService(s.name) }))
        .filter(u => u.group);
      if (updates.length > 0) {
        // Persist
        await Promise.all(
          updates.map(u =>
            supabase.from('services').update({ service_group: u.group }).eq('id', u.id)
          )
        );
        // Patch the loaded array so we render the new groups immediately
        loadedSvcs = loadedSvcs.map(s => {
          const u = updates.find(u => u.id === s.id);
          return u ? { ...s, service_group: u.group } : s;
        });
        // Seed group order with any newly-discovered groups
        const groupsInUse = Array.from(new Set([
          ...(Array.isArray(therapist?.service_group_order) ? therapist.service_group_order : []),
          ...updates.map(u => u.group),
        ]));
        const orderedByPredef = [
          ...PREDEFINED_GROUPS.filter(g => groupsInUse.includes(g)),
          ...groupsInUse.filter(g => !PREDEFINED_GROUPS.includes(g)),
        ];
        const currentOrder = Array.isArray(therapist?.service_group_order) ? therapist.service_group_order : [];
        if (JSON.stringify(orderedByPredef) !== JSON.stringify(currentOrder)) {
          setGroupOrder(orderedByPredef);
          await supabase
            .from('therapists')
            .update({ service_group_order: orderedByPredef })
            .eq('id', therapist.id);
        }
      }
    }
    setServices(loadedSvcs);
    setAvailability(avail || []);
    setLocations(locs || []);
    setLoading(false);
  }

  function handlePreset(val) {
    if (val === 'Custom...') {
      setDraft(d => ({ ...d, preset: val, name: '' }));
    } else {
      const p = PRESETS.find(x => x.name === val);
      if (p) setDraft({ preset: val, name: p.name, duration: p.duration, price: p.price, is_couples: p.is_couples || false });
    }
  }

  async function addService() {
    if (!draft.name.trim()) return;
    setSaving('add');
    // New services go to the end of the sort order. Compute max + 10
    // so therapist can drag/move within the list without renumbering
    // every neighbor. Steps of 10 preserve gaps for inserts.
    const maxSort = services.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
    // When groups are on, classify the new service by name keyword so
    // it lands in a group without the therapist having to assign it.
    const autoGroup = useGroups ? classifyService(draft.name) : null;
    const { data } = await supabase.from('services').insert({
      name: draft.name,
      duration: draft.duration,
      price: draft.price,
      therapist_id: therapist.id,
      active: true,
      visibility: 'public',
      is_couples: draft.is_couples || false,
      sort_order: maxSort + 10,
      service_group: autoGroup,
    }).select().single();
    setServices(s => [...s, data]);
    setDraft({ preset:'', name:'', duration:60, price:85 });
    setSaving(false);
    // If we auto-classified into a group not yet in the order, add it
    if (autoGroup && !groupOrder.includes(autoGroup)) {
      const nextOrder = [...groupOrder, autoGroup];
      setGroupOrder(nextOrder);
      await supabase
        .from('therapists')
        .update({ service_group_order: nextOrder })
        .eq('id', therapist.id);
    }
    // Activation: first service added
    if (therapist?.id) {
      try {
        const { trackActivation } = await import('../lib/activation');
        trackActivation(therapist.id, 'added_service');
      } catch {}
    }
  }

  async function toggleService(svc) {
    await supabase.from('services').update({ active: !svc.active }).eq('id', svc.id);
    setServices(s => s.map(x => x.id === svc.id ? { ...x, active: !x.active } : x));
  }

  // Visibility toggle for the Private flag.
  // public  → shown on public booking page + therapist book-on-behalf
  // private → therapist book-on-behalf only (hidden from public)
  // Backward compatible: legacy rows without the column default to 'public'.
  async function toggleServiceVisibility(svc) {
    const next = (svc.visibility === 'private') ? 'public' : 'private';
    await supabase.from('services').update({ visibility: next }).eq('id', svc.id);
    setServices(s => s.map(x => x.id === svc.id ? { ...x, visibility: next } : x));
  }

  async function deleteService(id) {
    // HK May 16 2026: Candice reported services come back after Remove.
    // Root cause: hard DELETE fails silently when bookings/packages/gift
    // cards reference the service via FK. The old code swallowed the
    // error and updated local state anyway, so the row vanished from
    // the UI but persisted in the database.
    //
    // Fix: try hard delete first. If it succeeds, great. If it fails
    // (almost always FK constraint), soft-delete by setting archived_at
    // so the booking history stays intact but the service disappears
    // from every list.
    const svc = services.find(s => s.id === id);
    if (!svc) return;

    const { error: deleteError } = await supabase.from('services').delete().eq('id', id);

    if (!deleteError) {
      // Hard delete worked: service had no historical references.
      setServices(s => s.filter(x => x.id !== id));
      return;
    }

    // Hard delete failed (likely FK constraint). Soft-delete instead so
    // the service disappears from all lists while preserving the booking
    // history that references it.
    const { error: archiveError } = await supabase
      .from('services')
      .update({ archived_at: new Date().toISOString(), active: false })
      .eq('id', id);

    if (archiveError) {
      console.error('deleteService: both delete and archive failed', { deleteError, archiveError });
      alert(`Could not remove "${svc.name}". ${archiveError.message || 'Please refresh and try again.'}`);
      return;
    }

    // Soft-delete succeeded: filter the row out of local state. The
    // database row still exists but archived_at is now set, so the
    // services list query (with archived_at IS NULL filter) will
    // not return it on next load.
    setServices(s => s.filter(x => x.id !== id));
  }

  // Inline-edit save for service price / duration. Optimistic update,
  // rollback on error.
  async function updateService(id, patch) {
    const prev = services.find(s => s.id === id);
    if (!prev) return;
    setServices(s => s.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('services').update(patch).eq('id', id);
    if (error) {
      console.error('updateService failed:', error);
      setServices(s => s.map(x => x.id === id ? prev : x));
    }
  }

  // HK May 19 2026: services can be reordered with up/down arrows.
  // Swaps the sort_order of the moved service with its neighbor in
  // the direction of movement. Optimistic update locally, then writes
  // both rows. On error, refetches to resync.
  //
  // Customer ask, Candice Peek: 'I'd like to group together my
  // prenatal and postnatal services rather than have them sorted by
  // duration.' Up/down arrows chosen over drag-and-drop for the
  // 70-year-old persona who finds touch drag tricky on phone.
  // HK May 19 2026: services can be reordered with number input or
  // up/down arrows. Both call setServicePosition under the hood with
  // the new 1-based position. The function recomputes sort_order
  // values stepped by 10 for the affected slice and persists all
  // changed rows.
  //
  // Why stepped sort_order: future inserts can fit between existing
  // values without renumbering every row. Visible display is always
  // 1-based contiguous (1, 2, 3...) because we render in sort_order
  // ASC then created_at ASC.
  //
  // Optimistic update strategy: compute the new sorted array locally,
  // patch sort_order on every row that needs to change, write all
  // changed rows in parallel. On any error, refetch from server.
  function getSortedServices() {
    return [...services].sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  async function setServicePosition(id, newPos1Based) {
    // When groups are on, the position is 1-based WITHIN the
    // service's own group. Renumber only that group's services.
    // When off, fall back to global renumbering.
    const allSorted = getSortedServices();
    const me = allSorted.find(s => s.id === id);
    if (!me) return;

    let scope;
    if (useGroups) {
      const groupKey = (me.service_group || '').trim() || '__UNGROUPED__';
      scope = allSorted.filter(s => {
        const k = (s.service_group || '').trim() || '__UNGROUPED__';
        return k === groupKey;
      });
    } else {
      scope = allSorted;
    }

    const currentIdx = scope.findIndex(s => s.id === id);
    if (currentIdx === -1) return;

    // Clamp the new position to the valid range within the scope
    const targetIdx = Math.max(0, Math.min(scope.length - 1, newPos1Based - 1));
    if (targetIdx === currentIdx) return;

    // Move the item within the scope array
    const moved = scope.splice(currentIdx, 1)[0];
    scope.splice(targetIdx, 0, moved);

    // Compute new sort_order values for the scope. We pack the scope
    // into the range of sort_order values it currently occupies, then
    // step by 10 between them. This keeps other groups' sort_order
    // intact so they don't get re-interleaved.
    const occupiedSorts = scope.map(s => s.sort_order ?? 9999).sort((a, b) => a - b);
    const updates = scope.map((svc, i) => ({
      id: svc.id,
      newSort: occupiedSorts[i],
    }));

    // Optimistic local update
    setServices(s => s.map(x => {
      const u = updates.find(u => u.id === x.id);
      return u ? { ...x, sort_order: u.newSort } : x;
    }));

    // Persist only the rows that actually changed
    const changed = updates.filter(u => {
      const original = services.find(s => s.id === u.id);
      return original && (original.sort_order ?? 9999) !== u.newSort;
    });
    if (changed.length === 0) return;

    const results = await Promise.all(
      changed.map(u =>
        supabase.from('services').update({ sort_order: u.newSort }).eq('id', u.id)
      )
    );
    const hasError = results.some(r => r.error);
    if (hasError) {
      console.error('setServicePosition failed:', results.find(r => r.error)?.error);
      // Refetch to resync
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('therapist_id', therapist.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (data) setServices(data);
    }
  }

  // Convenience wrapper for up/down arrows. Computes the current
  // 1-based position from the sorted list and shifts by 1.
  async function moveService(id, direction) {
    // When grouping is on, arrows only nudge within the service's own
    // group. When off, arrows nudge globally across the full list.
    if (useGroups) {
      const svc = services.find(s => s.id === id);
      if (!svc) return;
      const groupKey = (svc.service_group || '').trim() || '__UNGROUPED__';
      const groupSorted = getSortedServices().filter(s => {
        const k = (s.service_group || '').trim() || '__UNGROUPED__';
        return k === groupKey;
      });
      const idxInGroup = groupSorted.findIndex(s => s.id === id);
      if (idxInGroup === -1) return;
      const neighborInGroup = direction === 'up'
        ? groupSorted[idxInGroup - 1]
        : groupSorted[idxInGroup + 1];
      if (!neighborInGroup) return;
      // Swap sort_order with the neighbor in-group. We do this
      // directly rather than via setServicePosition because the
      // latter renumbers the global list which would re-interleave
      // services from other groups.
      const mySort = svc.sort_order ?? 9999;
      const neighborSort = neighborInGroup.sort_order ?? 9999;
      setServices(s => s.map(x => {
        if (x.id === svc.id) return { ...x, sort_order: neighborSort };
        if (x.id === neighborInGroup.id) return { ...x, sort_order: mySort };
        return x;
      }));
      const [r1, r2] = await Promise.all([
        supabase.from('services').update({ sort_order: neighborSort }).eq('id', svc.id),
        supabase.from('services').update({ sort_order: mySort }).eq('id', neighborInGroup.id),
      ]);
      if (r1.error || r2.error) {
        console.error('moveService in-group failed:', r1.error || r2.error);
        const { data } = await supabase.from('services').select('*').eq('therapist_id', therapist.id).is('archived_at', null).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
        if (data) setServices(data);
      }
      return;
    }
    const sorted = getSortedServices();
    const idx = sorted.findIndex(s => s.id === id);
    if (idx === -1) return;
    const newPos1Based = direction === 'up' ? idx : idx + 2;
    await setServicePosition(id, newPos1Based);
  }

  // ─── Group management (HK May 19 2026, opt-in) ───────────────────
  // Groups are derived from distinct values of service.service_group
  // per therapist. Empty / null group means the service has no group
  // and shows under "All other services."
  //
  // Group order is stored on therapists.service_group_order as a JSON
  // array of group names. Groups not in the array sort alphabetically
  // after named ones.

  // Returns an array of group names in display order. Includes the
  // implicit "All other services" pseudo-group only when there is
  // at least one ungrouped service.
  function getGroupedServiceLayout() {
    const sorted = getSortedServices();
    const grouped = {};
    for (const s of sorted) {
      const key = (s.service_group || '').trim() || '__UNGROUPED__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    }
    // Build the ordered list of group names: named groups first in
    // groupOrder sequence, then any new named groups alphabetically,
    // then ungrouped last.
    const namedKeys = Object.keys(grouped).filter(k => k !== '__UNGROUPED__');
    const ordered = [];
    for (const name of groupOrder) {
      if (namedKeys.includes(name)) ordered.push(name);
    }
    const unordered = namedKeys.filter(k => !ordered.includes(k)).sort();
    ordered.push(...unordered);
    if (grouped['__UNGROUPED__']) ordered.push('__UNGROUPED__');
    return ordered.map(name => ({
      name,
      displayName: name === '__UNGROUPED__' ? 'All other services' : name,
      services: grouped[name],
    }));
  }

  // Toggle the opt-in group UI. Writes to therapists.use_service_groups
  // so the setting persists across sessions. The first time groups go
  // ON, auto-assign every unassigned service to a pre-defined group
  // by keyword match. Services we can't classify stay null (they
  // render under 'All other services' as the fallback).
  async function toggleUseGroups() {
    const next = !useGroups;
    setUseGroups(next);
    const { error } = await supabase
      .from('therapists')
      .update({ use_service_groups: next })
      .eq('id', therapist.id);
    if (error) {
      console.error('toggleUseGroups failed:', error);
      setUseGroups(!next);
      return;
    }
    // Only auto-assign on the ON transition. Don't override services
    // the therapist has already placed in a group.
    if (next) {
      const unassigned = services.filter(s => !s.service_group);
      const updates = unassigned
        .map(s => ({ id: s.id, group: classifyService(s.name) }))
        .filter(u => u.group);
      if (updates.length > 0) {
        // Optimistic local update
        setServices(s => s.map(x => {
          const u = updates.find(u => u.id === x.id);
          return u ? { ...x, service_group: u.group } : x;
        }));
        // Persist
        await Promise.all(
          updates.map(u =>
            supabase.from('services').update({ service_group: u.group }).eq('id', u.id)
          )
        );
        // Seed the group order so groups appear in the predefined order
        const groupsInUse = Array.from(new Set([
          ...groupOrder,
          ...updates.map(u => u.group),
        ]));
        const orderedByPredef = [
          ...PREDEFINED_GROUPS.filter(g => groupsInUse.includes(g)),
          ...groupsInUse.filter(g => !PREDEFINED_GROUPS.includes(g)),
        ];
        if (JSON.stringify(orderedByPredef) !== JSON.stringify(groupOrder)) {
          setGroupOrder(orderedByPredef);
          await supabase
            .from('therapists')
            .update({ service_group_order: orderedByPredef })
            .eq('id', therapist.id);
        }
      }
    }
  }

  // Move a service to a specific group (or to ungrouped if null).
  // Used by the 'Move to...' button in each service row when groups
  // are on.
  async function moveServiceToGroup(id, groupName) {
    const next = groupName || null;
    await updateService(id, { service_group: next });
    if (next && !groupOrder.includes(next)) {
      const insertAt = PREDEFINED_GROUPS.includes(next)
        ? Math.max(0, ...groupOrder.map((g, i) => PREDEFINED_GROUPS.indexOf(g) > PREDEFINED_GROUPS.indexOf(next) ? i : -1)) + 1
        : groupOrder.length;
      const nextOrder = [...groupOrder];
      nextOrder.splice(insertAt, 0, next);
      setGroupOrder(nextOrder);
      await supabase
        .from('therapists')
        .update({ service_group_order: nextOrder })
        .eq('id', therapist.id);
    }
  }

  // Add a new custom group. Therapist types a name in the inline
  // prompt at the bottom of the groups list. Empty / duplicate names
  // are ignored. The new group appears at the end and the therapist
  // assigns services to it via 'Move to...'.
  async function addCustomGroup(rawName) {
    const name = (rawName || '').trim();
    if (!name) return;
    if (groupOrder.includes(name) || PREDEFINED_GROUPS.includes(name)) return;
    const nextOrder = [...groupOrder, name];
    setGroupOrder(nextOrder);
    const { error } = await supabase
      .from('therapists')
      .update({ service_group_order: nextOrder })
      .eq('id', therapist.id);
    if (error) {
      console.error('addCustomGroup failed:', error);
      setGroupOrder(groupOrder);
    }
  }

  // Move a group up or down in the displayed group order. Stays out
  // of the ungrouped pseudo-group, which is always last.
  async function moveGroup(groupName, direction) {
    if (groupName === '__UNGROUPED__') return;
    const layout = getGroupedServiceLayout().filter(g => g.name !== '__UNGROUPED__');
    const idx = layout.findIndex(g => g.name === groupName);
    if (idx === -1) return;
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= layout.length) return;
    const nextOrder = layout.map(g => g.name);
    const tmp = nextOrder[idx];
    nextOrder[idx] = nextOrder[neighborIdx];
    nextOrder[neighborIdx] = tmp;
    setGroupOrder(nextOrder);
    const { error } = await supabase
      .from('therapists')
      .update({ service_group_order: nextOrder })
      .eq('id', therapist.id);
    if (error) {
      console.error('moveGroup failed:', error);
    }
  }

  async function setGroupPosition(groupName, newPos1Based) {
    if (groupName === '__UNGROUPED__') return;
    const layout = getGroupedServiceLayout().filter(g => g.name !== '__UNGROUPED__');
    const currentIdx = layout.findIndex(g => g.name === groupName);
    if (currentIdx === -1) return;
    const targetIdx = Math.max(0, Math.min(layout.length - 1, newPos1Based - 1));
    if (targetIdx === currentIdx) return;
    const nextOrder = layout.map(g => g.name);
    const moved = nextOrder.splice(currentIdx, 1)[0];
    nextOrder.splice(targetIdx, 0, moved);
    setGroupOrder(nextOrder);
    const { error } = await supabase
      .from('therapists')
      .update({ service_group_order: nextOrder })
      .eq('id', therapist.id);
    if (error) {
      console.error('setGroupPosition failed:', error);
    }
  }

  // ─── Location management (HK May 18 2026) ───────────────────────
  // V1 scope: add, edit, soft-archive, mark primary. No reorder UI
  // (sort_order set automatically on add). No service-mapping UI here;
  // that lives in the per-service location picker further down in
  // the Services section.

  function locResetDraft() {
    setLocDraft({ name: '', street1: '', street2: '', city: '', state: '', postal_code: '', notes: '' });
    setLocError('');
    setEditingLocId(null);
  }

  function locStartEdit(loc) {
    setEditingLocId(loc.id);
    setLocDraft({
      name: loc.name || '',
      street1: loc.street1 || '',
      street2: loc.street2 || '',
      city: loc.city || '',
      state: loc.state || '',
      postal_code: loc.postal_code || '',
      notes: loc.notes || '',
    });
    setLocError('');
  }

  async function addOrUpdateLocation() {
    const name = (locDraft.name || '').trim();
    if (!name) {
      setLocError('Location needs a name.');
      return;
    }
    setLocSaving(true);
    setLocError('');
    try {
      const payload = {
        name,
        street1: (locDraft.street1 || '').trim() || null,
        street2: (locDraft.street2 || '').trim() || null,
        city: (locDraft.city || '').trim() || null,
        state: (locDraft.state || '').trim() || null,
        postal_code: (locDraft.postal_code || '').trim() || null,
        notes: (locDraft.notes || '').trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editingLocId) {
        const { data, error } = await supabase
          .from('therapist_locations')
          .update(payload)
          .eq('id', editingLocId)
          .select()
          .single();
        if (error) throw error;
        setLocations(ls => ls.map(x => x.id === editingLocId ? data : x));
      } else {
        // New location. First-ever location becomes primary
        // automatically so the per-service UI has a sensible default
        // once a second location is added later.
        const isFirst = locations.length === 0;
        const nextSort = locations.length === 0
          ? 0
          : Math.max(...locations.map(l => l.sort_order || 0)) + 1;
        const { data, error } = await supabase
          .from('therapist_locations')
          .insert({
            therapist_id: therapist.id,
            ...payload,
            is_primary: isFirst,
            sort_order: nextSort,
            active: true,
          })
          .select()
          .single();
        if (error) throw error;
        setLocations(ls => [...ls, data]);
      }
      locResetDraft();
    } catch (e) {
      setLocError(e.message || 'Save failed.');
    } finally {
      setLocSaving(false);
    }
  }

  async function setPrimaryLocation(id) {
    // Atomic-ish: unset all then set the chosen one. Race window is
    // narrow (single-user editing their own row). Partial-index
    // constraint will reject if both end up true momentarily.
    try {
      await supabase
        .from('therapist_locations')
        .update({ is_primary: false })
        .eq('therapist_id', therapist.id);
      const { data, error } = await supabase
        .from('therapist_locations')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setLocations(ls => ls.map(x => ({ ...x, is_primary: x.id === id })));
    } catch (e) {
      setLocError(e.message || 'Could not change primary.');
    }
  }

  async function archiveLocation(id) {
    // Soft delete. Historical bookings keep their FK pointer intact.
    const loc = locations.find(l => l.id === id);
    if (!loc) return;
    if (loc.is_primary && locations.filter(l => l.active).length > 1) {
      setLocError('Choose another primary location before removing this one.');
      return;
    }
    try {
      const { error } = await supabase
        .from('therapist_locations')
        .update({ active: false, archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setLocations(ls => ls.filter(x => x.id !== id));
    } catch (e) {
      setLocError(e.message || 'Could not remove location.');
    }
  }

  // Update which locations a service is offered at. Used by the
  // per-service location checkbox group rendered only when 2+
  // locations exist. NULL or empty array means "all locations"
  // (the default). The backend treats NULL the same as a full list
  // for filtering purposes; the UI mirrors that.
  async function updateServiceLocations(serviceId, locationIds) {
    const prev = services.find(s => s.id === serviceId);
    if (!prev) return;
    // Sentinel: if all locations are checked, store NULL ("all").
    // Easier to reason about than a list that drifts when locations
    // are added/removed.
    const valueToStore = (locationIds && locationIds.length > 0 && locationIds.length < locations.length)
      ? locationIds
      : null;
    setServices(s => s.map(x => x.id === serviceId ? { ...x, location_ids: valueToStore } : x));
    const { error } = await supabase
      .from('services')
      .update({ location_ids: valueToStore })
      .eq('id', serviceId);
    if (error) {
      console.error('updateServiceLocations failed:', error);
      setServices(s => s.map(x => x.id === serviceId ? prev : x));
    }
  }

  async function toggleDay(dow) {
    const existing = availability.find(a => a.day_of_week === dow);
    if (existing) {
      await supabase.from('availability').update({ active: !existing.active }).eq('id', existing.id);
      setAvailability(a => a.map(x => x.id === existing.id ? { ...x, active: !x.active } : x));
    } else {
      const { data } = await supabase.from('availability').insert({ therapist_id: therapist.id, day_of_week: dow, start_time: '09:00', end_time: '17:00', active: true }).select().single();
      setAvailability(a => [...a, data]);
    }
    // Activation: set availability for at least one day
    if (therapist?.id) {
      try {
        const { trackActivation } = await import('../lib/activation');
        trackActivation(therapist.id, 'set_availability');
      } catch {}
    }
  }

  async function updateHours(id, field, val) {
    await supabase.from('availability').update({ [field]: val }).eq('id', id);
    setAvailability(a => a.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  // Time blocks helpers
  function getBlocks(avail) {
    if (avail.time_blocks && avail.time_blocks.length > 0) return avail.time_blocks;
    // Migrate from old start/end format
    return [{ start: avail.start_time?.slice(0,5) || '09:00', end: avail.end_time?.slice(0,5) || '17:00' }];
  }

  async function saveBlocks(id, blocks) {
    const sorted = [...blocks].sort((a,b) => a.start.localeCompare(b.start));
    await supabase.from('availability').update({
      time_blocks: sorted,
      start_time: sorted[0]?.start || '09:00',
      end_time: sorted[sorted.length-1]?.end || '17:00',
    }).eq('id', id);
    setAvailability(a => a.map(x => x.id === id ? { ...x, time_blocks: sorted, start_time: sorted[0]?.start || '09:00', end_time: sorted[sorted.length-1]?.end || '17:00' } : x));
  }

  function addBlock(avail) {
    const blocks = getBlocks(avail);
    const last = blocks[blocks.length - 1];
    // Suggest 1hr after last block ends
    const [h, m] = (last?.end || '17:00').split(':').map(Number);
    const newStart = `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const newEnd = `${String(h+2).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    saveBlocks(avail.id, [...blocks, { start: newStart, end: newEnd }]);
  }

  function removeBlock(avail, idx) {
    const blocks = getBlocks(avail).filter((_, i) => i !== idx);
    if (blocks.length === 0) return; // keep at least one
    saveBlocks(avail.id, blocks);
  }

  function updateBlock(avail, idx, field, val) {
    const blocks = getBlocks(avail).map((b, i) => i === idx ? { ...b, [field]: val } : b);
    saveBlocks(avail.id, blocks);
  }

  if (loading) return null;

  const isCustom = draft.preset === 'Custom...';
  const canAdd = draft.name.trim().length > 0;

  return (
    <div style={{ marginBottom:20 }}>
      {/* Services. Disclosure row pattern (HK May 10 2026).
          Opens by default since this is the daily-edit setting. */}
      <DisclosureRow
        icon="🧾"
        taxonomyId="2.1.1"
        title="Services"
        summary={`${services.filter(s => s.active).length} active${services.length > services.filter(s => s.active).length ? `, ${services.length - services.filter(s => s.active).length} off` : ''}`}
        open={openSubRow === 'services'}
        onToggle={() => setOpenSubRow(openSubRow === 'services' ? null : 'services')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px' }}>Clients choose from these when booking online.</p>

        {/* Opt-in group toggle (HK May 19 2026). Default off keeps the
            menu flat, which is what most therapists want. Therapists
            with sub-categories (Candice's prenatal + postnatal) flip
            it on, give each service a group name, and the menu
            renders grouped sections with their own ordering. */}
        {services.length > 0 && (
          <div style={{
            marginBottom: 14,
            padding: '10px 12px',
            background: useGroups ? '#F0F6EE' : '#FAFAFA',
            border: `1px solid ${useGroups ? '#B7D1AB' : '#EEE9DC'}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C2.darkGray, marginBottom: 2 }}>Organize services into groups</div>
              <div style={{ fontSize: 12, color: C2.gray, lineHeight: 1.4 }}>
                Optional. Use this if you want sections like "Prenatal" or "Couples" with their own service lists.
              </div>
            </div>
            <button
              onClick={toggleUseGroups}
              aria-label={useGroups ? 'Turn off groups' : 'Turn on groups'}
              style={{
                background: useGroups ? '#16A34A' : '#fff',
                color: useGroups ? '#fff' : C2.gray,
                border: `1.5px solid ${useGroups ? '#16A34A' : C2.lightGray}`,
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >{useGroups ? 'On' : 'Off'}</button>
          </div>
        )}

        {/* Collapse all / Expand all (HK May 19 2026). Only renders
            when groups are on and there is more than one group to
            collapse. Single tap closes (or opens) every group at
            once. Useful when the therapist has many groups and
            wants a clean overview. */}
        {useGroups && services.length > 0 && (() => {
          const layout = getGroupedServiceLayout();
          if (layout.length <= 1) return null;
          // All groups currently collapsed?
          const allCollapsed = layout.every(g => collapsedGroups.has(g.name));
          return (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 8,
            }}>
              <button
                onClick={() => {
                  if (allCollapsed) {
                    setCollapsedGroups(new Set());
                  } else {
                    setCollapsedGroups(new Set(layout.map(g => g.name)));
                  }
                }}
                style={{
                  background: '#fff',
                  color: '#1F4131',
                  border: `1.5px solid ${C2.lightGray}`,
                  borderRadius: 18,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                  {allCollapsed
                    ? <path d="M3 9 L7 5 L11 9" stroke="#1F4131" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    : <path d="M3 5 L7 9 L11 5" stroke="#1F4131" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  }
                </svg>
                {allCollapsed ? 'Expand all groups' : 'Collapse all groups'}
              </button>
            </div>
          );
        })()}

        {/* Existing services, rendered in sort_order ascending so
            the displayed order matches what the therapist sees on
            the booking page. Position controls are 1-based and
            contiguous: first row is position 1, last is N.
            When useGroups is on, services render in group sections
            with their own group header (group name + position
            controls). Within each group, services have their own
            1-based contiguous position. */}
        {services.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {(() => {
              // Build the display list. When grouped, interleave
              // group headers between sections. When flat, just the
              // services in sort order.
              const flat = getSortedServices();
              if (!useGroups) {
                return flat.map((svc, idx) => ({
                  kind: 'service',
                  svc,
                  idxInGroup: idx,
                  totalInGroup: flat.length,
                  groupKey: null,
                }));
              }
              const layout = getGroupedServiceLayout();
              const namedGroups = layout.filter(g => g.name !== '__UNGROUPED__');
              const items = [];
              for (let gi = 0; gi < layout.length; gi++) {
                const group = layout[gi];
                const isNamed = group.name !== '__UNGROUPED__';
                items.push({
                  kind: 'group-header',
                  groupName: group.name,
                  groupDisplayName: group.displayName,
                  groupPosition: isNamed ? namedGroups.findIndex(g => g.name === group.name) + 1 : null,
                  groupTotal: namedGroups.length,
                });
                group.services.forEach((svc, idx) => {
                  items.push({
                    kind: 'service',
                    svc,
                    idxInGroup: idx,
                    totalInGroup: group.services.length,
                    groupKey: group.name,
                  });
                });
              }
              return items;
            })().filter(item => {
              // Hide service rows whose group is collapsed. Group
              // headers always render (their chevron is the way to
              // expand back).
              if (item.kind !== 'service') return true;
              const groupKey = item.groupKey || '__UNGROUPED__';
              if (collapsedGroups.has(groupKey)) return false;
              return true;
            }).map((item, i) => {
              if (item.kind === 'group-header') {
                const isUngrouped = item.groupName === '__UNGROUPED__';
                const isCollapsed = collapsedGroups.has(item.groupName);
                const toggleCollapse = () => {
                  setCollapsedGroups(prev => {
                    const next = new Set(prev);
                    if (next.has(item.groupName)) next.delete(item.groupName);
                    else next.add(item.groupName);
                    return next;
                  });
                };
                return (
                  <div
                    key={`group:${item.groupName}`}
                    onClick={toggleCollapse}
                    style={{
                      display:'flex',
                      alignItems:'center',
                      gap:10,
                      padding:'12px 14px',
                      marginTop: i === 0 ? 4 : 16,
                      marginBottom: 2,
                      background: isUngrouped ? '#F5F5F0' : '#F0F6EE',
                      border: `1px solid ${isUngrouped ? '#E5E1D5' : '#B7D1AB'}`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}>
                    {!isUngrouped && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ServicePositionControl
                          position={item.groupPosition}
                          total={item.groupTotal}
                          onSetPosition={(n) => setGroupPosition(item.groupName, n)}
                          onMoveUp={() => moveGroup(item.groupName, 'up')}
                          onMoveDown={() => moveGroup(item.groupName, 'down')}
                          serviceName={item.groupDisplayName}
                          lightGray={C2.lightGray}
                          darkGray={C2.darkGray}
                        />
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: 18,
                        fontWeight: 700,
                        color: isUngrouped ? C2.gray : '#1F4131',
                        letterSpacing: '-0.005em',
                        lineHeight: 1.2,
                      }}>{item.groupDisplayName}</div>
                      <div style={{
                        fontSize: 11,
                        color: isUngrouped ? '#A0A0A0' : '#6B7280',
                        marginTop: 2,
                      }}>
                        {(() => {
                          const groupKey = item.groupName;
                          const count = services.filter(s => {
                            const k = (s.service_group || '').trim() || '__UNGROUPED__';
                            return k === groupKey;
                          }).length;
                          return `${count} service${count === 1 ? '' : 's'}${isCollapsed ? ' · hidden' : ''}`;
                        })()}
                      </div>
                    </div>
                    {/* ChevronPill: matches Billing's collapsible
                        pattern (Memory #17). 32x32 circular,
                        sage-tint when closed, forest when open. */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isCollapsed ? '#F0F6EE' : '#1F4131',
                      flexShrink: 0,
                      transition: 'background 0.2s ease',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" style={{
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                        transition: 'transform 0.2s ease',
                      }}>
                        <path
                          d="M3 5 L7 9 L11 5"
                          stroke={isCollapsed ? '#1F4131' : '#FFFFFF'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                  </div>
                );
              }
              const svc = item.svc;
              const idx = item.idxInGroup;
              const sortedArr = { length: item.totalInGroup };
              return (
              <div key={svc.id} style={{
                padding:'10px 12px',
                background:svc.active?'#F9FAFB':'#FAFAFA',
                borderRadius:10,
                border:`1px solid ${svc.active?C2.lightGray:'#F0F0F0'}`,
                marginLeft: useGroups ? 16 : 0,
                borderLeft: useGroups ? `3px solid ${item.groupKey === '__UNGROUPED__' ? '#E5E1D5' : '#B7D1AB'}` : `1px solid ${svc.active?C2.lightGray:'#F0F0F0'}`,
              }}>
                {/* Service row top: position + name + duration/price.
                    Action pills (On/Off, Public/Private, Remove) live on
                    a second row aligned right. This two-row structure
                    prevents the action pills from overlapping the
                    service name on narrow screens (~360-400px wide).
                    HK May 19 2026 phone overlap fix. */}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {/* Position controls: number input + up/down arrows.
                      Per HK design principle for 70-year-old persona:
                      clear tappable controls + a fast big-jump option.
                      Number is 1-based, applies on Enter or blur.
                      Arrows nudge by one. */}
                  <ServicePositionControl
                    position={idx + 1}
                    total={sortedArr.length}
                    onSetPosition={(n) => setServicePosition(svc.id, n)}
                    onMoveUp={() => moveService(svc.id, 'up')}
                    onMoveDown={() => moveService(svc.id, 'down')}
                    serviceName={svc.name}
                    lightGray={C2.lightGray}
                    darkGray={C2.darkGray}
                  />
                  <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C2.darkGray }}>{svc.name}</span>
                    <span style={{ fontSize:12, color:C2.gray, display:'inline-flex', alignItems:'center', gap:6 }}>
                      <InlineEditField
                        value={svc.duration}
                        type="number"
                        suffix="min"
                        min={5}
                        max={480}
                        step={5}
                        width={48}
                        fontSize={12}
                        color={C2.gray}
                        ariaLabel={`Duration for ${svc.name}`}
                        onSave={(v) => updateService(svc.id, { duration: v })}
                      />
                      <span style={{ color:'#D1D5DB' }}>·</span>
                      <InlineEditField
                        value={svc.price}
                        type="number"
                        prefix="$"
                        min={0}
                        max={9999}
                        step={5}
                        width={56}
                        fontSize={12}
                        color={C2.gray}
                        ariaLabel={`Price for ${svc.name}`}
                        onSave={(v) => updateService(svc.id, { price: v })}
                      />
                    </span>
                  </div>
                </div>
                {/* Service row action pills. Second row, right-aligned.
                    Wrap if even these overflow on the narrowest phones. */}
                <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end', flexWrap:'wrap', marginTop:8 }}>
                  <button onClick={() => toggleService(svc)} style={{ background:svc.active?'#DCFCE7':'#F3F4F6', color:svc.active?'#16A34A':C2.gray, border:'none', borderRadius:20, padding:'3px 10px', fontSize:'11px', fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                    {svc.active ? 'On' : 'Off'}
                  </button>
                  {/* Private/Public toggle. Only meaningful when active=true;
                      hidden when service is off so the row stays clean.
                      Private hides this service from the public booking
                      page but keeps it bookable by the therapist (for
                      gift card legacy services, friends-and-family
                      discount tiers, etc). */}
                  {svc.active && (
                    <button
                      onClick={() => toggleServiceVisibility(svc)}
                      title={svc.visibility === 'private'
                        ? 'Only you can schedule this service. Tap to make public.'
                        : 'Anyone can book this on your public booking page. Tap to make private.'}
                      style={{
                        background: svc.visibility === 'private' ? '#FEF3C7' : '#E0E7FF',
                        color: svc.visibility === 'private' ? '#92400E' : '#3730A3',
                        border: 'none',
                        borderRadius: 20,
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {svc.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
                    </button>
                  )}
                  {pendingDeleteId !== svc.id && (
                    <button
                      onClick={() => setPendingDeleteId(svc.id)}
                      style={{
                        background:'transparent',
                        border:`1px solid ${C2.lightGray}`,
                        color:C2.gray,
                        borderRadius:8,
                        padding:'4px 10px',
                        fontSize:11,
                        fontWeight:600,
                        cursor:'pointer',
                        flexShrink:0,
                        whiteSpace:'nowrap',
                      }}
                      aria-label={`Remove ${svc.name}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Move to group control (HK May 19 2026, opt-in
                    groups). Replaces the previous free-text Group
                    field which was hard to find and required typing.
                    Now: tap 'Move to...' to see all groups in a small
                    inline menu, tap a group name to reassign. Current
                    group is shown as a pill so the therapist sees at
                    a glance which group the service is in. */}
                {useGroups && (
                  <div style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: `1px dashed ${C2.lightGray}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: C2.gray,
                      flexShrink: 0,
                    }}>In group</span>
                    <span style={{
                      background: svc.service_group ? '#F0F6EE' : '#F3F4F6',
                      color: svc.service_group ? '#1F4131' : C2.gray,
                      border: `1px solid ${svc.service_group ? '#B7D1AB' : C2.lightGray}`,
                      borderRadius: 16,
                      padding: '3px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>{svc.service_group || 'None'}</span>
                    <button
                      onClick={() => setMoveMenuFor(moveMenuFor === svc.id ? null : svc.id)}
                      style={{
                        marginLeft: 'auto',
                        background: moveMenuFor === svc.id ? '#F0F6EE' : '#fff',
                        color: '#1F4131',
                        border: `1.5px solid ${moveMenuFor === svc.id ? '#B7D1AB' : C2.lightGray}`,
                        borderRadius: 8,
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >Move to...</button>
                    {moveMenuFor === svc.id && (
                      <div style={{
                        flexBasis: '100%',
                        background: '#fff',
                        border: `1px solid ${C2.lightGray}`,
                        borderRadius: 10,
                        padding: 6,
                        marginTop: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        boxShadow: '0 4px 12px rgba(31, 65, 49, 0.08)',
                      }}>
                        {/* All groups currently in use, in display order */}
                        {(() => {
                          const allGroups = Array.from(new Set([
                            ...PREDEFINED_GROUPS,
                            ...groupOrder,
                          ]));
                          return allGroups.map(g => (
                            <button
                              key={g}
                              onClick={() => {
                                moveServiceToGroup(svc.id, g);
                                setMoveMenuFor(null);
                              }}
                              style={{
                                textAlign: 'left',
                                background: svc.service_group === g ? '#F0F6EE' : 'transparent',
                                color: svc.service_group === g ? '#1F4131' : C2.darkGray,
                                border: 'none',
                                borderRadius: 6,
                                padding: '8px 12px',
                                fontSize: 13,
                                fontWeight: svc.service_group === g ? 700 : 500,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              {svc.service_group === g && '✓ '}{g}
                            </button>
                          ));
                        })()}
                        {/* 'All other services' option (clears the group) */}
                        <button
                          onClick={() => {
                            moveServiceToGroup(svc.id, null);
                            setMoveMenuFor(null);
                          }}
                          style={{
                            textAlign: 'left',
                            background: !svc.service_group ? '#F0F6EE' : 'transparent',
                            color: !svc.service_group ? '#1F4131' : C2.gray,
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontSize: 13,
                            fontWeight: !svc.service_group ? 700 : 500,
                            cursor: 'pointer',
                            fontStyle: 'italic',
                            fontFamily: 'inherit',
                          }}
                        >
                          {!svc.service_group && '✓ '}All other services
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline confirm bar. Replaces the row's normal
                    bottom area when the therapist has tapped Remove
                    but not yet confirmed. Soft amber, plain English,
                    two clear buttons. Cancel is the larger of the
                    two so an accidental tap defaults to keeping the
                    service. */}
                {pendingDeleteId === svc.id && (
                  <div style={{
                    marginTop:10,
                    background:'#FFF8E7',
                    border:'1px solid #F3D88E',
                    borderRadius:10,
                    padding:'10px 12px',
                    display:'flex',
                    alignItems:'center',
                    gap:10,
                    flexWrap:'wrap',
                  }}>
                    <div style={{ flex:1, minWidth:0, fontSize:12.5, color:'#78350F', lineHeight:1.5 }}>
                      Remove <strong>{svc.name}</strong>? Clients will not be able to book it any more. You can always add it back later.
                    </div>
                    <button
                      onClick={() => setPendingDeleteId(null)}
                      style={{
                        background:'#fff',
                        border:`1.5px solid ${C2.lightGray}`,
                        color:C2.darkGray,
                        borderRadius:8,
                        padding:'7px 14px',
                        fontSize:12.5,
                        fontWeight:700,
                        cursor:'pointer',
                        whiteSpace:'nowrap',
                      }}
                    >
                      Keep it
                    </button>
                    <button
                      onClick={() => {
                        deleteService(svc.id);
                        setPendingDeleteId(null);
                      }}
                      style={{
                        background:'#DC2626',
                        color:'#fff',
                        border:'none',
                        borderRadius:8,
                        padding:'7px 14px',
                        fontSize:12.5,
                        fontWeight:700,
                        cursor:'pointer',
                        whiteSpace:'nowrap',
                      }}
                    >
                      Yes, remove
                    </button>
                  </div>
                )}
                <div style={{ marginTop:6 }}>
                  <InlineEditDescription
                    value={svc.description}
                    placeholder="Add a description so clients know what it is (optional)"
                    onSave={(v) => updateService(svc.id, { description: v })}
                    ariaLabel={`Description for ${svc.name}`}
                  />
                </div>
                {/* Phase tags + Days combined into a single tight block.
                    Phase pills use 3-letter abbreviations (Men/Fol/Ovu/Lut)
                    so all 4 fit on one mobile line. Days pills are compact
                    26px wide single-letter circles. Both rows aligned with
                    a fixed-width label so the visual grid is clean. */}
                <div style={{ marginTop:8, paddingTop:8, borderTop:`1px dashed ${C2.lightGray}`, display:'flex', flexDirection:'column', gap:6 }}>
                  {therapist?.cycle_scheduling_enabled && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
                      <span style={{ fontSize:10, color:C2.gray, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', width:46, flexShrink:0 }}>Phase</span>
                      <div style={{ display:'flex', gap:4, flex:1, overflowX:'auto', scrollbarWidth:'none' }}>
                        {[
                          { key:'menstrual',  label:'Men', full:'Menstrual',  color:'#C99488' },
                          { key:'follicular', label:'Fol', full:'Follicular', color:'#D4A578' },
                          { key:'ovulatory',  label:'Ovu', full:'Ovulatory',  color:'#9DAA85' },
                          { key:'luteal',     label:'Lut', full:'Luteal',     color:'#A87468' },
                        ].map(ph => {
                          const phases = svc.phases || [];
                          const allOff = phases.length === 0;
                          const isOn = allOff || phases.includes(ph.key);
                          const togglePhase = () => {
                            let next;
                            if (allOff) {
                              next = ['menstrual','follicular','ovulatory','luteal'].filter(p => p !== ph.key);
                            } else if (isOn) {
                              next = phases.filter(p => p !== ph.key);
                              if (next.length === 0) next = null;
                            } else {
                              next = [...phases, ph.key];
                              if (next.length === 4) next = null;
                            }
                            updateService(svc.id, { phases: next });
                          };
                          return (
                            <button key={ph.key} onClick={togglePhase} title={ph.full} style={{
                              background: isOn ? ph.color : 'transparent',
                              color: isOn ? '#fff' : C2.gray,
                              border: `1.5px solid ${isOn ? ph.color : C2.lightGray}`,
                              borderRadius: 999,
                              padding: '3px 9px',
                              fontSize: 10.5, fontWeight: 700, letterSpacing:'0.3px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              flexShrink: 0,
                              minWidth: 40,
                            }}>
                              {ph.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
                    <span style={{ fontSize:10, color:C2.gray, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', width:46, flexShrink:0 }}>Days</span>
                    <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                      {[
                        { dow:1, label:'M' }, { dow:2, label:'T' }, { dow:3, label:'W' },
                        { dow:4, label:'T' }, { dow:5, label:'F' }, { dow:6, label:'S' }, { dow:0, label:'S' },
                      ].map(({ dow, label }) => {
                        const svcRows = (availability || []).filter(a => a.service_id === svc.id);
                        const hasOverride = svcRows.length > 0;
                        const isOn = !hasOverride || svcRows.some(r => r.day_of_week === dow);
                        const togglePill = async () => {
                          if (!hasOverride) {
                            const masterRows = (availability || []).filter(a => !a.service_id && a.active);
                            const toCopy = masterRows.filter(r => r.day_of_week !== dow);
                            if (toCopy.length === 0) return;
                            const inserts = toCopy.map(r => ({
                              therapist_id: therapist.id,
                              service_id: svc.id,
                              day_of_week: r.day_of_week,
                              start_time: r.start_time,
                              end_time: r.end_time,
                              time_blocks: r.time_blocks,
                              active: true,
                            }));
                            const { data } = await supabase.from('availability').insert(inserts).select();
                            if (data) setAvailability(a => [...a, ...data]);
                          } else if (isOn) {
                            const row = svcRows.find(r => r.day_of_week === dow);
                            if (row) {
                              await supabase.from('availability').delete().eq('id', row.id);
                              setAvailability(a => a.filter(x => x.id !== row.id));
                            }
                          } else {
                            const masterRow = (availability || []).find(a => !a.service_id && a.day_of_week === dow && a.active);
                            const insertRow = {
                              therapist_id: therapist.id,
                              service_id: svc.id,
                              day_of_week: dow,
                              start_time: masterRow?.start_time || '09:00',
                              end_time: masterRow?.end_time || '17:00',
                              time_blocks: masterRow?.time_blocks || null,
                              active: true,
                            };
                            const { data } = await supabase.from('availability').insert(insertRow).select().single();
                            if (data) setAvailability(a => [...a, data]);
                          }
                        };
                        return (
                          <button key={dow} onClick={togglePill} type="button"
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              fontSize: 10.5,
                              background: isOn ? C2.forest : '#F0EDE6',
                              color: isOn ? '#fff' : '#9A9486',
                              border:'none', cursor:'pointer', fontFamily:'system-ui',
                              fontWeight: isOn ? 700 : 500,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              padding: 0, flexShrink: 0,
                            }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const svcRows = (availability || []).filter(a => a.service_id === svc.id);
                      if (svcRows.length === 0) return (
                        <span style={{ fontSize:10, color:'#9A9486', fontStyle:'italic', marginLeft:'auto' }}>
                          all days
                        </span>
                      );
                      const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                      const sorted = [...svcRows].sort((a, b) => a.day_of_week - b.day_of_week);
                      if (sorted.length === 1) return (
                        <span style={{ fontSize:10, color:C2.forest, fontStyle:'italic', marginLeft:'auto' }}>
                          {dayLabels[sorted[0].day_of_week]} only
                        </span>
                      );
                      if (sorted.length === 2) return (
                        <span style={{ fontSize:10, color:C2.forest, fontStyle:'italic', marginLeft:'auto' }}>
                          {dayLabels[sorted[0].day_of_week]}, {dayLabels[sorted[1].day_of_week]} only
                        </span>
                      );
                      return (
                        <span style={{ fontSize:10, color:C2.forest, fontStyle:'italic', marginLeft:'auto' }}>
                          {sorted.length}d
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Per-service location picker. Only shows when therapist
                    has 2+ active locations (V1: feature gates itself off
                    for the common single-location case). NULL/empty
                    location_ids = "offered at all locations" (default).
                    Therapist picks subset; updateServiceLocations stores
                    NULL if all are checked. */}
                {locations.length >= 2 && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:`1px dashed ${C2.lightGray}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C2.gray, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                      Offered at
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {locations.map(loc => {
                        // Treat NULL/empty location_ids as "all locations
                        // checked" so the default behaves predictably.
                        const currentIds = (svc.location_ids && svc.location_ids.length > 0)
                          ? svc.location_ids
                          : locations.map(l => l.id);
                        const isChecked = currentIds.includes(loc.id);
                        return (
                          <button
                            key={loc.id}
                            onClick={() => {
                              const next = isChecked
                                ? currentIds.filter(id => id !== loc.id)
                                : [...currentIds, loc.id];
                              // Don't allow zero-locations on a service:
                              // a service offered nowhere is unbookable.
                              // The button is disabled visually below
                              // when this would be the result.
                              if (next.length === 0) return;
                              updateServiceLocations(svc.id, next);
                            }}
                            disabled={isChecked && currentIds.length === 1}
                            style={{
                              display:'inline-flex',
                              alignItems:'center',
                              gap:6,
                              background: isChecked ? '#F0F6EE' : '#fff',
                              border:`1.5px solid ${isChecked ? C2.forest : C2.lightGray}`,
                              borderRadius:8,
                              padding:'5px 10px',
                              fontSize:12,
                              fontWeight:600,
                              color: isChecked ? C2.forest : C2.gray,
                              cursor: isChecked && currentIds.length === 1 ? 'not-allowed' : 'pointer',
                              opacity: isChecked && currentIds.length === 1 ? 0.7 : 1,
                            }}
                            aria-pressed={isChecked}
                          >
                            <span style={{ fontSize:11 }}>{isChecked ? '✓' : ''}</span>
                            <span>{loc.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* + New group (HK May 19 2026, opt-in groups). Only renders
            when the therapist has groups on. Lets her add a custom
            group name beyond the 6 pre-defined ones, then assign
            services to it via 'Move to...' in each row. */}
        {useGroups && services.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {newGroupDraft === null ? (
              <button
                onClick={() => setNewGroupDraft('')}
                style={{
                  background: '#fff',
                  color: '#1F4131',
                  border: `1.5px dashed ${C2.lightGray}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >+ Add a new group</button>
            ) : (
              <div style={{
                display: 'flex',
                gap: 8,
                background: '#F0F6EE',
                border: `1px solid #B7D1AB`,
                borderRadius: 10,
                padding: 10,
              }}>
                <input
                  autoFocus
                  type="text"
                  value={newGroupDraft}
                  onChange={(e) => setNewGroupDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = newGroupDraft.trim();
                      if (name) addCustomGroup(name);
                      setNewGroupDraft(null);
                    } else if (e.key === 'Escape') {
                      setNewGroupDraft(null);
                    }
                  }}
                  placeholder="New group name"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    color: C2.darkGray,
                    background: '#fff',
                    border: `1px solid ${C2.lightGray}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={() => {
                    const name = newGroupDraft.trim();
                    if (name) addCustomGroup(name);
                    setNewGroupDraft(null);
                  }}
                  style={{
                    background: '#16A34A',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >Add</button>
                <button
                  onClick={() => setNewGroupDraft(null)}
                  style={{
                    background: 'transparent',
                    color: C2.gray,
                    border: `1px solid ${C2.lightGray}`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Add service - always visible inline */}
        <div style={{ background:'#F9FAFB', borderRadius:10, padding:14, border:`1.5px dashed ${C2.lightGray}` }}>
          <p style={{ fontSize:'11px', fontWeight:700, color:C2.gray, margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'0.06em' }}>+ Add a service</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
            <select value={draft.preset} onChange={e => handlePreset(e.target.value)}
              style={{ flex:'1 1 180px', padding:'10px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, fontSize:16, fontFamily:'system-ui', background:'#fff', color: draft.preset ? C2.darkGray : C2.gray, outline:'none', cursor:'pointer' }}>
              <option value="" disabled>Select a service type</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'0 10px', height:42, flexShrink:0 }}>
              <input type="number" value={draft.duration} onChange={e => setDraft(d => ({...d, duration:parseInt(e.target.value)||60}))} min="15" max="240"
                style={{ width:38, border:'none', fontSize:16, fontWeight:700, color:C2.forest, background:'transparent', outline:'none', textAlign:'center' }} />
              <span style={{ fontSize:12, color:C2.gray }}>min</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', background:'#fff', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'0 10px', height:42, flexShrink:0 }}>
              <span style={{ fontSize:13, color:C2.gray, marginRight:2 }}>$</span>
              <input type="number" value={draft.price} onChange={e => setDraft(d => ({...d, price:parseInt(e.target.value)||0}))} min="0"
                style={{ width:52, border:'none', fontSize:16, fontWeight:700, color:C2.forest, background:'transparent', outline:'none', textAlign:'center' }} />
            </div>
          </div>
          {isCustom && (
            <input value={draft.name} onChange={e => setDraft(d => ({...d, name:e.target.value}))} placeholder="Enter service name"
              style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, fontSize:13, fontFamily:'system-ui', boxSizing:'border-box', marginTop:8, outline:'none' }} />
          )}
          {draft.preset && (
            <button onClick={addService} disabled={!canAdd || saving === 'add'}
              style={{ marginTop:10, background:canAdd?C2.forest:'#D1D5DB', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:canAdd?'pointer':'default', transition:'background 0.15s' }}>
              {saving === 'add' ? 'Saving...' : `Add ${draft.name || 'Service'}`}
            </button>
          )}
        </div>
      </DisclosureRow>


      {/* Locations. Disclosure row pattern. HK May 18 2026.
          Driven by Jackie's inbound asking for multi-location support.
          Sits between Services and Deposit since locations are tightly
          tied to services (per-service location picker appears in
          Services when 2+ locations exist). */}
      <DisclosureRow
        icon="📍"
        taxonomyId="2.1.2"
        title="Locations"
        summary={
          locations.length === 0
            ? 'Add the place you practice from'
            : locations.length === 1
              ? `1 location: ${locations[0].name}`
              : `${locations.length} locations`
        }
        open={openSubRow === 'locations'}
        onToggle={() => { setOpenSubRow(openSubRow === 'locations' ? null : 'locations'); locResetDraft(); }}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px', lineHeight:1.5 }}>
          Where you see clients. Add a second location if you practice in more than one place, and clients will pick which one when booking.
        </p>

        {/* Existing locations list */}
        {locations.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            {locations.map(loc => {
              const fullAddr = [loc.street1, loc.street2, loc.city, loc.state, loc.postal_code]
                .filter(Boolean).join(', ');
              const isEditing = editingLocId === loc.id;
              if (isEditing) {
                return (
                  <LocationEditCard
                    key={loc.id}
                    draft={locDraft}
                    setDraft={setLocDraft}
                    onSave={addOrUpdateLocation}
                    onCancel={locResetDraft}
                    saving={locSaving}
                    error={locError}
                    isEdit
                    C2={C2}
                  />
                );
              }
              return (
                <div key={loc.id} style={{ padding:'12px 14px', background:'#F9FAFB', borderRadius:10, border:`1px solid ${C2.lightGray}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:14, fontWeight:700, color:C2.darkGray }}>{loc.name}</span>
                        {loc.is_primary && (
                          <span style={{ fontSize:10, fontWeight:700, color:C2.forest, background:'#F0F6EE', border:'1px solid #B7D1AB', borderRadius:999, padding:'2px 7px', letterSpacing:'0.04em', textTransform:'uppercase' }}>Primary</span>
                        )}
                      </div>
                      {fullAddr && (
                        <div style={{ fontSize:12, color:C2.gray, marginTop:3 }}>{fullAddr}</div>
                      )}
                      {loc.notes && (
                        <div style={{ fontSize:11, color:C2.gray, marginTop:3, fontStyle:'italic' }}>{loc.notes}</div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {!loc.is_primary && (
                        <button onClick={() => setPrimaryLocation(loc.id)} style={{ background:'transparent', border:`1px solid ${C2.lightGray}`, padding:'5px 11px', borderRadius:6, fontSize:11, fontWeight:600, color:C2.forest, cursor:'pointer' }}>
                          Make primary
                        </button>
                      )}
                      <button onClick={() => locStartEdit(loc)} style={{ background:'transparent', border:`1px solid ${C2.lightGray}`, padding:'5px 11px', borderRadius:6, fontSize:11, fontWeight:600, color:C2.darkGray, cursor:'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => archiveLocation(loc.id)} style={{ background:'transparent', border:`1px solid ${C2.lightGray}`, padding:'5px 11px', borderRadius:6, fontSize:11, fontWeight:600, color:'#9F6B6B', cursor:'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new location form. Only shows when not editing an existing one. */}
        {!editingLocId && (
          <LocationEditCard
            draft={locDraft}
            setDraft={setLocDraft}
            onSave={addOrUpdateLocation}
            onCancel={locResetDraft}
            saving={locSaving}
            error={locError}
            isEdit={false}
            C2={C2}
          />
        )}
      </DisclosureRow>


      {/* Deposit Settings. Disclosure row pattern. */}
      <DisclosureRow
        icon="💳"
        taxonomyId="2.1.3"
        title="New client deposit"
        summary={depositEnabled ? `On · ${depositPercent}% required from new clients` : 'Off · clients pay at session'}
        open={openSubRow === 'deposit'}
        onToggle={() => setOpenSubRow(openSubRow === 'deposit' ? null : 'deposit')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 8px' }}>Require first-time clients to pay a deposit when booking. Repeat clients are never charged.</p>
        {/* Phase 25b (May 25 2026): when both approval AND deposit are on,
            MyBodyMap captures the client's card at booking time via
            SetupIntent, then charges the deposit automatically the moment
            the therapist approves. No manual step. Surface this so the
            therapist understands the combined behavior. */}
        {depositEnabled && therapist?.require_approval && (
          <p style={{ fontSize:'12px', color:'#1F2937', background:'#F0F7F4', border:'1px solid #BFD8C9', borderRadius:8, padding:'10px 12px', margin:'0 0 14px', lineHeight:1.55 }}>
            🌿 You also have <strong>Approve new clients</strong> on. MyBodyMap captures the client's card when they submit a request. The moment you approve, the deposit is charged automatically. If you decline, no charge is made.
          </p>
        )}
        <p style={{ fontSize:'11px', color:C2.gray, background:C2.beige, borderRadius:8, padding:'8px 10px', margin:'0 0 14px', lineHeight:1.5 }}>
          💡 Prefer Square or cash? Keep deposits off, clients pay you directly at the session. MyBodyMap handles scheduling, intake, and reminders regardless.
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button onClick={async () => {
            const newVal = !depositEnabled;
            setDepositEnabled(newVal); // optimistic
            setDepositSaving(true);
            const result = await updateProfile({ deposit_enabled: newVal });
            setDepositSaving(false);
            if (!result.success) setDepositEnabled(!newVal); // revert if failed
          }} style={{ width:40, height:22, borderRadius:11, background:depositEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s', opacity:depositSaving?0.6:1 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:depositEnabled?21:3, transition:'left 0.2s' }}/>
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:C2.darkGray }}>
            {depositSaving ? 'Saving…' : depositEnabled ? 'Deposit enabled' : 'Deposit disabled'}
          </span>
        </div>
        {depositEnabled && (
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', background:'#F9FAFB', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, padding:'8px 14px', gap:6 }}>
              <input type="number" min="5" max="100"
                defaultValue={depositPercent}
                onBlur={async e => {
                  const v = Math.min(100, Math.max(5, parseInt(e.target.value)||20));
                  setDepositPercent(v);
                  e.target.value = v;
                  await updateProfile({ deposit_percent: v });
                }}
                style={{ width:50, border:'none', background:'transparent', fontSize:16, fontWeight:700, color:C2.forest, outline:'none', textAlign:'center' }}
              />
              <span style={{ fontSize:14, color:C2.gray }}>%</span>
            </div>
            <div style={{ fontSize:12, color:C2.gray, lineHeight:1.5 }}>
              Recommended: 20-50%. For a $85 session, 20% = $17 deposit.
            </div>
          </div>
        )}
      </DisclosureRow>

      {/* Buffer Time Between Sessions. Disclosure row pattern. */}
      <DisclosureRow
        icon="⏱️"
        taxonomyId="2.1.4"
        title="Buffer between sessions"
        summary={bufferEnabled ? `${bufferMinutes} min after each session` : 'Off'}
        open={openSubRow === 'buffer'}
        onToggle={() => setOpenSubRow(openSubRow === 'buffer' ? null : 'buffer')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 12px', lineHeight:1.5 }}>
          Add time after each session for room turnover, notes, or a break. Clients won't see available slots during this window.
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: bufferEnabled ? 12 : 0 }}>
          <button onClick={async () => {
            const newVal = !bufferEnabled;
            setBufferEnabled(newVal);
            await supabase.from('therapists').update({ buffer_enabled: newVal }).eq('id', therapist.id);
          }} style={{ width:40, height:22, borderRadius:11, background:bufferEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:bufferEnabled?21:3, transition:'left 0.2s' }} />
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:C2.darkGray }}>
            {bufferEnabled ? `Buffer ON, ${bufferMinutes} min after each session` : 'Buffer OFF'}
          </span>
        </div>
        {bufferEnabled && (
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, color:C2.gray }}>Block</span>
            <InlineSaveNumberInput
              value={bufferMinutes}
              defaultValue={15}
              onChange={setBufferMinutes}
              onSave={async v => {
                await supabase.from('therapists').update({ buffer_minutes: v }).eq('id', therapist.id);
              }}
              suffix="min"
              min={5}
              max={120}
              placeholder="15"
              width={70}
            />
            <span style={{ fontSize:13, color:C2.gray }}>after each session</span>
          </div>
        )}
      </DisclosureRow>

      {/* Booking window: lead time + max advance.
          Disclosure row pattern (HK May 10 2026). */}
      <DisclosureRow
        icon="📆"
        taxonomyId="2.1.5"
        title="Booking window"
        summary={
          (minLeadHours > 0 || maxAdvanceDays > 0)
            ? `${minLeadHours > 0 ? `${minLeadHours}h ahead` : 'No minimum'}${maxAdvanceDays > 0 ? `, up to ${maxAdvanceDays} days out` : ''}`
            : 'Anytime, no limits'
        }
        open={openSubRow === 'booking-window'}
        onToggle={() => setOpenSubRow(openSubRow === 'booking-window' ? null : 'booking-window')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px', lineHeight:1.5 }}>
          Control how soon and how far ahead clients can book. Helps protect prep time and keep the calendar tidy.
        </p>

        {/* Minimum advance notice
            Default placeholder 24 (industry-standard for spa/massage,
            matches Acuity and Vagaro defaults). 0 means "no minimum,
            client can book the next slot." Range 0 to 8760 (1 year). */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:C2.darkGray, marginBottom:6 }}>
            Minimum advance notice
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <InlineSaveNumberInput
              value={minLeadHours}
              defaultValue={24}
              placeholder="24"
              onChange={setMinLeadHours}
              onSave={async (v) => {
                await supabase.from('therapists').update({ minimum_advance_hours: v }).eq('id', therapist.id);
              }}
              suffix="hours"
              min={0}
              max={8760}
              width={70}
            />
            <span style={{ fontSize:12, color:C2.gray }}>before a client can book</span>
          </div>
          <div style={{ fontSize:11, color:C2.gray, marginTop:6, lineHeight:1.5 }}>
            Common: 24 hours so you have prep time. Set 0 for no minimum (clients can book the next available slot).
          </div>
        </div>

        {/* Maximum advance window
            Default placeholder 90 (matches Acuity default; 60-90 days
            is the spa industry norm). 0 means "no maximum, clients
            can book any future date." Range 0 to 730 (2 years). */}
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:C2.darkGray, marginBottom:6 }}>
            Maximum advance window
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <InlineSaveNumberInput
              value={maxAdvanceDays}
              defaultValue={90}
              placeholder="90"
              onChange={setMaxAdvanceDays}
              onSave={async (v) => {
                await supabase.from('therapists').update({ maximum_advance_days: v }).eq('id', therapist.id);
              }}
              suffix="days"
              min={0}
              max={730}
              width={70}
            />
            <span style={{ fontSize:12, color:C2.gray }}>ahead a client can book</span>
          </div>
          <div style={{ fontSize:11, color:C2.gray, marginTop:6, lineHeight:1.5 }}>
            Common: 60-90 days. Set 0 for no limit.
          </div>
        </div>
      </DisclosureRow>

      {/* Daily hands-on hours cap (HK May 27 2026, Jacquie's ask).
          MassageBook has this; we did not. Limits how many minutes
          of session time the booking page will offer per day. The
          therapist can still book past the cap from her own
          dashboard; this only restricts the public booking page.
          Default 0 = no cap, behaves exactly as before. Promoted to
          its own disclosure 2.1.6 May 27 2026 after HK noted that
          2.1 had become too crowded and lacked numbering. */}
      <DisclosureRow
        icon="💪"
        taxonomyId="2.1.6"
        title="Daily hands-on cap"
        summary={
          maxHandsOnMinutes > 0
            ? `Up to ${maxHandsOnMinutes} minutes (${(maxHandsOnMinutes / 60).toFixed(1)}h) bookable per day`
            : 'No cap, full working day available'
        }
        open={openSubRow === 'hands-on-cap'}
        onToggle={() => setOpenSubRow(openSubRow === 'hands-on-cap' ? null : 'hands-on-cap')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px', lineHeight:1.5 }}>
          Limit how many minutes of bookable session time the booking page offers per day. Once today's bookings hit this many minutes, your booking page shows 'Fully booked today'. You can still book past the cap from your own dashboard.
        </p>
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:C2.darkGray, marginBottom:6 }}>
            Cap in minutes
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <InlineSaveNumberInput
              value={maxHandsOnMinutes}
              defaultValue={330}
              placeholder="330"
              onChange={setMaxHandsOnMinutes}
              onSave={async (v) => {
                await supabase.from('therapists').update({ max_hands_on_minutes_per_day: v || null }).eq('id', therapist.id);
              }}
              suffix="minutes"
              min={0}
              max={1440}
              width={80}
            />
            <span style={{ fontSize:12, color:C2.gray }}>per day</span>
          </div>
          <div style={{ fontSize:11, color:C2.gray, marginTop:6, lineHeight:1.5 }}>
            Common: 330 (5.5 hours) or 360 (6 hours). Set 0 for no cap.
          </div>
        </div>
      </DisclosureRow>

      {/* Efficient Scheduling (Lindsey #7, May 10 2026).
          Three-way segmented control: Off / Soft / Hard.
          Disclosure row pattern (HK May 10 2026). */}
      <DisclosureRow
        icon="📐"
        taxonomyId="2.1.7"
        title="Smart scheduling"
        summary={
          schedulingMode === 'normal'
            ? 'Off · all slots offered'
            : efficientStrictness === 'soft'
              ? 'Soft · adjacent slots highlighted'
              : 'Hard · only adjacent slots offered'
        }
        open={openSubRow === 'smart-scheduling'}
        onToggle={() => setOpenSubRow(openSubRow === 'smart-scheduling' ? null : 'smart-scheduling')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px', lineHeight:1.5 }}>
          When you have appointments on a day, this clusters new bookings around them. Less starting and stopping. Longer breaks instead of awkward gaps.
        </p>

        {/* 3-way segmented control: Off / Soft / Hard.
            Off = scheduling_mode 'normal'.
            Soft = scheduling_mode 'efficient' + efficient_strictness 'soft'.
            Hard = scheduling_mode 'efficient' + efficient_strictness 'hard'.
            DB columns unchanged; UI just collapses the two into one
            three-way control per HK design direction May 10 2026. */}
        {(() => {
          const current = schedulingMode === 'normal' ? 'off'
            : efficientStrictness === 'hard' ? 'hard' : 'soft';
          const setMode = async (mode) => {
            if (mode === 'off') {
              setSchedulingMode('normal');
              await supabase.from('therapists').update({ scheduling_mode: 'normal' }).eq('id', therapist.id);
            } else {
              setSchedulingMode('efficient');
              setEfficientStrictness(mode);
              await supabase.from('therapists').update({ scheduling_mode: 'efficient', efficient_strictness: mode }).eq('id', therapist.id);
            }
          };
          const buttonStyle = (active) => ({
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            background: active ? C2.white : 'transparent',
            color: active ? C2.forest : C2.gray,
            fontSize: 13,
            fontWeight: active ? 700 : 500,
            cursor: 'pointer',
            fontFamily: 'system-ui',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s',
          });
          return (
            <>
              <div style={{ display:'flex', gap:0, background:'#F7F3EB', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, padding:3, marginBottom:10 }}>
                <button onClick={() => setMode('off')}  style={buttonStyle(current === 'off')}>Off</button>
                <button onClick={() => setMode('soft')} style={buttonStyle(current === 'soft')}>Soft</button>
                <button onClick={() => setMode('hard')} style={buttonStyle(current === 'hard')}>Hard</button>
              </div>
              <div style={{ fontSize:11, color:C2.gray, lineHeight:1.6 }}>
                {current === 'off'
                  ? 'Clients see every available slot in your working hours. Full flexibility, gaps possible.'
                  : current === 'soft'
                    ? 'All slots stay visible. Adjacent ones rank higher so clients gravitate to them. Friendly for clients with limited flexibility.'
                    : 'Only slots that touch an existing appointment edge are offered. Strongest packing. Some clients may not find a time on busy days.'}
              </div>
            </>
          );
        })()}
      </DisclosureRow>

      {/* Tips + pay-in-full at booking (Lindsey #2, May 10 2026).
          Disclosure row pattern (HK May 10 2026). */}
      {/* Tips + pay-in-full at booking (Lindsey #2, May 10 2026).
          Two related controls in one card:
            1. Accept tips (default on). Disabling hides tip
               selectors entirely from booking and post-session
               charge flows.
            2. Allow pay-in-full at booking (default off). When
               on, clients see a "Pay full now" option alongside
               deposit-only and pay-later. Useful for therapists
               who prefer prepayment to deposits.
            3. Three percentage presets shown as chips on the
               booking page tip selector. Therapist can edit
               each independently. */}
      <DisclosureRow
        icon="💝"
        taxonomyId="2.1.8"
        title="Tips and pay-in-full"
        summary={`Tips ${acceptTips ? 'on' : 'off'}${acceptTips ? ` · ${tipPreset1}/${tipPreset2}/${tipPreset3}%` : ''} · Full payment ${payInFullEnabled ? 'on' : 'off'}`}
        open={openSubRow === 'tips'}
        onToggle={() => setOpenSubRow(openSubRow === 'tips' ? null : 'tips')}
      >
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px', lineHeight:1.5 }}>
          Choose whether clients can leave tips and pay the full session amount upfront.
        </p>

        {/* Toggle: Accept tips */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 0', marginBottom: acceptTips ? 4 : 12,
        }}>
          <div style={{ flex:1, paddingRight:12 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C2.darkGray, marginBottom:2 }}>
              Accept tips
            </div>
            <div style={{ fontSize:12, color:C2.gray, lineHeight:1.5 }}>
              Show tip options at booking and after sessions. Turn off if you prefer not to invite tips.
            </div>
          </div>
          <button
            onClick={async () => {
              const next = !acceptTips;
              setAcceptTips(next);
              await supabase.from('therapists').update({ accept_tips: next }).eq('id', therapist.id);
            }}
            style={{
              width:46, height:26, borderRadius:13, border:'none',
              background: acceptTips ? C2.forest : '#D1CFC7',
              position:'relative', cursor:'pointer', flexShrink:0,
              transition:'background 0.2s',
            }}
            aria-label={acceptTips ? 'Disable tips' : 'Enable tips'}>
            <div style={{
              position:'absolute', top:3, left: acceptTips ? 23 : 3,
              width:20, height:20, borderRadius:'50%', background:'#fff',
              transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>

        {/* Tip preset percentages (only when accepting tips).
            Three inline number inputs using InlineSaveNumberInput,
            no dropdowns per HK design principle. */}
        {acceptTips && (
          <div style={{ paddingBottom:12, marginBottom:12, borderBottom:`1px dashed ${C2.lightGray}` }}>
            <div style={{ fontSize:12, color:C2.gray, marginBottom:8, lineHeight:1.5 }}>
              Three percentage chips clients can tap. They can also enter a custom amount or skip.
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <InlineSaveNumberInput
                value={tipPreset1}
                defaultValue={15}
                placeholder="15"
                onChange={setTipPreset1}
                onSave={async (v) => {
                  await supabase.from('therapists').update({ tip_preset_1: v }).eq('id', therapist.id);
                }}
                suffix="%"
                min={0}
                max={100}
                width={50}
              />
              <InlineSaveNumberInput
                value={tipPreset2}
                defaultValue={18}
                placeholder="18"
                onChange={setTipPreset2}
                onSave={async (v) => {
                  await supabase.from('therapists').update({ tip_preset_2: v }).eq('id', therapist.id);
                }}
                suffix="%"
                min={0}
                max={100}
                width={50}
              />
              <InlineSaveNumberInput
                value={tipPreset3}
                defaultValue={20}
                placeholder="20"
                onChange={setTipPreset3}
                onSave={async (v) => {
                  await supabase.from('therapists').update({ tip_preset_3: v }).eq('id', therapist.id);
                }}
                suffix="%"
                min={0}
                max={100}
                width={50}
              />
            </div>
          </div>
        )}

        {/* Toggle: Allow pay-in-full */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 0',
        }}>
          <div style={{ flex:1, paddingRight:12 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C2.darkGray, marginBottom:2 }}>
              Allow pay-in-full at booking
            </div>
            <div style={{ fontSize:12, color:C2.gray, lineHeight:1.5 }}>
              Clients can choose to pay the full session price upfront instead of just a deposit.
              {acceptTips && ' Tip selector appears with this option.'}
            </div>
          </div>
          <button
            onClick={async () => {
              const next = !payInFullEnabled;
              setPayInFullEnabled(next);
              await supabase.from('therapists').update({ pay_in_full_enabled: next }).eq('id', therapist.id);
            }}
            style={{
              width:46, height:26, borderRadius:13, border:'none',
              background: payInFullEnabled ? C2.forest : '#D1CFC7',
              position:'relative', cursor:'pointer', flexShrink:0,
              transition:'background 0.2s',
            }}
            aria-label={payInFullEnabled ? 'Disable pay-in-full' : 'Enable pay-in-full'}>
            <div style={{
              position:'absolute', top:3, left: payInFullEnabled ? 23 : 3,
              width:20, height:20, borderRadius:'50%', background:'#fff',
              transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>
      </DisclosureRow>

      {/* Working Hours - Time Blocks. Disclosure row pattern. */}
      <DisclosureRow
        icon="🕐"
        taxonomyId="2.1.9"
        title="Working hours"
        summary={(() => {
          const activeDays = (availability || []).filter(a => !a.service_id && a.active);
          if (activeDays.length === 0) return 'No days set';
          const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const sorted = [...activeDays].sort((a, b) => a.day_of_week - b.day_of_week);
          const days = sorted.map(a => dayLabels[a.day_of_week]).join(', ');
          const first = sorted[0];
          if (!first?.start_time) return days;
          const start = first.start_time.slice(0, 5);
          const end = first.end_time?.slice(0, 5) || '';
          return `${days} · ${start} to ${end}`;
        })()}
        open={openSubRow === 'working-hours'}
        onToggle={() => setOpenSubRow(openSubRow === 'working-hours' ? null : 'working-hours')}
      >
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:'11px', color:C2.gray }}>Tap a day to enable. + adds a break.</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {DAYS.map(({ id: dow, label }) => {
            const avail = availability.find(a => a.day_of_week === dow);
            const isOn = avail?.active;
            const blocks = avail ? getBlocks(avail) : [];
            return (
              <div key={dow} style={{
                background: isOn ? '#F9FAFB' : 'transparent',
                borderRadius: 8,
                padding: isOn ? '6px 10px' : '4px 10px',
                transition: 'all 0.15s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {/* Day toggle pill — compact */}
                  <button onClick={() => toggleDay(dow)}
                    style={{
                      width: 30, height: 18, borderRadius: 10,
                      background: isOn ? C2.forest : '#D1D5DB',
                      border: 'none', cursor: 'pointer',
                      position: 'relative', flexShrink: 0,
                      transition: 'background 0.2s',
                    }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#fff', position: 'absolute',
                      top: 3, left: isOn ? 15 : 3,
                      transition: 'left 0.2s',
                    }}/>
                  </button>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: isOn ? C2.darkGray : '#C4C4C4',
                    width: 30, flexShrink: 0,
                  }}>{label}</span>

                  {!isOn && (
                    <span style={{ fontSize: 12, color: '#D1D5DB' }}>Off</span>
                  )}

                  {/* Time blocks inline on the same row when day is on */}
                  {isOn && avail && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', flex:1 }}>
                      {blocks.map((block, idx) => (
                        <div key={idx} style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <input type="time" value={block.start}
                            onChange={e => updateBlock(avail, idx, 'start', e.target.value)}
                            style={{
                              padding: '3px 6px',
                              border: `1px solid ${C2.lightGray}`,
                              borderRadius: 6,
                              fontSize: 12,
                              outline: 'none',
                              background: '#fff',
                              width: 96,
                            }}/>
                          <span style={{ fontSize: 11, color: C2.gray }}>to</span>
                          <input type="time" value={block.end}
                            onChange={e => updateBlock(avail, idx, 'end', e.target.value)}
                            style={{
                              padding: '3px 6px',
                              border: `1px solid ${C2.lightGray}`,
                              borderRadius: 6,
                              fontSize: 12,
                              outline: 'none',
                              background: '#fff',
                              width: 96,
                            }}/>
                          {blocks.length > 1 && (
                            <button onClick={() => removeBlock(avail, idx)}
                              aria-label="Remove this time block"
                              style={{
                                background: 'transparent', border: '1px solid transparent',
                                color: '#EF4444', cursor: 'pointer',
                                fontSize: 11, fontWeight: 700, padding: '4px 10px',
                                borderRadius: 999, flexShrink: 0,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e)=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.borderColor='#FCA5A5';}}
                              onMouseLeave={(e)=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='transparent';}}>Remove</button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addBlock(avail)}
                        title="Add a break"
                        style={{
                          background: 'transparent',
                          border: `1px dashed ${C2.lightGray}`,
                          borderRadius: 6,
                          width: 22, height: 22,
                          fontSize: 13, fontWeight: 700,
                          color: C2.sage,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DisclosureRow>

      {/* Cycle-aligned scheduling. Disclosure row pattern. */}
      <DisclosureRow
        icon="🌙"
        taxonomyId="2.1.10"
        title="Cycle-aligned scheduling"
        summary={therapist?.cycle_scheduling_enabled ? 'On · per-phase service filtering' : 'Off · all services any phase'}
        open={openSubRow === 'cycle'}
        onToggle={() => setOpenSubRow(openSubRow === 'cycle' ? null : 'cycle')}
      >
        <CycleScheduling therapist={therapist} />
      </DisclosureRow>

      {/* Preview booking page footer (HK May 10 2026 design direction).
          Single dedicated link at the bottom of the panel that opens
          the public booking page in a new tab. Uses the /book/<slug>
          route which lands on BookingPage with the slot picker first.
          The bare /<slug> route goes to ClientIntake (the intake form),
          which is wrong for "see what clients see when they book". */}
      {therapist?.custom_url && (() => {
        const previewUrl = `/book/${therapist.custom_url}?preview=1${services?.[0]?.id ? `&service=${services[0].id}` : ''}`;
        return (
        <div style={{ marginTop:12 }}>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openExternalClick(previewUrl)}
            style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'10px 14px',
              background:'#F0FDF4', border:'1px solid #C9DCC2', borderRadius:10,
              fontSize:12, color:C2.forest, fontWeight:600,
              textDecoration:'none',
            }}>
            👀 Preview booking page
            <span style={{ marginLeft:'auto', fontSize:11, color:C2.gray, fontWeight:500 }}>
              opens slot picker in a new tab
            </span>
          </a>
        </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ServiceAddonsCard
//
// Settings card where a therapist defines optional extras a client can
// pick at booking — Hot Stones, Aromatherapy, Extended Time, etc.
// Each add-on has a name, price, and optional extra minutes that get
// added to the appointment slot when chosen. Lives in the service_addons
// Supabase table.
//
// Triggered by Leslie Luna's FB question (April 2026): "Is there an
// option for add-ons?" Same shape Vagaro and MassageBook offer.
// ─────────────────────────────────────────────────────────────────────────
function ServiceAddonsCard({ therapist }) {
  const C2 = { sage:'#6B9E80', forest:'#2A5741', beige:'#F0EAD9', gray:'#6B7280', lightGray:'#E8E4DC', white:'#FFFFFF' };
  const [addons, setAddons] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState({ name:'', price:15, extra_minutes:0 });
  const [saving, setSaving] = React.useState(false);

  const PRESETS = [
    { name:'Hot Stones', price:15, extra_minutes:0 },
    { name:'Aromatherapy', price:10, extra_minutes:0 },
    { name:'CBD Oil', price:15, extra_minutes:0 },
    { name:'Cupping Therapy', price:25, extra_minutes:15 },
    { name:'Extended Time +30 min', price:45, extra_minutes:30 },
    { name:'Hot Towels', price:8, extra_minutes:0 },
    { name:'Custom...', price:15, extra_minutes:0 },
  ];

  // Top 5 most-requested add-ons by solo LMTs (researched median pricing).
  const SEED_ADDONS = [
    { name:'Hot Stones', price:15, extra_minutes:0 },
    { name:'Aromatherapy', price:10, extra_minutes:0 },
    { name:'Hot Towels', price:8, extra_minutes:0 },
    { name:'Cupping Therapy', price:25, extra_minutes:15 },
    { name:'Extended Time +30 min', price:45, extra_minutes:30 },
  ];

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('service_addons').select('*').eq('therapist_id', therapist.id).order('display_order').order('created_at')
      .then(({ data }) => { setAddons(data || []); setLoading(false); });
  }, [therapist?.id]);

  function handlePreset(name) {
    if (name === 'Custom...') { setDraft(d => ({ ...d, name:'' })); return; }
    const p = PRESETS.find(x => x.name === name);
    if (p) setDraft({ name:p.name, price:p.price, extra_minutes:p.extra_minutes });
  }

  async function addAddon() {
    if (!draft.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('service_addons').insert({
      therapist_id: therapist.id,
      name: draft.name.trim(),
      price: Number(draft.price) || 0,
      extra_minutes: Number(draft.extra_minutes) || 0,
      active: true,
    }).select().single();
    setSaving(false);
    if (error) {
      alert('Could not save the add-on. The schema may not be applied yet — run the SQL migration in Supabase.');
      return;
    }
    setAddons(a => [...a, data]);
    setDraft({ name:'', price:15, extra_minutes:0 });
  }

  async function toggleAddon(addon) {
    await supabase.from('service_addons').update({ active: !addon.active }).eq('id', addon.id);
    setAddons(a => a.map(x => x.id === addon.id ? { ...x, active: !x.active } : x));
  }

  async function deleteAddon(id) {
    if (!window.confirm('Remove this add-on? Existing bookings that include it are unaffected.')) return;
    await supabase.from('service_addons').delete().eq('id', id);
    setAddons(a => a.filter(x => x.id !== id));
  }

  async function updateAddon(id, patch) {
    const prev = addons.find(a => a.id === id);
    if (!prev) return;
    setAddons(a => a.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('service_addons').update(patch).eq('id', id);
    if (error) {
      console.error('updateAddon failed:', error);
      setAddons(a => a.map(x => x.id === id ? prev : x));
    }
  }

  async function seedDefaults(indices) {
    const rows = indices.map(i => ({
      therapist_id: therapist.id,
      ...SEED_ADDONS[i],
      active: true,
    }));
    const { data } = await supabase.from('service_addons').insert(rows).select();
    if (data) setAddons(a => [...a, ...data]);
  }

  return (
    <div style={{ background:C2.white, border:`1.5px solid ${C2.lightGray}`, borderRadius:14, padding:24, marginBottom:20 }}>
      <p style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:C2.gray, margin:'0 0 6px 0' }}>Add-ons</p>
      <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Optional extras a client can add to any service when booking. Hot Stones, Aromatherapy, Extended Time. Each can change price and optionally extend the appointment.</p>

      {loading ? (
        <p style={{ fontSize:13, color:C2.gray }}>Loading…</p>
      ) : (
        <>
          {addons.length === 0 && (
            <SeedDefaults
              title="Suggested add-ons"
              items={SEED_ADDONS.map(p => ({
                label: p.name,
                sub: `+$${p.price}${p.extra_minutes > 0 ? ` · +${p.extra_minutes} min` : ''}`,
              }))}
              onSeed={seedDefaults}
            />
          )}
          {addons.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {addons.map(a => (
                <div key={a.id} style={{ padding:'10px 12px', background:a.active ? '#FAFAF6' : '#F3F4F6', border:`1px solid ${C2.lightGray}`, borderRadius:10, marginBottom:6, opacity:a.active?1:0.55 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:C2.forest }}>{a.name}</div>
                      <div style={{ fontSize:12, color:C2.gray, display:'inline-flex', alignItems:'center', gap:6, marginTop:2 }}>
                        <InlineEditField
                          value={Number(a.price)}
                          type="number"
                          prefix="+$"
                          min={0}
                          max={999}
                          step={5}
                          width={50}
                          fontSize={12}
                          color={C2.gray}
                          ariaLabel={`Price for ${a.name}`}
                          onSave={(v) => updateAddon(a.id, { price: v })}
                        />
                        <span style={{ color:'#D1D5DB' }}>·</span>
                        <InlineEditField
                          value={Number(a.extra_minutes) || 0}
                          type="number"
                          prefix="+"
                          suffix="min"
                          min={0}
                          max={120}
                          step={5}
                          width={42}
                          fontSize={12}
                          color={C2.gray}
                          ariaLabel={`Extra minutes for ${a.name}`}
                          onSave={(v) => updateAddon(a.id, { extra_minutes: v })}
                        />
                      </div>
                    </div>
                    <button onClick={() => toggleAddon(a)} style={{ background:a.active?'#fff':C2.sage, color:a.active?C2.gray:'#fff', border:`1px solid ${C2.lightGray}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      {a.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => deleteAddon(a.id)} aria-label={`Delete ${a.name || 'this add-on'}`} style={{ background:'transparent', color:C2.gray, border:'1px solid transparent', fontSize:11, fontWeight:700, cursor:'pointer', padding:'4px 10px', borderRadius:999, transition:'all 0.15s' }} onMouseEnter={(e)=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.color='#DC2626';e.currentTarget.style.borderColor='#FCA5A5';}} onMouseLeave={(e)=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C2.gray;e.currentTarget.style.borderColor='transparent';}}>Delete</button>
                  </div>
                  <div style={{ marginTop:6 }}>
                    <InlineEditDescription
                      value={a.description}
                      placeholder="Add a description so clients know what it is (optional)"
                      onSave={(v) => updateAddon(a.id, { description: v })}
                      ariaLabel={`Description for ${a.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:C2.beige, padding:14, borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C2.forest, marginBottom:10 }}>Add a new one</div>
            <select onChange={e => handlePreset(e.target.value)} value={PRESETS.find(p => p.name === draft.name)?.name || ''}
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, background:'#fff' }}>
              <option value="">Pick a preset or write your own…</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}
              placeholder="Add-on name (e.g. Hot Stones)"
              style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C2.gray, fontWeight:600, display:'block', marginBottom:3 }}>Price</label>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ color:C2.gray, fontSize:13 }}>$</span>
                  <input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price:e.target.value }))}
                    min="0" step="1"
                    style={{ flex:1, padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C2.gray, fontWeight:600, display:'block', marginBottom:3 }}>Extra minutes</label>
                <input type="number" value={draft.extra_minutes} onChange={e => setDraft(d => ({ ...d, extra_minutes:e.target.value }))}
                  min="0" step="5"
                  style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:13, boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={addAddon} disabled={saving || !draft.name.trim()}
              style={{ width:'100%', background:saving?C2.sage:C2.forest, color:'#fff', border:'none', borderRadius:8, padding:'10px', fontSize:13, fontWeight:700, cursor:draft.name.trim() ? 'pointer' : 'not-allowed', opacity:draft.name.trim()?1:0.5 }}>
              {saving ? 'Saving…' : '+ Add this add-on'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BookingEmbedPanel({ customUrl }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  if (!customUrl) return null;
  const bookingUrl = `${window.location.origin}/book/${customUrl}`;
  const embedCode = `<iframe
  src="${bookingUrl}"
  width="100%"
  height="780"
  frameborder="0"
  style="border:0;max-width:560px;display:block;margin:0 auto;"
  title="Book a session"
  loading="lazy"
></iframe>`;
  const onCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#2A5741',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
        <span style={{ fontSize: 10, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
        Embed on your website
      </button>
      {open && (
        <div style={{ marginTop: 10, background: '#fff', border: '1.5px solid #E8E4DC', borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
            Paste this snippet into your website's HTML where you want the booking form to appear. Works on Wix, Squarespace, WordPress, or any site that accepts HTML embeds.
          </p>
          <textarea
            readOnly
            value={embedCode}
            onClick={e => e.target.select()}
            style={{
              width: '100%',
              minHeight: 120,
              padding: 10,
              border: '1.5px solid #E8E4DC',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#1F2937',
              background: '#FAFAF7',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              onClick={onCopy}
              style={{
                background: copied ? '#16A34A' : '#2A5741',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              {copied ? '✓ Copied' : 'Copy embed code'}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              onClick={openExternalClick(bookingUrl)}
              style={{
                background: '#fff',
                border: '1.5px solid #E8E4DC',
                color: '#6B7280',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}>
              Test the booking form →
            </a>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
            <strong style={{ color: '#6B7280' }}>Tip:</strong> On Wix, use <em>Embed HTML</em>. On Squarespace, use <em>Code Block</em>. On WordPress, use the <em>Custom HTML</em> block.
          </div>
        </div>
      )}
    </div>
  );
}

function PushNotificationsCard({ therapist, C2 }) {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe, sendTest } = usePushNotifications(therapist?.id);
  const [testStatus, setTestStatus] = React.useState(null);
  const [testSending, setTestSending] = React.useState(false);

  const doTest = async () => {
    setTestSending(true);
    setTestStatus(null);
    const result = await sendTest();
    setTestSending(false);

    // Build a clear diagnostic based on what came back
    if (result.ok && result.data?.sent > 0) {
      setTestStatus({ ok: true, msg: `Test sent to ${result.data.sent} device${result.data.sent > 1 ? 's' : ''}. Check your notifications.` });
    } else if (result.ok && result.data?.sent === 0 && result.data?.reason === 'no subscriptions') {
      setTestStatus({ ok: false, msg: 'No devices subscribed yet. Turn on notifications above first, then try again.' });
    } else if (result.status === 404) {
      setTestStatus({ ok: false, msg: 'send-push edge function not deployed. From your terminal: npx supabase functions deploy send-push --project-ref rmnqfrljoknmellbnpiy' });
    } else if (result.data?.error && /VAPID/i.test(result.data.error)) {
      setTestStatus({ ok: false, msg: 'VAPID secrets missing in Supabase. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT under Project Settings -> Edge Functions -> Secrets.' });
    } else if (result.data?.error) {
      setTestStatus({ ok: false, msg: `Edge function error: ${result.data.error}` });
    } else if (result.data?.errors?.length > 0) {
      const e = result.data.errors[0];
      setTestStatus({ ok: false, msg: `Push service rejected (${e.statusCode || '?'}) from ${e.endpoint_host || 'endpoint'}: ${e.message || e.body || 'unknown'}` });
    } else if (result.reason) {
      setTestStatus({ ok: false, msg: result.reason });
    } else {
      setTestStatus({ ok: false, msg: `HTTP ${result.status || '?'}: ${JSON.stringify(result.data).slice(0, 200)}` });
    }
    setTimeout(() => setTestStatus(null), 12000);
  };

  return (
    <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px 0' }}>
        Push Notifications
      </p>
      <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#15803D', marginBottom:4 }}>Why this matters</div>
        <p style={{ fontSize:12, color:'#166534', margin:0, lineHeight:1.55 }}>The faster you reply to a new booking or a client message, the more likely they stay. A 5-minute reply turns a maybe into a yes. Push lets you respond from your phone the moment something happens, instead of finding out hours later when you check email.</p>
      </div>
      <p style={{ fontSize: '12px', color: C2.gray, margin: '0 0 16px 0', lineHeight: 1.5 }}>
        Get a tap on your phone when something matters, a new booking, a client reply, a gift card redemption. Works on your iPhone after you install MyBodyMap to your home screen.
      </p>

      {!supported && (
        <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#9A3412', lineHeight: 1.5 }}>
          <strong>Not supported in this browser.</strong><br/>
          On iPhone, open mybodymap.app in Safari, tap Share → Add to Home Screen, then open from the home screen. Notifications will work from there.
        </div>
      )}

      {supported && permission === 'denied' && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>
          <strong>Notifications blocked.</strong> Open your device Settings → Notifications → MyBodyMap, and allow notifications.
        </div>
      )}

      {supported && permission !== 'denied' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={subscribed ? unsubscribe : subscribe}
                disabled={loading}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: subscribed ? C2.forest : '#D1D5DB',
                  border: 'none', cursor: loading ? 'wait' : 'pointer',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  opacity: loading ? 0.6 : 1,
                }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: subscribed ? 21 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: subscribed ? C2.forest : C2.gray }}>
                {loading ? 'Working…' : subscribed ? 'Notifications ON' : 'Notifications OFF'}
              </span>
            </div>
          </div>

          {subscribed && (
            <button
              onClick={doTest}
              disabled={testSending}
              style={{
                background: testSending ? C2.sage : C2.beige,
                color: C2.forest,
                border: `1.5px solid ${C2.lightGray}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12, fontWeight: 700,
                cursor: testSending ? 'wait' : 'pointer',
                marginBottom: testStatus ? 10 : 0,
              }}>
              {testSending ? 'Sending…' : 'Send me a test notification'}
            </button>
          )}

          {testStatus && (
            <div style={{
              background: testStatus.ok ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${testStatus.ok ? '#86EFAC' : '#FECACA'}`,
              color: testStatus.ok ? '#166534' : '#991B1B',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: 1.5,
            }}>
              {testStatus.ok ? '✓ ' : '⚠ '}{testStatus.msg}
            </div>
          )}

          {error && !testStatus && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 10 }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReferralCard({ therapist, C2 }) {
  const [copied, setCopied] = React.useState(false);
  const [count, setCount] = React.useState(null);
  const referralUrl = therapist?.custom_url
    ? `${window.location.origin}/signup?ref=${therapist.custom_url}`
    : '';

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('referrals').select('id', { count: 'exact', head: true })
      .eq('referrer_therapist_id', therapist.id)
      .then(({ count }) => setCount(count || 0))
      .catch(() => {});
  }, [therapist?.id]);

  function copy() {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!referralUrl) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #FFFBEB)', border: '1.5px solid #86EFAC', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.forest, margin: '0 0 6px 0' }}>🌿 Refer a therapist</p>
      <p style={{ fontSize: 14, color: C2.darkGray, lineHeight: 1.6, margin: '0 0 14px 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
        Know another therapist who'd love MyBodyMap? Share your link. They get Silver free for a limited time. You get a shoutout and swag.
      </p>
      <div style={{ background: '#fff', border: `1.5px solid ${C2.lightGray}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: C2.forest, fontWeight: 700, wordBreak: 'break-all' }}>
        {referralUrl}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={copy} style={{ background: copied ? '#E8F5EE' : C2.forest, color: copied ? C2.forest : '#fff', border: copied ? '1.5px solid #86EFAC' : 'none', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {copied ? '✓ Copied!' : '📋 Copy link'}
        </button>
        {count !== null && count > 0 && (
          <span style={{ fontSize: 12, color: C2.gray }}>{count} {count === 1 ? 'therapist' : 'therapists'} signed up through you</span>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ therapist, lapsedDays, setLapsedDays }) {
  const { updateProfile, refreshTherapist } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // OnboardingChecklist data load. Mirrors the loadStats() in main
  // Dashboard but scoped just to what the checklist needs. Keeps
  // SettingsPanel self-contained without threading stats props in.
  // HK May 23 2026: dual-placement decision, checklist renders both
  // here (above 'How I practice') and on the home tab.
  const [onboardingState, setOnboardingState] = React.useState({
    services: [],
    availability: [],
    clients: 0,
    sessions: 0,
  });
  React.useEffect(() => {
    let mounted = true;
    if (!therapist?.id) return;
    (async () => {
      try {
        const [{ data: svc }, { data: avail }, { count: clientCount }, { count: sessionCount }] = await Promise.all([
          supabase.from('services').select('id, price').eq('therapist_id', therapist.id).is('archived_at', null),
          supabase.from('availability').select('active').eq('therapist_id', therapist.id),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('therapist_id', therapist.id),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('therapist_id', therapist.id),
        ]);
        if (!mounted) return;
        setOnboardingState({
          services: svc || [],
          availability: avail || [],
          clients: clientCount || 0,
          sessions: sessionCount || 0,
        });
      } catch (e) {
        console.error('[SettingsPanel] onboarding state load failed:', e);
      }
    })();
    return () => { mounted = false; };
  }, [therapist?.id, therapist?.skipped_import_at, therapist?.booking_page_previewed_at]);

  // Which row in Settings is currently expanded. null = all collapsed.
  // Mobile-first: collapsed by default to kill the endless vertical scroll.
  const [openRow, setOpenRow] = React.useState(null);
  const toggleRow = React.useCallback((id) => {
    setOpenRow(prev => prev === id ? null : id);
  }, []);

  // Inline confirm for Square disconnect (HK May 22 2026, replaces
  // window.confirm per house design rule). Tapping Disconnect once
  // reveals a Confirm/Cancel pair; second tap on Confirm executes.
  const [squareDisconnectConfirm, setSquareDisconnectConfirm] = React.useState(false);
  // Inline error message for Square OAuth failure (HK May 22 2026,
  // replaces alert per house design rule).
  const [squareConnectError, setSquareConnectError] = React.useState(null);

  // Within 4.3 'Booking & cancellation policies' the two policy cards
  // are individually collapsible so therapists can focus on one at a
  // time. Default: both collapsed when 4.3 opens. State is a Set so
  // both can be open simultaneously, unlike openRow which is one-at-a-
  // time at the section level.
  const [openPolicySubs, setOpenPolicySubs] = React.useState(() => new Set());
  const togglePolicySub = React.useCallback((id) => {
    setOpenPolicySubs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Hash-based deep-link to a specific Settings collapsible section.
  // OnboardingChecklist links like /dashboard/settings#import use this to
  // auto-open the row matching the hash and scroll it into view. Critical
  // for the 'Import Clients' onboarding step — clicking lands the user
  // directly on the import form instead of inside Settings somewhere.
  //
  // Three important details:
  // 1. Depends on location.hash (from useLocation) so the effect re-runs
  //    when the user clicks a deep-link from somewhere else inside the
  //    /dashboard/settings page.
  // 2. Two-step scroll: first setOpenRow expands the section, then on
  //    next render we scroll. We use requestAnimationFrame instead of
  //    setTimeout because mobile timers are unreliable and rAF fires
  //    after layout, when the section is actually visible.
  // 3. After the scroll, CLEAR the hash so subsequent re-renders (e.g.
  //    when a child save updates auth context and re-renders the panel)
  //    don't re-fire this effect and re-jump the page. HK reported the
  //    page jumping when clicking the cycle scheduling toggle — caused
  //    by the toggle's save call triggering a re-render that re-ran
  //    this effect with the original hash still present.
  React.useEffect(() => {
    const hash = (location.hash || '').replace('#', '');
    if (!hash) return;

    // Deep-link map: a few hash targets are inside a PolicySubRow nested
    // under a parent CollapsibleSection. The hash names the inner element;
    // we open BOTH the parent CollapsibleSection and the inner PolicySubRow,
    // then scroll the inner row into view. Add new mappings here as new
    // PolicySubRows are added.
    //
    // Today the only nested target is the Client Agreement editor inside
    // section 4.3 (cancellation). When the deep link is for
    // #client_agreement, we expand 'cancellation' AND 'client_agreement'.
    const POLICY_SUB_PARENTS = {
      client_agreement: 'cancellation',
      booking_policies: 'cancellation',
    };

    const parentSectionId = POLICY_SUB_PARENTS[hash] || hash;
    setOpenRow(parentSectionId);
    if (POLICY_SUB_PARENTS[hash]) {
      setOpenPolicySubs(prev => {
        const next = new Set(prev);
        next.add(hash);
        return next;
      });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.style.boxShadow = '0 0 0 3px rgba(42, 87, 65, 0.35)';
          el.style.transition = 'box-shadow 0.6s ease';
          setTimeout(() => {
            el.style.boxShadow = '';
          }, 1800);
        }
        // Clear the hash so we don't re-scroll on every subsequent render.
        // Use replaceState (not navigate) to avoid adding a history entry.
        if (window.history.replaceState) {
          window.history.replaceState(
            null, '',
            window.location.pathname + window.location.search
          );
        }
      });
    });
  }, [location.hash]);

  // Settings search: matches against label, summary, taxonomy, and a
  // hand-curated synonym map so common search terms ('billing', 'price',
  // 'subscription') route to the right rows even though the literal
  // word isn't in the label.
  const [settingsQuery, setSettingsQuery] = React.useState('');
  const isSearching = settingsQuery.trim().length > 0;

  // Synonym aliases: the key is a search term the user is likely to type,
  // the value is one or more taxonomy IDs that should match.
  const SEARCH_ALIASES = React.useMemo(() => ({
    billing:        ['5.1', '4.2'],
    subscription:   ['5.1'],
    price:          ['2.1', '2.2', '2.3', '2.4', '2.5'],
    pricing:        ['2.1', '2.2', '2.3', '2.4', '2.5'],
    money:          ['4.2', '5.1'],
    pay:            ['4.2', '2.1'],
    stripe:         ['4.2'],
    square:         ['4.2'],
    twilio:         ['4.3'],
    sms:            ['4.3', '3.4'],
    text:           ['4.3'],
    email:          ['3.4'],
    notification:   ['3.3', '3.4'],
    notifications:  ['3.3', '3.4'],
    alert:          ['3.3'],
    intake:         ['1.3', '1.5'],
    waiver:         ['2.6', '1.5'],
    schedule:       ['2.1', '1.6'],
    hours:          ['2.1'],
    vacation:       ['1.6'],
    'days off':     ['1.6'],
    'time off':     ['1.6'],
    holiday:        ['1.6'],
    cal:            ['4.1'],
    calendar:       ['4.1'],
    booking:        ['1.4', '1.5'],
    approval:       ['1.5'],
    qr:             ['1.3'],
    photo:          ['1.1'],
    profile:        ['1.1'],
    name:           ['1.1'],
    business:       ['1.1', '1.4'],
    'lapsed':       ['3.5'],
    pulse:          ['3.2'],
    'practice pulse': ['3.2'],
    digest:         ['3.2'],
    referral:       ['4.4'],
    refer:          ['4.4'],
    import:         ['1.2'],
    csv:            ['1.2'],
    vagaro:         ['1.2'],
    massagebook:    ['1.2'],
    password:       ['5.2'],
    plan:           ['5.1'],
    silver:         ['5.1'],
    gold:           ['5.1'],
    addon:          ['2.2'],
    'add-on':       ['2.2'],
    'add on':       ['2.2'],
    package:        ['2.3'],
    membership:     ['2.4', '5.1'],
    class:          ['2.5'],
    classes:        ['2.5'],
    event:          ['2.5'],
    workshop:       ['2.5'],
    ai:             ['3.1'],
    chat:           ['3.1'],
    push:           ['3.3'],
  }), []);

  const matchesSearch = React.useCallback((label, summary, taxonomy) => {
    if (!isSearching) return true;
    const q = settingsQuery.trim().toLowerCase();
    const haystack = `${label || ''} ${summary || ''} ${taxonomy || ''}`.toLowerCase();
    if (haystack.includes(q)) return true;
    // Check aliases: if the query matches an alias key (or a key contains
    // the query as a substring), see if this row's taxonomy is in the
    // alias's target list.
    for (const [aliasKey, taxIds] of Object.entries(SEARCH_ALIASES)) {
      if (aliasKey.includes(q) || q.includes(aliasKey)) {
        if (taxIds.includes(taxonomy)) return true;
      }
    }
    return false;
  }, [settingsQuery, isSearching, SEARCH_ALIASES]);

  // Per-group match maps so we can hide entire group headers when no row
  // inside them matches the active search. Drives both the section
  // header visibility and the SettingsGroup panel render.
  const groupMatches = React.useMemo(() => {
    if (!isSearching) {
      return { practice: true, offer: true, restEasier: true, plugIn: true, membership: true, anyMatch: true };
    }
    const groups = {
      practice:    [['Your info','','1.1'],['Import existing clients','Bring your list from CSV. Vagaro, MassageBook, Square','1.2'],['Booking & intake links','Share your link or QR codes for clients','1.3'],['Booking page setup','Approval and intake gates, embed','1.4'],['Time off','','1.5']],
      offer:       [['Services & hours','Your menu, weekly hours, deposits, buffer','2.1'],['Add-ons','Hot stones, aromatherapy, hot towels…','2.2'],['Packages','Multi-session bundles','2.3'],['Memberships','Recurring monthly plans','2.4'],['Classes & events','Workshops, group sessions','2.5'],['Waiver text','','2.6']],
      restEasier:  [['Platform features','','3.1'],['Practice Pulse','','3.2'],['Push notifications','On-device alerts for new bookings','3.3'],['Notification preferences','Email alerts for events','3.4'],['Lapsed client threshold','','3.5']],
      plugIn:      [['Cal.com sync','','4.1'],['Google Calendar sync','Two-way sync with Google Calendar','4.1.5'],['Payments','','4.2'],['Custom SMS sender (Twilio)','','4.3'],['Referrals','','4.4']],
      membership:  [['Your plan','','5.1'],['Change password','Set a new password','5.2']],
    };
    const result = { anyMatch: false };
    for (const [key, rows] of Object.entries(groups)) {
      const has = rows.some(([l,s,t]) => matchesSearch(l, s, t));
      result[key] = has;
      if (has) result.anyMatch = true;
    }
    return result;
  }, [isSearching, matchesSearch]);

  // Which major SECTION groups are open. Default all open so the page
  // looks identical to before unless user collapses. Tap header to fold.
  const [openSections, setOpenSections] = React.useState({
    practice: true,
    offer: true,
    restEasier: true,
    plugIn: true,
    membership: true,
  });
  const toggleSection = React.useCallback((key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const [lapsedSaved, setLapsedSaved] = React.useState(false);
  const [fullName, setFullName] = React.useState(therapist?.full_name || '');
  const [businessName, setBusinessName] = React.useState(therapist?.business_name || '');
  const [phone, setPhone] = React.useState(therapist?.phone || '');
  const [phoneError, setPhoneError] = React.useState('');
  const [nameError, setNameError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState(therapist?.photo_url || '');
  const [pulseEnabled, setPulseEnabled] = React.useState(therapist?.practice_pulse_enabled !== false);
  const [pulseEmail, setPulseEmail] = React.useState(therapist?.practice_pulse_email || '');
  const [pulseEmailSaved, setPulseEmailSaved] = React.useState(false);
  const [pulseSending, setPulseSending] = React.useState(false);
  const [pulseSent, setPulseSent] = React.useState(false);

  // Platform features master switch. Defaults TRUE so existing therapists are
  // unchanged. Flipping to false hides PracticeIQ chat tab, pre-session
  // brief buttons, and Practice Pulse from the dashboard. Data is preserved
  // -- flipping back to true restores all surfaces.
  const [aiEnabled, setAiEnabled] = React.useState(therapist?.ai_enabled !== false);

  async function togglePulse() {
    const newVal = !pulseEnabled;
    setPulseEnabled(newVal);
    await supabase.from('therapists').update({ practice_pulse_enabled: newVal }).eq('id', therapist.id);
  }

  async function toggleAi() {
    const newVal = !aiEnabled;
    setAiEnabled(newVal);
    await supabase.from('therapists').update({ ai_enabled: newVal }).eq('id', therapist.id);
    // Hard reload so all dashboard surfaces re-fetch the therapist row and
    // re-render with AI tabs/buttons hidden or shown. Cheaper than threading
    // a context update through every component that reads therapist.ai_enabled.
    setTimeout(() => window.location.reload(), 400);
  }

  async function savePulseEmail() {
    await supabase.from('therapists').update({ practice_pulse_email: pulseEmail || null }).eq('id', therapist.id);
    setPulseEmailSaved(true);
    setTimeout(() => setPulseEmailSaved(false), 2000);
  }

  async function sendTestPulse() {
    setPulseSending(true);
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    await fetch(`${supabaseUrl}/functions/v1/practice-pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
      body: JSON.stringify({ therapist_id: therapist.id }),
    });
    setPulseSending(false);
    setPulseSent(true);
    setTimeout(() => setPulseSent(false), 3000);
  }
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [newBookingUrl, setNewBookingUrl] = React.useState(null);
  const [calKey, setCalKey] = React.useState(therapist?.cal_api_key || '');
  // Google Calendar connect (Lindsey #10).
  const [googleConnecting, setGoogleConnecting] = React.useState(false);
  const [googleBanner, setGoogleBanner] = React.useState(null); // { kind: 'success'|'error', text: string }
  const [externalEvents, setExternalEvents] = React.useState([]);

  // Detect post-OAuth redirect back: /dashboard/settings#integrations?google_connected=1 or ?google_error=...
  // Cleans URL after reading so the banner shows once.
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('google_connected') === '1') {
      setGoogleBanner({ kind: 'success', text: 'Google Calendar connected. Syncing now.' });
      sp.delete('google_connected');
      const newUrl = window.location.pathname + (sp.toString() ? '?' + sp.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } else if (sp.get('google_error')) {
      const err = sp.get('google_error');
      setGoogleBanner({ kind: 'error', text: `Could not connect Google Calendar: ${err}` });
      sp.delete('google_error');
      const newUrl = window.location.pathname + (sp.toString() ? '?' + sp.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Load external (Google) events for the upcoming 60 days so the
  // therapist can see their dentist / lunch / kid pickups on the
  // dashboard. Clients on the public booking page never see these
  // titles, only that the slot is unavailable.
  React.useEffect(() => {
    if (!therapist?.id || !therapist?.google_calendar_connected) {
      setExternalEvents([]);
      return;
    }
    const upper = new Date();
    upper.setDate(upper.getDate() + 60);
    supabase
      .from('external_calendar_events')
      .select('id, summary, start_at, end_at, is_all_day')
      .eq('therapist_id', therapist.id)
      .eq('status', 'confirmed')
      .gte('end_at', new Date().toISOString())
      .lte('start_at', upper.toISOString())
      .order('start_at', { ascending: true })
      .limit(20)
      .then(({ data }) => setExternalEvents(data || []));
  }, [therapist?.id, therapist?.google_calendar_connected]);

  async function connectGoogleCalendar() {
    setGoogleConnecting(true);
    try {
      // Ask the edge function to build the OAuth URL for us. The
      // edge function reads GOOGLE_CLIENT_ID from Supabase secrets,
      // so we never need a frontend env var for it. May 10 2026:
      // moved server-side after the REACT_APP_GOOGLE_CLIENT_ID
      // approach kept failing in Vercel.
      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ therapist_id: therapist.id }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.url) {
        setGoogleBanner({ kind: 'error', text: data?.error || 'Could not start Google connect. Try again or contact support.' });
        setGoogleConnecting(false);
        return;
      }
      // Send the browser to Google's consent screen.
      window.location.href = data.url;
    } catch (e) {
      setGoogleBanner({ kind: 'error', text: e.message || 'Connect failed' });
      setGoogleConnecting(false);
    }
  }

  async function disconnectGoogleCalendar() {
    await supabase.from('therapists').update({
      google_calendar_connected: false,
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
      google_email: null,
      google_sync_token: null,
      google_last_synced_at: null,
    }).eq('id', therapist.id);
    setGoogleBanner({ kind: 'success', text: 'Google Calendar disconnected. Existing events stay in your Google Calendar.' });
    window.location.reload();
  }

  async function syncGoogleNow() {
    setGoogleConnecting(true);
    try {
      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ therapist_id: therapist.id }),
      });
      const j = await res.json();
      if (j.ok) {
        setGoogleBanner({ kind: 'success', text: 'Synced. Your Google events are up to date.' });
        // Reload external events
        const upper = new Date();
        upper.setDate(upper.getDate() + 60);
        const { data } = await supabase
          .from('external_calendar_events')
          .select('id, summary, start_at, end_at, is_all_day')
          .eq('therapist_id', therapist.id)
          .eq('status', 'confirmed')
          .gte('end_at', new Date().toISOString())
          .lte('start_at', upper.toISOString())
          .order('start_at', { ascending: true })
          .limit(20);
        setExternalEvents(data || []);
      } else {
        setGoogleBanner({ kind: 'error', text: 'Sync failed. Try disconnecting and reconnecting.' });
      }
    } catch (e) {
      setGoogleBanner({ kind: 'error', text: e.message });
    } finally {
      setGoogleConnecting(false);
    }
  }

  // Blocked days
  const [blockedDays, setBlockedDays] = React.useState([]);
  const [blockDate, setBlockDate] = React.useState('');
  const [blockNote, setBlockNote] = React.useState('');
  const [blockSaving, setBlockSaving] = React.useState(false);

  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase.from('blocked_days').select('*').eq('therapist_id', therapist.id)
      .gte('date', new Date().toISOString().slice(0,10))
      .order('date').then(({ data }) => setBlockedDays(data || []));
  }, [therapist?.id]);

  async function addBlockedDay() {
    if (!blockDate) return;
    setBlockSaving(true);
    const { data } = await supabase.from('blocked_days').insert({
      therapist_id: therapist.id, date: blockDate, note: blockNote.trim() || null
    }).select().single();
    if (data) setBlockedDays(prev => [...prev, data].sort((a,b) => a.date.localeCompare(b.date)));
    setBlockDate(''); setBlockNote(''); setBlockSaving(false);
  }

  async function removeBlockedDay(id) {
    await supabase.from('blocked_days').delete().eq('id', id);
    setBlockedDays(prev => prev.filter(d => d.id !== id));
  }
  const [calSaved, setCalSaved] = React.useState(false);
  const [twilioSid, setTwilioSid] = React.useState(therapist?.twilio_account_sid || '');
  const [twilioToken, setTwilioToken] = React.useState('');
  const [twilioPhone, setTwilioPhone] = React.useState(therapist?.twilio_phone_number || '');
  const [twilioSaved, setTwilioSaved] = React.useState(false);
  const [showCalKey, setShowCalKey] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const [pwCurrent, setPwCurrent] = React.useState('');
  const [pwNew, setPwNew] = React.useState('');
  const [pwConfirm, setPwConfirm] = React.useState('');
  const [pwSaving, setPwSaving] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState(null); // { type: 'ok'|'err', text }

  async function changePassword() {
    setPwMsg(null);
    if (!pwNew || pwNew.length < 8) { setPwMsg({ type:'err', text:'New password must be at least 8 characters.' }); return; }
    if (pwNew !== pwConfirm) { setPwMsg({ type:'err', text:'New passwords do not match.' }); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) { setPwMsg({ type:'err', text: error.message }); }
    else { setPwMsg({ type:'ok', text:'Password updated.' }); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }
    setTimeout(() => setPwMsg(null), 4000);
  }

  // ─── Data export (HK May 19 2026) ──────────────────────────────
  // Therapist taps 'Download all my data'. We call the
  // export-therapist-data edge function which builds a ZIP of every
  // table tied to her therapist_id, uploads to Supabase Storage, and
  // emails her a 7-day signed URL.
  //
  // Free for all therapists. Marketing differentiator: 'your data
  // is yours.' Matches the FB thread where Colleen challenged
  // 'what happens to your data when you leave?' as the deciding
  // factor between platforms.
  // Export state machine:
  //   idle      -> button enabled, no message
  //   building  -> button disabled with spinner, banner says 'preparing'
  //                while polling data_exports every 3s
  //   ready     -> button shows 'Export ready, check your email' with
  //                checkmark, banner says 'Sent! Check your inbox'
  //                Button auto-resets to idle after 60s so therapist
  //                can request another export later.
  //   failed    -> button returns to enabled state with 'Try again'
  //                label, error banner shows the reason
  const [exportStatus, setExportStatus] = React.useState('idle');
  const [exportMessage, setExportMessage] = React.useState('');
  const [lastExportAt, setLastExportAt] = React.useState(null);
  const [currentExportId, setCurrentExportId] = React.useState(null);

  // On mount, check if the therapist has a recent ready export
  React.useEffect(() => {
    if (!therapist?.id) return;
    supabase
      .from('data_exports')
      .select('status, completed_at, created_at')
      .eq('therapist_id', therapist.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'ready' && data.completed_at) {
          setLastExportAt(data.completed_at);
        }
      });
  }, [therapist?.id]);

  // Poll data_exports while an export is building. Checks every 3s
  // for up to 3 minutes. Stops when status flips to ready or failed.
  React.useEffect(() => {
    if (exportStatus !== 'building' || !currentExportId) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 3 seconds * 60 = 3 minutes
    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(interval);
        setExportStatus('failed');
        setExportMessage('Export is taking longer than expected. Check your email in a few minutes, or try again. If this keeps happening, please email us at hello@mybodymap.app.');
        return;
      }
      const { data } = await supabase
        .from('data_exports')
        .select('status, completed_at, error_message, file_size_bytes, row_count')
        .eq('id', currentExportId)
        .maybeSingle();
      if (!data) return;
      if (data.status === 'ready') {
        clearInterval(interval);
        setExportStatus('ready');
        const mb = data.file_size_bytes ? (data.file_size_bytes / 1024 / 1024).toFixed(1) : null;
        const sizeBlurb = mb ? ` (${mb} MB, ${(data.row_count || 0).toLocaleString()} records)` : '';
        setExportMessage(`Your export is ready${sizeBlurb}. Check your email for the download link.`);
        setLastExportAt(data.completed_at);
        // Auto-reset to idle after 60 seconds so therapist can request
        // another export if needed (e.g., made a change and wants fresh data)
        setTimeout(() => {
          setExportStatus('idle');
          setExportMessage('');
          setCurrentExportId(null);
        }, 60000);
      } else if (data.status === 'failed') {
        clearInterval(interval);
        setExportStatus('failed');
        setExportMessage(`Export failed: ${data.error_message || 'Unknown error'}. Please try again or contact us at hello@mybodymap.app.`);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [exportStatus, currentExportId]);

  async function requestDataExport() {
    // Lock the button immediately by entering building state
    setExportStatus('building');
    setExportMessage('Starting your export...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${process.env.REACT_APP_SUPABASE_URL || 'https://rmnqfrljoknmellbnpiy.supabase.co'}/functions/v1/export-therapist-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Export failed');
      // Stay in 'building' state. The polling effect above will flip
      // us to 'ready' or 'failed' when the backend completes.
      setCurrentExportId(data.export_id);
      setExportMessage(data.message || 'Building your export. We will email you when it is ready, usually within a minute.');
    } catch (err) {
      console.error('requestDataExport failed:', err);
      setExportStatus('failed');
      setExportMessage('Could not start the export. Please try again, or contact us at hello@mybodymap.app.');
    }
  }

  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const bookingUrl = `${window.location.origin}/book/${therapist?.custom_url}`;

  const C2 = {
    sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
    darkGray: '#1A1A2E', gray: '#6B7280', lightGray: '#E8E4DC',
    white: '#FFFFFF', gold: '#C9A84C'
  };

  const copyLink = () => {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    if (therapist?.id) {
      import('../lib/activation').then(({ trackActivation }) => {
        trackActivation(therapist.id, 'shared_booking_link');
      }).catch(() => {});
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <SettingsHero therapist={therapist} />

      {/* Settings search. Top of page so it's the first place a therapist
          looks if they remember a feature name but not its group. Matches
          on label + summary across all rows. Highlighted style (forest
          border, bigger padding, label above) so 70-year-old users can
          find it without hunting. */}
      <div style={{
        marginBottom: 8,
        fontSize: 11,
        fontWeight: 700,
        color: '#2A5741',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        🔎 Search any setting
      </div>
      <div style={{
        position: 'relative',
        marginBottom: 16,
        background: '#fff',
        border: `2px solid ${isSearching ? '#2A5741' : '#86A395'}`,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        boxShadow: '0 2px 8px rgba(42,87,65,0.10)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2A5741" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>
        </svg>
        <input
          type="text"
          value={settingsQuery}
          onChange={(e) => setSettingsQuery(e.target.value)}
          placeholder="Search settings (services, intake, platform, payments, time off…)"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '14px 0',
            fontSize: 15,
            background: 'transparent',
            color: '#1F3A2C',
            minWidth: 0,
          }}
        />
        {isSearching && (
          <button
            onClick={() => setSettingsQuery('')}
            style={{
              background: 'none', border: 'none', padding: 4, cursor: 'pointer',
              color: '#6B7280', display: 'flex', flexShrink: 0,
            }}
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Setup checklist, dual-placement (also on dashboard home tab).
          HK May 23 2026: surface the 5 setup steps above 'How I practice'
          so therapists who land in Settings have a clear path forward
          before they wade through the full settings tree. */}
      <div style={{ marginBottom: 20 }}>
        <OnboardingChecklist
          therapist={therapist}
          services={onboardingState.services}
          availability={onboardingState.availability}
          sessions={onboardingState.sessions}
          clients={onboardingState.clients}
          onNavigate={buildOnboardingNavigate({
            therapist,
            navigate,
            onTherapistUpdated: () => { refreshTherapist && refreshTherapist(); },
          })}
        />
      </div>

      {groupMatches.practice && (<>
      <SettingsSectionHeader
        title="How I practice"
        sub="The bones of your practice. Who you are, where clients find you, when you take days off."
        sprigType="leaf"
        isOpen={isSearching || openSections.practice}
        onToggle={() => toggleSection('practice')}
      />

      {(isSearching || openSections.practice) && (<><SettingsGroup>
      {matchesSearch('Your info', '', '1.1') && (<>
      <CollapsibleSection
        id="profile"
        taxonomy="1.1"
        timeBadge="~30s"
        label="Your info"
        summary={`${therapist?.full_name || 'Add your name'}${therapist?.phone ? ' · ' + therapist.phone : ''}`}
        status={therapist?.full_name && therapist?.phone ? 'done' : 'todo'}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="12" cy="9" r="3.5"/><path d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>}
        isOpen={openRow === 'profile'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        {/* Photo Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${C2.lightGray}` }}>
          <div style={{ position: 'relative' }}>
            {photoUrl || therapist?.photo_url ? (
              <img src={photoUrl || therapist?.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C2.sage}` }} />
            ) : (
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: C2.beige, border: `2px dashed ${C2.sage}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🌿</div>
            )}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: C2.darkGray, margin: '0 0 4px 0' }}>Profile Photo / Business Logo</p>
            <p style={{ fontSize: '11px', color: C2.gray, margin: '0 0 10px 0' }}>Used on client briefs. Square image works best.</p>
            <label style={{ display: 'inline-block', background: C2.beige, border: `1.5px solid ${C2.lightGray}`, color: C2.darkGray, padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: photoUploading ? 'not-allowed' : 'pointer' }}>
              {photoUploading ? '⏳ Uploading...' : '📷 Upload Photo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={photoUploading}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
                  setPhotoUploading(true);
                  try {
                    const { supabase } = await import('../lib/supabase');
                    const ext = file.name.split('.').pop();
                    const { data: { user } } = await supabase.auth.getUser();
                    const path = `${user.id}/profile.${ext}`;
                    const { error: upErr } = await supabase.storage.from('bodymap-assets').upload(path, file, { upsert: true });
                    if (upErr) throw upErr;
                    const { data: { publicUrl } } = supabase.storage.from('bodymap-assets').getPublicUrl(path);
                    await supabase.from('therapists').update({ photo_url: publicUrl }).eq('id', therapist.id);
                    setPhotoUrl(publicUrl);
                  } catch(err) { console.error(err); alert('Upload failed. Please try again.'); }
                  finally { setPhotoUploading(false); }
                }} />
            </label>
            {(photoUrl || therapist?.photo_url) && (
              <button onClick={async () => {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('therapists').update({ photo_url: null }).eq('id', therapist.id);
                setPhotoUrl('');
              }} style={{ marginLeft: '8px', background: 'none', border: 'none', fontSize: '11px', color: '#EF4444', cursor: 'pointer', fontWeight: '600' }}>Remove</button>
            )}
          </div>
        </div>

        <div className="bm-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${nameError?'#EF4444':C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          {nameError && <p style={{color:'#EF4444',fontSize:'11px',margin:'4px 0 0'}}>{nameError}</p>}
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Business Name</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Phone Number (shown on client briefs)</label>
          <input value={phone} onChange={e => { const d=e.target.value.replace(/\D/g,'').slice(0,10); const f=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; setPhone(f); setPhoneError(''); }} placeholder="(512) 555-1234" type="tel"
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${phoneError?'#EF4444':C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          {phoneError && <p style={{color:'#EF4444',fontSize:'11px',margin:'4px 0 0'}}>{phoneError}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={async () => {
              let valid = true;
              if (!fullName.trim() || fullName.trim().length < 2) { setNameError('Name must be at least 2 characters'); valid = false; } else setNameError('');
              if (phone && phone.replace(/\D/g,'').length > 0 && phone.replace(/\D/g,'').length !== 10) { setPhoneError('Enter a valid 10-digit phone number'); valid = false; } else setPhoneError('');
              if (!valid) return;
              setSaving(true);
              try {
                const { supabase } = await import('../lib/supabase');

                // If business name changed, regenerate the booking-link slug
                // (custom_url) to match. Falls back to full_name if business
                // name is empty. Slugify: lowercase, strip non-alphanumeric,
                // truncate to 30. If the resulting slug is taken by another
                // therapist, append -2, -3, etc. until unique.
                const updates = { full_name: fullName, business_name: businessName, phone: phone };
                let newSlug = null;
                const businessOrName = (businessName || fullName).trim();
                if (businessOrName) {
                  const baseSlug = businessOrName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
                  // Only regenerate if the user's CURRENT slug looks auto-generated
                  // from their old name (i.e. doesn't match the new base AND
                  // isn't a custom hand-picked slug they care about).
                  if (baseSlug && baseSlug !== therapist?.custom_url) {
                    let candidate = baseSlug;
                    let attempt = 1;
                    while (attempt < 20) {
                      const { data: clash } = await supabase.from('therapists')
                        .select('id').eq('custom_url', candidate).neq('id', therapist.id).maybeSingle();
                      if (!clash) break;
                      attempt += 1;
                      candidate = baseSlug + '-' + attempt;
                    }
                    newSlug = candidate;
                    updates.custom_url = newSlug;
                  }
                }

                await supabase.from('therapists').update(updates).eq('id', therapist.id);
                if (newSlug) {
                  setNewBookingUrl(`${window.location.origin}/book/${newSlug}`);
                }
                setSaved(true); setTimeout(() => { setSaved(false); setNewBookingUrl(null); }, 6000);
                // Refresh page state so the rest of the dashboard sees the new slug
                if (newSlug) {
                  setTimeout(() => window.location.reload(), 1500);
                }
              } catch(e) { console.error(e); }
              finally { setSaving(false); }
            }}
            style={{ background: C2.sage, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          <div>
            {nameError && <p style={{color:'#EF4444',fontSize:'11px',margin:'0 0 2px'}}>{nameError}</p>}
            <p style={{ fontSize: '12px', color: C2.gray, margin: 0 }}>Email: {therapist?.email}</p>
          </div>
        </div>
        {newBookingUrl && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16A34A', margin: '0 0 4px' }}>Booking link updated</p>
            <p style={{ fontSize: 13, color: C2.darkGray, margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{newBookingUrl}</p>
            <p style={{ fontSize: 11, color: C2.gray, margin: '6px 0 0', lineHeight: 1.4 }}>
              Old links you've shared will stop working. Update your social profiles, business cards, and email signatures with this new link. Reloading dashboard…
            </p>
          </div>
        )}
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Import existing clients', 'Bring your list from CSV. Vagaro, MassageBook, Square', '1.2') && (<>
      <CollapsibleSection
        id="import"
        taxonomy="1.2"
        timeBadge="~2m"
        label="Import existing clients"
        summary="Bring your list from CSV. Vagaro, MassageBook, Square"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v10"/><path d="M8 8l4-4 4 4"/><rect x="4" y="14" width="16" height="6" rx="1"/></svg>}
        isOpen={openRow === 'import'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><UnifiedImport therapist={therapist} onComplete={() => {}} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Booking & intake links', 'Share your booking link or QR codes for clients. Intake is part of the booking flow.', '1.3') && (<>
      <CollapsibleSection
        id="intake_qr"
        taxonomy="1.3"
        timeBadge="~30s"
        label="Booking & intake links"
        summary="Your booking link, intake link, and QR codes"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>}
        isOpen={openRow === 'intake_qr'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        {/* Two clean link rows up top. HK May 14 2026 ask: 'If we say
            Booking and Intake Links, first thing therapist should see
            is booking and intake link with both preview and copy.'
            Booking link first (most-used for client-facing share).
            Intake link second (used for sending to existing clients to
            update intake). Same compact row pattern, no big colored
            card, no redundancy. */}
        <LinkRow
          label="Booking link"
          sublabel="Share with clients to book a session"
          url={bookingUrl}
          C2={C2}
        />
        <div style={{ height: 8 }} />
        <LinkRow
          label="Intake link"
          sublabel="Send to existing clients to update their intake"
          url={intakeUrl}
          C2={C2}
        />

        <div style={{ borderTop: `1px solid ${C2.lightGray}`, margin: '16px 0 14px' }} />

        {/* Customize-intake button. Less visual weight than before
            because the link rows above are the primary affordance. */}
        <button
          onClick={() => navigate('/dashboard/intake/edit')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%',
            background: '#fff',
            border: `1.5px solid ${C2.lightGray}`,
            borderRadius: 10,
            padding: '11px 14px',
            cursor: 'pointer',
            marginBottom: 14,
            transition: 'all 0.15s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C2.sage;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C2.lightGray;
          }}
        >
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C2.darkGray, marginBottom: 2 }}>
              Customize your intake form
            </div>
            <div style={{ fontSize: 11, color: C2.gray, lineHeight: 1.45 }}>
              Hide questions, edit options, add your own. Medical checklist + HIPAA mode.
            </div>
          </div>
          <span style={{ color: C2.forest, fontSize: 14, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>Edit →</span>
        </button>

        <QRCodesCard intakeUrl={intakeUrl} bookingUrl={bookingUrl} businessName={therapist?.business_name || therapist?.full_name} C2={C2} />
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Booking page setup', 'Approve new clients, require intake before booking, embed on your website', '1.4') && (<>
      <CollapsibleSection
        id="bookingflow"
        taxonomy="1.4"
        timeBadge="~3m"
        label="Booking page setup"
        summary={(() => {
          const a = !!therapist?.require_approval;
          const i = !!therapist?.require_intake_before_booking;
          if (a && i) return 'Approval ON · Intake required';
          if (a) return 'Approval required for new clients';
          if (i) return 'Intake required before booking';
          return 'Open booking · both gates off';
        })()}
        status={therapist?.custom_url ? 'done' : 'todo'}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>}
        isOpen={openRow === 'bookingflow'}
        onToggle={toggleRow}
      ><div style={{ padding:'4px 4px' }}>
        <p style={{ fontSize:12, color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>
          Configure how your booking page behaves for new clients. Returning clients always book straight through.
        </p>

        {/* Approval gate. Compact toggle row. */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 0', borderBottom:`1px dashed ${C2.lightGray}` }}>
          <button onClick={async () => {
            const newVal = !therapist?.require_approval;
            await supabase.from('therapists').update({ require_approval: newVal }).eq('id', therapist.id);
            window.location.reload();
          }} style={{ width:40, height:22, borderRadius:11, background:therapist?.require_approval?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, marginTop:2, transition:'background 0.2s' }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:therapist?.require_approval?21:3, transition:'left 0.2s' }} />
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C2.darkGray }}>Approve new clients before they book</div>
            <div style={{ fontSize:12, color:C2.gray, lineHeight:1.5, marginTop:3 }}>New clients submit a request. You see it on your Schedule page with Approve and Decline buttons. Returning clients book directly. If you also require a deposit, the client saves a card at request time and the deposit is charged automatically when you approve.</div>
          </div>
        </div>

        {/* Intake-first gate. Compact toggle row. */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 0', borderBottom:`1px dashed ${C2.lightGray}` }}>
          <button onClick={async () => {
            const newVal = !therapist?.require_intake_before_booking;
            await supabase.from('therapists').update({ require_intake_before_booking: newVal }).eq('id', therapist.id);
            window.location.reload();
          }} style={{ width:40, height:22, borderRadius:11, background:therapist?.require_intake_before_booking?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', flexShrink:0, marginTop:2, transition:'background 0.2s' }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:therapist?.require_intake_before_booking?21:3, transition:'left 0.2s' }} />
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C2.darkGray }}>Require intake form before booking</div>
            <div style={{ fontSize:12, color:C2.gray, lineHeight:1.5, marginTop:3 }}>New clients fill out the body map and waiver before they reach the calendar. Returning clients skip this. Helps you screen for medical concerns and keeps liability waivers signed up front.</div>
            {therapist?.require_approval && therapist?.require_intake_before_booking && (
              <div style={{ fontSize:11, color:'#92400E', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'8px 10px', marginTop:8, lineHeight:1.5 }}>
                Heads up: while Approve new clients is also on, intake is collected from the client after you approve their request, not before. This way the client does not fill out an intake you might decline anyway. The approval email links them straight to the form.
              </div>
            )}
          </div>
        </div>

        {/* Embed-on-your-website panel. Was previously its own section
            (1.4) sibling. Folded in here so all booking-page setup
            lives in one place. */}
        <div style={{ marginTop: 14 }}>
          <BookingEmbedPanel customUrl={therapist?.custom_url} />
        </div>
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Time off', '', '1.5') && (<>
      <CollapsibleSection
        id="timeoff"
        taxonomy="1.5"
        timeBadge="~1m"
        label="Time off"
        summary={blockedDays.length === 0 ? "None scheduled" : `${blockedDays.length} day${blockedDays.length === 1 ? '' : 's'} blocked`}
        status={blockedDays.length > 0 ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M9 4v4M15 4v4"/></svg>}
        isOpen={openRow === 'timeoff'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>Block entire days for vacations, personal days, or events. Clients cannot book on these dates.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
          <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)}
            min={new Date().toISOString().slice(0,10)}
            placeholder="Choose a date"
            style={{ width:'100%', padding:'12px 14px', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, fontSize:15, outline:'none', background:'#fff', color:blockDate?C2.darkGray:C2.gray, boxSizing:'border-box', WebkitAppearance:'none', appearance:'none' }} />
          <input type="text" value={blockNote} onChange={e => setBlockNote(e.target.value)}
            placeholder="Reason (optional)"
            style={{ width:'100%', padding:'12px 14px', border:`1.5px solid ${C2.lightGray}`, borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }} />
          <button onClick={addBlockedDay} disabled={!blockDate || blockSaving}
            style={{ width:'100%', background:blockDate ? C2.forest : '#D1D5DB', color:'#fff', border:'none', padding:'13px 16px', borderRadius:10, fontSize:14, fontWeight:700, cursor:blockDate ? 'pointer' : 'not-allowed' }}>
            {blockSaving ? 'Adding…' : '+ Block This Day'}
          </button>
        </div>
        {blockedDays.length === 0
          ? <div style={{ fontSize:12, color:C2.gray, fontStyle:'italic' }}>No days blocked. Clients can book any available date up to a year out.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {blockedDays.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:C2.beige, borderRadius:8, padding:'10px 12px', gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C2.darkGray }}>
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
                    </div>
                    {d.note && <div style={{ fontSize:12, color:C2.gray, marginTop:2 }}>{d.note}</div>}
                  </div>
                  <button onClick={() => removeBlockedDay(d.id)}
                    style={{ background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:6, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
        }
      </div></CollapsibleSection>
      </>)}
      </SettingsGroup></>)}
      </>)}

      {groupMatches.offer && (<>
      <SettingsSectionHeader
        title="What I offer"
        sub="Your menu. Services, hours, add-ons, packages, memberships, classes, waiver."
        sprigType="leaf"
        isOpen={isSearching || openSections.offer}
        onToggle={() => toggleSection('offer')}
      />

      {(isSearching || openSections.offer) && (<><SettingsGroup>
      {matchesSearch('Services & hours', 'Your menu, weekly hours, deposits, buffer', '2.1') && (<>
      <CollapsibleSection
        id="services"
        taxonomy="2.1"
        timeBadge="~3m"
        label="Services & hours"
        summary="Your menu, weekly hours, deposits, buffer"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 9c2 4 5 4 7 4s5 0 7-4"/><path d="M5 13c2 4 5 4 7 4s5 0 7-4"/><path d="M12 4v3"/></svg>}
        isOpen={openRow === 'services'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ServicesAndAvailability therapist={therapist} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Add-ons', 'Hot stones, aromatherapy, hot towels…', '2.2') && (<>
      <CollapsibleSection
        id="addons"
        taxonomy="2.2"
        timeBadge="~2m"
        label="Add-ons"
        summary="Hot stones, aromatherapy, hot towels…"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="9" cy="9" r="3"/><circle cx="15" cy="15" r="3"/><path d="M9 12v3M15 12V9"/></svg>}
        isOpen={openRow === 'addons'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ServiceAddonsCard therapist={therapist} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Packages', 'Multi-session bundles', '2.3') && (<>
      <CollapsibleSection
        id="packages"
        taxonomy="2.3"
        timeBadge="~3m"
        label="Packages"
        summary="Multi-session bundles"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M4 12h16M12 8v12"/></svg>}
        isOpen={openRow === 'packages'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><PackagesCard therapist={therapist} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Memberships', 'Recurring monthly plans', '2.4') && (<>
      <CollapsibleSection
        id="memberships"
        taxonomy="2.4"
        timeBadge="~3m"
        label="Memberships"
        summary="Recurring monthly plans"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 6v6l4 2"/></svg>}
        isOpen={openRow === 'memberships'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><MembershipsCard therapist={therapist} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Classes & events', 'Workshops, group sessions', '2.5') && (<>
      <CollapsibleSection
        id="events"
        taxonomy="2.5"
        timeBadge="~3m"
        label="Classes & events"
        summary="Workshops, group sessions"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="9" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M4 19c0-2.5 2.2-4.5 5-4.5"/></svg>}
        isOpen={openRow === 'events'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><EventsCard therapist={therapist} /></div></CollapsibleSection>
      </>)}
      {/* Waiver text moved into the consolidated "Client agreements"
          section at 4.3 below. HK May 14 2026: Alison G. asked for a
          single place for client-facing agreements (intake, booking
          policies, cancellation policy, waiver) instead of waiver
          living in its own section away from the others. */}
      </SettingsGroup></>)}
      </>)}

      {groupMatches.restEasier && (<>
      <SettingsSectionHeader
        title="How I rest easier"
        sub="Quiet help working in the background. Platform features, retention nudges, reminders."
        sprigType="leaf"
        isOpen={isSearching || openSections.restEasier}
        onToggle={() => toggleSection('restEasier')}
      />

      {(isSearching || openSections.restEasier) && (<><SettingsGroup>
      {matchesSearch('Platform features', '', '3.1') && (<>
      <CollapsibleSection
        id="ai"
        taxonomy="3.1"
        label="Platform features"
        summary={aiEnabled ? 'On · chat, briefs, patterns' : 'Off · all platform features hidden'}
        status={aiEnabled ? 'done' : 'todo'}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 5c4 4 5 7 5 10a5 5 0 0 1-10 0c0-3 1-6 5-10z"/></svg>}
        isOpen={openRow === 'ai'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#15803D', marginBottom:4 }}>Why this matters</div>
          <p style={{ fontSize:12, color:'#166534', margin:0, lineHeight:1.55 }}>Pre-session briefs save 10 minutes of prep before each appointment. Platform chat answers questions like "who's overdue?" without you scrolling through your client list. Pattern detection flags clients showing the same complaint for the third time. All trained on your own session notes, never shared.</p>
        </div>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>Your data is unchanged either way. Turn off if you prefer a fully manual workflow.</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={toggleAi}
              style={{ width:40, height:22, borderRadius:11, background:aiEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:aiEnabled?21:3, transition:'left 0.2s' }} />
            </button>
            <span style={{ fontSize:13, fontWeight:600, color:aiEnabled?C2.forest:C2.gray }}>{aiEnabled ? 'Platform features ON' : 'Platform features OFF'}</span>
          </div>
        </div>
        {!aiEnabled && (
          <p style={{ fontSize:11, color:C2.gray, margin:'12px 0 0', fontStyle:'italic' }}>The PracticeIQ tab and pre-session brief buttons are hidden. Booking, intake, SOAP notes, billing, reminders, and schedule all stay on.</p>
        )}
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Practice Pulse', '', '3.2') && (<>
      <CollapsibleSection
        id="pulse"
        taxonomy="3.2"
        label="Practice Pulse"
        summary={pulseEnabled ? "Daily 6 PM digest · email" : "Off"}
        status={pulseEnabled ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 5c4 4 5 7 5 10a5 5 0 0 1-10 0c0-3 1-6 5-10z"/></svg>}
        isOpen={openRow === 'pulse'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#15803D', marginBottom:4 }}>Why this matters</div>
          <p style={{ fontSize:12, color:'#166534', margin:0, lineHeight:1.55 }}>Most therapists check their schedule reactively. Practice Pulse turns that into a 60-second evening review. You see who's coming tomorrow (so you can prep), who's been quiet 30+ days (so you can reach out before they're gone), and which sessions need follow-up notes. One email replaces six places you'd otherwise have to look.</p>
        </div>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 16px 0', lineHeight:1.5 }}>A short daily email sent at 6pm, sessions today, who's coming tomorrow, who's overdue, and who just went quiet. Opens in 10 seconds.</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={togglePulse}
              style={{ width:40, height:22, borderRadius:11, background:pulseEnabled?C2.forest:'#D1D5DB', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:pulseEnabled?21:3, transition:'left 0.2s' }} />
            </button>
            <span style={{ fontSize:13, fontWeight:600, color:pulseEnabled?C2.forest:C2.gray }}>{pulseEnabled ? 'Daily Pulse ON, sent at 6pm' : 'Daily Pulse OFF'}</span>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:700, color:C2.gray, display:'block', marginBottom:6 }}>Also send to (optional)</label>
          <div style={{ display:'flex', gap:8 }}>
            <input type="email" value={pulseEmail} onChange={e => setPulseEmail(e.target.value)}
              placeholder="e.g. bodymap01@gmail.com"
              style={{ flex:1, padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none', background:'#fff' }} />
            <button onClick={savePulseEmail}
              style={{ background:C2.sage, color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              {pulseEmailSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p style={{ fontSize:11, color:C2.gray, margin:'6px 0 0' }}>The Pulse always goes to your account email. Add a second address here if you check another inbox more often.</p>
        </div>
        <button onClick={sendTestPulse} disabled={pulseSending}
          style={{ background:pulseSending?C2.sage:C2.beige, color:C2.forest, border:`1.5px solid ${C2.lightGray}`, borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {pulseSending ? 'Sending…' : pulseSent ? '✓ Sent! Check your email' : 'Send me a test Pulse now'}
        </button>
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Push notifications', 'On-device alerts for new bookings', '3.3') && (<>
      <CollapsibleSection
        id="push"
        taxonomy="3.3"
        label="Push notifications"
        summary="On-device alerts for new bookings"
        status="todo"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2V9z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>}
        isOpen={openRow === 'push'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><PushNotificationsCard therapist={therapist} C2={C2} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Notification preferences', 'Email alerts for events', '3.4') && (<>
      <CollapsibleSection
        id="notifs"
        taxonomy="3.4"
        label="Notification preferences"
        summary="Email alerts for events"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 5h14v10H7l-2 4z"/></svg>}
        isOpen={openRow === 'notifs'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><NotificationSettingsTable therapist={therapist} /></div></CollapsibleSection>
      </>)}
      {matchesSearch('Lapsed client threshold', '', '3.5') && (<>
      <CollapsibleSection
        id="lapsed"
        taxonomy="3.5"
        timeBadge="~30s"
        label="Lapsed client threshold"
        summary={`${lapsedDays} days · clients flagged after this`}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 4v8l5 3"/><circle cx="12" cy="12" r="9"/></svg>}
        isOpen={openRow === 'lapsed'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input type="number" min="1" max="365" value={lapsedDays}
            onChange={e => { const v=parseInt(e.target.value); if(!isNaN(v)) setLapsedDays(v); }}
            onBlur={e => { const v=parseInt(e.target.value); const c=Math.max(1,Math.min(365,isNaN(v)?60:v)); setLapsedDays(c); localStorage.setItem('bm_lapsed_days',c); setLapsedSaved(true); setTimeout(()=>setLapsedSaved(false),2000); }}
            style={{ width:'70px', padding:'8px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:'17px', fontWeight:'700', color:C2.forest, background:C2.beige, textAlign:'center' }} />
          <p style={{ fontSize:'13px', color:C2.darkGray, margin:0 }}>days since last session before a client is flagged as lapsed</p>
          {lapsedSaved && <p style={{ fontSize:'12px', color:C2.forest, fontWeight:'600', margin:0 }}>✓ Saved</p>}
        </div>
      </div></CollapsibleSection>
      </>)}
      </SettingsGroup></>)}
      </>)}

      {groupMatches.plugIn && (<>
      <SettingsSectionHeader
        title="How I plug in"
        sub="Connections to the tools and systems you already use."
        sprigType="leaf"
        isOpen={isSearching || openSections.plugIn}
        onToggle={() => toggleSection('plugIn')}
      />

      {(isSearching || openSections.plugIn) && (<><SettingsGroup>
      {matchesSearch('Cal.com sync', '', '4.1') && (<>
      <CollapsibleSection
        id="cal"
        taxonomy="4.1"
        timeBadge="~3m"
        label="Cal.com sync"
        summary={(therapist?.cal_connected || therapist?.cal_api_key) ? "Connected · syncing automatically" : "Optional · two-way calendar"}
        status={(therapist?.cal_connected || therapist?.cal_api_key) ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M8 4v4M16 4v4"/></svg>}
        isOpen={openRow === 'cal'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
          <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>Already using Cal.com for scheduling? Connect it here to sync bookings automatically. If you're using MyBodyMap's built-in booking, you don't need this.</p>
          {(therapist?.cal_connected || therapist?.cal_api_key) ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>✅</span>
                <div>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Cal.com Connected</div>
                  <div style={{ fontSize:'11px', color:'#6B7280' }}>Syncing automatically</div>
                </div>
              </div>
              <button onClick={async () => {
                await supabase.from('therapists').update({ cal_connected:false, cal_access_token:null, cal_refresh_token:null }).eq('id', therapist.id);
                window.location.reload();
              }} style={{ background:'transparent', border:'1px solid #DC2626', color:'#DC2626', borderRadius:6, padding:'4px 10px', fontSize:'11px', fontWeight:'600', cursor:'pointer' }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div style={{ background:C2.beige, borderRadius:10, padding:12 }}>
              <p style={{ fontSize:'11px', color:C2.gray, margin:'0 0 8px 0', lineHeight:1.5 }}>
                <strong>Cal.com users only:</strong> Find your API key at cal.com → Settings → Developer → API Keys
              </p>
              <div style={{ display:'flex', gap:6 }}>
                <input type="password" value={calKey} onChange={e => setCalKey(e.target.value)} placeholder="cal_live_..."
                  style={{ flex:1, padding:'8px 10px', border:'1.5px solid #E8E4DC', borderRadius:8, fontSize:'12px', fontFamily:'monospace', background:'#fff' }} />
                <button onClick={async () => {
                  const { supabase: sb } = await import('../lib/supabase');
                  await sb.from('therapists').update({ cal_api_key: calKey }).eq('id', therapist.id);
                  setCalSaved(true); setTimeout(() => setCalSaved(false), 2000);
                }} style={{ background:C2.sage, color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {calSaved ? '✓' : 'Save'}
                </button>
              </div>
            </div>
          )}
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Google Calendar sync', 'Two-way sync with Google Calendar', '4.1.5') && (<>
      <CollapsibleSection
        id="google-calendar"
        taxonomy="4.1.5"
        timeBadge="~2m"
        label="Google Calendar sync"
        summary={therapist?.google_calendar_connected
          ? `Connected · ${therapist.google_email || 'syncing automatically'}`
          : 'Two-way sync · bookings + personal events'}
        status={therapist?.google_calendar_connected ? 'done' : 'todo'}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M8 4v4M16 4v4M9 14l2 2 4-4"/></svg>}
        isOpen={openRow === 'google-calendar'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        {googleBanner && (
          <div style={{
            background: googleBanner.kind === 'success' ? '#F0FDF4' : '#FBEAEA',
            border: `1px solid ${googleBanner.kind === 'success' ? '#86EFAC' : '#F1A4A4'}`,
            color: googleBanner.kind === 'success' ? '#15803D' : '#9B2C2C',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            {googleBanner.text}
          </div>
        )}

        <p style={{ fontSize: 12, color: C2.gray, margin: '0 0 12px', lineHeight: 1.5 }}>
          Bookings made on MyBodyMap appear in your Google Calendar within seconds.
          Personal events you add to Google Calendar (lunch, dentist, kid pickup) block
          MyBodyMap booking slots so clients cannot double-book you.
        </p>
        <div style={{
          background: '#FBF4ED', border: '1px solid #E5D5C8',
          borderRadius: 8, padding: '8px 10px', marginBottom: 14,
          fontSize: 11, color: '#A87468', lineHeight: 1.5,
        }}>
          ⏱ New events you add directly in Google Calendar take up to 15 minutes
          to start blocking your booking slots. Bookings made on MyBodyMap appear
          in Google instantly.
        </div>

        {therapist?.google_calendar_connected ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#F0FDF4', border: '1.5px solid #86EFAC',
              borderRadius: 10, padding: '10px 14px', marginBottom: 12,
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>
                  Connected
                </div>
                <div style={{ fontSize: 11, color: '#166534' }}>
                  {therapist.google_email || 'Google account connected'}
                  {therapist.google_last_synced_at && (
                    <span> · last synced {new Date(therapist.google_last_synced_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={syncGoogleNow} disabled={googleConnecting}
                style={{
                  background: C2.sage, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: googleConnecting ? 0.6 : 1,
                }}>
                {googleConnecting ? 'Syncing...' : 'Sync now'}
              </button>
              <button onClick={disconnectGoogleCalendar}
                style={{
                  background: 'transparent', color: '#DC2626',
                  border: '1px solid #DC2626', borderRadius: 8,
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                Disconnect
              </button>
            </div>

            {externalEvents.length > 0 && (
              <div style={{
                background: C2.white, border: `1px solid ${C2.lightGray}`,
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: C2.gray,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: 8,
                }}>
                  Personal events blocking your slots ({externalEvents.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {externalEvents.slice(0, 8).map(ev => (
                    <div key={ev.id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, padding: '6px 0',
                      borderBottom: `1px dashed ${C2.lightGray}`,
                    }}>
                      <span style={{ fontWeight: 600, color: C2.darkGray }}>{ev.summary || '(no title)'}</span>
                      <span style={{ color: C2.gray, fontSize: 11 }}>
                        {new Date(ev.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' · '}
                        {ev.is_all_day
                          ? 'all day'
                          : new Date(ev.start_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
                {externalEvents.length > 8 && (
                  <div style={{ fontSize: 11, color: C2.gray, marginTop: 8, textAlign: 'center' }}>
                    + {externalEvents.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button onClick={connectGoogleCalendar} disabled={googleConnecting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', background: '#fff', color: '#3D4A42',
              border: '1.5px solid #E5D5C8', borderRadius: 10,
              padding: '12px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              opacity: googleConnecting ? 0.6 : 1,
            }}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleConnecting ? 'Redirecting to Google...' : 'Connect Google Calendar'}
          </button>
        )}
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Payments', '', '4.2') && (<>
        <CollapsibleSection
          id="payments"
          taxonomy="4.2"
          timeBadge="~5m"
          label="Payments"
          summary={
            therapist?.stripe_account_connected && therapist?.square_connected
              ? "Stripe + Square connected · use Payment routing to assign features"
              : therapist?.stripe_account_connected
              ? "Stripe connected · all online features active"
              : therapist?.square_connected
              ? "Square connected · most features active, memberships use manual monthly renewal"
              : "Connect Stripe or Square to take online payments"
          }
          status={(therapist?.stripe_account_connected || therapist?.square_connected) ? "done" : "attn"}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h3"/></svg>}
          isOpen={openRow === 'payments'}
          onToggle={toggleRow}
        ><div style={{ padding: '4px 4px' }}>

          {/* Both processors support the full online feature set:
              deposits, packages, memberships, card-on-file, cancellation
              charging, refunds. Therapists pick whichever they already
              use, or connect both and use Payment routing (4.2.1) to
              decide which one handles each feature. The capability
              matrix surfaces a few honest tradeoffs (see the 'Things
              to know about Square' ribbon at the bottom of this section)
              without pushing therapists in either direction. */}
          <div style={{
            background: '#F8FAF7',
            border: '1px solid #D1E5D9',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
            fontSize: 11,
            lineHeight: 1.6,
            color: '#1F3A2C',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>💳</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#2A5741' }}>Stripe</strong> · deposits at booking, cards on file, packages, memberships, one-tap refunds. Fees: 2.9% + 30¢ per online card transaction (paid to Stripe directly).
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>⬛</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#2A5741' }}>Square</strong> · deposits, packages, cards on file, memberships (one-tap monthly Charge for renewals). Fees: 2.9% + 30¢ for online, 2.6% + 10¢ for in-person Square Reader (paid to Square directly). For fully automatic membership auto-renew, connect Stripe instead.
              </div>
            </div>
            <div style={{ marginTop: 8, color: '#6B7280', borderTop: '1px solid #D1E5D9', paddingTop: 8, fontSize: 10, lineHeight: 1.55 }}>
              MyBodyMap is the connection layer. Your money settles directly between your client and your Stripe or Square account. We never hold funds, set rates, or change processor terms. Disputes, chargebacks, and tax reporting are between you and the processor you connect.
            </div>
            <div style={{ marginTop: 6, color: '#6B7280', fontSize: 10, lineHeight: 1.55 }}>
              Most therapists connect both. You can connect either one alone, or skip and accept payment outside MyBodyMap.
            </div>
          </div>

          {/* Stripe panel - primary CTA.
              Three states, decided by (stripe_account_id, stripe_account_connected):
                (set, true)   = fully connected; show green panel + disconnect
                (set, false)  = onboarding in progress; show Resume Stripe setup
                                so the existing account is reused. Tapping
                                the purple Connect Stripe in this state used
                                to create a brand new Express account, leaving
                                the half-finished one orphaned. HK May 15 2026.
                (null, false) = brand new; show purple Connect Stripe */}
          {therapist?.stripe_account_connected ? (
            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span>✅</span>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Stripe · Connected</div>
                    <div style={{ fontSize:'11px', color:'#6B7280' }}>Deposits, packages, memberships, cards on file all enabled</div>
                  </div>
                </div>
                <a
                  href="https://dashboard.stripe.com/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ background:'transparent', border:'1px solid #BBF7D0', color:'#065F46', borderRadius:8, padding:'5px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', textDecoration:'none', whiteSpace:'nowrap' }}
                  title="Open your Stripe dashboard in a new tab"
                >
                  Manage in Stripe →
                </a>
              </div>
              <div style={{ marginTop:8, fontSize:10.5, color:'#6B7280', lineHeight:1.55 }}>
                To change your payout bank or update business info, manage your account directly in Stripe. To switch to a different Stripe account, contact us at hello@mybodymap.app.
              </div>
            </div>
          ) : therapist?.stripe_account_id ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ background:'#FFF8E7', border:'1.5px solid #F3D88E', borderRadius:10, padding:'12px 14px', marginBottom: 10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>🔄</span>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#78350F' }}>Stripe setup not finished</div>
                </div>
                <div style={{ fontSize:'11px', color:'#92400E', lineHeight: 1.55 }}>
                  You started connecting Stripe but a few items still need to be completed in their hosted onboarding. Resume below to finish where you left off. Stripe saves your progress.
                </div>
              </div>
              <button onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/stripe-connect', {
                  method:'POST',
                  headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token}` },
                  body: JSON.stringify({ action:'resume_onboarding', therapist_id: therapist.id }),
                });
                const data = await res.json();
                if (data.url) {
                  // Same-tab redirect so the hosted flow can take over.
                  window.location.href = data.url;
                } else {
                  alert('Could not resume Stripe setup. ' + (data.error || 'Please try again.'));
                }
              }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#635BFF', color:'#fff', border:'none', borderRadius:10, padding:'14px 16px', fontSize:'13px', fontWeight:'700', cursor:'pointer', width:'100%', boxShadow: '0 2px 8px rgba(99, 91, 255, 0.25)' }}>
                Resume Stripe setup →
              </button>
              <button onClick={async () => {
                // Escape hatch: cancel this in-progress account and
                // start over with a fresh one. Clears stripe_account_id
                // so the next 'Connect Stripe' creates a brand new
                // Express account.
                await updateProfile({ stripe_account_id: null, stripe_account_connected: false });
              }} style={{ marginTop: 8, background:'transparent', border:'none', color:'#6B7280', fontSize:'11px', fontWeight:'600', cursor:'pointer', textDecoration:'underline', padding:'4px 0', width:'100%' }}>
                Start over with a fresh Stripe account
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              {/* PRIMARY: Standard Connect.
                  For therapists who already have a Stripe account,
                  this is a 15-second OAuth click-through that links
                  the existing account. Preserves transaction history,
                  saved customer cards, subscriptions, 1099 reporting,
                  everything. This is the path comparable SaaS use
                  (MassageBook, Vagaro, Jane App, Calendly). */}
              <button onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/stripe-connect', {
                  method:'POST',
                  headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token}` },
                  body: JSON.stringify({ action:'get_standard_oauth_url', therapist_id: therapist.id }),
                });
                const data = await res.json();
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  alert('Could not start Stripe link. ' + (data.error || JSON.stringify(data)));
                }
              }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#635BFF', color:'#fff', border:'none', borderRadius:10, padding:'14px 16px', fontSize:'13px', fontWeight:'700', cursor:'pointer', width:'100%', boxShadow: '0 2px 8px rgba(99, 91, 255, 0.25)' }}>
                💳 Link your Stripe account · Recommended
              </button>
              <p style={{ fontSize: 11, color: '#374151', textAlign: 'center', margin: '8px 0 14px', lineHeight: 1.55 }}>
                <strong style={{ color:'#1F3A2C' }}>Already use Stripe?</strong> 15-second link. Keeps your existing transactions, saved cards, and tax forms intact.
              </p>

              {/* OR divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
              </div>

              {/* SECONDARY: Express fallback. Visible from the start
                  (not hidden behind a disclosure) because two cases
                  hit this path: (a) new to Stripe entirely, (b) had
                  a Stripe account created by another platform that
                  does not appear in OAuth picker. The disclosure
                  hid case (b) and caused user confusion. */}
              <button onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/stripe-connect', {
                  method:'POST',
                  headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token}` },
                  body: JSON.stringify({ action:'get_oauth_url', therapist_id: therapist.id }),
                });
                const data = await res.json();
                if (data.reused_existing) {
                  window.location.reload();
                  return;
                }
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  alert('Error: ' + JSON.stringify(data));
                }
              }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#fff', color:'#1F3A2C', border:'1.5px solid #C7CDD6', borderRadius:10, padding:'12px 16px', fontSize:'13px', fontWeight:'700', cursor:'pointer', width:'100%' }}>
                Set up a new Stripe account
              </button>
              <p style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', margin: '8px 0 0', lineHeight: 1.55 }}>
                Pick this if you are new to Stripe, OR if your existing Stripe account was set up by another booking platform and you do not see it in the screen above. Five-minute setup.
              </p>
            </div>
          )}

          {/* Square — reframed as in-person companion */}
          {therapist?.square_connected ? (
            <div>
              <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span>✅</span>
                    <div>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:'#2A5741' }}>Square · Connected</div>
                      <div style={{ fontSize:'11px', color:'#6B7280' }}>Deposits, packages, cards on file, and memberships all enabled. Membership renewals after the first month appear as a one-tap Charge action on your Billing dashboard.</div>
                    </div>
                  </div>
                  {squareDisconnectConfirm ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#6B7280', marginRight: 4 }}>Disconnect?</span>
                      <button
                        onClick={async () => {
                          setSquareDisconnectConfirm(false);
                          await updateProfile({
                            square_access_token: null,
                            square_merchant_id: null,
                            square_location_id: null,
                            square_connected: false,
                          });
                        }}
                        style={{
                          background: '#EF4444',
                          border: '1px solid #EF4444',
                          color: '#fff',
                          borderRadius: 8,
                          padding: '5px 12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Yes, disconnect
                      </button>
                      <button
                        onClick={() => setSquareDisconnectConfirm(false)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #C7CDD6',
                          color: '#6B7280',
                          borderRadius: 8,
                          padding: '5px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSquareDisconnectConfirm(true)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #EF4444',
                        color: '#EF4444',
                        borderRadius: 8,
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Health indicator: warns if Square is connected but the
                  location_id is missing. This can happen for therapists
                  who connected before May 2026 when the OAuth callback
                  started persisting the location. The 'Repair' button
                  calls the square-repair-location edge function which
                  fetches the location from Square and writes it back.
                  After this commit, every Square-using edge function
                  also self-heals on first call, so this is a backup
                  affordance for therapists who want to verify the
                  connection is healthy without having to test a
                  payment to find out. */}
              {!therapist?.square_location_id && (
                <div style={{ background:'#FFFBEB', border:'1.5px solid #F59E0B', borderRadius:10, padding:'12px 14px', marginTop:8 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <span style={{ fontSize:16 }}>⚠️</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:'#92400E' }}>Square location missing</div>
                      <div style={{ fontSize:'11px', color:'#78350F', marginTop:2, lineHeight:1.5 }}>
                        Your Square account is connected but the location ID is not stored. Deposits and package purchases will fail. Tap Repair to fetch it from Square.
                      </div>
                      <button onClick={async () => {
                        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
                        const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-repair-location', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
                          body: JSON.stringify({ therapist_id: therapist.id }),
                        });
                        const data = await res.json();
                        if (data?.ok) {
                          alert(`Square location set: ${data.location_name || data.location_id}`);
                          window.location.reload();
                        } else {
                          alert('Repair failed: ' + (data?.error || JSON.stringify(data)));
                        }
                      }} style={{
                        marginTop: 8,
                        background: '#F59E0B', color: '#fff',
                        border: 'none', borderRadius: 8,
                        padding: '6px 14px', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer',
                      }}>Repair connection</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (<>
            <button onClick={async () => {
              const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
              const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-oauth', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${anonKey}`, 'apikey': anonKey },
                body: JSON.stringify({ therapist_id: therapist.id }),
              });
              const data = await res.json();
              if (data.url) {
                const popup = window.open(data.url, 'square-oauth', 'width=600,height=700');
                window.addEventListener('message', async (e) => {
                  if (e.data?.type === 'square-oauth-success') {
                    popup?.close();
                    const { data: t } = await supabase.from('therapists').select('*').eq('id', therapist.id).single();
                    if (t) await updateProfile(t);
                    window.location.reload();
                  }
                }, { once: true });
              } else setSquareConnectError(data?.error ? String(data.error) : 'Could not start Square connection. Please try again.');
            }} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#fff', color:'#000', border:'1.5px solid #000', borderRadius:10, padding:'12px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', width:'100%' }}>
              ⬛ Connect Square
            </button>
            {squareConnectError && (
              <div style={{
                marginTop: 8,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11.5,
                color: '#991B1B',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                <span style={{ flex: 1 }}>{squareConnectError}</span>
                <button
                  onClick={() => setSquareConnectError(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#991B1B',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
            <p style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', margin: '6px 0 0', lineHeight: 1.5 }}>
              Square handles deposits, packages, cards on file, and memberships with one-tap monthly renewals. For fully automatic recurring billing, connect Stripe. Pick whichever you already use, or connect both.
            </p>
          </>)}

          {/* Square activation + capability ribbon. Collapsed by default
              so the section does not feel voluminous. Only renders when
              relevant — when a therapist is on Square (or considering it).
              Three things from the capability matrix, presented honestly.
              When everything is triple-checked over the next week, this
              content can be promoted to marketing surfaces. For now it
              lives quietly in Settings. */}
          {(therapist?.square_connected || therapist?.stripe_account_connected) && (
            <details style={{
              marginTop: 16,
              background: '#FFFBEB',
              border: '1px solid #FCD34D',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <summary style={{
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: '#78350F',
                letterSpacing: 0.3,
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                userSelect: 'none',
              }}>
                <span style={{ fontSize: 14 }}>⚡</span>
                <span>Things to know about Square</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#92400E', fontWeight: 600 }}>tap to expand</span>
              </summary>
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px dashed #FCD34D',
                fontSize: 12,
                color: '#1F2937',
                lineHeight: 1.6,
              }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#78350F', marginBottom: 4 }}>
                    1. Square requires merchant activation before real charges
                  </div>
                  <div>
                    Square asks every merchant to complete{' '}
                    <a href="https://squareup.com/activate" target="_blank" rel="noopener noreferrer"
                       style={{ color: '#2A5741', fontWeight: 600 }}>squareup.com/activate</a>
                    {' '}(identity + bank verification) before they will process card payments.
                    Most therapists already did this when first setting up Square. If not, it takes
                    about ten minutes. The booking flow on MyBodyMap will work either way; only
                    the actual card charge is gated until activation completes.
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#78350F', marginBottom: 4 }}>
                    2. Recurring memberships need a manual nudge to renew
                  </div>
                  <div>
                    First month works fully. After that, Square's recurring billing requires you to
                    confirm each renewal manually from your dashboard (Stripe auto-renews silently).
                    For therapists who plan to sell memberships heavily, Stripe is the smoother
                    choice. For occasional memberships, Square is fine.
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: '#78350F', marginBottom: 4 }}>
                    3. Square's card form is slightly less browser-friendly
                  </div>
                  <div>
                    About 5% of clients on older Safari or some embedded browsers may need to switch
                    browsers to save a card on file. Stripe's card form supports a wider range. If
                    you have clients on older devices and you take card-on-file at booking,
                    connecting Stripe alongside Square covers both worlds.
                  </div>
                </div>
              </div>
            </details>
          )}
        </div></CollapsibleSection>
      </>)}
      {matchesSearch('Payment routing', 'Choose which processor handles deposits, card-on-file, packages, memberships', '4.2.1') && (<>
      <CollapsibleSection
        id="payment-routing"
        taxonomy="4.2.1"
        timeBadge="~2m"
        label="Payment routing"
        summary={
          (therapist?.stripe_account_id && therapist?.square_access_token)
            ? "Choose which processor handles each feature"
            : "Available when both Stripe and Square are connected"
        }
        status={(therapist?.stripe_account_id && therapist?.square_access_token) ? "todo" : "off"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 12h6m6 0h6M9 6l-6 6 6 6m6-12l6 6-6 6"/></svg>}
        isOpen={openRow === 'payment-routing'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <PaymentRouting therapist={therapist} onSaved={() => updateProfile({ ...therapist })} />
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Client agreements', 'Intake form, booking policies, cancellation policy, liability waiver, practice rules clients see before booking, charge for late cancels reschedules no-shows', '4.3') && (<>
      <CollapsibleSection
        id="cancellation"
        taxonomy="4.3"
        timeBadge="~10m"
        label="Client agreements"
        summary={(() => {
          const hasAgreement = !!therapist?.practice_agreement_text;
          const cancelOn = !!therapist?.cancellation_policy_enabled;
          if (hasAgreement && cancelOn) return "Client agreement set · cancellation fee on";
          if (hasAgreement && !cancelOn) return "Client agreement set · no cancellation fee";
          if (!hasAgreement) return "Set up your client agreement and policies";
          return "Set up your client agreement and policies";
        })()}
        status={(therapist?.practice_agreement_text || therapist?.cancellation_policy_enabled) ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M12 2v10l4 4"/><circle cx="12" cy="12" r="10"/></svg>}
        isOpen={openRow === 'cancellation'}
        onToggle={toggleRow}
      >
        {/* Two sibling policy editors inside 4.3, each individually
            collapsible. Same visual chrome on both rows (chevron +
            label + on/off pill). Click anywhere on the header bar to
            expand or collapse. Both start collapsed so opening 4.3
            shows two clean rows the therapist can choose from rather
            than a wall of two stacked editors. */}
        {(() => {
          const PolicySubRow = ({ id, title, blurb, on, children }) => {
            const isOpen = openPolicySubs.has(id);
            return (
              <div id={id} style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 10,
              }}>
                <button
                  onClick={() => togglePolicySub(id)}
                  style={{
                    width: '100%',
                    background: isOpen ? '#FAF6EE' : '#fff',
                    border: 'none',
                    borderBottom: isOpen ? '1px solid #E5E7EB' : 'none',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    width: 14, height: 14, flexShrink: 0,
                    color: '#6B7280',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.18s',
                  }}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 3 11 8 5 13" />
                    </svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', lineHeight: 1.3 }}>
                      {title}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2, lineHeight: 1.4 }}>
                      {blurb}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: on ? '#DCFCE7' : '#F3F4F6',
                    color: on ? '#166534' : '#6B7280',
                    border: `1px solid ${on ? '#86EFAC' : '#E5E7EB'}`,
                    flexShrink: 0,
                  }}>
                    {on ? 'On' : 'Off'}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '12px 14px 14px' }}>
                    {children}
                  </div>
                )}
              </div>
            );
          };
          return (
            <>
              {/* Intake form link (separate from the practice agreement
                  because intake is data collection, agreement is consent). */}
              <div style={{
                background: '#fff',
                borderRadius: 12,
                border: '1.5px solid #E5E7EB',
                padding: '12px 14px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
                onClick={() => { window.location.href = '/dashboard/intake/edit'; }}
              >
                <span style={{
                  display:'inline-block', width:14, height:14, flexShrink:0,
                  color:'#6B7280',
                }}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 3 11 8 5 13" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', lineHeight: 1.3 }}>
                    Intake form
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2, lineHeight: 1.4 }}>
                    Health history, focus areas, preferences. Customize the questions per practice.
                  </div>
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, color: '#2A5741',
                  flexShrink: 0,
                }}>
                  Edit →
                </span>
              </div>

              {/* How signing works: short explainer so therapists
                  understand the agreement is signed at intake AND
                  can be sent separately for re-signature. */}
              <div style={{
                background: '#FAF6EE',
                border: '1px solid #E5DCC4',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 10,
                fontSize: 12,
                color: '#5A4A2A',
                lineHeight: 1.55,
              }}>
                <strong style={{ color: '#3D2F18' }}>How signing works:</strong> new clients sign the agreement automatically when they complete intake before their first session. For existing clients, or when you update your agreement, tap <strong>Send for signature</strong> inside the agreement editor below to send a private signing link.
              </div>

              {/* Client Agreement: ONE document for all policies +
                  guidelines + consent + waiver. Client e-signs once. */}
              <PolicySubRow
                id="client_agreement"
                title="Client agreement"
                blurb="One document, policies + guidelines + consent + waiver. Client signs once at intake."
                on={!!therapist?.practice_agreement_text}
              >
                <PracticeAgreement therapist={therapist} />
              </PolicySubRow>

              {/* Cancellation fee: drives the auto-charge logic, separate
                  from the agreement text. The text of the cancellation
                  policy lives inside the practice agreement (and is shown
                  to clients there). The FEE amount + auto-charge toggle
                  live here because that's what triggers billing. Also
                  re-acknowledged at booking time as a hard gate. */}
              <PolicySubRow
                id="cancellation-policy"
                title="Cancellation fee + auto-charge"
                blurb="What you charge for late cancels and no-shows. Re-acknowledged at every booking."
                on={!!therapist?.cancellation_policy_enabled}
              >
                <CancellationPolicy therapist={therapist} />
              </PolicySubRow>
            </>
          );
        })()}
      </CollapsibleSection>
      </>)}
      {matchesSearch('Custom SMS sender (Twilio)', '', '4.4') && (<>
      <CollapsibleSection
        id="twilio"
        taxonomy="4.4"
        timeBadge="~10m"
        label="Custom SMS sender (Twilio)"
        summary={therapist?.twilio_phone_number ? `Connected · ${therapist.twilio_phone_number}` : "Optional · advanced"}
        status={therapist?.twilio_phone_number ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 5h14v11H10l-3 3v-3H5z"/></svg>}
        isOpen={openRow === 'twilio'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:'12px', color:C2.gray, margin:'0 0 6px 0', lineHeight:1.5 }}>Send text messages to lapsed or due clients from a dedicated practice number. Your clients see a local number, not your personal phone.</p>
        <div style={{ background:C2.beige, borderRadius:8, padding:'10px 12px', marginBottom:14, fontSize:12, color:C2.gray, lineHeight:1.6 }}>
          <strong>Setup takes about 10 minutes:</strong><br/>
          1. Go to <a href="https://twilio.com" target="_blank" rel="noreferrer" style={{ color:C2.forest }}>twilio.com</a> → create a free account ($15 trial credit included)<br/>
          2. Get a phone number, pick your local area code<br/>
          3. Go to Console → Account Info → copy your Account SID, Auth Token, and phone number<br/>
          4. Paste them below and save
        </div>
        {therapist?.twilio_phone_number ? (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#2A5741' }}>✅ SMS Connected</div>
              <div style={{ fontSize:11, color:C2.gray }}>Sending from {therapist.twilio_phone_number}</div>
            </div>
            <button onClick={async () => {
              await supabase.from('therapists').update({ twilio_account_sid:null, twilio_auth_token:null, twilio_phone_number:null }).eq('id', therapist.id);
              window.location.reload();
            }} style={{ background:'transparent', border:'1px solid #DC2626', color:'#DC2626', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input type="text" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} placeholder="Account SID (ACxxxxxxxxxxxxxxx)"
              style={{ padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:12, fontFamily:'monospace', outline:'none' }} />
            <input type="password" value={twilioToken} onChange={e => setTwilioToken(e.target.value)} placeholder="Auth Token"
              style={{ padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:12, fontFamily:'monospace', outline:'none' }} />
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input type="text" value={twilioPhone} onChange={e => setTwilioPhone(e.target.value)} placeholder="+15551234567"
                style={{ flex:1, minWidth:120, padding:'8px 10px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:12, fontFamily:'monospace', outline:'none' }} />
              <button onClick={async () => {
                if (!twilioSid || !twilioToken || !twilioPhone) return;
                await supabase.from('therapists').update({ twilio_account_sid: twilioSid, twilio_auth_token: twilioToken, twilio_phone_number: twilioPhone }).eq('id', therapist.id);
                setTwilioSaved(true); setTimeout(() => { setTwilioSaved(false); window.location.reload(); }, 1500);
              }} style={{ background:C2.sage, color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                {twilioSaved ? '✓ Saved!' : 'Save & Connect'}
              </button>
            </div>
          </div>
        )}
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Referrals', '', '4.5') && (<>
      <CollapsibleSection
        id="referral"
        taxonomy="4.5"
        label="Referrals"
        summary={therapist?.referral_code ? `Code ${therapist.referral_code}` : "Earn from word-of-mouth"}
        status={therapist?.referral_code ? "done" : "todo"}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 8l3 8M16 8l-3 8"/></svg>}
        isOpen={openRow === 'referral'}
        onToggle={toggleRow}
      ><div className="bm-section-bare"><ReferralCard therapist={therapist} C2={C2} /></div></CollapsibleSection>
      </>)}
      </SettingsGroup></>)}
      </>)}

      {groupMatches.membership && (<>
      <SettingsSectionHeader
        title="My membership"
        sub="Your password and your plan with us."
        sprigType="sun"
        isOpen={isSearching || openSections.membership}
        onToggle={() => toggleSection('membership')}
      />

      {(isSearching || openSections.membership) && (<><SettingsGroup>
      {matchesSearch('Your plan', '', '5.1') && (<>
      <CollapsibleSection
        id="plan"
        taxonomy="5.1"
        label="Your plan"
        summary={(!therapist?.plan || therapist?.plan === 'free' || therapist?.plan === 'bronze') ? 'Bronze · Free' : therapist?.plan === 'silver' ? 'Silver · $19/mo' : therapist?.plan === 'gold' ? 'Gold · $49/mo' : 'Bronze · Free'}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h3"/></svg>}
        isOpen={openRow === 'plan'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '18px', fontWeight: '700', color: C2.darkGray, margin: '0 0 4px 0' }}>
              {(!therapist?.plan || therapist?.plan === 'free' || therapist?.plan === 'bronze') ? 'Bronze - Free' : therapist?.plan === 'silver' ? 'Silver - $19/mo' : therapist?.plan === 'gold' ? 'Gold - $49/mo' : 'Bronze - Free'}
            </p>
            <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 4px 0' }}>
              {(!therapist?.plan || therapist?.plan === 'free' || therapist?.plan === 'bronze') ? 'All tools included free. Upgrade to unlock unlimited.' : therapist?.plan === 'silver' ? 'Unlimited clients + full session history.' : therapist?.plan === 'gold' ? 'All features including Platform insights.' : 'All tools included free. Upgrade to unlock unlimited.'}
            </p>
            {therapist?.plan !== 'free' && (
              <p style={{ fontSize: '12px', color: C2.gray, margin: 0, opacity: 0.7 }}>Cancel anytime. Access continues until end of billing period.</p>
            )}
          </div>
        </div>
      </div></CollapsibleSection>
      </>)}
      {matchesSearch('Change password', 'Set a new password', '5.2') && (<>
      <CollapsibleSection
        id="password"
        taxonomy="5.2"
        timeBadge="~1m"
        label="Change password"
        summary="Set a new password"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>}
        isOpen={openRow === 'password'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:360 }}>
          <input
            type="password" value={pwNew} onChange={e => setPwNew(e.target.value)}
            placeholder="New password (min 8 characters)"
            style={{ padding:'9px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none' }}
          />
          <input
            type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
            placeholder="Confirm new password"
            style={{ padding:'9px 12px', border:`1.5px solid ${C2.lightGray}`, borderRadius:8, fontSize:14, outline:'none' }}
          />
          <button onClick={changePassword} disabled={pwSaving}
            style={{ background:C2.forest, color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', alignSelf:'flex-start', opacity:pwSaving?0.6:1 }}>
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
          {pwMsg && (
            <div style={{ fontSize:13, fontWeight:600, color: pwMsg.type==='ok' ? '#16A34A' : '#DC2626', marginTop:4 }}>
              {pwMsg.type==='ok' ? '✓ ' : '⚠ '}{pwMsg.text}
            </div>
          )}
        </div>
      </div></CollapsibleSection>
      </>)}

      {matchesSearch('Your data', 'Download all your client records, sessions, services, settings as a ZIP file', '5.3') && (<>
      <CollapsibleSection
        id="dataexport"
        taxonomy="5.3"
        timeBadge="~1m"
        label="Your data"
        summary={lastExportAt
          ? `Last export: ${new Date(lastExportAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : 'Download everything as a ZIP, anytime'}
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
        isOpen={openRow === 'dataexport'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize:13, color:C2.gray, margin:'0 0 14px 0', lineHeight:1.5 }}>
          Your data is yours. Download a complete copy anytime as a ZIP file. Includes all your clients, bookings, sessions, services, intake answers, SOAP notes, memberships, gift certificates, and account settings.
        </p>
        <div style={{
          background: '#F9FAFB',
          border: `1px solid ${C2.lightGray}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 14,
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:C2.darkGray, marginBottom:8, letterSpacing:'0.04em', textTransform:'uppercase' }}>What is in the ZIP</div>
          <ul style={{ margin:0, padding:'0 0 0 18px', fontSize:13, color:C2.gray, lineHeight:1.7 }}>
            <li>Every client (name, email, phone, notes, tags, lifetime spend)</li>
            <li>Every booking ever (date, service, status, deposit info)</li>
            <li>Sessions with intake answers (focus, pressure, music, medical flags)</li>
            <li>SOAP notes in a separate file you can secure independently</li>
            <li>Payment records per session</li>
            <li>Your service menu, add-ons, weekly hours</li>
            <li>Memberships, packages, and active client subscriptions</li>
            <li>Gift certificates outstanding</li>
            <li>Signed waiver records (metadata, no signature images)</li>
            <li>Your account settings and intake form schema</li>
          </ul>
        </div>
        {/* Button state machine:
              idle      -> 'Download all my data' (forest, enabled)
              building  -> 'Preparing your export...' (gray, locked,
                           spinner, no click possible)
              ready     -> 'Export sent to your email' (sage, locked
                           for 60s with checkmark, then auto-resets)
              failed    -> 'Try again' (forest, enabled, retry path)
        */}
        <button
          onClick={requestDataExport}
          disabled={exportStatus === 'building' || exportStatus === 'ready'}
          style={{
            background: exportStatus === 'building'
              ? '#9CA3AF'
              : exportStatus === 'ready'
                ? '#16A34A'
                : C2.forest,
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 700,
            cursor: (exportStatus === 'building' || exportStatus === 'ready') ? 'not-allowed' : 'pointer',
            opacity: exportStatus === 'building' ? 0.85 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          {exportStatus === 'building' && (
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none"/>
              <path d="M7 2 A5 5 0 0 1 12 7" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          )}
          {exportStatus === 'ready' && (
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 7 L6 10 L11 4" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {exportStatus === 'building' && 'Preparing your export...'}
          {exportStatus === 'ready' && 'Export sent to your email'}
          {exportStatus === 'failed' && 'Try again'}
          {exportStatus === 'idle' && 'Download all my data'}
        </button>
        {exportMessage && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            background: exportStatus === 'failed'
              ? '#FEF2F2'
              : exportStatus === 'ready'
                ? '#F0FDF4'
                : '#FFF8E7',
            border: `1px solid ${
              exportStatus === 'failed'
                ? '#FCA5A5'
                : exportStatus === 'ready'
                  ? '#86EFAC'
                  : '#F3D88E'
            }`,
            color: exportStatus === 'failed'
              ? '#991B1B'
              : exportStatus === 'ready'
                ? '#15803D'
                : '#854F0B',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            {exportMessage}
          </div>
        )}
        <p style={{ fontSize:11.5, color:C2.gray, marginTop:14, lineHeight:1.5, fontStyle:'italic' }}>
          Exports usually take less than a minute. We will email you a secure download link when ready. The link is good for 7 days. You can request a fresh export anytime.
        </p>
      </div></CollapsibleSection>
      </>)}

      </SettingsGroup></>)}
      </>)}

      {/* Empty state when search returns nothing across all groups. */}
      {isSearching && !groupMatches.anyMatch && (
        <div style={{
          background:'#fff',
          border:'0.5px solid rgba(31,58,44,0.07)',
          borderRadius:14,
          padding:'40px 24px',
          textAlign:'center',
          marginTop:8,
        }}>
          <div style={{ fontSize:34, marginBottom:10, opacity:0.5 }}>🔍</div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:600, color:'#1F3A2C', marginBottom:6 }}>
            No settings match "{settingsQuery.trim()}"
          </div>
          <div style={{ fontSize:13, color:'#6F7B6C', maxWidth:340, margin:'0 auto', lineHeight:1.5 }}>
            Try a different word, or tap the × to see everything again. Common terms work too: billing, schedule, payments, time off, intake.
          </div>
        </div>
      )}
    </div>
  );
}


// LocationEditCard (HK May 18 2026): inline form for adding or editing
// a therapist location. Used by the Locations DisclosureRow in the
// main Dashboard function. Structured address fields (street1, street2,
// city, state, postal_code) plus name and optional notes. Saving is
// the parent's responsibility; this component only edits the draft.
function LocationEditCard({ draft, setDraft, onSave, onCancel, saving, error, isEdit, C2 }) {
  const set = (field) => (e) => setDraft({ ...draft, [field]: e.target.value });
  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: `1.5px solid ${C2.lightGray}`,
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: C2.gray,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  };
  return (
    <div style={{ padding: '14px 16px', background: '#FAFAF7', borderRadius: 10, border: `1.5px dashed ${C2.lightGray}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C2.darkGray }}>
          {isEdit ? 'Edit location' : 'Add a location'}
        </span>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={draft.name}
          onChange={set('name')}
          placeholder="Downtown studio"
          disabled={saving}
          style={inputStyle}
        />
      </div>

      {/* Address autocomplete (HK May 19 2026): single type-ahead
          field that fills street, city, state, zip on selection.
          Suite stays its own field because Google does not reliably
          return suite numbers, and the therapist usually knows hers
          better than Google would anyway. Falls back to manual
          entry if Places API is unavailable (no key, network, etc). */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Address</label>
        <AddressAutocompleteInput
          street1={draft.street1}
          city={draft.city}
          state={draft.state}
          postal_code={draft.postal_code}
          onSelect={(parts) => setDraft({
            ...draft,
            street1: parts.street1 || '',
            city: parts.city || '',
            state: parts.state || '',
            postal_code: parts.postal_code || '',
          })}
          disabled={saving}
          placeholder="Start typing your address..."
          inputStyle={inputStyle}
          labelStyle={labelStyle}
        />
      </div>

      {/* Street2 (suite) stays its own field since Places does not
          reliably return suite numbers. */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Suite, floor, room (optional)</label>
        <input
          type="text"
          value={draft.street2}
          onChange={set('street2')}
          placeholder="Studio B"
          disabled={saving}
          style={inputStyle}
        />
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Notes (optional)</label>
        <input
          type="text"
          value={draft.notes}
          onChange={set('notes')}
          placeholder="Parking behind the building, buzz suite 200"
          disabled={saving}
          style={inputStyle}
        />
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {isEdit && (
          <button
            onClick={onCancel}
            disabled={saving}
            style={{ background: '#F3F4F6', color: '#4B5563', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          style={{
            background: saving || !draft.name.trim() ? '#D1D5DB' : C2.forest,
            color: '#fff',
            border: 'none',
            padding: '9px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: saving || !draft.name.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : (isEdit ? 'Save changes' : 'Add location')}
        </button>
      </div>
    </div>
  );
}


export default function Dashboard({ view }) {
  const { therapist, signOut, refreshTherapist } = useAuth();
  const navigate = useNavigate();
  const { clientId, sessionId } = useParams();
  const isMobile = useMobile();
  const [stats, setStats] = useState({ clients: 0, sessions: 0 });
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendPhone, setSendPhone] = useState('');
  const [sendCopied, setSendCopied] = useState(false);
  const [showBookmarkNudge, setShowBookmarkNudge] = useState(false);
  const [lapsedDays, setLapsedDays] = React.useState(() => parseInt(localStorage.getItem('bm_lapsed_days') || '60'));


  useEffect(() => {
    if (therapist?.id) loadStats();
    if (localStorage.getItem('showSendOnLoad') === 'true') {
      localStorage.removeItem('showSendOnLoad');
      setTimeout(() => setShowSendModal(true), 800);
    }
    if (localStorage.getItem('showBookmarkNudge') === 'true') {
      localStorage.removeItem('showBookmarkNudge');
      setShowBookmarkNudge(true);
    }
  }, [therapist?.id]);

  // Phone verification hard gate for new signups.
  // Therapists created on or after 2026-05-12 (the day this feature
  // shipped) must verify their phone before they can use the dashboard.
  // Older therapists are grandfathered in and see a soft banner instead.
  // See PhoneVerifyBanner below.
  const PHONE_GATE_FROM = '2026-05-12T00:00:00Z';
  useEffect(() => {
    if (!therapist?.id) return;
    if (therapist.phone_verified_at) return;
    if (!therapist.created_at) return;
    if (therapist.created_at >= PHONE_GATE_FROM) {
      navigate('/verify-phone', { replace: true });
    }
  }, [therapist?.id, therapist?.phone_verified_at, therapist?.created_at, navigate]);

  useEffect(() => {
    if (clientId) loadClient();
  }, [clientId]);

  useEffect(() => {
    if (sessionId) loadSession();
  }, [sessionId]);

  async function loadStats() {
    try {
      const clients = await db.getTherapistClients(therapist.id);
      // Lifetime sessions = total confirmed/completed bookings.
      // We use bookings (appointment records) not sessions (SOAP-note
      // records) because bookings is the actual unit of work that
      // happened. A booking can exist without a SOAP note; a SOAP-only
      // session (rare) was never an appointment.
      const { data: sessions } = await supabase.from('bookings').select('id, status').eq('therapist_id', therapist.id);
      const sessionsCount = (sessions || []).filter(b => !b.status || ['confirmed', 'completed'].includes(b.status)).length;
      const { data: services } = await supabase.from('services').select('id').eq('therapist_id', therapist.id).eq('active', true);
      const { data: availability } = await supabase.from('availability').select('id,active').eq('therapist_id', therapist.id);
      // Lapsed clients for nudge
      const lapsedMs = (lapsedDays || 60) * 24 * 60 * 60 * 1000;
      const lapsedClients = (clients || []).filter(c => c.last_session_date && (Date.now() - new Date(c.last_session_date).getTime()) >= lapsedMs);

      // ─── Rolling 7-day and 30-day stats for the dashboard strip ───
      // Industry standard (Stripe, Linear, Apple) uses rolling windows
      // not calendar week/month, so the numbers never look small on
      // partial periods.
      const now = Date.now();
      const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      // New clients: created in window
      const new7d = (clients || []).filter(c => c.created_at && c.created_at >= d7).length;
      const new30d = (clients || []).filter(c => c.created_at && c.created_at >= d30).length;

      // Sessions completed: count of confirmed/completed bookings in
      // the window. We read from `bookings` (not `sessions`) because
      // bookings is the appointment record with date + service link,
      // while sessions is the SOAP-note record decoupled from any
      // service or date. booking_date is YYYY-MM-DD format so we slice
      // the ISO timestamp to 10 chars.
      //
      // Status filter: confirmed and completed both count. Anything
      // cancelled or pending is excluded from the live earnings/sessions
      // numbers. If status is null (legacy rows from before the column
      // was added), include it; defaulting to "treat as confirmed" is
      // less surprising than silently dropping old data.
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select('id, booking_date, status, services(price)')
        .eq('therapist_id', therapist.id)
        .gte('booking_date', d30.slice(0, 10));

      const isCounted = (b) => !b.status || ['confirmed', 'completed'].includes(b.status);
      const counted30d = (recentBookings || []).filter(isCounted);
      const counted7d = counted30d.filter(b => b.booking_date >= d7.slice(0, 10));

      const sessions7d = counted7d.length;
      const sessions30d = counted30d.length;

      // Earnings: sum of booking.services.price for counted bookings.
      // Falls back to therapist.session_rate when the booking's service
      // has no price (rare but possible for legacy bookings).
      const fallbackRate = Number(therapist?.session_rate) || 0;
      const priceOf = (b) => (b.services?.price ?? fallbackRate) || 0;
      const earnings7d = counted7d.reduce((sum, b) => sum + priceOf(b), 0);
      const earnings30d = counted30d.reduce((sum, b) => sum + priceOf(b), 0);

      setStats({
        clients: clients?.length || 0,
        sessions: sessionsCount,
        services: services || [],
        availability: availability || [],
        lapsedClients,
        rolling: { new7d, new30d, sessions7d, sessions30d, earnings7d, earnings30d },
      });
    } catch (err) { console.error(err); }
  }

  async function loadClient() {
    try {
      // Sample-client preview path: a new therapist tapped one of the
      // sample cards on the empty Clients tab. The clientId is
      // 'sample-s1' etc., not a real UUID. Resolve from the sample
      // store instead of querying Supabase. The rest of the page
      // (ClientProfile, SessionList, four-document journey) renders
      // identically to a real client.
      if (isSampleId(clientId)) {
        const sample = getSampleClient(clientId);
        if (sample) setClient(sample);
        return;
      }
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (!error) setClient(data);
    } catch (err) { console.error(err); }
  }

  async function loadSession() {
    try {
      // Sample-session path: parallel to sample clients above. The
      // sessionId is 'sample-session-s1-3', resolve from the sample
      // store. Brief routes (/brief/intake/<id> etc) handle their
      // own sample resolution in their respective page files.
      if (isSampleSessionId(sessionId)) {
        const sample = getSampleSession(sessionId);
        if (sample) setSession(sample);
        return;
      }
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (!error) setSession(data);
    } catch (err) { console.error(err); }
  }

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div style={{ minHeight: '100vh', background: C.beige, fontFamily: 'system-ui, sans-serif', paddingTop: '0' }}>
      {new URLSearchParams(window.location.search).get('upgraded') === 'true' && (
        <div style={{ background: '#ECFDF5', borderBottom: '2px solid #059669', padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '17px', fontWeight: '700', color: '#065F46', margin: '0 0 2px 0' }}>🎉 Congratulations! You're now on Silver.</p>
          <p style={{ fontSize: '13px', color: '#047857', margin: 0 }}>Unlimited clients and sessions are now unlocked. Let's get to work!</p>
        </div>
      )}
      <header style={{
        background: C.white,
        borderBottom: `1px solid ${C.lightGray}`,
        padding: isMobile
          ? 'max(10px, env(safe-area-inset-top, 10px)) 14px 10px'
          : '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <BMLogo size={isMobile ? 26 : 30} variant="dark" showWordmark={false} />
          <div>
            <h1 style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: '700', color: C.forest, margin: 0, lineHeight: 1.1 }}>MyBodyMap</h1>
            <p style={{ fontSize: '10px', color: C.gray, margin: 0 }}>{therapist?.business_name || 'Dashboard'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <NotificationsBell therapistId={therapist?.id} isMobile={isMobile} />
          <span style={{ fontSize: '10px', fontWeight: '700', color: C.forest, background: '#F0FDF4', border: '1px solid #86EFAC', padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
            🌿 Silver · Free
          </span>
          {isMobile ? (
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              style={{
                background: C.white,
                border: `1px solid ${C.lightGray}`,
                color: C.gray,
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          ) : (
            <button onClick={handleLogout} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
              Sign Out
            </button>
          )}
        </div>
      </header>

      {showBookmarkNudge && !isMobile && (
        <div style={{ background: '#2A5741', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add MyBodyMap to your home screen for instant access, use Share → Add to Home Screen</p>
          </div>
          <button onClick={() => setShowBookmarkNudge(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Got it ✓</button>
        </div>
      )}

      {/* Desktop tab nav, hidden on mobile */}
      {!isMobile && (
        <div className="bm-dash-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 0' }}>
          <div style={{ background: C.white, borderRadius: '12px', padding: '6px', marginBottom: '24px', display: 'flex', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button onClick={() => navigate('/dashboard')} style={{ flexShrink:0, background: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.sage : 'transparent', color: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>Clients</button>
            <button onClick={() => navigate('/dashboard/schedule')} style={{ background: view === 'schedule' ? C.sage : 'transparent', color: view === 'schedule' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Schedule</button>
            <button onClick={() => navigate('/dashboard/billing')} style={{ background: view === 'billing' ? C.sage : 'transparent', color: view === 'billing' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Billing</button>
            {therapist?.ai_enabled !== false && (
              <button onClick={() => navigate('/dashboard/ai')} style={{ background: view === 'ai' ? C.sage : 'transparent', color: view === 'ai' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Platform</button>
            )}
            <button onClick={() => navigate('/dashboard/outreach')} style={{ background: view === 'outreach' ? C.sage : 'transparent', color: view === 'outreach' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Outreach</button>
            <button onClick={() => navigate('/dashboard/gifts')} style={{ background: view === 'gifts' ? C.sage : 'transparent', color: view === 'gifts' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Gifts</button>
            <button onClick={() => navigate('/dashboard/settings')} style={{ background: view === 'settings' ? C.sage : 'transparent', color: view === 'settings' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>Settings</button>
          </div>
        </div>
      )}

      {/* Content area.
          Mobile bottom padding needs to clear the fixed bottom nav
          (74px) + iOS home indicator safe area + a comfortable gap
          so users can scroll the last item above the nav, not
          hidden behind it. Earlier value (90px flat) was too short
          on iPhones with home indicator. */}
      <div className="bm-dash-pad" style={{
        maxWidth: isMobile ? '100%' : '1200px',
        margin: '0 auto',
        padding: isMobile
          ? '12px 12px calc(96px + env(safe-area-inset-bottom, 0px))'
          : '0 16px 32px',
      }}>
        <div style={{
          background: C.white,
          borderRadius: isMobile ? '16px' : '12px',
          padding: isMobile ? '16px' : '32px',
          minHeight: '400px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {view === 'clients' && (
            <>
              {(() => {
                // Friendly greeting at the top of the main dashboard
                // view. First name + time-of-day. Falls back to
                // 'Hi there' if therapist name is missing for any
                // reason. Per HK direction May 8, 2026.
                const firstName = (therapist?.full_name || '').trim().split(/\s+/)[0] || '';
                const hour = new Date().getHours();
                const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
                return (
                  <div style={{
                    marginBottom: isMobile ? 14 : 18,
                    paddingBottom: isMobile ? 12 : 14,
                    borderBottom: `1px solid ${C.lightGray}`,
                  }}>
                    <h2 style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: isMobile ? 22 : 26,
                      fontWeight: 700,
                      color: C.dark,
                      margin: '0 0 3px 0',
                      lineHeight: 1.2,
                    }}>
                      {greeting}{firstName ? `, ${firstName}` : ''}.
                    </h2>
                    {therapist?.business_name && (
                      <p style={{
                        fontSize: 12,
                        color: C.gray,
                        margin: 0,
                        lineHeight: 1.4,
                      }}>
                        {therapist.business_name}
                      </p>
                    )}
                  </div>
                );
              })()}
              <StatsStrip rolling={stats?.rolling} />
              <OnboardingChecklist
                therapist={therapist}
                services={stats?.services || []}
                availability={stats?.availability || []}
                sessions={stats?.sessions || 0}
                clients={stats?.clients || 0}
                onNavigate={buildOnboardingNavigate({
                  therapist,
                  navigate,
                  onTherapistUpdated: () => { refreshTherapist && refreshTherapist(); loadStats(); },
                })}
              />
              <PhoneVerifyBanner therapist={therapist} navigate={navigate} />
              <ActivationNudge sessions={stats?.sessions || 0} />
              <LapsedClientAlert
                clients={stats?.lapsedClients || []}
                onNavigate={(v) => navigate(`/dashboard/${v}`)}
              />
              <PurchasesPanel therapistId={therapist?.id} />
              <BookingLinkNudge
                therapist={therapist}
                bookings={stats?.sessions || 0}
              />
              <ClientList
                therapistId={therapist?.id}
                therapist={therapist}
                onSelectClient={(c) => navigate(`/dashboard/clients/${c.id}`)}
                lapsedDays={lapsedDays}
                customUrl={therapist?.custom_url || ''}
              />
            </>
          )}
          {view === 'sessions' && client && (
            <ClientProfile
              client={client}
              therapist={therapist}
              therapistId={therapist?.id}
              onBack={() => navigate('/dashboard')}
              onSelectSession={(s) => navigate(`/dashboard/clients/${clientId}/sessions/${s.id}`)}
            />
          )}
          {view === 'sessions' && !client && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>Loading client...</div>
          )}
          {view === 'session-detail' && session && client && (
            <SessionDetail
              session={session}
              client={client}
              onBack={() => navigate(`/dashboard/clients/${clientId}`)}
              onUpdate={(updated) => setSession(updated)}
            />
          )}
          {view === 'session-detail' && (!session || !client) && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>Loading session...</div>
          )}
          {view === 'schedule' && (
            <><ScheduleDashboard therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
          {view === 'billing' && (
            <><BillingDashboard therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
          {view === 'ai' && therapist && therapist.ai_enabled !== false && (
            <><AIDashboard therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
          {view === 'ai' && therapist && therapist.ai_enabled === false && (
            <div style={{ maxWidth: 560, margin: '40px auto', padding: '32px 24px', background: C.white, borderRadius: 14, border: `1.5px solid ${C.lightGray}`, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.gray, marginBottom: 6 }}>Platform features off</div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: C.forest, margin: '0 0 10px' }}>PracticeIQ is turned off.</h2>
              <p style={{ fontSize: 14, color: C.gray, lineHeight: 1.6, margin: '0 0 20px' }}>You turned off Platform features in Settings. Turn them back on anytime to use the chat, pre-session briefs, and Practice Pulse digest. Your data is unchanged.</p>
              <button onClick={() => navigate('/dashboard/settings')}
                style={{ background: C.forest, color: C.white, border: 'none', borderRadius: 999, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Open Settings →
              </button>
            </div>
          )}
          {view === 'outreach' && therapist && (
            <><Outreach therapist={therapist} lapsedDays={lapsedDays} />{isMobile && <PageEnd />}</>
          )}
          {view === 'settings' && (
            <div style={{ paddingBottom: isMobile ? 120 : 0 }}>
              <SettingsPanel therapist={therapist} lapsedDays={lapsedDays} setLapsedDays={setLapsedDays} />
              {isMobile && <PageEnd />}
            </div>
          )}
          {view === 'gifts' && therapist && (
            <><GiftCertificates therapist={therapist} />{isMobile && <PageEnd />}</>
          )}
        </div>

        <div className="no-print" style={{ display: isMobile || view === 'schedule' ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Total Clients</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.forest, margin: 0 }}>{stats.clients}</p>
          </div>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Total Sessions</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.sage, margin: 0 }}>{stats.sessions}</p>
          </div>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Plan</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, margin: 0 }}>
              {(!therapist?.plan || therapist?.plan === 'free' || therapist?.plan === 'bronze') ? 'Bronze (Free)' : therapist?.plan === 'silver' ? 'Silver ($19/mo)' : therapist?.plan === 'gold' ? 'Gold ($49/mo)' : 'Bronze (Free)'}
            </p>
          </div>
        </div>
      </div>
      {/* HK May 25 2026: removed the standalone 'Share booking link'
          pill floater on Clients/Sessions/Session-Detail views.
          FloatingBookingChip mounted below now handles the same job
          on every tab. The chip's popover surfaces 'Send via SMS'
          which opens the same modal kept here. */}
      {/* Share booking link modal.
          HK May 14 2026: the URL we share IS the booking page URL.
          Intake is a step inside that booking flow. We were labeling
          the same URL as 'intake link' in some places and 'booking
          link' in others, which confused therapists ('where is the
          booking link?'). Single label now: booking link, with a
          subtitle reminding them intake is included. */}
      {showSendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px' }} onClick={() => setShowSendModal(false)}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 4px 0' }}>🔗 Share your booking link</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Includes intake automatically. Client books and fills intake in one flow.</p>
              </div>
              <CloseButton onClick={() => setShowSendModal(false)} label="Close" />
            </div>
            <div style={{ background: '#F5F0E8', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>Your booking link</p>
              <a
                href={`${window.location.origin}/book/${therapist?.custom_url}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openExternalClick(`${window.location.origin}/book/${therapist?.custom_url}`)}
                style={{ fontSize: '14px', fontWeight: '600', color: '#2A5741', margin: 0, wordBreak: 'break-all', textDecoration: 'underline', textDecorationColor: 'rgba(42,87,65,0.3)', textUnderlineOffset: 3 }}
              >
                {window.location.origin}/book/{therapist?.custom_url}
              </a>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E', display: 'block', marginBottom: '8px' }}>Client phone number (optional)</label>
              <input type="tel" value={sendPhone} onChange={e => { const d=e.target.value.replace(/\D/g,'').slice(0,10); const f=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; setSendPhone(f); }} placeholder="(512) 555-1234" autoFocus style={{ width: '100%', padding: '12px 16px', border: '2px solid #E8E4DC', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={sendPhone.replace(/\D/g,'').length >= 10 ? 'sms:' + sendPhone.replace(/\D/g,'') + '?body=' + encodeURIComponent('Hi! Here is my booking link, you can pick a time and fill the intake in one go: ' + window.location.origin + '/book/' + (therapist?.custom_url || '')) : undefined} onClick={e => { if(sendPhone.replace(/\D/g,'').length < 10) { e.preventDefault(); return; } if (therapist?.id) { import('../lib/activation').then(({ trackActivation }) => trackActivation(therapist.id, 'sent_first_intake')).catch(()=>{}); } setTimeout(() => setShowSendModal(false), 500); }} style={{ display: 'block', textAlign: 'center', background: sendPhone.replace(/\D/g,'').length >= 10 ? '#2A5741' : '#C8BFB0', color: 'white', padding: '14px', borderRadius: '50px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', cursor: sendPhone.replace(/\D/g,'').length >= 10 ? 'pointer' : 'not-allowed' }}>
                💬 Open in Messages →
              </a>
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/book/' + (therapist?.custom_url || '')); setSendCopied(true); setTimeout(() => setSendCopied(false), 2000); if (therapist?.id) { import('../lib/activation').then(({ trackActivation }) => trackActivation(therapist.id, 'sent_first_intake')).catch(()=>{}); } }} style={{ background: sendCopied ? '#E8F5EE' : '#F5F0E8', border: '1.5px solid ' + (sendCopied ? '#6B9E80' : '#E8E4DC'), color: sendCopied ? '#2A5741' : '#6B7280', padding: '12px', borderRadius: '50px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                {sendCopied ? '✓ Copied!' : '📋 Copy Link Only'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>🔒 Only shared with you</p>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile && (
        <MobileBottomNav
          active={view === 'clients' || view === 'sessions' || view === 'session-detail' ? 'clients' : view || 'clients'}
          onChange={(tab) => {
            const routes = {
              clients: '/dashboard',
              schedule: '/dashboard/schedule',
              billing: '/dashboard/billing',
              outreach: '/dashboard/outreach',
              settings: '/dashboard/settings',
              ai: '/dashboard/ai',
              gifts: '/dashboard/gifts',
            };
            navigate(routes[tab] || '/dashboard');
          }}
          onSignOut={handleLogout}
          therapist={therapist}
        />
      )}

      {/* PWA install banner */}
      <PWAInstallBanner therapist={therapist} />

      {/* HK May 25 2026 (Work E): floating booking-link chip available
          on every dashboard tab. Sage circle in the bottom-right by
          default with a popover that exposes Open + Copy + Send via
          SMS. Long-press to drag to another corner; the choice
          persists per therapist. Built as a generic chip so future
          iterations can expand it into a PracticeIQ shortcut hub. */}
      <FloatingBookingChip
        therapist={therapist}
        onSendSms={() => { setShowSendModal(true); setSendPhone(''); setSendCopied(false); }}
      />
    </div>
  );
}

// Inline component: position controls for a single service row.
// Renders [number input][up arrow][down arrow] side by side.
//
// Per HK May 19 2026: 1-based contiguous position. Tap the number,
// type a new position, press Enter or tap away to apply. Arrows
// nudge by 1. Both go through the same setServicePosition handler.
//
// Behavior:
//   - Local draft state while typing so user can backspace
//   - On blur or Enter: parse, clamp to [1, total], dispatch if changed
//   - On Escape: revert and blur
//   - Empty input or invalid input on commit: revert to original
//   - Up arrow disabled at position 1, down arrow disabled at position total
function ServicePositionControl({ position, total, onSetPosition, onMoveUp, onMoveDown, serviceName, lightGray, darkGray }) {
  const [draft, setDraft] = React.useState(String(position));
  const [editing, setEditing] = React.useState(false);

  // Keep draft in sync when the actual position changes from outside
  // (e.g., the therapist moved a different service which renumbered
  // this one). Skip while editing so we don't clobber the user's typing.
  React.useEffect(() => {
    if (!editing) setDraft(String(position));
  }, [position, editing]);

  function commit() {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (Number.isNaN(n) || n < 1 || n > total) {
      setDraft(String(position));
      return;
    }
    if (n === position) {
      setDraft(String(position));
      return;
    }
    onSetPosition(n);
  }

  function cancel() {
    setEditing(false);
    setDraft(String(position));
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onFocus={(e) => { setEditing(true); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          else if (e.key === 'Escape') { cancel(); e.currentTarget.blur(); }
        }}
        aria-label={`Position of ${serviceName}`}
        style={{
          width: 34,
          height: 28,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: darkGray,
          background: '#fff',
          border: `1px solid ${lightGray}`,
          borderRadius: 6,
          padding: '0 2px',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        <button
          onClick={onMoveUp}
          disabled={position === 1}
          aria-label={`Move ${serviceName} up`}
          style={{
            width: 22,
            height: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: position === 1 ? '#F3F4F6' : '#fff',
            border: `1px solid ${position === 1 ? '#F3F4F6' : lightGray}`,
            borderRadius: 4,
            cursor: position === 1 ? 'not-allowed' : 'pointer',
            color: position === 1 ? '#D1D5DB' : darkGray,
            padding: 0,
            lineHeight: 1,
          }}
        >
          <svg width="9" height="6" viewBox="0 0 10 7"><path d="M2 5 L5 2 L8 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={position === total}
          aria-label={`Move ${serviceName} down`}
          style={{
            width: 22,
            height: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: position === total ? '#F3F4F6' : '#fff',
            border: `1px solid ${position === total ? '#F3F4F6' : lightGray}`,
            borderRadius: 4,
            cursor: position === total ? 'not-allowed' : 'pointer',
            color: position === total ? '#D1D5DB' : darkGray,
            padding: 0,
            lineHeight: 1,
          }}
        >
          <svg width="9" height="6" viewBox="0 0 10 7"><path d="M2 2 L5 5 L8 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </button>
      </div>
    </div>
  );
}
