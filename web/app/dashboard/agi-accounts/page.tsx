'use client';
// ================================================================
// MIRACLE HMS -- AGI CoA INTELLIGENCE ENGINE (ZONE 11)
// Futuristic Self-Expanding Accounting AGI Dashboard
// SAFETY CONTRACT:
//   - CLASSIFY (Dry Run) is always the DEFAULT tab
//   - POST requires explicit ARMED toggle + confirmation modal
//   - Zero hallucination: 62 deterministic pattern rules only
//   - All amounts are user-entered -- no AI-generated figures
// ================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

// ── Types ─────────────────────────────────────────────────────────
interface EngineStatus {
  id: number;
  name: string;
  status: string;
  endpoint: string;
}

interface CoaStats {
  total_accounts: number;
  total_journals: number;
  total_ledger_lines: number;
  agi_auto_posted: number;
}

interface StatusData {
  status: string;
  engines: EngineStatus[];
  coa_stats: CoaStats;
  classification_rules: number;
}

interface ClassifyResult {
  type: string;
  name: string;
  code_hint: number | null;
  account_exists: boolean;
  existing_account: { id: number; code: number; name: string; type: string } | null;
  will_auto_create: boolean;
}

interface PostResult {
  journal_id: number;
  classified_as: string;
  debit_account: { code: number; name: string };
  credit_account: { code: number; name: string };
  amount: number;
  auto_created_account: boolean;
}

interface FraudAlert {
  type: string;
  severity: string;
  description?: string;
  journal_id?: number;
  amount?: number;
  count?: number;
  date?: string;
  posted_by?: string;
  recommendation: string;
}

interface PeriodSummary {
  period: string;
  summary: { total_revenue: number; total_expense: number; net_income: number; profitable: boolean };
  journals_included: number;
  account_breakdown: { code: number; name: string; type: string; total_debit: number; total_credit: number }[];
}

interface Rule {
  pattern: string;
  type: string;
  name: string | null;
  code: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  REVENUE: '#00FF88',
  EXPENSE: '#FF6B9D',
  ASSET: '#00F2FF',
  LIABILITY: '#FFB700',
  EQUITY: '#D4AF37',
  COGS: '#FF8C00',
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: '#FF3131',
  MEDIUM: '#FFB700',
  LOW: '#00F2FF',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ── Sub-components ────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
      <div className="agi-spinner" />
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`s-pulse ${online ? 'agi-pulse-green' : 'agi-pulse-red'}`}
      style={{ background: online ? '#00FF88' : '#FF3131' }} />
  );
}

