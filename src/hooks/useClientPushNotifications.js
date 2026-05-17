// src/hooks/useClientPushNotifications.js
//
// PWA push subscription for clients (no login). Companion to
// usePushNotifications.js (therapist version).
//
// Identity model: clients are identified by (therapist_id, client_id)
// captured at booking-confirmation time. The booking flow already
// knows both at the moment we show the "Get session reminders on
// your phone" CTA, so no token dance needed.
//
// HK May 17 2026: this is the client side of the Notification
// Compliance Dashboard's C-Push column. Built to unblock the
// auto-fire test from going around it.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Same VAPID key as therapist subscriptions; the public key is
// shared across the whole platform.
const VAPID_PUBLIC_KEY = 'BIj1wL2VIP8Chwj37JY2eOkHkwKpO-90AnCk6fLOLnGbgrpehP9sEMYEwAthBaO1M_ftVtonMQisiCZzpWVyJgQ';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function useClientPushNotifications({ therapistId, clientId }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detect support and current permission on mount.
  // Same logic as the therapist version; could be factored later.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supportsPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(supportsPush);
    if (supportsPush) {
      setPermission(Notification.permission);
      // Check if an active subscription already exists for this device
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription()
      ).then(sub => {
        if (sub) setSubscribed(true);
      }).catch(() => {});
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return { ok: false, reason: 'unsupported' };
    if (!therapistId || !clientId) return { ok: false, reason: 'missing_ids' };
    setLoading(true);
    setError(null);
    try {
      // Request permission if not already granted
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }
      if (perm !== 'granted') {
        setLoading(false);
        return { ok: false, reason: 'permission_denied' };
      }

      // Subscribe
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const p256dh = arrayBufferToBase64(sub.getKey('p256dh'));
      const auth = arrayBufferToBase64(sub.getKey('auth'));

      const { error: upsertErr } = await supabase
        .from('client_push_subscriptions')
        .upsert({
          client_id: clientId,
          therapist_id: therapistId,
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 200),
          last_used_at: new Date().toISOString(),
          unsubscribed_at: null,
        }, { onConflict: 'endpoint' });

      if (upsertErr) {
        let friendlyMsg = upsertErr.message;
        if (upsertErr.code === '42P01' || /relation.*does not exist/i.test(upsertErr.message || '')) {
          friendlyMsg = 'client_push_subscriptions table is missing. Run migration 2026-05-17-client-push-subscriptions.sql.';
        }
        setError(friendlyMsg);
        setLoading(false);
        return { ok: false, reason: friendlyMsg };
      }

      setSubscribed(true);
      setLoading(false);
      return { ok: true };
    } catch (e) {
      setError(e?.message || String(e));
      setLoading(false);
      return { ok: false, reason: e?.message };
    }
  }, [supported, therapistId, clientId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from('client_push_subscriptions')
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe };
}
