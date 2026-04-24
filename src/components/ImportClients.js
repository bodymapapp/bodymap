import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC' };

const PLATFORMS = [
  { id:'vagaro',       label:'Vagaro',        cols:['First Name','Last Name','Email','Mobile Phone','Notes'] },
  { id:'massagebook',  label:'MassageBook',   cols:['First Name','Last Name','Email','Phone','Notes'] },
  { id:'glossgenius',  label:'GlossGenius',   cols:['First Name','Last Name','Email','Phone'] },
  { id:'mindbody',     label:'Mindbody',      cols:['Client First Name','Client Last Name','Email','Mobile Phone','Visit Count','Last Visit Date'] },
  { id:'square',       label:'Square',        cols:['Given Name','Family Name','Email Address','Phone Number'] },
  { id:'other',        label:'Other / Generic CSV', cols:[] },
];

// Auto-detect which column maps to which field
function detectMapping(headers) {
  const h = headers.map(h => h.toLowerCase().trim());
  const find = (...terms) => {
    for (const t of terms) {
      const i = h.findIndex(x => x.includes(t));
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    firstName:    find('first name', 'firstname', 'given name', 'client first'),
    lastName:     find('last name', 'lastname', 'family name', 'client last'),
    email:        find('email'),
    phone:        find('mobile', 'phone', 'cell'),
    notes:        find('notes', 'note', 'comments'),
    visitCount:   find('visit count', 'visits', 'appointment count'),
    lastVisit:    find('last visit', 'last appointment', 'last seen'),
  };
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow).filter(r => r.some(c => c));
  return { headers, rows };
}

