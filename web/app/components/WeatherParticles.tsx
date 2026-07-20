'use client';
// ============================================================
// WEATHER PARTICLES — MIRACLE HMS V1.0
// Hardware-accelerated CSS particle system
// Driven by WMO weather code from Open-Meteo
// ============================================================
import { useMemo } from 'react';

interface Props {
  weatherCode: number;
  temperature?: number;
  intensity?: 'light' | 'medium' | 'heavy';
}

// WMO code → particle type
const getParticleType = (code: number) => {
  if (code === 0 || code === 1) return 'sun';
  if (code === 2 || code === 3) return 'cloud';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return 'cloud';
};

export default function WeatherParticles({ weatherCode, temperature = 25, intensity = 'medium' }: Props) {
  const type = getParticleType(weatherCode);

  const count = intensity === 'light' ? 12 : intensity === 'medium' ? 24 : 40;

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      duration: `${1.5 + Math.random() * 3}s`,
      size: `${2 + Math.random() * 4}px`,
      opacity: 0.3 + Math.random() * 0.5,
      drift: `${(Math.random() - 0.5) * 30}px`,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, weatherCode]);

  const keyframes = `
    @keyframes rain-fall {
      0% { transform: translateY(-20px) translateX(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 0.8; }
      100% { transform: translateY(100px) translateX(8px); opacity: 0; }
    }
    @keyframes snow-drift {
      0% { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 0.9; }
      100% { transform: translateY(100px) translateX(var(--drift, 20px)) rotate(360deg); opacity: 0; }
    }
    @keyframes sun-pulse {
      0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.6; }
      50% { transform: scale(1.3) rotate(180deg); opacity: 1; }
    }
    @keyframes cloud-float {
      0% { transform: translateX(-30px); opacity: 0; }
      20% { opacity: 0.4; }
      80% { opacity: 0.3; }
      100% { transform: translateX(120px); opacity: 0; }
    }
    @keyframes fog-drift {
      0% { transform: translateX(-40px) scaleX(0.8); opacity: 0; }
      30% { opacity: 0.25; }
      70% { opacity: 0.2; }
      100% { transform: translateX(80px) scaleX(1.2); opacity: 0; }
    }
    @keyframes storm-flash {
      0%, 90%, 100% { opacity: 0; }
      92%, 96% { opacity: 0.8; }
    }
    @keyframes lightning {
      0%, 85%, 100% { opacity: 0; transform: scaleY(0); }
      87% { opacity: 1; transform: scaleY(1); }
      90% { opacity: 0.5; }
      93% { opacity: 0; }
    }
  `;

  if (type === 'sun') {
    // Radiant sun rays
    return (
      <div style={containerStyle} aria-hidden>
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: '15%', left: '75%',
            width: `${40 + i * 8}px`, height: `${40 + i * 8}px`,
            borderRadius: '50%',
            border: `1px solid rgba(255,${200 - i * 10},50,${0.15 - i * 0.015})`,
            animation: `sun-pulse ${2 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
            transform: 'translate(-50%, -50%)',
          }} />
        ))}
        {/* Sun glow */}
        <div style={{
          position: 'absolute', top: '12%', left: '73%',
          width: '50px', height: '50px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,220,80,0.6) 0%, rgba(255,160,30,0.2) 50%, transparent 75%)',
          filter: 'blur(3px)',
          animation: 'sun-pulse 3s ease-in-out infinite',
        }} />
      </div>
    );
  }

  if (type === 'rain' || type === 'storm') {
    return (
      <div style={containerStyle} aria-hidden>
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: p.left, top: 0,
            width: '1.5px',
            height: `${8 + Math.random() * 12}px`,
            background: type === 'storm'
              ? 'linear-gradient(180deg, rgba(100,180,255,0) 0%, rgba(140,200,255,0.8) 100%)'
              : 'linear-gradient(180deg, rgba(120,200,255,0) 0%, rgba(100,180,255,0.7) 100%)',
            borderRadius: '2px',
            animation: `rain-fall ${p.duration} linear infinite`,
            animationDelay: p.delay,
            opacity: p.opacity,
          }} />
        ))}
        {type === 'storm' && (
          <>
            <div style={{
              position: 'absolute', top: '5%', left: '60%',
              width: '2px', height: '60px',
              background: 'linear-gradient(180deg, rgba(255,255,180,0.9) 0%, transparent 100%)',
              animation: 'lightning 4s ease-in-out infinite',
              filter: 'blur(1px)',
              transformOrigin: 'top',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 60% 5%, rgba(200,200,255,0.06) 0%, transparent 50%)',
              animation: 'storm-flash 4s ease-in-out infinite',
            }} />
          </>
        )}
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div style={containerStyle} aria-hidden>
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: p.left, top: 0,
            fontSize: p.size,
            animation: `snow-drift ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
            opacity: p.opacity,
            '--drift': p.drift,
          } as React.CSSProperties}>
            ❄
          </div>
        ))}
      </div>
    );
  }

  if (type === 'fog') {
    return (
      <div style={containerStyle} aria-hidden>
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: `${15 + i * 12}%`, left: 0,
            width: `${60 + i * 20}px`,
            height: `${8 + i * 3}px`,
            background: 'linear-gradient(90deg, transparent, rgba(180,200,220,0.2), transparent)',
            borderRadius: '50%',
            filter: 'blur(4px)',
            animation: `fog-drift ${4 + i * 0.8}s ease-in-out infinite`,
            animationDelay: `${i * 0.7}s`,
          }} />
        ))}
      </div>
    );
  }

  // Clouds (default/overcast)
  return (
    <div style={containerStyle} aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${5 + i * 14}%`, left: 0,
          width: `${50 + i * 15}px`,
          height: `${18 + i * 4}px`,
          background: 'radial-gradient(ellipse, rgba(150,170,190,0.25) 0%, transparent 75%)',
          borderRadius: '50%',
          filter: 'blur(6px)',
          animation: `cloud-float ${6 + i * 1.5}s ease-in-out infinite`,
          animationDelay: `${i * 1.2}s`,
        }} />
      ))}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  borderRadius: 'inherit',
  zIndex: 0,
};
