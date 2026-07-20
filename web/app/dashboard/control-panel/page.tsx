'use client';

import React, { useState, useEffect } from 'react';

interface Tenant {
  id: number;
  tenant_id: string;
  entity_name: string;
  package_id: string;
  allowed_zones: string[];
  status: string;
  subscription_expires_at: string | null;
  whatsapp: string | null;
  email: string | null;
  db_size_mb: number;
  created_at: string | null;
  last_login_at: string | null;
}

interface SystemHealth {
  cpu_pct: number;
  mem_pct: number;
  disk_pct: number;
  platform: string;
  status: string;
}

export default function ControlPanelPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  // Provision Form State
  const [tenantId, setTenantId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [packageId, setPackageId] = useState('FB_SUITE');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_URL}/ctrl/tenants`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('miracle_token')}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          setTenants(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/ctrl/system-health`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('miracle_token')}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          setHealth(data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to fetch health:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTenants(), fetchHealth()]);
      setLoading(false);
    };
    loadData();
    
    // Auto-refresh metrics every 15 seconds
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (tid: string, currentStatus: string) => {
    const action = currentStatus === 'ACTIVE' ? 'suspend' : 'activate';
    setActionLoading(tid);
    try {
      const res = await fetch(`${API_URL}/ctrl/tenant/${tid}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('miracle_token')}`,
        }
      });
      if (res.ok) {
        await fetchTenants();
      }
    } catch (err) {
      console.error(`Failed to ${action} tenant:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtend = async (tid: string, days: number) => {
    setActionLoading(`${tid}-extend-${days}`);
    try {
      const res = await fetch(`${API_URL}/ctrl/tenant/${tid}/extend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('miracle_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days })
      });
      if (res.ok) {
        await fetchTenants();
      }
    } catch (err) {
      console.error('Failed to extend subscription:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setActionLoading('provision');

    if (!tenantId || !entityName || !email || !whatsapp || !adminPassword) {
      setFormError('All fields are required.');
      setActionLoading(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/tenant/provision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('miracle_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          entity_name: entityName,
          package_id: packageId,
          email,
          whatsapp,
          admin_password: adminPassword,
        })
      });

      const data = await res.json();
      if (res.ok) {
        setFormSuccess(`SUCCESS! Isolated DB provisioned. Creds: admin / ${adminPassword}`);
        setTenantId('');
        setEntityName('');
        setEmail('');
        setWhatsapp('');
        setAdminPassword('');
        await fetchTenants();
      } else {
        setFormError(data.detail || 'Provisioning failed.');
      }
    } catch (err) {
      setFormError('Failed to connect to provisioner API.');
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate MRR / ARR from active clients
  const activeCount = tenants.filter(t => t.status === 'ACTIVE').length;
  const packagePrices: Record<string, number> = {
    FB_SUITE: 1200,
    SPA_SUITE: 1200,
    BOUTIQUE: 1200,
    FLEET_SUITE: 1050,
    HOTEL_PRO: 2550,
    ENTERPRISE: 4500
  };
  
  const mrr = tenants
    .filter(t => t.status === 'ACTIVE')
    .reduce((sum, t) => sum + (packagePrices[t.package_id] || 0), 0);
  const arr = mrr * 12;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .ctrl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .ctrl-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 20px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .ctrl-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: var(--glow-color, rgba(0, 242, 255, 0.4));
        }
        .ctrl-metric-val {
          font-family: 'Orbitron', monospace;
          font-size: 24px;
          font-weight: 700;
          margin-top: 8px;
          text-shadow: 0 0 10px var(--glow-color, rgba(0, 242, 255, 0.2));
        }
        .ctrl-table-container {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          overflow-x: auto;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          margin-bottom: 32px;
        }
        .ctrl-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .ctrl-table th {
          background: rgba(255, 255, 255, 0.03);
          padding: 14px 16px;
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .ctrl-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }
        .ctrl-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 700;
          font-family: 'Orbitron', monospace;
          letter-spacing: 1px;
        }
        .ctrl-badge.active { background: rgba(57, 255, 20, 0.1); color: #39ff14; border: 1px solid rgba(57, 255, 20, 0.2); }
        .ctrl-badge.suspended { background: rgba(255, 49, 49, 0.1); color: #ff3131; border: 1px solid rgba(255, 49, 49, 0.2); }
        .ctrl-badge.expired { background: rgba(255, 140, 0, 0.1); color: #ff8c00; border: 1px solid rgba(255, 140, 0, 0.2); }
        
        .ctrl-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-family: 'Orbitron', monospace;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .ctrl-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .ctrl-btn.primary {
          background: rgba(0, 242, 255, 0.1);
          border-color: rgba(0, 242, 255, 0.3);
          color: #00f2ff;
        }
        .ctrl-btn.primary:hover {
          background: rgba(0, 242, 255, 0.2);
          border-color: rgba(0, 242, 255, 0.5);
        }
        .ctrl-input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 10px 14px;
          color: white;
          width: 100%;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .ctrl-input:focus {
          border-color: #00f2ff;
        }
        .ctrl-select {
          background: rgba(4, 4, 14, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 10px 14px;
          color: white;
          width: 100%;
          font-size: 13px;
          outline: none;
        }
        .ctrl-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
        }
        .ctrl-modal {
          background: #060614;
          border: 1px solid rgba(0, 242, 255, 0.2);
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          padding: 32px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
          position: relative;
        }
      `}} />

      <div style={{ padding: '24px', minHeight: '100vh', background: '#020208', color: '#FFF' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'Orbitron', fontSize: '24px', letterSpacing: '2px', color: '#D4AF37' }}>
              🛡️ VIGILANT CONTROL PANEL
            </h1>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
              Sovereign Multi-Tenant SaaS Administration Command
            </p>
          </div>
          <button className="ctrl-btn primary" style={{ padding: '10px 20px' }} onClick={() => setShowProvisionModal(true)}>
            ＋ PROVISION ENTERPRISE DB
          </button>
        </div>

        {/* Stats Grid */}
        <div className="ctrl-grid">
          <div className="ctrl-card" style={{ '--glow-color': '#00f2ff' } as React.CSSProperties}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '1px' }}>MONTHLY RECURRING REVENUE</div>
            <div className="ctrl-metric-val" style={{ color: '#00f2ff' }}>${mrr.toLocaleString()}</div>
          </div>
          <div className="ctrl-card" style={{ '--glow-color': '#39ff14' } as React.CSSProperties}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '1px' }}>ANNUAL RECURRING REVENUE</div>
            <div className="ctrl-metric-val" style={{ color: '#39ff14' }}>${arr.toLocaleString()}</div>
          </div>
          <div className="ctrl-card" style={{ '--glow-color': '#D4AF37' } as React.CSSProperties}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '1px' }}>ACTIVE CLIENT DATABASES</div>
            <div className="ctrl-metric-val" style={{ color: '#D4AF37' }}>{activeCount} / {tenants.length}</div>
          </div>
          <div className="ctrl-card" style={{ '--glow-color': '#9D00FF' } as React.CSSProperties}>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '1px' }}>VPS SERVER STATUS</div>
            <div className="ctrl-metric-val" style={{ color: '#9D00FF', fontSize: '13px', display: 'flex', gap: '8px', flexDirection: 'column', marginTop: '12px' }}>
              <div>CPU: {health?.cpu_pct ?? '--'}% | RAM: {health?.mem_pct ?? '--'}%</div>
              <div>Disk Usage: {health?.disk_pct ?? '--'}%</div>
            </div>
          </div>
        </div>

        {/* Client Database Table */}
        <h2 style={{ fontFamily: 'Orbitron', fontSize: '15px', letterSpacing: '1px', marginBottom: '16px', color: 'rgba(255, 255, 255, 0.8)' }}>
          MANAGED CLIENT INSTANCES
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255, 255, 255, 0.4)' }}>
            Retrieving database registry telemetry...
          </div>
        ) : (
          <div className="ctrl-table-container">
            <table className="ctrl-table">
              <thead>
                <tr>
                  <th>CLIENT ID</th>
                  <th>BUSINESS NAME</th>
                  <th>PACKAGE</th>
                  <th>STATUS</th>
                  <th>EXPIRY DATE</th>
                  <th>DB SIZE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.tenant_id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#00f2ff' }}>{t.tenant_id}</td>
                    <td style={{ fontWeight: '500' }}>{t.entity_name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{t.package_id}</td>
                    <td>
                      <span className={`ctrl-badge ${t.status.toLowerCase()}`}>{t.status}</span>
                    </td>
                    <td>{t.subscription_expires_at ? new Date(t.subscription_expires_at).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{t.db_size_mb} MB</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          className="ctrl-btn" 
                          onClick={() => handleStatusChange(t.tenant_id, t.status)}
                          disabled={actionLoading === t.tenant_id}
                        >
                          {t.status === 'ACTIVE' ? '⏸ SUSPEND' : '▶ ACTIVATE'}
                        </button>
                        <button 
                          className="ctrl-btn"
                          onClick={() => handleExtend(t.tenant_id, 30)}
                          disabled={actionLoading?.startsWith(t.tenant_id)}
                        >
                          ＋30D
                        </button>
                        <button 
                          className="ctrl-btn"
                          onClick={() => handleExtend(t.tenant_id, 365)}
                          disabled={actionLoading?.startsWith(t.tenant_id)}
                        >
                          ＋365D
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'rgba(255, 255, 255, 0.3)' }}>
                      No active client databases provisioned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Provisioning Modal */}
        {showProvisionModal && (
          <div className="ctrl-modal-overlay">
            <div className="ctrl-modal">
              <h3 style={{ fontFamily: 'Orbitron', fontSize: '18px', letterSpacing: '1px', marginBottom: '20px', color: '#00f2ff' }}>
                PROVISION CLIENT ENVIRONMENT
              </h3>

              {formError && (
                <div style={{ background: 'rgba(255, 49, 49, 0.1)', border: '1px solid #ff3131', color: '#ff3131', padding: '12px', borderRadius: '10px', fontSize: '12px', marginBottom: '16px' }}>
                  ⚠️ {formError}
                </div>
              )}

              {formSuccess && (
                <div style={{ background: 'rgba(57, 255, 20, 0.1)', border: '1px solid #39ff14', color: '#39ff14', padding: '12px', borderRadius: '10px', fontSize: '12px', marginBottom: '16px' }}>
                  ✅ {formSuccess}
                </div>
              )}

              <form onSubmit={handleProvision} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px' }}>TENANT UNIQUE ID (Lowercase, no spaces)</label>
                  <input className="ctrl-input" placeholder="e.g. coffee-house" value={tenantId} onChange={e => setTenantId(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px' }}>BUSINESS / ENTITY NAME</label>
                  <input className="ctrl-input" placeholder="e.g. Coffee House Cafe" value={entityName} onChange={e => setEntityName(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px' }}>PACKAGE SUITE</label>
                  <select className="ctrl-select" value={packageId} onChange={e => setPackageId(e.target.value)}>
                    <option value="FB_SUITE">🍽️ F&B Suite ($1,200/mo)</option>
                    <option value="SPA_SUITE">🧬 Spa Suite ($1,200/mo)</option>
                    <option value="BOUTIQUE">🛍️ Boutique Suite ($1,200/mo)</option>
                    <option value="FLEET_SUITE">🚁 Fleet Suite ($1,050/mo)</option>
                    <option value="HOTEL_PRO">🏢 Hotel Pro ($2,550/mo)</option>
                    <option value="ENTERPRISE">🌐 Enterprise Custom ($4,500/mo)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px' }}>OWNER EMAIL</label>
                  <input className="ctrl-input" type="email" placeholder="owner@business.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px' }}>OWNER WHATSAPP NUMBER</label>
                  <input className="ctrl-input" placeholder="+88017XXXXXXXX" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'block', marginBottom: '6px' }}>INITIAL ADMIN PASSWORD</label>
                  <input className="ctrl-input" type="password" placeholder="••••••••" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="ctrl-btn" style={{ flex: 1, padding: '12px' }} onClick={() => { setShowProvisionModal(false); setFormError(''); setFormSuccess(''); }}>
                    CLOSE
                  </button>
                  <button type="submit" className="ctrl-btn primary" style={{ flex: 1, padding: '12px' }} disabled={actionLoading === 'provision'}>
                    {actionLoading === 'provision' ? 'PROVISIONING...' : 'PROVISION NOW'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
