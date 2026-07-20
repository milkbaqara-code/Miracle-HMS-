'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useRadio } from '../context/RadioContext';

interface Movie {
  id: string;
  title: string;
  description: string;
  price: string;
  bg: string;
  poster_url: string;
  trailer_url: string;
  drive_file_id: string;
}

interface TVEpisode {
  episode_number: number;
  title: string;
  duration: number;
  drive_file_id: string;
}

interface TVSeason {
  season_number: number;
  episodes: TVEpisode[];
}

interface TVSeriesMeta {
  plot: string;
  is_series: boolean;
  seasons: TVSeason[];
}

const CATEGORIES_META: Record<string, { label: string; icon: string; color: string }> = {
  CAROUSEL: { label: "Featured Spotlight", icon: "🌟", color: "#FFD700" },
  PAID_NEW_RELEASE: { label: "Premiere Releases (🎫 Paid)", icon: "🎫", color: "#D4AF37" },
  FREE_MEMBERVIEW: { label: "Free Memberview Zone", icon: "🆓", color: "#00F2FF" },
  HIT_SERIES: { label: "Hit Series & Serials", icon: "📺", color: "#FF3131" },
  ACTION: { label: "Action Blockbusters", icon: "⚡", color: "#FF6B35" },
  SCIFI: { label: "Sci-Fi & Cosmic Horizons", icon: "🛸", color: "#00F2FF" },
  HORROR: { label: "Supernatural & Horror", icon: "👻", color: "#CC44FF" },
  DRAMA: { label: "Award-Winning Drama", icon: "🎭", color: "#FF3366" },
  ROMCOM: { label: "Royal Rom-Coms", icon: "💖", color: "#FF66B2" },
  CYBERPUNK: { label: "Cyberpunk & Future Noir", icon: "🕶️", color: "#39FF14" },
  ANIME: { label: "Anime & Animated Epics", icon: "🐉", color: "#FFCC00" },
  SPORTS: { label: "Live Sports & Action", icon: "🏈", color: "#FF5722" },
  COMEDY: { label: "Stand-Up & Comedy", icon: "🎙️", color: "#4CAF50" },
  TRAVEL: { label: "Travel & Food Odysseys", icon: "🗺️", color: "#03A9F4" },
  MYSTERY: { label: "Crime & Mystery Sagas", icon: "🕵️", color: "#607D8B" },
  HISTORY: { label: "Historical & Biographical", icon: "🏛️", color: "#FF9800" },
  MUSIC: { label: "Music Concerts & Musicals", icon: "🎹", color: "#9C27B0" },
  NATURE: { label: "Eco-Nature & Science", icon: "🌊", color: "#8BC34A" },
  FAMILY: { label: "Kids & Family Fun", icon: "🎪", color: "#E91E63" },
  FANTASY: { label: "Fantasy & Mythological", icon: "🔮", color: "#3F51B5" },
  INDIE: { label: "Sovereign Indie Cinema", icon: "🎞️", color: "#E0E0E0" }
};

