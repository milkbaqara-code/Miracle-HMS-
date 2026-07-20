"use client";
import React, { useState } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { useRouter } from 'next/navigation';

const LOCAL_API_BASE = "/api";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background: #041417;
    color: #f4f9f7;
    font-family: 'Outfit', sans-serif;
  }
`;

const pulseSage = keyframes`
  0%   { box-shadow: 0 0 0 3px rgba(82, 209, 163, 0.08), 0 0 16px rgba(82, 209, 163, 0.15); }
  50%  { box-shadow: 0 0 0 4px rgba(82, 209, 163, 0.15), 0 0 30px rgba(82, 209, 163, 0.25); }
  100% { box-shadow: 0 0 0 3px rgba(82, 209, 163, 0.08), 0 0 16px rgba(82, 209, 163, 0.15); }
`;

const breatheSage = keyframes`
  0%   { box-shadow: 0 0 20px rgba(82, 209, 163, 0.3), 0 0 40px rgba(82, 209, 163, 0.15); transform: scale(1); }
  50%  { box-shadow: 0 0 40px rgba(82, 209, 163, 0.6), 0 0 80px rgba(82, 209, 163, 0.3), 0 0 120px rgba(82, 209, 163, 0.08); transform: scale(1.05); }
  100% { box-shadow: 0 0 20px rgba(82, 209, 163, 0.3), 0 0 40px rgba(82, 209, 163, 0.15); transform: scale(1); }
`;

const nebulaFlow = keyframes`
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const UnifiedCanvas = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100vw;
  background: #020b0c;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      linear-gradient(-45deg, #020b0c, #041417, #062227, #020b0c);
    background-size: 400% 400%;
    animation: ${nebulaFlow} 15s ease infinite;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 15% 15%, rgba(82,209,163,0.06), transparent 55%),
      radial-gradient(ellipse at 85% 85%, rgba(112,197,226,0.05), transparent 55%);
    pointer-events: none;
  }
`;

const LuxuryPanel = styled.div`
  background: rgba(4, 20, 23, 0.85);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(82, 209, 163, 0.15);
  border-radius: 30px;
  padding: clamp(36px,8vw,54px) clamp(28px,7vw,44px);
  width: min(90%, 420px);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02),
    0 40px 80px rgba(0,0,0,0.8),
    0 0 50px rgba(82, 209, 163, 0.02);
  z-index: 10;
  text-align: center;
  animation: ${fadeIn} 0.5s cubic-bezier(0.16,1,0.3,1);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(82,209,163,0.3), transparent);
    border-radius: 1px;
  }
`;

const Logo = styled.div`
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #52d1a3 0%, #40ab85 50%, #2f7e62 100%);
  color: #041417;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 25px;
  animation: ${breatheSage} 2.8s ease-in-out infinite;
  border: 1px solid rgba(82, 209, 163, 0.3);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 23px;
    border: 1px solid rgba(82, 209, 163, 0.2);
    animation: ${breatheSage} 2.8s ease-in-out 0.4s infinite;
    pointer-events: none;
  }
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1.5px;
  margin: 0 0 6px 0;
  color: #fff;
`;

const Subtitle = styled.p`
  font-size: 10px;
  color: #52d1a3;
  font-weight: bold;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin: 0 0 35px 0;
`;

const InputGroup = styled.div`
  margin-bottom: 20px;
  text-align: left;

  label {
    font-size: 9px;
    font-weight: bold;
    color: rgba(82, 209, 163, 0.8);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: block;
  }

  input {
    width: 100%;
    padding: 16px 18px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(82, 209, 163, 0.15);
    border-radius: 12px;
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.25s, box-shadow 0.25s;
    -webkit-appearance: none;
    font-family: inherit;

    &::placeholder { color: rgba(255,255,255,0.15); }

    &:focus {
      border-color: rgba(82, 209, 163, 0.5);
      animation: ${pulseSage} 2.5s ease infinite;
    }
  }
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 18px;
  background: #52d1a3;
  color: #041417;
  border: none;
  border-radius: 14px;
  font-weight: bold;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  margin-top: 8px;
  transition: transform 0.2s, box-shadow 0.3s;
  box-shadow: 0 4px 18px rgba(82, 209, 163, 0.15);
  position: relative;
  overflow: hidden;

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

export default function PatientLogin() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [identity, setIdentity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${LOCAL_API_BASE}/guest/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_number: room, identity: identity, app_version: "2.0.0" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Patient Access Denied.");
      
      localStorage.setItem('SOV_GUEST_TOKEN', data.token);
      localStorage.setItem('SOV_GUEST_SESSION', JSON.stringify(data.guest));
      
      setTimeout(() => {
        router.replace('/guest/hub');
      }, 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <UnifiedCanvas>
      <GlobalStyle />
      <LuxuryPanel>
        <Logo>🏥</Logo>
        <Title>Miracle General Hospital</Title>
        <Subtitle>PATIENT HEALTH PORTAL</Subtitle>
        
        <form onSubmit={handleLogin}>
          {error && <p style={{ color: '#FF5A5A', fontSize: '10px', fontWeight: 'bold', marginBottom: '20px' }}>🚨 {error}</p>}
          <InputGroup>
            <label>📍 WARD / BED IDENTIFICATION</label>
            <input type="text" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. WARD-01 or CABIN-02" required />
          </InputGroup>
          <InputGroup>
            <label>👤 PATIENT SURNAME / CRM ID</label>
            <input type="text" value={identity} onChange={e => setIdentity(e.target.value)} placeholder="e.g. Master" required />
          </InputGroup>
          
          <ActionButton type="submit" disabled={loading}>
            {loading ? "VERIFYING CLINICAL ACCESS..." : "🔓 ACCESS HEALTH DASHBOARD"}
          </ActionButton>
        </form>
      </LuxuryPanel>
    </UnifiedCanvas>
  );
}
