// web/app/components/CurrencyLangContext.tsx
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ==========================================
// SOVEREIGN MULTI-CURRENCY ENGINE
// 14 major global currencies — USD primary, AED secondary
// ==========================================
export type Currency =
  | 'USD' | 'AED' | 'EUR' | 'GBP' | 'SAR' | 'QAR'
  | 'SGD' | 'BDT' | 'INR' | 'JPY' | 'CNY' | 'CHF' | 'KWD' | 'OMR';

export type Language = 'EN' | 'AR' | 'BN';

// ── USD-based fallback rates (how many display units = 1 USD) ──
// Used before the API responds. Keeps UI non-zero from first render.
const DEFAULT_RATES: Record<Currency, number> = {
  USD: 1.000000,   // BASE CURRENCY
  AED: 3.670000,   // 1 USD ≈ 3.67 AED
  EUR: 0.900000,   // 1 USD ≈ 0.90 EUR
  GBP: 0.760000,   // 1 USD ≈ 0.76 GBP
  SAR: 3.750000,   // 1 USD ≈ 3.75 SAR
  QAR: 3.640000,   // 1 USD ≈ 3.64 QAR
  SGD: 1.340000,   // 1 USD ≈ 1.34 SGD
  BDT: 110.500000, // 1 USD ≈ 110.5 BDT
  INR: 83.500000,  // 1 USD ≈ 83.5 INR
  JPY: 150.000000, // 1 USD ≈ 150 JPY
  CNY: 7.200000,   // 1 USD ≈ 7.20 CNY
  CHF: 0.910000,   // 1 USD ≈ 0.91 CHF
  KWD: 0.310000,   // 1 USD ≈ 0.31 KWD
  OMR: 0.380000,   // 1 USD ≈ 0.38 OMR
};

interface CurrencyMeta {
  symbol: string;
  label: string;
  locale: string;
  flag: string;
  symbolAfter?: boolean; // if true, symbol goes after the number
}

const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  USD: { symbol: '$',    label: 'US Dollar',          locale: 'en-US', flag: '🇺🇸' },
  AED: { symbol: 'AED', label: 'UAE Dirham',          locale: 'ar-AE', flag: '🇦🇪', symbolAfter: true },
  EUR: { symbol: '€',    label: 'Euro',               locale: 'de-DE', flag: '🇪🇺' },
  GBP: { symbol: '£',    label: 'British Pound',      locale: 'en-GB', flag: '🇬🇧' },
  SAR: { symbol: 'SAR', label: 'Saudi Riyal',         locale: 'ar-SA', flag: '🇸🇦', symbolAfter: true },
  QAR: { symbol: 'QAR', label: 'Qatari Riyal',        locale: 'ar-QA', flag: '🇶🇦', symbolAfter: true },
  SGD: { symbol: 'S$',   label: 'Singapore Dollar',   locale: 'en-SG', flag: '🇸🇬' },
  BDT: { symbol: '৳',    label: 'Bangladeshi Taka',   locale: 'en-BD', flag: '🇧🇩' },
  INR: { symbol: '₹',    label: 'Indian Rupee',       locale: 'en-IN', flag: '🇮🇳' },
  JPY: { symbol: '¥',    label: 'Japanese Yen',       locale: 'ja-JP', flag: '🇯🇵' },
  CNY: { symbol: '¥',    label: 'Chinese Yuan',       locale: 'zh-CN', flag: '🇨🇳' },
  CHF: { symbol: 'CHF', label: 'Swiss Franc',         locale: 'de-CH', flag: '🇨🇭', symbolAfter: true },
  KWD: { symbol: 'KWD', label: 'Kuwaiti Dinar',       locale: 'ar-KW', flag: '🇰🇼', symbolAfter: true },
  OMR: { symbol: 'OMR', label: 'Omani Rial',          locale: 'ar-OM', flag: '🇴🇲', symbolAfter: true },
};

// Ordered display list: USD first, AED second, then rest alphabetically
const CURRENCY_ORDER: Currency[] = [
  'USD', 'AED', 'EUR', 'GBP', 'SAR', 'QAR', 'SGD', 'KWD', 'OMR', 'BDT', 'INR', 'JPY', 'CNY', 'CHF',
];

