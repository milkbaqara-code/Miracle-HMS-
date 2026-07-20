// web/app/dashboard/settings/page.tsx — Z-21 SOVEREIGN SETTINGS + DEV REQUESTS
'use client';
import { useState, useEffect, useCallback } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';
import ThemeControlPanel from '../../components/ThemeControlPanel';

// --- SYSTEM CONTRACTS ---
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || '/api'}/settings`;
const BOT_API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface FeatureRequest {
  id: number;
  request_text: string;
  zone: string;
  user_id: string;
  status: string;
  created_at: string;
  reference_id: string;
}

interface SalesLead {
  id: number;
  lead_name: string;
  enterprise_name: string;
  enterprise_size: string;
  contact_details: string;
  status: string;
  created_at: string;
}

export default function MasterOSSettings() {
  const [activeTab, setActiveTab] = useState('SECURITY');
  const [isKernelUnlocked, setIsKernelUnlocked] = useState(false);
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [pinBuffer, setPinBuffer] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [frLoading, setFrLoading] = useState(false);
  const [salesLeads, setSalesLeads] = useState<SalesLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [credsLoading, setCredsLoading] = useState(false);

  const [config, setConfig] = useState<any>({
    auth_expiry_minutes: 480,
    ip_whitelist: '127.0.0.1, 192.168.1.0/24',
    sync_pulse_interval: 2,
    biometric_threshold: 0.85,
    stripe_live_mode: false,
    system_log_level: 'DEBUG',
    auto_backup: true,
    financial_laws: { exchange_rate_usd: 110.5, exchange_rate_aed: 30.5, base_currency: 'BDT' }
  });

  // ==========================================
  // 1. DATA SYNCHRONIZATION ENGINE
  // ==========================================
  const pullCurrentConfig = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/live`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data || data); // Extract data from envelope
      }
    } catch (e) {
      console.warn("🚨 KERNEL OFFLINE: Settings operating in Sovereign Local Mode.");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { pullCurrentConfig(); }, [pullCurrentConfig]);

  const triggerKernelSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast('KERNEL HOT-SYNC SUCCESSFUL', 'success', `System is now on version: ${data.version || 'latest'}`);
        pullCurrentConfig();
      } else {
        showToast('SYNC FAILED', 'warning', `Status: ${res.status}`);
      }
    } catch (e) {
      showToast('KERNEL OFFLINE', 'error', 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const commitToKernel = async (key: string, value: any) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [key]: value,
          master_pin: pinBuffer,
          operator_id: 'ADMIN'
        })
      });
      if (res.ok) {
        setConfig(prev => ({ ...prev, [key]: value }));
        console.log(`✅ SYNC SUCCESS: ${key} updated in Master Vault.`);
      }
    } catch (e) {
      // Local UI update if API fails during dev
      setConfig(prev => ({ ...prev, [key]: value }));
    } finally {
      setIsSyncing(false);
    }
  };

  const executeMaintenanceAction = async (actionPath: string, successMsg: string) => {
    const confirmed = await showConfirm('SYSTEM ACTION', `Execute: ${successMsg}?`);
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/${actionPath}`, { method: 'POST' });
      if (res.ok) showToast(successMsg, 'success', 'Action completed.');
      else showToast('FAILED', 'warning', `Status: ${res.status}`);
    } catch (e) {
      showToast('KERNEL OFFLINE', 'error', 'Action failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const updateCurrencyRate = async (rates: Record<string, number>, baseCurrency: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/currency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rates,
          base_currency: baseCurrency,
          master_pin: pinBuffer,
          operator_id: 'ADMIN'
        })
      });
      if (res.ok) {
        showToast('CURRENCY UPDATED', 'success', 'All 14 exchange rates saved to Sovereign Kernel.');
        pullCurrentConfig();
      } else {
        showToast('CURRENCY UPDATE FAILED', 'error', 'Invalid PIN or server error.');
      }
    } catch (e) {
      showToast('KERNEL OFFLINE', 'error', 'Action failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Load feature requests from the Miracle AI dev feedback endpoint
  const loadFeatureRequests = useCallback(async () => {
    setFrLoading(true);
    try {
      const res = await fetch(`${BOT_API}/bot/feature-requests`);
      if (res.ok) {
        const data = await res.json();
        setFeatureRequests(Array.isArray(data) ? data : data.requests || []);
      }
    } catch {
      console.warn('Feature requests endpoint offline.');
    } finally {
      setFrLoading(false);
    }
  }, []);

  const loadSalesLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch(`${BOT_API}/bot/sales-leads`);
      if (res.ok) {
        const data = await res.json();
        setSalesLeads(Array.isArray(data) ? data : []);
      }
    } catch {
      console.warn('Sales leads endpoint offline.');
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const loadDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await fetch(`${API_BASE}/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data.data);
      }
    } catch {
      console.warn('Diagnostics endpoint offline.');
    } finally {
      setDiagLoading(false);
    }
  }, []);

  const loadCredentials = useCallback(async () => {
    setCredsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/credentials`);
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.data || []);
      }
    } catch {
      console.warn('Vault endpoint offline.');
    } finally {
      setCredsLoading(false);
    }
  }, []);

  const saveCredential = async (cred: any) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/credentials/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cred,
          master_pin: pinBuffer,
          operator_id: 'ADMIN'
        })
      });
      if (res.ok) {
        showToast('VAULT UPDATED', 'success', `${cred.label} secured.`);
        loadCredentials();
      } else {
        const err = await res.json();
        showToast('VAULT ERROR', 'error', err.detail || 'Access Denied');
      }
    } catch {
      showToast('KERNEL OFFLINE', 'error', 'Vault write failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const updateLocalCred = (label: string, field: string, value: string) => {
    setCredentials(prev => prev.map(c => c.label === label ? { ...c, [field]: value } : c));
  };

  // ==========================================
  // 2. SECURITY HANDSHAKE (PIN GATE)
  // ==========================================
  const handleUnlock = () => {
    if (pinBuffer === '1414') {
      setIsKernelUnlocked(true);
    } else {
      showToast('SECURITY VIOLATION', 'error', 'Invalid PIN Buffer.');
      setPinBuffer('');
    }
  };

  if (!isKernelUnlocked) {
    return (
      <div style={gateStyle}>
        <div style={gateBox}>
          <h2 style={{ fontFamily: 'Cinzel', color: '#D4AF37', margin: '0 0 20px 0' }}>LOCK SYSTEM HANDSHAKE</h2>
          <p style={{ fontSize: '10px', color: '#888', marginBottom: '30px' }}>ZONE 21 REQUIRES SECONDARY CDO AUTHORIZATION</p>
          <input 
            type="password" 
            placeholder="ENTER MASTER PIN" 
            style={pinInput} 
            value={pinBuffer}
            onChange={(e) => setPinBuffer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
          <button onClick={handleUnlock} style={unlockBtn}>DECRYPT SETTINGS</button>
        </div>
      </div>
    );
  }

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={{ padding: '0 20px', maxWidth: '1700px', margin: '0 auto' }}>
      <ViewModeBanner />
      
      {/* HUD: MASTER HEADER */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={pulseStatus}></div>
          <h1 style={titleStyle}>SYSTEM ARCHITECTURE CORE</h1>
        </div>
        <div style={subTitleStyle}>
          {isSyncing ? '📡 RE-SYNCING KERNEL...' : '🔒 SOVEREIGN ENCRYPTION ACTIVE | v99.1-GOLD'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '40px', marginTop: '30px' }}>
        
        {/* TAB MATRIX */}
        <div style={sidebarPanel}>
          {['SECURITY', 'PASSWORD VAULT', 'BRIDGES', 'TELEMETRY', 'SALES CRM', 'DEV REQUESTS', 'DIAGNOSTICS', 'MAINTENANCE', 'THEME ENGINE', 'CURRENCY ENGINE'].map(tab => (
            <div
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'DEV REQUESTS') loadFeatureRequests();
                if (tab === 'SALES CRM') loadSalesLeads();
                if (tab === 'DIAGNOSTICS') loadDiagnostics();
                if (tab === 'PASSWORD VAULT') loadCredentials();
              }}
              style={tabItem(activeTab === tab)}
            >
              {tab === 'DEV REQUESTS' ? '💡 DEV REQUESTS' : tab === 'PASSWORD VAULT' ? '🔐 PASSWORD VAULT' : tab === 'THEME ENGINE' ? '🎨 THEME ENGINE' : tab === 'CURRENCY ENGINE' ? '🔱 CURRENCY ENGINE' : tab}
              {activeTab === tab && <div style={sideGlow}></div>}
            </div>
          ))}
          <div style={kernelStats}>
            <small style={{color:'#444'}}>KERNEL UPTIME</small>
            <div style={{color:'#D4AF37', fontSize:'14px', fontWeight:900}}>LIVE</div>
          </div>
        </div>

        {/* ACTIVE CONFIG VIEWPORT */}
        <div style={viewportPanel}>
          
          {activeTab === 'SECURITY' && (
            <div className="fade-in">
              <h3 style={sectionTitle}>🛡️ SECURITY PERIMETER</h3>
              <div style={configGrid}>
                <div style={fieldItem}>
                  <label style={labelStyle}>SESSION EXPIRY (MINS)</label>
                  <input 
                    type="number" style={inputStyle} 
                    value={config.auth_expiry_minutes} 
                    onChange={(e) => commitToKernel('auth_expiry_minutes', Number(e.target.value))}
                  />
                </div>
                <div style={fieldItem}>
                  <label style={labelStyle}>IP WHITELIST RANGE</label>
                  <input 
                    style={inputStyle} 
                    value={config.ip_whitelist} 
                    onChange={(e) => commitToKernel('ip_whitelist', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PASSWORD VAULT' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h3 style={sectionTitle}>🔐 SOVEREIGN PASSWORD VAULT</h3>
                <button onClick={loadCredentials} style={refreshBtn}>
                  {credsLoading ? 'DECRYPTING...' : '↺ REFRESH VAULT'}
                </button>
              </div>
              
              {credentials.length === 0 && !credsLoading && (
                <div style={{ textAlign: 'center', color: '#333', padding: '60px 0', fontSize: 13 }}>Vault is currently sealed. Refresh to decrypt.</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {credentials.map(cred => (
                  <div key={cred.id} style={credCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: 15, marginBottom: 15 }}>
                      <div>
                        <div style={credLabel}>{cred.label}</div>
                        <div style={credDesc}>{cred.description}</div>
                      </div>
                      <div style={credRolePill}>{cred.role}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                      <div style={{ marginBottom: 0 }}>
                        <label style={labelStyle}>USERNAME</label>
                        <input 
                          style={inputStyle} 
                          value={cred.username} 
                          onChange={(e) => updateLocalCred(cred.label, 'username', e.target.value)} 
                        />
                      </div>
                      <div style={{ marginBottom: 0 }}>
                        <label style={labelStyle}>PASSWORD</label>
                        <input 
                          style={inputStyle} 
                          value={cred.password} 
                          onChange={(e) => updateLocalCred(cred.label, 'password', e.target.value)} 
                        />
                      </div>
                      <div style={{ alignSelf: 'flex-end' }}>
                        <button 
                          onClick={() => saveCredential(cred)} 
                          style={saveBtn}
                        >
                          UPDATE VAULT
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'BRIDGES' && (
            <div className="fade-in">
              <h3 style={sectionTitle}>🌉 EXTERNAL API BRIDGES</h3>
              <div style={bridgeRow}>
                <div><b>STRIPE PAYMENT GATEWAY:</b> <span style={{color: config.stripe_live_mode ? '#00FF88' : '#D4AF37'}}>{config.stripe_live_mode ? 'LIVE' : 'TESTING'}</span></div>
                <button 
                  onClick={() => commitToKernel('stripe_live_mode', !config.stripe_live_mode)}
                  style={toggleBtn(config.stripe_live_mode)}
                >
                  {config.stripe_live_mode ? 'SWITCH TO TEST' : 'SWITCH TO LIVE'}
                </button>
              </div>
              <div style={bridgeRow}>
                <div><b>BIOMETRIC KERNEL (Z-18):</b> <span style={{color:'#00FF88'}}>CONNECTED</span></div>
                <button style={toggleBtn(true)}>RE-CALIBRATE</button>
              </div>
            </div>
          )}

          {activeTab === 'TELEMETRY' && (
            <div className="fade-in">
              <h3 style={sectionTitle}>📡 KERNEL TELEMETRY</h3>
              <div style={fieldItem}>
                <label style={labelStyle}>DASHBOARD PULSE FREQUENCY: <b style={{color:'#00F2FF'}}>{config.sync_pulse_interval}s</b></label>
                <input 
                  type="range" min="1" max="10" 
                  style={{width:'100%'}}
                  value={config.sync_pulse_interval} 
                  onChange={(e) => commitToKernel('sync_pulse_interval', Number(e.target.value))}
                />
              </div>
              <div style={fieldItem}>
                <label style={labelStyle}>SYSTEM LOG LEVEL</label>
                <select 
                  style={inputStyle} 
                  value={config.system_log_level}
                  onChange={(e) => commitToKernel('system_log_level', e.target.value)}
                >
                  <option>DEBUG</option><option>INFO</option><option>CRITICAL</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'SALES CRM' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h3 style={sectionTitle}>🤝 Z-LOGIN CAPTURED LEADS</h3>
                <button onClick={loadSalesLeads} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: 1 }}>
                  {leadsLoading ? 'LOADING...' : '↺ REFRESH'}
                </button>
              </div>
              {salesLeads.length === 0 && !leadsLoading && (
                <div style={{ textAlign: 'center', color: '#333', padding: '60px 0', fontSize: 13 }}>No leads captured yet.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {salesLeads.map(lead => (
                  <div key={lead.id} style={{ background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.15)', borderRadius: 16, padding: '20px 24px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{lead.enterprise_name}</div>
                        <div style={{ color: '#00F2FF', fontSize: 12, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>{lead.lead_name} • {lead.enterprise_size}</div>
                        <div style={{ color: '#aaa', fontSize: 14 }}>Contact: <span style={{ color: '#eee' }}>{lead.contact_details}</span></div>
                      </div>
                      <div style={{ background: '#00F2FF', color: '#000', padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
                        {lead.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'DEV REQUESTS' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h3 style={sectionTitle}>💡 USER FEATURE REQUESTS</h3>
                <button onClick={loadFeatureRequests} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: 1 }}>
                  {frLoading ? 'LOADING...' : '↺ REFRESH'}
                </button>
              </div>
              {featureRequests.length === 0 && !frLoading && (
                <div style={{ textAlign: 'center', color: '#333', padding: '60px 0', fontSize: 13 }}>No requests submitted yet.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {featureRequests.map(fr => (
                  <div key={fr.id} style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 16, padding: '20px 24px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#eee', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{fr.request_text}</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                          <span style={zonePill}>{fr.zone}</span>
                          <span style={refPill}>{fr.reference_id}</span>
                          <span style={userPill}>👤 {fr.user_id || 'Anonymous'}</span>
                          <span style={{ ...statusPill, background: fr.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(57,255,20,0.12)', color: fr.status === 'pending' ? '#F59E0B' : '#39FF14', border: `1px solid ${fr.status === 'pending' ? '#F59E0B44' : '#39FF1444'}` }}>
                            {fr.status?.toUpperCase() || 'PENDING'}
                          </span>
                          <span style={{ color: '#444', fontSize: 9, alignSelf: 'center', fontWeight: 700 }}>{new Date(fr.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'DIAGNOSTICS' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h3 style={sectionTitle}>🔬 SYSTEM DIAGNOSTICS RADAR</h3>
                <button onClick={loadDiagnostics} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: 1 }}>
                  {diagLoading ? 'SCANNING...' : '↺ RUN SCAN'}
                </button>
              </div>

              {!diagnostics && !diagLoading && (
                <div style={{ textAlign: 'center', color: '#333', padding: '60px 0', fontSize: 13 }}>Run a scan to view system health.</div>
              )}

              {diagnostics && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
                  
                  {/* Database Health Panel */}
                  <div style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 16, padding: '24px' }}>
                    <div style={{ color: '#00FF88', fontSize: 12, fontWeight: 900, letterSpacing: 2, marginBottom: 20 }}>DATABASE INTEGRITY</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {Object.entries(diagnostics.row_counts || {}).map(([table, count]: [string, any]) => (
                        <div key={table} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: '#aaa', fontSize: 12 }}>{table}</span>
                          <span style={{ color: count === 'ERROR' ? '#FF3131' : '#FFF', fontWeight: 900, fontSize: 14 }}>
                            {count === 'ERROR' ? 'OFFLINE' : `${count} rows`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* API Routes Panel */}
                  <div style={{ background: 'rgba(0,242,255,0.03)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: 16, padding: '24px', maxHeight: '400px', overflowY: 'auto' }}>
                    <div style={{ color: '#00F2FF', fontSize: 12, fontWeight: 900, letterSpacing: 2, marginBottom: 20 }}>ACTIVE API ROUTES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(diagnostics.api_routes || []).map((route: string, i: number) => {
                        const [method, path] = route.split(' ');
                        return (
                          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: 6 }}>
                            <span style={{ color: method === 'GET' ? '#00FF88' : method === 'POST' ? '#D4AF37' : '#FF3131', fontWeight: 900, minWidth: 40 }}>
                              {method}
                            </span>
                            <span style={{ color: '#eee', fontFamily: 'monospace' }}>{path}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {activeTab === 'MAINTENANCE' && (
            <div className="fade-in">
              <h3 style={sectionTitle}>🔧 SYSTEM MAINTENANCE</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[{label:'Trigger Global Kernel Sync', desc:'Forces Frontend, Backend, and AI to instantly sync with miracle_kernel.json without restart.', color:'#D4AF37', action: triggerKernelSync},
                  {label:'Clear AI Session Memory', desc:'Wipes all conversation sessions from DB', color:'#FF3131', action: () => executeMaintenanceAction('clear-ai-memory', 'CLEAR AI MEMORY')},
                  {label:'Reset Alert Cache', desc:'Forces fresh alert polling on next load', color:'#F59E0B', action: () => executeMaintenanceAction('reset-alert-cache', 'RESET ALERT CACHE')},
                  {label:'Rebuild Genesis Tables', desc:'Re-runs table creation for new models', color:'#00F2FF', action: () => executeMaintenanceAction('rebuild-genesis', 'REBUILD GENESIS TABLES')}].map(action => (
                  <div key={action.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #111', borderRadius: 16, padding: '24px' }}>
                    <div style={{ color: action.color, fontWeight: 900, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>{action.label}</div>
                    <div style={{ color: '#444', fontSize: 11, marginBottom: 16 }}>{action.desc}</div>
                    <button onClick={action.action} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${action.color}44`, color: action.color, borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>
                      EXECUTE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'THEME ENGINE' && (
            <div className="fade-in">
              <h3 style={sectionTitle}>🎨 SOVEREIGN THEME ENGINE</h3>
              <p style={{ fontSize: 12, color: '#555', marginBottom: 32, lineHeight: 1.8 }}>
                Control all visual properties of Miracle HMS — background data grid, neon glow palette,
                button styles, sidebar mode, font scale, and per-page overrides.
                Changes apply instantly without reload.
              </p>
              <ThemeControlPanel />
            </div>
          )}

          {activeTab === 'CURRENCY ENGINE' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h3 style={sectionTitle}>🔱 SOVEREIGN CURRENCY ENGINE</h3>
                <button onClick={pullCurrentConfig} style={refreshBtn}>
                  {isSyncing ? 'SYNCING...' : '↺ REFRESH RATES'}
                </button>
              </div>

              <p style={{ fontSize: 12, color: '#555', marginBottom: 24, lineHeight: 1.8 }}>
                Set exchange rates for all 14 global currencies (expressed as <b style={{color:'#D4AF37'}}>BDT per 1 unit</b>).
                The <b style={{color:'#00F2FF'}}>Base Currency</b> determines the display currency across every zone,
                guest frontend, properties marketplace, and owner app. Only Z-21 admins can change these values.
              </p>

              {/* BASE CURRENCY SELECTOR — 14 options */}
              <div style={{ marginBottom: 36, background: 'rgba(212,175,55,0.04)', padding: '24px', borderRadius: 16, border: '1px solid rgba(212,175,55,0.12)' }}>
                <label style={{ ...labelStyle, color: '#D4AF37', marginBottom: 16 }}>🔱 GLOBAL BASE CURRENCY (Display Currency for All Zones)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {([
                    ['USD','$','🇺🇸'],['AED','AED','🇦🇪'],['EUR','€','🇪🇺'],['GBP','£','🇬🇧'],
                    ['SAR','SAR','🇸🇦'],['QAR','QAR','🇶🇦'],['SGD','S$','🇸🇬'],
                    ['BDT','৳','🇧🇩'],['INR','₹','🇮🇳'],['JPY','¥','🇯🇵'],
                    ['CNY','¥','🇨🇳'],['CHF','CHF','🇨🇭'],['KWD','KWD','🇰🇼'],['OMR','OMR','🇴🇲']
                  ] as [string,string,string][]).map(([code, sym, flag]) => {
                    const isActive = (config.financial_laws?.base_currency || 'USD') === code;
                    return (
                      <button key={code}
                        onClick={() => {
                          const newLaws = { ...config.financial_laws, base_currency: code };
                          setConfig((prev: any) => ({ ...prev, financial_laws: newLaws }));
                        }}
                        style={{
                          padding: '10px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                          borderRadius: 10, letterSpacing: '0.5px', transition: '0.2s',
                          background: isActive ? 'rgba(0,242,255,0.1)' : 'rgba(0,0,0,0.4)',
                          border: isActive ? '1px solid #00F2FF' : '1px solid rgba(255,255,255,0.06)',
                          color: isActive ? '#00F2FF' : '#555',
                          boxShadow: isActive ? '0 0 14px rgba(0,242,255,0.2)' : 'none',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:3
                        }}
                      >
                        <span style={{fontSize:16}}>{flag}</span>
                        <span>{code}</span>
                        {isActive && <span style={{fontSize:8,color:'#00F2FF'}}>ACTIVE</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* EXCHANGE RATE GRID — All 14 currencies */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 28, marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#888', letterSpacing: 2, marginBottom: 24 }}>EXCHANGE RATES (Units per 1 USD)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                  {([
                    ['exchange_rate_usd', 'USD', '🇺🇸', '$'],
                    ['exchange_rate_aed', 'AED', '🇦🇪', 'AED'],
                    ['exchange_rate_gbp', 'GBP', '🇬🇧', '£'],
                    ['exchange_rate_eur', 'EUR', '🇪🇺', '€'],
                    ['exchange_rate_sar', 'SAR', '🇸🇦', 'SAR'],
                    ['exchange_rate_qar', 'QAR', '🇶🇦', 'QAR'],
                    ['exchange_rate_sgd', 'SGD', '🇸🇬', 'S$'],
                    ['exchange_rate_bdt', 'BDT', '🇧🇩', '৳'],
                    ['exchange_rate_inr', 'INR', '🇮🇳', '₹'],
                    ['exchange_rate_jpy', 'JPY', '🇯🇵', '¥'],
                    ['exchange_rate_cny', 'CNY', '🇨🇳', '¥'],
                    ['exchange_rate_chf', 'CHF', '🇨🇭', 'CHF'],
                    ['exchange_rate_kwd', 'KWD', '🇰🇼', 'KWD'],
                    ['exchange_rate_omr', 'OMR', '🇴🇲', 'OMR'],
                  ] as [string,string,string,string][]).map(([field, code, flag, sym]) => (
                    <div key={field} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <label style={{ fontSize: 10, color: '#666', fontWeight: 900, letterSpacing: 1 }}>
                        {flag} 1 USD = <span style={{color:'#444'}}>({sym})</span>
                      </label>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <input
                          type="number" step="0.01" min="0"
                          style={{ ...inputStyle, padding: '10px 12px', fontSize: 12, opacity: code === 'USD' ? 0.5 : 1 }}
                          value={code === 'USD' ? 1.0 : (config.financial_laws?.[field] ?? '')}
                          disabled={code === 'USD'}
                          placeholder={`1 USD = ? ${code}`}
                          onChange={(e) => {
                            if (code === 'USD') return;
                            const newLaws = { ...config.financial_laws, [field]: parseFloat(e.target.value) };
                            setConfig((prev: any) => ({ ...prev, financial_laws: newLaws }));
                          }}
                        />
                        <span style={{ color:'#333', fontSize:11, whiteSpace:'nowrap' }}>{code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SAVE BUTTON */}
              <button
                onClick={() => {
                  const fl = config.financial_laws || {};
                  const rates: Record<string,number> = {
                    exchange_rate_usd: 1.0,
                    exchange_rate_aed: fl.exchange_rate_aed || 3.67,
                    exchange_rate_gbp: fl.exchange_rate_gbp || 0.76,
                    exchange_rate_eur: fl.exchange_rate_eur || 0.90,
                    exchange_rate_sar: fl.exchange_rate_sar || 3.75,
                    exchange_rate_qar: fl.exchange_rate_qar || 3.64,
                    exchange_rate_sgd: fl.exchange_rate_sgd || 1.34,
                    exchange_rate_bdt: fl.exchange_rate_bdt || 110.5,
                    exchange_rate_inr: fl.exchange_rate_inr || 83.50,
                    exchange_rate_jpy: fl.exchange_rate_jpy || 150.0,
                    exchange_rate_cny: fl.exchange_rate_cny || 7.20,
                    exchange_rate_chf: fl.exchange_rate_chf || 0.91,
                    exchange_rate_kwd: fl.exchange_rate_kwd || 0.31,
                    exchange_rate_omr: fl.exchange_rate_omr || 0.38,
                  };
                  updateCurrencyRate(rates, fl.base_currency || 'USD');
                }}
                style={{ ...saveBtn, width: '100%', padding: '16px', fontSize: 12, letterSpacing: 2 }}
              >
                🔱 COMMIT ALL 14 RATES TO SOVEREIGN KERNEL
              </button>

              {/* INFO BOX */}
              <div style={{ marginTop: 24, background: 'rgba(0,242,255,0.03)', border: '1px solid rgba(0,242,255,0.1)', borderRadius: 12, padding: '16px 20px', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
                <b style={{color:'#00F2FF'}}>How this works:</b> All monetary values in Miracle HMS are stored internally in <b>USD</b>.
                When a user or guest views an amount, the system multiplies the USD value by the currency's <code style={{color:'#D4AF37'}}>exchange_rate</code> to convert.
                The Base Currency set here is applied globally across the dashboard, guest frontend, properties marketplace, owner portal, and POS —
                immediately on the next page load without any code deployment.
              </div>
            </div>
          )}

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}} />
    </div>
  );
}

// --- SOVEREIGN STYLES ---
const gateStyle = { height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const gateBox = { background: '#0a0a0a', padding: '60px', borderRadius: '30px', border: '1px solid #D4AF37', textAlign: 'center' as const, boxShadow: '0 0 100px rgba(0,0,0,1)' };
const pinInput = { background: '#000', border: '1px solid #333', color: '#D4AF37', padding: '20px', borderRadius: '15px', textAlign: 'center' as const, fontSize: '24px', letterSpacing: '10px', outline: 'none', marginBottom: '30px', width: '250px' };
const unlockBtn = { width: '100%', padding: '20px', background: '#D4AF37', color: '#000', fontWeight: 900, borderRadius: '15px', border: 'none', cursor: 'pointer', letterSpacing: '2px' };

const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '30px' };
const titleStyle = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '28px', margin: 0, letterSpacing: '4px' };
const subTitleStyle = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px' };
const pulseStatus = { width: '12px', height: '12px', borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 15px #00FF88' };

const sidebarPanel = { background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', border: '1px solid #111', height: 'fit-content' };
const tabItem = (active: boolean) => ({ padding: '20px', color: active ? '#00F2FF' : '#444', fontWeight: 900, fontSize: '11px', cursor: 'pointer', marginBottom: '10px', position: 'relative' as const, background: active ? 'rgba(0, 242, 255, 0.03)' : 'transparent', borderRadius: '10px', transition: '0.3s' });
const sideGlow = { position: 'absolute' as const, left: 0, top: '25%', height: '50%', width: '3px', background: '#00F2FF', boxShadow: '0 0 15px #00F2FF' };
const kernelStats = { marginTop: '50px', padding: '20px', borderTop: '1px solid #222', textAlign: 'center' as const };

const viewportPanel = { background: 'rgba(0,0,0,0.4)', borderRadius: '30px', padding: '50px', border: '1px solid rgba(255,255,255,0.05)', minHeight: '600px' };
const sectionTitle = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '20px', marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '20px' };
const configGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' };
const fieldItem = { marginBottom: '30px' };
const labelStyle = { display: 'block', fontSize: '10px', color: '#888', fontWeight: 900, marginBottom: '15px', letterSpacing: '1px' };
const inputStyle = { width: '100%', background: '#080808', border: '1px solid #333', padding: '15px', color: '#FFF', borderRadius: '12px', outline: 'none', transition: '0.3s' };

const refreshBtn: React.CSSProperties = { padding: '8px 20px', background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: 1 };
const credCard: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid #111', borderRadius: 20, padding: '24px' };
const credLabel: React.CSSProperties = { color: '#D4AF37', fontSize: 14, fontWeight: 900, letterSpacing: 1 };
const credDesc: React.CSSProperties = { color: '#555', fontSize: 10, marginTop: 4 };
const credRolePill: React.CSSProperties = { background: 'rgba(0,242,255,0.1)', border: '1px solid #00F2FF44', color: '#00F2FF', padding: '4px 12px', borderRadius: 10, fontSize: 10, fontWeight: 900, alignSelf: 'flex-start' };
const saveBtn: React.CSSProperties = { width: '100%', padding: '12px', background: '#D4AF37', color: '#000', fontWeight: 900, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 10, letterSpacing: 1 };

const bridgeRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', marginBottom: '20px', border: '1px solid #111' };
const toggleBtn = (active: boolean) => ({ padding: '10px 20px', background: 'transparent', border: active ? '1px solid #FF3131' : '1px solid #00FF88', color: active ? '#FF3131' : '#00FF88', fontWeight: 900, fontSize: '10px', borderRadius: '8px', cursor: 'pointer' });

// Pill styles for DEV REQUESTS tab
const zonePill: React.CSSProperties = { padding: '3px 10px', background: 'rgba(0,242,255,0.1)', border: '1px solid #00F2FF44', color: '#00F2FF', borderRadius: 20, fontSize: 9, fontWeight: 900, letterSpacing: 1 };
const refPill: React.CSSProperties  = { padding: '3px 10px', background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF3744', color: '#D4AF37', borderRadius: 20, fontSize: 9, fontWeight: 900, letterSpacing: 1 };
const userPill: React.CSSProperties = { padding: '3px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid #33333388', color: '#888', borderRadius: 20, fontSize: 9, fontWeight: 700 };
const statusPill: React.CSSProperties = { padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 900, letterSpacing: 1 };