const MUSIC_TRACKS = [
  { id: 'track-1', title: 'Eco-Resort Ambient Morning', artist: 'Sovereign Soundscapes', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', cover: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&q=80' },
  { id: 'track-2', title: 'Cyberpunk Skyline Beats', artist: 'Hacker Zone 17', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', cover: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=200&q=80' },
  { id: 'track-3', title: 'Midnight Lounge & Sommelier', artist: 'Miracle Jazz Trio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', cover: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=200&q=80' },
  { id: 'track-4', title: 'Sovereign Coast Wave Chill', artist: 'Royalty Free Loops', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=80' }
];

const LIVE_TV_CHANNELS = [
  { id: 'al-jazeera', name: 'Al Jazeera English', icon: '🌍', genre: 'NEWS',    country: 'QA' },
  { id: 'bloomberg',  name: 'Bloomberg TV',        icon: '📈', genre: 'FINANCE', country: 'US' },
  { id: 'nasa-tv',    name: 'NASA TV',             icon: '🚀', genre: 'SCIENCE', country: 'US' },
  { id: 'france24',   name: 'France 24',           icon: '🇫🇷', genre: 'NEWS',   country: 'FR' },
  { id: 'dw-news',    name: 'DW News',             icon: '🇩🇪', genre: 'NEWS',   country: 'DE' },
  { id: 'euronews',   name: 'Euronews',            icon: '🇪🇺', genre: 'EUROPE', country: 'EU' },
  { id: 'trt-world',  name: 'TRT World',           icon: '📡', genre: 'NEWS',    country: 'TR' },
  { id: 'cgtn',       name: 'CGTN',                icon: '🐉', genre: 'NEWS',    country: 'CN' },
  { id: 'nhk-world',  name: 'NHK World',           icon: '🇯🇵', genre: 'NEWS',   country: 'JP' },
  { id: 'sky-news',   name: 'Sky News',            icon: '🛰️', genre: 'NEWS',  country: 'GB' },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;600;700;900&display=swap');

  @keyframes shimmerSwipe { from{left:-70%} to{left:120%} }
  @keyframes pulse-ring   { 0%{transform:scale(1);opacity:0.6} 70%{transform:scale(1.5);opacity:0} 100%{transform:scale(1.5);opacity:0} }
  @keyframes spotGlow     { 0%,100%{opacity:0.18} 50%{opacity:0.28} }
  @keyframes cardIn       { from{opacity:0;transform:translateY(24px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes scaleUp      { from{transform:scale(0.98);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes visualizerAnim { 0%, 100% { height: 5px; } 50% { height: 35px; } }

  .cinema-hero {
    position: relative;
    padding: clamp(20px,5vw,36px) clamp(16px,5vw,28px) clamp(16px,4vw,24px);
    overflow: hidden;
    border-bottom: 1px solid rgba(212,175,55,0.12);
  }
  .cinema-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(212,175,55,0.12) 0%, transparent 65%),
      radial-gradient(ellipse at 80% 20%, rgba(0,242,255,0.05) 0%, transparent 55%);
    animation: spotGlow 4s ease infinite;
    pointer-events: none;
  }
  .cinema-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: clamp(28px,8vw,42px);
    font-weight: 700;
    letter-spacing: 2px;
    color: #FFF;
    margin: 0;
    text-shadow: 0 0 40px rgba(212,175,55,0.4), 0 2px 8px rgba(0,0,0,0.8);
  }
  .cinema-title span { color: #D4AF37; }
  .cinema-sub {
    font-family: 'Inter', sans-serif;
    font-size: 9px; font-weight: 700;
    letter-spacing: 3px; text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin: 6px 0 0;
  }
  .cinema-tag {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(212,175,55,0.1);
    border: 1px solid rgba(212,175,55,0.25);
    border-radius: 20px; padding: 4px 12px;
    font-size: 9px; font-weight: 700; color: #D4AF37;
    letter-spacing: 2px; margin-top: 10px;
  }

  /* ── 3D CURVED THEATER VIEW ─────────────────────── */
  .theater-container {
    perspective: 1000px;
    width: 100%;
    max-width: 900px;
    margin: 30px auto 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 0 16px;
  }
  .theater-screen-wrapper {
    width: 100%;
    aspect-ratio: 16/7;
    transform-style: preserve-3d;
    transform: rotateX(12deg);
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 
      0 15px 35px rgba(0, 242, 255, 0.2), 
      0 0 40px rgba(0, 0, 0, 0.8),
      inset 0 0 30px rgba(0, 0, 0, 0.9);
    border: 1.5px solid rgba(0, 242, 255, 0.25);
    background: #000;
  }
  .theater-screen-content {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 20px;
    transition: background-image 0.5s ease;
  }
  .theater-screen-content::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%);
  }
  .theater-projector-ray {
    position: absolute;
    top: -50px;
    left: 50%;
    transform: translateX(-50%) rotateX(-12deg);
    width: 120%;
    height: 110%;
    background: radial-gradient(ellipse at top, rgba(0, 242, 255, 0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 2;
  }
  .theater-seating-chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
    transform: rotateX(28deg);
    transform-style: preserve-3d;
    width: 100%;
    max-width: 500px;
    align-items: center;
  }
  .theater-row {
    display: flex;
    gap: 6px;
    justify-content: center;
  }
  .theater-chair {
    font-size: 16px;
    color: #333;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .theater-chair:hover {
    color: #D4AF37;
    transform: translateZ(12px) scale(1.3);
    text-shadow: 0 0 10px rgba(212,175,55,0.8);
  }
  .theater-chair.booked {
    color: #FF3131;
    cursor: not-allowed;
  }

  /* ── NAVIGATION TABS ───────────────────────────── */
  .category-tab-bar {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    background: rgba(10,10,12,0.6);
    backdrop-filter: blur(15px);
    position: sticky;
    top: 0;
    z-index: 80;
  }
  .category-tab-btn {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    color: #777;
    padding: 10px 4px;
    border-radius: 10px;
    font-size: clamp(9px, 2.5vw, 11px);
    font-weight: 800;
    letter-spacing: 1px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: all 0.25s;
    text-transform: uppercase;
  }
  .category-tab-btn.active {
    background: rgba(212, 175, 55, 0.08);
    border-color: #D4AF37;
    color: #D4AF37;
    box-shadow: 0 0 15px rgba(212,175,55,0.15);
  }
  .category-tab-btn:hover:not(.active) {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.15);
    color: #FFF;
  }

  /* ── NETFLIX SCROLL ROWS ────────────────────────── */
  .section-head {
    display: flex; align-items: center; gap: 10px;
    padding: 0 16px; margin-bottom: 12px; margin-top: 24px;
  }
  .section-bar { width: 3px; height: 16px; border-radius: 2px; flex-shrink: 0; }
  .section-name {
    font-family: 'Inter', sans-serif;
    font-size: clamp(11px,3.2vw,13px); font-weight: 900;
    letter-spacing: 2px; text-transform: uppercase;
  }
  .section-count {
    font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.3);
    margin-left: auto; letter-spacing: 1px;
  }
  .h-scroll {
    display: flex; gap: 12px;
    overflow-x: auto; padding: 4px 16px 20px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .h-scroll::-webkit-scrollbar { display: none; }

  /* ── MOVIE CARDS ────────────────────────────────── */
  .nf-card {
    min-width: clamp(112px,32vw,165px);
    aspect-ratio: 2/3;
    border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.06);
    background: #111;
    cursor: pointer; position: relative;
    scroll-snap-align: start; flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s, border-color 0.25s;
    animation: cardIn 0.4s ease both;
  }
  .nf-card::after {
    content: '';
    position: absolute; top: 0; left: -70%; width: 40%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    transform: skewX(-15deg);
    transition: left 0.5s ease;
    pointer-events: none;
  }
  .nf-card:active { transform: scale(0.94); }
  @media (hover:hover) {
    .nf-card:hover { transform: scale(1.06) translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.7); border-color: rgba(255,255,255,0.22); }
    .nf-card:hover::after { left: 120%; }
  }
  .card-img { width: 100%; height: 100%; object-fit: cover; }
  .card-overlay {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 24px 10px 10px;
    background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%);
    z-index: 2;
  }
  .card-badge {
    font-size: 7px; font-weight: 900; letter-spacing: 1px;
    margin-bottom: 4px; text-transform: uppercase;
  }
  .card-title {
    font-family: 'Inter', sans-serif;
    font-size: clamp(10px,2.8vw,12px); font-weight: 800;
    color: #FFF; line-height: 1.25;
  }
  .prev-vid { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.5s }
  .prev-vid.on { opacity:1 }

  /* ── GLASS PANELS ──────────────────────────────── */
  .tab-view-container {
    padding: 16px;
    animation: scaleUp 0.35s ease;
  }
  .sovereign-glass-card {
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    padding: 20px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    margin-bottom: 20px;
  }
  .suite-select-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  @media (min-width: 600px) {
    .suite-select-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .suite-option-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 14px;
    cursor: pointer;
    transition: all 0.25s;
    text-align: center;
  }
  .suite-option-card.active {
    border-color: #D4AF37;
    background: rgba(212,175,55,0.06);
    box-shadow: 0 0 15px rgba(212,175,55,0.15);
  }
  .suite-option-card:hover:not(.active) {
    border-color: rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.04);
  }

  .s-form-group {
    margin-bottom: 16px;
  }
  .s-form-label {
    display: block;
    font-size: 9px;
    font-weight: 900;
    color: #666;
    letter-spacing: 1.5px;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .s-form-input, .s-form-select, .s-form-textarea {
    width: 100%;
    padding: 12px 14px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #FFF;
    border-radius: 10px;
    font-size: 13px;
    outline: none;
    transition: all 0.25s;
    box-sizing: border-box;
    font-family: 'Inter', sans-serif;
  }
  .s-form-input:focus, .s-form-select:focus, .s-form-textarea:focus {
    border-color: #D4AF37;
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.15);
  }
  .s-form-textarea {
    min-height: 70px;
    resize: vertical;
  }

  .s-btn-primary {
    width: 100%;
    padding: 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, #D4AF37, #B8960C);
    color: #000;
    border: none;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.5px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.25s;
    box-shadow: 0 0 20px rgba(212,175,55,0.25);
  }
  .s-btn-primary:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
    box-shadow: 0 0 25px rgba(212,175,55,0.4);
  }
  .s-btn-primary:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* ── MUSIC SUITE PLAYER ───────────────────────── */
  .music-player-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  @media (min-width: 700px) {
    .music-player-grid { grid-template-columns: 2fr 3fr; }
  }
  .music-list-pane {
    max-height: 380px;
    overflow-y: auto;
    padding-right: 6px;
  }
  .music-list-pane::-webkit-scrollbar {
    width: 4px;
  }
  .music-list-pane::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
  }
  .music-item-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid transparent;
    cursor: pointer;
    margin-bottom: 8px;
    transition: all 0.25s;
  }
  .music-item-row.active {
    background: rgba(212,175,55,0.06);
    border-color: rgba(212,175,55,0.25);
  }
  .music-item-row:hover:not(.active) {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.1);
  }
  .track-art {
    width: 40px; height: 40px; border-radius: 6px; object-fit: cover;
  }

  .visualizer-wave-bar {
    width: 4px;
    background: #D4AF37;
    border-radius: 2px;
    animation: visualizerAnim 1.2s ease-in-out infinite;
  }

  /* ── LIVE TV CARDS ──────────────────────────────── */
  .tv-card {
    min-width: clamp(120px,36vw,160px);
    height: clamp(75px,20vw,95px);
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 4px; cursor: pointer;
    scroll-snap-align: start; flex-shrink: 0;
    position: relative; overflow: hidden;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .tv-card::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,49,49,0.05) 0%, transparent 60%);
    pointer-events: none;
  }
  .tv-card:active { transform: scale(0.94); border-color: #FF3131; background: rgba(255,49,49,0.08); }
  @media (hover:hover) {
    .tv-card:hover { transform: translateY(-4px); border-color: rgba(255,49,49,0.5); box-shadow: 0 8px 28px rgba(255,49,49,0.2); background: rgba(255,49,49,0.06); }
  }
  .live-pulse {
    position: absolute; top: 7px; right: 7px;
    width: 8px; height: 8px;
  }
  .live-pulse::before, .live-pulse::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: 50%;
    background: #FF3131;
  }
  .live-pulse::after {
    animation: pulse-ring 1.4s ease infinite;
    background: transparent;
    border: 2px solid #FF3131;
  }
  .tv-name {
    font-family: 'Inter', sans-serif;
    font-size: clamp(8px,2.2vw,10px); font-weight: 800;
    color: #FFF; letter-spacing: 0.5px;
    text-align: center; padding: 0 8px; line-height: 1.3;
  }
  .tv-genre {
    font-size: 7px; font-weight: 900; color: #FF3131;
    letter-spacing: 1.5px; text-transform: uppercase;
  }

  /* ── FULLSCREEN PLAYER ──────────────────────────── */
  .player-wrap {
    position: fixed; inset: 0; z-index: 99999;
    background: #000; display: flex; flex-direction: column;
  }
  .player-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding: max(env(safe-area-inset-top,0px),14px) 16px 14px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, transparent 100%);
    position: absolute; top: 0; left: 0; right: 0; z-index: 3;
    gap: 10px; flex-wrap: wrap;
  }
  .player-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(14px,4vw,18px); font-style: italic;
    color: #D4AF37; margin: 0; flex: 1;
  }
  .live-badge {
    background: #FF3131; color: #FFF;
    font-size: 8px; font-weight: 900; padding: 3px 8px;
    border-radius: 4px; animation: blink 1.5s infinite;
    letter-spacing: 1.5px;
  }
  .q-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    color: #FFF; padding: 5px 11px;
    border-radius: 8px; font-size: 9px; font-weight: 900;
    cursor: pointer; transition: 0.2s; letter-spacing: 1px;
  }
  .q-btn.active, .q-btn:hover {
    background: rgba(212,175,55,0.2);
    border-color: #D4AF37; color: #D4AF37;
  }
  .close-btn {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.15);
    color: #FFF; padding: 9px 18px;
    border-radius: 50px; cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-weight: 700; font-size: 11px; letter-spacing: 1px;
    min-height: 42px; flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;
  }
  .close-btn:active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.4); }
