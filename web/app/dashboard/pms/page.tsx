'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api$/, '') || '';

interface Bed {
  id: string;
  type: string;
  rate: number;
  status: string;
  guest: string;
  guest_crm_id: string | null;
  folioBalance: number;
  primaryDept?: string;
  signals: Record<string, string>;
  isAlarm: boolean;
  isVortex: boolean;
}

export default function WardADTBoard() {
  const isViewMode = useViewMode();
  const { formatMoney } = useCurrencyLang();

  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<string>('');
  const [targetBed, setTargetBed] = useState<string>('');
  const [transferMode, setTransferMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchBeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/frontdesk/live-grid`);
      if (res.ok) {
        const json = await res.json();
        const rawGrid = json.data || json;
        // 🛡️ WARD SUB-BED ARCHITECTURE INJECTION
        const processed = rawGrid.map((r: any) => {
          if (r.assetClass === 'WARD' || r.type === 'WARD') {
            const subBeds = [];
            for (let i = 1; i <= 6; i++) {
              // Same logic as master grid: 1-3 occupied if WARD is occupied
              const isOcc = (r.status === 'IN-HOUSE' && i <= 3);
              subBeds.push({
                ...r,
                id: `${r.id}-B${i}`,
                type: 'SUB-BED',
                guest: isOcc ? r.guest : 'VACANT',
                status: isOcc ? 'IN-HOUSE' : 'AVAILABLE',
              });
            }
            return { ...r, subBeds };
          }
          return r;
        });
        setBeds(processed);
      }
    } catch (err) {
      console.error("Failed to fetch bed layout:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !targetBed) return;

    try {
      const res = await fetch('/api/hms/adt/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: selectedBed, target_bed_id: targetBed })
      });
      if (res.ok) {
        fetchBeds();
        setTransferMode(false);
        setSelectedBed('');
        setTargetBed('');
      } else {
        const err = await res.json();
        alert(err.detail || "Transfer failed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkClean = async (bedId: string) => {
    try {
      // Clean/Inspection resolver route
      const res = await fetch(`/api/solve/resolve/${bedId}?dept=HK`, { method: 'POST' });
      if (res.ok) {
        fetchBeds();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const departments = ['ALL', 'WARD', 'CABIN', 'ICU', 'EMERGENCY', 'OT'];
  const [activeDept, setActiveDept] = useState('ALL');

  const filteredBeds = beds.filter(b => {
    const deptMatch = activeDept === 'ALL' || b.type.toUpperCase().includes(activeDept) || (b.primaryDept && b.primaryDept.toUpperCase() === activeDept);
    const statusMatch = statusFilter === 'ALL' || b.status === statusFilter;
    return deptMatch && statusMatch;
  });

  return (
    <div style={containerStyle}>
      <ViewModeBanner />
      
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🏥 CLINICAL ADT WARD BOARD</h1>
          <p style={subtitleStyle}>ADMISSION, DISCHARGE, & BED TRANSFER CONTROL MATRIX</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={btnStyle} onClick={() => setTransferMode(!transferMode)}>
            {transferMode ? 'CANCEL ACTION' : '🔄 TRANSFER PATIENT'}
          </button>
          <button style={btnStyle} onClick={fetchBeds}>🔄 REFRESH BOARD</button>
        </div>
      </div>

      {transferMode && (
        <div style={transferPanelStyle}>
          <h3 style={{ margin: '0 0 15px 0', color: '#10b981', fontSize: '15px' }}>Initiate Patient Bed Reassignment</h3>
          <form onSubmit={handleTransfer} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Source Bed (Occupied)</label>
              <select style={selectStyle} value={selectedBed} onChange={e => setSelectedBed(e.target.value)} required>
                <option value="">-- Select Admitted Bed --</option>
                {beds.flatMap(b => (b.assetClass === 'WARD' || b.type === 'WARD') ? (b.subBeds || []) : [b])
                     .filter(b => b.status === 'IN-HOUSE').map(b => (
                  <option key={b.id} value={b.id}>{b.id} - {b.guest}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Target Bed (Vacant)</label>
              <select style={selectStyle} value={targetBed} onChange={e => setTargetBed(e.target.value)} required>
                <option value="">-- Select Available Bed --</option>
                {beds.flatMap(b => (b.assetClass === 'WARD' || b.type === 'WARD') ? (b.subBeds || []) : [b])
                     .filter(b => b.status === 'AVAILABLE' && b.id !== selectedBed).map(b => (
                  <option key={b.id} value={b.id}>{b.id} ({b.type})</option>
                ))}
              </select>
            </div>
            <button type="submit" style={submitBtnStyle}>EXECUTE ADT TRANSFER</button>
          </form>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div style={filterBar}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {departments.map(d => (
            <button
              key={d}
              onClick={() => setActiveDept(d)}
              style={tabStyle(activeDept === d)}
            >
              {d}
            </button>
          ))}
        </div>

        <select style={statusSelectStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">ALL STATUSES</option>
          <option value="AVAILABLE">AVAILABLE (VACANT)</option>
          <option value="IN-HOUSE">OCCUPIED (ADMITTED)</option>
          <option value="DIRTY">DIRTY (PENDING SANITATION)</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: '#10b981', textAlign: 'center', padding: '50px' }}>Loading real-time bed board...</div>
      ) : (
        <div style={gridStyle}>
          {filteredBeds.map(b => {
            if (b.assetClass === 'WARD' || b.type === 'WARD') {
              return (
                <div key={b.id} style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(5, 5, 10, 0.95)',
                  border: `1px solid rgba(16, 185, 129, 0.3)`,
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#10b981', letterSpacing: '2px' }}>{b.id} - CLINICAL WARD MACRO | <span style={{color: '#fff'}}>{b.status}</span></div>
                    <div style={{ fontSize: '14px', color: '#888', fontWeight: 800 }}>PRIMARY GUEST: {b.guest}</div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                    {b.subBeds?.map((sb: any) => {
                      const isOccupied = sb.status === 'IN-HOUSE';
                      const isDirty = sb.status === 'DIRTY';
                      
                      let cardBorder = 'rgba(255,255,255,0.05)';
                      let statusColor = '#aaa';
                      if (isOccupied) {
                        cardBorder = 'rgba(16, 185, 129, 0.3)';
                        statusColor = '#10b981';
                      } else if (isDirty) {
                        cardBorder = 'rgba(245, 158, 11, 0.3)';
                        statusColor = '#f59e0b';
                      }

                      return (
                        <div key={sb.id} style={{ ...cardStyle, border: `1px solid ${cardBorder}` }}>
                          <div style={cardHeaderStyle}>
                            <span style={bedIdStyle}>{sb.id}</span>
                            <span style={{ fontSize: '10px', color: statusColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {sb.status.replace('-', ' ')}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                            {sb.type}
                          </div>

                          <div style={patientBlockStyle}>
                            {isOccupied ? (
                              <>
                                <div style={patientNameStyle}>👤 {sb.guest}</div>
                                <div style={metaTextStyle}>Admitted Patient</div>
                                <div style={metaTextStyle}>Rate: {formatMoney(sb.rate || 0)} / day</div>
                              </>
                            ) : isDirty ? (
                              <>
                                <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>🧹 SANITIZING REQ</div>
                                <button style={cleanBtnStyle} onClick={() => handleMarkClean(sb.id)}>
                                  COMPLETE SANITATION
                                </button>
                              </>
                            ) : (
                              <div style={{ color: '#666', fontSize: '13px', fontStyle: 'italic' }}>Vacant Bed</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isOccupied = b.status === 'IN-HOUSE';
            const isDirty = b.status === 'DIRTY';
            
            let cardBorder = 'rgba(255,255,255,0.05)';
            let statusColor = '#aaa';
            if (isOccupied) {
              cardBorder = 'rgba(16, 185, 129, 0.3)';
              statusColor = '#10b981';
            } else if (isDirty) {
              cardBorder = 'rgba(245, 158, 11, 0.3)';
              statusColor = '#f59e0b';
            }

            return (
              <div key={b.id} style={{ ...cardStyle, border: `1px solid ${cardBorder}` }}>
                <div style={cardHeaderStyle}>
                  <span style={bedIdStyle}>{b.id}</span>
                  <span style={{ fontSize: '10px', color: statusColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {b.status.replace('-', ' ')}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                  {b.type}
                </div>

                <div style={patientBlockStyle}>
                  {isOccupied ? (
                    <>
                      <div style={patientNameStyle}>👤 {b.guest}</div>
                      <div style={metaTextStyle}>Admitted Patient</div>
                      <div style={metaTextStyle}>Rate: {formatMoney(b.rate)} / day</div>
                    </>
                  ) : isDirty ? (
                    <>
                      <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>🧹 SANITIZING REQ</div>
                      <button style={cleanBtnStyle} onClick={() => handleMarkClean(b.id)}>
                        COMPLETE SANITATION
                      </button>
                    </>
                  ) : (
                    <div style={{ color: '#666', fontSize: '13px', fontStyle: 'italic' }}>Vacant Bed</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Styling definitions
const containerStyle: React.CSSProperties = {
  padding: '30px',
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  background: 'transparent',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#10b981',
  textShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  margin: '5px 0 0 0',
  fontSize: '11px',
  color: '#aaa',
  letterSpacing: '1px',
};

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid #10b981',
  color: '#10b981',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: '0.3s',
};

const transferPanelStyle: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '25px',
  backdropFilter: 'blur(10px)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#aaa',
  marginBottom: '6px',
  textTransform: 'uppercase',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(5, 8, 16, 0.8)',
  border: '1px solid rgba(16, 185, 129, 0.25)',
  borderRadius: '8px',
  padding: '10px',
  color: '#fff',
  outline: 'none',
};

const submitBtnStyle: React.CSSProperties = {
  background: '#10b981',
  color: '#050810',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 20px',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer',
};

const filterBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '20px',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: active ? '#10b981' : 'rgba(255,255,255,0.02)',
  color: active ? '#000' : '#888',
  border: active ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.05)',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
});

const statusSelectStyle: React.CSSProperties = {
  background: 'rgba(5, 8, 16, 0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#aaa',
  borderRadius: '8px',
  padding: '6px 12px',
  outline: 'none',
  fontSize: '11px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '20px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(10, 15, 30, 0.45)',
  backdropFilter: 'blur(8px)',
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
};

const bedIdStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#fff',
};

const patientBlockStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: '10px',
  borderTop: '1px solid rgba(255,255,255,0.05)',
};

const patientNameStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#fff',
  marginBottom: '4px',
};

const metaTextStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#aaa',
  marginTop: '2px',
};

const cleanBtnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '10px',
  background: '#f59e0b',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  padding: '6px',
  fontSize: '10px',
  fontWeight: 'bold',
  cursor: 'pointer',
};
