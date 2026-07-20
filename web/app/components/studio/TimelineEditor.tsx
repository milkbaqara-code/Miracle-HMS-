'use client';
import React, { useState, useEffect, useRef } from 'react';

type TrackType = 'VIDEO' | 'AUDIO' | 'TEXT';

export interface TimelineClip {
  id: string;
  asset_id: string;
  type: TrackType;
  name: string;
  start_time: number;  // Position on timeline
  duration: number;    // Duration in seconds
  url?: string;
}

export interface TimelineEditorProps {
  clips: TimelineClip[];
  onClipsChange: (clips: TimelineClip[]) => void;
  onPlayheadMove: (time: number) => void;
}

export default function TimelineEditor({ clips, onClipsChange, onPlayheadMove }: TimelineEditorProps) {
  const [playhead, setPlayhead] = useState(0);
  const [scale, setScale] = useState(20); // pixels per second
  const containerRef = useRef<HTMLDivElement>(null);


  // Groups clips by track type
  const tracks: { type: TrackType, label: string, color: string }[] = [
    { type: 'VIDEO', label: 'Video Track', color: 'rgba(0,242,255,0.2)' },
    { type: 'AUDIO', label: 'Audio Track', color: 'rgba(57,255,20,0.2)' },
    { type: 'TEXT',  label: 'Text Overlay', color: 'rgba(157,0,255,0.2)' },
  ];

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 150; // offset for track headers
    if (x < 0) return;
    const newTime = x / scale;
    setPlayhead(newTime);
    onPlayheadMove(newTime);
  };

  return (
    <div style={{ background: '#0a0f1e', borderTop: '1px solid #1e293b', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Toolbar */}
      <div style={{ padding: '8px 16px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>✂️ Split</button>
        <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️ Delete</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Zoom:</span>
          <input type="range" min="5" max="100" value={scale} onChange={e => setScale(Number(e.target.value))} />
        </div>
      </div>

      {/* Timeline Grid */}
      <div ref={containerRef} style={{ position: 'relative', flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingLeft: 150 }} onClick={handleTimelineClick}>
        
        {/* Playhead */}
        <div style={{
          position: 'absolute', left: 150 + playhead * scale, top: 0, bottom: 0, width: 2, background: '#ff3131', zIndex: 50, pointerEvents: 'none'
        }}>
          <div style={{ position: 'absolute', top: 0, left: -4, width: 10, height: 10, background: '#ff3131', borderRadius: '50%' }} />
        </div>

        {/* Tracks */}
        {tracks.map(track => (
          <div key={track.type} style={{ height: 60, borderBottom: '1px solid #1e293b', position: 'relative', display: 'flex', alignItems: 'center' }}>
            {/* Header */}
            <div style={{ position: 'absolute', left: -150, width: 150, height: '100%', background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 12, fontWeight: 700, color: '#94a3b8', zIndex: 10 }}>
              {track.label}
            </div>

            {/* Clips */}
            {clips.filter(c => c.type === track.type).map(clip => (
              <div key={clip.id} style={{
                position: 'absolute',
                left: clip.start_time * scale,
                width: clip.duration * scale,
                height: 40,
                background: track.color,
                border: `1px solid ${track.color.replace('0.2', '0.8')}`,
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 10,
                color: '#fff',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                cursor: 'grab'
              }}>
                {clip.name}
              </div>
            ))}
          </div>
        ))}
        
        {/* Time Ruler (Empty block just for spacing) */}
        <div style={{ height: 24, borderBottom: '1px solid #1e293b' }} />
      </div>
    </div>
  );
}
