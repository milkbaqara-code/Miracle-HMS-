'use client';
// ============================================================
// MiracleBot / hooks / useMiracleSTT.ts
// Sovereign Speech-to-Text hook — Web Speech API with full
// barge-in support. Stops TTS when mic activates.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useRef, useCallback } from 'react';

interface STTOptions {
  onTranscript: (text: string) => void;
  stopAllSpeech: () => void;
  language: string;
}

export function useMiracleSTT({ onTranscript, stopAllSpeech, language }: STTOptions) {
  const [isListening,  setIsListening]  = useState(false);
  const [micActivity,  setMicActivity]  = useState(0);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopAllSpeech(); // Full barge-in

    const recognition = new SpeechRecognition();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = language || 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript)
        .join('');
      // Simulate mic activity level for visual feedback
      setMicActivity(Math.min(transcript.length * 2, 100));
      if (e.results[e.results.length - 1].isFinal) {
        setMicActivity(0);
        setIsListening(false);
        onTranscript(transcript.trim());
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setMicActivity(0);
    };

    recognition.onend = () => {
      setIsListening(false);
      setMicActivity(0);
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [language, onTranscript, stopAllSpeech]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setIsListening(false);
    setMicActivity(0);
  }, []);

  return { isListening, micActivity, startListening, stopListening };
}
