"use client";
import React, { useState, useEffect } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { useRouter } from 'next/navigation';

const API_BASE = ""; // Next.js dynamic routing resolves locally or to process.env.NEXT_PUBLIC_API_URL

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background: #04070c;
    color: #fff;
    font-family: 'Inter', sans-serif;
  }
`;

const pulseCyan = keyframes`
  0%   { box-shadow: 0 0 0 3px rgba(0,242,255,0.08), 0 0 16px rgba(0,242,255,0.15); }
  50%  { box-shadow: 0 0 0 4px rgba(0,242,255,0.15), 0 0 30px rgba(0,242,255,0.25); }
  100% { box-shadow: 0 0 0 3px rgba(0,242,255,0.08), 0 0 16px rgba(0,242,255,0.15); }
`;

const breatheCyan = keyframes`
  0%   { box-shadow: 0 0 20px rgba(0, 242, 255, 0.3), 0 0 40px rgba(0, 242, 255, 0.15); transform: scale(1); }
  50%  { box-shadow: 0 0 40px rgba(0, 242, 255, 0.6), 0 0 80px rgba(0, 242, 255, 0.3), 0 0 120px rgba(0, 242, 255, 0.1); transform: scale(1.05); }
  100% { box-shadow: 0 0 20px rgba(0, 242, 255, 0.3), 0 0 40px rgba(0, 242, 255, 0.15); transform: scale(1); }
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
  background: #04070c;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      linear-gradient(-45deg, #04070c, #090e17, #020408, #050c18, #04070c);
    background-size: 500% 500%;
    animation: ${nebulaFlow} 18s ease infinite;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 15% 15%, rgba(0,242,255,0.06), transparent 55%),
      radial-gradient(ellipse at 85% 85%, rgba(99,102,241,0.08), transparent 55%);
    pointer-events: none;
  }
`;

const LuxuryPanel = styled.div`
  background: rgba(8, 12, 24, 0.85);
  backdrop-filter: blur(60px) saturate(180%);
  -webkit-backdrop-filter: blur(60px) saturate(180%);
  border: 1px solid rgba(0, 242, 255, 0.15);
  border-radius: 36px;
  padding: clamp(36px,8vw,54px) clamp(28px,7vw,44px);
  width: min(90%, 420px);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.03),
    0 50px 100px rgba(0,0,0,0.9),
    0 0 60px rgba(0,242,255,0.04);
  z-index: 10;
  text-align: center;
  animation: ${fadeIn} 0.5s cubic-bezier(0.16,1,0.3,1);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,242,255,0.3), transparent);
    border-radius: 1px;
  }
`;

const Logo = styled.div`
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #00f2ff 0%, #3b82f6 50%, #1d4ed8 100%);
  color: #000;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 900;
  font-family: 'Cinzel', serif;
  margin-bottom: 30px;
  animation: ${breatheCyan} 2.8s ease-in-out infinite;
  border: 1px solid rgba(0, 242, 255, 0.3);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 23px;
    border: 1px solid rgba(0, 242, 255, 0.25);
    animation: ${breatheCyan} 2.8s ease-in-out 0.4s infinite;
    pointer-events: none;
  }
`;

const Title = styled.h1`
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 2px;
  margin-bottom: 8px;
  color: #00f2ff;
  text-transform: uppercase;
`;

const Subtitle = styled.p`
  font-size: 9px;
  color: #64748b;
  font-weight: 900;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 40px;
`;

const InputGroup = styled.div`
  margin-bottom: 24px;
  text-align: left;

  label {
    font-size: 9px;
    font-weight: 900;
    color: rgba(0,242,255,0.7);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 10px;
    display: block;
  }

  input {
    width: 100%;
    padding: 18px 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.25s, box-shadow 0.25s;
    -webkit-appearance: none;
    font-family: inherit;

    &::placeholder { color: rgba(255,255,255,0.2); }

    &:focus {
      border-color: rgba(0,242,255,0.5);
      animation: ${pulseCyan} 2.5s ease infinite;
    }
  }
`;

const shineSwipe = keyframes`
  from { left: -60%; }
  to   { left: 120%; }
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 20px;
  background: linear-gradient(135deg, #00f2ff 0%, #3b82f6 50%, #1e40af 100%);
  color: #000;
  border: none;
  border-radius: 18px;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  margin-top: 8px;
  transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
  box-shadow: 0 8px 28px rgba(0,242,255,0.25), 0 2px 0 rgba(255,255,255,0.18) inset;
  position: relative;
  overflow: hidden;
  will-change: transform;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: -60%; width: 40%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
    transform: skewX(-20deg);
  }

  &:active:not(:disabled) {
    transform: scale(0.96);
    box-shadow: 0 4px 14px rgba(0,242,255,0.15);
    &::before { animation: ${shineSwipe} 0.45s ease; }
  }

  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

export default function OwnerLogin() {
  const router = useRouter();
  const [nid, setNid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/pms/owner/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nid_passport: nid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication Failed.");

      // Store owner authentication
      localStorage.setItem('SOV_OWNER_TOKEN', data.token);
      localStorage.setItem('SOV_OWNER_SESSION', JSON.stringify(data.owner));

      setTimeout(() => {
        router.replace('/owner/hub');
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
        <Logo>O</Logo>
        <Title>Miracle Owner</Title>
        <Subtitle>Sovereign Ledger Portal | V66.0-SRE</Subtitle>
        
        <form onSubmit={handleLogin}>
          {error && <p style={{ color: '#FF3131', fontSize: '11px', fontWeight: 900, marginBottom: '20px', letterSpacing: '0.5px' }}>🚨 {error}</p>}
          <InputGroup>
            <label>👤 NID / PASSPORT IDENTIFICATION</label>
            <input type="text" value={nid} onChange={e => setNid(e.target.value)} placeholder="e.g. NID-998877" required />
          </InputGroup>
          
          <ActionButton type="submit" disabled={loading}>
            {loading ? "VERIFYING ACCOUNT..." : "🔓 ACCESS LEDGER"}
          </ActionButton>
        </form>
      </LuxuryPanel>
    </UnifiedCanvas>
  );
}
