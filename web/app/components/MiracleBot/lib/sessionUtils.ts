// ============================================================
// MiracleBot / lib / sessionUtils.ts
// SOVEREIGN SESSION UTILITIES — Pure functions, zero React.
// Generates and retrieves the stable browser-tab session ID,
// and provides a lightweight clock-tick formatter for chat timestamps.
// V4.0 — Enterprise Refactor
// ============================================================

/**
 * Returns a timestamp string formatted as HH:MM (24-hour) for chat message timestamps.
 */
export const tick = (): string =>
  new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/**
 * Generates (or retrieves from sessionStorage) a stable, unique session ID
 * scoped to the current browser tab lifetime. Server-side returns 'ssr'.
 */
export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  let s = sessionStorage.getItem('miracle_session_id');
  if (!s) {
    s = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('miracle_session_id', s);
  }
  return s;
};
