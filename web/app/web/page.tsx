'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ViewModeBanner, { useViewMode } from '../components/ViewModeBanner';

const API = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export default function PeacefulHospitalWebPage() {
  const isViewMode = useViewMode();
  
  // Canvas Ref for Healing Breathing Waves & Particles
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Calming Image Slider
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      url: '/images/luxury_ward.png',
      title: 'Serene Recovery Suites',
      desc: 'Designed with warm natural light and calming gardens to promote rapid healing and peace of mind.'
    },
    {
      url: '/images/robotic_surgery.png',
      title: 'Advanced Robotic Care',
      desc: 'Precision surgical technologies executing treatments with highest safety and care.'
    },
    {
      url: '/images/diagnostic_lab.png',
      title: 'Precision Diagnostics Lab',
      desc: 'Fast, accurate health reports to give you clarity and comfort on your wellness path.'
    }
  ];

  // Triage Console States
  const [symptomInput, setSymptomInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [diagnosticReport, setDiagnosticReport] = useState<{
    dept: string;
    priority: string;
    priorityColor: string;
    action: string;
    waitTime: string;
  } | null>(null);

  // Active Department Explorer (Expanded with 8 Advanced Services)
  const [activeDept, setActiveDept] = useState<'CARDIOLOGY' | 'TRAUMA' | 'LIS_LABS' | 'NEURO' | 'GENOMICS' | 'TELEMEDICINE' | 'IMAGING' | 'WELLNESS'>('CARDIOLOGY');

  // RERS Feature Carousel
  const [rersSlide, setRersSlide] = useState(0);
  const [rersHovered, setRersHovered] = useState(false);
  const rersIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const RERS_SLIDES = [
    {
      icon: '⌚',
      label: 'STEP 01 — WRISTBAND SENSOR',
      title: 'Continuous Vital Monitoring, 24/7',
      body: 'Every admitted patient wears a smart wristband that streams heart rate, blood oxygen (SpO2), temperature, and blood pressure to our hospital network in real time. No button press needed — the system watches silently and vigilantly.',
      stat1: { label: 'METRICS TRACKED', value: '4 Vitals' },
      stat2: { label: 'STREAM INTERVAL', value: 'Real-Time' },
      accent: '#52d1a3',
      glow: 'rgba(82,209,163,0.15)',
    },
    {
      icon: '🧠',
      label: 'STEP 02 — AI THRESHOLD ENGINE',
      title: 'Intelligent Crisis Classification',
      body: 'When vitals cross clinical thresholds — a heart rate below 50 bpm, SpO2 under 92%, systolic BP below 80 mmHg — the AI engine instantly classifies the event type: Bradycardia, Hypoxia, Hypotension, Hypertension Crisis, Hypo/Hyperthermia.',
      stat1: { label: 'ALERT TYPES', value: '7 Classified' },
      stat2: { label: 'DETECTION LATENCY', value: '< 1 Second' },
      accent: '#818cf8',
      glow: 'rgba(129,140,248,0.15)',
    },
    {
      icon: '🚨',
      label: 'STEP 03 — EMERGENCY COMMAND GRID',
      title: 'The Exact Bed Flashes Red — Instantly',
      body: 'The moment an alert triggers, every Emergency Command Grid dashboard in the hospital lights up. The exact ward bed card pulses red with an alert type label. No phone calls, no delays — the right people see it in zero seconds via WebSocket broadcast.',
      stat1: { label: 'BROADCAST SPEED', value: 'WebSocket' },
      stat2: { label: 'BED VISIBILITY', value: 'Exact Card' },
      accent: '#FF5A5A',
      glow: 'rgba(255,90,90,0.15)',
    },
    {
      icon: '🩺',
      label: 'STEP 04 — DOCTOR NOTIFICATION',
      title: 'Doctor On-Call Alerted Within 60 Seconds',
      body: 'The duty doctor receives an immediate notification with patient name, bed number, and the critical vital snapshot. Our SLA mandates acknowledgement within 60 seconds. Every response is timestamped — compliant or breached — permanently recorded.',
      stat1: { label: 'DOCTOR SLA', value: '≤ 60 Seconds' },
      stat2: { label: 'TRACKING', value: 'Millisecond' },
      accent: '#fbbf24',
      glow: 'rgba(251,191,36,0.15)',
    },
    {
      icon: '🚑',
      label: 'STEP 05 — AMBULANCE DISPATCH',
      title: 'Emergency Response Deployed in 3 Minutes',
      body: 'Simultaneously, the hospital ambulance and crash cart team are dispatched. Our SLA mandates full deployment within 3 minutes of the alert trigger. Dispatch time is recorded, and compliance is reported to hospital management automatically.',
      stat1: { label: 'DISPATCH SLA', value: '≤ 3 Minutes' },
      stat2: { label: 'TEAM ASSIGNED', value: 'Auto-Alerted' },
      accent: '#818cf8',
      glow: 'rgba(129,140,248,0.15)',
    },
    {
      icon: '✅',
      label: 'STEP 06 — SLA TIME AUDIT',
      title: 'Every Second Measured. Every Breach Logged.',
      body: 'From the moment the wristband triggers to the moment the medical team reaches the patient — every second is measured, stored, and audited. Hospital management can review SLA compliance for any alert at any time, across all wards.',
      stat1: { label: 'ARRIVAL SLA', value: '≤ 10 Minutes' },
      stat2: { label: 'AUDIT TRAIL', value: 'Permanent DB' },
      accent: '#34d399',
      glow: 'rgba(52,211,153,0.15)',
    },
  ];

  // Calming Care Marquee
  const [careTips, setCareTips] = useState([
    '🌿 HEALING: Our outdoor healing gardens are open 24/7 for patient relaxation and fresh air.',
    '✨ WELLNESS: Staying hydrated supports optimal circulation and cellular healing.',
    '🩺 PATIENT-FIRST: The average GP wait time in outpatient reception is currently under 10 minutes.',
    '🍎 DIETETICS: Our dietary prep team serves organic, chef-curated meals tailored to your recovery.',
    '💖 COMPASSION: Our nurse-to-patient ratio is maintained at 1:2 to ensure personalized attention.'
  ]);

  // Chatbot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Welcome to Miracle General Hospital. How can I help guide you to an appointment, view your lab charts, or check on a loved one?' }
  ]);
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSendChat = async () => {
    if (!chatInput.trim() || thinking) return;
    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setThinking(true);
    try {
      const res = await fetch(`${API}/visitor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'ai', text: data.reply || data.message || 'How else can I assist you?' }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'I am here to help. Please visit our front desk or call our helpline for immediate assistance.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Our team is available at the front desk 24/7. How can we assist you today?' }]);
    }
    setThinking(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 1. Calming Respiration Waves & Drifting Particles Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 1200;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    resize();
    window.addEventListener('resize', resize);

    // Particle class for slow drifting bioluminescence
    class BioParticle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      alpha: number;

      constructor() {
        this.x = Math.random() * (canvas?.width || 1200);
        this.y = (canvas?.height || 600) + Math.random() * 50;
        this.size = Math.random() * 3 + 1;
        this.speedY = -(Math.random() * 0.4 + 0.1);
        this.alpha = Math.random() * 0.5 + 0.1;
      }

      update() {
        this.y += this.speedY;
        if (this.y < 0) {
          this.y = (canvas?.height || 600) + 10;
          this.x = Math.random() * (canvas?.width || 1200);
        }
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#52d1a3';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const particles: BioParticle[] = Array.from({ length: 45 }, () => new BioParticle());

    let breathAngle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // A. Soft respiratory sine waves representing gentle breathing
      ctx.strokeStyle = 'rgba(112, 197, 226, 0.08)';
      ctx.lineWidth = 3;
      
      const drawSine = (offset: number, amplitude: number, speed: number) => {
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x++) {
          const y = canvas.height * 0.5 + Math.sin(x * 0.003 + breathAngle * speed + offset) * amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      // Draw three intersecting soft waves
      drawSine(0, 45, 1);
      ctx.strokeStyle = 'rgba(82, 209, 163, 0.06)';
      drawSine(Math.PI / 3, 30, 0.8);
      ctx.strokeStyle = 'rgba(112, 197, 226, 0.04)';
      drawSine(Math.PI / 1.5, 60, 1.2);

      breathAngle += 0.005; // Extremely slow, peaceful breathing speed

      // B. Render and update bioluminescent particles
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // RERS Carousel auto-advance
  useEffect(() => {
    if (rersHovered) {
      if (rersIntervalRef.current) clearInterval(rersIntervalRef.current);
      return;
    }
    rersIntervalRef.current = setInterval(() => {
      setRersSlide(prev => (prev + 1) % RERS_SLIDES.length);
    }, 4500);
    return () => { if (rersIntervalRef.current) clearInterval(rersIntervalRef.current); };
  }, [rersHovered, RERS_SLIDES.length]);

  // Auto-sliding banner
  useEffect(() => {
    const sliderInterval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(sliderInterval);
  }, [slides.length]);

  // Care Marquee loop
  useEffect(() => {
    const interval = setInterval(() => {
      setCareTips(prev => {
        const next = [...prev];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerDiagnosticScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomInput) return;

    setIsScanning(true);
    setScanProgress(0);
    setDiagnosticReport(null);

    let progress = 0;
    const timer = setInterval(() => {
      progress += 5;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(timer);
        setIsScanning(false);
        generateReport();
      }
    }, 100);
  };

  const generateReport = () => {
    const text = symptomInput.toUpperCase();
    if (text.includes('CHEST') || text.includes('HEART') || text.includes('BREATH') || text.includes('PAIN')) {
      setDiagnosticReport({
        dept: 'PRECISION CARDIOLOGY / EMERGENCY UNIT',
        priority: 'CRITICAL CARE ROUTE',
        priorityColor: '#FF5A5A',
        action: 'Cardiac response team prepared. Please proceed directly to emergency triage.',
        waitTime: 'Immediate'
      });
    } else if (text.includes('FRACTURE') || text.includes('BONE') || text.includes('BLEED') || text.includes('ACCIDENT')) {
      setDiagnosticReport({
        dept: 'TRAUMA CARE & SURGERY WING',
        priority: 'URGENT ATTENTION',
        priorityColor: '#f59e0b',
        action: 'Orthopedic triage ready. Directed pathways are open.',
        waitTime: '< 10 Minutes'
      });
    } else {
      setDiagnosticReport({
        dept: 'GENERAL OPD / FAMILY MEDICINE',
        priority: 'STABLE / ROUTINE CARE',
        priorityColor: '#52d1a3',
        action: 'Registered for general wellness consultation. Triage ticket generated.',
        waitTime: '15 Minutes'
      });
    }
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        * { box-sizing: border-box; }
        body { background: #041417; }

        @keyframes pulseSoft { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.02); opacity: 1; } }
        
        .calm-border { border: 1px solid rgba(82, 209, 163, 0.12); transition: 0.4s ease; }
        .calm-border:hover { border-color: rgba(82, 209, 163, 0.35); box-shadow: 0 10px 30px rgba(82, 209, 163, 0.05); }
      `}</style>
      <ViewModeBanner />

      {/* 🌿 GENTLE WELLNESS MARQUEE */}
      <div style={marqueeStyle}>
        <div style={{ display: 'flex', gap: '60px', whiteSpace: 'nowrap' }}>
          {careTips.map((t, idx) => (
            <span key={idx} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px', color: '#70c5e2' }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 🏥 HARMONIOUS SANCTUARY NAVBAR */}
      <nav style={navbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={logoBadge}>🌿</span>
          <div>
            <span style={logoTitle}>MIRACLE GENERAL HOSPITAL</span>
            <div style={logoSub}>COMPASSION · PRECISION · HEALING</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          <Link href="/properties" style={navLinkStyle}>PARTNERSHIP & DONATIONS</Link>
          <Link href="/dashboard" style={navLinkStyle}>CLINICAL PORTAL</Link>
          <Link href="/guest" style={actionBtn}>PATIENT EHR ACCESS</Link>
        </div>
      </nav>

      {/* 🌌 SERENE HERO SECTION WITH BREATHING SINE WAVES */}
      <header style={heroSection}>
        <canvas ref={canvasRef} style={canvasBgStyle} />
        
        <div style={heroContent}>
          <div style={badgeStyle}>
            <span style={{ animation: 'pulseSoft 3s infinite' }}>✨ A Calm Haven for Healing & Diagnostics</span>
          </div>
          <h1 style={heroTitle}>Compassionate Care, Guided by Precision Science</h1>
          <p style={heroSubtitle}>
            We combine world-class medical innovation with a serene, patient-first environment to support your path to recovery and give you absolute peace of mind.
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '35px', position: 'relative', zIndex: 10 }}>
            <Link href="/guest" style={heroBtnPrimary}>ACCESS SECURE PATIENT PORTAL</Link>
            <Link href="/properties" style={heroBtnSecondary}>JOIN AS DONOR PARTNER</Link>
          </div>
        </div>
      </header>

      {/* 🖼️ PEACEFUL GALLERY CAROUSEL */}
      <div style={sliderContainerStyle}>
        <h2 style={sliderHeadingStyle}>🌸 Healing Spaces & Care Units</h2>
        <div style={sliderFrameStyle}>
          <img 
            src={slides[currentSlide].url} 
            alt={slides[currentSlide].title} 
            style={sliderImageStyle} 
          />
          <div style={sliderCaptionOverlay}>
            <h3 style={sliderCaptionTitle}>{slides[currentSlide].title}</h3>
            <p style={sliderCaptionDesc}>{slides[currentSlide].desc}</p>
          </div>
          {/* Slider Dots */}
          <div style={sliderDotsStyle}>
            {slides.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentSlide(idx)} 
                style={sliderDotStyle(currentSlide === idx)} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================
          🚨 RERS FUTURISTIC FEATURE CAROUSEL
      ================================================================ */}
      <div style={rersSection}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={rersBadge}>⌚ WORLD-FIRST TECHNOLOGY</div>
          <h2 style={rersSectionTitle}>Real-Time Patient Emergency Response System</h2>
          <p style={rersSectionSub}>
            A wristband worn by every patient. A command grid watched by every doctor.
            An ambulance dispatched in 3 minutes. Every second measured. Nothing missed.
          </p>
        </div>

        {/* Main Carousel Frame */}
        <div
          style={rersCarouselFrame}
          onMouseEnter={() => setRersHovered(true)}
          onMouseLeave={() => setRersHovered(false)}
        >
          {/* Scanline ambient effect */}
          <div style={rersScanline} />

          {/* Slide Step Track */}
          <div style={rersStepTrack}>
            {RERS_SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => setRersSlide(i)}
                style={rersStepBtn(i === rersSlide, s.accent)}
              >
                <span style={{ fontSize: '16px' }}>{s.icon}</span>
                <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', marginTop: '4px', color: i === rersSlide ? s.accent : 'rgba(255,255,255,0.25)' }}>
                  {`0${i + 1}`}
                </span>
              </button>
            ))}
          </div>

          {/* Slide Content */}
          <div style={rersSlideContent(RERS_SLIDES[rersSlide].glow)}>
            {/* Left — visual icon column */}
            <div style={rersIconColumn(RERS_SLIDES[rersSlide].accent)}>
              <div style={rersIconOrb(RERS_SLIDES[rersSlide].accent)}>
                <span style={{ fontSize: '56px', lineHeight: 1 }}>{RERS_SLIDES[rersSlide].icon}</span>
              </div>
              {/* Chain dots */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '20px' }}>
                {RERS_SLIDES.map((_, i) => (
                  <div key={i} style={rersChainDot(i === rersSlide, i < rersSlide, RERS_SLIDES[rersSlide].accent)} />
                ))}
              </div>
            </div>

            {/* Right — text content */}
            <div style={rersTextCol}>
              <div style={rersStepLabel(RERS_SLIDES[rersSlide].accent)}>{RERS_SLIDES[rersSlide].label}</div>
              <h3 style={rersSlideTitleStyle}>{RERS_SLIDES[rersSlide].title}</h3>
              <p style={rersSlideBody}>{RERS_SLIDES[rersSlide].body}</p>

              {/* Stat pills */}
              <div style={{ display: 'flex', gap: '14px', marginTop: '24px', flexWrap: 'wrap' }}>
                <div style={rersStatPill(RERS_SLIDES[rersSlide].accent)}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: '4px' }}>{RERS_SLIDES[rersSlide].stat1.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: RERS_SLIDES[rersSlide].accent, fontFamily: 'monospace' }}>{RERS_SLIDES[rersSlide].stat1.value}</div>
                </div>
                <div style={rersStatPill(RERS_SLIDES[rersSlide].accent)}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: '4px' }}>{RERS_SLIDES[rersSlide].stat2.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: RERS_SLIDES[rersSlide].accent, fontFamily: 'monospace' }}>{RERS_SLIDES[rersSlide].stat2.value}</div>
                </div>
              </div>

              {/* CTA */}
              <a href="/guest" style={rersCtaBtn(RERS_SLIDES[rersSlide].accent)}>
                Access Patient Portal &rarr;
              </a>
            </div>
          </div>

          {/* Progress bar */}
          <div style={rersProgressTrack}>
            <div style={rersProgressFill(RERS_SLIDES[rersSlide].accent, rersSlide, RERS_SLIDES.length)} />
          </div>

          {/* Prev / Next nav */}
          <button style={rersNavBtn('left')} onClick={() => setRersSlide(p => (p - 1 + RERS_SLIDES.length) % RERS_SLIDES.length)}>&lsaquo;</button>
          <button style={rersNavBtn('right')} onClick={() => setRersSlide(p => (p + 1) % RERS_SLIDES.length)}>&rsaquo;</button>
        </div>

        {/* Bottom chain summary strip */}
        <div style={rersChainStrip}>
          {['⌚ Wristband', '🧠 AI Engine', '🚨 Grid Alert', '🩺 Doctor', '🚑 Ambulance', '✅ SLA Audit'].map((step, i) => (
            <React.Fragment key={i}>
              <div
                style={rersChainItem(i === rersSlide, RERS_SLIDES[i].accent)}
                onClick={() => setRersSlide(i)}
              >
                {step}
              </div>
              {i < 5 && <div style={rersChainArrow(i < rersSlide)}>›</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 🎛️ HARMONIOUS CLINICAL GRID */}
      <div style={gridContainer}>
        
        {/* COMPASSIONATE Symptom Assister */}
        <div style={diagnosticConsole} className="calm-border">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={panelTitle}>Symptom Guidance Portal</h2>
            <span style={{ fontSize: '10px', color: '#52d1a3', fontWeight: 'bold', letterSpacing: '1px' }}>CARE MONITOR: ACTIVE</span>
          </div>

          <p style={panelDesc}>Share your symptoms to find the appropriate clinic wing and estimated waiting times.</p>

          <form onSubmit={triggerDiagnosticScan} style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            <input 
              type="text" 
              style={inputStyle} 
              placeholder="e.g. Chest tightness, body aches..." 
              value={symptomInput} 
              onChange={e => setSymptomInput(e.target.value)}
              disabled={isScanning}
              required 
            />
            <button type="submit" style={scanBtnStyle} disabled={isScanning}>
              {isScanning ? 'ASSESSING...' : 'GET GUIDANCE'}
            </button>
          </form>

          {isScanning && (
            <div style={scannerProgressContainer}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#70c5e2', marginBottom: '6px' }}>
                <span>Reviewing clinical pathways...</span>
                <span>{scanProgress}%</span>
              </div>
              <div style={progressBarBg}>
                <div style={progressBarVal(scanProgress)} />
              </div>
            </div>
          )}

          {diagnosticReport && (
            <div style={reportContainer(diagnosticReport.priorityColor)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', color: diagnosticReport.priorityColor }}>
                  {diagnosticReport.priority}
                </span>
                <span style={{ fontSize: '10px', color: '#888' }}>Wait Time: {diagnosticReport.waitTime}</span>
              </div>
              <h3 style={reportDeptTitle}>{diagnosticReport.dept}</h3>
              <p style={reportActionText}><strong>Recommendation:</strong> {diagnosticReport.action}</p>
            </div>
          )}
        </div>

        {/* INTERACTIVE CLINICS MATRIX */}
        <div style={deptExplorer} className="calm-border">
          <h2 style={panelTitle}>Specialized Care Clinics</h2>
          <div style={tabScrollContainer}>
            {([
              'CARDIOLOGY', 'TRAUMA', 'LIS_LABS', 'NEURO', 
              'GENOMICS', 'TELEMEDICINE', 'IMAGING', 'WELLNESS'
            ] as const).map(d => (
              <button 
                key={d} 
                onClick={() => setActiveDept(d)} 
                style={deptTabStyle(activeDept === d)}
              >
                {d.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={deptContentBox}>
            {activeDept === 'CARDIOLOGY' && (
              <div>
                <h3 style={deptContentTitle}>🩺 Precision Cardiovascular Unit</h3>
                <p style={deptContentText}>
                  Dedicated cardiac specialists and non-invasive monitoring supporting long-term vascular health.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>CARE CAPACITY</span><span style={statVal}>Optimal</span></div>
                  <div><span style={statLabel}>ROSTERING CHIEFS</span><span style={{ ...statVal, color: '#52d1a3' }}>2 Active</span></div>
                </div>
              </div>
            )}
            {activeDept === 'TRAUMA' && (
              <div>
                <h3 style={deptContentTitle}>🚑 Emergency Response & Trauma</h3>
                <p style={deptContentText}>
                  Around-the-clock emergency support prioritizing patients with immediate medical attention needs.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>TRAUMA BEDS</span><span style={statVal}>8 Prepared</span></div>
                  <div><span style={statLabel}>DUTY TEAM</span><span style={statVal}>Full Shift</span></div>
                </div>
              </div>
            )}
            {activeDept === 'LIS_LABS' && (
              <div>
                <h3 style={deptContentTitle}>🔬 Diagnostics Laboratory</h3>
                <p style={deptContentText}>
                  Pathology screenings and blood test panels processed with absolute precision.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>DAILY REPORTS</span><span style={statVal}>Verified</span></div>
                  <div><span style={statLabel}>COMPLIANCE STATUS</span><span style={{ ...statVal, color: '#52d1a3' }}>100% SECURE</span></div>
                </div>
              </div>
            )}
            {activeDept === 'NEURO' && (
              <div>
                <h3 style={deptContentTitle}>🧠 Advanced Neuro-Science</h3>
                <p style={deptContentText}>
                  Neurological evaluations, sleep study diagnostics, and pediatric cognitive support.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>SPECIALISTS ON DUTY</span><span style={statVal}>3 Attending</span></div>
                  <div><span style={statLabel}>REHAB SUITES</span><span style={statVal}>Active</span></div>
                </div>
              </div>
            )}
            {activeDept === 'GENOMICS' && (
              <div>
                <h3 style={deptContentTitle}>🧬 Precision Genomics & Oncology</h3>
                <p style={deptContentText}>
                  Gene sequencing, hereditary cancer panels, and personalized treatment matches.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>TARGET PANELS</span><span style={statVal}>Active</span></div>
                  <div><span style={statLabel}>LAB CLEARANCE</span><span style={{ ...statVal, color: '#52d1a3' }}>CERTIFIED</span></div>
                </div>
              </div>
            )}
            {activeDept === 'TELEMEDICINE' && (
              <div>
                <h3 style={deptContentTitle}>💻 Tele-Health Consultation</h3>
                <p style={deptContentText}>
                  Secure video appointments with board-certified general practitioners from the comfort of home.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>GP CHANNELS</span><span style={statVal}>Available 24/7</span></div>
                  <div><span style={statLabel}>TELEMETRY SYNC</span><span style={statVal}>Active</span></div>
                </div>
              </div>
            )}
            {activeDept === 'IMAGING' && (
              <div>
                <h3 style={deptContentTitle}>☢️ Radiology & MRI</h3>
                <p style={deptContentText}>
                  Tesla MRI and low-exposure CT scans designed to maintain patient safety and comfort.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>MRI CAPACITY</span><span style={statVal}>Open Slots</span></div>
                  <div><span style={statLabel}>AVERAGE TURNOUT</span><span style={statVal}>&lt; 2 Hours</span></div>
                </div>
              </div>
            )}
            {activeDept === 'WELLNESS' && (
              <div>
                <h3 style={deptContentTitle}>🎖️ Executive Health Audits</h3>
                <p style={deptContentText}>
                  Bespoke comprehensive physical checkups and lifestyle medicine panels for premium diagnostics.
                </p>
                <div style={deptStatsRow}>
                  <div><span style={statLabel}>DAILY SLOTS</span><span style={statVal}>Rostered</span></div>
                  <div><span style={statLabel}>WELLNESS SUITE</span><span style={{ ...statVal, color: '#52d1a3' }}>AVAILABLE</span></div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 💬 FLOATING HELPFUL SUPPORT DECK */}
      <button style={floatingChatTrigger} onClick={() => setChatOpen(!chatOpen)}>
        💬 HEALING HELPDESK
      </button>

      {chatOpen && (
        <div style={chatContainerStyle}>
          <div style={chatHeaderStyle}>
            <span>💚 Compassionate Support</span>
            <button onClick={() => setChatOpen(false)} style={chatCloseBtnStyle}>×</button>
          </div>
          <div style={chatBodyStyle}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ textAlign: m.role === 'user' ? 'right' : 'left', marginBottom: '10px' }}>
                <span style={chatBubbleStyle(m.role === 'user')}>
                  {m.text}
                </span>
              </div>
            ))}
            {thinking && <div style={{ fontSize: '11px', color: '#52d1a3', fontStyle: 'italic' }}>Finding answers for you...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={chatInputBlock}>
            <input 
              type="text" 
              style={chatInputField} 
              placeholder="Ask a question about your care..." 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
            />
            <button onClick={handleSendChat} style={chatSendBtnStyle}>ASK</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Calming Colors & Layout Definitions
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#041417', // Calming Deep Sea Teal
  color: '#f4f9f7',
  fontFamily: "'Outfit', sans-serif",
  paddingBottom: '80px',
  overflowX: 'hidden'
};

const marqueeStyle: React.CSSProperties = {
  background: 'rgba(82, 209, 163, 0.05)',
  borderBottom: '1px solid rgba(82, 209, 163, 0.1)',
  padding: '10px 20px',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 10
};

const navbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '25px 50px',
  background: 'rgba(4, 20, 23, 0.75)',
  backdropFilter: 'blur(30px)',
  borderBottom: '1px solid rgba(82, 209, 163, 0.08)',
  position: 'sticky',
  top: 0,
  zIndex: 100
};

const logoBadge: React.CSSProperties = {
  fontSize: '28px',
  background: 'rgba(82, 209, 163, 0.08)',
  padding: '8px',
  borderRadius: '12px',
  border: '1px solid rgba(82, 209, 163, 0.2)'
};

const logoTitle: React.CSSProperties = {
  fontWeight: '700',
  fontSize: '16px',
  letterSpacing: '1.5px',
  color: '#fff',
  display: 'block'
};

const logoSub: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 'bold',
  letterSpacing: '2px',
  color: '#52d1a3',
  marginTop: '2px'
};

const navLinkStyle: React.CSSProperties = {
  color: '#b0c0bc',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '1px',
  transition: '0.3s'
};

const actionBtn: React.CSSProperties = {
  background: '#52d1a3',
  color: '#041417',
  padding: '10px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '11px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
  boxShadow: '0 4px 15px rgba(82, 209, 163, 0.15)'
};

const heroSection: React.CSSProperties = {
  position: 'relative',
  padding: '120px 20px 150px 20px',
  textAlign: 'center',
  borderBottom: '1px solid rgba(82, 209, 163, 0.05)',
  overflow: 'hidden'
};

const canvasBgStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 1,
  pointerEvents: 'none'
};

const heroContent: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  position: 'relative',
  zIndex: 5
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(82, 209, 163, 0.05)',
  border: '1px solid rgba(82, 209, 163, 0.15)',
  borderRadius: '30px',
  padding: '6px 18px',
  marginBottom: '25px',
  fontSize: '11px',
  color: '#52d1a3',
  letterSpacing: '0.5px'
};

const heroTitle: React.CSSProperties = {
  fontSize: '44px',
  fontWeight: '700',
  color: '#fff',
  marginBottom: '20px',
  lineHeight: '1.3'
};

const heroSubtitle: React.CSSProperties = {
  fontSize: '15px',
  color: '#a4bca8',
  lineHeight: '1.7',
  maxWidth: '700px',
  margin: '0 auto'
};

const heroBtnPrimary: React.CSSProperties = {
  background: '#52d1a3',
  color: '#041417',
  padding: '14px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 'bold',
  boxShadow: '0 4px 20px rgba(82, 209, 163, 0.2)'
};

const heroBtnSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  padding: '14px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 'bold',
  transition: '0.3s'
};

const sliderContainerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '60px auto 0 auto',
  padding: '0 20px'
};

const sliderHeadingStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#fff',
  marginBottom: '20px'
};

const sliderFrameStyle: React.CSSProperties = {
  width: '100%',
  height: '480px',
  position: 'relative',
  borderRadius: '24px',
  overflow: 'hidden',
  border: '1px solid rgba(82, 209, 163, 0.08)',
  boxShadow: '0 15px 40px rgba(0,0,0,0.4)'
};

const sliderImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

const sliderCaptionOverlay: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'linear-gradient(transparent, rgba(4, 20, 23, 0.95))',
  padding: '40px 30px 30px 30px',
  borderTop: '1px solid rgba(255,255,255,0.04)'
};

const sliderCaptionTitle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#52d1a3',
  margin: '0 0 8px 0'
};

const sliderCaptionDesc: React.CSSProperties = {
  fontSize: '13px',
  color: '#a4bca8',
  margin: 0,
  lineHeight: '1.5'
};

const sliderDotsStyle: React.CSSProperties = {
  position: 'absolute',
  right: '30px',
  bottom: '30px',
  display: 'flex',
  gap: '8px',
  zIndex: 10
};

const sliderDotStyle = (active: boolean): React.CSSProperties => ({
  width: active ? '24px' : '8px',
  height: '8px',
  borderRadius: '4px',
  background: active ? '#52d1a3' : 'rgba(255,255,255,0.2)',
  border: 'none',
  cursor: 'pointer',
  transition: '0.3s'
});

const gridContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '40px',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 20px',
  marginTop: '50px'
};

const diagnosticConsole: React.CSSProperties = {
  background: 'rgba(10, 22, 25, 0.45)',
  borderRadius: '20px',
  padding: '30px',
  backdropFilter: 'blur(20px)'
};

const panelTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#fff',
  margin: 0
};

const panelDesc: React.CSSProperties = {
  fontSize: '12px',
  color: '#a4bca8',
  marginBottom: '20px'
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(4, 20, 23, 0.8)',
  border: '1px solid rgba(82, 209, 163, 0.15)',
  borderRadius: '8px',
  padding: '12px 16px',
  color: '#fff',
  outline: 'none',
  fontSize: '13px',
  fontFamily: 'inherit'
};

const scanBtnStyle: React.CSSProperties = {
  background: '#52d1a3',
  color: '#041417',
  border: 'none',
  borderRadius: '8px',
  padding: '0 24px',
  fontWeight: 'bold',
  fontSize: '12px',
  cursor: 'pointer'
};

const scannerProgressContainer: React.CSSProperties = {
  marginBottom: '20px'
};

const progressBarBg: React.CSSProperties = {
  width: '100%',
  height: '6px',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '3px',
  overflow: 'hidden'
};

const progressBarVal = (progress: number): React.CSSProperties => ({
  width: `${progress}%`,
  height: '100%',
  background: '#70c5e2',
  borderRadius: '3px',
  transition: '0.1s'
});

