"use client";
import React, { useState } from "react";
import { Plus, Trash2, Save, Truck, Percent, Calculator, Upload } from "lucide-react";
import { useToast } from "./SovereignToast";
import { useCurrencyLang } from "./CurrencyLangContext";

// ================================================================
// COMMISSION ARCHITECT BOM -- Z-26 FLEET / AVIATION (V1.0)
// ARCHITECTURE: Third-party vendor model
//   COGS      = Vendor Base Rate + Add-on Components
//   COMMISSION = Hotel Markup % applied on COGS
//   RETAIL     = COGS + Commission
// ================================================================

type DurationType = 'PER_TRIP' | 'HOURLY' | 'HALF_DAY' | 'FULL_DAY' | 'MULTI_DAY';

interface VendorComponent {
  id: string;
  name: string;       // e.g. "Driver Fee", "Fuel Surcharge", "Port Tax"
  cost: number;
  included: boolean;  // included in base rate or billed separately
}

const DURATION_LABELS: Record<DurationType, string> = {
  PER_TRIP: 'Per Trip (Fixed)',
  HOURLY: 'Per Hour',
  HALF_DAY: 'Half Day (4hrs)',
  FULL_DAY: 'Full Day (8hrs)',
  MULTI_DAY: 'Multi-Day Package',
};

const FLEET_SUB_DEPTS = [
  'AIRPORT TRANSFER', 'CITY TOUR', 'YACHT CHARTER',
  'HELICOPTER', 'CAR RENTAL', 'VIP ESCORT', 'SPEEDBOAT', 'CUSTOM'
];

interface Props {
  onSaveSuccess?: () => void;
}

