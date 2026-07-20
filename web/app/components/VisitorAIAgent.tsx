'use client';
import { useState, useRef, useEffect } from 'react';

export default function VisitorAIAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'ai'|'user', text: string}[]>([
    { role: 'ai', text: 'Welcome to Miracle HMS. I am your exclusive concierge. How may I elevate your experience today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    try {
      const visitorId = localStorage.getItem('operative_id') || 'GUEST-1';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/visitor/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          visitor_id: visitorId,
          context: { current_path: window.location.pathname }
        })
      });
      
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply || 'System disruption. Please try again.' }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Kernel connection lost. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FLOATING ORB */}
      {!isOpen && (
        <div 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00F2FF, #D4AF37)',
            boxShadow: '0 0 20px rgba(0,242,255,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'pulse-orb 2s infinite',
            transition: 'transform 0.3s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ background: '#000', width: '54px', height: '54px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '24px' }}>✨</span>
          </div>
        </div>
      )}

      {/* CHAT DRAWER */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '350px',
          height: '500px',
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,242,255,0.3)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,242,255,0.1)'
        }}>
          {/* HEADER */}
          <div style={{
            padding: '15px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(90deg, rgba(0,242,255,0.1), transparent)'
          }}>
            <div>
              <div style={{ color: '#00F2FF', fontFamily: 'Cinzel', fontWeight: 900, fontSize: '16px', letterSpacing: '1px' }}>MIRACLE AI</div>
              <div style={{ color: '#888', fontSize: '9px', letterSpacing: '2px' }}>PREMIUM CONCIERGE</div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#FFF', fontSize: '20px', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>

          {/* MESSAGES */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.role === 'ai' ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                background: msg.role === 'ai' ? 'rgba(0,242,255,0.05)' : 'rgba(212,175,55,0.1)',
                border: `1px solid ${msg.role === 'ai' ? 'rgba(0,242,255,0.2)' : 'rgba(212,175,55,0.2)'}`,
                padding: '12px 16px',
                borderRadius: '12px',
                borderBottomLeftRadius: msg.role === 'ai' ? '2px' : '12px',
                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                color: '#FFF',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', color: '#00F2FF', fontSize: '12px', fontStyle: 'italic' }}>
                Analyzing core matrices...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div style={{
            padding: '15px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            gap: '10px'
          }}>
            <input 
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '10px 15px',
                color: '#FFF',
                outline: 'none',
                fontSize: '13px'
              }}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                background: '#00F2FF',
                border: 'none',
                borderRadius: '10px',
                width: '40px',
                color: '#000',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (isLoading || !input.trim()) ? 0.5 : 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-orb {
          0% { box-shadow: 0 0 0 0 rgba(0,242,255,0.4); }
          70% { box-shadow: 0 0 0 15px rgba(0,242,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,242,255,0); }
        }
      `}} />
    </>
  );
}
