// src/components/InlineEditDescription.jsx
//
// Tap-to-edit multiline description field. Built for service +
// add-on description rows. Sister component to InlineEditField
// (which is for single-line values like prices).
//
// Behavior:
//   - Static state: shows description text, or "Add description" placeholder
//     in italic gray when empty
//   - Tap: becomes a textarea
//   - Save: on blur OR Cmd/Ctrl+Enter
//   - Cancel: Esc (reverts to original value)
//
// Same Notion/Linear pattern as InlineEditField: autosave, no commit
// button, optimistic with rollback handled by the caller's onSave.

import React from "react";

export default function InlineEditDescription({
  value,
  onSave,
  placeholder = "Add a description (optional)",
  maxLength = 500,
  ariaLabel = "Edit description",
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value || "");
  const [saving, setSaving] = React.useState(false);
  const taRef = React.useRef(null);

  React.useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);

  React.useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.selectionStart = taRef.current.value.length;
      taRef.current.selectionEnd = taRef.current.value.length;
    }
  }, [editing]);

  async function commit() {
    if (saving) return;
    const next = draft.trim().slice(0, maxLength);
    if (next === (value || "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next || null);
    } catch (e) {
      console.error("InlineEditDescription save failed:", e);
      setDraft(value || "");
    }
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setDraft(value || "");
    setEditing(false);
  }

  if (editing) {
    return (
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        rows={2}
        maxLength={maxLength}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={saving}
        style={{
          width: "100%",
          border: "1.5px solid #2A5741",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 12.5,
          color: "#1F3A2C",
          outline: "none",
          background: "#fff",
          fontFamily: "inherit",
          lineHeight: 1.5,
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
    );
  }

  const isEmpty = !value || !value.trim();
  return (
    <div
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); }
      }}
      style={{
        fontSize: 12.5,
        color: isEmpty ? "#9CA3AF" : "#4B5563",
        fontStyle: isEmpty ? "italic" : "normal",
        cursor: "pointer",
        padding: "4px 8px",
        margin: "-4px -8px",
        borderRadius: 8,
        borderBottom: "1px dashed transparent",
        transition: "all 0.12s",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(42,87,65,0.06)";
        e.currentTarget.style.borderBottom = "1px dashed rgba(42,87,65,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderBottom = "1px dashed transparent";
      }}
    >
      {isEmpty ? placeholder : value}
    </div>
  );
}
