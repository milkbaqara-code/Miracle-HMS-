// web/app/dashboard/policy/page.tsx
'use client';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
import React, { useState, useEffect } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';
import ServiceArchitectBOM from '../../components/ServiceArchitectBOM';

export default function PolicyEngineMaster() {
  const { formatMoney, t, currency } = useCurrencyLang();
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const [activeTab, setActiveTab] = useState('BEDS');
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. MASTER ASSET GEOMETRY
  const [unitInventory, setUnitInventory] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // 2. GLOBAL SYSTEM LAWS (Expanded for Feature 4)
  const [globalLaws, setGlobalLaws] = useState({
    noShowPenaltyHours: 48,
    noShowChargeNights: 1,
    serviceChargePct: 10,
    vatPct: 15,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    hotelName: 'Miracle General Hospital & Diagnosis Center',
    yieldRules: [{ occupancyTrigger: 80, priceMultiplier: 1.25 }],
    payrollRules: { overtimeRateMult: 1.5, commCapPct: 5 },
    inventoryRules: { maxWastagePct: 2, shrinkageAlertPct: 5 },
    rateCalendar: [] as any[]
  });

  // 3. DEPARTMENTAL SOP MATRIX
  const [sopMatrix, setSopMatrix] = useState<Record<string, string[]>>({
    EMR: ['Triaging incoming patient admissions', 'Sterilize trauma bay equipment', 'Verify defibrillator battery level'],
    ICU: ['Calibrate patient telemetry monitors', 'Verify life support oxygen pressure', 'Audit ventilator maintenance logs'],
    CL: ['Calibrate diagnostic biochemistry analyzer', 'Run daily control tests for blood counts', 'Audit biohazard waste disposal schedule'],
    OPD: ['Reconcile clinic scheduler queues', 'Verify doctor consulting availability', 'Sanitize consulting desks'],
    IT: ['Verify HL7 integration telemetry', 'Audit clinical database encryption keys', 'Verify PACS imaging server backups'],
    PH: ['Verify temperature logs for vaccine fridges', 'Audit narcotic vault inventory logs', 'Perform expiration date checks'],
    WARD: ['Perform ward round check-ins', 'Log patient vitals to EMR', 'Verify bed occupancy grid status']
  });

  // 4. GM BULK SEED STATE
  const [seedForm, setSeedForm] = useState({ start: 101, end: 150, category: 'ICU BED', rate: 5500 });
  
  // 5. MAINTENANCE LOCK STATE
  const [maintenanceForm, setMaintenanceForm] = useState({ roomId: '', startDate: '', endDate: '', reason: '' });

  // 🛡️ 6. GUEST HUB CMS STATE
  const [offers, setOffers] = useState<any[]>([]);
  const [offerForm, setOfferForm] = useState<{id?: number, category: string, title: string, description: string, image_url: string, price_tag: string, is_active: boolean, is_featured: boolean}>({
    category: 'HEALTH_CHECK', title: '', description: '', image_url: '', price_tag: '', is_active: true, is_featured: false
  });

  // ==========================================
  // 📡 BOOT SEQUENCE: FETCH REALITY FROM DB
  // ==========================================
  useEffect(() => {
    const fetchCurrentLock = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/current-lock`);
        if (res.ok) {
          const data = await res.json();
          if (data.inventory.length > 0) {
            setUnitInventory(data.inventory.map((r: any) => ({
              id: r.room_id, category: r.category, capacity: 2, baseRate: r.base_rate, status: r.is_active ? 'ACTIVE' : 'INACTIVE'
            })));
          }
          if (Object.keys(data.laws).length > 0) {
              setGlobalLaws(prev => ({ ...prev, ...data.laws }));
          }
          if (Object.keys(data.sops).length > 0) setSopMatrix(data.sops);
        }
      } catch (e) {
        console.warn("DB Offline, using local Sovereign Cache.");
        const localUnits = localStorage.getItem('miracle_policy_inventory');
        const localLaws = localStorage.getItem('miracle_global_laws');
        if (localUnits) setUnitInventory(JSON.parse(localUnits));
        if (localLaws) setGlobalLaws(JSON.parse(localLaws));
      }
    };
    const fetchOffers = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/offers`);
        if (res.ok) {
          const data = await res.json();
          setOffers(data.data || []);
        }
      } catch (e) {
        console.warn("Offers Offline.");
      }
    };
    const fetchDepartments = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/synapse/grid/departments`);
        if (res.ok) {
          const data = await res.json();
          setDepartments(data.data || []);
        }
      } catch (e) {
        console.warn("Departments Offline.");
      }
    };
    fetchCurrentLock();
    fetchOffers();
    fetchDepartments();
  }, []);

  // ==========================================
  // 📡 THE KERNEL HANDSHAKE (Atomic Sync)
  // ==========================================
  const commitArchitectureLock = async () => {
    setIsSyncing(true);
    const payload = { unitInventory, globalLaws, sopMatrix, timestamp: new Date().toISOString() };
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      localStorage.setItem('miracle_policy_inventory', JSON.stringify(unitInventory));
      localStorage.setItem('miracle_global_laws', JSON.stringify(globalLaws));

      if (res.ok) showToast('ARCHITECTURE LOCKED', 'success', 'All Resort modules synchronized.');
      else throw new Error("Sync Failed");
    } catch (e) {
      showToast('LOCAL LOCK ACTIVE', 'warning', 'Kernel stored in Sovereign Cache. Database sync pending...');
    } finally { setIsSyncing(false); }
  };

  const executeBulkSeed = async () => {
    const confirmed = await showConfirm('WARNING: BULK SEED', `This will instantly forge ${seedForm.end - seedForm.start + 1} physical assets in the database. Proceed?`);
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      const payload = { blueprints: [{ start_number: seedForm.start, end_number: seedForm.end, category: seedForm.category, baseRate: seedForm.rate }] };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/gm-bulk-seed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { showToast('MASS SEED COMPLETE', 'success', 'Assets locked into grid.'); window.location.reload(); }
      else throw new Error();
    } catch (e) { showToast('MASS SEED FAILED', 'error', 'Check connection to Master Kernel.'); } finally { setIsSyncing(false); }
  };

  const executeMaintenanceLock = async () => {
    if (!maintenanceForm.roomId || !maintenanceForm.startDate || !maintenanceForm.reason) {
      showToast('VALIDATION ERROR', 'warning', 'Fill all required fields.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/maintenance-lock`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: maintenanceForm.roomId, start_date: maintenanceForm.startDate, end_date: maintenanceForm.endDate, reason: maintenanceForm.reason })
      });
      if (res.ok) { showToast('MAINTENANCE LOCK ENGAGED', 'success', 'Bed locked and stripped from active occupancy.'); setMaintenanceForm({ roomId: '', startDate: '', endDate: '', reason: '' }); }
      else showToast('GRID ERROR', 'error', 'Bed ID not found in active Ward Grid.');
    } catch (e) { showToast('LOCK FAILED', 'error', 'Could not engage maintenance lock.'); } finally { setIsSyncing(false); }
  };

  const spawnSopTicket = async (dept: string, task: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/spawn-ticket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dept, task, priority: 'NORMAL', room_id: 'GENERAL' })
      });
      if (res.ok) showToast('ISSUE TICKET SPAWNED', 'success', `${dept}: ${task}`);
    } catch (e) { showToast('TICKET CREATION FAILED', 'error', 'Could not reach backend.'); }
  };

  const saveOffer = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm)
      });
      if (res.ok) {
        showToast('CONTENT LOCKED', 'success', 'Synced to Patient Portal.');
        setOfferForm({ category: 'HEALTH_CHECK', title: '', description: '', image_url: '', price_tag: '', is_active: true, is_featured: false });
        // Refresh
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/offers`);
        const json = await r.json();
        setOffers(json.data || []);
      }
    } catch (e) {
      showToast('CMS PUSH FAILED', 'error', 'Could not sync content to Patient Portal.');
    } finally { setIsSyncing(false); }
  };

  const purgeOffer = async (id: number) => {
    const confirmed = await showConfirm('PURGE CONTENT', 'Remove this content from Patient Portal permanently?');
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/offers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOffers(offers.filter(o => o.id !== id));
      }
    } catch (e) { showToast('PURGE FAILED', 'error', 'Could not remove content.'); } finally { setIsSyncing(false); }
  };

  const updateUnit = (index: number, field: string, value: any) => {
    const updated = [...unitInventory];
    updated[index] = { ...updated[index], [field]: value };
    setUnitInventory(updated);
  };

  const updateGlobalLaw = (field: string, subfield: string|null, value: any) => {
      setGlobalLaws(prev => {
          if (subfield) {
              return { ...prev, [field]: { ...(prev as any)[field], [subfield]: value } };
          }
          return { ...prev, [field]: value };
      });
  };

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={containerStyle}>
      <ViewModeBanner />
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>⚙️ GLOBAL CLINICAL POLICY KERNEL</h1>
          <div style={subTitleStyle}>ZONE 19 | MASTER DATA MANAGEMENT (MDM) | v68.0-HARD-LOCK</div>
        </div>
        <button onClick={commitArchitectureLock} disabled={isSyncing} style={lockBtnStyle(isSyncing)}>
          {isSyncing ? '📡 SYNCING...' : '🔒 COMMIT ARCHITECTURE LOCK'}
        </button>
      </div>

      <div className="hide-scroll" style={tabBar}>
        {['WARD_ARCHITECT', 'BEDS', 'CLINICAL_DEPARTMENTS', 'CLINICAL_LAWS', 'SURGE_&_EMERGENCY_RATES', 'PATIENT_PORTAL_CMS', 'CLINICAL_SOPS', 'DECONTAMINATION', 'SEED_ENGINE'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={tabBtn(activeTab === t)}>{t.replace(/_/g, ' ')}</button>
        ))}
      </div>

      <div style={contentWrapper}>
        
        {/* TAB 0: PMS ARCHITECT */}
        {activeTab === 'WARD_ARCHITECT' && (
          <div className="fade-in">
             <ServiceArchitectBOM department="Clinical Ward & Bed Types" zonePrefix="Z-19" primaryColor="gold" />
          </div>
        )}

        {/* TAB 1: UNITS */}
        {activeTab === 'BEDS' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
              <h3 style={sectionTitle}>🏗️ PHYSICAL BED & WARD INVENTORY ({unitInventory.length})</h3>
              <button style={miniBtn} onClick={() => setUnitInventory([...unitInventory, { id: 'NEW', category: 'ICU BED', capacity: 2, baseRate: 5500, status: 'ACTIVE' }])}>+ ADD SINGLE BED</button>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }} className="hide-scroll">
              <table style={tableStyle}>
                <thead style={{ position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
                  <tr style={headerRow}><th>ID</th><th>CATEGORY (FREE TEXT)</th><th>CAPACITY</th><th>BASE RATE ({currency})</th><th>STATUS</th></tr>
                </thead>
                <tbody>
                  {unitInventory.map((room, i) => (
                    <tr key={i} style={dataRow}>
                      <td><input style={ghostInput} value={room.id} onChange={(e) => updateUnit(i, 'id', e.target.value)} /></td>
                      {/* FIX: Free text input instead of locked dropdown */}
                      <td><input style={ghostInput} value={room.category} onChange={(e) => updateUnit(i, 'category', e.target.value.toUpperCase())} placeholder="e.g. ICU BED / PRIVATE ROOM" /></td>
                      <td><input type="number" style={ghostInput} value={room.capacity} onChange={(e) => updateUnit(i, 'capacity', Number(e.target.value))} /></td>
                      <td><input type="number" style={ghostInput} value={room.baseRate} onChange={(e) => updateUnit(i, 'baseRate', Number(e.target.value))} /></td>
                      <td style={{ color: '#00FF88', fontSize: '10px', fontWeight: 900 }}>
                        <select style={{...selectStyle, color: '#00FF88', border: 'none', background: 'transparent'}} value={room.status} onChange={(e) => updateUnit(i, 'status', e.target.value)}>
                          <option>ACTIVE</option><option>INACTIVE</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 1.5: VIRTUAL ZONES (DEPARTMENTS) */}
        {activeTab === 'CLINICAL_DEPARTMENTS' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
              <h3 style={sectionTitle}>🏢 🏥 CLINICAL & HOSPITAL DEPARTMENTS (VIRTUAL ZONES)</h3>
              <button style={miniBtn} onClick={() => {
                const newDept = { code: 'NEW', name: 'New Department', category: 'DEPARTMENT', icon_code: '🏢', signal_color: 'cyan' };
                setDepartments([...departments, newDept]);
              }}>+ ADD DEPARTMENT</button>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }} className="hide-scroll">
              <table style={tableStyle}>
                <thead style={{ position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
                  <tr style={headerRow}><th>CODE</th><th>NAME</th><th>CATEGORY</th><th>ICON</th><th>NEON COLOR</th><th>ACTIONS</th></tr>
                </thead>
                <tbody>
                  {departments.map((dept, i) => (
                    <tr key={i} style={dataRow}>
                      <td><input style={ghostInput} value={dept.code} onChange={(e) => {
                        const updated = [...departments]; updated[i].code = e.target.value.toUpperCase(); setDepartments(updated);
                      }} /></td>
                      <td><input style={ghostInput} value={dept.name} onChange={(e) => {
                        const updated = [...departments]; updated[i].name = e.target.value; setDepartments(updated);
                      }} /></td>
                      <td>
                        <select style={selectStyle} value={dept.category} onChange={(e) => {
                          const updated = [...departments]; updated[i].category = e.target.value; setDepartments(updated);
                        }}>
                          <option value="DEPARTMENT">DEPARTMENT — Cyan</option>
                          <option value="OPERATIONAL">OPERATIONAL — Purple</option>
                          <option value="EXECUTIVE">EXECUTIVE — Gold</option>
                        </select>
                      </td>
                      <td><input style={{...ghostInput, width: '40px'}} value={dept.icon_code} onChange={(e) => {
                        const updated = [...departments]; updated[i].icon_code = e.target.value; setDepartments(updated);
                      }} /></td>
                      <td>
                        <select style={{...selectStyle, color: dept.signal_color}} value={dept.signal_color} onChange={(e) => {
                          const updated = [...departments]; updated[i].signal_color = e.target.value; setDepartments(updated);
                        }}>
                          <option value="cyan">CYAN</option><option value="magenta">MAGENTA</option><option value="yellow">YELLOW</option><option value="emerald">EMERALD</option><option value="amber">AMBER</option><option value="rose">ROSE</option>
                        </select>
                      </td>
                      <td>
                        <button style={{background:'transparent', border:'1px solid #00F2FF', color:'#00F2FF', padding:'5px 10px', fontSize:'9px', cursor:'pointer', marginRight:'10px', borderRadius:'4px'}} onClick={async () => {
                          setIsSyncing(true);
                          try {
                            const method = dept.id ? 'PUT' : 'POST';
                            const url = dept.id ? `/synapse/grid/departments/${dept.code}` : `/synapse/grid/departments`;
                            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
                            const res = await fetch(`${baseUrl}${url}`, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(dept) });
                            if (res.ok) showToast('MATRIX UPDATED', 'success', 'Department saved.');
                            else showToast('MATRIX UPDATE FAILED', 'error', 'Backend rejected update.');
                          } catch (e) { showToast('NETWORK ERROR', 'error', 'Could not reach backend.'); }
                          setIsSyncing(false);
                        }}>SAVE</button>
                        <button style={{background:'transparent', border:'none', color:'#FF3131', padding:'5px', fontSize:'12px', cursor:'pointer'}} onClick={async () => {
                          const confirmed = await showConfirm('PURGE TILE', 'Remove this department from the grid?');
                          if (!confirmed) return;
                          if (dept.id) {
                            setIsSyncing(true);
                            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
                            await fetch(`${baseUrl}/synapse/grid/departments/${dept.code}`, { method: 'DELETE' });
                            setIsSyncing(false);
                          }
                          setDepartments(departments.filter((_, idx) => idx !== i));
                        }}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: GLOBAL LAW */}
        {activeTab === 'CLINICAL_LAWS' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div style={panel('#FF3131')}>
              <h4 style={panelTitle('#FF3131')}>🛡️ ADMISSION & CANCELLATION PENALTY LAWS</h4>
              <div style={ruleRow}><span>No-Show / Late Admission Window:</span> <b>{globalLaws.noShowPenaltyHours} Hours</b></div>
              <div style={ruleRow}><span>Administration Fee:</span> <b>{globalLaws.serviceChargePct}%</b></div>
              <div style={ruleRow}><span>Clinical Tax / VAT:</span> <b>{globalLaws.vatPct}%</b></div>
              <div style={{ marginTop: '20px' }}>
                <label style={labelStyle}>ADJUST NO-SHOW WINDOW (HOURS)</label>
                <input type="range" min="12" max="72" value={globalLaws.noShowPenaltyHours} onChange={(e) => updateGlobalLaw('noShowPenaltyHours', null, Number(e.target.value))} style={{width: '100%'}} />
              </div>
            </div>

            <div style={panel('#00F2FF')}>
              <h4 style={panelTitle('#00F2FF')}>🕒 ADMISSION & DISCHARGE HOURS</h4>
              <div style={ruleRow}><span>Standard Admission Time:</span> <input type="time" style={timeInput} value={globalLaws.checkInTime} onChange={(e)=>updateGlobalLaw('checkInTime', null, e.target.value)} /></div>
              <div style={ruleRow}><span>Standard Discharge Time:</span> <input type="time" style={timeInput} value={globalLaws.checkOutTime} onChange={(e)=>updateGlobalLaw('checkOutTime', null, e.target.value)} /></div>
              
              <div style={{ marginTop: '20px' }}>
                <label style={labelStyle}>DYNAMIC CLINICAL FACILITY NAME</label>
                <input style={{...ghostInput, borderBottom: '1px solid #00F2FF'}} value={globalLaws.hotelName} onChange={(e)=>updateGlobalLaw('hotelName', null, e.target.value)} placeholder="e.g. Miracle Hospital" />
              </div>
            </div>

            <div style={panel('#D4AF37')}>
              <h4 style={panelTitle('#D4AF37')}>👥 PAYROLL & HR POLICIES</h4>
              <div style={ruleRow}><span>Overtime Rate Multiplier:</span> <input type="number" step="0.1" style={{...ghostInput, width: '60px', borderBottom: '1px solid #D4AF37'}} value={globalLaws.payrollRules.overtimeRateMult} onChange={(e)=>updateGlobalLaw('payrollRules', 'overtimeRateMult', Number(e.target.value))} /> x</div>
              <div style={ruleRow}><span>Commission Hard Cap:</span> <input type="number" style={{...ghostInput, width: '60px', borderBottom: '1px solid #D4AF37'}} value={globalLaws.payrollRules.commCapPct} onChange={(e)=>updateGlobalLaw('payrollRules', 'commCapPct', Number(e.target.value))} /> %</div>
            </div>

            <div style={panel('#00FF88')}>
              <h4 style={panelTitle('#00FF88')}>📦 INVENTORY POLICIES</h4>
              <div style={ruleRow}><span>Max Auto-Wastage Auth:</span> <input type="number" style={{...ghostInput, width: '60px', borderBottom: '1px solid #00FF88'}} value={globalLaws.inventoryRules.maxWastagePct} onChange={(e)=>updateGlobalLaw('inventoryRules', 'maxWastagePct', Number(e.target.value))} /> %</div>
              <div style={ruleRow}><span>Shrinkage Alert Threshold:</span> <input type="number" style={{...ghostInput, width: '60px', borderBottom: '1px solid #00FF88'}} value={globalLaws.inventoryRules.shrinkageAlertPct} onChange={(e)=>updateGlobalLaw('inventoryRules', 'shrinkageAlertPct', Number(e.target.value))} /> %</div>
            </div>
          </div>
        )}

        {/* TAB 3: YIELD & RATES */}
        {activeTab === 'SURGE_&_EMERGENCY_RATES' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div style={panel('#00FF88')}>
              <h4 style={panelTitle('#00FF88')}>📈 🏥 EMERGENCY & SURGE RATE ADJUSTMENTS</h4>
              <p style={{fontSize: '11px', color: '#888', marginBottom: '25px', lineHeight: '1.6'}}>
                Configure algorithmic pricing adjustments. When building occupancy hits the threshold, Base Rates are automatically multiplied to maximize revenue.
              </p>
              <div style={ruleRow}>
                <span>Occupancy Trigger Threshold:</span> 
                <input type="number" style={{...ghostInput, width: '80px', borderBottom: '1px solid #00FF88', textAlign: 'right'}} value={globalLaws.yieldRules[0]?.occupancyTrigger || 80} onChange={(e)=>{
                    const newRules = [...globalLaws.yieldRules];
                    if (!newRules[0]) newRules[0] = { occupancyTrigger: 80, priceMultiplier: 1.25 };
                    newRules[0].occupancyTrigger = Number(e.target.value);
                    updateGlobalLaw('yieldRules', null, newRules);
                }} /> %
              </div>
              <div style={ruleRow}>
                <span>High-Demand Price Multiplier:</span> 
                <input type="number" step="0.1" style={{...ghostInput, width: '80px', borderBottom: '1px solid #00FF88', textAlign: 'right'}} value={globalLaws.yieldRules[0]?.priceMultiplier || 1.25} onChange={(e)=>{
                    const newRules = [...globalLaws.yieldRules];
                    if (!newRules[0]) newRules[0] = { occupancyTrigger: 80, priceMultiplier: 1.25 };
                    newRules[0].priceMultiplier = Number(e.target.value);
                    updateGlobalLaw('yieldRules', null, newRules);
                }} /> x
              </div>
            </div>

            <div style={panel('#9D00FF')}>
              <h4 style={panelTitle('#9D00FF')}>🗓️ SEASONAL RATE CALENDAR (OVERRIDES)</h4>
              <p style={{fontSize: '11px', color: '#888', marginBottom: '25px', lineHeight: '1.6'}}>
                Define strict periods (e.g., epidemic events, high-occupancy surges) where bed base rates are adjusted.
              </p>
              {globalLaws.rateCalendar.map((rc, idx) => (
                  <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <input type="date" value={rc.start} onChange={(e)=>{
                          const cl = [...globalLaws.rateCalendar]; cl[idx].start = e.target.value; updateGlobalLaw('rateCalendar', null, cl);
                      }} style={timeInput} />
                      <input type="date" value={rc.end} onChange={(e)=>{
                          const cl = [...globalLaws.rateCalendar]; cl[idx].end = e.target.value; updateGlobalLaw('rateCalendar', null, cl);
                      }} style={timeInput} />
                      <input type="number" step="0.1" value={rc.multiplier} onChange={(e)=>{
                          const cl = [...globalLaws.rateCalendar]; cl[idx].multiplier = Number(e.target.value); updateGlobalLaw('rateCalendar', null, cl);
                      }} style={{...ghostInput, width: '50px', borderBottom: '1px solid #9D00FF'}} /> x
                      <button onClick={()=>{
                          const cl = [...globalLaws.rateCalendar]; cl.splice(idx, 1); updateGlobalLaw('rateCalendar', null, cl);
                      }} style={{background:'transparent', border:'none', color:'#FF3131', cursor:'pointer'}}>X</button>
                  </div>
              ))}
              <button style={miniBtn} onClick={() => {
                  const cl = [...globalLaws.rateCalendar, { start: '', end: '', multiplier: 1.5 }];
                  updateGlobalLaw('rateCalendar', null, cl);
              }}>+ ADD SEASONAL BLOCK</button>
            </div>
          </div>
        )}

        {/* TAB 4: GUEST MARKETING CMS */}
        {activeTab === 'PATIENT_PORTAL_CMS' && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 2fr', gap: '40px' }}>
             {/* CMS EDITOR */}
             <div style={panel('#00F2FF')}>
                <h4 style={panelTitle('#00F2FF')}>🖋️ PATIENT PORTAL: WELLNESS & EDUCATION CMS</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div>
                      <label style={labelStyle}>CONTENT CATEGORY</label>
                      <select style={selectStyle} value={offerForm.category} onChange={e=>setOfferForm({...offerForm, category: e.target.value})}>
                         <option>HEALTH_CHECK</option><option>DIET_PLAN</option><option>PHYSIO_THERAPY</option><option>TELE_CONSULT</option><option>WARD_UPGRADE</option>
                      </select>
                   </div>
                   <div>
                      <label style={labelStyle}>TITLE</label>
                      <input style={{...ghostInput, borderBottom: '1px solid #333'}} value={offerForm.title} onChange={e=>setOfferForm({...offerForm, title: e.target.value})} placeholder="Title of the offer..." />
                   </div>
                   <div>
                      <label style={labelStyle}>PRICE TAG (DISPLAY ONLY)</label>
                      <input style={{...ghostInput, borderBottom: '1px solid #333'}} value={offerForm.price_tag} onChange={e=>setOfferForm({...offerForm, price_tag: e.target.value})} placeholder="e.g. $2,500 nett" />
                   </div>
                   <div>
                      <label style={labelStyle}>IMAGE URL</label>
                      <input style={{...ghostInput, borderBottom: '1px solid #333'}} value={offerForm.image_url} onChange={e=>setOfferForm({...offerForm, image_url: e.target.value})} placeholder="https://image-host.com/promo.jpg" />
                   </div>
                   <div>
                      <label style={labelStyle}>DESCRIPTION</label>
                      <textarea style={{...ghostInput, border: '1px solid #222', borderRadius: '10px', height: '100px', padding: '10px'}} value={offerForm.description} onChange={e=>setOfferForm({...offerForm, description: e.target.value})} placeholder="Details of the offer..." />
                   </div>
                   <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', cursor: 'pointer' }}>
                         <input type="checkbox" checked={offerForm.is_active} onChange={e=>setOfferForm({...offerForm, is_active: e.target.checked})} /> LIVE ON HUB
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', cursor: 'pointer' }}>
                         <input type="checkbox" checked={offerForm.is_featured} onChange={e=>setOfferForm({...offerForm, is_featured: e.target.checked})} /> FEATURED
                      </label>
                   </div>
                   <button onClick={saveOffer} style={{ padding: '16px', background: '#00F2FF', color: '#000', fontWeight: 900, borderRadius: '12px', border: 'none', cursor: 'pointer', marginTop: '10px' }}>
                      {offerForm.id ? 'UPDATE CONTENT' : 'PUSH TO PATIENT PORTAL'}
                   </button>
                   {offerForm.id && <button onClick={()=>setOfferForm({category: 'HEALTH_CHECK', title: '', description: '', image_url: '', price_tag: '', is_active: true, is_featured: false})} style={{ color: '#888', background: 'transparent', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Cancel Edit</button>}
                </div>
             </div>

             {/* CMS LIVE PREVIEW / LIST */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={sectionTitle}>📡 LIVE PATIENT PORTAL FEED ({offers.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                   {offers.map(offer => (
                      <div key={offer.id} style={{ ...panel('#333'), padding: '20px', position: 'relative' }}>
                         <div style={{ height: '150px', backgroundImage: `url(${offer.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '15px', marginBottom: '15px', background: '#111' }}>
                            {!offer.image_url && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>NO IMAGE</div>}
                         </div>
                         {offer.is_featured && <span style={{ position: 'absolute', top: '30px', right: '30px', background: '#D4AF37', color: '#000', fontSize: '8px', fontWeight: 900, padding: '4px 8px', borderRadius: '4px' }}>FEATURED</span>}
                         <div style={{ fontSize: '9px', color: '#00F2FF', fontWeight: 900, marginBottom: '5px' }}>{offer.category}</div>
                         <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '10px', color: offer.is_active ? '#FFF' : '#444' }}>{offer.title}</div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: '#D4AF37', fontWeight: 900 }}>{offer.price_tag}</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                               <button onClick={()=>setOfferForm(offer)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>EDIT</button>
                               <button onClick={()=>purgeOffer(offer.id)} style={{ background: 'transparent', border: 'none', color: '#FF3131', cursor: 'pointer', fontSize: '11px' }}>PURGE</button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* TAB 4: SOP MATRIX (FULLY EDITABLE) */}
        {activeTab === 'CLINICAL_SOPS' && (
            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                <div style={{gridColumn: '1/-1', marginBottom: '10px'}}>
                   <span style={{color: '#888', fontSize: '11px', marginRight: '20px'}}>SOPs are directly linked to Virtual Zones. Use the 'Clinical Departments' tab to manage Departments.</span>
                   <select style={{...selectStyle, width: '200px', display: 'inline-block'}} onChange={(e) => {
                       if(e.target.value && !sopMatrix[e.target.value]) {
                           setSopMatrix({...sopMatrix, [e.target.value]: ['New Task']});
                       }
                   }}>
                       <option value="">+ ADD SOP FOR DEPT</option>
                       {departments.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                   </select>
                </div>
                {Object.entries(sopMatrix).map(([dept, tasks]) => (
                    <div key={dept} style={panel('#D4AF37')}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: '1px solid rgba(212,175,55,0.2)', marginBottom: '15px', paddingBottom: '10px'}}>
                            <input style={{...panelTitle('#D4AF37'), borderBottom:'none', marginBottom:0, paddingBottom:0, background:'transparent', outline:'none', width:'50%'}} value={dept} 
                                onChange={(e) => {
                                    const newSop = {...sopMatrix};
                                    newSop[e.target.value.toUpperCase()] = newSop[dept];
                                    delete newSop[dept];
                                    setSopMatrix(newSop);
                                }} 
                            />
                            <button onClick={()=>{
                                const newSop = {...sopMatrix}; delete newSop[dept]; setSopMatrix(newSop);
                            }} style={{background:'transparent', border:'1px solid #FF3131', color:'#FF3131', borderRadius:'4px', fontSize:'9px', cursor:'pointer'}}>DEL DEPT</button>
                        </div>
                        
                        {tasks.map((task, idx) => (
                            <div key={idx} style={{...taskItem, alignItems: 'center'}}>
                                <span>●</span> 
                                <input style={{...ghostInput, padding: '5px', fontSize: '12px'}} value={task} onChange={(e)=>{
                                    const newTasks = [...tasks]; newTasks[idx] = e.target.value; setSopMatrix({...sopMatrix, [dept]: newTasks});
                                }} />
                                <button onClick={()=>spawnSopTicket(dept, task)} style={{background:'rgba(0,242,255,0.1)', border:'1px solid #00F2FF', color:'#00F2FF', fontSize:'8px', padding:'4px 8px', borderRadius:'4px', cursor:'pointer', whiteSpace: 'nowrap'}}>SPAWN TICKET</button>
                                <button onClick={()=>{
                                    const newTasks = [...tasks]; newTasks.splice(idx,1); setSopMatrix({...sopMatrix, [dept]: newTasks});
                                }} style={{background:'transparent', border:'none', color:'#FF3131', cursor:'pointer', fontSize:'14px'}}>×</button>
                            </div>
                        ))}
                        <button style={{...miniBtn, marginTop: '10px', fontSize:'9px'}} onClick={()=>{
                            setSopMatrix({...sopMatrix, [dept]: [...tasks, 'New Task']});
                        }}>+ ADD TASK</button>
                    </div>
                ))}
            </div>
        )}

        {/* TAB 5: MAINTENANCE LOCK */}
        {activeTab === 'DECONTAMINATION' && (
          <div className="fade-in" style={panel('#F59E0B')}>
            <h4 style={panelTitle('#F59E0B')}>🧼 DECONTAMINATION & BED STERILIZATION LOCK</h4>
            <p style={{fontSize: '11px', color: '#888', lineHeight: '1.6', marginBottom: '25px'}}>
              Schedule hard-locks on specific grid zones. Beds placed in Decontamination/Maintenance will be locked and stripped from active occupancy assignment to prevent accidental guest assignment and will spawn a tracking ticket.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>TARGET BED ID</label>
                <input style={{...ghostInput, borderBottom: '1px solid #F59E0B'}} placeholder="e.g. 105" value={maintenanceForm.roomId} onChange={e=>setMaintenanceForm({...maintenanceForm, roomId: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label style={labelStyle}>DECONTAMINATION / STERILIZATION REASON (Becomes Ticket Subject)</label>
                <input style={{...ghostInput, borderBottom: '1px solid #F59E0B'}} placeholder="e.g. HVAC Refit" value={maintenanceForm.reason} onChange={e=>setMaintenanceForm({...maintenanceForm, reason: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>LOCK START DATE</label>
                <input type="date" style={timeInput} value={maintenanceForm.startDate} onChange={e=>setMaintenanceForm({...maintenanceForm, startDate: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>LOCK END DATE</label>
                <input type="date" style={timeInput} value={maintenanceForm.endDate} onChange={e=>setMaintenanceForm({...maintenanceForm, endDate: e.target.value})} />
              </div>
            </div>

            <button onClick={executeMaintenanceLock} disabled={isSyncing} style={{ padding: '15px', background: 'rgba(245,158,11,0.2)', border: '1px solid #F59E0B', color: '#F59E0B', fontWeight: 900, borderRadius: '10px', cursor: 'pointer', fontSize: '11px', letterSpacing: '2px', width: '100%' }}>
              {isSyncing ? 'LOCKING...' : '🧼 ENGAGE DECONTAMINATION HARD-LOCK'}
            </button>
          </div>
        )}

        {/* TAB 6: SEED (GM MASS PROVISIONING) */}
        {activeTab === 'SEED_ENGINE' && (
          <div className="fade-in" style={panel('#FFB800')}>
            <h4 style={panelTitle('#FFB800')}>🧬 CLINICAL GRID SEED ENGINE (SYSTEM KERNEL USE ONLY)</h4>
            <p style={{fontSize: '11px', color: '#888', marginBottom: '25px', lineHeight: '1.6'}}>
              Instantly forge hundreds of physical assets. The Kernel will mathematically generate IDs from Start to End. 
              <strong> WARNING: This executes a direct SQL UPSERT.</strong>
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div>
                <label style={labelStyle}>STARTING BED NUMBER</label>
                <input type="number" value={seedForm.start} onChange={(e)=>setSeedForm({...seedForm, start: Number(e.target.value)})} style={{...ghostInput, borderBottom: '1px solid #333'}} />
              </div>
              <div>
                <label style={labelStyle}>ENDING BED NUMBER</label>
                <input type="number" value={seedForm.end} onChange={(e)=>setSeedForm({...seedForm, end: Number(e.target.value)})} style={{...ghostInput, borderBottom: '1px solid #333'}} />
              </div>
              <div>
                <label style={labelStyle}>APPLY CATEGORY (FREE TEXT OR SELECT)</label>
                <input style={{...ghostInput, borderBottom: '1px solid #333'}} value={seedForm.category} onChange={(e)=>setSeedForm({...seedForm, category: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label style={labelStyle}>BASE RATE ({currency})</label>
                <input type="number" value={seedForm.rate} onChange={(e)=>setSeedForm({...seedForm, rate: Number(e.target.value)})} style={{...ghostInput, borderBottom: '1px solid #333'}} />
              </div>
            </div>

            <button onClick={executeBulkSeed} disabled={isSyncing} style={{ padding: '20px', background: '#FFB800', color: '#000', fontWeight: 900, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', letterSpacing: '2px', width: '100%' }}>
              {isSyncing ? 'FORGING ASSETS...' : '🧬 INITIATE SYSTEM SEEDING'}
            </button>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .hide-scroll::-webkit-scrollbar { display: none; }
        input[type="range"] { accent-color: #D4AF37; }
      `}} />
    </div>
  );
}

// --- SOVEREIGN STYLES ---
const containerStyle = { padding: '40px 20px', maxWidth: '1750px', margin: '0 auto', minHeight: '100vh', background: 'transparent', color: '#FFF' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #222', paddingBottom: '30px', marginBottom: '40px' };
const lockBtnStyle = (syncing: boolean) => ({ padding: '16px 32px', background: syncing ? '#222' : 'linear-gradient(45deg, #D4AF37, #AA8529)', color: '#000', fontWeight: 900, border: 'none', borderRadius: '12px', cursor: syncing ? 'not-allowed' : 'pointer', fontSize: '11px', letterSpacing: '1px', boxShadow: syncing ? 'none' : '0 0 30px rgba(212,175,55,0.2)' });
const titleStyle = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '32px', letterSpacing: '4px', margin: 0 };
const subTitleStyle = { color: '#00F2FF', fontSize: '9px', fontWeight: 900, letterSpacing: '2px', marginTop: '10px' };
const tabBar = { display: 'flex', gap: '10px', marginBottom: '30px', overflowX: 'auto' as const };
const tabBtn = (active: boolean) => ({ background: active ? '#D4AF37' : 'rgba(255,255,255,0.02)', color: active ? '#000' : '#666', border: active ? 'none' : '1px solid #222', padding: '14px 28px', borderRadius: '10px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', transition: '0.3s', textTransform: 'uppercase' as any });
const contentWrapper = { background: 'rgba(255,255,255,0.01)', borderRadius: '30px', padding: '40px', border: '1px solid #111' };
const panel = (c: string) => ({ background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '25px', border: `1px solid ${c}33` });
const panelTitle = (c: string) => ({ color: c, fontFamily: 'Cinzel', marginBottom: '25px', fontSize: '14px', borderBottom: `1px solid ${c}22`, paddingBottom: '12px' });
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const };
const headerRow = { textAlign: 'left' as const, color: '#444', fontSize: '10px', borderBottom: '1px solid #222', paddingBottom: '10px' };
const dataRow = { borderBottom: '1px solid #111' };
const ghostInput = { background: 'transparent', border: 'none', color: '#FFF', padding: '15px 5px', fontSize: '13px', outline: 'none', width: '100%' };
const selectStyle = { background: '#0a0a0a', color: '#D4AF37', border: '1px solid #222', padding: '10px', borderRadius: '6px', fontSize: '11px', outline: 'none', width: '100%' };
const sectionTitle = { color: '#FFF', fontFamily: 'Cinzel', fontSize: '20px', margin: 0 };
const miniBtn = { background: 'transparent', border: '1px solid #00F2FF', color: '#00F2FF', padding: '10px 20px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' };
const ruleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', fontSize: '14px' };
const labelStyle = { display: 'block', fontSize: '9px', color: '#666', fontWeight: 900, marginBottom: '12px', letterSpacing: '1px' };
const timeInput = { background: '#111', border: '1px solid #222', color: '#00F2FF', padding: '8px', borderRadius: '6px', outline: 'none', fontFamily: 'monospace' };
const taskItem = { fontSize: '12px', color: '#AAA', marginBottom: '12px', display: 'flex', gap: '15px' };
