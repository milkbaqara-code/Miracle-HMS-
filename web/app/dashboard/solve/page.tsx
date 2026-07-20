// web/app/dashboard/solve/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useGlobalSync } from '../../context/GlobalSyncContext'; // Iron Law 31
import { useRadio } from '../../context/RadioContext';

import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';
// --- ENTERPRISE TYPES ---
interface Mission {
  id: number;
  room_no: string;
  dept: string;
  subject: string;
  status: 'Active' | 'Securing' | 'Resolved' | 'PENDING'; // 🛡️ CDO FIX: Added backend sync status
  assigned_to: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  checks: string[];
  raised_at: string;
  picked_up_at: string | null;
  secured_at: string | null;
  proof_image?: string | null; // Biometric/Visual Proof
}

// 🛡️ DEMO-SAFE: Use env variable so this works in deployed demo environments too
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export default function SolveTicketsHub() {
  const isViewMode = useViewMode();
  const { syncPulse, triggerGlobalSync } = useGlobalSync();
  const { showToast } = useToast();
  const [view, setView] = useState<'RADAR' | 'MY_TASKS' | 'MY_PROFILE'>('RADAR');
  
  // 🛡️ DYNAMIC IDENTITY HYDRATION (From Login Portal)
  const [userName, setUserName] = useState('');
  const [operativeRole, setOperativeRole] = useState('');
  const [operativeStatus, setOperativeStatus] = useState('OFFLINE');
  const [shiftStart, setShiftStart] = useState<string | null>(null);
  
  const [operativeStats, setOperativeStats] = useState({ monthly_hours: 0, avg_response: 0, missions_count: 0 });
  const [commissionInfo, setCommissionInfo] = useState({ earned: 0, salary: 0, show_salary: false });
  
  const [missions, setMissions] = useState<Mission[]>([]);
  const [corporateNodes, setCorporateNodes] = useState<any[]>([]);
  const [completedChecks, setCompletedChecks] = useState<Record<number, string[]>>({});
  const [isLive, setIsLive] = useState(false);
  
  // Image Upload State
  const [proofUploads, setProofUploads] = useState<Record<number, File | null>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});

  // Staff Profile State
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [payRequestAmount, setPayRequestAmount] = useState('');
  const [payRequestMethod, setPayRequestMethod] = useState('BANK');

  const { setRadioVisible, setRadioExpanded, radioActive } = useRadio();

  const fetchRadar = async () => {
    try {
      const res = await fetch(`${API_BASE}/solve/active`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setMissions(data.missions);
    } catch (err) { console.error("RADAR_CRASH:", err); }
  };

  const fetchStats = async (user: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/solve/operative-stats/${user}`);
      const data = await res.json();
      if (data.status === 'SUCCESS') setOperativeStats(data.stats);
    } catch (err) { console.error("STATS_CRASH:", err); }

    try {
        const perfRes = await fetch(`${API_BASE}/hr/performance-matrix/${user}`);
        if(perfRes.ok) {
            const perfData = await perfRes.json();
            if (perfData.status === 'SUCCESS') {
                if (perfData.operative_status) setOperativeStatus(perfData.operative_status);
                if (perfData.shift_start) setShiftStart(perfData.shift_start);
                setOperativeStats(prev => ({...prev, monthly_hours: perfData.monthly_hours || prev.monthly_hours}));
                setCommissionInfo({
                    earned: perfData.commission || 0,
                    salary: perfData.salary || 0,
                    show_salary: perfData.show_salary || false
                });
            }
        }
    } catch (err) { console.error("PERF_CRASH:", err); }
  };

  const handleDutyAction = async (action: 'START' | 'END') => {
    try {
        const formData = new FormData();
        formData.append('username', userName);
        const endpoint = action === 'START' ? '/duty/start' : '/duty/end';
        const res = await fetch(`${API_BASE}/hr${endpoint}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            setOperativeStatus(data.status);
            if (action === 'START') {
                setShiftStart(data.shift_start);
            } else {
                setShiftStart(null);
            }
            showToast(action === 'START' ? 'DUTY STARTED' : 'DUTY ENDED', 'success', data.message);
            triggerGlobalSync();
            fetchStats(userName);
        } else {
            showToast('DUTY ERROR', 'error', data.detail || 'Could not update duty status.');
        }
    } catch(e) {
        showToast('SYSTEM OFFLINE', 'warning', 'Cannot sync duty status to Sovereign HR Ledger.');
    }
  };

  // 1. BOOT SEQUENCE: LOAD IDENTITY & RADAR
  useEffect(() => {
    const user = localStorage.getItem('miracle_user') || 'ANONYMOUS';
    const role = localStorage.getItem('vigilant_role') || 'STAFF';
    const avatar = localStorage.getItem('miracle_avatar');
    setUserName(user);
    setOperativeRole(role);
    if (avatar) setAvatarPreview(avatar);

    fetchRadar();
    fetchStats(user);
  }, [syncPulse]);


  const syncRadar = useCallback(async () => {
    try {
      // 🛡️ THE CDO UPGRADE: Physical Python Backend Uplink
      const res = await fetch(`${API_BASE}/solve/active`);
      if (res.ok) {
          const data = await res.json();
          let newMissions = [];
          if (data.missions && data.missions.length > 0) {
              newMissions = data.missions;
          }
          
          // 🛡️ CDO UPGRADE: Fetch Corporate Directives (Phase 26)
          try {
            const dirRes = await fetch(`${API_BASE}/synapse/directives`);
            if (dirRes.ok) {
              const dirData = await dirRes.json();
              if (dirData.status === 'SUCCESS' && dirData.directives) {
                setCorporateNodes(dirData.directives);
              }
            }
          } catch(e) { console.warn("Failed to fetch corporate directives"); }

          if (newMissions.length > 0) {
              setMissions(newMissions);
              localStorage.setItem('miracle_missions', JSON.stringify(newMissions));
              setIsLive(true);
              return;
          }
          // DB returned but is empty — wipe ghost localStorage so seeds don't persist
          localStorage.removeItem('miracle_missions');
          setMissions([]);
          setIsLive(true);
          return;
      }
      throw new Error("Backend offline, checking local vault.");
    } catch (backendError) {
      try {
        const raw = localStorage.getItem('miracle_missions');
        if (raw) {
            setMissions(JSON.parse(raw));
        } else {
            setMissions([]);
        }
        // 🛡️ FIX: Local data is NOT live — show the SYNC button so user knows
        setIsLive(false);
      } catch (e) { setIsLive(false); }
    }
  }, []);


  useEffect(() => {
    syncRadar();
  }, [syncRadar, syncPulse]);

  // --- 2. TACTICAL ENGINES ---
  const handleProofChange = (missionId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofUploads({...proofUploads, [missionId]: file});
      setPreviewUrls({...previewUrls, [missionId]: URL.createObjectURL(file)});
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          setAvatarPreview(url);
          localStorage.setItem('miracle_avatar', url);
      }
  };

  const handleAvatarRemove = () => {
      setAvatarPreview(null);
      localStorage.removeItem('miracle_avatar');
  };

  const handlePaymentRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const res = await fetch(`${API_BASE}/hr/payment-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  staff_id: userName,
                  amount: parseFloat(payRequestAmount),
                  method: payRequestMethod
              })
          });
          if(res.ok) {
              showToast('PAYMENT REQUEST', 'success', `💸 $${payRequestAmount} via ${payRequestMethod} submitted to Accounts.`);
              setPayRequestAmount('');
          } else {
              showToast('REQUEST FAILED', 'error', 'Ensure Accounts DB is accessible.');
          }
      } catch(e) {
          showToast('NETWORK ERROR', 'error', 'Could not submit payment request. Try again.');
      }
  };

  const pickupMission = async (id: number) => {
    const m = radarMissions.find(x => x.id === id);
    if (m?.is_corp_node) {
      try {
        await fetch(`${API_BASE}/synapse/directives/${m.real_directive_id}/nodes/${m.real_node_id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ started: true, assignee_id: userName }) 
        });
        triggerGlobalSync();
      } catch (e) { console.warn("Failed to lock corp node"); }
      return;
    }

    // Optimistic UI Update
    const updated = missions.map(m => m.id === id ? { ...m, assigned_to: userName, picked_up_at: new Date().toISOString() } : m);
    saveAndSync(updated);

    // 🛡️ CDO FIX: Attempt physical DB lock
    try {
      const formData = new FormData();
      formData.append('operative_name', userName);
      await fetch(`${API_BASE}/solve/pickup/${id}`, { method: 'PATCH', body: formData });
      triggerGlobalSync();
    } catch (e) { console.warn("Failed to lock in physical DB, relying on local state."); }
  };

  const finalizeMission = async (id: number) => {
    const m = myMissions.find(x => x.id === id);
    if (m?.is_corp_node) {
      if (m.requires_verification && !proofUploads[id]) {
        showToast('PROTOCOL VIOLATION', 'warning', 'You must upload photographic proof of completion for this Corporate Node.');
        return;
      }
      try {
        if (m.requires_verification) {
          const formData = new FormData();
          formData.append('file', proofUploads[id]!);
          formData.append('uploaded_by', userName);
          formData.append('node_id', String(m.real_node_id));
          await fetch(`${API_BASE}/synapse/directives/${m.real_directive_id}/upload`, {
            method: 'POST', body: formData
          });
        }
        await fetch(`${API_BASE}/synapse/directives/${m.real_directive_id}/nodes/${m.real_node_id}`, { 
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: true }) 
        });
        triggerGlobalSync();
        showToast('CORPORATE NODE SECURED', 'success', 'Node marked complete and synced to Z-20.');
      } catch (e) { console.error("Failed to secure corp node", e); }
      return;
    }

    const proofFile = proofUploads[id];
    if (!proofFile) {
        showToast('PROTOCOL VIOLATION', 'warning', 'You must upload photographic proof of completion before securing this mission.');
        return;
    }

    const now = new Date().toISOString();
    const updated = missions.map(m => {
      if (m.id === id) {
        return { ...m, status: 'Resolved' as const, secured_at: now, proof_image: previewUrls[id] };
      }
      return m;
    });
    
    saveAndSync(updated);
    
    // 🛡️ CDO FIX: Two-tier resolution — try full proof upload first, fall back to force-resolve
    let resolvedInDB = false;
    try {
      const formData = new FormData();
      formData.append('operative_name', userName);
      formData.append('proof_image', proofFile);
      const secureRes = await fetch(`${API_BASE}/solve/secure/${id}`, { method: 'POST', body: formData });
      if (secureRes.ok) resolvedInDB = true;
    } catch (e) { console.warn("Primary secure endpoint failed, trying force-resolve..."); }
    
    // If primary secure failed, call force-resolve to guarantee grid signal clearance
    if (!resolvedInDB) {
      try {
        await fetch(`${API_BASE}/solve/force-resolve/${id}`, { method: 'POST' });
        resolvedInDB = true;
      } catch (e) { console.warn("Force-resolve offline. Resolution cached locally."); }
    }

    showToast('MISSION SECURED', 'success', resolvedInDB ? 'Grid signal cleared from Master Grid (Z-07).' : 'Offline: Resolution cached locally — will sync on next backend connection.');
    triggerGlobalSync();
    
    // Clean up local image state
    const newUploads = {...proofUploads}; delete newUploads[id]; setProofUploads(newUploads);
    const newPreviews = {...previewUrls}; delete newPreviews[id]; setPreviewUrls(newPreviews);
  };


  const saveAndSync = (updated: Mission[]) => {
    setMissions(updated);
    localStorage.setItem('miracle_missions', JSON.stringify(updated));
  };

  // 🛡️ CDO FIX: LOCAL-TO-CLOUD SYNC (THE VAULT UPLINK)
  const syncGhostTickets = async () => {
    const localMissions = JSON.parse(localStorage.getItem('miracle_missions') || '[]');
    if (localMissions.length === 0) {
      showToast('VAULT EMPTY', 'warning', 'No local records to sync.');
      return;
    }

    let successCount = 0;
    for (const m of localMissions) {
        try {
            const apiPayload = {
                room: m.room_no,
                dept: m.dept,
                subject: m.subject,
                priority: m.priority,
                checks: m.checks
            };
            const res = await fetch(`${API_BASE}/solve/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload)
            });
            if (res.ok) successCount++;
        } catch (e) { console.error("Sync Error:", e); }
    }
    
    showToast('SYNC COMPLETE', 'success', `${successCount} ghost tickets migrated to Master Ledger. Command Grid (Z-07) will now pulse with these updates.`);
    triggerGlobalSync();
    syncRadar(); // Refresh state from master
  };

  // 🛡️ THE RBAC FIX & DUTY LOCK
  const userRoles = operativeRole.split(',').map(r => r.trim());
  const isGodMode = userRoles.some(r => ['CDO', 'GM', 'ADMIN'].includes(r));
  
  // 🛡️ CDO FIX: Hybrid Map Corporate Nodes to Missions
  const mappedCorpNodes = corporateNodes.flatMap(d => 
    (d.nodes || [])
      .filter((n: any) => !n.done && (isGodMode || userRoles.includes(n.target_dept)))
      .map((n: any) => ({
        id: 9000000 + n.id, // Offset ID to avoid collision
        room_no: 'Z-20',
        dept: n.target_dept || 'ALL',
        subject: `[${d.title}] ${n.task}`,
        status: n.started_at ? 'Active' : 'PENDING',
        assigned_to: n.assigned_to_id ? (userName) : 'Unassigned', // Simplifying assigned check
        priority: d.priority,
        checks: [],
        raised_at: d.created_at || new Date().toISOString(),
        picked_up_at: n.started_at,
        secured_at: n.completed_at,
        is_corp_node: true,
        real_directive_id: d.id,
        real_node_id: n.id,
        requires_verification: n.requires_verification
      } as any))
  );

  const hybridMissions = [...missions, ...mappedCorpNodes];

  // 🛡️ CDO FIX: Radar and tasks only active when ON-DUTY
  const radarMissions = hybridMissions.filter(m => 
    m.status !== 'Resolved' && operativeStatus === 'ON-DUTY' && (isGodMode || userRoles.includes(m.dept))
  );
  
  const myMissions = hybridMissions.filter(m => 
    m.assigned_to === userName && m.status !== 'Resolved' && operativeStatus === 'ON-DUTY'
  );

  // Star logic
  let starCount = 0;
  if(operativeStats.missions_count >= 30) starCount = 3;
  else if(operativeStats.missions_count >= 15) starCount = 2;
  else if(operativeStats.missions_count >= 5) starCount = 1;
  const starsDisplay = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);

  return (
    <div style={mainViewport} className={isViewMode ? "zone-view-mode" : ""}>
      <ViewModeBanner />
      
      {/* HUD: IDENTITY CORE */}
      <div style={headerFrame} onClick={() => setView('MY_PROFILE')}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={avatarNeon(operativeStatus === 'ON-DUTY')}>
              {avatarPreview ? <img src={avatarPreview} style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : '👤'}
          </div>
          <div style={{ marginLeft: 'clamp(10px, 3vw, 15px)' }}>
            <h2 style={{ fontSize: 'clamp(16px, 4vw, 18px)', margin: 0, fontFamily: 'Cinzel', color: '#FFF' }}>{userName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '5px 0 0 0' }}>
               <p style={{ fontSize: '9px', color: '#00F2FF', letterSpacing: '2px', margin: 0 }}>ROLE: {operativeRole} | ZONE 17</p>
               <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '1px', padding: '2px 6px', borderRadius: '4px', background: operativeStatus === 'ON-DUTY' ? 'rgba(0,255,136,0.2)' : 'rgba(255,49,49,0.2)', color: operativeStatus === 'ON-DUTY' ? '#00FF88' : '#FF3131' }}>{operativeStatus}</span>
            </div>
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px'}}>
            <div style={radarPulse(isLive)} />
            {missions.length > 0 && !isLive && (
                <button onClick={(e) => { e.stopPropagation(); syncGhostTickets(); }} style={syncVaultBtn}>📡 SYNC</button>
            )}
            {missions.length > 0 && isLive && (
                <button onClick={(e) => { e.stopPropagation(); syncGhostTickets(); }} style={{...syncVaultBtn, borderColor: 'rgba(0,255,136,0.3)', color: '#00FF88'}}>🔄 RE-SYNC</button>
            )}
        </div>
      </div>

      {/* VIEW SWITCHER WITH BADGES */}
      <div style={tabContainer}>
        {/* RADAR tab — red dot when open missions exist */}
        <button onClick={() => setView('RADAR')} style={tabBtn(view === 'RADAR')} id="solve-tab-radar">
          RADAR
          {radarMissions.length > 0 && <span style={missionDot}>{radarMissions.length}</span>}
        </button>

        <button onClick={() => setView('MY_TASKS')} style={tabBtn(view === 'MY_TASKS')} id="solve-tab-tasks">
          MY TASKS
          {myMissions.length > 0 && <span style={{...missionDot, background:'#00F2FF', boxShadow:'0 0 8px #00F2FF'}}>{myMissions.length}</span>}
        </button>

        {/* MY PROFILE — gold shimmer when commission > 0 */}
        <button onClick={() => setView('MY_PROFILE')} id="solve-tab-dna"
          style={{...tabBtn(view === 'MY_PROFILE'), ...(commissionInfo.earned > 0 ? {borderColor:'#D4AF37', boxShadow:'0 0 15px rgba(212,175,55,0.3)'} : {})}}>
          MY PROFILE
          {commissionInfo.earned > 0 && <span style={{...missionDot, background:'#D4AF37', boxShadow:'0 0 8px #D4AF37'}}>💰</span>}
        </button>
      </div>

      <div style={contentBox}>
        {/* VIEW 1: MY MISSIONS (THE WORKBENCH) */}
        {view === 'MY_TASKS' && (
          <div className="fade-in">
            {myMissions.length === 0 && <div style={emptyState}>NO ACTIVE MISSIONS ASSIGNED.</div>}
            
            {myMissions.map(m => (
              <div key={m.id} style={missionCard(m.priority === 'CRITICAL')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={roomBadge}>ROOM {m.room_no}</span>
                  <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'8px', color:'#888'}}>RAISED: {new Date(m.raised_at).toLocaleTimeString()}</div>
                      {m.picked_up_at && <div style={{fontSize:'8px', color:'#00F2FF'}}>PICKUP: {new Date(m.picked_up_at).toLocaleTimeString()}</div>}
                  </div>
                </div>
                
                <h3 style={{ margin: '0 0 25px 0', fontSize: 'clamp(16px, 5vw, 20px)', fontWeight: 900, color: '#FFF' }}>{m.subject}</h3>
                
                {/* SOP CHECKLISTS */}
                <div style={checklistContainer}>
                  {m.checks.map(check => {
                    const isChecked = (completedChecks[m.id] || []).includes(check);
                    return (
                      <label key={check} style={checkItem(isChecked)}>
                        <input 
                          type="checkbox" 
                          onChange={() => {
                            const curr = completedChecks[m.id] || [];
                            const next = isChecked ? curr.filter(c => c !== check) : [...curr, check];
                            setCompletedChecks({...completedChecks, [m.id]: next});
                          }} 
                          checked={isChecked} 
                          style={{ width: '24px', height: '24px', accentColor: '#00FF88' }}
                        />
                        <span style={{ marginLeft: '15px' }}>{check}</span>
                      </label>
                    );
                  })}
                </div>

                {/* 🛡️ THE VISUAL PROOF UPLOADER */}
                <div style={uploadContainer}>
                    <p style={{fontSize: '9px', color: '#D4AF37', margin: '0 0 10px 0', fontWeight: 900, letterSpacing: '1px'}}>📸 REQUIRED: UPLOAD VISUAL PROOF TO HR GALLERY</p>
                    <label style={dropzone}>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleProofChange(m.id, e)} style={{ display: 'none' }} />
                      {previewUrls[m.id] ? (
                          <img src={previewUrls[m.id]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                      ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '32px' }}>📷</span>
                              <span>TAP TO OPEN CAMERA</span>
                          </div>
                      )}
                    </label>
                </div>

                <button 
                  disabled={(completedChecks[m.id] || []).length !== m.checks.length || !proofUploads[m.id]}
                  onClick={() => finalizeMission(m.id)}
                  style={finalizeBtn((completedChecks[m.id] || []).length === m.checks.length && !!proofUploads[m.id])}
                >
                  🏁 SECURE MISSION & SYNC PROOF TO Z-07
                </button>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 2: REGIONAL RADAR (Global Issues) */}
        {view === 'RADAR' && (
          <div className="radar-grid fade-in">
             {radarMissions.length === 0 && <div style={{...emptyState, gridColumn: '1 / -1'}}>RADAR CLEAR. NO ISSUES DETECTED.</div>}
             {radarMissions.map(m => (
               <div key={m.id} style={radarNode(m.priority === 'CRITICAL')}>
                  <div style={{fontSize:'10px', color:'#888', fontWeight: 900, letterSpacing: '1px'}}>ROOM {m.room_no}</div>
                  <div style={{fontSize:'14px', fontWeight:900, color: m.priority === 'CRITICAL' ? '#FF3131' : '#D4AF37', margin: '10px 0'}}>{m.dept} - {m.priority}</div>
                  <div style={{fontSize:'12px', color:'#FFF', marginBottom: '15px', minHeight: '30px'}}>{m.subject}</div>
                  
                  {m.assigned_to === 'Unassigned' ? (
                    <button onClick={() => pickupMission(m.id)} style={pickupBtn}>+ PICKUP MISSION</button>
                  ) : (
                    <div style={{fontSize:'9px', padding: '10px', background: 'rgba(0,242,255,0.1)', color:'#00F2FF', borderRadius: '6px', fontWeight: 900}}>CLAIMED BY: {m.assigned_to.toUpperCase()}</div>
                  )}
               </div>
             ))}
          </div>
        )}

        {/* VIEW 3: MY PROFILE (Duty Lifecycle & ROI Panel) */}
        {view === 'MY_PROFILE' && (
          <div className="fade-in">
            <div style={panel('#D4AF37')}>
              
              {/* DUTY LIFECYCLE CONTROLS (SOVEREIGN HR BRIDGE) */}
              <h3 style={sectionTitle}>🛡️ DUTY TERMINAL</h3>
              <div style={dutyContainer}>
                  {operativeStatus === 'OFFLINE' ? (
                      <button onClick={() => handleDutyAction('START')} style={dutyStartBtn}>
                          <span style={{fontSize: '20px'}}>🟢</span> START DUTY
                      </button>
                  ) : (
                      <div style={dutyActivePanel}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px', color: '#00FF88', fontWeight: 900, letterSpacing: '2px'}}>
                              <div style={radarPulse(true)} /> ON-DUTY ACTIVE
                          </div>
                          {shiftStart && <div style={{fontSize: '10px', color: '#aaa', marginTop: '5px'}}>SHIFT STARTED: {new Date(shiftStart).toLocaleTimeString()}</div>}
                          <button onClick={() => handleDutyAction('END')} style={dutyEndBtn}>
                              <span style={{fontSize: '16px'}}>🔴</span> END SHIFT
                          </button>
                      </div>
                  )}
                  
                  {/* Biometric Clock-In Toggle */}
                  <div style={{...biometricToggleContainer, marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{fontSize: '18px'}}>🔒</span>
                          <div>
                              <div style={{fontWeight: 900, fontSize: '12px', color: '#aaa'}}>BIOMETRIC CLOCK-IN</div>
                              <div style={{fontSize: '9px', color: '#ffcc00'}}>Coming Soon — Awaiting Hardware Install</div>
                          </div>
                      </div>
                      <div style={disabledToggle}></div>
                  </div>
              </div>

              {/* Avatar Management */}
              <div style={avatarManageContainer}>
                  <div style={avatarLarge}>
                      {avatarPreview ? <img src={avatarPreview} style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : '👤'}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                      <label style={uploadAvatarBtn}>
                          + UPLOAD AVATAR
                          <input type="file" accept="image/*" onChange={handleAvatarChange} style={{display:'none'}}/>
                      </label>
                      {avatarPreview && (
                          <button onClick={handleAvatarRemove} style={removeAvatarBtn}>- REMOVE</button>
                      )}
                  </div>
              </div>

              <h3 style={sectionTitle}>💳 MY SOVEREIGN PERFORMANCE</h3>
              
              <div style={dnaStats}>
                <div style={dnaMetric}>
                  <small>STARS</small>
                  <div style={{ color: '#D4AF37', fontSize: '20px' }}>{starsDisplay}</div>
                </div>
                <div style={dnaMetric}>
                  <small>AVG RESPONSE</small>
                  <div style={{ color: operativeStats.avg_response > 30 ? '#FF3131' : '#00FF88' }}>
                      {operativeStats.avg_response} MIN
                      {operativeStats.avg_response > 30 && <div style={qualityBadge}>⚠ QUALITY ALERT</div>}
                  </div>
                </div>
                <div style={dnaMetric}>
                  <small>DUTY HOURS</small>
                  <div style={{ color: '#00F2FF' }}>{operativeStats.monthly_hours.toFixed(1)} HR</div>
                </div>
              </div>

              {/* Financial Section */}
              <div style={financialContainer}>
                  <div style={financialRow}>
                      <span>COMMISSION EARNED</span>
                      <span style={{color: '#00FF88', fontWeight: 900}}>\${commissionInfo.earned.toFixed(2)}</span>
                  </div>
                  {commissionInfo.show_salary && (
                      <div style={financialRow}>
                          <span>BASE SALARY</span>
                          <span style={{color: '#D4AF37', fontWeight: 900}}>\${commissionInfo.salary.toFixed(2)}</span>
                      </div>
                  )}
              </div>

              {/* Payment Request Form */}
              <div style={paymentFormContainer}>
                  <h4 style={{margin: '0 0 15px 0', fontSize: '12px', color: '#D4AF37'}}>💸 INITIATE PAYMENT REQUEST</h4>
                  <form onSubmit={handlePaymentRequest} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                      <input 
                          type="number" 
                          placeholder="Amount ($)" 
                          value={payRequestAmount}
                          onChange={(e) => setPayRequestAmount(e.target.value)}
                          style={payInput}
                          required
                          min="1"
                      />
                      <select 
                          value={payRequestMethod} 
                          onChange={(e) => setPayRequestMethod(e.target.value)}
                          style={payInput}
                      >
                          <option value="BANK">BANK TRANSFER</option>
                          <option value="CASH">CASH (HR DESK)</option>
                      </select>
                      <button type="submit" style={submitPayBtn}>SUBMIT TO ACCOUNTS & FINANCE</button>
                  </form>
              </div>
              
              {/* FM Radio Trigger */}
              <div style={paymentFormContainer}>
                  <h4 style={{margin: '0 0 15px 0', fontSize: '12px', color: '#00F2FF'}}>🎙 SOVEREIGN BROADCAST UNIT</h4>
                  <button 
                    onClick={() => { setRadioVisible(true); setRadioExpanded(true); }}
                    style={{...submitPayBtn, background: radioActive ? 'rgba(0,255,136,0.1)' : 'rgba(0,242,255,0.1)', borderColor: radioActive ? '#00FF88' : '#00F2FF', color: radioActive ? '#00FF88' : '#00F2FF'}}
                  >
                    {radioActive ? '📡 RADIO ACTIVE — OPEN CONSOLE' : '▶ ACTIVATE FM RADIO'}
                  </button>
                  <p style={{fontSize: '8px', color: '#333', textAlign: 'center', marginTop: '10px'}}>Global Singleton: Plays across all panels once activated.</p>
              </div>

              <div style={{marginTop:'30px'}}>
                 <p style={{fontSize:'9px', color:'#555', marginBottom:'15px', fontWeight: 900}}>RECENT SECURED MISSIONS</p>
                 {missions.filter(m => m.status === 'Resolved' && m.assigned_to === userName).map(m => (
                   <div key={m.id} style={historyRow}>
                      <span style={{ color: '#FFF' }}>RM {m.room_no} - {m.subject}</span>
                      <span style={{color:'#00FF88', fontWeight: 900}}>VERIFIED ✓</span>
                   </div>
                 ))}
                 {missions.filter(m => m.status === 'Resolved' && m.assigned_to === userName).length === 0 && (
                     <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '20px' }}>NO RESOLVED MISSIONS ON RECORD</div>
                 )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ╔══════════════════════════════════════════════╗
           ║  🎙 FLOATING NEON FM RADIO WIDGET            ║
           ║  Persistent across all tabs. WiFi + Speaker.  ║
           ╚══════════════════════════════════════════════╝ */}

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes pulse-text { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes eq-bar { from{transform:scaleY(0.2);} to{transform:scaleY(1);} }
        @keyframes missionPulse { 0%{transform:scale(1);} 50%{transform:scale(1.2);} 100%{transform:scale(1);} }
        .radar-grid { display:grid; grid-template-columns:1fr; gap:15px; }
        @media(min-width:768px){.radar-grid{grid-template-columns:1fr 1fr;}}
      `}} />
    </div>
  );
}

