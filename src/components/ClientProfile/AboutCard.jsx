// src/components/ClientProfile/AboutCard.jsx
//
// Inline-editable client identity card. Replaces the 'Edit Client'
// modal, which had recurring layout bugs every time the viewport
// changed shape. Each row is tap-to-edit in place: see the value,
// tap it, it turns into an input, Enter or blur saves. No dialog.
// No back-button. No 'unsaved changes' alert.
//
// Pattern: same Notion / Linear cell-edit idiom InlineEditField
// already implements for the catalog rows. This is the structured-
// form sibling: four single-row fields stacked, with a wider
// 'Notes' textarea cell at the bottom.
//
// Save behavior: each cell saves on blur (or Enter for text inputs,
// Cmd-Enter for the textarea). Saving sets a soft 'Saved ✓' ghost
// for ~1.5s next to the just-edited row. No global save button.
//
// Sample clients (client.__sample) short-circuit Supabase writes
// and just update local state, same pattern the SessionList modal
// used.

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import AutoGrowingTextarea from '../AutoGrowingTextarea';
import { ChevronButton } from '../ChevronIcon';
import { recordFactHistory, HISTORY_FIELDS, listFactHistory, HISTORY_FIELD_LABELS, HISTORY_SOURCE_LABELS } from '../../lib/clientHistory';