const reportContainer = (borderCol: string): React.CSSProperties => ({
  background: 'rgba(4, 20, 23, 0.6)',
  borderLeft: `4px solid ${borderCol}`,
  borderRadius: '4px 12px 12px 4px',
  padding: '18px',
  borderTop: '1px solid rgba(255,255,255,0.04)',
  borderRight: '1px solid rgba(255,255,255,0.04)',
  borderBottom: '1px solid rgba(255,255,255,0.04)'
});

const reportDeptTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#fff',
  margin: '0 0 6px 0'
};

const reportActionText: React.CSSProperties = {
  fontSize: '12px',
  color: '#a4bca8',
  margin: 0
};

const deptExplorer: React.CSSProperties = {
  background: 'rgba(10, 22, 25, 0.45)',
  borderRadius: '20px',
  padding: '30px',
  backdropFilter: 'blur(20px)',
  display: 'flex',
  flexDirection: 'column'
};

const tabScrollContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '8px',
  marginBottom: '20px'
};

const deptTabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 4px',
  background: active ? 'rgba(82, 209, 163, 0.08)' : 'rgba(255,255,255,0.02)',
  color: active ? '#52d1a3' : '#a4bca8',
  border: `1px solid ${active ? 'rgba(82, 209, 163, 0.3)' : 'rgba(255,255,255,0.05)'}`,
  borderRadius: '6px',
  fontSize: '9px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: '0.3s',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
});

