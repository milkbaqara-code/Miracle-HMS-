"use client";
import React, { useState, useEffect } from "react";
import { useToast } from "./SovereignToast";
import { useCurrencyLang } from "./CurrencyLangContext";

// ================================================================
// CINEPLEX MOVIE VAULT BOM — Z-17 MEDIA LAB (V1.0)
// ARCHITECTURE: Purchase-to-Rent Model
//   COGS        = Purchase / License Cost (one-time, hotel pays)
//   Revenue     = Rental Fee × Number of Views (ongoing)
//   Break-Even  = Purchase Cost ÷ Rental Price (views needed)
//   FREE movies = rp:0, cat:'FREE' → guest watches at no charge
//   PAID movies = rp:rentalPrice, cat:'RENTAL' → billed per view
// ================================================================

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

type AccessType = 'FREE' | 'RENTAL';

const GENRES = ['ACTION', 'ADVENTURE', 'ANIMATION', 'COMEDY', 'DOCUMENTARY', 'DRAMA', 'HORROR', 'ROMANCE', 'SCI-FI', 'THRILLER', 'FAMILY', 'MYSTERY'];
const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'UNRATED'];
const LANGUAGES = ['ENGLISH', 'BANGLA', 'HINDI', 'ARABIC', 'FRENCH', 'JAPANESE', 'KOREAN', 'MANDARIN', 'SPANISH'];

interface MovieCatalogItem {
  id: number; title: string; category: string; is_paid: boolean;
  price: number; poster_url: string; description: string;
}

interface Props {
  onSaveSuccess?: () => void;
}