// ==========================================
// TRANSLATION MAP (EN / AR / BN)
// ==========================================
export const T: Record<Language, Record<string, string>> = {
  EN: {
    'Command Grid': 'Command Grid', 'Reservations': 'Reservations',
    'Point of Sale': 'Point of Sale', 'Checkout': 'Checkout & Folio',
    'Inventory': 'Inventory Vault', 'HR': 'Human Capital',
    'Accounts': 'Accounts & Finance', 'Issue Tickets': 'Issue Tickets',
    'Solve': 'Solve Portal', 'Policy': 'Global Policy Kernel',
    'Settings': 'OS Settings', 'Search': 'Search', 'Save': 'Save',
    'Cancel': 'Cancel', 'Sync': 'Sync', 'Register': 'Register',
    'Delete': 'Delete', 'Reports': 'Reports', 'Total Revenue': 'Total Revenue',
    'Occupancy': 'Occupancy', 'Due': 'Due', 'Paid': 'Paid',
    'Check In': 'Check In', 'Check Out': 'Check Out', 'Staff': 'Staff',
    'Recruits': 'Recruits', 'Stock': 'Stock', 'Low Stock': 'Low Stock',
    'Currency': 'Currency', 'Language': 'Language',
  },
  AR: {
    'Command Grid': 'شبكة القيادة', 'Reservations': 'الحجوزات',
    'Point of Sale': 'نقطة البيع', 'Checkout': 'تسجيل الخروج',
    'Inventory': 'مخزن المخزون', 'HR': 'الموارد البشرية',
    'Accounts': 'الحسابات والتمويل', 'Issue Tickets': 'تذاكر الخدمة',
    'Solve': 'بوابة الحل', 'Policy': 'نواة السياسة العالمية',
    'Settings': 'إعدادات النظام', 'Search': 'بحث', 'Save': 'حفظ',
    'Cancel': 'إلغاء', 'Sync': 'مزامنة', 'Register': 'تسجيل',
    'Delete': 'حذف', 'Reports': 'تقارير', 'Total Revenue': 'إجمالي الإيرادات',
    'Occupancy': 'الإشغال', 'Due': 'مستحق', 'Paid': 'مدفوع',
    'Check In': 'تسجيل الوصول', 'Check Out': 'تسجيل المغادرة',
    'Staff': 'الموظفون', 'Recruits': 'المجندون', 'Stock': 'المخزون',
    'Low Stock': 'مخزون منخفض', 'Currency': 'العملة', 'Language': 'اللغة',
  },
  BN: {
    'Command Grid': 'কমান্ড গ্রিড', 'Reservations': 'রিজার্ভেশন',
    'Point of Sale': 'পয়েন্ট অফ সেল', 'Checkout': 'চেকআউট',
    'Inventory': 'ইনভেন্টরি ভল্ট', 'HR': 'মানব সম্পদ',
    'Accounts': 'হিসাব ও অর্থায়ন', 'Issue Tickets': 'সার্ভিস টিকিট',
    'Solve': 'সমাধান পোর্টাল', 'Policy': 'গ্লোবাল পলিসি কার্নেল',
    'Settings': 'সিস্টেম সেটিংস', 'Search': 'অনুসন্ধান', 'Save': 'সংরক্ষণ',
    'Cancel': 'বাতিল', 'Sync': 'সিঙ্ক', 'Register': 'নিবন্ধন',
    'Delete': 'মুছুন', 'Reports': 'রিপোর্ট', 'Total Revenue': 'মোট রাজস্ব',
    'Occupancy': 'দখলের হার', 'Due': 'বকেয়া', 'Paid': 'পরিশোধিত',
    'Check In': 'চেক-ইন', 'Check Out': 'চেক-আউট', 'Staff': 'কর্মী',
    'Recruits': 'নতুন কর্মী', 'Stock': 'স্টক', 'Low Stock': 'কম স্টক',
    'Currency': 'মুদ্রা', 'Language': 'ভাষা',
  },
};

