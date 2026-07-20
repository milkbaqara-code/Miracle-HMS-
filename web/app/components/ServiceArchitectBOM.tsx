"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useToast } from "./SovereignToast";
import { useCurrencyLang } from "./CurrencyLangContext";

// ============================================================
// SOVEREIGN ARCHITECT ENGINE V2.0
// Full CRUD: Create / Edit / Delete for all Zone Services
// Pure Inline CSS - Glassmorphic Neon - Zero Tailwind
// Zones: Z-26 Fleet | Z-27 Wellness | Z-28 Boutique
//        Z-29 Gastronomy | Z-17 Cinema
// ============================================================

interface RawItem {
  id: string; name: string; cat: string;
  pp: number; stock: number; p_unit: string; s_unit: string; factor: number;
}
interface BOMIngredient {
  rawId: string; name: string; qty: number; unit: string; unitCost: number;
}
interface VaultItem {
  id: string; name: string; type: string; dept: string; cat: string;
  pp: number; rp: number; stock: number; margin: string; img: string;
  desc: string; bom: BOMIngredient[];
}
interface ServiceArchitectProps {
  department: string;
  zonePrefix?: string;
  onSaveSuccess?: () => void;
  primaryColor?: string;
}

// Zone color resolver
const ZONE_COLORS: Record<string, string> = {
  purple: "#9D00FF", cyan: "#00F2FF", amber: "#F59E0B",
  green: "#00FF88", pink: "#FF6B9D", gold: "#D4AF37", red: "#FF3131",
};
const getColor = (c: string) => ZONE_COLORS[c] || ZONE_COLORS.cyan;

// Sub-department options per zone
const SUB_DEPT_OPTIONS: Record<string, string[]> = {
  "Z-19": ["VILLA", "APARTMENT", "STANDARD", "SUITE", "PENTHOUSE", "CRUISE", "CUSTOM"],
  "Z-26": ["AIRPORT TRANSFER","CITY TOUR","YACHT CHARTER","HELICOPTER","CAR RENTAL","VIP ESCORT","CUSTOM"],
  "Z-27": ["MASSAGE","SPA TREATMENT","POOL & GYM","BEAUTY & GROOMING","MEDITATION","HYDROTHERAPY","CUSTOM"],
  "Z-28": ["LUXURY GOODS","FASHION","ACCESSORIES","GIFT SET","PERFUMERY","WATCHES & JEWELLERY","CUSTOM"],
  "Z-29": ["RESTAURANT","COFFEE & BAR","ROOM SERVICE","MINI SHOP","BANQUET","POOL DINING","CUSTOM"],
  "Z-17": ["PREMIERE HALL","VIP SCREENING","STANDARD","EVENT BOOKING","PRIVATE HIRE","CUSTOM"],
};

const API = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

// ---- Delete Confirm Modal ----
function DeleteModal({ item, onConfirm, onCancel, color }: { item: VaultItem; onConfirm: () => void; onCancel: () => void; color: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(10px)" }}>
      <div style={{ background: "rgba(15,5,5,0.97)", border: `1px solid ${color}44`, borderRadius: "20px", padding: "40px", maxWidth: "420px", width: "90%", boxShadow: `0 0 60px ${color}22`, textAlign: "center" }}>
        <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(255,49,49,0.1)", border: "1px solid #FF313144", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "24px" }}>🗑️</div>
        <div style={{ fontSize: "11px", color: "#666", letterSpacing: "2px", marginBottom: "10px" }}>CONFIRM DELETE</div>
        <div style={{ fontSize: "20px", fontWeight: 900, color: "#FFF", marginBottom: "8px" }}>{item.name}</div>
        <div style={{ fontSize: "12px", color: "#555", marginBottom: "30px" }}>SKU: {item.id} | This action cannot be undone.</div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#888", fontWeight: 700, cursor: "pointer", fontSize: "12px", letterSpacing: "1px" }}>CANCEL</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "12px", background: "rgba(255,49,49,0.15)", border: "1px solid #FF313166", borderRadius: "10px", color: "#FF3131", fontWeight: 900, cursor: "pointer", fontSize: "12px", letterSpacing: "1px" }}>DELETE PERMANENTLY</button>
        </div>
      </div>
    </div>
  );
}

