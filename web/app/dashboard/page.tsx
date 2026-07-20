// web/app/dashboard/page.tsx
'use client';
import { useCurrencyLang } from '../components/CurrencyLangContext';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalSync } from '../context/GlobalSyncContext'; // Iron Law 31
import WeatherCorner from '../components/WeatherCorner';
import ToolbarDock from '../components/ToolbarDock';

import ViewModeBanner, { useViewMode } from '../components/ViewModeBanner';
import { VitalsModal, ConsultDesk, PharmacyQueue, ADTTransferModal, InsuranceSplitModal } from '../components/ClinicalOverlays';
import OPDScheduler from '../components/OPDScheduler';
import DiagnosticsHub from '../components/DiagnosticsHub';
export default function MasterCommandGrid() {
  const isViewMode = useViewMode();
  const { formatMoney, t, currency } = useCurrencyLang();

  const [rooms, setRooms] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ALARMS' | 'DIRTY' | 'MAINTENANCE'>('ALL');
  const [isSyncing, setIsSyncing] = useState(true);
  const router = useRouter();
  const { syncPulse, globalGridState } = useGlobalSync();

  // 🛡️ RAW VAULT STATES FOR 60FPS MEMOIZATION
  const [rawGrid, setRawGrid] = useState<any[]>([]);
  const [rawFolios, setRawFolios] = useState<any[]>([]);
  const [rawMissions, setRawMissions] = useState<any[]>([]);
  const [rawPos, setRawPos] = useState<any[]>([]);
  const [rawHr, setRawHr] = useState<any[]>([]);

  // 🩺 CLINICAL OVERLAYS STATE
  const [vitalsBedId, setVitalsBedId] = useState<string | null>(null);
  const [consultPatient, setConsultPatient] = useState<{ bedId: string; name: string } | null>(null);
  const [pharmacyPrescriptionsOpen, setPharmacyPrescriptionsOpen] = useState(false);
  const [transferBedId, setTransferBedId] = useState<string | null>(null);
  const [insuranceSplitFolio, setInsuranceSplitFolio] = useState<{ id: number; balance: number } | null>(null);
  const [diagnosticsHubOpen, setDiagnosticsHubOpen] = useState(false);
  const [opdSchedulerOpen, setOpdSchedulerOpen] = useState(false);

  // 🚨 RERS EMERGENCY STATES
  const [alerts, setAlerts] = useState<any[]>([]);
  const [elapsedMap, setElapsedMap] = useState<Record<number, number>>({});
  const [simPanelOpen, setSimPanelOpen] = useState(false);
  const [simBed, setSimBed] = useState('WARD-01');
  const [simHR, setSimHR] = useState('35');
  const [simSPO2, setSimSPO2] = useState('88');
  const [simBP, setSimBP] = useState('70/45');
  const [simTemp, setSimTemp] = useState('40.2');

  // ── PACKAGE SCOPE: HMS product title is IMMUTABLE — but package color + demo badge are read from
  // localStorage so the UI theme glow adapts per demo session without overriding the product name.
  const [packageColor, setPackageColor] = useState<string>('#00FF88'); // HMS Neon Green default
  const [demoPackageName, setDemoPackageName] = useState<string | null>(null);
  const [demoPackageIcon, setDemoPackageIcon] = useState<string | null>(null);
  useEffect(() => {
    // Read theme color for glow — this is legitimate per-demo theming
    const color = localStorage.getItem('miracle_package_color');
    const name  = localStorage.getItem('miracle_package_name');
    const icon  = localStorage.getItem('miracle_package_icon');
    // Only apply if it's a real demo session (visitor role), not a stale key
    const role  = localStorage.getItem('vigilant_role');
    if (color && role === 'VISITOR') setPackageColor(color);
    if (name  && role === 'VISITOR') setDemoPackageName(name);
    if (icon  && role === 'VISITOR') setDemoPackageIcon(icon);
  }, []);

  // 1. OMNI-NODE MASTER AGGREGATOR
  // ==========================================
  const fetchSafe = async (url: string, key?: string) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const res = await fetch(url, { 
        cache: 'no-store',
        signal: controller.signal 
      });
      clearTimeout(id);
      if (!res.ok) return null;
      const body = await res.json();
      // 🛡️ FIX: Use explicit key first, then fall through
      if (key && body[key] !== undefined) return body[key];
      if (body?.data !== undefined) return body.data;
      return body || null;
    } catch (e) { 
      clearTimeout(id);
      return null; 
    }
  };

  const fetchLiveGrid = useCallback(async () => {
    // 🛡️ PARALLEL CONCURRENT VAULT EXTRACTION: THE OMNI-FETCHER
    const [gridRes, foliosRes, missionsRes, hrRes, posRes] = await Promise.allSettled([
      fetchSafe(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/frontdesk/live-grid`),
      fetchSafe(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/frontdesk/folios`),
      fetchSafe(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/solve/active`, 'missions'),
      fetchSafe(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/performance-matrix`), 
      fetchSafe(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/live`) 
    ]);

    let fFolios = (foliosRes.status === 'fulfilled' && foliosRes.value) ? foliosRes.value : [];
    if (!fFolios) fFolios = [];
    fFolios = Array.isArray(fFolios) ? fFolios : Object.values(fFolios);

    // 🏥 MIRACLE HMS — CLINICAL WARD FALLBACK (matches genesis.py seed)
    let fGrid = (gridRes.status === 'fulfilled' && gridRes.value) ? gridRes.value : [];
    if (!fGrid || fGrid.length === 0) {
        fGrid = [];
        // General Wards (5) — shared multi-bed rooms
        for (let i = 1; i <= 5; i++) fGrid.push({ id: `WARD-${String(i).padStart(2,'0')}`, type: 'WARD', rate: 150, assetClass: 'WARDS', desc: 'General Ward', status: 'AVAILABLE', guest: 'NONE', active_tickets: [] });
        // Private Cabins (5)
        for (let i = 1; i <= 5; i++) fGrid.push({ id: `CABIN-${String(i).padStart(2,'0')}`, type: 'CABIN', rate: 350, assetClass: 'CABINS', desc: 'Private Cabin', status: 'AVAILABLE', guest: 'NONE', active_tickets: [] });
        // ICU (3)
        for (let i = 1; i <= 3; i++) fGrid.push({ id: `ICU-${String(i).padStart(2,'0')}`, type: 'ICU', rate: 1200, assetClass: 'CRITICAL', desc: 'Intensive Care Unit', status: 'AVAILABLE', guest: 'NONE', active_tickets: [] });
        // Emergency (3)
        for (let i = 1; i <= 3; i++) fGrid.push({ id: `ER-${String(i).padStart(2,'0')}`, type: 'EMERGENCY', rate: 500, assetClass: 'CRITICAL', desc: 'Emergency Room', status: 'AVAILABLE', guest: 'NONE', active_tickets: [] });
        // Operating Theatres (2)
        for (let i = 1; i <= 2; i++) fGrid.push({ id: `OT-${String(i).padStart(2,'0')}`, type: 'OT', rate: 2500, assetClass: 'THEATRES', desc: 'Operating Theatre', status: 'AVAILABLE', guest: 'NONE', active_tickets: [] });
    }


    const fMissions = (missionsRes.status === 'fulfilled' && missionsRes.value) ? missionsRes.value : [];
    const fHr = (hrRes.status === 'fulfilled' && hrRes.value) ? hrRes.value : [];
    const fPos = (posRes.status === 'fulfilled' && posRes.value) ? posRes.value : [];

    setRawGrid(fGrid);
    setRawFolios(fFolios);
    setRawMissions(fMissions);
    setRawHr(fHr);
    setRawPos(fPos);
    
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    fetchLiveGrid();
  }, [fetchLiveGrid, syncPulse]);

  // 🛡️ CDO FIX: FAST-PATH WEBSOCKET PAYLOAD INJECTION
  useEffect(() => {
    if (globalGridState && globalGridState.length > 0) {
       setRawGrid(globalGridState);
    }
  }, [globalGridState]);

  // ── RERS WEBSOCKET & ACTION CLINICAL INTEGRATION ────────────────────
  const wsRef = useRef<WebSocket | null>(null);

  const fetchEmergencyAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/active`);
      const json = await res.json();
      if (json.status === 'SUCCESS') setAlerts(json.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchEmergencyAlerts();
    const interval = setInterval(fetchEmergencyAlerts, 5000);
    return () => clearInterval(interval);
  }, [fetchEmergencyAlerts]);

  useEffect(() => {
    const connect = () => {
      try {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const port = '8095'; // FastAPI backend port
        const wsUrl = `ws://${host}:${port}/api/emergency/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (['EMERGENCY_TRIGGERED','DOCTOR_ACKNOWLEDGED','AMBULANCE_DISPATCHED','TEAM_ARRIVED','ALERT_RESOLVED'].includes(msg.event)) {
              fetchEmergencyAlerts();
              fetchLiveGrid(); // Refresh grid state too
            }
          } catch {}
        };

        ws.onclose = () => {
          setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
      } catch {}
    };
    connect();
    return () => wsRef.current?.close();
  }, [fetchEmergencyAlerts, fetchLiveGrid]);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsedMap(prev => {
        const next = { ...prev };
        alerts.forEach(a => {
          if (a.triggered_at) {
            next[a.id] = Math.floor((Date.now() - new Date(a.triggered_at).getTime()) / 1000);
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [alerts]);

  const alertByBed = useMemo(() => {
    return alerts.reduce((acc: Record<string, any>, a) => {
      if (a.status !== 'RESOLVED') {
        acc[a.bed_number] = a;
      }
      return acc;
    }, {});
  }, [alerts]);

  const doctorAck = async (alertId: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/${alertId}/doctor-acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctor_id: 'DR-ON-CALL', notes: 'Acknowledged from Master Command Grid' })
    });
    fetchEmergencyAlerts();
    fetchLiveGrid();
  };

  const dispatchAmbulance = async (alertId: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/${alertId}/dispatch-ambulance`, { method: 'POST' });
    fetchEmergencyAlerts();
    fetchLiveGrid();
  };

  const markArrived = async (alertId: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/${alertId}/service-arrived`, { method: 'POST' });
    fetchEmergencyAlerts();
    fetchLiveGrid();
  };

  const resolveAlert = async (alertId: number) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Resolved from Master Command Grid' })
    });
    fetchEmergencyAlerts();
    fetchLiveGrid();
  };

  const simulateTrigger = async () => {
    const deviceId = `WB-${simBed}`;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/devices/register?device_id=${deviceId}&patient_name=Test+Patient&bed_number=${simBed}`, {
      method: 'POST'
    });
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/emergency/vitals/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        heart_rate: parseInt(simHR) || null,
        spo2: parseInt(simSPO2) || null,
        blood_pressure: simBP || null,
        temperature: parseFloat(simTemp) || null,
      })
    });
    fetchEmergencyAlerts();
    fetchLiveGrid();
  };

  function fmtSeconds(s: number | null | undefined) {
    if (s == null) return '--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  function fmtElapsed(triggeredAt: string | null) {
    if (!triggeredAt) return '0s';
    const diff = Math.floor((Date.now() - new Date(triggeredAt).getTime()) / 1000);
    return fmtSeconds(diff);
  }


  // ==========================================
  // 2. ASYMPTOTIC UI (RULE 7) DOM MAPPER
  // ==========================================
  const hybridInventory = useMemo(() => {
    if (!rawGrid || rawGrid.length === 0) return [];
    return rawGrid.map(room => {
      const roomId = String(room.id);
      const rawStatus = String(room.status || 'AVAILABLE').toUpperCase();
      let status = rawStatus;
      let guest = room.guest || 'NONE';
      const type = room.type;
      const rate = room.rate;

      // 🛡️ THE SINGLE SOURCE OF TRUTH: GUEST FOLIO MATCH
      let folioBalance = 0;
      const f = rawFolios.find((folio: any) => String(folio.id) === roomId || String(folio.room) === roomId || String(folio.room_number) === roomId);
      if (f) {
        folioBalance = f.balance || 0;
        status = 'IN-HOUSE';
        guest = String(f.guest || f.name || f.guest_name || 'GUEST').toUpperCase();
      }

      // 🛡️ SOLVE MISSIONS MATCH (Fusion from Master Ledger)
      const activeRoomMissions = rawMissions.filter((m: any) => 
        String(m.room_no) === roomId && (m.status === 'PENDING' || m.status === 'Active' || m.status === 'ACTIVE')
      );
      const activeMission = activeRoomMissions[0];
      
      const activeAlert = alertByBed[roomId];
      const isAlarm = activeAlert ? true : (activeRoomMissions.some((t: any) => 
        String(t.priority).toUpperCase() === 'CRITICAL' || 
        String(t.type).toUpperCase() === 'CRITICAL' ||
        String(t.subject || '').toUpperCase().includes('ALARM') ||
        String(t.subject || '').toUpperCase().includes('EMERGENCY')
      ) || rawStatus === 'ALARM' || rawStatus === 'CRITICAL' || rawStatus === 'EMERGENCY');
      
      const activeTicketDesc = activeAlert 
        ? `🚨 ${activeAlert.alert_type.replace('_', ' ')} (${activeAlert.status})`
        : (activeMission ? activeMission.subject || activeMission.title || 'ACTIVE TICKET' : null);
      
      // 🛡️ CDO FIX: OMNI-SPECTRUM TELEMETRY MAPPING (Force Abbreviation Mapping)
      const mapDept = (d: string) => {
        const up = String(d || '').toUpperCase();
        if (up.includes('HOUSEKEEPING') || up === 'HK' || up === 'CLN') return 'HK';
        if (up.includes('NURSE') || up === 'NRS' || up.includes('FRONT') || up.includes('CONCIERGE')) return 'NRS';
        if (up.includes('DOCTOR') || up === 'DOC') return 'DOC';
        if (up.includes('LAB') || up === 'LB') return 'LAB';
        if (up.includes('PHARMA') || up === 'PHR') return 'PHR';
        if (up.includes('DIET') || up === 'DIT' || up.includes('ROOM SERVICE') || up.includes('SPA')) return 'DIT';
        if (up.includes('IT') || up === 'MEDTECH' || up.includes('MAINTENANCE') || up.includes('ENGINEER')) return 'IT';
        return 'NRS'; // Default fallback so it always triggers a signal
      };

      const activeDepts = Array.from(new Set(activeRoomMissions.map((t:any) => mapDept(t.dept || t.type))));
      const isVortex = activeDepts.length > 1;
      const primaryDept = activeDepts.length === 1 ? activeDepts[0] : null;

      // 🛡️ WARD SUB-BED ARCHITECTURE
      const beds = [];
      if (room.assetClass === 'WARD' || type === 'WARD') {
        const wardMissions = rawMissions.filter((m: any) => 
          String(m.room_no).startsWith(`${roomId}-B`) && (m.status === 'PENDING' || m.status === 'Active' || m.status === 'ACTIVE')
        );
        for (let i = 1; i <= 6; i++) {
          const bedId = `${roomId}-B${i}`;
          const bedMissions = wardMissions.filter((m: any) => String(m.room_no) === bedId);
          const bedDepts = Array.from(new Set(bedMissions.map((t:any) => mapDept(t.dept || t.type))));
          const bedAlert = alertByBed[bedId];
          const bedIsAlarm = bedAlert ? true : (bedMissions.some((t: any) => 
            String(t.priority).toUpperCase() === 'CRITICAL' || 
            String(t.type).toUpperCase() === 'CRITICAL' ||
            String(t.subject || '').toUpperCase().includes('ALARM') ||
            String(t.subject || '').toUpperCase().includes('EMERGENCY')
          ));
          beds.push({
            id: bedId,
            guest: (status === 'IN-HOUSE' && i <= 3) ? guest : 'VACANT', // Simulate occupied beds for IN-HOUSE wards
            status: (status === 'IN-HOUSE' && i <= 3) ? 'OCCUPIED' : 'AVAILABLE',
            activeDepts: bedDepts,
            isVortex: bedDepts.length > 1,
            primaryDept: bedDepts.length === 1 ? bedDepts[0] : null,
            isAlarm: bedIsAlarm,
            activeTicketDesc: bedAlert 
              ? `🚨 ${bedAlert.alert_type.replace('_', ' ')} (${bedAlert.status})`
              : (bedMissions[0] ? bedMissions[0].subject || 'ACTIVE TICKET' : null),
            signals: {
              hk: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'HK') ? 'PULSE' : 'OFF',
              nrs: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'NRS') ? 'PULSE' : 'OFF',
              doc: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'DOC') ? 'PULSE' : 'OFF',
              lab: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'LAB') ? 'PULSE' : 'OFF',
              phr: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'PHR') ? 'PULSE' : 'OFF',
              dit: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'DIT') ? 'PULSE' : 'OFF',
              it: bedMissions.some((t:any) => mapDept(t.dept || t.type) === 'IT') ? 'PULSE' : 'OFF'
            }
          });
        }
      }

      return {
        ...room, id: roomId, status: activeAlert ? 'EMERGENCY' : status, guest, type, rate, folioBalance, activeTicketDesc, isAlarm,
        activeDepts, isVortex, primaryDept, assetClass: room.assetClass || 'ROOM',
        isHighYield: rate > 10000, desc: room.desc || 'Sovereign Asset',
        upcoming_id: room.upcoming_id,
        activeAlert, // Pass activeAlert info to render SLA timeline and actions
        beds,
        signals: {
          hk: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'HK') ? 'PULSE' : (rawStatus === 'DIRTY' ? 'ON' : 'OFF'),
          nrs: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'NRS') ? 'PULSE' : (status === 'IN-HOUSE' ? 'ON' : 'OFF'),
          doc: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'DOC') ? 'PULSE' : (status === 'IN-HOUSE' ? 'ON' : 'OFF'),
          lab: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'LAB') ? 'PULSE' : 'OFF',
          phr: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'PHR') ? 'PULSE' : 'OFF',
          dit: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'DIT') ? 'PULSE' : 'OFF',
          it: activeRoomMissions.some((t:any) => mapDept(t.dept || t.type) === 'IT') ? 'PULSE' : 'OFF'
        }
      };
    });
  }, [rawGrid, rawFolios, rawPos, rawHr, rawMissions, alertByBed]); // 🛡️ FIX: rawMissions added so signals re-render on new tickets

  useEffect(() => { setRooms(hybridInventory); }, [hybridInventory]);

  const forceRoomAvailable = async (roomId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/frontdesk/force-available/${roomId}`, {
        method: 'POST'
      });
      if(response.ok) {
        console.log(`👑 SOVEREIGN OVERRIDE: ROOM ${roomId} RESET.`);
        fetchLiveGrid(); // Refresh immediately
      }
    } catch (e) {
      console.error("OS OVERRIDE FAULT:", e);
    }
  };

  const warpSync = (zone: string, roomId: string, resId?: string) => {
    localStorage.setItem('miracle_target_room', roomId);
    if (resId) localStorage.setItem('miracle_target_res', resId);
    
    if (zone === 'checkout') {
      router.push(`/dashboard/checkout?room=${roomId}`);
    } else {
      router.push(`/dashboard/${zone}${resId ? `?resId=${resId}` : ''}`);
    }
  };

  const getStatusStyle = (status: string, isAlarm: boolean, isHighYield: boolean) => {
    if (isAlarm) return { borderColor: 'rgba(255, 49, 49, 0.8)', shadow: '0 0 25px rgba(255, 49, 49, 0.5), inset 0 0 15px rgba(255, 49, 49, 0.4)', glow: '#FF3131', anim: 'retina-strobe 1.8s infinite' };
    if (status === 'IN-HOUSE' || status === 'OCCUPIED') return { borderColor: `${packageColor}66`, shadow: `0 0 15px ${packageColor}33`, glow: packageColor, anim: 'none' };
    if (isHighYield) return { borderColor: 'rgba(212, 175, 55, 0.8)', shadow: '0 0 15px rgba(212, 175, 55, 0.3), inset 0 0 10px rgba(212, 175, 55, 0.2)', glow: '#D4AF37', anim: 'none' };
    
    switch(status) {
      case 'DIRTY': return { borderColor: 'rgba(157, 0, 255, 0.4)', shadow: '0 0 10px rgba(157, 0, 255, 0.2)', glow: '#9D00FF', anim: 'none' };
      case 'MAINTENANCE': return { borderColor: 'rgba(245, 158, 11, 0.3)', shadow: '0 0 8px rgba(245, 158, 11, 0.2)', glow: '#F59E0B', anim: 'none' };
      case 'RESERVED': return { borderColor: 'rgba(0, 98, 255, 0.8)', shadow: '0 0 30px rgba(0, 98, 255, 0.4), inset 0 0 15px rgba(0, 31, 63, 0.2)', glow: '#0062ff', anim: 'slow-breath 4s infinite ease-in-out' };
      default: return { borderColor: 'rgba(255, 255, 255, 0.1)', shadow: '0 0 0 transparent', glow: '#444', anim: 'none' };
    }
  };

  const stats = useMemo(() => ({
    total: hybridInventory.length,
    occ: hybridInventory.filter(r => r.status === 'IN-HOUSE').length,
    dirty: hybridInventory.filter(r => r.status === 'DIRTY').length,
    maint: hybridInventory.filter(r => r.status === 'MAINTENANCE').length,
    yield: hybridInventory.filter(r => r.status === 'IN-HOUSE').reduce((acc, r) => acc + (r.rate || 0), 0)
  }), [hybridInventory]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(hybridInventory.map(r => {
      const c = r.assetClass || r.category || 'ROOM';
      return c === 'MARINE' ? 'CRUISE' : c;
    }));
    return ['ALL', ...Array.from(cats)];
  }, [hybridInventory]);

  // 🛡️ CDO FIX: ROBUST SIGNAL FILTERING ENGINE (Rule 7)
  const filteredRooms = useMemo(() => {
    return hybridInventory.filter(r => {
      // 1. GLOBAL SEARCH ADN/GUEST DNA
      const search = searchQuery.toUpperCase().trim();
      const matchesSearch = !search || 
        r.id.toUpperCase().includes(search) || 
        r.guest.toUpperCase().includes(search);
        
      if (!matchesSearch) return false;

      // 2. SOVEREIGN SIGNAL GATE
      const statusUpper = String(r.status || '').toUpperCase();
      
      const assetClass = r.assetClass || r.category || 'ROOM';
      const mappedAssetClass = String(assetClass === 'MARINE' ? 'CRUISE' : assetClass).toUpperCase().trim();
      const tabTarget = String(activeTab).toUpperCase().trim();
      if (tabTarget !== 'ALL' && mappedAssetClass !== tabTarget) return false;

      if (activeFilter === 'ALARMS') return r.isAlarm;
      if (activeFilter === 'DIRTY') {
        return statusUpper === 'DIRTY' || r.signals.hk === 'ON' || r.signals.hk === 'PULSE';
      }
      if (activeFilter === 'MAINTENANCE') {
        return statusUpper === 'MAINTENANCE' || r.signals.mn === 'ON' || r.signals.mn === 'PULSE';
      }
      
      return true; 
    });
  }, [hybridInventory, searchQuery, activeFilter, activeTab]);

  return (
    <div className={`touch-scroll-vault ${isViewMode ? 'zone-view-mode' : ''}`} style={mainViewport}>
      <ViewModeBanner />
      
      {/* 🚀 HUD: EXECUTIVE TELEMETRY */}
      <div style={headerPanel}>
        <div style={headerTopRow}>
          <div>
            <h2 style={titleStyle}>
              🏥 MIRACLE HMS — MASTER COMMAND GRID
            </h2>
            <div style={subTitleRow}>
              <p style={subTitleText}>HEALTHCARE INTELLIGENCE KERNEL | V66.0-SOVEREIGN</p>
              {/* 🎯 DEMO BADGE: Shows active demo module without overriding the product title */}
              {demoPackageName && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '3px 10px', borderRadius: '20px',
                  background: `${packageColor}22`,
                  border: `1px solid ${packageColor}66`,
                  fontSize: '9px', fontWeight: 800,
                  color: packageColor, letterSpacing: '1px',
                  whiteSpace: 'nowrap'
                }}>
                  {demoPackageIcon && <span>{demoPackageIcon}</span>}
                  DEMO: {demoPackageName.toUpperCase()}
                </div>
              )}
              <div style={revenueBadge}>LIVE YIELD: {formatMoney(stats.yield)}</div>
              <button style={syncBtn} onClick={() => router.push('/dashboard/synapse')}>⚡ ZONE 20: SYNAPSE NEXUS</button>
              {/* 🟢 ACCOUNTS & FINANCE — Sovereign Pulse Dot (Iron Law: no dead buttons) */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '5px 10px', borderRadius: '6px', transition: '0.2s' }}
                onClick={() => router.push('/dashboard/accounts')}
                title="Zone 11: Accounts & Finance"
              >
                <span style={accountsDotStyle} className="accounts-pulse-dot" />
                <span style={{ fontSize: '9px', color: '#00FF88', fontWeight: 700, letterSpacing: '1px', opacity: 0.7 }}>ACCOUNTS</span>
              </div>
            </div>
          </div>
          {/* TOP-RIGHT: Weather + Toolbar + Pulse Sync */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ToolbarDock />
              <WeatherCorner />
            </div>
            <button className="cyber-btn pulse-glow" onClick={() => fetchLiveGrid()} style={{...syncBtn, padding: '6px 12px', fontSize: '9px'}}>
              📡 PULSE SYNC DATA
            </button>
          </div>
        </div>

        <div style={headerBottomRow}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', width: '100%', alignItems: 'center', justifyContent: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            <div style={{ position: 'relative', flex: '0 1 300px' }}>
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}>🔍</span>
              <input 
                type="text" placeholder="SEARCH DNA..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={searchInput}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {uniqueCategories.map(t => (
                 <button 
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 900,
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      background: activeTab === t ? `rgba(16, 185, 129, 0.15)` : 'transparent',
                      border: `1px solid ${activeTab === t ? packageColor : 'rgba(255,255,255,0.1)'}`,
                      color: activeTab === t ? packageColor : '#888',
                      transition: 'all 0.2s'
                    }}
                 >
                   {t}
                 </button>
              ))}
            </div>
          </div>

          <div style={filterGroup}>
            {['ALL', 'ALARMS', 'DIRTY'].map(f => {
              const count = f === 'ALL' ? rooms.length : 
                            f === 'ALARMS' ? rooms.filter(r => r.isAlarm).length :
                            f === 'DIRTY' ? rooms.filter(r => r.signals.hk !== 'OFF').length :
                            rooms.filter(r => r.signals.mn !== 'OFF').length;
              
              const displayLabel = f === 'DIRTY' ? 'SANITATION' : f;
              
              return (
                <button 
                  key={f} 
                  onClick={() => setActiveFilter(f as any)} 
                  style={filterPill(activeFilter === f)}
                >
                  {displayLabel} {count > 0 ? `[${count}]` : ''}
                </button>
              );
            })}
            <button 
              onClick={() => setPharmacyPrescriptionsOpen(true)}
              style={{
                padding: '6px 12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                borderRadius: '6px',
                fontSize: '9px',
                fontWeight: 900,
                cursor: 'pointer',
                transition: '0.3s',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)'
              }}
            >
              💊 PHARMACY QUEUE
            </button>
            <button 
              onClick={() => setDiagnosticsHubOpen(true)}
              style={{
                padding: '6px 12px',
                background: 'rgba(57, 255, 20, 0.15)',
                border: '1px solid #39FF14',
                color: '#39FF14',
                borderRadius: '6px',
                fontSize: '9px',
                fontWeight: 900,
                cursor: 'pointer',
                transition: '0.3s',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 10px rgba(57, 255, 20, 0.2)'
              }}
            >
              🔬 LIS LABS
            </button>
            <button 
              onClick={() => setOpdSchedulerOpen(true)}
              style={{
                padding: '6px 12px',
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                borderRadius: '6px',
                fontSize: '9px',
                fontWeight: 900,
                cursor: 'pointer',
                transition: '0.3s',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)'
              }}
            >
              📅 OPD SCHEDULER
            </button>
            <button 
              onClick={() => setSimPanelOpen(!simPanelOpen)}
              style={{
                padding: '6px 12px',
                background: 'rgba(255, 90, 90, 0.15)',
                border: '1px solid #FF5A5A',
                color: '#FF5A5A',
                borderRadius: '6px',
                fontSize: '9px',
                fontWeight: 900,
                cursor: 'pointer',
                transition: '0.3s',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 10px rgba(255, 90, 90, 0.2)'
              }}
            >
              🚨 RERS SIMULATOR
            </button>
          </div>
        </div>
      </div>

      {/* RERS SIMULATION CONTROL PANEL */}
      {simPanelOpen && (
        <div style={simPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#FF5A5A', letterSpacing: '1px' }}>🚨 RERS IOT WRISTBAND VITAL SIMULATOR</h3>
            <button onClick={() => setSimPanelOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={simLabelStyle}>TARGET BED</label>
              <select value={simBed} onChange={e => setSimBed(e.target.value)} style={simInputStyle}>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={simLabelStyle}>HEART RATE</label>
              <input type="number" value={simHR} onChange={e => setSimHR(e.target.value)} style={simInputStyle} placeholder="bpm" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={simLabelStyle}>SPO2 (%)</label>
              <input type="number" value={simSPO2} onChange={e => setSimSPO2(e.target.value)} style={simInputStyle} placeholder="%" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={simLabelStyle}>BLOOD PRESSURE</label>
              <input type="text" value={simBP} onChange={e => setSimBP(e.target.value)} style={simInputStyle} placeholder="sys/dia" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={simLabelStyle}>TEMP (°C)</label>
              <input type="number" step="0.1" value={simTemp} onChange={e => setSimTemp(e.target.value)} style={simInputStyle} placeholder="°C" />
            </div>
            <button onClick={simulateTrigger} style={simSubmitBtnStyle}>
              📡 INJECT CRITICAL VITALS
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes radioactive-pulse { 0% { filter: brightness(1); transform: scale(1); } 50% { filter: brightness(2); transform: scale(1.05); } 100% { filter: brightness(1); transform: scale(1); } }
        @keyframes retina-strobe { 0% { border-color: rgba(255,49,49,0.5); box-shadow: 0 0 10px rgba(255,49,49,0.4), inset 0 0 10px rgba(255,49,49,0.2); } 50% { border-color: rgba(255,255,255,0.8); box-shadow: 0 0 35px rgba(255,49,49,1), inset 0 0 20px rgba(255,49,49,0.5); } 100% { border-color: rgba(255,49,49,0.5); box-shadow: 0 0 10px rgba(255,49,49,0.4), inset 0 0 10px rgba(255,49,49,0.2); } }
        @keyframes slow-breath { 0% { box-shadow: 0 0 15px rgba(0,98,255,0.2), inset 0 0 5px rgba(0,31,63,0.1); } 50% { box-shadow: 0 0 45px rgba(0,98,255,0.6), inset 0 0 20px rgba(0,31,63,0.3); } 100% { box-shadow: 0 0 15px rgba(0,98,255,0.2), inset 0 0 5px rgba(0,31,63,0.1); } }
        @keyframes accountsPulse { 0%, 100% { box-shadow: 0 0 4px #00FF88, 0 0 8px #00FF88; transform: scale(1); opacity: 1; } 50% { box-shadow: 0 0 10px #00FF88, 0 0 20px #00FF88; transform: scale(1.4); opacity: 0.8; } }
        
        /* 🛡️ DEPT-SPECIFIC GLOW PULSES */
        @keyframes pulse-vortex { 0% { box-shadow: 0 0 15px rgba(0,255,255,0.3), inset 0 0 10px rgba(255,0,255,0.2); border-color: #00ffff; } 50% { box-shadow: 0 0 40px rgba(0,255,255,0.8), inset 0 0 20px rgba(255,0,255,0.6); border-color: #ff00ff; } 100% { box-shadow: 0 0 15px rgba(0,255,255,0.3), inset 0 0 10px rgba(255,0,255,0.2); border-color: #00ffff; } }
        @keyframes pulse-hk { 0% { box-shadow: 0 0 10px rgba(168,85,247,0.3); border-color: rgba(168,85,247,0.5); } 50% { box-shadow: 0 0 30px rgba(168,85,247,0.8); border-color: #a855f7; } 100% { box-shadow: 0 0 10px rgba(168,85,247,0.3); border-color: rgba(168,85,247,0.5); } }
        @keyframes pulse-nrs { 0% { box-shadow: 0 0 10px rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5); } 50% { box-shadow: 0 0 30px rgba(56,189,248,0.8); border-color: #38bdf8; } 100% { box-shadow: 0 0 10px rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5); } }
        @keyframes pulse-doc { 0% { box-shadow: 0 0 10px rgba(251,191,36,0.3); border-color: rgba(251,191,36,0.5); } 50% { box-shadow: 0 0 30px rgba(251,191,36,0.8); border-color: #fbbf24; } 100% { box-shadow: 0 0 10px rgba(251,191,36,0.3); border-color: rgba(251,191,36,0.5); } }
        @keyframes pulse-lab { 0% { box-shadow: 0 0 10px rgba(236,72,153,0.3); border-color: rgba(236,72,153,0.5); } 50% { box-shadow: 0 0 30px rgba(236,72,153,0.8); border-color: #ec4899; } 100% { box-shadow: 0 0 10px rgba(236,72,153,0.3); border-color: rgba(236,72,153,0.5); } }
        @keyframes pulse-phr { 0% { box-shadow: 0 0 10px rgba(16,185,129,0.3); border-color: rgba(16,185,129,0.5); } 50% { box-shadow: 0 0 30px rgba(16,185,129,0.8); border-color: #10b981; } 100% { box-shadow: 0 0 10px rgba(16,185,129,0.3); border-color: rgba(16,185,129,0.5); } }
        @keyframes pulse-dit { 0% { box-shadow: 0 0 10px rgba(249,115,22,0.3); border-color: rgba(249,115,22,0.5); } 50% { box-shadow: 0 0 30px rgba(249,115,22,0.8); border-color: #f97316; } 100% { box-shadow: 0 0 10px rgba(249,115,22,0.3); border-color: rgba(249,115,22,0.5); } }
        @keyframes pulse-it { 0% { box-shadow: 0 0 10px rgba(161,161,170,0.3); border-color: rgba(161,161,170,0.5); } 50% { box-shadow: 0 0 30px rgba(161,161,170,0.8); border-color: #a1a1aa; } 100% { box-shadow: 0 0 10px rgba(161,161,170,0.3); border-color: rgba(161,161,170,0.5); } }

        .signal-pulse { animation: radioactive-pulse 1.2s infinite ease-in-out; }
        .pulse-glow { animation: radioactive-pulse 2s infinite ease-in-out; }
        .accounts-pulse-dot { animation: accountsPulse 2s ease-in-out infinite; }
        .pulse-vortex { animation: pulse-vortex 1.8s infinite ease-in-out !important; }
        .pulse-critical { animation: retina-strobe 1.2s infinite ease-in-out !important; }
        .pulse-hk { animation: pulse-hk 2s infinite ease-in-out !important; }
        .pulse-nrs { animation: pulse-nrs 2s infinite ease-in-out !important; }
        .pulse-doc { animation: pulse-doc 2s infinite ease-in-out !important; }
        .pulse-lab { animation: pulse-lab 2s infinite ease-in-out !important; }
        .pulse-phr { animation: pulse-phr 2s infinite ease-in-out !important; }
        .pulse-dit { animation: pulse-dit 2s infinite ease-in-out !important; }
        .pulse-it { animation: pulse-it 2s infinite ease-in-out !important; }

        @keyframes pulse-vortex-2 {
          0% { border-color: var(--v-color-1); box-shadow: 0 0 35px var(--v-color-1), inset 0 0 15px var(--v-color-1); }
          50% { border-color: var(--v-color-2); box-shadow: 0 0 35px var(--v-color-2), inset 0 0 15px var(--v-color-2); }
          100% { border-color: var(--v-color-1); box-shadow: 0 0 35px var(--v-color-1), inset 0 0 15px var(--v-color-1); }
        }
        .vortex-anim-2 { animation: pulse-vortex-2 3s infinite ease-in-out !important; }

        @keyframes pulse-vortex-3 {
          0% { border-color: var(--v-color-1); box-shadow: 0 0 35px var(--v-color-1), inset 0 0 15px var(--v-color-1); }
          33% { border-color: var(--v-color-2); box-shadow: 0 0 35px var(--v-color-2), inset 0 0 15px var(--v-color-2); }
          66% { border-color: var(--v-color-3); box-shadow: 0 0 35px var(--v-color-3), inset 0 0 15px var(--v-color-3); }
          100% { border-color: var(--v-color-1); box-shadow: 0 0 35px var(--v-color-1), inset 0 0 15px var(--v-color-1); }
        }
        .vortex-anim-3 { animation: pulse-vortex-3 4.5s infinite ease-in-out !important; }

        @keyframes pulse-vortex-4 {
          0% { border-color: var(--v-color-1); box-shadow: 0 0 35px var(--v-color-1), inset 0 0 15px var(--v-color-1); }
          25% { border-color: var(--v-color-2); box-shadow: 0 0 35px var(--v-color-2), inset 0 0 15px var(--v-color-2); }
          50% { border-color: var(--v-color-3); box-shadow: 0 0 35px var(--v-color-3), inset 0 0 15px var(--v-color-3); }
          75% { border-color: var(--v-color-4); box-shadow: 0 0 35px var(--v-color-4), inset 0 0 15px var(--v-color-4); }
          100% { border-color: var(--v-color-1); box-shadow: 0 0 35px var(--v-color-1), inset 0 0 15px var(--v-color-1); }
        }
        .vortex-anim-4 { animation: pulse-vortex-4 6s infinite ease-in-out !important; }
      `}} />

      {/* --- RETINA GLASS MATRIX --- */}
      <div style={gridMatrix}>
        {filteredRooms.map((room) => {
          const ui = getStatusStyle(room.status, room.isAlarm, room.isHighYield);
          
          if (room.assetClass === 'WARD' || room.type === 'WARD') {
            return (
              <div key={room.id} style={{
                gridColumn: '1 / -1',
                background: 'rgba(5, 5, 10, 0.95)',
                border: `1px solid ${ui.borderColor}`,
                boxShadow: ui.shadow,
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>{room.id} - WARD MACRO GRID | <span style={{color: ui.glow}}>{room.status}</span></div>
                  <div style={{ fontSize: '14px', color: '#888', fontWeight: 800 }}>PRIMARY GUEST: {room.guest}</div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                  {room.beds?.map((bed: any) => {
                    const bedUi = getStatusStyle(bed.status, bed.isAlarm, false);
                    let bClass = "";
                    let bProps = {};
                    if (bed.isAlarm) bClass = "pulse-critical";
                    else if (bed.isVortex && bed.activeDepts) {
                      const depts = [...bed.activeDepts].sort();
                      const n = Math.min(depts.length, 4);
                      bClass = `vortex-anim-${n}`;
                      const DEPT_COLORS: any = { HK: '#a855f7', NRS: '#38bdf8', DOC: '#fbbf24', LAB: '#ec4899', PHR: '#10b981', DIT: '#f97316', IT: '#a1a1aa' };
                      bProps = {
                        '--v-color-1': DEPT_COLORS[depts[0]] || '#00ffff',
                        '--v-color-2': DEPT_COLORS[depts[1]] || '#00ffff',
                        '--v-color-3': DEPT_COLORS[depts[2]] || DEPT_COLORS[depts[0]] || '#00ffff',
                        '--v-color-4': DEPT_COLORS[depts[3]] || DEPT_COLORS[depts[0]] || '#00ffff',
                      };
                    } else if (bed.primaryDept) {
                      bClass = `pulse-${bed.primaryDept.toLowerCase()}`;
                    }

                    return (
                      <div key={bed.id} className={bClass} style={{ ...roomCardStyle(bedUi.borderColor, bedUi.shadow, bedUi.anim, bed.status), padding: '15px', minHeight: '160px', ...(bProps as any) }}>
                        <div style={{...roomNumber, fontSize: '18px'}}>{bed.id}</div>
                        <div style={roomType(bedUi.glow)}>SUB-BED | <span style={{ color: bedUi.glow }}>{bed.status}</span></div>
                        
                        {bed.activeTicketDesc && (
                          <div style={{ ...activeTicketBadge, fontSize: '9px', marginTop: '10px' }}>🚨 {bed.activeTicketDesc.toUpperCase()}</div>
                        )}
                        
                        <div style={{...guestBlock, marginTop: bed.activeTicketDesc ? '10px' : '20px'}}>
                          <div style={guestName(bed.status)}>{bed.guest.split(' ')[0]}</div>
                        </div>

                        {/* GLASS SIGNAL BLOCKS (INTERACTIVE PORTALS) - Hide during active emergencies */}
                        {bed.status !== 'EMERGENCY' && (
                          <div style={{...signalRow, marginTop: '10px'}}>
                            {['HK', 'NRS', 'DOC', 'LAB', 'PHR', 'DIT', 'IT'].map((key) => {
                                const val = bed.signals[key.toLowerCase()];
                                return (
                                    <div 
                                      key={key} 
                                      onClick={() => router.push(`/dashboard/issue-tickets?room=${bed.id}&dept=${key}`)}
                                      style={{...signalBadge(val, bedUi.glow, key), cursor: 'pointer', padding: '4px', fontSize: '9px'}}
                                    >
                                        {key}
                                    </div>
                                );
                            })}
                          </div>
                        )}

                        {/* GLASS TACTICAL ACTIONS */}
                        <div style={{...actionRow, marginTop: '10px'}}>
                          {bed.status === 'EMERGENCY' && bed.activeAlert && (
                            <div style={actionRowInline}>
                              {bed.activeAlert.status === 'ACTIVE' && (
                                <button className="cyber-btn pulse-glow" onClick={() => doctorAck(bed.activeAlert.id)} style={{...btnStyle('#FF5A5A'), flex: 1, fontSize: '9px'}}>🩺 ACK</button>
                              )}
                              {bed.activeAlert.status === 'DOCTOR_NOTIFIED' && (
                                <button className="cyber-btn pulse-glow" onClick={() => dispatchAmbulance(bed.activeAlert.id)} style={{...btnStyle('#fbbf24'), flex: 1, fontSize: '9px'}}>🚑 DISPATCH</button>
                              )}
                              {bed.activeAlert.status === 'AMBULANCE_DISPATCHED' && (
                                <button className="cyber-btn pulse-glow" onClick={() => markArrived(bed.activeAlert.id)} style={{...btnStyle('#818cf8'), flex: 1, fontSize: '9px'}}>🏥 ARRIVAL</button>
                              )}
                              {bed.activeAlert.status === 'ARRIVED' && (
                                <button className="cyber-btn pulse-glow" onClick={() => resolveAlert(bed.activeAlert.id)} style={{...btnStyle('#34d399'), flex: 1, fontSize: '9px'}}>✅ RESOLVE</button>
                              )}
                            </div>
                          )}
                          {bed.status === 'AVAILABLE' && !bed.isVortex && !bed.isAlarm && (
                            <><button className="cyber-btn" onClick={() => setVitalsBedId(bed.id)} style={{...btnStyle(packageColor), fontSize: '9px'}}>VITALS</button><button className="cyber-btn gold" onClick={() => warpSync('reservations', bed.id)} style={{...btnStyle('#D4AF37'), fontSize: '9px'}}>ADMIT</button></>
                          )}
                          {bed.status === 'RESERVED' && !bed.isVortex && !bed.isAlarm && (
                            <button className="cyber-btn pulse-glow" onClick={() => warpSync('reservations', bed.id, bed.upcoming_id)} style={{...btnStyle('#0062ff'), fontSize: '9px'}}>PUSH ADMIT</button>
                          )}
                          {bed.status === 'OCCUPIED' && !bed.isVortex && !bed.isAlarm && (
                            <div style={actionRowInline}>
                              <button className="cyber-btn" onClick={() => setConsultPatient({ bedId: bed.id, name: bed.guest })} style={{...btnStyle(packageColor), flex: 1.2, fontSize: '9px'}}>🩺 SOAP</button>
                              <button className="cyber-btn" onClick={() => setTransferBedId(bed.id)} style={{...btnStyle('#D4AF37'), flex: 0.8, fontSize: '9px'}}>🔄 TX</button>
                              <button className="cyber-btn" onClick={() => {
                                const folio = rawFolios.find(f => f.room_number === bed.id && f.status === 'IN_HOUSE');
                                if (folio) {
                                  setInsuranceSplitFolio({ id: folio.id, balance: folio.balance });
                                } else {
                                  warpSync('checkout', bed.id);
                                }
                              }} style={{...btnStyle('#FF3131'), flex: 1.0, fontSize: '9px'}}>💳 CLAIM</button>
                            </div>
                          )}
                          {bed.status === 'OCCUPIED' && (bed.isVortex || bed.isAlarm) && (
                            <div style={actionRowInline}>
                              <button className="cyber-btn" onClick={() => {
                                const folio = rawFolios.find(f => f.room_number === bed.id && f.status === 'IN_HOUSE');
                                if (folio) {
                                  setInsuranceSplitFolio({ id: folio.id, balance: folio.balance });
                                } else {
                                  warpSync('checkout', bed.id);
                                }
                              }} style={{...btnStyle('#FF3131'), flex: 1, fontSize: '9px'}}>💳 CLAIM</button>
                              <button className="cyber-btn pulse-glow" onClick={() => warpSync('solve', bed.id)} style={{...btnStyle('#FF6B35'), flex: 1, fontSize: '9px'}}>🔥 ALARM</button>
                            </div>
                          )}
                          {/* Non-IN-HOUSE beds with fractures */}
                          {bed.status !== 'OCCUPIED' && bed.status !== 'EMERGENCY' && (bed.isVortex || bed.isAlarm) && (
                            <button className="cyber-btn pulse-glow" onClick={() => warpSync('solve', bed.id)} style={{...btnStyle('#FF3131'), fontSize: '9px'}}>🔥 ALARM</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // 🛡️ CDO FIX: DYNAMIC COMPONENT CLASSES FOR CSS KEYFRAMES
          let teleportClass = "";
          let vortexStyleProps = {};
          if (room.isAlarm) teleportClass = "pulse-critical";
          else if (room.isVortex && room.activeDepts) {
            const depts = [...room.activeDepts].sort();
            const n = Math.min(depts.length, 4);
            teleportClass = `vortex-anim-${n}`;
            const DEPT_COLORS: any = { HK: '#a855f7', NRS: '#38bdf8', DOC: '#fbbf24', LAB: '#ec4899', PHR: '#10b981', DIT: '#f97316', IT: '#a1a1aa' };
            vortexStyleProps = {
              '--v-color-1': DEPT_COLORS[depts[0]] || '#00ffff',
              '--v-color-2': DEPT_COLORS[depts[1]] || '#00ffff',
              '--v-color-3': DEPT_COLORS[depts[2]] || DEPT_COLORS[depts[0]] || '#00ffff',
              '--v-color-4': DEPT_COLORS[depts[3]] || DEPT_COLORS[depts[0]] || '#00ffff',
            };
          }
          else if (room.primaryDept) teleportClass = `pulse-${room.primaryDept.toLowerCase()}`;
          else teleportClass = "";

          return (
            <div key={room.id} className={teleportClass} style={{ ...roomCardStyle(ui.borderColor, ui.shadow, ui.anim, room.status), ...(vortexStyleProps as any) }}>

              {/* COMPACTED 32PX CINZEL DOMINANCE */}
              <div style={roomNumber}>{room.id}</div>
              <div style={roomType(ui.glow)}>{room.type.split(' ')[0]} | <span style={{ color: ui.glow }}>{room.status}</span></div>
              
              {room.activeTicketDesc && (
                <div style={activeTicketBadge}>🚨 {room.activeTicketDesc.toUpperCase()}</div>
              )}
              {room.activeTicketDesc ? null : (
                <div style={roomDescText}>{room.desc}</div>
              )}

              <div style={guestBlock}>
                <div style={guestName(room.status)}>{room.guest === 'NONE' ? 'VACANT' : room.guest.split(' ')[0]}</div>
                <div style={guestRate}>RATE: {formatMoney((room.rate || 0))}</div>
                {(room.status === 'IN-HOUSE' || room.status === 'EMERGENCY') && <div style={folioRate}>FOLIO: {formatMoney((room.folioBalance || 0))}</div>}
              </div>

              {/* RERS EMERGENCY SLA TIMELINE */}
              {room.activeAlert && (
                <div style={slaTimelineStyle}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#ff5a5a', letterSpacing: '1px', marginBottom: '6px' }}>⏱️ RERS SLA TIMELINE</div>
                  <div style={slaRowStyle}>
                    <span>DOC ACK (60s):</span>
                    <span style={{ color: room.activeAlert.doctor_sla === 'BREACH' ? '#FF3131' : room.activeAlert.doctor_sla === 'COMPLIANT' ? '#52d1a3' : '#FFD700', fontWeight: 'bold' }}>
                      {room.activeAlert.doctor_response_seconds != null ? `${room.activeAlert.doctor_response_seconds}s` : 'PENDING'}
                    </span>
                  </div>
                  <div style={slaRowStyle}>
                    <span>DISPATCH (3m):</span>
                    <span style={{ color: room.activeAlert.ambulance_sla === 'BREACH' ? '#FF3131' : room.activeAlert.ambulance_sla === 'COMPLIANT' ? '#52d1a3' : '#FFD700', fontWeight: 'bold' }}>
                      {room.activeAlert.ambulance_response_seconds != null ? `${room.activeAlert.ambulance_response_seconds}s` : 'PENDING'}
                    </span>
                  </div>
                  <div style={slaRowStyle}>
                    <span>ARRIVAL (10m):</span>
                    <span style={{ color: room.activeAlert.arrival_sla === 'BREACH' ? '#FF3131' : room.activeAlert.arrival_sla === 'COMPLIANT' ? '#52d1a3' : '#FFD700', fontWeight: 'bold' }}>
                      {room.activeAlert.total_response_seconds != null ? `${room.activeAlert.total_response_seconds}s` : 'PENDING'}
                    </span>
                  </div>
                  <div style={{ ...slaRowStyle, marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                    <span>ELAPSED:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#FF3131' }}>
                      {fmtElapsed(room.activeAlert.triggered_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* GLASS SIGNAL BLOCKS (INTERACTIVE PORTALS) - Hide during active emergencies */}
              {room.status !== 'EMERGENCY' && (
                <div style={signalRow}>
                  {['HK', 'NRS', 'DOC', 'LAB', 'PHR', 'DIT', 'IT'].map((key) => {
                      const val = room.signals[key.toLowerCase()];
                      return (
                          <div 
                            key={key} 
                            onClick={() => router.push(`/dashboard/issue-tickets?room=${room.id}&dept=${key}`)}
                            style={{...signalBadge(val, ui.glow, key), cursor: 'pointer'}}
                          >
                              {key}
                          </div>
                      );
                  })}
                </div>
              )}

              {/* GLASS TACTICAL ACTIONS */}
              <div style={actionRow}>
                {room.status === 'EMERGENCY' && room.activeAlert && (
                  <div style={actionRowInline}>
                    {room.activeAlert.status === 'ACTIVE' && (
                      <button className="cyber-btn pulse-glow" onClick={() => doctorAck(room.activeAlert.id)} style={{...btnStyle('#FF5A5A'), flex: 1}}>🩺 ACK DIRECTIVE</button>
                    )}
                    {room.activeAlert.status === 'DOCTOR_NOTIFIED' && (
                      <button className="cyber-btn pulse-glow" onClick={() => dispatchAmbulance(room.activeAlert.id)} style={{...btnStyle('#fbbf24'), flex: 1}}>🚑 DISPATCH FLEET</button>
                    )}
                    {room.activeAlert.status === 'AMBULANCE_DISPATCHED' && (
                      <button className="cyber-btn pulse-glow" onClick={() => markArrived(room.activeAlert.id)} style={{...btnStyle('#818cf8'), flex: 1}}>🏥 MARK ARRIVAL</button>
                    )}
                    {room.activeAlert.status === 'ARRIVED' && (
                      <button className="cyber-btn pulse-glow" onClick={() => resolveAlert(room.activeAlert.id)} style={{...btnStyle('#34d399'), flex: 1}}>✅ RESOLVE ALERT</button>
                    )}
                  </div>
                )}
                {room.status === 'AVAILABLE' && !room.isVortex && !room.isAlarm && (
                  <><button className="cyber-btn" onClick={() => setVitalsBedId(room.id)} style={btnStyle(packageColor)}>VITALS TRIAGE</button><button className="cyber-btn gold" onClick={() => warpSync('reservations', room.id)} style={btnStyle('#D4AF37')}>ADMIT PATIENT</button></>
                )}
                {room.status === 'RESERVED' && !room.isVortex && !room.isAlarm && (
                  <button className="cyber-btn pulse-glow" onClick={() => warpSync('reservations', room.id, room.upcoming_id)} style={btnStyle('#0062ff')}>PUSH ADMISSION</button>
                )}
                {room.status === 'IN-HOUSE' && !room.isVortex && !room.isAlarm && (
                  <div style={actionRowInline}>
                    <button className="cyber-btn" onClick={() => setConsultPatient({ bedId: room.id, name: room.guest })} style={{...btnStyle(packageColor), flex: 1.2}}>🩺 SOAP</button>
                    <button className="cyber-btn" onClick={() => setTransferBedId(room.id)} style={{...btnStyle('#D4AF37'), flex: 0.8}}>🔄 TRANSFER</button>
                    <button className="cyber-btn" onClick={() => {
                      const folio = rawFolios.find(f => f.room_number === room.id && f.status === 'IN_HOUSE');
                      if (folio) {
                        setInsuranceSplitFolio({ id: folio.id, balance: folio.balance });
                      } else {
                        warpSync('checkout', room.id);
                      }
                    }} style={{...btnStyle('#FF3131'), flex: 1.0}}>💳 TPA CLAIM</button>
                  </div>
                )}
                {/* 🛡️ CDO FIX: IN-HOUSE + TICKETS — FOLIO & RESOLVE FRACTURE always side-by-side */}
                {room.status === 'IN-HOUSE' && (room.isVortex || room.isAlarm) && (
                  <div style={actionRowInline}>
                    <button className="cyber-btn" onClick={() => {
                      const folio = rawFolios.find(f => f.room_number === room.id && f.status === 'IN_HOUSE');
                      if (folio) {
                        setInsuranceSplitFolio({ id: folio.id, balance: folio.balance });
                      } else {
                        warpSync('checkout', room.id);
                      }
                    }} style={{...btnStyle('#FF3131'), flex: 1}}>💳 TPA CLAIM</button>
                    <button className="cyber-btn pulse-glow" onClick={() => warpSync('solve', room.id)} style={{...btnStyle('#FF6B35'), flex: 1}}>🔥 CLINICAL ALARM</button>
                  </div>
                )}
                {room.status === 'DIRTY' && !room.isVortex && !room.isAlarm && (
                  <><button className="cyber-btn" onClick={() => warpSync('issue-tickets', room.id)} style={btnStyle('#9D00FF')}>ASSIGN SANITATION</button><button className="cyber-btn" onClick={() => warpSync('solve', room.id)} style={btnStyle('#888')}>INSPECT</button></>
                )}
                {room.status === 'MAINTENANCE' && !room.isVortex && !room.isAlarm && (
                  <button className="cyber-btn" onClick={() => warpSync('solve', room.id)} style={btnStyle('#F59E0B')}>WORK ORDER</button>
                )}
                {room.status === 'OCCUPIED' && !room.isVortex && !room.isAlarm && (
                  <><button className="cyber-btn" onClick={() => forceRoomAvailable(room.id)} style={btnStyle('#FF3131')}>FORCE CLEAR</button><button className="cyber-btn" onClick={() => warpSync('solve', room.id)} style={btnStyle('#888')}>INSPECT</button></>
                )}
                {/* Non-IN-HOUSE rooms with fractures */}
                {room.status !== 'IN-HOUSE' && room.status !== 'EMERGENCY' && (room.isVortex || room.isAlarm) && (
                  <button className="cyber-btn pulse-glow" onClick={() => warpSync('solve', room.id)} style={btnStyle('#FF3131')}>🔥 CLINICAL ALARM</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🩺 CLINICAL OVERLAYS RENDERING */}
      {vitalsBedId && (
        <VitalsModal 
          bedId={vitalsBedId} 
          onClose={() => setVitalsBedId(null)} 
          onRefresh={fetchLiveGrid} 
        />
      )}
      
      {consultPatient && (
        <ConsultDesk 
          patient={consultPatient} 
          inventory={rawPos} 
          onClose={() => setConsultPatient(null)} 
          onRefresh={fetchLiveGrid} 
        />
      )}
      
      {pharmacyPrescriptionsOpen && (
        <PharmacyQueue 
          onClose={() => setPharmacyPrescriptionsOpen(false)} 
          onRefresh={fetchLiveGrid} 
        />
      )}

      {transferBedId && (
        <ADTTransferModal
          patientId={transferBedId}
          currentBed={transferBedId}
          bedsList={rooms}
          onClose={() => setTransferBedId(null)}
          onRefresh={fetchLiveGrid}
        />
      )}

      {insuranceSplitFolio && (
        <InsuranceSplitModal
          folioId={insuranceSplitFolio.id}
          totalBalance={insuranceSplitFolio.balance}
          onClose={() => setInsuranceSplitFolio(null)}
          onRefresh={fetchLiveGrid}
        />
      )}

      {diagnosticsHubOpen && (
        <DiagnosticsHub
          onClose={() => setDiagnosticsHubOpen(false)}
        />
      )}

      {opdSchedulerOpen && (
        <OPDScheduler
          onClose={() => setOpdSchedulerOpen(false)}
        />
      )}
    </div>
  );
}

// --- SOVEREIGN GLASS STYLING KERNEL (HARD LOCKED) ---
const mainViewport = { width: '100%', minHeight: '100vh', padding: 'var(--space-lg)', background: 'transparent', backgroundImage: 'radial-gradient(circle at center, rgba(16,185,129,0.03) 0%, transparent 70%)' };
const headerPanel = { borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-lg)' };
const headerTopRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: '20px', marginBottom: '25px' };
const titleStyle = { fontFamily: 'Cinzel, Inter, sans-serif', color: '#D4AF37', margin: 0, fontSize: '26px', letterSpacing: '4px', textShadow: '0 0 20px rgba(212,175,55,0.4)', fontWeight: 800 };
const subTitleRow = { display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '15px', marginTop: '12px' };
const subTitleText = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '15px' };
const revenueBadge = { background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', fontSize: '10px', padding: '6px 14px', borderRadius: '6px', fontWeight: 900, boxShadow: '0 0 10px rgba(16,185,129,0.2)' };
const syncBtn = { padding: '10px 20px', fontSize: '10px', color: '#00F2FF', border: '1px solid rgba(0, 242, 255, 0.5)', background: 'rgba(0, 242, 255, 0.05)', backdropFilter: 'blur(5px)', cursor: 'pointer', fontWeight: 900, borderRadius: '8px', transition: '0.3s' };
const headerBottomRow = { display: 'flex', flexDirection: 'column' as const, gap: '10px', background: 'rgba(5, 10, 5, 0.7)', padding: '12px 15px', borderRadius: '12px', border: '1px solid rgba(0, 255, 136, 0.1)', boxShadow: '0 4px 30px rgba(0,0,0,0.5)' };
const searchInput = { background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0, 255, 136, 0.2)', color: '#00FF88', padding: '8px 12px 8px 35px', borderRadius: '6px', fontSize: '11px', width: '100%', outline: 'none', transition: '0.3s', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' };
const filterGroup = { display: 'flex', gap: '8px', flexWrap: 'wrap' as const, alignItems: 'center', width: '100%' };
const filterPill = (active: boolean) => ({ padding: '6px 14px', background: active ? 'linear-gradient(90deg, #D4AF37, #F3E5AB)' : 'rgba(255,255,255,0.02)', color: active ? '#000' : '#888', border: active ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '9px', fontWeight: 900, cursor: 'pointer', transition: '0.3s', whiteSpace: 'nowrap' as const, boxShadow: active ? '0 0 15px rgba(212,175,55,0.4)' : 'none' });
const gridMatrix = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' };

const roomCardStyle = (borderColor: string, shadow: string, anim: string, status: string) => ({
  background: 'linear-gradient(135deg, rgba(20,20,20,0.6) 0%, rgba(5,5,5,0.8) 100%)',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  borderRadius: '16px', 
  borderStyle: 'solid', borderWidth: '1px',
  borderTopColor: 'rgba(255,255,255,0.15)',
  borderLeftColor: 'rgba(255,255,255,0.05)', 
  borderRightColor: borderColor,
  borderBottomColor: borderColor,
  padding: '16px', textAlign: 'center' as const, position: 'relative' as const, overflow: 'hidden',
  boxShadow: `0 10px 30px rgba(0,0,0,0.8), ${shadow}`, animation: anim, transition: '0.3s',
  display: 'flex', flexDirection: 'column' as const,
  minHeight: (status === 'IN-HOUSE' || status === 'EMERGENCY') ? '420px' : '280px',
  height: '100%',
  justifyContent: 'space-between' as const
});

const yieldTag = { position: 'absolute' as const, top: '10px', right: '-25px', background: '#D4AF37', color: '#000', fontSize: '7px', fontWeight: 900, padding: '3px 25px', transform: 'rotate(45deg)', boxShadow: '0 5px 10px rgba(212,175,55,0.5)', letterSpacing: '1px' };
const roomNumber = { fontFamily: 'Inter', fontSize: '32px', fontWeight: 900, color: '#FFF', textShadow: '0 0 15px rgba(255,255,255,0.4)', marginBottom: '5px' };
const roomType = (glow: string) => ({ fontSize: '8px', fontWeight: 900, color: '#888', letterSpacing: '1px', marginBottom: '10px' });
const roomDescText = { fontSize: '8px', color: '#555', lineHeight: '1.4', marginBottom: '15px', height: '24px', overflow: 'hidden' };
const activeTicketBadge = { fontSize: '9px', color: '#FF3131', background: 'rgba(255,49,49,0.1)', padding: '5px', borderRadius: '4px', marginBottom: '10px', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '1px' };
const guestBlock = { background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '10px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)' };
const guestName = (status: string) => ({ fontSize: '11px', fontWeight: 900, color: status === 'IN-HOUSE' ? '#10b981' : '#666', letterSpacing: '1px', textShadow: status === 'IN-HOUSE' ? '0 0 8px rgba(16,185,129,0.4)' : 'none', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' });
const guestRate = { fontSize: '9px', color: '#D4AF37', marginTop: '6px', fontWeight: 800 };
const folioRate = { fontSize: '9px', color: '#10b981', marginTop: '6px', fontWeight: 900, textShadow: '0 0 5px rgba(16,185,129,0.4)' };
const signalRow = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '20px' };

const getDeptColor = (dept: string) => {
  switch(dept) {
    case 'HK': return '#a855f7'; // Purple
    case 'NRS': return '#38bdf8'; // Blue
    case 'DOC': return '#fbbf24'; // Yellow
    case 'LAB': return '#ec4899'; // Pink
    case 'PHR': return '#10b981'; // Green
    case 'DIT': return '#f97316'; // Orange
    case 'IT': return '#a1a1aa'; // Grey
    default: return '#FFF';
  }
};

const signalBadge = (val: string, glow: string, dept: string) => {
  const activeColor = getDeptColor(dept);
  return {
    fontSize: '8px', fontWeight: 900, padding: '5px 8px', borderRadius: '6px', transition: '0.3s',
    background: val === 'PULSE' ? `${activeColor}22` : val === 'ON' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
    color: val === 'PULSE' ? activeColor : val === 'ON' ? glow : '#555',
    border: val === 'PULSE' ? `1px solid ${activeColor}` : val === 'ON' ? `1px solid ${glow}` : '1px solid rgba(255,255,255,0.05)',
    boxShadow: val === 'PULSE' ? `0 0 15px ${activeColor}88` : val === 'ON' ? `0 0 5px ${glow}44` : 'none',
    animation: val === 'PULSE' ? 'radioactive-pulse 1.2s infinite ease-in-out' : 'none'
  };
};

const actionRow = { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginTop: 'auto' };
const actionRowInline = { display: 'flex', flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: '6px', width: '100%' };
const btnStyle = (color: string) => ({ flex: '1 1 auto', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', border: `1px solid ${color}`, color: color, padding: '10px', borderRadius: '8px', fontSize: '9px', fontWeight: 900, cursor: 'pointer', transition: '0.2s', boxShadow: `0 0 10px ${color}22` });

const accountsDotStyle: React.CSSProperties = {
  width: '8px', height: '8px',
  borderRadius: '50%',
  background: '#00FF88',
  display: 'inline-block',
  flexShrink: 0,
};

const slaTimelineStyle: React.CSSProperties = {
  background: 'rgba(255, 90, 90, 0.05)',
  border: '1px solid rgba(255, 90, 90, 0.2)',
  borderRadius: '10px',
  padding: '10px',
  margin: '10px 0',
  fontSize: '11px',
  textAlign: 'left',
};

const slaRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '3px',
  color: 'rgba(255,255,255,0.7)',
};

const simPanelStyle: React.CSSProperties = {
  background: 'rgba(20, 10, 10, 0.85)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 90, 90, 0.3)',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '20px',
  boxShadow: '0 0 25px rgba(255, 90, 90, 0.1)',
};

const simLabelStyle: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 900,
  color: '#888',
  letterSpacing: '1px',
  marginBottom: '2px',
};

const simInputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '11px',
  outline: 'none',
  minWidth: '100px',
};

const simSubmitBtnStyle: React.CSSProperties = {
  background: '#FF5A5A',
  color: '#000',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 20px',
  fontSize: '11px',
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 0 15px rgba(255, 90, 90, 0.4)',
  transition: '0.2s',
};

