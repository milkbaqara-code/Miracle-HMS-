"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
// 🔱 MIRACLE GUEST AGI BUTLER — V1.0
// Uses the EXACT same executiveSpeak pattern as MiracleBot.tsx
// IRON LAW 51 compliant: No null returns. Synchronous useState init.
// IRON LAW 50: Fully decoupled from staff logic.
// ============================================================

const API_BASE = "/api";

// ── Same cleanForSpeech as MiracleBot (strips markdown for TTS) ──
function cleanForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ');
}

// ── executiveSpeak — IDENTICAL pattern to MiracleBot V8.8 — Android-safe ──
function executiveSpeak(
  text: string,
  voice: SpeechSynthesisVoice | null,
  isMutedRef: React.MutableRefObject<boolean>,
  onStart: () => void,
  onEnd: () => void
) {
  // 🛡️ Android WebView guard: speechSynthesis may be undefined on Capacitor
  const hasSpeech = typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    window.speechSynthesis != null &&
    typeof window.speechSynthesis.speak === 'function';
  if (!hasSpeech) { onEnd(); return; }

  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {}

  if (isMutedRef.current) { onEnd(); return; }

  const clean = cleanForSpeech(text)
    .replace(/\.\.\./g, ',')
    .replace(/—/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!clean) { onEnd(); return; }
  if (!('SpeechSynthesisUtterance' in window)) { onEnd(); return; }

  const rawChunks = clean.match(/[^.?!;:]+[.?!;:]+|\s*[^.?!;:]+$/g) || [clean];
  const chunks: string[] = [];
  rawChunks.forEach(chunk => {
    const t = chunk.trim();
    if (!t) return;
    if (t.length > 140) {
      chunks.push(...t.split(/(?<=,)\s*/).map(s => s.trim()).filter(c => c.length > 2));
    } else if (t.length > 2) {
      chunks.push(t);
    }
  });

  const filteredChunks = chunks.filter(c => c.length > 0);
  if (filteredChunks.length === 0) { onEnd(); return; }

  let currentIndex = 0;
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const keepAliveId = setInterval(() => {
    try {
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    } catch {}
  }, isMobile ? 7000 : 10000);

  const speakNext = () => {
    if (currentIndex >= filteredChunks.length) {
      clearInterval(keepAliveId);
      onEnd();
      return;
    }
    const u = new window.SpeechSynthesisUtterance(filteredChunks[currentIndex]);
    if (voice) u.voice = voice;
    u.pitch = 1.05;
    u.rate = 0.95;
    u.volume = 1;
    u.onstart = () => { if (currentIndex === 0) onStart(); };
    u.onend = () => { currentIndex++; speakNext(); };
    u.onerror = (e) => {
      if (['interrupted', 'cancelled', 'cancel'].includes(e.error)) {
        clearInterval(keepAliveId); onEnd(); return;
      }
      clearInterval(keepAliveId); onEnd();
    };
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(u);
    } catch {
      clearInterval(keepAliveId);
      onEnd();
    }
  };

  // 🔱 V8.8: Direct call — no setTimeout delay
  speakNext();
}

// ── Best voice selector — Android-safe ──
function getBestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window) || !window.speechSynthesis) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Google UK English Female', 'Samantha', 'Karen', 'Moira', 'Victoria'];
    for (const name of preferred) {
      const v = voices.find(v => v.name.includes(name));
      if (v) return v;
    }
    return voices.find(v => v.lang?.startsWith('en')) || null;
  } catch {
    return null;
  }
}

interface Message {
  role: 'user' | 'bot' | 'action';
  text: string;
  time: string;
}

interface GuestAiButlerProps {
  guestSession: {
    name: string;
    room: string;
    type: string;
  };
}

