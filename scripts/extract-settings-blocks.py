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
            # Walk backward to find any leading comment block. Multi-line
            # JSX comments span several lines without each line starting
            # with {/*, so we anchor on the closing */} and then walk up
            # until we find the matching open. Single-line {/* ... */}
            # comments are also handled.
            comment_start = start
            k = start - 1
            while k >= 0:
                s = lines[k].strip()
                if s == "":
                    k -= 1
                    continue
                if s.endswith("*/}"):
                    # Found end of a JSX comment. Walk up until the open.
                    end_k = k
                    while k >= 0 and "{/*" not in lines[k]:
                        k -= 1
                    if k >= 0:
                        comment_start = k
                        k -= 1
                        continue
                    else:
                        # No matching open found; bail out, don't include
                        # the orphan closing line.
                        break
                if s.startswith("//"):
                    comment_start = k
                    k -= 1
                    continue
                if s.endswith("*/") and not s.startswith("/*"):
                    # /* ... */ style block comment closing. Walk up.
                    while k >= 0 and not lines[k].strip().startswith("/*"):
                        k -= 1
                    if k >= 0:
                        comment_start = k
                        k -= 1
                        continue
                    else:
                        break
                if s.startswith("/*") and s.endswith("*/"):
                    comment_start = k
                    k -= 1
                    continue
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
