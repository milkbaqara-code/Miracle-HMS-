// web/app/dashboard/pos/page.tsx
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGlobalSync } from '../context/GlobalSyncContext'; // Iron Law 31 // 🛡️ CDO FIX: The Global Brain Link
import { useCurrencyLang } from './CurrencyLangContext';
import { useToast } from './SovereignToast';
import { useConfirm } from './SovereignConfirm';
import DeptTillPanel from './DeptTillPanel';

import ViewModeBanner, { useViewMode } from './ViewModeBanner';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');


// ==========================================
// --- ENTERPRISE TYPES: MASTER VAULT & POS ---
// ==========================================
interface BOMItem { rawId: string; name: string; qty: number; unit: string; unitCost: number; }
interface Product { id: string; name: string; rp: number; stock: number; min_level: number; unit: string; dept: string; cat: string; img: string; desc: string; type: string; bom: BOMItem[]; cogs: number; barcode?: string; }
interface CartItem extends Product { qty: number; isFOC: boolean; focReason?: string; }
interface FinancialMetrics { subtotal: number; totalCOGS: number; discount: number; vat: number; sc: number; grand: number; trueProfit: number; }
interface OfflineTransaction { id: string; timestamp: string; payload: any; }
interface LiveGuest { id: string; name: string; room: string; }

const TERMINALS = [
  'Z-29-PHARMACY', 'Z-28-SUPPLIES', 'OTC MEDICINES', 'Z-27-PHYSIO', 'Z-26-AMBULANCE', 'Z-17-LABS', 'Z-29-GASTRONOMY', 'Z-3B-RENTAL', 'Z-08-SANITATION', 'REHABILITATION'
];
const ITEMS_PER_PAGE = 40;

interface UniversalPOSProps {
  fixedTerminal?: string;
  fixedTitle?: string;
  fixedSubtitle?: string;
}