export default function CommissionArchitectBOM({ onSaveSuccess }: Props) {
  const { showToast } = useToast();
  const { formatMoney, currencySymbol } = useCurrencyLang();

  // Service Identity
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceImg, setServiceImg] = useState('');
  const [subDept, setSubDept] = useState('AIRPORT TRANSFER');
  const [customDept, setCustomDept] = useState('');
  const [durationType, setDurationType] = useState<DurationType>('PER_TRIP');
  const [minDuration, setMinDuration] = useState(1);

  // Vendor / Commission
  const [vendorName, setVendorName] = useState('');
  const [vendorBaseRate, setVendorBaseRate] = useState<number>(0);
  const [components, setComponents] = useState<VendorComponent[]>([
    { id: 'drv', name: 'Driver / Guide', cost: 0, included: true },
    { id: 'fuel', name: 'Fuel', cost: 0, included: true },
    { id: 'ins', name: 'Insurance', cost: 0, included: false },
  ]);
  const [commissionPct, setCommissionPct] = useState<number>(20);
  const [vatPct, setVatPct] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // --- FINANCIAL CALCULATIONS ---
  const totalVendorCost = vendorBaseRate + components.reduce((s, c) => s + (c.included ? c.cost : 0), 0);
  const commissionAmount = totalVendorCost * (commissionPct / 100);
  const preVatRetail = totalVendorCost + commissionAmount;
  const vatAmount = preVatRetail * (vatPct / 100);
  const guestRetailPrice = preVatRetail + vatAmount;
  const trueMarginPct = guestRetailPrice > 0 ? ((commissionAmount / guestRetailPrice) * 100) : 0;

  // --- COMPONENT MANAGEMENT ---
  const addComponent = () => {
    setComponents([...components, { id: Date.now().toString(), name: '', cost: 0, included: false }]);
  };
  const updateComponent = (id: string, field: keyof VendorComponent, value: any) => {
    setComponents(components.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  // --- SAVE ---
  const handleSave = async () => {
    if (!serviceName) return showToast('Service Name is required', 'error');
    if (vendorBaseRate <= 0) return showToast('Vendor Base Rate must be greater than 0', 'error');
    if (guestRetailPrice <= 0) return showToast('Retail price calculation error', 'error');

    setIsSaving(true);
    const finalSubDept = subDept === 'CUSTOM' ? customDept.toUpperCase() : subDept;

    // BOM stores vendor components for audit trail
    const bom = [
      { rawId: 'VENDOR_BASE', name: `${vendorName || 'Vendor'} Base Rate`, qty: 1, unit: durationType, unitCost: vendorBaseRate },
      ...components.filter(c => c.included).map(c => ({
        rawId: c.id, name: c.name, qty: 1, unit: 'INCLUDED', unitCost: c.cost
      })),
    ];

    const payload = {
      id: `FLT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      name: serviceName.toUpperCase(),
      type: 'SERVICE',
      dept: `Z-26-${finalSubDept}`,
      cat: 'FLEET_SERVICE',
      pp: totalVendorCost,          // purchase price = vendor cost (COGS)
      rp: guestRetailPrice,         // retail price to guest
      stock: 9999,                  // unlimited (vendor capacity)
      min_level: 0,
      s_unit: durationType,
      p_unit: 'CONTRACT',
      factor: 1,
      margin: commissionPct.toFixed(2),
      desc: serviceDesc || `${vendorName ? vendorName + ' | ' : ''}${DURATION_LABELS[durationType]} | Commission: ${commissionPct}%`,
      img: serviceImg,
      bom: bom,
      // Extra metadata for fleet booking UI
      meta: JSON.stringify({
        vendor: vendorName,
        vendorRate: vendorBaseRate,
        commissionPct,
        vatPct,
        durationType,
        minDuration,
        components,
      })
    };

    try {
      const res = await fetch('/api/inventory/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([payload])
      });
      if (res.ok) {
        showToast(`Fleet Service "${serviceName}" Commissioned & Vaulted`, 'success');
        setServiceName(''); setServiceDesc(''); setServiceImg('');
        setVendorName(''); setVendorBaseRate(0); setCommissionPct(20);
        setComponents([
          { id: 'drv', name: 'Driver / Guide', cost: 0, included: true },
          { id: 'fuel', name: 'Fuel', cost: 0, included: true },
          { id: 'ins', name: 'Insurance', cost: 0, included: false },
        ]);
        if (onSaveSuccess) onSaveSuccess();
      } else {
        showToast('Failed to save fleet service', 'error');
      }
    } catch (e) {
      showToast('Network error — check VPS connection', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 p-4 overflow-y-auto">

      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-cyan-900/40 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400"><Truck size={22} /></div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide">Commission Architect</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Z-26 Fleet & Aviation — Vendor Commission Model</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: SERVICE IDENTITY */}
        <div className="flex flex-col gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Service Identity</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Service Name *</label>
              <input type="text" value={serviceName} onChange={e => setServiceName(e.target.value)}
                placeholder="e.g. AIRPORT RETURN TRANSFER" className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors" />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Sub-Department</label>
              <select value={subDept} onChange={e => setSubDept(e.target.value)}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 appearance-none">
                {FLEET_SUB_DEPTS.map(d => <option key={d} value={d}>{d === 'CUSTOM' ? 'CUSTOM...' : d}</option>)}
              </select>
            </div>

            {subDept === 'CUSTOM' && (
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 uppercase tracking-wider">Custom Name</label>
                <input type="text" value={customDept} onChange={e => setCustomDept(e.target.value)}
                  placeholder="e.g. BUGGY TOUR" className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500" />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Duration Type</label>
              <select value={durationType} onChange={e => setDurationType(e.target.value as DurationType)}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 appearance-none">
                {Object.entries(DURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Min. Duration ({durationType === 'HOURLY' ? 'hrs' : 'units'})</label>
              <input type="number" value={minDuration} onChange={e => setMinDuration(Number(e.target.value))} min={1}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500" />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Cover Image URL</label>
              <div className="relative">
                <input type="text" value={serviceImg} onChange={e => setServiceImg(e.target.value)}
                  placeholder="https://..." className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 pl-10 text-white focus:outline-none focus:border-cyan-500" />
                <Upload size={16} className="absolute left-3 top-3.5 text-zinc-500" />
              </div>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Guest-Facing Description</label>
              <textarea value={serviceDesc} onChange={e => setServiceDesc(e.target.value)}
                placeholder="Describe what the guest experiences..." rows={2}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        </div>

        {/* RIGHT: VENDOR & COMMISSION */}
        <div className="flex flex-col gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Vendor & Commission</h3>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 uppercase tracking-wider">Vendor / Partner Name</label>
            <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)}
              placeholder="e.g. Silver Wings Aviation Ltd." className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 uppercase tracking-wider">Vendor Base Rate ({currencySymbol}) — {DURATION_LABELS[durationType]}</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-zinc-400">{currencySymbol}</span>
              <input type="number" value={vendorBaseRate || ''} onChange={e => setVendorBaseRate(Number(e.target.value))} min={0}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 pl-7 text-white text-lg font-bold focus:outline-none focus:border-cyan-500" placeholder="0" />
            </div>
          </div>

          {/* Add-on Components */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Add-on Components</label>
              <button onClick={addComponent} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                <Plus size={14} /> Add Line
              </button>
            </div>
            <div className="space-y-2">
              {components.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-black/30 border border-zinc-800/60 rounded-lg p-2">
                  <input type="checkbox" checked={c.included} onChange={e => updateComponent(c.id, 'included', e.target.checked)}
                    className="accent-cyan-500 w-4 h-4 flex-shrink-0" title="Include in COGS" />
                  <input type="text" value={c.name} onChange={e => updateComponent(c.id, 'name', e.target.value)}
                    placeholder="Component name" className="flex-1 bg-transparent text-sm text-zinc-200 focus:outline-none" />
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500 text-xs">{currencySymbol}</span>
                    <input type="number" value={c.cost || ''} onChange={e => updateComponent(c.id, 'cost', Number(e.target.value))} min={0}
                      className="w-20 bg-black/50 border border-zinc-800 rounded px-2 py-1 text-sm text-white focus:outline-none text-right" placeholder="0" />
                  </div>
                  <button onClick={() => removeComponent(c.id)} className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-1">✓ Checked items are included in vendor COGS</p>
          </div>

          {/* Commission & VAT */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1"><Percent size={11} /> Hotel Commission %</label>
              <input type="number" value={commissionPct} onChange={e => setCommissionPct(Number(e.target.value))} min={0} max={100}
                className="w-full bg-black/40 border border-cyan-900 rounded-lg p-3 text-cyan-400 font-bold text-lg focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">VAT on Guest Price %</label>
              <input type="number" value={vatPct} onChange={e => setVatPct(Number(e.target.value))} min={0} max={100}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        </div>
      </div>

      {/* FINANCIAL SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/40 border border-zinc-800 rounded-xl p-4">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 font-mono flex items-center gap-1"><Calculator size={11} /> VENDOR COST (COGS)</span>
          <span className="text-xl font-bold text-red-400 font-mono mt-1">{formatMoney(totalVendorCost)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 font-mono flex items-center gap-1"><Percent size={11} /> COMMISSION EARNED</span>
          <span className="text-xl font-bold text-cyan-400 font-mono mt-1">{formatMoney(commissionAmount)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 font-mono">VAT ({vatPct}%)</span>
          <span className="text-xl font-bold text-amber-400 font-mono mt-1">{formatMoney(vatAmount)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 font-mono">GUEST RETAIL PRICE</span>
          <span className="text-2xl font-black text-green-400 font-mono mt-1">{formatMoney(guestRetailPrice)}</span>
          <span className="text-xs text-zinc-600 mt-0.5">True Margin: {trueMarginPct.toFixed(1)}%</span>
        </div>
      </div>

      <button onClick={handleSave} disabled={isSaving || !serviceName || vendorBaseRate <= 0}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold tracking-widest text-sm transition-all ${
          isSaving || !serviceName || vendorBaseRate <= 0
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-xl shadow-cyan-500/20'
        }`}>
        {isSaving ? 'Commissioning to Vault...' : <><Save size={18} /> Commission & Publish Fleet Service</>}
      </button>
    </div>
  );
}
