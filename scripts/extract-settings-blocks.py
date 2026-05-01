#!/usr/bin/env python3
"""
Extract every <CollapsibleSection id="..."> ... </CollapsibleSection> block
from src/pages/Dashboard.js, keyed by id. Save to /tmp/settings_blocks.json.

Useful for safely rebuilding SettingsPanel JSX without losing any wiring.
"""

import json
import pathlib
import re

src = pathlib.Path("src/pages/Dashboard.js").read_text()
lines = src.split("\n")

blocks = {}
i = 0
while i < len(lines):
    line = lines[i]
    # Detect start: line with `<CollapsibleSection`
    if "<CollapsibleSection" in line:
        start = i
        # Find the matching end. CollapsibleSection rows in this codebase
        # always end with `</CollapsibleSection>` on a single line. We
        # need to handle nested sections (the old `<CollapsibleSection` open
        # of the children-rendering wrapper inside `payments`). Track depth.
        depth = line.count("<CollapsibleSection") - line.count("</CollapsibleSection>")
        j = i
        while depth > 0 and j < len(lines) - 1:
            j += 1
            depth += lines[j].count("<CollapsibleSection") - lines[j].count("</CollapsibleSection>")
        # Find this block's id
        block_text = "\n".join(lines[start:j+1])
        m = re.search(r'id="([a-z]+)"', block_text[:300])
        if m:
            sect_id = m.group(1)
            # Find leading comment line (the // … or {/* … */} immediately above)
            comment_start = start
            for k in range(start - 1, max(start - 8, -1), -1):
                stripped = lines[k].strip()
                if stripped.startswith("{/*") or stripped.startswith("/*") or stripped.endswith("*/}"):
                    comment_start = k
                elif stripped == "":
                    continue
                else:
                    break
            full_block = "\n".join(lines[comment_start:j+1])
            blocks[sect_id] = full_block
        i = j + 1
    else:
        i += 1

out = pathlib.Path("/tmp/settings_blocks.json")
out.write_text(json.dumps(blocks, indent=2))
print(f"Extracted {len(blocks)} blocks: {sorted(blocks.keys())}")
print(f"Saved to {out}")
