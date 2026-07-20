"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const slideUp = keyframes`
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 15px rgba(0, 242, 255, 0.1), 0 0 30px rgba(139, 92, 246, 0.05); }
  50% { box-shadow: 0 0 25px rgba(0, 242, 255, 0.3), 0 0 50px rgba(139, 92, 246, 0.15); }
  100% { box-shadow: 0 0 15px rgba(0, 242, 255, 0.1), 0 0 30px rgba(139, 92, 246, 0.05); }
`;

const breathAnimation = keyframes`
  0%, 100% { opacity: 0.3; transform: scaleX(0.95); }
  50% { opacity: 0.8; transform: scaleX(1.02); }
`;

const BubbleWrapper = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
`;

const BubbleBtn = styled.button`
  width: 60px; height: 60px; border-radius: 30px;
  background: linear-gradient(135deg, #00f2ff 0%, #8b5cf6 100%);
  border: none; color: #000; font-size: 28px; cursor: pointer;
  box-shadow: 0 8px 32px rgba(0,242,255,0.4);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.25s cubic-bezier(0.16,1,0.3,1);

  &:active { transform: scale(0.9); }
`;

const FullScreenOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: #04070c;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.3s ease;
`;

const FullScreenLayout = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  flex: 1;
  overflow: hidden;
  height: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const LeftSidebar = styled.div<{ $showOnMobile: boolean }>`
  background: rgba(8, 12, 24, 0.95);
  border-right: 1px solid rgba(0, 242, 255, 0.15);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px;
  gap: 20px;

  &::-webkit-scrollbar { display: none; }

  @media (max-width: 768px) {
    display: ${props => props.$showOnMobile ? 'flex' : 'none'};
    position: fixed;
    inset: 60px 0 0 0;
    z-index: 6000;
  }
`;

const RightChatPanel = styled.div`
  background: #050812;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  border-left: 1px solid rgba(255,255,255,0.03);
`;

const GeminiHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 242, 255, 0.1);
  background: rgba(6, 9, 20, 0.8);
  backdrop-filter: blur(20px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;

  .title-area {
    h3 {
      margin: 0; font-size: 16px; font-weight: 900;
      background: linear-gradient(90deg, #00f2ff, #a78bfa, #f472b6);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      letter-spacing: 0.5px;
    }
    p { margin: 2px 0 0 0; font-size: 8px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  }

  .actions {
    display: flex; gap: 8px;
    button {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      color: #cbd5e1; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
      &:active { transform: scale(0.95); }
    }
  }
`;

const MessagesBox = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;

  &::-webkit-scrollbar { display: none; }
`;

const MsgBubble = styled.div<{ $isUser: boolean }>`
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  max-width: 85%;
  padding: 16px 20px;
  border-radius: ${props => props.$isUser ? '24px 24px 4px 24px' : '24px 24px 24px 4px'};
  background: ${props => props.$isUser ? 'linear-gradient(135deg, #00f2ff11 0%, #8b5cf611 100%)' : 'rgba(255,255,255,0.02)'};
  border: 1px solid ${props => props.$isUser ? 'rgba(0, 242, 255, 0.15)' : 'rgba(255,255,255,0.05)'};
  color: ${props => props.$isUser ? '#00f2ff' : '#cbd5e1'};
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-line;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
`;

const LoadingBreathBar = styled.div`
  width: 80%; height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, #00f2ff, #8b5cf6, #f472b6, #00f2ff);
  background-size: 300% 100%;
  animation: ${breathAnimation} 2s infinite ease-in-out;
  align-self: flex-start;
  margin-left: 20px;
  margin-top: 10px;
