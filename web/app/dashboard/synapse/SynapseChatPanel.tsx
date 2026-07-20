'use client';
import React, { useRef, useState, useCallback } from 'react';
import { SynapseThread, SynapseMessage } from './synapse.types';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

// ─── SMART ATTACHMENT RENDERER ─────────────────────────────────────────
// Iron Law 9: hardware-accelerated transitions only (transform, opacity)
function SmartAttachment({
  url,
  fileName,
  fileType,
  fileSizeBytes,
  isMe,
}: {
  url: string;
  fileName: string;
  fileType?: string;
  fileSizeBytes?: number;
  isMe: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const ft = fileType ?? '';
  const sizeLabel = fileSizeBytes ? `${(fileSizeBytes / 1024).toFixed(1)} KB` : '';

  const borderColor = isMe ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.1)';
  const bgColor     = isMe ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.04)';

  // ── IMAGE ─────────────────────────────────────────────────────
  if (ft.startsWith('image/')) {
    return (
      <>
        <div
          onClick={() => setLightboxOpen(true)}
          style={{
            maxWidth: '260px', cursor: 'zoom-in',
            borderRadius: '12px', overflow: 'hidden',
            border: `1px solid ${borderColor}`,
            background: bgColor,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          {!imgLoaded && (
            <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
              <span style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>🖼️</span>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={fileName}
            onLoad={() => setImgLoaded(true)}
            style={{
              display: imgLoaded ? 'block' : 'none',
              width: '100%', maxHeight: '200px',
              objectFit: 'cover',
            }}
          />
          <div style={{ padding: '6px 10px', fontSize: '10px', color: '#666' }}>
            🖼️ {fileName} {sizeLabel && `· ${sizeLabel}`}
          </div>
        </div>

        {/* Lightbox */}
        {lightboxOpen && (
          <div
            onClick={() => setLightboxOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={fileName}
              style={{
                maxWidth: '90vw', maxHeight: '88vh',
                objectFit: 'contain', borderRadius: '8px',
                boxShadow: '0 0 80px rgba(0,0,0,0.9)',
                animation: 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
              }}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute', top: '20px', right: '24px',
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: '#FFF', fontSize: '24px', cursor: 'pointer',
                width: '44px', height: '44px', borderRadius: '50%',
              }}
            >×</button>
          </div>
        )}
      </>
    );
  }

  // ── VIDEO ─────────────────────────────────────────────────────
  if (ft.startsWith('video/')) {
    return (
      <div style={{
        maxWidth: '300px', borderRadius: '12px', overflow: 'hidden',
        border: `1px solid ${borderColor}`, background: bgColor,
      }}>
        <video
          controls
          preload="metadata"
          style={{ width: '100%', maxHeight: '180px', display: 'block', background: '#000' }}
        >
          <source src={url} type={ft} />
        </video>
        <div style={{ padding: '6px 10px', fontSize: '10px', color: '#666' }}>
          🎬 {fileName} {sizeLabel && `· ${sizeLabel}`}
        </div>
      </div>
    );
  }

  // ── AUDIO ─────────────────────────────────────────────────────
  if (ft.startsWith('audio/')) {
    return (
      <div style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px', padding: '12px 16px',
        minWidth: '220px', maxWidth: '300px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🎙️</span>
          <div>
            <div style={{ fontSize: '11px', color: '#CCC', fontWeight: 700 }}>{fileName}</div>
            {sizeLabel && <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{sizeLabel}</div>}
          </div>
        </div>
        <audio controls preload="metadata" style={{ width: '100%', height: '32px' }}>
          <source src={url} type={ft} />
        </audio>
      </div>
    );
  }

  // ── PDF / Excel / Generic Download ────────────────────────────
  const fileIcon = ft.includes('pdf') ? '📕'
    : (ft.includes('sheet') || ft.includes('excel')) ? '📊'
    : ft.includes('word') ? '📄'
    : '📎';

  return (
    <a href={url} target="_blank" rel="noreferrer" download style={{ textDecoration: 'none', maxWidth: '70%' }}>
      <div
        style={{
          background: bgColor, border: `1px solid ${borderColor}`,
          padding: '12px 16px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '12px',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D4AF37'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}
      >
        <div style={{ fontSize: '24px' }}>{fileIcon}</div>
        <div>
          <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 700 }}>{fileName}</div>
          {sizeLabel && (
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{sizeLabel} · Click to download</div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '16px', color: '#D4AF37' }}>⬇</div>
      </div>
    </a>
  );
}

interface SynapseChatPanelProps {
  activeThread: SynapseThread;
  messages: SynapseMessage[];
  myEmpId: string;
  msgInput: string;
  uploadingFile: boolean;
  chatWsRef: React.MutableRefObject<WebSocket | null>;
  onClose: () => void;
  onMsgInputChange: (val: string) => void;
  onSend: () => void;
  onFileUpload: (file: File) => void;
}

const getTierColor = (tier: number): string => {
  if (tier === 4) return '#D4AF37';
  if (tier === 3) return '#ff3366';
  if (tier === 2) return '#00ff88';
  return '#00fbff';
};

export default function SynapseChatPanel({
  activeThread,
  messages,
  myEmpId,
  msgInput,
  uploadingFile,
  onClose,
  onMsgInputChange,
  onSend,
  onFileUpload,
}: SynapseChatPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const glass = {
    background: 'rgba(10, 10, 10, 0.6)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    backdropFilter: 'blur(20px)',
  };

  return (
    <div style={{ ...glass, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#FFF', fontWeight: 900, letterSpacing: '1px' }}>{activeThread.subject}</div>
          <div style={{ fontSize: '10px', color: activeThread.thread_type === 'BRIDGED' ? '#ff3366' : '#00fbff', letterSpacing: '1px', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ padding: '2px 6px', border: `1px solid ${activeThread.thread_type === 'BRIDGED' ? '#ff3366' : '#00fbff'}`, borderRadius: '4px' }}>
              {activeThread.thread_type} THREAD
            </span>
            {activeThread.bridge_manager_id && <span>CC: {activeThread.bridge_manager_id}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* COMM-LINK placeholder — wired in Batch 3 (WebRTC) */}
          <button
            title="Video call (coming in Batch 3)"
            style={{ background: 'none', border: '1px solid rgba(0,251,255,0.3)', color: '#00fbff44', padding: '6px 12px', borderRadius: '6px', cursor: 'not-allowed', fontSize: '11px', fontWeight: 900 }}>
            📹 COMM-LINK
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
      </div>

      {/* Messages Feed */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map(msg => {
          const isMe = msg.sender_id === myEmpId;
          const isSys = msg.msg_type === 'SYSTEM';
          const tColor = getTierColor(msg.sender_tier);

          if (isSys) {
            const isAgi = msg.sender_id === 'SYSTEM_AGI';
            return (
              <div key={msg.id} style={{ textAlign: 'center', margin: '16px 0' }}>
                <span style={{ 
                  fontSize: '10px', 
                  color: isAgi ? '#00fbff' : '#888', 
                  background: isAgi ? 'linear-gradient(90deg, rgba(0,251,255,0.05), rgba(212,175,55,0.05))' : 'rgba(255,255,255,0.05)', 
                  padding: '6px 16px', 
                  borderRadius: '12px', 
                  border: `1px solid ${isAgi ? 'rgba(0,251,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: isAgi ? '0 0 10px rgba(0,251,255,0.1)' : 'none',
                  fontWeight: isAgi ? 900 : 'normal'
                }}>
                  {isAgi ? '✨ AGI ARBITRATOR: ' : '🛡️ '}{msg.content}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                {!isMe && <span style={{ color: tColor, fontWeight: 900 }}>{msg.sender_name}</span>}
                <span>{new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {msg.msg_type === 'FILE' ? (
                <SmartAttachment
                  url={`${API}${msg.attachment_url}`}
                  fileName={msg.content}
                  fileType={msg.file_type}
                  fileSizeBytes={msg.file_size_bytes}
                  isMe={isMe}
                />
              ) : (
                <div style={{
                  background: isMe ? 'rgba(0, 251, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isMe ? 'rgba(0, 251, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'}`,
                  padding: '12px 16px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  color: '#EEE', fontSize: '13px', maxWidth: '70%', lineHeight: '1.6'
                }}>
                  {msg.content}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFileUpload(f); e.target.value = ''; }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          title="Attach file"
          style={{ background: uploadingFile ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: uploadingFile ? '#D4AF37' : '#888', width: '44px', height: '44px', borderRadius: '10px', cursor: 'pointer', fontSize: '18px', flexShrink: 0, transition: '0.2s' }}>
          {uploadingFile ? '⏳' : '📎'}
        </button>
        {/* Voice message button — wired in Batch 3 */}
        <button
          title="Voice message (coming in Batch 3)"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#444', width: '44px', height: '44px', borderRadius: '10px', cursor: 'not-allowed', fontSize: '18px', flexShrink: 0 }}>
          🎙️
        </button>
        <input
          type="text"
          value={msgInput}
          onChange={e => onMsgInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="Transmit via Secure Channel..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0 16px', height: '44px', color: '#FFF', outline: 'none', fontSize: '13px' }}
        />
        <button
          onClick={onSend}
          style={{ background: 'linear-gradient(135deg, rgba(0,251,255,0.15), rgba(0,251,255,0.05))', border: '1px solid rgba(0,251,255,0.4)', color: '#00fbff', padding: '0 20px', height: '44px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, letterSpacing: '1px', fontSize: '11px', flexShrink: 0 }}>
          SEND
        </button>
      </div>
    </div>
  );
}
