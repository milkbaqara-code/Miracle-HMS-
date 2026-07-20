'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/SovereignToast';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// ── TYPES ────────────────────────────────────────────────────────────────────
interface ZoneKnowledge { zone_id: string; zone_name: string; hook: string; seo_focus: string; }
interface Sequence { id: string; zone_id: string; zone_name: string; topic_theme: string; custom_brief: string; sequence_day: number; is_active: boolean; }
interface Asset { id: string; asset_name: string; asset_type: string; zone_tag: string; emotion_tag: string; file_path: string; description: string; }
interface SocialConfig { id: string; platform: string; page_id: string; auto_publish: boolean; publish_schedule: string; is_connected: boolean; api_key_masked: string; access_token_set: boolean; }
interface LedgerEntry { id: string; zone_id: string; topic_theme: string; publish_status: string; created_at: string; platforms_posted?: string; }

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  youtube:   { icon: '📱', color: '#00f2ff', label: 'Patient Portal Feed' },
  linkedin:  { icon: '💬', color: '#39ff14', label: 'Patient SMS Alerts' },
  facebook:  { icon: '📺', color: '#ff0055', label: 'In-Hospital TV Display' },
  instagram: { icon: '💬', color: '#25D366', label: 'WhatsApp Broadcast' },
  twitter:   { icon: '✉️', color: '#ffb703', label: 'Medical Newsletter' },
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  CLINICAL_INFOGRAPHIC: '#00f2ff',
  DOCTOR_PROFILE:       '#39ff14',
  AWARENESS_FLYER:      '#d4af37',
  MEDICAL_TUTORIAL:     '#ff6b35',
  WARD_LAYOUT:          '#9d00ff',
  EQUIPMENT_SPOTLIGHT:  '#ff3131',
};

