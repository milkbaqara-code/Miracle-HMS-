"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrencyLang } from '../../components/CurrencyLangContext';

const API_BASE = "/api";

// ================================================================
// ZONE DEFINITIONS — Each zone maps to a dept prefix
// ================================================================
const ZONES = [
  {
    id: 'Z-29',
    label: 'DINING',
    subtitle: 'Restaurant, Coffee & Bar, Room Service',
    icon: '🍽️',
    color: '#D4AF37',
    glow: 'rgba(212,175,55,0.25)',
    border: 'rgba(212,175,55,0.35)',
    bg: 'rgba(212,175,55,0.05)',
  },
  {
    id: 'Z-27',
    label: 'SPA & WELLNESS',
    subtitle: 'Massages, Treatments, Pool & Gym',
    icon: '💆',
    color: '#9D00FF',
    glow: 'rgba(157,0,255,0.25)',
    border: 'rgba(157,0,255,0.35)',
    bg: 'rgba(157,0,255,0.05)',
  },
  {
    id: 'Z-28',
    label: 'BOUTIQUES',
    subtitle: 'Luxury Goods, Fashion, Gifts',
    icon: '🛍️',
    color: '#0096FF',
    glow: 'rgba(0,150,255,0.25)',
    border: 'rgba(0,150,255,0.35)',
    bg: 'rgba(0,150,255,0.05)',
  },
  {
    id: 'Z-26',
    label: 'FLEET & TRANSFERS',
    subtitle: 'Airport Transfers, Tours, Charters',
    icon: '🚗',
    color: '#00F2FF',
    glow: 'rgba(0,242,255,0.25)',
    border: 'rgba(0,242,255,0.35)',
    bg: 'rgba(0,242,255,0.05)',
  },
  {
    id: 'Z-08',
    label: 'HOUSEKEEPING & LAUNDRY',
    subtitle: 'Dry Cleaning, Ironing, Laundry',
    icon: '👕',
    color: '#60EFFF',
    glow: 'rgba(96,239,255,0.25)',
    border: 'rgba(96,239,255,0.35)',
    bg: 'rgba(96,239,255,0.05)',
  },
];

interface Product {
  id: string; name: string; rp: number; stock: number; unit: string;
  dept: string; cat: string; img: string; desc: string; type: string; bom: any[]; cogs: number;
}
interface CartItem extends Product { qty: number; }

// Helper function to check if item belongs to a specific zone
const isItemInZone = (dept: string, zoneId: string) => {
  const d = dept.toUpperCase();
  if (zoneId === 'Z-29') {
    // Dining: Gastronomy, Restaurant, Bar, Room Service, RS
    return d.includes('RESTAURANT') || d.includes('COFFEE') || d.includes('BAR') || d.includes('DINING') || d.includes('F&B') || d.includes('GASTRONOMY') || d.startsWith('RS-');
  }
  if (zoneId === 'Z-27') {
    // Spa & Wellness: Spa, Wellness, Pool, Gym
    return d.includes('SPA') || d.includes('WELLNESS') || d.includes('POOL') || d.includes('GYM');
  }
  if (zoneId === 'Z-28') {
    // Boutiques: Boutique, Shop, Luxury
    return d.includes('BOUTIQUE') || d.includes('SHOP') || d.includes('LUXURY');
  }
  if (zoneId === 'Z-26') {
    // Fleet: Fleet, Transfers, Transport, Car (exclude F&B)
    if (d.includes('GASTRONOMY') || d.includes('F&B')) return false;
    return d.includes('FLEET') || d.includes('TRANSFERS') || d.includes('TRANSPORT') || d.includes('CAR') || d.startsWith('Z-26-');
  }
  if (zoneId === 'Z-08') {
    // Housekeeping: Housekeeping, Laundry, HK
    return d.includes('HOUSEKEEPING') || d.includes('LAUNDRY') || d.includes('HK-');
  }
  return d.startsWith(zoneId + '-') || d === zoneId;
};