`;

export default function MiracleCinema() {
  const router = useRouter();
  const pathname = usePathname();
  const isGuestView = pathname?.startsWith('/guest');
  const { radioActive, toggleRadio } = useRadio();
  const [activeTab, setActiveTab] = useState<'cinema' | 'music'>('cinema');

  const [playingVideo, setPlayingVideo] = useState<any>(null);
  const [liveStreamUrl, setLiveStreamUrl] = useState<string>('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [hoveredMovie, setHoveredMovie] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [quality, setQuality] = useState<string>('auto');
  const [qualityLevels, setQualityLevels] = useState<any[]>([]);
  const [vault, setVault] = useState<Record<string, Movie[]>>({});
  const [loading, setLoading] = useState(true);

  // Active user / room tracking for billing
  const [roomNumber, setRoomNumber] = useState('');
  const [session, setSession] = useState<any>(null);

  // TV Serial Season & Episode selection
  const [selectedSerial, setSelectedSerial] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Seeding the virtual theater curved screen with a current movie
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);

  // VIP Screening states
  const [vipSuite, setVipSuite] = useState('ONYX');
  const [vipDate, setVipDate] = useState('');
  const [vipTime, setVipTime] = useState('06:00 PM');
  const [vipGuests, setVipGuests] = useState('1');
  const [vipNotes, setVipNotes] = useState('');
  const [vipSubmitting, setVipSubmitting] = useState(false);
  const [vipSuccess, setVipSuccess] = useState(false);

  // Private Events states
  const [eventCategory, setEventCategory] = useState('YACHT');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('10:00 AM');
  const [eventGuests, setEventGuests] = useState('10');
  const [eventNotes, setEventNotes] = useState('');
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventSuccess, setEventSuccess] = useState(false);

  // MP3 Player states
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isMp3Playing, setIsMp3Playing] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [mp3Volume, setMp3Volume] = useState(0.8);

  useEffect(() => {
    const guestSessionStr = localStorage.getItem('SOV_GUEST_SESSION');
    if (guestSessionStr) {
      try {
        const parsed = JSON.parse(guestSessionStr);
        setSession(parsed);
        setRoomNumber(parsed.room || '');
      } catch {}
    } else {
      setRoomNumber('Z-17'); // Fallback room number
    }

    // Default dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.toISOString().split('T')[0];
    setVipDate(tomStr);
    setEventDate(tomStr);
  }, []);

  const fetchVault = () => {
    setLoading(true);
    fetch('/api/cinema/vault')
      .then(r => r.json())
      .then(data => {
        setVault(data || {});
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  };

  useEffect(() => {
    fetchVault();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'music') {
        setActiveTab('music');
      }
    }
  }, []);

  // Interval for 3D theater screen slideshow
  useEffect(() => {
    if (activeTab !== 'cinema') return;
    const featured = vault.CAROUSEL || [];
    if (featured.length === 0) return;

    const interval = setInterval(() => {
      setActiveScreenIndex(prev => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [vault.CAROUSEL, activeTab]);

  // Video Streaming Handlers (HLS / MP4)
  useEffect(() => {
    if (!playingVideo || !videoRef.current) return;
    const src = playingVideo.isLive
      ? liveStreamUrl
      : (playingVideo.trailer_url ? `/api/cinema/stream?drive_id=${encodeURIComponent(playingVideo.trailer_url)}` : 'https://www.w3schools.com/html/mov_bbb.mp4');
    if (!src) return;
    const isHls = src.includes('.m3u8') || src.includes('hls-proxy');
    if (isHls) {
      if (typeof window !== 'undefined') {
        const existingScript = document.getElementById('hlsjs-cdn');
        const initHls = () => {
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();
            const hls = new Hls({ maxBufferLength: 60, enableWorker: true });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(videoRef.current!);
            hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
              setQualityLevels(data.levels || []);
              videoRef.current?.play().catch(() => {});
            });
          } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = src;
            videoRef.current.play().catch(() => {});
          }
        };
        if (!existingScript) {
          const s = document.createElement('script');
          s.id = 'hlsjs-cdn';
          s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
          s.onload = initHls;
          document.head.appendChild(s);
        } else { initHls(); }
      }
    } else {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      setQualityLevels([]);
      videoRef.current.src = src;
      videoRef.current.play().catch(() => {});
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [playingVideo, liveStreamUrl]);

  const handleQualityChange = (levelIdx: number) => {
    if (hlsRef.current) { hlsRef.current.currentLevel = levelIdx; setQuality(levelIdx === -1 ? 'auto' : String(levelIdx)); }
  };

  const handlePlay = (movie: any) => {
    // Prevent overlapping music
    if (radioActive) toggleRadio();
    pauseMp3();
    setQualityLevels([]); setQuality('auto'); setLiveStreamUrl('');
    setPlayingVideo({ ...movie, isLive: false });
  };

  const handlePlayLive = async (channelId: string, channelName: string, genre: string) => {
    if (radioActive) toggleRadio();
    pauseMp3();
    setQualityLevels([]); setQuality('auto'); setLiveStreamUrl(''); setLiveLoading(true);
    setPlayingVideo({ id: channelId, title: channelName, description: genre, isLive: true, trailer_url: '', poster_url: '', price: 'FREE', bg: '#000', drive_file_id: '' });
    try {
      const res = await fetch(`/api/cinema/live-stream/${channelId}`);
      const data = await res.json();
      if (data.stream_url) setLiveStreamUrl(data.stream_url);
    } catch {}
    finally { setLiveLoading(false); }
  };

  const handleClose = () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; }
    setPlayingVideo(null); setLiveStreamUrl(''); setQualityLevels([]);
  };

  // TV Series Season & Episode handlers
  const handleSelectSerial = (movie: any) => {
    try {
      const parsed: TVSeriesMeta = JSON.parse(movie.description);
      if (parsed.is_series) {
        setSelectedSerial({ ...movie, seriesMeta: parsed });
        setSelectedSeason(1);
        return;
      }
    } catch {}
    handlePlay(movie);
  };

  const handlePlayEpisode = (episode: TVEpisode) => {
    handlePlay({
      id: `ep-${episode.episode_number}`,
      title: `${selectedSerial.title} - S${selectedSeason}E${episode.episode_number}: ${episode.title}`,
      description: `Episode duration: ${episode.duration} min.`,
      price: 'FREE',
      bg: '#000',
      poster_url: selectedSerial.poster_url,
      trailer_url: episode.drive_file_id,
      drive_file_id: episode.drive_file_id
    });
  };

  // VIP booking flow
  const handleVipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipDate || !vipTime) return;
    setVipSubmitting(true);

    const notes = `Suite: ${vipSuite}. Total Guests: ${vipGuests}. Special requests: ${vipNotes}`;
    try {
      const res = await fetch('/api/guest/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomNumber,
          service: `VIP_SCREENING_${vipSuite}`,
          date: vipDate,
          time: vipTime,
          guests: parseInt(vipGuests),
          notes: notes
        })
      });
      if (res.ok) {
        setVipSuccess(true);
      } else {
        throw new Error();
      }
    } catch {
      // Fallback ticket
      try {
        await fetch('/api/guest/concierge/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomNumber,
            dept: 'RS',
            subject: `[VIP CINEMA SCREENING] Suite: ${vipSuite} - ${vipDate} at ${vipTime} for ${vipGuests} guest(s). Notes: ${vipNotes}`,
            priority: 'HIGH'
          })
        });
        setVipSuccess(true);
      } catch {
        alert('Booking service currently unavailable. Please contact room service.');
      }
    } finally {
      setVipSubmitting(false);
    }
  };

  // Private Events flow
  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate || !eventTime) return;
    setEventSubmitting(true);

    const notes = `Category: ${eventCategory}. Total Guests: ${eventGuests}. Specifications: ${eventNotes}`;
    try {
      const res = await fetch('/api/guest/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomNumber,
          service: `PRIVATE_EVENT_${eventCategory}`,
          date: eventDate,
          time: eventTime,
          guests: parseInt(eventGuests),
          notes: notes
        })
      });
      if (res.ok) {
        setEventSuccess(true);
      } else {
        throw new Error();
      }
    } catch {
      // Fallback ticket
      try {
        await fetch('/api/guest/concierge/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomNumber,
            dept: 'RS',
            subject: `[PRIVATE EVENT BOOKING] Category: ${eventCategory} - ${eventDate} at ${eventTime} for ${eventGuests} guest(s). Notes: ${eventNotes}`,
            priority: 'HIGH'
          })
        });
        setEventSuccess(true);
      } catch {
        alert('Booking service currently unavailable. Please contact concierge.');
      }
    } finally {
      setEventSubmitting(false);
    }
  };

  // MP3 Player audio actions
  const togglePlayMp3 = () => {
    if (radioActive) toggleRadio(); // Pause FM
    if (!audioRef.current) return;

    if (isMp3Playing) {
      audioRef.current.pause();
      setIsMp3Playing(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsMp3Playing(true);
    }
  };

  const pauseMp3 = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsMp3Playing(false);
    }
  };

  const handleTrackChange = (index: number) => {
    if (radioActive) toggleRadio();
    setCurrentTrackIndex(index);
    setIsMp3Playing(true);
    setTrackProgress(0);

    if (audioRef.current) {
      audioRef.current.src = MUSIC_TRACKS[index].url;
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setTrackProgress(audioRef.current.currentTime);
    }
  };

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setTrackDuration(audioRef.current.duration);
    }
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTrackProgress(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMp3Volume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const formatAudioTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTrack = MUSIC_TRACKS[currentTrackIndex];

  // Helper: check if movie matches TV Series
  const checkIsSeries = (movie: Movie) => {
    try {
      const parsed = JSON.parse(movie.description);
      return !!parsed.is_series;
    } catch {
      return false;
    }
  };

  const getMoviePlot = (movie: Movie) => {
    try {
      const parsed = JSON.parse(movie.description);
      return parsed.plot || movie.description;
    } catch {
      return movie.description;
    }
  };

  // Categories extraction
  const featuredList = vault.CAROUSEL || [];
  const activeScreenMovie = featuredList[activeScreenIndex] || null;

  return (
    <div style={{ background: 'linear-gradient(180deg, #060608 0%, #04040a 100%)', color: '#FFF', minHeight: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden', paddingBottom: '80px' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* HTML5 Native Audio for MP3 listening */}
      <audio
        ref={audioRef}
        src={currentTrack.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onEnded={() => handleTrackChange((currentTrackIndex + 1) % MUSIC_TRACKS.length)}
      />

      {/* ── FULLSCREEN VIDEO PLAYER ── */}
      {playingVideo && (
        <div className="player-wrap" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
          <div className="player-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <h3 className="player-title">{playingVideo.title}</h3>
              {playingVideo.isLive && <span className="live-badge">● LIVE</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {qualityLevels.length > 0 && (<>
                <span style={{ fontSize: 9, color: '#666', fontWeight: 900, letterSpacing: 1 }}>QUALITY</span>
                <button className={`q-btn ${quality === 'auto' ? 'active' : ''}`} onClick={() => handleQualityChange(-1)}>AUTO</button>
                {qualityLevels.map((lvl, i) => (
                  <button key={i} className={`q-btn ${quality === String(i) ? 'active' : ''}`} onClick={() => handleQualityChange(i)}>
                    {lvl.height ? `${lvl.height}p` : `Q${i + 1}`}
                  </button>
                ))}
              </>)}
              <button className="close-btn" onClick={handleClose}>
                <span style={{ fontSize: 14 }}>✕</span> CLOSE
              </button>
            </div>
          </div>
          {playingVideo.isLive && liveLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 44 }}>📡</div>
              <div style={{ color: '#D4AF37', fontWeight: 900, letterSpacing: 3, fontSize: 12, animation: 'blink 1s infinite' }}>CONNECTING TO LIVE FEED...</div>
            </div>
          ) : (
            <video ref={videoRef} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </div>
      )}

      {/* ── TV EPISODES MODAL ── */}
      {selectedSerial && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', padding: '16px' }}>
          <div className="sovereign-glass-card" style={{ width: '100%', maxWidth: '500px', background: '#0a0a0f', borderColor: 'rgba(255,49,49,0.3)', animation: 'scaleUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              <h2 style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '18px', color: '#FF3131', margin: 0 }}>{selectedSerial.title}</h2>
              <button onClick={() => setSelectedSerial(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <img src={selectedSerial.poster_url} alt="" style={{ width: '90px', height: '130px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
              <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900 }}>TV Series</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>{selectedSerial.seriesMeta.plot}</p>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span className="s-form-label">Select Season</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedSerial.seriesMeta.seasons.map((s: TVSeason) => (
                  <button
                    key={s.season_number}
                    onClick={() => setSelectedSeason(s.season_number)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid',
                      fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                      borderColor: selectedSeason === s.season_number ? '#FF3131' : '#222',
                      background: selectedSeason === s.season_number ? 'rgba(255,49,49,0.1)' : 'transparent',
                      color: selectedSeason === s.season_number ? '#FF3131' : '#777'
                    }}
                  >
                    Season {s.season_number}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="s-form-label">Episodes ({selectedSerial.seriesMeta.seasons.find((s: TVSeason) => s.season_number === selectedSeason)?.episodes.length || 0})</span>
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedSerial.seriesMeta.seasons.find((s: TVSeason) => s.season_number === selectedSeason)?.episodes.map((ep: TVEpisode) => (
                  <div
                    key={ep.episode_number}
                    onClick={() => handlePlayEpisode(ep)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,49,49,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: '#FF3131', fontWeight: 900, marginRight: '8px' }}>Ep {ep.episode_number}</span>
                      <span style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>{ep.title}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#666' }}>{ep.duration}m 🔀</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CINEPLEX HERO HEADER ── */}
      <div className="cinema-hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: 'column', gap: '10px' }}>
          {isGuestView && (
            <button 
              className="back-btn" 
              onClick={() => router.push('/guest/hub')}
              style={{
                background: 'rgba(255, 49, 49, 0.1)',
                border: '1.5px solid rgba(255, 49, 49, 0.3)',
                color: '#FF3131',
                padding: '8px 16px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: '11px',
                letterSpacing: '1px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                transition: 'all 0.2s'
              }}
            >
              ← HUB
            </button>
          )}
          <div>
            <h1 className="cinema-title">Z-17 Cine<span>Plex</span></h1>
            <p className="cinema-sub">Miracle Hotel · In-House Sovereign Entertainment</p>
            <div className="cinema-tag">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4AF37' }} />
              {loading ? 'SYNCHRONIZING LIBRARY...' : 'VAULT CONNECTED'}
            </div>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE TAB BAR ── */}
      <div className="category-tab-bar">
        <button className={`category-tab-btn ${activeTab === 'cinema' ? 'active' : ''}`} onClick={() => setActiveTab('cinema')}>
          <span style={{ fontSize: '16px' }}>🎬</span>
          <span>Premiere Hall</span>
        </button>
        <button className={`category-tab-btn ${activeTab === 'music' ? 'active' : ''}`} onClick={() => setActiveTab('music')}>
          <span style={{ fontSize: '16px' }}>🎶</span>
          <span>Live & Music</span>
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, minHeight: '300px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid rgba(212,175,55,0.2)', borderTop: '2px solid #D4AF37', animation: 'cubeRotate 1s linear infinite' }} />
          <div style={{ fontSize: '9px', fontWeight: 900, color: '#D4AF37', letterSpacing: '2px' }}>LINKING TO ENTERTAINMENT VAULT...</div>
        </div>
      ) : (
        <>
          {/* TAB 1: PREMIERE HALL (Netflix Library + 3D Virtual Theatre) */}
          {activeTab === 'cinema' && (
            <div className="tab-view-container">

              {/* 3D Virtual Cinema curved screen */}
              <div className="theater-container">
                <div style={{ fontSize: '8px', color: '#666', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  📺 Now Screening
                </div>
                <div className="theater-screen-wrapper">
                  <div className="theater-projector-ray" />
                  <div 
                    className="theater-screen-content"
                    style={{
                      backgroundImage: activeScreenMovie ? `url(${activeScreenMovie.poster_url})` : 'none',
                    }}
                  >
                    {activeScreenMovie && (
                      <div style={{ position: 'relative', zIndex: 5, padding: '10px' }}>
                        <span style={{ fontSize: '8px', background: '#D4AF37', color: '#000', padding: '3px 8px', borderRadius: '4px', fontWeight: 900, letterSpacing: '1px' }}>
                          FEATURED PREMIERE
                        </span>
                        <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#fff', margin: '6px 0 2px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                          {activeScreenMovie.title}
                        </h2>
                        <p style={{ fontSize: '10px', color: '#ccc', margin: 0, maxLines: 2, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                          {getMoviePlot(activeScreenMovie)}
                        </p>
                        <button 
                          onClick={() => handlePlay(activeScreenMovie)}
                          style={{
                            marginTop: '10px', padding: '6px 14px', background: '#fff', color: '#000',
                            border: 'none', borderRadius: '6px', fontSize: '9px', fontWeight: 900,
                            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'
                          }}
                        >
                          ▶ Stream Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3D luxury armchairs rows */}
                <div className="theater-seating-chart">
                  {Array.from({ length: 3 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="theater-row">
                      {Array.from({ length: 8 }).map((_, seatIndex) => {
                        // Seat states
                        const isBooked = (rowIndex === 1 && (seatIndex === 3 || seatIndex === 4));
                        return (
                          <div 
                            key={seatIndex} 
                            className={`theater-chair ${isBooked ? 'booked' : ''}`}
                            title={isBooked ? 'Seat Occupied' : `Row ${rowIndex + 1} Seat ${seatIndex + 1}`}
                            onClick={() => {
                              if (isBooked) return;
                              alert(`Seat selected: Row ${rowIndex + 1} Seat ${seatIndex + 1}. Head over to Z-17 VIP Suite tab to book this private hall room!`);
                            }}
                          >
                            💺
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '8px', color: '#444', fontWeight: 900, letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '14px', textAlign: 'center' }}>
                  Interactive 3D Seating Matrix · Tap chair to inspect
                </p>
              </div>

              {/* Loop over all categories dynamically */}
              {Object.keys(vault).map((catKey) => {
                const movies = vault[catKey] || [];
                if (movies.length === 0) return null;
                const meta = CATEGORIES_META[catKey] || { label: catKey, icon: '🎬', color: '#00F2FF' };

                return (
                  <div key={catKey} style={{ marginBottom: 12, animation: 'cardIn 0.4s ease both' }}>
                    <div className="section-head">
                      <div className="section-bar" style={{ background: meta.color }} />
                      <span className="section-name" style={{ color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="section-count">{movies.length} TITLES</span>
                    </div>

                    <div className="h-scroll">
                      {movies.map((movie, idx) => {
                        const isSeries = checkIsSeries(movie);
                        const isPaid = movie.price === 'PAID';
                        return (
                          <div
                            key={movie.id}
                            className={`nf-card ${isPaid ? 'gold' : ''}`}
                            style={{ animationDelay: `${idx * 0.05}s` }}
                            onClick={() => isSeries ? handleSelectSerial(movie) : handlePlay(movie)}
                            onMouseEnter={() => setHoveredMovie(movie.id)}
                            onMouseLeave={() => setHoveredMovie(null)}
                          >
                            <div style={{ width: '100%', height: '100%', background: `url(${movie.poster_url}) center/cover` }} />
                            {hoveredMovie === movie.id && movie.trailer_url && (
                              <video className="prev-vid on" src={`/api/cinema/stream?drive_id=${encodeURIComponent(movie.trailer_url)}`} autoPlay muted loop />
                            )}
                            <div className="card-overlay">
                              <div className="card-badge" style={{ color: isPaid ? '#D4AF37' : meta.color }}>
                                {isPaid ? '🎫 PURCHASE' : (isSeries ? '📺 TV SERIES' : '✓ FREE')}
                              </div>
                              <div className="card-title">{movie.title}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* LIVE TV */}
              <div style={{ marginBottom: 12 }}>
                <div className="section-head">
                  <div className="section-bar" style={{ background: '#FF3131' }} />
                  <span className="section-name" style={{ color: '#FF3131' }}>
                    📡 Live TV Networks
                  </span>
                  <span className="section-count">{LIVE_TV_CHANNELS.length} CHANNELS</span>
                </div>
                <div className="h-scroll">
                  {LIVE_TV_CHANNELS.map(tv => (
                    <div key={tv.id} className="tv-card" onClick={() => handlePlayLive(tv.id, tv.name, tv.genre)}>
                      <div className="live-pulse" />
                      <div style={{ fontSize: 'clamp(22px,7vw,30px)' }}>{tv.icon}</div>
                      <div className="tv-name">{tv.name}</div>
                      <div className="tv-genre">{tv.genre}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}


          {/* TAB 2: LIVE PERFORMANCES & MUSIC VAULT */}
          {activeTab === 'music' && (
            <div className="tab-view-container">
              <div className="sovereign-glass-card">
                <h2 style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '20px', color: '#D4AF37', margin: '0 0 8px' }}>
                  🎶 In-House Music Suite & Radio
                </h2>
                <p style={{ fontSize: '11px', color: '#888', lineHeight: '1.5', margin: '0 0 20px' }}>
                  Listen to exclusive soundscapes, play/stream audio albums, or tune in directly to the <strong>Sovereign FM Radio</strong>.
                </p>

                <div className="music-player-grid">
                  
                  {/* Left Column: Track Selector */}
                  <div>
                    <h3 style={{ fontSize: '11px', fontWeight: 900, color: '#D4AF37', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Track Library
                    </h3>
                    <div className="music-list-pane">
                      {MUSIC_TRACKS.map((t, idx) => (
                        <div 
                          key={t.id} 
                          className={`music-item-row ${currentTrackIndex === idx ? 'active' : ''}`}
                          onClick={() => handleTrackChange(idx)}
                        >
                          <img src={t.cover} className="track-art" alt="" />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: '#fff', fontWeight: 700 }}>{t.title}</div>
                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{t.artist}</div>
                          </div>
                          {currentTrackIndex === idx && isMp3Playing && (
                            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '20px' }}>
                              <div className="visualizer-wave-bar" style={{ animationDelay: '0.1s' }} />
                              <div className="visualizer-wave-bar" style={{ animationDelay: '0.4s' }} />
                              <div className="visualizer-wave-bar" style={{ animationDelay: '0.2s' }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Player Controls & Radio */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    
                    {/* Active Track Box */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
                      <img src={currentTrack.cover} alt="" style={{ width: '100px', height: '100px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 12px', boxShadow: '0 8px 20px rgba(0,0,0,0.5)' }} />
                      <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>{currentTrack.title}</h4>
                      <p style={{ fontSize: '10px', color: '#D4AF37', margin: 0 }}>{currentTrack.artist}</p>

                      {/* Scrub Bar */}
                      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', color: '#555' }}>{formatAudioTime(trackProgress)}</span>
                        <input 
                          type="range" 
                          min={0} 
                          max={trackDuration || 100} 
                          value={trackProgress} 
                          onChange={handleScrubChange}
                          style={{ flex: 1, accentColor: '#D4AF37', height: '4px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '9px', color: '#555' }}>{formatAudioTime(trackDuration)}</span>
                      </div>

                      {/* Audio Controls */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', marginTop: '16px' }}>
                        <button 
                          onClick={() => handleTrackChange((currentTrackIndex - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length)}
                          style={{ background: 'none', border: 'none', color: '#777', fontSize: '18px', cursor: 'pointer' }}
                        >
                          ⏮
                        </button>
                        <button 
                          onClick={togglePlayMp3}
                          style={{
                            background: '#D4AF37', color: '#000', border: 'none',
                            width: '42px', height: '42px', borderRadius: '50%',
                            fontSize: '18px', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {isMp3Playing ? '⏸' : '▶'}
                        </button>
                        <button 
                          onClick={() => handleTrackChange((currentTrackIndex + 1) % MUSIC_TRACKS.length)}
                          style={{ background: 'none', border: 'none', color: '#777', fontSize: '18px', cursor: 'pointer' }}
                        >
                          ⏭
                        </button>
                      </div>

                      {/* Volume Slider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '14px' }}>
                        <span style={{ fontSize: '10px' }}>🔈</span>
                        <input 
                          type="range" 
                          min={0} 
                          max={1} 
                          step={0.05} 
                          value={mp3Volume} 
                          onChange={handleVolumeChange} 
                          style={{ width: '80px', accentColor: '#D4AF37', height: '3px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '10px' }}>🔊</span>
                      </div>
                    </div>

                    {/* Sovereign FM Radio toggle */}
                    <div style={{ background: 'rgba(212,175,55,0.03)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 900, color: '#D4AF37', margin: '0 0 4px' }}>📻 Sovereign FM Radio</h4>
                        <p style={{ fontSize: '9px', color: '#666', margin: 0 }}>Tune into the active resort frequency (Singleton Player)</p>
                      </div>
                      <button 
                        onClick={() => {
                          pauseMp3();
                          toggleRadio();
                        }}
                        style={{
                          padding: '10px 18px', borderRadius: '8px', border: '1px solid',
                          fontSize: '11px', fontWeight: 900, cursor: 'pointer',
                          borderColor: radioActive ? '#FF3131' : '#D4AF37',
                          background: radioActive ? 'rgba(255,49,49,0.06)' : 'rgba(212,175,55,0.06)',
                          color: radioActive ? '#FF3131' : '#D4AF37',
                          transition: 'all 0.2s'
                        }}
                      >
                        {radioActive ? '📻 FM ACTIVE' : '📻 TUNE IN'}
                      </button>
                    </div>

                  </div>

                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
