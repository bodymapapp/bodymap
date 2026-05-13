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
    // Two new optional columns. When present, every session created
    // from this row gets the named service (auto-created if it doesn't
    // exist) and the price. That makes the dashboard's
    // sessions/earnings counters reflect imported history. Without
    // these, imported sessions still write but with no session_date /
    // service_id / price, so the dashboard counters can't see them.
    service:      find('service', 'treatment', 'appointment type'),
    price:        find('price', 'session price', 'amount'),
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

    // Cache services by name (lowercased) so we don't query/insert
    // the same service repeatedly across rows. resolveServiceId returns
    // an existing service id if one matches, otherwise creates a new
    // service with the given price and returns the new id.
    const serviceCache = new Map();
    async function resolveServiceId(serviceName, defaultPrice) {
      if (!serviceName) return null;
      const key = serviceName.toLowerCase().trim();
      if (serviceCache.has(key)) return serviceCache.get(key);

      const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('therapist_id', therapist.id)
        .ilike('name', serviceName)
        .maybeSingle();
      if (existing?.id) {
        serviceCache.set(key, existing.id);
        return existing.id;
      }

      // Auto-create. Default duration 60 min if not specified. active
      // false so the new service is hidden from the live booking page
      // until the therapist reviews it (avoids surprises if their CSV
      // has a typoed service name).
      const { data: created, error } = await supabase
        .from('services')
        .insert({
          therapist_id: therapist.id,
          name: serviceName,
          duration: 60,
          price: defaultPrice || 0,
          active: false,
        })
        .select('id')
        .single();
      if (error) {
        console.error('[import] could not auto-create service:', error);
        serviceCache.set(key, null);
        return null;
      }
      serviceCache.set(key, created.id);
      return created.id;
    }

    for (const row of rows) {
      const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx]?.trim() : '';

      const firstName = get(mapping.firstName);
      const lastName  = get(mapping.lastName);
      const email     = get(mapping.email)?.toLowerCase() || null;
      const phone     = get(mapping.phone) || null;
      const notes     = get(mapping.notes) || null;
      const lastVisit = get(mapping.lastVisit) || null;
      const visitCount = parseInt(get(mapping.visitCount)) || null;
      // Optional new columns. If absent, sessions are created without
      // a service_id and the dashboard counters won't see them. If
      // present, the service is auto-resolved/created and the session
      // joins to services.price for earnings.
      const serviceName = get(mapping.service) || null;
      const priceRaw    = get(mapping.price) || null;
      const sessionPrice = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : null;

      // Build best possible name, fall back to email or phone if name missing
      let name = [firstName, lastName].filter(Boolean).join(' ');
      if (!name && email) name = email.split('@')[0].replace(/[._]/g, ' ');
      if (!name && phone) name = `Client ${phone.replace(/\D/g,'').slice(-4)}`;

      // Nothing at all, truly skip
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
          skipped++; // already exists, count as skipped not failed
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

        // Resolve service id once per row. Re-uses the cache across rows
        // for the same service name. May return null if no service column.
        const serviceId = serviceName ? await resolveServiceId(serviceName, sessionPrice) : null;

        // If we have visit history, create a synthetic session to preserve last visit date.
        // session_date is the column the dashboard's stats query reads,
        // so it MUST be set (YYYY-MM-DD format) for the import to count.
        if (lastVisit && client?.id) {
          const parsedDate = new Date(lastVisit);
          if (!isNaN(parsedDate)) {
            const isoDate = parsedDate.toISOString().slice(0, 10);
            await supabase.from('sessions').upsert({
              therapist_id: therapist.id,
              client_id: client.id,
              service_id: serviceId,
              session_date: isoDate,
              completed: true,
              therapist_notes: JSON.stringify({ __soap: true, S:'', O:'', A:'Imported session history', P:'', imported: true }),
              created_at: parsedDate.toISOString(),
              completed_at: parsedDate.toISOString(),
            }, { ignoreDuplicates: true });
          }
        }

        // If we have visit count, create placeholder historical sessions
        // spread BACKWARD from last_visit (or today) at ~2-week intervals
        // so the most recent few fall inside the dashboard's 30-day
        // window and Sessions/Earnings counters are non-zero immediately
        // after import.
        if (visitCount && visitCount > 1 && client?.id) {
          const anchor = lastVisit ? new Date(lastVisit) : new Date();
          // Skip the first one if lastVisit already covered it above
          const startIdx = lastVisit ? 1 : 0;
          const totalToCreate = Math.min(visitCount - startIdx, 10);
          for (let i = 0; i < totalToCreate; i++) {
            const d = new Date(anchor);
            d.setDate(d.getDate() - (i + startIdx) * 14); // every ~2 weeks
            const isoDate = d.toISOString().slice(0, 10);
            await supabase.from('sessions').insert({
              therapist_id: therapist.id,
              client_id: client.id,
              service_id: serviceId,
              session_date: isoDate,
              completed: true,
              therapist_notes: JSON.stringify({ __soap: true, S:'', O:'', A:'Imported session history', P:'', imported: true }),
              created_at: d.toISOString(),
              completed_at: d.toISOString(),
            });
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

        {/* STEP 1, Select platform */}
        {step === 1 && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>Step 1, Where are you coming from?</div>
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

        {/* STEP 2, Upload */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} style={{ background:'none', border:'none', color:C.gray, fontSize:13, cursor:'pointer', marginBottom:16, padding:0 }}>‹ Back</button>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>Step 2, Export from {platform?.label} and upload</div>

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

        {/* STEP 3, Preview & map */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} style={{ background:'none', border:'none', color:C.gray, fontSize:13, cursor:'pointer', marginBottom:16, padding:0 }}>‹ Back</button>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>Step 3, Preview & confirm</div>

            <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#16A34A', fontWeight:600 }}>
              ✅ Found {rows.length} clients in your file
            </div>

            {/* Column mapping */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.gray, marginBottom:10 }}>Column mapping, auto-detected, adjust if needed:</div>
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
                      <option value={-1}>,  skip , </option>
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
                    const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx] : ', ';
                    const name = [get(mapping.firstName), get(mapping.lastName)].filter(v => v && v !== ', ').join(' ') || ', ';
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

        {/* STEP 4, Done */}
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
                All clients already exist in MyBodyMap, no duplicates were created.
              </div>
            )}
            <p style={{ fontSize:13, color:C.gray, marginBottom:20, lineHeight:1.6 }}>
              Visit history has been preserved where available, lapsed detection and pattern intelligence will work immediately for imported clients.
            </p>

            {results.created > 0 && (
              <div style={{
                background: '#F0FDF4',
                border: '1.5px solid #86EFAC',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 20,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>
                  ✉ 30-second next step
                </div>
                <div style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.6, marginBottom: 12 }}>
                  Let your {results.created} {results.created === 1 ? 'client' : 'clients'} know you have moved to a new booking system. We have a warm, ready-to-send template, you just edit your name and tap send.
                </div>
                <button
                  onClick={() => { window.location.href = '/dashboard/outreach?template=wemoved&segment=all'; }}
                  style={{
                    background: '#15803D',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Send the "we moved" email →
                </button>
              </div>
            )}

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
  // Progress state during long imports. { phase, current, total }
  // where phase is 'preparing', 'looking-up-clients',
  // 'creating-new-clients', or 'creating-bookings'.
  const [progress, setProgress] = useState(null);
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
    setError('');
    setProgress({ phase: 'preparing', current: 0, total: rows.length });
    let created = 0, skipped = 0, failed = 0;
    const failureSamples = [];
    const get = (row, idx) => (idx >= 0 && idx < row.length) ? row[idx]?.trim() : '';

    // Robust date parser. Handles common formats from various spa
    // platforms: ISO (2026-05-09), US slash (5/9/2026), US dash
    // (5-9-2026), 2-digit year (5/9/26), and the dotted European
    // form (9.5.2026 / 09.05.26). Returns YYYY-MM-DD or null.
    function parseDate(s) {
      if (!s) return null;
      const trimmed = s.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
      const m = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
      if (m) {
        let [, a, b, y] = m;
        let mm, dd;
        if (parseInt(a) > 12) { dd = a; mm = b; }
        else { mm = a; dd = b; }
        if (y.length === 2) y = (parseInt(y) >= 50 ? '19' : '20') + y;
        return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      }
      const d = new Date(trimmed);
      if (!isNaN(d)) return d.toISOString().split('T')[0];
      return null;
    }

    // ─── Phase 1: Pre-process rows (no DB calls) ───────────────
    // Validate, parse dates/times, build canonical booking objects.
    // Anything that cannot parse goes straight to skipped/failed.
    const prepared = []; // { row data including bookingDate, startTime, endTime, ... }
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

      const bookingDate = parseDate(dateStr);
      if (!bookingDate) {
        failed++;
        if (failureSamples.length < 5) failureSamples.push(`Could not parse date "${dateStr}" for ${clientName}`);
        continue;
      }

      let timeMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm|AM|PM)?/);
      let sh = 9, sm = 0;
      if (timeMatch) {
        sh = parseInt(timeMatch[1]);
        sm = parseInt(timeMatch[2]);
        const ampm = (timeMatch[3] || '').toLowerCase();
        if (ampm === 'pm' && sh < 12) sh += 12;
        if (ampm === 'am' && sh === 12) sh = 0;
      }
      const startTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      const endMin = sh * 60 + sm + duration;
      const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      prepared.push({
        clientName, clientEmail, clientPhone, service, bookingDate,
        startTime, endTime, duration, price, notes,
      });
    }

    if (prepared.length === 0) {
      setResults({ created, skipped, failed, failureSamples });
      setImporting(false);
      setProgress(null);
      return;
    }

    // ─── Phase 2: Pre-fetch all existing clients for this therapist ──
    // Build lookup maps so we can match each booking row to a
    // client_id without hitting the DB per row. Single query
    // replaces ~1600 individual lookups.
    setProgress({ phase: 'looking-up-clients', current: 0, total: prepared.length });
    const { data: existingClients, error: fetchErr } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .eq('therapist_id', therapist.id);

    if (fetchErr) {
      setError(`Could not load existing clients: ${fetchErr.message}`);
      setImporting(false);
      setProgress(null);
      return;
    }

    const emailToId = new Map();
    const phoneToId = new Map();
    const nameToId = new Map();
    for (const c of (existingClients || [])) {
      if (c.email) emailToId.set(c.email.toLowerCase().trim(), c.id);
      if (c.phone) phoneToId.set(c.phone.trim(), c.id);
      if (c.name)  nameToId.set(c.name.trim().toLowerCase(), c.id);
    }

    // ─── Phase 2.5: Pre-fetch existing bookings for duplicate detection ──
    //
    // Re-running an import should not double-create bookings. Build
    // a Set of stable identity keys for already-existing bookings:
    //   "<email_or_phone_or_name>|<date>|<start>"
    // Then filter prepared rows that already match before we insert.
    //
    // Identity precedence: email > phone > name. Whatever the row
    // has, that is the key. Same precedence we use for client
    // matching, so a row that previously imported with a phone-only
    // signature will dedupe correctly even if a later row imports
    // with the same name.
    const { data: existingBookings, error: bkFetchErr } = await supabase
      .from('bookings')
      .select('client_email, client_phone, client_name, booking_date, start_time')
      .eq('therapist_id', therapist.id);

    if (bkFetchErr) {
      console.warn('[import] could not load existing bookings; skipping dedupe', bkFetchErr);
    }

    const existingBookingKeys = new Set();
    function bookingKey(emailLower, phone, nameLower, date, start) {
      const id = emailLower || phone || nameLower || 'unknown';
      // start time may come back as 'HH:MM' or 'HH:MM:SS'; normalize
      const startNorm = (start || '').slice(0, 5);
      return `${id}|${date}|${startNorm}`;
    }
    for (const b of (existingBookings || [])) {
      const emailLower = b.client_email ? b.client_email.toLowerCase().trim() : null;
      const phone = b.client_phone ? b.client_phone.trim() : null;
      const nameLower = b.client_name ? b.client_name.toLowerCase().trim() : null;
      existingBookingKeys.add(bookingKey(emailLower, phone, nameLower, b.booking_date, b.start_time));
    }

    // Filter prepared rows to drop duplicates of existing bookings.
    // Track skipped count so the user sees what happened.
    const dedupedPrepared = [];
    let dupSkipped = 0;
    const seenInThisRun = new Set();
    for (const p of prepared) {
      const emailLower = p.clientEmail ? p.clientEmail.toLowerCase().trim() : null;
      const phone = p.clientPhone ? p.clientPhone.trim() : null;
      const nameLower = p.clientName ? p.clientName.toLowerCase().trim() : null;
      const key = bookingKey(emailLower, phone, nameLower, p.bookingDate, p.startTime);
      if (existingBookingKeys.has(key) || seenInThisRun.has(key)) {
        dupSkipped++;
        continue;
      }
      seenInThisRun.add(key);
      dedupedPrepared.push(p);
    }
    skipped += dupSkipped;
    if (dupSkipped > 0 && failureSamples.length < 5) {
      failureSamples.push(`Skipped ${dupSkipped} appointment${dupSkipped === 1 ? '' : 's'} that already existed.`);
    }
    // Replace the prepared variable for downstream phases. Use let
    // semantics by reassigning the array reference via splice.
    prepared.length = 0;
    for (const p of dedupedPrepared) prepared.push(p);

    if (prepared.length === 0) {
      setResults({ created, skipped, failed, failureSamples });
      setImporting(false);
      setProgress(null);
      if (onComplete) onComplete();
      return;
    }

    // ─── Phase 3: Identify new clients to create ──────────────
    // For each prepared row, find or queue a client. If queued
    // (new), we will bulk-insert all queued clients in one shot.
    const newClientsToCreate = []; // { signature, name, email, phone }
    const signatureToQueued = new Map(); // dedupe within same import

    function clientSignature(name, email, phone) {
      // Stable identifier for grouping rows that refer to the same
      // person. Email > phone > lowercase-name precedence.
      if (email) return `e:${email}`;
      if (phone) return `p:${phone}`;
      return `n:${name.toLowerCase().trim()}`;
    }

    for (const p of prepared) {
      const sig = clientSignature(p.clientName, p.clientEmail, p.clientPhone);
      let id = null;
      if (p.clientEmail) id = emailToId.get(p.clientEmail.toLowerCase().trim());
      if (!id && p.clientPhone) id = phoneToId.get(p.clientPhone.trim());
      if (!id && !p.clientEmail && !p.clientPhone) {
        // Name-only match (legacy spa data without contact info)
        id = nameToId.get(p.clientName.trim().toLowerCase());
      }
      if (id) {
        p._clientId = id;
      } else {
        if (!signatureToQueued.has(sig)) {
          signatureToQueued.set(sig, {
            therapist_id: therapist.id,
            name: p.clientName,
            email: p.clientEmail,
            phone: p.clientPhone,
            imported_from: 'Appointment Import',
            _signature: sig,
          });
        }
      }
    }

    // ─── Phase 4: Bulk insert new clients ─────────────────────
    if (signatureToQueued.size > 0) {
      setProgress({ phase: 'creating-new-clients', current: 0, total: signatureToQueued.size });
      const newClientRows = [...signatureToQueued.values()].map(c => {
        const { _signature, ...rest } = c;
        return rest;
      });
      // Insert in chunks of 100 to be safe with payload size
      const sigOrder = [...signatureToQueued.keys()];
      const insertedSigs = []; // signatures in order with their new IDs
      for (let i = 0; i < newClientRows.length; i += 100) {
        const chunk = newClientRows.slice(i, i + 100);
        const sigChunk = sigOrder.slice(i, i + 100);
        const { data: insertedRows, error: insErr } = await supabase
          .from('clients')
          .insert(chunk)
          .select('id');
        if (insErr) {
          setError(`Could not create clients: ${insErr.message}`);
          setImporting(false);
          setProgress(null);
          return;
        }
        for (let j = 0; j < (insertedRows || []).length; j++) {
          insertedSigs.push([sigChunk[j], insertedRows[j].id]);
        }
        setProgress({ phase: 'creating-new-clients', current: Math.min(i + 100, newClientRows.length), total: newClientRows.length });
      }
      const sigToNewId = new Map(insertedSigs);
      // Now back-fill _clientId on prepared rows that were queued
      for (const p of prepared) {
        if (p._clientId) continue;
        const sig = clientSignature(p.clientName, p.clientEmail, p.clientPhone);
        const newId = sigToNewId.get(sig);
        if (newId) p._clientId = newId;
      }
    }

    // ─── Phase 4.5: Resolve service_id for each prepared row ──
    //
    // The bookings table has BOTH service_id (FK to services) and
    // service_name (text denorm). Public booking flow uses
    // service_id; CSV imports historically only had a service name
    // string. We do the work to resolve names to IDs so imported
    // bookings link properly to the therapist's services list.
    //
    // Strategy:
    //   1. Pre-fetch this therapist's existing services by name
    //   2. For service names in the CSV with no match, bulk-create
    //      using duration/price from the first row that mentions it
    //   3. Map each prepared row to its service_id
    //
    // service_id is nullable on bookings, so if creation fails the
    // booking still goes through with service_name (text) only.
    setProgress({ phase: 'matching-services', current: 0, total: prepared.length });
    const { data: existingServices } = await supabase
      .from('services')
      .select('id, name, duration, price')
      .eq('therapist_id', therapist.id);

    const svcNameToId = new Map();
    for (const s of (existingServices || [])) {
      if (s.name) svcNameToId.set(s.name.toLowerCase().trim(), s.id);
    }

    // Identify unique service names from CSV that need creation
    const newServicesByName = new Map(); // name (raw) -> { name, duration, price }
    for (const p of prepared) {
      const key = (p.service || '').toLowerCase().trim();
      if (!key) continue;
      if (svcNameToId.has(key)) continue;
      if (!newServicesByName.has(key)) {
        newServicesByName.set(key, {
          therapist_id: therapist.id,
          name: p.service,
          duration: p.duration || 60,
          price: p.price || 0,
          active: true,
        });
      }
    }

    // Bulk-create new services in chunks of 100
    if (newServicesByName.size > 0) {
      const newSvcRows = [...newServicesByName.values()];
      const newSvcKeys = [...newServicesByName.keys()];
      for (let i = 0; i < newSvcRows.length; i += 100) {
        const chunk = newSvcRows.slice(i, i + 100);
        const keyChunk = newSvcKeys.slice(i, i + 100);
        const { data: insSvcs, error: svcErr } = await supabase
          .from('services')
          .insert(chunk)
          .select('id');
        if (svcErr) {
          // Non-fatal: fall through and let bookings get null service_id
          console.warn('[import] service insert error:', svcErr);
          break;
        }
        for (let j = 0; j < (insSvcs || []).length; j++) {
          svcNameToId.set(keyChunk[j], insSvcs[j].id);
        }
      }
    }

    // ─── Phase 5: Bulk insert bookings ─────────────────────────
    //
    // Production bookings schema does NOT have duration or price
    // columns. Both are derived from the joined service. We pass
    // service_name (denorm text) and service_id (FK), nothing else.
    // Confirmed via information_schema diagnostic (May 9 2026).
    const bookingRows = prepared
      .filter(p => p._clientId)
      .map(p => {
        const svcKey = (p.service || '').toLowerCase().trim();
        const serviceId = svcKey ? (svcNameToId.get(svcKey) || null) : null;
        return {
          therapist_id: therapist.id,
          client_name:  p.clientName,
          client_email: p.clientEmail,
          client_phone: p.clientPhone,
          client_id:    p._clientId,
          service_id:   serviceId,
          service_name: p.service,
          booking_date: p.bookingDate,
          start_time:   p.startTime,
          end_time:     p.endTime,
          status:       'confirmed',
          notes:        p.notes,
          imported:     true,
        };
      });

    setProgress({ phase: 'creating-bookings', current: 0, total: bookingRows.length });
    for (let i = 0; i < bookingRows.length; i += 100) {
      const chunk = bookingRows.slice(i, i + 100);
      const { error: bkErr } = await supabase.from('bookings').insert(chunk);
      if (bkErr) {
        // Chunk failed wholesale. Fall back to per-row to capture
        // which specific row(s) caused it, so we can report. This
        // is rare; bulk should usually succeed once schema is right.
        for (const r of chunk) {
          const { error: rowErr } = await supabase.from('bookings').insert(r);
          if (rowErr) {
            failed++;
            if (failureSamples.length < 5) {
              failureSamples.push(`${r.client_name} ${r.booking_date}: ${rowErr.message}`);
            }
          } else {
            created++;
          }
        }
      } else {
        created += chunk.length;
      }
      setProgress({ phase: 'creating-bookings', current: Math.min(i + 100, bookingRows.length), total: bookingRows.length });
    }

    // Rows that did not get a client_id are counted as failed
    failed += prepared.filter(p => !p._clientId).length;

    setResults({ created, skipped, failed, failureSamples });
    setImporting(false);
    setProgress(null);
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
        <div style={{ padding: '8px 0' }}>
          {/* Honest results UI. The previous version always said
              "Appointments imported!" even when created=0. Jiny
              reported May 8 that 1600 appointments showed "success"
              but none appeared in Schedule. Now the header reflects
              actual outcome: green check only if at least one was
              created, yellow caution if all failed, red error if
              import threw. Failure samples shown so therapist can
              fix the CSV and retry. */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>
              {results.created === 0 && results.failed > 0 ? '⚠️' : results.created > 0 ? '✅' : '📅'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
              {results.created === 0 && results.failed > 0
                ? `No appointments were imported`
                : results.created > 0 && results.failed === 0
                  ? `${results.created} appointment${results.created === 1 ? '' : 's'} imported`
                  : `${results.created} of ${results.created + results.failed + results.skipped} imported`}
            </div>
            <div style={{ fontSize: 13, color: C.gray }}>
              {results.created} added · {results.skipped} skipped · {results.failed} failed
            </div>
          </div>

          {results.failed > 0 && results.failureSamples?.length > 0 && (
            <div style={{
              background: '#FEF3C7',
              border: '1.5px solid #FCD34D',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 12,
              fontSize: 12,
              color: '#78350F',
              lineHeight: 1.55,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>What went wrong (first {Math.min(5, results.failureSamples.length)}):</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {results.failureSamples.map((m, idx) => (
                  <li key={idx} style={{ marginBottom: 3 }}>{m}</li>
                ))}
              </ul>
              {results.failed > 5 && (
                <div style={{ marginTop: 6, fontStyle: 'italic' }}>
                  ... and {results.failed - 5} more rows with similar issues.
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                Common fixes: make sure every row has a Client Name and Date column. Date can be 5/9/2026, 2026-05-09, or 9.5.2026 format. Time can be 14:30 or 2:30 PM.
              </div>
            </div>
          )}

          {results.created > 0 && (
            <p style={{ fontSize: 12, color: C.gray, textAlign: 'center', margin: 0 }}>
              Check your Schedule tab to see them.
            </p>
          )}
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
                  const get = (idx) => (idx >= 0 && idx < row.length) ? row[idx] : ', ';
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

          {/* Progress display during long imports. Without this,
              1600+ rows can feel hung. Phase + count + percentage
              tell the therapist work is happening. */}
          {importing && progress && (
            <div style={{
              marginTop: 14,
              padding: '12px 14px',
              background: '#F5F0E8',
              border: '1px solid #DDD4C2',
              borderRadius: 10,
              fontSize: 12,
              color: '#3D4A42',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  {progress.phase === 'preparing'             && 'Preparing rows'}
                  {progress.phase === 'looking-up-clients'    && 'Matching to existing clients'}
                  {progress.phase === 'creating-new-clients'  && 'Creating new clients'}
                  {progress.phase === 'matching-services'     && 'Matching services'}
                  {progress.phase === 'creating-bookings'     && 'Saving appointments'}
                </span>
                <span style={{ color: '#6B7280' }}>
                  {progress.current.toLocaleString()} of {progress.total.toLocaleString()}
                </span>
              </div>
              <div style={{
                height: 6, background: '#E8E4DC', borderRadius: 999, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((progress.current / Math.max(1, progress.total)) * 100))}%`,
                  background: C.forest,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
