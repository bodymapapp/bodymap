// src/components/AIDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const SUGGESTED_PROMPTS = [
  { icon: '🍂', text: 'Which clients haven\'t booked in 30+ days?', category: 'retention' },
  { icon: '💰', text: 'How is my revenue trending this month?', category: 'billing' },
  { icon: '📋', text: 'Who has pending intake forms today?', category: 'schedule' },
  { icon: '💆', text: 'What are my most common client focus areas?', category: 'insights' },
  { icon: '💬', text: 'Draft an SMS to re-engage my lapsed clients', category: 'sms' },
  { icon: '⭐', text: 'Who are my top clients by sessions?', category: 'clients' },
  { icon: '📅', text: 'What does my week look like?', category: 'schedule' },
  { icon: '🔴', text: 'Do I have any outstanding payments?', category: 'billing' },
];

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', background: '#F9FAFB', borderRadius: 12, width: 'fit-content' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: '#6B9E80',
          animation: 'bounce 1.2s infinite',
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect SMS blocks between --- markers
  const parts = msg.content.split(/(---[\s\S]*?---)/g);

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2A5741', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginRight: 10, marginTop: 4 }}>
          🌿
        </div>
      )}
      <div style={{ maxWidth: '75%' }}>
        {isUser ? (
          <div style={{ background: '#2A5741', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', fontSize: 14, lineHeight: 1.5 }}>
            {msg.content}
          </div>
        ) : (
          <div>
            {parts.map((part, i) => {
              if (part.startsWith('---') && part.endsWith('---')) {
                const smsText = part.replace(/^---\n?/, '').replace(/\n?---$/, '').trim();
                return (
                  <div key={i} style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 10, padding: '12px 16px', margin: '8px 0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>💬 SMS Draft</div>
                    <div style={{ fontSize: 14, color: '#1F2937', lineHeight: 1.5, marginBottom: 10 }}>{smsText}</div>
                    <button onClick={() => copyText(smsText)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {copied ? '✓ Copied!' : '📋 Copy SMS'}
                    </button>
                  </div>
                );
              }
              return part ? (
                <div key={i} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px 18px 18px 18px', padding: '12px 16px', fontSize: 14, color: '#1F2937', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {part.trim()}
                </div>
              ) : null;
            })}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export default function AIDashboard({ therapist }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [practiceContext, setPracticeContext] = useState('');
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null); // { used, limit, remaining }
  const [limitReached, setLimitReached] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load practice data on mount
  useEffect(() => {
    buildContext();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Track keyboard open/close via visualViewport API (iOS Safari / Android Chrome)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      setViewportHeight(vv.height);
      // Keyboard considered open when viewport shrinks by more than 150px from window height
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    handler();
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  const buildContext = async () => {
    try {
      setContextLoading(true);
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('therapist_id', therapist.id);

      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('therapist_id', therapist.id)
        .order('created_at', { ascending: false })
        .limit(100);

      const now = new Date();
      const clientSummaries = (clients || []).map(c => {
        const clientSessions = (sessions || []).filter(s => s.client_id === c.id);
        const completed = clientSessions.filter(s => s.completed);
        const lastSession = completed.length > 0
          ? new Date(Math.max(...completed.map(s => new Date(s.completed_at || s.created_at))))
          : null;
        const daysSince = lastSession ? Math.floor((now - lastSession) / 86400000) : null;
        const latest = clientSessions[0];
        const focusAreas = latest ? [...(latest.front_focus || []), ...(latest.back_focus || [])].slice(0, 4).join(', ') : 'none recorded';
        const avoidAreas = latest ? [...(latest.front_avoid || []), ...(latest.back_avoid || [])].slice(0, 3).join(', ') : 'none';
        return `- ${c.name} | Phone: ${c.phone || 'n/a'} | Sessions: ${completed.length} | Last visit: ${daysSince !== null ? daysSince + 'd ago' : 'never'} | Focus: ${focusAreas} | Avoid: ${avoidAreas} | Pressure: ${latest?.pressure || 'n/a'}/5`;
      });

      const totalSessions = (sessions || []).filter(s => s.completed).length;
      const thisMonth = (sessions || []).filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.completed;
      }).length;
      const pendingIntake = (sessions || []).filter(s => !s.completed).length;
      const lapsedClients = (clients || []).filter(c => {
        const clientSessions = (sessions || []).filter(s => s.client_id === c.id && s.completed);
        if (clientSessions.length === 0) return false;
        const last = new Date(Math.max(...clientSessions.map(s => new Date(s.completed_at || s.created_at))));
        return Math.floor((now - last) / 86400000) > 30;
      });

      const context = `
THERAPIST: ${therapist.full_name} | Business: ${therapist.business_name || 'n/a'} | Plan: ${therapist.plan || 'bronze'} | Intake URL: ${window.location.origin}/${therapist.custom_url}

PRACTICE SUMMARY:
- Total clients: ${(clients || []).length}
- Total completed sessions: ${totalSessions}
- Sessions this month: ${thisMonth}
- Pending intake forms: ${pendingIntake}
- Lapsed clients (30+ days): ${lapsedClients.length}
- Lapsed client names: ${lapsedClients.map(c => c.name).join(', ') || 'none'}

CLIENTS (${(clients || []).length} total):
${clientSummaries.join('\n')}
`.trim();

      setPracticeContext(context);

      // Welcome message
      setMessages([{
        role: 'assistant',
        content: `Hi ${therapist.full_name?.split(' ')[0] || 'there'}! 👋 I'm your Practice Assistant. I have access to your full practice data, ${(clients || []).length} clients, ${totalSessions} sessions. Ask me anything about your clients, schedule, revenue, or practice trends. You have 10 questions per month while we are in beta.`,
        timestamp: Date.now()
      }]);
    } catch (err) {
      setError('Could not load practice data. Please refresh.');
    } finally {
      setContextLoading(false);
    }
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');
    setError(null);

    const userMsg = { role: 'user', content: userText, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // PostHog tracking
    if (window.posthog) {
      window.posthog.capture('ai_query', { query: userText, therapist_id: therapist.id });
    }

    try {
      const apiMessages = updatedMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/bodymap-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          context: practiceContext,
        }),
      });

      const data = await response.json();

      // 429: monthly limit reached
      if (response.status === 429) {
        setLimitReached(true);
        setUsage({
          used: data.questions_used ?? 10,
          limit: data.questions_limit ?? 10,
          remaining: 0,
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'You have reached this month\'s question limit. Resets on the 1st.',
          timestamp: Date.now()
        }]);
        setLoading(false);
        return;
      }

      // Track returned usage_meta if present
      if (data.usage_meta) {
        setUsage({
          used: data.usage_meta.questions_used,
          limit: data.usage_meta.questions_limit,
          remaining: data.usage_meta.questions_remaining,
        });
        if (data.usage_meta.questions_remaining <= 0) {
          setLimitReached(true);
        }
      }

      const aiText = data.content?.[0]?.text || 'Sorry, I had trouble with that. Try again.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiText,
        timestamp: Date.now()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (contextLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2A5741', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🌿</div>
        <div style={{ fontSize: 14, color: '#6B7280' }}>Loading your practice data...</div>
      </div>
    );
  }

  const showSuggested = messages.length <= 1 && !keyboardOpen;

  const isMobile = window.innerWidth < 768;
  // Use actual visual viewport height on mobile so keyboard doesn't eat the scroll area
  const containerHeight = isMobile
    ? (keyboardOpen ? `${viewportHeight - 90}px` : 'calc(100svh - 180px)')
    : '70vh';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: containerHeight, minHeight: isMobile ? 0 : 500, transition: 'height 0.2s ease' }}>
      {/* Header, collapsed when keyboard open to give chat space */}
      {!keyboardOpen && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#1F2937', margin: '0 0 2px 0' }}>Practice Assistant</h2>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>Your personal practice intelligence, powered by your real client data</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {usage && (
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: usage.remaining <= 2 ? '#B45309' : '#6B7280',
                background: usage.remaining <= 2 ? '#FEF3C7' : '#F3F4F6',
                border: `1px solid ${usage.remaining <= 2 ? '#FCD34D' : '#E5E7EB'}`,
                borderRadius: 99,
                padding: '4px 10px',
                whiteSpace: 'nowrap',
              }}>
                {usage.used} / {usage.limit} this month
              </div>
            )}
            <button onClick={() => { setMessages([]); setLimitReached(false); buildContext(); }} style={{ background: 'transparent', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#6B7280', cursor: 'pointer', flexShrink: 0 }}>
              🔄 New Chat
            </button>
          </div>
        </div>
      )}

      {/* Compact header when keyboard is open */}
      {keyboardOpen && isMobile && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2A5741', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🌿</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1F2937' }}>Practice Assistant</span>
          </div>
          <button onClick={() => inputRef.current?.blur()} style={{ background: 'transparent', border: 'none', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>
            Done
          </button>
        </div>
      )}

      {/* Messages, scrollable middle */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', marginBottom: 8, minHeight: 0 }}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2A5741', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🌿</div>
            <TypingIndicator />
          </div>
        )}
        {error && <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts, always visible, horizontal scroll on mobile */}
      {showSuggested && (
        <div style={{ marginBottom: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Suggested questions</div>
          <div style={{ display: 'flex', gap: 6, overflowX: isMobile ? 'auto' : 'hidden', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 4 : 0, scrollbarWidth: 'none' }}>
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMessage(p.text)}
                style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 20, padding: '6px 12px', fontSize: isMobile ? 12 : 13, color: '#1F2937', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {p.icon} {p.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input, sticky at bottom */}
      <div style={{ flexShrink: 0 }}>
        {limitReached ? (
          <div style={{
            background: '#FEF3C7',
            border: '1.5px solid #FCD34D',
            borderRadius: 14,
            padding: '14px 16px',
            color: '#78350F',
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'center',
          }}>
            <strong>Monthly limit reached.</strong> You have used all {usage?.limit ?? 10} Practice Assistant questions this month. Resets on the 1st.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your practice..."
              rows={1}
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14, color: '#1F2937', background: 'transparent', fontFamily: 'system-ui', lineHeight: 1.5 }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{ background: input.trim() && !loading ? '#2A5741' : '#E5E7EB', color: input.trim() && !loading ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {loading ? '...' : '↑ Send'}
            </button>
          </div>
        )}
        {!isMobile && <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 6 }}>
          Press Enter to send · Shift+Enter for new line · Practice Assistant by MyBodyMap
        </div>}
      </div>
    </div>
  );
}