const deptContentBox: React.CSSProperties = {
  background: 'rgba(4, 20, 23, 0.5)',
  borderRadius: '12px',
  padding: '20px',
  border: '1px solid rgba(255,255,255,0.03)',
  flex: 1
};

const deptContentTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#fff',
  margin: '0 0 8px 0'
};

const deptContentText: React.CSSProperties = {
  fontSize: '12px',
  color: '#a4bca8',
  lineHeight: '1.6',
  margin: '0 0 20px 0'
};

const deptStatsRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  paddingTop: '15px'
};

const statLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '9px',
  color: '#a4bca8',
  letterSpacing: '1px',
  marginBottom: '4px'
};

const statVal: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#fff'
};

const floatingChatTrigger: React.CSSProperties = {
  position: 'fixed',
  bottom: '30px',
  right: '30px',
  background: '#52d1a3',
  color: '#041417',
  border: 'none',
  borderRadius: '30px',
  padding: '12px 24px',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer',
  boxShadow: '0 4px 15px rgba(82, 209, 163, 0.25)',
  zIndex: 1000
};

const chatContainerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '95px',
  right: '30px',
  width: '360px',
  height: '460px',
  background: '#041c20',
  border: '1px solid rgba(82, 209, 163, 0.2)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
  borderRadius: '16px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 1000
};

