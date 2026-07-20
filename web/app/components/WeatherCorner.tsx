'use client';
// ============================================================
// WEATHER CORNER — MIRACLE HMS V1.0
// Collapsed: current city weather with live particles
// Expanded: all 10 cities weather grid
// API: Open-Meteo (free, no key required)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import WeatherParticles from './WeatherParticles';

// ──────────────────────────────────────────────────────────────
// 1. CITY DATA (matches WORLD_CITIES in layout.tsx)
// ──────────────────────────────────────────────────────────────
const WEATHER_CITIES = [
  { name: 'DHAKA',     lat: 23.8103, lon: 90.4125, tz: 'Asia/Dhaka',        color: '#FF3131', flag: '🇧🇩' },
  { name: 'NEW YORK',  lat: 40.7128, lon: -74.006, tz: 'America/New_York',  color: '#00F2FF', flag: '🇺🇸' },
  { name: 'LONDON',    lat: 51.5074, lon: -0.1278, tz: 'Europe/London',     color: '#39FF14', flag: '🇬🇧' },
  { name: 'DUBAI',     lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai',        color: '#D4AF37', flag: '🇦🇪' },
  { name: 'SINGAPORE', lat: 1.3521,  lon: 103.8198, tz: 'Asia/Singapore',   color: '#9D00FF', flag: '🇸🇬' },
  { name: 'TOKYO',     lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo',       color: '#FF69B4', flag: '🇯🇵' },
  { name: 'SYDNEY',    lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney',color: '#00FF88', flag: '🇦🇺' },
  { name: 'MUMBAI',    lat: 19.0760, lon: 72.8777,  tz: 'Asia/Kolkata',     color: '#FF8C00', flag: '🇮🇳' },
  { name: 'PARIS',     lat: 48.8566, lon: 2.3522,   tz: 'Europe/Paris',     color: '#C084FC', flag: '🇫🇷' },
  { name: 'BEIJING',   lat: 39.9042, lon: 116.4074, tz: 'Asia/Shanghai',    color: '#F87171', flag: '🇨🇳' },
];

// ──────────────────────────────────────────────────────────────
// 2. WMO CODE → DISPLAY
// ──────────────────────────────────────────────────────────────
const getWeatherInfo = (code: number, temp: number) => {
  if (code === 0)                  return { icon: '☀️', label: 'Clear', bg: 'rgba(255,200,50,0.12)' };
  if (code === 1)                  return { icon: '🌤️', label: 'Mostly Clear', bg: 'rgba(255,200,50,0.08)' };
  if (code === 2)                  return { icon: '⛅', label: 'Partly Cloudy', bg: 'rgba(120,140,160,0.1)' };
  if (code === 3)                  return { icon: '☁️', label: 'Overcast', bg: 'rgba(80,100,120,0.12)' };
  if (code >= 45 && code <= 48)    return { icon: '🌫️', label: 'Foggy', bg: 'rgba(150,160,170,0.1)' };
  if (code >= 51 && code <= 55)    return { icon: '🌦️', label: 'Drizzle', bg: 'rgba(80,150,200,0.1)' };
  if (code >= 61 && code <= 65)    return { icon: '🌧️', label: 'Rain', bg: 'rgba(60,120,200,0.12)' };
  if (code >= 71 && code <= 77)    return { icon: '❄️', label: 'Snow', bg: 'rgba(180,210,255,0.1)' };
  if (code >= 80 && code <= 82)    return { icon: '🌧️', label: 'Showers', bg: 'rgba(60,120,200,0.12)' };
  if (code >= 85 && code <= 86)    return { icon: '🌨️', label: 'Snow Showers', bg: 'rgba(180,210,255,0.1)' };
  if (code >= 95 && code <= 99)    return { icon: '⛈️', label: 'Thunderstorm', bg: 'rgba(100,50,200,0.12)' };
  if (temp >= 35)                  return { icon: '🥵', label: 'Very Hot', bg: 'rgba(255,80,30,0.12)' };
  return { icon: '🌡️', label: 'Unknown', bg: 'rgba(80,80,80,0.1)' };
};

// ──────────────────────────────────────────────────────────────
// 3. TYPES
// ──────────────────────────────────────────────────────────────
interface CityWeather {
  city: typeof WEATHER_CITIES[0];
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: number;
}

// ──────────────────────────────────────────────────────────────
// 4. MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
export default function WeatherCorner() {
  const [expanded, setExpanded] = useState(false);
  const [weatherData, setWeatherData] = useState<CityWeather[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAllWeather = useCallback(async () => {
    try {
      // 🌍 Fetches from Sovereign Backend Brain
      // Backend caches this for 1 hour to prevent Open-Meteo API bans
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiUrl}/global/sync`);
      if (!res.ok) throw new Error("Failed to fetch global sync");
      const json = await res.json();
      
      if (json.status === 'SUCCESS' && json.data?.weather) {
        setWeatherData(json.data.weather);
        setLastUpdate(new Date(json.data.server_time || Date.now()));
        setLoading(false);
      } else {
        throw new Error("Invalid global sync format");
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllWeather();
    // Re-sync every 5 minutes (the backend only hits the external API every 60 mins)
    const interval = setInterval(fetchAllWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllWeather]);

  const primary = weatherData[0]; // Dhaka (first city = home)
  const info = primary ? getWeatherInfo(primary.weatherCode, primary.temp) : null;

  // ── COLLAPSED WIDGET ──
  const collapsedWidget = (
    <div
      style={collapsedStyle}
      onClick={() => setExpanded(true)}
      title="Click to expand all cities"
    >
      {/* Particle layer */}
      {primary && (
        <WeatherParticles
          weatherCode={primary.weatherCode}
          temperature={primary.temp}
          intensity="light"
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
        {loading ? (
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '1px' }}>LOADING...</div>
        ) : primary && info ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 6px rgba(255,200,50,0.5))' }}>{info.icon}</span>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 900, color: '#FFF', lineHeight: 1, textShadow: '0 0 15px rgba(255,255,255,0.3)' }}>
                  {primary.temp}°C
                </div>
                <div style={{ fontSize: '8px', color: '#888', letterSpacing: '1px' }}>DHAKA</div>
              </div>
            </div>
            <div style={{ fontSize: '9px', color: primary.city.color, fontWeight: 700, letterSpacing: '1px' }}>
              {info.label} · {primary.humidity}% 💧
            </div>
          </>
        ) : (
          <div style={{ fontSize: '10px', color: '#555' }}>--</div>
        )}
      </div>
    </div>
  );

  // ── EXPANDED PANEL ──
  if (expanded) {
    return (
      <div style={expandedOverlay} onClick={() => setExpanded(false)}>
        <div style={expandedPanel} onClick={e => e.stopPropagation()}>
          {/* Panel Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
            <div>
              <div style={{ fontFamily: 'Cinzel', fontSize: '14px', color: '#00F2FF', letterSpacing: '3px' }}>🌍 GLOBAL WEATHER</div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '3px' }}>
                {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Live from Open-Meteo'}
              </div>
            </div>
            <button onClick={() => setExpanded(false)} style={closeBtnStyle}>✕</button>
          </div>

          {/* Primary city hero */}
          {primary && info && (
            <div style={heroCityStyle(info.bg, primary.city.color)}>
              <WeatherParticles weatherCode={primary.weatherCode} temperature={primary.temp} intensity="medium" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '48px', filter: 'drop-shadow(0 0 15px rgba(255,200,50,0.6))' }}>{info.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Cinzel', fontSize: '11px', color: primary.city.color, letterSpacing: '2px' }}>
                      {primary.city.flag} {primary.city.name}
                    </div>
                    <div style={{ fontSize: '42px', fontWeight: 900, color: '#FFF', fontFamily: 'monospace', lineHeight: 1, textShadow: `0 0 30px ${primary.city.color}66` }}>
                      {primary.temp}°C
                    </div>
                    <div style={{ fontSize: '12px', color: '#AAA', marginTop: '4px' }}>{info.label}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                  <div style={statChip}>💧 {primary.humidity}% Humidity</div>
                  <div style={statChip}>💨 {primary.windSpeed} km/h Wind</div>
                  <div style={statChip}>🌡️ Feels {primary.feelsLike}°C</div>
                </div>
              </div>
            </div>
          )}

          {/* All cities grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px', overflowY: 'auto' }}>
            {weatherData.slice(1).map((w) => {
              const wi = getWeatherInfo(w.weatherCode, w.temp);
              return (
                <div key={w.city.name} style={cityCardStyle(wi.bg, w.city.color)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: w.city.color, fontWeight: 900, letterSpacing: '1px' }}>
                        {w.city.flag} {w.city.name}
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#FFF', fontFamily: 'monospace', lineHeight: 1, marginTop: '4px' }}>
                        {w.temp}°C
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>{wi.label}</div>
                    </div>
                    <span style={{ fontSize: '26px', filter: `drop-shadow(0 0 8px ${w.city.color}66)` }}>{wi.icon}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span style={miniStat}>💧{w.humidity}%</span>
                    <span style={miniStat}>💨{w.windSpeed}km/h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes weatherExpand {
            from { opacity: 0; transform: translateY(-20px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        ` }} />
      </div>
    );
  }

  return collapsedWidget;
}

// ──────────────────────────────────────────────────────────────
// 5. STYLES
// ──────────────────────────────────────────────────────────────
const collapsedStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(135deg, rgba(15,20,30,0.9) 0%, rgba(5,10,20,0.95) 100%)',
  border: '1px solid rgba(0,242,255,0.15)',
  borderRadius: '14px',
  padding: '10px 14px',
  cursor: 'pointer',
  minWidth: '120px',
  transition: 'all 0.3s',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
};

const expandedOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)',
  zIndex: 9990,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  padding: '80px 20px 20px',
};

