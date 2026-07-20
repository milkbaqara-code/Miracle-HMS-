'use client';
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║      SOVEREIGN SURFACE POS — Dynamic Industry-Aware POS Renderer       ║
 * ║      Reads surface_config.ts and renders the correct industry UI       ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                        ║
 * ║  A pharmacy client sees: medicine categories, Rx fields, drug alerts   ║
 * ║  A library client sees: ISBN lookup, member card, borrow workflow      ║
 * ║  A restaurant client sees: table map, food tiles, kitchen tickets      ║
 * ║  A gym client sees: member scan, class board, trainer assignment       ║
 * ║                                                                        ║
 * ║  Same component. 15 different surfaces. Zero hardcoding.               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SurfaceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface SurfaceQuickKey {
  label: string;
  sku: string;
}

interface SurfaceWorkflowStep {
  step: number;
  id: string;
  label: string;
  icon: string;
}

interface SurfaceField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface SurfaceAlert {
  id: string;
  label: string;
  color: string;
}

interface SurfaceConfig {
  industry: string;
  label: string;
  catalog_label: string;
  cart_label: string;
  transaction_label: string;
  categories: SurfaceCategory[];
  quick_keys: SurfaceQuickKey[];
  workflow: SurfaceWorkflowStep[];
  fields: SurfaceField[];
  alerts: SurfaceAlert[];
  reports: string[];
  primary_color: string;
  accent_color: string;
  bg_gradient: string;
}

