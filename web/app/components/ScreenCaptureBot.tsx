'use client';
/**
 * ScreenCaptureBot.tsx
 * Z-CC NATIVE CAPTURE AGENT
 * Records screenshots & video of the Miracle HMS UI using browser MediaDevices API.
 * Auto-uploads to the Asset Vault for content generation.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const ZONE_OPTIONS = [
  'Z-29', 'Z-27', 'Z-11', 'Z-14', 'Z-CC', 'Z-HR', 'Z-FNB',
  'Z-PMS', 'Z-POS', 'Z-CRM', 'Z-INV', 'Z-FLT', 'Z-ACC',
];

const EMOTION_OPTIONS = [
  'power', 'trust', 'elegance', 'speed', 'innovation',
  'hospitality', 'precision', 'luxury', 'growth', 'viral',
];

type CaptureMode = 'idle' | 'screenshot' | 'recording' | 'preview';

export default function ScreenCaptureBot() {
  const [open, setOpen]       = useState(false);
  const [mode, setMode]       = useState<CaptureMode>('idle');
  const [zoneTag, setZoneTag] = useState('Z-CC');
  const [emotionTag, setEmotion] = useState('innovation');
  const [assetName, setAssetName] = useState('');
  const [blob, setBlob]       = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadOk, setUploadOk]     = useState<string | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [minimized, setMinimized]   = useState(false);

  const streamRef    = useRef<MediaStream | null>(null);
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => () => { stopStream(); }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // ── SCREENSHOT ─────────────────────────────────────────────────────────────
  const takeScreenshot = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any,
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      canvas.toBlob(b => {
        if (!b) return;
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setMode('preview');
        setAssetName(`screenshot_${zoneTag}_${Date.now()}`);
      }, 'image/png');
    } catch (e) {
      console.warn('[CaptureBot] Screenshot cancelled or denied:', e);
    }
  }, [zoneTag]);

  // ── START RECORDING ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          displaySurface: 'browser', 
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 }
        } as any,
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { 
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps for high quality text
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const webmBlob = new Blob(chunksRef.current, { type: mimeType });
        setBlob(webmBlob);
        setPreviewUrl(URL.createObjectURL(webmBlob));
        setMode('preview');
        setAssetName(`recording_${zoneTag}_${Date.now()}`);
        stopStream();
      };

      // Auto-stop when user closes share window
      stream.getVideoTracks()[0].addEventListener('ended', () => stopRecording());

      recorder.start(1000);
      setMode('recording');
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e) {
      console.warn('[CaptureBot] Recording cancelled or denied:', e);
    }
  }, [zoneTag]);

  // ── STOP RECORDING ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── SAVE LOCALLY (BYPASS VPS) ─────────────────────────────────────────────
  const saveToLocal = useCallback(() => {
    if (!blob) return;
    const isVideo = blob.type.startsWith('video');
    const ext     = isVideo ? 'webm' : 'png';
    const name    = (assetName || `capture_${zoneTag}_${Date.now()}`).replace(/\s+/g, '_');
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setUploadOk('saved');
    setTimeout(() => {
      setUploadOk(null); setBlob(null); setPreviewUrl(null); setMode('idle');
    }, 2000);
  }, [blob, assetName, zoneTag]);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── KEYBOARD SHORTCUT (Ctrl+S to toggle) ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); // Prevent browser 'Save Page' dialog
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Recording timer badge */}
      {mode === 'recording' && (
        <div style={{
          position: 'fixed', bottom: 158, right: 18, zIndex: 9999,
          background: 'rgba(255,49,49,0.9)', color: '#fff',
          padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800,
          fontFamily: 'monospace', boxShadow: '0 0 12px rgba(255,49,49,0.5)',
        }}>
          ⏺ {fmtTime(recSeconds)}
        </div>
      )}

      {/* Main panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 164, right: 24, zIndex: 9998,
          width: 340, background: '#0a0f1e',
          border: '1px solid rgba(157,0,255,0.35)',
          borderRadius: 20, boxShadow: '0 0 60px rgba(157,0,255,0.25), 0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg, rgba(157,0,255,0.2), rgba(0,242,255,0.1))', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🎥</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', letterSpacing: 1 }}>SCREEN CAPTURE BOT</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Z-CC Asset Vault Agent</div>
            </div>
            <button onClick={() => { setOpen(false); if (mode !== 'recording') { setBlob(null); setPreviewUrl(null); setMode('idle'); } }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
          </div>

          <div style={{ padding: 16 }}>

            {/* Zone + Emotion pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Zone Tag</div>
                <select value={zoneTag} onChange={e => setZoneTag(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#0d1526', color: '#e2e8f0', fontSize: 12, outline: 'none' }}>
                  {ZONE_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Emotion</div>
                <select value={emotionTag} onChange={e => setEmotion(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#0d1526', color: '#e2e8f0', fontSize: 12, outline: 'none' }}>
                  {EMOTION_OPTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>
            </div>

            {/* Preview panel */}
            {mode === 'preview' && previewUrl && (
              <div style={{ marginBottom: 12 }}>
                {blob?.type.startsWith('video') ? (
                  <video src={previewUrl} controls style={{ width: '100%', borderRadius: 10, maxHeight: 160, background: '#000' }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="capture preview" style={{ width: '100%', borderRadius: 10, maxHeight: 160, objectFit: 'cover' }} />
                )}
                <input value={assetName} onChange={e => setAssetName(e.target.value)}
                  placeholder="Asset name..."
                  style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {/* Success */}
            {uploadOk && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)', color: '#39ff14', fontSize: 12, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
                ✅ Downloaded successfully!
              </div>
            )}

            {/* Recording state */}
            {mode === 'recording' && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,49,49,0.1)', border: '1px solid rgba(255,49,49,0.3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff3131', animation: 'blink 1s infinite' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ff3131' }}>RECORDING {fmtTime(recSeconds)}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Capturing your screen...</div>
                </div>
                <button onClick={stopRecording}
                  style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: 'none', background: '#ff3131', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ⏹ Stop
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: mode === 'preview' ? '1fr 1fr' : '1fr 1fr', gap: 8 }}>
              {mode === 'preview' ? (
                <>
                  <button onClick={() => { setBlob(null); setPreviewUrl(null); setMode('idle'); }}
                    style={{ padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                    ↺ Retake
                  </button>
                  <button onClick={saveToLocal}
                    style={{ padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
                      background: 'linear-gradient(135deg, #00f2ff, #00ff88)',
                      color: '#000',
                      boxShadow: '0 0 20px rgba(0,242,255,0.3)',
                    }}>
                    💾 Save to Downloads
                  </button>
                </>
              ) : mode === 'idle' ? (
                <>
                  <button onClick={takeScreenshot}
                    style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,242,255,0.3)', background: 'rgba(0,242,255,0.08)', color: '#00f2ff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    📸 Screenshot
                  </button>
                  <button onClick={startRecording}
                    style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(255,49,49,0.4)', background: 'rgba(255,49,49,0.08)', color: '#ff5050', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    ⏺ Record
                  </button>
                </>
              ) : null}
            </div>

            <div style={{ fontSize: 10, color: '#334155', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Browser will ask you to select a tab/window to capture.<br />
              High-definition recordings save instantly to your <span style={{ color: '#00f2ff' }}>Downloads folder</span>.
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        select option { background: #1e293b; }
      `}</style>
    </>
  );
}