// ---- BOM Row ----
function BOMRow({ item, onQtyChange, onRemove, color, formatMoney }: { item: BOMIngredient; onQtyChange: (id: string, qty: number) => void; onRemove: (id: string) => void; color: string; formatMoney: (n: number) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: "10px", marginBottom: "8px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#DDD" }}>{item.name}</div>
        <div style={{ fontSize: "10px", color: "#555", marginTop: "2px", fontFamily: "monospace" }}>Cost: {formatMoney(item.unitCost)} / {item.unit}</div>
      </div>
      <input type="number" value={item.qty} min="0" step="0.1"
        onChange={e => onQtyChange(item.rawId, parseFloat(e.target.value) || 0)}
        style={{ width: "70px", background: "rgba(0,0,0,0.4)", border: `1px solid ${color}33`, borderRadius: "8px", padding: "6px 10px", color: "#FFF", textAlign: "center", fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }} />
      <div style={{ width: "80px", textAlign: "right", fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color }}>{formatMoney(item.qty * item.unitCost)}</div>
      <button onClick={() => onRemove(item.rawId)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "18px", lineHeight: 1, transition: "color 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#FF3131")} onMouseLeave={e => (e.currentTarget.style.color = "#444")}>×</button>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ServiceArchitectBOM({ department, zonePrefix = "Z-29", onSaveSuccess, primaryColor = "cyan" }: ServiceArchitectProps) {
  const color = getColor(primaryColor);
  const { showToast } = useToast();
  const { formatMoney, currencySymbol } = useCurrencyLang();

  // Mode: "gallery" | "create" | "edit"
  const [mode, setMode] = useState<"gallery" | "create" | "edit">("gallery");

  // All zone items (for gallery + edit search)
  const [zoneItems, setZoneItems] = useState<VaultItem[]>([]);
  // Raw materials (for BOM builder)
  const [rawInventory, setRawInventory] = useState<RawItem[]>([]);
  const [rawSearch, setRawSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit search
  const [editSearch, setEditSearch] = useState("");
  const [editSearchOpen, setEditSearchOpen] = useState(false);
  const editSearchRef = useRef<HTMLDivElement>(null);

  // Form state (shared between create and edit)
  const [editId, setEditId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [serviceImg, setServiceImg] = useState("");
  const [subDept, setSubDept] = useState("GENERAL");
  const [customDept, setCustomDept] = useState("");
  const [ingredients, setIngredients] = useState<BOMIngredient[]>([]);
  const [retailPrice, setRetailPrice] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const subDeptOpts = SUB_DEPT_OPTIONS[zonePrefix] || ["GENERAL", "VIP", "STANDARD", "CUSTOM"];

  const totalCogs = ingredients.reduce((s, i) => s + i.unitCost * i.qty, 0);
  const profitMargin = retailPrice > 0 ? ((retailPrice - totalCogs) / retailPrice) * 100 : 0;

  // Fetch all data
  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/inventory/live`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.status === "SUCCESS" && Array.isArray(data.data)) {
        const all: VaultItem[] = data.data.map((r: any) => ({
          id: String(r.id), name: String(r.name), type: String(r.type),
          dept: String(r.dept), cat: String(r.cat), pp: Number(r.pp) || 0,
          rp: Number(r.rp) || 0, stock: Number(r.stock) || 0,
          margin: String(r.margin || "0"), img: String(r.img || ""),
          desc: String(r.desc || ""), bom: Array.isArray(r.bom) ? r.bom : [],
        }));
        const zoneFiltered = all.filter(i =>
          i.dept.startsWith(zonePrefix) && i.type !== "RAW_MATERIAL" && i.type !== "RAW"
        );
        setZoneItems(zoneFiltered);
        const raws = all.filter(i => i.type === "RAW_MATERIAL" || i.type === "RAW" || i.type === "PRODUCT");
        setRawInventory(raws as any);
      }
    } catch { showToast("Vault sync failed", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Reset form
  const resetForm = () => {
    setEditId(null); setServiceName(""); setServiceDesc(""); setServiceImg("");
    setSubDept(subDeptOpts[0]); setCustomDept(""); setIngredients([]); setRetailPrice(0);
    setEditSearch("");
  };

  // Load item into edit form
  const loadForEdit = (item: VaultItem) => {
    setEditId(item.id);
    setServiceName(item.name);
    setServiceDesc(item.desc);
    setServiceImg(item.img);
    const deptSuffix = item.dept.replace(`${zonePrefix}-`, "");
    if (subDeptOpts.includes(deptSuffix)) setSubDept(deptSuffix);
    else { setSubDept("CUSTOM"); setCustomDept(deptSuffix); }
    const bomArr: BOMIngredient[] = Array.isArray(item.bom) ? item.bom.map((b: any) => ({
      rawId: String(b.rawId || b.id || ""), name: String(b.name || ""),
      qty: Number(b.qty) || 1, unit: String(b.unit || "UNIT"),
      unitCost: Number(b.unitCost) || 0,
    })) : [];
    setIngredients(bomArr);
    setRetailPrice(item.rp || 0);
    setEditSearch(item.name);
    setEditSearchOpen(false);
    setMode("edit");
  };

  // Add raw ingredient to BOM
  const addIngredient = (item: RawItem) => {
    if (ingredients.find(i => i.rawId === item.id)) return;
    const unitCost = item.factor > 0 ? item.pp / item.factor : item.pp;
    setIngredients(prev => [...prev, { rawId: item.id, name: item.name, qty: 1, unit: item.s_unit || "UNIT", unitCost }]);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!serviceName.trim()) return showToast("Service name is required", "error");
    if (retailPrice <= 0) return showToast("Retail price must be greater than 0", "error");
    setIsSaving(true);
    try {
      const deptFull = `${zonePrefix}-${(subDept === "CUSTOM" ? customDept : subDept).toUpperCase().replace(`${zonePrefix}-`, "")}`;
      const payload = {
        name: serviceName.trim().toUpperCase(),
        dept: deptFull, cat: "COMPILED_SERVICE",
        pp: totalCogs, rp: retailPrice,
        stock: 9999, min_level: 0,
        s_unit: "PKG", p_unit: "PKG", factor: 1,
        margin: profitMargin.toFixed(2),
        desc: serviceDesc, img: serviceImg, bom: ingredients,
      };

      let res: Response;
      if (mode === "edit" && editId) {
        res = await fetch(`${API}/inventory/update/${editId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        const createPayload = { ...payload, id: `SVC-${Math.random().toString(36).substr(2, 6).toUpperCase()}` };
        res = await fetch(`${API}/inventory/bulk-register`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([createPayload]),
        });
      }
      if (res.ok) {
        showToast(mode === "edit" ? `${serviceName} updated!` : `${serviceName} published to Vault!`, "success");
        resetForm(); await fetchAll();
        setMode("gallery");
        if (onSaveSuccess) onSaveSuccess();
      } else {
        showToast("Failed to save. Check network.", "error");
      }
    } catch { showToast("Network error", "error"); }
    finally { setIsSaving(false); }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API}/inventory/delete/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`${deleteTarget.name} removed from Vault`, "success");
        setDeleteTarget(null);
        await fetchAll();
      } else showToast("Delete failed", "error");
    } catch { showToast("Network error", "error"); }
    finally { setIsDeleting(false); }
  };

  const filteredRaw = rawInventory.filter((i: any) =>
    (i.name || "").toLowerCase().includes(rawSearch.toLowerCase()) ||
    (i.id || "").toLowerCase().includes(rawSearch.toLowerCase())
  );

  const editSearchFiltered = useMemo(() =>
    zoneItems.filter(i =>
      i.name.toLowerCase().includes(editSearch.toLowerCase()) ||
      i.id.toLowerCase().includes(editSearch.toLowerCase())
    ), [zoneItems, editSearch]);

  // ---- Styles ----
  const panel = (c = color): React.CSSProperties => ({
    background: "rgba(255,255,255,0.015)", border: `1px solid ${c}22`,
    borderRadius: "18px", padding: "24px", boxShadow: `0 0 40px ${c}08`,
  });
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(0,0,0,0.4)", border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: "10px", padding: "12px 16px", color: "#FFF", fontSize: "13px",
    outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: "10px", color: "#555", fontWeight: 900, letterSpacing: "1.5px", marginBottom: "6px", display: "block" };
  const modeBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px", borderRadius: "10px", fontWeight: 900, fontSize: "11px",
    letterSpacing: "1.5px", cursor: "pointer", transition: "all 0.2s",
    background: active ? `${color}18` : "rgba(255,255,255,0.03)",
    border: active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
    color: active ? color : "#666",
  });

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px", padding: "20px", boxSizing: "border-box" }}>
      <style>{`
        .arch-input:focus { border-color: ${color} !important; box-shadow: 0 0 0 3px ${color}15; }
        .raw-row:hover { border-color: ${color}55 !important; background: ${color}08 !important; }
        .gallery-row:hover { border-color: ${color}33 !important; }
        @keyframes archFade { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .arch-panel { animation: archFade 0.3s ease forwards; }
      `}</style>

      {deleteTarget && (
        <DeleteModal item={deleteTarget} color={color}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* ---- Header ---- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#FFF", letterSpacing: "1px" }}>
            <span style={{ color }}>⚒</span> Architect Engine
          </div>
          <div style={{ fontSize: "11px", color: "#555", letterSpacing: "2px", marginTop: "4px" }}>{zonePrefix} — {department}</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={modeBtn(mode === "gallery")} onClick={() => { resetForm(); setMode("gallery"); }}>📋 GALLERY</button>
          <button style={modeBtn(mode === "create")} onClick={() => { resetForm(); setMode("create"); }}>+ CREATE NEW</button>
          <button style={modeBtn(mode === "edit")} onClick={() => { resetForm(); setMode("edit"); }}>✏️ EDIT EXISTING</button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODE: GALLERY MANAGE */}
      {/* ============================================================ */}
      {mode === "gallery" && (
        <div className="arch-panel" style={panel()}>
          <div style={{ fontSize: "14px", color: "#FFF", fontWeight: 700, marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{zonePrefix} — {department} Gallery</span>
            <span style={{ fontSize: "11px", color: "#555" }}>{zoneItems.length} items</span>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#555", fontSize: "12px", letterSpacing: "2px" }}>SYNCING VAULT...</div>
          ) : zoneItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#333", border: "1px dashed #222", borderRadius: "14px" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>📦</div>
              <div style={{ fontSize: "13px", color: "#555" }}>No items in this zone yet.</div>
              <button onClick={() => setMode("create")} style={{ marginTop: "16px", padding: "10px 24px", background: `${color}15`, border: `1px solid ${color}44`, borderRadius: "8px", color, fontSize: "11px", fontWeight: 900, cursor: "pointer", letterSpacing: "1px" }}>+ CREATE FIRST ITEM</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px", gap: "12px", padding: "8px 16px", fontSize: "9px", color: "#444", fontWeight: 900, letterSpacing: "1.5px" }}>
                <span>NAME / SKU</span><span style={{ textAlign: "right" }}>COGS</span><span style={{ textAlign: "right" }}>PRICE</span><span style={{ textAlign: "right" }}>MARGIN</span><span style={{ textAlign: "center" }}>ACTIONS</span>
              </div>
              {zoneItems.map(item => {
                const margin = parseFloat(item.margin) || 0;
                const mc = margin > 50 ? "#00FF88" : margin > 25 ? "#F59E0B" : "#FF3131";
                return (
                  <div key={item.id} className="gallery-row" style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 80px", gap: "12px", padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px", alignItems: "center", transition: "0.2s" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#DDD" }}>{item.name}</div>
                      <div style={{ fontSize: "10px", color: "#444", marginTop: "3px", fontFamily: "monospace" }}>{item.id} · {item.dept}</div>
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13px", color: "#FF3131" }}>{formatMoney(item.pp)}</div>
                    <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13px", color }}>{formatMoney(item.rp)}</div>
                    <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13px", fontWeight: 900, color: mc }}>{margin.toFixed(1)}%</div>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                      <button title="Edit" onClick={() => loadForEdit(item)} style={{ padding: "6px 10px", background: `${color}15`, border: `1px solid ${color}33`, borderRadius: "7px", color, cursor: "pointer", fontSize: "13px", transition: "0.2s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${color}30`)} onMouseLeave={e => (e.currentTarget.style.background = `${color}15`)}>✏️</button>
                      <button title="Delete" onClick={() => setDeleteTarget(item)} style={{ padding: "6px 10px", background: "rgba(255,49,49,0.1)", border: "1px solid rgba(255,49,49,0.2)", borderRadius: "7px", color: "#FF3131", cursor: "pointer", fontSize: "13px", transition: "0.2s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,49,49,0.25)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,49,49,0.1)")}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODE: CREATE or EDIT — Two-column layout */}
      {/* ============================================================ */}
      {(mode === "create" || mode === "edit") && (
        <div className="arch-panel" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", alignItems: "start" }}>

          {/* LEFT: Form */}
          <div style={panel()}>
            {/* Edit search bar */}
            {mode === "edit" && (
              <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative" }} ref={editSearchRef}>
                <label style={labelStyle}>🔍 SEARCH ITEM TO EDIT (SKU or NAME)</label>
                <input className="arch-input" style={{ ...inputStyle, border: `1px solid ${color}44`, boxSizing: "border-box" }}
                  placeholder="Type SKU or product name..."
                  value={editSearch}
                  onChange={e => { setEditSearch(e.target.value); setEditSearchOpen(true); }}
                  onFocus={() => setEditSearchOpen(true)} />
                {editSearchOpen && editSearch && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(8,8,8,0.98)", border: `1px solid ${color}33`, borderRadius: "10px", zIndex: 50, maxHeight: "220px", overflowY: "auto", marginTop: "4px", boxShadow: `0 10px 40px rgba(0,0,0,0.8)` }}>
                    {editSearchFiltered.length === 0 ? (
                      <div style={{ padding: "16px", color: "#555", fontSize: "12px", textAlign: "center" }}>No items found</div>
                    ) : editSearchFiltered.map(item => (
                      <div key={item.id} onClick={() => loadForEdit(item)} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${color}12`)} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#DDD" }}>{item.name}</div>
                        <div style={{ fontSize: "10px", color: "#555", marginTop: "2px", fontFamily: "monospace" }}>{item.id} · {item.dept}</div>
                      </div>
                    ))}
                  </div>
                )}
                {editId && (
                  <div style={{ marginTop: "8px", padding: "8px 14px", background: `${color}12`, border: `1px solid ${color}33`, borderRadius: "8px", fontSize: "11px", color, fontWeight: 700 }}>
                    EDITING: {editId}
                  </div>
                )}
              </div>
            )}

            {/* Form fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>SERVICE / PRODUCT NAME</label>
                <input className="arch-input" style={inputStyle} placeholder="e.g. DEEP TISSUE MASSAGE" value={serviceName} onChange={e => setServiceName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>SUB-DEPARTMENT</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select className="arch-input" style={{ ...inputStyle, flex: 1 }} value={subDept} onChange={e => setSubDept(e.target.value)}>
                    {subDeptOpts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {subDept === "CUSTOM" && (
                    <input className="arch-input" style={{ ...inputStyle, flex: 1 }} placeholder="Custom name" value={customDept} onChange={e => setCustomDept(e.target.value)} />
                  )}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>COVER IMAGE URL</label>
                <input className="arch-input" style={inputStyle} placeholder="https://..." value={serviceImg} onChange={e => setServiceImg(e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>MARKETING DESCRIPTION (Guest App)</label>
                <textarea className="arch-input" style={{ ...inputStyle, resize: "vertical", minHeight: "70px" }} placeholder="Describe the experience..." value={serviceDesc} onChange={e => setServiceDesc(e.target.value)} />
              </div>
            </div>

            {/* BOM List */}
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "11px", color: "#666", fontWeight: 900, letterSpacing: "1.5px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color }}>▸</span> BILL OF MATERIALS (BOM)
              </div>
              {ingredients.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "12px", color: "#333", fontSize: "12px" }}>
                  No raw items attached. Search the vault on the right to add ingredients.
                </div>
              ) : (
                <div>
                  {ingredients.map(item => (
                    <BOMRow key={item.rawId} item={item} color={color} formatMoney={formatMoney}
                      onQtyChange={(id, qty) => setIngredients(prev => prev.map(i => i.rawId === id ? { ...i, qty } : i))}
                      onRemove={id => setIngredients(prev => prev.filter(i => i.rawId !== id))} />
                  ))}
                </div>
              )}
            </div>

            {/* Financial Bar */}
            <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div style={{ background: "rgba(255,49,49,0.06)", border: "1px solid rgba(255,49,49,0.2)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px", marginBottom: "6px" }}>TOTAL COGS</div>
                <div style={{ fontSize: "22px", fontWeight: 900, fontFamily: "monospace", color: "#FF3131" }}>{formatMoney(totalCogs)}</div>
              </div>
              <div style={{ background: `${color}08`, border: `1px solid ${color}33`, borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px", marginBottom: "6px" }}>RETAIL PRICE (RP)</div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ color, marginRight: "4px", fontSize: "16px", fontWeight: 700 }}>{currencySymbol}</span>
                  <input type="number" value={retailPrice || ""} min="0" step="10"
                    onChange={e => setRetailPrice(parseFloat(e.target.value) || 0)}
                    style={{ background: "transparent", border: "none", outline: "none", fontSize: "22px", fontWeight: 900, fontFamily: "monospace", color, width: "100%" }} placeholder="0" />
                </div>
              </div>
              <div style={{ background: profitMargin > 30 ? "rgba(0,255,136,0.06)" : "rgba(255,49,49,0.06)", border: `1px solid ${profitMargin > 30 ? "#00FF8833" : "#FF313133"}`, borderRadius: "12px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px", marginBottom: "6px" }}>TRUE PROFIT</div>
                <div style={{ fontSize: "22px", fontWeight: 900, fontFamily: "monospace", color: profitMargin > 30 ? "#00FF88" : "#FF3131" }}>{profitMargin.toFixed(1)}%</div>
              </div>
            </div>

            {/* Save button */}
            <button onClick={handleSave} disabled={isSaving}
              style={{ marginTop: "16px", width: "100%", padding: "16px", background: isSaving ? "rgba(255,255,255,0.04)" : `${color}20`, border: `1px solid ${isSaving ? "rgba(255,255,255,0.06)" : color}`, borderRadius: "12px", color: isSaving ? "#555" : color, fontWeight: 900, fontSize: "13px", letterSpacing: "1.5px", cursor: isSaving ? "not-allowed" : "pointer", transition: "all 0.2s", boxShadow: isSaving ? "none" : `0 0 20px ${color}22` }}>
              {isSaving ? "SAVING TO VAULT..." : mode === "edit" ? `💾 SAVE CHANGES — ${serviceName || "..."}` : `🚀 COMPILE & PUBLISH SERVICE`}
            </button>
          </div>

          {/* RIGHT: Raw Vault Search */}
          <div style={{ ...panel(), position: "sticky", top: "20px" }}>
            <div style={{ fontSize: "12px", color: "#FFF", fontWeight: 900, letterSpacing: "1.5px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>RAW VAULT</span>
              <span style={{ fontSize: "10px", color: "#444", background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: "4px" }}>ZONE 12</span>
            </div>
            <input className="arch-input" style={{ ...inputStyle, marginBottom: "12px", boxSizing: "border-box" }} placeholder="Search raw items..." value={rawSearch} onChange={e => setRawSearch(e.target.value)} />
            <div style={{ maxHeight: "500px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {loading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#444", fontSize: "11px" }}>SCANNING VAULT...</div>
              ) : filteredRaw.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#333", fontSize: "11px" }}>No items found</div>
              ) : filteredRaw.map((item: any) => {
                const alreadyAdded = ingredients.find(i => i.rawId === item.id);
                return (
                  <div key={item.id} className="raw-row" onClick={() => !alreadyAdded && addIngredient(item as RawItem)}
                    style={{ padding: "12px 14px", background: alreadyAdded ? `${color}10` : "rgba(255,255,255,0.02)", border: alreadyAdded ? `1px solid ${color}44` : "1px solid rgba(255,255,255,0.04)", borderRadius: "10px", cursor: alreadyAdded ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "0.2s" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: alreadyAdded ? color : "#CCC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                      <div style={{ fontSize: "10px", color: "#444", marginTop: "2px", fontFamily: "monospace" }}>{item.cat} · Stock: {parseFloat(item.stock || 0).toFixed(1)}</div>
                    </div>
                    <div style={{ marginLeft: "8px", fontSize: "18px", color: alreadyAdded ? color : "#333" }}>{alreadyAdded ? "✓" : "+"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