interface CartItem {
  sku: string;
  label: string;
  qty: number;
  price: number;
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface SurfacePOSProps {
  config: SurfaceConfig;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SurfacePOS({ config }: SurfacePOSProps) {
  const [activeCategory, setActiveCategory] = useState<string>(
    config.categories[0]?.id || ''
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAlert, setActiveAlert] = useState<SurfaceAlert | null>(null);

  const pc = config.primary_color;
  const totalAmount = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  // Simulate random alert
  useEffect(() => {
    if (config.alerts.length > 0) {
      const timer = setTimeout(() => {
        const randomAlert = config.alerts[Math.floor(Math.random() * config.alerts.length)];
        setActiveAlert(randomAlert);
        setTimeout(() => setActiveAlert(null), 4000);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [config.alerts]);

  const addToCart = (key: SurfaceQuickKey) => {
    setCart(prev => {
      const existing = prev.find(i => i.sku === key.sku);
      if (existing) {
        return prev.map(i => i.sku === key.sku ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { sku: key.sku, label: key.label, qty: 1, price: Math.floor(Math.random() * 50) + 5 }];
    });
    // Advance workflow step
    if (activeStep < config.workflow.length) setActiveStep(s => Math.min(s + 1, config.workflow.length));
  };

  const removeFromCart = (sku: string) => {
    setCart(prev => prev.filter(i => i.sku !== sku));
  };

  const clearAll = () => {
    setCart([]);
    setActiveStep(1);
    setFieldValues({});
  };

  const filteredQuickKeys = config.quick_keys.filter(k =>
    !searchQuery || k.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full" style={{ background: `linear-gradient(135deg, var(--tw-gradient-from, #0f172a), #1e293b)`, color: '#f1f5f9' }}>

      {/* ── LEFT: Categories + Products ── */}
      <div className="flex flex-col w-2/3 border-r border-white/10">

        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
          style={{ background: pc + '18' }}>
          <div>
            <div className="text-xs font-bold tracking-widest uppercase opacity-60">{config.label}</div>
            <div className="text-sm font-bold" style={{ color: pc }}>{config.catalog_label}</div>
          </div>

          {/* Search */}
          <div className="flex-1 ml-4">
            <input
              type="text"
              placeholder={`Search ${config.catalog_label.toLowerCase()}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-sm placeholder-white/30 outline-none focus:border-white/40"
            />
          </div>

          {/* Workflow progress */}
          <div className="flex items-center gap-1">
            {config.workflow.map(step => (
              <div key={step.id}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
                style={{
                  background: activeStep >= step.step ? pc + '30' : 'rgba(255,255,255,0.05)',
                  color: activeStep >= step.step ? pc : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${activeStep >= step.step ? pc + '60' : 'transparent'}`,
                }}>
                <span>{step.icon}</span>
                <span className="hidden xl:block font-medium">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.2)' }}>
          {config.categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
              style={{
                background: activeCategory === cat.id ? cat.color + '30' : 'rgba(255,255,255,0.05)',
                color: activeCategory === cat.id ? cat.color : 'rgba(255,255,255,0.5)',
                border: `1px solid ${activeCategory === cat.id ? cat.color + '60' : 'transparent'}`,
              }}>
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Quick Keys Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredQuickKeys.map(key => (
              <button
                key={key.sku}
                onClick={() => addToCart(key)}
                className="group relative flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
                }}>
                <span className="text-2xl">{config.categories.find(c => c.id === activeCategory)?.icon || '📦'}</span>
                <span className="text-xs font-bold text-white/80 leading-tight">{key.label}</span>
                <span className="text-xs text-white/30 font-mono">{key.sku}</span>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: pc }}>+</div>
                </div>
              </button>
            ))}
            {filteredQuickKeys.length === 0 && (
              <div className="col-span-4 text-center py-12 text-white/30 text-sm">
                No items found for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Custom Fields */}
        {config.fields.length > 0 && (
          <div className="border-t border-white/10 p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: pc, opacity: 0.7 }}>
              Transaction Details
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {config.fields.slice(0, 4).map(field => (
                <div key={field.name}>
                  <label className="text-xs text-white/40 block mb-0.5">
                    {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select
                      value={fieldValues[field.name] || ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/15 rounded px-2 py-1 text-xs outline-none focus:border-white/30"
                      style={{ color: '#f1f5f9' }}>
                      <option value="">Select...</option>
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={fieldValues[field.name] || ''}
                      onChange={e => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.label}
                      className="w-full bg-white/5 border border-white/15 rounded px-2 py-1 text-xs outline-none focus:border-white/30 placeholder-white/20"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Cart + Payment ── */}
      <div className="flex flex-col w-1/3 min-w-0">

        {/* Cart Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"
          style={{ background: pc + '12' }}>
          <div>
            <div className="text-xs opacity-50 tracking-widest uppercase">{config.cart_label}</div>
            <div className="text-sm font-bold" style={{ color: pc }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={clearAll} className="text-xs text-white/30 hover:text-red-400 transition-colors">
            Clear All
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3 opacity-30">🛒</div>
              <div className="text-sm text-white/30">
                {config.cart_label} is empty<br />
                <span className="text-xs">Tap an item to add</span>
              </div>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.sku} className="flex items-center justify-between p-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0 mr-2">
                  <div className="text-xs font-bold text-white truncate">{item.label}</div>
                  <div className="text-xs text-white/30 font-mono">{item.sku}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 rounded px-1">
                    <button onClick={() => setCart(p => p.map(i => i.sku === item.sku ? { ...i, qty: Math.max(0, i.qty - 1) } : i).filter(i => i.qty > 0))}
                      className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center">−</button>
                    <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                    <button onClick={() => setCart(p => p.map(i => i.sku === item.sku ? { ...i, qty: i.qty + 1 } : i))}
                      className="text-white/50 hover:text-white w-5 h-5 flex items-center justify-center">+</button>
                  </div>
                  <span className="text-xs font-bold text-white/70 w-12 text-right">
                    ${(item.qty * item.price).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-white/10 p-3 space-y-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex justify-between text-xs text-white/50">
            <span>Subtotal</span><span>${totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-white/50">
            <span>Tax (10%)</span><span>${(totalAmount * 0.1).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-white/10"
            style={{ color: pc }}>
            <span>TOTAL</span><span>${(totalAmount * 1.1).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Buttons */}
        <div className="p-3 space-y-2">
          <button
            disabled={cart.length === 0}
            className="w-full py-3 rounded-xl font-bold text-sm tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: cart.length > 0 ? `linear-gradient(135deg, ${pc}, ${pc}99)` : 'rgba(255,255,255,0.05)',
              color: 'white',
              boxShadow: cart.length > 0 ? `0 0 20px ${pc}40` : 'none',
            }}
            onClick={clearAll}>
            💳 COLLECT PAYMENT
          </button>
          <div className="grid grid-cols-3 gap-1">
            {['CASH', 'CARD', 'VOUCHER'].map(method => (
              <button key={method}
                className="py-2 rounded-lg text-xs font-bold text-white/60 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Reports quick access */}
        {config.reports.length > 0 && (
          <div className="border-t border-white/10 p-2">
            <div className="text-xs text-white/30 mb-1 px-1">Quick Reports</div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {config.reports.slice(0, 4).map(rep => (
                <button key={rep}
                  className="whitespace-nowrap px-2 py-1 rounded text-xs text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {rep}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ALERT TOAST ── */}
      {activeAlert && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300"
          style={{ background: activeAlert.color + '20', border: `1px solid ${activeAlert.color}60`, color: activeAlert.color }}>
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-bold">{activeAlert.label}</span>
          <button onClick={() => setActiveAlert(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
  );
}
