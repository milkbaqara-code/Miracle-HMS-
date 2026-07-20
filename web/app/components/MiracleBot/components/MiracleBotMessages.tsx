'use client';
// ============================================================
// MiracleBot / components / MiracleBotMessages.tsx
// Renders the scrollable chat message list — bot/user/alert/info
// bubbles, markdown, charts, proposal cards, contact CTAs,
// thinking dots, and the awaken circle.
// V4.0 — Enterprise Refactor
// ============================================================
import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { BotMessage, ProposalPayload, ZoneInfo } from '../lib/types';
import { SovereignChartRenderer } from './SovereignChartRenderer';
import { MiracleBotProposalCard } from './MiracleBotProposalCard';

const typewriterStyles = `
  @keyframes mirBlink {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

interface MessagesProps {
  messages: BotMessage[];
  isThinking: boolean;
  zone: ZoneInfo;
  hasInteracted: React.MutableRefObject<boolean>;
  isAwakening: boolean;
  visitorWarning: string | null;
  onAwaken: () => void;
  onApproveProposal: (i: number) => void;
  onDeclineProposal: (i: number) => void;
  onPanelClick: () => void;
}

function TypingBubble({ text, isLast, thColor, onComplete }: { text: string; isLast: boolean; thColor: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState(isLast ? '' : text);
  const [isDone, setIsDone] = useState(!isLast);

  useEffect(() => {
    if (!isLast) {
      setDisplayedText(text);
      setIsDone(true);
      return;
    }

    setDisplayedText('');
    setIsDone(false);

    const words = text.split(' ');
    let currentIdx = 0;

    if (words.length === 0 || !text) {
      setDisplayedText(text);
      setIsDone(true);
      onComplete?.();
      return;
    }

    setDisplayedText(words[0]);

    if (words.length === 1) {
      setIsDone(true);
      onComplete?.();
      return;
    }

    const speed = Math.max(12, Math.min(45, 1600 / words.length));

    const timer = setInterval(() => {
      currentIdx++;
      if (currentIdx >= words.length) {
        clearInterval(timer);
        setIsDone(true);
        onComplete?.();
      } else {
        setDisplayedText(prev => prev + ' ' + words[currentIdx]);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, isLast, onComplete]);

  const textWithCursor = isDone ? displayedText : displayedText + ' ▋';

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ ...p }) => (
          <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }} {...p} />
          </div>
        ),
        th:    ({ ...p }) => <th style={{ background: 'rgba(255,255,255,0.06)', color: thColor, borderBottom: '1px solid rgba(255,255,255,0.15)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', textAlign: 'left', fontWeight: 800, letterSpacing: '0.05em' }} {...p} />,
        td:    ({ ...p }) => <td style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '8px 14px', color: '#cbd5e1', lineHeight: 1.5 }} {...p} />,
        h2:    ({ ...p }) => <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '20px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: 6, letterSpacing: '0.03em' }} {...p} />,
        h3:    ({ ...p }) => <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '16px 0 8px' }} {...p} />,
        h4:    ({ ...p }) => <h4 style={{ fontSize: 13, fontWeight: 800, color: '#00F2FF', margin: '14px 0 6px', letterSpacing: '0.02em', textTransform: 'uppercase' }} {...p} />,
        pre:   ({ ...p }) => <pre style={{ background: 'rgba(0,0,20,0.6)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: 8, padding: '12px', overflowX: 'auto', margin: '12px 0' }} {...p} />,
        ul:    ({ ...p }) => <ul style={{ margin: '10px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }} {...p} />,
        ol:    ({ ...p }) => <ol style={{ margin: '10px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }} {...p} />,
        li:    ({ ...p }) => <li style={{ color: '#cbd5e1', lineHeight: 1.6 }} {...p} />,
        p:     ({ ...p }) => <p  style={{ margin: '0 0 12px 0', color: '#f1f5f9', lineHeight: 1.7 }} {...p} />,
        code:  ({ className, children, node, ...p }: any) => {
          const lang = className?.replace('language-', '') || '';
          if (lang === 'json_chart') {
            return <SovereignChartRenderer raw={String(children)} />;
          }
          // If it has a newline, it's a block of code (or inside a <pre>)
          const isBlock = String(children).includes('\n');
          return (
            <code style={{ 
              background: isBlock ? 'transparent' : 'rgba(0,242,255,0.08)', 
              border: isBlock ? 'none' : '1px solid rgba(0,242,255,0.2)', 
              borderRadius: 6, 
              padding: isBlock ? 0 : '3px 7px', 
              fontSize: 12, 
              color: '#00F2FF', 
              fontFamily: 'monospace',
              whiteSpace: isBlock ? 'pre-wrap' : 'normal',
              display: isBlock ? 'block' : 'inline',
            }} {...p}>
              {children}
            </code>
          );
        },
      }}
    >
      {textWithCursor}
    </ReactMarkdown>
  );
}

export function MiracleBotMessages({
  messages, isThinking, zone,
  hasInteracted, isAwakening, visitorWarning,
  onAwaken, onApproveProposal, onDeclineProposal, onPanelClick,
}: MessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const c = zone.color;

  const [thinkingPhase, setThinkingPhase] = useState('Thinking...');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isThinking) return;
    const phases = [
      '🧠 Right, give me one moment — initializing Sovereign Intelligence...',
      '🔍 Scanning Sovereign Vault across all active zones...',
      '📡 Querying Z-11 Accounts · Z-05 Reservations · Z-09 HR...',
      '⚡ Executing Tactical Execution Bridge — SQL synthesis active...',
      '🛡️ Apoptosis Guard verified — mutation keywords cleared...',
      '📊 Applying McKinsey Analytics Framework V15.0...',
      '💰 Cross-referencing PMS Financial Engine — UDI · WHT · DSCR...',
      '🏨 Analysing zone telemetry — occupancy · RevPAR · COGS%...',
      '🔐 RBAC fence validated — role-gated data access confirmed...',
      '📈 Structuring Markdown tables · Proactive anomaly detection active...',
      '✨ Synthesizing executive-grade response — almost there...',
      '🎯 Sovereign intelligence locked. Delivering now...',
    ];
    let idx = 0;
    setThinkingPhase(phases[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setThinkingPhase(phases[idx]);
    }, 1800);
    return () => clearInterval(timer);
  }, [isThinking]);

  const userGender =
    typeof window !== 'undefined'
      ? (localStorage.getItem('operative_gender') || 'UNSPECIFIED')
      : 'UNSPECIFIED';
  const userAvatarEmoji = userGender === 'MALE' ? '👨' : userGender === 'FEMALE' ? '👩' : '👤';

  return (
    <div
      onClick={onPanelClick}
      style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <style dangerouslySetInnerHTML={{ __html: typewriterStyles }} />

      {/* VISITOR RESTRICTION BANNER */}
      {visitorWarning && (
        <div style={{
          padding: '12px 16px', background: 'rgba(255,165,0,0.1)',
          border: '1px solid rgba(255,165,0,0.4)', borderRadius: 14,
          fontSize: 12, color: '#FFA500', lineHeight: 1.6,
        }}>
          ⚠️ {visitorWarning}
          <a
            href="https://wa.me/8801711477509"
            target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 10, padding: 10, borderRadius: 10, background: '#25D366',
              color: '#fff', fontWeight: 800, fontSize: 11, textDecoration: 'none', gap: 6,
            }}
          >
            💬 WhatsApp Engineer
          </a>
        </div>
      )}

      {/* SOVEREIGN AWAKEN CIRCLE */}
      {(!hasInteracted.current) && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '28px 20px', gap: 18,
          animation: 'slide-in-bot 0.5s ease-out',
        }}>
          <div onClick={onAwaken} style={{ position: 'relative', width: 90, height: 90, cursor: 'pointer' }}>
            <svg width="90" height="90" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(0,242,255,0.12)" strokeWidth="3" />
              {isAwakening && (
                <circle
                  cx="45" cy="45" r="40"
                  fill="none" stroke="#00F2FF" strokeWidth="3" strokeLinecap="round"
                  style={{
                    strokeDasharray: 251, strokeDashoffset: 251,
                    animation: 'circleComplete 1.4s cubic-bezier(0.4,0,0.2,1) forwards',
                    filter: 'drop-shadow(0 0 6px #00F2FF)',
                  }}
                />
              )}
            </svg>
            <div style={{
              position: 'absolute', inset: 10, borderRadius: '50%',
              background: isAwakening
                ? 'radial-gradient(circle, rgba(0,242,255,0.5) 0%, rgba(0,242,255,0.1) 70%)'
                : 'radial-gradient(circle, rgba(0,242,255,0.2) 0%, rgba(0,242,255,0.03) 70%)',
              border: `1.5px solid rgba(0,242,255,${isAwakening ? '0.8' : '0.35'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isAwakening
                ? '0 0 30px rgba(0,242,255,0.6), inset 0 0 20px rgba(0,242,255,0.2)'
                : '0 0 15px rgba(0,242,255,0.25)',
              animation: isAwakening ? 'none' : 'awakenPulse 2s ease-in-out infinite',
              transition: 'all 0.3s ease',
            }}>
              <span style={{ fontSize: 22, filter: isAwakening ? 'drop-shadow(0 0 8px #00F2FF)' : 'none', transition: '0.3s' }}>
                {isAwakening ? '✨' : '🤖'}
              </span>
            </div>
          </div>
          <div style={{
            color: isAwakening ? '#00F2FF' : 'rgba(0,242,255,0.8)',
            fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase',
            textShadow: isAwakening ? '0 0 12px #00F2FF' : 'none',
            animation: isAwakening ? 'none' : 'mirFade 2.5s ease-in-out infinite',
            transition: 'all 0.3s',
          }}>
            {isAwakening ? 'AWAKENING...' : 'START MIRACLE'}
          </div>
        </div>
      )}

      {/* MESSAGE BUBBLES */}
      {messages.map((m, i) => {
        const isUser = m.role === 'user';
        const isLast = i === messages.length - 1;
        return (
          <div key={i} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '88%', animation: 'mirFade 0.4s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexDirection: isUser ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              {!isUser && m.role !== 'alert' && m.role !== 'info' ? (
                <div style={{
                  width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0,242,255,0.15) 0%, rgba(157,0,255,0.1) 100%)',
                  border: '1px solid rgba(0,242,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, boxShadow: '0 0 10px rgba(0,242,255,0.3)', marginTop: 2,
                }}>🤖</div>
              ) : isUser ? (
                <div style={{
                  width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0,242,255,0.1) 0%, rgba(0,0,20,0.8) 100%)',
                  border: '1px solid rgba(0,242,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, marginTop: 2,
                }}>{userAvatarEmoji}</div>
              ) : null}

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Bubble */}
                <div style={{
                  padding: '14px 18px',
                  borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  background: isUser
                    ? 'rgba(0,242,255,0.07)'
                    : m.role === 'alert' ? 'rgba(255,49,49,0.07)'
                    : m.role === 'info'  ? 'rgba(57,255,20,0.07)'
                    : 'rgba(255,255,255,0.04)',
                  border: m.role === 'alert' ? '1px solid #FF313133'
                        : m.role === 'info'  ? '1px solid #39FF1433'
                        : '1px solid rgba(255,255,255,0.07)',
                  color: m.role === 'alert' ? '#FF3131'
                       : m.role === 'info'  ? '#39FF14'
                       : '#eee',
                  fontSize: 13, lineHeight: 1.75,
                }}>
                  {!isUser && m.role !== 'alert' && m.role !== 'info' ? (
                    <TypingBubble text={m.text} isLast={isLast} thColor={c} />
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                  )}
                </div>

                {/* Proposal Card */}
                {m.proposal && (
                  <MiracleBotProposalCard
                    proposal={m.proposal}
                    messageIndex={i}
                    onApprove={onApproveProposal}
                    onDecline={onDeclineProposal}
                  />
                )}

                {/* Contact CTAs */}
                {m.showContact && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, animation: 'mirFade 0.4s ease-out' }}>
                    <a href="https://wa.me/8801711477509?text=Hi%2C%20I%20need%20pricing%20details%20for%20Miracle%20OS" target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 14, background: 'linear-gradient(135deg,#25D366 0%,#128C7E 100%)', color: '#fff', fontWeight: 900, fontSize: 11, textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,211,102,0.4)', transition: '0.2s' }}>
                      <span style={{ fontSize: 16 }}>💬</span> Chat on WhatsApp
                    </a>
                    <a href="mailto:admin@vigilantitsolution.com?subject=Miracle%20OS%20Pricing%20Enquiry"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 14, background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.35)', color: '#00F2FF', fontWeight: 900, fontSize: 11, textDecoration: 'none' }}>
                      <span style={{ fontSize: 16 }}>✉️</span> Email Our Engineers
                    </a>
                  </div>
                )}

                {/* Z-LOGIN: always show CTAs after last bot message */}
                {zone.zone === 'Z-LOGIN' && !m.showContact && isLast && m.role === 'bot' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, animation: 'mirFade 0.4s ease-out' }}>
                    <a href="https://wa.me/8801711477509?text=Hi%2C%20I%20need%20a%20Miracle%20OS%20demo" target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 14, background: 'linear-gradient(135deg,#25D366 0%,#128C7E 100%)', color: '#fff', fontWeight: 900, fontSize: 11, textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,211,102,0.4)' }}>
                      💬 Chat on WhatsApp
                    </a>
                    <a href="mailto:admin@vigilantitsolution.com?subject=Miracle%20OS%20Demo%20Request"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 14, background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.35)', color: '#00F2FF', fontWeight: 900, fontSize: 11, textDecoration: 'none' }}>
                      ✉️ Email Our Engineers
                    </a>
                  </div>
                )}

                <div style={{ fontSize: 10, color: '#444', marginTop: 4, textAlign: isUser ? 'right' : 'left', fontWeight: 700 }}>{m.time}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* THINKING DOTS */}
      {isThinking && (
        <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,242,255,0.15) 0%, rgba(157,0,255,0.1) 100%)',
            border: '1px solid rgba(0,242,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, boxShadow: '0 0 10px rgba(0,242,255,0.3)',
            animation: 'mirDot 1.2s 0s infinite',
          }}>🤖</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 5, padding: '14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: '20px 20px 20px 4px', alignItems: 'center' }}>
              {[0,1,2].map(d => (
                <div key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: c, animation: `mirDot 1.2s ${d * 0.2}s infinite` }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', paddingLeft: 8, fontStyle: 'italic', fontWeight: 600, animation: 'mirBlink 1s infinite alternate' }}>
              {thinkingPhase}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