const chatHeaderStyle: React.CSSProperties = {
  background: 'rgba(82, 209, 163, 0.08)',
  borderBottom: '1px solid rgba(82, 209, 163, 0.15)',
  padding: '15px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontWeight: 'bold',
  fontSize: '13px',
  color: '#52d1a3'
};

const chatCloseBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a4bca8',
  fontSize: '22px',
  cursor: 'pointer'
};

const chatBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: '15px 20px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const chatBubbleStyle = (isUser: boolean): React.CSSProperties => ({
  background: isUser ? '#52d1a3' : 'rgba(255,255,255,0.04)',
  color: isUser ? '#041417' : '#fff',
  padding: '10px 14px',
  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
  fontSize: '12px',
  display: 'inline-block',
  maxWidth: '85%',
  lineHeight: '1.4'
});

const chatInputBlock: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.06)',
  padding: '12px 15px',
  display: 'flex',
  gap: '10px'
};

const chatInputField: React.CSSProperties = {
  flex: 1,
  background: 'rgba(4, 20, 23, 0.8)',
  border: '1px solid rgba(82, 209, 163, 0.2)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#fff',
  outline: 'none',
  fontSize: '12px'
};

const chatSendBtnStyle: React.CSSProperties = {
  background: '#52d1a3',
  color: '#041417',
  border: 'none',
  borderRadius: '8px',
  padding: '0 18px',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer'
};