// ==========================================
// CONTEXT
// ==========================================
interface CurrencyLangContextType {
  currency: Currency;
  language: Language;
  setCurrency: (c: Currency) => void;
  setLanguage: (l: Language) => void;
  formatMoney: (bdtAmount: number, opts?: { decimals?: number }) => string;
  currencySymbol: string;
  exchangeRates: Record<Currency, number>;
  ratesLoaded: boolean;
  t: (key: string) => string;
  isRTL: boolean;
}

const CurrencyLangContext = createContext<CurrencyLangContextType>({
  currency: 'USD',
  language: 'EN',
  setCurrency: () => {},
  setLanguage: () => {},
  formatMoney: (v) => `$${(v * 1).toFixed(2)}`,
  currencySymbol: '$',
  exchangeRates: DEFAULT_RATES,
  ratesLoaded: false,
  t: (k) => k,
  isRTL: false,
});

// ==========================================
// PROVIDER
// ==========================================
export function CurrencyLangProvider({ children }: { children: ReactNode }) {
  // Default: USD (sovereign primary currency)
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [language, setLanguageState] = useState<Language>('EN');
  const [exchangeRates, setExchangeRates] = useState<Record<Currency, number>>(DEFAULT_RATES);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // ── On mount: fetch live rates + active currency from Sovereign Kernel ──
  // NOTE: Currency selection is ONLY controllable from Z-21 Sovereign Currency Engine.
  // Normal users cannot change the currency — it is set globally by admin.
  useEffect(() => {
    const l = localStorage.getItem('miracle_language') as Language;
    if (l && T[l]) setLanguageState(l);

    // Fetch live exchange rates AND active currency from Sovereign Kernel Settings
    fetch('/api/settings/currency')
      .then(r => r.json())
      .then(data => {
        if (data?.currency) {
          const cfg = data.currency;
          // Merge API rates over defaults — they are now Units per 1 USD
          const merged: Record<Currency, number> = { ...DEFAULT_RATES };
          if (cfg.exchange_rate_usd > 0)  merged.USD = cfg.exchange_rate_usd; // Always 1.0
          if (cfg.exchange_rate_aed > 0)  merged.AED = cfg.exchange_rate_aed;
          if (cfg.exchange_rate_eur > 0)  merged.EUR = cfg.exchange_rate_eur;
          if (cfg.exchange_rate_gbp > 0)  merged.GBP = cfg.exchange_rate_gbp;
          if (cfg.exchange_rate_sar > 0)  merged.SAR = cfg.exchange_rate_sar;
          if (cfg.exchange_rate_qar > 0)  merged.QAR = cfg.exchange_rate_qar;
          if (cfg.exchange_rate_sgd > 0)  merged.SGD = cfg.exchange_rate_sgd;
          if (cfg.exchange_rate_bdt > 0)  merged.BDT = cfg.exchange_rate_bdt;
          if (cfg.exchange_rate_inr > 0)  merged.INR = cfg.exchange_rate_inr;
          if (cfg.exchange_rate_jpy > 0)  merged.JPY = cfg.exchange_rate_jpy;
          if (cfg.exchange_rate_cny > 0)  merged.CNY = cfg.exchange_rate_cny;
          if (cfg.exchange_rate_chf > 0)  merged.CHF = cfg.exchange_rate_chf;
          if (cfg.exchange_rate_kwd > 0)  merged.KWD = cfg.exchange_rate_kwd;
          if (cfg.exchange_rate_omr > 0)  merged.OMR = cfg.exchange_rate_omr;
          setExchangeRates(merged);

          // Set the GLOBALLY active currency from Z-21 kernel config
          if (cfg.base_currency && DEFAULT_RATES[cfg.base_currency as Currency] !== undefined) {
            setCurrencyState(cfg.base_currency as Currency);
          }
          setRatesLoaded(true);
        }
      })
      .catch(() => {
        // Fallback rates already in state — mark as loaded
        setRatesLoaded(true);
      });
  }, []);

  // setCurrency: called only from Z-21 admin panel — updates UI immediately
  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    localStorage.setItem('miracle_language', l);
  };

  const formatMoney = (usdAmount: number, opts?: { decimals?: number }) => {
    const rate = exchangeRates[currency] ?? DEFAULT_RATES[currency] ?? 1.0;
    const converted = usdAmount * rate;
    const decimals = opts?.decimals ?? 2;
    const meta = CURRENCY_META[currency];
    const formatted = converted.toLocaleString(meta.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return meta.symbolAfter ? `${formatted} ${meta.symbol}` : `${meta.symbol}${formatted}`;
  };

  const t = (key: string): string => T[language][key] ?? key;
  const isRTL = language === 'AR';
  const currencySymbol = CURRENCY_META[currency].symbol;

  return (
    <CurrencyLangContext.Provider value={{
      currency, language, setCurrency, setLanguage,
      formatMoney, currencySymbol, exchangeRates, ratesLoaded, t, isRTL,
    }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: isRTL ? 'sans-serif' : undefined }}>
        {children}
      </div>
    </CurrencyLangContext.Provider>
  );
}