export default function MiracleContentCreator() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'generate' | 'sequences' | 'vault' | 'social' | 'ledger'>('generate');

  // Generate tab state
  const [zones, setZones] = useState<ZoneKnowledge[]>([]);
  const [selectedZone, setSelectedZone] = useState('Z-07');
  const [platforms, setPlatforms] = useState<string[]>(['youtube', 'linkedin', 'facebook']);
  const [tone, setTone] = useState('elite');
  const [brief, setBrief] = useState('');
  
  // Migrated from Z-14 AGI Campaign Sandbox
  const [campaignTopicTheme, setCampaignTopicTheme] = useState('wellness_camp');
  const [campaignAudience, setCampaignAudience] = useState('patients');
  const [linkedinMode, setLinkedinMode] = useState('sms_invite');
  const [twitterMode, setTwitterMode] = useState('newsletter_roster');
  const [facebookMode, setFacebookMode] = useState('tv_announcement');
  const [youtubeMode, setYoutubeMode] = useState('portal_banner');

  const TOPIC_PLATFORM_MODES: Record<string, Record<string, { id: string; label: string }[]>> = {
    wellness_camp: {
      linkedin: [{ id: 'sms_invite', label: '💬 SMS Camp Invitation' }, { id: 'sms_reminder', label: '💬 SMS Camp Reminder' }],
      twitter: [{ id: 'newsletter_roster', label: '✉️ Newsletter Camp Schedule' }, { id: 'newsletter_highlights', label: '✉️ Newsletter Camp Highlights' }],
      facebook: [{ id: 'tv_announcement', label: '📺 TV Camp Announcement' }, { id: 'tv_guide', label: '📺 TV Camp Guidelines' }],
      youtube: [{ id: 'portal_banner', label: '📱 Portal Camp Banner' }, { id: 'portal_qna', label: '📱 Portal Camp Q&A' }]
    },
    doctor_roster: {
      linkedin: [{ id: 'sms_roster', label: '💬 SMS Specialist roster' }],
      twitter: [{ id: 'newsletter_profile', label: '✉️ Newsletter Doctor Profile' }],
      facebook: [{ id: 'tv_welcome', label: '📺 TV Welcome Banner' }],
      youtube: [{ id: 'portal_introduction', label: '📱 Portal Intro Article' }]
    },
    clinical_tech: {
      linkedin: [{ id: 'sms_tech', label: '💬 SMS Tech Announcement' }],
      twitter: [{ id: 'newsletter_tech_explain', label: '✉️ Newsletter Tech Deep-dive' }],
      facebook: [{ id: 'tv_tech_showcase', label: '📺 TV Tech Showcase' }],
      youtube: [{ id: 'portal_tech_walkthrough', label: '📱 Portal Tech Feature' }]
    },
    health_bulletin: {
      linkedin: [{ id: 'sms_bulletin', label: '💬 SMS Health Advisory' }],
      twitter: [{ id: 'newsletter_tip', label: '✉️ Newsletter Health Tips' }],
      facebook: [{ id: 'tv_alert', label: '📺 TV Alert Display' }],
      youtube: [{ id: 'portal_bulletin', label: '📱 Portal Medical Bulletin' }]
    },
    medical_alerts: {
      linkedin: [{ id: 'sms_urgent', label: '💬 SMS Urgent Alert' }],
      twitter: [{ id: 'newsletter_urgent', label: '✉️ Newsletter Urgent Update' }],
      facebook: [{ id: 'tv_urgent_screen', label: '📺 TV Urgent Message' }],
      youtube: [{ id: 'portal_urgent_post', label: '📱 Portal Critical Announcement' }]
    }
  };

  const handleTopicThemeChange = (theme: string) => {
    setCampaignTopicTheme(theme);
    const modes = TOPIC_PLATFORM_MODES[theme];
    if (modes) {
      if (modes.linkedin?.[0]) setLinkedinMode(modes.linkedin[0].id);
      if (modes.twitter?.[0]) setTwitterMode(modes.twitter[0].id);
      if (modes.facebook?.[0]) setFacebookMode(modes.facebook[0].id);
      if (modes.youtube?.[0]) setYoutubeMode(modes.youtube[0].id);
    }
  };

  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string> | null>(null);
  const [ledgerId, setLedgerId] = useState('');

  // Sequences
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [newSeqZone, setNewSeqZone] = useState('Z-29');
  const [newSeqTheme, setNewSeqTheme] = useState('');
  const [newSeqBrief, setNewSeqBrief] = useState('');

  // Asset vault
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetFilter, setAssetFilter] = useState('');
  const [showRegisterAsset, setShowRegisterAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({ asset_name: '', asset_type: 'CLINICAL_INFOGRAPHIC', zone_tag: '', emotion_tag: '', file_path: '', description: '' });

  // Social configs
  const [socialConfigs, setSocialConfigs] = useState<SocialConfig[]>([]);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [socialForm, setSocialForm] = useState({ api_key: '', api_secret: '', access_token: '', page_id: '', auto_publish: false, publish_schedule: '' });

  // Ledger
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  // Phase 2: Compose + Publish
  const [pulsingTrigger, setPulsingTrigger] = useState(false);
  const [composingId, setComposingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [elevenKey, setElevenKey] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [showComposeModal, setShowComposeModal] = useState<string | null>(null); // ledger_id
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);
  const [publishPlatforms, setPublishPlatforms] = useState<string[]>(['linkedin', 'facebook']);

  useEffect(() => {
    fetchZones();
    fetchSequences();
    fetchAssets();
    fetchSocialConfigs();
    fetchLedger();
  }, []);

  const fetchZones    = async () => { try { const r = await fetch(`${API}/content-creator/zone-knowledge`); if(r.ok) setZones(await r.json()); } catch {} };
  const fetchSequences= async () => { try { const r = await fetch(`${API}/content-creator/sequences`); if(r.ok) setSequences(await r.json()); } catch {} };
  const fetchAssets   = async () => { try { const r = await fetch(`${API}/content-creator/assets`); if(r.ok) setAssets(await r.json()); } catch {} };
  const fetchSocialConfigs = async () => { try { const r = await fetch(`${API}/content-creator/social-configs`); if(r.ok) setSocialConfigs(await r.json()); } catch {} };
  const fetchLedger   = async () => { try { const r = await fetch(`${API}/content-creator/ledger`); if(r.ok) setLedger(await r.json()); } catch {} };

  const handleTriggerPulse = async () => {
    setPulsingTrigger(true);
    try {
      const r = await fetch(`${API}/content-creator/trigger-pulse`, { method: 'POST' });
      const data = await r.json();
      if (data.status === 'PULSE_FIRED') {
        showToast(`✅ Pulse fired: ${data.sequence} â€” ${data.topic}`, 'success');
        fetchLedger();
      } else { showToast(data.detail || 'Pulse failed', 'error'); }
    } catch { showToast('Network error', 'error'); }
    setPulsingTrigger(false);
  };

  const handleComposeVideo = async (ledger_id: string) => {
    if (!selectedAssetIds.length) { showToast('Select at least one asset from the vault', 'error'); return; }
    setComposingId(ledger_id);
    try {
      const r = await fetch(`${API}/content-creator/compose-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledger_id, asset_ids: selectedAssetIds, elevenlabs_api_key: elevenKey || undefined })
      });
      const data = await r.json();
      if (data.status === 'RENDERED') {
        showToast(`ðŸŽ¬ Video rendered! Job: ${data.job_id} | Assets: ${data.asset_count}`, 'success');
        setShowComposeModal(null); setSelectedAssetIds([]);
        fetchLedger();
      } else { showToast(data.detail || 'Render failed', 'error'); }
    } catch { showToast('Render error', 'error'); }
    setComposingId(null);
  };

  const handlePublish = async (ledger_id: string) => {
    if (!publishPlatforms.length) { showToast('Select at least one platform', 'error'); return; }
    setPublishingId(ledger_id);
    try {
      const r = await fetch(`${API}/content-creator/publish/${ledger_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledger_id, platforms: publishPlatforms })
      });
      const data = await r.json();
      const allOk = data.status === 'PUBLISHED';
      showToast(allOk ? `✅ Published to ${publishPlatforms.join(', ')}!` : `âš ï¸ Partial publish â€” check logs`, allOk ? 'success' : 'warning');
      setShowPublishModal(null);
      fetchLedger();
    } catch { showToast('Publish error', 'error'); }
    setPublishingId(null);
  };

  const toggleAssetForCompose = (id: string) =>
    setSelectedAssetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleGenerate = async () => {
    if (!platforms.length) { showToast('Select at least one platform', 'error'); return; }
    setGenerating(true);
    setGeneratedContent(null);
    try {
      const r = await fetch(`${API}/content-creator/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zone_id: selectedZone, 
          platforms, 
          tone, 
          custom_brief: brief,
          topic_theme: campaignTopicTheme,
          target_audience: campaignAudience,
          platform_modes: {
            linkedin: linkedinMode,
            twitter: twitterMode,
            facebook: facebookMode,
            youtube: youtubeMode
          }
        })
      });
      const data = await r.json();
      if (data.status === 'SUCCESS') {
        setGeneratedContent(data.content);
        setLedgerId(data.ledger_id);
        showToast('Content generated! Review below.', 'success');
        fetchLedger();
      } else { showToast(data.message || 'Generation failed', 'error'); }
    } catch (e) { showToast('Network error', 'error'); }
    setGenerating(false);
  };

  const handleAddSequence = async () => {
    if (!newSeqTheme) return;
    const zone = zones.find(z => z.zone_id === newSeqZone);
    await fetch(`${API}/content-creator/sequences?zone_id=${newSeqZone}&zone_name=${encodeURIComponent(zone?.zone_name || newSeqZone)}&topic_theme=${encodeURIComponent(newSeqTheme)}&custom_brief=${encodeURIComponent(newSeqBrief)}`, { method: 'POST' });
    showToast('Sequence added!', 'success');
    setNewSeqTheme(''); setNewSeqBrief('');
    fetchSequences();
  };

  const handleDeleteSequence = async (id: string) => {
    await fetch(`${API}/content-creator/sequences/${id}`, { method: 'DELETE' });
    fetchSequences();
  };

  const handleRegisterAsset = async () => {
    const p = new URLSearchParams({ ...newAsset });
    await fetch(`${API}/content-creator/assets/register?${p.toString()}`, { method: 'POST' });
    showToast('Asset registered in vault!', 'success');
    setShowRegisterAsset(false);
    setNewAsset({ asset_name: '', asset_type: 'CLINICAL_INFOGRAPHIC', zone_tag: '', emotion_tag: '', file_path: '', description: '' });
    fetchAssets();
  };

  const handleSaveSocialConfig = async (platform: string) => {
    await fetch(`${API}/content-creator/social-configs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, ...socialForm })
    });
    showToast(`${platform} config saved!`, 'success');
    setEditingPlatform(null);
    fetchSocialConfigs();
  };

  const togglePlatform = (p: string) => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const tabs = [
    { id: 'generate',  label: '⚡ Generate', icon: '⚡' },
    { id: 'sequences', label: '🎛️ Sequence Matrix', icon: '🎛️' },
    { id: 'vault',     label: '📁 Asset Vault', icon: '📁' },
    { id: 'social',    label: '🔑 Social APIs', icon: '🔑' },
    { id: 'ledger',    label: '📋 Campaign Log', icon: '📋' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#060a14', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Animated grid background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(0,242,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,242,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(0,242,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(157,0,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>

        {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #00f2ff22, #9d00ff22)', border: '1px solid rgba(0,242,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🤖</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#00f2ff', textTransform: 'uppercase' }}>Z-CC</span>
                <span style={{ width: 1, height: 14, background: 'rgba(0,242,255,0.3)' }} />
                <span style={{ fontSize: 11, color: '#64748b', letterSpacing: 1 }}>SOVEREIGN HEALTHCARE CAMPAIGN ENGINE</span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #ffffff 0%, #00f2ff 50%, #9d00ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Miracle HMS Campaign Sandbox
              </h1>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.2)', fontSize: 12, color: '#00f2ff' }}>
                {sequences.length} Sequences Active
              </div>
              <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', fontSize: 12, color: '#39ff14' }}>
                {assets.length} Assets in Vault
              </div>
              <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(157,0,255,0.08)', border: '1px solid rgba(157,0,255,0.2)', fontSize: 12, color: '#c084fc' }}>
                {socialConfigs.filter(c => c.is_connected).length}/{Object.keys(PLATFORM_META).length} Platforms Connected
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            World's First AI/AGI-Native Healthcare Campaign & Advisory Engine â€” auto-sequences, generates, and publishes branded video & image content across all patient outreach channels.
          </p>
        </div>

        {/* â”€â”€ TAB BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(157,0,255,0.15))' : 'transparent',
                color: activeTab === tab.id ? '#00f2ff' : '#64748b',
                boxShadow: activeTab === tab.id ? '0 0 20px rgba(0,242,255,0.1), inset 0 0 20px rgba(0,242,255,0.05)' : 'none',
                borderBottom: activeTab === tab.id ? '1px solid rgba(0,242,255,0.4)' : '1px solid transparent',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* TAB 1: GENERATE                                                */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'generate' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 320px 1fr', gap: 20 }}>

            {/* LEFT: Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Zone Selector */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 14, textTransform: 'uppercase' }}>â‘  Select Enterprise Zone</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {zones.map(z => (
                    <button key={z.zone_id} onClick={() => setSelectedZone(z.zone_id)}
                      style={{ padding: '12px 14px', borderRadius: 10, border: selectedZone === z.zone_id ? '1px solid rgba(0,242,255,0.5)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        background: selectedZone === z.zone_id ? 'linear-gradient(135deg, rgba(0,242,255,0.12), rgba(157,0,255,0.08))' : 'rgba(255,255,255,0.02)',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: selectedZone === z.zone_id ? '#00f2ff' : '#e2e8f0' }}>{z.zone_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{z.hook.substring(0, 60)}...</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Targets */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 14, textTransform: 'uppercase' }}>â‘¡ Target Platforms</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(PLATFORM_META).map(([key, meta]) => (
                    <button key={key} onClick={() => togglePlatform(key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: platforms.includes(key) ? `1px solid ${meta.color}55` : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s',
                        background: platforms.includes(key) ? `${meta.color}18` : 'rgba(255,255,255,0.02)',
                      }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>{meta.icon}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: platforms.includes(key) ? '#e2e8f0' : '#64748b' }}>{meta.label}</span>
                      {platforms.includes(key) && <span style={{ marginLeft: 'auto', color: '#39ff14', fontSize: 16 }}>âœ“</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone & Brief */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 14, textTransform: 'uppercase' }}>â‘¢ Tone & Director's Brief</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {['elite', 'technical', 'emotional'].map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: tone === t ? '1px solid rgba(0,242,255,0.4)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'capitalize', transition: 'all 0.2s',
                        background: tone === t ? 'rgba(0,242,255,0.12)' : 'rgba(255,255,255,0.02)',
                        color: tone === t ? '#00f2ff' : '#64748b',
                      }}>{t}</button>
                  ))}
                </div>
                <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="Optional: Give the AGI a specific brief... e.g. 'Focus on how our system prevents financial fraud in hotels'"
                  style={{ width: '100%', height: 90, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Generate Button */}
              <button onClick={handleGenerate} disabled={generating}
                style={{ padding: '16px', borderRadius: 14, border: 'none', cursor: generating ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 800, letterSpacing: 1, transition: 'all 0.3s',
                  background: generating ? 'rgba(0,242,255,0.1)' : 'linear-gradient(135deg, #00f2ff, #9d00ff)',
                  color: generating ? '#00f2ff' : '#000',
                  boxShadow: generating ? 'none' : '0 0 40px rgba(0,242,255,0.4), 0 0 80px rgba(157,0,255,0.2)',
                }}>
                {generating ? '⚡ GENERATING...' : '🚀 GENERATE CAMPAIGN'}
              </button>
            </div>

            {/* MIDDLE: Z-14 Migrated Sandbox Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Campaign Topic Theme */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 14, textTransform: 'uppercase' }}>② Core Topic Theme</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'wellness_camp', label: '🏥 Wellness Camps' },
                    { id: 'doctor_roster', label: '🩺 Doctor Rosters' },
                    { id: 'clinical_tech', label: '🔬 Clinical Tech' },
                    { id: 'health_bulletin', label: '📢 Health Bulletins' },
                    { id: 'medical_alerts', label: '🚨 Medical Alerts' }
                  ].map(t => (
                    <button key={t.id} onClick={() => handleTopicThemeChange(t.id)}
                      style={{
                        background: campaignTopicTheme === t.id ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.02)',
                        color: campaignTopicTheme === t.id ? '#00f2ff' : '#64748b',
                        border: campaignTopicTheme === t.id ? '1px solid rgba(0,242,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                        padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: '0.2s'
                      }}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 14, textTransform: 'uppercase' }}>③ Target Audience</div>
                <select value={campaignAudience} onChange={e => setCampaignAudience(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', padding: '12px 14px', borderRadius: '10px', fontSize: '12px', outline: 'none' }}>
                  <option value="patients">🏥 Patients & Care Seekers</option>
                  <option value="doctors_medical_staff">🩺 Clinicians & Medical Staff</option>
                  <option value="hospital_administrators">👔 Hospital Administrators</option>
                  
                </select>
              </div>

              {/* Platform Modes */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 14, textTransform: 'uppercase' }}>④ Content Format Modes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {platforms.includes('linkedin') && (
                    <select value={linkedinMode} onChange={e => setLinkedinMode(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#0A66C2', padding: '10px', borderRadius: '8px', fontSize: '11px', outline: 'none' }}>
                      {(TOPIC_PLATFORM_MODES[campaignTopicTheme]?.linkedin || []).map(o => <option key={o.id} value={o.id}>IN: {o.label}</option>)}
                    </select>
                  )}
                  {platforms.includes('twitter') && (
                    <select value={twitterMode} onChange={e => setTwitterMode(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '11px', outline: 'none' }}>
                      {(TOPIC_PLATFORM_MODES[campaignTopicTheme]?.twitter || []).map(o => <option key={o.id} value={o.id}>X: {o.label}</option>)}
                    </select>
                  )}
                  {platforms.includes('facebook') && (
                    <select value={facebookMode} onChange={e => setFacebookMode(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#1877F2', padding: '10px', borderRadius: '8px', fontSize: '11px', outline: 'none' }}>
                      {(TOPIC_PLATFORM_MODES[campaignTopicTheme]?.facebook || []).map(o => <option key={o.id} value={o.id}>FB: {o.label}</option>)}
                    </select>
                  )}
                  {platforms.includes('youtube') && (
                    <select value={youtubeMode} onChange={e => setYoutubeMode(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#FF0000', padding: '10px', borderRadius: '8px', fontSize: '11px', outline: 'none' }}>
                      {(TOPIC_PLATFORM_MODES[campaignTopicTheme]?.youtube || []).map(o => <option key={o.id} value={o.id}>YT: {o.label}</option>)}
                    </select>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT: Output */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!generatedContent && !generating && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(0,242,255,0.15)' }}>
                  <div style={{ textAlign: 'center', color: '#475569' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Select Clinical Zone & Channels</div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>The AGI will generate clinical campaigns for each selected channel</div>
                  </div>
                </div>
              )}
              {generating && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, background: 'rgba(0,242,255,0.03)', borderRadius: 16, border: '1px solid rgba(0,242,255,0.15)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1s linear infinite' }}>âš¡</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#00f2ff' }}>AGI DIRECTOR IS WRITING...</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Generating SEO-optimized content for {platforms.length} platforms</div>
                  </div>
                </div>
              )}
              {generatedContent && !generating && (
                <>
                  {/* Ledger ID */}
                  <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', fontSize: 12, color: '#39ff14', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✅ Saved to Campaign Ledger</span>
                    <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{ledgerId}</span>
                  </div>

                  {/* SEO Block */}
                  {(generatedContent.seo_title || generatedContent.seo_description) && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#d4af37', marginBottom: 12, textTransform: 'uppercase' }}>ðŸ† SEO Optimization</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{generatedContent.seo_title}</div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>{generatedContent.seo_description}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(generatedContent.seo_keywords || '').split(',').map((kw, i) => (
                          <span key={i} style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', fontSize: 11, color: '#d4af37' }}>{kw.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platform outputs */}
                  {[
                    { key: 'youtube_script', label: 'YouTube Shorts Script', platform: 'youtube' },
                    { key: 'linkedin', label: 'LinkedIn Post', platform: 'linkedin' },
                    { key: 'facebook', label: 'Facebook Post', platform: 'facebook' },
                  ].map(({ key, label, platform }) => generatedContent[key] ? (
                    <div key={key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: `1px solid ${PLATFORM_META[platform]?.color}33`, padding: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: PLATFORM_META[platform]?.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{PLATFORM_META[platform]?.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: PLATFORM_META[platform]?.color, textTransform: 'uppercase' }}>{label}</div>
                        <button onClick={() => { navigator.clipboard.writeText(generatedContent[key]); showToast('Copied!', 'success'); }}
                          style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, border: `1px solid ${PLATFORM_META[platform]?.color}44`, background: 'transparent', color: PLATFORM_META[platform]?.color, fontSize: 11, cursor: 'pointer' }}>
                          ðŸ“‹ Copy
                        </button>
                      </div>
                      <pre style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{generatedContent[key]}</pre>
                    </div>
                  ) : null)}

                  {/* Media Prompt */}
                  {generatedContent.media_prompt && (
                    <div style={{ background: 'rgba(157,0,255,0.05)', borderRadius: 16, border: '1px solid rgba(157,0,255,0.2)', padding: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#c084fc', marginBottom: 12, textTransform: 'uppercase' }}>ðŸŽ¬ Asset Vault Director's Note</div>
                      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.8, margin: 0 }}>{generatedContent.media_prompt}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* TAB 2: SEQUENCE MATRIX                                         */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'sequences' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 16, textTransform: 'uppercase' }}>ðŸ”„ Campaign Rotation Matrix</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sequences.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', color: '#475569', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.08)' }}>
                    No sequences defined yet. Add your first rotation entry â†’
                  </div>
                )}
                {sequences.map((seq, idx) => (
                  <div key={seq.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(157,0,255,0.15))', border: '1px solid rgba(0,242,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#00f2ff' }}>
                      {seq.sequence_day}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{seq.zone_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{seq.topic_theme}</div>
                      {seq.custom_brief && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{seq.custom_brief}</div>}
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 6, background: seq.is_active ? 'rgba(57,255,20,0.1)' : 'rgba(255,49,49,0.1)', border: `1px solid ${seq.is_active ? 'rgba(57,255,20,0.3)' : 'rgba(255,49,49,0.3)'}`, fontSize: 11, color: seq.is_active ? '#39ff14' : '#ff3131' }}>
                      {seq.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                    <button onClick={() => handleDeleteSequence(seq.id)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,49,49,0.3)', background: 'transparent', color: '#ff3131', fontSize: 12, cursor: 'pointer' }}>
                      âœ• Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Sequence Panel */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(0,242,255,0.1)', padding: 24, height: 'fit-content' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 20, textTransform: 'uppercase' }}>+ Add Sequence</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Enterprise Zone</div>
                  <select value={newSeqZone} onChange={e => setNewSeqZone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                    {zones.map(z => <option key={z.zone_id} value={z.zone_id} style={{ background: '#1e293b' }}>{z.zone_name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Topic Theme</div>
                  <input value={newSeqTheme} onChange={e => setNewSeqTheme(e.target.value)} placeholder="e.g. WHT Optimization, Real-time KDS"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Custom Brief (optional)</div>
                  <textarea value={newSeqBrief} onChange={e => setNewSeqBrief(e.target.value)} placeholder="Specific angle for this rotation..."
                    style={{ width: '100%', height: 80, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                </div>
                <button onClick={handleAddSequence}
                  style={{ padding: '12px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(135deg, rgba(0,242,255,0.2), rgba(157,0,255,0.2))', color: '#00f2ff', fontSize: 13, fontWeight: 700, border: '1px solid rgba(0,242,255,0.3)' }}>
                  ➕ Add to Rotation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* TAB 3: ASSET VAULT                                             */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'vault' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', textTransform: 'uppercase' }}>📁 Clinical Asset Vault</div>
              <input value={assetFilter} onChange={e => setAssetFilter(e.target.value)} placeholder="Filter by zone tag..."
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, outline: 'none', minWidth: 200 }} />
              <button onClick={() => setShowRegisterAsset(v => !v)}
                style={{ marginLeft: 'auto', padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(0,242,255,0.3)', background: 'rgba(0,242,255,0.1)', color: '#00f2ff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                + Register Asset
              </button>
            </div>

            {/* Register Asset Panel */}
            {showRegisterAsset && (
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 16, border: '1px solid rgba(0,242,255,0.2)', padding: 24, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00f2ff', letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>Register New Asset</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  {[
                    { label: 'Asset Name', key: 'asset_name', placeholder: 'e.g. FNB_KDS_Tab1_Screenshot' },
                    { label: 'Zone Tag', key: 'zone_tag', placeholder: 'e.g. FNB_KDS, PMS_GRID' },
                    { label: 'Emotion Tag', key: 'emotion_tag', placeholder: 'e.g. CONFIDENT, WARNING' },
                    { label: 'File Path (VPS)', key: 'file_path', placeholder: '/media/vault/fnb_kds_tab1.webp' },
                    { label: 'Description', key: 'description', placeholder: 'What this asset shows...' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{f.label}</div>
                      <input value={(newAsset as any)[f.key]} onChange={e => setNewAsset(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Asset Type</div>
                    <select value={newAsset.asset_type} onChange={e => setNewAsset(p => ({ ...p, asset_type: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 12, outline: 'none' }}>
                      {Object.keys(ASSET_TYPE_COLORS).map(t => <option key={t} value={t} style={{ background: '#1e293b' }}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={handleRegisterAsset}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #00f2ff, #9d00ff)', color: '#000', fontWeight: 700, fontSize: 13 }}>
                  Save to Vault
                </button>
              </div>
            )}

            {/* Asset Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {assets.filter(a => !assetFilter || a.zone_tag?.toLowerCase().includes(assetFilter.toLowerCase())).map(asset => (
                <div key={asset.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 18, transition: 'border-color 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ASSET_TYPE_COLORS[asset.asset_type] || '#475569'}18`, border: `1px solid ${ASSET_TYPE_COLORS[asset.asset_type] || '#475569'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {asset.asset_type.startsWith('UI') ? 'ðŸ–¥ï¸' : asset.asset_type.startsWith('MASCOT') ? 'ðŸ§‘â€ðŸ’¼' : 'ðŸŽžï¸'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{asset.asset_name}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${ASSET_TYPE_COLORS[asset.asset_type] || '#475569'}22`, color: ASSET_TYPE_COLORS[asset.asset_type] || '#475569' }}>{asset.asset_type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {asset.zone_tag && <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(0,242,255,0.1)', color: '#00f2ff', fontSize: 10 }}>#{asset.zone_tag}</span>}
                    {asset.emotion_tag && <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(212,175,55,0.1)', color: '#d4af37', fontSize: 10 }}>@{asset.emotion_tag}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all' }}>{asset.file_path}</div>
                  {asset.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{asset.description}</div>}
                </div>
              ))}
              {assets.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: 60, textAlign: 'center', color: '#475569', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Asset Vault is empty</div>
                  <div style={{ fontSize: 13, marginTop: 8 }}>Register UI screenshots, mascot PNGs, and background loops to build your deterministic media library</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* TAB 4: SOCIAL API CONFIG                                        */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'social' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 20, textTransform: 'uppercase' }}>ðŸ”Œ Social Platform API Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {Object.entries(PLATFORM_META).map(([key, meta]) => {
                const cfg = socialConfigs.find(c => c.platform === key.toUpperCase());
                const isEditing = editingPlatform === key;
                return (
                  <div key={key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: `1px solid ${cfg?.is_connected ? meta.color + '44' : 'rgba(255,255,255,0.07)'}`, padding: 22, transition: 'border-color 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff' }}>{meta.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{meta.label}</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, background: cfg?.is_connected ? 'rgba(57,255,20,0.1)' : 'rgba(255,49,49,0.1)', color: cfg?.is_connected ? '#39ff14' : '#ff3131' }}>
                            {cfg?.is_connected ? 'â— CONNECTED' : '○ NOT CONNECTED'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => { setEditingPlatform(isEditing ? null : key); setSocialForm({ api_key: '', api_secret: '', access_token: '', page_id: cfg?.page_id || '', auto_publish: cfg?.auto_publish || false, publish_schedule: cfg?.publish_schedule || '' }); }}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${meta.color}44`, background: 'transparent', color: meta.color, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        {isEditing ? 'Cancel' : cfg ? 'Edit' : 'Connect'}
                      </button>
                    </div>

                    {cfg && !isEditing && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#64748b' }}>API Key</span>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{cfg.api_key_masked || 'â€”'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#64748b' }}>Page / Channel ID</span>
                          <span style={{ color: '#e2e8f0' }}>{cfg.page_id || 'â€”'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#64748b' }}>Auto-Publish</span>
                          <span style={{ color: cfg.auto_publish ? '#39ff14' : '#ff3131' }}>{cfg.auto_publish ? 'ON' : 'OFF'}</span>
                        </div>
                        {cfg.publish_schedule && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#64748b' }}>Schedule</span>
                            <span style={{ color: '#00f2ff' }}>{cfg.publish_schedule}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'API Key', key: 'api_key', type: 'password', placeholder: 'Enter API Key...' },
                          { label: 'API Secret', key: 'api_secret', type: 'password', placeholder: 'Enter API Secret...' },
                          { label: 'Access Token', key: 'access_token', type: 'password', placeholder: 'OAuth Access Token...' },
                          { label: 'Page / Channel ID', key: 'page_id', type: 'text', placeholder: 'Your page or channel ID...' },
                          { label: 'Post Schedule', key: 'publish_schedule', type: 'text', placeholder: 'e.g. TUE,THU 09:00' },
                        ].map(f => (
                          <div key={f.key}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{f.label}</div>
                            <input type={f.type} value={(socialForm as any)[f.key]} onChange={e => setSocialForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Auto-Publish</div>
                          <button onClick={() => setSocialForm(p => ({ ...p, auto_publish: !p.auto_publish }))}
                            style={{ padding: '4px 14px', borderRadius: 20, border: `1px solid ${socialForm.auto_publish ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.1)'}`, background: socialForm.auto_publish ? 'rgba(57,255,20,0.1)' : 'transparent', color: socialForm.auto_publish ? '#39ff14' : '#64748b', fontSize: 12, cursor: 'pointer' }}>
                            {socialForm.auto_publish ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <button onClick={() => handleSaveSocialConfig(key.toUpperCase())}
                          style={{ padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `${meta.color}`, color: '#fff', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                          Save Configuration
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* TAB 5: CAMPAIGN LEDGER                                         */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === 'ledger' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', textTransform: 'uppercase' }}>ðŸ“‹ Campaign Audit Ledger & Review Queue</div>
              <button onClick={fetchLedger} style={{ background: 'transparent', border: '1px solid rgba(0,242,255,0.3)', color: '#00f2ff', padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>ðŸ”„ Refresh Ledger</button>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,242,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Timestamp</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Zone / Topic</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Media Rendered</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Platforms</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(entry => {
                    const dt = new Date(entry.created_at);
                    const plats = entry.platforms_posted ? JSON.parse(entry.platforms_posted) : [];
                    const isPending = entry.publish_status === 'PENDING';
                    
                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } } as any}>
                        <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{dt.toLocaleDateString()}</div>
                          <div style={{ fontSize: 11 }}>{dt.toLocaleTimeString()}</div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569', marginTop: 4 }}>{entry.id.split('-')[0]}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,242,255,0.1)', color: '#00f2ff' }}>{entry.zone_id}</span>
                            <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{entry.topic_theme}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ 
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, 
                            background: isPending ? 'rgba(212,175,55,0.1)' : entry.publish_status === 'PUBLISHED' ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.05)',
                            color: isPending ? '#d4af37' : entry.publish_status === 'PUBLISHED' ? '#39ff14' : '#94a3b8',
                            border: `1px solid ${isPending ? 'rgba(212,175,55,0.3)' : entry.publish_status === 'PUBLISHED' ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.1)'}`
                          }}>
                            {isPending ? 'â³ PENDING REVIEW' : entry.publish_status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {entry.publish_status === 'PUBLISHED' || isPending ? (
                            <span style={{ color: '#39ff14', fontSize: 12 }}>âœ”ï¸ True</span>
                          ) : (
                            <button onClick={() => setShowComposeModal(entry.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(157,0,255,0.4)', background: 'rgba(157,0,255,0.1)', color: '#c084fc', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>ðŸŽ¬ Auto-Compose Video</button>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {plats.length > 0 ? plats.map((p: string) => (
                              <div key={p} style={{ width: 24, height: 24, borderRadius: 6, background: PLATFORM_META[p]?.color || '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{PLATFORM_META[p]?.icon || p[0]}</div>
                            )) : <span style={{ color: '#64748b', fontSize: 12 }}>â€”</span>}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {isPending && (
                            <button onClick={() => { setPublishPlatforms(['linkedin', 'facebook', 'youtube']); setShowPublishModal(entry.id); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(0,242,255,0.4)', background: 'rgba(0,242,255,0.1)', color: '#00f2ff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              ✅ Approve & Broadcast
                            </button>
                          )}
                          {!isPending && entry.publish_status !== 'PUBLISHED' && (
                            <button onClick={() => { setPublishPlatforms(['linkedin', 'facebook', 'youtube']); setShowPublishModal(entry.id); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#e2e8f0', fontSize: 12, cursor: 'pointer' }}>
                              Manual Publish
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {ledger.length === 0 && (
                <div style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>ðŸ“­</div>
                  <div style={{ fontSize: 14 }}>Ledger is empty</div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* â”€â”€ COMPOSE VIDEO MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showComposeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: 640, maxHeight: '85vh', overflow: 'auto', background: '#0d1526', borderRadius: 20, border: '1px solid rgba(157,0,255,0.3)', padding: 32, boxShadow: '0 0 80px rgba(157,0,255,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#c084fc', marginBottom: 8, textTransform: 'uppercase' }}>ðŸŽ¬ Native FFmpeg Video Compositor</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>Compose Video</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Select UI screenshots / mascot assets from the vault. FFmpeg will stitch them into a 1080Ã—1920 Short with Ken Burns zoom + burned subtitles.</div>

            {/* ElevenLabs Key */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>ElevenLabs API Key <span style={{ color: '#475569' }}>(optional â€” leave blank for silent render)</span></div>
              <input value={elevenKey} onChange={e => setElevenKey(e.target.value)} type="password" placeholder="sk-..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Asset picker */}
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>Select Assets from Vault ({selectedAssetIds.length} selected)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 280, overflow: 'auto', marginBottom: 24 }}>
              {assets.length === 0 && <div style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>No assets in vault yet. Register assets in the 📁 Asset Vault tab first.</div>}
              {assets.map(a => (
                <button key={a.id} onClick={() => toggleAssetForCompose(a.id)}
                  style={{ padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                    border: selectedAssetIds.includes(a.id) ? '1px solid rgba(157,0,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    background: selectedAssetIds.includes(a.id) ? 'rgba(157,0,255,0.12)' : 'rgba(255,255,255,0.02)',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{a.asset_name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${ASSET_TYPE_COLORS[a.asset_type] || '#475569'}22`, color: ASSET_TYPE_COLORS[a.asset_type] || '#475569' }}>{a.asset_type}</span>
                    {a.zone_tag && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,242,255,0.1)', color: '#00f2ff' }}>#{a.zone_tag}</span>}
                  </div>
                  {selectedAssetIds.includes(a.id) && <div style={{ color: '#c084fc', fontSize: 13, marginTop: 4 }}>âœ“ Selected (frame {selectedAssetIds.indexOf(a.id) + 1})</div>}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowComposeModal(null); setSelectedAssetIds([]); }}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleComposeVideo(showComposeModal!)} disabled={composingId === showComposeModal}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', cursor: composingId ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800,
                  background: composingId ? 'rgba(157,0,255,0.2)' : 'linear-gradient(135deg, #9d00ff, #c084fc)',
                  color: composingId ? '#c084fc' : '#fff',
                  boxShadow: composingId ? 'none' : '0 0 30px rgba(157,0,255,0.4)',
                }}>
                {composingId === showComposeModal ? 'âš™ï¸ FFmpeg rendering... (~45s)' : `ðŸŽ¬ Render ${selectedAssetIds.length} Asset${selectedAssetIds.length !== 1 ? 's' : ''} into MP4`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ PUBLISH MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: 480, background: '#0d1526', borderRadius: 20, border: '1px solid rgba(0,242,255,0.2)', padding: 32, boxShadow: '0 0 80px rgba(0,242,255,0.1)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#00f2ff', marginBottom: 8, textTransform: 'uppercase' }}>ðŸš€ OAuth2 Auto-Publisher</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>Publish Content</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Select platforms to publish to. API tokens are read from the ðŸ”Œ 🔑 Social APIs tab. YouTube requires a composed video first.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {Object.entries(PLATFORM_META).map(([key, meta]) => {
                const cfg = socialConfigs.find(c => c.platform === key.toUpperCase());
                const isOn = publishPlatforms.includes(key);
                return (
                  <button key={key} onClick={() => setPublishPlatforms(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      border: isOn ? `1px solid ${meta.color}55` : '1px solid rgba(255,255,255,0.06)',
                      background: isOn ? `${meta.color}14` : 'rgba(255,255,255,0.02)',
                    }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>{meta.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isOn ? '#e2e8f0' : '#64748b' }}>{meta.label}</div>
                      <div style={{ fontSize: 10, color: cfg?.is_connected ? '#39ff14' : '#ff3131' }}>{cfg?.is_connected ? 'â— Token configured' : '○ No token â€” configure in 🔑 Social APIs tab'}</div>
                    </div>
                    {isOn && <span style={{ color: '#39ff14', fontSize: 18 }}>âœ“</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowPublishModal(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handlePublish(showPublishModal!)} disabled={publishingId === showPublishModal}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', cursor: publishingId ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800,
                  background: publishingId ? 'rgba(0,242,255,0.1)' : 'linear-gradient(135deg, #00f2ff, #0A66C2)',
                  color: publishingId ? '#00f2ff' : '#000',
                  boxShadow: publishingId ? 'none' : '0 0 30px rgba(0,242,255,0.3)',
                }}>
                {publishingId === showPublishModal ? 'ðŸ“¡ Publishing...' : `ðŸš€ Publish to ${publishPlatforms.length} Platform${publishPlatforms.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        select option { background: #1e293b; color: #e2e8f0; }
        input::placeholder, textarea::placeholder { color: #475569; }
        button:hover { opacity: 0.88; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(0,242,255,0.2); border-radius: 3px; }
      `}</style>
    </div>
  );
}


