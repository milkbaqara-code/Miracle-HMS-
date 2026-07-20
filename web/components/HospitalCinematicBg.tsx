// components/HospitalCinematicBg.tsx
'use client';
import { useEffect, useRef } from 'react';

interface Figure {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;        // walk cycle phase
  dir: 1 | -1;         // 1 = left→right, -1 = right→left
  role: 'doctor' | 'nurse' | 'visitor';
  opacity: number;
  lane: number;         // 0 = far, 1 = mid, 2 = near
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface DataTag {
  x: number;
  y: number;
  text: string;
  opacity: number;
  fadeDir: 1 | -1;
}

const ROLE_COLORS = {
  doctor: 'rgba(0, 200, 255,',
  nurse:  'rgba(0, 255, 160,',
  visitor:'rgba(200, 220, 255,',
};

const DATA_SNIPPETS = [
  'VITALS: STABLE', 'ECG: SINUS RHYTHM', 'O₂: 98%', 'BP: 120/80',
  'WARD A: 5 OCCUPIED', 'ICU: 3 CRITICAL', 'ER: 2 INCOMING',
  'RX: DISPENSE OK', 'SCAN: CLEAR', 'LAB: RESULTS READY',
  'PATIENT 0047: ADMITTED', 'BED 12: AVAILABLE', 'OT-2: IN PROGRESS',
];

export default function HospitalCinematicBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let W = 0, H = 0;

    // ── State ──────────────────────────────────
    const figures: Figure[] = [];
    const particles: Particle[] = [];
    const dataTags: DataTag[] = [];
    let tick = 0;

    // ── Resize ─────────────────────────────────
    const resize = () => {
      W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
      H = canvas.height = canvas.offsetHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Seed figures ───────────────────────────
    const LANES = [
      { yBase: 0.62, sizeBase: 22, speedBase: 0.28 },
      { yBase: 0.70, sizeBase: 36, speedBase: 0.45 },
      { yBase: 0.80, sizeBase: 52, speedBase: 0.62 },
    ];
    const ROLES: Array<'doctor' | 'nurse' | 'visitor'> = ['doctor', 'nurse', 'visitor'];
    for (let i = 0; i < 14; i++) {
      const lane = i % 3;
      const l = LANES[lane];
      const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      figures.push({
        x: Math.random() * W,
        y: 0,
        speed: l.speedBase + Math.random() * 0.2,
        size: l.sizeBase + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
        dir,
        role: ROLES[Math.floor(Math.random() * 3)],
        opacity: 0.35 + Math.random() * 0.4,
        lane,
      });
    }

    // ── Seed data tags ─────────────────────────
    for (let i = 0; i < 6; i++) {
      dataTags.push({
        x: 0.05 + Math.random() * 0.9,
        y: 0.08 + Math.random() * 0.45,
        text: DATA_SNIPPETS[Math.floor(Math.random() * DATA_SNIPPETS.length)],
        opacity: Math.random(),
        fadeDir: Math.random() > 0.5 ? 1 : -1,
      });
    }

    // ── Draw corridor perspective ──────────────
    const drawCorridor = () => {
      // Deep space-blue hospital gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0,   '#000d1a');
      bg.addColorStop(0.4, '#001428');
      bg.addColorStop(1,   '#000a10');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const vp = H * 0.42; // vanishing point Y

      // Floor tiles (perspective lines)
      ctx.strokeStyle = 'rgba(0, 180, 220, 0.07)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x1 = cx - W * 0.55 * t;
        const x2 = cx + W * 0.55 * t;
        const y  = vp + (H - vp) * Math.pow(t, 0.6);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }

      // Lateral corridor walls (converging)
      const wallSpread = 0.44;
      // Left wall
      ctx.beginPath();
      ctx.moveTo(cx - 8, vp);
      ctx.lineTo(0, H);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Right wall
      ctx.beginPath();
      ctx.moveTo(cx + 8, vp);
      ctx.lineTo(W, H);
      ctx.stroke();

      // Ceiling light strips
      const numLights = 6;
      for (let i = 0; i < numLights; i++) {
        const t = (i + 0.5) / numLights;
        const yLight = vp + (H * 0.26 - vp) * (i === 0 ? 0.1 : Math.pow(t, 0.55));
        const halfW  = W * wallSpread * (i === 0 ? 0.02 : Math.pow(t, 0.55));
        const pulse  = 0.06 + 0.04 * Math.sin(tick * 0.018 + i * 1.2);

        const lg = ctx.createLinearGradient(cx - halfW, yLight, cx + halfW, yLight);
        lg.addColorStop(0,   'rgba(0,220,255,0)');
        lg.addColorStop(0.5, `rgba(0,220,255,${pulse})`);
        lg.addColorStop(1,   'rgba(0,220,255,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(cx - halfW, yLight - 2, halfW * 2, 4);
      }

      // Ambient glow from vanishing point
      const vGlow = ctx.createRadialGradient(cx, vp, 0, cx, vp, W * 0.6);
      vGlow.addColorStop(0,   `rgba(0, 180, 255, ${0.08 + 0.03 * Math.sin(tick * 0.012)})`);
      vGlow.addColorStop(0.5, 'rgba(0, 80, 120, 0.04)');
      vGlow.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = vGlow;
      ctx.fillRect(0, 0, W, H);
    };

    // ── Draw a walking humanoid silhouette ──────
    const drawFigure = (f: Figure) => {
      const l = LANES[f.lane];
      const y = H * l.yBase;
      const s = f.size;
      const walk = Math.sin(f.phase);
      const color = ROLE_COLORS[f.role];
      const alpha = f.opacity * (0.75 + 0.25 * Math.sin(f.phase * 0.5));

      ctx.save();
      ctx.translate(f.x, y);
      ctx.scale(f.dir, 1);

      // Shadow
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.25, s * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 200, 255, ${alpha * 0.15})`;
      ctx.fill();

      // Legs
      ctx.strokeStyle = `${color}${alpha})`;
      ctx.lineWidth = s * 0.095;
      ctx.lineCap = 'round';
      // Left leg
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.4);
      ctx.lineTo(-s * 0.1 + walk * s * 0.14, 0);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.4);
      ctx.lineTo(s * 0.1 - walk * s * 0.14, 0);
      ctx.stroke();

      // Body
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.38);
      ctx.lineTo(0, -s * 0.78);
      ctx.lineWidth = s * 0.13;
      ctx.stroke();

      // Arms
      ctx.lineWidth = s * 0.075;
      // Left arm
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.72);
      ctx.lineTo(-s * 0.22, -s * 0.52 + walk * s * 0.1);
      ctx.stroke();
      // Right arm
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.72);
      ctx.lineTo(s * 0.22, -s * 0.52 - walk * s * 0.1);
      ctx.stroke();

      // Head
      ctx.beginPath();
      ctx.arc(0, -s * 0.92, s * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${alpha})`;
      ctx.fill();