export default function GuestAiButler({ guestSession }: GuestAiButlerProps) {
  // IRON LAW 51: Synchronous useState initializers only
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pulse, setPulse] = useState(false);

  const isMutedRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const hasInteracted = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load voice on mount — Android-safe: check speechSynthesis exists first
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window) || !window.speechSynthesis) return;
    const loadVoice = () => { voiceRef.current = getBestVoice(); };
    try {
      if (window.speechSynthesis.getVoices().length > 0) loadVoice();
      else window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    } catch { /* speechSynthesis not ready on this device */ }
    return () => {
      try { window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoice); } catch {}
    };
  }, []);

  // Pulse effect when thinking or speaking
  useEffect(() => {
    if (isThinking || isSpeaking) {
      const t = setInterval(() => setPulse(p => !p), 600);
      return () => clearInterval(t);
    }
    setPulse(false);
  }, [isThinking, isSpeaking]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopSpeech = useCallback(() => {
    try { window.speechSynthesis?.cancel?.(); } catch {}
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (isMutedRef.current) return;
    executiveSpeak(
      text,
      voiceRef.current,
      isMutedRef,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  }, []);

  const addMessage = useCallback((role: Message['role'], text: string) => {
    setMessages(prev => [...prev, {
      role,
      text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }]);
  }, []);

  const askButler = useCallback(async (userMsg: string) => {
    if (!userMsg.trim()) return;
    hasInteracted.current = true;
    addMessage('user', userMsg);
    setInput('');
    setIsThinking(true);
    stopSpeech();

    // 🛡️ UNLOCK SPEECH ENGINE: synchronous empty speak inside user gesture
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        const silentUtterance = new window.SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
      }
    } catch {}

    // 🔱 Read JWT from storage — server validates this against live folio
    const token = typeof window !== 'undefined' ? (localStorage.getItem('SOV_GUEST_TOKEN') || '') : '';

    try {
      const res = await fetch(`${API_BASE}/guest/bot/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMsg,
          session_id: `GUEST-${guestSession.room}`,
          language: 'EN',
          // Legacy fields for backward compat (server ignores these, uses JWT)
          room: guestSession.room,
          guest_name: guestSession.name,
          guest_type: guestSession.type,
        })
      });

      if (res.status === 401) {
        // Guest checked out or token expired — clear session
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail?.includes('concluded')
          ? 'Your stay has concluded. Thank you for choosing Miracle. 🏨'
          : 'Your session has expired. Please log in again.';
        addMessage('bot', msg);
        speak(msg);
        setIsThinking(false);
        return;
      }

      const data = await res.json();
      const reply = data.response || 'Allow me a moment — I am looking into that for you.';

      addMessage('bot', reply);

      // Show executed actions as subtle info
      if (data.actions_executed && data.actions_executed.length > 0) {
        const actionText = data.actions_executed.map((a: string) => {
          if (a.startsWith('ticket_created:')) return '✅ Your request has been sent to our team';
          if (a.startsWith('order_placed:')) return '✅ Your order has been confirmed';
          return '✅ Request processed';
        }).join(' · ');
        addMessage('action', actionText);
      }

      speak(reply);
    } catch {
      const err = 'I apologise — I am momentarily unavailable. Please contact the front desk directly.';
      addMessage('bot', err);
      speak(err);
    } finally {
      setIsThinking(false);
    }
  }, [guestSession, addMessage, speak, stopSpeech]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { addMessage('action', 'Voice input not supported in this browser.'); return; }
    hasInteracted.current = true;
    stopSpeech();

    // 🛡️ UNLOCK SPEECH ENGINE: synchronous empty speak inside user gesture
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        const silentUtterance = new window.SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
      }
    } catch {}
    const rec = new SR();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      askButler(t);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  }, [addMessage, askButler, stopSpeech]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    if (next) stopSpeech();
  }, [isMuted, stopSpeech]);

  const handleOpen = useCallback(() => {
    hasInteracted.current = true;
    setIsOpen(true);

    // 🛡️ UNLOCK SPEECH ENGINE: synchronous empty speak inside user gesture
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        const silentUtterance = new window.SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
      }
    } catch {}

    if (messages.length === 0) {
      const greeting = `Good day, ${guestSession.name.split(' ')[0]}. I am Miracle, your personal concierge. How may I make your stay extraordinary today?`;
      setTimeout(() => {
        addMessage('bot', greeting);
        speak(greeting);
      }, 400);
    }
  }, [guestSession.name, messages.length, addMessage, speak]);

  const orbColor = isSpeaking ? '#D4AF37' : isThinking ? '#00F2FF' : isListening ? '#FF3131' : 'rgba(212,175,55,0.8)';

  return (
    <>
      <style>{`
        @keyframes butlerFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
        @keyframes butlerRing { 0%{transform:scale(1);opacity:0.6;} 100%{transform:scale(1.8);opacity:0;} }
        @keyframes butlerPulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        @keyframes butlerOrbit { from{transform:rotate(0deg) translateX(22px) rotate(0deg);} to{transform:rotate(360deg) translateX(22px) rotate(-360deg);} }
        @keyframes butlerSlideUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        @keyframes butlerBlink { 0%,90%,100%{opacity:1;} 45%{opacity:0;} }
        .butler-msg-user { background:rgba(212,175,55,0.1); border:1px solid rgba(212,175,55,0.2); align-self:flex-end; }
        .butler-msg-bot { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); align-self:flex-start; }
        .butler-msg-action { background:rgba(0,242,255,0.06); border:1px solid rgba(0,242,255,0.15); align-self:flex-start; }
        .butler-btn { background:none; border:none; cursor:pointer; outline:none; -webkit-tap-highlight-color:transparent; }
      `}</style>

      {/* FLOATING BUTLER ORB */}
      {!isOpen && (
        <div
          style={{ position:'fixed', bottom:'90px', right:'20px', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}
          onClick={handleOpen}
        >
          {/* Ripple rings */}
          {(isThinking || isSpeaking) && (
            <>
              <div style={{ position:'absolute', width:'64px', height:'64px', borderRadius:'50%', border:`2px solid ${orbColor}`, animation:'butlerRing 1.5s ease-out infinite', opacity:0.6 }} />
              <div style={{ position:'absolute', width:'64px', height:'64px', borderRadius:'50%', border:`2px solid ${orbColor}`, animation:'butlerRing 1.5s ease-out 0.5s infinite', opacity:0.4 }} />
            </>
          )}

          {/* Main Orb */}
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:`radial-gradient(circle at 35% 35%, ${orbColor}, rgba(10,10,10,0.9))`, boxShadow:`0 0 20px ${orbColor}66, 0 4px 20px rgba(0,0,0,0.5)`, display:'flex', alignItems:'center', justifyContent:'center', animation:'butlerFloat 3s ease-in-out infinite', cursor:'pointer', border:`2px solid ${orbColor}44`, position:'relative' }}>
            {/* Orbiting dot */}
            <div style={{ position:'absolute', width:'8px', height:'8px', borderRadius:'50%', background:orbColor, boxShadow:`0 0 6px ${orbColor}`, animation:'butlerOrbit 3s linear infinite' }} />
            {/* Butler icon */}
            <span style={{ fontSize:'22px', animation: isSpeaking ? 'butlerPulse 0.6s infinite' : 'none' }}>🎩</span>
          </div>

          <div style={{ fontSize:'9px', color:orbColor, fontWeight:900, letterSpacing:'1.5px', textShadow:`0 0 8px ${orbColor}`, background:'rgba(0,0,0,0.8)', padding:'3px 8px', borderRadius:'8px', whiteSpace:'nowrap' }}>
            {isThinking ? 'THINKING...' : isSpeaking ? 'SPEAKING...' : 'BUTLER AI'}
          </div>
        </div>
      )}

      {/* BUTLER PANEL */}
      {isOpen && (
        <div style={{ position:'fixed', bottom:'0', right:'0', zIndex:1001, width:'100%', maxWidth:'420px', height:'72vh', display:'flex', flexDirection:'column', background:'rgba(8,8,8,0.97)', backdropFilter:'blur(40px)', borderTop:'1px solid rgba(212,175,55,0.2)', borderLeft:'1px solid rgba(255,255,255,0.06)', borderRadius:'20px 20px 0 0', animation:'butlerSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)', boxShadow:'0 -10px 60px rgba(0,0,0,0.8)' }}>

          {/* HEADER */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:'14px', flexShrink:0 }}>
            {/* Small orb in header */}
            <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:`radial-gradient(circle at 35% 35%, ${orbColor}, rgba(10,10,10,0.9))`, boxShadow:`0 0 12px ${orbColor}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
              <span style={{ fontSize:'16px' }}>🎩</span>
              {(isSpeaking || isThinking) && <div style={{ position:'absolute', inset:'-3px', borderRadius:'50%', border:`2px solid ${orbColor}`, animation:'butlerRing 1.2s ease-out infinite' }} />}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'13px', fontWeight:900, color:'#FFF', letterSpacing:'1px' }}>MIRACLE BUTLER</div>
              <div style={{ fontSize:'10px', color: isSpeaking ? '#D4AF37' : isThinking ? '#00F2FF' : '#555', fontWeight:700, letterSpacing:'1px' }}>
                {isThinking ? '● THINKING...' : isSpeaking ? '● SPEAKING...' : isListening ? '● LISTENING...' : '● READY'}
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <button className="butler-btn" onClick={toggleMute} style={{ fontSize:'16px', opacity: isMuted ? 0.4 : 1 }} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? '🔇' : '🔊'}
              </button>
              <button className="butler-btn" onClick={() => { setIsOpen(false); stopSpeech(); }} style={{ fontSize:'18px', color:'#555' }}>✕</button>
            </div>
          </div>

          {/* MESSAGES */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign:'center', padding:'30px 20px', color:'#444' }}>
                <div style={{ fontSize:'32px', marginBottom:'12px' }}>🎩</div>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#666', letterSpacing:'1px' }}>YOUR PERSONAL CONCIERGE</div>
                <div style={{ fontSize:'11px', color:'#444', marginTop:'8px', lineHeight:'1.6' }}>Ask me anything — room service, temperature, housekeeping, transport, or spa bookings.</div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`butler-msg-${msg.role}`} style={{ padding:'10px 14px', borderRadius:'14px', maxWidth:'88%', animation:'butlerSlideUp 0.3s ease' }}>
                {msg.role === 'user' && <div style={{ fontSize:'9px', color:'#D4AF37', fontWeight:900, letterSpacing:'1px', marginBottom:'4px' }}>YOU</div>}
                {msg.role === 'bot' && <div style={{ fontSize:'9px', color:'#888', fontWeight:900, letterSpacing:'1px', marginBottom:'4px' }}>BUTLER</div>}
                <div style={{ fontSize:'13px', color: msg.role === 'action' ? '#00F2FF' : '#EEE', lineHeight:'1.6', fontWeight: msg.role === 'action' ? 700 : 400 }}>{msg.text}</div>
                <div style={{ fontSize:'9px', color:'#333', marginTop:'4px', textAlign:'right' }}>{msg.time}</div>
              </div>
            ))}
            {isThinking && (
              <div className="butler-msg-bot" style={{ padding:'12px 16px', borderRadius:'14px', maxWidth:'70%', display:'flex', gap:'6px', alignItems:'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#D4AF37', animation:`butlerPulse 1s ${i*0.2}s infinite` }} />)}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:'10px', alignItems:'center', flexShrink:0, background:'rgba(0,0,0,0.4)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askButler(input); } }}
              placeholder="Ask your butler..."
              style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'10px 14px', color:'#FFF', fontSize:'13px', outline:'none' }}
              disabled={isThinking}
            />
            {/* Mic button — push to talk */}
            <button
              className="butler-btn"
              onMouseDown={startListening}
              onMouseUp={() => recognitionRef.current?.stop()}
              onTouchStart={startListening}
              onTouchEnd={() => recognitionRef.current?.stop()}
              style={{ width:'40px', height:'40px', borderRadius:'50%', background: isListening ? 'rgba(255,49,49,0.3)' : 'rgba(212,175,55,0.1)', border:`1px solid ${isListening ? '#FF3131' : 'rgba(212,175,55,0.3)'}`, fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
            >
              {isListening ? '🔴' : '🎤'}
            </button>
            {/* Send button */}
            <button
              className="butler-btn"
              onClick={() => askButler(input)}
              disabled={!input.trim() || isThinking}
              style={{ width:'40px', height:'40px', borderRadius:'50%', background: input.trim() && !isThinking ? 'rgba(212,175,55,0.8)' : 'rgba(255,255,255,0.05)', border:'none', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.2s' }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
