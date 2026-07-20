'use client';
// ============================================================
// MiracleBot / hooks / useMiracleDrag.ts
// Sovereign orb drag & position engine.
// Handles pointer events, localStorage persistence, and
// viewport-bound safety snapping.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';

interface DragPos { x: number; y: number; }

const getBoundedPos = (x: number, y: number): DragPos => {
  if (typeof window === 'undefined') return { x, y };
  const maxX = window.innerWidth  - 100;
  const maxY = window.innerHeight - 180;
  return { x: Math.max(-300, Math.min(x, maxX)), y: Math.max(-600, Math.min(y, maxY)) };
};

export function useMiracleDrag(isOpen: boolean) {
  const [pos, setPos] = useState<DragPos>(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem('miracle_orb_pos') || 'null');
      if (saved && typeof saved.x === 'number') return saved;
    } catch {}
    return { x: 0, y: 0 };
  });

  const outerRef    = useRef<HTMLDivElement>(null);
  const draggingRef = useRef({
    isDragging: false, startX: 0, startY: 0,
    initialX: 0, initialY: 0, movedPx: 0, liveX: 0, liveY: 0,
  });

  // Persist position to localStorage
  useEffect(() => {
    try { localStorage.setItem('miracle_orb_pos', JSON.stringify(pos)); } catch {}
  }, [pos]);

  // Safety: snap back if off-screen (e.g. window resize)
  useEffect(() => {
    const safe = getBoundedPos(pos.x, pos.y);
    if (safe.x !== pos.x || safe.y !== pos.y) setPos(safe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PANEL DRAG (when open) ────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = {
      isDragging: true, startX: e.clientX, startY: e.clientY,
      initialX: pos.x, initialY: pos.y, movedPx: 0, liveX: pos.x, liveY: pos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current.isDragging) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    draggingRef.current.movedPx = Math.sqrt(dx * dx + dy * dy);
    draggingRef.current.liveX = draggingRef.current.initialX + dx;
    draggingRef.current.liveY = draggingRef.current.initialY + dy;
    
    if (moveRequestRef.current) cancelAnimationFrame(moveRequestRef.current);
    moveRequestRef.current = requestAnimationFrame(() => {
      if (outerRef.current) {
        outerRef.current.style.transform = `translate(${draggingRef.current.liveX}px, ${draggingRef.current.liveY}px)`;
      }
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current.isDragging) return;
    draggingRef.current.isDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (moveRequestRef.current) cancelAnimationFrame(moveRequestRef.current);
    const bounded = getBoundedPos(draggingRef.current.liveX, draggingRef.current.liveY);
    setPos(bounded);
  }, []);

  // ── ORB DRAG (when closed) ────────────────────────────────────────────────
  const moveRequestRef   = useRef<number | null>(null);
  const lastOrbTapRef    = useRef<number>(0);

  const handleOrbPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = {
      isDragging: true, startX: e.clientX, startY: e.clientY,
      initialX: pos.x, initialY: pos.y, movedPx: 0, liveX: pos.x, liveY: pos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }, [pos]);

  const handleOrbPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current.isDragging) return;
    e.preventDefault();
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    draggingRef.current.movedPx = Math.sqrt(dx * dx + dy * dy);
    draggingRef.current.liveX   = draggingRef.current.initialX + dx;
    draggingRef.current.liveY   = draggingRef.current.initialY + dy;
    if (moveRequestRef.current) cancelAnimationFrame(moveRequestRef.current);
    moveRequestRef.current = requestAnimationFrame(() => {
      if (outerRef.current) {
        outerRef.current.style.transform =
          `translate(${draggingRef.current.liveX}px, ${draggingRef.current.liveY}px)`;
      }
    });
  }, []);

  const handleOrbPointerUp = useCallback((e: React.PointerEvent): boolean => {
    if (!draggingRef.current.isDragging) return false;
    draggingRef.current.isDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (moveRequestRef.current) cancelAnimationFrame(moveRequestRef.current);
    const bounded = getBoundedPos(draggingRef.current.liveX, draggingRef.current.liveY);
    setPos(bounded);
    // Returns true if this was a TAP (not a drag)
    return draggingRef.current.movedPx < 12;
  }, []);

  return {
    pos, setPos, outerRef, draggingRef, lastOrbTapRef,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handleOrbPointerDown, handleOrbPointerMove, handleOrbPointerUp,
  };
}