      // Doctor coat / nurse detail
      if (f.role === 'doctor') {
        ctx.beginPath();
        ctx.moveTo(-s * 0.04, -s * 0.7);
        ctx.lineTo(-s * 0.04, -s * 0.44);
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
        ctx.lineWidth = s * 0.03;
        ctx.stroke();
      }

      ctx.restore();
    };

    // ── Update figures ─────────────────────────
    const updateFigures = () => {
      for (const f of figures) {
        f.phase += 0.065;
        f.x += f.speed * f.dir;
        if (f.dir === 1 && f.x > W + 80) f.x = -80;
        if (f.dir === -1 && f.x < -80)   f.x = W + 80;
      }
    };

    // ── Particles (dust / bokeh) ───────────────
    const spawnParticle = () => {
      particles.push({
        x: Math.random() * W,
        y: H * 0.35 + Math.random() * H * 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.25,
        life: 0,
        maxLife: 120 + Math.random() * 180,
        size: 1 + Math.random() * 2.5,
      });
    };

    const updateParticles = () => {
      if (tick % 3 === 0) spawnParticle();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx;
        p.y  += p.vy;
        p.life++;
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
        const a = Math.sin((p.life / p.maxLife) * Math.PI) * 0.45;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 220, 255, ${a})`;
        ctx.fill();
      }
    };

    // ── Data tags ──────────────────────────────
    const drawDataTags = () => {
      for (const tag of dataTags) {
        tag.opacity += tag.fadeDir * 0.005;
        if (tag.opacity >= 0.7) { tag.fadeDir = -1; }
        if (tag.opacity <= 0) {
          tag.opacity = 0;
          tag.fadeDir = 1;
          tag.text = DATA_SNIPPETS[Math.floor(Math.random() * DATA_SNIPPETS.length)];
          tag.x = 0.04 + Math.random() * 0.88;
          tag.y = 0.06 + Math.random() * 0.38;
        }
        const x = tag.x * W;
        const y = tag.y * H;
        ctx.save();
        ctx.globalAlpha = tag.opacity;
        ctx.font = `bold ${10}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = 'rgba(0, 240, 200, 1)';
        ctx.fillText(tag.text, x, y);
        // underline
        const tw = ctx.measureText(tag.text).width;
        ctx.strokeStyle = 'rgba(0, 240, 200, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x + tw, y + 3);
        ctx.stroke();
        ctx.restore();
      }
    };

    // ── Vignette ───────────────────────────────
    const drawVignette = () => {
      const vg = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, W*0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    };

    // ── Main loop ──────────────────────────────
    const loop = () => {
      tick++;
      ctx.clearRect(0, 0, W, H);

      drawCorridor();
      updateParticles();

      // Draw far → near (depth order)
      const sorted = [...figures].sort((a, b) => a.lane - b.lane);
      for (const f of sorted) drawFigure(f);
      updateFigures();

      drawDataTags();
      drawVignette();

      raf = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
      }}
    />
  );
}
