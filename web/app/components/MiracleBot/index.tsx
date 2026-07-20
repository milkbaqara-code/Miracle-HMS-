'use client';
// ============================================================
// MiracleBot / index.tsx  —  SOVEREIGN KERNEL ROOT  V4.0
//
// This file is the SINGLE COMPOSITION POINT for the entire
// MiracleBot architecture. It wires all hooks together and
// passes state down to the two top-level view components.
//
// Rule: NO business logic here. All logic lives in hooks.
// Rule: NO inline styles for layout — that lives in components.
// Rule: NO direct API calls — that lives in useMiracleQuery.
//
// Dependency graph (read top-to-bottom):
//   lib/ (pure) → hooks/ (stateful) → components/ (view)
//
// V4.0 — Enterprise Refactor
// ============================================================
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// ── lib ──────────────────────────────────────────────────────
import { VISITOR_READ_ONLY_ZONES } from './lib/constants';
import { resolveZone }             from './lib/zoneResolver';

// ── hooks ────────────────────────────────────────────────────
import { useMiracleSession }      from './hooks/useMiracleSession';
import { useMiracleSpeech }       from './hooks/useMiracleSpeech';
import { useMiracleSTT }          from './hooks/useMiracleSTT';
import { useMiracleDrag }         from './hooks/useMiracleDrag';
import { useMiracleAlerts }       from './hooks/useMiracleAlerts';
import { useBrowserErrorMonitor } from './hooks/useBrowserErrorMonitor';
import { useFeatureRequest }      from './hooks/useFeatureRequest';
import { useMiracleIntake }       from './hooks/useMiracleIntake';
import { useMiracleProposals }    from './hooks/useMiracleProposals';
import { useMiracleQuery }        from './hooks/useMiracleQuery';

// ── components ───────────────────────────────────────────────
import { MiracleBotOrb }   from './components/MiracleBotOrb';
import { MiracleBotPanel } from './components/MiracleBotPanel';

