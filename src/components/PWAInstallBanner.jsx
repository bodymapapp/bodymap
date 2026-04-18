import React, { useState, useEffect } from 'react';

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(localStorage.getItem('pwa-dismissed') === 'true');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    if (isStandalone || dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // For iOS show instructions after 5s
    if (isIOS) setTimeout(() => setShow(true), 5000);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed, isIOS, isStandalone]);

  if (!show || dismissed || isStandalone) return null;

  const dismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  const install = async () => {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') dismiss();
    }
  };

  return (
    <div className="bm-pwa-banner" style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9000,
      background: '#1A3A28', borderRadius: 16, padding: '16px 20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 14,
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#2A5741', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 24 }}>🌿</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 2 }}>
          Save BodyMap to your phone
        </div>
        <div style={{ color: '#A8C5B5', fontSize: 12, fontFamily: 'system-ui' }}>
          {isIOS ? 'Tap ⬆ Share at bottom → Add to Home Screen' : 'Tap Install — works like a real app'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!isIOS && (
          <button onClick={install} style={{
            background: '#6B9E80', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Install
          </button>
        )}
        <button onClick={dismiss} style={{
          background: 'transparent', color: '#6B9E80', border: 'none',
          fontSize: 11, cursor: 'pointer', padding: '4px 0', textAlign: 'center'
        }}>
          Not now
        </button>
      </div>
    </div>
  );
}