export default function GuestOrderPage() {
  const { formatMoney } = useCurrencyLang();
  const router = useRouter();
  const [allItems, setAllItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [activeSubDept, setActiveSubDept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [guestRoom, setGuestRoom] = useState('');
  const [payMethod, setPayMethod] = useState<'ROOM_CHARGE' | 'CASH'>('ROOM_CHARGE');
  const [orderDone, setOrderDone] = useState(false);

  useEffect(() => {
    fetchCatalog();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filter = params.get('filter');
      const promo = params.get('promo');
      if (filter) {
        // Match Z-XX prefix first
        const match = filter.match(/^(Z-\d+)(?:-(.*))?$/);
        if (match) {
          const zone = match[1];
          const sub = match[2];
          setActiveZone(zone);
          if (sub) {
            setActiveSubDept(sub.toUpperCase());
          }
        } else {
          // Custom check for known labels
          const f = filter.toUpperCase();
          if (f.includes('RESTAURANT') || f.includes('BAR') || f.includes('DINING')) {
            setActiveZone('Z-29');
            if (f.includes('RESTAURANT')) setActiveSubDept('RESTAURANT');
            else if (f.includes('BAR')) setActiveSubDept('COFFEE & BAR');
          } else if (f.includes('SPA') || f.includes('WELLNESS')) {
            setActiveZone('Z-27');
            setActiveSubDept('SPA');
          } else if (f.includes('POOL') || f.includes('GYM')) {
            setActiveZone('Z-27');
            setActiveSubDept('POOL & GYM');
          } else if (f.includes('LAUNDRY') || f.includes('HOUSEKEEPING')) {
            setActiveZone('Z-08');
            setActiveSubDept('HOUSEKEEPING');
          } else if (f.includes('BOUTIQUE') || f.includes('SHOP')) {
            setActiveZone('Z-28');
            setActiveSubDept('BOUTIQUE');
          }
        }
      }
      if (promo) {
        setSearchQuery(promo);
      }
    }
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/inventory/live`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'SUCCESS' && Array.isArray(data.data)) {
        const items = data.data
          .filter((i: any) => {
            const t = String(i.type || '').toUpperCase();
            return t !== 'RAW_MATERIAL' && t !== 'RAW';
          })
          .map((i: any) => ({
            id: String(i.id || i.product_id),
            name: String(i.name),
            rp: Number(i.rp) || (Number(i.pp) * (1 + Number(i.margin) / 100)) || 0,
            stock: Number(i.stock) || 0,
            unit: String(i.s_unit || 'ITEM'),
            dept: String(i.dept || '').toUpperCase(),
            cat: String(i.cat || '').toUpperCase(),
            img: String(i.img || ''),
            desc: String(i.desc || ''),
            type: String(i.type || '').toUpperCase(),
            bom: i.bom || [],
            cogs: Number(i.pp) || 0,
          }));
        setAllItems(items);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const selectedZone = ZONES.find(z => z.id === activeZone);

  const zoneItems = useMemo(() => {
    if (!activeZone) return [];
    return allItems.filter(i => isItemInZone(i.dept, activeZone));
  }, [allItems, activeZone]);

  const subDepts = useMemo(() => {
    const tabs = new Set<string>(['ALL']);
    zoneItems.forEach(i => {
      let sub = i.dept.replace(/Z-\d+-/, '').trim().toUpperCase();
      if (sub.startsWith('RS-')) sub = sub.substring(3);
      if (sub === 'COFFEE') sub = 'COFFEE & BAR';
      if (sub) tabs.add(sub);
    });
    return Array.from(tabs).sort((a, b) => a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b));
  }, [zoneItems]);

  const filteredItems = useMemo(() => {
    let list = zoneItems;
    if (activeSubDept !== 'ALL') {
      list = list.filter(i => {
        let d = i.dept.replace(/Z-\d+-/, '').trim().toUpperCase();
        if (d.startsWith('RS-')) d = d.substring(3);
        if (d === 'COFFEE') d = 'COFFEE & BAR';
        return d === activeSubDept;
      });
    }
    if (searchQuery) list = list.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [zoneItems, activeSubDept, searchQuery]);

  const addToCart = (item: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const cartTotal = cart.reduce((s, i) => s + i.rp * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const handleCheckout = async () => {
    if (!guestRoom && payMethod === 'ROOM_CHARGE') return;
    setCheckingOut(true);
    try {
      // PHASE 5: Use the sovereign Guest APK checkout endpoint
      // which accepts simplified payload and maps to full POS ledger
      const payload = {
        items: cart.map(i => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          rp: i.rp,
          cogs: i.cogs || 0,
          dept: i.dept,
          type: i.type || 'PRODUCT',
          bom: i.bom || [],
        })),
        payment_method: payMethod === 'ROOM_CHARGE' ? 'ROOM_CHARGE' : 'CASH',
        guest_ref: guestRoom || 'WALK_IN',
        zone: activeZone || 'Z-29',
        total: cartTotal,
        source: 'GUEST_APK',
      };
      const res = await fetch(`${API_BASE}/pos/guest-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)

      });
      if (res.ok) { setOrderDone(true); setCart([]); }
    } catch (e) { console.error(e); }
    finally { setCheckingOut(false); }
  };

  const fmt = (n: number) => formatMoney(n, { decimals: 0 });

  // ── ORDER DONE SCREEN ──────────────────────────────────────────
  if (orderDone) return (
    <div style={styles.screen}>
      <div style={styles.doneCard}>
        <div style={styles.doneIcon}>✓</div>
        <h2 style={styles.doneTitle}>ORDER RECEIVED</h2>
        <p style={styles.doneSub}>Your order has been sent to our team. We will be with you shortly.</p>
        <button style={styles.doneBtn} onClick={() => { setOrderDone(false); setActiveZone(null); setCartOpen(false); }}>
          ORDER AGAIN
        </button>
        <button style={{ ...styles.doneBtn, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', marginTop: '10px' }}
          onClick={() => router.push('/guest/hub')}>
          BACK TO HUB
        </button>
      </div>
    </div>
  );

  // ── ZONE SELECTOR LANDING ──────────────────────────────────────
  if (!activeZone) return (
    <div style={styles.screen}>
      {/* Background Ambience */}
      <div style={styles.ambience1} />
      <div style={styles.ambience2} />

      {/* Header */}
      <div style={styles.landingHeader}>
        <button onClick={() => router.push('/guest/hub')} style={styles.backBtn}>← HUB</button>
        <div>
          <h1 style={styles.landingTitle}>SILENT CONCIERGE</h1>
          <p style={styles.landingSubtitle}>Order anything. We deliver.</p>
        </div>
        <div style={styles.cartBadgeSmall}>
          {cartCount > 0 && <div style={styles.cartBubble}>{cartCount}</div>}
        </div>
      </div>

      {/* Zone Cards */}
      <div style={styles.zoneGrid}>
        {ZONES.map((zone, i) => (
          <button
            key={zone.id}
            onClick={() => { setActiveZone(zone.id); setActiveSubDept('ALL'); setSearchQuery(''); }}
            style={{
              ...styles.zoneCard,
              background: zone.bg,
              border: `1px solid ${zone.border}`,
              animationDelay: `${i * 0.1}s`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px -10px ${zone.glow}, 0 0 0 1px ${zone.border}`;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.01)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${zone.glow}`;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
            }}
          >
            <div style={{ ...styles.zoneIcon, textShadow: `0 0 30px ${zone.glow}` }}>{zone.icon}</div>
            <div style={{ ...styles.zoneLabel, color: zone.color }}>{zone.label}</div>
            <div style={styles.zoneSubtitle}>{zone.subtitle}</div>
            <div style={{ ...styles.zoneArrow, color: zone.color }}>→</div>
            {/* Count badge */}
            <div style={{ ...styles.zoneBadge, background: zone.bg, border: `1px solid ${zone.border}`, color: zone.color }}>
              {loading ? '...' : `${allItems.filter(i => i.dept.startsWith(zone.id + '-') || i.dept === zone.id).length} items`}
            </div>
          </button>
        ))}
      </div>

      <p style={styles.landingFooter}>Miracle General Hospital & Diagnosis Center · Silent Concierge v2.0</p>
    </div>
  );

  // ── ZONE ITEM BROWSER ──────────────────────────────────────────
  return (
    <div style={styles.screen}>
      <div style={styles.ambience1} />
      <div style={styles.ambience2} />

      {/* Zone Header */}
      <div style={{ ...styles.zoneHeader, borderColor: selectedZone?.border }}>
        <button onClick={() => setActiveZone(null)} style={{ ...styles.backBtn, color: selectedZone?.color }}>← BACK</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '28px', lineHeight: 1 }}>{selectedZone?.icon}</div>
          <h2 style={{ ...styles.zoneHeaderTitle, color: selectedZone?.color }}>{selectedZone?.label}</h2>
        </div>
        <button onClick={() => setCartOpen(true)} style={{ ...styles.cartBtn, borderColor: selectedZone?.border, color: selectedZone?.color }}>
          🛒 {cartCount > 0 && <span style={styles.cartCount}>{cartCount}</span>}
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search ${selectedZone?.label}...`}
          style={{ ...styles.searchInput, borderColor: selectedZone?.border }}
        />
      </div>

      {/* Sub-Dept Tabs */}
      {subDepts.length > 1 && (
        <div style={styles.tabScroll}>
          {subDepts.map(tab => (
            <button key={tab} onClick={() => setActiveSubDept(tab)}
              style={{
                ...styles.tabPill,
                background: activeSubDept === tab ? selectedZone?.color : 'rgba(255,255,255,0.04)',
                color: activeSubDept === tab ? '#000' : '#777',
                border: `1px solid ${activeSubDept === tab ? selectedZone?.color : 'rgba(255,255,255,0.08)'}`,
              }}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Product Grid */}
      <div style={styles.productGrid}>
        {loading && <div style={styles.loadingMsg}>Loading menu...</div>}
        {!loading && filteredItems.length === 0 && (
          <div style={styles.emptyMsg}>
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>{selectedZone?.icon}</div>
            <div style={{ color: '#555', fontSize: '14px', fontWeight: 700 }}>NO ITEMS AVAILABLE</div>
            <div style={{ color: '#333', fontSize: '12px', marginTop: '6px' }}>Check back soon or ask our team</div>
          </div>
        )}
        {filteredItems.map(item => {
          const inCart = cart.find(c => c.id === item.id);
          return (
            <div key={item.id} style={styles.productCard}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = selectedZone?.color || '#fff'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
              {/* Image */}
              <div style={styles.cardImgArea}>
                {item.img && item.img.length > 5 ? (
                  <img src={item.img} alt={item.name} style={styles.cardImg}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={styles.cardImgFallback}>
                    <span style={{ fontSize: '36px', opacity: 0.3 }}>{selectedZone?.icon}</span>
                  </div>
                )}
                <div style={{ ...styles.priceBadge, background: selectedZone?.bg, borderColor: selectedZone?.border, color: selectedZone?.color }}>
                  {fmt(item.rp)}
                </div>
                {inCart && (
                  <div style={{ ...styles.inCartBadge, background: selectedZone?.color, color: '#000' }}>
                    ×{inCart.qty}
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={styles.cardInfo}>
                <div style={styles.cardName}>{item.name}</div>
                {item.desc && <div style={styles.cardDesc}>{item.desc.substring(0, 60)}{item.desc.length > 60 ? '...' : ''}</div>}
                <div style={styles.cardCat}>{item.cat.replace('COMPILED_SERVICE', 'SERVICE').replace('FLEET_SERVICE', 'TRANSFER')}</div>
                <button
                  onClick={() => addToCart(item)}
                  style={{ ...styles.addBtn, background: inCart ? selectedZone?.color : 'rgba(255,255,255,0.06)', color: inCart ? '#000' : '#FFF', borderColor: inCart ? selectedZone?.color : 'rgba(255,255,255,0.1)' }}>
                  {inCart ? `+ ADD MORE` : `ADD TO ORDER`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Cart Bar */}
      {cartCount > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} style={{ ...styles.stickyCart, background: selectedZone?.color, color: selectedZone?.id === 'Z-29' ? '#000' : '#000' }}>
          <span>🛒 {cartCount} item{cartCount > 1 ? 's' : ''}</span>
          <span style={{ fontWeight: 900 }}>{fmt(cartTotal)} — VIEW ORDER</span>
        </button>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div style={styles.cartOverlay} onClick={() => setCartOpen(false)}>
          <div style={{ ...styles.cartDrawer, borderColor: selectedZone?.border }} onClick={e => e.stopPropagation()}>
            <div style={{ ...styles.cartHeader, borderColor: selectedZone?.border }}>
              <h3 style={{ ...styles.cartTitle, color: selectedZone?.color }}>YOUR ORDER</h3>
              <button onClick={() => setCartOpen(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.cartItems}>
              {cart.map(item => (
                <div key={item.id} style={styles.cartRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.cartItemName}>{item.name}</div>
                    <div style={{ ...styles.cartItemPrice, color: selectedZone?.color }}>{fmt(item.rp)} × {item.qty}</div>
                  </div>
                  <div style={styles.cartQtyRow}>
                    <button onClick={() => setCart(p => p.map(c => c.id === item.id ? { ...c, qty: Math.max(1, c.qty - 1) } : c))} style={styles.qtyBtn}>−</button>
                    <span style={styles.qtyNum}>{item.qty}</span>
                    <button onClick={() => setCart(p => p.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))} style={styles.qtyBtn}>+</button>
                    <button onClick={() => removeFromCart(item.id)} style={{ ...styles.qtyBtn, color: '#FF3131', marginLeft: '6px' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Checkout */}
            <div style={{ ...styles.checkoutPanel, borderColor: selectedZone?.border }}>
              <div style={styles.totalRow}>
                <span style={{ color: '#888', fontSize: '13px', fontWeight: 700 }}>TOTAL</span>
                <span style={{ color: '#FFF', fontSize: '22px', fontWeight: 900 }}>{fmt(cartTotal)}</span>
              </div>

              <div style={styles.payRow}>
                {['ROOM_CHARGE', 'CASH'].map(m => (
                  <button key={m} onClick={() => setPayMethod(m as any)}
                    style={{ ...styles.payBtn, background: payMethod === m ? (selectedZone?.color || '#FFF') : 'rgba(255,255,255,0.04)', color: payMethod === m ? '#000' : '#888', borderColor: payMethod === m ? (selectedZone?.color || '#FFF') : 'rgba(255,255,255,0.1)' }}>
                    {m === 'ROOM_CHARGE' ? '🏨 Room Charge' : '💵 Cash / Card'}
                  </button>
                ))}
              </div>

              {payMethod === 'ROOM_CHARGE' && (
                <input value={guestRoom} onChange={e => setGuestRoom(e.target.value)}
                  placeholder="Enter Room Number" style={{ ...styles.roomInput, borderColor: selectedZone?.border }} />
              )}

              <button onClick={handleCheckout} disabled={checkingOut || (payMethod === 'ROOM_CHARGE' && !guestRoom)}
                style={{ ...styles.checkoutBtn, background: (!checkingOut && (payMethod !== 'ROOM_CHARGE' || guestRoom)) ? selectedZone?.color : 'rgba(255,255,255,0.06)', color: '#000' }}>
                {checkingOut ? 'SENDING ORDER...' : 'CONFIRM ORDER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// SOVEREIGN GLASS STYLES
// ================================================================
const styles: Record<string, React.CSSProperties> = {
  screen: { minHeight: '100vh', background: '#000', color: '#FFF', fontFamily: 'var(--font-montserrat, system-ui)', position: 'relative', maxWidth: '600px', margin: '0 auto', overflow: 'hidden' },
  ambience1: { position: 'fixed', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  ambience2: { position: 'fixed', bottom: '-100px', left: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(0,242,255,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },

  // Landing
  landingHeader: { padding: '50px 25px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 },
  landingTitle: { fontFamily: 'var(--font-cinzel, serif)', color: '#D4AF37', fontSize: '22px', fontWeight: 900, letterSpacing: '4px', margin: 0, textShadow: '0 0 30px rgba(212,175,55,0.4)' },
  landingSubtitle: { color: '#555', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginTop: '4px' },
  landingFooter: { textAlign: 'center', color: '#222', fontSize: '10px', letterSpacing: '2px', padding: '20px', position: 'relative', zIndex: 10 },
  backBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', padding: '8px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', cursor: 'pointer' },
  cartBadgeSmall: { width: '40px', display: 'flex', justifyContent: 'flex-end' },
  cartBubble: { background: '#D4AF37', color: '#000', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900 },

  zoneGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '0 20px 40px', position: 'relative', zIndex: 10 },
  zoneCard: { background: 'transparent', borderRadius: '20px', padding: '24px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '170px' },
  zoneIcon: { fontSize: '36px', lineHeight: 1, marginBottom: '4px' },
  zoneLabel: { fontSize: '13px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' },
  zoneSubtitle: { fontSize: '10px', color: '#555', fontWeight: 600, lineHeight: 1.4 },
  zoneArrow: { fontSize: '18px', marginTop: 'auto', fontWeight: 900 },
  zoneBadge: { position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.5px', padding: '3px 8px', borderRadius: '20px' },

  // Zone browser
  zoneHeader: { padding: '45px 20px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(30px)' },
  zoneHeaderTitle: { fontSize: '13px', fontWeight: 900, letterSpacing: '3px', margin: 0, textTransform: 'uppercase' },
  cartBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid', padding: '8px 14px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' },
  cartCount: { background: '#FF3131', color: '#FFF', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900 },

  searchWrap: { padding: '16px 20px 8px', position: 'relative', zIndex: 10 },
  searchIcon: { position: 'absolute', left: '34px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', opacity: 0.5 },
  searchInput: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid', borderRadius: '14px', padding: '14px 16px 14px 44px', color: '#FFF', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },

  tabScroll: { display: 'flex', gap: '8px', padding: '12px 20px', overflowX: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 10 },
  tabPill: { borderRadius: '30px', padding: '8px 18px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.25s' },

  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '12px 16px 160px', position: 'relative', zIndex: 10 },
  loadingMsg: { gridColumn: '1/-1', textAlign: 'center', color: '#444', padding: '60px 20px', fontSize: '14px', fontWeight: 700, letterSpacing: '2px' },
  emptyMsg: { gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },

  productCard: { background: '#0A0A0A', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.3s cubic-bezier(0.25,0.8,0.25,1)', cursor: 'pointer' },
  cardImgArea: { height: '130px', background: '#050505', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardImgFallback: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' },
  priceBadge: { position: 'absolute', top: '8px', right: '8px', backdropFilter: 'blur(8px)', padding: '3px 8px', borderRadius: '12px', border: '1px solid', fontWeight: 900, fontSize: '10px' },
  inCartBadge: { position: 'absolute', top: '8px', left: '8px', padding: '3px 8px', borderRadius: '12px', fontWeight: 900, fontSize: '10px' },
  cardInfo: { padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  cardName: { fontSize: '12px', fontWeight: 800, color: '#FFF', lineHeight: 1.3, letterSpacing: '0.3px' },
  cardDesc: { fontSize: '10px', color: '#555', lineHeight: 1.4 },
  cardCat: { fontSize: '9px', color: '#444', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' },
  addBtn: { marginTop: 'auto', border: '1px solid', borderRadius: '10px', padding: '9px 8px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.25s', textAlign: 'center' },

  stickyCart: { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '560px', borderRadius: '16px', padding: '18px 24px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '13px', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 200, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' },

  cartOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(6px)' },
  cartDrawer: { width: '100%', maxWidth: '600px', margin: '0 auto', background: '#080808', borderRadius: '24px 24px 0 0', border: '1px solid', borderBottom: 'none', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cartHeader: { padding: '20px 24px 16px', borderBottom: '1px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cartTitle: { margin: 0, fontSize: '14px', fontWeight: 900, letterSpacing: '3px' },
  closeBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '12px' },
  cartItems: { overflowY: 'auto', flex: 1, padding: '12px 20px' },
  cartRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  cartItemName: { fontSize: '13px', fontWeight: 700, color: '#FFF' },
  cartItemPrice: { fontSize: '12px', fontWeight: 900, marginTop: '2px' },
  cartQtyRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  qtyBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#FFF', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyNum: { fontSize: '14px', fontWeight: 900, color: '#FFF', minWidth: '20px', textAlign: 'center' },

  checkoutPanel: { padding: '16px 20px 32px', borderTop: '1px solid' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  payRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' },
  payBtn: { border: '1px solid', borderRadius: '12px', padding: '12px 8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.25s' },
  roomInput: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid', borderRadius: '12px', padding: '14px 16px', color: '#FFF', fontSize: '14px', fontWeight: 700, outline: 'none', boxSizing: 'border-box', marginBottom: '12px', fontFamily: 'inherit' },
  checkoutBtn: { width: '100%', border: 'none', borderRadius: '14px', padding: '18px', fontSize: '14px', fontWeight: 900, letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase' },

  // Order done
  doneCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '40px 24px', textAlign: 'center' },
  doneIcon: { width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,255,136,0.1)', border: '2px solid #00FF88', color: '#00FF88', fontSize: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 0 40px rgba(0,255,136,0.3)' },
  doneTitle: { fontFamily: 'var(--font-cinzel, serif)', color: '#00FF88', fontSize: '24px', fontWeight: 900, letterSpacing: '4px', margin: '0 0 12px' },
  doneSub: { color: '#666', fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' },
  doneBtn: { background: '#D4AF37', color: '#000', border: 'none', borderRadius: '14px', padding: '16px 40px', fontSize: '13px', fontWeight: 900, letterSpacing: '2px', cursor: 'pointer', width: '100%', maxWidth: '320px' },
};
