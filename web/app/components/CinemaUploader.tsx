'use client';
import React, { useState } from 'react';

export default function CinemaUploader() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'ACTION',
    is_paid: false,
    price: 0.0,
    drive_file_id: '',
    poster_url: ''
  });
  const [trailerFile, setTrailerFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setStatusMsg('Syncing to Sovereign Vault...');

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('category', formData.category);
    data.append('is_paid', String(formData.is_paid));
    data.append('price', String(formData.price));
    data.append('drive_file_id', formData.drive_file_id);
    data.append('poster_url', formData.poster_url);
    if (trailerFile) {
      data.append('trailer_file', trailerFile);
    }

    try {
      const res = await fetch('https://api.vigilantitsolution.com/api/cinema/upload', {
        method: 'POST',
        body: data
      });
      const result = await res.json();
      if (res.ok) {
        setStatusMsg('✅ ' + result.message);
        setFormData({ title: '', description: '', category: 'ACTION', is_paid: false, price: 0.0, drive_file_id: '', poster_url: '' });
        setTrailerFile(null);
      } else {
        setStatusMsg('❌ Failed: ' + (result.detail || 'Unknown error'));
      }
    } catch (err) {
      setStatusMsg('❌ Network Error');
    } finally {
      setIsUploading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '15px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '10px', fontSize: '12px' };
  
  return (
    <div style={{ background: 'rgba(15, 15, 15, 0.6)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '30px', backdropFilter: 'blur(10px)' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '2px', color: '#D4AF37', marginBottom: '30px', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '10px' }}>
        MIRACLE CINEMA: SOVEREIGN UPLOADER
      </h2>
      <p style={{ color: '#888', fontSize: '12px', marginBottom: '25px', lineHeight: '1.6' }}>
        Upload HD quality MP4 trailers (up to 500MB) and link full-length features from the Google Drive Vault.
      </p>

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 900, marginBottom: '8px' }}>MOVIE TITLE</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={inputStyle} placeholder="e.g. Sovereign Core" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 900, marginBottom: '8px' }}>CATEGORY</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={inputStyle}>
              <option value="CAROUSEL">CAROUSEL (Top 3D Diamond)</option>
              <option value="ACTION">ACTION VAULT</option>
              <option value="SCIFI">SCI-FI VAULT</option>
              <option value="HORROR">HORROR VAULT</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 900, marginBottom: '8px' }}>SHORT DESCRIPTION</label>
          <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{...inputStyle, resize: 'vertical'}} placeholder="Synopsis..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 900, marginBottom: '8px' }}>GOOGLE DRIVE FILE ID (Full Movie)</label>
            <input type="text" value={formData.drive_file_id} onChange={e => setFormData({...formData, drive_file_id: e.target.value})} style={inputStyle} placeholder="e.g. 1BxiMVs0XRY..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#666', fontWeight: 900, marginBottom: '8px' }}>POSTER IMAGE URL</label>
            <input type="text" value={formData.poster_url} onChange={e => setFormData({...formData, poster_url: e.target.value})} style={inputStyle} placeholder="https://..." />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px' }}>
          <input type="checkbox" checked={formData.is_paid} onChange={e => setFormData({...formData, is_paid: e.target.checked})} style={{ width: '20px', height: '20px' }} />
          <div>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#D4AF37' }}>PREMIUM ASSET (PAID)</span>
            <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>Requires guest folio billing unlock.</p>
          </div>
          {formData.is_paid && (
            <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} style={{...inputStyle, width: '150px', marginLeft: 'auto'}} placeholder="Price" />
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '10px', color: '#00F2FF', fontWeight: 900, marginBottom: '8px', letterSpacing: '1px' }}>UPLOAD HD TRAILER (.MP4, Max 500MB)</label>
          <input 
            type="file" 
            accept="video/mp4" 
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                setTrailerFile(e.target.files[0]);
              }
            }} 
            style={{...inputStyle, padding: '10px', border: '1px dashed #00F2FF', cursor: 'pointer'}} 
          />
        </div>

        <button 
          type="submit" 
          disabled={isUploading}
          style={{ 
            background: isUploading ? '#333' : 'linear-gradient(90deg, rgba(212,175,55,0.2), transparent)', 
            border: isUploading ? '1px solid #555' : '1px solid #D4AF37', 
            color: isUploading ? '#888' : '#D4AF37', 
            padding: '20px', 
            borderRadius: '12px', 
            fontWeight: 900, 
            letterSpacing: '2px',
            cursor: isUploading ? 'not-allowed' : 'pointer'
          }}
        >
          {isUploading ? 'UPLOADING...' : 'SYNC TO VAULT'}
        </button>

        {statusMsg && <div style={{ textAlign: 'center', fontSize: '12px', color: '#FFF', fontWeight: 900 }}>{statusMsg}</div>}
      </form>
    </div>
  );
}