// ─── RERS FUTURISTIC CAROUSEL STYLES ────────────────────────────────────────
const rersSection: React.CSSProperties = {
  padding: '80px 40px',
  background: 'linear-gradient(180deg, #041417 0%, #04090c 50%, #041417 100%)',
  position: 'relative',
  overflow: 'hidden',
  borderTop: '1px solid rgba(255,255,255,0.04)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const rersBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 18px',
  background: 'rgba(255,90,90,0.1)',
  border: '1px solid rgba(255,90,90,0.3)',
  borderRadius: '20px',
  fontSize: '10px',
  fontWeight: 'bold',
  letterSpacing: '2px',
  color: '#FF7070',
  marginBottom: '20px',
};

const rersSectionTitle: React.CSSProperties = {
  fontSize: 'clamp(22px, 4vw, 40px)',
  fontWeight: 900,
  color: '#fff',
  letterSpacing: '-0.5px',
  marginBottom: '14px',
  lineHeight: 1.15,
};

const rersSectionSub: React.CSSProperties = {
  fontSize: '15px',
  color: 'rgba(255,255,255,0.45)',
  maxWidth: '600px',
  margin: '0 auto',
  lineHeight: 1.7,
};

const rersCarouselFrame: React.CSSProperties = {
  position: 'relative',
  maxWidth: '1100px',
  margin: '0 auto 32px',
  background: 'rgba(6,14,18,0.95)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '24px',
  overflow: 'hidden',
  minHeight: '340px',
  backdropFilter: 'blur(30px)',
};