export default function ImportClients({ therapist, onComplete }) {
  const [step, setStep] = useState(1);
  const [importTab, setImportTab] = useState('clients'); // 'clients' | 'appointments'
  const [platform, setPlatform] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const isMobile = window.innerWidth < 768;

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      if (!headers.length) { setError('Could not read CSV. Make sure it has a header row.'); return; }
      setHeaders(headers);
      setRows(rows);
      setMapping(detectMapping(headers));
      setError('');
      setStep(3);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    setImporting(true);
    let created = 0, skipped = 0, failed = 0;

    for (const row of rows) {
      const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx]?.trim() : '';

      const firstName = get(mapping.firstName);
      const lastName  = get(mapping.lastName);
      const email     = get(mapping.email)?.toLowerCase() || null;
      const phone     = get(mapping.phone) || null;
      const notes     = get(mapping.notes) || null;
      const lastVisit = get(mapping.lastVisit) || null;
      const visitCount = parseInt(get(mapping.visitCount)) || null;

      // Build best possible name — fall back to email or phone if name missing
      let name = [firstName, lastName].filter(Boolean).join(' ');
      if (!name && email) name = email.split('@')[0].replace(/[._]/g, ' ');
      if (!name && phone) name = `Client ${phone.replace(/\D/g,'').slice(-4)}`;
      
      // Nothing at all — truly skip
      if (!name && !email && !phone) { skipped++; continue; }

      try {
        let client = null;

        // Check for existing client by email (only if email present) or name+phone
        let existingQuery = supabase.from('clients').select('id').eq('therapist_id', therapist.id);
        if (email) {
          const { data: byEmail } = await existingQuery.eq('email', email).maybeSingle();
          if (byEmail) client = byEmail;
        }
        if (!client && phone) {
          const { data: byPhone } = await supabase.from('clients').select('id')
            .eq('therapist_id', therapist.id).eq('phone', phone).maybeSingle();
          if (byPhone) client = byPhone;
        }
        if (!client) {
          const { data: byName } = await supabase.from('clients').select('id')
            .eq('therapist_id', therapist.id).ilike('name', name).maybeSingle();
          if (byName) client = byName;
        }

        if (client) {
          // Update existing with any new info
          const updates = {};
          if (email && !client.email) updates.email = email;
          if (phone && !client.phone) updates.phone = phone;
          if (Object.keys(updates).length) {
            await supabase.from('clients').update(updates).eq('id', client.id);
          }
          skipped++; // already exists — count as skipped not failed
        } else {
          // Insert new client
          const payload = { therapist_id: therapist.id, name };
          if (email) payload.email = email;
          if (phone) payload.phone = phone;
          if (notes) payload.notes = notes;

          const { data: newClient, error: insertErr } = await supabase
            .from('clients').insert(payload).select('id').single();

          if (insertErr) { failed++; continue; }
          client = newClient;
          created++;
        }

        // If we have visit history, create a synthetic session to preserve last visit date
        if (lastVisit && client?.id) {
          const parsedDate = new Date(lastVisit);
          if (!isNaN(parsedDate)) {
            await supabase.from('sessions').upsert({
              therapist_id: therapist.id,
              client_id: client.id,
              completed: true,
              therapist_notes: JSON.stringify({ __soap: true, S:'', O:'', A:'Imported session history', P:'', imported: true }),
              created_at: parsedDate.toISOString(),
              completed_at: parsedDate.toISOString(),
            }, { ignoreDuplicates: true });
          }
        }

        // If we have visit count but no last visit, create placeholder sessions
        if (visitCount && visitCount > 1 && !lastVisit && client?.id) {
          const now = new Date();
          for (let i = 0; i < Math.min(visitCount - 1, 10); i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - (i + 1) * 30); // approximate monthly
            await supabase.from('sessions').insert({
              therapist_id: therapist.id,
              client_id: client.id,
              completed: true,
              therapist_notes: JSON.stringify({ __soap: true, S:'', O:'', A:'Imported session history', P:'', imported: true }),
              created_at: d.toISOString(),
              completed_at: d.toISOString(),
            }).select();
          }
        }

      } catch(e) { console.error('Import row error:', e, row); failed++; }
    }

    setResults({ created, skipped, failed, total: rows.length });
    setImporting(false);
    setStep(4);
    // Log activation (imported at least one client)
    if (created > 0 && therapist?.id) {
      try {
        const { trackActivation } = await import('../lib/activation');
        trackActivation(therapist.id, 'imported_clients', { count: created });
      } catch {}
    }
    if (onComplete) onComplete();
  }

  const previewRows = rows.slice(0, 5);

  return (
    <div style={{ background:C.white, borderRadius:16, border:`1.5px solid ${C.light}`, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:C.forest, padding:'20px 24px' }}>
        <h3 style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#fff', margin:'0 0 4px' }}>Import Clients from Another Platform</h3>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', margin:0 }}>Transfer your client list from MassageBook, Vagaro, GlossGenius, Mindbody, or any CSV file.</p>
      </div>

      {/* Mobile notice */}
      {isMobile && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', margin:16, borderRadius:10, padding:'14px 16px' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#92400E', marginBottom:4 }}>📱 Best done on a computer</div>
          <div style={{ fontSize:13, color:'#78350F', lineHeight:1.5 }}>
            Importing clients requires uploading a CSV file. To do this:
            <ol style={{ margin:'8px 0 0 16px', padding:0 }}>
              <li>Export your client list from your current platform</li>
              <li>Open mybodymap.app on your computer</li>
              <li>Go to Settings → Import Clients</li>
            </ol>
          </div>
          <div style={{ fontSize:12, color:'#92400E', marginTop:8, fontStyle:'italic' }}>Your clients will sync instantly once imported.</div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.light}` }}>
        {[{id:'clients',label:'👥 Import Clients'},{id:'appointments',label:'📅 Import Appointments'}].map(t => (
          <button key={t.id} onClick={() => setImportTab(t.id)}
            style={{ flex:1, padding:'12px', border:'none', borderBottom:importTab===t.id?`2px solid ${C.forest}`:'2px solid transparent', background:'transparent', color:importTab===t.id?C.forest:C.gray, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:24 }}>
        {importTab === 'appointments' && <ImportBookings therapist={therapist} onComplete={onComplete} />}
        {importTab === 'clients' && <>

        {/* STEP 1 — Select platform */}
        {step === 1 && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>Step 1 — Where are you coming from?</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => { setPlatform(p); setStep(2); }}
                  style={{ padding:'14px 12px', borderRadius:10, border:`1.5px solid ${C.light}`, background:C.beige, cursor:'pointer', textAlign:'center', fontSize:13, fontWeight:700, color:C.dark, transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.forest; e.currentTarget.style.background = '#F0FDF4'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.light; e.currentTarget.style.background = C.beige; }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Upload */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} style={{ background:'none', border:'none', color:C.gray, fontSize:13, cursor:'pointer', marginBottom:16, padding:0 }}>‹ Back</button>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>Step 2 — Export from {platform?.label} and upload</div>

            <div style={{ background:C.beige, borderRadius:12, padding:16, marginBottom:20, fontSize:13, color:C.gray, lineHeight:1.7 }}>
              <strong style={{ color:C.dark }}>How to export from {platform?.label}:</strong>
              {platform?.id === 'vagaro' && <div>Vagaro → Clients → Export → Download CSV</div>}
              {platform?.id === 'massagebook' && <div>Business Profile → Clients → Import/Export → Export client file</div>}
              {platform?.id === 'glossgenius' && <div>GlossGenius → Clients → ⋯ menu → Export</div>}
              {platform?.id === 'mindbody' && <div>Mindbody → Clients → Client List → Export → CSV</div>}
              {platform?.id === 'square' && <div>Square Dashboard → Customers → Directory → Import/Export → Export Customers</div>}
              {platform?.id === 'other' && <div>Export your client list as a CSV from your current platform. Make sure the first row has column headers.</div>}
            </div>

            <div onClick={() => fileRef.current?.click()}
              style={{ border:`2px dashed ${C.light}`, borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:'#FAFAF9' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.sage}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.light}>
              <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:4 }}>Click to upload your CSV file</div>
              <div style={{ fontSize:12, color:C.gray }}>or drag and drop</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:'none' }} />
            </div>
            {error && <div style={{ color:'#EF4444', fontSize:13, marginTop:10 }}>{error}</div>}
          </div>
        )}

        {/* STEP 3 — Preview & map */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} style={{ background:'none', border:'none', color:C.gray, fontSize:13, cursor:'pointer', marginBottom:16, padding:0 }}>‹ Back</button>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>Step 3 — Preview & confirm</div>

            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#16A34A', fontWeight:600 }}>
              ✅ Found {rows.length} clients in your file
            </div>

            {/* Column mapping */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.gray, marginBottom:10 }}>Column mapping — auto-detected, adjust if needed:</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }} className="bm-2col">
                {[
                  { key:'firstName', label:'First Name *' },
                  { key:'lastName',  label:'Last Name' },
                  { key:'email',     label:'Email' },
                  { key:'phone',     label:'Phone' },
                  { key:'notes',     label:'Notes' },
                  { key:'lastVisit', label:'Last Visit Date' },
                  { key:'visitCount',label:'Visit Count' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, color:C.gray, width:100, flexShrink:0 }}>{label}</span>
                    <select value={mapping[key] >= 0 ? mapping[key] : -1}
                      onChange={e => setMapping(m => ({ ...m, [key]: parseInt(e.target.value) }))}
                      style={{ flex:1, padding:'6px 8px', border:`1.5px solid ${C.light}`, borderRadius:6, fontSize:12, outline:'none', background:'#fff' }}>
                      <option value={-1}>— skip —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div style={{ overflowX:'auto', marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.gray, marginBottom:8 }}>Preview (first 5 rows):</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:C.beige }}>
                    {['Name','Email','Phone','Notes','Last Visit'].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:C.gray, borderBottom:`1px solid ${C.light}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx] : '—';
                    const name = [get(mapping.firstName), get(mapping.lastName)].filter(v => v && v !== '—').join(' ') || '—';
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.light}` }}>
                        <td style={{ padding:'8px 10px', color:C.dark, fontWeight:600 }}>{name}</td>
                        <td style={{ padding:'8px 10px', color:C.gray }}>{get(mapping.email)}</td>
                        <td style={{ padding:'8px 10px', color:C.gray }}>{get(mapping.phone)}</td>
                        <td style={{ padding:'8px 10px', color:C.gray, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{get(mapping.notes)}</td>
                        <td style={{ padding:'8px 10px', color:C.gray }}>{get(mapping.lastVisit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 5 && <div style={{ fontSize:11, color:C.gray, marginTop:6 }}>...and {rows.length - 5} more clients</div>}
            </div>

            <button onClick={runImport} disabled={importing || mapping.firstName < 0}
              style={{ width:'100%', background:importing?C.sage:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:importing?'wait':'pointer' }}>
              {importing ? `Importing ${rows.length} clients…` : `Import ${rows.length} Clients →`}
            </button>
            <p style={{ fontSize:11, color:C.gray, textAlign:'center', marginTop:8 }}>
              Any row with a name, phone, or email gets imported. Missing info can be filled in later from each client's profile.
            </p>
          </div>
        )}

        {/* STEP 4 — Done */}
        {step === 4 && results && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
            <h3 style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:C.dark, margin:'0 0 8px' }}>Import complete!</h3>
            <p style={{ fontSize:15, color:C.gray, margin:'0 0 24px' }}>
              {results.created > 0
                ? `${results.created} client${results.created !== 1 ? 's' : ''} from ${platform?.label} are now in MyBodyMap.`
                : `All clients from ${platform?.label} were already in MyBodyMap.`}
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
              {[
                { label:'Imported', value:results.created, color:C.forest },
                { label:'Already existed', value:results.skipped, color:C.gray },
                { label:'Failed', value:results.failed, color: results.failed > 0 ? '#EF4444' : C.gray },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:C.beige, borderRadius:10, padding:'16px 8px' }}>
                  <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
                  <div style={{ fontSize:12, color:C.gray }}>{label}</div>
                </div>
              ))}
            </div>
            {results.failed > 0 && (
              <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#991B1B', textAlign:'left', lineHeight:1.6 }}>
                <strong>{results.failed} rows failed.</strong> Most common cause: rows missing both a name and email. Open your CSV, make sure every client has at least a first name, then try again.
              </div>
            )}
            {results.created === 0 && results.skipped > 0 && (
              <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#1D4ED8', textAlign:'left', lineHeight:1.6 }}>
                All clients already exist in MyBodyMap — no duplicates were created.
              </div>
            )}
            <p style={{ fontSize:13, color:C.gray, marginBottom:20, lineHeight:1.6 }}>
              Visit history has been preserved where available — lapsed detection and pattern intelligence will work immediately for imported clients.
            </p>
            <button onClick={() => { setStep(1); setPlatform(null); setHeaders([]); setRows([]); setResults(null); }}
              style={{ background:C.beige, color:C.forest, border:`1.5px solid ${C.light}`, borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Import another file
            </button>
          </div>
        )}
        </>}
      </div>
    </div>
  );
}

// ─── Appointment Import Component ────────────────────────────────────────────
export function ImportBookings({ therapist, onComplete }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  function detectBookingMapping(headers) {
    const h = headers.map(x => x.toLowerCase().trim());
    const find = (...terms) => {
      for (const t of terms) {
        const i = h.findIndex(x => x.includes(t));
        if (i >= 0) return i;
      }
      return -1;
    };
    return {
      clientName:  find('client name', 'name', 'client'),
      clientEmail: find('email'),
      clientPhone: find('phone', 'mobile'),
      service:     find('service', 'treatment', 'appointment type'),
      date:        find('date'),
      startTime:   find('start time', 'time', 'start'),
      duration:    find('duration', 'length', 'minutes'),
      price:       find('price', 'amount', 'cost'),
      notes:       find('notes', 'note', 'comments'),
    };
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      if (!headers.length) { setError('Could not read CSV.'); return; }
      setHeaders(headers);
      setRows(rows);
      setMapping(detectBookingMapping(headers));
      setError('');
    };
    reader.readAsText(file);
  }

  async function runImport() {
    setImporting(true);
    let created = 0, skipped = 0, failed = 0;
    const get = (row, idx) => (idx >= 0 && idx < row.length) ? row[idx]?.trim() : '';

    for (const row of rows) {
      const clientName  = get(row, mapping.clientName);
      const clientEmail = get(row, mapping.clientEmail)?.toLowerCase() || null;
      const clientPhone = get(row, mapping.clientPhone) || null;
      const service     = get(row, mapping.service) || 'Session';
      const dateStr     = get(row, mapping.date);
      const timeStr     = get(row, mapping.startTime) || '09:00';
      const duration    = parseInt(get(row, mapping.duration)) || 60;
      const price       = parseFloat(get(row, mapping.price)) || 0;
      const notes       = get(row, mapping.notes) || '';

      if (!clientName || !dateStr) { skipped++; continue; }

      try {
        // Parse date
        const d = new Date(dateStr);
        if (isNaN(d)) { skipped++; continue; }
        const bookingDate = d.toISOString().split('T')[0];

        // Parse start time
        const timeParsed = timeStr.match(/(\d+):(\d+)/);
        const startTime = timeParsed ? `${String(parseInt(timeParsed[1])).padStart(2,'0')}:${timeParsed[2]}` : '09:00';
        const [sh, sm] = startTime.split(':').map(Number);
        const endMin = sh * 60 + sm + duration;
        const endTime = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;

        // Upsert client first
        const { data: client } = await supabase.from('clients')
          .upsert({ therapist_id: therapist.id, name: clientName, email: clientEmail, phone: clientPhone, imported_from: 'Appointment Import' },
            { onConflict: 'therapist_id,email', ignoreDuplicates: false })
          .select().single();

        // Create booking
        await supabase.from('bookings').insert({
          therapist_id:  therapist.id,
          client_name:   clientName,
          client_email:  clientEmail,
          client_phone:  clientPhone,
          client_id:     client?.id || null,
          booking_date:  bookingDate,
          start_time:    startTime,
          end_time:      endTime,
          duration,
          price,
          service_name:  service,
          status:        'confirmed',
          notes,
          imported:      true,
        });

        created++;
      } catch(e) { failed++; }
    }

    setResults({ created, skipped, failed });
    setImporting(false);
    if (onComplete) onComplete();
  }

  return (
    <div>
      <p style={{ fontSize:12, color:C.gray, marginBottom:14, lineHeight:1.5 }}>
        Import upcoming appointments from your previous platform. Each booking will appear in your Schedule tab. Reminder emails will only fire for future bookings within 24–48 hours.
      </p>

      {!rows.length ? (
        <div>
          <div onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${C.light}`, borderRadius:12, padding:'32px 24px', textAlign:'center', cursor:'pointer', background:'#FAFAF9' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.sage}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.light}>
            <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:4 }}>Upload appointments CSV</div>
            <div style={{ fontSize:12, color:C.gray }}>Columns needed: Client Name, Date, Start Time, Service, Duration</div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }} />
          </div>
          {error && <div style={{ color:'#EF4444', fontSize:13, marginTop:8 }}>{error}</div>}
        </div>
      ) : results ? (
        <div style={{ textAlign:'center', padding:'16px 0' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.dark, marginBottom:4 }}>Appointments imported!</div>
          <div style={{ fontSize:13, color:C.gray }}>{results.created} added · {results.skipped} skipped · {results.failed} failed</div>
          <p style={{ fontSize:12, color:C.gray, marginTop:10 }}>Check your Schedule tab to see them.</p>
        </div>
      ) : (
        <div>
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#16A34A', fontWeight:600 }}>
            Found {rows.length} appointments
          </div>
          <div style={{ overflowX:'auto', marginBottom:16 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:C.beige }}>
                {['Client','Service','Date','Time','Duration'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700, color:C.gray, borderBottom:`1px solid ${C.light}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice(0,5).map((row, i) => {
                  const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx] : '—';
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.light}` }}>
                      <td style={{ padding:'7px 10px' }}>{get(mapping.clientName)}</td>
                      <td style={{ padding:'7px 10px', color:C.gray }}>{get(mapping.service)}</td>
                      <td style={{ padding:'7px 10px', color:C.gray }}>{get(mapping.date)}</td>
                      <td style={{ padding:'7px 10px', color:C.gray }}>{get(mapping.startTime)}</td>
                      <td style={{ padding:'7px 10px', color:C.gray }}>{get(mapping.duration)} min</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 5 && <div style={{ fontSize:11, color:C.gray, marginTop:4 }}>...and {rows.length - 5} more</div>}
          </div>
          <button onClick={runImport} disabled={importing}
            style={{ width:'100%', background:importing?C.sage:C.forest, color:'#fff', border:'none', borderRadius:10, padding:'12px', fontSize:14, fontWeight:700, cursor:importing?'wait':'pointer' }}>
            {importing ? `Importing ${rows.length} appointments…` : `Import ${rows.length} Appointments →`}
          </button>
        </div>
      )}
    </div>
  );
}