const C = {
  paper:  '#FFFFFF',
  cream:  '#FBF8F1',
  ink:    '#1F2937',
  inkSoft:'#475569',
  muted:  '#94A3B8',
  line:   '#E2E8F0',
  lineSoft:'#EEF2F7',
  forest: '#1F3A2C',
  sage:   '#5C7A4F',
  saved:  '#16A34A',
  error:  '#DC2626',
  hover:  '#F8FAFC',
  focus:  '#2A5741',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

export default function AboutCard({ client, onUpdated, pulse = false, readOnly = false }) {
  // Local mirror of the values shown. Updates after save so the
  // cell shows the new value without a re-fetch.
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [notes, setNotes] = useState(client?.notes || '');
  // Address fields (HK May 22 2026 item H of A-J). The schema gained
  // line1/line2/city/state/zip/country May 21 evening; this is the
  // UI surface that lets therapists view and edit them. All optional.
  const [addressLine1, setAddressLine1] = useState(client?.address_line1 || '');
  const [addressLine2, setAddressLine2] = useState(client?.address_line2 || '');
  const [city, setCity] = useState(client?.city || '');
  const [state, setState] = useState(client?.state || '');
  const [zip, setZip] = useState(client?.zip || '');
  // Scope B (HK Jun 1 2026): extra client fields
  const [birthday, setBirthday] = useState(client?.birthday || '');
  const [customerSince, setCustomerSince] = useState(client?.customer_since || '');
  const [altPhone, setAltPhone] = useState(client?.alt_phone || '');
  const [gender, setGender] = useState(client?.gender || '');
  const [referralSource, setReferralSource] = useState(client?.referral_source || '');
  // Health and safety fields (HK Jun 8 2026). Editable here, and the
  // document reader can fill blanks from a read intake form.
  const [allergies, setAllergies] = useState(client?.allergies || '');
  const [healthConditions, setHealthConditions] = useState(client?.health_conditions || '');
  const [medications, setMedications] = useState(client?.medications || '');
  const [areasToAvoid, setAreasToAvoid] = useState(client?.areas_to_avoid || '');
  const [emergencyContact, setEmergencyContact] = useState(client?.emergency_contact || '');
  // 'name' | 'email' | 'phone' | 'notes' | 'address_line1' | etc
  const [justSaved, setJustSaved] = useState(null);
  // 'name' | etc for inline error message
  const [errorOn, setErrorOn] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  // Change history panel for the Health and safety group.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const toggleHistory = async () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && historyRows === null && client?.id && !client?.__sample) {
      setHistoryLoading(true);
      try {
        const rows = await listFactHistory(client.id);
        setHistoryRows(rows);
      } catch (_e) {
        setHistoryRows([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  };
  // Reload history when reopened after a client switch.
  useEffect(() => { setHistoryRows(null); setHistoryOpen(false); }, [client?.id]);

  // Reset local state if the parent swaps to a different client.
  useEffect(() => {
    setName(client?.name || '');
    setEmail(client?.email || '');
    setPhone(client?.phone || '');
    setNotes(client?.notes || '');
    setAddressLine1(client?.address_line1 || '');
    setAddressLine2(client?.address_line2 || '');
    setCity(client?.city || '');
    setState(client?.state || '');
    setZip(client?.zip || '');
    setAllergies(client?.allergies || '');
    setHealthConditions(client?.health_conditions || '');
    setMedications(client?.medications || '');
    setAreasToAvoid(client?.areas_to_avoid || '');
    setEmergencyContact(client?.emergency_contact || '');
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep fields in sync when the client object is updated externally
  // (e.g. the document reader fills blanks). The viewer is a separate
  // full screen, so there is no concurrent in-place edit to clobber.
  useEffect(() => {
    setName(client?.name || '');
    setEmail(client?.email || '');
    setPhone(client?.phone || '');
    setAltPhone(client?.alt_phone || '');
    setBirthday(client?.birthday || '');
    setGender(client?.gender || '');
    setReferralSource(client?.referral_source || '');
    setAddressLine1(client?.address_line1 || '');
    setAddressLine2(client?.address_line2 || '');
    setCity(client?.city || '');
    setState(client?.state || '');
    setZip(client?.zip || '');
    setAllergies(client?.allergies || '');
    setHealthConditions(client?.health_conditions || '');
    setMedications(client?.medications || '');
    setAreasToAvoid(client?.areas_to_avoid || '');
    setEmergencyContact(client?.emergency_contact || '');
    setNotes(client?.notes || '');
  }, [
    client?.name, client?.email, client?.phone, client?.alt_phone, client?.birthday,
    client?.gender, client?.referral_source, client?.address_line1, client?.address_line2,
    client?.city, client?.state, client?.zip, client?.allergies, client?.health_conditions,
    client?.medications, client?.areas_to_avoid, client?.emergency_contact, client?.notes,
  ]);

  // Pulse animation when the hero pencil button is tapped. Outer
  // wrapper gets the bm-cp-attn class for ~1.4s, then it clears.
  const cardRef = useRef(null);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    setPulsing(true);
    if (cardRef.current && cardRef.current.scrollIntoView) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setPulsing(false), 1400);
    return () => clearTimeout(t);
  }, [pulse]);

  const isSample = !!client?.__sample;

  async function saveField(field, value) {
    setErrorOn(null);
    setErrorMsg('');

    // Validation. Name is required; email is loosely validated.
    if (field === 'name') {
      if (!value || !value.trim()) {
        setErrorOn('name');
        setErrorMsg('Name is required.');
        setName(client?.name || '');
        return;
      }
    }
    if (field === 'email') {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        setErrorOn('email');
        setErrorMsg('That email looks off.');
        return;
      }
    }

    // Sample client: short-circuit. UI flips to saved, no DB write.
    if (isSample) {
      setJustSaved(field);
      setTimeout(() => setJustSaved(null), 1500);
      return;
    }

    const payload = {};
    if (field === 'name')  payload.name  = value.trim();
    if (field === 'email') payload.email = value.trim().toLowerCase() || null;
    if (field === 'phone') payload.phone = value.trim() || null;
    if (field === 'notes') payload.notes = value.trim() || null;
    if (field === 'address_line1') payload.address_line1 = value.trim() || null;
    if (field === 'address_line2') payload.address_line2 = value.trim() || null;
    if (field === 'city')  payload.city  = value.trim() || null;
    if (field === 'state') payload.state = value.trim() || null;
    if (field === 'zip')   payload.zip   = value.trim() || null;
    if (field === 'birthday')        payload.birthday        = value.trim() || null;
    if (field === 'customer_since')  payload.customer_since  = value.trim() || null;
    if (field === 'alt_phone')       payload.alt_phone       = value.trim() || null;
    if (field === 'gender')          payload.gender          = value || null;
    if (field === 'referral_source') payload.referral_source = value || null;
    if (field === 'allergies')        payload.allergies        = value.trim() || null;
    if (field === 'health_conditions') payload.health_conditions = value.trim() || null;
    if (field === 'medications')       payload.medications       = value.trim() || null;
    if (field === 'areas_to_avoid')    payload.areas_to_avoid    = value.trim() || null;
    if (field === 'emergency_contact') payload.emergency_contact = value.trim() || null;

    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', client.id);

    if (error) {
      setErrorOn(field);
      setErrorMsg('Save failed. Try again.');
      // Revert local state to what the parent had
      if (field === 'name')  setName(client?.name || '');
      if (field === 'email') setEmail(client?.email || '');
      if (field === 'phone') setPhone(client?.phone || '');
      if (field === 'notes') setNotes(client?.notes || '');
      if (field === 'address_line1') setAddressLine1(client?.address_line1 || '');
      if (field === 'address_line2') setAddressLine2(client?.address_line2 || '');
      if (field === 'city')  setCity(client?.city || '');
      if (field === 'state') setState(client?.state || '');
      if (field === 'zip')   setZip(client?.zip || '');
      if (field === 'birthday')        setBirthday(client?.birthday || '');
      if (field === 'customer_since')  setCustomerSince(client?.customer_since || '');
      if (field === 'alt_phone')       setAltPhone(client?.alt_phone || '');
      if (field === 'gender')          setGender(client?.gender || '');
      if (field === 'referral_source') setReferralSource(client?.referral_source || '');
      if (field === 'allergies')        setAllergies(client?.allergies || '');
      if (field === 'health_conditions') setHealthConditions(client?.health_conditions || '');
      if (field === 'medications')       setMedications(client?.medications || '');
      if (field === 'areas_to_avoid')    setAreasToAvoid(client?.areas_to_avoid || '');
      if (field === 'emergency_contact') setEmergencyContact(client?.emergency_contact || '');
      return;
    }

    setJustSaved(field);
    setTimeout(() => setJustSaved(null), 1500);
    if (HISTORY_FIELDS.includes(field)) {
      recordFactHistory({
        therapistId: client?.therapist_id,
        clientId: client?.id,
        field,
        value: payload[field],
        previousValue: client?.[field],
        source: 'edit',
      });
    }
    if (onUpdated) onUpdated(payload);
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: 'transparent',
        borderRadius: 10,
        padding: '4px 2px',
        fontFamily: F.sans,
        outline: pulsing ? `2px solid ${C.focus}` : '2px solid transparent',
        outlineOffset: pulsing ? 4 : 0,
        boxShadow: pulsing ? '0 0 0 6px rgba(42,87,65,0.12)' : 'none',
        transition: 'box-shadow 0.25s ease, outline-color 0.25s ease',
      }}
    >
      <Row readOnly={readOnly}
        label="Name"
        value={name}
        setValue={setName}
        onSave={(v) => saveField('name', v)}
        justSaved={justSaved === 'name'}
        error={errorOn === 'name' ? errorMsg : ''}
        required
      />
      <Row readOnly={readOnly}
        label="Email"
        value={email}
        setValue={setEmail}
        onSave={(v) => saveField('email', v)}
        justSaved={justSaved === 'email'}
        error={errorOn === 'email' ? errorMsg : ''}
        type="email"
        placeholder="Add email"
      />
      <Row readOnly={readOnly}
        label="Phone"
        value={phone}
        setValue={setPhone}
        onSave={(v) => saveField('phone', v)}
        justSaved={justSaved === 'phone'}
        error={errorOn === 'phone' ? errorMsg : ''}
        type="tel"
        placeholder="Add phone"
      />
      <Row readOnly={readOnly}
        label="Alternate phone"
        value={altPhone}
        setValue={setAltPhone}
        onSave={(v) => saveField('alt_phone', v)}
        justSaved={justSaved === 'alt_phone'}
        error={errorOn === 'alt_phone' ? errorMsg : ''}
        type="tel"
        placeholder="Add a second phone"
      />
      <Row readOnly={readOnly}
        label="Birthday"
        value={birthday}
        setValue={setBirthday}
        onSave={(v) => saveField('birthday', v)}
        justSaved={justSaved === 'birthday'}
        error={errorOn === 'birthday' ? errorMsg : ''}
        type="date"
        placeholder="Add birthday"
      />
      <Row readOnly={readOnly}
        label="Customer since"
        value={customerSince}
        setValue={setCustomerSince}
        onSave={(v) => saveField('customer_since', v)}
        justSaved={justSaved === 'customer_since'}
        type="date"
        placeholder="Add date"
      />
      <PillRow
        label="Gender"
        value={gender}
        options={['Female', 'Male', 'Non-binary', 'Prefer not to say']}
        onSave={(v) => { setGender(v); saveField('gender', v); }}
        justSaved={justSaved === 'gender'}
      />
      <PillRow
        label="How they found you"
        value={referralSource}
        options={['Referred by someone', 'Found online', 'Social media', 'Returning client', 'Walk-in']}
        onSave={(v) => { setReferralSource(v); saveField('referral_source', v); }}
        justSaved={justSaved === 'referral_source'}
      />
      {/* Address (HK May 22 2026 item H). Collapsible because most
          therapists don't need to see it at a glance for every client.
          Tap "Address" header to expand; tap a field to edit. */}
      <AddressBlock
        readOnly={readOnly}
        line1={addressLine1}
        setLine1={setAddressLine1}
        line2={addressLine2}
        setLine2={setAddressLine2}
        city={city}
        setCity={setCity}
        state={state}
        setState={setState}
        zip={zip}
        setZip={setZip}
        saveField={saveField}
        justSaved={justSaved}
        errorOn={errorOn}
        errorMsg={errorMsg}
      />
      <div style={{
        marginTop: 18, marginBottom: 2, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}`,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.sage,
      }}>
        Health and safety
      </div>
      <RowMultiline
        label="Allergies"
        value={allergies}
        setValue={setAllergies}
        onSave={(v) => saveField('allergies', v)}
        justSaved={justSaved === 'allergies'}
        error={errorOn === 'allergies' ? errorMsg : ''}
        placeholder="Latex, nut oils, scents"
      />
      <RowMultiline
        label="Conditions"
        value={healthConditions}
        setValue={setHealthConditions}
        onSave={(v) => saveField('health_conditions', v)}
        justSaved={justSaved === 'health_conditions'}
        error={errorOn === 'health_conditions' ? errorMsg : ''}
        placeholder="Injuries, pregnancy, conditions to know about"
      />
      <RowMultiline
        label="Medications"
        value={medications}
        setValue={setMedications}
        onSave={(v) => saveField('medications', v)}
        justSaved={justSaved === 'medications'}
        error={errorOn === 'medications' ? errorMsg : ''}
        placeholder="Anything relevant for bodywork"
      />
      <RowMultiline
        label="Areas to avoid"
        value={areasToAvoid}
        setValue={setAreasToAvoid}
        onSave={(v) => saveField('areas_to_avoid', v)}
        justSaved={justSaved === 'areas_to_avoid'}
        error={errorOn === 'areas_to_avoid' ? errorMsg : ''}
        placeholder="Left shoulder, low back"
      />
      <Row readOnly={readOnly}
        label="Emergency contact"
        value={emergencyContact}
        setValue={setEmergencyContact}
        onSave={(v) => saveField('emergency_contact', v)}
        justSaved={justSaved === 'emergency_contact'}
        error={errorOn === 'emergency_contact' ? errorMsg : ''}
        placeholder="Name and phone"
      />
      {!isSample && (
        <div style={{ marginTop: 4 }}>
          <button type="button" onClick={toggleHistory} style={{
            background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
            fontFamily: F.sans, fontSize: 12.5, fontWeight: 700, color: C.sage,
          }}>
            {historyOpen ? 'Hide change history' : 'View change history'}
          </button>
          {historyOpen && (
            <div style={{ marginTop: 4 }}>
              {historyLoading && (
                <div style={{ fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>Loading.</div>
              )}
              {!historyLoading && historyRows && historyRows.length === 0 && (
                <div style={{ fontFamily: F.sans, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                  No changes recorded yet. Edits and document reads from here on will show up here.
                </div>
              )}
              {!historyLoading && historyRows && historyRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {historyRows.map(r => (
                    <div key={r.id} style={{
                      borderLeft: `2px solid ${C.lineSoft}`, paddingLeft: 10,
                    }}>
                      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.ink, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700 }}>{HISTORY_FIELD_LABELS[r.field] || r.field}:</span>{' '}
                        {r.value ? r.value : <span style={{ fontStyle: 'italic', color: C.muted }}>cleared</span>}
                      </div>
                      <div style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                        {prettyHistoryDate(r.effective_on)} · {HISTORY_SOURCE_LABELS[r.source] || r.source}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!readOnly && (
        <RowMultiline
          label="Notes"
          value={notes}
          setValue={setNotes}
          onSave={(v) => saveField('notes', v)}
          justSaved={justSaved === 'notes'}
          error={errorOn === 'notes' ? errorMsg : ''}
          placeholder="Internal notes about this client"
        />
      )}
    </div>
  );
}
// HK May 29 2026: CardOnFileChip moved out of AboutCard. The chip
// previously sat at the bottom of this card, but AboutCard lives
// inside the collapsed-by-default 'Client info' section so therapists
// never saw it. The signal is now a permanent tile in StatusStrip
// where every important client state lives.

// Format a YYYY-MM-DD date as a short local date without timezone drift.
function prettyHistoryDate(d) {
  if (!d) return '';
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_e) { return d; }
}

// Single-line tap-to-edit row. Click anywhere on the row body to
// enter edit mode. Blur or Enter saves. Esc cancels.
function Row({ label, value, setValue, onSave, justSaved, error, required, type = 'text', placeholder = 'Add value', readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft === value) return;
    setValue(draft);
    onSave(draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(70px, 90px) 1fr',
      alignItems: 'center',
      padding: '10px 4px',
      borderBottom: `1px solid ${C.lineSoft}`,
      gap: 12,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}{required && <span style={{ color: C.error, marginLeft: 2 }}>*</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {(editing && !readOnly) ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            type={type}
            placeholder={placeholder}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 8px',
              border: `1.5px solid ${C.focus}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              background: C.paper,
              color: C.ink,
              boxSizing: 'border-box',
            }}
            inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text'}
            autoCapitalize={type === 'email' ? 'none' : 'sentences'}
            autoCorrect={type === 'email' ? 'off' : 'on'}
          />
        ) : readOnly ? (
          <div style={{
            flex: 1,
            minWidth: 0,
            padding: '6px 8px',
            fontSize: 14,
            fontFamily: 'inherit',
            color: value ? C.ink : C.muted,
            fontStyle: value ? 'normal' : 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {value || 'Not set'}
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              padding: '6px 8px',
              background: 'transparent',
              border: '1.5px solid transparent',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              color: value ? C.ink : C.muted,
              cursor: 'pointer',
              fontStyle: value ? 'normal' : 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {value || placeholder}
          </button>
        )}
        {justSaved && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.saved,
            flexShrink: 0,
            opacity: 0.9,
          }}>
            ✓ Saved
          </span>
        )}
        {error && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.error,
            flexShrink: 0,
          }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

