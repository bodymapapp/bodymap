#!/usr/bin/env python3
"""
Build the new Settings JSX panel (with 5 groups, taxonomy, time badges,
combined intake+QR row, search filtering) from /tmp/settings_blocks.json.

Writes the new JSX to /tmp/new_settings_jsx.txt, ready to be spliced into
Dashboard.js between the SettingsHero search bar and the closing </div>.
"""

import json
import pathlib
import re

blocks = json.loads(pathlib.Path("/tmp/settings_blocks.json").read_text())

# ─── Step 1: Wrap each block with a {matchesSearch(...) && (...)} guard
# so search filtering hides non-matching rows. We pull out the label and
# summary from each block and pass them to matchesSearch().

def label_summary_taxonomy(block_text):
    label = re.search(r'\blabel="([^"]+)"|\blabel=\{([^}]+)\}', block_text)
    summary = re.search(r'\bsummary=\{([^}]+)\}|\bsummary="([^"]+)"', block_text)
    taxonomy = re.search(r'\btaxonomy="([^"]+)"', block_text)
    label_str = (label.group(1) or label.group(2)) if label else ""
    summary_str = ""
    if summary:
        summary_str = summary.group(2) if summary.group(2) else ""
    tax_str = taxonomy.group(1) if taxonomy else ""
    # For matchesSearch we rebuild a JS-side string. Use the block's literal
    # label/summary (only the static string portions). Falls back to taxonomy.
    return label_str, summary_str, tax_str

def search_wrap(block_text, label, summary, taxonomy):
    """Wrap a block in {matchesSearch('label','summary','taxonomy') && (<>...</>)}.
    Strip any leading comment block to keep things clean."""
    # Strip leading comment lines (both /* */ and {/* */} styles)
    lines = block_text.split("\n")
    clean = []
    in_jsx_comment = False
    in_block_comment = False
    started = False
    for ln in lines:
        s = ln.strip()
        if not started:
            if not s:
                continue
            if s.startswith("{/*") and not s.endswith("*/}"):
                in_jsx_comment = True
                continue
            if in_jsx_comment:
                if s.endswith("*/}"):
                    in_jsx_comment = False
                continue
            if s.startswith("{/*") and s.endswith("*/}"):
                continue
            if s.startswith("/*") and not s.endswith("*/"):
                in_block_comment = True
                continue
            if in_block_comment:
                if s.endswith("*/"):
                    in_block_comment = False
                continue
            if s.startswith("//"):
                continue
            started = True
        clean.append(ln)
    block_no_comment = "\n".join(clean)
    L = label.replace("'", "\\'")
    S = summary.replace("'", "\\'")
    return (
        f"      {{matchesSearch('{L}', '{S}', '{taxonomy}') && (<>\n"
        f"{block_no_comment}\n"
        f"      </>)}}\n"
    )

# Build the combined intake+QR row.
# We take the intake block's body text and the qrcodes body text, render
# them as two stacked sections inside one CollapsibleSection.
def build_combined_intake_qr():
    return """      {matchesSearch('Client intake & QR codes', 'Share your link or QR codes for clients', '1.3') && (<>
      <CollapsibleSection
        id="intake_qr"
        taxonomy="1.3"
        timeBadge="~30s"
        label="Client intake & QR codes"
        summary="Your link plus 3 QR codes ready to share"
        status="done"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>}
        isOpen={openRow === 'intake_qr'}
        onToggle={toggleRow}
      ><div style={{ padding: '4px 4px' }}>
        <p style={{ fontSize: 13, color: C2.gray, margin: '0 0 12px 0', lineHeight: 1.5 }}>
          Share your intake link with clients, or print a QR code for your room or front desk.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: 1, background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: C2.darkGray, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {intakeUrl}
          </div>
          <button onClick={copyLink} style={{ background: copied ? C2.forest : C2.sage, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
            {copied ? '\u2713 Copied' : 'Copy Link'}
          </button>
        </div>
        <div style={{ borderTop: `1px solid ${C2.lightGray}`, margin: '0 0 14px' }} />
        <QRCodesCard intakeUrl={intakeUrl} bookingUrl={bookingUrl} businessName={therapist?.business_name || therapist?.full_name} C2={C2} />
      </div></CollapsibleSection>
      </>)}
"""

# ─── Step 2: Define the new layout ─────────────────────────────────────

GROUPS = [
    {
        "key": "practice",
        "title": "How I practice",
        "sub": "The bones of your practice. Who you are, where clients find you, when you take days off.",
        "sprigType": "leaf",
        "rows": ["profile", "import", "_combined_intake_qr", "booking", "bookingflow", "timeoff"],
    },
    {
        "key": "offer",
        "title": "What I offer",
        "sub": "Your menu. Services, hours, add-ons, packages, memberships, classes, waiver.",
        "sprigType": "menu",
        "rows": ["services", "addons", "packages", "memberships", "events", "waiver"],
    },
    {
        "key": "restEasier",
        "title": "How I rest easier",
        "sub": "Quiet help working in the background. AI, retention nudges, reminders.",
        "sprigType": "moon",
        "rows": ["ai", "pulse", "push", "notifs", "lapsed"],
    },
    {
        "key": "plugIn",
        "title": "How I plug in",
        "sub": "Connections to the tools and systems you already use.",
        "sprigType": "plug",
        "rows": ["cal", "payments", "twilio", "referral"],
    },
    {
        "key": "membership",
        "title": "My membership",
        "sub": "Your password and your plan with us.",
        "sprigType": "sun",
        "rows": ["plan", "password"],
    },
]

out_lines = []

for g in GROUPS:
    # SettingsSectionHeader.
    # Note sprigType "menu","moon","plug" may not be defined in
    # SettingsSectionHeader yet — keep the existing valid values for
    # backward compat. Use 'leaf' for the unknown sprig types. The
    # existing component reads sprigType in {leaf, sun, ...} so we'll
    # only set leaf or sun where supported.
    safe_sprig = g["sprigType"] if g["sprigType"] in ("leaf", "sun") else "leaf"
    out_lines.append(
f"""      <SettingsSectionHeader
        title="{g['title']}"
        sub="{g['sub']}"
        sprigType="{safe_sprig}"
        isOpen={{isSearching || openSections.{g['key']}}}
        onToggle={{() => toggleSection('{g['key']}')}}
      />

      {{(isSearching || openSections.{g['key']}) && (<>"""
    )
    for row_id in g["rows"]:
        if row_id == "_combined_intake_qr":
            out_lines.append(build_combined_intake_qr().rstrip())
        else:
            block = blocks[row_id]
            label, summary, tax = label_summary_taxonomy(block)
            out_lines.append(search_wrap(block, label, summary, tax).rstrip())
    out_lines.append("      </>)}\n")

new_jsx = "\n".join(out_lines)
pathlib.Path("/tmp/new_settings_jsx.txt").write_text(new_jsx)
print(f"Wrote {len(new_jsx)} chars to /tmp/new_settings_jsx.txt")
print(f"Used rows: {sum(len(g['rows']) for g in GROUPS)} (1 is combined)")