// ==========================================
// HOOK
// ==========================================
export const useCurrencyLang = () => useContext(CurrencyLangContext);

// ==========================================
// CURRENCY / LANGUAGE SWITCHER WIDGET
// Compact dropdown pill — saves sidebar space
// ==========================================
export function CurrencyLangSwitcher({ isExpanded = true }: { isExpanded?: boolean }) {
  const { currency, setCurrency } = useCurrencyLang();
  const [open, setOpen] = useState(false);
  const meta = CURRENCY_META[currency];

  // Collapsed sidebar: show just the flag as an icon pill
  if (!isExpanded) {
    return (
      <div style={{ padding: '6px 10px 8px', borderTop: '1px solid #111', position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          title={`Currency: ${currency}`}
          style={{
            width: '100%', padding: '6px', borderRadius: '8px', fontSize: '14px',
            background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{meta.flag}</button>
        {open && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '4px', right: '4px',
            background: 'rgba(12,12,16,0.98)', border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '10px', padding: '8px', display: 'grid',
            gridTemplateColumns: '1fr 1fr', gap: '3px', zIndex: 999,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)',
            marginBottom: '4px',
          }}>
            {CURRENCY_ORDER.map(code => {
              const m = CURRENCY_META[code];
              const isActive = currency === code;
              return (
                <button key={code} onClick={() => { setCurrency(code); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 5px',
                    borderRadius: '6px', fontSize: '9px', fontWeight: isActive ? 900 : 600,
                    cursor: 'pointer', background: isActive ? 'linear-gradient(135deg, #D4AF37, #B8960C)' : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#000' : '#777', border: isActive ? '1px solid #D4AF37' : '1px solid transparent',
                  }} title={m.label}
                >
                  <span style={{ fontSize: '10px' }}>{m.flag}</span>
                  <span>{code}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '6px 12px 8px', borderTop: '1px solid #111', position: 'relative' }}>

      {/* Compact active currency pill — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(212,175,55,0.07)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: '8px',
          padding: '6px 10px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>{meta.flag}</span>
          <span style={{ fontSize: '10px', fontWeight: 900, color: '#D4AF37', letterSpacing: '1px' }}>
            {currency}
          </span>
          <span style={{ fontSize: '9px', color: '#666' }}>{meta.symbol}</span>
        </div>
        <span style={{ fontSize: '8px', color: '#555', transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
      </button>

      {/* Dropdown panel — appears above the pill */}
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '12px',
          right: '12px',
          background: 'rgba(12,12,16,0.98)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '10px',
          padding: '8px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3px',
          zIndex: 999,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          marginBottom: '4px',
          maxHeight: '240px',
          overflowY: 'auto',
        }}>
          {CURRENCY_ORDER.map(code => {
            const m = CURRENCY_META[code];
            const isActive = currency === code;
            return (
              <button
                key={code}
                onClick={() => { setCurrency(code); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 7px',
                  borderRadius: '6px',
                  fontSize: '9px',
                  fontWeight: isActive ? 900 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  letterSpacing: '0.3px',
                  background: isActive ? 'linear-gradient(135deg, #D4AF37, #B8960C)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? '#000' : '#777',
                  border: isActive ? '1px solid #D4AF37' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 8px rgba(212,175,55,0.3)' : 'none',
                  whiteSpace: 'nowrap',
                }}
                title={m.label}
              >
                <span style={{ fontSize: '11px' }}>{m.flag}</span>
                <span>{code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


