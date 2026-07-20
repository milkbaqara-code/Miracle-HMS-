// ============================================================
// MiracleBot / lib / ttsEngine.ts
// SOVEREIGN TTS ENGINE V8.8 — SMART HUMAN AGENT PROTOCOL
//
// A fully standalone, framework-agnostic function. No React.
// No hooks. No useState. Can be unit-tested in isolation.
//
// Key capabilities:
//   - Sequential chunk engine (Chrome queue-stall elimination)
//   - Android/Chrome keep-alive pulse (7s mobile / 10s desktop)
//   - Smart male voice pitch calibration (0.95 pitch, 1.05 rate)
//   - Graceful 'interrupted'/'cancelled' error suppression
//   - Self-reporting genuine TTS failures to the Synapse backend
//
// V4.0 — Enterprise Refactor
// ============================================================
import { cleanForSpeech } from './speechCleaner';
import { API } from './constants';

export const executiveSpeak = (
  text: string,
  voice: SpeechSynthesisVoice | null,
  isMutedRef: { current: boolean },
  volumeRef: { current: number },
  onStart: () => void,
  onEnd: () => void
): void => {
  if (!('speechSynthesis' in window)) { onEnd(); return; }

  // SAFE CANCEL: Only cancel if actively speaking/pending.
  // Calling cancel() on a silent engine locks Chrome for 30-60s.
  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {
    console.warn('Speech Flush Error:', e);
  }

  if (isMutedRef.current) { onEnd(); return; }

  const clean = cleanForSpeech(text)
    .replace(/\.\.\./g, ',')
    .replace(/—/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!clean) { onEnd(); return; }

  if (typeof window === 'undefined' || !('SpeechSynthesisUtterance' in window)) {
    onEnd();
    return;
  }

  // ── REFINED CHUNKING ───────────────────────────────────────────────────────
  // Split on sentence-ending punctuation. Sub-chunk anything > 140 chars at commas.
  const rawChunks = clean.match(/[^.?!;:]+[.?!;:]+|\s*[^.?!;:]+$/g) || [clean];
  const chunks: string[] = [];
  rawChunks.forEach(chunk => {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    if (trimmed.length > 140) {
      const subChunks = trimmed.split(/(?<=,)\s*/);
      chunks.push(...subChunks.map(s => s.trim()).filter(c => c.length > 2));
    } else if (trimmed.length > 2) {
      chunks.push(trimmed);
    }
  });

  const isMale = voice && (
    voice.name.toLowerCase().includes('male') ||
    voice.name.includes('Daniel') ||
    voice.name.includes('Arthur') ||
    voice.name.includes('David')  ||
    voice.name.includes('George') ||
    voice.name.includes('UK English')
  );

  const filteredChunks = chunks.filter(c => c.length > 0);
  if (filteredChunks.length === 0) { onEnd(); return; }

  // ── SEQUENTIAL SPEECH ENGINE (Chrome-Safe) ─────────────────────────────────
  // Speak ONE chunk at a time. When chunk N finishes → fire chunk N+1.
  // Eliminates Chrome's queue-stall bug completely.
  let currentIndex = 0;
  let keepAliveId: ReturnType<typeof setInterval> | null = null;

  // ── ANDROID/CHROME KEEP-ALIVE (V8.6) ──────────────────────────────────────
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const keepAliveInterval = isMobile ? 7000 : 10000;

  keepAliveId = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, keepAliveInterval);

  const speakNext = () => {
    if (currentIndex >= filteredChunks.length) {
      if (keepAliveId) clearInterval(keepAliveId);
      onEnd();
      return;
    }

    const chunk = filteredChunks[currentIndex];
    const u = new window.SpeechSynthesisUtterance(chunk);
    if (voice) u.voice = voice;

    // ── CONFIDENT & ENTHUSIASTIC HUMAN TUNING V9.0 ────────────────────────────
    u.pitch  = isMale ? 0.98 : 1.02;  // Authoritative yet engaging
    u.rate   = 1.08;                  // Lively, confident, and enthusiastic tempo
    u.volume = volumeRef.current;

    u.onstart = () => { if (currentIndex === 0) onStart(); };
    u.onend = () => { currentIndex++; speakNext(); };
    u.onerror = (e) => {
      // V8.7: 'interrupted' / 'cancelled' are EXPECTED events — not failures.
      // Fired when user types or a new utterance preempts the current one.
      const EXPECTED_ERRORS = ['interrupted', 'cancelled', 'cancel'];
      if (EXPECTED_ERRORS.includes(e.error)) {
        if (keepAliveId) clearInterval(keepAliveId);
        onEnd();
        return;
      }

      // Genuine TTS failure — report to Synapse backend (Z-23 self-healing)
      console.error('TTS Chunk Error:', e);
      try {
        fetch(`${API}/bot/v2/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `[SYSTEM_ERROR] Frontend TTS Engine failed. Error: ${e.error || 'Unknown'}. Self-healing required.`,
            zone: 'Z-AUDIO',
            role: 'SYSTEM',
            session_id: 'SYSTEM-MONITOR',
          }),
        }).catch(() => {});
      } catch (_e) { /* silent */ }

      if (keepAliveId) clearInterval(keepAliveId);
      onEnd();
    };

    (window as any)._miracleActiveUtterance = u;
    window.speechSynthesis.speak(u);
  };

  // V8.8: Call speakNext() directly — no delay needed.
  // cancel() above already clears the queue synchronously.
  speakNext();
};
