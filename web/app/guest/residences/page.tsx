"use client";
import React, { useEffect, useState, memo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';

const API_BASE = "/api";

// --- ANIMATIONS ---
const scanline = keyframes`
  0% { transform: translateY(-100%); opacity: 0; }
  50% { opacity: 0.5; }
  100% { transform: translateY(100vh); opacity: 0; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(30px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const glitch = keyframes`
  0% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 2px); }
  20% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
  40% { clip-path: inset(30% 0 50% 0); transform: translate(-2px, -2px); }
  60% { clip-path: inset(60% 0 10% 0); transform: translate(2px, 2px); }
  80% { clip-path: inset(40% 0 30% 0); transform: translate(-2px, 2px); }
  100% { clip-path: inset(0 0 0 0); transform: translate(0); }
`;

const neonPulse = keyframes`
  0% { opacity: 0.2; transform: scale(1); }
  100% { opacity: 0.6; transform: scale(1.05); }
`;

// --- STYLED COMPONENTS ---
const Canvas = styled.div`
  min-height: 100vh;
  background: #020202;
  color: #FFF;
  font-family: 'Inter', sans-serif;
  position: relative;
  overflow-x: hidden;
  max-width: 600px;
  margin: 0 auto;
  box-shadow: 0 0 100px rgba(0,0,0,1);

  &::before {
    content: ''; position: fixed; inset: 0;
    background: 
      linear-gradient(rgba(0,242,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,242,255,0.03) 1px, transparent 1px);
    background-size: 30px 30px;
    z-index: 0;
    pointer-events: none;
  }
  
  &::after {
    content: ''; position: fixed; top: 0; left: 0; right: 0; height: 10px;
    background: #00F2FF; opacity: 0.5; filter: blur(10px);
    animation: ${scanline} 6s linear infinite;
    z-index: 100; pointer-events: none;
  }
