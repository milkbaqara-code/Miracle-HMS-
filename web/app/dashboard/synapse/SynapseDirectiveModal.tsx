'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Directive, EmpNode } from './synapse.types';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AgiTask {
  task_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  department: string;
  requires_verification: boolean;
  estimated_minutes: number;
}

interface SynapseDirectiveModalProps {
  directive?: Directive | null;   // null = create mode, defined = edit/view mode
  nodes: EmpNode[];               // For department autocomplete
  token: string;
  myEmpId: string;
  onClose: () => void;
  onSaved: () => void;            // Refresh parent list after save
  onDeleted?: () => void;
}

const PRIORITIES = ['CRITICAL', 'STRATEGIC', 'NORMAL'] as const;
const PRIORITY_META = {
  CRITICAL: { icon: '🔴', color: '#ff3366', desc: 'Halt-everything escalation' },
  STRATEGIC: { icon: '🟡', color: '#D4AF37', desc: 'High-impact quarterly goal' },
  NORMAL:    { icon: '🔵', color: '#00fbff', desc: 'Standard operational task' },
};

export default function SynapseDirectiveModal({
  directive,
  nodes,
  token,
  myEmpId,
  onClose,
  onSaved,
  onDeleted,
}: SynapseDirectiveModalProps) {
  const isEdit = !!directive;
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const [title, setTitle]           = useState(directive?.title ?? '');
  const [description, setDescription] = useState(directive?.description ?? '');
  const [priority, setPriority]     = useState<typeof PRIORITIES[number]>(
    (directive?.priority as typeof PRIORITIES[number]) ?? 'NORMAL'
  );
  const [targetDept, setTargetDept] = useState(directive?.target_dept ?? '');
  const [tasks, setTasks]           = useState<{ 
    id?: number; 
    task: string; 
    done: boolean;
    requires_verification?: boolean;
    verification_status?: string;
    assignee_id?: string | null;
    assignee_name?: string | null;
    target_dept?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }[]>(
    directive?.nodes?.map((n: any) => ({ 
      id: n.id, 
      task: n.task || n.task_name, 
      done: n.done || n.is_completed,
      requires_verification: n.requires_verification,
      verification_status: n.verification_status || 'NONE',
      assignee_id: n.assigned_to_id || null,
      assignee_name: n.assigned_to_id ? nodes.find(emp => emp.id === n.assigned_to_id)?.name : null,
      target_dept: n.target_dept,
      started_at: n.started_at,
      completed_at: n.completed_at
    })) ?? [{ task: '', done: false, requires_verification: false, verification_status: 'NONE' }]
  );
  const [taggedOperatives, setTaggedOperatives] = useState<string[]>(
    directive?.tagged_operatives ?? []
  );
  const [files, setFiles] = useState<{ id: string; name: string; url: string }[]>(
    directive?.files ?? []
  );
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  // ── AGI Auto-Decompiler State ───────────────────────────────────
  const [agiLoading, setAgiLoading] = useState(false);
  const [agiError, setAgiError]     = useState('');
  const [agiTasks, setAgiTasks]     = useState<AgiTask[]>([]);
  const [agiReveal, setAgiReveal]   = useState<number>(0); // typewriter index

  // ── Corporate Matrix Departments ────────────────────────────────
  const [matrixDepts, setMatrixDepts] = useState<{code: string, name: string}[]>([]);
  useEffect(() => {
    // The router has prefix="/synapse/grid" + main.py has prefix="/api"
    // Full path = /api/synapse/grid/departments
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout, never freeze
    fetch(`${API}/synapse/grid/departments`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.departments)) {
          setMatrixDepts(data.departments);
        } else if (Array.isArray(data)) {
          setMatrixDepts(data);
        }
      })
      .catch(() => {}) // Fail silently — modal must NEVER freeze
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [token]);

  const myNode = nodes.find(n => n.id === myEmpId);
  const isOperative = myNode?.tier_weight === 1; // Tier 1 Operative
  const isIssuer = directive?.issued_by === myEmpId;
  const readOnly = isOperative && !isIssuer;

  useEffect(() => {
    if (!readOnly) {
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [readOnly]);

  // Typewriter reveal: each AGI task appears one-by-one with 120ms gap
  useEffect(() => {
    if (agiTasks.length === 0) { setAgiReveal(0); return; }
    if (agiReveal >= agiTasks.length) return;
    const t = setTimeout(() => setAgiReveal(prev => prev + 1), 120);
    return () => clearTimeout(t);
  }, [agiTasks, agiReveal]);

  // ── AGI Auto-Decompile ──────────────────────────────────────────
  const handleAgiDecompose = async () => {
    if (!title.trim()) { setError('Enter a directive title before calling the AGI engine.'); return; }
    setAgiLoading(true);
    setAgiError('');
    setAgiTasks([]);
    setAgiReveal(0);
    try {
      const res = await fetch(`${API}/synapse/agi/decompose-directive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          target_dept: targetDept || 'ALL',
          issuer_id: myEmpId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'AGI Engine error');
      if (data.status === 'SUCCESS' && Array.isArray(data.tasks)) {
        setAgiTasks(data.tasks);
        // Auto-populate task checklist and tagged operatives from AGI output
        const newTasks = data.tasks.map((t: AgiTask) => ({ 
          task: t.task_name, 
          done: false,
          requires_verification: t.requires_verification,
          verification_status: 'NONE',
          assignee_id: t.assignee_id,
          assignee_name: t.assignee_name,
          target_dept: t.department
        }));
        setTasks(newTasks);
        const assigneeIds = data.tasks
          .map((t: AgiTask) => t.assignee_id)
          .filter((id: string | null): id is string => !!id);
        setTaggedOperatives(prev => {
          const merged = [...prev];
          assigneeIds.forEach((id: string) => { if (!merged.includes(id)) merged.push(id); });
          return merged;
        });
      } else {
        throw new Error('AGI returned empty task list.');
      }
    } catch (e: unknown) {
      setAgiError(e instanceof Error ? e.message : 'AGI Engine unreachable.');
    } finally {
      setAgiLoading(false);
    }
  };

  // ── Task Checklist helpers ──────────────────────────────────────
  const addTask = () => setTasks(prev => [...prev, { task: '', done: false }]);
  const updateTaskText = (i: number, val: string) =>
    setTasks(prev => prev.map((t, idx) => (idx === i ? { ...t, task: val } : t)));
  const updateTaskDept = (i: number, val: string) =>
    setTasks(prev => prev.map((t, idx) => (idx === i ? { ...t, target_dept: val } : t)));
  const removeTask = (i: number) =>
    setTasks(prev => prev.filter((_, idx) => idx !== i));

  // ── AGI Visual Verification (Phase 2) ───────────────────────────
  const handleVerifyNode = async (idx: number, nodeId: number, file: File) => {
    if (!directive) return;
    try {
      setTasks(prev => prev.map((t, i) => i === idx ? { ...t, verification_status: 'PENDING' } : t));
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', myEmpId);
      formData.append('node_id', String(nodeId));

      const res = await fetch(`${API}/synapse/directives/${directive.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Upload failed');
      
      setTasks(prev => prev.map((t, i) => {
        if (i !== idx) return t;
        const isVerified = data.agi_feedback?.includes('✅');
        return {
          ...t,
          done: isVerified || t.done,
          verification_status: isVerified ? 'VERIFIED' : 'REJECTED'
        };
      }));
      onSaved();
    } catch (e) {
      console.error(e);
      setTasks(prev => prev.map((t, i) => i === idx ? { ...t, verification_status: 'NONE' } : t));
    }
  };

  const handleToggleTask = async (idx: number, taskId?: number, currentlyDone?: boolean) => {
    if (!taskId) return; // Unsaved task
    const taskObj = tasks[idx];
    if (taskObj.requires_verification && !currentlyDone) {
      showToast('VERIFICATION REQUIRED', 'warning', 'AGI REQUIRES VISUAL EVIDENCE. Please upload a photo to verify completion.');
      return;
    }

    const newStatus = !currentlyDone;
    
    // Optimistic update
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, done: newStatus } : t));
    
    try {
      const res = await fetch(`${API}/synapse/directives/${directive!.id}/nodes/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_completed: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      onSaved(); // Trigger parent refresh to update Kanban completion pct
    } catch (err) {
      // Rollback
      setTasks(prev => prev.map((t, i) => i === idx ? { ...t, done: currentlyDone! } : t));
    }
  };

  const handleStartTask = async (idx: number, taskId?: number) => {
    if (!taskId) return;
    try {
      const res = await fetch(`${API}/synapse/directives/${directive!.id}/nodes/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ started: true }),
      });
      if (!res.ok) throw new Error("Failed to start task");
      onSaved();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { setError('Directive title is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      target_dept: targetDept.trim() || null,
      issued_by: myEmpId,
      nodes: tasks.filter(t => t.task.trim()).map(t => ({ 
        task: t.task.trim(), 
        done: t.done,
        assigned_to_id: t.assignee_id || null,
        target_dept: t.target_dept || null,
        requires_verification: t.requires_verification || false
      })),
      tagged_operatives: taggedOperatives,
      // parent_directive_id could be passed if we had sub-directives
    };
    try {
      const url = isEdit
        ? `${API}/synapse/directives/${directive!.id}`
        : `${API}/synapse/directives`;
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? 'Save failed');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // ── File Upload ─────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!directive) {
      setError('You must create the directive first before uploading files.');
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('uploaded_by', myEmpId);
    try {
      const res = await fetch(`${API}/synapse/directives/${directive.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.status === 'SUCCESS') {
        setFiles(prev => [...prev, { id: data.file_id, name: file.name, url: data.download_url }]);
      } else {
        throw new Error(data.detail ?? 'Upload failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveOperative = (empId: string) => {
    setTaggedOperatives(prev => prev.filter(id => id !== empId));
  };

  // ── Input style token ───────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#EEE', fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 900, letterSpacing: '1.5px',
    color: '#666', marginBottom: '6px', display: 'block',
  };

  const pm = PRIORITY_META[priority];

  return (
    <>
      {/* Backdrop (Disabled for Drag & Drop Interaction) */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.2)',
          pointerEvents: 'none', // Extremely important: allows dragging from Neural Tree
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 100vw)',
        background: 'linear-gradient(180deg, #0c0c18 0%, #080810 100%)',
        borderLeft: '1px solid rgba(212,175,55,0.15)',
        boxShadow: '-20px 0 80px rgba(0,0,0,0.9)',
        zIndex: 2100,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(212,175,55,0.08)',
          background: 'rgba(212,175,55,0.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#D4AF37', letterSpacing: '3px', fontWeight: 900, marginBottom: '6px' }}>
                {isEdit ? '✏️ EDIT DIRECTIVE' : '⚡ NEW DIRECTIVE'}
              </div>
              <div style={{ fontSize: '16px', color: '#FFF', fontWeight: 900 }}>
                {isEdit ? directive!.title : 'Issue Strategic Directive'}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#444', fontSize: '22px', cursor: 'pointer', padding: '4px', lineHeight: 1, marginTop: '2px' }}
            >×</button>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Directive Lifecycle Timeline */}
          {isEdit && directive && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#666', letterSpacing: '1.5px' }}>DIRECTIVE TIMELINE LIFECYCLE</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '4px 0' }}>
                {/* Connector Line */}
                <div style={{
                  position: 'absolute', left: '10px', right: '10px', top: '16px', height: '2px',
                  background: 'rgba(255,255,255,0.06)', zIndex: 0
                }} />
                
                {/* Node 1: Issued */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: '#00fbff', boxShadow: '0 0 10px #00fbff'
                  }} />
                  <span style={{ fontSize: '9px', fontWeight: 900, color: '#00fbff' }}>ISSUED</span>
                  <span style={{ fontSize: '8px', color: '#555' }}>
                    {(directive as any).created_at ? new Date((directive as any).created_at).toLocaleDateString() : '—'}
                  </span>
                </div>

                {/* Node 2: Picked Up */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: (directive as any).picked_at ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                    boxShadow: (directive as any).picked_at ? '0 0 10px #D4AF37' : 'none'
                  }} />
                  <span style={{ fontSize: '9px', fontWeight: 900, color: (directive as any).picked_at ? '#D4AF37' : '#444' }}>PICKED</span>
                  <span style={{ fontSize: '8px', color: '#555' }}>
                    {(directive as any).picked_at ? new Date((directive as any).picked_at).toLocaleDateString() : 'Pending'}
                  </span>
                </div>

                {/* Node 3: Under Review */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: (directive as any).reviewed_at ? '#00ff88' : 'rgba(255,255,255,0.1)',
                    boxShadow: (directive as any).reviewed_at ? '0 0 10px #00ff88' : 'none'
                  }} />
                  <span style={{ fontSize: '9px', fontWeight: 900, color: (directive as any).reviewed_at ? '#00ff88' : '#444' }}>REVIEW</span>
                  <span style={{ fontSize: '8px', color: '#555' }}>
                    {(directive as any).reviewed_at ? new Date((directive as any).reviewed_at).toLocaleDateString() : 'Pending'}
                  </span>
                </div>

                {/* Node 4: Secured/Completed */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: directive.status === 'COMPLETED' ? '#ff3366' : 'rgba(255,255,255,0.1)',
                    boxShadow: directive.status === 'COMPLETED' ? '0 0 10px #ff3366' : 'none'
                  }} />
                  <span style={{ fontSize: '9px', fontWeight: 900, color: directive.status === 'COMPLETED' ? '#ff3366' : '#444' }}>COMPLETED</span>
                  <span style={{ fontSize: '8px', color: '#555' }}>
                    {directive.status === 'COMPLETED' && (directive as any).updated_at ? new Date((directive as any).updated_at).toLocaleDateString() : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Title & AGI Auto-Decompiler */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>DIRECTIVE TITLE *</label>
              {!readOnly && !isEdit && (
                <button
                  onClick={handleAgiDecompose}
                  disabled={agiLoading}
                  style={{
                    background: agiLoading ? 'rgba(0,251,255,0.05)' : 'linear-gradient(90deg, rgba(0,251,255,0.1), rgba(212,175,55,0.1))',
                    border: '1px solid rgba(0,251,255,0.3)',
                    color: '#00fbff', fontSize: '9px', fontWeight: 900, letterSpacing: '1px',
                    padding: '4px 10px', borderRadius: '6px', cursor: agiLoading ? 'wait' : 'pointer',
                    boxShadow: agiLoading ? 'none' : '0 0 10px rgba(0,251,255,0.2)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {agiLoading ? '⏳ AGI THINKING...' : '✨ AUTO-DECOMPILE'}
                </button>
              )}
            </div>
            
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={readOnly}
              placeholder="e.g. Upgrade Pool Area Lighting"
              style={{ ...inputStyle, opacity: readOnly ? 0.7 : 1, cursor: readOnly ? 'not-allowed' : 'text' }}
              onFocus={e => { if(!readOnly) e.currentTarget.style.borderColor = 'rgba(0,251,255,0.4)'; }}
              onBlur={e => { if(!readOnly) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            />

            {/* AGI Loading / Error Pulse */}
            {agiLoading && (
              <div style={{
                marginTop: '10px', height: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', borderRadius: '2px'
              }}>
                <div style={{
                  width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, #00fbff, transparent)',
                  animation: 'agiPulse 1.5s infinite linear'
                }} />
              </div>
            )}
            {agiError && (
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#ff3366', fontWeight: 700 }}>
                ⚠️ AGI FAULT: {agiError}
              </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes agiPulse {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>OPERATIONAL BRIEFING</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={readOnly}
              placeholder="Describe the operational context, success criteria, and constraints..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, opacity: readOnly ? 0.7 : 1, cursor: readOnly ? 'not-allowed' : 'text' }}
              onFocus={e => { if(!readOnly) e.currentTarget.style.borderColor = 'rgba(0,251,255,0.4)'; }}
              onBlur={e => { if(!readOnly) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            />
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>PRIORITY LEVEL</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PRIORITIES.map(p => {
                const m = PRIORITY_META[p];
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => { if(!readOnly) setPriority(p); }}
                    disabled={readOnly}
                    style={{
                      flex: 1, padding: '10px 8px',
                      background: isSelected ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? m.color : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '10px', cursor: readOnly ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease', opacity: readOnly && !isSelected ? 0.3 : 1,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{m.icon}</span>
                    <span style={{ fontSize: '8px', fontWeight: 900, color: isSelected ? m.color : '#555', letterSpacing: '1px' }}>{p}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '6px', fontStyle: 'italic' }}>
              {pm.desc}
            </div>
          </div>

          {/* Target Department */}
          <div>
            <label style={labelStyle}>TARGET DEPARTMENT</label>
            <select
              value={targetDept}
              onChange={e => setTargetDept(e.target.value)}
              disabled={readOnly}
              style={{ ...inputStyle, cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.7 : 1 }}
              onFocus={e => { if(!readOnly) e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
              onBlur={e => { if(!readOnly) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              <option value="">All Departments</option>
              {matrixDepts.map(d => (
                <option key={d.code} value={d.code} style={{ background: '#0c0c18' }}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>

          {/* Task Checklist (DirectiveNodes) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>TASK CHECKLIST</label>
              {!readOnly && (
                <button
                  onClick={addTask}
                  style={{
                    background: 'rgba(0,251,255,0.08)', border: '1px solid rgba(0,251,255,0.2)',
                    color: '#00fbff', fontSize: '10px', fontWeight: 900, letterSpacing: '1px',
                    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                  }}
                >+ ADD TASK</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tasks.map((task, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isEdit && task.id ? (
                      <input 
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleToggleTask(i, task.id!, task.done)}
                        disabled={task.requires_verification && !task.done}
                        style={{ cursor: (task.requires_verification && !task.done) ? 'not-allowed' : 'pointer', transform: 'scale(1.2)', accentColor: '#00ff88' }}
                      />
                    ) : (
                      <span style={{ color: '#333', fontSize: '14px', flexShrink: 0 }}>☐</span>
                    )}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '10px', padding: '0 8px' }}>
                      <input
                        type="text"
                        value={task.task}
                        onChange={e => updateTaskText(i, e.target.value)}
                        disabled={readOnly}
                        placeholder={`Task ${i + 1}...`}
                        style={{ ...inputStyle, flex: 1, background: 'none', border: 'none', padding: '8px 4px', opacity: readOnly ? 0.7 : 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? '#777' : '#FFF' }}
                        onFocus={e => { if(!readOnly) e.currentTarget.parentElement!.style.borderColor = 'rgba(0,251,255,0.3)'; }}
                        onBlur={e => { if(!readOnly) e.currentTarget.parentElement!.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                      />
                      <select
                        value={task.target_dept || ''}
                        onChange={e => updateTaskDept(i, e.target.value)}
                        disabled={readOnly}
                        style={{
                          background: task.target_dept ? 'rgba(0,251,255,0.1)' : 'transparent',
                          border: 'none', color: task.target_dept ? '#00fbff' : '#666',
                          fontSize: '9px', fontWeight: 700, padding: '4px 6px', borderRadius: '4px',
                          cursor: readOnly ? 'not-allowed' : 'pointer', outline: 'none'
                        }}
                      >
                        <option value="">Dept?</option>
                        {matrixDepts.map(d => (
                          <option key={d.code} value={d.code} style={{ background: '#0c0c18' }}>{d.code}</option>
                        ))}
                      </select>
                      {task.assignee_name && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#00fbff', background: 'rgba(0,251,255,0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                          👤 {task.assignee_name.split(' ')[0]}
                        </span>
                      )}
                      {task.started_at && !task.done && (
                        <span style={{ fontSize: '9px', color: '#D4AF37', border: '1px solid #d4af3744', padding: '2px 6px', borderRadius: '4px' }}>
                          ⏱️ IN PROGRESS
                        </span>
                      )}
                      {task.completed_at && (
                        <span style={{ fontSize: '9px', color: '#00ff88', border: '1px solid #00ff8844', padding: '2px 6px', borderRadius: '4px' }}>
                          {task.started_at ? `⏱️ ${Math.max(1, Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 60000))} MIN` : '⏱️ DONE'}
                        </span>
                      )}
                      {!task.started_at && !task.done && task.assignee_id === myEmpId && task.id && (
                        <button 
                          onClick={() => handleStartTask(i, task.id)}
                          style={{ fontSize: '9px', fontWeight: 900, color: '#000', background: '#00fbff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          🚀 PICK UP
                        </button>
                      )}
                    </div>
                    {task.requires_verification && (
                      <span style={{ fontSize: '10px', color: '#d4af37', border: '1px solid #d4af3744', padding: '2px 6px', borderRadius: '4px' }}>
                        👁️ QA REQ
                      </span>
                    )}
                    {!readOnly && tasks.length > 1 && (
                      <button
                        onClick={() => removeTask(i)}
                        style={{ background: 'none', border: 'none', color: '#ff336644', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0, lineHeight: 1 }}
                      >×</button>
                    )}
                  </div>
                  
                  {/* Phase 2: AGI Zero-Trust Verification Dropzone */}
                  {isEdit && task.id && task.requires_verification && !task.done && (
                    <div style={{ marginLeft: '24px', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '11px', color: '#999' }}>
                      {task.verification_status === 'PENDING' ? (
                        <span style={{ color: '#00fbff' }}>⏳ AGI Vision scanning evidence...</span>
                      ) : (
                        <label htmlFor={`upload-task-${task.id}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37' }}>
                          <span>📸 Upload visual proof to unlock</span>
                          <input 
                            id={`upload-task-${task.id}`}
                            type="file" 
                            accept="image/*" 
                            style={{ display: 'none' }}
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                handleVerifyNode(i, task.id!, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      )}
                      {task.verification_status === 'REJECTED' && (
                        <span style={{ color: '#ff3366', display: 'block', marginTop: '4px' }}>❌ AGI REJECTED. Please try again.</span>
                      )}
                    </div>
                  )}
                  {task.requires_verification && task.done && (
                    <div style={{ marginLeft: '24px', fontSize: '10px', color: '#00ff88', fontWeight: 900 }}>
                      ✅ VERIFIED BY AGI ARBITRATOR
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tagged Operatives */}
          <div>
            <label style={labelStyle}>TAGGED OPERATIVES (Drop here from Neural Tree)</label>
            <div
              onDragOver={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'rgba(0,251,255,0.8)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0,251,255,0.15)';
                e.currentTarget.style.background = 'rgba(0,251,255,0.05)';
              }}
              onDragLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json'));
                  if (data.type === 'OPERATIVE' && data.empId) {
                    if (!taggedOperatives.includes(data.empId)) {
                      setTaggedOperatives(prev => [...prev, data.empId]);
                    }
                  }
                } catch (err) {}
              }}
              style={{
              display: 'flex', flexWrap: 'wrap', gap: '8px',
              padding: '10px', minHeight: '60px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px',
              transition: 'all 0.2s ease'
            }}>
              {taggedOperatives.map(empId => {
                const node = nodes.find(n => n.id === empId);
                return (
                  <div key={empId} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '20px',
                    background: 'rgba(0,251,255,0.1)', border: '1px solid rgba(0,251,255,0.3)',
                    fontSize: '11px', color: '#00fbff', fontWeight: 700
                  }}>
                    {node?.name || empId}
                    {!readOnly && (
                      <button onClick={() => handleRemoveOperative(empId)} style={{ background: 'none', border: 'none', color: '#00fbff', cursor: 'pointer', padding: 0 }}>×</button>
                    )}
                  </div>
                );
              })}
              {taggedOperatives.length === 0 && <span style={{ color: '#555', fontSize: '11px', margin: 'auto' }}>Drag operatives here...</span>}
            </div>
          </div>

          {/* Attachments Dropzone */}
          <div>
            <label style={labelStyle}>MISSION ASSETS & ATTACHMENTS</label>
            <label
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '20px', minHeight: '80px',
                background: 'rgba(212,175,55,0.02)',
                border: '1px dashed rgba(212,175,55,0.3)', borderRadius: '10px',
                transition: 'all 0.2s ease', cursor: directive ? 'pointer' : 'not-allowed'
              }}
            >
              <input
                type="file"
                multiple
                style={{ display: 'none' }}
                disabled={!directive || uploading}
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              {uploading ? (
                <span style={{ color: '#D4AF37', fontSize: '11px', fontWeight: 700 }}>⏳ UPLOADING...</span>
              ) : (
                <>
                  <span style={{ fontSize: '20px', opacity: directive ? 1 : 0.4 }}>📁</span>
                  <span style={{ color: directive ? '#D4AF37' : '#ff3366', fontSize: '11px', fontWeight: 700 }}>
                    {directive ? 'Click or Drop images/PDFs here' : '⚠️ Save directive first to unlock file uploads'}
                  </span>
                </>
              )}
            </label>
            
            {/* File List */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {files.map(f => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    textDecoration: 'none', color: '#EEE', fontSize: '12px'
                  }}>
                    📄 {f.name}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '12px', color: '#ff3366',
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', gap: '10px',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: '#666',
              fontWeight: 900, fontSize: '11px', letterSpacing: '1px', cursor: 'pointer',
            }}
          >CANCEL</button>
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2, padding: '12px',
                background: saving
                  ? 'rgba(212,175,55,0.1)'
                  : 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))',
                border: `1px solid ${saving ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.5)'}`,
                borderRadius: '10px',
                color: saving ? '#D4AF3766' : '#D4AF37',
                fontWeight: 900, fontSize: '11px', letterSpacing: '2px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {saving ? '⏳ SAVING...' : isEdit ? '✅ UPDATE DIRECTIVE' : '⚡ ISSUE DIRECTIVE'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
