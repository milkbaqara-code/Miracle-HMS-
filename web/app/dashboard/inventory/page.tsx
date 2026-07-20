'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useToast } from '../../components/SovereignToast';
import { usePrompt } from '../../components/SovereignPrompt';
import WastageAuditLog from '../../components/WastageAuditLog';

// --- ENTERPRISE TYPES (THUMB RULE 1: STRICT DATA CONTRACTS) ---
interface BOMItem { rawId: string; name: string; qty: number; unit: string; unitCost: number; }

interface InventoryItem {
  id: string;
  name: string;
  type: 'RAW' | 'PRODUCT' | 'SERVICE';
  cat: 'CONSUMABLE' | 'FIXED' | 'PERISHABLE';
  dept: string; 
  pp: number;          
  rp: number;          
  stock: number;        
  min_level: number;    
  p_unit: string;       
  s_unit: string;       
  factor: number;       
  margin: string; // 🛡️ Hardlocked as String to match PostgreSQL VARCHAR
  img?: string; 
  barcode?: string;
  bom?: BOMItem[];
  vendor?: string;
  expiry?: string;
  weight?: string;
  desc?: string;
  shelf_location?: string;
  active_ingredient?: string;
  dosage_form?: string;
}

const TERMINALS = ['DEPT_POS', 'DEPT_WELLNESS', 'DEPT_GASTRONOMY', 'DEPT_BOUTIQUE', 'DEPT_RENTAL', 'GENERAL'];

import { useCurrencyLang } from '../../components/CurrencyLangContext';

const ITEMS_PER_PAGE = 50;

// 🛡️ SMART ASSET CLEANER: Extracts raw URL from Markdown/HTML snippets
const cleanImgUrl = (input: string): string => {
  if (!input) return "";
  let trimmed = input.trim();
  // 1. Strip Markdown ![]() or []()
  const mdMatch = trimmed.match(/\(+(https?:\/\/[^\s)]+)\)+/i);
  if (mdMatch) trimmed = mdMatch[1].trim();
  // 2. Strip HTML <img src="...">
  const htmlMatch = trimmed.match(/src=["'](https?:\/\/[^"']+)["']/i);
  if (htmlMatch) trimmed = htmlMatch[1].trim();
  
  // 🛡️ Google Drive Direct Link Converter (V2 - High Reliability)
  if (trimmed.includes("drive.google.com") || trimmed.includes("google.com")) {
    const driveMatch = trimmed.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/i);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  
  return trimmed;
};