// Multi-line textarea row for the Notes field. Same click-to-edit
// pattern; Cmd/Ctrl + Enter commits, Esc cancels, blur commits.
// Tappable-pill row with an Other option that reveals a text box.
// HK Jun 1 2026 Scope B: no dropdowns, no free-text-only fields.
// A stored value that is not one of the options (e.g. an imported
// "Other: ..." value) shows as the Other pill pre-filled.
function PillRow({ label, value, options, onSave, justSaved }) {
  const isKnown = options.includes(value);
  const otherText = (!isKnown && value) ? value.replace(/^Other:\s*/i, '') : '';
  const [showOther, setShowOther] = useState(!isKnown && !!value);
  const [draft, setDraft] = useState(otherText);
  const inputRef = useRef(null);

  useEffect(() => {
    setShowOther(!options.includes(value) && !!value);
    setDraft((!options.includes(value) && value) ? value.replace(/^Other:\s*/i, '') : '');
  }, [value, options]);

  useEffect(() => { if (showOther && inputRef.current) inputRef.current.focus(); }, [showOther]);

  const otherSelected = showOther || (!isKnown && !!value);

  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.lineSoft}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        {justSaved && <span style={{ fontSize: 11, color: C.saved, fontWeight: 700 }}>Saved</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => { setShowOther(false); onSave(opt); }}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1.5px solid ${active ? C.forest : C.line}`,
                background: active ? C.forest : C.paper,
                color: active ? '#fff' : C.ink,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              {opt}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowOther(true)}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            border: `1.5px solid ${otherSelected ? C.forest : C.line}`,
            background: otherSelected ? C.forest : C.paper,
            color: otherSelected ? '#fff' : C.ink,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
          Other
        </button>
      </div>
      {showOther && (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { const t = draft.trim(); onSave(t ? `Other: ${t}` : ''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="Type it in"
          style={{
            marginTop: 8,
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 10px',
            border: `1.5px solid ${C.line}`,
            borderRadius: 8,
            fontSize: 14,
            fontFamily: F.sans,
          }}
        />
      )}
    </div>
  );
}

function RowMultiline({ label, value, setValue, onSave, justSaved, error, placeholder = 'Add notes' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at end so existing text is preserved naturally
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft === value) return;
    setValue(draft);
    onSave(draft);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(70px, 90px) 1fr',
      alignItems: 'flex-start',
      padding: '10px 4px',
      gap: 12,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        paddingTop: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, minWidth: 0 }}>
        {editing ? (
          <AutoGrowingTextarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            }}
            minRows={3}
            maxRows={12}
            placeholder={placeholder}
            style={{
              padding: '8px 10px',
              border: `1.5px solid ${C.focus}`,
              fontSize: 14,
              lineHeight: 1.45,
              background: C.paper,
              color: C.ink,
              boxSizing: 'border-box',
              minHeight: 70,
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              background: 'transparent',
              border: '1.5px solid transparent',
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: 'inherit',
              color: value ? C.ink : C.muted,
              cursor: 'pointer',
              fontStyle: value ? 'normal' : 'italic',
              whiteSpace: 'pre-wrap',
              transition: 'background 0.12s',
              minHeight: 38,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {value || placeholder}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, minHeight: 14 }}>
          {justSaved && (
            <span style={{ fontSize: 11, fontWeight: 600, color: C.saved }}>✓ Saved</span>
          )}
          {error && (
            <span style={{ fontSize: 11, fontWeight: 600, color: C.error }}>{error}</span>
          )}
          {editing && !error && (
            <span style={{ fontSize: 10.5, color: C.muted, fontStyle: 'italic' }}>
              Esc to cancel, Cmd-Enter to save
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// AddressBlock: collapsible group of address fields (line1, line2,
// city, state, zip). Collapsed by default since most therapists
// don't need to see addresses on every glance. Tap the header to
// expand. Each field is a tap-to-edit Row that saves independently
// via the parent's saveField. HK May 22 2026 item H of A-J.
//
// When any address field has a value, the header summary shows a
// short preview (e.g. "Nashville, TN 37212") so therapists can see
// the city without expanding.
function AddressBlock({
  line1, setLine1,
  line2, setLine2,
  city, setCity,
  state, setState,
  zip, setZip,
  saveField, justSaved, errorOn, errorMsg,
  readOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const hasAny = !!(line1 || line2 || city || state || zip);
  const summary = hasAny
    ? [city, state].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '')
    : '';

  return (
    <div style={{
      borderRadius: 10,
      background: C.cream,
      marginTop: 4,
      marginBottom: 4,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: open ? '#D4E6DA' : '#F0EBE0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          📍
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
            Address
          </div>
          <div style={{
            fontSize: 12,
            color: C.muted,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {hasAny ? (summary || 'Address on file') : 'Add an address (optional)'}
          </div>
        </div>
        <ChevronButton open={open} ariaLabel={open ? 'Collapse address' : 'Expand address'} />
      </button>
      {open && (
        <div style={{ padding: '4px 8px 10px 8px' }}>
          <Row readOnly={readOnly}
            label="Street address"
            value={line1}
            setValue={setLine1}
            onSave={(v) => saveField('address_line1', v)}
            justSaved={justSaved === 'address_line1'}
            error={errorOn === 'address_line1' ? errorMsg : ''}
            placeholder="123 Main St"
          />
          <Row readOnly={readOnly}
            label="Apt / Suite"
            value={line2}
            setValue={setLine2}
            onSave={(v) => saveField('address_line2', v)}
            justSaved={justSaved === 'address_line2'}
            error={errorOn === 'address_line2' ? errorMsg : ''}
            placeholder="Apt 4B (optional)"
          />
          <Row readOnly={readOnly}
            label="City"
            value={city}
            setValue={setCity}
            onSave={(v) => saveField('city', v)}
            justSaved={justSaved === 'city'}
            error={errorOn === 'city' ? errorMsg : ''}
            placeholder="Nashville"
          />
          <Row readOnly={readOnly}
            label="State"
            value={state}
            setValue={setState}
            onSave={(v) => saveField('state', v)}
            justSaved={justSaved === 'state'}
            error={errorOn === 'state' ? errorMsg : ''}
            placeholder="TN"
          />
          <Row readOnly={readOnly}
            label="Zip"
            value={zip}
            setValue={setZip}
            onSave={(v) => saveField('zip', v)}
            justSaved={justSaved === 'zip'}
            error={errorOn === 'zip' ? errorMsg : ''}
            placeholder="37212"
          />
        </div>
      )}
    </div>
  );
}