export default function UniversalCashierPOS({ fixedTerminal, fixedTitle, fixedSubtitle }: UniversalPOSProps = {}) {
  const isViewMode = useViewMode();
  const { syncPulse, triggerGlobalSync } = useGlobalSync(); // 🛡️ Listening to Zone 05
  const { formatMoney, t } = useCurrencyLang();
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  // ==========================================
  // 1. SYSTEM STATE & UI ROUTING
  // ==========================================
  const [activeTerminal, setActiveTerminal] = useState<string>(fixedTerminal || 'Z-29-PHARMACY');
  const [activeSubDept, setActiveSubDept] = useState<string>('ALL');
  const [networkStatus, setNetworkStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [isKernelSyncing, setIsKernelSyncing] = useState<boolean>(true);
  
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [liveGuests, setLiveGuests] = useState<Record<string, LiveGuest>>({});
  const [offlineQueue, setOfflineQueue] = useState<OfflineTransaction[]>([]);
  const [offlineQueueOpen, setOfflineQueueOpen] = useState(false);

  const [guestType, setGuestType] = useState<'WALK_IN' | 'HOTEL_GUEST' | 'VIP_MEMBER'>('WALK_IN');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD' | 'ROOM_CHARGE'>('CASH');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [authPin, setAuthPin] = useState<string>('');
  const [guestRef, setGuestRef] = useState<string>(''); 
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSyncingHub, setIsSyncingHub] = useState<boolean>(false);
  const [pendingTableOrders, setPendingTableOrders] = useState<any[]>([]);
  const [selectedTableOrderId, setSelectedTableOrderId] = useState<string>('');


  // 🛡️ CDO FIX: Clear search on mount to prevent browser autofill "ADMIN" ghosting
  useEffect(() => { setSearchQuery(''); }, []);


  // ==========================================
  // 2. DUAL NEURAL INGESTION (CATALOG + GUESTS)
  // ==========================================
  const sanitizeStr = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[\r\n]+/gm, '').trim();
  };

  const fetchMasterData = useCallback(async () => {
    setIsKernelSyncing(true);
    try {
      const invRes = await fetch(`${API_BASE}/inventory/live`, { cache: 'no-store' }); 
      if (!invRes.ok) throw new Error("Vault Connection Refused");
      const invData = await invRes.json();
      
      if (invData.status === 'SUCCESS' && Array.isArray(invData.data)) {
        console.log(`🔥 KERNEL TELEMETRY: Received ${invData.data.length} raw items from Vault.`);

        const mappedCatalog: Product[] = invData.data.map((item: any) => {
            const itemBOM: BOMItem[] = item.bom || [];
            
            // 🛡️ CDO FIX: Strict Baseline Financials
            const rawPP = Number(item.pp) || 0;
            const rawFactor = Number(item.factor) || 1;
            const rawMargin = Number(item.margin) || 0;
            
            const calculatedCOGS = itemBOM.length > 0 
              ? itemBOM.reduce((sum: number, b: any) => sum + ((Number(b.qty) || 0) * (Number(b.unitCost) || 0)), 0)
              : rawPP / rawFactor;

            // 🛡️ THE FAILSAFE MAPPER
            const safeDept = item.dept || item.DEPARTMENT || item.department || 'GENERAL';
            const rawDept = sanitizeStr(safeDept).toUpperCase();
            let cleanDept = TERMINALS.includes(rawDept) ? rawDept : rawDept.includes('HOUSEKEEPING') ? 'HK-HOUSEKEEPING' : rawDept.includes('MAINTENANCE') ? 'MAINTENANCE' : rawDept;

            // 🛡️ CDO UPGRADE: POS Unit Economics Mapper
            const trueBulkRP = rawPP + (rawPP * (rawMargin / 100));
            const guaranteedUnitRP = trueBulkRP / rawFactor;

            return {
              id: sanitizeStr(item.id || item.product_id) || `UNK-${Math.random().toString(36).substr(2, 9)}`, 
              name: sanitizeStr(item.name) || 'Unnamed Asset',
              rp: guaranteedUnitRP, 
              stock: Number(item.stock) || 0, min_level: Number(item.min_level) || 0, 
              unit: sanitizeStr(item.s_unit) || 'UNIT', dept: cleanDept, cat: sanitizeStr(item.cat) || 'CONSUMABLE', 
              img: sanitizeStr(item.img) || '', desc: sanitizeStr(item.desc) || 'Premium Resort Selection',
              type: sanitizeStr(item.type).toUpperCase(), barcode: sanitizeStr(item.barcode) || '',
              bom: itemBOM, cogs: Number(calculatedCOGS) || 0
            };
          });
        setCatalog(mappedCatalog);
      }

      // 🛡️ THE MASTER LEDGER FIX: KILLING THE DUMMY GUESTS AND OMNI-VAULT SYNC
      try {
        const guestRes = await fetch(`${API_BASE}/frontdesk/active-in-house`);
        if (!guestRes.ok) throw new Error("API Guest Fetch Failed");
        const guestData = await guestRes.json();
        console.log("🚨 ZONE 06 INGESTION (API /active-in-house):", guestData);
        
        if (guestData.status === 'SUCCESS' && Array.isArray(guestData.data)) {
          const guestObj: Record<string, LiveGuest> = {};
          guestData.data.forEach((g: any) => { 
            const rm = String(g.room);
            const nm = String(g.name);
            // 🛡️ PREVENT GHOST INJECTIONS: Ignore raw reservations sneaking into Folios
            if (rm && nm && nm !== 'NONE' && nm !== 'undefined' && !rm.startsWith('RES-')) {
                guestObj[rm] = { id: rm, name: nm, room: rm }; 
            }
          });
          setLiveGuests(guestObj);
        } else {
          throw new Error("API Failed Status"); // Force fallback ONLY if API explicitly failed
        }
      } catch {
        // 🛡️ CDO PHYSICAL SYNC: THE SINGLE SOURCE OMNI-FETCHER
        // If API fails, MUST FALLBACK EXACTLY TO miracle_folios. NO SCANNING OTHER VAULTS.
        const guestObj: Record<string, LiveGuest> = {};
        
        const foliosVaultStr = localStorage.getItem('miracle_folios') || '[]';
        console.log("🚨 ZONE 06 INGESTION (miracle_folios fallback):", foliosVaultStr);
        let foliosVault = [];
        try {
            const parsed = JSON.parse(foliosVaultStr);
            foliosVault = Array.isArray(parsed) ? parsed : Object.values(parsed);
        } catch { foliosVault = []; }

        foliosVault.forEach((f: any) => {
            const rm = String(f.id || f.room_number || f.room);
            const nm = String(f.guest || f.name || f.guest_name);
            const status = String(f.status || 'IN_HOUSE').toUpperCase();
            
            // 🛡️ PREVENT GHOST INJECTIONS (Local Vault): Enforce strictly IN_HOUSE
            if (rm && nm && nm !== 'NONE' && nm !== 'undefined' && !rm.startsWith('RES-') && status === 'IN_HOUSE') {
                guestObj[rm] = { id: rm, name: nm, room: rm };
            }
        });
        
        setLiveGuests(guestObj);
      }
      
      setNetworkStatus('ONLINE');
    } catch { setNetworkStatus('OFFLINE'); } finally { setIsKernelSyncing(false); }
  }, []);

  // 🌐 SYNC HUB: Push inventory changes to Guest Cloud App
  const pushToGuestHub = async () => {
    setIsSyncingHub(true);
    try {
      // Trigger a global sync pulse so all connected guest apps refresh their catalog
      triggerGlobalSync();
      // Also hit the guest catalog endpoint to warm the cache
      await fetch(`${API_BASE}/guest/catalog`);
      showToast('Sync Hub', 'success', 'Guest Marketing catalog refreshed.');
    } catch {
      showToast('Sync Hub', 'error', 'Failed to push. Check network status.');
    } finally {
      setIsSyncingHub(false);
    }
  };

  const retryOfflineTransaction = async (txn: OfflineTransaction) => {
    try {
      const res = await fetch(`${API_BASE}/pos/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txn.payload) });
      if (res.ok) {
        showToast('Retry Success', 'success', 'Offline transaction synced to Master Kernel.');
        const newQueue = offlineQueue.filter(q => q.id !== txn.id);
        setOfflineQueue(newQueue);
        localStorage.setItem('shah_marine_offline_queue', JSON.stringify(newQueue));
        if (newQueue.length === 0) setOfflineQueueOpen(false);
      } else { showToast('Retry Failed', 'error', 'Kernel rejected transaction.'); }
    } catch(e) { showToast('Retry Failed', 'error', 'Network still offline.'); }
  };

  // 🛡️ CDO TRIGGER: Auto-refresh guests when Z-05 changes
  useEffect(() => { fetchMasterData(); }, [fetchMasterData]); // CDO FIX: Removed syncPulse to prevent infinite loop

  useEffect(() => {
    const savedQueue = localStorage.getItem('shah_marine_offline_queue');
    if (savedQueue) {
      const parsedQueue = JSON.parse(savedQueue);
      if (parsedQueue.length > 0) setOfflineQueue(parsedQueue);
    }
  }, []);

  // Load pending table orders for pharmacy cashier settlement (Z-06 / Z-29 integration)
  const fetchPendingTableOrders = useCallback(async () => {
    if (activeTerminal !== 'Z-29-PHARMACY') return;
    try {
      const res = await fetch(`${API_BASE}/fnb/orders/pending-till`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS' && Array.isArray(data.data)) {
          setPendingTableOrders(data.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch pending table orders:", err);
    }
  }, [activeTerminal]);

  useEffect(() => {
    fetchPendingTableOrders();
    let interval: any;
    if (activeTerminal === 'Z-29-PHARMACY') {
      interval = setInterval(fetchPendingTableOrders, 8000);
    }
    return () => clearInterval(interval);
  }, [activeTerminal, fetchPendingTableOrders]);

  const selectPendingTableOrder = (order: any) => {
    if (!order) {
      setSelectedTableOrderId('');
      setCart([]);
      setGuestRef('');
      return;
    }
    setSelectedTableOrderId(order.id);
    setGuestRef(order.table_label);
    
    // Convert KDS order items to POS cart items
    const newCart: CartItem[] = order.items.map((item: any) => {
      const product = catalog.find(p => p.id === item.id || p.name.toUpperCase() === item.name.toUpperCase());
      if (product) {
        return { ...product, qty: item.qty, isFOC: false };
      }
      return {
        id: item.id || `GEN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: item.name,
        rp: item.price,
        cogs: 0,
        stock: 9999,
        min_level: 0,
        unit: 'QTY',
        dept: 'Z-29-PHARMACY',
        cat: 'F&B',
        img: '',
        desc: 'QR Order Item',
        type: 'SERVICE',
        bom: [],
        qty: item.qty,
        isFOC: false
      };
    });
    setCart(newCart);
    showToast('Order Loaded', 'success', `${order.table_label} loaded into cart.`);
  };


  // Hardware Barcode Scanner Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let timeout: NodeJS.Timeout;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
          const scannedItem = catalog.find(p => p.barcode === barcodeBuffer || p.id === barcodeBuffer);
          if (scannedItem) addToCart(scannedItem);
        }
        barcodeBuffer = '';
      } else {
        barcodeBuffer += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => { barcodeBuffer = ''; }, 50); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [catalog]);

  // SOVEREIGN: Z-29 sub-dept tabs — dynamically generated from live catalog
  // Any dept created in the Architect Engine auto-appears here
  const z29SubDepts = useMemo(() => {
    const depts = new Set<string>();
    catalog.forEach(p => {
      const raw = String(p.dept || '').toUpperCase().trim();
      // Extract suffix from Z-29-XXXX pattern
      const match = raw.match(/^Z-29-(.+)$/);
      if (match) depts.add(match[1].trim());
      // Also handle items directly tagged RESTAURANT, COFFEE & BAR etc (legacy)
      else if (['RESTAURANT','COFFEE & BAR','ROOM SERVICE','MINI SHOP'].includes(raw)) depts.add(raw);
    });
    const ordered = ['RESTAURANT','COFFEE & BAR','ROOM SERVICE','MINI SHOP'];
    const custom = Array.from(depts).filter(d => !ordered.includes(d));
    return ['ALL', ...ordered.filter(d => depts.has(d)), ...custom];
  }, [catalog]);

  // 🛡️ THE GOD-MODE REGEX FILTER ENGINE
  const filteredProducts = useMemo(() => {
    if (!catalog || catalog.length === 0) return [];
    return catalog.filter(p => {
      // IRON LAW: Block RAW_MATERIAL. DB stores 'RAW_MATERIAL' not 'RAW'.
      if (p.type === 'RAW_MATERIAL' || p.type === 'RAW') return false;

      const rawItemDept = String(p.dept || '').toUpperCase().trim();
      const search = searchQuery.toUpperCase().trim();

      // --- Terminal-level filtering ---
      let terminalMatch = false;
      if (activeTerminal === 'Z-29-PHARMACY') {
        terminalMatch = rawItemDept.includes('POS') || rawItemDept.includes('PHARMACY') || rawItemDept.includes('DRUGS') || rawItemDept.startsWith('Z-29-') || rawItemDept === 'RESTAURANT' || rawItemDept === 'COFFEE & BAR' || rawItemDept === 'ROOM SERVICE';
      } else if (activeTerminal === 'Z-28-SUPPLIES') {
        terminalMatch = rawItemDept.includes('BOUTIQUE') || rawItemDept.includes('SUPPLIES') || rawItemDept.startsWith('Z-28-') || rawItemDept.includes('LUXURY') || rawItemDept.includes('EQUIPMENT');
      } else if (activeTerminal === 'Z-17-LABS') {
        terminalMatch = rawItemDept.includes('WELLNESS') || rawItemDept.includes('LAB') || rawItemDept.includes('LIS') || rawItemDept.includes('DIAG') || rawItemDept.startsWith('Z-17-') || rawItemDept.includes('CINE') || rawItemDept.includes('MEDIA');
      } else if (activeTerminal === 'Z-29-GASTRONOMY') {
        terminalMatch = rawItemDept.includes('GASTRONOMY') || rawItemDept.includes('DIET') || rawItemDept.includes('FOOD') || rawItemDept.includes('MEAL');
      } else if (activeTerminal === 'Z-3B-RENTAL') {
        terminalMatch = rawItemDept.includes('RENTAL') || rawItemDept.includes('EQUIPMENT') || rawItemDept.startsWith('Z-3B-');
      } else if (activeTerminal === 'OTC MEDICINES') {
        terminalMatch = rawItemDept.includes('MINI') || rawItemDept.includes('SHOP') || rawItemDept.includes('RETAIL') || rawItemDept.includes('GROCERY') || rawItemDept.includes('OTC') || rawItemDept.includes('MED');
      } else if (activeTerminal === 'Z-27-PHYSIO') {
        terminalMatch = rawItemDept.includes('SPA') || rawItemDept.startsWith('Z-27-') || rawItemDept.includes('PHYSIO');
      } else if (activeTerminal === 'Z-26-AMBULANCE') {
        terminalMatch = rawItemDept.includes('FLEET') || rawItemDept.includes('TRANSPORT') || rawItemDept.startsWith('Z-26-') || rawItemDept.includes('AMBULANCE');
      } else if (activeTerminal === 'Z-08-SANITATION') {
        terminalMatch = rawItemDept.includes('HK') || rawItemDept.includes('HOUSEKEEPING') || rawItemDept.includes('LAUNDRY') || rawItemDept.startsWith('Z-08-') || rawItemDept.includes('SANITA');
      } else if (activeTerminal === 'REHABILITATION') {
        terminalMatch = rawItemDept.includes('POOL') || rawItemDept.includes('GYM') || rawItemDept.includes('FITNESS') || rawItemDept.includes('REHAB');
      } else {
        terminalMatch = rawItemDept.includes(String(activeTerminal).replace(/[^A-Z0-9]/ig, '').toUpperCase());
      }
      if (!terminalMatch) return false;

      // --- Z-29 sub-dept filtering ---
      if (activeTerminal === 'Z-29-PHARMACY' && activeSubDept !== 'ALL') {
        const suffix = rawItemDept.replace(/^Z-29-/, '');
        if (suffix !== activeSubDept && rawItemDept !== activeSubDept) return false;
      }

      if (!search) return true;
      return String(p.name || '').toUpperCase().includes(search) || String(p.id || '').toUpperCase().includes(search);
    });
  }, [catalog, activeTerminal, activeSubDept, searchQuery]);

  // 🛡️ THE ARCHITECTURAL SLICER
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // ==========================================
  // 3. CART & FINANCIAL ENGINE
  // ==========================================
  const addToCart = (product: Product) => { setCart(prev => { const exists = prev.find(i => i.id === product.id); if (exists) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i); return [...prev, { ...product, qty: 1, isFOC: false }]; }); };
  const updateQty = (id: string, delta: number) => { setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item).filter(item => item.qty > 0)); };
  const toggleFOC = (id: string) => { setCart(prev => prev.map(i => i.id === id ? { ...i, isFOC: !i.isFOC } : i)); };
  const voidAll = async () => { 
    const confirmed = await showConfirm({ title: 'SECURITY OVERRIDE', message: 'Authorize full folio void?', icon: '🛡️', options: [{label: 'VOID CART', value: 'yes', variant: 'danger'}, {label: 'CANCEL', value: 'no', variant: 'cancel'}]});
    if (confirmed === 'yes') { setCart([]); setGuestRef(''); } 
  };

  const finance: FinancialMetrics = useMemo(() => {
    const subtotal = cart.reduce((acc, i) => acc + (i.isFOC ? 0 : (Number(i.rp) || 0) * (Number(i.qty) || 1)), 0);
    const totalCOGS = cart.reduce((acc, i) => acc + ((Number(i.cogs) || 0) * (Number(i.qty) || 1)), 0); 
    const discount = guestType === 'VIP_MEMBER' ? subtotal * 0.15 : 0;
    const net = subtotal - discount; const vat = net * 0.15; const sc = net * 0.10;
    return { subtotal, totalCOGS, discount, vat, sc, grand: net + vat + sc, trueProfit: net - totalCOGS };
  }, [cart, guestType]);

  const processSettlement = async () => {
    if (cart.length === 0 || !authPin) { showToast('System Halt', 'error', 'Invalid Session.'); return; }
    if ((paymentMethod === 'ROOM_CHARGE' || guestType === 'HOTEL_GUEST') && !guestRef) { showToast('System Halt', 'error', 'Room Required.'); return; }
    setIsKernelSyncing(true);

    // 🛡️ CDO FIX: CRYPTOGRAPHIC ID
    const txnUuid = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 🛡️ CDO FIX: RECURSIVE BOM ENGINE (Rule 4 & 7)
    const vaultStr = localStorage.getItem('miracle_catalog_vault');
    let localVault = vaultStr ? JSON.parse(vaultStr) : [];
    let updatedStateCatalog = [...catalog];
    
    cart.forEach(cItem => {
      const vProduct = localVault.find((v: any) => v.id === cItem.id);
      if (vProduct) vProduct.stock = Math.max(0, vProduct.stock - cItem.qty);
      
      const sProduct = updatedStateCatalog.find(p => p.id === cItem.id);
      if (sProduct) sProduct.stock = Math.max(0, sProduct.stock - cItem.qty);
      
      if (cItem.bom && cItem.bom.length > 0) {
        cItem.bom.forEach(b => {
          const rawQtyDeduct = b.qty * cItem.qty;
          const vRaw = localVault.find((v: any) => v.id === b.rawId);
          if (vRaw) vRaw.stock = Math.max(0, vRaw.stock - rawQtyDeduct);
          
          const sRaw = updatedStateCatalog.find(p => p.id === b.rawId);
          if (sRaw) sRaw.stock = Math.max(0, sRaw.stock - rawQtyDeduct);
        });
      }
    });
    if (vaultStr) localStorage.setItem('miracle_catalog_vault', JSON.stringify(localVault));
    setCatalog(updatedStateCatalog);

    // 🛡️ CDO FIX: LOCAL FOLIO INJECTOR (Rule 3)
    if (paymentMethod === 'ROOM_CHARGE' && guestRef) {
      const foliosStr = localStorage.getItem('miracle_folios');
      if (foliosStr) {
        let folios = JSON.parse(foliosStr);
        const folio = folios.find((f: any) => f.id === guestRef || f.room === guestRef);
        if (folio) {
          folio.balance = (folio.balance || 0) + finance.grand;
          if (!folio.charges) folio.charges = [];
          cart.forEach(cItem => {
            if (!cItem.isFOC) {
              folio.charges.push({
                id: `CHG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                item: cItem.name,
                amount: cItem.rp * cItem.qty,
                sector: activeTerminal
              });
            }
          });
          localStorage.setItem('miracle_folios', JSON.stringify(folios));
        }
      }
    }

    try {
      const payload = { transaction_id: txnUuid, timestamp: new Date().toISOString(), cashier_pin: authPin, terminal_id: activeTerminal, guest_type: guestType, guest_ref: guestRef, payment_method: paymentMethod, financials: finance, items: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, isFOC: c.isFOC, rp: c.rp, bom: c.bom, cogs: c.cogs, type: c.type })) };
      const res = await fetch(`${API_BASE}/pos/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Sync Failed");

      // Mark QR table order as settled in KDS/F&B engine
      if (selectedTableOrderId) {
        await fetch(`${API_BASE}/fnb/orders/${selectedTableOrderId}/settle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pos_transaction_id: txnUuid })
        });
        setSelectedTableOrderId('');
        fetchPendingTableOrders();
      }

      showToast('Folio Secured', 'success', `Total: ${formatMoney(finance.grand)}`);
      setCart([]); setAuthPin(''); setGuestRef(''); 
      triggerGlobalSync(); // Trigger OS updates globally

    } catch { 
      // 🛡️ CDO FIX: Physical Offline Queue Push
      const payload = { transaction_id: txnUuid, timestamp: new Date().toISOString(), cashier_pin: authPin, terminal_id: activeTerminal, guest_type: guestType, guest_ref: guestRef, payment_method: paymentMethod, financials: finance, items: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, isFOC: c.isFOC, rp: c.rp, bom: c.bom, cogs: c.cogs, type: c.type })) };
      const newQueue = [...offlineQueue, { id: txnUuid, timestamp: payload.timestamp, payload }];
      setOfflineQueue(newQueue);
      localStorage.setItem('shah_marine_offline_queue', JSON.stringify(newQueue));
      showToast('Kernel Offline', 'error', 'Transaction secured to Local Vault.');
      setCart([]); setAuthPin(''); setGuestRef(''); setSelectedTableOrderId('');
    } finally { setIsKernelSyncing(false); }

  };

  // ==========================================
  // 4. MASTER UI RENDER ENGINE (ADVANCED TILL)
  // ==========================================
  return (
    <div className={`pos-app-container ${isViewMode ? 'zone-view-mode' : ''}`}>
      {/* 🛡️ CDO SHIELD: Sacrifice inputs to capture browser autofill "ADMIN" ghosting */}
      <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
        <input type="text" name="miracle_autofill_bait_user" tabIndex={-1} />
        <input type="password" name="miracle_autofill_bait_pass" tabIndex={-1} />
      </div>

      <ViewModeBanner />
      
      {/* CASHIER HUD HEADER */}
      <div className="hud-header">
        <div>
          <h1 className="hud-title">{fixedTitle || 'PHARMACY REVENUE DESK'}</h1>
          <div className="hud-subtitle">
            {fixedSubtitle || 'CLINICAL DISPENSARY | CENTRAL REVENUE SYSTEM'}
            {offlineQueue.length > 0 && <button className="queue-warning" onClick={() => setOfflineQueueOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, textDecoration: 'underline' }}> | {offlineQueue.length} PENDING IN QUEUE</button>}
          </div>
        </div>
        
        <div className="hud-actions">
          <div className={`network-status ${networkStatus === 'ONLINE' ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {networkStatus === 'ONLINE' ? 'SYSTEM ONLINE' : 'OFFLINE MODE'}
          </div>
          <button onClick={fetchMasterData} disabled={isKernelSyncing} className="refresh-btn">
            {isKernelSyncing ? 'SYNCING DATA...' : '🔄 REFRESH DATA'}
          </button>
          <button onClick={pushToGuestHub} disabled={isSyncingHub} className="sync-hub-btn">
            {isSyncingHub ? 'PUSHING...' : '🌐 SYNC HUB'}
          </button>
        </div>
      </div>

      <div className="layout-grid">
        
        {/* ========================================== */}
        {/* LEFT PANEL: PREMIUM E-COMMERCE RETAIL GRID */}
        {/* ========================================== */}
        <div className="left-panel">
          
          {/* Only show terminal tabs if a fixedTerminal is NOT provided */}
          {!fixedTerminal && (
            <div className="terminal-scroll hide-scroll">
              {TERMINALS.map(term => {
                const isActive = activeTerminal === term;
                return (
                  <button 
                    key={term} 
                    onClick={() => { setActiveTerminal(term); setActiveSubDept('ALL'); setSearchQuery(''); setCurrentPage(1); }} 
                    className={`ecommerce-tab ${isActive ? 'active' : ''}`}
                  >
                    {isActive && <div className="tab-glow-dot" />}
                    {term.replace('Z-29-', '').replace('Z-28-', '').replace('Z-27-', '').replace('Z-26-', '').replace('Z-17-', '').replace('Z-08-', '').replace('RS-', '')}
                  </button>
                )
              })}
            </div>
          )}

          {/* Z-29 DYNAMIC SUB-DEPARTMENT TABS — auto-synced from Architect Engine */}
          {activeTerminal === 'Z-29-F & B' && (
            <div className="terminal-scroll hide-scroll" style={{ marginTop: '8px', paddingBottom: '4px' }}>
              {z29SubDepts.map(sub => {
                const isActive = activeSubDept === sub;
                return (
                  <button
                    key={sub}
                    onClick={() => { setActiveSubDept(sub); setCurrentPage(1); }}
                    className={`ecommerce-tab ${isActive ? 'active' : ''}`}
                    style={isActive ? { background: '#D4AF37', color: '#000', fontSize: '10px' } : { fontSize: '10px', opacity: 0.75 }}
                  >
                    {isActive && <div className="tab-glow-dot" style={{ background: '#000' }} />}
                    {sub}
                  </button>
                );
              })}
            </div>
          )}

          <div className="search-container">
            <div className="search-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <input 
              type="search"
              className="search-input"
              name="pos-asset-dna-search"
              autoComplete="new-password"
              data-lpignore="true" 
              spellCheck="false"
              placeholder={`Search ${activeTerminal.replace('RS-', '')} assets by name or SKU...`} 
              value={searchQuery} 
              onChange={e => { setSearchQuery(e.target.value.toUpperCase()); setCurrentPage(1); }} 
            />
          </div>
          
          <div className="product-grid hide-scroll">
            {paginatedProducts.length > 0 ? paginatedProducts.map(p => {
              const isLowStock = p.stock <= p.min_level;
              return (
                <div 
                  key={p.id} 
                  onClick={() => addToCart(p)} 
                  className="premium-product-card" 
                >
                  <div className="card-img-area">
                    {p.img && p.img.length > 3 ? (
                      <img 
                        src={p.img} 
                        alt={p.name} 
                        className="product-img" 
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/240x190?text=NO+IMAGE';
                        }}
                      /> 
                    ) : (
                      <div className="fallback-img">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      </div>
                    )}
                    <div className="floating-price">
                      {formatMoney(p.rp || 0)}
                    </div>
                  </div>
                  
                  <div className="card-info-area">
                    <div style={{ flex: 1 }}>
                      <div className="product-category">{p.cat}</div>
                      <div className="product-title">{p.name}</div>
                      <div className="product-sku">SKU: {p.id}</div>
                    </div>
                    <div className="card-action-row">
                      {/* 🛡️ CDO FIX: Service Stock Indicator UI */}
                      {p.type === 'SERVICE' ? (
                        <div className="stock-indicator" style={{ color: '#00F2FF', background: 'rgba(0, 242, 255, 0.1)', border: '1px solid rgba(0, 242, 255, 0.2)' }}>
                          <span className="stock-dot" style={{ background: '#00F2FF' }}></span>
                          MADE TO ORDER
                        </div>
                      ) : (
                        <div className={`stock-indicator ${isLowStock ? 'stock-low' : 'stock-good'}`}>
                          <span className="stock-dot"></span>
                          {p.stock} {p.unit}
                        </div>
                      )}
                      
                      <div className="add-to-cart-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="empty-grid-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:'20px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <div className="empty-title">NO ASSETS FOUND</div>
                <div className="empty-subtitle">The matrix returned 0 results for this criteria.</div>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="pagination-console">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                className="ecommerce-page-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                PREV
              </button>
              <div className="page-indicator-wrap">
                <div className="page-line"></div>
                <div className="page-text">
                  PAGE <span className="page-highlight">{currentPage}</span> OF <span className="page-highlight">{totalPages}</span>
                </div>
                <div className="page-line"></div>
              </div>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                className="ecommerce-page-btn"
              >
                NEXT
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* RIGHT PANEL: ADVANCED CHECKOUT FOLIO */}
        {/* ========================================== */}
        <div className="glass-panel right-folio-panel">
          
          <div style={folioHeader}>
            <h3 style={folioTitle}>GUEST FOLIO</h3>
            <button onClick={voidAll} className="void-btn" style={voidBtnStyle}>VOID CART</button>
          </div>

          <div style={routeRow}>
            {['WALK_IN', 'HOTEL_GUEST', 'VIP_MEMBER'].map(gt => (
              <button key={gt} onClick={() => setGuestType(gt as any)} style={routeBtn(guestType === gt, '#D4AF37')}>
                {gt.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ ...routeRow, marginBottom: '20px' }}>
            {['CASH', 'CREDIT_CARD', 'ROOM_CHARGE'].map(pm => (
              <button key={pm} onClick={() => setPaymentMethod(pm as any)} style={routeBtn(paymentMethod === pm, '#00F2FF')}>
                {pm === 'ROOM_CHARGE' ? 'MASTER FOLIO CHARGE' : pm.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={refInputRow}>
            {(paymentMethod === 'ROOM_CHARGE' || guestType === 'HOTEL_GUEST') && (
              <select style={refSelectInput} value={guestRef} onChange={e => setGuestRef(e.target.value)}>
                <option value="">-- SELECT OCCUPIED ROOM --</option>
                {Object.entries(liveGuests).map(([rm, guest]) => (
                  <option key={rm} value={rm}>RM {guest.room} - {guest.name}</option>
                ))}
              </select>
            )}
            {guestType === 'VIP_MEMBER' && 
              <input style={refInput} placeholder="SCAN VIP CARD ID" value={guestRef} onChange={e => setGuestRef(e.target.value)} />
            }
          </div>

          {activeTerminal === 'Z-29-F & B' && pendingTableOrders.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '9px', fontWeight: 900, color: '#D4AF37', display: 'block', marginBottom: '6px', letterSpacing: '1px' }}>
                🛎️ ACTIVE QR TABLE ORDERS ({pendingTableOrders.length})
              </label>
              <select 
                style={refSelectInput} 
                value={selectedTableOrderId}
                onChange={e => {
                  const order = pendingTableOrders.find(o => o.id === e.target.value);
                  selectPendingTableOrder(order);
                }}
              >
                <option value="">-- SELECT PENDING TABLE ORDER --</option>
                {pendingTableOrders.map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.table_label} ({o.items.length} items) - {formatMoney(o.subtotal)}
                  </option>
                ))}
              </select>
            </div>
          )}


          <div className="hide-scroll cart-viewport">
            {cart.length === 0 && <div style={{ textAlign: 'center', color: '#444', marginTop: '50px', fontSize: '12px', fontWeight: 900 }}>AWAITING ASSET SELECTIONS...</div>}
            
            {cart.map(item => (
              <div key={item.id} style={cartItemStyle(item.isFOC)}>
                <div style={{ flex: 2 }}>
                  <div style={cartItemTitle}>{item.name} {item.type === 'SERVICE' && <span style={{fontSize: '10px', color: '#00F2FF', marginLeft: '5px'}}>⚙️</span>}</div>
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
                    <label style={focLabel}>
                      <input type="checkbox" checked={item.isFOC} onChange={() => toggleFOC(item.id)} style={{ accentColor: '#00FF88', cursor: 'pointer', transform: 'scale(1.2)' }} /> FOC / COMP
                    </label>
                  </div>
                </div>
                
                <div style={qtyControl}>
                  <button style={qtyBtnStyle} onClick={() => updateQty(item.id, -1)}>-</button>
                  <b style={qtyText}>{item.qty}</b>
                  <button style={qtyBtnStyle} onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
                
                <div style={cartPrice(item.isFOC)}>
                  {item.isFOC ? 'COMP' : formatMoney((item.rp || 0) * (item.qty || 1))}
                </div>
              </div>
            ))}
          </div>

          <div style={summaryPanel}>
            <div style={summaryRow}><span>Subtotal</span> <span>{formatMoney(finance.subtotal || 0)}</span></div>
            {finance.discount > 0 && <div style={vipRow}><span>VIP Privilege (15%)</span> <span>-{formatMoney(finance.discount || 0)}</span></div>}
            <div style={summaryRow}><span>Tourism & VAT (15%)</span> <span>{formatMoney(finance.vat || 0)}</span></div>
            <div style={summaryRow}><span>Service Charge (10%)</span> <span>{formatMoney(finance.sc || 0)}</span></div>
            <div style={totalRow}>
              <span>TOTAL DUE</span> <span style={{ color: '#00F2FF', textShadow: '0 0 10px rgba(0,242,255,0.5)' }}>{formatMoney(finance.grand || 0)}</span>
            </div>
          </div>

          <div style={pinRow}>
            <input type="password" style={pinInputStyle} placeholder="STAFF PIN REQUIRED" value={authPin} onChange={e => setAuthPin(e.target.value)} />
          </div>

          <button onClick={processSettlement} disabled={isKernelSyncing} className="glow-btn commit-btn" style={commitBtnStyle(isKernelSyncing)}>
            {isKernelSyncing ? "PROCESSING..." : "CONFIRM SECURE TICKET"}
          </button>
        </div>
      </div>

      {/* OFFLINE QUEUE DRAWER */}
      {offlineQueueOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#0A0A0A', border: '1px solid #FF3131', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,49,49,0.3)', paddingBottom: '10px' }}>
              <h2 style={{ color: '#FF3131', margin: 0, fontSize: '18px', fontFamily: 'Cinzel', fontWeight: 900 }}>OFFLINE QUEUE ({offlineQueue.length})</h2>
              <button onClick={() => setOfflineQueueOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {offlineQueue.map(txn => (
                <div key={txn.id} style={{ background: 'rgba(255,49,49,0.05)', border: '1px solid rgba(255,49,49,0.2)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{new Date(txn.timestamp).toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 900 }}>{txn.payload.terminal_id}</div>
                    <div style={{ fontSize: '12px', color: '#00F2FF' }}>{formatMoney(txn.payload.financials.grand)}</div>
                  </div>
                  <button onClick={() => retryOfflineTransaction(txn)} style={{ background: '#FF3131', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}>
                    RETRY SYNC
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 5. MASTER E-COMMERCE CSS ARCHITECTURE */}
      {/* ========================================== */}
      <style dangerouslySetInnerHTML={{__html: `
        /* CORE SCROLLBAR CONTROL */
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* BASE APP LAYOUT */
        .pos-app-container { padding: 10px; max-width: 1920px; margin: 0 auto; min-height: 100vh; height: auto; display: flex; flex-direction: column; background: #030303; font-family: system-ui, sans-serif; overflow-y: auto; overflow-x: hidden; }
        .layout-grid { display: grid; grid-template-columns: 1.8fr 1fr; gap: 12px; flex: 1; min-width: 0; }
        .left-panel { display: flex; flex-direction: column; height: 100%; padding-right: 5px; min-width: 0; }
        
        /* HEADER HUD */
        .hud-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .hud-title { font-family: 'Cinzel'; color: #FFF; margin: 0 0 5px 0; font-size: 24px; letter-spacing: 3px; text-shadow: 0 2px 10px rgba(255,255,255,0.1); }
        .hud-subtitle { color: #00F2FF; font-size: 10px; font-weight: 900; letter-spacing: 2px; }
        .queue-warning { color: #FF3131; margin-left: 10px; }
        .hud-actions { display: flex; align-items: center; gap: 15px; }
        .network-status { font-size: 12px; font-weight: 900; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); }
        .network-status.online { color: #00FF88; border-color: rgba(0,255,136,0.2); }
        .network-status.offline { color: #FF3131; border-color: rgba(255,49,49,0.2); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor; }
        .refresh-btn { background: #111; color: #FFF; border: 1px solid #333; padding: 12px 25px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 900; letter-spacing: 1px; transition: 0.3s; }
        .refresh-btn:hover:not(:disabled) { background: #222; border-color: #555; }
        .sync-hub-btn { background: rgba(0,242,255,0.05); color: #00F2FF; border: 1px solid rgba(0,242,255,0.3); padding: 12px 25px; border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 900; letter-spacing: 1px; transition: 0.3s; animation: sync-pulse 2s infinite; }
        .sync-hub-btn:hover:not(:disabled) { background: rgba(0,242,255,0.15); box-shadow: 0 0 20px rgba(0,242,255,0.3); }
        .sync-hub-btn:disabled { opacity: 0.5; cursor: wait; animation: none; }
        @keyframes sync-pulse { 0% { box-shadow: 0 0 0 0 rgba(0,242,255,0.3); } 70% { box-shadow: 0 0 0 8px rgba(0,242,255,0); } 100% { box-shadow: 0 0 0 0 rgba(0,242,255,0); } }

        /* TILL TERMINAL TABS — Sleeker Pills */
        .terminal-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 15px; flex-shrink: 0; }
        .ecommerce-tab { padding: 12px 20px; background: #0A0A0A; border: 1px solid rgba(255,255,255,0.05); color: #666; border-radius: 30px; font-size: 11px; font-weight: 900; letter-spacing: 1px; cursor: pointer; transition: 0.3s; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
        .ecommerce-tab.active { background: #D4AF37; border-color: #D4AF37; color: #000; box-shadow: 0 4px 20px rgba(212,175,55,0.25); }
        .ecommerce-tab:hover:not(.active) { background: rgba(255,255,255,0.05); color: #FFF; }
        .tab-glow-dot { width: 4px; height: 4px; border-radius: 50%; background: #000; }

        /* ADVANCED SEARCH INPUT */
        .search-container { position: relative; margin-bottom: 25px; flex-shrink: 0; }
        .search-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: #00F2FF; font-size: 18px; pointer-events: none; }
        .search-input { width: 100%; height: 56px; background: rgba(10, 10, 10, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: #FFF; padding: 0 20px 0 55px; font-size: 15px; font-weight: 500; outline: none; backdrop-filter: blur(10px); transition: border 0.3s ease, box-shadow 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
        .search-input:focus { border-color: #00F2FF; box-shadow: 0 0 0 3px rgba(0, 242, 255, 0.1), inset 0 2px 4px rgba(0,0,0,0.3); }

        /* THE GRID CONTAINER */
        .product-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; align-content: start; overflow-y: auto; padding-bottom: 14px; min-height: 400px; }
        .empty-grid-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; background: rgba(10,10,10,0.5); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1); }
        .empty-title { color: #FFF; font-size: 18px; font-weight: 800; letter-spacing: 1px; }
        .premium-product-card { background: #0A0A0A; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; height: 260px; position: relative; }
        .premium-product-card:hover { transform: scale(1.02); border-color: #00F2FF; box-shadow: 0 10px 30px -10px rgba(0, 242, 255, 0.3); }
        
        /* CARD IMAGE AREA */
        .card-img-area { height: 140px; width: 100%; background: #000; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .product-img { width: 100%; height: 100%; object-fit: cover; }
        .floating-price { position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); color: #00F2FF; padding: 6px 12px; border-radius: 12px; font-weight: 900; font-size: 15px; letter-spacing: 0.5px; z-index: 10; }

        /* CARD INFO AREA */
        .card-info-area { padding: 12px; display: flex; flex-direction: column; flex: 1; }
        .product-category { color: #888; font-size: 8px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
        .product-title { color: #FFF; font-size: 14px; font-weight: 800; line-height: 1.3; margin-bottom: 6px; text-transform: uppercase; }
        .product-sku { color: #333; font-size: 8px; font-weight: 900; font-family: monospace; letter-spacing: 1px; }

        /* CARD BOTTOM ACTION ROW */
        .card-action-row { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); }
        .stock-indicator { display: flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 800; letter-spacing: 0.5px; padding: 3px 6px; border-radius: 5px; }
        .stock-good { color: #00FF88; background: rgba(0, 255, 136, 0.08); }
        .stock-low { color: #FF3131; background: rgba(255, 49, 49, 0.08); }
        .stock-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .add-to-cart-btn { width: 36px; height: 36px; border-radius: 10px; background: #111; border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: #FFF; transition: all 0.2s ease; }
        .premium-product-card:hover .add-to-cart-btn { background: #00F2FF; color: #000; border-color: #00F2FF; box-shadow: 0 0 15px rgba(0, 242, 255, 0.4); }

        /* EXECUTIVE PAGINATION CONSOLE */
        .pagination-console { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: rgba(15, 15, 15, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.08); border-radius: 16px; margin-top: 15px; flex-shrink: 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.5); }
        .ecommerce-page-btn { display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #FFF; border-radius: 12px; font-weight: 800; font-size: 12px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s ease; min-width: 120px; justify-content: center; }
        .ecommerce-page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
        .ecommerce-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-indicator-wrap { display: flex; align-items: center; gap: 15px; }
        .page-line { height: 1px; width: 30px; background: rgba(255,255,255,0.1); }
        .page-text { color: #888; font-size: 12px; font-weight: 800; letter-spacing: 2px; }
        .page-highlight { color: #FFF; font-size: 16px; margin: 0 4px; }

        /* CART FOLIO PRESERVED STYLES */
        .right-folio-panel { border-radius: 16px; padding: 15px; display: flex; flex-direction: column; background: #080808; height: fit-content; border: 1px solid rgba(255,255,255,0.08); position: sticky; top: 10px; min-width: 0; }
        .glass-panel { background: linear-gradient(145deg, rgba(15,15,15,0.9), rgba(5,5,5,0.9)); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); }
        .void-btn:hover { background: rgba(255,49,49,0.1) !important; }
        .cart-viewport { max-height: 180px; overflow-y: auto; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-right: 5px; }
        .glow-btn { transition: 0.3s all ease; }
        .glow-btn:hover:not(:disabled) { box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); transform: scale(1.02); }
      `}} />

      {/* ═══════════════════════════════════════════════════════════
          Z-06 DEPARTMENT TILL VAULT (Phase 6B — Iron Laws 64/65/68)
          Compact mode: revenue/expense/batch embedded in POS zone
      ═══════════════════════════════════════════════════════════ */}
      <div style={{ padding: '16px 16px 32px', marginTop: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: 'rgba(0,242,255,0.5)', marginBottom: 10 }}>
          🏦 Z-06 POS VAULT — DEPARTMENT TILL
        </div>
        <DeptTillPanel
          deptId={activeTerminal.startsWith('Z-29') ? 'DEPT_FB' :
                  activeTerminal.startsWith('Z-27') ? 'DEPT_WELLNESS' :
                  activeTerminal.startsWith('Z-28') ? 'DEPT_BOUTIQUE' : 'DEPT_POS'}
          deptName={`${activeTerminal} — Till`}
          callerRole={typeof window !== 'undefined' ? (localStorage.getItem('miracle_role') || 'STAFF') : 'STAFF'}
          callerId={typeof window !== 'undefined' ? (localStorage.getItem('miracle_user_id') || 'unknown') : 'unknown'}
          callerUsername={typeof window !== 'undefined' ? (localStorage.getItem('miracle_username') || 'staff') : 'staff'}
          compact={true}
        />
      </div>
    </div>
  );
}

// ==========================================
// --- PRESERVED CART STYLES ---
// ==========================================
const folioHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' };
const folioTitle = { fontFamily: 'Cinzel', color: '#FFF', margin: 0, fontSize: '15px', letterSpacing: '1px' };
const voidBtnStyle = { background: 'transparent', border: '1px solid rgba(255,49,49,0.2)', color: '#FF3131', fontSize: '9px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 900, transition: '0.3s all ease', letterSpacing: '0.5px' };
const routeRow = { display: 'flex', gap: '4px', marginBottom: '8px' };
const routeBtn = (active: boolean, activeBg: string) => ({ flex: 1, padding: '8px', background: active ? activeBg : 'rgba(255,255,255,0.02)', color: active ? '#000' : '#666', border: `1px solid ${active ? activeBg : 'rgba(255,255,255,0.03)'}`, borderRadius: '8px', fontSize: '9px', fontWeight: 900, cursor: 'pointer', transition: '0.2s', letterSpacing: '0.5px' });
const refInputRow = { marginBottom: '10px', display: 'flex', gap: '8px', minHeight: '35px' };
const refInput = { flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', outline: 'none', fontSize: '11px' };
const refSelectInput = { flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid #D4AF37', padding: '8px 12px', borderRadius: '8px', color: '#D4AF37', outline: 'none', fontSize: '11px', fontWeight: 900, cursor: 'pointer' };
const cartItemStyle = (isFOC: boolean) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', background: isFOC ? 'rgba(0,255,136,0.02)' : 'transparent', opacity: isFOC ? 0.6 : 1, transition: '0.2s', margin: '2px 0' });
const cartItemTitle = { color: '#FFF', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' as const };
const focLabel = { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 900, letterSpacing: '0.5px', color: '#555', fontSize: '8px' };
const qtyControl = { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' };
const qtyBtnStyle = { background: 'transparent', border: 'none', color: '#00F2FF', fontSize: '14px', cursor: 'pointer', fontWeight: 900, padding: '0 2px' };
const qtyText = { color: '#FFF', fontSize: '11px', width: '16px', textAlign: 'center' as const };
const cartPrice = (isFOC: boolean) => ({ width: '60px', textAlign: 'right' as const, color: isFOC ? '#00FF88' : '#FFF', fontWeight: 900, fontSize: '11px', letterSpacing: '0.5px' });
const summaryPanel = { background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.04)' };
const summaryRow = { display: 'flex', justifyContent: 'space-between', color: '#777', fontSize: '10px', marginBottom: '6px', fontWeight: 900, letterSpacing: '0.5px' };
const vipRow = { display: 'flex', justifyContent: 'space-between', color: '#D4AF37', fontSize: '10px', marginBottom: '6px', fontWeight: 900, letterSpacing: '0.5px' };
const totalRow = { display: 'flex', justifyContent: 'space-between', color: '#FFF', fontSize: '14px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)', fontWeight: 900, fontFamily: 'Cinzel' };
const pinRow = { marginBottom: '10px' };
const pinInputStyle = { width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,49,49,0.2)', color: '#FF3131', padding: '12px', borderRadius: '8px', outline: 'none', fontSize: '13px', textAlign: 'center' as const, letterSpacing: '4px', fontWeight: 900 };
const commitBtnStyle = (syncing: boolean) => ({ width: '100%', padding: '12px', background: syncing ? '#333' : '#00F2FF', color: '#000', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', cursor: syncing ? 'wait' : 'pointer', boxShadow: syncing ? 'none' : '0 4px 10px rgba(0,242,255,0.2)' });
