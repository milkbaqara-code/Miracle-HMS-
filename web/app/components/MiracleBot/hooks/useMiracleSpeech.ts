'use client';
// ============================================================
// MiracleBot / hooks / useMiracleSpeech.ts
// Sovereign TTS hook — wraps executiveSpeak, manages voice
// vault selection, isMuted/volume state, and speak/stop API.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { executiveSpeak } from '../lib/ttsEngine';

export function useMiracleSpeech() {
  const [isMuted,    setIsMuted]    = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [hasPendingSpeech, setHasPendingSpeech] = useState(false);

  const isMutedRef   = useRef(true);
  const volumeRef    = useRef(1);
  const voiceRef     = useRef<SpeechSynthesisVoice | null>(null);
  const isOpenRef    = useRef(false); // injected by index.tsx
  const pendingSpeech = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync isMuted state → ref and kill active speech when muted
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      try { window.speechSynthesis?.cancel(); } catch {}
    }
  }, [isMuted]);

  // Sync volume state → ref
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // ── SOVEREIGN VOICE VAULT ─────────────────────────────────────────────────
  // Selects the most professional executive voice available in the browser.
  const getBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices?.length) return null;
      
      // Filter for British English (UK) voices
      const britishVoices = voices.filter(v => {
        const nameLower = v.name.toLowerCase();
        const langLower = v.lang.toLowerCase().replace('_', '-');
        return langLower.startsWith('en-gb') || 
               nameLower.includes('uk english') || 
               nameLower.includes('united kingdom') ||
               nameLower.includes('great britain') ||
               (langLower.startsWith('en') && nameLower.includes('gb'));
      });

      if (britishVoices.length > 0) {
        // Sonia, Ryan, Libby, Oliver are highly enthusiastic/confident online natural UK voices
        const priorityKeywords = [
          'sonia', 'ryan', 'libby', 'oliver', 'natural', 'google', 
          'george', 'hazel', 'susan', 'daniel', 'arthur', 'kate', 'serena'
        ];
        for (const kw of priorityKeywords) {
          const found = britishVoices.find(v => v.name.toLowerCase().includes(kw));
          if (found) return found;
        }
        return britishVoices[0];
      }

      // Fallback: standard English premium voices
      const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
      if (englishVoices.length > 0) {
        const priorityKeywords = ['natural', 'google', 'microsoft', 'male', 'female'];
        for (const kw of priorityKeywords) {
          const found = englishVoices.find(v => v.name.toLowerCase().includes(kw));
          if (found) return found;
        }
        return englishVoices[0];
      }

      return voices[0];
    } catch { return null; }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const update = () => { voiceRef.current = getBestVoice(); };
    update();
    try { window.speechSynthesis.onvoiceschanged = update; } catch {}
    return () => {
      try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; } catch {}
    };
  }, [getBestVoice]);

  // ── STOP ALL SPEECH ───────────────────────────────────────────────────────
  const stopAllSpeech = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch {}
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ── SPEAK ─────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (isMutedRef.current) return;
    if (!isOpenRef.current) {
      pendingSpeech.current = text;
      setHasPendingSpeech(true);
      return;
    }
    setHasPendingSpeech(false);
    pendingSpeech.current = null;
    executiveSpeak(
      text,
      voiceRef.current,
      isMutedRef,
      volumeRef,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
    );
  }, []);

  // ── FLUSH PENDING SPEECH ──────────────────────────────────────────────────
  const flushPendingSpeech = useCallback(() => {
    if (pendingSpeech.current) {
      const t = pendingSpeech.current;
      pendingSpeech.current = null;
      setHasPendingSpeech(false);
      speak(t);
    }
  }, [speak]);

  return {
    isMuted, setIsMuted, isMutedRef,
    isSpeaking,
    volume, setVolume, volumeRef,
    voiceRef,
    isOpenRef,
    hasPendingSpeech,
    speak,
    stopAllSpeech,
    flushPendingSpeech,
    currentAudioRef,
  };
}
