'use client';
import React, { useState, useCallback, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Directive } from './synapse.types';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

// ─── SOVEREIGN CONSTANTS ─────────────────────────────────────────
const COLUMNS: { id: string; label: string; color: string; glow: string }[] = [
  { id: 'BACKLOG',     label: '📋 BACKLOG',     color: '#555',    glow: 'rgba(85,85,85,0.3)' },
  { id: 'IN_PROGRESS', label: '⚡ IN PROGRESS', color: '#00fbff', glow: 'rgba(0,251,255,0.25)' },
  { id: 'REVIEW',      label: '🔍 REVIEW',      color: '#D4AF37', glow: 'rgba(212,175,55,0.25)' },
  { id: 'COMPLETED',   label: '✅ COMPLETED',   color: '#00ff88', glow: 'rgba(0,255,136,0.25)' },
];

const PRIORITY_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: 'rgba(255,51,102,0.12)', border: '#ff3366', text: '#ff3366' },
  STRATEGIC: { bg: 'rgba(212,175,55,0.12)', border: '#D4AF37', text: '#D4AF37' },
  NORMAL:    { bg: 'rgba(0,251,255,0.08)', border: '#00fbff44', text: '#00fbff' },
};

// ─── SORTABLE CARD ───────────────────────────────────────────────
function DirectiveCard({
  directive,
  isDragging = false,
  onClick,
  myEmpId,
  token,
  onDeleted,
}: {
  directive: Directive;
  isDragging?: boolean;
  onClick?: () => void;
  myEmpId?: string;
  token?: string;
  onDeleted?: () => void;
}) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const { attributes, listeners, setNodeRef, transform, transition, active } =
    useSortable({ id: String(directive.id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms cubic-bezier(0.25,0.46,0.45,0.94)',
    opacity: active?.id === String(directive.id) && !isDragging ? 0.35 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const ps = PRIORITY_STYLE[directive.priority] ?? PRIORITY_STYLE.NORMAL;

  const fmtTime = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm('DELETE DIRECTIVE', `Delete directive "${directive.title}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      const res = await fetch(`${API}/synapse/directives/${directive.id}?issued_by=${myEmpId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        onDeleted?.();
      } else {
        showToast('DELETE FAILED', 'error', data.detail || 'Delete failed.');
      }
    } catch { showToast('NETWORK ERROR', 'error', 'Network error.'); }
  };

  const handleMarkCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm('COMPLETE DIRECTIVE', 'Mark this directive as COMPLETED? This closes it permanently.');
    if (!confirmed) return;
    try {
      const res = await fetch(`${API}/synapse/directives/${directive.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'COMPLETED', reviewed_by: myEmpId }),
      });
      const data = await res.json();
      if (data.status !== 'SUCCESS') showToast('ERROR', 'error', data.detail || 'Failed to complete directive.');
      onDeleted?.(); // Triggers refresh
    } catch { showToast('NETWORK ERROR', 'error', 'Network error.'); }
  };

  const isIssuer = myEmpId === directive.issued_by;
  const isInReview = directive.status === 'REVIEW';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isDragging ? ps.border : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '10px',
        backdropFilter: 'blur(20px)',
        boxShadow: isDragging
          ? `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${ps.border}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        willChange: 'transform',
      }}
      onMouseEnter={e => {
        if (!isDragging) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        }
      }}
      onMouseLeave={e => {
        if (!isDragging) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }
      }}
      >
        {/* Priority + Dept + Delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <span style={{
            fontSize: '9px', fontWeight: 900, letterSpacing: '1.5px',
            padding: '3px 8px', borderRadius: '20px',
            background: ps.bg, border: `1px solid ${ps.border}`, color: ps.text,
          }}>
            {directive.priority}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {directive.target_dept && (
              <span style={{ fontSize: '9px', color: '#555', fontWeight: 700, letterSpacing: '1px' }}>
                {directive.target_dept}
              </span>
            )}
            {/* Delete button — issuer + managers see this */}
            {isIssuer && (
              <button
                onClick={handleDelete}
                style={{ background: 'rgba(255,51,102,0.15)', border: '1px solid rgba(255,51,102,0.3)', color: '#ff3366', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 900 }}
              >🗑</button>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: '13px', color: '#EEE', fontWeight: 700, lineHeight: 1.4, marginBottom: '8px' }}>
          {directive.title}
        </div>

        {/* Progress Bar */}
        {directive.node_count > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '9px', color: '#555' }}>{directive.node_count} tasks</span>
              <span style={{ fontSize: '9px', color: directive.completion_pct === 100 ? '#00ff88' : '#D4AF37', fontWeight: 700 }}>
                {directive.completion_pct}%
              </span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${directive.completion_pct}%`,
                background: directive.completion_pct === 100
                  ? 'linear-gradient(90deg, #00ff88, #00fbff)'
                  : 'linear-gradient(90deg, #D4AF37, #ff9900)',
                borderRadius: '2px',
                transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
          </div>
        )}

        {/* ⏱️ TIMELINE STRIP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
          <div style={{ fontSize: '9px', color: '#444', display: 'flex', gap: '6px' }}>
            <span style={{ color: '#555' }}>📋 ISSUED</span>
            <span>{fmtTime((directive as any).created_at) || '—'}</span>
          </div>
          {(directive as any).picked_at && (
            <div style={{ fontSize: '9px', color: '#D4AF37', display: 'flex', gap: '6px' }}>
              <span>🚀 PICKED</span>
              <span>{fmtTime((directive as any).picked_at)}</span>
            </div>
          )}
          {(directive as any).reviewed_at && (
            <div style={{ fontSize: '9px', color: '#00fbff', display: 'flex', gap: '6px' }}>
              <span>🔍 REVIEW</span>
              <span>{fmtTime((directive as any).reviewed_at)}</span>
            </div>
          )}
        </div>

        {/* REVIEW → COMPLETE button (issuer only, when in REVIEW) */}
        {isIssuer && isInReview && (
          <button
            onClick={handleMarkCompleted}
            style={{
              width: '100%', padding: '7px', marginBottom: '6px',
              background: 'linear-gradient(90deg, #00ff88, #00fbff)',
              border: 'none', borderRadius: '8px',
              color: '#000', fontWeight: 900, fontSize: '10px', cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            ✅ MARK COMPLETED
          </button>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', color: '#444' }}>BY {directive.issued_by}</span>
          <span style={{ fontSize: '10px', color: '#444' }}>⋮⋮</span>
        </div>
      </div>
    </div>
  );
}

// ─── DROPPABLE COLUMN ────────────────────────────────────────────
function KanbanColumn({
  col,
  directives,
  onCardClick,
  myEmpId,
  token,
  onRefresh,
}: {
  col: typeof COLUMNS[0];
  directives: Directive[];
  onCardClick: (d: Directive) => void;
  myEmpId: string;
  token: string;
  onRefresh: () => void;
}) {
  return (
    <div style={{
      flex: '1 1 0',
      minWidth: '200px',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
    }}>
      {/* Column Header */}
      <div style={{
        padding: '10px 14px',
        marginBottom: '12px',
        borderRadius: '10px',
        background: `linear-gradient(135deg, ${col.glow}, transparent)`,
        border: `1px solid ${col.glow}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '1px', color: col.color }}>
          {col.label}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 900,
          background: `rgba(255,255,255,0.05)`,
          border: `1px solid ${col.glow}`,
          color: col.color,
          padding: '1px 7px', borderRadius: '20px',
        }}>
          {directives.length}
        </span>
      </div>

      {/* Drop Zone */}
      <div style={{
        flex: 1,
        minHeight: '80px',
        padding: '4px 2px',
        borderRadius: '8px',
        background: directives.length === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
        border: directives.length === 0 ? '1px dashed rgba(255,255,255,0.05)' : 'none',
        transition: 'background 0.2s ease',
      }}>
        <SortableContext
          items={directives.map(d => String(d.id))}
          strategy={verticalListSortingStrategy}
        >
          {directives.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#2a2a2a', fontSize: '11px' }}>
              No directives
            </div>
          ) : (
            directives.map(d => (
              <DirectiveCard
                key={d.id}
                directive={d}
                onClick={() => onCardClick(d)}
                myEmpId={myEmpId}
                token={token}
                onDeleted={onRefresh}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── MAIN KANBAN EXPORT ──────────────────────────────────────────
interface SynapseKanbanProps {
  directives: Directive[];
  token: string;
  nodes: any[];
  myEmpId: string;
  onDirectivesChange: (updated: Directive[]) => void;
  onCardClick: (d: Directive) => void;
  onRefresh?: () => void;  // Full re-fetch from parent
}

export default function SynapseKanban({
  directives,
  token,
  nodes,
  myEmpId,
  onDirectivesChange,
  onCardClick,
  onRefresh,
}: SynapseKanbanProps) {
  const [activeDirective, setActiveDirective] = useState<Directive | null>(null);
  const [, startTransition] = useTransition();

  // Iron Law 6: PointerSensor with 8px activation distance to prevent accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const getColumn = useCallback(
    (id: string) => COLUMNS.find(c => c.id === id),
    []
  );

  const findDirectiveById = useCallback(
    (id: string) => directives.find(d => String(d.id) === id),
    [directives]
  );

  const findColumnForDirective = useCallback(
    (directiveId: string) => {
      const d = findDirectiveById(directiveId);
      return d ? d.status : null;
    },
    [findDirectiveById]
  );

  const myNode = nodes.find(n => n.id === myEmpId);
  const isOperative = myNode?.exec_tier === 1;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (isOperative) return; // Operatives cannot drag
    const d = findDirectiveById(String(event.active.id));
    if (d) setActiveDirective(d);
  }, [findDirectiveById, isOperative]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDirective(null);
    if (isOperative) return; // Operatives cannot drag
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Determine target column: either by column id or by hovering over another card
    const targetColumnId =
      getColumn(overId)?.id ?? findColumnForDirective(overId);

    if (!targetColumnId) return;

    const sourceDirective = findDirectiveById(activeId);
    if (!sourceDirective || sourceDirective.status === targetColumnId) return;

    // Optimistic UI update — Iron Law 6 (60FPS, no layout thrashing)
    startTransition(() => {
      onDirectivesChange(
        directives.map(d =>
          String(d.id) === activeId ? { ...d, status: targetColumnId } : d
        )
      );
    });

    // Persist to backend
    try {
      await fetch(`${API}/synapse/directives/${sourceDirective.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: targetColumnId }),
      });
    } catch {
      // Rollback on failure
      onDirectivesChange(directives);
    }
  }, [directives, findDirectiveById, findColumnForDirective, getColumn, onDirectivesChange, token]);

  const directivesByColumn = useCallback(
    (colId: string) => directives.filter(d => d.status === colId),
    [directives]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'flex',
        gap: '14px',
        height: '100%',
        padding: '4px 2px',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            directives={directivesByColumn(col.id)}
            onCardClick={onCardClick}
            myEmpId={myEmpId}
            token={token}
            onRefresh={onRefresh || (() => onDirectivesChange([...directives]))}
          />
        ))}
      </div>

      {/* Drag Overlay — hardware-accelerated ghost card */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18,0.67,0.6,1.22)',
      }}>
        {activeDirective ? (
          <div style={{ transform: 'rotate(2deg) scale(1.04)', willChange: 'transform' }}>
            <DirectiveCard directive={activeDirective} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