`;

const SidebarCard = styled.div`
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 16px;

  .title { font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  
  .row-item {
    margin-bottom: 8px; font-size: 12px;
    span.lbl { color: #64748b; font-weight: 700; margin-right: 6px; }
    span.val { color: #cbd5e1; }
  }
`;

const SignModalOverlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 8000;
  display: flex; align-items: center; justify-content: center; padding: 20px;
`;

const SignModal = styled.div`
  background: #080c16; border: 1px solid rgba(0, 242, 255, 0.3); border-radius: 28px;
  padding: 24px; max-width: 450px; width: 100%; text-align: center;
  box-shadow: ${pulseGlow};
`;

const CanvasWrapper = styled.div`
  border: 1px dashed rgba(255,255,255,0.15); border-radius: 16px; background: #000;
  margin: 18px 0; overflow: hidden; height: 180px; position: relative;
`;

const InvoiceCard = styled.div`
  background: rgba(255,49,49,0.02); border: 1px solid rgba(255,49,49,0.1); border-radius: 12px;
  padding: 10px 14px; margin-bottom: 8px; font-size: 11px;
  .header { display: flex; justify-content: space-between; font-weight: 800; color: #ff3131; }
  .desc { color: #94a3b8; margin-top: 4px; }
`;

const SuggestionGrid = styled.div`
  display: flex; gap: 8px; overflow-x: auto; padding: 12px 20px;
  border-top: 1px solid rgba(255,255,255,0.04);
  &::-webkit-scrollbar { display: none; }
`;

const SuggestChip = styled.button`
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
  color: #94a3b8; border-radius: 12px; padding: 8px 14px; font-size: 10px; font-weight: 700;
  cursor: pointer; white-space: nowrap; transition: 0.2s;
  &:active { background: rgba(0,242,255,0.05); border-color: #00f2ff; color: #00f2ff; }
`;

const ChatInputForm = styled.form`
  padding: 16px 20px; display: flex; gap: 10px;
  border-top: 1px solid rgba(255,255,255,0.05); background: rgba(6, 9, 20, 0.8);
`;

const InputText = styled.input`
  flex: 1; padding: 16px 20px; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
  color: #fff; font-size: 13px; outline: none; transition: 0.25s;
  &:focus { border-color: rgba(0,242,255,0.3); }
`;

const SendButton = styled.button`
  width: 48px; height: 48px; border-radius: 14px;
  background: #00f2ff; color: #000; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
`;

const CHART_COLORS = ['#00F2FF', '#8b5cf6', '#f472b6', '#3b82f6', '#10b981', '#f59e0b'];

function SovereignChartRenderer({ raw }: { raw: string }) {
  try {
    const config = JSON.parse(raw.trim());
    const { type = 'bar', title, data = [] } = config;
    if (!data.length) return null;

    const tooltipStyle = {
      backgroundColor: 'rgba(8,12,24,0.95)',
      border: '1px solid rgba(0,242,255,0.25)',
      borderRadius: 12,
      color: '#00F2FF',
      fontSize: 11,
    };

    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,242,255,0.02) 0%, rgba(139,92,246,0.02) 100%)',
        border: '1px solid rgba(0,242,255,0.15)', borderRadius: 20, padding: 18, marginTop: 12, width: '100%', maxWidth: 460
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#00f2ff', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>📈 {title || 'Visual Report'}</div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            {type === 'line' ? (
              <LineChart data={data}>
                <XAxis dataKey="name" stroke="#475569" style={{ fontSize: 10 }} />
                <YAxis stroke="#475569" style={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="#00F2FF" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                {data[0]?.value2 !== undefined && <Line type="monotone" dataKey="value2" stroke="#8b5cf6" strokeWidth={2.5} />}
              </LineChart>
            ) : type === 'pie' ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#8b5cf6" label={{ fill: '#cbd5e1', fontSize: 9 }}>
                  {data.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            ) : (
              <BarChart data={data}>
                <XAxis dataKey="name" stroke="#475569" style={{ fontSize: 10 }} />
                <YAxis stroke="#475569" style={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#00F2FF" radius={[4, 4, 0, 0]}>
                  {data.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  } catch {
    return <pre style={{ color: '#ef4444', fontSize: 11, overflowX: 'auto', background: '#000', padding: 10, borderRadius: 8 }}>{raw}</pre>;
  }
}

interface ButlerProps {
  ownerNid: string;
  ownerName: string;
}

export default function OwnerAiButler({ ownerNid, ownerName }: ButlerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Advanced PMS Sub-screen states
  const [profileData, setProfileData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [signingRoom, setSigningRoom] = useState<string | null>(null);
  const [signingType, setSigningType] = useState<string>('');
  const [mandateRegOpen, setMandateRegOpen] = useState(false);
  const [mandateRef, setMandateRef] = useState('');
  const [mandateToken, setMandateToken] = useState('');

  // Canvas drawing refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const welcomeName = ownerName.split(' ')[0];

  const fetchAdvancedData = useCallback(async () => {
    try {
      const token = localStorage.getItem('SOV_OWNER_TOKEN') || '';
      const [profileRes, invoicesRes] = await Promise.all([
        fetch(`/api/pms/owner/profile?owner_nid=${encodeURIComponent(ownerNid)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/pms/owner/invoices`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfileData(pData);
      }
      if (invoicesRes.ok) {
        const iData = await invoicesRes.json();
        setInvoices(iData.invoices || []);
      }
    } catch {}
  }, [ownerNid]);

  useEffect(() => {
    setMessages([
      {
        isUser: false,
        text: `Good day, ${welcomeName}.\nI am your Sovereign AGI Butler. How can I assist you with your Miracle General Hospital & Diagnosis Center yields, rental pools, or mortgage buyouts today?`
      }
    ]);
  }, [welcomeName]);

  useEffect(() => {
    if (isOpen) {
      fetchAdvancedData();
    }
  }, [isOpen, fetchAdvancedData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg = { isUser: true, text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const token = localStorage.getItem('SOV_OWNER_TOKEN') || '';
      const res = await fetch(`/api/pms/owner/bot/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query: textToSend })
      });
      const data = await res.json();
      if (!res.ok) throw new Error();

      setMessages(prev => [...prev, { isUser: false, text: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { isUser: false, text: "I apologize, but I could not synthesize your query." }]);
    } finally {
      setLoading(false);
    }
  };

  // HTML5 E-Signature Pad drawing logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#00f2ff';

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submitSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !signingRoom) return;
    const signatureBase64 = canvas.toDataURL();

    try {
      const token = localStorage.getItem('SOV_OWNER_TOKEN') || '';
      const res = await fetch(`/api/pms/owner/contract/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          room_id: signingRoom,
          contract_type: signingType,
          terms_text: `International Standard real estate contract terms for room ${signingRoom}. Governed by LCIA London rules.`,
          signature_data: signatureBase64
        })
      });
      if (res.ok) {
        alert('Contract signed successfully and hashed to ledger!');
        setSigningRoom(null);
        fetchAdvancedData();
      }
    } catch {
      alert('Failed to register signature.');
    }
  };

  const submitDirectDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandateRef || !mandateToken) return;
    try {
      const token = localStorage.getItem('SOV_OWNER_TOKEN') || '';
      const res = await fetch(`/api/pms/owner/direct-debit/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mandate_reference: mandateRef,
          payment_gateway: 'STRIPE',
          mandate_token: mandateToken
        })
      });
      if (res.ok) {
        alert('Direct debit ACH/SEPA mandate activated!');
        setMandateRegOpen(false);
        setMandateRef('');
        setMandateToken('');
        fetchAdvancedData();
      }
    } catch {
      alert('Debit registration failed.');
    }
  };

  // Render bubble + messages
  const renderMessageContent = (text: string) => {
    // Check if the response contains a json_chart block
    const chartRegex = /```json_chart([\s\S]*?)```/g;
    const match = chartRegex.exec(text);

    if (match) {
      const beforeText = text.substring(0, match.index);
      const afterText = text.substring(match.index + match[0].length);
      return (
        <>
          {beforeText}
          <SovereignChartRenderer raw={match[1]} />
          {afterText}
        </>
      );
    }
    return text;
  };

  return (
    <>
      <BubbleWrapper>
        <BubbleBtn onClick={() => setIsOpen(true)}>🤖</BubbleBtn>
      </BubbleWrapper>

      {isOpen && (
        <FullScreenOverlay>
          {/* TOP BAR */}
          <GeminiHeader>
            <div className="title-area">
              <h3>MIRACLE AGI OWNER BUTLER</h3>
              <p>Sovereign PMS Core Client Engine</p>
            </div>
            <div className="actions">
              <button style={{ display: 'block', '@media (min-width: 769px)': { display: 'none' } } as any} onClick={() => setShowMobileSidebar(!showMobileSidebar)}>
                {showMobileSidebar ? 'Hide Details' : 'Show Details'}
              </button>
              <button onClick={() => setIsOpen(false)}>Minimize</button>
            </div>
          </GeminiHeader>

          <FullScreenLayout>
            {/* SIDEBAR DETAIL FRAME */}
            <LeftSidebar $showOnMobile={showMobileSidebar}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#00f2ff', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10 }}>Owner Dossier</div>
              
              <SidebarCard>
                <div className="title">Client Profile</div>
                <div className="row-item"><span className="lbl">Name:</span><span className="val">{ownerName}</span></div>
                <div className="row-item"><span className="lbl">NID:</span><span className="val" style={{ fontFamily: 'monospace' }}>{ownerNid}</span></div>
                <div className="row-item"><span className="lbl">Yield:</span><span className="val" style={{ color: '#00ff88', fontWeight: 800 }}>${profileData?.profile?.balance?.toFixed(2) || '0.00'}</span></div>
              </SidebarCard>

              <SidebarCard>
                <div className="title">Direct Debit (ACH/SEPA)</div>
                {profileData?.profile?.bank_details ? (
                  <>
                    <div className="row-item"><span className="lbl">Gateway:</span><span className="val">STRIPE ACTIVE</span></div>
                    <div className="row-item"><span className="lbl">Ref Mandate:</span><span className="val" style={{ fontSize: 10, fontFamily: 'monospace' }}>{profileData.profile.bank_details?.account_number ? `MND-${profileData.profile.bank_details.account_number}` : 'ACTIVE'}</span></div>
                  </>
                ) : (
                  <button onClick={() => setMandateRegOpen(true)} style={{ background: '#00f2ff', color: '#000', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 10, fontWeight: 'bold', width: '100%', cursor: 'pointer' }}>Register Mandate</button>
                )}
              </SidebarCard>

              <SidebarCard>
                <div className="title">Covenant Contracts</div>
                {profileData?.properties?.map((p: any) => {
                  const signed = (profileData.contracts || []).some((c: any) => c.room_id === p.room_id);
                  return (
                    <div key={p.room_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11 }}>
                      <span>Room {p.room_id} ({p.ownership_type})</span>
                      {signed ? (
                        <span style={{ color: '#00ff88', fontWeight: 700 }}>✓ Signed</span>
                      ) : (
                        <button onClick={() => { setSigningRoom(p.room_id); setSigningType(p.ownership_type === 'MORTGAGE_BUYER' ? 'MORTGAGE_NOTE' : 'LEASE_AGREEMENT'); }} style={{ background: 'rgba(0,242,255,0.1)', color: '#00f2ff', border: '1px solid #00f2ff44', borderRadius: 6, padding: '3px 8px', fontSize: 9, cursor: 'pointer' }}>Sign</button>
                      )}
                    </div>
                  );
                })}
              </SidebarCard>

              <SidebarCard>
                <div className="title">Repair Invoices</div>
                {invoices.map(inv => (
                  <InvoiceCard key={inv.id}>
                    <div className="header">
                      <span>Room {inv.room_id}</span>
                      <span>${inv.amount.toFixed(2)}</span>
                    </div>
                    <div className="desc">{inv.description}</div>
                  </InvoiceCard>
                ))}
                {invoices.length === 0 && (
                  <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>No outstanding repair charges.</div>
                )}
              </SidebarCard>
            </LeftSidebar>

            {/* CHAT INTERFACE PANEL */}
            <RightChatPanel>
              <MessagesBox>
                {messages.map((m, idx) => (
                  <MsgBubble key={idx} $isUser={m.isUser}>
                    {renderMessageContent(m.text)}
                  </MsgBubble>
                ))}
                {loading && <LoadingBreathBar />}
                <div ref={messagesEndRef} />
              </MessagesBox>

              <SuggestionGrid>
                {["Yield comparison chart", "Mortgage sweeps forecast", "Outstanding repair list"].map(s => (
                  <SuggestChip key={s} onClick={() => handleSend(s)}>{s}</SuggestChip>
                ))}
              </SuggestionGrid>

              <ChatInputForm onSubmit={e => { e.preventDefault(); handleSend(query); }}>
                <InputText
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Query AGI Butler..."
                  disabled={loading}
                />
                <SendButton type="submit" disabled={loading}>→</SendButton>
              </ChatInputForm>
            </RightChatPanel>
          </FullScreenLayout>

          {/* SIGNATURE DRAWING MODAL */}
          {signingRoom && (
            <SignModalOverlay>
              <SignModal>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#00f2ff' }}>Covenant Agreement signature</h3>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Use your finger or mouse to draw your legal signature below to sign the {signingType} for Room {signingRoom}.</p>
                <CanvasWrapper>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={180}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={() => setIsDrawing(false)}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={() => setIsDrawing(false)}
                  />
                </CanvasWrapper>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={clearCanvas} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.04)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>Clear</button>
                  <button onClick={submitSignature} style={{ padding: '10px 18px', background: '#00f2ff', border: 'none', color: '#000', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Sign & Lock</button>
                  <button onClick={() => setSigningRoom(null)} style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                </div>
              </SignModal>
            </SignModalOverlay>
          )}

          {/* DIRECT DEBIT REGISTER MANDATE */}
          {mandateRegOpen && (
            <SignModalOverlay>
              <SignModal>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#00f2ff', marginBottom: 12 }}>Register SEPA/ACH Mandate</h3>
                <form onSubmit={submitDirectDebit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <InputText
                    value={mandateRef}
                    onChange={e => setMandateRef(e.target.value)}
                    placeholder="Enter Mandate Reference (e.g. MND-1002)"
                    required
                  />
                  <InputText
                    value={mandateToken}
                    onChange={e => setMandateToken(e.target.value)}
                    placeholder="Enter Payment Bank Routing Token"
                    required
                  />
                  <button type="submit" style={{ padding: '14px', background: '#00f2ff', color: '#000', border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', marginTop: 10 }}>Activate Direct Debit</button>
                  <button type="button" onClick={() => setMandateRegOpen(false)} style={{ padding: '10px', background: 'transparent', color: '#cbd5e1', border: 'none', cursor: 'pointer' }}>Close</button>
                </form>
              </SignModal>
            </SignModalOverlay>
          )}
        </FullScreenOverlay>
      )}
    </>
  );
}
