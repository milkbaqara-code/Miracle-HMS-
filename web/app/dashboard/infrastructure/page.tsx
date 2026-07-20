// web/app/dashboard/infrastructure/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
import { useRouter } from 'next/navigation';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useConfirm } from '../../components/SovereignConfirm';
import { useToast } from '../../components/SovereignToast';
import SovereignAnatomy from '../../components/SovereignAnatomy';

export default function InfrastructureMatrix() {
  const { formatMoney, currency } = useCurrencyLang();
  const router = useRouter();
  const isViewMode = useViewMode();
  const { showConfirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    // 🛡️ SOVEREIGN UI FORCE-CLICK OVERRIDE
    const style = document.createElement('style');
    style.innerHTML = `
      .cyber-btn-force:active { transform: scale(0.95); filter: brightness(1.5); }
      .cyber-btn-force:hover { background: rgba(255,49,49,0.2) !important; }
      * { pointer-events: auto !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const [telemetry, setTelemetry] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [immune, setImmune] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [logs, setLogs] = useState<string>('INFRASTRUCTURE DATALINK ESTABLISHED.\nAWAITING TELEMETRY PULL...');
  const [activeLog, setActiveLog] = useState<'backend' | 'frontend' | 'nginx'>('backend');
  const [activePillar, setActivePillar] = useState<'financial' | 'operational' | 'staff' | 'guest' | 'sre'>('operational');
  const [activeHeal, setActiveHeal] = useState<any>(null); 
  
  const [masterPin, setMasterPin] = useState('');
  const [actionStatus, setActionStatus] = useState<string>('');
  
  const logEndRef = useRef<HTMLDivElement>(null);
  // 🔑 SOVEREIGN CURRENCY REF — always holds latest value for interval callbacks
  const currencyRef = useRef(currency);
  useEffect(() => { currencyRef.current = currency; }, [currency]);

  const [backendStatus, setBackendStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [brainSync, setBrainSync] = useState<any>(null);

  // V11.0: BRAIN MANIFEST STATE (CDO Injection Gate)
  const [brainManifest, setBrainManifest] = useState<any[]>([]);
  const [manifestFilter, setManifestFilter] = useState<'ALL' | 'PENDING_INJECTION' | 'ACTIVE' | 'REJECTED'>('PENDING_INJECTION');
  const [manifestAction, setManifestAction] = useState<string>('');

  // V12.0: SYSTEM ERROR LOGS (CDO Diagnostics Pipeline)
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [errorActionStatus, setErrorActionStatus] = useState<string>('');

  // V66.0: SRE SCAN ENGINE
  const [sreScan, setSreScan] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const fetchBrainSync = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/surgical-fixes/status`);
      if (res.ok) {
        setBrainSync(await res.json());
        setBackendStatus('ONLINE');
      } else {
        setBackendStatus('OFFLINE');
      }
    } catch(e) { setBackendStatus('OFFLINE'); }
  };

  const syncBrain = async () => {
    setActionStatus("SYNCHRONIZING AI BRAIN WITH SURGICAL MANIFEST...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/surgical-fixes/sync-all`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActionStatus(`SUCCESS: ${data.message}`);
        fetchBrainSync();
      }
    } catch(e) { setActionStatus("SYNC FAILED."); }
  };

  // V11.0: BRAIN MANIFEST FETCH (CDO Injection Gate)
  const fetchBrainManifest = async (status?: string) => {
    try {
      const filterStatus = status || manifestFilter;
      const params = filterStatus !== 'ALL' ? `?status=${filterStatus}&limit=50` : `?limit=50`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/brain/manifest${params}`);
      if (res.ok) {
        const data = await res.json();
        setBrainManifest(data.records || []);
      }
    } catch(e) { console.warn('Brain manifest fetch failed', e); }
  };

  const approveRule = async (id: number) => {
    setManifestAction(`APPROVING RULE #${id}...`);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/brain/approve/${id}`, { method: 'POST' });
      if (res.ok) {
        setManifestAction(`RULE #${id} APPROVED — NOW ACTIVE IN AI BRAIN.`);
        fetchBrainManifest();
      } else { setManifestAction(`FAILED TO APPROVE #${id}.`); }
    } catch(e) { setManifestAction(`ERROR: ${e}`); }
  };

  const rejectRule = async (id: number) => {
    setManifestAction(`REJECTING RULE #${id}...`);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/brain/reject/${id}`, { method: 'POST' });
      if (res.ok) {
        setManifestAction(`RULE #${id} REJECTED — WILL NOT AFFECT AI BEHAVIOR.`);
        fetchBrainManifest();
      } else { setManifestAction(`FAILED TO REJECT #${id}.`); }
    } catch(e) { setManifestAction(`ERROR: ${e}`); }
  };

  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  const fetchErrorLogs = async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/error-logs`);
      if (res.ok) {
        const body = await res.json();
        setErrorLogs(body.data || []);
      }
    } catch(e) {}
    finally { setIsRefreshingLogs(false); }
  };

  const dismissError = async (id: number) => {
    try {
      // Optimistically remove from UI immediately
      setErrorLogs(prev => prev.filter(e => e.id !== id));
      // Tell backend to mark as DISMISSED
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/error-logs/${id}/dismiss`, { method: 'POST' });
    } catch(e) {}
  };

  const dismissAllAnalyzed = () => {
    const analyzedIds = errorLogs.filter(e => e.status === 'AI_ANALYZED').map(e => e.id);
    analyzedIds.forEach(id => dismissError(id));
  };

  const analyzeError = async (id: number) => {
    setErrorActionStatus(`AI IS ANALYZING SYSTEM ERROR #${id}...`);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/error-logs/${id}/analyze`, { method: 'POST' });
      if (res.ok) {
        setErrorActionStatus(`ERROR #${id} ANALYZED. AUTO-CLEANING IN 3s...`);
        fetchErrorLogs();
        // Auto-dismiss analyzed log after 3 seconds
        setTimeout(() => {
          dismissError(id);
          setErrorActionStatus('');
        }, 3000);
      } else { setErrorActionStatus(`FAILED TO ANALYZE #${id}.`); }
    } catch(e) { setErrorActionStatus(`ERROR: ${e}`); }
  };

  const runSreScan = async () => {
    setIsScanning(true);
    setLogs(prev => prev + "\n[SRE] INITIATING SYSTEM-WIDE DIAGNOSTIC SCAN...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/diagnostics/scan/all`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSreScan(data);
        setLogs(prev => prev + `\n[SRE] SCAN COMPLETE. HEALTH: ${data.summary.overall_health}. FOUND ${data.summary.total_issues} ISSUES.`);
      }
    } catch (e) {
      setLogs(prev => prev + "\n[SRE] SCAN FAILED. CHECK KERNEL CONNECTIVITY.");
    } finally {
      setIsScanning(false);
    }
  };

  const fetchSreStatus = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/diagnostics/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.summary.overall_health !== "UNKNOWN") {
          setSreScan(data);
        }
      }
    } catch (e) {}
  };

  // 1. PULSE ENGINE
  useEffect(() => {
    // Fetch telemetry immediately on mount AND whenever currency changes
    fetchTelemetry();
    fetchServices();
    fetchAuditLog();
    fetchBrainSync();
    fetchBrainManifest();
    fetchLogs(activeLog);
    fetchErrorLogs();
    fetchSreStatus();

    // Auto-refresh telemetry every 10s
    const pulse = setInterval(() => {
      fetchTelemetry();
      fetchImmune();
      fetchAuditLog();
      fetchBrainSync();
      fetchBrainManifest();
      fetchLogs(activeLog);
      fetchErrorLogs();
      fetchSreStatus();
    }, 10000);
    return () => clearInterval(pulse);
  }, [activeLog, currency]);

  // Scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 2. DATA LINKS
  const fetchTelemetry = async () => {
    // Use currencyRef to always read the CURRENT currency — avoids stale closure inside interval
    const activeCurrency = currencyRef.current;
    try {
      const token = localStorage.getItem('miracle_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/telemetry?currency=${activeCurrency}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setTelemetry(body.data);
      }
    } catch(e) {}
  };

  const fetchImmune = async () => {
    try {
      const token = localStorage.getItem('miracle_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/immune`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setImmune(body.data);
      }
    } catch(e) {}
  };

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('miracle_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setServices(body.data || []);
      }
    } catch(e) {}
  };

  const fetchLogs = async (target: string) => {
    try {
      const token = localStorage.getItem('miracle_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/logs/${target}?lines=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setLogs(body.data || "No logs received.");
      }
    } catch(e) {
      setLogs("LINK SEVERED. UNABLE TO RETRIEVE LOGS.");
    }
  };

  const fetchAuditLog = async () => {
    try {
      const [logRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/log?limit=30`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/stats`),
      ]);
      if (logRes.ok) {
        const body = await logRes.json();
        setAuditLog(body.records || []);
      }
      if (statsRes.ok) {
        const body = await statsRes.json();
        setAuditStats(body);
      }
    } catch(e) {}
  };

  const clearSystemFailures = async () => {
    setActionStatus("CLEARING SYSTEM FAILURES...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/clear-system-failures`, {
        method: 'POST'
      });
      if (res.ok) {
        setActionStatus("SYSTEM FAILURES CLEARED.");
        fetchAuditLog();
      }
    } catch(e) {
      setActionStatus("FAILED TO CLEAR LOGS.");
    }
  };


  const triggerAudit = async (auditId: number) => {
    setActionStatus(`AUDITING RECORD #${auditId}...`);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/trigger/${auditId}`, {
        method: 'POST'
      });
      if (res.ok) {
        const body = await res.json();
        setActionStatus(`AUDIT COMPLETE: ${body.verdict}`);
        fetchAuditLog();
      }
    } catch(e) { setActionStatus("AUDIT FAILED."); }
  };

  const developHeal = async (auditId: number) => {
    setActionStatus(`DEVELOPING BRAIN FIX FOR #${auditId}...`);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/heal/develop/${auditId}`, {
        method: 'POST'
      });
      if (res.ok) {
        const body = await res.json();
        if (body.error) {
          setActionStatus(`ERROR: ${body.error}`);
        } else {
          setActiveHeal({ auditId, ...body });
          setActionStatus(`FIX DEVELOPED. REVIEW AND INJECT.`);
        }
      }
    } catch(e) { setActionStatus("HEAL DEVELOPMENT FAILED."); }
  };

  const injectHeal = async () => {
    if (!activeHeal) return;
    const confirmed = await showConfirm('FORCE-INJECT WISDOM', 'Are you sure you want to forcibly inject this wisdom into the AI brain?');
    if (!confirmed) return;
    setActionStatus(`INJECTING FIX INTO AI BRAIN...`);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/heal/inject/${activeHeal.auditId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_cause: activeHeal.root_cause,
          correction: activeHeal.correction,
          prevention_rule: activeHeal.prevention_rule
        })
      });
      if (res.ok) {
        setActionStatus(`SUCCESS: AI BRAIN HAS BEEN REWIRED.`);
        setActiveHeal(null);
        fetchAuditLog();
      }
    } catch(e) { setActionStatus("INJECTION FAILED."); }
  };


  // 3. ACTION ENGINES
  const executeRestart = async (serviceName: string) => {
    if(!masterPin) {
      setActionStatus("ERROR: MASTER PIN REQUIRED.");
      return;
    }
    const confirmed = await showConfirm({
      title: 'SOVEREIGN RESTART INITIATED',
      message: `Force PM2 Restart for ${serviceName}? This will sever all current connections.`,
      icon: '⚡',
      options: [
        { label: 'EXECUTE RESTART', value: 'yes', variant: 'danger' },
        { label: 'CANCEL', value: 'no', variant: 'cancel' }
      ]
    });
    if (confirmed !== 'yes') {
      setActionStatus("RESTART ABORTED.");
      return;
    }
    setActionStatus(`[SOVEREIGN COMMAND] INITIATING PM2 RESTART FOR ${serviceName.toUpperCase()}...`);
    try {
      const token = localStorage.getItem('miracle_token');
      const res = await fetch(`/api/infra/action?t=${Date.now()}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ master_pin: masterPin, service_name: serviceName, action: 'restart' })
      });
      const body = await res.json();
      if(res.ok) {
        setActionStatus(`[SUCCESS] ${serviceName.toUpperCase()} RESTARTED. WAIT 5S FOR RECONNECT.`);
        setMasterPin(''); // Clear pin for security
        setTimeout(() => fetchServices(), 5000);
      } else {
        setActionStatus(`[FATAL] ${body.detail || 'RESTART DENIED BY KERNEL'}`);
      }
    } catch(e) {
      setActionStatus("[FATAL] KERNEL UNREACHABLE. TRY MANUAL VPS RESTART.");
    }
  };

  const executeBackup = async () => {
    if(!masterPin) {
      setActionStatus("ERROR: MASTER PIN REQUIRED FOR LEDGER BACKUP.");
      return;
    }
    setActionStatus("INITIATING ZERO-DOWNTIME MASTER BACKUP...");
    try {
      const token = localStorage.getItem('miracle_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/infra/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ master_pin: masterPin })
      });
      
      if(res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fn = res.headers.get('content-disposition')?.split('filename=')[1] || `miracle_backup_${Date.now()}.sql`;
        a.download = fn.replace(/"/g, '');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        setActionStatus(`SUCCESS: SECURE LEDGER FORGED -> ${a.download}`);
        setMasterPin('');
      } else {
        const body = await res.json();
        setActionStatus(`FATAL: ${body.detail}`);
      }
    } catch(e) {
      setActionStatus("FATAL: LEDGER UNREACHABLE.");
    }
  };

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={viewportStyle}>
      <ViewModeBanner />
      <div style={headerSection}>
        <div>
          <h2 style={titleStyle}>ZONE 23: SOVEREIGN INFRASTRUCTURE</h2>
          <p style={subtitleStyle}>MASTER KERNEL HYPERVISOR | CPANEL REPLACEMENT MATRIX</p>
        </div>
        <div style={liveUptimeBox}>
          <span style={{ color: '#00F2FF', fontSize: '10px' }}>SYSTEM UPTIME</span>
          <br/>
          <span style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'monospace' }}>
            {telemetry?.uptime || 'CALCULATING...'}
          </span>
        </div>
      </div>

      {/* ⚠️ CRITICAL SYSTEM ALERT BANNER */}
      {(backendStatus === 'OFFLINE' || (auditStats?.system_failure_count && auditStats.system_failure_count > 0)) && (
        <div style={{ 
          background: '#FF3131', color: '#FFF', padding: '15px', textAlign: 'center', 
          fontWeight: 900, fontSize: '12px', letterSpacing: '2px', margin: '20px 40px 0 40px',
          borderRadius: '8px', boxShadow: '0 0 20px rgba(255,49,49,0.5)',
          animation: 'pulse_red 1s infinite'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
            <span>
              {backendStatus === 'OFFLINE' 
                ? '⚠️ SOVEREIGN KERNEL OFFLINE — ALL AI SYNAPSES SEVERED — RESTART PM2 IMMEDIATELY'
                : `⚠️ SYSTEM FAILURE DETECTED: ${auditStats.system_failure_count} PM2/API CRASHES PENDING.`}
            </span>
            {backendStatus !== 'OFFLINE' && auditStats?.system_failure_count > 0 && (
              <button
                onClick={clearSystemFailures}
                style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.5)', 
                  color: '#FFF', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '11px'
                }}
              >
                CLEAR LOGS
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🫁 SOVEREIGN ANATOMY — 3D AI GLASS BODY (Z-23 DIAGNOSTICS)  */}
      {/* ============================================================ */}
      <div style={{ margin: '30px 40px 0 40px' }}>
        <SovereignAnatomy />
      </div>

      {/* 🧠 CDO BRAIN VIEWER (INJECTION GATE) */}
      <div style={{ margin: '30px 40px 0 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#9D00FF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🧠</span> CDO BRAIN VIEWER (INJECTION GATE)
          </h2>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#666', fontWeight: 900 }}>PENDING INJECTIONS: {brainManifest.filter((m: any) => m.status === 'PENDING_INJECTION').length}</span>
            <button 
              className="cyber-btn-force"
              onClick={() => fetchBrainManifest()}
              style={{ 
                background: '#9D00FF', color: '#FFF', border: 'none', padding: '8px 16px', 
                borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 0 15px rgba(157,0,255,0.4)'
              }}
            >REFRESH VIEWER</button>
          </div>
        </div>
        
        {/* Manifest Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {['PENDING_INJECTION', 'ACTIVE', 'REJECTED', 'ALL'].map(tab => (
            <button key={tab} onClick={() => { setManifestFilter(tab as any); fetchBrainManifest(tab); }} style={{
              background: manifestFilter === tab ? '#9D00FF' : 'rgba(10,10,10,0.8)',
              color: manifestFilter === tab ? '#FFF' : '#888',
              border: manifestFilter === tab ? '1px solid #9D00FF' : '1px solid #333',
              padding: '6px 12px', borderRadius: '4px', fontSize: '9px', fontWeight: 900, cursor: 'pointer'
            }}>{tab.replace('_', ' ')}</button>
          ))}
        </div>
        {manifestAction && <div style={{ fontSize: '10px', color: '#00F2FF', marginBottom: '10px', fontWeight: 900 }}>&gt; {manifestAction}</div>}

        <div style={{ 
          background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(157,0,255,0.2)', 
          borderRadius: '12px', padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px'
        }}>
          {/* MANUAL INJECTION FORM */}
          <div style={{ background: 'rgba(157,0,255,0.05)', border: '1px dashed #9D00FF', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '10px', color: '#9D00FF', fontWeight: 900 }}>➕ MANUAL KNOWLEDGE INJECTION</div>
            <textarea id="manual_insight" placeholder="Enter custom AI learning rule..." style={{ background: '#000', color: '#FFF', border: '1px solid #333', borderRadius: '4px', padding: '8px', fontSize: '10px', resize: 'none', height: '60px' }}></textarea>
            <button onClick={async () => {
              const val = (document.getElementById('manual_insight') as HTMLTextAreaElement).value;
              if (!val) return;
              setManifestAction('INJECTING MANUAL RULE...');
              try {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/brain/inject`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({insight: val}) });
                setManifestAction('RULE INJECTED.');
                (document.getElementById('manual_insight') as HTMLTextAreaElement).value = '';
                fetchBrainManifest();
              } catch(e) { setManifestAction('INJECTION FAILED.'); }
            }} style={{ background: '#000', border: '1px solid #9D00FF', color: '#9D00FF', padding: '6px', fontSize: '9px', fontWeight: 900, cursor: 'pointer', borderRadius: '4px' }}>INJECT TO ROOT</button>
          </div>

          {brainManifest?.map((fix: any) => (
            <div key={fix.id} style={{ 
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '8px', padding: '12px', position: 'relative'
            }}>
              <div style={{ fontSize: '8px', color: '#666', fontWeight: 900, display: 'flex', justifyContent: 'space-between' }}>
                <span>#{fix.id} | {fix.category}</span>
                <span>{fix.source_role}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#CCC', margin: '6px 0', minHeight: '30px' }}>{fix.insight_preview || fix.insight}</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <span style={{ 
                  fontSize: '8px', fontWeight: 900, padding: '3px 8px', borderRadius: '4px',
                  background: fix.status === 'ACTIVE' ? 'rgba(0,255,157,0.1)' : fix.status === 'REJECTED' ? 'rgba(255,49,49,0.1)' : 'rgba(255,107,53,0.1)',
                  color: fix.status === 'ACTIVE' ? '#00FF9D' : fix.status === 'REJECTED' ? '#FF3131' : '#FF6B35'
                }}>{fix.status}</span>
                
                <div style={{ display: 'flex', gap: '5px' }}>
                  {fix.status !== 'ACTIVE' && <button onClick={() => approveRule(fix.id)} style={{ background: 'transparent', border: '1px solid #00FF9D', color: '#00FF9D', padding: '4px 8px', borderRadius: '3px', fontSize: '8px', cursor: 'pointer' }}>APPROVE</button>}
                  <button onClick={() => rejectRule(fix.id)} style={{ background: 'transparent', border: '1px solid #FF3131', color: '#FF3131', padding: '4px 8px', borderRadius: '3px', fontSize: '8px', cursor: 'pointer' }}>DELETE FROM ROOT</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 🧠 BRAIN SYNCHRONIZATION MATRIX (LEGACY/INFO) */}
      <div style={{ margin: '30px 40px 0 40px', display: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#9D00FF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🧠</span> AI BRAIN SYNCHRONIZATION MATRIX
          </h2>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#666', fontWeight: 900 }}>WISDOM PARITY: {brainSync?.total_deployed || 0}/{brainSync?.total_manifest || 0}</span>
            <button 
              className="cyber-btn-force"
              onClick={syncBrain}
              style={{ 
                background: '#9D00FF', color: '#FFF', border: 'none', padding: '8px 16px', 
                borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 0 15px rgba(157,0,255,0.4)'
              }}
            >SYNC BRAIN WISDOM</button>
          </div>
        </div>
        
        <div style={{ 
          background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(157,0,255,0.2)', 
          borderRadius: '12px', padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px'
        }}>
          {brainSync?.fixes?.map((fix: any) => (
            <div key={fix.id} style={{ 
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '8px', padding: '12px', position: 'relative'
            }}>
              <div style={{ fontSize: '8px', color: '#666', fontWeight: 900 }}>{fix.id} | {fix.category}</div>
              <div style={{ fontSize: '10px', color: '#CCC', margin: '6px 0', height: '30px', overflow: 'hidden' }}>{fix.summary}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '8px', fontWeight: 900, padding: '2px 6px', borderRadius: '3px',
                  background: fix.status === 'DEPLOYED' ? 'rgba(0,255,157,0.1)' : 'rgba(255,107,53,0.1)',
                  color: fix.status === 'DEPLOYED' ? '#00FF9D' : '#FF6B35'
                }}>{fix.status}</span>
                <span style={{ fontSize: '8px', color: fix.severity === 'CRITICAL' ? '#FF3131' : '#444' }}>{fix.severity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={mainGrid}>
        
        {/* COLUMN 1: TELEMETRY & RESOURCES */}
        <div style={columnStyle}>
          <h3 style={sectionHeader}>SYSTEM TELEMETRY</h3>
          
          <div style={telemetryRow}>
            {/* CPU GAUGE */}
            <div style={gaugeContainer}>
               <RingGauge percentage={telemetry?.cpu_usage || 0} color="#00F2FF" label="CPU CORES" />
            </div>
            {/* RAM GAUGE */}
            <div style={gaugeContainer}>
               <RingGauge percentage={telemetry?.memory_usage || 0} color="#9D00FF" label="MEMORY" />
               <div style={gaugeSubtext}>{telemetry?.memory_usage || 0}% USED</div>
            </div>
          </div>

          <div style={progressContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 900, marginBottom: '5px' }}>
              <span>MASTER DISK VAULT ( / )</span>
              <span style={{ color: '#D4AF37' }}>{telemetry?.storage_percent || 0}% USED</span>
            </div>
            <div style={progressBg}>
              <div style={{ ...progressFill, width: `${telemetry?.storage_percent || 0}%`, background: '#D4AF37' }} />
            </div>
            <div style={gaugeSubtext}>{telemetry?.storage_used || 0} / {telemetry?.storage_total || 0} GB ALLOCATED</div>
          </div>

          <div style={networkBox}>
            <div style={{ fontSize: '10px', color: '#888', fontWeight: 900 }}>NETWORK MATRIX</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <div><span style={{ color: '#00FF88' }}>▲ SENT:</span> {telemetry?.network_out || 0} MB</div>
              <div><span style={{ color: '#FF3131' }}>▼ RECV:</span> {telemetry?.network_in || 0} MB</div>
            </div>
          </div>

          <h3 style={{...sectionHeader, marginTop: '30px'}}>DATABASE LEDGER (SQL)</h3>
          <div style={backupBox}>
            <p style={{ fontSize: '11px', color: '#AAA', lineHeight: '1.5' }}>
              Initiate a zero-downtime structural clone of the entire Master Ledger. This exports the full dataset directly to your local machine.
            </p>
            <div style={actionRow}>
              <input type="password" value={masterPin} onChange={e=>setMasterPin(e.target.value)} placeholder="MASTER PIN" style={pinInput} />
              <button 
                className="cyber-btn gold" 
                style={backupBtn} 
                title="Sovereign Ledger Backup"
                onClick={executeBackup}
              >
                📥 SECURE BACKUP
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 2: PROCESS OVERRIDE & LOGS */}
        <div style={columnStyle}>
          <h3 style={sectionHeader}>PROCESS OVERRIDE (PM2 MATRIX)</h3>
          
          <div style={serviceGrid}>
            {services.map((svc: any, idx: number) => (
              <div key={idx} style={serviceCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, color: '#FFF' }}>{svc.name.toUpperCase()}</div>
                  <div style={statusBadge(svc.status)}>{svc.status}</div>
                </div>
                <div style={serviceStats}>
                  <span>MEM: {svc.memory_mb} MB</span>
                  <span>CPU: {svc.cpu_percent}%</span>
                </div>
                {/* 🛡️ RESTART LOCK */}
                <div style={actionRowSlim}>
                   <input type="password" value={masterPin} onChange={e=>setMasterPin(e.target.value)} placeholder="PIN" style={pinInputSlim} />
                   <button 
                      className="cyber-btn-force"
                      style={restartBtn}
                      onClick={() => executeRestart(svc.name)}
                    >
                      ⟲ ⚡ RUN PM2 RESTART
                   </button>
                </div>
              </div>
            ))}
            {/* STATIC NGINX CARD FOR LOGIC */}
            <div style={serviceCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, color: '#FFF' }}>NGINX PROXY</div>
                  <div style={statusBadge('ONLINE')}>ONLINE</div>
                </div>
                <div style={serviceStats}><span>MANAGED BY OS-LEVEL SYSTEMD</span></div>
                <div style={{ fontSize: '9px', color: '#888', marginTop: '10px', textAlign: 'center' }}>
                  Restarts restricted to SSH Root context.
                </div>
            </div>
          </div>

          <h3 style={{...sectionHeader, marginTop: '30px'}}>KINETIC LOG TERMINAL</h3>
          
          <div style={logControls}>
            {(['backend', 'frontend', 'nginx'] as const).map(target => (
               <button 
                 key={target} 
                 style={logTab(activeLog === target)}
                 onClick={() => setActiveLog(target)}
               >
                 {target.toUpperCase()} LOGS
               </button>
            ))}
          </div>

          <div style={terminalBox}>
            <pre style={terminalText}>{logs}</pre>
            <div ref={logEndRef} />
          </div>

          {/* GLOBAL ACTION STATUS CONSOLE */}
          {actionStatus && (
            <div style={actionStatusBox(actionStatus.includes('FATAL') || actionStatus.includes('ERROR'))}>
              &gt;&gt; {actionStatus}
            </div>
          )}

        </div>
      </div>

      {/* ============================================================ */}
      {/* 🔱 SRE DIAGNOSTIC LEDGER (ZONE 23 MASTER SCANNER)           */}
      {/* ============================================================ */}
      <div style={{ marginTop: '40px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '15px', padding: '25px', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#00F2FF', fontWeight: 900, letterSpacing: '2px' }}>SRE DIAGNOSTIC LEDGER</h3>
            <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#666' }}>SOVEREIGN INFRASTRUCTURE INTEGRITY & SELF-HEALING STATUS</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {sreScan && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: sreScan.summary.overall_health === 'HEALTHY' ? '#39FF14' : '#FF3131' }}>
                  HEALTH: {sreScan.summary.overall_health}
                </div>
                <div style={{ fontSize: '8px', color: '#555' }}>ISSUES: {sreScan.summary.total_issues} | LAST SCAN: {sreScan.scan_timestamp || 'NEVER'}</div>
              </div>
            )}
            <button 
              className="cyber-btn"
              onClick={runSreScan}
              disabled={isScanning}
              style={{ 
                background: isScanning ? '#222' : 'linear-gradient(135deg, #00F2FF, #0062FF)',
                color: '#000', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, fontSize: '10px',
                boxShadow: isScanning ? 'none' : '0 0 15px rgba(0,242,255,0.3)', cursor: 'pointer', border: 'none'
              }}
            >
              {isScanning ? 'SCANNING SYSTEM...' : '⚡ TRIGGER FULL SRE SCAN'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          {/* SCAN SUMMARY CARDS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {sreScan ? Object.entries(sreScan.scanners).map(([name, data]: [string, any]) => (
               <div key={name} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${data.status === 'PASS' ? '#39FF14' : data.status === 'WARN' ? '#D4AF37' : '#FF3131'}` }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                   <span style={{ fontSize: '9px', fontWeight: 900, color: '#AAA' }}>{name.toUpperCase().replace('_', ' ')}</span>
                   <span style={{ fontSize: '9px', fontWeight: 900, color: data.status === 'PASS' ? '#39FF14' : data.status === 'WARN' ? '#D4AF37' : '#FF3131' }}>{data.status}</span>
                 </div>
                 <div style={{ fontSize: '8px', color: '#666' }}>{data.issue_count || 0} issues found</div>
               </div>
             )) : (
               <div style={{ color: '#444', fontSize: '10px', textAlign: 'center', padding: '40px' }}>Awaiting initial scan...</div>
             )}
          </div>

          {/* REAL-TIME ISSUE LEDGER */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '400px', overflowY: 'auto' }}>
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
               <thead style={{ position: 'sticky', top: 0, background: '#111', color: '#00F2FF' }}>
                 <tr>
                   <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #222' }}>TIME</th>
                   <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #222' }}>ZONE</th>
                   <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #222' }}>DIAGNOSTIC REPORT</th>
                 </tr>
               </thead>
               <tbody>
                 {sreScan?.ledger?.length > 0 ? sreScan.ledger.map((log: any, i: number) => (
                   <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: log.severity === 'CRITICAL' ? '#FF3131' : log.severity === 'WARNING' ? '#D4AF37' : '#AAA' }}>
                     <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>[{log.time}]</td>
                     <td style={{ padding: '10px 12px', fontWeight: 900 }}>{log.zone}</td>
                     <td style={{ padding: '10px 12px' }}>{log.preview}</td>
                   </tr>
                 )) : (
                   <tr>
                     <td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>No issues detected. System integrity verified.</td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SOVEREIGN SENSOR PILLARS (5 PILLAR LIVE DASHBOARD)           */}
      {/* ============================================================ */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ ...sectionHeader, marginBottom: '20px', fontSize: '16px', color: '#D4AF37' }}>
          🛡️ SOVEREIGN SENSOR PILLARS — LIVE INTELLIGENCE
        </h3>
        
        {/* Pillar Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
          {[
            { key: 'financial', label: '💰 FINANCIAL VAULT', color: '#D4AF37' },
            { key: 'operational', label: '🏨 OPERATIONAL GRID', color: '#00F2FF' },
            { key: 'staff', label: '👥 HUMAN CAPITAL', color: '#9D00FF' },
            { key: 'guest', label: '⭐ GUEST INTEL', color: '#00FF88' },
            { key: 'sre', label: '⚡ SRE INFRA', color: '#FF6B35' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setActivePillar(key as any)}
              style={{
                padding: '8px 16px',
                background: activePillar === key ? `rgba(${color === '#D4AF37' ? '212,175,55' : color === '#00F2FF' ? '0,242,255' : color === '#9D00FF' ? '157,0,255' : color === '#00FF88' ? '0,255,136' : '255,107,53'},0.15)` : 'rgba(10,10,10,0.6)',
                color: activePillar === key ? color : '#555',
                border: activePillar === key ? `1px solid ${color}` : '1px solid #222',
                borderRadius: '8px', fontSize: '10px', fontWeight: 900,
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: activePillar === key ? `0 0 12px ${color}40` : 'none'
              }}
            >{label}</button>
          ))}
        </div>

        {/* Pillar Data Display */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {(() => {
            const pillarData = activePillar === 'financial' ? telemetry?.pillars?.financial
              : activePillar === 'operational' ? telemetry?.pillars?.operational
              : activePillar === 'staff' ? telemetry?.pillars?.human_capital
              : activePillar === 'guest' ? telemetry?.pillars?.guest_intelligence
              : telemetry?.pillars?.sre;
            
            if (!pillarData) return <div style={{ color: '#555', fontSize: '12px', padding: '20px' }}>Awaiting sensor data... (auto-refresh every 5s)</div>;
            if (pillarData.error) return <div style={{ color: '#FF3131', fontSize: '12px', padding: '20px' }}>Sensor Error: {pillarData.error}</div>;
            
            return Object.entries(pillarData)
              .filter(([k]) => k !== 'PILLAR' && k !== 'data_verified')
              .map(([key, value]: [string, any]) => (
                <div key={key} style={{
                  background: 'rgba(10,10,10,0.7)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px', padding: '14px'
                }}>
                  <div style={{ fontSize: '9px', color: '#666', fontWeight: 900, letterSpacing: '1px', marginBottom: '6px' }}>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#FFF', fontFamily: 'monospace' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </div>
                </div>
              ));
          })()}
        </div>
        
        {telemetry?.pillars && (
          <div style={{ marginTop: '10px', fontSize: '9px', color: '#333', fontFamily: 'monospace' }}>
            DATA VERIFIED — {telemetry?.pillars?.[activePillar === 'financial' ? 'financial' : activePillar === 'staff' ? 'human_capital' : activePillar === 'guest' ? 'guest_intelligence' : activePillar]?.data_verified || 'LIVE — Read directly from Master DB'}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* IMMUNE SYSTEM MONITOR (SELF-HEALING FLIGHT RECORDER)         */}
      {/* ============================================================ */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ ...sectionHeader, marginBottom: '20px', fontSize: '16px', color: '#00FF88' }}>
          🧬 SOVEREIGN IMMUNE SYSTEM — SELF-HEALING MONITOR
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          {/* Immune Status Panel */}
          <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#00FF88', fontWeight: 900, marginBottom: '15px', letterSpacing: '2px' }}>
              IMMUNE PILLARS — STATUS
            </div>
            {immune && backendStatus === 'ONLINE' ? (
              <>
                {Object.entries(immune.pillars || {}).map(([pillar, status]: [string, any]) => (
                  <div key={pillar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '11px', color: '#AAA', fontWeight: 900 }}>{pillar.replace(/_/g, ' ').toUpperCase()}</span>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#00FF88', background: 'rgba(0,255,136,0.1)', padding: '3px 10px', borderRadius: '4px' }}>{String(status)}</span>
                  </div>
                ))}
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
                  <div style={immuneStat}><span style={{ color: '#888', fontSize: '9px' }}>WHITELIST FIELDS</span><br/><b>{immune.firewall_whitelist_count}</b></div>
                  <div style={immuneStat}><span style={{ color: '#888', fontSize: '9px' }}>INJECTION SIGNATURES</span><br/><b>{immune.injection_signatures_monitored}</b></div>
                  <div style={immuneStat}><span style={{ color: '#888', fontSize: '9px' }}>PROTECTED TABLES</span><br/><b>{immune.protected_tables?.length || 0}</b></div>
                </div>
              </>
            ) : (
              <div style={{ 
                color: backendStatus === 'OFFLINE' ? '#FF3131' : '#555', 
                fontSize: '12px', fontWeight: 900, textAlign: 'center', padding: '40px 0',
                animation: backendStatus === 'OFFLINE' ? 'pulse_red 1.5s infinite' : 'none'
              }}>
                {backendStatus === 'OFFLINE' ? '⚠️ SYSTEM OFFLINE — CONNECTION SEVERED' : 'Awaiting immune telemetry...'}
                {backendStatus === 'OFFLINE' && <div style={{ fontSize: '8px', marginTop: '10px', color: '#666' }}>Run `pm2 restart miracle-backend` on VPS</div>}
              </div>
            )}
          </div>

          {/* Self-Healing Activity Log */}
          <div style={{ background: 'rgba(10,10,10,0.7)', border: '1px solid rgba(0,242,255,0.1)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#00F2FF', fontWeight: 900, marginBottom: '15px', letterSpacing: '2px' }}>
              SELF-HEALING ACTIVITY — TODAY
            </div>
            <div style={{ maxHeight: '250px', overflowY: 'auto' as const }}>
              {immune?.session_activity_today?.length ? immune.session_activity_today.map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '10px', fontFamily: 'monospace' }}>
                  <span style={{ color: '#444', minWidth: '55px' }}>{s.time}</span>
                  <span style={{ color: '#00F2FF', minWidth: '55px' }}>[{s.zone}]</span>
                  <span style={{ color: '#888' }}>{s.preview}</span>
                </div>
              )) : <div style={{ color: '#333', fontSize: '11px' }}>No AI activity logged today yet.</div>}
            </div>
          </div>
        </div>

        {/* Self-Learning Events */}
        {immune?.self_learning_events?.length > 0 && (
          <div style={{ marginTop: '20px', background: 'rgba(157,0,255,0.04)', border: '1px solid rgba(157,0,255,0.2)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '11px', color: '#9D00FF', fontWeight: 900, marginBottom: '12px' }}>🧠 SELF-LEARNING EVENTS (SHADOW-VALIDATED KNOWLEDGE)</div>
            {immune.self_learning_events.map((k: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '10px', fontFamily: 'monospace' }}>
                <span style={{ color: '#444', minWidth: '55px' }}>{k.time}</span>
                <span style={{ color: '#9D00FF', minWidth: '80px' }}>[{k.category}]</span>
                <span style={{ color: '#DDD', fontSize: '9px' }}>{k.insight}</span>
                <span style={{ color: '#666', marginLeft: 'auto' }}>Score: {k.importance}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI REPLY AUDIT LOG — BIDIRECTIONAL SELF-LEARNING ENGINE       */}
      {/* ============================================================ */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ ...sectionHeader, margin: 0, fontSize: '16px', color: '#FF6B35' }}>
            🔬 AI REPLY AUDIT — HALLUCINATION DETECTION & SELF-HEALING
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button 
                className="cyber-btn-force"
                onClick={async () => {
                  setActionStatus("SCANNING SYSTEM LOGS FOR HALLUCINATIONS...");
                  try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/audit/scan-all`, { method: 'POST' });
                    const data = await res.json();
                    setActionStatus(`SCAN DISPATCHED: ${data.message}`);
                    fetchAuditLog();
                  } catch(e) { setActionStatus("SCAN FAILED."); }
                }}
                style={{ background: 'rgba(0,242,255,0.1)', border: '1px solid #00F2FF', color: '#00F2FF', padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
             >🔬 SCAN FOR HALLUCINATIONS</button>
             <button 
                className="cyber-btn-force"
                onClick={async () => {
                  setActionStatus("SYNTHESIZING BRAIN PATCH FROM DETECTED ERRORS...");
                  // This now triggers the bulk sync of surgical fixes which include the self-healing logic
                  try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/surgical-fixes/sync-all`, { method: 'POST' });
                    const data = await res.json();
                    setActionStatus(`BRAIN PATCH SYNTHESIZED: ${data.message}`);
                    fetchBrainSync();
                    fetchAuditLog();
                  } catch(e) { setActionStatus("SYNTHESIS FAILED."); }
                }}
                style={{ background: 'rgba(157,0,255,0.1)', border: '1px solid #9D00FF', color: '#9D00FF', padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', position: 'relative' }}
             >
               🧪 SYNTHESIZE BRAIN PATCH
               {auditStats?.hallucinations_detected > 0 && (
                 <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#FF3131', color: '#FFF', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', border: '2px solid #000' }}>
                   {auditStats.hallucinations_detected}
                 </span>
               )}
             </button>
             <button 
                className="cyber-btn-force"
                onClick={async () => {
                  setActionStatus("FORCE-INJECTING SYSTEM WISDOM...");
                  try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/bot/v2/surgical-fixes/sync-all`, { method: 'POST' });
                    const data = await res.json();
                    setActionStatus(`SYSTEM WISDOM INJECTED: ${data.message}`);
                    showToast('Wisdom Injected', 'success', data.message);
                    fetchBrainSync();
                    fetchAuditLog();
                  } catch(e) { 
                    setActionStatus("INJECTION FAILED.");
                    showToast('Injection Failed', 'error', 'Kernel Unreachable');
                  }
                }}
                style={{ background: 'rgba(255,49,49,0.1)', border: '1px solid #FF3131', color: '#FF3131', padding: '6px 14px', borderRadius: '4px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
             >💉 FORCE-INJECT WISDOM</button>
          </div>
        </div>

        {/* Audit Stats Row */}
        {auditStats && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' as const }}>
            {[
              { label: 'TOTAL AUDITED', value: auditStats.total_replies_audited, color: '#00F2FF' },
              { label: 'CORRECT', value: auditStats.correct_replies, color: '#00FF88' },
              { label: 'HALLUCINATIONS', value: auditStats.hallucinations_detected, color: '#FF3131' },
              { label: 'PENDING AUDIT', value: auditStats.pending_audit, color: '#D4AF37' },
              { label: 'CORRECTIONS INJECTED', value: auditStats.corrections_injected, color: '#9D00FF' },
              { label: 'AI ACCURACY', value: `${auditStats.accuracy_pct}%`, color: auditStats.accuracy_pct >= 90 ? '#00FF88' : auditStats.accuracy_pct >= 70 ? '#D4AF37' : '#FF3131' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,10,10,0.8)', border: `1px solid ${color}33`, borderRadius: '10px', padding: '12px 18px', textAlign: 'center' as const, minWidth: '110px' }}>
                <div style={{ fontSize: '8px', color: '#666', fontWeight: 900, letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Audit Log Table */}
        <div style={{ background: 'rgba(6,4,10,0.95)', border: '1px solid rgba(255,107,53,0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,107,53,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#FF6B35', fontWeight: 900, letterSpacing: '2px' }}>LIVE REPLY AUDIT STREAM (auto-refresh 10s)</span>
            <span style={{ fontSize: '9px', color: '#444' }}>🔴 HALLUCINATION auto-corrects the AI brain permanently</span>
          </div>
          <div style={{ maxHeight: '420px', overflowY: 'auto' as const }}>
            {auditLog.length === 0 ? (
              <div style={{ padding: '30px', color: '#333', fontSize: '12px', textAlign: 'center' as const }}>No audit records yet. Speak to Miracle AI to begin tracking.</div>
            ) : auditLog.map((r: any, i: number) => (
              <div key={r.id} style={{
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: r.verdict === 'HALLUCINATION' ? 'rgba(255,49,49,0.04)' : r.verdict === 'CORRECT' ? 'rgba(0,255,136,0.02)' : 'transparent',
                transition: 'background 0.3s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  {/* Left: Query + Reply */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: '8px', color: '#444', fontFamily: 'monospace' }}>{r.created_at?.slice(11, 16) || '--'}</span>
                      <span style={{ fontSize: '8px', color: '#00F2FF', background: 'rgba(0,242,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>{r.zone || '?'}</span>
                      <span style={{ fontSize: '8px', color: '#666' }}>{r.intent}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>
                      <span style={{ color: '#555' }}>Q: </span>{r.user_query}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                      <span style={{ color: '#333' }}>A: </span>{r.ai_reply?.slice(0, 160)}{r.ai_reply?.length > 160 ? '...' : ''}
                    </div>
                    {/* Correction row — only shown for hallucinations */}
                    {r.verdict === 'HALLUCINATION' && r.correction && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '8px', color: '#00FF88', fontWeight: 900, marginBottom: '3px' }}>✅ SELF-HEALING CORRECTION INJECTED:</div>
                        <div style={{ fontSize: '10px', color: '#00FF88' }}>{r.correction}</div>
                      </div>
                    )}
                    {r.verdict === 'HALLUCINATION' && r.root_cause && (
                      <div style={{ marginTop: '4px', fontSize: '9px', color: '#FF6B35' }}>
                        🔍 Root Cause: {r.root_cause}
                      </div>
                    )}
                  </div>
                  {/* Right: Verdict Badge + Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={verdictBadge(r.verdict)}>{r.verdict}</div>
                    
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <button 
                        onClick={() => triggerAudit(r.id)}
                        style={{ ...miniBtn, background: 'rgba(0,242,255,0.1)', color: '#00F2FF', border: '1px solid rgba(0,242,255,0.3)' }}
                        title="Run Deterministic & LLM Audit"
                      >🔬 AUDIT</button>
                    </div>

                    {r.hallucination_type && (
                      <div style={{ fontSize: '8px', color: '#FF6B35', fontWeight: 700 }}>{r.hallucination_type}</div>
                    )}
                    {r.confidence > 0 && (
                      <div style={{ fontSize: '8px', color: '#555' }}>{r.confidence}% conf</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* MANUAL HEALING INJECTION MODAL/PANEL */}
          {activeHeal && (
            <div style={{ 
              padding: '20px', 
              background: 'rgba(157,0,255,0.08)', 
              borderTop: '2px solid #9D00FF',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#9D00FF', fontWeight: 900 }}>⚡ SOVEREIGN BRAIN HEALING — PREVIEW</h4>
                <button onClick={() => setActiveHeal(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>✕ CLOSE</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <div style={labelStyle}>ROOT CAUSE</div>
                  <textarea 
                    value={activeHeal.root_cause} 
                    onChange={e => setActiveHeal({...activeHeal, root_cause: e.target.value})}
                    style={healInput}
                  />
                </div>
                <div>
                  <div style={labelStyle}>CORRECTION</div>
                  <textarea 
                    value={activeHeal.correction} 
                    onChange={e => setActiveHeal({...activeHeal, correction: e.target.value})}
                    style={healInput}
                  />
                </div>
              </div>
              <div style={{ marginTop: '15px' }}>
                <div style={labelStyle}>PREVENTION RULE (BRAIN INJECTION)</div>
                <textarea 
                  value={activeHeal.prevention_rule} 
                  onChange={e => setActiveHeal({...activeHeal, prevention_rule: e.target.value})}
                  style={{ ...healInput, height: '40px' }}
                />
              </div>
              <button 
                onClick={injectHeal}
                style={{
                  marginTop: '15px', width: '100%', padding: '12px',
                  background: '#9D00FF', color: '#FFF', border: 'none',
                  borderRadius: '8px', fontWeight: 900, cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(157,0,255,0.5)'
                }}
              >EXECUTE BRAIN INJECTION & FIX PERMANENTLY</button>
            </div>
          )}
        </div>
      </div>

      {/* V12.0: SYSTEM ERROR LOGS (CDO DIAGNOSTICS PIPELINE) */}
      <div style={{ margin: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ ...sectionHeader, margin: 0, fontSize: '16px', color: '#FF3131' }}>
            🚨 SYSTEM ERROR LOGS — CDO DIAGNOSTICS PIPELINE
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             {errorActionStatus && <div style={{ fontSize: '10px', color: '#00F2FF', fontFamily: 'monospace' }}>{errorActionStatus}</div>}
             {errorLogs.some((e: any) => e.status === 'AI_ANALYZED') && (
               <button onClick={dismissAllAnalyzed} style={{ padding: '6px 14px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', background: 'rgba(0,255,136,0.1)', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '4px' }}>✓ DISMISS ANALYZED</button>
             )}
             <button onClick={fetchErrorLogs} disabled={isRefreshingLogs} style={{ padding: '6px 14px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', background: 'transparent', color: '#00F2FF', border: '1px solid #00F2FF', borderRadius: '4px', opacity: isRefreshingLogs ? 0.5 : 1 }}>{isRefreshingLogs ? '⟳ REFRESHING...' : 'REFRESH LOGS'}</button>
          </div>
        </div>

        <div style={{ background: 'rgba(6,4,10,0.95)', border: '1px solid rgba(255,49,49,0.2)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,49,49,0.15)', display: 'grid', gridTemplateColumns: '80px 150px 1fr 100px 100px', gap: '10px', fontSize: '10px', color: '#FF3131', fontWeight: 900, letterSpacing: '1px' }}>
            <div>SOURCE</div><div>ERROR TYPE</div><div>MESSAGE</div><div>STATUS</div><div>ACTIONS</div>
          </div>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {errorLogs.length === 0 ? (
              <div style={{ padding: '30px', color: '#333', fontSize: '12px', textAlign: 'center' }}>No system errors detected. Systems nominal.</div>
            ) : errorLogs.map((r: any, i: number) => (
              <div key={r.id} style={{
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: r.status === 'UNRESOLVED' ? 'rgba(255,49,49,0.04)' : 'rgba(0,242,255,0.02)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 150px 1fr 100px 100px', gap: '10px', alignItems: 'start' }}>
                  <div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>{r.source}</div>
                  <div style={{ fontSize: '11px', color: '#FF3131', fontWeight: 700, wordBreak: 'break-word' }}>{r.error_type}</div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#CCC', marginBottom: '8px' }}>{r.error_message}</div>
                    {r.url && <div style={{ fontSize: '9px', color: '#666', marginBottom: '8px' }}>Path: {r.url}</div>}
                    
                    {/* AI Analysis Block */}
                    {r.ai_analysis && (
                      <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(0,242,255,0.05)', borderLeft: '2px solid #00F2FF', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: '#00F2FF', fontWeight: 900, marginBottom: '4px' }}>🧠 SOVEREIGN AI DIAGNOSIS:</div>
                        <div style={{ fontSize: '11px', color: '#FFF' }}>{r.ai_analysis}</div>
                      </div>
                    )}
                    {r.ai_proposed_fix && (
                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(0,255,136,0.05)', borderLeft: '2px solid #00FF88', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: '#00FF88', fontWeight: 900, marginBottom: '4px' }}>🛠️ PROPOSED FIX (Give to Dev):</div>
                        <pre style={{ fontSize: '10px', color: '#00FF88', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap' }}>{r.ai_proposed_fix}</pre>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 900, color: r.status === 'UNRESOLVED' ? '#FF3131' : '#00F2FF' }}>{r.status}</div>
                  <div>
                    {r.status === 'UNRESOLVED' && (
                      <button 
                        onClick={() => analyzeError(r.id)}
                        style={{ ...miniBtn, background: 'rgba(0,242,255,0.1)', color: '#00F2FF', border: '1px solid rgba(0,242,255,0.3)', width: '100%', marginBottom: '6px' }}
                      >ANALYZE</button>
                    )}
                    {r.status === 'AI_ANALYZED' && (
                      <button
                        onClick={() => dismissError(r.id)}
                        style={{ ...miniBtn, background: 'rgba(0,255,136,0.1)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.3)', width: '100%' }}
                      >✓ DISMISS</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* V11.0: SOVEREIGN BRAIN MANIFEST - CDO INJECTION GATE */}
      <div style={{ margin: '30px 40px 40px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#D4AF37', margin: 0 }}>
            🔬 SOVEREIGN BRAIN MANIFEST — CDO INJECTION GATE
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['ALL', 'PENDING_INJECTION', 'ACTIVE', 'REJECTED'] as const).map(f => (
              <button key={f} onClick={() => { setManifestFilter(f); fetchBrainManifest(f); }} style={{ padding: '5px 10px', fontSize: '8px', fontWeight: 900, cursor: 'pointer', background: manifestFilter === f ? 'rgba(212,175,55,0.2)' : 'transparent', color: manifestFilter === f ? '#D4AF37' : '#555', border: `1px solid ${manifestFilter === f ? '#D4AF37' : '#333'}`, borderRadius: '6px' }}>{f.replace('_', ' ')}</button>
            ))}
            <button onClick={() => fetchBrainManifest()} style={{ padding: '5px 12px', fontSize: '8px', fontWeight: 900, cursor: 'pointer', background: 'transparent', color: '#00F2FF', border: '1px solid #00F2FF', borderRadius: '6px' }}>REFRESH</button>
          </div>
        </div>
        {manifestAction && (
          <div style={{ padding: '8px 12px', marginBottom: '12px', fontSize: '10px', fontWeight: 900, fontFamily: 'monospace', background: manifestAction.includes('APPROVED') ? 'rgba(0,255,136,0.08)' : 'rgba(255,49,49,0.08)', borderLeft: manifestAction.includes('APPROVED') ? '3px solid #00FF88' : '3px solid #FF3131', color: manifestAction.includes('APPROVED') ? '#00FF88' : '#FF3131', borderRadius: '0 6px 6px 0' }}>{manifestAction}</div>
        )}
        {manifestFilter === 'PENDING_INJECTION' && brainManifest.filter(r => r.status === 'PENDING_INJECTION').length > 0 && (
          <div style={{ padding: '10px 15px', marginBottom: '15px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', fontSize: '10px', color: '#D4AF37', fontWeight: 900 }}>
            AWAITING CDO APPROVAL: {brainManifest.filter(r => r.status === 'PENDING_INJECTION').length} rule(s). APPROVE to wire into AI brain. REJECT to discard.
          </div>
        )}
        <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '45px 110px 70px 1fr 80px 150px', gap: '10px', padding: '10px 16px', background: 'rgba(212,175,55,0.06)', borderBottom: '1px solid rgba(212,175,55,0.1)', fontSize: '8px', color: '#D4AF37', fontWeight: 900 }}>
            <div>ID</div><div>CATEGORY</div><div>SOURCE</div><div>INSIGHT</div><div>PRIORITY</div><div>CDO ACTION</div>
          </div>
          {brainManifest.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center' as const, color: '#444', fontSize: '11px', fontFamily: 'monospace' }}>{manifestFilter === 'PENDING_INJECTION' ? 'NO PENDING RULES. BRAIN IS CLEAN.' : 'NO RECORDS.'}</div>
          ) : brainManifest.map((rule, i) => (
            <div key={rule.id} style={{ display: 'grid', gridTemplateColumns: '45px 110px 70px 1fr 80px 150px', gap: '10px', padding: '12px 16px', alignItems: 'start', borderBottom: i < brainManifest.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', background: rule.status === 'PENDING_INJECTION' ? 'rgba(212,175,55,0.03)' : 'transparent' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>#{rule.id}</div>
              <div><span style={{ fontSize: '7px', fontWeight: 900, padding: '3px 6px', borderRadius: '4px', background: rule.category === 'ANTI_HALLUCINATION' ? 'rgba(255,49,49,0.15)' : 'rgba(0,242,255,0.1)', color: rule.category === 'ANTI_HALLUCINATION' ? '#FF3131' : '#00F2FF', border: rule.category === 'ANTI_HALLUCINATION' ? '1px solid rgba(255,49,49,0.3)' : '1px solid rgba(0,242,255,0.2)' }}>{rule.category}</span></div>
              <div style={{ fontSize: '9px', color: '#555', fontFamily: 'monospace' }}>{rule.source_role || '-'}</div>
              <div style={{ fontSize: '10px', color: '#aaa', lineHeight: '1.5', wordBreak: 'break-word' as const }}>{rule.insight_preview}{rule.business_context && <div style={{ fontSize: '8px', color: '#555', marginTop: '4px' }}>{rule.business_context}</div>}</div>
              <div style={{ textAlign: 'center' as const }}><span style={{ fontSize: '20px', fontWeight: 900, color: rule.importance_score >= 9 ? '#FF3131' : '#D4AF37' }}>{rule.importance_score}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '5px' }}>
                <span style={{ fontSize: '7px', fontWeight: 900, padding: '3px 6px', borderRadius: '4px', textAlign: 'center' as const, background: rule.status === 'ACTIVE' ? 'rgba(0,255,136,0.12)' : rule.status === 'PENDING_INJECTION' ? 'rgba(212,175,55,0.15)' : 'rgba(255,49,49,0.1)', color: rule.status === 'ACTIVE' ? '#00FF88' : rule.status === 'PENDING_INJECTION' ? '#D4AF37' : '#FF3131' }}>{rule.status?.replace('_', ' ')}</span>
                {rule.status === 'PENDING_INJECTION' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button id={`approve-${rule.id}`} onClick={() => approveRule(rule.id)} style={{ flex: 1, padding: '5px 0', fontSize: '8px', fontWeight: 900, cursor: 'pointer', background: 'rgba(0,255,136,0.15)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.4)', borderRadius: '5px' }}>APPROVE</button>
                    <button id={`reject-${rule.id}`} onClick={() => rejectRule(rule.id)} style={{ flex: 1, padding: '5px 0', fontSize: '8px', fontWeight: 900, cursor: 'pointer', background: 'rgba(255,49,49,0.12)', color: '#FF3131', border: '1px solid rgba(255,49,49,0.3)', borderRadius: '5px' }}>REJECT</button>
                  </div>
                )}
                {rule.status === 'REJECTED' && (
                  <button onClick={() => approveRule(rule.id)} style={{ padding: '4px 0', fontSize: '7px', fontWeight: 900, cursor: 'pointer', background: 'transparent', color: '#555', border: '1px solid #333', borderRadius: '5px' }}>RE-APPROVE</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', fontSize: '9px', color: '#333', fontFamily: 'monospace', textAlign: 'center' as const }}>SOVEREIGN PROTOCOL: Only APPROVED rules are injected into the AI brain as HARD RULES.</div>
      </div>
    </div>
  );
}

// ===================================
// PURE CSS KINETIC RING GAUGE
// ===================================
const RingGauge = ({ percentage, color, label }: { percentage: number, color: string, label: string }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
        <circle 
          cx="60" cy="60" r={radius} 
          stroke={color} strokeWidth="8" fill="transparent" 
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out', filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace', color: '#FFF' }}>{percentage}%</div>
        <div style={{ fontSize: '8px', fontWeight: 900, color: '#888', letterSpacing: '1px' }}>{label}</div>
      </div>
    </div>
  );
};

// ===================================
// STYLES
// ===================================
const viewportStyle = { padding: '30px', minHeight: '100vh', background: 'transparent', color: '#FFF' };
const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '30px' };
const titleStyle = { fontFamily: 'Cinzel', fontSize: '28px', color: '#D4AF37', margin: 0, textShadow: '0 0 20px rgba(212,175,55,0.3)', letterSpacing: '2px' };
const subtitleStyle = { fontSize: '10px', color: '#00F2FF', fontWeight: 900, letterSpacing: '1px', marginTop: '5px' };
const liveUptimeBox = { background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)', padding: '10px 20px', borderRadius: '8px', textAlign: 'center' as const };
const mainGrid = { display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(400px, 1.5fr)', gap: '40px' };
const columnStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px' };
const sectionHeader = { fontSize: '14px', color: '#FFF', fontWeight: 900, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', margin: 0 };

const telemetryRow = { display: 'flex', justifyContent: 'space-around', background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' };
const gaugeContainer = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' };
const gaugeSubtext = { fontSize: '10px', color: '#888', marginTop: '10px', fontWeight: 900, fontFamily: 'monospace' };

const progressContainer = { background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' };
const progressBg = { width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' };
const progressFill = { height: '100%', transition: 'width 1s ease-in-out', boxShadow: '0 0 10px rgba(212,175,55,0.6)' };

const networkBox = { background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px', fontFamily: 'monospace', fontWeight: 900 };

const backupBox = { background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', padding: '20px' };
const actionRow = { display: 'flex', gap: '10px', marginTop: '15px' };
const pinInput = { background: 'rgba(0,0,0,0.5)', border: '1px solid #444', color: '#FFF', padding: '10px', borderRadius: '8px', fontSize: '11px', width: '120px', outline: 'none', textAlign: 'center' as const, letterSpacing: '4px' };
const backupBtn = { flex: 1, padding: '10px', background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', color: '#D4AF37', borderRadius: '8px', fontSize: '11px', fontWeight: 900, cursor: 'pointer' };

const serviceGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' };
const serviceCard = { background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(0,242,255,0.1)', borderRadius: '12px', padding: '15px' };
const statusBadge = (status: string) => ({ background: status === 'ONLINE' ? 'rgba(0,255,136,0.1)' : 'rgba(255,49,49,0.1)', color: status === 'ONLINE' ? '#00FF88' : '#FF3131', padding: '3px 8px', borderRadius: '4px', fontSize: '8px', fontWeight: 900 });
const serviceStats = { fontSize: '10px', color: '#888', display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontFamily: 'monospace' };
const actionRowSlim = { display: 'flex', gap: '5px', marginTop: '15px' };
const pinInputSlim = { ...pinInput, padding: '6px', fontSize: '9px', width: '70px', letterSpacing: '2px' };
const restartBtn = { 
  flex: 1, 
  padding: '12px', 
  background: 'rgba(255,49,49,0.1)', 
  border: '1px solid #FF3131', 
  color: '#FF3131', 
  borderRadius: '6px', 
  fontSize: '10px', 
  fontWeight: 900, 
  cursor: 'pointer',
  boxShadow: '0 0 15px rgba(255,49,49,0.3)',
  transition: 'all 0.1s',
  position: 'relative' as const,
  zIndex: 9999,
  pointerEvents: 'auto' as const
};

const logControls = { display: 'flex', gap: '5px' };
const logTab = (active: boolean) => ({ padding: '8px 15px', background: active ? 'rgba(0,242,255,0.1)' : 'transparent', color: active ? '#00F2FF' : '#555', border: active ? '1px solid #00F2FF' : '1px solid #333', borderRadius: '8px 8px 0 0', fontSize: '10px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' });
const terminalBox = { background: '#0A0A0E', border: '1px solid #00F2FF', borderRadius: '0 8px 8px 8px', padding: '15px', height: '300px', overflowY: 'auto' as const, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)' };
const terminalText = { fontFamily: 'monospace', fontSize: '11px', color: '#00F2FF', margin: 0, whiteSpace: 'pre-wrap' as const, lineHeight: '1.4' };

const actionStatusBox = (isError: boolean) => ({ marginTop: '15px', padding: '10px', background: isError ? 'rgba(255,49,49,0.1)' : 'rgba(0,255,136,0.1)', borderLeft: isError ? '4px solid #FF3131' : '4px solid #00FF88', color: isError ? '#FF3131' : '#00FF88', fontSize: '11px', fontFamily: 'monospace', fontWeight: 900 });
const immuneStat = { background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '14px', color: '#00FF88', fontWeight: 900, textAlign: 'center' as const, flex: '1' };

const verdictBadge = (verdict: string) => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    CORRECT:       { bg: 'rgba(0,255,136,0.12)', color: '#00FF88', border: 'rgba(0,255,136,0.3)' },
    HALLUCINATION: { bg: 'rgba(255,49,49,0.15)',  color: '#FF3131', border: 'rgba(255,49,49,0.4)' },
    PARTIAL:       { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
    UNVERIFIABLE:  { bg: 'rgba(255,255,255,0.05)', color: '#666',    border: 'rgba(255,255,255,0.1)' },
    PENDING:       { bg: 'rgba(212,175,55,0.1)',  color: '#D4AF37', border: 'rgba(212,175,55,0.25)' },
  };
  const s = map[verdict] || map.PENDING;
  return {
    background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    borderRadius: '6px', padding: '4px 10px', fontSize: '9px', fontWeight: 900,
    letterSpacing: '1px', whiteSpace: 'nowrap' as const,
  };
};

const miniBtn = { 
  fontSize: '7px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', outline: 'none'
};

const healInput = {
  width: '100%', height: '80px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(157,0,255,0.3)',
  color: '#FFF', fontSize: '11px', padding: '10px', borderRadius: '6px', outline: 'none', resize: 'none' as const,
  fontFamily: 'monospace'
};

const labelStyle = {
  fontSize: '9px', color: '#666', fontWeight: 900, marginBottom: '5px'
};

// CSS Injection for Animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes pulse_red {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

