"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { useRouter } from 'next/navigation';

const API_BASE = "/api";

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: #03080a;
    color: #e8f4f1;
    font-family: 'Outfit', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  input, select, textarea {
    font-family: 'Outfit', sans-serif;
  }
`;

const breathe = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.04); opacity: 1; }
`;
const rise = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(82,209,163,0.4); }
  50%       { box-shadow: 0 0 0 10px rgba(82,209,163,0); }
`;
const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
`;
const shimmer = keyframes`
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;
const ecgLine = keyframes`
  0%   { stroke-dashoffset: 800; }
  100% { stroke-dashoffset: 0; }
`;
const orbFloat = keyframes`
  0%, 100% { transform: translateY(0px) translateX(0px); }
  33%       { transform: translateY(-20px) translateX(10px); }
  66%       { transform: translateY(10px) translateX(-15px); }
`;

const Shell = styled.div`
  min-height: 100vh;
  background: #03080a;
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  padding-bottom: 100px;

  /* Ambient background orbs */
  &::before {
    content: '';
    position: fixed;
    top: -100px; left: -100px;
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(82,209,163,0.07) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    animation: ${orbFloat} 12s ease-in-out infinite;
    z-index: 0;
  }
  &::after {
    content: '';
    position: fixed;
    bottom: -80px; right: -80px;
    width: 280px; height: 280px;
    background: radial-gradient(circle, rgba(112,197,226,0.06) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    animation: ${orbFloat} 16s ease-in-out 4s infinite;
    z-index: 0;
  }
`;

// ── HERO HEADER ────────────────────────────────────────────
const HeroHeader = styled.div`
  position: relative;
  padding: 50px 24px 30px;
  background: linear-gradient(180deg, rgba(5,18,22,0.98) 0%, rgba(3,8,10,0) 100%);
  z-index: 10;

  .hospital-brand {
    font-size: 10px;
    letter-spacing: 2px;
    color: #52d1a3;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .patient-name {
    font-family: 'Lora', serif;
    font-size: 28px;
    font-weight: 600;
    color: #fff;
    line-height: 1.2;
    margin-bottom: 4px;
  }
  .bed-info {
    font-size: 13px;
    color: #7a9e96;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .logout-btn {
    position: absolute;
    top: 50px; right: 24px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    color: rgba(255,255,255,0.4);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { border-color: rgba(255,90,90,0.4); color: #FF5A5A; }
  }
`;

const ECGBar = styled.div`
  margin: 0 24px;
  height: 48px;
  position: relative;
  z-index: 10;
  svg {
    width: 100%;
    height: 48px;
    overflow: visible;
  }
  .ecg-path {
    stroke-dasharray: 800;
    stroke-dashoffset: 800;
    animation: ${ecgLine} 3s ease forwards, ${ecgLine} 4s ease 3s infinite;
  }
`;

// ── WELLBEING RING ──────────────────────────────────────────
const WellbeingRing = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 24px;
  padding: 20px;
  background: rgba(10,28,30,0.8);
  border: 1px solid rgba(82,209,163,0.15);
  border-radius: 24px;
  z-index: 10;
  position: relative;
  animation: ${rise} 0.5s ease;

  .ring-wrap {
    position: relative;
    width: 80px;
    height: 80px;
    flex-shrink: 0;
  }
  svg { transform: rotate(-90deg); }
  .ring-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .ring-score { font-size: 20px; font-weight: 800; color: #52d1a3; }
  .ring-label { font-size: 7px; color: #7a9e96; letter-spacing: 1px; text-transform: uppercase; }
  .wellness-right h3 { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 4px; }
  .wellness-right p  { font-size: 12px; color: #7a9e96; line-height: 1.5; margin: 0; }
`;

// ── VITALS STRIP ───────────────────────────────────────────
const VitalsStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 0 24px 24px;
  z-index: 10;
  position: relative;
`;

const VitalPill = styled.div<{ $color: string; $delay?: number }>`
  background: rgba(10,28,30,0.7);
  border: 1px solid ${p => p.$color}20;
  border-radius: 16px;
  padding: 14px 8px;
  text-align: center;
  animation: ${rise} 0.4s ease ${p => (p.$delay||0)*0.08}s both;

  .v-icon  { font-size: 18px; margin-bottom: 6px; }
  .v-value { font-size: 17px; font-weight: 800; color: #fff; line-height: 1; }
  .v-unit  { font-size: 9px; color: #7a9e96; margin-top: 2px; }
  .v-label { font-size: 8px; color: ${p => p.$color}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
`;

// ── TAB NAV ────────────────────────────────────────────────
const TabNav = styled.div`
  display: flex;
  gap: 6px;
  padding: 0 24px 20px;
  overflow-x: auto;
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(3,8,10,0.95);
  backdrop-filter: blur(20px);
  padding-top: 14px;
  &::-webkit-scrollbar { display: none; }
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 9px 16px;
  border-radius: 20px;
  border: 1px solid ${p => p.$active ? 'rgba(82,209,163,0.5)' : 'rgba(255,255,255,0.07)'};
  background: ${p => p.$active ? 'rgba(82,209,163,0.12)' : 'transparent'};
  color: ${p => p.$active ? '#52d1a3' : '#5a7a74'};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s;
  flex-shrink: 0;
`;

// ── SHARED SECTION COMPONENTS ──────────────────────────────
const Section = styled.div`
  padding: 0 24px;
  margin-bottom: 24px;
  position: relative;
  z-index: 10;
  animation: ${slideIn} 0.3s ease;
`;
const SLabel = styled.p`
  font-size: 10px;
  letter-spacing: 2px;
  color: #52d1a3;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0 0 14px;
`;
const Card = styled.div`
  background: rgba(10,28,30,0.75);
  border: 1px solid rgba(82,209,163,0.1);
  border-radius: 20px;
  padding: 20px;
  backdrop-filter: blur(20px);
`;

// ── MEDICAL RECORD CARD ────────────────────────────────────
const DiagCard = styled.div`
  background: linear-gradient(135deg, rgba(10,28,30,0.9), rgba(8,22,26,0.9));
  border: 1px solid rgba(82,209,163,0.15);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #52d1a3, #70c5e2);
    border-radius: 3px;
  }
  .consult-date { font-size: 10px; color: #52d1a3; font-weight: 600; letter-spacing: 1px; margin-bottom: 10px; }
  .diag-title { font-family: 'Lora', serif; font-size: 18px; color: #fff; margin-bottom: 8px; }
  .field-lbl { font-size: 9px; letter-spacing: 1.5px; color: #7a9e96; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
  .field-val { font-size: 13px; color: #c8e0d8; line-height: 1.5; margin-bottom: 14px; }
`;

// ── MEDICINE TIMELINE ──────────────────────────────────────
const MedCard = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(10,28,30,0.75);
  border: 1px solid rgba(82,209,163,0.1);
  border-radius: 16px;
  margin-bottom: 10px;

  .pill-icon {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, rgba(82,209,163,0.15), rgba(112,197,226,0.1));
    border: 1px solid rgba(82,209,163,0.25);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
    animation: ${breathe} 3s ease-in-out infinite;
  }
  .med-info { flex: 1; }
  .med-name { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 3px; }
  .med-dose { font-size: 12px; color: #7a9e96; }
  .times-col { text-align: right; }
  .time-tag {
    display: inline-block;
    padding: 3px 10px;
    background: rgba(82,209,163,0.12);
    border: 1px solid rgba(82,209,163,0.2);
    border-radius: 8px;
    font-size: 10px;
    font-weight: 700;
    color: #52d1a3;
    margin: 2px 0;
  }
`;

// ── DIET PLANNER ───────────────────────────────────────────
const MealCard = styled.div<{ $time: 'morning' | 'noon' | 'evening' | 'night' }>`
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 10px;
  background: ${p => ({
    morning: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(10,28,30,0.8))',
    noon: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(10,28,30,0.8))',
    evening: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(10,28,30,0.8))',
    night: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(10,28,30,0.8))',
  }[p.$time])};

  .meal-time { font-size: 10px; letter-spacing: 1.5px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;
    color: ${p => ({morning:'#fbbf24',noon:'#10b981',evening:'#f97316',night:'#818cf8'}[p.$time])};
  }
  .meal-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .meal-desc { font-size: 12px; color: #7a9e96; line-height: 1.5; }
  .meal-cals { margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.3); }
`;

// ── DOCTOR CARD ────────────────────────────────────────────
const DoctorCard = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: rgba(10,28,30,0.75);
  border: 1px solid rgba(82,209,163,0.1);
  border-radius: 18px;
  margin-bottom: 10px;

  .avatar {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #1a3a3a, #0d2a2a);
    border: 2px solid rgba(82,209,163,0.3);
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; flex-shrink: 0;
    animation: ${pulse} 3s ease infinite;
  }
  .doc-info { flex: 1; }
  .doc-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 2px; }
  .doc-spec { font-size: 11px; color: #52d1a3; margin-bottom: 4px; }
  .doc-avail { font-size: 10px; color: #7a9e96; }
  .book-btn {
    padding: 8px 14px;
    background: rgba(82,209,163,0.12);
    border: 1px solid rgba(82,209,163,0.3);
    border-radius: 10px;
    color: #52d1a3;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    &:active { transform: scale(0.95); }
  }
`;

// ── APT FORM ───────────────────────────────────────────────
const AptCard = styled.div`
  padding: 18px;
  background: rgba(10,28,30,0.75);
  border: 1px solid rgba(82,209,163,0.12);
  border-radius: 18px;
  margin-bottom: 12px;

  label { display: block; font-size: 9px; letter-spacing: 1.5px; color: #7a9e96; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
  input, select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(82,209,163,0.15);
    border-radius: 10px;
    padding: 12px 14px;
    color: #fff;
    font-size: 13px;
    outline: none;
    margin-bottom: 14px;
    &:focus { border-color: rgba(82,209,163,0.4); }
  }
`;

// ── VIDEO CONSULT ──────────────────────────────────────────
const VideoPanel = styled.div`
  .vp-pre {
    padding: 30px 20px;
    text-align: center;
    h3 { font-family: 'Lora', serif; font-size: 22px; color: #fff; margin-bottom: 10px; }
    p { font-size: 13px; color: #7a9e96; line-height: 1.6; margin-bottom: 24px; }
  }
  .doc-row {
    display: flex; gap: 10px; margin-bottom: 16px;
    overflow-x: auto; padding-bottom: 4px;
    &::-webkit-scrollbar { display: none; }
  }
  .doc-chip {
    padding: 10px 16px;
    background: rgba(10,28,30,0.8);
    border: 1px solid rgba(82,209,163,0.2);
    border-radius: 14px;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    .dc-name { font-size: 13px; font-weight: 700; color: #fff; }
    .dc-spec { font-size: 10px; color: #52d1a3; margin-top: 2px; }
    &:hover { border-color: #52d1a3; background: rgba(82,209,163,0.08); }
  }
  .start-btn {
    width: 100%;
    padding: 18px;
    background: linear-gradient(135deg, #52d1a3, #40ab85);
    border: none;
    border-radius: 16px;
    color: #041417;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: transform 0.2s;
    &:active { transform: scale(0.97); }
  }
  .live-box {
    width: 100%;
    height: 240px;
    background: #070f10;
    border-radius: 20px;
    border: 1px solid rgba(82,209,163,0.3);
    position: relative;
    overflow: hidden;
    margin-bottom: 14px;
    .live-overlay {
      position: absolute; top: 0; inset-x: 0;
      padding: 12px 16px;
      display: flex; justify-content: space-between; align-items: center;
      background: linear-gradient(180deg, rgba(0,0,0,0.6), transparent);
    }
    .live-badge {
      padding: 4px 10px;
      background: rgba(255,90,90,0.85);
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      color: #fff;
      letter-spacing: 1px;
    }
    .duration { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 600; }
    .doctor-feed {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: #52d1a3; font-size: 60px;
    }
    .local-bubble {
      position: absolute;
      bottom: 12px; right: 12px;
      width: 80px; height: 100px;
      background: rgba(20,40,40,0.9);
      border: 1.5px solid #52d1a3;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; color: #fff;
    }
  }
  .call-controls {
    display: flex; gap: 12px;
    button {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: 0.2s;
      &:active { transform: scale(0.95); }
    }
    .mute-btn { background: rgba(255,255,255,0.07); color: #fff; }
    .end-btn   { background: #FF5A5A; color: #fff; }
  }
`;

// ── NOTIF ITEM ─────────────────────────────────────────────
const NotifItem = styled.div<{ $type: 'info' | 'med' | 'doc' | 'lab' }>`
  display: flex;
  gap: 14px;
  padding: 14px;
  background: rgba(10,28,30,0.65);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  margin-bottom: 8px;
  animation: ${rise} 0.3s ease;

  .n-dot {
    width: 36px; height: 36px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 17px;
    flex-shrink: 0;
    background: ${p => ({info:'rgba(82,209,163,0.12)',med:'rgba(249,115,22,0.12)',doc:'rgba(112,197,226,0.12)',lab:'rgba(167,139,250,0.12)'}[p.$type])};
    border: 1px solid ${p => ({info:'rgba(82,209,163,0.25)',med:'rgba(249,115,22,0.25)',doc:'rgba(112,197,226,0.25)',lab:'rgba(167,139,250,0.25)'}[p.$type])};
  }
  .n-title { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 3px; }
  .n-body  { font-size: 12px; color: #7a9e96; line-height: 1.4; }
  .n-time  { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 6px; }
`;

// ── ACTION CTA ─────────────────────────────────────────────
const CtaButton = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #52d1a3, #3ab885);
  border: none;
  border-radius: 14px;
  color: #041417;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.3px;
  cursor: pointer;
  margin-top: 12px;
  transition: transform 0.2s;
  &:active { transform: scale(0.97); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// ── BOTTOM NAV ─────────────────────────────────────────────
const BottomNav = styled.nav`
  position: fixed;
  bottom: 0; inset-x: 0;
  max-width: 480px;
  margin: 0 auto;
  background: rgba(5,14,17,0.95);
  backdrop-filter: blur(30px);
  border-top: 1px solid rgba(82,209,163,0.12);
  display: flex;
  padding: 8px 0;
  z-index: 50;
`;

const NavItem = styled.button<{ $active: boolean }>`
  flex: 1;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  .nav-icon { font-size: 20px; }
  .nav-lbl {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: ${p => p.$active ? '#52d1a3' : '#3a5550'};
    transition: color 0.2s;
  }
`;

// ── PROGRESS TRACKER ───────────────────────────────────────
const ProgressBar = styled.div<{ $pct: number }>`
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 6px;
  &::after {
    content: '';
    display: block;
    width: ${p => p.$pct}%;
    height: 100%;
    background: linear-gradient(90deg, #52d1a3, #70c5e2);
    border-radius: 6px;
    transition: width 1s ease;
  }
`;

// ── DATA ────────────────────────────────────────────────────
// const doctorsList = [
//   { id: 'DOC-001', name: 'Dr. Yasmine Al-Rashidi', spec: 'Cardiology & Internal Medicine', avail: 'Available · Today 2:00 PM', icon: '👩‍⚕️' },
//   { id: 'DOC-002', name: 'Dr. Ethan Morrow',       spec: 'Neurology & Sleep Medicine',    avail: 'Available · Tomorrow 10:00 AM', icon: '👨‍⚕️' },
//   { id: 'DOC-003', name: 'Dr. Priya Kamath',       spec: 'Family Medicine & OPD',         avail: 'Available · Today 5:00 PM', icon: '👩‍⚕️' },
// ];

const NOTIFICATIONS = [
  { type: 'med' as const, icon: '💊', title: 'Medicine Time Reminder', body: 'Metformin 500mg is due at 8:00 PM. Please take with food.', time: '2 hours ago' },
  { type: 'doc' as const, icon: '🩺', title: 'Dr. Yasmine left a note', body: '"Continue rest. Vitals are trending excellently. Proud of your progress."', time: '4 hours ago' },
  { type: 'lab' as const, icon: '🔬', title: 'Lab Result Published', body: 'Your HbA1c diagnostic panel results are now available for review.', time: 'Yesterday' },
  { type: 'info' as const, icon: '🌿', title: 'Dietary Update', body: 'Your diet plan has been updated by the clinical nutritionist. Review your new meal plan.', time: 'Yesterday' },
];

function getMedTimes(freq: string): string[] {
  const f = (freq || '').toUpperCase();
  if (f.includes('TID') || f.includes('THRICE') || f.includes('3')) return ['08:00 AM', '02:00 PM', '08:00 PM'];
  if (f.includes('BID') || f.includes('TWICE') || f.includes('2'))  return ['08:00 AM', '08:00 PM'];
  if (f.includes('QID') || f.includes('FOUR') || f.includes('4'))   return ['06:00 AM', '12:00 PM', '06:00 PM', '12:00 AM'];
  return ['08:00 AM'];
}

function getDietPlan(consults: any[]) {
  const diag = consults[0]?.diagnosis_icd10?.toUpperCase() || '';
  if (diag.includes('DIAB') || diag.includes('SUGAR') || diag.includes('E11')) return {
    label: 'Therapeutic Diabetic Meal Plan',
    sub: 'Prescribed by Dr. Yasmine · Low Glycaemic Index',
    meals: [
      { time: 'morning' as const, label: '🌅 Breakfast · 07:30 AM',  name: 'Steel-cut oats with cinnamon & walnut', desc: 'Slow-release carbohydrate base. Almond milk. No added sugar.', cals: '280 kcal' },
      { time: 'noon'    as const, label: '☀️ Lunch · 12:30 PM',     name: 'Grilled lemon chicken with brown rice', desc: 'High lean protein, steamed broccoli & asparagus, zero salt.', cals: '480 kcal' },
      { time: 'evening' as const, label: '🌇 Snack · 05:00 PM',     name: 'Mixed seeds with unsweetened yoghurt',  desc: 'Probiotic-enriched. Chia seeds, flaxseed, cucumber slices.', cals: '140 kcal' },
      { time: 'night'   as const, label: '🌙 Dinner · 07:30 PM',    name: 'Baked salmon with roasted vegetables',  desc: 'Omega-3 rich. Sweet potato & green beans. Light herbal broth.', cals: '400 kcal' },
    ]
  };
  if (diag.includes('HYPERT') || diag.includes('CARDIAC') || diag.includes('I10')) return {
    label: 'Cardiovascular Low-Sodium Diet',
    sub: 'Prescribed by Dr. Yasmine · DASH Protocol',
    meals: [
      { time: 'morning' as const, label: '🌅 Breakfast · 07:30 AM', name: 'Whole grain toast with avocado & eggs', desc: 'Low sodium. Heart-healthy fats. Orange slices.', cals: '310 kcal' },
      { time: 'noon'    as const, label: '☀️ Lunch · 12:30 PM',    name: 'Grilled fish tacos with salsa verde',    desc: 'Zero added salt. High potassium. Leafy green salad.', cals: '420 kcal' },
      { time: 'evening' as const, label: '🌇 Snack · 05:00 PM',    name: 'Handful of unsalted almonds & berries',  desc: 'Antioxidant-rich. Magnesium and Potassium dense.', cals: '160 kcal' },
      { time: 'night'   as const, label: '🌙 Dinner · 07:30 PM',   name: 'Herb-roasted chicken with quinoa',       desc: 'Anti-inflammatory herbs. Garlic, turmeric, olive oil.', cals: '380 kcal' },
    ]
  };
  return {
    label: 'Clinical Recovery Nutrition Plan',
    sub: 'Prescribed by Clinical Dietitian · Healing Protocol',
    meals: [
      { time: 'morning' as const, label: '🌅 Breakfast · 07:30 AM', name: 'Warm oatmeal with honey & banana',      desc: 'Easy digestion. Energy-restoring. Chamomile herbal tea.', cals: '300 kcal' },
      { time: 'noon'    as const, label: '☀️ Lunch · 12:30 PM',    name: 'Chicken broth soup with soft vegetables', desc: 'Collagen-rich healing broth. Soft carrots & peas.', cals: '360 kcal' },
      { time: 'evening' as const, label: '🌇 Snack · 05:00 PM',    name: 'Fresh fruit platter with mint water',     desc: 'Vitamin C loaded. Papaya, guava, watermelon.', cals: '130 kcal' },
      { time: 'night'   as const, label: '🌙 Dinner · 07:30 PM',   name: 'Soft steamed fish with mashed potato',   desc: 'Light & digestible. Clinical nutrition supplement shake.', cals: '390 kcal' },
    ]
  };
}

// ── WRISTBAND COMPONENTS ────────────────────────────────────
const sosPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,50,50,0.7); }
  50%       { box-shadow: 0 0 0 18px rgba(255,50,50,0); }
`;

const WristbandBand = styled.div<{ $connected: boolean; $alertSent: boolean }>`
  margin: 0 24px 20px;
  padding: 16px 20px;
  background: ${p => p.$alertSent
    ? 'rgba(40,5,5,0.9)'
    : p.$connected ? 'rgba(5,24,20,0.8)' : 'rgba(14,20,24,0.6)'};
  border: 1px solid ${p => p.$alertSent
    ? 'rgba(255,50,50,0.5)'
    : p.$connected ? 'rgba(82,209,163,0.3)' : 'rgba(255,255,255,0.07)'};
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 10;
  animation: ${rise} 0.4s ease;

  .wb-icon {
    font-size: 28px;
    animation: ${p => p.$alertSent ? `${sosPulse} 1s ease infinite` : 'none'};
  }
  .wb-info { flex: 1; }
  .wb-title { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 3px; }
  .wb-status {
    font-size: 10px; font-weight: 700; letter-spacing: 1px;
    color: ${p => p.$alertSent ? '#FF5A5A' : p.$connected ? '#52d1a3' : '#7a9e96'};
  }
  .wb-battery { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }
  .sos-btn {
    padding: 10px 16px;
    background: ${p => p.$alertSent ? 'rgba(255,50,50,0.25)' : 'rgba(255,50,50,0.12)'};
    border: 1.5px solid ${p => p.$alertSent ? '#FF3232' : 'rgba(255,50,50,0.4)'};
    border-radius: 12px;
    color: #FF5A5A;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.2s;
    animation: ${p => p.$alertSent ? `${sosPulse} 1.2s ease infinite` : 'none'};
    &:active { transform: scale(0.94); }
  }
`;

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PatientSanctuary() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'home'|'records'|'meds'|'diet'|'appt'|'video'|'notify'>('home');

  const [vitals, setVitals]   = useState<any>(null);
  const [consults, setConsults] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);

  // Wristband state
  const [wbConnected,  setWbConnected]  = useState(false);
  const [wbAlertSent,  setWbAlertSent]  = useState(false);
  const [wbDeviceId,   setWbDeviceId]   = useState('');
  const [wbBattery,    setWbBattery]    = useState(94);

  // Appointment form
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [aptDoc,   setAptDoc]   = useState('');
  const [aptTime,  setAptTime]  = useState('');
  const [aptNotes, setAptNotes] = useState('');
  const [aptSaved, setAptSaved] = useState(false);

  // Video call
  const [selectedDoc, setSelectedDoc] = useState(0);
  const [callActive,  setCallActive]  = useState(false);
  const [callSecs,    setCallSecs]    = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Session Load ───────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('SOV_GUEST_SESSION');
      if (!raw || raw === 'undefined') { router.replace('/guest'); return; }
      const parsed = JSON.parse(raw);
      setSession(parsed);
      setLoading(false);
    } catch { router.replace('/guest'); }
  }, [router]);

  // ── API Fetch ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const ref = session.id || session.full_name || session.room_number;

    fetch(`${API_BASE}/hms/vitals/${ref}`)
      .then(r => r.json())
      .then(j => { if (j.status === 'SUCCESS' && j.data.length > 0) setVitals(j.data[0]); })
      .catch(() => {});

    fetch(`${API_BASE}/hms/consultations/${ref}`)
      .then(r => r.json())
      .then(j => { if (j.status === 'SUCCESS') setConsults(j.data); })
      .catch(() => {});

    fetch(`${API_BASE}/hms/lab-orders`)
      .then(r => r.json())
      .then(j => {
        if (j.status === 'SUCCESS') {
          setLabOrders(j.data.filter((o: any) =>
            o.patient_name?.toLowerCase().includes((session.full_name || '').toLowerCase())
          ));
        }
      })
      .catch(() => {});
  }, [session]);

  // ── Wristband Registration ────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const deviceId = `WB-${session.room_number || 'OPD'}-${session.id || 1}`;
    setWbDeviceId(deviceId);
    // Register wristband device with the backend
    fetch(`${API_BASE}/emergency/devices/register?device_id=${encodeURIComponent(deviceId)}&patient_name=${encodeURIComponent(session.full_name || 'Patient')}&bed_number=${encodeURIComponent(session.room_number || 'OPD')}&patient_id=${session.id || ''}`, {
      method: 'POST'
    })
    .then(() => setWbConnected(true))
    .catch(() => setWbConnected(false));
  }, [session]);

  // ── SOS Emergency Trigger ─────────────────────────────────
  const triggerSOS = useCallback(async () => {
    if (!wbDeviceId || wbAlertSent) return;
    try {
      await fetch(`${API_BASE}/emergency/vitals/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: wbDeviceId,
          heart_rate: 38,
          spo2: 86,
          blood_pressure: '70/45',
          temperature: vitals?.temperature || 37.0
        })
      });
      setWbAlertSent(true);
    } catch {}
  }, [wbDeviceId, wbAlertSent, vitals]);

  // ── Call Timer ─────────────────────────────────────────────
  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => setCallSecs(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallSecs(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callActive]);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // ── Booking ────────────────────────────────────────────────
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aptTime) return;
    try {
      const res = await fetch(`${API_BASE}/hms/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: session.id, doctor_id: aptDoc, appointment_time: aptTime, notes: aptNotes })
      });
      if (res.ok) { setAptSaved(true); setAptTime(''); setAptNotes(''); }
    } catch {}
  };

  const dietPlan = getDietPlan(consults);
  const allPrescriptions = consults.flatMap((c: any) =>
    (c.prescriptions || []).map((p: any) => ({ ...p, consultDate: c.created_at?.split('T')[0] }))
  );

  // wellness score calculation (basic from vitals)
  const wellnessScore = vitals
    ? Math.min(100, 60 + (vitals.spo2 ? Math.min(15, vitals.spo2 - 85) : 0)
        + (vitals.heart_rate && vitals.heart_rate < 100 ? 10 : 0)
        + (vitals.temperature && vitals.temperature < 37.5 ? 10 : 0)
        + (vitals.blood_pressure ? 5 : 0))
    : 78;

  if (loading) return (
    <Shell>
      <GlobalStyle />
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 40 }}>🏥</div>
        <p style={{ color: '#52d1a3', fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>Preparing your health sanctuary…</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <GlobalStyle />

      {/* ── HERO ─────────────────────────────────────────── */}
      <HeroHeader>
        <div className="hospital-brand">🏥 Miracle General Hospital</div>
        <div className="patient-name">Hello, {session?.full_name?.split(' ')[0]} 🌿</div>
        <div className="bed-info">
          <span>📍 {session?.room_number || 'OPD Lounge'}</span>
          <span>·</span>
          <span>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span>
        </div>
        <button className="logout-btn" onClick={() => {
          localStorage.removeItem('SOV_GUEST_SESSION');
          localStorage.removeItem('SOV_GUEST_TOKEN');
          router.replace('/guest');
        }}>Sign Out</button>
      </HeroHeader>

      {/* ── ANIMATED ECG ──────────────────────────────────── */}
      <ECGBar>
        <svg viewBox="0 0 400 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path className="ecg-path" d="M0,24 L60,24 L70,24 L80,8 L90,40 L100,4 L110,44 L120,24 L160,24 L170,24 L180,14 L190,34 L200,24 L260,24 L270,10 L280,38 L290,6 L300,42 L310,24 L400,24"
            stroke="rgba(82,209,163,0.6)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </ECGBar>

      {/* ── WELLBEING RING ────────────────────────────────── */}
      <WellbeingRing>
        <div className="ring-wrap">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="40" cy="40" r="30" fill="none" stroke="url(#rg)" strokeWidth="6"
              strokeDasharray={`${2*Math.PI*30 * wellnessScore/100} ${2*Math.PI*30}`}
              strokeLinecap="round" />
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#52d1a3" />
                <stop offset="100%" stopColor="#70c5e2" />
              </linearGradient>
            </defs>
          </svg>
          <div className="ring-text">
            <div className="ring-score">{wellnessScore}</div>
            <div className="ring-label">HEALTH</div>
          </div>
        </div>
        <div className="wellness-right">
          <h3>Recovery on Track 🌱</h3>
          <p>Your vitals are stable and your care team is monitoring you closely. You are in safe hands.</p>
        </div>
      </WellbeingRing>

      {/* ── VITALS ───────────────────────────────────────── */}
      <VitalsStrip>
        <VitalPill $color="#52d1a3" $delay={0}>
          <div className="v-icon">❤️</div>
          <div className="v-value">{vitals?.heart_rate || '--'}</div>
          <div className="v-unit">bpm</div>
          <div className="v-label">Pulse</div>
        </VitalPill>
        <VitalPill $color="#70c5e2" $delay={1}>
          <div className="v-icon">🩺</div>
          <div className="v-value">{vitals?.blood_pressure || '--'}</div>
          <div className="v-unit">mmHg</div>
          <div className="v-label">BP</div>
        </VitalPill>
        <VitalPill $color="#fbbf24" $delay={2}>
          <div className="v-icon">🌡️</div>
          <div className="v-value">{vitals?.temperature || '--'}</div>
          <div className="v-unit">°C</div>
          <div className="v-label">Temp</div>
        </VitalPill>
        <VitalPill $color="#c4b5fd" $delay={3}>
          <div className="v-icon">💨</div>
          <div className="v-value">{vitals?.spo2 || '--'}</div>
          <div className="v-unit">%</div>
          <div className="v-label">SpO2</div>
        </VitalPill>
      </VitalsStrip>

      {/* ── WRISTBAND BAND ────────────────────────────────── */}
      <WristbandBand $connected={wbConnected} $alertSent={wbAlertSent}>
        <div className="wb-icon">{wbAlertSent ? '🚨' : wbConnected ? '⌚' : '📡'}</div>
        <div className="wb-info">
          <div className="wb-title">Smart Wristband Monitor</div>
          <div className="wb-status">
            {wbAlertSent ? '🔴 EMERGENCY ALERT SENT TO HOSPITAL' : wbConnected ? '🟢 Connected · Monitoring Active' : '⚫ Connecting to ward network…'}
          </div>
          {wbConnected && <div className="wb-battery">🔋 Battery {wbBattery}% · Device: {wbDeviceId}</div>}
        </div>
        <button
          className="sos-btn"
          onClick={triggerSOS}
          disabled={wbAlertSent}
        >
          {wbAlertSent ? '✓ SENT' : 'SOS 🆘'}
        </button>
      </WristbandBand>

      {/* ── TAB NAV ──────────────────────────────────────── */}
      <TabNav>
        <Tab $active={tab==='home'}   onClick={() => setTab('home')}>🏠 Home</Tab>
        <Tab $active={tab==='records'}onClick={() => setTab('records')}>📋 Records</Tab>
        <Tab $active={tab==='meds'}   onClick={() => setTab('meds')}>💊 Medicines</Tab>
        <Tab $active={tab==='diet'}   onClick={() => setTab('diet')}>🍎 Diet</Tab>
        <Tab $active={tab==='appt'}   onClick={() => setTab('appt')}>📅 Appointments</Tab>
        <Tab $active={tab==='video'}  onClick={() => setTab('video')}>📹 Video</Tab>
        <Tab $active={tab==='notify'} onClick={() => setTab('notify')}>🔔 Alerts</Tab>
      </TabNav>

      {/* ══════════════════════════════════════════════════════
          HOME TAB
      ══════════════════════════════════════════════════════ */}
      {tab === 'home' && (
        <div>
          {/* Recovery Progress */}
          <Section>
            <SLabel>Recovery Progress</SLabel>
            <Card>
              <div style={{ fontSize: 13, color: '#7a9e96', marginBottom: 10 }}>Your care team has marked the following milestones:</div>
              {[
                { label: 'Vitals Stabilised', pct: 100, done: true },
                { label: 'Initial Diagnostics', pct: 100, done: true },
                { label: 'Active Treatment Phase', pct: 75, done: false },
                { label: 'Recovery & Discharge Prep', pct: 20, done: false },
              ].map((m, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: m.done ? '#52d1a3' : '#e8f4f1', fontWeight: 600 }}>{m.done ? '✓ ' : ''}{m.label}</span>
                    <span style={{ color: '#7a9e96' }}>{m.pct}%</span>
                  </div>
                  <ProgressBar $pct={m.pct} />
                </div>
              ))}
            </Card>
          </Section>

          {/* Care Team */}
          <Section>
            <SLabel>Your Care Team</SLabel>
            {doctorsList.map((doc, i) => (
              <DoctorCard key={i}>
                <div className="avatar">{doc.icon}</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-spec">{doc.spec}</div>
                  <div className="doc-avail">🟢 {doc.avail}</div>
                </div>
                <button className="book-btn" onClick={() => setTab('appt')}>Book</button>
              </DoctorCard>
            ))}
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MEDICAL RECORDS
      ══════════════════════════════════════════════════════ */}
      {tab === 'records' && (
        <div>
          <Section>
            <SLabel>Clinical Consultation History</SLabel>
            {consults.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#7a9e96' }}>No consultation records available yet.</p></Card>
            ) : consults.map((c, i) => (
              <DiagCard key={i}>
                <div className="consult-date">🗓 {c.created_at?.split('T')[0]} · {c.doctor_id}</div>
                <div className="diag-title">{c.diagnosis_icd10 || 'Clinical Evaluation'}</div>
                {c.symptoms    && <><div className="field-lbl">Presenting Symptoms</div><div className="field-val">{c.symptoms}</div></>}
                {c.examination && <><div className="field-lbl">Clinical Findings</div><div className="field-val">{c.examination}</div></>}
                {c.treatment_plan && <><div className="field-lbl">Doctor's Plan & Suggestions</div><div className="field-val">{c.treatment_plan}</div></>}
              </DiagCard>
            ))}
          </Section>

          <Section>
            <SLabel>Laboratory & Pathology Reports</SLabel>
            {labOrders.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#7a9e96' }}>No lab diagnostics ordered.</p></Card>
            ) : labOrders.map((o, i) => (
              <Card key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{o.test_name}</span>
                  <span style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(82,209,163,0.12)', border: '1px solid rgba(82,209,163,0.25)', borderRadius: 6, color: '#52d1a3', fontWeight: 700 }}>{o.status}</span>
                </div>
                {o.result_text && (
                  <div style={{ background: 'rgba(82,209,163,0.04)', border: '1px solid rgba(82,209,163,0.08)', borderRadius: 10, padding: 12, fontSize: 12, color: '#a8c4bc', lineHeight: 1.5 }}>
                    <span style={{ color: '#52d1a3', fontWeight: 700 }}>Finding: </span>{o.result_text}
                  </div>
                )}
              </Card>
            ))}
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MEDICINES
      ══════════════════════════════════════════════════════ */}
      {tab === 'meds' && (
        <Section>
          <SLabel>Active Prescription Schedule</SLabel>
          {allPrescriptions.length === 0 ? (
            <Card><p style={{ fontSize: 13, color: '#7a9e96' }}>No active prescriptions logged.</p></Card>
          ) : allPrescriptions.map((p, i) => {
            const times = getMedTimes(p.frequency);
            return (
              <MedCard key={i}>
                <div className="pill-icon">💊</div>
                <div className="med-info">
                  <div className="med-name">{p.drug_name}</div>
                  <div className="med-dose">{p.dosage} · {p.duration_days} days · {p.status}</div>
                </div>
                <div className="times-col">
                  {times.map((t, j) => <div key={j} className="time-tag">{t}</div>)}
                </div>
              </MedCard>
            );
          })}
          <div style={{ background: 'rgba(82,209,163,0.06)', border: '1px solid rgba(82,209,163,0.12)', borderRadius: 14, padding: 14, marginTop: 6 }}>
            <p style={{ fontSize: 12, color: '#7a9e96', margin: 0, lineHeight: 1.6 }}>
              💡 <strong style={{ color: '#52d1a3' }}>Care Tip:</strong> Always take your medicines with room-temperature water. Never skip a dose without consulting your doctor.
            </p>
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════════════════════
          DIET
      ══════════════════════════════════════════════════════ */}
      {tab === 'diet' && (
        <Section>
          <SLabel>Personalised Clinical Diet Plan</SLabel>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{dietPlan.label}</div>
            <div style={{ fontSize: 11, color: '#52d1a3', marginBottom: 10 }}>{dietPlan.sub}</div>
            <div style={{ fontSize: 12, color: '#7a9e96', lineHeight: 1.5 }}>
              This plan is dynamically prescribed based on your clinical diagnosis and adjusted for your recovery phase. Follow it strictly for optimal healing.
            </div>
          </Card>
          {dietPlan.meals.map((m, i) => (
            <MealCard key={i} $time={m.time}>
              <div className="meal-time">{m.label}</div>
              <div className="meal-name">{m.name}</div>
              <div className="meal-desc">{m.desc}</div>
              <div className="meal-cals">⚡ {m.cals}</div>
            </MealCard>
          ))}
          <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)', borderRadius: 14, padding: 14, marginTop: 6 }}>
            <p style={{ fontSize: 12, color: '#7a9e96', margin: 0, lineHeight: 1.6 }}>
              🌿 <strong style={{ color: '#fbbf24' }}>Hydration:</strong> Drink 2.5–3 litres of water daily. Herbal teas are encouraged. Avoid sugary beverages.
            </p>
          </div>
        </Section>
      )}

      {/* ══════════════════════════════════════════════════════
          APPOINTMENTS
      ══════════════════════════════════════════════════════ */}
      {tab === 'appt' && (
        <div>
          <Section>
            <SLabel>Schedule a Doctor Appointment</SLabel>
            <AptCard>
              <form onSubmit={handleBook}>
                <label>Select Doctor</label>
                <select value={aptDoc} onChange={e => setAptDoc(e.target.value)}>
                  {doctorsList.map(d => <option key={d.id} value={d.id}>{d.name} — {d.spec}</option>)}
                </select>

                <label>Preferred Date & Time</label>
                <input type="datetime-local" value={aptTime} onChange={e => setAptTime(e.target.value)} required />

                <label>Reason / Symptoms</label>
                <input type="text" value={aptNotes} onChange={e => setAptNotes(e.target.value)} placeholder="Briefly describe your concern…" />

                <CtaButton type="submit">Confirm Appointment</CtaButton>
              </form>
              {aptSaved && (
                <div style={{ marginTop: 14, padding: 12, background: 'rgba(82,209,163,0.1)', border: '1px solid rgba(82,209,163,0.25)', borderRadius: 10, fontSize: 13, color: '#52d1a3', fontWeight: 600 }}>
                  ✅ Appointment confirmed. Your care team will send a reminder.
                </div>
              )}
            </AptCard>
          </Section>

          <Section>
            <SLabel>Your Care Team</SLabel>
            {doctorsList.map((doc, i) => (
              <DoctorCard key={i}>
                <div className="avatar">{doc.icon}</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-spec">{doc.spec}</div>
                  <div className="doc-avail">🟢 {doc.avail}</div>
                </div>
                <button className="book-btn" onClick={() => { setAptDoc(doc.id); }}>Select</button>
              </DoctorCard>
            ))}
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          VIDEO CONSULT
      ══════════════════════════════════════════════════════ */}
      {tab === 'video' && (
        <Section>
          <SLabel>Tele-Health Video Consultation</SLabel>
          <VideoPanel>
            {!callActive ? (
              <Card className="vp-pre">
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>{doctorsList[selectedDoc]?.icon || '🩺'}</div>
                  <h3 style={{ fontFamily: "'Lora', serif", fontSize: 20, color: '#fff', margin: '0 0 6px' }}>{doctorsList[selectedDoc]?.name || 'Available Doctor'}</h3>
                  <p style={{ fontSize: 12, color: '#52d1a3', margin: '0 0 20px' }}>{doctorsList[selectedDoc]?.spec || 'General Physician'}</p>
                  <p style={{ fontSize: 13, color: '#7a9e96', lineHeight: 1.6, margin: '0 0 24px' }}>
                    Start a secure, encrypted video consultation with your assigned physician from the comfort of your bed.
                  </p>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <SLabel>Choose Doctor</SLabel>
                  <div className="doc-row">
                    {doctorsList.map((d, i) => (
                      <div key={i} className="doc-chip" style={{ borderColor: selectedDoc === i ? '#52d1a3' : undefined, background: selectedDoc === i ? 'rgba(82,209,163,0.12)' : undefined }}
                        onClick={() => setSelectedDoc(i)}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{d.icon}</div>
                        <div className="dc-name">{d.name.split(' ')[0]} {d.name.split(' ')[1]}</div>
                        <div className="dc-spec">{d.spec.split(' ')[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="start-btn" onClick={() => setCallActive(true)}>
                  📹 Start Video Consultation
                </button>
              </Card>
            ) : (
              <Card>
                <div className="live-box">
                  <div className="doctor-feed">
                    {doctorsList[selectedDoc]?.icon || '🩺'}
                    <div style={{ fontSize: 12, color: '#52d1a3', marginTop: 8, fontWeight: 600 }}>Connecting securely…</div>
                  </div>
                  <div className="live-overlay">
                    <div className="live-badge">🔴 LIVE</div>
                    <div className="duration">{fmtTime(callSecs)}</div>
                  </div>
                  <div className="local-bubble">👤</div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{doctorsList[selectedDoc]?.name || 'Available Doctor'}</div>
                  <div style={{ fontSize: 11, color: '#52d1a3' }}>{doctorsList[selectedDoc]?.spec || 'General Physician'}</div>
                </div>
                <div className="call-controls">
                  <button className="mute-btn">🔇 Mute</button>
                  <button className="mute-btn">📷 Camera</button>
                  <button className="end-btn" onClick={() => setCallActive(false)}>📵 End Call</button>
                </div>
              </Card>
            )}
          </VideoPanel>
        </Section>
      )}

      {/* ══════════════════════════════════════════════════════
          NOTIFICATIONS
      ══════════════════════════════════════════════════════ */}
      {tab === 'notify' && (
        <Section>
          <SLabel>Notifications & Care Alerts</SLabel>
          {NOTIFICATIONS.map((n, i) => (
            <NotifItem key={i} $type={n.type}>
              <div className="n-dot">{n.icon}</div>
              <div>
                <div className="n-title">{n.title}</div>
                <div className="n-body">{n.body}</div>
                <div className="n-time">{n.time}</div>
              </div>
            </NotifItem>
          ))}
          {labOrders.filter(o => o.status === 'REPORTED').map((o, i) => (
            <NotifItem key={'lab-'+i} $type="lab">
              <div className="n-dot">🔬</div>
              <div>
                <div className="n-title">Lab Result: {o.test_name}</div>
                <div className="n-body">{o.result_text || 'Your result has been published. View in Records.'}</div>
                <div className="n-time">Today</div>
              </div>
            </NotifItem>
          ))}
        </Section>
      )}

      {/* ── BOTTOM NAV ───────────────────────────────────── */}
      <BottomNav>
        <NavItem $active={tab==='home'}   onClick={() => setTab('home')}>  <span className="nav-icon">🏠</span><span className="nav-lbl">Home</span></NavItem>
        <NavItem $active={tab==='records'}onClick={() => setTab('records')}><span className="nav-icon">📋</span><span className="nav-lbl">Records</span></NavItem>
        <NavItem $active={tab==='meds'}   onClick={() => setTab('meds')}>  <span className="nav-icon">💊</span><span className="nav-lbl">Meds</span></NavItem>
        <NavItem $active={tab==='diet'}   onClick={() => setTab('diet')}>  <span className="nav-icon">🍎</span><span className="nav-lbl">Diet</span></NavItem>
        <NavItem $active={tab==='video'}  onClick={() => setTab('video')}> <span className="nav-icon">📹</span><span className="nav-lbl">Video</span></NavItem>
      </BottomNav>

    </Shell>
  );
}
