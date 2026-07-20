// web/app/components/ViewModeBanner.tsx
'use client';
import { usePathname } from 'next/navigation';
import { useGlobalSync } from '../context/GlobalSyncContext'; // Iron Law 31

// 🛡️ VISITOR GATE HOOK — SURGICAL LOCK
// Only Z-23 (Infrastructure Anatomy) and Z-21 (Settings/Kernel) are read-only for VISITORS.
// ALL other zones are fully accessible so visitors can demo the system freely.
const VISITOR_LOCKED_PATHS = ['/dashboard/infrastructure', '/dashboard/settings', '/dashboard/admin', '/dashboard/audit-ledger'];

export function useViewMode() {
  const { activeRole } = useGlobalSync();
  const pathname = usePathname();
  if (activeRole !== 'VISITOR') return false;
  return VISITOR_LOCKED_PATHS.some(p => pathname?.startsWith(p));
}

export default function ViewModeBanner() {
  const isViewMode = useViewMode();
  if (!isViewMode) return null;

  return (
    <div className="vm-banner" style={{
      position: 'sticky',
      top: 0,
      zIndex: 9000,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '14px 28px',
      background: 'linear-gradient(90deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)',
      borderBottom: '1px solid rgba(212,175,55,0.4)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <span style={{ fontSize: '20px' }}>🔒</span>
      <div>
        <div style={{
          color: '#D4AF37',
          fontWeight: 900,
          fontSize: '11px',
          letterSpacing: '3px',
          fontFamily: 'Cinzel, serif',
        }}>
          VISITOR — SOVEREIGN READ-ONLY ZONE
        </div>
        <div style={{
          color: '#888',
          fontSize: '10px',
          marginTop: '2px',
          letterSpacing: '1px',
        }}>
          This is a restricted Sovereign Zone. All other panels are fully accessible for your demo session.
        </div>
      </div>
      <div style={{
        marginLeft: 'auto',
        background: 'rgba(212,175,55,0.1)',
        border: '1px solid rgba(212,175,55,0.3)',
        borderRadius: '20px',
        padding: '6px 16px',
        color: '#D4AF37',
        fontSize: '9px',
        fontWeight: 900,
        letterSpacing: '2px',
        whiteSpace: 'nowrap',
      }}>
        READ ONLY
      </div>
    </div>
  );
}

