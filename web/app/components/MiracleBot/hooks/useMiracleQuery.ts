'use client';
// ============================================================
// MiracleBot / hooks / useMiracleQuery.ts
// CORE AI QUERY ENGINE — The sovereign brain of the bot.
//
// Responsibility chain (Iron Law order — NEVER change):
//   1. Add user message to chat
//   2. Layer 0: Local Brain Interceptor (zero-latency, 0 tokens)
//   3. POST to /api/bot/v2/query
//   4. Detect PROPOSAL JSON in response
//   5. Extract ALL protocol tags BEFORE stripping display text
//   6. Strip ALL tags from display text
//   7. STATUS → info message
//   8. LOGIN → PIN auth handshake
//   9. NAVIGATE → route (1.5s delay), skip FOCUS
//   10. FOCUS → Wisp move (600ms delay, after speak starts)
//   11. WhatsApp CTA injection
//   12. ROI widget auto-trigger
//   13. Session memory update
//   14. In-chat proposal approve/decline handlers
//
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { API } from '../lib/constants';
import { tick } from '../lib/sessionUtils';
import { ZONES } from '../lib/zoneResolver';
import { runMiracleBrain } from '../../miracle_brain';
import type { BotMessage, ProposalPayload, ZoneInfo } from '../lib/types';

interface QueryOptions {
  zone: ZoneInfo;
  sessionId: string;
  userId: string;
  role: string;
  activeUser: string;
  language: string;
  speak: (text: string) => void;
  stopAllSpeech: () => void;
  moveWispTo: (label: string) => void;
  setPendingWisp: (label: string | null) => void;
}