`;

const MediaViewerContainer = styled.div`
  width: 100%; height: 250px; position: relative; overflow: hidden;
  background: #050505;
  
  .media-element { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.4s; }
  .video-element { width: 100%; height: 100%; object-fit: cover; }
  
  .controls {
    position: absolute; bottom: 10px; left: 0; right: 0;
    display: flex; justify-content: center; gap: 8px; z-index: 20;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3);
    cursor: pointer; transition: 0.3s;
    &.active { background: #00F2FF; box-shadow: 0 0 10px #00F2FF; transform: scale(1.2); }
  }
  
  .mode-switch {
    position: absolute; top: 15px; left: 15px; z-index: 20;
    display: flex; gap: 5px; background: rgba(0,0,0,0.6); padding: 5px; border-radius: 12px;
    border: 1px solid rgba(0,242,255,0.2); backdrop-filter: blur(5px);
  }
  .mode-btn {
    background: transparent; border: none; color: #FFF; font-size: 10px; cursor: pointer;
    padding: 5px 10px; border-radius: 8px; transition: 0.3s;
    &.active { background: #00F2FF; color: #000; font-weight: 900; }
  }
`;

const Header = styled.div`
  padding: 40px 25px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(2, 2, 2, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 242, 255, 0.15);

  .back-btn {
    background: rgba(0, 242, 255, 0.1); border: 1px solid rgba(0,242,255,0.3);
    color: #00F2FF; padding: 10px 15px; borderRadius: 10px; cursor: pointer;
    font-weight: 900; font-size: 14px;
    transition: 0.3s;
    &:active { transform: scale(0.9); }
  }

  .title-glitch {
    font-family: 'Cinzel', serif; font-size: 20px; font-weight: 900;
    color: #FFF; letter-spacing: 3px; position: relative;
    &:hover { animation: ${glitch} 0.3s infinite; }
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  padding: 30px 25px;
  position: relative;
  z-index: 10;
`;

const Card = styled.div`
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(0, 242, 255, 0.2);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  animation: ${slideUp} 0.6s ease-out forwards;
  opacity: 1;

  &:hover {
    transform: translateY(-10px) scale(1.02);
    /* FIX: use direct CSS properties instead of animation override — animation override
       was resetting the slideUp keyframes causing opacity:0 flash on hover */
    box-shadow: 0 0 30px rgba(0, 242, 255, 0.6), inset 0 0 20px rgba(0, 242, 255, 0.15);
    border-color: rgba(0, 242, 255, 1);
    opacity: 1;
  }

  .media-container {
    height: 250px;
    position: relative;
    overflow: hidden;
  }

  .main-image {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.5s;
  }
  
  &:hover .main-image { transform: scale(1.1); }

  .hologram-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 50%, rgba(0, 15, 20, 0.9) 100%);
  }

  .badge {
    position: absolute; top: 15px; right: 15px;
    background: rgba(0, 242, 255, 0.2); border: 1px solid #00F2FF;
    color: #00F2FF; font-size: 10px; font-weight: 900; letter-spacing: 2px;
    padding: 6px 12px; border-radius: 12px; backdrop-filter: blur(10px);
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.4);
  }

  .content { padding: 25px; }
  .room-name { font-family: 'Cinzel'; font-size: 22px; font-weight: 900; color: #FFF; margin: 0 0 10px 0; }
  .room-desc { font-size: 12px; color: #888; line-height: 1.6; margin-bottom: 20px; }
  
  .footer-row { display: flex; justify-content: space-between; alignItems: center; }
  .price { font-size: 24px; font-weight: 900; color: #00F2FF; fontFamily: monospace; }
  .price-sub { fontSize: 10px; color: #555; }
  
  .ai-btn {
    background: linear-gradient(45deg, #00F2FF, #9D00FF);
    border: none; border-radius: 12px;
    color: #FFF; font-weight: 900; fontSize: 12px; letter-spacing: 1.5px;
    padding: 14px 24px; cursor: pointer;
    box-shadow: 0 0 20px rgba(0, 242, 255, 0.5);
    transition: 0.3s;
    &:active { transform: scale(0.95); box-shadow: 0 0 40px rgba(157, 0, 255, 0.8); }
  }
`;

const AiModalOverlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.9);
  backdrop-filter: blur(25px); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  padding: 20px; animation: ${slideUp} 0.3s ease-out;
`;

const AiModal = styled.div`
  width: 100%; max-width: 500px;
  background: rgba(10, 15, 25, 0.8); border: 1px solid #00F2FF;
  border-radius: 24px; box-shadow: 0 0 60px rgba(0,242,255,0.2);
  padding: 30px; position: relative; overflow: hidden;
  
  &::before {
    content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
    background: radial-gradient(circle at center, rgba(0,242,255,0.1) 0%, transparent 60%);
    animation: ${neonPulse} 4s infinite alternate; pointer-events: none;
  }
  
  .ai-header { text-align: center; margin-bottom: 30px; }
  .ai-icon { font-size: 40px; filter: drop-shadow(0 0 20px #00F2FF); margin-bottom: 15px; }
  .ai-title { color: #00F2FF; font-family: 'Cinzel'; font-size: 18px; font-weight: 900; letter-spacing: 2px; }
  .ai-subtitle { color: #888; font-size: 11px; letter-spacing: 1px; margin-top: 5px; }

  .input-group { margin-bottom: 20px; }
  .ai-label { display: block; color: #00F2FF; font-size: 10px; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; }
  .ai-input {
    width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(0,242,255,0.3);
    color: #FFF; padding: 15px; border-radius: 12px; font-size: 14px;
    outline: none; transition: 0.3s;
    &:focus { border-color: #00F2FF; box-shadow: 0 0 15px rgba(0,242,255,0.3); }
  }
`;


// 7-Star Seeded Images for AssetGrid Categories
const getAssetImage = (category: string) => {
  const cat = category.toUpperCase();
  if (cat.includes('VILLA')) return 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80';
  if (cat.includes('PENTHOUSE')) return 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80';
  if (cat.includes('CRUISE')) return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80';
  if (cat.includes('SUITE')) return 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80';
  if (cat.includes('APARTMENT')) return 'https://images.unsplash.com/photo-1582719478250-c89404bb2a15?auto=format&fit=crop&w=800&q=80';
  return 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'; // STANDARD
};

export default function GuestResidencesGallery() {
  const router = useRouter();
  const [residences, setResidences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingModal, setBookingModal] = useState<any>(null);
  const [dates, setDates] = useState({ checkIn: '', checkOut: '' });
  const [processing, setProcessing] = useState(false);

  // Define Media Viewer Component locally
  const MediaViewer = ({ room }: { room: any }) => {
    const [mode, setMode] = useState<'PHOTO'|'VIDEO'>('PHOTO');
    const [imgIdx, setImgIdx] = useState(0);
    // Dummy images for futuristic luxury effect if DB only has one image
    const images = room.img ? [room.img, 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1582719478250-c89404bb2a15?auto=format&fit=crop&w=800&q=80'] : ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'];
    const videoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4'; // Placeholder for property video

    return (
      <MediaViewerContainer>
        <div className="mode-switch">
          <button className={`mode-btn ${mode === 'PHOTO' ? 'active' : ''}`} onClick={() => setMode('PHOTO')}>PHOTOS</button>
          <button className={`mode-btn ${mode === 'VIDEO' ? 'active' : ''}`} onClick={() => setMode('VIDEO')}>VIDEO</button>
        </div>
        
        {mode === 'PHOTO' ? (
          <>
            <img className="media-element" src={images[imgIdx]} alt="Room View" />
            <div className="controls">
              {images.map((_, i) => (
                <div key={i} className={`dot ${i === imgIdx ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setImgIdx(i); }} />
              ))}
            </div>
          </>
        ) : (
          <video className="video-element" autoPlay loop muted playsInline>
            <source src={videoUrl} type="video/mp4" />
          </video>
        )}
        <div className="hologram-overlay" />
        <div className="badge">{room.dept.replace('Z-19-', '')}</div>
      </MediaViewerContainer>
    );
  };

  useEffect(() => {
    fetch(`${API_BASE}/policy/current-lock`)
      .then(r => r.json())
      .then(data => {
        if (data.inventory && Array.isArray(data.inventory)) {
          // Map AssetGrid items to Residence format
          const assets = data.inventory.map((asset: any) => ({
            id: asset.room_id,
            name: `Residence ${asset.room_id}`,
            dept: `Z-19-${asset.category || 'STANDARD'}`,
            rp: asset.base_rate,
            img: getAssetImage(asset.category || ''),
            desc: `A 7-star luxury sovereign ${asset.category?.toLowerCase() || 'residence'} experience with full access to Miracle ECO amenities.`,
            status: asset.current_status
          }));
          setResidences(assets);
        }
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleAiBooking = () => {
    if (!dates.checkIn || !dates.checkOut) return alert("AI requires Check-In and Check-Out dates.");
    setProcessing(true);
    
    // Spawn a ticket in Z-16 for the Concierge/Reservations team
    fetch(`${API_BASE}/policy/spawn-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dept: 'FD',
        room_id: 'GENERAL',
        task: `[AI BOOKING REQUEST] Guest wants to reserve ${bookingModal.name} (${bookingModal.dept}) from ${dates.checkIn} to ${dates.checkOut}. Base RP: ${bookingModal.rp}`,
        priority: 'CRITICAL'
      })
    }).then(res => {
      setTimeout(() => {
        setProcessing(false);
        setBookingModal(null);
        alert("🔱 AI HAS SECURED YOUR REQUEST. Our Royal Concierge will confirm shortly.");
      }, 1500);
    });
  };

  return (
    <Canvas>
      <Header>
        <button className="back-btn" onClick={() => router.push('/guest/hub')}>← HUB</button>
        <div className="title-glitch">RESIDENCES</div>
      </Header>

      <Grid>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#00F2FF', padding: '50px', fontSize: '12px', letterSpacing: '3px', animation: 'pulse 1.5s infinite' }}>
            SCANNING KERNEL FOR ASSETS...
          </div>
        ) : residences.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: '50px', fontSize: '12px' }}>
            NO RESIDENCE ASSETS FOUND IN Z-19 CORE PMS.
          </div>
        ) : (
          residences.map((room, i) => (
            <Card key={room.id} style={{ animationDelay: `${i * 0.15}s` }}>
              <MediaViewer room={room} />
              <div className="content">
                <h2 className="room-name">{room.name}</h2>
                <div className="room-desc">{room.desc || 'Experience ultimate luxury in our meticulously designed sovereign asset. Perfect for extended stays or brief escapes.'}</div>
                <div className="footer-row">
                  <div>
                    <div className="price">${parseFloat(room.rp).toLocaleString()}</div>
                    <div className="price-sub">PER NIGHT / EXCL. TAX</div>
                  </div>
                  <button className="ai-btn" onClick={() => setBookingModal(room)}>
                    RESERVE VIA AI
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </Grid>

      {/* --- AGENTIC AI BOOKING MODAL --- */}
      {bookingModal && (
        <AiModalOverlay>
          <AiModal>
            <div className="ai-header">
              <div className="ai-icon">🧠</div>
              <div className="ai-title">MIRACLE AI AGENT</div>
              <div className="ai-subtitle">SECURING: {bookingModal.name}</div>
            </div>
            
            <div className="input-group">
              <label className="ai-label">CHECK-IN HORIZON</label>
              <input type="date" className="ai-input" value={dates.checkIn} onChange={e => setDates({...dates, checkIn: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="ai-label">CHECK-OUT HORIZON</label>
              <input type="date" className="ai-input" value={dates.checkOut} onChange={e => setDates({...dates, checkOut: e.target.value})} />
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button 
                onClick={() => setBookingModal(null)}
                style={{ flex: 1, padding: '15px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
              >ABORT</button>
              
              <button 
                onClick={handleAiBooking} disabled={processing}
                style={{ flex: 2, padding: '15px', background: processing ? '#333' : '#00F2FF', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, letterSpacing: '1px', cursor: processing ? 'not-allowed' : 'pointer', boxShadow: processing ? 'none' : '0 0 20px #00F2FF' }}
              >
                {processing ? 'INITIALIZING NEURAL NET...' : 'ENGAGE AI BOOKING'}
              </button>
            </div>
          </AiModal>
        </AiModalOverlay>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;700;900&display=swap');
        ::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
      `}} />
    </Canvas>
  );
}