function ConfirmModal({
  data, onConfirm, onCancel,
}: {
  data: { description: string; amount: number; debit: string; credit: string };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="s-modal-overlay">
      <div className="s-modal" style={{ maxWidth: '520px', border: '1px solid #FF3131', boxShadow: '0 0 40px rgba(255,49,49,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>⚠</div>
          <div className="s-arch-title" style={{ color: '#FF3131' }}>CONFIRM LIVE POST</div>
          <div className="s-arch-subtitle">This will write a permanent journal entry to the ledger</div>
        </div>

        <div className="s-panel" style={{ marginBottom: 'var(--space-md)', fontFamily: 'monospace' }}>
          <div style={{ marginBottom: 'var(--space-sm)', color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-xs)' }}>JOURNAL PREVIEW</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>DEBIT</div>
              <div style={{ color: '#00FF88', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{data.debit}</div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 'var(--text-lg)' }}>⇄</div>
            <div style={{ background: 'rgba(255,107,157,0.05)', border: '1px solid rgba(255,107,157,0.2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>CREDIT</div>
              <div style={{ color: '#FF6B9D', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{data.credit}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-sm)' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-xs)' }}>{data.description.substring(0, 60)}</span>
            <span style={{ color: '#D4AF37', fontWeight: 700 }}>USD {fmt(data.amount)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="s-btn s-btn--ghost" style={{ flex: 1 }} onClick={onCancel}>CANCEL</button>
          <button className="s-btn s-btn--danger" style={{ flex: 1 }} onClick={onConfirm}>POST TO LEDGER</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: STATUS ───────────────────────────────────────────────────
function TabStatus({ data }: { data: StatusData | null }) {
  if (!data) return <Spinner />;
  const { engines, coa_stats, classification_rules } = data;

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        {[
          { label: 'ACCOUNTS IN CoA', value: coa_stats.total_accounts },
          { label: 'JOURNALS POSTED', value: coa_stats.total_journals },
          { label: 'LEDGER LINES', value: coa_stats.total_ledger_lines },
          { label: 'AGI AUTO-POSTED', value: coa_stats.agi_auto_posted },
        ].map(({ label, value }) => (
          <div key={label} className="s-metric">
            <div className="s-metric__label">{label}</div>
            <div className="s-metric__value">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Rules Badge */}
      <div className="s-panel" style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', border: '2px solid rgba(212,175,55,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
          ⚡
        </div>
        <div>
          <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: 'var(--text-md)' }}>{classification_rules} Deterministic Classification Rules</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)' }}>Zero hallucination — pure pattern engine. No LLM required for classification.</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="s-badge" style={{ '--badge-color': '#00FF88' } as React.CSSProperties}>SOVEREIGN_ACTIVE</span>
        </div>
      </div>

      {/* Engine Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)' }}>
        {engines.map(eng => (
          <div key={eng.id} className="s-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: '#D4AF37', fontWeight: 700, flexShrink: 0 }}>
              {String(eng.id).padStart(2, '0')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 'var(--text-xs)', fontFamily: 'monospace' }}>{eng.endpoint}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <StatusDot online={eng.status === 'ONLINE'} />
              <span style={{ color: eng.status === 'ONLINE' ? '#00FF88' : '#FF3131', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{eng.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: CLASSIFY ─────────────────────────────────────────────────
function TabClassify() {
  const [sessionId, setSessionId] = useState(() => 'session_' + Date.now());
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: "Welcome to the Accounting AGI Genius. I am a 200% confident super accountant. Describe your transaction and I will classify it for the Chart of Accounts.",
      stage: 'INIT'
    }
  ]);
  const [stage, setStage] = useState<string>('INIT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [currentSuggestion, setCurrentSuggestion] = useState<any>(null);
  
  // Create account form state
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('EXPENSE');
  const [createPrompt, setCreatePrompt] = useState('');
  const [createFields, setCreateFields] = useState<any[]>([]);

  // Feedback retry state
  const [retryFeedback, setRetryFeedback] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  const [postedJournal, setPostedJournal] = useState<any>(null);

  const sendMessage = useCallback(async (msgText: string, customStage?: string, customContext?: any) => {
    if (!msgText.trim() && !customStage) return;
    
    setLoading(true);
    setError('');
    
    const nextStage = customStage || (stage === 'SUGGEST' ? 'ANSWER' : stage);
    
    // Add user message to UI
    if (msgText.trim()) {
      setMessages(prev => [...prev, { role: 'user', content: msgText }]);
    }
    
    try {
      const res = await fetch(`${API}/accounting/agi/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: msgText,
          stage: nextStage,
          context: customContext || {},
          amount: amount ? parseFloat(amount) : null,
          currency: currency
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.stage === 'CLARIFY') {
          setStage('CLARIFY');
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.question,
            options: data.options,
            fieldKey: data.field_key
          }]);
          setCurrentSuggestion(null);
        } else if (data.stage === 'SUGGEST') {
          setStage('SUGGEST');
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.message
          }]);
          setCurrentSuggestion(data);
        } else if (data.stage === 'CREATE_FORM') {
          setStage('CREATE_FORM');
          setCreatePrompt(data.prompt);
          setCreateFields(data.fields);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.message
          }]);
        } else if (data.stage === 'POSTED') {
          setStage('POSTED');
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.message
          }]);
          setPostedJournal(data);
          setCurrentSuggestion(null);
        } else if (data.stage === 'ERROR') {
          setError(data.message || 'An error occurred.');
        }
      } else {
        setError(data.detail || 'Failed to process request.');
      }
    } catch (e: any) {
      setError(e.message || 'Network error.');
    } finally {
      setLoading(false);
      setInputMessage('');
      setRetryFeedback('');
      setIsRetrying(false);
    }
  }, [sessionId, stage, amount, currency]);

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount before confirming.');
      return;
    }
    sendMessage('', 'CONFIRM');
  };

  const handleRetrySubmit = () => {
    if (!retryFeedback.trim()) return;
    sendMessage(retryFeedback, 'RETRY');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    sendMessage(`Create account: ${newAccName} (${newAccType})`, 'DO_CREATE', {
      account_name: newAccName,
      account_type: newAccType
    });
    setNewAccName('');
  };

  const handleReset = () => {
    setSessionId('session_' + Date.now());
    setInputMessage('');
    setMessages([
      {
        role: 'assistant',
        content: "Welcome to the Accounting AGI Genius. I am a 200% confident super accountant. Describe your transaction and I will classify it for the Chart of Accounts.",
        stage: 'INIT'
      }
    ]);
    setStage('INIT');
    setCurrentSuggestion(null);
    setAmount('');
    setPostedJournal(null);
    setNewAccName('');
    setError('');
  };

  const typeColor = currentSuggestion?.classification ? (TYPE_COLORS[currentSuggestion.classification.type] || '#D4AF37') : '#D4AF37';

  // Autoscroll chat
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--space-lg)' }}>
      {/* Left Column: Conversational Panel */}
      <div className="s-panel s-panel--glow" style={{ display: 'flex', flexDirection: 'column', height: '620px', padding: 'var(--space-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧠</span>
            <div>
              <div style={{ color: '#00F2FF', fontSize: 'var(--text-sm)', fontWeight: 700 }}>AGI ACCOUNTING GENIUS</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>CONVERSATIONAL CLASSIFIER</div>
            </div>
          </div>
          <button className="s-btn s-btn--ghost" style={{ fontSize: '10px', padding: '4px 10px' }} onClick={handleReset}>RESET CHAT</button>
        </div>

        {/* Message Container */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }} className="hide-scroll">
          {messages.map((m, idx) => {
            const isBot = m.role === 'assistant';
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end', marginBottom: 'var(--space-sm)' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  background: isBot ? 'rgba(255,255,255,0.03)' : 'rgba(0,242,255,0.06)',
                  border: `1px solid ${isBot ? 'rgba(255,255,255,0.05)' : 'rgba(0,242,255,0.2)'}`,
                  color: '#fff',
                  fontFamily: isBot ? 'sans-serif' : 'monospace',
                  fontSize: 'var(--text-sm)',
                  lineHeight: '1.4',
                  boxShadow: isBot ? 'none' : '0 0 15px rgba(0,242,255,0.05)'
                }}>
                  <div style={{ color: isBot ? '#D4AF37' : '#00F2FF', fontSize: '10px', fontWeight: 700, marginBottom: '4px', fontFamily: 'monospace' }}>
                    {isBot ? '🤖 AGI' : '👤 USER'}
                  </div>
                  <div>{m.content}</div>

                  {/* Options Quick Chips */}
                  {isBot && m.options && m.options.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-sm)' }}>
                      {m.options.map((opt: string) => (
                        <button
                          key={opt}
                          className="s-btn s-btn--ghost"
                          style={{ fontSize: '11px', padding: '4px 8px', borderColor: 'rgba(212,175,55,0.25)', color: '#D4AF37' }}
                          onClick={() => sendMessage(opt, 'ANSWER')}
                          disabled={loading}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-sm)' }}>
              <div style={{ padding: '8px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="agi-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Example Shortcuts (only if initial stage) */}
        {stage === 'INIT' && messages.length === 1 && (
          <div style={{ marginTop: 'var(--space-sm)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 'var(--space-sm)' }}>
            <div className="s-label" style={{ marginBottom: '6px', fontSize: '10px' }}>QUICK TEST EXAMPLES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                'Room revenue from LTR-01 overnight stay',
                'OTA commission from Booking.com reservation',
                'Chef salary F&B division June 2026',
                'Electricity bill for the month BDT 45000',
                'Advance payment from corporate guest',
                'Inter-property commission for V-04 villa owner',
              ].map(ex => (
                <button
                  key={ex}
                  className="s-btn s-btn--ghost"
                  style={{ fontSize: '10px', padding: '4px 8px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '240px' }}
                  onClick={() => sendMessage(ex, 'INIT')}
                  disabled={loading}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--space-sm)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-sm)' }}>
          <input
            className="s-input"
            style={{ flex: 1, fontFamily: 'monospace' }}
            placeholder={stage === 'CREATE_FORM' ? 'Use the form on the right to create account' : 'Type transaction description or reply...'}
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(inputMessage)}
            disabled={loading || stage === 'CREATE_FORM'}
          />
          <button
            className="s-btn"
            style={{ minWidth: '80px' }}
            onClick={() => sendMessage(inputMessage)}
            disabled={loading || !inputMessage.trim() || stage === 'CREATE_FORM'}
          >
            SEND
          </button>
        </div>
        {error && <div style={{ color: '#FF3131', fontSize: 'var(--text-xs)', marginTop: '8px' }}>{error}</div>}
      </div>

      {/* Right Column: Live Suggestion Card */}
      <div style={{ height: '620px', display: 'flex', flexDirection: 'column' }}>
        {/* Placeholder / Suggestion Card / Posted Card / Create Form */}
        
        {/* ── 1. Create CoA Form Stage ── */}
        {stage === 'CREATE_FORM' && (
          <div className="s-panel s-panel--glow" style={{ flex: 1, display: 'flex', flexDirection: 'column', '--zone-color': '#FFB700' } as React.CSSProperties}>
            <div style={{ color: '#FFB700', fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
              ➕ CREATE NEW ACCOUNT
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-md)' }}>
              {createPrompt || "Create a brand new Chart of Accounts entry."}
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1 }}>
              <div>
                <label className="s-label">ACCOUNT NAME</label>
                <input
                  className="s-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Solar Energy Maintenance Expense"
                  value={newAccName}
                  onChange={e => setNewAccName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="s-label">ACCOUNT TYPE</label>
                <select
                  className="s-input"
                  style={{ width: '100%', background: '#0e0e1a', color: '#fff' }}
                  value={newAccType}
                  onChange={e => setNewAccType(e.target.value)}
                >
                  {["REVENUE", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  type="button"
                  className="s-btn s-btn--ghost"
                  style={{ flex: 1 }}
                  onClick={() => setStage('CLARIFY')}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="s-btn"
                  style={{ flex: 1, borderColor: '#FFB700', color: '#FFB700' }}
                  disabled={loading}
                >
                  SUBMIT CREATE
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── 2. Posted Success Card ── */}
        {stage === 'POSTED' && postedJournal && (
          <div className="s-panel s-panel--glow" style={{ flex: 1, display: 'flex', flexDirection: 'column', '--zone-color': '#00FF88' } as React.CSSProperties}>
            <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{ fontSize: '3rem' }}>✅</div>
              <div style={{ color: '#00FF88', fontSize: 'var(--text-lg)', fontWeight: 700 }}>JOURNAL POSTED</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-sm)', fontFamily: 'monospace' }}>
                Journal ID: #{postedJournal.journal_id}
              </div>

              <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: 'var(--space-md) 0', margin: 'var(--space-md) 0', fontFamily: 'monospace', fontSize: 'var(--text-xs)', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>DEBIT:</span>
                  <span style={{ color: '#00FF88' }}>{postedJournal.debit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>CREDIT:</span>
                  <span style={{ color: '#FF6B9D' }}>{postedJournal.credit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>AMOUNT:</span>
                  <span style={{ color: '#D4AF37' }}>{postedJournal.currency} {fmt(postedJournal.amount)}</span>
                </div>
              </div>

              <button className="s-btn" style={{ width: '100%' }} onClick={handleReset}>
                NEW ENTRY
              </button>
            </div>
          </div>
        )}

        {/* ── 3. Suggestion Active Card ── */}
        {stage === 'SUGGEST' && currentSuggestion && (
          <div className="s-panel s-panel--glow" style={{ flex: 1, display: 'flex', flexDirection: 'column', '--zone-color': typeColor } as React.CSSProperties}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <div style={{ padding: '4px 12px', background: `${typeColor}22`, border: `1px solid ${typeColor}44`, borderRadius: 'var(--radius-md)', color: typeColor, fontWeight: 700, fontSize: 'var(--text-xs)' }}>
                {currentSuggestion.classification.type}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {currentSuggestion.classification.will_auto_create ? (
                  <span style={{ color: '#FFB700', fontSize: '10px', fontWeight: 700 }}>NEW ACCOUNT WILL BE CREATED</span>
                ) : (
                  <span style={{ color: '#00FF88', fontSize: '10px', fontWeight: 700 }}>EXISTING ACCOUNT MATCHED</span>
                )}
              </div>
            </div>

            {/* Target Account */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)', border: `1px solid ${typeColor}15`, marginBottom: 'var(--space-md)' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>TARGET CoA ACCOUNT</div>
              <div style={{ color: typeColor, fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'monospace' }}>
                [{currentSuggestion.classification.code ?? 'AUTO'}] {currentSuggestion.classification.name}
              </div>
            </div>

            {/* Double Entry Preview */}
            <div className="s-panel" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, marginBottom: '8px' }}>DOUBLE-ENTRY JOURNAL PREVIEW</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: '#00FF88' }}>Dr {currentSuggestion.double_entry.debit}</span>
                  <span style={{ color: '#00FF88', fontWeight: 700 }}>{amount ? fmt(parseFloat(amount) || 0) : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#FF6B9D' }}>Cr {currentSuggestion.double_entry.credit}</span>
                  <span style={{ color: '#FF6B9D', fontWeight: 700 }}>{amount ? fmt(parseFloat(amount) || 0) : '—'}</span>
                </div>
              </div>
            </div>

            {/* Confidence */}
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                <span>AGI CONFIDENCE</span>
                <span style={{ color: typeColor }}>{currentSuggestion.confidence}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${currentSuggestion.confidence}%`, height: '100%', background: typeColor, borderRadius: '3px', transition: 'width 0.5s ease-out' }} />
              </div>
            </div>

            {/* Confirm Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {isRetrying ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  <textarea
                    className="s-input"
                    rows={2}
                    placeholder="Provide correction context here (e.g. this is a marketing expense, not chef salary)..."
                    value={retryFeedback}
                    onChange={e => setRetryFeedback(e.target.value)}
                    style={{ width: '100%', resize: 'none', fontSize: '12px' }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="s-btn s-btn--ghost" style={{ flex: 1 }} onClick={() => setIsRetrying(false)}>CANCEL</button>
                    <button className="s-btn" style={{ flex: 1 }} onClick={handleRetrySubmit} disabled={!retryFeedback.trim()}>SUBMIT RETRY</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="s-label" style={{ fontSize: '9px' }}>AMOUNT (USD)</label>
                      <input
                        type="number"
                        className="s-input"
                        style={{ width: '100%', height: '36px' }}
                        placeholder="e.g. 50000"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                      />
                    </div>
                    <div style={{ width: '80px' }}>
                      <label className="s-label" style={{ fontSize: '9px' }}>CURRENCY</label>
                      <input
                        className="s-input"
                        style={{ width: '100%', height: '36px', textTransform: 'uppercase', textAlign: 'center' }}
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    className="s-btn"
                    style={{ width: '100%', height: '42px', background: 'rgba(0, 255, 136, 0.15)', borderColor: '#00FF88', color: '#00FF88', fontWeight: 700 }}
                    onClick={handleConfirm}
                    disabled={loading || !amount || parseFloat(amount) <= 0}
                  >
                    ⚡ CONFIRM — POST TO LEDGER
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="s-btn s-btn--ghost"
                      style={{ flex: 1, fontSize: '11px' }}
                      onClick={() => setIsRetrying(true)}
                    >
                      🔄 TRY AGAIN
                    </button>
                    <button
                      className="s-btn s-btn--ghost"
                      style={{ flex: 1, fontSize: '11px', borderColor: 'rgba(255,183,0,0.3)', color: '#FFB700' }}
                      onClick={() => sendMessage('', 'CREATE')}
                    >
                      ➕ CREATE NEW COA
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Empty / Initial Placeholder Card ── */}
        {stage !== 'SUGGEST' && stage !== 'CREATE_FORM' && stage !== 'POSTED' && (
          <div className="s-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-md)', opacity: 0.45 }}>
            <div style={{ fontSize: '3rem' }}>📊</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
              Describe a transaction in the chat<br />to see live ledger recommendations and post details.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: POST ─────────────────────────────────────────────────────
function TabPost() {
  const [armed, setArmed] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [zone, setZone] = useState('');
  const [tags, setTags] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [offsetCode, setOffsetCode] = useState('100000');
  const [classified, setClassified] = useState<ClassifyResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runClassify = useCallback(async () => {
    if (!desc.trim()) return;
    try {
      const res = await fetch(`${API}/accounting/agi/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ description: desc, zone, tags }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') setClassified(data.classification);
    } catch { setClassified(null); }
  }, [desc, zone, tags]);

  useEffect(() => { if (desc.length > 5) runClassify(); }, [desc, runClassify]);

  const executePost = useCallback(async () => {
    setPreview(false); setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/accounting/agi/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ description: desc, amount: parseFloat(amount), zone, tags, currency, offset_account: parseInt(offsetCode) || 100000, posted_by: 'AGI_UI_OPERATOR' }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') { setResult(data.data); setDesc(''); setAmount(''); setArmed(false); }
      else setError(data.detail || 'Post failed');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally { setLoading(false); }
  }, [desc, amount, zone, tags, currency, offsetCode]);

  const typeColor = classified ? (TYPE_COLORS[classified.type] || '#D4AF37') : '#D4AF37';

  return (
    <div>
      {/* ARMED Toggle Banner */}
      <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md) var(--space-lg)', background: armed ? 'rgba(255,49,49,0.06)' : 'rgba(0,242,255,0.04)', border: `1px solid ${armed ? 'rgba(255,49,49,0.3)' : 'rgba(0,242,255,0.15)'}`, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: armed ? '#FF3131' : '#00F2FF', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
            {armed ? 'ARMED — LIVE POST MODE' : 'SAFE MODE — Classification Preview Only'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
            {armed ? 'Posting this entry WILL write a permanent journal to the ledger. Verify carefully.' : 'Toggle ARMED to enable live posting to the accounting ledger.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-xs)' }}>{armed ? 'ARMED' : 'SAFE'}</span>
          <div onClick={() => setArmed(a => !a)}
            style={{ width: '52px', height: '28px', borderRadius: '14px', background: armed ? 'rgba(255,49,49,0.3)' : 'rgba(255,255,255,0.1)', border: `1px solid ${armed ? '#FF3131' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: armed ? '#FF3131' : 'rgba(255,255,255,0.4)', position: 'absolute', top: '3px', left: armed ? '28px' : '4px', transition: 'all 0.2s' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Form */}
        <div className="s-panel s-panel--glow">
          <label className="s-label">TRANSACTION DESCRIPTION</label>
          <textarea className="s-input" rows={3} value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="e.g. Room revenue from LTR-03 overnight stay"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
            <div>
              <label className="s-label">AMOUNT (USD)</label>
              <input className="s-input" type="number" min="0.01" step="0.01"
                placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="s-label">CURRENCY</label>
              <select className="s-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {['USD', 'BDT', 'EUR', 'GBP', 'SGD', 'AED'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
            <div>
              <label className="s-label">ZONE</label>
              <input className="s-input" placeholder="Z-19, Z-30..." value={zone} onChange={e => setZone(e.target.value)} />
            </div>
            <div>
              <label className="s-label">OFFSET ACCOUNT CODE</label>
              <input className="s-input" placeholder="100000 (Cash/Bank)" value={offsetCode} onChange={e => setOffsetCode(e.target.value)} />
            </div>
          </div>

          <button className="s-btn" disabled={!armed || !desc.trim() || !amount || loading}
            style={{ marginTop: 'var(--space-md)', width: '100%', background: armed ? 'rgba(255,49,49,0.15)' : undefined, borderColor: armed ? '#FF3131' : undefined }}
            onClick={() => setPreview(true)}>
            {loading ? 'POSTING...' : armed ? 'POST TO LEDGER' : 'ARM FIRST TO POST'}
          </button>
          {error && <div style={{ color: '#FF3131', fontSize: 'var(--text-xs)', marginTop: 'var(--space-sm)' }}>{error}</div>}
        </div>

        {/* Live Preview */}
        <div className="s-panel" style={{ '--zone-color': typeColor } as React.CSSProperties}>
          <div className="s-label" style={{ marginBottom: 'var(--space-md)' }}>LIVE CLASSIFICATION PREVIEW</div>
          {!classified ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 'var(--text-sm)', textAlign: 'center', paddingTop: 'var(--space-xl)' }}>
              Start typing to see live classification...
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <div style={{ padding: '4px 12px', background: `${typeColor}22`, border: `1px solid ${typeColor}44`, borderRadius: 'var(--radius-md)', color: typeColor, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                  {classified.type}
                </div>
                <span style={{ color: classified.will_auto_create ? '#FFB700' : '#00FF88', fontSize: 'var(--text-xs)' }}>
                  {classified.will_auto_create ? 'WILL CREATE NEW ACCOUNT' : 'MATCHES EXISTING'}
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', color: typeColor, fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
                [{classified.code_hint ?? 'AUTO'}] {classified.name}
              </div>
              {amount && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)' }}>
                      {classified.type === 'REVENUE' ? 'DR Cash/Bank' : `DR ${classified.name?.substring(0, 20)}`}
                    </div>
                    <div style={{ color: '#00FF88', fontFamily: 'monospace', fontWeight: 700 }}>USD {fmt(parseFloat(amount) || 0)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,107,157,0.05)', border: '1px solid rgba(255,107,157,0.2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)' }}>
                      {classified.type === 'REVENUE' ? `CR ${classified.name?.substring(0, 20)}` : `CR Cash/Bank`}
                    </div>
                    <div style={{ color: '#FF6B9D', fontFamily: 'monospace', fontWeight: 700 }}>USD {fmt(parseFloat(amount) || 0)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Success Card */}
      {result && (
        <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-lg)', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ color: '#00FF88', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>JOURNAL #{result.journal_id} POSTED SUCCESSFULLY</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
            <div><div style={{ color: 'rgba(255,255,255,0.4)' }}>DEBIT</div><div style={{ color: '#00FF88' }}>[{result.debit_account.code}] {result.debit_account.name}</div></div>
            <div><div style={{ color: 'rgba(255,255,255,0.4)' }}>CREDIT</div><div style={{ color: '#FF6B9D' }}>[{result.credit_account.code}] {result.credit_account.name}</div></div>
            <div><div style={{ color: 'rgba(255,255,255,0.4)' }}>AMOUNT</div><div style={{ color: '#D4AF37' }}>USD {fmt(result.amount)}</div></div>
          </div>
          {result.auto_created_account && <div style={{ color: '#FFB700', fontSize: 'var(--text-xs)', marginTop: 'var(--space-sm)' }}>New CoA account auto-created — the system has self-expanded.</div>}
        </div>
      )}

      {preview && classified && amount && (
        <ConfirmModal
          data={{ description: desc, amount: parseFloat(amount), debit: classified.type === 'REVENUE' ? `Cash/Bank [100000]` : `${classified.name} [${classified.code_hint ?? 'AUTO'}]`, credit: classified.type === 'REVENUE' ? `${classified.name} [${classified.code_hint ?? 'AUTO'}]` : `Cash/Bank [${offsetCode}]` }}
          onConfirm={executePost} onCancel={() => setPreview(false)} />
      )}
    </div>
  );
}

// ── Tab: TAX ENGINE ───────────────────────────────────────────────
function TabTax() {
  const [gross, setGross] = useState('');
  const [txType, setTxType] = useState('ROOM');
  const [vat, setVat] = useState('15');
  const [sc, setSc] = useState('10');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ journal_id: number; breakdown: { gross: number; net_revenue: number; vat: number; sc: number } } | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  const grossNum = parseFloat(gross) || 0;
  const vatPct = parseFloat(vat) || 0;
  const scPct = parseFloat(sc) || 0;
  const divisor = 1 + scPct / 100 + vatPct / 100;
  const scAmt = grossNum * (scPct / 100) / divisor;
  const vatAmt = grossNum * (vatPct / 100) / divisor;
  const netAmt = grossNum - scAmt - vatAmt;

  const execute = useCallback(async () => {
    setPreview(false); setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/accounting/agi/tax/calculate-and-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ gross_amount: grossNum, transaction_type: txType, vat_pct: vatPct, sc_pct: scPct }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') { setResult(data); setGross(''); }
      else setError(data.detail || 'Tax post failed');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error'); }
    finally { setLoading(false); }
  }, [grossNum, txType, vatPct, scPct]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
      <div className="s-panel s-panel--glow">
        <div className="s-arch-title" style={{ marginBottom: 'var(--space-md)' }}>Tax Engine</div>
        <label className="s-label">TRANSACTION TYPE</label>
        <select className="s-input" style={{ marginBottom: 'var(--space-sm)' }} value={txType} onChange={e => setTxType(e.target.value)}>
          {['ROOM', 'FNB', 'SPA', 'BOUTIQUE', 'FLEET', 'CINEMA'].map(t => <option key={t}>{t}</option>)}
        </select>
        <label className="s-label">GROSS AMOUNT (inclusive)</label>
        <input className="s-input" type="number" min="0" step="0.01" placeholder="0.00" value={gross} onChange={e => setGross(e.target.value)} style={{ marginBottom: 'var(--space-sm)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <div><label className="s-label">VAT %</label><input className="s-input" type="number" value={vat} onChange={e => setVat(e.target.value)} /></div>
          <div><label className="s-label">SERVICE CHARGE %</label><input className="s-input" type="number" value={sc} onChange={e => setSc(e.target.value)} /></div>
        </div>
        <button className="s-btn" style={{ width: '100%' }} onClick={() => setPreview(true)} disabled={!gross || loading}>{loading ? 'POSTING...' : 'CALCULATE & POST'}</button>
        {error && <div style={{ color: '#FF3131', fontSize: 'var(--text-xs)', marginTop: 'var(--space-sm)' }}>{error}</div>}
      </div>

      <div className="s-panel">
        <div className="s-label" style={{ marginBottom: 'var(--space-md)' }}>LIVE TAX BREAKDOWN</div>
        {[
          { label: 'Gross Amount', value: grossNum, color: '#fff' },
          { label: `Service Charge (${sc}%)`, value: scAmt, color: '#FFB700' },
          { label: `VAT (${vat}%)`, value: vatAmt, color: '#FF6B9D' },
          { label: 'Net Revenue', value: netAmt, color: '#00FF88' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>{label}</span>
            <span style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>USD {fmt(value)}</span>
          </div>
        ))}
        {result && (
          <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: '#00FF88', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Posted as Journal #{result.journal_id}</div>
          </div>
        )}
      </div>

      {preview && (
        <ConfirmModal
          data={{ description: `Tax Engine: ${txType} | Gross ${fmt(grossNum)}`, amount: grossNum, debit: `Cash/Bank [100000]`, credit: `${txType} Revenue + VAT Payable + SC Payable` }}
          onConfirm={execute} onCancel={() => setPreview(false)} />
      )}
    </div>
  );
}

// ── Tab: PAYROLL ──────────────────────────────────────────────────
function TabPayroll() {
  const [division, setDivision] = useState('ROOMS');
  const [gross, setGross] = useState('');
  const [deductions, setDeductions] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ journal_id: number; division: string; account_code: number; net_pay: number } | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  const net = (parseFloat(gross) || 0) - (parseFloat(deductions) || 0);

  const execute = useCallback(async () => {
    setPreview(false); setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/accounting/agi/payroll/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ division, gross_salary: parseFloat(gross), deductions: parseFloat(deductions) || 0, period }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') { setResult(data); setGross(''); setDeductions(''); }
      else setError(data.detail || 'Payroll post failed');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error'); }
    finally { setLoading(false); }
  }, [division, gross, deductions, period]);

  const DIVISIONS = ['ROOMS', 'FNB', 'FLEET', 'WELLNESS', 'BOUTIQUE', 'CINEMA', 'GENERAL'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
      <div className="s-panel s-panel--glow">
        <div className="s-arch-title" style={{ marginBottom: 'var(--space-md)' }}>Payroll Engine</div>
        <label className="s-label">DIVISION</label>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
          {DIVISIONS.map(d => (
            <button key={d} onClick={() => setDivision(d)}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${division === d ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`, background: division === d ? 'rgba(212,175,55,0.15)' : 'transparent', color: division === d ? '#D4AF37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, transition: 'all 0.2s' }}>
              {d}
            </button>
          ))}
        </div>
        <label className="s-label">PAY PERIOD</label>
        <input className="s-input" type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ marginBottom: 'var(--space-sm)' }} />
        <label className="s-label">GROSS SALARY</label>
        <input className="s-input" type="number" placeholder="0.00" value={gross} onChange={e => setGross(e.target.value)} style={{ marginBottom: 'var(--space-sm)' }} />
        <label className="s-label">DEDUCTIONS</label>
        <input className="s-input" type="number" placeholder="0.00" value={deductions} onChange={e => setDeductions(e.target.value)} style={{ marginBottom: 'var(--space-md)' }} />
        <button className="s-btn" style={{ width: '100%' }} onClick={() => setPreview(true)} disabled={!gross || loading}>{loading ? 'POSTING...' : 'POST PAYROLL'}</button>
        {error && <div style={{ color: '#FF3131', fontSize: 'var(--text-xs)', marginTop: 'var(--space-sm)' }}>{error}</div>}
      </div>

      <div className="s-panel">
        <div className="s-label" style={{ marginBottom: 'var(--space-md)' }}>PAYROLL SUMMARY</div>
        {[
          { label: 'Division', value: division, color: '#D4AF37' },
          { label: 'Period', value: period },
          { label: 'Gross Salary', value: `USD ${fmt(parseFloat(gross) || 0)}`, color: '#fff' },
          { label: 'Deductions', value: `USD ${fmt(parseFloat(deductions) || 0)}`, color: '#FF6B9D' },
          { label: 'Net Pay', value: `USD ${fmt(net)}`, color: '#00FF88' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-sm)' }}>{label}</span>
            <span style={{ color: color || 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        {result && (
          <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: '#00FF88', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Payroll Posted — Journal #{result.journal_id} | Account [{result.account_code}]</div>
          </div>
        )}
      </div>

      {preview && (
        <ConfirmModal
          data={{ description: `Payroll ${period}: ${division} Division`, amount: parseFloat(gross) || 0, debit: `Payroll - ${division} Division`, credit: `Salaries Payable [212000]` }}
          onConfirm={execute} onCancel={() => setPreview(false)} />
      )}
    </div>
  );
}

// ── Tab: INTER-PROPERTY ────────────────────────────────────────────
function TabInterProperty() {
  const [fromProp, setFromProp] = useState('MIRACLE_MAIN');
  const [toProp, setToProp] = useState('');
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState('COMMISSION');
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ journal_id: number; debit_account: { code: number; name: string }; credit_account: { code: number; name: string } } | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  const execute = useCallback(async () => {
    setPreview(false); setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/accounting/agi/inter-property/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ from_property: fromProp, to_property: toProp, amount: parseFloat(amount), transaction_type: txType, reference: ref }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') { setResult(data); setAmount(''); setToProp(''); }
      else setError(data.detail || 'Post failed');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error'); }
    finally { setLoading(false); }
  }, [fromProp, toProp, amount, txType, ref]);

  const TX_TYPES = ['COMMISSION', 'RENT', 'SETUP_COST', 'MANAGEMENT_FEE'];
  const TX_DESC: Record<string, string> = {
    COMMISSION: 'Dr Commission Expense / Cr AP Owner Commission',
    RENT: 'Dr Lease Expense / Cr AP Lease Payable',
    SETUP_COST: 'Dr Property Capitalization / Cr AP Vendors',
    MANAGEMENT_FEE: 'Dr Marketing Expense / Cr AP Vendors',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
      <div className="s-panel s-panel--glow">
        <div className="s-arch-title" style={{ marginBottom: 'var(--space-md)' }}>Z-30 Inter-Property Engine</div>
        <label className="s-label">TRANSACTION TYPE</label>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
          {TX_TYPES.map(t => (
            <button key={t} onClick={() => setTxType(t)}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${txType === t ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`, background: txType === t ? 'rgba(212,175,55,0.15)' : 'transparent', color: txType === t ? '#D4AF37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, transition: 'all 0.2s' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ padding: 'var(--space-sm)', background: 'rgba(212,175,55,0.06)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)' }}>
          {TX_DESC[txType]}
        </div>
        <label className="s-label">FROM PROPERTY</label>
        <input className="s-input" value={fromProp} onChange={e => setFromProp(e.target.value)} style={{ marginBottom: 'var(--space-sm)' }} />
        <label className="s-label">TO PROPERTY / OWNER</label>
        <input className="s-input" placeholder="e.g. LTR-01_OWNER, V-04_OWNER" value={toProp} onChange={e => setToProp(e.target.value)} style={{ marginBottom: 'var(--space-sm)' }} />
        <label className="s-label">AMOUNT (USD)</label>
        <input className="s-input" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: 'var(--space-sm)' }} />
        <label className="s-label">REFERENCE</label>
        <input className="s-input" placeholder="Invoice or contract ref..." value={ref} onChange={e => setRef(e.target.value)} style={{ marginBottom: 'var(--space-md)' }} />
        <button className="s-btn" style={{ width: '100%' }} onClick={() => setPreview(true)} disabled={!amount || !toProp || loading}>{loading ? 'POSTING...' : 'POST INTER-PROPERTY'}</button>
        {error && <div style={{ color: '#FF3131', fontSize: 'var(--text-xs)', marginTop: 'var(--space-sm)' }}>{error}</div>}
      </div>

      <div className="s-panel">
        <div className="s-label" style={{ marginBottom: 'var(--space-md)' }}>PROPERTY NETWORK MAP</div>
        {['LTR-01 to LTR-10', 'OB-01 to OB-05', 'PS-01 to PS-05', 'V-01 to V-10', 'RS-01 to RS-05'].map(prop => (
          <div key={prop} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-xs) 0', fontSize: 'var(--text-xs)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{prop}</span>
            <span style={{ color: '#D4AF37', fontSize: '10px' }}>AFFILIATED</span>
          </div>
        ))}
        {result && (
          <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: '#00FF88', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: '4px' }}>Journal #{result.journal_id} Posted</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '11px' }}>Dr [{result.debit_account.code}] {result.debit_account.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: '11px' }}>Cr [{result.credit_account.code}] {result.credit_account.name}</div>
          </div>
        )}
      </div>

      {preview && (
        <ConfirmModal
          data={{ description: `Inter-Property ${txType}: ${fromProp} to ${toProp}`, amount: parseFloat(amount) || 0, debit: TX_DESC[txType].split('/')[0].trim(), credit: TX_DESC[txType].split('/')[1].trim() }}
          onConfirm={execute} onCancel={() => setPreview(false)} />
      )}
    </div>
  );
}

// ── Tab: FRAUD SCAN ───────────────────────────────────────────────
function TabFraud() {
  const [data, setData] = useState<{ total_alerts: number; alerts: FraudAlert[]; scanned_at: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/accounting/agi/fraud/scan`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      const d = await res.json();
      if (d.status === 'SUCCESS') setData(d);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { scan(); }, [scan]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <div className="s-arch-title">Fraud Detection Engine</div>
          {data && <div className="s-arch-subtitle">Scanned {data.scanned_at ? new Date(data.scanned_at).toLocaleString() : ''}</div>}
        </div>
        <button className="s-btn" onClick={scan} disabled={loading}>{loading ? 'SCANNING...' : 'RUN SCAN'}</button>
      </div>

      {loading && <Spinner />}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
              const cnt = data.alerts.filter(a => a.severity === sev).length;
              return (
                <div key={sev} className="s-metric" style={{ '--zone-color': SEVERITY_COLORS[sev] } as React.CSSProperties}>
                  <div className="s-metric__label">{sev} SEVERITY</div>
                  <div className="s-metric__value" style={{ color: SEVERITY_COLORS[sev] }}>{cnt}</div>
                </div>
              );
            })}
          </div>

          {data.alerts.length === 0 ? (
            <div className="s-panel" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>✓</div>
              <div style={{ color: '#00FF88', fontWeight: 700 }}>No anomalies detected</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>All journal entries passed fraud analysis</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {data.alerts.map((alert, i) => (
                <div key={i} className="s-row" style={{ padding: 'var(--space-md)', borderLeft: `3px solid ${SEVERITY_COLORS[alert.severity] || '#fff'}`, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{ color: SEVERITY_COLORS[alert.severity], fontWeight: 700, fontSize: 'var(--text-xs)' }}>{alert.type}</span>
                    <span className="s-badge" style={{ background: `${SEVERITY_COLORS[alert.severity]}22`, color: SEVERITY_COLORS[alert.severity], border: `1px solid ${SEVERITY_COLORS[alert.severity]}44` }}>{alert.severity}</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>{alert.description || `Journal #${alert.journal_id}`} {alert.count ? `(${alert.count}x on ${alert.date})` : ''}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)' }}>{alert.recommendation}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: PERIOD CLOSE ─────────────────────────────────────────────
function TabPeriodClose() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/accounting/agi/period/close-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ year, month }),
      });
      const d = await res.json();
      if (d.status === 'SUCCESS') setData(d);
      else setError(d.detail || 'Snapshot failed');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error'); }
    finally { setLoading(false); }
  }, [year, month]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <div>
          <label className="s-label">YEAR</label>
          <input className="s-input" type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: '100px' }} />
        </div>
        <div>
          <label className="s-label">MONTH</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {MONTHS.map((m, i) => (
              <button key={m} onClick={() => setMonth(i + 1)}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${month === i + 1 ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`, background: month === i + 1 ? 'rgba(212,175,55,0.15)' : 'transparent', color: month === i + 1 ? '#D4AF37' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, transition: 'all 0.2s' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <button className="s-btn" onClick={run} disabled={loading} style={{ alignSelf: 'flex-end' }}>{loading ? 'GENERATING...' : 'GENERATE P&L SNAPSHOT'}</button>
      </div>
      {error && <div style={{ color: '#FF3131', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>{error}</div>}

      {data && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <div className="s-metric"><div className="s-metric__label">TOTAL REVENUE</div><div className="s-metric__value" style={{ color: '#00FF88' }}>USD {fmt(data.summary.total_revenue)}</div></div>
            <div className="s-metric"><div className="s-metric__label">TOTAL EXPENSE</div><div className="s-metric__value" style={{ color: '#FF6B9D' }}>USD {fmt(data.summary.total_expense)}</div></div>
            <div className="s-metric"><div className="s-metric__label">NET INCOME</div><div className="s-metric__value" style={{ color: data.summary.profitable ? '#00FF88' : '#FF3131' }}>USD {fmt(data.summary.net_income)}</div></div>
          </div>

          <div className="s-panel">
            <div className="s-label" style={{ marginBottom: 'var(--space-md)' }}>ACCOUNT BREAKDOWN — {data.journals_included} JOURNALS</div>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {data.account_breakdown.map(acc => (
                <div key={acc.code} className="s-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px 80px', gap: 'var(--space-sm)', alignItems: 'center', padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-xs)' }}>
                  <span style={{ fontFamily: 'monospace', color: TYPE_COLORS[acc.type] || '#D4AF37' }}>{acc.code}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                  <span style={{ color: '#00FF88', fontFamily: 'monospace', textAlign: 'right' }}>+{fmt(acc.total_credit)}</span>
                  <span style={{ color: '#FF6B9D', fontFamily: 'monospace', textAlign: 'right' }}>-{fmt(acc.total_debit)}</span>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', background: `${TYPE_COLORS[acc.type] || '#D4AF37'}22`, color: TYPE_COLORS[acc.type] || '#D4AF37', textAlign: 'center', fontSize: '10px' }}>{acc.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: RULES ────────────────────────────────────────────────────
function TabRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    fetch(`${API}/accounting/agi/rules`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(r => r.json()).then(d => { if (d.status === 'SUCCESS') setRules(d.rules); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rules.filter(r =>
    (typeFilter === 'ALL' || r.type === typeFilter) &&
    (!filter || r.pattern.toLowerCase().includes(filter.toLowerCase()) || (r.name || '').toLowerCase().includes(filter.toLowerCase()))
  ), [rules, filter, typeFilter]);

  const TYPES = ['ALL', 'REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <input className="s-input" placeholder="Search rules..." value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1, minWidth: '200px' }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${typeFilter === t ? (TYPE_COLORS[t] || '#D4AF37') : 'rgba(255,255,255,0.1)'}`, background: typeFilter === t ? `${TYPE_COLORS[t] || '#D4AF37'}22` : 'transparent', color: typeFilter === t ? (TYPE_COLORS[t] || '#D4AF37') : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 700, transition: 'all 0.2s' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px', gap: 'var(--space-sm)', padding: 'var(--space-xs) var(--space-sm)', opacity: 0.4, fontSize: 'var(--text-xs)', fontWeight: 700 }}>
            <span>TYPE</span><span>REGEX PATTERN</span><span>ACCOUNT NAME</span><span>CODE</span>
          </div>
          {filtered.map((rule, i) => {
            const color = TYPE_COLORS[rule.type] || '#D4AF37';
            return (
              <div key={i} className="s-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px', gap: 'var(--space-sm)', padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-xs)', alignItems: 'center' }}>
                <span style={{ color, fontWeight: 700, fontSize: '10px' }}>{rule.type}</span>
                <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.pattern}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name || '(auto-name from description)'}</span>
                <span style={{ color, fontFamily: 'monospace' }}>{rule.code ?? 'AUTO'}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 'var(--space-sm)', color: 'rgba(255,255,255,0.3)', fontSize: 'var(--text-xs)', textAlign: 'right' }}>
            Showing {filtered.length} of {rules.length} rules
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
const TABS = [
  { id: 'status',         label: 'STATUS' },
  { id: 'classify',       label: 'CLASSIFY' },
  { id: 'post',           label: 'POST ENTRY' },
  { id: 'tax',            label: 'TAX ENGINE' },
  { id: 'payroll',        label: 'PAYROLL' },
  { id: 'inter-property', label: 'INTER-PROPERTY' },
  { id: 'fraud',          label: 'FRAUD SCAN' },
  { id: 'period',         label: 'PERIOD CLOSE' },
  { id: 'rules',          label: 'RULES [62]' },
];

export default function AGICoaPage() {
  const [activeTab, setActiveTab] = useState('classify'); // SAFE DEFAULT: dry-run first
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    fetch(`${API}/accounting/agi/status`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(r => r.json())
      .then(d => { if (d.status === 'SOVEREIGN_ACTIVE') setStatusData(d); else setStatusError('Engine offline'); })
      .catch(() => setStatusError('Cannot reach AGI engine'));
  }, []);

  return (
    <div className="zone-gold" style={{ minHeight: '100vh', padding: 'var(--space-xl)', background: 'var(--surface-dark)' }}>
      {/* ── Header ── */}
      <div className="s-arch-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xs)' }}>
            <div className="s-arch-title" style={{ fontSize: 'var(--text-xl)', background: 'linear-gradient(135deg, #D4AF37, #FFD700, #B8960C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              MIRACLE ACCOUNTING AGI
            </div>
            {statusData ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: 'var(--radius-md)' }}>
                <StatusDot online />
                <span style={{ color: '#00FF88', fontSize: 'var(--text-xs)', fontWeight: 700 }}>SOVEREIGN_ACTIVE</span>
              </div>
            ) : (
              <div style={{ color: statusError ? '#FF3131' : 'rgba(255,255,255,0.4)', fontSize: 'var(--text-xs)' }}>{statusError || 'Connecting...'}</div>
            )}
          </div>
          <div className="s-arch-subtitle" style={{ fontSize: 'var(--text-xs)' }}>
            ZONE 11 — SELF-EXPANDING CHART OF ACCOUNTS &nbsp;|&nbsp;
            {statusData ? `${statusData.coa_stats.total_accounts} Accounts &nbsp;| ${statusData.classification_rules} Rules &nbsp;| ${statusData.coa_stats.agi_auto_posted} AGI-Posted` : 'Loading...'}
          </div>
        </div>

        {/* Safety notice */}
        <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.15)', borderRadius: 'var(--radius-md)', textAlign: 'right' }}>
          <div style={{ color: '#00F2FF', fontWeight: 700, fontSize: 'var(--text-xs)' }}>ANTI-HALLUCINATION SHIELD ACTIVE</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '2px' }}>62 Deterministic Rules &nbsp;| Zero LLM on Classification &nbsp;| ARMED mode required to post</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="s-tabs" style={{ marginBottom: 'var(--space-xl)', overflowX: 'auto', flexWrap: 'nowrap', gap: 'var(--space-xs)' }}>
        {TABS.map(tab => (
          <button key={tab.id}
            className={`s-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ whiteSpace: 'nowrap', position: 'relative' }}>
            {tab.label}
            {tab.id === 'classify' && activeTab !== 'classify' && (
              <span style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', borderRadius: '50%', background: '#00F2FF' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div>
        {activeTab === 'status'         && <TabStatus data={statusData} />}
        {activeTab === 'classify'       && <TabClassify />}
        {activeTab === 'post'           && <TabPost />}
        {activeTab === 'tax'            && <TabTax />}
        {activeTab === 'payroll'        && <TabPayroll />}
        {activeTab === 'inter-property' && <TabInterProperty />}
        {activeTab === 'fraud'          && <TabFraud />}
        {activeTab === 'period'         && <TabPeriodClose />}
        {activeTab === 'rules'          && <TabRules />}
      </div>
    </div>
  );
}