export function useMiracleQuery({
  zone, sessionId, userId, role, activeUser,
  language, speak, stopAllSpeech, moveWispTo, setPendingWisp,
}: QueryOptions) {
  const [messages,    setMessages]    = useState<BotMessage[]>([]);
  const [isThinking,  setIsThinking]  = useState(false);
  const [synapseError,setSynapseError]= useState(false);
  const router = useRouter();

  // ── ADD MESSAGE ───────────────────────────────────────────────────────────
  const addMsg = useCallback((
    role: BotMessage['role'],
    text: string,
    proposal?: ProposalPayload
  ) => {
    const hasContact =
      text.includes('[BTN_WHATSAPP]') ||
      text.includes('wa.me/')         ||
      text.includes('WhatsApp')       ||
      text.includes('engineer');

    const cleanText = text
      .replace(/\[BTN_WHATSAPP\]/g, '')
      .replace(/\[BTN_EMAIL\]/g, '')
      .replace(/\[\s*NAVIGATE\s*:[^\]]*\]/gi, '')
      .replace(/\[\s*FOCUS\s*:[^\]]*\]/gi, '')
      .replace(/https?:\/\/wa\.me\/\S*/g, '')
      .replace(/Connect with them right now on WhatsApp:?\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    setMessages(prev => [...prev, {
      role,
      text: cleanText,
      time: tick(),
      showContact: hasContact && role === 'bot',
      proposal,
    }]);
  }, []);

  // ── IN-CHAT PROPOSAL APPROVE ──────────────────────────────────────────────
  const handleApproveProposal = useCallback(async (index: number) => {
    setMessages(prev => {
      const msg = prev[index];
      if (!msg?.proposal) return prev;
      return prev; // will update after fetch
    });

    setMessages(prev => {
      const msg = prev[index];
      if (!msg?.proposal) return prev;

      // Fire async — can't await inside setMessages
      const finalRole = typeof window !== 'undefined' ? (localStorage.getItem('vigilant_role') || 'VISITOR') : role;
      const finalUser = typeof window !== 'undefined' ? (localStorage.getItem('miracle_user') || 'Guest') : activeUser;

      fetch(`${API}/bot/v2/execute-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      msg.proposal.action,
          parameters:  msg.proposal.parameters,
          proposal_id: msg.proposal.proposal_id,
          role:        finalRole,
          active_user: finalUser,
        }),
      })
        .then(r => r.json())
        .then(data => {
          setMessages(next => {
            const updated = [...next];
            updated[index] = {
              ...updated[index],
              proposal: {
                ...updated[index].proposal!,
                approved:   true,
                resultText: data.response || 'Executed.',
              },
            };
            return updated;
          });
          addMsg('info', `Action executed successfully.`);
        })
        .catch(err => addMsg('alert', `Execute failed: ${err.message}`));

      return prev;
    });
  }, [role, activeUser, addMsg]);

  // ── IN-CHAT PROPOSAL DECLINE ──────────────────────────────────────────────
  const handleDeclineProposal = useCallback((index: number) => {
    setMessages(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        proposal: { ...next[index].proposal!, declined: true },
      };
      return next;
    });
    addMsg('info', 'Action declined.');
  }, [addMsg]);

  // ── PATH CORRECTIONS — LLM hallucination guard ────────────────────────────
  const PATH_CORRECTIONS: Record<string, string> = {
    '/dashboard/reservation':   '/dashboard/reservations',
    '/dashboard/ticket':        '/dashboard/issue-tickets',
    '/dashboard/issue-ticket':  '/dashboard/issue-tickets',
    '/dashboard/account':       '/dashboard/accounts',
    '/dashboard/guest-app':     '/dashboard/guest-marketing',
    '/dashboard/pos-terminal':  '/dashboard/pos',
    '/dashboard/spa':           '/dashboard/wellness',
    '/dashboard/wellness-spa':  '/dashboard/wellness',
    '/dashboard/boutique':      '/dashboard/boutiques',
    '/dashboard/shop':          '/dashboard/boutiques',
    '/dashboard/retail':        '/dashboard/boutiques',
    '/dashboard/transport':     '/dashboard/fleet',
    '/dashboard/transfer':      '/dashboard/fleet',
    '/dashboard/gastronomy':    '/dashboard/z29-gastronomy',
    '/dashboard/fnb':           '/dashboard/z29-gastronomy',
    '/dashboard/fb':            '/dashboard/z29-gastronomy',
    '/dashboard/restaurant':    '/dashboard/z29-gastronomy',
    '/dashboard/food':          '/dashboard/z29-gastronomy',
    '/dashboard/synapse-nexus': '/dashboard/synapse',
    '/dashboard/command':           '/dashboard',
    '/dashboard/command-grid':      '/dashboard',
    // HMS Clinical aliases (added for navigation fix)
    '/dashboard/reservation':       '/dashboard/reservations',
    '/dashboard/opd':               '/dashboard/reservations',
    '/dashboard/appointments':      '/dashboard/reservations',
    '/dashboard/admission':         '/dashboard/reservations',
    '/dashboard/admissions':        '/dashboard/reservations',
    '/dashboard/billing':           '/dashboard/checkout',
    '/dashboard/bill':              '/dashboard/checkout',
    '/dashboard/discharge':         '/dashboard/checkout',
    '/dashboard/patient-billing':   '/dashboard/checkout',
    '/dashboard/invoice':           '/dashboard/checkout',
    '/dashboard/finance':           '/dashboard/accounts',
    '/dashboard/account':           '/dashboard/accounts',
    '/dashboard/ledger':            '/dashboard/accounts',
    '/dashboard/staff':             '/dashboard/hr',
    '/dashboard/hr-engine':         '/dashboard/hr',
    '/dashboard/payroll':           '/dashboard/hr',
    '/dashboard/employees':         '/dashboard/hr',
    '/dashboard/pharmacy':          '/dashboard/inventory',
    '/dashboard/drug':              '/dashboard/inventory',
    '/dashboard/stock':             '/dashboard/inventory',
    '/dashboard/patients':          '/dashboard/crm',
    '/dashboard/patient-records':   '/dashboard/crm',
    '/dashboard/tickets':           '/dashboard/issue-tickets',
    '/dashboard/ticket':            '/dashboard/issue-tickets',
    '/dashboard/issue-ticket':      '/dashboard/issue-tickets',
    '/dashboard/maintenance':       '/dashboard/issue-tickets',
    '/dashboard/missions':          '/dashboard/solve',
    '/dashboard/war-room':          '/dashboard/synapse',
    '/dashboard/synapse-nexus':     '/dashboard/synapse',
    '/dashboard/org-chart':         '/dashboard/synapse',
    '/dashboard/beds':              '/dashboard',
    '/dashboard/ward':              '/dashboard',
    '/dashboard/clinical':          '/dashboard',
    '/dashboard/census':            '/dashboard',
    '/dashboard/infra':             '/dashboard/infrastructure',
    '/dashboard/server':            '/dashboard/infrastructure',
    '/dashboard/vps':               '/dashboard/infrastructure',
    '/dashboard/setting':           '/dashboard/settings',
    '/dashboard/kernel':            '/dashboard/settings',
    '/dashboard/users':             '/dashboard/settings',
    '/dashboard/config':            '/dashboard/settings',
    '/dashboard/pricing':           '/dashboard/policy',
    '/dashboard/rates':             '/dashboard/policy',
    '/dashboard/biometric':         '/dashboard/portal',
    '/dashboard/attendance':        '/dashboard/portal',
    '/dashboard/assets':            '/dashboard/pms',
    '/dashboard/equipment':         '/dashboard/pms',
    '/dashboard/biomedical':        '/dashboard/pms',
    '/dashboard/canteen':           '/dashboard/z29-gastronomy',
    '/dashboard/cafeteria':         '/dashboard/z29-gastronomy',
    '/dashboard/media':             '/dashboard/media-lab',
    '/dashboard/marketing':         '/dashboard/guest-marketing',
    '/dashboard/apk':               '/dashboard/guest-marketing',
    '/guest/meals':                 '/guest/order',
    '/guest/diet':                  '/guest/order',
    '/guest/bill':                  '/guest/folio',
  };

  // ── CORE ASK MIRACLE ─────────────────────────────────────────────────────
  const askMiracle = useCallback(async (message: string, silent = false) => {
    if (!silent) addMsg('user', message);
    setIsThinking(true);
    stopAllSpeech();

    // ── LAYER 0: LOCAL BRAIN (zero-latency intercept) ─────────────────────
    const wasIntercepted = await runMiracleBrain(
      message,
      zone,
      (msg: string, r: string) => addMsg(r as BotMessage['role'], msg),
      messages,
      role,
    );

    if (wasIntercepted) {
      setIsThinking(false);
      fetch(`${API}/bot/v2/audit/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_query: message, intent: 'LOCAL_BRAIN_FIX',
          zone: zone.zone, session_id: sessionId,
        }),
      }).catch(() => {});
      return;
    }

    try {
      const finalRole = typeof window !== 'undefined' ? (localStorage.getItem('vigilant_role') || 'VISITOR') : role;
      const finalUser = typeof window !== 'undefined' ? (localStorage.getItem('miracle_user') || 'Guest') : activeUser;
      const finalUserId = typeof window !== 'undefined' ? (localStorage.getItem('miracle_user_id') || '') : userId;

      const res = await fetch(`${API}/bot/v2/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:       message,
          zone:        zone.zone,
          session_id:  sessionId,
          user_id:     finalUserId,
          role:        finalRole,
          active_user: finalUser,
          language,
        }),
      });
      const data = await res.json();
      let reply: string = data.response;

      if (!reply) {
        setSynapseError(true);
        const fallback = 'Sir, I am experiencing a Synapse Error. The LLM is unresponsive, but the Sovereign Kernel remains operational. Please check the Infrastructure Dashboard (Z-23).';
        addMsg('alert', fallback);
        speak(fallback);
        return;
      }
      setSynapseError(false);

      // ── STEP 4: Detect PROPOSAL JSON ──────────────────────────────────
      let proposalObj: ProposalPayload | null = null;
      try {
        if (reply.trim().startsWith('{') && reply.trim().endsWith('}')) {
          const parsed = JSON.parse(reply.trim());
          if (parsed.type === 'PROPOSAL') {
            proposalObj = parsed;
            reply = parsed.explanation || `Action Proposal: ${parsed.action}`;
          }
        }
      } catch { /* Not a proposal JSON */ }

      // ── STEP 5: Extract ALL tags BEFORE stripping ──────────────────────
      const navigateMatch  = reply.match(/\[?\s*NAVIGATE\s*:\s*(\/[\w\-\/]+)\s*\]?/i);
      const focusMatch     = reply.match(/\[?\s*FOCUS\s*:\s*(#?[\w-]+)\s*\]?/i);
      const loginMatch     = reply.match(/\[?\s*LOGIN\s*:\s*(\d+)\s*\]?/i);
      const statusMatch    = reply.match(/\[?\s*STATUS\s*:\s*([^\]]+?)\s*\]?/i);
      const whatsappMatch  = reply.includes('[BTN_WHATSAPP]');

      // ── STEP 6: Strip ALL tags from display text ───────────────────────
      reply = reply
        .replace(/\[?\s*NAVIGATE\s*:\s*\/[\w\-\/]+\s*\]?/gi, '')
        .replace(/\[?\s*FOCUS\s*:\s*#?[\w-]+\s*\]?/gi, '')
        .replace(/\[?\s*LOGIN\s*:\s*\d+\s*\]?/gi, '')
        .replace(/\[?\s*STATUS\s*:\s*[^\]]+?\s*\]?/gi, '')
        .replace(/\[?\s*BTN_WHATSAPP\s*\]?/gi, '')
        .replace(/\[?\s*BTN_EMAIL\s*\]?/gi, '')
        .trim();

      // ── STEP 7: STATUS ─────────────────────────────────────────────────
      if (statusMatch) addMsg('info', `⚙️ ${statusMatch[1]}`);

      // ── STEP 8: LOGIN / PIN AUTH ───────────────────────────────────────
      if (loginMatch) {
        fetch(`${API}/auth/login-with-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: loginMatch[1] }),
        }).then(async r => {
          if (r.ok) {
            const authData = await r.json();
            localStorage.setItem('miracle_token', authData.token);
            localStorage.setItem('miracle_user',  authData.username);
            localStorage.setItem('vigilant_role', authData.role);
            router.push('/dashboard');
          }
        });
        if (!reply) reply = 'Authentication in progress, Sir...';
      }

      // ── STEP 9: NAVIGATE (wins over FOCUS — Iron Law) ─────────────────
      let didNavigate = false;
      if (navigateMatch) {
        let targetPath = PATH_CORRECTIONS[navigateMatch[1]] || navigateMatch[1];
        const validPaths = Object.keys(ZONES);
        const isValid = validPaths.includes(targetPath) ||
          validPaths.filter(k => k !== '/' && k !== '/dashboard')
            .some(k => targetPath.startsWith(k + '/'));

        if (isValid) {
          if (!reply) reply = `Taking you to ${ZONES[targetPath]?.name || targetPath} now, Sir.`;
          didNavigate = true;
          setTimeout(() => router.push(targetPath), 1500);
        } else {
          console.warn(`[SOVEREIGN] Blocked hallucinated route: ${targetPath}`);
          reply = `That path is not in my kernel map. Try: Reservations, POS, HR, Inventory, Accounts, CRM, or Solve.`;
        }
      }

      // ── STEP 10: FOCUS (only if NOT navigating) ────────────────────────
      if (focusMatch) {
        if (didNavigate) {
          setPendingWisp(focusMatch[1]);
        } else {
          setTimeout(() => moveWispTo(focusMatch[1]), 600);
        }
      }

      // ── STEP 11: WhatsApp CTA ──────────────────────────────────────────
      if (whatsappMatch) reply = reply + ' [BTN_WHATSAPP]';

      // ── STEP 12: Empty reply guard ─────────────────────────────────────
      if (!reply.trim()) reply = didNavigate ? 'Navigating now, Sir.' : 'Understood.';

      addMsg('bot', reply, proposalObj || undefined);
      speak(reply);

      // ── STEP 12b: ROI widget auto-trigger ─────────────────────────────
      const roiSignals = /\b(roi|return on investment|cost saving|how much.*(save|worth)|payback|efficiency gain|manual.*hour|automat.*saving)/i;
      if (roiSignals.test(reply)) {
        setTimeout(() => addMsg('info', '💡 ROI_WIDGET: Use the calculator below to estimate your savings.'), 1000);
      }

      // ── STEP 13: Session memory ────────────────────────────────────────
      try {
        const existing = JSON.parse(localStorage.getItem('miracle_os_session') || '{}');
        localStorage.setItem('miracle_os_session', JSON.stringify({
          ...existing,
          zone:         zone.zone,
          zoneName:     zone.name,
          lastActivity: new Date().toISOString(),
          role,
          username:     activeUser,
          lastQuery:    message.slice(0, 80),
        }));
      } catch { /* localStorage blocked in some enterprise configs */ }

    } catch {
      const err = 'I seem to be offline at the moment. Please check the connection.';
      addMsg('alert', err);
      speak(err);
    } finally {
      setIsThinking(false);
    }
  }, [
    zone, sessionId, userId, role, activeUser, language,
    messages, addMsg, speak, stopAllSpeech, moveWispTo, setPendingWisp, router,
  ]);

  return {
    messages, setMessages,
    isThinking,
    synapseError, setSynapseError,
    addMsg,
    askMiracle,
    handleApproveProposal,
    handleDeclineProposal,
  };
}
