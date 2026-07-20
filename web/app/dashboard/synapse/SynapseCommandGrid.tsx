'use client';
import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Department {
  id: number;
  code: string;
  name: string;
  category: string;
  manager_id: string | null;
}

interface SignalData {
  department: string;
  active_nodes: number;
  critical_nodes: number;
  signal_color: string; // #00fbff, #ff3366, #d4af37, #555
  pulse: boolean;
}

interface SynapseCommandGridProps {
  token: string;
}

interface HoldingNode {
  directiveTitle: string;
  taskName: string;
  assignedTo: string;
  priority: string;
}

export default function SynapseCommandGrid({ token }: SynapseCommandGridProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [signals, setSignals] = useState<Record<string, SignalData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [holdingNodes, setHoldingNodes] = useState<HoldingNode[]>([]);
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  useEffect(() => {
    fetchGrid();
    const interval = setInterval(fetchGrid, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchGrid = async () => {
    try {
      // Fetch the departments
      const deptRes = await fetch(`${API}/synapse/grid/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const deptData = await deptRes.json();
      if (deptData.status === 'SUCCESS') {
        setDepartments(deptData.departments);
      }

      // Fetch the live matrix signals
      const sigRes = await fetch(`${API}/synapse/grid/live-matrix`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sigData = await sigRes.json();
      if (sigData.data) {
        const sigMap: Record<string, SignalData> = {};
        sigData.data.forEach((s: any) => {
          sigMap[s.name] = {
            department: s.name,
            active_nodes: s.pulse_state === 'ACTION_REQUIRED' ? s.pending_nodes : (s.pulse_state === 'CRITICAL' ? 0 : s.pending_nodes),
            critical_nodes: s.pulse_state === 'CRITICAL' ? s.pending_nodes : 0,
            signal_color: s.signal_color || '#333',
            pulse: s.pulse_state !== 'NORMAL'
          };
        });
        setSignals(sigMap);
      }
    } catch (e) {
      console.error("Error fetching Command Grid:", e);
    }
    setLoading(false);
  };

  const fetchHoldingNodes = async (deptCode: string) => {
    setLoadingOverlay(true);
    try {
      const res = await fetch(`${API}/synapse/directives`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'SUCCESS' && data.directives) {
        const list: HoldingNode[] = [];
        data.directives.forEach((d: any) => {
          (d.nodes || []).forEach((n: any) => {
            // FIX: Filter by dept.code (target_dept stores code, not full name)
            if (!n.is_completed && n.target_dept === deptCode) {
              list.push({
                directiveTitle: d.title,
                taskName: n.task,
                assignedTo: n.assigned_to_id || 'Unassigned',
                priority: d.priority
              });
            }
          });
        });
        setHoldingNodes(list);
      }
    } catch (e) {
      console.error("Error fetching holding nodes:", e);
    }
    setLoadingOverlay(false);
  };

  const handleTileClick = (dept: Department) => {
    setSelectedDept(dept);
    // Pass dept.code so it matches what target_dept stores in the DB
    fetchHoldingNodes(dept.code);
  };

  const getDeptColor = (category: string) => {
    switch(category) {
      case 'OPERATIONAL': return '#a855f7'; // Purple
      case 'ADMINISTRATIVE': return '#00fbff'; // Cyan
      case 'EXECUTIVE': return '#D4AF37'; // Gold
      default: return '#555';
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#00fbff', fontSize: '11px', fontWeight: 900, textAlign: 'center' }}>PULSING GRID...</div>;
  }

  return (
    <div style={{ position: 'relative', minHeight: '400px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {departments.map((dept) => {
          const sig = signals[dept.name] || { active_nodes: 0, critical_nodes: 0, signal_color: '#333', pulse: false };
          const hasCritical = sig.critical_nodes > 0;
          const hasActive = sig.active_nodes > 0 && !hasCritical;

          let tileClass = "synapse-dept-tile";
          if (hasCritical) tileClass += " has-critical-nodes";
          else if (hasActive) tileClass += " has-active-nodes";

          return (
            <div 
              key={dept.id} 
              className={tileClass}
              onClick={() => handleTileClick(dept)}
              style={{
                borderRadius: '12px',
                padding: '16px', 
                textAlign: 'center', 
                position: 'relative',
                transition: '0.3s',
                cursor: 'pointer',
                borderWidth: '1px',
                borderStyle: 'solid',
                WebkitBackdropFilter: 'blur(10px)'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 900, color: getDeptColor(dept.category), letterSpacing: '2px', marginBottom: '8px' }}>
                {dept.code}
              </div>
              
              <div style={{ fontFamily: 'Cinzel', fontSize: '20px', fontWeight: 900, color: '#FFF', textShadow: `0 0 10px ${sig.signal_color}88`, marginBottom: '4px' }}>
                {dept.name}
              </div>
              
              <div style={{ fontSize: '8px', color: '#888', letterSpacing: '1px', marginBottom: '16px' }}>
                {dept.category}
              </div>

              {/* Neon Pending/Critical Badges */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {sig.active_nodes > 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 900, color: '#00fbff',
                    background: 'rgba(0, 251, 255, 0.1)', border: '1px solid rgba(0, 251, 255, 0.3)',
                    padding: '2px 8px', borderRadius: '4px', textShadow: '0 0 5px #00fbff'
                  }}>
                    [ {sig.active_nodes} PENDING ]
                  </span>
                )}
                {sig.critical_nodes > 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 900, color: '#ff3366',
                    background: 'rgba(255, 51, 102, 0.1)', border: '1px solid rgba(255, 51, 102, 0.3)',
                    padding: '2px 8px', borderRadius: '4px', textShadow: '0 0 5px #ff3366'
                  }}>
                    🚨 [ {sig.critical_nodes} CRITICAL ]
                  </span>
                )}
                {sig.active_nodes === 0 && sig.critical_nodes === 0 && (
                  <span style={{
                    fontSize: '9px', color: '#555',
                    background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '2px 8px', borderRadius: '4px'
                  }}>
                    SECURED
                  </span>
                )}
              </div>

              {/* Neon Pulse Signal LED */}
              <div style={{
                position: 'absolute', top: '12px', right: '12px', width: '8px', height: '8px', borderRadius: '50%',
                background: sig.signal_color,
                boxShadow: sig.pulse ? `0 0 10px ${sig.signal_color}` : 'none',
              }} />
            </div>
          );
        })}
      </div>

      {/* Slide-out Overlay */}
      {selectedDept && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px',
          background: 'rgba(10, 10, 15, 0.98)', borderLeft: '1px solid rgba(0, 251, 255, 0.2)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.8)', zIndex: 10000, padding: '24px',
          display: 'flex', flexDirection: 'column',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontFamily: 'Cinzel', color: '#D4AF37', margin: 0, fontSize: '20px' }}>{selectedDept.name}</h2>
              <p style={{ fontSize: '9px', color: '#00fbff', letterSpacing: '1px', margin: '4px 0 0 0' }}>DEPARTMENTAL BLOCKERS</p>
            </div>
            <button 
              onClick={() => setSelectedDept(null)}
              style={{
                background: 'none', border: 'none', color: '#FF3131', fontSize: '20px', cursor: 'pointer',
                fontWeight: 900
              }}
            >×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingOverlay ? (
              <div style={{ color: '#00fbff', fontSize: '11px', textAlign: 'center', padding: '20px' }}>FETCHING MATRIX TELEMETRY...</div>
            ) : holdingNodes.length === 0 ? (
              <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', padding: '40px' }}>NO ACTIVE BLOCKERS ON RECORD</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {holdingNodes.map((n, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px', padding: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 900, color: n.priority === 'CRITICAL' ? '#ff3366' : '#D4AF37' }}>
                        {n.priority}
                      </span>
                      <span style={{ fontSize: '9px', color: '#888' }}>
                        👤 {n.assignedTo}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#FFF', fontWeight: 700, marginBottom: '4px' }}>
                      {n.taskName}
                    </div>
                    <div style={{ fontSize: '9px', color: '#666' }}>
                      Directive: {n.directiveTitle}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
