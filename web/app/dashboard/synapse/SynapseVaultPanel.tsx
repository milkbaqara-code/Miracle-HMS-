'use client';
import React, { useState } from 'react';
import { EmpNode, VaultData, VaultFile } from './synapse.types';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface SynapseVaultPanelProps {
  vaultTarget: EmpNode;
  vaultData: VaultData | null;
  vaultLoading: boolean;
  myEmpId: string;
  token: string;
  onClose: () => void;
  onRefresh: () => void;
}

const FILE_CATEGORIES = ['DOCUMENT', 'PAYSLIP', 'JOINING_RECORD', 'CHAT_ATTACHMENT'] as const;
type FileCategory = typeof FILE_CATEGORIES[number];

const categoryLabel = (tab: FileCategory): string => {
  if (tab === 'DOCUMENT') return '📄 DOCS';
  if (tab === 'PAYSLIP') return '💰 PAYSLIPS';
  if (tab === 'JOINING_RECORD') return '🪪 ONBOARDING';
  return '💬 ATTACHMENTS';
};

const fileIcon = (fileType: string | null): string => {
  if (!fileType) return '📄';
  if (fileType.includes('pdf')) return '📕';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
  return '📄';
};

export default function SynapseVaultPanel({
  vaultTarget,
  vaultData,
  vaultLoading,
  myEmpId,
  token,
  onClose,
  onRefresh,
}: SynapseVaultPanelProps) {
  const [vaultTab, setVaultTab] = useState<FileCategory>('DOCUMENT');

  const uploadToVault = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', vaultTab);
    form.append('uploaded_by', myEmpId);
    try {
      await fetch(`${API}/synapse/vault/${vaultTarget.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      onRefresh();
    } catch (e) {
      console.error('Vault Upload Error:', e);
    }
  };

  const tabFiles: VaultFile[] = vaultData?.grouped?.[vaultTab] || [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1500 }}
      />

      {/* Vault Slide-In Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px',
        background: 'linear-gradient(180deg, #0a0a12 0%, #080810 100%)',
        borderLeft: '1px solid rgba(212,175,55,0.2)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.8), -1px 0 0 rgba(212,175,55,0.1)',
        zIndex: 1600, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Vault Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212,175,55,0.1)', background: 'rgba(212,175,55,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#D4AF37', letterSpacing: '3px', fontWeight: 900, marginBottom: '6px' }}>🗄️ SOVEREIGN VAULT</div>
              <div style={{ fontSize: '18px', color: '#FFF', fontWeight: 900 }}>{vaultTarget.name}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{vaultTarget.position} · {vaultTarget.department}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>×</button>
          </div>

          {/* Status Badges */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <div style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 900, letterSpacing: '1px', background: vaultTarget.on_duty ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${vaultTarget.on_duty ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`, color: vaultTarget.on_duty ? '#00ff88' : '#444' }}>
              {vaultTarget.on_duty ? '● ON-DUTY' : '○ OFF-DUTY'}
            </div>
            <div style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 900, letterSpacing: '1px', background: vaultTarget.is_online ? 'rgba(0,251,255,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${vaultTarget.is_online ? 'rgba(0,251,255,0.25)' : 'rgba(255,255,255,0.08)'}`, color: vaultTarget.is_online ? '#00fbff' : '#444' }}>
              {vaultTarget.is_online ? '◉ ONLINE' : '○ OFFLINE'}
            </div>
          </div>

          {vaultData && (
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#555' }}>
              {vaultData.total_files} file{vaultData.total_files !== 1 ? 's' : ''} stored in vault
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 8px', overflowX: 'auto' }}>
          {FILE_CATEGORIES.map(tab => (
            <button key={tab} onClick={() => setVaultTab(tab)} style={{
              background: 'none', border: 'none',
              borderBottom: `2px solid ${vaultTab === tab ? '#D4AF37' : 'transparent'}`,
              color: vaultTab === tab ? '#D4AF37' : '#555',
              padding: '12px 10px', fontSize: '9px', fontWeight: 900,
              letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s',
            }}>
              {categoryLabel(tab)}
            </button>
          ))}
        </div>

        {/* File List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {vaultLoading ? (
            <div style={{ textAlign: 'center', color: '#D4AF37', marginTop: '60px', fontSize: '12px', letterSpacing: '2px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'pulse 1.5s infinite' }}>🗄️</div>
              DECRYPTING VAULT...
            </div>
          ) : tabFiles.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#333', marginTop: '50px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📂</div>
              <div style={{ fontSize: '11px' }}>No {vaultTab.toLowerCase().replace('_', ' ')} files yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tabFiles.map(f => (
                <a key={f.id} href={`${API}${f.download_url}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.1)'; }}>
                    <div style={{ fontSize: '22px', flexShrink: 0 }}>{fileIcon(f.file_type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.original_name}</div>
                      <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>
                        {(f.file_size_bytes / 1024).toFixed(1)} KB · {new Date(f.uploaded_at).toLocaleDateString()}
                      </div>
                      {f.description && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontStyle: 'italic' }}>{f.description}</div>}
                    </div>
                    <div style={{ fontSize: '14px', color: '#D4AF37', flexShrink: 0 }}>⬇</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
          <input type="file" id="vault-upload-input" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadToVault(f); e.currentTarget.value = ''; }} />
          <button
            onClick={() => document.getElementById('vault-upload-input')?.click()}
            style={{ width: '100%', padding: '12px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', color: '#D4AF37', cursor: 'pointer', fontWeight: 900, fontSize: '11px', letterSpacing: '2px', transition: '0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.08)'; }}>
            ⬆ UPLOAD TO {vaultTab.replace('_', ' ')}
          </button>
        </div>
      </div>
    </>
  );
}
