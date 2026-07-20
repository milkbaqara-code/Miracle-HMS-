import React, { useState, useEffect } from 'react';

const overlayContainer: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(5, 8, 16, 0.85)',
  backdropFilter: 'blur(12px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  color: '#fff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const glassPanel: React.CSSProperties = {
  background: 'rgba(16, 24, 48, 0.45)',
  border: '1px solid rgba(16, 185, 129, 0.25)',
  boxShadow: '0 0 30px rgba(16, 185, 129, 0.1), inset 0 0 20px rgba(16, 185, 129, 0.05)',
  borderRadius: '16px',
  padding: '30px',
  width: '100%',
  maxWidth: '750px',
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: '20px',
  right: '20px',
  background: 'transparent',
  border: 'none',
  color: '#888',
  fontSize: '24px',
  cursor: 'pointer',
};

const sectionTitle: React.CSSProperties = {
  color: '#10b981',
  textShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
  fontSize: '20px',
  fontWeight: 'bold',
  marginBottom: '20px',
  borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
  paddingBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#9ca3af',
  marginBottom: '4px',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(5, 8, 16, 0.6)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
};

const actionBtn: React.CSSProperties = {
  background: '#10b981',
  color: '#050810',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 16px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer',
  boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
};

export default function DiagnosticsHub({ onClose }: { onClose: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [resultTextMap, setResultTextMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchOrders = () => {
    fetch('/api/hms/lab-orders')
      .then(res => res.json())
      .then(json => {
        if (json.status === 'SUCCESS') setOrders(json.data);
      })
      .catch(err => console.error("Error loading lab orders:", err));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handlePublish = async (oId: number) => {
    const text = resultTextMap[oId];
    if (!text) {
      alert("Please enter results before publishing.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/hms/lab-orders/${oId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result_text: text })
      });
      if (res.ok) {
        fetchOrders();
        setResultTextMap(prev => {
          const next = { ...prev };
          delete next[oId];
          return next;
        });
      } else {
        alert("Failed to publish results.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayContainer}>
      <div style={glassPanel}>
        <button style={closeBtn} onClick={onClose}>&times;</button>
        <div style={sectionTitle}>🔬 LIS LABORATORY DIAGNOSTICS CONTROL</div>
        
        {orders.length === 0 ? (
          <div style={{ color: '#888', padding: '30px 0', textAlign: 'center' }}>No diagnostic test orders logged.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: 'rgba(5, 8, 16, 0.4)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>{o.patient_name}</span>
                    <h4 style={{ margin: '4px 0', fontSize: '15px' }}>{o.test_name}</h4>
                    <span style={{ fontSize: '10px', color: '#888' }}>
                      Ordered at: {new Date(o.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: o.status === 'REPORTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: o.status === 'REPORTED' ? '#10b981' : '#f59e0b',
                    border: `1px solid ${o.status === 'REPORTED' ? '#10b981' : '#f59e0b'}`
                  }}>
                    {o.status}
                  </span>
                </div>

                {o.status === 'ORDERED' ? (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        style={inputStyle}
                        placeholder="Enter lab findings / pathology outcome..."
                        value={resultTextMap[o.id] || ''}
                        onChange={e => setResultTextMap({ ...resultTextMap, [o.id]: e.target.value })}
                      />
                    </div>
                    <button style={actionBtn} onClick={() => handlePublish(o.id)} disabled={loading}>
                      PUBLISH
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', background: 'rgba(5, 8, 16, 0.6)', padding: '10px', borderRadius: '6px', fontSize: '12px', borderLeft: '3px solid #10b981' }}>
                    <span style={labelStyle}>Reported Outcome</span>
                    <p style={{ margin: '4px 0 0 0', color: '#fff' }}>{o.result_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
