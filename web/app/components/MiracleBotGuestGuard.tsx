// web/app/components/MiracleBotGuestGuard.tsx
// ============================================================
// IRON LAW 50 -- GUEST ZONE ABSOLUTE EXCLUSION GATE
// IRON LAW 52 -- RESORT WEB PAGE EXCLUSION GATE
//
// MiracleBot is STAFF-ONLY. It MUST NEVER mount on /guest/* or /web paths.
//
// /guest/* crash reason: MiracleBot polls /api/settings/kernel (staff endpoint)
// on a timer. On guest WebViews this causes a crash cascade:
//   1. GlobalSyncProvider fires kernel fetch -> console.error on 401
//   2. MiracleBot browser monitor intercepts the error -> fires MORE fetches
//   3. WebView crashes within 5 seconds with "client-side exception"
//
// /web exclusion reason (Iron Law 52):
//   The /web route is a PUBLIC resort landing page with no staff context.
//   The page has its own lightweight ResortAIConcierge component that
//   uses the Z-GUEST-WEB zone directive -- warm concierge persona, NOT
//   the British corporate navigator. MiracleBot's kernel polling,
//   watchdog, and TTS are irrelevant and harmful on this public page.
//
// This guard is the SINGLE ENFORCEMENT POINT. Do NOT add MiracleBot
// directly to layout.tsx. Always use this wrapper.
// ============================================================
'use client';
import { usePathname } from 'next/navigation';
import MiracleBot from './MiracleBot';

export default function MiracleBotGuestGuard() {
  const pathname = usePathname();

  // Block MiracleBot on ALL guest routes permanently (Iron Law 50)
  // Guest app users are hotel guests / delivery customers -- not staff.
  if (pathname?.startsWith('/guest')) return null;

  // Block MiracleBot on the public resort web page (Iron Law 52)
  // The web page has its own ResortAIConcierge component with Z-GUEST-WEB persona.
  if (pathname?.startsWith('/web')) return null;

  return <MiracleBot />;
}
