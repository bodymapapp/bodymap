// src/components/founder/MarkdownView.jsx
//
// Lightweight markdown renderer for the Founder Hub. Scoped to the
// markdown subset our documents actually use: headings (h1-h4),
// paragraphs, bold, italic, inline code, fenced code blocks, links,
// unordered + ordered lists, tables, horizontal rules, blockquotes.
//
// Why not pull in react-markdown: ~50KB gzip plus a remark/rehype
// plugin chain we do not need. This renderer is ~250 lines we
// fully control, and the output stays consistent with the rest of
// the Founder Hub visual language.
//
// Limitations to be aware of:
//   - No HTML passthrough (intentional; markdown only)
//   - No nested lists deeper than two levels
//   - No image rendering (the docs do not currently include images)
//   - Tables must use standard markdown pipe syntax with header row
//     and separator row

import React from "react";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5D5C8",
  paper:  "#FBFAF6",
  green:  "#16A34A",
  amber:  "#D97706",
};

export default function MarkdownView({ source, size = "compact" }) {
  if (!source) return null;
  const blocks = parseBlocks(source);
  // Comfortable size used on the public Help center where readability
  // matters more than density. Compact remains default for Founder Hub
  // where density helps HK scan long internal docs.
  const baseFontSize = size === "comfortable" ? 16 : 14;
  const baseLineHeight = size === "comfortable" ? 1.75 : 1.7;
  return (
    <div style={{
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      fontSize: baseFontSize,
      lineHeight: baseLineHeight,
      color: C.ink,
    }}>
      {blocks.map((block, i) => renderBlock(block, i, size))}
    </div>
  );
}

// Split source into block-level tokens. Order matters: code fences
// must be detected before lines inside are interpreted.
function parseBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, content: headingMatch[2] });
      i += 1;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|?\s*$/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "table", lines: tableLines });
      continue;
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || (items.length > 0 && lines[i].startsWith("  ") && lines[i].trim()))) {
        if (/^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        } else {
          items[items.length - 1] += " " + lines[i].trim();
        }
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*\d+\.\s+/.test(lines[i]) || (items.length > 0 && lines[i].startsWith("   ") && lines[i].trim()))) {
        if (/^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        } else {
          items[items.length - 1] += " " + lines[i].trim();
        }
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^---+\s*$/.test(lines[i].trim()) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith(">") &&
      !(lines[i].includes("|") && i + 1 < lines.length && /^\s*\|?[\s\-:|]+\|?\s*$/.test(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

function renderBlock(block, key, size = "compact") {
  switch (block.type) {
    case "heading":
      return renderHeading(block, key, size);
    case "paragraph":
      return (
        <p key={key} style={{ margin: "0 0 14px 0" }}>
          {renderInline(block.content)}
        </p>
      );
    case "ul":
      return (
        <ul key={key} style={{ margin: "0 0 14px 0", paddingLeft: 22 }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ marginBottom: 6 }}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} style={{ margin: "0 0 14px 0", paddingLeft: 22 }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ marginBottom: 6 }}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre key={key} style={{
          background: "#1F3A2C",
          color: "#E5E5E5",
          padding: "14px 16px",
          borderRadius: 8,
          fontSize: size === "comfortable" ? 13 : 12,
          lineHeight: 1.55,
          overflow: "auto",
          margin: "0 0 16px 0",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        }}>
          <code>{block.content}</code>
        </pre>
      );
    case "hr":
      return (
        <hr key={key} style={{
          border: "none",
          borderTop: `1px solid ${C.border}`,
          margin: "24px 0",
        }} />
      );
    case "table":
      return renderTable(block, key);
    case "blockquote":
      return (
        <blockquote key={key} style={{
          borderLeft: `3px solid ${C.sage}`,
          paddingLeft: 14,
          margin: "0 0 14px 0",
          color: C.gray,
          fontStyle: "italic",
        }}>
          {renderInline(block.content)}
        </blockquote>
      );
    default:
      return null;
  }
}