export default function CineplexBOM({ onSaveSuccess }: Props) {
  const { showToast } = useToast();
  const { formatMoney, currencySymbol } = useCurrencyLang();

  // Movie Identity
  const [movieName, setMovieName] = useState('');
  const [genre, setGenre] = useState('ACTION');
  const [director, setDirector] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [duration, setDuration] = useState(120);
  const [language, setLanguage] = useState('ENGLISH');
  const [rating, setRating] = useState('PG');
  const [synopsis, setSynopsis] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');

  // Financials
  const [purchaseCost, setPurchaseCost] = useState<number>(0);
  const [accessType, setAccessType] = useState<AccessType>('RENTAL');
  const [rentalPrice, setRentalPrice] = useState<number>(0);

  const [isSaving, setIsSaving] = useState(false);
  const [vaultMovies, setVaultMovies] = useState<MovieCatalogItem[]>([]);
  const [vaultLoaded, setVaultLoaded] = useState(false);

  // Load existing vault on mount
  useEffect(() => {
    fetch(`${API_BASE}/cinema/vault-list`)
      .then(r => r.json())
      .then(d => {
        if (d.status === 'SUCCESS') {
          setVaultMovies(d.movies.map((m: any) => ({
            id: m.id, title: m.title, category: m.category,
            is_paid: m.is_paid, price: m.price, poster_url: m.poster_url,
            description: m.description,
          })));
          setVaultLoaded(true);
        }
      }).catch(() => setVaultLoaded(true));
  }, []);

  // Break-even calculation
  const breakEvenViews = rentalPrice > 0 ? Math.ceil(purchaseCost / rentalPrice) : 0;
  const monthlyRevTarget = rentalPrice * 20; // target 20 rentals/month
  const roiMonths = monthlyRevTarget > 0 ? (purchaseCost / monthlyRevTarget).toFixed(1) : '∞';

  const handleSave = async () => {
    if (!movieName.trim()) return showToast('Movie title is required', 'error');
    if (purchaseCost <= 0) return showToast('Purchase/License cost is required', 'error');
    if (accessType === 'RENTAL' && rentalPrice <= 0) return showToast('Rental price is required for paid movies', 'error');

    setIsSaving(true);
    const payload = {
      title: movieName,
      description: synopsis,
      category: genre,
      is_paid: accessType === 'RENTAL',
      price: accessType === 'RENTAL' ? rentalPrice : 0,
      drive_file_id: trailerUrl,
      poster_url: coverUrl,
      trailer_url: trailerUrl,
      director,
      year,
      duration,
      language,
      rating,
      purchase_cost: purchaseCost,
    };

    try {
      const res = await fetch(`${API_BASE}/cinema/vault-movie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'SUCCESS') {
        showToast(`"${movieName}" vaulted to Cineplex`, 'success');
        const newEntry: MovieCatalogItem = {
          id: data.movie_id, title: movieName.toUpperCase(), category: genre,
          is_paid: accessType === 'RENTAL', price: rentalPrice,
          poster_url: coverUrl, description: synopsis,
        };
        setVaultMovies(prev => [newEntry, ...prev]);
        // Reset form
        setMovieName(''); setDirector(''); setSynopsis('');
        setCoverUrl(''); setTrailerUrl('');
        setPurchaseCost(0); setRentalPrice(0); setDuration(120);
        if (onSaveSuccess) onSaveSuccess();
      } else {
        showToast(data.detail || 'Failed to vault movie', 'error');
      }
    } catch (e) {
      showToast('Network error — check backend', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const durationStr = `${Math.floor(duration / 60)}h ${duration % 60}m`;

  return (
    <div style={s.root}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>🎬</span>
          <div>
            <div style={s.headerTitle}>MOVIE VAULT — CINEPLEX BOM</div>
            <div style={s.headerSub}>Z-17 CINEPLEX · PURCHASE-TO-RENT ENGINE · {accessType === 'FREE' ? 'COMPLIMENTARY' : 'REVENUE RENTAL'}</div>
          </div>
        </div>
        {vaultMovies.length > 0 && (
          <div style={s.savedCount}>{vaultMovies.length} IN VAULT</div>
        )}
      </div>

      <div style={s.layout}>
        {/* LEFT COLUMN: COVER PREVIEW + FINANCIALS */}
        <div style={s.leftCol}>

          {/* Cover Preview */}
          <div style={s.coverFrame}>
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" style={s.coverImg}
                onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div style={s.coverPlaceholder}>
                <span style={{ fontSize: '48px' }}>🎥</span>
                <span style={s.coverPlaceholderText}>COVER PREVIEW</span>
              </div>
            )}
            {/* Floating badges */}
            <div style={s.ratingBadge}>{rating}</div>
            <div style={{ ...s.accessBadge, background: accessType === 'FREE' ? 'rgba(0,255,136,0.9)' : 'rgba(212,175,55,0.9)', color: '#000' }}>
              {accessType === 'FREE' ? '✓ FREE' : `${formatMoney(rentalPrice)}/VIEW`}
            </div>
          </div>

          {/* Duration bar */}
          <div style={s.metaBar}>
            <span style={s.metaChip}>⏱ {durationStr}</span>
            <span style={s.metaChip}>{language}</span>
            <span style={{ ...s.metaChip, color: '#D4AF37', borderColor: 'rgba(212,175,55,0.3)' }}>{genre}</span>
          </div>

          {/* FINANCIAL MODEL */}
          <div style={s.finPanel}>
            <div style={s.finTitle}>💰 PURCHASE-TO-RENT MODEL</div>

            <div style={s.finRow}>
              <span style={s.finLabel}>PURCHASE COST</span>
              <span style={s.finCogs}>{formatMoney(purchaseCost)}</span>
            </div>

            <div style={s.finRow}>
              <span style={s.finLabel}>ACCESS TYPE</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['FREE', 'RENTAL'] as AccessType[]).map(t => (
                  <button key={t} onClick={() => setAccessType(t)}
                    style={{ ...s.accessToggle, background: accessType === t ? (t === 'FREE' ? '#00FF88' : '#D4AF37') : 'rgba(255,255,255,0.04)', color: accessType === t ? '#000' : '#888' }}>
                    {t === 'FREE' ? '🎁 FREE' : '💰 RENTAL'}
                  </button>
                ))}
              </div>
            </div>

            {accessType === 'RENTAL' && (
              <>
                <div style={s.finRow}>
                  <span style={s.finLabel}>RENTAL PRICE / VIEW</span>
                  <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: '20px' }}>{formatMoney(rentalPrice)}</span>
                </div>
                <div style={s.breakEvenBox}>
                  <div style={s.breakEvenItem}>
                    <div style={s.breakEvenVal}>{breakEvenViews > 0 ? breakEvenViews : '—'}</div>
                    <div style={s.breakEvenLabel}>VIEWS TO BREAK EVEN</div>
                  </div>
                  <div style={s.breakEvenDivider} />
                  <div style={s.breakEvenItem}>
                    <div style={{ ...s.breakEvenVal, color: '#00FF88' }}>{roiMonths}mo</div>
                    <div style={s.breakEvenLabel}>EST. ROI (@ 20 rentals/mo)</div>
                  </div>
                </div>
              </>
            )}

            {accessType === 'FREE' && (
              <div style={{ ...s.breakEvenBox, justifyContent: 'center', textAlign: 'center' }}>
                <div>
                  <div style={{ color: '#00FF88', fontSize: '13px', fontWeight: 900 }}>COMPLIMENTARY VIEWING</div>
                  <div style={{ color: '#555', fontSize: '10px', marginTop: '4px' }}>Included in room package · Cost: {formatMoney(purchaseCost)}</div>
                </div>
              </div>
            )}
          </div>

          {/* SAVE BUTTON */}
          <button onClick={handleSave} disabled={isSaving || !movieName || purchaseCost <= 0}
            style={{ ...s.saveBtn, background: (!isSaving && movieName && purchaseCost > 0) ? '#D4AF37' : 'rgba(255,255,255,0.06)', color: (!isSaving && movieName && purchaseCost > 0) ? '#000' : '#444', cursor: (!isSaving && movieName && purchaseCost > 0) ? 'pointer' : 'not-allowed' }}>
            {isSaving ? '⏳ VAULTING...' : '🎬 VAULT TO CINEPLEX'}
          </button>
        </div>

        {/* RIGHT COLUMN: MOVIE METADATA FORM */}
        <div style={s.rightCol}>

          {/* Section 1: Identity */}
          <div style={s.section}>
            <div style={s.sectionTitle}>01 · MOVIE IDENTITY</div>
            <div style={s.formGrid}>
              <div style={{ ...s.formGroup, gridColumn: '1/-1' }}>
                <label style={s.label}>MOVIE TITLE *</label>
                <input value={movieName} onChange={e => setMovieName(e.target.value)}
                  placeholder="e.g. INTERSTELLAR" style={s.input} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>GENRE</label>
                <select value={genre} onChange={e => setGenre(e.target.value)} style={s.select}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>AGE RATING</label>
                <select value={rating} onChange={e => setRating(e.target.value)} style={s.select}>
                  {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>DIRECTOR</label>
                <input value={director} onChange={e => setDirector(e.target.value)}
                  placeholder="Christopher Nolan" style={s.input} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>RELEASE YEAR</label>
                <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                  min={1900} max={2030} style={s.input} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>DURATION (MINUTES)</label>
                <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
                  min={1} style={s.input} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>LANGUAGE</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} style={s.select}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Media URLs */}
          <div style={s.section}>
            <div style={s.sectionTitle}>02 · MEDIA ASSETS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={s.formGroup}>
                <label style={s.label}>🖼️ COVER POSTER URL</label>
                <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)}
                  placeholder="https://image.tmdb.org/t/p/..." style={s.input} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>▶️ TRAILER / STREAM URL</label>
                <input value={trailerUrl} onChange={e => setTrailerUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or local path" style={s.input} />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>📝 GUEST-FACING SYNOPSIS</label>
                <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)}
                  placeholder="Write a compelling synopsis for the guest cinema menu..." rows={3} style={{ ...s.input, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing */}
          <div style={s.section}>
            <div style={s.sectionTitle}>03 · COST & PRICING</div>
            <div style={s.formGrid}>
              <div style={s.formGroup}>
                <label style={s.label}>PURCHASE / LICENSE COST ({currencySymbol}) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={s.currencyPrefix}>{currencySymbol}</span>
                  <input type="number" value={purchaseCost || ''} onChange={e => setPurchaseCost(Number(e.target.value))}
                    placeholder="0" min={0} style={{ ...s.input, paddingLeft: '28px' }} />
                </div>
                <div style={s.inputHint}>What the hotel paid for this DVD/license</div>
              </div>
              {accessType === 'RENTAL' && (
                <div style={s.formGroup}>
                  <label style={s.label}>RENTAL PRICE PER VIEW ({currencySymbol}) *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={s.currencyPrefix}>{currencySymbol}</span>
                    <input type="number" value={rentalPrice || ''} onChange={e => setRentalPrice(Number(e.target.value))}
                      placeholder="0" min={0} style={{ ...s.input, paddingLeft: '28px' }} />
                  </div>
                  <div style={s.inputHint}>Charged to guest per viewing session via POS or room folio</div>
                </div>
              )}
            </div>
          </div>

          {/* POS / Guest App Routing Note */}
          <div style={s.routingBox}>
            <div style={s.routingTitle}>📡 AUTO-ROUTING ON SAVE</div>
            <div style={s.routingGrid}>
              <div style={s.routingItem}>
                <div style={s.routingIcon}>🖥️</div>
                <div><div style={s.routingLabel}>POS Z-17 TERMINAL</div><div style={s.routingNote}>Appears under Z-17-CINEPLEX for staff billing</div></div>
              </div>
              <div style={s.routingItem}>
                <div style={s.routingIcon}>📱</div>
                <div><div style={s.routingLabel}>GUEST CINEMA APK</div><div style={s.routingNote}>{accessType === 'FREE' ? 'Shows as FREE in guest cinema library' : 'Shows rental price in guest cinema'}</div></div>
              </div>
              <div style={s.routingItem}>
                <div style={s.routingIcon}>💼</div>
                <div><div style={s.routingLabel}>ROOM FOLIO</div><div style={s.routingNote}>{accessType === 'FREE' ? 'No charge added to folio' : 'Rental charged to guest room folio'}</div></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SESSION VAULT — recently added movies */}
      {vaultMovies.length > 0 && (
        <div style={s.sessionVault}>
          <div style={s.sessionVaultTitle}>🎞️ CINEPLEX VAULT ({vaultMovies.length} MOVIES)</div>
          <div style={s.sessionVaultList}>
            {vaultMovies.slice(0, 12).map(m => (
              <div key={m.id} style={s.sessionVaultItem}>
                {m.poster_url && <img src={m.poster_url} alt={m.title} style={s.sessionVaultThumb} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />}
                <div>
                  <div style={s.sessionVaultName}>{m.title}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                    <span style={s.sessionVaultId}>{m.category}</span>
                    <span style={{ ...s.sessionVaultCat, color: m.is_paid ? '#D4AF37' : '#00FF88' }}>{m.is_paid ? 'RENTAL' : 'FREE'}</span>
                    {m.is_paid && <span style={s.sessionVaultId}>{formatMoney(m.price)}/VIEW</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// CINEMA-DARK SOVEREIGN STYLES
// ================================================================
const GOLD = '#D4AF37';
const CYAN = '#00F2FF';
const GREEN = '#00FF88';

const s: Record<string, React.CSSProperties> = {
  root: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', overflowY: 'auto', fontFamily: 'system-ui, sans-serif', background: 'transparent' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(212,175,55,0.2)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  headerIcon: { fontSize: '32px', lineHeight: 1 },
  headerTitle: { fontSize: '16px', fontWeight: 900, color: '#FFF', letterSpacing: '3px' },
  headerSub: { fontSize: '9px', color: '#555', fontWeight: 700, letterSpacing: '1.5px', marginTop: '3px' },
  savedCount: { background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: GOLD, fontSize: '10px', fontWeight: 900, padding: '6px 14px', borderRadius: '20px', letterSpacing: '1px' },

  layout: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', flex: 1 },

  // LEFT
  leftCol: { display: 'flex', flexDirection: 'column', gap: '14px' },

  coverFrame: { height: '380px', borderRadius: '20px', overflow: 'hidden', position: 'relative', background: '#080808', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  coverPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: 0.3 },
  coverPlaceholderText: { fontSize: '10px', fontWeight: 900, letterSpacing: '2px', color: '#FFF' },
  ratingBadge: { position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', fontSize: '9px', fontWeight: 900, padding: '4px 10px', borderRadius: '6px', letterSpacing: '1px' },
  accessBadge: { position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: 900, padding: '5px 12px', borderRadius: '20px', letterSpacing: '1px' },

  metaBar: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  metaChip: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', fontSize: '9px', fontWeight: 800, padding: '5px 12px', borderRadius: '20px', letterSpacing: '1px' },

  finPanel: { background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  finTitle: { fontSize: '9px', fontWeight: 900, color: GOLD, letterSpacing: '2px', borderBottom: '1px solid rgba(212,175,55,0.15)', paddingBottom: '10px' },
  finRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  finLabel: { fontSize: '9px', color: '#555', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' },
  finCogs: { color: '#FF3131', fontWeight: 900, fontSize: '16px' },

  accessToggle: { border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px 12px', fontSize: '9px', fontWeight: 900, letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s' },

  breakEvenBox: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '10px' },
  breakEvenItem: { textAlign: 'center' },
  breakEvenVal: { fontSize: '24px', fontWeight: 900, color: GOLD, letterSpacing: '1px' },
  breakEvenLabel: { fontSize: '8px', color: '#444', fontWeight: 700, letterSpacing: '1px', marginTop: '3px', textTransform: 'uppercase' },
  breakEvenDivider: { width: '1px', height: '40px', background: 'rgba(255,255,255,0.06)' },

  saveBtn: { width: '100%', border: 'none', borderRadius: '14px', padding: '18px', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', transition: 'all 0.3s', textTransform: 'uppercase' },

  // RIGHT
  rightCol: { display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' },

  section: { background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' },
  sectionTitle: { fontSize: '9px', fontWeight: 900, color: CYAN, letterSpacing: '3px', textTransform: 'uppercase', paddingBottom: '8px', borderBottom: '1px solid rgba(0,242,255,0.1)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '9px', color: '#555', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' },
  input: { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', color: '#FFF', fontSize: '13px', fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' } as React.CSSProperties,
  select: { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', color: '#FFF', fontSize: '13px', fontWeight: 600, outline: 'none', appearance: 'none', cursor: 'pointer' } as React.CSSProperties,
  currencyPrefix: { position: 'absolute', left: '12px', top: '12px', color: '#555', fontSize: '13px', fontWeight: 700 },
  inputHint: { fontSize: '9px', color: '#333', marginTop: '2px', letterSpacing: '0.5px' },

  routingBox: { background: 'rgba(0,242,255,0.03)', border: '1px solid rgba(0,242,255,0.1)', borderRadius: '16px', padding: '18px' },
  routingTitle: { fontSize: '9px', fontWeight: 900, color: CYAN, letterSpacing: '3px', marginBottom: '14px' },
  routingGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  routingItem: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' },
  routingIcon: { fontSize: '20px', lineHeight: 1, flexShrink: 0 },
  routingLabel: { fontSize: '11px', fontWeight: 800, color: '#FFF', letterSpacing: '0.5px' },
  routingNote: { fontSize: '10px', color: '#555', marginTop: '2px' },

  sessionVault: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '16px', padding: '16px' },
  sessionVaultTitle: { fontSize: '9px', fontWeight: 900, color: GOLD, letterSpacing: '2px', marginBottom: '12px' },
  sessionVaultList: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  sessionVaultItem: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 12px' },
  sessionVaultThumb: { width: '36px', height: '54px', borderRadius: '4px', objectFit: 'cover' },
  sessionVaultName: { fontSize: '11px', fontWeight: 800, color: '#FFF' },
  sessionVaultId: { fontSize: '9px', color: '#444', fontWeight: 700, letterSpacing: '0.5px' },
  sessionVaultCat: { fontSize: '9px', fontWeight: 900, letterSpacing: '1px' },
};
