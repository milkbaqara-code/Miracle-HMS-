'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
// ==========================================
// --- ENTERPRISE TYPES: MASTER ADMIN ---
// ==========================================
interface RawMaterial {
  id: string;
  name: string;
  stock: number;
  unit: string;
  cost: number;
}

interface BOMDraft {
  rawId: string;
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
}

interface ProductDraft {
  name: string;
  rp: number;
  cat: string;
  desc: string;
  type: 'PRODUCT' | 'SERVICE';
}

const TERMINALS = ['MICHELIN DINING', 'CIGAR LOUNGE', 'IN-VILLA CATERING', 'MED-SPA CLINIC', 'THERMAL HAMMAM', 'HELIPAD SVCS', 'SUPERCAR FLEET', 'MARINA CHARTER', 'LUXURY BOUTIQUE', 'ART GALLERY', 'HK-HOUSEKEEPING', 'MAINTENANCE'];

export default function POSAdminControlCenter() {
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const { formatMoney, currencySymbol } = useCurrencyLang();
  // ==========================================
  // 1. SYSTEM STATE & MASTER VAULT LINK
  // ==========================================
  const [networkStatus, setNetworkStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [rawInventory, setRawInventory] = useState<RawMaterial[]>([]);

  // Fetch 'RAW' items only, so the admin can build the BOM recipes
  const fetchRawMaterials = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/raw`);
      if (res.ok) {
        const data = await res.json();
        setRawInventory(data.data || []);
        setNetworkStatus('ONLINE');
      }
    } catch (e) {
      console.error("Vault Offline: Cannot fetch raw materials for BOM.");
      setNetworkStatus('OFFLINE');
    }
  }, []);

  useEffect(() => { fetchRawMaterials(); }, [fetchRawMaterials]);

  // ==========================================
  // 2. ASSET CREATION STATE
  // ==========================================
  const [draft, setDraft] = useState<ProductDraft>({
    name: '', rp: 0, cat: 'RS-RESTAURANT', desc: '', type: 'PRODUCT'
  });
  
  // BOM Configurator State
  const [bom, setBom] = useState<BOMDraft[]>([]);
  const [selectedRawId, setSelectedRawId] = useState<string>('');
  const [bomQty, setBomQty] = useState<number | ''>('');

  const addBOMItem = () => {
    if (!selectedRawId || !bomQty) return;
    const raw = rawInventory.find(r => r.id === selectedRawId);
    if (!raw) return;

    setBom(prev => {
      // Prevent duplicates, update qty instead
      const exists = prev.find(b => b.rawId === selectedRawId);
      if (exists) return prev.map(b => b.rawId === selectedRawId ? { ...b, qty: b.qty + Number(bomQty) } : b);
      return [...prev, { rawId: raw.id, name: raw.name, qty: Number(bomQty), unit: raw.unit, unitCost: raw.cost }];
    });
    setSelectedRawId(''); setBomQty('');
  };

  const removeBOMItem = (rawId: string) => {
    setBom(prev => prev.filter(b => b.rawId !== rawId));
  };

  // Live COGS Calculator
  const liveCOGS = bom.reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
  const liveProfit = draft.rp - liveCOGS;
  const margin = draft.rp > 0 ? ((liveProfit / draft.rp) * 100).toFixed(1) : '0.0';

  // ==========================================
  // 3. MEDIA FORGE: CSS-GPU WEBP CROPPER
  // ==========================================
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [finalWebP, setFinalWebP] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setRawImage(img); setZoom(1); setPan({ x: 0, y: 0 }); setFinalWebP(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rawImage) return;
    setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !rawImage) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // The Cropper Math Engine
  const generateWebP = () => {
    if (!rawImage) return;
    const canvas = document.createElement('canvas');
    const size = 600; // Perfect 600x600 POS Square for fast rendering
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, size, size);

      // Mathematical alignment matching the UI preview box
      ctx.translate((size / 2) + (pan.x * 2), (size / 2) + (pan.y * 2)); 
      ctx.scale(zoom, zoom);
      
      const scaleToFit = Math.max(size / rawImage.width, size / rawImage.height);
      const w = rawImage.width * scaleToFit; const h = rawImage.height * scaleToFit;
      
      ctx.drawImage(rawImage, -w / 2, -h / 2, w, h);
      
      // 80% Compression for lightning-fast frontend load times
      setFinalWebP(canvas.toDataURL('image/webp', 0.8));
    }
  };

  // ==========================================
  // 4. THE MASTER SYNC PAYLOAD
  // ==========================================
  const publishAsset = async () => {
    if (!draft.name || draft.rp <= 0) {
      showToast('HALT', 'warning', 'Name and valid Retail Price are required.');
      return;
    }
    if (draft.type === 'PRODUCT' && bom.length === 0) {
      const proceed = await showConfirm('WARNING', 'Creating a PRODUCT with no BOM. Inventory will not deduct accurately. Proceed?');
      if (!proceed) return;
    }

    setIsSyncing(true);
    
    const payload = {
      ...draft,
      bom: bom,
      cogs: liveCOGS,
      img: finalWebP || ''
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/admin/create-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Vault Rejected Payload");

      showToast('ASSET SECURED', 'success', `[${draft.name}] is now live on ${draft.cat.replace('RS-', '')} terminals.`);
      
      setDraft({ name: '', rp: 0, cat: 'RS-RESTAURANT', desc: '', type: 'PRODUCT' });
      setBom([]); setRawImage(null); setFinalWebP(null); setZoom(1); setPan({ x: 0, y: 0 });
      
    } catch (error) {
      showToast('SYNC ERROR', 'error', 'Failed to write to Master Vault.');
    } finally {
      setIsSyncing(false);
    }
  };
  // ... (Picks up exactly after publishAsset function from Part 1)

  return (
    <div style={adminContainer} className={isViewMode ? "zone-view-mode" : ""}>
      <ViewModeBanner />
      
      {/* ======================================= */}
      {/* ADMIN HUD HEADER                        */}
      {/* ======================================= */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>POS CONTROL CENTER</h1>
          <div style={subTitleStyle}>MASTER VAULT ASSET INJECTION & MEDIA FORGE</div>
        </div>
        <div style={networkStatusStyle(networkStatus === 'ONLINE')}>
          <span style={statusDot(networkStatus === 'ONLINE')}></span>
          {networkStatus === 'ONLINE' ? 'VAULT UPLINK SECURE' : 'VAULT OFFLINE'}
        </div>
      </div>

      <div style={layoutGrid}>
        
        {/* ======================================= */}
        {/* PANEL 1: CORE ASSET METADATA            */}
        {/* ======================================= */}
        <div style={panelStyle}>
          <h3 style={panelTitle}>1. ASSET METADATA</h3>
          
          <label style={labelStyle}>ASSET NAME</label>
          <input style={inputStyle} placeholder="e.g. Wagyu Tomahawk Steak" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} />
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>RETAIL PRICE ({currencySymbol})</label>
              <input type="number" style={inputStyle} placeholder="0.00" value={draft.rp || ''} onChange={e => setDraft({...draft, rp: Number(e.target.value)})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ASSET TYPE</label>
              <select style={selectStyle} value={draft.type} onChange={e => setDraft({...draft, type: e.target.value as any})}>
                <option value="PRODUCT">PHYSICAL PRODUCT</option>
                <option value="SERVICE">SERVICE / TIME</option>
              </select>
            </div>
          </div>

          <label style={labelStyle}>TARGET POS TERMINAL</label>
          <select style={selectStyle} value={draft.cat} onChange={e => setDraft({...draft, cat: e.target.value})}>
            {TERMINALS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={labelStyle}>LUXURY GUEST DESCRIPTION (MENU DISPLAY)</label>
          <textarea style={textAreaStyle} placeholder="Craft the narrative..." value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} />
        </div>

        {/* ======================================= */}
        {/* PANEL 2: THE BOM CONFIGURATOR           */}
        {/* ======================================= */}
        <div style={panelStyle}>
          <h3 style={panelTitle}>2. BILL OF MATERIALS (BOM)</h3>
          
          {draft.type === 'SERVICE' ? (
            <div style={serviceLockout}>SERVICES DO NOT REQUIRE RAW INVENTORY DEDUCTION</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <select style={{ ...selectStyle, flex: 2, marginBottom: 0 }} value={selectedRawId} onChange={e => setSelectedRawId(e.target.value)}>
                  <option value="">-- SELECT RAW INGREDIENT --</option>
                  {rawInventory.map(r => <option key={r.id} value={r.id}>{r.name} (In Stock: {r.stock} {r.unit})</option>)}
                </select>
                <input type="number" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} placeholder="QTY" value={bomQty} onChange={e => setBomQty(Number(e.target.value))} />
                <button style={addBtnStyle} onClick={addBOMItem}>ADD</button>
              </div>

              <div style={bomList}>
                {bom.length === 0 && <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', marginTop: '30px' }}>No ingredients added. Asset will not deduct inventory.</div>}
                {bom.map(b => (
                  <div key={b.rawId} style={bomRow}>
                    <span style={{ color: '#FFF', fontSize: '12px', fontWeight: 900 }}>{b.name}</span>
                    <span style={{ color: '#00F2FF', fontSize: '11px' }}>{b.qty} {b.unit}</span>
                    <button onClick={() => removeBOMItem(b.rawId)} style={removeBtnStyle}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* FINANCIAL TELEMETRY HUD */}
          <div style={telemetryPanel}>
            <div style={summaryRow}><span>Calculated COGS</span> <span>{formatMoney(liveCOGS)}</span></div>
            <div style={summaryRow}><span>Retail Price</span> <span>{formatMoney(draft.rp)}</span></div>
            <div style={profitRow}>
              <span>EST. PROFIT</span> 
              <span style={{ color: liveProfit >= 0 ? '#00FF88' : '#FF3131' }}>{formatMoney(liveProfit)} ({margin}%)</span>
            </div>
          </div>
        </div>

        {/* ======================================= */}
        {/* PANEL 3: MEDIA FORGE & PUBLISH          */}
        {/* ======================================= */}
        <div style={panelStyle}>
          <h3 style={panelTitle}>3. MEDIA FORGE</h3>
          
          <div style={cropperViewport} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileUpload} style={hiddenInput} />
            
            {!rawImage && !finalWebP && <div style={uploadPrompt}>CLICK OR DRAG<br/>HIGH-RES IMAGE</div>}
            
            {/* The final cropped preview */}
            {finalWebP && !rawImage && <img src={finalWebP} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Final WebP" />}
            
            {/* The GPU Pan/Zoom Engine */}
            {rawImage && !finalWebP && (
              <img src={rawImage.src} alt="Crop Engine" draggable={false}
                style={{ position: 'absolute', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
              />
            )}
          </div>

          {rawImage && !finalWebP && (
            <div style={zoomControls}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '9px', fontWeight: 900, marginBottom: '10px' }}>
                <span>ZOOM ENGINE</span> <span style={{ color: '#00F2FF' }}>{(zoom * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: '#D4AF37', cursor: 'ew-resize' }} />
              <button onClick={generateWebP} style={cropBtnStyle}>LOCK & COMPRESS TO WEBP</button>
            </div>
          )}

          <div style={{ flex: 1 }}></div>

          <button onClick={publishAsset} disabled={isSyncing} style={commitBtnStyle(isSyncing)}>
            {isSyncing ? "INJECTING TO VAULT..." : "PUBLISH ASSET TO TERMINALS"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// --- MASTER STYLES: SHAH MARINE THEME ---
// ==========================================

const adminContainer = { padding: '30px', maxWidth: '1800px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' as const, background: 'transparent', fontFamily: 'system-ui, sans-serif' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #222' };
const titleStyle = { fontFamily: 'Cinzel', color: '#D4AF37', margin: '0 0 5px 0', fontSize: '26px', letterSpacing: '2px' };
const subTitleStyle = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px' };

const networkStatusStyle = (isOnline: boolean) => ({ fontSize: '11px', color: isOnline ? '#00FF88' : '#FF3131', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', background: '#111', borderRadius: '8px', border: '1px solid #333' });
const statusDot = (isOnline: boolean) => ({ width: '8px', height: '8px', background: isOnline ? '#00FF88' : '#FF3131', borderRadius: '50%' });

const layoutGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '30px', flex: 1, overflow: 'hidden' };
const panelStyle = { background: '#0a0a0a', borderRadius: '25px', border: '1px solid #222', padding: '30px', display: 'flex', flexDirection: 'column' as const, overflowY: 'auto' as const };
const panelTitle = { color: '#FFF', fontSize: '14px', marginBottom: '25px', borderLeft: '4px solid #D4AF37', paddingLeft: '15px', letterSpacing: '1px' };

const labelStyle = { display: 'block', fontSize: '10px', fontWeight: 900, color: '#666', marginBottom: '8px', letterSpacing: '1px' };
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#FFF', padding: '15px', borderRadius: '10px', outline: 'none', fontSize: '12px', marginBottom: '20px' };
const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'none' as const };
const textAreaStyle = { ...inputStyle, resize: 'none' as const, height: '120px', lineHeight: '1.6' };

const serviceLockout = { padding: '30px', textAlign: 'center' as const, background: 'rgba(0,242,255,0.05)', color: '#00F2FF', border: '1px dashed #00F2FF55', borderRadius: '12px', fontSize: '11px', fontWeight: 900, letterSpacing: '1px' };

const addBtnStyle = { background: '#111', border: '1px solid #D4AF37', color: '#D4AF37', padding: '0 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '11px' };
const bomList = { flex: 1, background: '#000', borderRadius: '12px', border: '1px solid #222', padding: '10px', overflowY: 'auto' as const, marginBottom: '20px' };
const bomRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #111', background: 'transparent', borderRadius: '8px', marginBottom: '5px' };
const removeBtnStyle = { background: 'transparent', border: 'none', color: '#FF3131', cursor: 'pointer', fontWeight: 900, fontSize: '14px' };

const telemetryPanel = { background: '#000', padding: '20px', borderRadius: '15px', border: '1px solid #222', marginTop: 'auto' };
const summaryRow = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '10px' };
const profitRow = { display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 900, color: '#FFF', borderTop: '1px dashed #333', paddingTop: '15px', marginTop: '10px' };

const cropperViewport = { position: 'relative' as const, width: '100%', height: '320px', background: '#111', borderRadius: '20px', border: '2px dashed #444', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', marginBottom: '20px' };
const hiddenInput = { position: 'absolute' as const, zIndex: 10, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' };
const uploadPrompt = { color: '#555', fontSize: '11px', fontWeight: 900, pointerEvents: 'none' as const, textAlign: 'center' as const, lineHeight: '1.5' };
const zoomControls = { background: '#111', padding: '15px', borderRadius: '12px', border: '1px solid #333', marginBottom: '20px' };
const cropBtnStyle = { width: '100%', background: '#00F2FF', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 900, fontSize: '10px', letterSpacing: '1px', marginTop: '15px', cursor: 'pointer' };

const commitBtnStyle = (disabled: boolean) => ({ width: '100%', padding: '22px', background: '#D4AF37', color: '#000', fontWeight: 900, borderRadius: '12px', border: 'none', cursor: 'pointer', letterSpacing: '1px', fontSize: '14px', transition: '0.3s', opacity: disabled ? 0.5 : 1 });