// --- SOVEREIGN RETINA STYLES ---
const mainViewport = { padding: 'clamp(10px, 3vw, 20px)', background: 'transparent', minHeight: '100vh', backgroundImage: 'radial-gradient(circle at top, rgba(0,242,255,0.05) 0%, transparent 60%)' };
const headerFrame = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'clamp(10px, 4vw, 20px)', background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.15)', marginBottom: '25px', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', minHeight: '80px' };
const avatarNeon = (live: boolean) => ({ width: 'clamp(40px, 10vw, 50px)', height: 'clamp(40px, 10vw, 50px)', borderRadius: '50%', background: '#000', border: `2px solid ${live ? '#00FF88' : '#FF3131'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: `0 0 15px ${live ? 'rgba(0,255,136,0.3)' : 'rgba(255,49,49,0.3)'}`, overflow: 'hidden' });
const radarPulse = (live: boolean) => ({ width: '12px', height: '12px', borderRadius: '50%', background: live ? '#00FF88' : '#FF3131', boxShadow: `0 0 15px ${live ? '#00FF88' : '#FF3131'}`, animation: live ? 'pulse 2s infinite' : 'none' });

const tabContainer = { display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' as const, paddingBottom: '10px' };
const tabBtn = (active: boolean): React.CSSProperties => ({ position: 'relative', flex: '1 0 auto', minWidth: '90px', minHeight: '48px', padding: '12px 8px', background: active ? 'rgba(212,175,55,0.1)' : 'rgba(20,20,20,0.6)', backdropFilter: 'blur(10px)', color: active ? '#D4AF37' : '#666', border: `1px solid ${active ? '#D4AF37' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', fontWeight: 900, fontSize: '11px', cursor: 'pointer', transition: '0.3s' });
const missionDot: React.CSSProperties = { position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', borderRadius: '9px', background: '#FF3131', boxShadow: '0 0 8px #FF3131', color: '#FFF', fontSize: '9px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'missionPulse 2s infinite' };
const floatingRadio = (active: boolean, expanded: boolean): React.CSSProperties => ({ position: 'fixed', bottom: '90px', right: '15px', zIndex: 999, background: active ? 'rgba(0,5,20,0.97)' : 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)', border: `1px solid ${active ? '#00F2FF' : 'rgba(255,255,255,0.08)'}`, borderRadius: expanded ? '20px' : '50px', boxShadow: active ? '0 0 30px rgba(0,242,255,0.3), 0 0 60px rgba(0,242,255,0.1), inset 0 0 20px rgba(0,242,255,0.05)' : '0 10px 30px rgba(0,0,0,0.8)', width: expanded ? 'clamp(260px, 80vw, 300px)' : 'auto', transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' });
const miniPlayBtn = (active: boolean): React.CSSProperties => ({ width: '32px', height: '32px', borderRadius: '50%', border: `1px solid ${active ? '#FF3131' : '#00F2FF'}`, background: active ? 'rgba(255,49,49,0.15)' : 'rgba(0,242,255,0.15)', color: active ? '#FF3131' : '#00F2FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', transition: '0.2s' });
const contentBox = { paddingBottom: '100px' };
const emptyState = { textAlign: 'center' as const, padding: '50px', color: '#444', fontFamily: 'Cinzel', fontSize: '14px', border: '1px dashed #222', borderRadius: '20px' };

const missionCard = (critical: boolean) => ({ padding: 'clamp(15px, 5vw, 30px)', background: 'rgba(15,15,15,0.9)', backdropFilter: 'blur(15px)', borderRadius: '25px', border: `1px solid rgba(255,255,255,0.05)`, borderLeft: `6px solid ${critical ? '#FF3131' : '#00F2FF'}`, marginBottom: '25px', boxShadow: '0 15px 35px rgba(0,0,0,0.8)' });
const roomBadge = { background: '#D4AF37', color: '#000', padding: '8px 15px', borderRadius: '8px', fontWeight: 900, fontSize: '12px', letterSpacing: '1px' };
const checklistContainer = { background: 'rgba(0,0,0,0.5)', padding: 'clamp(15px, 4vw, 25px)', borderRadius: '15px', marginBottom: '25px', border: '1px solid #1a1a1a' };
const checkItem = (checked: boolean) => ({ display: 'flex', alignItems: 'center', marginBottom: '15px', color: checked ? '#00FF88' : '#AAA', fontSize: '16px', transition: '0.3s', minHeight: '48px', cursor: 'pointer' });

const uploadContainer = { marginBottom: '30px', padding: '20px', background: 'rgba(212,175,55,0.05)', borderRadius: '15px', border: '1px solid rgba(212,175,55,0.2)' };
const dropzone = { height: 'clamp(150px, 30vw, 200px)', border: '2px dashed rgba(212,175,55,0.5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 900, fontSize: '10px', background: 'rgba(0,0,0,0.4)', cursor: 'pointer', overflow: 'hidden' };

const finalizeBtn = (ready: boolean) => ({ width: '100%', minHeight: '60px', padding: '20px', borderRadius: '15px', background: ready ? 'linear-gradient(90deg, #00FF88 0%, #00CC6A 100%)' : 'rgba(0,0,0,0.6)', color: ready ? '#000' : '#444', border: `1px solid ${ready ? '#00FF88' : '#222'}`, fontWeight: 900, cursor: ready ? 'pointer' : 'not-allowed', fontSize: 'clamp(10px, 3vw, 12px)', letterSpacing: '1px', boxShadow: ready ? '0 0 20px rgba(0,255,136,0.4)' : 'none', transition: '0.3s' });

const radarNode = (critical: boolean) => ({ background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '20px', border: `1px solid ${critical ? '#FF3131' : 'rgba(255,255,255,0.05)'}`, textAlign: 'center' as const, boxShadow: critical ? 'inset 0 0 20px rgba(255,49,49,0.1)' : 'none' });
const pickupBtn = { width: '100%', minHeight: '48px', padding: '12px', background: 'rgba(0,242,255,0.1)', color: '#00F2FF', border: '1px solid #00F2FF', borderRadius: '8px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', transition: '0.3s' };

const panel = (c: string) => ({ background: 'rgba(15,15,15,0.9)', backdropFilter: 'blur(15px)', padding: 'clamp(15px, 5vw, 35px)', borderRadius: '25px', border: `1px solid rgba(255,255,255,0.05)`, borderTop: '1px solid rgba(255,255,255,0.15)' });
const sectionTitle = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '18px', marginBottom: '30px', textAlign: 'center' as const, letterSpacing: '2px' };
const dutyContainer = { marginBottom: '30px', padding: '20px', background: 'rgba(0,255,136,0.05)', borderRadius: '15px', border: '1px solid rgba(0,255,136,0.2)' };
const dutyStartBtn = { width: '100%', minHeight: '60px', padding: '15px', borderRadius: '12px', background: 'linear-gradient(90deg, rgba(0,255,136,0.2) 0%, rgba(0,255,136,0.1) 100%)', color: '#00FF88', border: '1px solid #00FF88', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', fontSize: '14px', letterSpacing: '2px', transition: '0.3s' };
const dutyActivePanel = { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '15px' };
const dutyEndBtn = { width: '100%', minHeight: '50px', padding: '15px', borderRadius: '12px', background: 'rgba(255,49,49,0.1)', color: '#FF3131', border: '1px solid #FF3131', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '12px', letterSpacing: '2px', transition: '0.3s' };
const dnaStats = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '10px' };
const dnaMetric = { background: 'rgba(0,0,0,0.6)', padding: '20px 10px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' as const, fontSize: '16px', fontWeight: 900, color: '#FFF', display: 'flex', flexDirection: 'column' as const, gap: '5px' };
const historyRow = { display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', marginBottom: '10px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.05)' };
const syncVaultBtn = { padding: '10px 15px', fontSize: '9px', fontWeight: 900, background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '8px', cursor: 'pointer', letterSpacing: '1px' };

const qualityBadge = { fontSize: '8px', background: 'rgba(255,49,49,0.2)', padding: '2px 5px', borderRadius: '4px', marginTop: '5px' };
const biometricToggleContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '15px', marginBottom: '25px' };
const disabledToggle = { width: '40px', height: '20px', background: '#333', borderRadius: '10px', position: 'relative' as const, opacity: 0.5 };
const avatarManageContainer = { display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: 'rgba(0,0,0,0.5)', borderRadius: '15px', marginBottom: '25px' };
const avatarLarge = { width: '80px', height: '80px', borderRadius: '50%', background: '#111', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', overflow: 'hidden' };
const uploadAvatarBtn = { minHeight: '40px', padding: '10px 15px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' };
const removeAvatarBtn = { minHeight: '40px', padding: '10px 15px', background: 'rgba(255,49,49,0.1)', color: '#FF3131', border: '1px solid #FF3131', borderRadius: '8px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' };
const financialContainer = { marginTop: '25px', padding: '20px', background: 'rgba(0,255,136,0.05)', borderRadius: '15px', border: '1px solid rgba(0,255,136,0.1)' };
const financialRow = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 900, color: '#AAA', marginBottom: '10px' };
const paymentFormContainer = { marginTop: '15px', padding: '20px', background: 'rgba(0,0,0,0.5)', borderRadius: '15px', border: '1px solid #222' };
const payInput = { minHeight: '48px', width: '100%', padding: '15px', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#FFF', fontSize: '14px', boxSizing: 'border-box' as const };
const submitPayBtn = { minHeight: '48px', width: '100%', padding: '15px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '8px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' };
const radioWidgetContainer = (connected: boolean) => ({ marginTop: '25px', padding: '20px', background: connected ? 'rgba(0,242,255,0.05)' : 'rgba(0,0,0,0.5)', borderRadius: '15px', border: `1px solid ${connected ? 'rgba(0,242,255,0.2)' : '#222'}`, transition: '0.3s' });
const radioBtn = (active: boolean) => ({ minHeight: '48px', padding: '10px 20px', background: active ? '#00F2FF' : 'rgba(0,242,255,0.1)', color: active ? '#000' : '#00F2FF', border: `1px solid #00F2FF`, borderRadius: '8px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', transition: '0.3s', flex: 1 });