const rersScanline: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(82,209,163,0.5), transparent)',
  pointerEvents: 'none',
  zIndex: 5,
};

const rersStepTrack: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  padding: '14px 20px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  background: 'rgba(0,0,0,0.25)',
};

const rersStepBtn = (active: boolean, accent: string): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 14px 10px',
  background: active ? `${accent}18` : 'transparent',
  border: 'none',
  borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
  borderRadius: '8px 8px 0 0',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  minWidth: '58px',
});

const rersSlideContent = (glow: string): React.CSSProperties => ({
  display: 'flex',
  gap: '40px',
  padding: '36px 52px 52px',
  alignItems: 'flex-start',
  background: `radial-gradient(ellipse at 8% 50%, ${glow} 0%, transparent 55%)`,
  transition: 'background 0.5s ease',
  flexWrap: 'wrap',
});

const rersIconColumn = (_accent: string): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  flexShrink: 0,
  width: '110px',
});

const rersIconOrb = (accent: string): React.CSSProperties => ({
  width: '100px',
  height: '100px',
  borderRadius: '28px',
  background: `linear-gradient(135deg, ${accent}1a, ${accent}08)`,
  border: `1px solid ${accent}33`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `0 0 40px ${accent}22`,
  transition: 'all 0.4s ease',
});

const rersChainDot = (active: boolean, done: boolean, accent: string): React.CSSProperties => ({
  width: active ? '10px' : '6px',
  height: active ? '10px' : '6px',
  borderRadius: '50%',
  background: active ? accent : done ? `${accent}55` : 'rgba(255,255,255,0.1)',
  transition: 'all 0.3s ease',
  boxShadow: active ? `0 0 8px ${accent}` : 'none',
});

const rersTextCol: React.CSSProperties = {
  flex: 1,
  minWidth: '280px',
  paddingTop: '4px',
};

const rersStepLabel = (accent: string): React.CSSProperties => ({
  fontSize: '10px',
  fontWeight: 800,
  letterSpacing: '2px',
  color: accent,
  marginBottom: '10px',
  textTransform: 'uppercase',
});

const rersSlideTitleStyle: React.CSSProperties = {
  fontSize: 'clamp(18px, 2.5vw, 26px)',
  fontWeight: 800,
  color: '#fff',
  marginBottom: '14px',
  lineHeight: 1.25,
};

const rersSlideBody: React.CSSProperties = {
  fontSize: '14px',
  color: 'rgba(255,255,255,0.52)',
  lineHeight: 1.78,
  maxWidth: '520px',
};

const rersStatPill = (accent: string): React.CSSProperties => ({
  padding: '14px 20px',
  background: `${accent}0d`,
  border: `1px solid ${accent}22`,
  borderRadius: '14px',
  minWidth: '120px',
});

const rersCtaBtn = (accent: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  marginTop: '28px',
  padding: '11px 22px',
  background: `${accent}18`,
  border: `1px solid ${accent}44`,
  borderRadius: '12px',
  color: accent,
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.5px',
  textDecoration: 'none',
  transition: 'all 0.2s ease',
});

const rersProgressTrack: React.CSSProperties = {
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  height: '3px',
  background: 'rgba(255,255,255,0.04)',
};

const rersProgressFill = (accent: string, slide: number, total: number): React.CSSProperties => ({
  height: '100%',
  width: `${((slide + 1) / total) * 100}%`,
  background: `linear-gradient(90deg, ${accent}66, ${accent})`,
  borderRadius: '3px',
  transition: 'width 0.45s ease',
});

const rersNavBtn = (dir: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute',
  top: '50%',
  ...(dir === 'left' ? { left: '16px' } : { right: '16px' }),
  transform: 'translateY(-50%)',
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.6)',
  fontSize: '20px',
  fontWeight: 900,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  transition: 'all 0.2s ease',
});

const rersChainStrip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  maxWidth: '1100px',
  margin: '0 auto',
  flexWrap: 'wrap',
};

const rersChainItem = (active: boolean, accent: string): React.CSSProperties => ({
  padding: '8px 16px',
  background: active ? `${accent}18` : 'rgba(255,255,255,0.03)',
  border: `1px solid ${active ? accent + '44' : 'rgba(255,255,255,0.06)'}`,
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 700,
  color: active ? accent : 'rgba(255,255,255,0.3)',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  whiteSpace: 'nowrap',
});

const rersChainArrow = (done: boolean): React.CSSProperties => ({
  fontSize: '16px',
  color: done ? 'rgba(82,209,163,0.6)' : 'rgba(255,255,255,0.12)',
  fontWeight: 300,
  userSelect: 'none',
});
