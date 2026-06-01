// src/components/AutoGrowingTextarea.jsx
//
// HK May 31 2026: drop-in replacement for <textarea> that auto-resizes
// to fit content as the user types. Matches the iMessage / Claude / Slack
// input box pattern: starts at minRows, grows with content, caps at
// maxRows where it becomes internally scrollable so the save button
// below it never gets pushed off-screen.
//
// Why this exists:
// Our 70 year old persona writes longer SOAP notes than the fixed-height
// 56px field allows. She has to scroll INSIDE a tiny window to see what
// she just typed, which she does not do well. The fix is for the field
// to grow as she types so the whole note is visible at once.
//
// Where to use it:
// Anywhere a therapist writes free-text notes that could exceed one
// line: SOAP (S/O/A/P), private notes, recap to client, custom message
// drafts, booking notes, cancellation reason, intake follow-up notes,
// quick-send message body.
//
// Where NOT to use it:
// Short single-line inputs (name, email, phone). Use <input> for those.
// Anything where a hard length cap matters more than ergonomics (e.g.
// SMS body where 160 chars is the limit) - those use a fixed textarea
// with a counter, not auto-grow.
//
// API:
//   <AutoGrowingTextarea
//     value={value}
//     onChange={(e) => setValue(e.target.value)}
//     placeholder="..."
//     minRows={2}        // default 2
//     maxRows={12}       // default 12 (~270px)
//     style={...}        // optional, merged with our defaults
//   />
// All other props (id, name, disabled, onBlur, onFocus, etc) pass through.

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

const AutoGrowingTextarea = forwardRef(function AutoGrowingTextarea({
  value,
  onChange,
  minRows = 2,
  maxRows = 12,
  style: styleOverride = {},
  ...rest
}, parentRef) {
  const ref = useRef(null);
  // Expose the underlying textarea node to parents (focus, blur, select).
  useImperativeHandle(parentRef, () => ref.current, []);

  // Resize on every change. Strategy:
  //   1. Reset height to auto so scrollHeight reflects the content's
  //      natural height, not the previous fixed height.
  //   2. Read scrollHeight.
  //   3. Clamp to [minRows, maxRows] expressed in pixels using the
  //      computed line-height.
  //   4. Set height to that pixel value. If clamped at maxRows, the
  //      browser handles overflow with its native scrollbar.
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    // Save scroll position so resizing doesn't jump the page.
    const prevScrollTop = window.pageYOffset;
    el.style.height = 'auto';
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const paddingV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderV = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const minPx = lineHeight * minRows + paddingV + borderV;
    const maxPx = lineHeight * maxRows + paddingV + borderV;
    const next = Math.max(minPx, Math.min(maxPx, el.scrollHeight + borderV));
    el.style.height = `${next}px`;
    // Show internal scrollbar only when capped.
    el.style.overflowY = el.scrollHeight + borderV > maxPx ? 'auto' : 'hidden';
    // Restore page scroll position so the field growing doesn't kick the
    // page down.
    window.scrollTo({ top: prevScrollTop });
  };

  // Resize on value change (covers controlled-component updates from
  // dictation, PracticeIQ drafting, programmatic setValue, etc).
  useEffect(() => { resize(); }, [value]);

  // Initial mount + window resize (font changes, viewport rotation).
  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergedStyle = {
    width: '100%',
    minHeight: 56,           // initial minRows guidance, real clamp via JS
    padding: '10px 12px',
    border: '1px solid #E5DDD2',
    borderRadius: 8,
    fontSize: 14,            // bump from 13 to 14 - easier on 70yo eyes
    lineHeight: 1.6,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none',          // we handle resize via JS; user-resize handle clutters mobile
    boxSizing: 'border-box',
    background: '#FAFAF7',
    overflowY: 'hidden',     // toggled by resize() to 'auto' only when needed
    transition: 'border-color 120ms',
    ...styleOverride,
  };

  return (
    <textarea
      ref={ref}
      value={value || ''}
      onChange={(e) => {
        onChange?.(e);
        // resize() fires from the value useEffect, but for uncontrolled
        // setups (or if value prop is debounced) we also resize here.
        resize();
      }}
      style={mergedStyle}
      {...rest}
    />
  );
});

export default AutoGrowingTextarea;
