'use client';
// ============================================================
// MiracleBot / hooks / useFeatureRequest.ts
// Sovereign Feature Request submit hook.
// Manages form text, status, and POST to /bot/v2/feature-request.
// V4.0 — Enterprise Refactor
// ============================================================
import { useState, useCallback } from 'react';
import { API } from '../lib/constants';

interface FeatureRequestOptions {
  zone: string;
  sessionId: string;
  activeUser: string;
  addMsg: (role: 'info' | 'alert', text: string) => void;
  speak: (text: string) => void;
  setShowFeatureForm: (v: boolean) => void;
}

export function useFeatureRequest({
  zone, sessionId, activeUser, addMsg, speak, setShowFeatureForm,
}: FeatureRequestOptions) {
  const [featureText,   setFeatureText]   = useState('');
  const [featureStatus, setFeatureStatus] = useState('');

  const submitFeatureRequest = useCallback(async () => {
    if (!featureText.trim()) return;
    setFeatureStatus('Submitting...');
    try {
      const res = await fetch(`${API}/bot/v2/feature-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: featureText,
          zone,
          session_id: sessionId,
          submitted_by: activeUser,
        }),
      });
      const data = await res.json();
      setFeatureStatus(data.message || 'Submitted!');
      addMsg('info', data.message || 'Feature request submitted.');
      speak(data.message || 'Your request has been sent to the development team.');
      setFeatureText('');
      setTimeout(() => { setShowFeatureForm(false); setFeatureStatus(''); }, 3000);
    } catch {
      setFeatureStatus('Failed — please try again.');
    }
  }, [featureText, zone, sessionId, activeUser, addMsg, speak, setShowFeatureForm]);

  return { featureText, setFeatureText, featureStatus, submitFeatureRequest };
}
