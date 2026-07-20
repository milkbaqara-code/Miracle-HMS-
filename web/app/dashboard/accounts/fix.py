# -*- coding: utf-8 -*-
import re

with open('page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

correct_block = '''  const renderEnterpriseModules = () => {
    const BASE = 'http://127.0.0.1:8000/api/accounting';
    const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '24px', marginBottom: '20px' };
    const inputStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', padding: '10px 14px', borderRadius: '8px', width: '100%', fontSize: '13px', outline: 'none' };
    const headerStyle: React.CSSProperties = { color: '#D4AF37', fontFamily: 'Cinzel', fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '10px' };

    // ---- TAB 6: GL JOURNAL ENTRY + ORACLE BOT ----
    if (activeTab === 6) {
      const [glLines, setGlLines] = React.useState<{code: string, debit: string, credit: string}[]>([{code: '', debit: '', credit: ''}, {code: '', debit: '', credit: ''}]);
      const [glRef, setGlRef] = React.useState('');
      const [glDesc, setGlDesc] = React.useState('');
      const [glStatus, setGlStatus] = React.useState<string|null>(null);
      const [coaList, setCoaList] = React.useState<any[]>([]);
      const [botMsg, setBotMsg] = React.useState('Select an account to see Oracle Bot guidance.');

      React.useEffect(() => { fetch(\\/coa/list\).then(r=>r.json()).then(d=>setCoaList(d.data||[])).catch(()=>{}); }, []);

      const botGuide: Record<string, string> = {
        'ASSET': 'ASSET accounts increase with a DEBIT and decrease with a CREDIT. Example: Receiving cash = Debit Cash.',
        'LIABILITY': 'LIABILITY accounts increase with a CREDIT and decrease with a DEBIT. Example: Accepting a vendor invoice = Credit Accounts Payable.',
        'EQUITY': 'EQUITY accounts increase with a CREDIT. Example: Owner investment = Credit Retained Earnings.',
        'REVENUE': 'REVENUE accounts increase with a CREDIT. Example: Room checkout = Credit Room Revenue.',
        'EXPENSE': 'EXPENSE accounts increase with a DEBIT. Example: Paying staff = Debit Payroll Expense.'
      };

      const totalDr = glLines.reduce((s,l)=>s+(parseFloat(l.debit)||0),0);
      const totalCr = glLines.reduce((s,l)=>s+(parseFloat(l.credit)||0),0);
      const isBalanced = totalDr > 0 && Math.abs(totalDr - totalCr) < 0.01;

      const handleAccountChange = (idx: number, code: string) => {
        const newLines = [...glLines]; newLines[idx].code = code;
        setGlLines(newLines);
        const acc = coaList.find((a:any) => String(a.code) === code);
        if (acc) setBotMsg(\Account [\] \ — \\);
      };

      const handleSubmit = async () => {
        if (!isBalanced) { setGlStatus('UNBALANCED — Entry rejected.'); return; }
        const lines = glLines.filter(l=>l.code).map(l=>({code: parseInt(l.code), debit: parseFloat(l.debit)||0, credit: parseFloat(l.credit)||0}));
        try {
          const res = await fetch(\\/journal/manual\, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({reference_type: glRef || 'MANUAL', description: glDesc, lines}) });
          const d = await res.json();
          setGlStatus(res.ok ? \SUCCESS — Journal Entry Posted.\ : \ERROR: \\);
        } catch { setGlStatus('ERROR: Server offline.'); }
      };

      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '30px' }}>
          <div>
            <div style={headerStyle}>GL Journal Entry — Free Sovereign Posting</div>
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div><div style={{ color: '#888', fontSize: '11px', marginBottom: '6px' }}>REFERENCE</div><input style={inputStyle} placeholder="e.g. MANUAL-001" value={glRef} onChange={e=>setGlRef(e.target.value)} /></div>
                <div><div style={{ color: '#888', fontSize: '11px', marginBottom: '6px' }}>DESCRIPTION</div><input style={inputStyle} placeholder="e.g. Correction entry" value={glDesc} onChange={e=>setGlDesc(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px' }}>
                <div style={{ color: '#666', fontSize: '10px', fontWeight: 700 }}>ACCOUNT</div>
                <div style={{ color: '#00FF88', fontSize: '10px', fontWeight: 700 }}>DEBIT (?)</div>
                <div style={{ color: '#FF3131', fontSize: '10px', fontWeight: 700 }}>CREDIT (?)</div>
                <div></div>
              </div>
              {glLines.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px' }}>
                  <select style={{...inputStyle, cursor:'pointer'}} value={line.code} onChange={e=>handleAccountChange(idx, e.target.value)}>
                    <option value="">— Select Account —</option>
                    {coaList.map((a:any) => <option key={a.code} value={String(a.code)}>[\] \ (\)</option>)}
                  </select>
                  <input style={inputStyle} type="number" placeholder="0.00" value={line.debit} onChange={e=>{const n=[...glLines];n[idx].debit=e.target.value;setGlLines(n);}} />
                  <input style={inputStyle} type="number" placeholder="0.00" value={line.credit} onChange={e=>{const n=[...glLines];n[idx].credit=e.target.value;setGlLines(n);}} />
                  <button onClick={()=>setGlLines(glLines.filter((_,i)=>i!==idx))} style={{background:'#FF313122',border:'1px solid #FF313144',color:'#FF3131',borderRadius:'6px',padding:'0 10px',cursor:'pointer',fontSize:'16px'}}>×</button>
                </div>
              ))}
              <button onClick={()=>setGlLines([...glLines,{code:'',debit:'',credit:''}])} style={{...inputStyle, width:'auto', cursor:'pointer', marginBottom:'20px', color:'#00F2FF', borderColor:'#00F2FF44'}}>+ Add Line</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderRadius: '10px', background: isBalanced ? 'rgba(0,255,136,0.05)' : 'rgba(255,49,49,0.05)', border: \1px solid \\, marginBottom: '20px' }}>
                <div><span style={{ color: '#00FF88', fontWeight: 700 }}>DR ?{totalDr.toFixed(2)}</span><span style={{ color: '#888', margin: '0 15px' }}>|</span><span style={{ color: '#FF3131', fontWeight: 700 }}>CR ?{totalCr.toFixed(2)}</span></div>
                <div style={{ color: isBalanced ? '#00FF88' : '#FF3131', fontWeight: 900, fontSize: '12px' }}>{isBalanced ? '? BALANCED' : \VARIANCE: ?\\}</div>
              </div>
              <button className="neon-btn" onClick={handleSubmit} disabled={!isBalanced} style={{ width: '100%', padding: '14px' }}>POST TO SOVEREIGN LEDGER</button>
              {glStatus && <div style={{ marginTop: '15px', padding: '12px', borderRadius: '8px', background: glStatus.includes('SUCCESS') ? 'rgba(0,255,136,0.1)' : 'rgba(255,49,49,0.1)', color: glStatus.includes('SUCCESS') ? '#00FF88' : '#FF3131', fontSize: '13px', fontWeight: 700 }}>{glStatus}</div>}
            </div>
          </div>
          <div style={{ position: 'sticky', top: '20px' }}>
            <div style={{ ...cardStyle, border: '1px solid rgba(0,242,255,0.2)', background: 'rgba(0,242,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}><span style={{ fontSize: '28px' }}>??</span><div style={{ color: '#00F2FF', fontWeight: 900, fontSize: '14px' }}>ORACLE BOT GUIDE</div></div>
              <div style={{ color: '#DDD', fontSize: '13px', lineHeight: '1.8', minHeight: '120px' }}>{botMsg}</div>
              <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', fontSize: '11px', color: '#666' }}>
                <div style={{ color: '#D4AF37', fontWeight: 700, marginBottom: '8px' }}>NORMAL BALANCE RULES</div>
                <div>ASSET / EXPENSE ? Debit increases</div>
                <div>LIABILITY / EQUITY / REVENUE ? Credit increases</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ---- TAB 7: AR AGING ----
    if (activeTab === 7) {
      const [arData, setArData] = React.useState<any>(null);
      React.useEffect(() => { fetch(\\/ar/aging\).then(r=>r.json()).then(setArData).catch(()=>{}); }, []);
      const bucketInfo = [
        { key: 'current', label: '0 — 30 Days', color: '#00FF88' },
        { key: '31_60', label: '31 — 60 Days', color: '#F59E0B' },
        { key: '61_90', label: '61 — 90 Days', color: '#FF8C00' },
        { key: 'over_90', label: '90+ Days (CRITICAL)', color: '#FF3131' }
      ];
      const reconcile = async (id: number) => {
        await fetch(\\/ar/reconcile/\\, { method: 'POST' });
        const d = await fetch(\\/ar/aging\).then(r=>r.json());
        setArData(d);
      };
      return (
        <div>
          <div style={headerStyle}>AR Aging — OTA & Corporate Receivables</div>
          {!arData ? <div style={{ color: '#888', textAlign: 'center', padding: '60px' }}>Loading AR data...</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
                {bucketInfo.map(b => (
                  <div key={b.key} style={{ ...cardStyle, border: \1px solid \33\, textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>{b.label}</div>
                    <div style={{ color: b.color, fontSize: '24px', fontWeight: 900 }}>?{((arData.totals||{})[b.key]||0).toLocaleString()}</div>
                    <div style={{ color: '#666', fontSize: '10px', marginTop: '5px' }}>{((arData.buckets||{})[b.key]||[]).length} entries</div>
                  </div>
                ))}
              </div>
              {bucketInfo.map(b => {
                const entries: any[] = (arData.buckets||{})[b.key] || [];
                if (!entries.length) return null;
                return (
                  <div key={b.key} style={{ ...cardStyle, border: \1px solid \22\ }}>
                    <div style={{ color: b.color, fontSize: '12px', fontWeight: 900, marginBottom: '15px' }}>{b.label.toUpperCase()}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Client', 'Type', 'Amount', 'Age', 'Action'].map(h => <th key={h} style={{ color: '#888', fontSize: '10px', fontWeight: 700, padding: '8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {entries.map((e:any) => (
                          <tr key={e.id}>
                            <td style={{ padding: '10px 8px', color: '#FFF', fontSize: '13px' }}>{e.client}</td>
                            <td style={{ padding: '10px 8px', color: '#888', fontSize: '12px' }}>{e.ota_type}</td>
                            <td style={{ padding: '10px 8px', color: b.color, fontWeight: 700 }}>?{e.amount?.toLocaleString()}</td>
                            <td style={{ padding: '10px 8px', color: '#AAA', fontSize: '12px' }}>{e.age_days}d</td>
                            <td style={{ padding: '10px 8px' }}><button onClick={() => reconcile(e.id)} style={{ background: '#00FF8822', border: '1px solid #00FF8844', color: '#00FF88', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>RECONCILE</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {arData.grand_total === 0 && <div style={{ textAlign: 'center', color: '#00FF88', padding: '60px', fontSize: '16px', fontWeight: 700 }}>? All Receivables Cleared</div>}
            </>
          )}
        </div>
      );
    }

    // ---- TAB 8: BANK RECONCILIATION ----
    if (activeTab === 8) {
      const [bankLines, setBankLines] = React.useState<{date: string, desc: string, amount: string}[]>([]);
      const [matched, setMatched] = React.useState<Set<number>>(new Set());
      const addBankLine = () => setBankLines([...bankLines, {date: '', desc: '', amount: ''}]);
      const matchedTotal = Array.from(matched).reduce((s,i) => s + (parseFloat(bankLines[i]?.amount)||0), 0);
      return (
        <div>
          <div style={headerStyle}>Bank Reconciliation — Statement vs. General Ledger</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
            <div style={cardStyle}>
              <div style={{ color: '#D4AF37', fontWeight: 700, marginBottom: '15px', fontSize: '13px' }}>BANK STATEMENT ENTRIES</div>
              {bankLines.map((l, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input style={{...inputStyle, fontSize: '11px'}} type="date" value={l.date} onChange={e=>{const n=[...bankLines];n[i].date=e.target.value;setBankLines(n);}} />
                  <input style={{...inputStyle, fontSize: '11px'}} placeholder="Description" value={l.desc} onChange={e=>{const n=[...bankLines];n[i].desc=e.target.value;setBankLines(n);}} />
                  <input style={{...inputStyle, fontSize: '11px'}} type="number" placeholder="Amount" value={l.amount} onChange={e=>{const n=[...bankLines];n[i].amount=e.target.value;setBankLines(n);}} />
                </div>
              ))}
              <button onClick={addBankLine} style={{...inputStyle, cursor:'pointer', color:'#00F2FF', borderColor:'#00F2FF33', width:'auto', marginTop:'10px'}}>+ Add Bank Entry</button>
            </div>
            <div style={cardStyle}>
              <div style={{ color: '#00F2FF', fontWeight: 700, marginBottom: '15px', fontSize: '13px' }}>GL LEDGER ENTRIES (LIVE)</div>
              {liveData.slice(0, 15).map((e: any) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '12px' }}>
                  <div><div style={{ color: '#FFF' }}>{e.description?.slice(0,30)}</div><div style={{ color: '#666', fontSize: '10px' }}>{e.ref}</div></div>
                  <div style={{ color: e.type === 'DEBIT' ? '#00FF88' : '#FF3131', fontWeight: 700 }}>?{e.amount?.toLocaleString()}</div>
                </div>
              ))}
              {liveData.length === 0 && <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>No ledger entries. Entries will appear as transactions are posted.</div>}
            </div>
          </div>
          <div style={{ ...cardStyle, marginTop: '0', background: 'rgba(0,242,255,0.03)', border: '1px solid rgba(0,242,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ color: '#888', fontSize: '11px' }}>BANK STATEMENT TOTAL</div><div style={{ color: '#FFF', fontSize: '22px', fontWeight: 900 }}>?{bankLines.reduce((s,l)=>s+(parseFloat(l.amount)||0),0).toLocaleString()}</div></div>
              <div><div style={{ color: '#888', fontSize: '11px' }}>GL CASH BALANCE</div><div style={{ color: '#00FF88', fontSize: '22px', fontWeight: 900 }}>?{liveData.filter((e:any)=>e.type==='DEBIT').reduce((s:number,e:any)=>s+e.amount,0).toLocaleString()}</div></div>
              <div style={{ color: '#D4AF37', fontSize: '13px', fontWeight: 700 }}>MANUALLY MATCH ENTRIES IN BOTH PANELS</div>
            </div>
          </div>
        </div>
      );
    }

    // ---- TAB 9: AP MODULE ----
    if (activeTab === 9) {
      const [apData, setApData] = React.useState<any>(null);
      const [vendors, setVendors] = React.useState<any[]>([]);
      const [apTab, setApTab] = React.useState(0);
      const [newVendor, setNewVendor] = React.useState({name:'',contact:'',tax_id:'',payment_terms_days:30});
      React.useEffect(() => {
        fetch(\\/ap/invoices\).then(r=>r.json()).then(setApData).catch(()=>{});
        fetch(\\/ap/vendors\).then(r=>r.json()).then(d=>setVendors(d.data||[])).catch(()=>{});
      }, []);
      const payInvoice = async (id: number) => {
        await fetch(\\/ap/pay/\\, {method:'POST'});
        const d = await fetch(\\/ap/invoices\).then(r=>r.json());
        setApData(d);
      };
      const addVendor = async () => {
        await fetch(\\/ap/vendors\, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newVendor)});
        const d = await fetch(\\/ap/vendors\).then(r=>r.json());
        setVendors(d.data||[]);
        setNewVendor({name:'',contact:'',tax_id:'',payment_terms_days:30});
      };
      const ageColor = (age: number) => age > 60 ? '#FF3131' : age > 30 ? '#F59E0B' : '#00FF88';
      return (
        <div>
          <div style={headerStyle}>Accounts Payable — Vendor Module</div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            {['Invoice Ledger', 'Vendor Directory', 'Add Vendor'].map((t,i)=>(
              <button key={i} onClick={()=>setApTab(i)} className={\	ab-btn \\} style={{fontSize:'11px',padding:'8px 16px'}}>{t}</button>
            ))}
          </div>
          {apTab === 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ color: '#888', fontSize: '12px' }}>Total Outstanding: <span style={{ color: '#FF3131', fontWeight: 900, fontSize: '18px' }}>?{(apData?.total_outstanding||0).toLocaleString()}</span></div>
              </div>
              {(apData?.data||[]).length === 0 ? <div style={{ color: '#666', textAlign: 'center', padding: '60px' }}>No invoices yet. Stock receives will auto-create AP invoices.</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Vendor', 'Invoice Ref', 'Description', 'Amount', 'Due Date', 'Age', 'Status', 'Action'].map(h=><th key={h} style={{color:'#888',fontSize:'10px',fontWeight:700,padding:'10px 12px',textAlign:'left',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(apData?.data||[]).map((inv:any)=>(
                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{padding:'12px',color:'#FFF',fontSize:'13px'}}>{inv.vendor}</td>
                        <td style={{padding:'12px',color:'#888',fontSize:'11px'}}>{inv.invoice_ref}</td>
                        <td style={{padding:'12px',color:'#888',fontSize:'11px'}}>{inv.description?.slice(0,25)}</td>
                        <td style={{padding:'12px',color:'#D4AF37',fontWeight:700}}>?{inv.amount?.toLocaleString()}</td>
                        <td style={{padding:'12px',color:'#AAA',fontSize:'11px'}}>{inv.due_date?.slice(0,10)}</td>
                        <td style={{padding:'12px',color:ageColor(inv.age_days),fontWeight:700}}>{inv.age_days}d</td>
                        <td style={{padding:'12px'}}><span style={{background:inv.status==='PAID'?'rgba(0,255,136,0.1)':'rgba(255,49,49,0.1)',color:inv.status==='PAID'?'#00FF88':'#FF3131',padding:'3px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{inv.status}</span></td>
                        <td style={{padding:'12px'}}>{inv.status==='OUTSTANDING'&&<button onClick={()=>payInvoice(inv.id)} style={{background:'#00F2FF22',border:'1px solid #00F2FF44',color:'#00F2FF',padding:'5px 12px',borderRadius:'6px',cursor:'pointer',fontSize:'11px'}}>PAY</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {apTab === 1 && (
            <div style={cardStyle}>
              {vendors.length === 0 ? <div style={{color:'#666',textAlign:'center',padding:'40px'}}>No vendors. Add one in the next tab.</div> : (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['ID','Name','Contact','Tax ID','Payment Terms'].map(h=><th key={h} style={{color:'#888',fontSize:'10px',fontWeight:700,padding:'10px',textAlign:'left',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>{h}</th>)}</tr></thead>
                  <tbody>{vendors.map((v:any)=>(
                    <tr key={v.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <td style={{padding:'10px',color:'#666'}}>{v.id}</td>
                      <td style={{padding:'10px',color:'#FFF',fontWeight:700}}>{v.name}</td>
                      <td style={{padding:'10px',color:'#888'}}>{v.contact||'—'}</td>
                      <td style={{padding:'10px',color:'#888'}}>{v.tax_id||'—'}</td>
                      <td style={{padding:'10px',color:'#D4AF37'}}>{v.terms} days</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
          {apTab === 2 && (
            <div style={cardStyle}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'15px'}}>
                {[['Vendor Name *', 'name', 'text', 'e.g. DHAKA LINEN CO.'], ['Contact / Phone', 'contact', 'text', '+880...'], ['Tax ID / BIN', 'tax_id', 'text', '0000-0000'], ['Payment Terms (Days)', 'payment_terms_days', 'number', '30']].map(([label, key, type, ph])=>(
                  <div key={key}>
                    <div style={{color:'#888',fontSize:'11px',marginBottom:'6px'}}>{label}</div>
                    <input style={inputStyle} type={type} placeholder={ph} value={(newVendor as any)[key]} onChange={e=>setNewVendor({...newVendor, [key]: type==='number'?parseInt(e.target.value)||30:e.target.value})} />
                  </div>
                ))}
              </div>
              <button className="neon-btn" onClick={addVendor} style={{marginTop:'20px', padding:'12px 30px'}} disabled={!newVendor.name}>ADD VENDOR TO DIRECTORY</button>
            </div>
          )}
        </div>
      );
    }

    // ---- TAB 10: PREMIUM TRIAL BALANCE ----
    if (activeTab === 10) {
      const [tbData, setTbData] = React.useState<any>(null);
      const [loading, setLoading] = React.useState(false);
      const fetchTB = async () => { setLoading(true); const d = await fetch(\\/trial-balance\).then(r=>r.json()); setTbData(d); setLoading(false); };
      React.useEffect(() => { fetchTB(); }, []);
      const typeColors: Record<string,string> = { ASSET: '#00F2FF', LIABILITY: '#F59E0B', EQUITY: '#9D50BB', REVENUE: '#00FF88', EXPENSE: '#FF3131' };
      const groupedByType: Record<string, any[]> = {};
      (tbData?.accounts||[]).forEach((a:any) => { if (!groupedByType[a.type||'OTHER']) groupedByType[a.type||'OTHER']=[]; groupedByType[a.type||'OTHER'].push(a); });
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={headerStyle}>Trial Balance — Sovereign Ledger Proof</div>
            <button className="neon-btn" onClick={fetchTB} style={{fontSize:'11px',padding:'8px 20px'}}>{loading ? 'AUDITING...' : 'REFRESH'}</button>
          </div>
          {tbData && (
            <div style={{ ...cardStyle, border: \1px solid \\, background: tbData.status==='SUCCESS'?'rgba(0,255,136,0.03)':'rgba(255,49,49,0.03)', textAlign: 'center', marginBottom: '25px', padding: '20px' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: tbData.status==='SUCCESS'?'#00FF88':'#FF3131' }}>
                {tbData.status === 'SUCCESS' ? '? MASTER LEDGER BALANCED — ZERO VARIANCE' : \IMBALANCE DETECTED: ?\\}
              </div>
            </div>
          )}
          {Object.keys(typeColors).map(type => {
            const accounts = groupedByType[type] || [];
            if (!accounts.length) return null;
            const totalDr = accounts.reduce((s:number,a:any)=>s+a.debit,0);
            const totalCr = accounts.reduce((s:number,a:any)=>s+a.credit,0);
            return (
              <div key={type} style={{...cardStyle, border:\1px solid \22\}}>
                <div style={{color:typeColors[type],fontWeight:900,fontSize:'13px',marginBottom:'12px',letterSpacing:'2px'}}>{type} ACCOUNTS</div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>
                    <th style={{color:'#666',fontSize:'10px',padding:'8px',textAlign:'left'}}>CODE</th>
                    <th style={{color:'#666',fontSize:'10px',padding:'8px',textAlign:'left'}}>ACCOUNT NAME</th>
                    <th style={{color:'#00FF88',fontSize:'10px',padding:'8px',textAlign:'right'}}>DEBIT (?)</th>
                    <th style={{color:'#FF3131',fontSize:'10px',padding:'8px',textAlign:'right'}}>CREDIT (?)</th>
                    <th style={{color:'#D4AF37',fontSize:'10px',padding:'8px',textAlign:'right'}}>BALANCE (?)</th>
                  </tr></thead>
                  <tbody>
                    {accounts.map((a:any)=>(
                      <tr key={a.code} style={{borderTop:'1px solid rgba(255,255,255,0.03)'}}>
                        <td style={{padding:'10px 8px',color:'#666',fontSize:'12px'}}>{a.code}</td>
                        <td style={{padding:'10px 8px',color:'#FFF',fontSize:'13px'}}>{a.name}</td>
                        <td style={{padding:'10px 8px',color:'#00FF88',textAlign:'right',fontFamily:'monospace'}}>{a.debit?.toFixed(2)}</td>
                        <td style={{padding:'10px 8px',color:'#FF3131',textAlign:'right',fontFamily:'monospace'}}>{a.credit?.toFixed(2)}</td>
                        <td style={{padding:'10px 8px',color:'#D4AF37',fontWeight:700,textAlign:'right',fontFamily:'monospace'}}>{a.balance?.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{borderTop:\2px solid \44\,fontWeight:900}}>
                      <td colSpan={2} style={{padding:'10px 8px',color:typeColors[type],fontSize:'12px'}}>SUBTOTAL</td>
                      <td style={{padding:'10px 8px',color:'#00FF88',textAlign:'right',fontFamily:'monospace'}}>{totalDr.toFixed(2)}</td>
                      <td style={{padding:'10px 8px',color:'#FF3131',textAlign:'right',fontFamily:'monospace'}}>{totalCr.toFixed(2)}</td>
                      <td style={{padding:'10px 8px',color:typeColors[type],textAlign:'right',fontFamily:'monospace'}}>{(totalDr-totalCr).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
          {!tbData && !loading && <div style={{color:'#666',textAlign:'center',padding:'60px'}}>No data. Click REFRESH to load Trial Balance.</div>}
        </div>
      );
    }

    return null;
  };
'''

new_text = re.sub(r'  const renderEnterpriseModules = \(\) => \{.+?return null;\n  \};\n', correct_block, text, flags=re.DOTALL)
with open('page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('JS Templates fixed.')