export default function SovereignInventoryNexus() {
  const { currency, formatMoney, t } = useCurrencyLang();
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  const { showPrompt } = usePrompt();
  const [activeTab, setActiveTab] = useState<'VAULT' | 'REGISTER' | 'MASS_INGESTION' | 'RECEIVING_BAY' | 'SUPPLY_CHAIN' | 'IMPORT_EXPORT'>('VAULT');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWastage, setShowWastage] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // --- SUPPLY CHAIN STATES ---
  const [supplyNodes, setSupplyNodes] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  
  // Forms
  const [poForm, setPoForm] = useState({ po_number: '', vendor_id: '', delivery_node_id: 'NODE_DOCK', total_amount: 0 });
  const [matchForm, setMatchForm] = useState({ po_number: '', vendor_invoice_ref: '', receiving_dock_log_id: '', matching_amount: 0, product_id: '', qty_received: 0, batch_number: '', expiry_date: '', unit_cost: 0, operator_id: 'STAFF_RECV' });
  const [transferForm, setTransferForm] = useState({ source_node_id: 'NODE_DOCK', dest_node_id: 'NODE_PHARMACY', product_id: '', batch_number: '', qty_transferred: 0, operator_id: 'STAFF_TRANS' });

  const fetchSupplyChainData = useCallback(async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
      const nodesRes = await fetch(`${apiBase}/inventory/nodes`);
      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setSupplyNodes(data.nodes || []);
      }
      const allocsRes = await fetch(`${apiBase}/inventory/vault-allocations`);
      if (allocsRes.ok) {
        const data = await allocsRes.json();
        setAllocations(data.allocations || []);
      }
    } catch (err) {
      console.error("Failed to fetch supply chain data", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'SUPPLY_CHAIN') {
      fetchSupplyChainData();
    }
  }, [activeTab, fetchSupplyChainData]);
  
  // 🛡️ ADVANCED UI STATE
  const [vaultSearch, setVaultSearch] = useState(''); 
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [draftEdits, setDraftEdits] = useState<Record<string, InventoryItem>>({});

  // ==========================================
  // 1. THE KERNEL SYNC ENGINE
  // ==========================================
  const fetchGlobalInventory = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/live`);
      if (!res.ok) throw new Error("Vault Connection Refused");
      const data = await res.json();
      
      if (data.status === 'SUCCESS' && data.data) {
        // 🛡️ RESTORED FULL MAPPING TO PREVENT GHOST DROPS
        const sanitizedData = data.data.map((item: any) => ({
            ...item,
            id: String(item.id || item.product_id).trim(), 
            dept: item.dept || 'GENERAL',
            cat: item.cat || 'CONSUMABLE',
            type: item.type || 'PRODUCT',
            margin: String(item.margin || '0.0'),
            bom: item.bom || []
        }));
        
        setInventory(sanitizedData);
        setDraftEdits({}); 
      }
    } catch (e) {
      console.error("🚨 KERNEL OFFLINE: Zone 12 Unreachable.");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { fetchGlobalInventory(); }, [fetchGlobalInventory]);

  const formatFinance = (bdtAmount: number, isUnitCost = false) => {
    return formatMoney(bdtAmount, { decimals: isUnitCost ? 2 : 0 });
  };

  // ==========================================
  // 🛡️ FINANCIAL AUTO-BALANCING ENGINE
  // ==========================================
  const handleInlineEdit = (id: string, field: keyof InventoryItem, value: any) => {
    const originalItem = inventory.find(i => i.id === id);
    if (!originalItem) return;

    const valueToSet = field === 'img' ? cleanImgUrl(value) : value;
    const updatedDraft = { ...(draftEdits[id] || originalItem), [field]: valueToSet };

    const pp = Number(updatedDraft.pp) || 0;
    const factor = Number(updatedDraft.factor) || 1;
    const unitCost = pp / factor;

    if (field === 'pp' || field === 'margin' || field === 'factor') {
        const marg = Number(updatedDraft.margin) || 0;
        updatedDraft.rp = Number((unitCost + (unitCost * (marg / 100))).toFixed(2));
    } 
    else if (field === 'rp') {
        const rp = Number(value) || 0;
        updatedDraft.margin = unitCost > 0 ? (((rp - unitCost) / unitCost) * 100).toFixed(1) : '100.0';
    }

    setDraftEdits(prev => ({ ...prev, [id]: updatedDraft }));
  };

  const handleImageEdit = async (id: string, currentImg: string) => {
    const newImg = await showPrompt({
      title: 'UPDATE IMAGE',
      message: 'Enter new Image URL / Path:',
      defaultValue: currentImg || ''
    });
    if (newImg !== null) handleInlineEdit(id, 'img', newImg);
  };

  // ==========================================
  // 🛡️ THE COMMAND & CONTROL SYNC
  // ==========================================
  const handleMasterSync = async () => {
    const itemsToSync = Object.values(draftEdits);
    if (itemsToSync.length === 0) return;
    
    setIsSyncing(true);
    try {
      // 🛡️ CDO FIX: RACE CONDITION GUARD
      // Fetch the latest stock from DB BEFORE syncing. Merge fresh stock into drafts
      // so POS deductions are never overwritten by stale UI state.
      let freshStockMap: Record<string, number> = {};
      try {
        const freshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/live`);
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          if (freshData.data) {
            freshData.data.forEach((item: any) => {
              freshStockMap[String(item.id || item.product_id)] = Number(item.stock) || 0;
            });
          }
        }
      } catch { /* If refresh fails, backend protected stock logic still guards */ }

      // Merge: use fresh DB stock for each draft item
      const protectedItems = itemsToSync.map(draft => ({
        ...draft,
        stock: freshStockMap[draft.id] !== undefined ? freshStockMap[draft.id] : draft.stock
      }));

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/bulk-register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(protectedItems)
      });
      if (!res.ok) throw new Error(await res.text());
      
      showToast('MASTER SYNC COMPLETE', 'success', 'Matrix Locked.');
      await fetchGlobalInventory(); 
      
    } catch (e: any) {
      showToast('SYNC FAILED', 'error', e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiBase}/inventory/purchase-orders/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poForm)
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('PO CREATED', 'success', `PO ${poForm.po_number} successfully registered.`);
      setPoForm({ po_number: '', vendor_id: '', delivery_node_id: 'NODE_DOCK', total_amount: 0 });
      fetchSupplyChainData();
    } catch (err: any) {
      showToast('PO CREATION FAILED', 'error', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleThreeWayMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiBase}/inventory/three-way-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchForm)
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('RECEIPT COMPLETED', 'success', `Stock received into loading dock.`);
      setMatchForm({ po_number: '', vendor_invoice_ref: '', receiving_dock_log_id: '', matching_amount: 0, product_id: '', qty_received: 0, batch_number: '', expiry_date: '', unit_cost: 0, operator_id: 'STAFF_RECV' });
      fetchSupplyChainData();
      fetchGlobalInventory();
    } catch (err: any) {
      showToast('MATCH FAILED', 'error', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiBase}/inventory/transfers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferForm)
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('TRANSFER COMPLETED', 'success', `Stock transfer successfully dispatched.`);
      setTransferForm({ source_node_id: 'NODE_DOCK', dest_node_id: 'NODE_PHARMACY', product_id: '', batch_number: '', qty_transferred: 0, operator_id: 'STAFF_TRANS' });
      fetchSupplyChainData();
      fetchGlobalInventory();
    } catch (err: any) {
      showToast('TRANSFER FAILED', 'error', err.message);
    } finally {
      setIsSyncing(false);
    }
  };


  // ==========================================
  // GOD-MODE MATRIX FILTERS
  // ==========================================
  const filteredVault = useMemo(() => {
    let result = inventory;
    if (deptFilter !== 'ALL') result = result.filter(i => i.dept.includes(deptFilter));
    if (typeFilter !== 'ALL') result = result.filter(i => i.type === typeFilter);
    if (vaultSearch) {
        const query = vaultSearch.toLowerCase();
        result = result.filter(i => i.name.toLowerCase().includes(query) || i.id.toLowerCase().includes(query));
    }
    return result;
  }, [inventory, deptFilter, typeFilter, vaultSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredVault.length / ITEMS_PER_PAGE));
  const paginatedVault = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredVault.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVault, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [vaultSearch, deptFilter, typeFilter]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (filteredVault.length > 0) {
      if (!filteredVault.some(i => i.id === selectedItemId)) {
        setSelectedItemId(filteredVault[0].id);
      }
    } else {
      setSelectedItemId(null);
    }
  }, [vaultSearch, filteredVault, selectedItemId]);

  const activeLocItem = useMemo(() => {
    return inventory.find(i => i.id === selectedItemId) || filteredVault[0];
  }, [inventory, selectedItemId, filteredVault]);

  const parsedLocation = useMemo(() => {
    if (!activeLocItem || !activeLocItem.shelf_location) return null;
    const loc = activeLocItem.shelf_location.toUpperCase();
    
    // RACK-P12-S3
    const match = loc.match(/RACK-([A-Z])([0-9]+)-S([0-9]+)/);
    if (match) {
      return {
        aisle: match[1],
        rackNum: parseInt(match[2], 10),
        shelfLevel: parseInt(match[3], 10),
        raw: loc
      };
    }
    
    // RACK-SURG05
    const surgMatch = loc.match(/RACK-(SURG|SAN|MED|EQP)([0-9]+)/);
    if (surgMatch) {
      return {
        aisle: surgMatch[1],
        rackNum: parseInt(surgMatch[2], 10),
        shelfLevel: 1,
        raw: loc
      };
    }
    
    return {
      aisle: loc.replace('RACK-', '').slice(0, 4),
      rackNum: 1,
      shelfLevel: 1,
      raw: loc
    };
  }, [activeLocItem]);

  const vaultMetrics = useMemo(() => {
    let totalAssets = 0; let potentialRevenue = 0; let lowStockCount = 0;
    inventory.forEach(item => {
      if (item.type !== 'SERVICE') {
          const actualUnitCost = item.pp / (item.factor || 1);
          totalAssets += (actualUnitCost * item.stock);
          potentialRevenue += (item.rp * item.stock);
          if (item.stock <= item.min_level) lowStockCount++;
      }
    });
    return { totalAssets, potentialRevenue, projectedProfit: potentialRevenue - totalAssets, lowStockCount };
  }, [inventory]);

  // ==========================================
  // 2. REGISTRATION & BOM LAB
  // ==========================================
  const [regType, setRegType] = useState<'RAW' | 'PRODUCT' | 'SERVICE'>('RAW');
  const [formData, setFormData] = useState({
    id: '', name: '', dept: 'DEPT_POS', cat: 'CONSUMABLE',
    pp: 0, rp: 0, p_unit: 'BOX-12', s_unit: 'PCS', factor: 12,
    min_level: 5, vendor: '', expiry: '', weight: '', desc: '', img: '',
    shelf_location: '', active_ingredient: '', dosage_form: 'TABLET'
  });
  
  const [currentBOM, setCurrentBOM] = useState<BOMItem[]>([]);
  const [bomSearch, setBomSearch] = useState('');
  const [overrideSearch, setOverrideSearch] = useState('');

  const unitCost = useMemo(() => formData.pp / (formData.factor || 1), [formData.pp, formData.factor]);

  const currentMargin = useMemo((): string => {
    const cost = regType === 'RAW' ? unitCost : currentBOM.reduce((s, i) => s + (i.unitCost * i.qty), 0);
    if (cost <= 0) return "0.0";
    return (((formData.rp - cost) / cost) * 100).toFixed(1);
  }, [unitCost, formData.rp, currentBOM, regType]);

  const loadAssetForOverride = (asset: InventoryItem) => {
      setRegType(asset.type);
      setFormData({
          id: asset.id, name: asset.name, dept: asset.dept, cat: asset.cat,
          pp: asset.pp, rp: asset.rp, p_unit: asset.p_unit, s_unit: asset.s_unit,
          factor: asset.factor, min_level: asset.min_level, vendor: asset.vendor || '',
          expiry: asset.expiry || '', weight: asset.weight || '', desc: asset.desc || '', img: asset.img || '',
          shelf_location: asset.shelf_location || '', active_ingredient: asset.active_ingredient || '', dosage_form: asset.dosage_form || 'TABLET'
      });
      setCurrentBOM(asset.bom || []);
      setOverrideSearch('');
  };

  const addIngredient = (rawItem: InventoryItem) => {
    if (currentBOM.find(i => i.rawId === rawItem.id)) return;
    setCurrentBOM([...currentBOM, { rawId: rawItem.id, name: rawItem.name, qty: 1, unit: rawItem.s_unit, unitCost: rawItem.pp / (rawItem.factor || 1) }]);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    const newId = formData.id || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload: InventoryItem = { ...formData, id: newId, type: regType, cat: formData.cat as any, margin: currentMargin, bom: currentBOM, stock: 0 };
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/bulk-register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([payload])
      });
      if (!res.ok) throw new Error("Backend Rejected Registration");
      await fetchGlobalInventory();
      showToast('ASSET COMMITTED TO KERNEL', 'success', newId);
      setFormData({ id: '', name: '', dept: 'DEPT_POS', cat: 'CONSUMABLE', pp: 0, rp: 0, p_unit: 'BOX-12', s_unit: 'PCS', factor: 12, min_level: 5, vendor: '', expiry: '', weight: '', desc: '', img: '', shelf_location: '', active_ingredient: '', dosage_form: 'TABLET' });
      setCurrentBOM([]);
      setActiveTab('VAULT');
    } catch (e) { 
      showToast('KERNEL OFFLINE', 'error', 'Sync Failed.'); 
    } finally { setIsSyncing(false); }
  };

  // ==========================================
  // 3. RECEIVING BAY STATE
  // ==========================================
  const [receiveForm, setReceiveForm] = useState({ id: '', p_qty: 0, supplier: '', invoice: '', expiry: '' });

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.id || receiveForm.p_qty <= 0) {
      showToast('AUDIT ERROR', 'warning', 'Invalid SKU or Quantity.');
      return;
    }
    const targetItem = inventory.find(i => i.id === receiveForm.id);
    if (!targetItem) {
      showToast('KERNEL REJECTED', 'error', 'SKU not found in Master Vault.');
      return;
    }

    const addedSalesUnits = receiveForm.p_qty * targetItem.factor;
    const updatedStock = targetItem.stock + addedSalesUnits;
    
    setIsSyncing(true);
    try {
      const payload = { ...targetItem, stock: updatedStock, vendor: receiveForm.supplier, expiry: receiveForm.expiry };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/bulk-register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify([payload])
      });
      if (!res.ok) throw new Error("DB Save Failed");
      
      await fetchGlobalInventory();
      showToast('INBOUND LOGISTICS CONFIRMED', 'success', `Received ${receiveForm.p_qty} ${targetItem.p_unit}. Converted to ${addedSalesUnits} ${targetItem.s_unit} for POS. New Total Stock: ${updatedStock}`);
      setReceiveForm({ id: '', p_qty: 0, supplier: '', invoice: '', expiry: '' });
      setActiveTab('VAULT');
    } catch (e) { 
      showToast('SYNC ERROR', 'error', 'Failed to register inbound stock.'); 
    } finally { setIsSyncing(false); }
  };

  // ==========================================
  // 4. SPREADSHEET ENGINE
  // ==========================================
  const generateEmptyRow = (): InventoryItem => ({
    id: `SKU-${Math.floor(1000 + Math.random() * 9000)}`, name: '', type: 'PRODUCT', cat: 'CONSUMABLE', dept: 'MINI SHOP',
    pp: 0, rp: 0, stock: 0, min_level: 5, p_unit: 'BOX', s_unit: 'PCS', factor: 1, margin: '0.0', img: '', bom: []
  });

  const [sheetData, setSheetData] = useState<InventoryItem[]>([generateEmptyRow()]);

  const handleSheetChange = (index: number, field: keyof InventoryItem, value: any) => {
    const newData = [...sheetData];
    // @ts-ignore
    newData[index][field] = value;
    if (field === 'pp' || field === 'rp' || field === 'factor') {
      const row = newData[index];
      const uCost = Number(row.pp) / (Number(row.factor) || 1);
      if (uCost > 0) newData[index].margin = (((Number(row.rp) - uCost) / uCost) * 100).toFixed(1);
    }
    setSheetData(newData);
  };

  const handleBatchAuthorize = async () => {
    const validData = sheetData.filter(row => row.name.trim() !== '');
    if (validData.length === 0) {
      showToast('AUDIT ERROR', 'warning', 'Spreadsheet is empty.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/bulk-register`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validData) 
      });
      if (!res.ok) throw new Error("Backend Rejected Batch");
      await fetchGlobalInventory();
      showToast('MASS INGESTION SUCCESS', 'success', `${validData.length} Assets committed.`);
      setSheetData([generateEmptyRow()]); 
      setActiveTab('VAULT');
    } catch (e) { 
      showToast('SYNC FAILED', 'error', 'Mass ingestion failed.'); 
    } finally { setIsSyncing(false); }
  };

  // ==========================================
  // 5. IMPORT / EXPORT ENGINE
  // ==========================================
  const downloadCSVTemplate = () => {
    const headers = "ID,NAME,TYPE,CATEGORY,DEPARTMENT,PURCHASE_PRICE,RETAIL_PRICE,MIN_LEVEL,PURCHASE_UNIT,FACTOR,SALES_UNIT,STOCK\n";
    const sampleData = "MINI-1001,Premium Water,PRODUCT,CONSUMABLE,MINI SHOP,1500,50,5,BOX-24,24,BTL,100\n";
    const blob = new Blob([headers + sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Matrix_Template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSyncing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("CSV is empty.");

        const newItems: InventoryItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length < 11) continue; 
          const pp = Number(cols[5]) || 0; 
          const rp = Number(cols[6]) || 0; 
          const factor = Number(cols[9]) || 1;
          const uCost = pp / factor; 
          const margin = uCost > 0 ? (((rp - uCost) / uCost) * 100).toFixed(1) : "100.0";
          const stockValue = cols.length >= 12 ? (Number(cols[11]) || 0) : 0;
          
          newItems.push({
            id: cols[0].replace(/"/g, '').trim(), 
            name: cols[1].replace(/"/g, '').trim(), 
            type: cols[2].replace(/"/g, '').trim() as any, 
            cat: cols[3].replace(/"/g, '').trim() as any, 
            dept: cols[4].replace(/"/g, '').trim(),
            pp, rp, stock: stockValue, min_level: Number(cols[7]) || 5, 
            p_unit: cols[8].replace(/"/g, '').trim(), factor, 
            s_unit: cols[10].replace(/"/g, '').trim(), margin, img: '', bom: []
          });
        }
        
        for (let i = 0; i < newItems.length; i += 500) {
            const chunk = newItems.slice(i, i + 500);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/inventory/bulk-register`, { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunk) 
            });
            if (!res.ok) throw new Error(`Kernel Rejected Chunk.`);
        }

        await fetchGlobalInventory();
        showToast('CSV IMPORT SUCCESS', 'success', `${newItems.length} Assets committed.`);
        setActiveTab('VAULT');
      } catch (error: any) { 
        showToast('IMPORT CRASHED', 'error', error.message); 
      } finally { setIsSyncing(false); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={containerStyle}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlow {
          0% { border-color: #00F2FF; box-shadow: 0 0 5px rgba(0, 242, 255, 0.3); }
          100% { border-color: #D4AF37; box-shadow: 0 0 20px rgba(212, 175, 55, 0.6); }
        }
      `}} />
      <ViewModeBanner />
      {/* HUD: COMMAND CONTROL */}
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>ZONE 12: SOVEREIGN ASSET KERNEL</h2>
          <p style={subTitleStyle}>MASTER VAULT | BOM EXPLOSION | FINANCIAL TELEMETRY</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px' }}>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {['VAULT', 'REGISTER', 'MASS_INGESTION', 'RECEIVING_BAY', 'SUPPLY_CHAIN', 'IMPORT_EXPORT'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} style={tabStyle(activeTab === t)}>{t.replace('_', ' ')}</button>
            ))}
            <button onClick={fetchGlobalInventory} style={refreshBtn} disabled={isSyncing}>
              {isSyncing ? "SYNCING..." : "🔄 REFRESH MATRIX"}
            </button>
            <button
              onClick={() => setShowWastage(true)}
              style={{ background: 'rgba(255,165,0,0.1)', color: '#FFA500', border: '1px solid rgba(255,165,0,0.5)', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '10px', letterSpacing: '1px' }}
            >
              ⚠️ LOG WASTAGE
            </button>
          </div>
        </div>
      </div>

      {/* TELEMETRY RADAR */}
      <div style={radarGrid}>
        <div style={metricBox('#D4AF37')}><div style={metricLabel}>PHYSICAL ASSET VALUE (PP)</div><div style={metricValue}>{formatFinance(vaultMetrics.totalAssets)}</div></div>
        <div style={metricBox('#00F2FF')}><div style={metricLabel}>PROJECTED REVENUE (RP)</div><div style={metricValue}>{formatFinance(vaultMetrics.potentialRevenue)}</div></div>
        <div style={metricBox('#00FF88')}><div style={metricLabel}>PROJECTED PROFIT</div><div style={metricValue}>{formatFinance(vaultMetrics.projectedProfit)}</div></div>
        <div style={metricBox(vaultMetrics.lowStockCount > 0 ? '#FF3131' : '#444')}><div style={metricLabel}>CRITICAL LOW STOCK SKUs</div><div style={{...metricValue, color: vaultMetrics.lowStockCount > 0 ? '#FF3131' : '#FFF'}}>{vaultMetrics.lowStockCount}</div></div>
      </div>

      {/* 👑 VIEW 1: THE SOVEREIGN VAULT MATRIX */}
      {activeTab === 'VAULT' && (
        <div className="glass-panel vault-container" style={vaultContainer}>
          <div style={vaultHeader}>
            <h4 style={vaultTitle}>LIVE ASSET MATRIX</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select style={vaultFilter} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="ALL">ALL TYPES</option><option value="PRODUCT">PHYSICAL PRODUCTS</option><option value="RAW">RAW INGREDIENTS</option><option value="SERVICE">VIRTUAL SERVICES (BOM)</option>
              </select>
              <select style={vaultFilter} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="ALL">ALL DEPARTMENTS</option>
                {TERMINALS.map(t => <option key={t} value={t.replace('RS-', '')}>{t.replace('RS-', '')}</option>)}
              </select>
              <input style={vaultSearchInput} placeholder="Search SKU / Name..." value={vaultSearch} onChange={e => setVaultSearch(e.target.value)} />
              <button onClick={handleMasterSync} disabled={Object.keys(draftEdits).length === 0 || isSyncing} style={syncBtn(Object.keys(draftEdits).length > 0)}>
                {isSyncing ? "📡 SYNCING..." : `📡 SYNC MATRIX (${Object.keys(draftEdits).length})`}
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left: Inventory list table */}
            <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="hide-scroll" style={{ flex: 1, overflowY: 'auto', background: '#030303' }}>
                <table style={matrixTable}>
                  <thead style={matrixHead}>
                    {/* 🛡️ CDO FIX: Perfect Header Widths */}
                    <tr>
                      <th style={{...padTh, width: '60px', textAlign: 'center'}}>ASSET</th>
                      <th style={{...padTh, width: '120px'}}>SKU ID</th>
                      <th style={{...padTh, width: '250px'}}>ASSET IDENTITY</th>
                      <th style={{...padTh, width: '140px'}}>SHELF LOCATION</th>
                      <th style={{...padTh, width: '180px'}}>ACTIVE INGREDIENT</th>
                      <th style={{...padTh, width: '120px'}}>DOSAGE FORM</th>
                      <th style={{...padTh, width: '120px'}}>TYPE</th>
                      <th style={{...padTh, width: '120px'}}>STOCK (FIFO)</th>
                      <th style={{...padTh, width: '130px', textAlign: 'right'}}>{t('COST')} ({currency})</th>
                      <th style={{...padTh, width: '100px', textAlign: 'center'}}>{t('MARGIN')}</th>
                      <th style={{...padTh, width: '130px', textAlign: 'right'}}>{t('UNIT RP')} ({currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVault.map(item => {
                      const isEdited = !!draftEdits[item.id];
                      const draft = draftEdits[item.id] || item;
                      const low = draft.stock <= draft.min_level && draft.type !== 'SERVICE';
                      const isSelected = (selectedItemId || filteredVault[0]?.id) === item.id;
                      return (
                        <tr 
                          key={item.id} 
                          className="data-row" 
                          style={{ 
                            ...rowStyle(isEdited), 
                            cursor: 'pointer', 
                            borderLeft: isSelected ? '4px solid #00F2FF' : 'none',
                            background: isSelected ? 'rgba(0, 242, 255, 0.03)' : rowStyle(isEdited).background
                          }} 
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          {/* 🛡️ CDO FIX: Perfect Data Widths to match Headers */}
                          <td style={{ width: '60px', padding: '10px', textAlign: 'center' }}>
                            <div 
                              onClick={() => handleImageEdit(item.id, draft.img || "")} 
                              style={imgCircle} 
                              title="Click to edit/paste image URL"
                            >
                              {draft.img ? (
                                <img 
                                  src={draft.img} 
                                  style={imgFit} 
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40x40?text=ERR';
                                  }}
                                />
                              ) : '🖼️'}
                            </div>
                          </td>
                          <td style={{ width: '120px', padding: '10px', fontFamily: 'monospace', color: '#666', fontSize: '12px', fontWeight: 900 }}>{draft.id}</td>
                          <td style={{ width: '250px', padding: '10px' }}>
                            <input style={sheetInput} value={draft.name} onChange={e => handleInlineEdit(item.id, 'name', e.target.value.toUpperCase())} />
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '8px' }}>
                              <select style={deptSelect} value={draft.dept} onChange={e => handleInlineEdit(item.id, 'dept', e.target.value)}>
                                <option value="GENERAL">GENERAL</option>
                                {TERMINALS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          </td>
                          <td style={{ width: '140px', padding: '10px' }}>
                            <input style={sheetInput} value={draft.shelf_location || ''} onChange={e => handleInlineEdit(item.id, 'shelf_location', e.target.value)} placeholder="E.g. RACK-P12-S3" />
                          </td>
                          <td style={{ width: '180px', padding: '10px' }}>
                            <input style={sheetInput} value={draft.active_ingredient || ''} onChange={e => handleInlineEdit(item.id, 'active_ingredient', e.target.value)} placeholder="E.g. Paracetamol" />
                          </td>
                          <td style={{ width: '120px', padding: '10px' }}>
                            <select style={{...sheetSelect, color: '#D4AF37'}} value={draft.dosage_form || 'TABLET'} onChange={e => handleInlineEdit(item.id, 'dosage_form', e.target.value)}>
                              <option value="TABLET">TABLET</option>
                              <option value="CAPSULE">CAPSULE</option>
                              <option value="SYRUP">SYRUP</option>
                              <option value="OINTMENT">OINTMENT</option>
                              <option value="PEDIATRIC">PEDIATRIC</option>
                              <option value="SANITARY">SANITARY</option>
                              <option value="SURGICAL">SURGICAL</option>
                            </select>
                          </td>
                          <td style={{ width: '120px', padding: '10px' }}>
                            <select style={typeSelect(draft.type)} value={draft.type} onChange={e => handleInlineEdit(item.id, 'type', e.target.value)}><option value="PRODUCT">PRODUCT</option><option value="RAW">RAW</option><option value="SERVICE">SERVICE</option></select>
                          </td>
                          <td style={{ width: '120px', padding: '10px' }}>
                            {draft.type === 'SERVICE' ? <span style={bomBadge}>⚙️ BOM VIRTUAL</span> : <div style={stockCell(low)}>{draft.stock} <span style={{ fontSize: '10px', color: '#888' }}>{draft.s_unit}</span></div>}
                          </td>
                          <td style={{ width: '130px', padding: '10px', textAlign: 'right' }}>
                            <input type="number" style={costInput} value={draft.pp} onChange={e => handleInlineEdit(item.id, 'pp', Number(e.target.value))} />
                            {/* 🛡️ CDO FIX: Widened Factor Box + Center Alignment */}
                            <div style={{fontSize: '9px', color: '#555', marginTop: '4px'}}>Per <input type="number" style={{...sheetInput, width: '40px', padding: '0 4px', textAlign: 'center', display: 'inline-block', color: '#D4AF37'}} value={draft.factor} onChange={e => handleInlineEdit(item.id, 'factor', Number(e.target.value))} /> {draft.s_unit}</div>
                          </td>
                          <td style={{ width: '100px', padding: '10px', textAlign: 'center' }}>
                            <div style={marginWrap}><input type="number" style={marginInput} value={draft.margin} onChange={e => handleInlineEdit(item.id, 'margin', e.target.value)} /><span style={{ color: '#555', fontSize: '10px', paddingRight: '6px' }}>%</span></div>
                          </td>
                          <td style={{ width: '130px', padding: '10px', textAlign: 'right' }}>
                            <input type="number" style={rpInput} value={draft.rp} onChange={e => handleInlineEdit(item.id, 'rp', Number(e.target.value))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', background: 'rgba(15, 15, 15, 0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={pageBtn(currentPage !== 1)}>◀ PREVIOUS</button>
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: 900, letterSpacing: '2px' }}>MATRIX PAGE <span style={{ color: '#FFF', fontSize: '14px', margin: '0 5px' }}>{currentPage}</span> OF {totalPages}</div>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={pageBtn(currentPage !== totalPages)}>NEXT ▶</button>
                </div>
              )}
            </div>

            {/* Right: Virtual Shelving Map Component */}
            <div style={{
              width: '380px',
              background: 'rgba(5, 5, 5, 0.95)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              overflowY: 'auto'
            }}>
              <h4 style={{ color: '#00F2FF', fontFamily: 'Cinzel', fontSize: '14px', letterSpacing: '1px', borderBottom: '1px solid rgba(0,242,255,0.2)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0' }}>
                🧭 PHARMACY LOCATOR GUIDE
              </h4>

              {activeLocItem ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 🚀 Active Target Card */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px' }}>
                    <div style={{ fontSize: '9px', color: '#888', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Target</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#FFF', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeLocItem.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#D4AF37', fontWeight: 900 }}>
                      <span>SKU: {activeLocItem.id}</span>
                      <span>SHELF: {activeLocItem.shelf_location || 'UNASSIGNED'}</span>
                    </div>
                    {activeLocItem.active_ingredient && (
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                        🧪 active ingredient: <span style={{ color: '#FFF' }}>{activeLocItem.active_ingredient}</span>
                      </div>
                    )}
                  </div>

                  {parsedLocation ? (
                    <>
                      {/* 🗺️ STEP 1: AISLE SELECTOR (Floor Plan Layout) */}
                      <div>
                        <div style={{ fontSize: '10px', color: '#666', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Floor Aisle Location</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', background: '#000', padding: '8px', borderRadius: '8px', border: '1px solid #111' }}>
                          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'SURG', 'SAN'].map(ais => {
                            const isActive = parsedLocation.aisle === ais;
                            return (
                              <div 
                                key={ais} 
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 900,
                                  padding: '4px 2px',
                                  textAlign: 'center',
                                  borderRadius: '4px',
                                  border: isActive ? '1px solid #00F2FF' : '1px solid transparent',
                                  background: isActive ? 'rgba(0, 242, 255, 0.15)' : 'rgba(255,255,255,0.01)',
                                  color: isActive ? '#00F2FF' : '#444',
                                  transition: 'all 0.3s'
                                }}
                              >
                                {ais}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 📦 STEP 2: CABINET ELEVATION GRID */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#666', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Cabinet: Rack {parsedLocation.rackNum}</span>
                          <span style={{ fontSize: '11px', color: '#00FF88', fontWeight: 900 }}>Aisle {parsedLocation.aisle}</span>
                        </div>
                        
                        <div style={{ background: '#0a0a0a', border: '2px solid #222', borderRadius: '10px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Shelves from top (Level 5) to bottom (Level 1) */}
                          {[5, 4, 3, 2, 1].map(lvl => {
                            const isTargetLevel = parsedLocation.shelfLevel === lvl;
                            return (
                              <div key={lvl} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', gap: '6px', padding: '4px 0' }}>
                                  <div style={{ width: '45px', fontSize: '9px', color: '#444', fontWeight: 900, display: 'flex', alignItems: 'center' }}>
                                    LVL {lvl}
                                  </div>
                                  
                                  {/* Grid Containers on this Level */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', flex: 1 }}>
                                    {[1, 2, 3, 4, 5].map(col => {
                                      const isTargetBin = isTargetLevel && (parsedLocation.rackNum % 5 === col - 1 || (parsedLocation.rackNum === 1 && col === 1));
                                      return (
                                        <div 
                                          key={col} 
                                          style={{
                                            height: '24px',
                                            borderRadius: '4px',
                                            background: isTargetBin ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.02)',
                                            border: isTargetBin ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.05)',
                                            boxShadow: isTargetBin ? '0 0 10px rgba(212, 175, 55, 0.4)' : 'none',
                                            animation: isTargetBin ? 'pulseGlow 1.2s infinite alternate' : 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '8px',
                                            fontWeight: 900,
                                            color: isTargetBin ? '#FFF' : '#333'
                                          }}
                                          title={isTargetBin ? `Item container is here!` : `Shelf lvl ${lvl}, Bin ${col}`}
                                        >
                                          {isTargetBin ? '🎯' : `${parsedLocation.aisle}-${col}`}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                {/* Visual wooden shelf line separator */}
                                <div style={{ height: '3px', background: isTargetLevel ? '#D4AF37' : '#333', borderRadius: '1px' }}></div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div style={{ fontSize: '9px', color: '#555', textAlign: 'center', marginTop: '10px', fontStyle: 'italic' }}>
                          💡 TARGET HIGHLIGHTED IN NEON PULSE. LOCATE ON PHYSICAL RACK CABINET.
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#444', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>
                      No shelf location coordinates mapped. Assign location to verify.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#444', textAlign: 'center', padding: '40px 0', fontSize: '12px' }}>
                  Search or select a product to begin location tracking.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 👑 VIEW 2: REGISTER & BOM BUILDER */}
      {activeTab === 'REGISTER' && (
        <div style={fadeInAnim}>
          <div className="glass-panel" style={overridePanel}>
             <h4 style={overrideTitle}>🔍 OVERRIDE EXISTING ASSET (CLONE & EDIT)</h4>
             <input style={inputStyle} placeholder="Search inventory by Name or SKU to load data..." value={overrideSearch} onChange={e => setOverrideSearch(e.target.value)} />
             {overrideSearch && (
                <div style={searchDropdown}>
                  {inventory.filter(i => i.name.toLowerCase().includes(overrideSearch.toLowerCase()) || i.id.toLowerCase().includes(overrideSearch.toLowerCase())).slice(0, 5).map(asset => (
                    <div key={asset.id} onClick={()=>loadAssetForOverride(asset)} style={searchResult}><span><b>{asset.name}</b> [{asset.dept}]</span><span style={{color:'#D4AF37'}}>{asset.id}</span></div>
                  ))}
                </div>
             )}
          </div>
          {/* 🤖 MIRACLE GUIDE: CONTEXT-AWARE VAULT MANAGER */}
          <div style={{
            padding: '20px 25px', marginBottom: '20px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(157,0,255,0.06) 0%, rgba(0,242,255,0.04) 100%)',
            border: '1px solid rgba(157,0,255,0.3)',
            boxShadow: '0 0 30px rgba(157,0,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #9D00FF, #00F2FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', boxShadow: '0 0 15px rgba(157,0,255,0.6)',
              }}>🤖</div>
              <div>
                <div style={{ color: '#FFF', fontWeight: 900, fontSize: '12px', letterSpacing: '1px' }}>MIRACLE GUIDE — VAULT MANAGER</div>
                <div style={{ color: '#9D00FF', fontSize: '9px', fontWeight: 700, letterSpacing: '2px' }}>
                  Z-12 ASSET KERNEL · MODE: {regType}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                {(['RAW', 'PRODUCT', 'SERVICE'] as const).map(t => (
                  <div key={t} style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 900,
                    background: regType === t ? (t === 'RAW' ? 'rgba(212,175,55,0.2)' : t === 'PRODUCT' ? 'rgba(0,242,255,0.2)' : 'rgba(157,0,255,0.2)') : 'transparent',
                    color: regType === t ? (t === 'RAW' ? '#D4AF37' : t === 'PRODUCT' ? '#00F2FF' : '#9D00FF') : '#444',
                    border: `1px solid ${regType === t ? (t === 'RAW' ? '#D4AF37' : t === 'PRODUCT' ? '#00F2FF' : '#9D00FF') : '#222'}`,
                  }}>{t}</div>
                ))}
              </div>
            </div>

            {/* RAW Guide */}
            {regType === 'RAW' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '14px', background: 'rgba(212,175,55,0.05)', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.15)' }}>
                  <div style={{ color: '#D4AF37', fontSize: '10px', fontWeight: 900, marginBottom: '8px' }}>📦 WHAT IS RAW?</div>
                  <p style={{ color: '#AAA', fontSize: '11px', margin: 0, lineHeight: '1.7' }}>
                    RAW = base ingredient or material purchased in bulk. Example: <b style={{color:'#FFF'}}>Coffee Beans</b>, <b style={{color:'#FFF'}}>Milk</b>, <b style={{color:'#FFF'}}>Cleaning Agent</b>.
                    These feed into SERVICE recipes (BOM) and are tracked in stock.
                  </p>
                </div>
                <div style={{ padding: '14px', background: 'rgba(0,255,136,0.04)', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.1)' }}>
                  <div style={{ color: '#00FF88', fontSize: '10px', fontWeight: 900, marginBottom: '8px' }}>🔢 COGS FORMULA</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#CCC', lineHeight: '2' }}>
                    <div>Purchase Price (PP) = <span style={{color:'#D4AF37'}}>{formatMoney(formData.pp || 0)}</span></div>
                    <div>÷ Factor = <span style={{color:'#00F2FF'}}>{formData.factor || '?'}</span> {formData.s_unit || 'PCS'}</div>
                    <div style={{borderTop:'1px solid #222', marginTop:'4px', paddingTop:'4px'}}>
                      Unit COGS = <b style={{color:'#00FF88', fontSize:'13px'}}>{formatMoney(unitCost)}</b> per {formData.s_unit || 'unit'}
                    </div>
                  </div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid #222', gridColumn: '1 / -1' }}>
                  <div style={{ color: '#666', fontSize: '10px', fontWeight: 900, marginBottom: '6px' }}>💡 MIRACLE TIP</div>
                  <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>
                    Example: 1 BOX of Coffee Beans = {formatMoney(1200)}. Factor = 1000g. Unit COGS = {formatMoney(1.20)}/g.
                    When someone orders a Cappuccino (SERVICE) using 18g of beans → that dish costs {formatMoney(21.60)} in coffee alone.
                  </p>
                </div>
              </div>
            )}

            {/* PRODUCT Guide */}
            {regType === 'PRODUCT' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '14px', background: 'rgba(0,242,255,0.05)', borderRadius: '10px', border: '1px solid rgba(0,242,255,0.15)' }}>
                  <div style={{ color: '#00F2FF', fontSize: '10px', fontWeight: 900, marginBottom: '8px' }}>🏷️ WHAT IS PRODUCT?</div>
                  <p style={{ color: '#AAA', fontSize: '11px', margin: 0, lineHeight: '1.7' }}>
                    PRODUCT = a physical item sold directly at POS without a recipe. Example: <b style={{color:'#FFF'}}>Bottled Water</b>, <b style={{color:'#FFF'}}>Souvenir</b>, <b style={{color:'#FFF'}}>Towel Set</b>.
                    Stock depletes by 1 unit per sale.
                  </p>
                </div>
                <div style={{ padding: '14px', background: 'rgba(0,255,136,0.04)', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.1)' }}>
                  <div style={{ color: '#00FF88', fontSize: '10px', fontWeight: 900, marginBottom: '8px' }}>💰 MARGIN FORMULA</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#CCC', lineHeight: '2' }}>
                    <div>Retail Price (RP) = <span style={{color:'#00F2FF'}}>{formatMoney(formData.rp || 0)}</span></div>
                    <div>− Unit COGS = <span style={{color:'#FF3131'}}>{formatMoney(unitCost)}</span></div>
                    <div style={{borderTop:'1px solid #222', marginTop:'4px', paddingTop:'4px'}}>
                      Margin = <b style={{color:'#D4AF37', fontSize:'13px'}}>{currentMargin}%</b>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid #222', gridColumn: '1 / -1' }}>
                  <div style={{ color: '#666', fontSize: '10px', fontWeight: 900, marginBottom: '6px' }}>💡 MIRACLE TIP</div>
                  <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>
                    Example: Buy 24 bottles (BOX-24) for {formatMoney(360)} → Unit COGS = {formatMoney(15)}. Retail at {formatMoney(50)} → Margin = 233%.
                    Use the RECEIVING BAY tab to log stock arrivals — never edit stock numbers directly.
                  </p>
                </div>
              </div>
            )}

            {/* SERVICE / BOM Guide */}
            {regType === 'SERVICE' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '12px', background: 'rgba(157,0,255,0.06)', borderRadius: '10px', border: '1px solid rgba(157,0,255,0.2)' }}>
                    <div style={{ color: '#9D00FF', fontSize: '10px', fontWeight: 900, marginBottom: '6px' }}>⚙️ WHAT IS SERVICE?</div>
                    <p style={{ color: '#AAA', fontSize: '11px', margin: 0, lineHeight: '1.7' }}>
                      Service = a menu item or spa treatment built from raw ingredients. It has <b style={{color:'#FFF'}}>no physical stock</b> — COGS is calculated from its BOM recipe.
                    </p>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(0,255,136,0.04)', borderRadius: '10px', border: '1px solid rgba(0,255,136,0.1)' }}>
                    <div style={{ color: '#00FF88', fontSize: '10px', fontWeight: 900, marginBottom: '6px' }}>🧪 BOM COST ENGINE</div>
                    {currentBOM.length === 0 ? (
                      <p style={{ color: '#555', fontSize: '11px', margin: 0 }}>Add ingredients below to see live BOM cost calculation here.</p>
                    ) : (
                      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#CCC', lineHeight: '2' }}>
                        {currentBOM.map((b, i) => (
                          <div key={i}>
                            <span style={{color:'#888'}}>{b.name}:</span> {b.qty} {b.unit} × {formatMoney(b.unitCost)} = <b style={{color:'#00FF88'}}>{formatMoney(b.qty * b.unitCost)}</b>
                          </div>
                        ))}
                        <div style={{borderTop:'1px solid #222', marginTop:'4px', paddingTop:'4px'}}>
                          Total COGS = <b style={{color:'#FF3131', fontSize:'13px'}}>{formatMoney(currentBOM.reduce((s,i) => s + i.qty * i.unitCost, 0))}</b>
                        </div>
                        {formData.rp > 0 && (
                          <div>Margin = <b style={{color:'#D4AF37'}}>
                            {(((formData.rp - currentBOM.reduce((s,i) => s + i.qty * i.unitCost, 0)) / (currentBOM.reduce((s,i) => s + i.qty * i.unitCost, 0) || 1)) * 100).toFixed(1)}%
                          </b></div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', border: '1px solid #222' }}>
                    <div style={{ color: '#666', fontSize: '10px', fontWeight: 900, marginBottom: '6px' }}>💡 MIRACLE TIPS</div>
                    <ul style={{ color: '#888', fontSize: '10px', margin: 0, paddingLeft: '14px', lineHeight: '1.8' }}>
                      <li>Food menu item → Type: SERVICE</li>
                      <li>Sauna service → Type: SERVICE + add oils, towels</li>
                      <li>PP/Factor fields are <span style={{color:'#FF3131'}}>ignored</span> for SERVICE</li>
                      <li>BOM deducts RAW stock on each POS sale</li>
                      <li>Set RP = your selling price in {currency}</li>
                    </ul>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(157,0,255,0.04)', borderRadius: '8px', border: '1px solid rgba(157,0,255,0.1)', fontSize: '10px', color: '#9D00FF', fontWeight: 700 }}>
                  ► STEP 1: Select Type = SERVICE &nbsp;|&nbsp; STEP 2: Enter Name + Department &nbsp;|&nbsp; STEP 3: Set Retail Price (RP) &nbsp;|&nbsp; STEP 4: Search &amp; Add Ingredients below &nbsp;|&nbsp; STEP 5: Authorize &amp; Sync
                </div>
              </div>
            )}
          </div>
          <form onSubmit={handleRegister} style={registerGrid}>

            <div className="glass-panel" style={panelStyle}>
              <h3 style={sectionTitle}>1. CORE IDENTITY & LOGISTICS</h3>
              <div style={toggleRow}>{['RAW', 'PRODUCT', 'SERVICE'].map(t => <button key={t} type="button" onClick={() => setRegType(t as any)} style={typeToggle(regType === t)}>{t}</button>)}</div>
              <div style={inputRow}>
                <div style={{flex: 1}}><label style={labelStyle}>SKU ID (Leave blank for Auto)</label><input style={inputStyle} value={formData.id} onChange={e=>setFormData({...formData, id: e.target.value})} /></div>
                <div style={{flex: 2}}><label style={labelStyle}>ASSET NAME</label><input style={inputStyle} value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} required /></div>
              </div>
              <div style={inputRow}>
                <div style={{flex: 1}}>
                  <label style={labelStyle}>IMAGE URL (External Link / Google Drive)</label>
                  <input 
                    style={inputStyle} 
                    placeholder="https://images.unsplash.com/..." 
                    value={formData.img} 
                    onChange={e=>setFormData({...formData, img: cleanImgUrl(e.target.value)})} 
                  />
                  <div style={{ fontSize: '9px', color: '#D4AF37', marginTop: '5px', fontWeight: 900 }}>
                    💡 TIP: Ensure Google Drive files are shared as "Anyone with the link can view"
                  </div>
                </div>
              </div>
              <div style={inputRow}>
                <div style={{flex: 1}}><label style={labelStyle}>DEPARTMENT</label><select style={inputStyle} value={formData.dept} onChange={e=>setFormData({...formData, dept: e.target.value})}>{TERMINALS.map(t => <option key={t} value={t.replace('RS-', '')}>{t.replace('RS-', '')}</option>)}</select></div>
                <div style={{flex: 1}}><label style={labelStyle}>CATEGORY</label><select style={inputStyle} value={formData.cat} onChange={e=>setFormData({...formData, cat: e.target.value as any})}><option value="CONSUMABLE">CONSUMABLE</option><option value="PERISHABLE">PERISHABLE</option><option value="FIXED">FIXED ASSET</option></select></div>
              </div>
              <div style={inputRow}>
                <div style={{flex: 1}}><label style={labelStyle}>SHELF LOCATION</label><input style={inputStyle} placeholder="e.g. RACK-P12-S3" value={formData.shelf_location || ''} onChange={e=>setFormData({...formData, shelf_location: e.target.value})} /></div>
                <div style={{flex: 1}}><label style={labelStyle}>ACTIVE INGREDIENT</label><input style={inputStyle} placeholder="e.g. Paracetamol" value={formData.active_ingredient || ''} onChange={e=>setFormData({...formData, active_ingredient: e.target.value})} /></div>
                <div style={{flex: 1}}>
                  <label style={labelStyle}>DOSAGE FORM</label>
                  <select style={inputStyle} value={formData.dosage_form || 'TABLET'} onChange={e=>setFormData({...formData, dosage_form: e.target.value})}>
                    <option value="TABLET">TABLET</option>
                    <option value="CAPSULE">CAPSULE</option>
                    <option value="SYRUP">SYRUP</option>
                    <option value="OINTMENT">OINTMENT</option>
                    <option value="PEDIATRIC">PEDIATRIC</option>
                    <option value="SANITARY">SANITARY</option>
                    <option value="SURGICAL">SURGICAL</option>
                  </select>
                </div>
              </div>
              <h4 style={{ color: '#00F2FF', fontSize: '11px', borderBottom: '1px solid #333', paddingBottom: '5px', marginTop: '30px' }}>DUAL-UNIT CONVERSION ENGINE</h4>
              <div style={inputRow}><div style={{flex: 1}}><label style={labelStyle}>PURCHASE UNIT</label><input style={inputStyle} value={formData.p_unit} onChange={e=>setFormData({...formData, p_unit: e.target.value})} /></div><div style={{flex: 1}}><label style={labelStyle}>CONVERSION FACTOR</label><input type="number" style={inputStyle} value={formData.factor} onChange={e=>setFormData({...formData, factor: Number(e.target.value)})} /></div><div style={{flex: 1}}><label style={labelStyle}>POS SALES UNIT</label><input style={inputStyle} value={formData.s_unit} onChange={e=>setFormData({...formData, s_unit: e.target.value})} /></div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div className="glass-panel" style={panelStyle}>
                <h3 style={sectionTitle}>2. FINANCIALS & SENSITIVITY</h3>
                <div style={inputRow}><div style={{flex: 1}}><label style={labelStyle}>BULK PURCHASE COST ({currency})</label><input type="number" style={{...inputStyle, border: '1px solid #D4AF37'}} value={formData.pp} onChange={e=>setFormData({...formData, pp: Number(e.target.value)})} /></div><div style={{flex: 1}}><label style={labelStyle}>POS RETAIL PRICE ({currency})</label><input type="number" style={inputStyle} value={formData.rp} onChange={e=>setFormData({...formData, rp: Number(e.target.value)})} /></div></div>
                <div style={inputRow}><div style={{flex: 1}}><label style={labelStyle}>REORDER ALERT LEVEL</label><input type="number" style={inputStyle} value={formData.min_level} onChange={e=>setFormData({...formData, min_level: Number(e.target.value)})} /></div></div>
                <div style={costTelemetry}>
                  <div style={telemetryRow}><span>CALCULATED COGS: <b style={{color: '#00FF88', fontSize:'14px'}}>{formatMoney(unitCost)}</b></span><span>PROJECTED MARGIN: <b style={{color: '#D4AF37', fontSize:'14px'}}>{currentMargin}%</b></span></div>
                  <div style={progressBar}><div style={progressFill(Number(currentMargin))}></div></div>
                </div>
              </div>
              <div className="glass-panel" style={panelStyle}>
                <h3 style={sectionTitle}>3. RECIPE / BOM BUILDER</h3>
                {regType === 'RAW' ? <p style={{color:'#666', fontSize:'12px'}}>Raw assets rely purely on Base Purchase Cost.</p> : (
                  <>
                    <input style={{...inputStyle, width:'100%', marginBottom:'15px'}} placeholder="Search raw ingredients by Name or SKU..." value={bomSearch} onChange={e=>setBomSearch(e.target.value)} />
                    <div style={{ maxHeight:'150px', overflowY:'auto', border:'1px solid #222', borderRadius:'8px', marginBottom:'20px' }}>
                       {inventory.filter(i => i.type === 'RAW' && (i.name.toLowerCase().includes(bomSearch.toLowerCase()) || i.id.toLowerCase().includes(bomSearch.toLowerCase()))).slice(0, 10).map(raw => (
                         <div key={raw.id} onClick={()=>addIngredient(raw)} style={{padding:'10px', borderBottom:'1px solid #111', cursor:'pointer', fontSize:'11px', color:'#00F2FF'}}>+ Add {raw.name} ({formatFinance(raw.pp/raw.factor, true)} / {raw.s_unit})</div>
                       ))}
                    </div>
                    <div>
                      {currentBOM.map((ing, idx) => (
                        <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems: 'center', fontSize:'11px', padding:'8px', background:'#111', marginBottom:'5px', borderRadius:'5px'}}>
                          <span>{ing.name}</span>
                          <div style={{display:'flex', alignItems: 'center', gap: '10px'}}>
                            <input type="number" style={{background: 'transparent', border: '1px solid #333', color: '#00FF88', width: '50px', padding: '2px 5px'}} value={ing.qty} onChange={(e) => { const newBOM = [...currentBOM]; newBOM[idx].qty = Number(e.target.value); setCurrentBOM(newBOM); }} />
                            <span style={{color:'#888'}}>{ing.unit}</span><button type="button" onClick={() => setCurrentBOM(currentBOM.filter((_, i) => i !== idx))} style={{background:'transparent', border:'none', color:'#FF3131', cursor:'pointer'}}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button type="submit" className="neon-btn" style={commitBtnStyle}>🔐 AUTHORIZE DETAILED ASSET & SYNC</button>
            </div>
          </form>
        </div>
      )}

      {/* 👑 VIEW 3: RECEIVING BAY */}
      {activeTab === 'RECEIVING_BAY' && (
        <div style={fadeInAnim}>
          <div className="glass-panel replenished-panel" style={replenishPanel}>
            <h4 style={{color:'#00FF88', fontFamily:'Cinzel', marginBottom:'20px'}}>🚚 RECEIVING BAY (STOCK REFILL)</h4>
            <p style={{ color: '#888', fontSize: '11px', marginBottom: '20px' }}>Record inbound bulk shipments. The system automatically multiplies the bulk quantity by the conversion factor to update your POS Sales Unit stock.</p>
            <form onSubmit={handleReceiveStock} style={{display:'flex', flexDirection:'column', gap:'20px'}}>
              <div><label style={labelStyle}>TARGET SKU ID</label><input style={inputStyle} placeholder="e.g. SKU-1001" value={receiveForm.id} onChange={e=>setReceiveForm({...receiveForm, id: e.target.value.toUpperCase()})} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                 <div><label style={labelStyle}>RECEIVED BULK QTY</label><input type="number" style={inputStyle} placeholder="e.g. 5 Boxes" onChange={e=>setReceiveForm({...receiveForm, p_qty: Number(e.target.value)})} required /></div>
                 <div><label style={labelStyle}>SUPPLIER</label><input style={inputStyle} placeholder="Vendor Name" value={receiveForm.supplier} onChange={e=>setReceiveForm({...receiveForm, supplier: e.target.value})} /></div>
              </div>
              <button type="submit" disabled={isSyncing} style={replenishBtn}>{isSyncing ? "SYNCING..." : "AUTHORIZE PHYSICAL STOCK REFILL"}</button>
            </form>
          </div>
        </div>
      )}

      {/* 👑 VIEW SUPPLY_CHAIN */}
      {activeTab === 'SUPPLY_CHAIN' && (
        <div style={fadeInAnim}>
          {/* Section 1: Echelon Nodes Grid */}
          <div style={{ marginBottom: '40px' }}>
            <h4 style={{ color: '#00F2FF', fontFamily: 'Cinzel', marginBottom: '15px' }}>🏢 ENTERPRISE ECHELON NODE MAP</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {supplyNodes.map(node => (
                <div key={node.id} className="glass-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid rgba(0,242,255,0.15)', background: 'rgba(0,0,0,0.6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#00FF88', background: 'rgba(0,255,136,0.1)', padding: '4px 8px', borderRadius: '4px', fontWeight: 900 }}>{node.type}</span>
                    <span style={{ fontSize: '9px', color: '#888' }}>{node.facility_code}</span>
                  </div>
                  <h5 style={{ color: '#FFF', fontSize: '13px', margin: '5px 0', fontFamily: 'Outfit' }}>{node.name}</h5>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '10px' }}>
                    <div>ID: <span style={{ fontFamily: 'monospace', color: '#00F2FF' }}>{node.id}</span></div>
                    <div>Parent Node: <span style={{ fontFamily: 'monospace' }}>{node.parent_node_id || 'ROOT'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Stock Allocations */}
          <div style={{ marginBottom: '40px' }}>
            <h4 style={{ color: '#D4AF37', fontFamily: 'Cinzel', marginBottom: '15px' }}>📦 BATCH STOCK ALLOCATIONS</h4>
            <div className="hide-scroll" style={{ overflowX: 'auto', background: '#0a0a0a', border: '1px solid #333', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#111', color: '#00F2FF', fontSize: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '15px' }}>VAULT LOCATION</th>
                    <th style={{ padding: '15px' }}>PRODUCT NAME (ID)</th>
                    <th style={{ padding: '15px' }}>BATCH NUMBER</th>
                    <th style={{ padding: '15px' }}>EXPIRY DATE</th>
                    <th style={{ padding: '15px', textAlign: 'right' }}>QUANTITY ON HAND</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #222', fontSize: '12px' }}>
                      <td style={{ padding: '15px', color: '#00FF88', fontWeight: 900 }}>{a.vault_name}</td>
                      <td style={{ padding: '15px', color: '#FFF' }}>{a.product_name} <span style={{ color: '#666', fontSize: '10px' }}>({a.product_id})</span></td>
                      <td style={{ padding: '15px', fontFamily: 'monospace', color: '#D4AF37' }}>{a.batch_number}</td>
                      <td style={{ padding: '15px', color: '#aaa' }}>{a.expiry_date || 'N/A'}</td>
                      <td style={{ padding: '15px', textAlign: 'right', fontWeight: 900, color: a.quantity > 50 ? '#00FF88' : '#FF3131' }}>{a.quantity}</td>
                    </tr>
                  ))}
                  {allocations.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No active stock allocations found. Run a PO Match or Transfer to allocate stock.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Operations Hub */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px' }}>
            {/* Col 1: PO Creation */}
            <div className="glass-panel" style={{ padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h5 style={{ color: '#00F2FF', fontFamily: 'Cinzel', fontSize: '14px', marginBottom: '20px' }}>📄 1. PROCURE (CREATE PO)</h5>
              <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div><label style={labelStyle}>PO NUMBER</label><input style={inputStyle} placeholder="e.g. PO-8902" value={poForm.po_number} onChange={e=>setPoForm({...poForm, po_number: e.target.value.toUpperCase()})} required /></div>
                <div><label style={labelStyle}>VENDOR ID</label><input style={inputStyle} placeholder="e.g. VEND_PHARMA" value={poForm.vendor_id} onChange={e=>setPoForm({...poForm, vendor_id: e.target.value})} required /></div>
                <div>
                  <label style={labelStyle}>DELIVERY NODE</label>
                  <select style={inputStyle} value={poForm.delivery_node_id} onChange={e=>setPoForm({...poForm, delivery_node_id: e.target.value})}>
                    {supplyNodes.filter(n => n.type === 'LOADING_DOCK').map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div><label style={labelStyle}>TOTAL AMOUNT ({currency})</label><input type="number" style={inputStyle} value={poForm.total_amount || ''} onChange={e=>setPoForm({...poForm, total_amount: Number(e.target.value)})} required /></div>
                <button type="submit" disabled={isSyncing} style={{ ...replenishBtn, background: '#00F2FF', color: '#000', fontWeight: 900 }}>{isSyncing ? "SYNCING..." : "REGISTER PURCHASE ORDER"}</button>
              </form>
            </div>

            {/* Col 2: Three-Way Matching */}
            <div className="glass-panel" style={{ padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h5 style={{ color: '#00FF88', fontFamily: 'Cinzel', fontSize: '14px', marginBottom: '20px' }}>🚚 2. RECEIVE (3-WAY MATCH)</h5>
              <form onSubmit={handleThreeWayMatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>PO NUMBER</label><input style={inputStyle} value={matchForm.po_number} onChange={e=>setMatchForm({...matchForm, po_number: e.target.value.toUpperCase()})} required /></div>
                  <div><label style={labelStyle}>INVOICE REF</label><input style={inputStyle} value={matchForm.vendor_invoice_ref} onChange={e=>setMatchForm({...matchForm, vendor_invoice_ref: e.target.value})} required /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>DOCK LOG ID</label><input style={inputStyle} value={matchForm.receiving_dock_log_id} onChange={e=>setMatchForm({...matchForm, receiving_dock_log_id: e.target.value})} required /></div>
                  <div><label style={labelStyle}>MATCH VAL ({currency})</label><input type="number" style={inputStyle} value={matchForm.matching_amount || ''} onChange={e=>setMatchForm({...matchForm, matching_amount: Number(e.target.value)})} required /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>SKU ID (PRODUCT)</label><input style={inputStyle} value={matchForm.product_id} onChange={e=>setMatchForm({...matchForm, product_id: e.target.value.toUpperCase()})} required /></div>
                  <div><label style={labelStyle}>QTY RECEIVED</label><input type="number" style={inputStyle} value={matchForm.qty_received || ''} onChange={e=>setMatchForm({...matchForm, qty_received: Number(e.target.value)})} required /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>BATCH #</label><input style={inputStyle} value={matchForm.batch_number} onChange={e=>setMatchForm({...matchForm, batch_number: e.target.value})} required /></div>
                  <div><label style={labelStyle}>EXPIRY DATE</label><input type="date" style={inputStyle} value={matchForm.expiry_date} onChange={e=>setMatchForm({...matchForm, expiry_date: e.target.value})} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>UNIT COST ({currency})</label><input type="number" style={inputStyle} value={matchForm.unit_cost || ''} onChange={e=>setMatchForm({...matchForm, unit_cost: Number(e.target.value)})} required /></div>
                  <div><label style={labelStyle}>OPERATOR ID</label><input style={inputStyle} value={matchForm.operator_id} onChange={e=>setMatchForm({...matchForm, operator_id: e.target.value})} required /></div>
                </div>
                <button type="submit" disabled={isSyncing} style={{ ...replenishBtn, background: '#00FF88', color: '#000', fontWeight: 900 }}>{isSyncing ? "MATCHING..." : "EXECUTE 3-WAY MATCH"}</button>
              </form>
            </div>

            {/* Col 3: Internal Transfer */}
            <div className="glass-panel" style={{ padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h5 style={{ color: '#D4AF37', fontFamily: 'Cinzel', fontSize: '14px', marginBottom: '20px' }}>⚡ 3. DISPATCH (TRANSFER)</h5>
              <form onSubmit={handleCreateTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={labelStyle}>SOURCE NODE</label>
                  <select style={inputStyle} value={transferForm.source_node_id} onChange={e=>setTransferForm({...transferForm, source_node_id: e.target.value})}>
                    {supplyNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>DESTINATION NODE</label>
                  <select style={inputStyle} value={transferForm.dest_node_id} onChange={e=>setTransferForm({...transferForm, dest_node_id: e.target.value})}>
                    {supplyNodes.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div><label style={labelStyle}>SKU ID (PRODUCT)</label><input style={inputStyle} value={transferForm.product_id} onChange={e=>setTransferForm({...transferForm, product_id: e.target.value.toUpperCase()})} required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><label style={labelStyle}>BATCH #</label><input style={inputStyle} value={transferForm.batch_number} onChange={e=>setTransferForm({...transferForm, batch_number: e.target.value})} required /></div>
                  <div><label style={labelStyle}>TRANSFER QTY</label><input type="number" style={inputStyle} value={transferForm.qty_transferred || ''} onChange={e=>setTransferForm({...transferForm, qty_transferred: Number(e.target.value)})} required /></div>
                </div>
                <div><label style={labelStyle}>OPERATOR ID</label><input style={inputStyle} value={transferForm.operator_id} onChange={e=>setTransferForm({...transferForm, operator_id: e.target.value})} required /></div>
                <button type="submit" disabled={isSyncing} style={{ ...replenishBtn, background: '#D4AF37', color: '#000', fontWeight: 900 }}>{isSyncing ? "DISPATCHING..." : "DISPATCH INTERNAL TRANSFER"}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 👑 VIEW 4: MASS INGESTION */}
      {activeTab === 'MASS_INGESTION' && (
        <div style={fadeInAnim}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ color: '#D4AF37', fontFamily: 'Cinzel', margin: 0 }}>SPREADSHEET INGESTION MATRIX</h3>
              <p style={{ color: '#888', fontSize: '10px', marginTop: '5px' }}>Data entry is strictly in Base Currency ({currency}) to maintain accounting ledger integrity.</p>
            </div>
            <button onClick={handleBatchAuthorize} className="neon-btn" style={{ background: '#D4AF37', padding: '15px 30px', border: 'none', borderRadius: '8px', color: '#000', fontSize: '10px', cursor: 'pointer', fontWeight: 900 }}>
              {isSyncing ? "SYNCING..." : "📡 AUTHORIZE BATCH SYNC"}
            </button>
          </div>
          <div className="hide-scroll" style={{ overflowX: 'auto', background: '#0a0a0a', border: '1px solid #333', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
              <thead>
                <tr style={{ background: '#111', color: '#00F2FF', fontSize: '9px', textAlign: 'left' }}>
                  <th style={sheetTh}>SKU ID</th><th style={sheetTh}>ASSET NAME</th><th style={sheetTh}>TYPE</th>
                  <th style={sheetTh}>DEPARTMENT</th><th style={sheetTh}>PURCHASE UNIT</th><th style={sheetTh}>FACTOR</th>
                  <th style={sheetTh}>SALES UNIT</th><th style={sheetTh}>PP (BULK {currency})</th><th style={sheetTh}>RP (POS {currency})</th>
                  <th style={sheetTh}>MARGIN</th><th style={sheetTh}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {sheetData.map((row, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                    <td style={sheetTd}><input style={sheetInput} value={row.id} onChange={e => handleSheetChange(index, 'id', e.target.value)} /></td>
                    <td style={sheetTd}><input style={{...sheetInput, width: '100%', minWidth: '200px'}} placeholder="e.g. Arabica Beans" value={row.name} onChange={e => handleSheetChange(index, 'name', e.target.value)} /></td>
                    <td style={sheetTd}><select style={sheetSelect} value={row.type} onChange={e => handleSheetChange(index, 'type', e.target.value)}><option>RAW</option><option>PRODUCT</option><option>SERVICE</option></select></td>
                    <td style={sheetTd}><select style={sheetSelect} value={row.dept} onChange={e => handleSheetChange(index, 'dept', e.target.value)}><option value="DEPT_POS">DEPT_POS (Pharmacy)</option><option value="DEPT_WELLNESS">DEPT_WELLNESS (Labs)</option><option value="DEPT_GASTRONOMY">DEPT_GASTRONOMY (Dietary)</option><option value="DEPT_BOUTIQUE">DEPT_BOUTIQUE (Supplies)</option><option value="DEPT_RENTAL">DEPT_RENTAL (Equipment)</option></select></td>
                    <td style={sheetTd}><input style={{...sheetInput, width: '80px'}} value={row.p_unit} onChange={e => handleSheetChange(index, 'p_unit', e.target.value)} /></td>
                    <td style={sheetTd}><input type="number" style={{...sheetInput, width: '50px'}} value={row.factor} onChange={e => handleSheetChange(index, 'factor', e.target.value)} /></td>
                    <td style={sheetTd}><input style={{...sheetInput, width: '60px'}} value={row.s_unit} onChange={e => handleSheetChange(index, 's_unit', e.target.value)} /></td>
                    <td style={sheetTd}><input type="number" style={{...sheetInput, width: '80px'}} value={row.pp} onChange={e => handleSheetChange(index, 'pp', e.target.value)} /></td>
                    <td style={sheetTd}><input type="number" style={{...sheetInput, width: '80px', color: '#00F2FF'}} value={row.rp} onChange={e => handleSheetChange(index, 'rp', e.target.value)} /></td>
                    <td style={{...sheetTd, color: Number(row.margin) > 50 ? '#00FF88' : '#D4AF37', fontWeight: 900}}>{row.margin}%</td>
                    <td style={sheetTd}><button onClick={() => setSheetData(sheetData.filter((_, i) => i !== index))} style={{ background: 'transparent', border: 'none', color: '#FF3131', cursor: 'pointer', fontWeight: 900 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setSheetData([...sheetData, generateEmptyRow()])} style={{ background: '#111', border: '1px dashed #333', color: '#888', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 900, marginTop: '20px', width: '100%' }}>+ ADD NEW ROW</button>
        </div>
      )}

      {/* 👑 VIEW 5: IMPORT / EXPORT */}
      {activeTab === 'IMPORT_EXPORT' && (
        <div style={{ animation: 'fadeIn 0.5s ease', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div className="glass-panel" style={{...panelStyle, border: '1px solid #00F2FF33', textAlign: 'center'}}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '15px' }}>📄</span>
            <h4 style={{ color: '#00F2FF', fontFamily: 'Cinzel', marginBottom: '10px' }}>STEP 1: OBTAIN OFFICIAL BLUEPRINT</h4>
            <p style={{ color: '#888', fontSize: '11px', marginBottom: '30px' }}>Download the strict CSV template. Fill it out completely using Base Currency ({currency}) before importing.</p>
            <button onClick={downloadCSVTemplate} className="neon-btn" style={{...commitBtnStyle, background: 'transparent', border: '1px solid #00F2FF', color: '#00F2FF', width: 'auto', padding: '15px 40px'}}>⬇️ DOWNLOAD .CSV TEMPLATE</button>
          </div>
          <div className="glass-panel" style={{...panelStyle, border: '1px solid #D4AF3733', textAlign: 'center'}}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '15px' }}>☁️</span>
            <h4 style={{ color: '#D4AF37', fontFamily: 'Cinzel', marginBottom: '10px' }}>STEP 2: UPLOAD & INGEST DATA</h4>
            <p style={{ color: '#888', fontSize: '11px', marginBottom: '30px' }}>Upload your completed .CSV file here. The Kernel will automatically map the data.</p>
            <label style={{ display: 'inline-block', background: isSyncing ? '#333' : '#D4AF37', color: '#000', padding: '15px 40px', borderRadius: '8px', fontWeight: 900, cursor: isSyncing ? 'wait' : 'pointer', transition: '0.3s' }} className="neon-btn">
              {isSyncing ? 'BATCHING DATA...' : '📂 SELECT & UPLOAD FILE'}
              <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} disabled={isSyncing} />
            </label>
          </div>
        </div>
      )}

      {/* 🛡️ CDO STYLES: Including the Hidden Spinner Eraser */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .glass-panel { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px); }
        .data-row { transition: 0.2s; border-bottom: 1px solid #111; }
        .data-row:hover { background: rgba(255,255,255,0.02) !important; }
        .neon-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 0 20px rgba(212,175,55,0.4); }
        
        /* 🛡️ ERADICATE BROWSER SPINNERS ON NUMBER INPUTS */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}} />

      {/* ⚠️ WASTAGE AUDIT LOG OVERLAY */}
      {showWastage && (
        <WastageAuditLog
          onClose={() => setShowWastage(false)}
          onLogged={() => { setShowWastage(false); fetchGlobalInventory(); }}
        />
      )}
    </div>
  );
}

// --- CSS-IN-JS (MASTER STYLES) ---
const containerStyle = { padding: '40px', background: '#000', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #111', paddingBottom: '20px' };
const titleStyle = { fontFamily: 'Cinzel', color: '#D4AF37', margin: 0, letterSpacing: '2px' };
const subTitleStyle = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginTop: '5px' };
const currencyBar = { display: 'flex', background: '#111', borderRadius: '15px', padding: '5px', border: '1px solid #333', gap: '5px' };
const currencyBtn = (active: boolean, c: string) => ({ background: active ? c : 'transparent', color: active ? '#000' : '#666', border: 'none', padding: '5px 15px', borderRadius: '15px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' as const });
const tabStyle = (active: boolean) => ({ background: active ? '#D4AF37' : 'transparent', color: active ? '#000' : '#888', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '10px', transition: '0.3s' });
const refreshBtn = { background: 'transparent', color: '#00F2FF', border: '1px solid #00F2FF33', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '10px' };
const radarGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' };
const metricBox = (c: string) => ({ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', border: `1px solid ${c}55`, borderLeft: `4px solid ${c}` });
const metricLabel = { color: '#888', fontSize: '9px', fontWeight: 900, letterSpacing: '1px', marginBottom: '10px' };
const metricValue = { color: '#FFF', fontSize: '24px', fontFamily: 'Cinzel', fontWeight: 900 };
const vaultContainer = { display: 'flex', flexDirection: 'column' as const, height: 'calc(100vh - 250px)', padding: 0, overflow: 'hidden' };
const vaultHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const vaultTitle = { color: '#00F2FF', fontFamily: 'Cinzel', margin: 0, fontSize: '20px', letterSpacing: '2px' };
const vaultFilter = { background: 'rgba(0,0,0,0.5)', color: '#FFF', border: '1px solid #333', padding: '10px', borderRadius: '8px', fontSize: '12px', outline: 'none' };
const vaultSearchInput = { background: 'rgba(10,10,10,0.8)', color: '#FFF', border: '1px solid rgba(0,242,255,0.2)', padding: '10px 15px', borderRadius: '8px', width: '250px', outline: 'none' };
const syncBtn = (active: boolean) => ({ background: active ? '#D4AF37' : '#111', color: active ? '#000' : '#555', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, fontSize: '11px', cursor: active ? 'pointer' : 'not-allowed' });
const matrixTable = { width: '100%', color: '#FFF', textAlign: 'left' as const, borderCollapse: 'collapse' as const, minWidth: '2200px' };
const matrixHead = { position: 'sticky' as const, top: 0, zIndex: 10, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(10px)' };
const padTh = { padding: '15px 10px', borderBottom: '1px solid #333', color: '#666', fontSize: '10px', letterSpacing: '1px', whiteSpace: 'nowrap' as const };
const rowStyle = (edited: boolean) => ({ background: edited ? 'rgba(212,175,55,0.05)' : 'transparent' });
const imgCircle = { width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', background: '#111', border: '1px solid #333', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const imgFit = { width: '100%', height: '100%', objectFit: 'cover' as const };
const skuCell = { padding: '10px', fontFamily: 'monospace', color: '#666', fontSize: '12px', fontWeight: 900 };
const nameCell = { padding: '10px', width: '250px' };
const sheetInput = { background: 'transparent', border: 'none', color: '#FFF', padding: '8px', outline: 'none', fontSize: '14px', fontWeight: 900, width: '100%' };
const sheetSelect = { background: 'transparent', border: 'none', color: '#00F2FF', outline: 'none', fontWeight: 900, cursor: 'pointer', width: '100%' };
const deptSelect = { background: 'transparent', color: '#888', border: 'none', fontSize: '10px', outline: 'none', cursor: 'pointer' };
const typeSelect = (type: string) => ({ background: 'transparent', color: type === 'SERVICE' ? '#00F2FF' : (type === 'RAW' ? '#D4AF37' : '#FFF'), border: 'none', fontSize: '11px', fontWeight: 900, outline: 'none' });
const bomBadge = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, padding: '6px', background: 'rgba(0,242,255,0.1)', borderRadius: '6px', border: '1px solid rgba(0,242,255,0.3)', display: 'inline-block' };
const stockCell = (low: boolean) => ({ color: low ? '#FF3131' : '#00FF88', fontWeight: 900, fontSize: '13px' });
const rightCell = { padding: '10px', textAlign: 'right' as const };
const costInput = { background: 'transparent', border: '1px solid #222', color: '#FFF', width: '90px', textAlign: 'right' as const, padding: '6px', borderRadius: '6px', outline: 'none' };
const marginWrap = { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', border: '1px solid #333', width: '70px', margin: '0 auto' };
const marginInput = { background: 'transparent', border: 'none', color: '#D4AF37', width: '45px', textAlign: 'right' as const, fontWeight: 900, outline: 'none', padding: '6px 2px 6px 6px' };
const rpInput = { background: 'transparent', border: '1px solid #222', color: '#00F2FF', width: '90px', textAlign: 'right' as const, padding: '6px', borderRadius: '6px', fontWeight: 900, outline: 'none' };
const centerCell = { padding: '10px', textAlign: 'center' as const };
const fadeInAnim = { animation: 'fadeIn 0.5s ease' };
const overridePanel = { padding: '30px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #00F2FF55' };
const overrideTitle = { color: '#00F2FF', fontSize: '12px', margin: '0 0 10px 0' };
const searchDropdown = { maxHeight:'150px', overflowY:'auto' as const, border:'1px solid #222', borderRadius:'8px', marginTop:'10px', background: 'transparent' };
const searchResult = { padding:'15px', borderBottom:'1px solid #111', cursor:'pointer', fontSize:'12px', color:'#FFF', display:'flex', justifyContent:'space-between' };
const registerGrid = { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' };
const panelStyle = { padding: '30px', borderRadius: '20px' };
const sectionTitle = { color: '#FFF', fontSize: '14px', marginBottom: '25px', borderLeft: '4px solid #D4AF37', paddingLeft: '15px', textTransform: 'uppercase' as const, letterSpacing: '1px' };
const toggleRow = { display: 'flex', gap: '10px', marginBottom: '25px' };
const typeToggle = (active: boolean) => ({ flex: 1, padding: '12px', background: active ? 'rgba(212,175,55,0.1)' : 'transparent', color: active ? '#D4AF37' : '#444', border: `1px solid ${active ? '#D4AF37' : '#222'}`, borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '10px', letterSpacing: '1px', transition: '0.3s' });
const inputRow = { display: 'flex', gap: '20px', marginBottom: '20px' };
const labelStyle = { display: 'block', fontSize: '9px', color: '#666', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' };
const inputStyle = { width: '100%', background: '#000', border: '1px solid #222', padding: '15px', color: '#FFF', borderRadius: '8px', outline: 'none', fontSize: '12px' };
const costTelemetry = { background: 'rgba(0,0,0,0.6)', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginTop: '20px' };
const telemetryRow = { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' };
const progressBar = { width: '100%', height: '4px', background: '#222', borderRadius: '2px' };
const progressFill = (m: number) => ({ width: `${Math.min(m, 100)}%`, height: '100%', background: m > 50 ? '#00FF88' : '#D4AF37', borderRadius: '2px' });
const commitBtnStyle = { width: '100%', padding: '20px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' as const };
const replenishPanel = { padding: '40px', maxWidth: '600px', margin: '0 auto', border: '1px solid #00FF8833', borderRadius: '20px', background: 'rgba(0,0,0,0.4)' };
const replenishBtn = { width: '100%', padding: '20px', background: '#00FF88', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', marginTop: '10px', textTransform: 'uppercase' as const };
const sheetTh = { padding: '15px 10px', borderRight: '1px solid #222' };
const sheetTd = { padding: '5px 10px', borderRight: '1px solid #222' };
const pageBtn = (active: boolean) => ({ background: active ? 'rgba(255,255,255,0.05)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: active ? '#FFF' : '#444', padding: '10px 20px', borderRadius: '8px', cursor: active ? 'pointer' : 'not-allowed', fontSize: '10px', fontWeight: 900, letterSpacing: '1px' });
