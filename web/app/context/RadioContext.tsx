'use client';
/**
 * RadioContext.tsx
 * SOVEREIGN FM RADIO — GLOBAL SINGLETON CONTEXT
 * Mounts once at the dashboard layout level.
 * All panels share ONE audio instance. No duplicates. No double-play.
 */
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';

export interface Station {
  name: string;
  url: string;
  genre: string;
}

export const STATIONS: Station[] = [
  { name: '88.5 - BBC World Service', url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service', genre: 'Global News'   },
  { name: '92.3 - Radio Paradise',    url: 'https://stream.radioparadise.com/aac-320',                genre: 'Eclectic Mix'  },
  { name: '98.1 - SomaFM Groove',     url: 'https://ice6.somafm.com/groovesalad-256-mp3',             genre: 'Ambient/Chill' },
  { name: '104.5 - Capital FM UK',    url: 'https://media-ssl.musicradio.com/CapitalUK',              genre: 'Pop/Hits'      },
  { name: '107.1 - FIP Paris',        url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',            genre: 'Jazz/World'    },
];

interface RadioContextValue {
  radioActive: boolean;
  radioStation: number;
  radioExpanded: boolean;
  radioVisible: boolean;  // false = dismissed back to solve portal
  favourites: number[];
  frequency: number;
  volume: number;
  setRadioExpanded: (v: boolean) => void;
  setRadioVisible: (v: boolean) => void;
  setFrequency: (v: number) => void;
  setVolume: (v: number) => void;
  toggleRadio: () => void;
  switchStation: (idx: number) => void;
  toggleFavourite: (idx: number) => void;
  playCustom: (url: string, name: string) => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export function RadioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [radioActive, setRadioActive] = useState(false);
  const [radioStation, setRadioStation] = useState(0);
  const [radioExpanded, setRadioExpanded] = useState(false);
  const [radioVisible, setRadioVisible] = useState(false); // starts hidden — reveal on first play
  const [favourites, setFavourites] = useState<number[]>([]);
  const [frequency, setFrequency] = useState(88.5);
  const [volume, setVolume] = useState(0.8);

  // Load saved favourites on boot
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('miracle_radio_favs') || '[]');
    setFavourites(saved);
    if (saved.length > 0) {
      setRadioStation(saved[0]);
      setFrequency(parseFloat(STATIONS[saved[0]]?.name?.match(/\d+\.\d+/)?.[0] || '88.5'));
    }
  }, []);

  const setupMediaSession = useCallback((stationName: string) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: stationName,
      artist: 'Miracle HMS Operative FM',
      album: 'Zone 17 - Live Radio',
      artwork: [{ src: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' }],
    });
    navigator.mediaSession.setActionHandler('play',  () => { audioRef.current?.play(); setRadioActive(true);  navigator.mediaSession.playbackState = 'playing'; });
    navigator.mediaSession.setActionHandler('pause', () => { audioRef.current?.pause(); setRadioActive(false); navigator.mediaSession.playbackState = 'paused'; });
    navigator.mediaSession.setActionHandler('stop',  () => { audioRef.current?.pause(); setRadioActive(false); navigator.mediaSession.playbackState = 'none'; });
    navigator.mediaSession.playbackState = 'playing';
  }, []);

  const playStation = useCallback((stationIdx: number, vol: number) => {
    const st = STATIONS[stationIdx];
    if (!st) return;
    // Reuse the SAME audio element — just update src. No new Audio() = no duplicate.
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute('playsinline', 'true');
      audioRef.current.setAttribute('preload', 'none');
      audioRef.current.crossOrigin = 'anonymous';
    }
    audioRef.current.pause();
    audioRef.current.src = st.url;
    audioRef.current.volume = Math.max(0, Math.min(1, vol));
    audioRef.current.play().catch(e => console.warn('Radio play failed:', e));
    setRadioActive(true);
    setRadioVisible(true);
    setupMediaSession(st.name);
  }, [setupMediaSession]);

  const toggleRadio = useCallback(() => {
    if (radioActive) {
      audioRef.current?.pause();
      setRadioActive(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    } else {
      playStation(radioStation, volume);
    }
  }, [radioActive, radioStation, volume, playStation]);

  const switchStation = useCallback((idx: number) => {
    setRadioStation(idx);
    setFrequency(parseFloat(STATIONS[idx]?.name?.match(/\d+\.\d+/)?.[0] || '88.5'));
    // If already playing, switch stream immediately; otherwise just queue
    if (radioActive) {
      playStation(idx, volume);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = STATIONS[idx].url;
      }
    }
  }, [radioActive, volume, playStation]);

  const toggleFavourite = useCallback((idx: number) => {
    setFavourites(prev => {
      const next = prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx];
      localStorage.setItem('miracle_radio_favs', JSON.stringify(next));
      return next;
    });
  }, []);

  const playCustom = useCallback((url: string, name: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute('playsinline', 'true');
      audioRef.current.crossOrigin = 'anonymous';
    }
    audioRef.current.pause();
    audioRef.current.src = url;
    audioRef.current.volume = volume;
    audioRef.current.play().catch(e => console.warn('Radio play failed:', e));
    setRadioActive(true);
    setRadioVisible(true);
    setupMediaSession(name);
  }, [volume, setupMediaSession]);

  const handleSetVolume = useCallback((v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const handleSetFrequency = useCallback((val: number) => {
    setFrequency(val);
    // Auto-snap: if near a station freq, switch to it
    const match = STATIONS.findIndex(s => {
      const f = parseFloat(s.name.match(/\d+\.\d+/)?.[0] || '0');
      return Math.abs(f - val) < 0.6;
    });
    if (match !== -1 && match !== radioStation) switchStation(match);
  }, [radioStation, switchStation]);

  return (
    <RadioContext.Provider value={{
      radioActive, radioStation, radioExpanded, radioVisible, favourites, frequency, volume,
      setRadioExpanded, setRadioVisible,
      setFrequency: handleSetFrequency,
      setVolume: handleSetVolume,
      toggleRadio, switchStation, toggleFavourite, playCustom,
    }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside RadioProvider');
  return ctx;
}
