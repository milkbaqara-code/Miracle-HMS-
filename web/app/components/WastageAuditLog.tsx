"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Trash2, Save, X, Search, FileText } from "lucide-react";
import { useToast } from "./SovereignToast";
import { useCurrencyLang } from "./CurrencyLangContext";

interface VaultItem {
  id: string;
  name: string;
  type: string;
  cat: string;
  stock: number;
  pp: number;
  p_unit: string;
}

interface WastageAuditProps {
  onClose: () => void;
  onLogged?: () => void;
}

export default function WastageAuditLog({ onClose, onLogged }: WastageAuditProps) {
  const [inventory, setInventory] = useState<VaultItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [wastageQty, setWastageQty] = useState<number>(0);
  const [reason, setReason] = useState("");
  const { showToast } = useToast();
  const { formatMoney } = useCurrencyLang();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/live");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "SUCCESS") {
          // Allow wasting both raw and retail products
          setInventory(data.data.filter((i: any) => i.type === "PRODUCT" || i.type === "RAW"));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = inventory.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const costImpact = selectedItem ? (selectedItem.pp * wastageQty) : 0;

  const handleLogWastage = async () => {
    if (!selectedItem) return showToast("No item selected", "error");
    if (wastageQty <= 0) return showToast("Quantity must be > 0", "error");
    if (!reason.trim()) return showToast("Reason is required for audit trails", "error");
    if (wastageQty > selectedItem.stock) return showToast("Wastage exceeds available stock", "error");

    setIsSubmitting(true);
    try {
      const payload = {
        product_id: selectedItem.id,
        qty_changed: wastageQty,
        reason: reason,
        department: "GLOBAL_AUDIT", // Can be wired to auth user context
        cost_impact: costImpact,
        operator: "Admin", // Would be from auth context
      };

      const res = await fetch("/api/inventory/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`Wastage Logged: ${selectedItem.name}`, "success");
        if (onLogged) onLogged();
        onClose();
      } else {
        const err = await res.json();
        showToast(err.detail || "Audit logging failed", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network Error connecting to Zone 12", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-amber-500/10">
          <div className="flex items-center gap-3 text-amber-500">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold tracking-wider">WASTAGE AUDIT LEDGER</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* LEFT: ITEM SEARCH */}
          <div className="w-full md:w-1/2 border-r border-zinc-800 flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-black/20">
              <div className="relative">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search vault to mark wastage..."
                  className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="text-center text-zinc-500 py-10 animate-pulse text-sm">Scanning Vault...</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-zinc-600 py-10 text-sm">No items found</div>
              ) : (
                filteredItems.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => { setSelectedItem(item); setWastageQty(0); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedItem?.id === item.id 
                        ? 'bg-amber-500/10 border-amber-500/50' 
                        : 'bg-black/20 border-zinc-800/50 hover:bg-black/40 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <p className={`text-sm font-medium ${selectedItem?.id === item.id ? 'text-amber-400' : 'text-zinc-200'}`}>
                        {item.name}
                      </p>
                      <span className="text-xs font-mono text-zinc-500">{item.stock.toFixed(1)} {item.p_unit}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: AUDIT FORM */}
          <div className="w-full md:w-1/2 flex flex-col p-5 bg-black/10">
            {!selectedItem ? (
              <div className="flex-1 flex flex-col justify-center items-center text-zinc-600">
                <Trash2 size={48} className="opacity-20 mb-4" />
                <p>Select an item to declare wastage.</p>
                <p className="text-xs mt-2 max-w-[200px] text-center">Wastage reduces vault stock without generating revenue.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedItem.name}</h3>
                  <div className="flex gap-4 mt-2">
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400 font-mono">
                      VAULT: {selectedItem.stock.toFixed(2)} {selectedItem.p_unit}
                    </span>
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400 font-mono">
                      COGS: {formatMoney(selectedItem.pp)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Lost / Damaged Quantity</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        value={wastageQty || ""}
                        onChange={(e) => setWastageQty(parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-zinc-700 rounded-l-lg p-3 text-white text-lg font-mono focus:outline-none focus:border-amber-500 transition-colors"
                        placeholder="0.00"
                        min="0"
                        max={selectedItem.stock}
                        step="0.1"
                      />
                      <span className="bg-zinc-800 border border-l-0 border-zinc-700 rounded-r-lg px-4 py-3 text-zinc-400 font-mono">
                        {selectedItem.p_unit}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <FileText size={12} /> Audit Reason
                    </label>
                    <textarea 
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-black/40 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="e.g. Broken bottle during transport..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-zinc-800">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm text-zinc-400">Total Financial Impact:</span>
                    <span className="text-2xl font-bold text-red-400 font-mono">
                      -{formatMoney(costImpact)}
                    </span>
                  </div>
                  
                  <button 
                    onClick={handleLogWastage}
                    disabled={isSubmitting || wastageQty <= 0 || !reason}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold tracking-wide transition-all ${
                      isSubmitting || wastageQty <= 0 || !reason
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    {isSubmitting ? "Committing Audit Log..." : <><Trash2 size={18} /> Declare Wastage</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
