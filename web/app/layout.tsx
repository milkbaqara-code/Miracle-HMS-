/**
 * web/app/layout.tsx
 * SOVEREIGN INDEX PROTOCOL:
 * 1. FONTS & ASSETS (Lines 10-20)
 * 2. VIEWPORT & METADATA (Lines 22-55)
 * 3. ROOT HTML STRUCTURE (Lines 57-75)
 * 4. ROTHCHILD ANALYTICS & HANDSHAKE (Lines 65-72)
 */
import React from 'react';
// web/app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import CapacitorManager from './components/CapacitorManager';
import MiracleBotGuestGuard from './components/MiracleBotGuestGuard';
import { GlobalSyncProvider } from './context/GlobalSyncContext';
import { CurrencyLangProvider } from './components/CurrencyLangContext';
import { SovereignToastProvider } from './components/SovereignToast';
import { SovereignConfirmProvider } from './components/SovereignConfirm';
import { SovereignPromptProvider } from './components/SovereignPrompt';
import SovereignThemeEngine from './components/SovereignThemeEngine';
import { ThemeProvider } from './context/ThemeContext';

// IRON LAW: No next/font/google during build -- Turbopack fetches CSS regardless of preload:false
// Fonts are loaded via globals.css @import instead (network-safe, CDN-cached on client)
const inter = { variable: '--font-inter', className: 'font-inter' };
const montserrat = { variable: '--font-montserrat', className: 'font-montserrat' };
const cinzel = { variable: '--font-cinzel', className: 'font-cinzel' };

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Miracle HMS | Healthcare Intelligence Kernel',
  description: 'Enterprise-grade hospital information system and patient management ecosystem by Vigilant IT Solution Ltd.',
  keywords: ['Miracle HMS', 'Miracle HMS', 'Hospital Management', 'Vigilant IT Solution Ltd'],
  authors: [{ name: 'CDO Sajeed' }],
  alternates: {
    canonical: 'https://hms.vigilantitsolution.com',
  },
  openGraph: {
    title: 'Miracle HMS | Healthcare Intelligence Kernel',
    description: 'Sovereign Architecture for Premium Healthcare Operations.',
    url: 'https://hms.vigilantitsolution.com',
    siteName: 'Miracle HMS',
    images: [
      {
        url: 'https://miracle.vigilantitsolution.com/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${montserrat.variable} ${cinzel.variable}`}>
      <body 
        suppressHydrationWarning
        className={inter.className} 
        style={{ margin: 0, background: '#000', color: '#FFF', minHeight: '100vh' }}
      >
        <CapacitorManager />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-DPDJPGJR3B"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-DPDJPGJR3B');
          `
        }} />
        <GlobalSyncProvider>
          <CurrencyLangProvider>
            <SovereignToastProvider>
              <SovereignConfirmProvider>
                <SovereignPromptProvider>
                  <ThemeProvider>
                    <SovereignThemeEngine />
                    <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                      {children}
                    </div>
                    <MiracleBotGuestGuard />
                  </ThemeProvider>
                </SovereignPromptProvider>
              </SovereignConfirmProvider>
            </SovereignToastProvider>
          </CurrencyLangProvider>
        </GlobalSyncProvider>
      </body>
    </html>
  );
}
