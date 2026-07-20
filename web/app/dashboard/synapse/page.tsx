'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useGlobalSync } from '../../context/GlobalSyncContext';
import { EmpNode, Directive, Room, SynapseMessage, SynapseThread, VaultData } from './synapse.types';
import SynapseChatPanel from './SynapseChatPanel';
import SynapseVaultPanel from './SynapseVaultPanel';
import SynapseKanban from './SynapseKanban';
import SynapseCommandGrid from './SynapseCommandGrid';
import SynapseDirectiveModal from './SynapseDirectiveModal';
import { usePrompt } from '../../components/SovereignPrompt';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || API.replace('http', 'ws');

export default function SynapseNexusPage() {
  const { activeRole } = useGlobalSync();
  const { showPrompt } = usePrompt();
  const [nodes, setNodes] = useState<EmpNode[]>([]);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisitor, setIsVisitor] = useState(false);
  const [mainView, setMainView] = useState<'KANBAN' | 'GRID'>('KANBAN');

  // Chat State
  const [myThreads, setMyThreads] = useState<SynapseThread[]>([]);
  const [filterUnread, setFilterUnread] = useState(false);
  const [activeThread, setActiveThread] = useState<SynapseThread | null>(null);
  const [messages, setMessages] = useState<SynapseMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const chatWsRef = useRef<WebSocket | null>(null);
  const presenceWsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [gatekeeperStatus, setGatekeeperStatus] = useState<any>(null);
  // Vault state
  const [vaultTarget, setVaultTarget] = useState<EmpNode | null>(null);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [vaultTab, setVaultTab] = useState('DOCUMENT');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  // Directive modal state
  const [directiveModal, setDirectiveModal] = useState<{ open: boolean; directive?: Directive | null }>({ open: false, directive: null });

  const token = typeof window !== 'undefined' ? localStorage.getItem('miracle_token') : '';
  const role = typeof window !== 'undefined' ? localStorage.getItem('vigilant_role') || '' : '';
  const myEmpId = typeof window !== 'undefined' ? localStorage.getItem('operative_id') || 'OP-001' : 'OP-001'; // Fallback for dev
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (role.includes('VISITOR')) setIsVisitor(true);
    fetchData();
    fetchMyThreads();
    const interval = setInterval(() => { fetchData(); fetchMyThreads(); }, 10000);
    return () => clearInterval(interval);
  }, [role, myEmpId]);

  // Presence heartbeat — keeps is_online=true while page is open
  useEffect(() => {
    if (!myEmpId || myEmpId === 'OP-001') return;
    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/synapse/presence/${myEmpId}`);
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'ping' })); };
      ws.onmessage = () => {};
      ws.onclose = () => { setTimeout(connect, 5000); }; // auto-reconnect
      presenceWsRef.current = ws;
    };
    connect();
    const ping = setInterval(() => {
      if (presenceWsRef.current?.readyState === WebSocket.OPEN) {
        presenceWsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
    return () => { clearInterval(ping); presenceWsRef.current?.close(); };
  }, [myEmpId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchData = async () => {
    try {
      const [rNodes, rDirs, rRooms] = await Promise.all([
        fetch(`${API}/synapse/org-chart`, { headers }),
        fetch(`${API}/synapse/directives`, { headers }),
        fetch(`${API}/synapse/webrtc/rooms`, { headers })
      ]);
      const [dNodes, dDirs, dRooms] = await Promise.all([rNodes.json(), rDirs.json(), rRooms.json()]);
      if (dNodes.status === 'SUCCESS') setNodes(dNodes.nodes);
      if (dDirs.status === 'SUCCESS') setDirectives(dDirs.directives);
      if (dRooms.status === 'SUCCESS') setRooms(dRooms.rooms);
    } catch (e) {
      console.error('Synapse Sync Error:', e);
    }
    setLoading(false);
  };

  const fetchMyThreads = async () => {
    try {
      const res = await fetch(`${API}/synapse/threads/${myEmpId}`, { headers });
      const data = await res.json();
      if (data.status === 'SUCCESS') setMyThreads(data.threads);
    } catch (e) { console.error('Thread Fetch Error:', e); }
  };

  // Open Staff Vault for any employee
  const openVault = async (node: EmpNode) => {
    setVaultTarget(node);
    setVaultLoading(true);
    setVaultData(null);
    try {
      const res = await fetch(`${API}/synapse/vault/${node.id}`, { headers });
      const data = await res.json();
      if (data.status === 'SUCCESS') setVaultData(data);
    } catch (e) { console.error('Vault Load Error:', e); }
    setVaultLoading(false);
  };

  const closeVault = () => { setVaultTarget(null); setVaultData(null); };

  // Upload a file into the active chat thread
  const uploadChatFile = async (file: File) => {
    if (!activeThread) return;
    setUploadingFile(true);
    const form = new FormData();
    form.append('file', file);
    form.append('thread_id', activeThread.thread_id);
    form.append('sender_id', myEmpId);
    try {
      await fetch(`${API}/synapse/files/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    } catch (e) { console.error('Upload Error:', e); }
    setUploadingFile(false);
  };

  // Upload a file directly to a vault (HR usage)
  const uploadToVault = async (empId: string, file: File, category: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    form.append('uploaded_by', myEmpId);
    try {
      const res = await fetch(`${API}/synapse/vault/${empId}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (data.status === 'SUCCESS') openVault(vaultTarget!);
    } catch (e) { console.error('Vault Upload Error:', e); }
  };



  // --- HIERARCHY CHAT LOGIC ---
  const handleSelectNode = async (targetNode: EmpNode) => {
    if (targetNode.id === myEmpId) return;
    try {
      const res = await fetch(`${API}/synapse/can-message?initiator_id=${myEmpId}&target_id=${targetNode.id}`, { headers });
      const status = await res.json();
      setGatekeeperStatus({ target: targetNode, ...status });
      
      if (status.verdict !== 'REQUIRE_BRIDGE') {
        // Auto-create/open thread
        initiateThread(targetNode.id, null, targetNode.name);
      }
    } catch (e) { console.error(e); }
  };

  const initiateThread = async (targetId: string, bridgeManagerId: string | null, targetName: string) => {
    try {
      const res = await fetch(`${API}/synapse/threads`, {
        method: 'POST', headers,
        body: JSON.stringify({ initiator_id: myEmpId, target_id: targetId, bridge_manager_id: bridgeManagerId })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        const fakeThread = { thread_id: data.thread_id, thread_type: data.thread_type, subject: `Comms: ${targetName}`, last_message: '', last_sender: '', last_at: '', unread: 0, initiator_id: myEmpId, target_id: targetId, bridge_manager_id: bridgeManagerId };
        openThread(fakeThread);
        setGatekeeperStatus(null);
        fetchMyThreads();
      }
    } catch (e) { console.error(e); }
  };

  const openThread = async (thread: SynapseThread) => {
    setActiveThread(thread);
    if (chatWsRef.current) {
        chatWsRef.current.close();
    }
    try {
      const res = await fetch(`${API}/synapse/threads/${thread.thread_id}/messages`, { headers });
      const data = await res.json();
      if (data.status === 'SUCCESS') setMessages(data.messages);
    } catch (e) { console.error(e); }

    // Connect WS
    const ws = new WebSocket(`${WS_BASE}/synapse/chat/${thread.thread_id}`);
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            setMessages(prev => [...prev, msg]);
        } catch (e) { console.error(e); }
    };
    chatWsRef.current = ws;
  };

  const sendMessage = () => {
    if (!msgInput.trim() || !activeThread || !chatWsRef.current) return;
    const payload = { sender_id: myEmpId, content: msgInput, msg_type: 'TEXT' };
    chatWsRef.current.send(JSON.stringify(payload));
    setMsgInput('');
  };

  const closeThread = () => {
      setActiveThread(null);
      if (chatWsRef.current) {
          chatWsRef.current.close();
          chatWsRef.current = null;
      }
  };

  // --- WEBRTC ---
  const startVideoCall = async (empId: string, empName: string) => {
    try {
      const res = await fetch(`${API}/synapse/webrtc/create-room`, {
        method: 'POST', headers,
        body: JSON.stringify({ room_name: `Comm-Link: ${empName}`, created_by: myEmpId })
      });
      const d = await res.json();
      if (d.status === 'SUCCESS') {
        setActiveCall(d.room_id);
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const endCall = async () => {
    if (!activeCall) return;
    try {
      await fetch(`${API}/synapse/webrtc/rooms/${activeCall}/end`, { method: 'POST', headers });
      setActiveCall(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const createDirective = async () => {
    const title = await showPrompt({ title: 'NEW DIRECTIVE', message: 'Enter Directive Title:' });
    if (!title) return;
    try {
      const res = await fetch(`${API}/synapse/directives`, {
        method: 'POST', headers,
        body: JSON.stringify({ title, priority: 'NORMAL', issued_by: myEmpId })
      });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  };

  // --- UI Components ---
  const glass = { background: 'rgba(10, 10, 10, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(20px)' };
  
  const getTierColor = (tier: number) => {
      if (tier === 4) return '#D4AF37'; // Gold (C-Suite)
      if (tier === 3) return '#ff3366'; // Pink (Director)
      if (tier === 2) return '#00ff88'; // Green (Manager)
      return '#00fbff'; // Cyan (Operative)
  };

  return (
    <div style={{ padding: '24px', minHeight: '100%', pointerEvents: isVisitor ? 'none' : 'auto', opacity: isVisitor ? 0.6 : 1, position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Cinzel', color: '#00fbff', fontSize: '28px', letterSpacing: '4px', textShadow: '0 0 20px rgba(0,251,255,0.4)' }}>⚡ SYNAPSE NEXUS</h1>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px', letterSpacing: '2px' }}>ZONE 20 · SOVEREIGN COMMAND & COMM-LINK MATRIX</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => {fetchData(); fetchMyThreads();}} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(0,251,255,0.3)', color: '#00fbff', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 900, letterSpacing: '1px' }}>
            {loading ? 'PULSING...' : '↻ SYNC GRID'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeThread ? '350px 1fr' : '350px 1fr 300px', gap: '24px', height: 'calc(100vh - 140px)', transition: 'all 0.3s ease' }}>
            {/* PANEL 1: NEURAL TREE - ALL ONBOARDED STAFF */}
        <div style={{ ...glass, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#FFF', letterSpacing: '2px', fontWeight: 900 }}>NEURAL TREE</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '9px', color: '#00ff88', background: 'rgba(0,255,136,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(0,255,136,0.2)' }}>
                  {nodes.filter(n => n.on_duty).length} ON-DUTY
                </span>
                <span style={{ fontSize: '9px', color: '#888', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                  {nodes.length} TOTAL
                </span>
              </div>
            </div>
            <div style={{ fontSize: '9px', color: '#555', letterSpacing: '1px' }}>Click any operative to open a secure channel. Messages persist offline.</div>
          </div>
          <div style={{ padding: '8px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Group by tier */}
            {[4, 3, 2, 1].map(tier => {
              const tierNodes = nodes.filter(n => n.tier_weight === tier);
              if (tierNodes.length === 0) return null;
              const tierLabel = tier === 4 ? 'C-SUITE' : tier === 3 ? 'DIRECTORS' : tier === 2 ? 'MANAGERS' : 'OPERATIVES';
              const tColor = getTierColor(tier);
              return (
                <div key={tier}>
                  <div style={{ fontSize: '8px', color: tColor, letterSpacing: '2px', fontWeight: 900, padding: '8px 8px 4px', opacity: 0.7 }}>{tierLabel}</div>
                  {tierNodes.map(node => {
                    const threadForNode = myThreads.find(t => t.target_id === node.id || t.initiator_id === node.id);
                    const unreadCount = threadForNode?.unread || 0;
                    const isMe = node.id === myEmpId;
                    return (
                      <div key={node.id} onClick={() => !isMe && handleSelectNode(node)}
                        draggable={!isMe}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'OPERATIVE', empId: node.id }));
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: '10px',
                          background: isMe ? 'rgba(0,251,255,0.04)' : 'transparent',
                          border: isMe ? '1px solid rgba(0,251,255,0.1)' : '1px solid transparent',
                          cursor: isMe ? 'default' : 'grab', transition: 'all 0.2s', position: 'relative' }}
                        onMouseEnter={e => { if (!isMe) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = tColor + '44'; }}}
                        onMouseLeave={e => { if (!isMe) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}}
                      >
                        {/* Avatar */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%',
                            background: `linear-gradient(135deg, ${tColor}33, #0d0d0d)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2px solid ${node.on_duty ? tColor : node.is_online ? '#00fbff55' : '#2a2a2a'}`,
                            boxShadow: node.on_duty ? `0 0 14px ${tColor}66` : node.is_online ? '0 0 8px rgba(0,251,255,0.3)' : 'none',
                            color: tColor, fontWeight: 900, fontSize: '13px' }}>
                            {node.name.substring(0, 2).toUpperCase()}
                          </div>
                          {/* Presence dot — CYAN = online via WebSocket (is_online) */}
                          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%',
                            background: node.is_online ? '#00fbff' : '#2a2a2a',
                            boxShadow: node.is_online ? '0 0 8px #00fbff' : 'none',
                            border: '2px solid #0a0a0a',
                            animation: node.is_online ? 'pulse 2s infinite' : 'none' }}/>
                          {/* Unread badge */}
                          {unreadCount > 0 && (
                            <div title="Unread Messages" style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff3366', 
                              width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                              fontSize: '8px', color: '#FFF', fontWeight: 900 }}>{unreadCount}</div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.name}
                            {isMe && <span style={{ fontSize: '8px', background: 'rgba(0,251,255,0.15)', color: '#00fbff', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>YOU</span>}
                          </div>
                          <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{node.position}</div>
                        </div>

                        {/* Right: Dual-status + vault button */}
                        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {/* ON-DUTY badge — GREEN = actively working shift */}
                          {node.on_duty ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '5px', padding: '2px 6px' }}>
                              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00ff88' }}/>
                              <span style={{ fontSize: '7px', color: '#00ff88', fontWeight: 900, letterSpacing: '0.5px' }}>ON-DUTY</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: '7px', color: '#444', letterSpacing: '0.5px' }}>OFF-DUTY</div>
                          )}
                          {/* Vault icon button */}
                          {!isMe && (
                            <div onClick={e => { e.stopPropagation(); openVault(node); }}
                              style={{ fontSize: '10px', color: '#D4AF37', opacity: 0.6, cursor: 'pointer', transition: '0.2s' }}
                              title="Open Vault"
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}>
                              🗄️
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 2: MAIN CHAT OR DIRECTIVES */}
        {activeThread ? (
            <SynapseChatPanel
              activeThread={activeThread}
              messages={messages}
              myEmpId={myEmpId}
              msgInput={msgInput}
              uploadingFile={uploadingFile}
              chatWsRef={chatWsRef}
              onClose={closeThread}
              onMsgInputChange={setMsgInput}
              onSend={sendMessage}
              onFileUpload={uploadChatFile}
            />
        ) : (
            <div style={{ ...glass, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <span 
                        onClick={() => setMainView('KANBAN')}
                        style={{ fontSize: '11px', color: mainView === 'KANBAN' ? '#FFF' : '#666', letterSpacing: '2px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}
                      >STRATEGIC KANBAN</span>
                      <span style={{ color: '#444' }}>|</span>
                      <span 
                        onClick={() => setMainView('GRID')}
                        style={{ fontSize: '11px', color: mainView === 'GRID' ? '#FFF' : '#666', letterSpacing: '2px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}
                      >CORPORATE MATRIX</span>
                    </div>
                    <button
                      onClick={() => setDirectiveModal({ open: true, directive: null })}
                      style={{ padding: '6px 14px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', borderRadius: '6px', cursor: 'pointer', fontSize: '9px', fontWeight: 900, letterSpacing: '1px', transition: '0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.1)'; }}
                    >⚡ NEW DIRECTIVE</button>
                </div>
                <div style={{ flex: 1, padding: '14px', overflow: mainView === 'GRID' ? 'auto' : 'hidden' }}>
                    {mainView === 'KANBAN' ? (
                      <SynapseKanban
                        directives={directives}
                        token={token || ''}
                        nodes={nodes}
                        myEmpId={myEmpId}
                        onDirectivesChange={setDirectives}
                        onCardClick={(d) => setDirectiveModal({ open: true, directive: d })}
                        onRefresh={fetchData}
                      />
                    ) : (
                      <SynapseCommandGrid token={token || ''} />
                    )}
                </div>
            </div>
        )}

        {/* PANEL 3: INBOX */}
        {!activeThread && (
            <div style={{ ...glass, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#FFF', letterSpacing: '2px', fontWeight: 900 }}>ACTIVE COMMS</span>
                        {myThreads.filter(t => t.unread > 0).length > 0 && (
                            <button 
                                onClick={() => setFilterUnread(!filterUnread)}
                                style={{ 
                                    fontSize: '10px', 
                                    color: filterUnread ? '#FFF' : '#ff3366', 
                                    background: filterUnread ? '#ff3366' : 'rgba(255,51,102,0.1)', 
                                    padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,51,102,0.3)', fontWeight: 900, cursor: 'pointer' 
                                }}>
                                {myThreads.filter(t => t.unread > 0).length} UNREAD
                            </button>
                        )}
                    </div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '6px', letterSpacing: '1px' }}>Messages held in vault for offline operatives</div>
                </div>
                <div style={{ padding: '8px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {myThreads.filter(t => filterUnread ? t.unread > 0 : true).length === 0 ? (
                        <div style={{textAlign: 'center', color: '#555', marginTop: '30px'}}>
                            <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.4 }}>📭</div>
                            <div style={{ fontSize: '11px' }}>No active channels.</div>
                        </div>
                    ) : (
                        myThreads.filter(t => filterUnread ? t.unread > 0 : true).map(thread => (
                            <div key={thread.thread_id} onClick={() => openThread(thread)}
                                style={{ padding: '12px', background: thread.unread > 0 ? 'rgba(255,51,102,0.04)' : 'rgba(255,255,255,0.02)',
                                    borderRadius: '10px', border: `1px solid ${thread.unread > 0 ? 'rgba(255,51,102,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                    cursor: 'pointer', transition: '0.2s', position: 'relative' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = thread.unread > 0 ? 'rgba(255,51,102,0.04)' : 'rgba(255,255,255,0.02)'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 700, flex: 1, paddingRight: '8px' }}>{thread.subject}</div>
                                    {thread.unread > 0 && (
                                        <div style={{ background: '#ff3366', boxShadow: '0 0 8px #ff3366', borderRadius: '10px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#FFF', fontWeight: 900, padding: '0 4px', flexShrink: 0 }}>
                                            {thread.unread}
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontSize: '9px', color: thread.thread_type === 'BRIDGED' ? '#ff3366' : '#00fbff', marginBottom: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span>{thread.thread_type === 'BRIDGED' ? '🔗' : '💬'}</span>
                                    <span>{thread.thread_type}</span>
                                    {thread.bridge_manager_id && <span style={{ color: '#666' }}>· CC: MGR</span>}
                                </div>
                                <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {thread.last_sender ? `${thread.last_sender}: ${thread.last_message}` : 'Channel opened — no messages yet.'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

      </div>
      {/* END GRID */}

      {/* GATEKEEPER MODAL */}
      {gatekeeperStatus && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '400px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid #222', background: gatekeeperStatus.verdict === 'REQUIRE_BRIDGE' ? 'rgba(255,51,102,0.1)' : 'rgba(0,251,255,0.1)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ fontSize: '24px' }}>{gatekeeperStatus.verdict === 'REQUIRE_BRIDGE' ? '🔒' : '🔓'}</div>
                      <div>
                          <div style={{ fontSize: '14px', color: '#FFF', fontWeight: 900, letterSpacing: '1px' }}>HIERARCHY PROTOCOL</div>
                          <div style={{ fontSize: '10px', color: gatekeeperStatus.verdict === 'REQUIRE_BRIDGE' ? '#ff3366' : '#00fbff' }}>{gatekeeperStatus.verdict === 'REQUIRE_BRIDGE' ? 'RESTRICTED ACCESS' : 'CLEARANCE GRANTED'}</div>
                      </div>
                  </div>
                  <div style={{ padding: '24px' }}>
                      {gatekeeperStatus.verdict === 'REQUIRE_BRIDGE' ? (
                          <>
                              <div style={{ fontSize: '13px', color: '#CCC', lineHeight: '1.6', marginBottom: '20px' }}>
                                  You are attempting to bypass the chain of command. Direct messaging to <b style={{color:'#FFF'}}>{gatekeeperStatus.target.name}</b> ({gatekeeperStatus.target.executive_tier}) is restricted for your tier.
                              </div>
                              {gatekeeperStatus.bridge_manager ? (
                                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid #333', marginBottom: '24px' }}>
                                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>REQUIRED BRIDGE:</div>
                                      <div style={{ fontSize: '14px', color: '#D4AF37', fontWeight: 700 }}>{gatekeeperStatus.bridge_manager.name}</div>
                                      <div style={{ fontSize: '11px', color: '#666' }}>Manager CC will be enforced.</div>
                                  </div>
                              ) : (
                                  <div style={{ color: '#ff3366', fontSize: '12px', marginBottom: '24px' }}>No direct manager found. Cannot bridge.</div>
                              )}
                              <div style={{ display: 'flex', gap: '12px' }}>
                                  <button onClick={() => setGatekeeperStatus(null)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>CANCEL</button>
                                  <button 
                                    onClick={() => initiateThread(gatekeeperStatus.target.id, gatekeeperStatus.bridge_manager.id, gatekeeperStatus.target.name)}
                                    disabled={!gatekeeperStatus.bridge_manager}
                                    style={{ flex: 1, padding: '12px', background: 'rgba(255,51,102,0.1)', border: '1px solid #ff3366', color: '#ff3366', borderRadius: '8px', cursor: gatekeeperStatus.bridge_manager ? 'pointer' : 'not-allowed', fontWeight: 900, letterSpacing: '1px' }}>
                                      REQUEST BRIDGE
                                  </button>
                              </div>
                          </>
                      ) : (
                          <>
                               <div style={{ fontSize: '13px', color: '#CCC', lineHeight: '1.6', marginBottom: '24px' }}>
                                  Secure channel to <b style={{color:'#FFF'}}>{gatekeeperStatus.target.name}</b> authorized.
                                  {gatekeeperStatus.auto_cc && " Top-down communication protocol engaged. Relevant managers will be automatically CC'd."}
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                  <button onClick={() => setGatekeeperStatus(null)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>CANCEL</button>
                                  <button onClick={() => initiateThread(gatekeeperStatus.target.id, null, gatekeeperStatus.target.name)} style={{ flex: 1, padding: '12px', background: 'rgba(0,251,255,0.1)', border: '1px solid #00fbff', color: '#00fbff', borderRadius: '8px', cursor: 'pointer', fontWeight: 900, letterSpacing: '1px' }}>
                                      OPEN CHANNEL
                                  </button>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ============================================================ */}
      {/* DIRECTIVE MODAL — New / Edit                                  */}
      {/* ============================================================ */}
      {directiveModal.open && (
        <SynapseDirectiveModal
          directive={directiveModal.directive}
          nodes={nodes}
          token={token || ''}
          myEmpId={myEmpId}
          onClose={() => setDirectiveModal({ open: false, directive: null })}
          onSaved={fetchData}
        />
      )}

      {/* ============================================================ */}
      {/* SOVEREIGN STAFF VAULT — slide-in panel from the right        */}
      {/* ============================================================ */}
      {vaultTarget && (
        <SynapseVaultPanel
          vaultTarget={vaultTarget}
          vaultData={vaultData}
          vaultLoading={vaultLoading}
          myEmpId={myEmpId}
          token={token || ''}
          onClose={closeVault}
          onRefresh={() => openVault(vaultTarget)}
        />
      )}

    </div>
  );
}


