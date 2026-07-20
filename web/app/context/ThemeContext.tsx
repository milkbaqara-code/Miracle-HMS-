'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ============================================================
// SOVEREIGN THEME CONTEXT — SINGLE SOURCE OF TRUTH
// All theme state lives HERE in the React tree.
// SovereignThemeEngine reads it. ThemeControlPanel writes it.
// No module singletons. No DOM events. Pure React.
// ============================================================

export type BgMode = 'NEON_DOTS' | 'CIRCUIT_BOARD' | 'MATRIX_RAIN' | 'CITY_DUBAI' | 'CITY_LONDON' | 'CITY_NEWYORK' | 'CITY_SAUDI' | 'CITY_QATAR' | 'CITY_SINGAPORE' | 'OFF';
export type NeonColor = string;
export type BtnStyle = 'GLOW' | 'SOLID' | 'FROST';
export type SidebarMode = 'KINETIC' | 'NORMAL';
export type FontScale = 'COMPACT' | 'STANDARD' | 'LARGE';

export interface MiracleThemeConfig {
  bg_mode: BgMode;
  bg_intensity: number;
  bg_opacity: number;
  bg_sharpness: number;
  neon_color: NeonColor;
  btn_style: BtnStyle;
  sidebar_mode: SidebarMode;
  font_scale: FontScale;
  page_overrides: Record<string, BgMode>;
}

export const DEFAULT_THEME: MiracleThemeConfig = {
  bg_mode: 'NEON_DOTS',
  bg_intensity: 0.5,
  bg_opacity: 0.15,
  bg_sharpness: 50, // 0 = very blurry, 100 = very sharp
  neon_color: '#10b981',
  btn_style: 'GLOW',
  sidebar_mode: 'KINETIC',
  font_scale: 'STANDARD',
  page_overrides: {},
};

const STORAGE_KEY = 'miracle_theme_config';

export function readTheme(): MiracleThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch { return DEFAULT_THEME; }
}

export function applyGlobalVars(cfg: MiracleThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--zone-color', cfg.neon_color);
  root.style.setProperty('--neon-primary', cfg.neon_color);
  root.style.setProperty('--neon-cyan', cfg.neon_color);
  const scales: Record<FontScale, string> = {
    COMPACT: '0.88', STANDARD: '1', LARGE: '1.12',
  };
  root.style.setProperty('--font-scale', scales[cfg.font_scale]);
  document.body.setAttribute('data-btn-style', cfg.btn_style);
  document.body.setAttribute('data-sidebar-mode', cfg.sidebar_mode);
}

// ---- Context ----
interface ThemeContextValue {
  theme: MiracleThemeConfig;
  updateTheme: (patch: Partial<MiracleThemeConfig>) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  updateTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<MiracleThemeConfig>(DEFAULT_THEME);

  // Load from localStorage on client mount
  useEffect(() => {
    const cfg = readTheme();
    setTheme(cfg);
    applyGlobalVars(cfg);
  }, []);

  const updateTheme = useCallback((patch: Partial<MiracleThemeConfig>) => {
    setTheme(prev => {
      const updated = { ...prev, ...patch };
      // Persist immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      // Apply CSS custom properties immediately
      applyGlobalVars(updated);
      return updated;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