// ── Wisp engine (preserved exactly from monolith) ────────────
const moveWispToLabel = (label: string) => {
  try {
    const el = document.querySelector(`[data-wisp="${label}"]`)
      || document.getElementById(label)
      || document.querySelector(`[aria-label="${label}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement).style.outline = '2px solid #00F2FF';
    (el as HTMLElement).style.boxShadow = '0 0 16px #00F2FF66';
    setTimeout(() => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.boxShadow = '';
    }, 2800);
  } catch {}
};

// ── Language detection ────────────────────────────────────────
const detectLanguage = () => {
  if (typeof window === 'undefined') return 'en-US';
  const stored = localStorage.getItem('miracle_language');
  if (stored) return stored;
  return navigator.language || 'en-US';
};

export function MiracleBot() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Zone resolution ─────────────────────────────────────────
  const zone = resolveZone(pathname, []);  // kernelZones can be injected via context later

  // ── Bot open/close state ────────────────────────────────────
  const [isOpen,         setIsOpen]         = useState(false);
  const [isGhostMode,    setIsGhostMode]    = useState(false);
  const [showOrbHint,    setShowOrbHint]    = useState(false);
  const [isAwakening,    setIsAwakening]    = useState(false);
  const [showFeatureForm,setShowFeatureForm] = useState(false);
  const [pendingWisp,    setPendingWisp]    = useState<string | null>(null);
  const [wispTarget,     setWispTarget]     = useState<string | null>(null);
  const [visitorWarning, setVisitorWarning] = useState<string | null>(null);
  const [language]                          = useState(detectLanguage);
  const hasInteracted                       = useRef(false);

  // ── Session ──────────────────────────────────────────────────
  const session = useMiracleSession();

  // ── Speech / TTS ─────────────────────────────────────────────
  const speech  = useMiracleSpeech();
  speech.isOpenRef.current = isOpen;

  // ── Query engine ─────────────────────────────────────────────
  const moveWisp = useCallback((label: string) => {
    setWispTarget(label);
    moveWispToLabel(label);
    setTimeout(() => setWispTarget(null), 3000);
  }, []);

  const query = useMiracleQuery({
    zone,
    sessionId:   session.sessionId.current,
    userId:      session.userId.current,
    role:        session.role.current,
    activeUser:  session.activeUser.current,
    language,
    speak:       speech.speak,
    stopAllSpeech: speech.stopAllSpeech,
    moveWispTo:  moveWisp,
    setPendingWisp,
  });

  // ── STT ──────────────────────────────────────────────────────
  const stt = useMiracleSTT({
    language,
    stopAllSpeech: speech.stopAllSpeech,
    onTranscript: (text) => {
      hasInteracted.current = true;
      query.askMiracle(text);
    },
  });

  // ── Drag ─────────────────────────────────────────────────────
  const drag = useMiracleDrag(isOpen);

  // ── Alerts ───────────────────────────────────────────────────
  const alerts = useMiracleAlerts(speech.isOpenRef);
  // Wire alert messages into the chat
  alerts.onNewAlerts.current = (newAlerts) => {
    newAlerts.forEach((a: any) => query.addMsg('alert', `⚠️ ${a.message || JSON.stringify(a)}`));
  };

  // ── Browser error monitor (Z-23) ─────────────────────────────
  useBrowserErrorMonitor({
    zone:      zone.zone,
    sessionId: session.sessionId.current,
  });

  // ── Intake (V4.0) ────────────────────────────────────────────
  const intake = useMiracleIntake({
    zone:      zone.zone,
    sessionId: session.sessionId.current,
    isVisitor: session.isVisitor.current,
  });

  // ── Proposals (V4.0) ─────────────────────────────────────────
  const proposals = useMiracleProposals({
    sessionId:  session.sessionId.current,
    role:       session.role.current,
    activeUser: session.activeUser.current,
  });

  // ── Feature request ──────────────────────────────────────────
  const feat = useFeatureRequest({
    zone:       zone.zone,
    sessionId:  session.sessionId.current,
    activeUser: session.activeUser.current,
    addMsg:     query.addMsg,
    speak:      speech.speak,
    setShowFeatureForm,
  });

  // ── Visitor access control ────────────────────────────────────
  useEffect(() => {
    if (session.isVisitor.current && VISITOR_READ_ONLY_ZONES.includes(zone.zone)) {
      setVisitorWarning(`Visitor access: you may view this zone but cannot interact with the AI. Contact your administrator for full access.`);
    } else {
      setVisitorWarning(null);
    }
  }, [zone.zone, session.isVisitor]);

  // ── Orb first-use hint ────────────────────────────────────────
  useEffect(() => {
    const seen = localStorage.getItem('mir_orb_hint_seen');
    if (!seen) {
      setShowOrbHint(true);
      localStorage.setItem('mir_orb_hint_seen', '1');
    }
  }, []);

  // ── Cross-route wisp applicator ───────────────────────────────
  useEffect(() => {
    if (pendingWisp) {
      const t = setTimeout(() => { moveWisp(pendingWisp); setPendingWisp(null); }, 800);
      return () => clearTimeout(t);
    }
  }, [pathname, pendingWisp, moveWisp]);

  // ── Greeting on open ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (query.messages.length > 0) return;
    const greeting = zone.zone === 'Z-LOGIN'
      ? `Welcome to Miracle HMS — the Sovereign AI Hospitality System. I'm your Miracle Sales Agent. How can I assist you today?`
      : `Good day. I am your Miracle AI Agent, operating in the ${zone.name}. How may I assist you, Sir?`;
    query.addMsg('bot', greeting);
    speech.speak(greeting);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Orb open/close handler ────────────────────────────────────
  const handleOrbAction = useCallback(() => {
    const now = Date.now();
    if (now - drag.lastOrbTapRef.current < 300) {
      setIsGhostMode(prev => !prev); // double-tap = ghost
      return;
    }
    drag.lastOrbTapRef.current = now;
    const next = !isOpen;
    setIsOpen(next);
    speech.isOpenRef.current = next;
  }, [isOpen, drag.lastOrbTapRef, speech.isOpenRef]);

  // ── Awaken ───────────────────────────────────────────────────
  const handleAwaken = useCallback(() => {
    setIsAwakening(true);
    hasInteracted.current = true;
    speech.flushPendingSpeech();
    setTimeout(() => setIsAwakening(false), 1500);
  }, [speech]);

  const isReadOnly = session.isVisitor.current && VISITOR_READ_ONLY_ZONES.includes(zone.zone);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  if (!mounted) return null;

  return (
    <div
      ref={drag.outerRef}
      className={isOpen ? 'miracle-bot-container open' : 'miracle-bot-container'}
      style={{
        position:    'fixed',
        bottom:      90,
        right:       20,
        zIndex:      999999,
        fontFamily:  "'Inter', sans-serif",
        transform:   `translate(${drag.pos.x}px, ${drag.pos.y}px)`,
        touchAction: 'none',
        pointerEvents:'auto',
        userSelect:  'none',
        cursor:      !isOpen ? (isGhostMode ? 'pointer' : 'grab') : 'default',
      }}
    >
      {/* ── FLAME ORB (closed state) ─────────────────────── */}
      {!isOpen && (
        <MiracleBotOrb
          zone={zone}
          isSpeaking={speech.isSpeaking}
          isGhostMode={isGhostMode}
          alertCount={alerts.alertCount}
          showOrbHint={showOrbHint}
          wispTarget={wispTarget}
          onPointerDown={drag.handleOrbPointerDown}
          onPointerMove={drag.handleOrbPointerMove}
          onPointerUp={e => { const wasTap = drag.handleOrbPointerUp(e); if (wasTap) handleOrbAction(); }}
          onClick={() => { if (drag.draggingRef.current.movedPx < 12) handleOrbAction(); }}
        />
      )}

      {/* ── CHAT PANEL (open state) ─────────────────────── */}
      {isOpen && (
        <MiracleBotPanel
          zone={zone}
          synapseError={query.synapseError}
          isSpeaking={speech.isSpeaking}
          isThinking={query.isThinking}
          isListening={stt.isListening}
          isMuted={speech.isMuted}
          hasPendingSpeech={speech.hasPendingSpeech}
          volume={speech.volume}
          messages={query.messages}
          hasInteracted={hasInteracted}
          isAwakening={isAwakening}
          visitorWarning={visitorWarning}
          onApproveProposal={query.handleApproveProposal}
          onDeclineProposal={query.handleDeclineProposal}
          onAwaken={handleAwaken}
          onPanelClick={() => {
            if (!hasInteracted.current) {
              hasInteracted.current = true;
              speech.flushPendingSpeech();
            }
          }}
          onClose={() => { setIsOpen(false); speech.isOpenRef.current = false; }}
          onMuteToggle={() => speech.setIsMuted(prev => !prev)}
          onVolumeChange={v => { speech.setVolume(v); speech.volumeRef.current = v; }}
          onUnlockAndPlay={() => {
            hasInteracted.current = true;
            speech.flushPendingSpeech();
          }}
          showFeatureForm={showFeatureForm}
          setShowFeatureForm={setShowFeatureForm}
          featureText={feat.featureText}
          setFeatureText={feat.setFeatureText}
          featureStatus={feat.featureStatus}
          onSubmitFeature={feat.submitFeatureRequest}
          isReadOnly={isReadOnly}
          onStartListening={stt.startListening}
          onStopListening={stt.stopListening}
          onSend={text => {
            hasInteracted.current = true;
            query.askMiracle(text);
          }}
          onPointerDown={drag.handlePointerDown}
          onPointerMove={drag.handlePointerMove}
          onPointerUp={drag.handlePointerUp}
          hubOpen={proposals.hubOpen}
          setHubOpen={proposals.setHubOpen}
          pendingProposals={proposals.pendingProposals}
          onHubApprove={proposals.approveProposal}
          onHubDecline={proposals.declineProposal}
          intakeOpen={intake.intakeOpen}
          intakeSaving={intake.intakeSaving}
          onIntakeSelect={intake.saveIntake}
          onIntakeSkip={() => intake.setIntakeOpen(false)}
        />
      )}
    </div>
  );
}

export default MiracleBot;