function renderHeading(block, key, size = "compact") {
  const isComfortable = size === "comfortable";
  const baseStyle = {
    fontFamily: "Georgia, serif",
    color: C.forest,
    fontWeight: 700,
    margin: "0 0 12px 0",
    lineHeight: 1.3,
  };
  switch (block.level) {
    case 1:
      return (
        <h1 key={key} style={{
          ...baseStyle,
          fontSize: isComfortable ? 30 : 26,
          marginTop: 4,
          paddingBottom: 10,
          borderBottom: `2px solid ${C.border}`,
        }}>
          {renderInline(block.content)}
        </h1>
      );
    case 2:
      return (
        <h2 key={key} style={{
          ...baseStyle,
          fontSize: isComfortable ? 23 : 20,
          marginTop: 28,
        }}>
          {renderInline(block.content)}
        </h2>
      );
    case 3:
      return (
        <h3 key={key} style={{
          ...baseStyle,
          fontSize: isComfortable ? 18 : 16,
          marginTop: 20,
          color: C.ink,
        }}>
          {renderInline(block.content)}
        </h3>
      );
    case 4:
      return (
        <h4 key={key} style={{
          ...baseStyle,
          fontSize: isComfortable ? 15 : 14,
          marginTop: 16,
          color: C.ink,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}>
          {renderInline(block.content)}
        </h4>
      );
    default:
      return null;
  }
}

function renderTable(block, key) {
  const rows = block.lines.map((line) =>
    line.split("|").map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""))
  );
  if (rows.length < 2) return null;
  const [header, , ...body] = rows;

  return (
    <div key={key} style={{ overflowX: "auto", margin: "0 0 16px 0" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 13,
      }}>
        <thead>
          <tr style={{ background: C.cream }}>
            {header.map((cell, j) => (
              <th key={j} style={{
                textAlign: "left",
                padding: "8px 12px",
                borderBottom: `2px solid ${C.border}`,
                fontWeight: 700,
                color: C.ink,
              }}>
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? "#fff" : C.paper,
            }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${C.border}`,
                  verticalAlign: "top",
                }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Inline formatting: bold, italic, inline code, links.
// Order matters: handle links before bold/italic since link text
// can contain bold/italic, and inline code before everything else
// since code should not have its contents formatted.
function renderInline(text) {
  if (!text) return null;
  // Tokenize the string into segments. Each segment is either plain
  // text or a typed token (code, link, bold, italic).
  const tokens = tokenize(text);
  return tokens.map((tok, i) => {
    if (tok.type === "code") {
      return (
        <code key={i} style={{
          background: C.cream,
          border: `1px solid ${C.border}`,
          padding: "1px 6px",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          color: C.ink,
        }}>
          {tok.content}
        </code>
      );
    }
    if (tok.type === "link") {
      return (
        <a key={i} href={tok.href} target="_blank" rel="noopener noreferrer" style={{
          color: C.forest,
          fontWeight: 600,
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}>
          {renderInline(tok.text)}
        </a>
      );
    }
    if (tok.type === "bold") {
      return <strong key={i} style={{ fontWeight: 700, color: C.ink }}>{renderInline(tok.content)}</strong>;
    }
    if (tok.type === "italic") {
      return <em key={i} style={{ fontStyle: "italic" }}>{renderInline(tok.content)}</em>;
    }
    return <span key={i}>{tok.content}</span>;
  });
}

// Simple tokenizer. Handles code, links, bold, italic in priority order.
function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    // Inline code `...`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        tokens.push({ type: "code", content: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Link [text](url)
    if (text[i] === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          tokens.push({
            type: "link",
            text: text.slice(i + 1, closeBracket),
            href: text.slice(closeBracket + 2, closeParen),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }
    // Bold **...**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        tokens.push({ type: "bold", content: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // Italic *...* (single asterisk, not preceded/followed by another)
    if (text[i] === "*" && text[i - 1] !== "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end + 1] !== "*" && text[end - 1] !== "*") {
        tokens.push({ type: "italic", content: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Italic _..._
    if (text[i] === "_" && text[i - 1] !== "_") {
      const end = text.indexOf("_", i + 1);
      if (end !== -1 && /\W/.test(text[end + 1] || " ")) {
        tokens.push({ type: "italic", content: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // Plain character; accumulate into the last text token if any
    if (tokens.length > 0 && tokens[tokens.length - 1].type === "text") {
      tokens[tokens.length - 1].content += text[i];
    } else {
      tokens.push({ type: "text", content: text[i] });
    }
    i += 1;
  }
  return tokens;
}