const expandedPanel: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(10,12,20,0.99) 0%, rgba(5,7,15,0.99) 100%)',
  border: '1px solid rgba(0,242,255,0.12)',
  borderRadius: '24px',
  boxShadow: '0 40px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0,242,255,0.04)',
  width: '520px',
  maxHeight: '80vh',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  animation: 'weatherExpand 0.35s cubic-bezier(0.16,1,0.3,1)',
  overflow: 'hidden',
};

const heroCityStyle = (bg: string, color: string): React.CSSProperties => ({
  position: 'relative',
  overflow: 'hidden',
  background: bg,
  border: `1px solid ${color}30`,
  borderRadius: '16px',
  padding: '20px',
  boxShadow: `0 0 30px ${color}15`,
});

const cityCardStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  border: `1px solid ${color}25`,
  borderRadius: '12px',
  padding: '12px',
  transition: '0.2s',
});

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,49,49,0.1)',
  border: '1px solid rgba(255,49,49,0.3)',
  borderRadius: '50%',
  width: '28px', height: '28px',
  color: '#FF3131',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const statChip: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '20px',
  padding: '4px 10px',
  fontSize: '10px',
  color: '#CCC',
  fontWeight: 700,
};

const miniStat: React.CSSProperties = {
  fontSize: '9px',
  color: '#666',
  background: 'rgba(255,255,255,0.04)',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: 700,
};
