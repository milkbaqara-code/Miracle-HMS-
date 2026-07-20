'use client';
import React, { useState, useEffect, useCallback } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import UniversalCashierPOS from '../../components/UniversalPOS';

interface LabOrder {
  id: number;
  patient_name: string;
  test_name: string;
  status: string;
  result_text: string | null;
  created_at: string;
}

export default function LISLaboratoryPage() {
  const isViewMode = useViewMode();

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultInputs, setResultInputs] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'REPORTED'>('ALL');
  const [currentSection, setCurrentSection] = useState<'worklist' | 'billing'>('worklist');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hms/lab-orders');
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load LIS worklist:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handlePublish = async (oId: number) => {
    const text = resultInputs[oId];
    if (!text) {
      alert("Please enter results before publishing.");
      return;
    }

    try {
      const res = await fetch(`/api/hms/lab-orders/${oId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_text: text })
      });
      if (res.ok) {
        fetchOrders();
        setResultInputs(prev => {
          const next = { ...prev };
          delete next[oId];
          return next;
        });
      } else {
        alert("Failed to publish lab results.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'PENDING') return o.status === 'ORDERED';
    if (activeTab === 'REPORTED') return o.status === 'REPORTED';
    return true;
  });

  return (
    <div style={containerStyle}>
      <ViewModeBanner />
      
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🔬 LIS LABORATORY DIAGNOSTICS HUB</h1>
          <p style={subtitleStyle}>PATHOLOGY SPECIMEN MANAGEMENT & CLINICAL FINDINGS PORTAL</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{
              ...btnStyle,
              background: currentSection === 'worklist' ? '#39FF14' : 'rgba(57, 255, 20, 0.15)',
              color: currentSection === 'worklist' ? '#000' : '#39FF14'
            }} 
            onClick={() => setCurrentSection('worklist')}
          >
            📋 WORKLIST QUEUE
          </button>
          <button 
            style={{
              ...btnStyle,
              background: currentSection === 'billing' ? '#39FF14' : 'rgba(57, 255, 20, 0.15)',
              color: currentSection === 'billing' ? '#000' : '#39FF14'
            }} 
            onClick={() => setCurrentSection('billing')}
          >
            💸 LAB RECEPTION BILLING (POS)
          </button>
          <button style={btnStyle} onClick={fetchOrders}>🔄 REFRESH QUEUE</button>
        </div>
      </div>

      {currentSection === 'billing' ? (
        <UniversalCashierPOS 
          fixedTerminal="Z-17-LABS" 
          fixedTitle="DIAGNOSTIC LAB RECEPTION" 
          fixedSubtitle="PATHOLOGY & IMAGING | AUTONOMOUS CLINICAL ZONE" 
        />
      ) : (
        <>
          {/* FILTER TABS */}
          <div style={filterBar}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['ALL', 'PENDING', 'REPORTED'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={tabStyle(activeTab === tab)}
                >
                  {tab === 'PENDING' ? '📥 PENDING ANALYSES' : tab === 'REPORTED' ? '📤 PUBLISHED REPORTS' : '🗂️ ALL ORDERS'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ color: '#10b981', textAlign: 'center', padding: '50px' }}>Loading pathology worklist...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={emptyPanelStyle}>
              <div style={{ fontSize: '15px', color: '#888', fontStyle: 'italic' }}>
                No laboratory test orders found in this category.
              </div>
            </div>
          ) : (
            <div style={worklistStyle}>
              {filteredOrders.map(o => {
                const isPending = o.status === 'ORDERED';
                return (
                  <div key={o.id} style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <div>
                        <span style={patientNameStyle}>👤 {o.patient_name}</span>
                        <h3 style={testNameStyle}>{o.test_name}</h3>
                      </div>
                      <span style={statusBadgeStyle(o.status)}>
                        {o.status === 'ORDERED' ? 'PENDING SPECIMEN' : 'REPORT PUBLISHED'}
                      </span>
                    </div>

                    <div style={metaRowStyle}>
                      <span>Order Reference: #LAB-{o.id}</span>
                      <span>Received: {new Date(o.created_at).toLocaleString()}</span>
                    </div>

                    <div style={actionAreaStyle}>
                      {isPending ? (
                        <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
                          <div style={{ flex: 1 }}>
                            <textarea
                              style={textareaStyle}
                              placeholder="Document quantitative values, findings, or critical diagnostic observations..."
                              value={resultInputs[o.id] || ''}
                              onChange={e => setResultInputs({ ...resultInputs, [o.id]: e.target.value })}
                            />
                          </div>
                          <button style={publishBtnStyle} onClick={() => handlePublish(o.id)}>
                            PUBLISH REPORT
                          </button>
                        </div>
                      ) : (
                        <div style={outcomeBlockStyle}>
                          <span style={{ fontSize: '9px', color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase' }}>Published Laboratory Report Findings</span>
                          <p style={{ margin: '6px 0 0 0', color: '#fff', fontSize: '13px', whiteSpace: 'pre-line' }}>{o.result_text}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
  color: '#39FF14',
  textShadow: '0 0 10px rgba(57, 255, 20, 0.2)',
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
  background: 'rgba(57, 255, 20, 0.15)',
  border: '1px solid #39FF14',
  color: '#39FF14',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: '0.3s',
};

const filterBar: React.CSSProperties = {
  marginBottom: '25px',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  background: active ? '#39FF14' : 'rgba(255,255,255,0.02)',
  color: active ? '#000' : '#888',
  border: active ? '1px solid #39FF14' : '1px solid rgba(255,255,255,0.05)',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 'bold',
  cursor: 'pointer',
});

const emptyPanelStyle: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '16px',
  padding: '50px',
  textAlign: 'center',
  backdropFilter: 'blur(10px)',
};

const worklistStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(57, 255, 20, 0.15)',
  boxShadow: '0 0 20px rgba(57, 255, 20, 0.02)',
  borderRadius: '16px',
  padding: '20px',
  backdropFilter: 'blur(10px)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '10px',
};

const patientNameStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#39FF14',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const testNameStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#fff',
  margin: '4px 0 0 0',
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isPending = status === 'ORDERED';
  return {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: '4px',
    background: isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(57, 255, 20, 0.15)',
    color: isPending ? '#f59e0b' : '#39FF14',
    border: `1px solid ${isPending ? '#f59e0b' : '#39FF14'}`,
  };
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '20px',
  fontSize: '11px',
  color: '#888',
  marginBottom: '15px',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  paddingBottom: '10px',
};

const actionAreaStyle: React.CSSProperties = {
  display: 'flex',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(5, 8, 16, 0.8)',
  border: '1px solid rgba(57, 255, 20, 0.25)',
  borderRadius: '8px',
  padding: '10px',
  color: '#fff',
  outline: 'none',
  fontSize: '13px',
  minHeight: '60px',
  fontFamily: 'inherit',
};

const publishBtnStyle: React.CSSProperties = {
  background: '#39FF14',
  color: '#050810',
  border: 'none',
  borderRadius: '8px',
  padding: '0 20px',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer',
  height: '60px',
  boxShadow: '0 0 10px rgba(57, 255, 20, 0.2)',
};

const outcomeBlockStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(5, 8, 16, 0.5)',
  borderLeft: '4px solid #39FF14',
  padding: '12px 16px',
  borderRadius: '4px 8px 8px 4px',
};
