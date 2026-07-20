// web/app/dashboard/crm/page.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useCurrencyLang } from '../../components/CurrencyLangContext';

const API = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

interface CRMProfile {
  id: string; full_name: string; phone: string; email: string;
  total_ltv: number; total_stays: number; vip_tier: string; preferences: string[];
}

interface SalesLead {
  id: number; lead_name: string; enterprise_name: string; enterprise_size: string;
  contact_details: string; status: string; visit_count: number;
  created_at: string; last_visited_at: string;
}

export default function RoyalCRMDashboard() {
  const [tab, setTab]             = useState<'GUESTS' | 'SALES_LEADS'>('GUESTS');
  const [profiles, setProfiles]   = useState<CRMProfile[]>([]);
  const [leads, setLeads]         = useState<SalesLead[]>([]);
  const [searchQuery, setSearch]  = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const isViewMode                = useViewMode();
  const { formatMoney }           = useCurrencyLang();

  useEffect(() => { fetchGuests(); fetchLeads(); }, []);

  const fetchGuests = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API}/frontdesk/crm-profiles`);
      const json = await res.json();
      if (json.status === 'SUCCESS') setProfiles(json.data);
    } catch (e) { console.error('CRM FETCH:', e); }
    finally { setIsSyncing(false); }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${API}/visitor/leads`);
      if (res.ok) { const json = await res.json(); if (json.leads) setLeads(json.leads); }
    } catch (e) { console.error('LEADS FETCH:', e); }
  };

  const filteredGuests = useMemo(() =>
    profiles.filter(p =>
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
    ), [profiles, searchQuery]);

  const filteredLeads = useMemo(() =>
    leads.filter(l =>
      l.lead_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.enterprise_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.contact_details.includes(searchQuery)
    ), [leads, searchQuery]);

  const totalVaultValue = useMemo(() => profiles.reduce((s, p) => s + p.total_ltv, 0), [profiles]);
  const totalVIPs       = useMemo(() => profiles.filter(p => p.vip_tier !== 'STANDARD').length, [profiles]);
  const newLeads        = useMemo(() => leads.filter(l => l.status === 'NEW').length, [leads]);
  const returningLeads  = useMemo(() => leads.filter(l => l.status === 'RETURNING').length, [leads]);

  const statusColor = (s: string) =>
    s === 'NEW' ? '#00FF88' : s === 'RETURNING' ? '#D4AF37' : s === 'CONVERTED' ? '#00F2FF' : '#888';

  return (
    <div className={`crm-app-container${isViewMode ? ' zone-view-mode' : ''}`}>
      <ViewModeBanner />

      {/* HUD HEADER */}
      <div className="hud-header">
        <div>
          <h1 className="hud-title">{tab === 'GUESTS' ? 'GUEST CRM VAULT' : 'SALES LEADS CRM'}</h1>
          <div className="hud-subtitle">
            {tab === 'GUESTS' ? 'SOVEREIGN LIFETIME VALUE TRACKING • ZONE 10' : 'VISITOR PIPELINE & ENTERPRISE LEAD CAPTURE • Z-LOGIN'}
          </div>
        </div>
        <div className="hud-actions">
          {tab === 'GUESTS' ? <>
            <div className="kpi-box"><span className="kpi-label">TOTAL VAULT VALUE</span><span className="kpi-value gold-text">{formatMoney(totalVaultValue)}</span></div>
            <div className="kpi-box"><span className="kpi-label">VIP ENTITIES</span><span className="kpi-value">{totalVIPs} / {profiles.length}</span></div>
          </> : <>
            <div className="kpi-box"><span className="kpi-label">NEW LEADS</span><span className="kpi-value" style={{color:'#00FF88'}}>{newLeads}</span></div>
            <div className="kpi-box"><span className="kpi-label">RETURNING</span><span className="kpi-value gold-text">{returningLeads}</span></div>
            <div className="kpi-box"><span className="kpi-label">TOTAL PIPELINE</span><span className="kpi-value">{leads.length}</span></div>
          </>}
          <button onClick={tab === 'GUESTS' ? fetchGuests : fetchLeads} disabled={isSyncing} className="refresh-btn">
            {isSyncing ? 'SYNCING...' : '🔄 REFRESH'}
          </button>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div style={{display:'flex', gap:'12px', marginBottom:'25px'}}>
        <button onClick={()=>{setTab('GUESTS');setSearch('');}} className={`crm-tab ${tab==='GUESTS'?'active':''}`} id="crm-tab-guests">
          👥 GUEST CRM
          <span className="tab-count">{profiles.length}</span>
        </button>
        <button onClick={()=>{setTab('SALES_LEADS');setSearch('');}} className={`crm-tab ${tab==='SALES_LEADS'?'active-leads':''}`} id="crm-tab-leads">
          🎯 SALES LEADS
          {newLeads > 0 && <span className="tab-badge">{newLeads} NEW</span>}
        </button>
      </div>

      {/* SEARCH */}
      <div className="search-container" style={{marginBottom:'20px'}}>
        <div className="search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input className="search-input"
          placeholder={tab === 'GUESTS' ? 'SEARCH BY NAME, EMAIL OR UUID...' : 'SEARCH BY NAME, ENTERPRISE OR PHONE...'}
          value={searchQuery} onChange={e=>setSearch(e.target.value)} />
      </div>

      {/* ══ GUEST CRM TABLE ══════════════════════════════════ */}
      {tab === 'GUESTS' && (
        <div className="royal-table-container hide-scroll">
          <table className="royal-table">
            <thead><tr>
              <th>ID SIGNAL</th><th>GUEST NAME</th><th>CONTACT RECORD</th>
              <th>LIFETIME VALUE</th><th>TOTAL STAYS</th><th>VIP TIER</th><th>PREFERENCES</th>
            </tr></thead>
            <tbody>
              {filteredGuests.length > 0 ? filteredGuests.map(p => {
                const isVIP = p.vip_tier !== 'STANDARD' || p.total_ltv > 50000;
                return (
                  <tr key={p.id} className={isVIP ? 'vip-row' : ''}>
                    <td className="uuid-cell">{p.id.substring(0,8)}...</td>
                    <td className="name-cell">{p.full_name}{isVIP && <span className="vip-badge">VIP</span>}</td>
                    <td className="contact-cell">
                      {p.phone !== 'N/A' && <div>📞 {p.phone}</div>}
                      {p.email !== 'N/A' && <div>✉️ {p.email}</div>}
                      {p.phone === 'N/A' && p.email === 'N/A' && <span style={{opacity:0.3}}>UNVERIFIED</span>}
                    </td>
                    <td className="gold-text ltv-cell">{formatMoney(p.total_ltv)}</td>
                    <td className="stays-cell">{p.total_stays}</td>
                    <td><span className={`tier-badge tier-${p.vip_tier.toLowerCase()}`}>{p.vip_tier}</span></td>
                    <td className="prefs-cell">
                      {p.preferences.length > 0
                        ? <div className="prefs-list">{p.preferences.map((pref,i)=><span key={i} className="pref-tag">{pref}</span>)}</div>
                        : <span style={{opacity:0.3}}>NONE RECORDED</span>}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="empty-state">
                  <div className="empty-title">NO ENTITIES FOUND</div>
                  <div className="empty-subtitle">The CRM matrix returned 0 results for this criteria.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ SALES LEADS TABLE ════════════════════════════════ */}
      {tab === 'SALES_LEADS' && (
        <div className="royal-table-container hide-scroll">
          <table className="royal-table">
            <thead><tr>
              <th>#</th><th>LEAD NAME</th><th>ENTERPRISE</th><th>TEAM SIZE</th>
              <th>CONTACT (WhatsApp)</th><th>STATUS</th><th>VISITS</th><th>FIRST CONTACT</th><th>LAST SEEN</th>
            </tr></thead>
            <tbody>
              {filteredLeads.length > 0 ? filteredLeads.map(l => (
                <tr key={l.id} className={l.status === 'RETURNING' ? 'vip-row' : ''}>
                  <td className="uuid-cell">#{l.id}</td>
                  <td className="name-cell">
                    {l.lead_name}
                    {l.status === 'RETURNING' && <span className="vip-badge" style={{background:'rgba(212,175,55,0.2)',color:'#D4AF37',border:'1px solid #D4AF37'}}>↩ RETURNING</span>}
                  </td>
                  <td style={{color:'#FFF',fontWeight:700}}>{l.enterprise_name}</td>
                  <td style={{color:'#888',fontSize:'12px'}}>{l.enterprise_size}</td>
                  <td className="contact-cell">
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <span>📱 {l.contact_details}</span>
                      <a href={`https://wa.me/${l.contact_details.replace('+','')}`} target="_blank" rel="noreferrer"
                        style={{fontSize:'9px',padding:'3px 8px',border:'1px solid #39FF14',borderRadius:'4px',color:'#39FF14',textDecoration:'none',fontWeight:900}}>
                        WA →
                      </a>
                    </div>
                  </td>
                  <td>
                    <span style={{fontSize:'10px',fontWeight:900,padding:'5px 10px',borderRadius:'20px',border:`1px solid ${statusColor(l.status)}`,color:statusColor(l.status)}}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{color:'#00F2FF',fontWeight:900,textAlign:'center'}}>{l.visit_count}×</td>
                  <td style={{color:'#555',fontSize:'11px'}}>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{color:'#888',fontSize:'11px'}}>{l.last_visited_at ? new Date(l.last_visited_at).toLocaleDateString() : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="empty-state">
                  <div className="empty-title">NO LEADS CAPTURED YET</div>
                  <div className="empty-subtitle">Leads appear here when visitors use the OTP form on the login portal.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scroll::-webkit-scrollbar{display:none;} .hide-scroll{-ms-overflow-style:none;scrollbar-width:none;}
        .crm-app-container{padding:25px;max-width:1920px;margin:0 auto;min-height:100vh;background:#030303;font-family:system-ui,sans-serif;display:flex;flex-direction:column;}
        .hud-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:25px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.05);flex-wrap:wrap;gap:15px;}
        .hud-title{font-family:'Cinzel',serif;color:#FFF;margin:0 0 5px;font-size:clamp(20px,4vw,32px);letter-spacing:4px;text-shadow:0 0 20px rgba(212,175,55,0.3);}
        .hud-subtitle{color:#00F2FF;font-size:11px;font-weight:900;letter-spacing:2px;opacity:0.8;}
        .hud-actions{display:flex;align-items:stretch;gap:12px;flex-wrap:wrap;}
        .kpi-box{display:flex;flex-direction:column;justify-content:center;padding:10px 18px;background:rgba(20,20,20,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:12px;min-width:120px;text-align:right;}
        .kpi-label{color:#888;font-size:8px;font-weight:900;letter-spacing:2px;margin-bottom:4px;}
        .kpi-value{color:#FFF;font-size:18px;font-weight:800;font-family:'Cinzel',serif;}
        .gold-text{color:#D4AF37!important;text-shadow:0 0 10px rgba(212,175,55,0.4);}
        .refresh-btn{background:#111;color:#FFF;border:1px solid #333;padding:0 20px;border-radius:12px;cursor:pointer;font-size:11px;font-weight:900;letter-spacing:1px;transition:0.3s;}
        .refresh-btn:hover:not(:disabled){background:#D4AF37;color:#000;border-color:#D4AF37;box-shadow:0 0 15px rgba(212,175,55,0.4);}
        .crm-tab{position:relative;padding:12px 20px;border-radius:12px;font-weight:900;font-size:12px;cursor:pointer;letter-spacing:1px;border:1px solid rgba(255,255,255,0.07);background:rgba(15,15,15,0.6);color:#555;transition:0.3s;display:flex;align-items:center;gap:8px;}
        .crm-tab.active{background:rgba(212,175,55,0.08);border-color:#D4AF37;color:#D4AF37;}
        .crm-tab.active-leads{background:rgba(0,255,136,0.08);border-color:#00FF88;color:#00FF88;}
        .tab-count{background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:10px;font-size:10px;}
        .tab-badge{background:rgba(255,49,49,0.2);color:#FF3131;border:1px solid #FF3131;padding:2px 8px;border-radius:10px;font-size:9px;animation:pulse 2s infinite;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
        .search-container{position:relative;}
        .search-icon{position:absolute;left:24px;top:50%;transform:translateY(-50%);color:#D4AF37;pointer-events:none;}
        .search-input{width:100%;height:56px;background:rgba(15,15,15,0.6);backdrop-filter:blur(15px);border:1px solid rgba(212,175,55,0.2);border-radius:14px;color:#FFF;padding:0 20px 0 60px;font-size:14px;font-weight:500;outline:none;transition:0.3s;box-shadow:0 10px 30px rgba(0,0,0,0.5);box-sizing:border-box;}
        .search-input:focus{border-color:#D4AF37;box-shadow:0 0 0 2px rgba(212,175,55,0.1);}
        .royal-table-container{flex:1;border-radius:18px;border:1px solid rgba(255,255,255,0.05);background:rgba(10,10,10,0.4);backdrop-filter:blur(25px);overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.8);}
        .royal-table{width:100%;border-collapse:separate;border-spacing:0;}
        .royal-table th{position:sticky;top:0;background:rgba(5,5,5,0.97);backdrop-filter:blur(10px);padding:18px 20px;text-align:left;color:#D4AF37;font-size:9px;font-weight:900;letter-spacing:2px;border-bottom:1px solid rgba(212,175,55,0.2);z-index:10;white-space:nowrap;}
        .royal-table td{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.02);color:#AAA;font-size:13px;vertical-align:middle;}
        .royal-table tr:hover td{background:rgba(255,255,255,0.02);}
        .vip-row td{background:linear-gradient(90deg,rgba(212,175,55,0.02) 0%,transparent 100%);}
        .vip-row:hover td{background:linear-gradient(90deg,rgba(212,175,55,0.05) 0%,rgba(255,255,255,0.02) 100%);}
        .uuid-cell{font-family:monospace;color:#555!important;font-size:11px!important;letter-spacing:1px;}
        .name-cell{color:#FFF!important;font-weight:800;font-size:15px!important;display:flex;align-items:center;gap:10px;white-space:nowrap;}
        .vip-badge{background:linear-gradient(135deg,#FFD700,#D4AF37);color:#000;font-size:8px;font-weight:900;padding:3px 8px;border-radius:4px;letter-spacing:1px;flex-shrink:0;}
        .contact-cell{font-size:12px!important;color:#888;line-height:1.7;}
        .ltv-cell{font-size:17px!important;font-weight:900;font-family:'Cinzel',serif;}
        .stays-cell{font-weight:900;font-size:15px!important;color:#FFF!important;}
        .tier-badge{font-size:9px;font-weight:900;padding:5px 10px;border-radius:20px;letter-spacing:1px;border:1px solid currentColor;}
        .tier-standard{color:#888;border-color:rgba(255,255,255,0.1);}
        .tier-gold{color:#FFD700;background:rgba(255,215,0,0.05);}
        .tier-platinum{color:#E5E4E2;background:rgba(229,228,226,0.05);}
        .tier-royal{color:#D4AF37;background:rgba(212,175,55,0.1);box-shadow:0 0 15px rgba(212,175,55,0.2);}
        .prefs-list{display:flex;flex-wrap:wrap;gap:5px;max-width:220px;}
        .pref-tag{background:rgba(0,242,255,0.05);color:#00F2FF;border:1px solid rgba(0,242,255,0.2);font-size:8px;font-weight:800;padding:3px 7px;border-radius:6px;letter-spacing:1px;}
        .empty-state{text-align:center;padding:80px 20px!important;}
        .empty-title{color:#FFF;font-size:18px;font-weight:800;letter-spacing:2px;font-family:'Cinzel',serif;margin-bottom:8px;}
        .empty-subtitle{color:#666;font-size:13px;}
      `}} />
    </div>
  );
}
