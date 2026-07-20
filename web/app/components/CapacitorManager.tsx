"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function CapacitorManager() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only run in Capacitor environment
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const initCapacitor = async () => {
        try {
          const { App } = await import('@capacitor/app');
          App.removeAllListeners();
          
          App.addListener('backButton', ({ canGoBack }) => {
            if (window.location.pathname === '/guest' || window.location.pathname === '/guest/hub') {
               // We are at the root, trigger the Royal Exit Guard
               window.dispatchEvent(new CustomEvent('TRIGGER_EXIT_GUARD'));
            } else {
               // We are in a sub-page, just go back
               window.history.back();
            }
          });

          console.log("🛡️ CAPACITOR HANDLER: Smart Back Button Listener Active.");
        } catch (err) {
          console.warn("🛡️ CAPACITOR HANDLER: @capacitor/app not found. Falling back to default browser behavior.");
        }
      };

      initCapacitor();
    }
  }, [router, pathname]);

  return null;
}
