#!/usr/bin/env python3
"""
Surgical edit of src/pages/Dashboard.js: add taxonomy + timeBadge props to
each CollapsibleSection by id, mapping to the agreed taxonomy.

Doesn't move anything. Doesn't restructure anything. Just adds two new props
right after the `id="..."` line for each row.

Run from repo root.
"""

import re
import pathlib

# id -> (taxonomy, timeBadge or None)
# None = no time badge (toggle-style or read-only)
META = {
    # 1. How I practice
    "profile":      ("1.1", "~30s"),
    "import":       ("1.2", "~2m"),
    "intake":       ("1.3", "~30s"),   # combined with QR
    "qrcodes":      ("1.3", "~30s"),   # combined with intake (same id slot)
    "booking":      ("1.4", "~1m"),
    "bookingflow":  ("1.5", None),
    "timeoff":      ("1.6", "~1m"),

    # 2. What I offer
    "services":     ("2.1", "~3m"),
    "addons":       ("2.2", "~2m"),
    "packages":     ("2.3", "~3m"),
    "memberships":  ("2.4", "~3m"),
    "events":       ("2.5", "~3m"),
    "waiver":       ("2.6", "~1m"),

    # 3. How I rest easier
    "ai":           ("3.1", None),
    "pulse":        ("3.2", None),
    "push":         ("3.3", None),
    "notifs":       ("3.4", None),
    "lapsed":       ("3.5", "~30s"),

    # 4. How I plug in
    "cal":          ("4.1", "~3m"),
    "payments":     ("4.2", "~5m"),
    "twilio":       ("4.3", "~10m"),
    "referral":     ("4.4", None),

    # 5. My membership
    "plan":         ("5.1", None),
    "password":     ("5.2", "~1m"),
}

path = pathlib.Path("src/pages/Dashboard.js")
src = path.read_text()

# Regex: locate `id="<name>"` line, then add taxonomy + timeBadge right after it.
# Idempotent: skip if `taxonomy=` already present in the next ~3 lines.

def replace_fn(match):
    full = match.group(0)
    indent = match.group("indent")
    sect_id = match.group("id")
    if sect_id not in META:
        return full
    if "taxonomy=" in full:
        return full  # already done
    tax, time_badge = META[sect_id]
    extra = f'\n{indent}taxonomy="{tax}"'
    if time_badge:
        extra += f'\n{indent}timeBadge="{time_badge}"'
    return full + extra

# Match the id="..." line, capturing leading whitespace for indentation match.
pattern = re.compile(
    r'(?P<indent>^[ \t]+)id="(?P<id>[a-z]+)"',
    re.MULTILINE,
)
new_src = pattern.sub(replace_fn, src)

if new_src == src:
    print("No changes (already applied?)")
else:
    path.write_text(new_src)
    # Count additions
    added = sum(1 for sid in META if f'id="{sid}"' in src)
    print(f"Updated {added} rows with taxonomy + timeBadge props.")
