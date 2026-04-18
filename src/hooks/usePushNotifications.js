import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// VAPID public key — safe to ship to client, used to identify the app server
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

export default function usePushNotifications(therapistId) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detect support + current permission on mount
  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(isSupported);
    if (!isSupported) return;

    setPermission(Notification.permission);

    // Check existing subscription
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        setSubscribed(!!existing);
      } catch (e) {
        // ignore — sw might not be ready yet
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !therapistId) return { ok: false, reason: 'not supported' };
    setLoading(true);
    setError(null);
    try {
      // Request permission
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return { ok: false, reason: 'permission ' + perm };
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

      // Extract keys and send to Supabase
      const p256dh = arrayBufferToBase64(sub.getKey('p256dh'));
      const auth = arrayBufferToBase64(sub.getKey('auth'));

      const { error: upsertErr } = await supabase
        .from('push_subscriptions')
        .upsert({
          therapist_id: therapistId,
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 200),
          last_used_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' });

      if (upsertErr) {
        // 42P01 = relation does not exist (table missing)
        let friendlyMsg = upsertErr.message;
        if (upsertErr.code === '42P01' || /relation.*does not exist/i.test(upsertErr.message || '')) {
          friendlyMsg = 'push_subscriptions table is missing. Run the migration in Supabase SQL Editor (see setup step 1).';
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
  }, [supported, therapistId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const sendTest = useCallback(async () => {
    if (!therapistId) return { ok: false, reason: 'no therapist' };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          therapist_id: therapistId,
          title: 'BodyMap test notification 🌿',
          body: 'If you see this, push notifications are working. You\'ll get these when clients book, reply, or go quiet.',
          url: '/dashboard',
          tag: 'bodymap-test',
        }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, reason: e?.message || 'fetch failed' };
    }
  }, [therapistId]);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe, sendTest };
}
