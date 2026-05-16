// src/components/NotificationsBell.jsx
//
// Bell icon for the therapist top nav. Shows an unread count
// badge, and on tap opens a drawer with the last 20
// notifications. Mark-as-read on tap; mark-all-read button.
//
// Data source: in_app_notifications table (migration:
// supabase/migrations/in_app_notifications.sql). Inserts happen
// from edge functions via notifyTherapist() in
// supabase/functions/_shared/notifications.ts.
//
// HK May 16 2026 design notes:
//   - Soft + feminine: cream surface, rose accents, no work for
//     therapist or client
//   - Bell tap opens, tap-outside closes
//   - Mark-read on row tap; whole-drawer "Mark all read" link
//   - Polls in background every 60s while drawer is closed; on
//     open does a fresh fetch so the user never sees stale state
//
// Hooks imported individually per repo convention.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const POLL_MS = 60_000;
const DRAWER_LIMIT = 20;

export default function NotificationsBell({ therapistId, isMobile }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const drawerRef = useRef(null);
  const buttonRef = useRef(null);

  // ─── Fetchers ───────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!therapistId) return;
    const { count } = await supabase
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .is('read_at', null);
    setUnread(count || 0);
  }, [therapistId]);

  const fetchList = useCallback(async () => {
    if (!therapistId) return;
    setLoading(true);
    const { data } = await supabase
      .from('in_app_notifications')
      .select('id, event_type, title, body, icon, link_url, read_at, created_at')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .limit(DRAWER_LIMIT);
    setItems(data || []);
    setLoading(false);
  }, [therapistId]);

  // ─── Initial + interval polling for unread count ────────────
  useEffect(() => {
    if (!therapistId) return undefined;
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_MS);
    return () => clearInterval(id);
  }, [therapistId, fetchUnreadCount]);

  // ─── On open: fresh fetch of the list ───────────────────────
  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  // ─── Tap-outside to close ───────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    function handler(e) {
      if (drawerRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // ─── Mark a single row read ─────────────────────────────────
  async function markRead(notif) {
    if (notif.read_at) return;
    await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notif.id);
    setItems((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    await supabase
      .from('in_app_notifications')
      .update({ read_at: now })
      .eq('therapist_id', therapistId)
      .is('read_at', null);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
  }

  function handleRowTap(notif) {
    markRead(notif);
    if (notif.link_url) {
      // link_url is an internal route like '/dashboard/billing'
      navigate(notif.link_url);
      setOpen(false);
    }
  }

  // ─── Styles ─────────────────────────────────────────────────
  // Rose/cream feminine palette to match the Gift Cards aesthetic
  // per HK's memory note.
  const ROSE = '#C77B8A';
  const ROSE_SOFT = '#FDF2F4';
  const CREAM = '#FBFAF4';
  const CREAM_DEEP = '#F2EFE4';
  const INK = '#3F4F45';
  const INK_SOFT = '#6B7280';
  const SAGE = '#6B9E80';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        title="Notifications"
        style={{
          background: '#fff',
          border: `1px solid ${CREAM_DEEP}`,
          color: INK_SOFT,
          padding: isMobile ? '6px 8px' : '6px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: ROSE,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
            lineHeight: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={drawerRef}
          style={{
            position: 'absolute',
            top: isMobile ? 56 : 60,
            right: isMobile ? 8 : 16,
            width: isMobile ? 'calc(100vw - 16px)' : 380,
            maxWidth: 420,
            background: CREAM,
            border: `1px solid ${CREAM_DEEP}`,
            borderRadius: 16,
            boxShadow: '0 18px 48px rgba(63, 79, 69, 0.15), 0 4px 12px rgba(63, 79, 69, 0.06)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '70vh',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${CREAM_DEEP}`,
            background: ROSE_SOFT,
          }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 16,
              fontWeight: 700,
              color: INK,
            }}>
              Your notifications
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: SAGE,
                  fontSize: 12,
                  fontWeight: 600,
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  fontFamily: 'Georgia, serif',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(107, 158, 128, 0.3)',
                  textUnderlineOffset: 3,
                  padding: 4,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && items.length === 0 && (
              <div style={{ padding: '24px 18px', textAlign: 'center', color: INK_SOFT, fontSize: 13 }}>
                Loading…
              </div>
            )}
            {!loading && items.length === 0 && (
              <div style={{ padding: '32px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: INK, marginBottom: 4 }}>
                  All caught up
                </div>
                <div style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>
                  When a client books, pays, or cancels, you'll see it here.
                </div>
              </div>
            )}
            {items.map((n) => {
              const isUnread = !n.read_at;
              const when = formatRelative(n.created_at);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleRowTap(n)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '14px 18px',
                    width: '100%',
                    background: isUnread ? ROSE_SOFT : 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${CREAM_DEEP}`,
                    cursor: n.link_url ? 'pointer' : 'default',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: '#fff',
                    border: `1px solid ${CREAM_DEEP}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    {n.icon || '·'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5,
                      fontWeight: isUnread ? 700 : 500,
                      color: INK,
                      lineHeight: 1.35,
                      marginBottom: 2,
                    }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{
                        fontSize: 12,
                        color: INK_SOFT,
                        lineHeight: 1.4,
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: INK_SOFT, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                      {when}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{
                      flexShrink: 0,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: ROSE,
                      alignSelf: 'center',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 18px',
            borderTop: `1px solid ${CREAM_DEEP}`,
            background: '#fff',
            fontSize: 11,
            color: INK_SOFT,
            textAlign: 'center',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
          }}>
            Manage what reaches you in Settings.
          </div>
        </div>
      )}
    </>
  );
}

// "5 min ago", "2 hr ago", "Yesterday", "Mon", "Mar 12"
function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return 'Yesterday';
  if (diff < 604800) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
