"use client";
import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';

const API_BASE = "/api";

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 5px rgba(157, 0, 255, 0.2); }
  50% { box-shadow: 0 0 20px rgba(157, 0, 255, 0.4); }
  100% { box-shadow: 0 0 5px rgba(157, 0, 255, 0.2); }
`;

const PageShell = styled.div`
  min-height: 100vh;
  background: #030303;
  color: #FFF;
  font-family: 'Inter', system-ui, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  box-shadow: 0 0 50px rgba(0,0,0,0.5);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 0%, rgba(157, 0, 255, 0.08) 0%, rgba(0,0,0,0) 60%);
    pointer-events: none;
    z-index: 0;
  }
`;

const Header = styled.header`
  background: rgba(10, 10, 10, 0.7);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  padding: 40px 25px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 50;
`;

const BackBtn = styled.button`
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #FFF;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  transition: 0.3s;
  &:active { transform: scale(0.9); }
`;

const ContentArea = styled.div`
  padding: 25px;
  position: relative;
  z-index: 10;
`;

const ServiceCard = styled.div<{ $active: boolean }>`
  background: ${props => props.$active ? 'rgba(157, 0, 255, 0.08)' : 'rgba(10, 10, 10, 0.6)'};
  border: 1px solid ${props => props.$active ? 'rgba(157, 0, 255, 0.4)' : 'rgba(255,255,255,0.05)'};
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 15px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 18px;

  &:active { transform: scale(0.97); }

  .icon {
    font-size: 2rem;
    width: 55px;
    height: 55px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.3);
    border-radius: 16px;
    flex-shrink: 0;
  }

  .info {
    flex: 1;
    h4 { margin: 0 0 5px; font-size: 14px; font-weight: 800; color: #FFF; }
    p { margin: 0; font-size: 11px; color: #666; line-height: 1.4; }
  }

  .check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid ${props => props.$active ? '#9D00FF' : 'rgba(255,255,255,0.1)'};
    background: ${props => props.$active ? '#9D00FF' : 'transparent'};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFF;
    font-size: 12px;
    transition: 0.3s;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;

  label {
    display: block;
    font-size: 10px;
    font-weight: 900;
    color: #888;
    letter-spacing: 2px;
    margin-bottom: 10px;
    text-transform: uppercase;
  }

  input, select, textarea {
    width: 100%;
    padding: 18px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.1);
    color: #FFF;
    border-radius: 16px;
    font-size: 14px;
    outline: none;
    transition: 0.3s;
    box-sizing: border-box;
    font-family: 'Inter', system-ui, sans-serif;

    &:focus {
      border-color: #9D00FF;
      box-shadow: 0 0 15px rgba(157, 0, 255, 0.15);
    }

    &::placeholder { color: #444; }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 16px center;
    background-size: 16px;
  }
`;

const SubmitBtn = styled.button<{ $disabled: boolean }>`
  width: 100%;
  padding: 20px;
  border-radius: 20px;
  background: ${props => props.$disabled ? '#333' : 'linear-gradient(135deg, #9D00FF, #6B00CC)'};
  color: #FFF;
  border: none;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 2px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: 0.3s;
  opacity: ${props => props.$disabled ? 0.5 : 1};
  animation: ${props => props.$disabled ? 'none' : pulseGlow} 3s infinite;
  margin-top: 10px;

  &:hover:not(:disabled) {
    filter: brightness(1.2);
    transform: translateY(-2px);
  }
`;

const SuccessCard = styled.div`
  text-align: center;
  padding: 60px 25px;

  .icon { font-size: 64px; margin-bottom: 20px; }
  .title { font-size: 20px; font-weight: 900; color: #FFF; margin-bottom: 10px; }
  .subtitle { font-size: 12px; color: #888; line-height: 1.6; margin-bottom: 30px; }
  
  button {
    padding: 16px 32px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #FFF;
    border-radius: 14px;
    font-weight: 900;
    font-size: 12px;
    letter-spacing: 1px;
    cursor: pointer;
    transition: 0.3s;
    &:active { transform: scale(0.95); }
  }
`;

const SectionLabel = styled.h3`
  font-size: 11px;
  font-weight: 900;
  color: #888;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin: 25px 0 15px;
`;

const SERVICES = [
  { id: 'SPA', name: 'Spa & Sauna', icon: '💆', desc: 'Relaxation therapy, hot sauna, body treatments' },
  { id: 'POOL', name: 'Swimming Pool', icon: '🏊', desc: 'Heated pool access, poolside service' },
  { id: 'GYM', name: 'Fitness Center', icon: '🏋️', desc: 'Full gym access, personal trainer available' },
  { id: 'VIP_SCREENING', name: 'VIP Screening Suite', icon: '🥂', desc: 'Intimate viewing rooms for up to 12 guests with butler service' },
  { id: 'PRIVATE_EVENTS', name: 'Private Events', icon: '🎪', desc: 'Exclusive venue hire for celebrations, corporate events, and productions' }
];

const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM',
  '08:00 PM', '09:00 PM'
];

export default function GuestReservePage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [selectedService, setSelectedService] = useState('SPA');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [guests, setGuests] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const guestData = localStorage.getItem('SOV_GUEST_SESSION');
    if (!guestData) { router.push('/guest'); return; }
    setSession(JSON.parse(guestData));

    // Pre-select service from URL query param if present
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const svc = params.get('service');
      if (svc && ['SPA', 'POOL', 'GYM', 'VIP_SCREENING', 'PRIVATE_EVENTS'].includes(svc)) {
        setSelectedService(svc);
      }
    }

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, [router]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/guest/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: session.room,
          service: selectedService,
          date: selectedDate,
          time: selectedTime,
          guests: parseInt(guests),
          notes: notes
        })
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        throw new Error('Reservation failed');
      }
    } catch (e) {
      // Fallback: create a concierge ticket instead
      try {
        await fetch(`${API_BASE}/guest/concierge/ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: session.room,
            dept: 'RS',
            subject: `[RESERVATION] ${SERVICES.find(s => s.id === selectedService)?.name} - ${selectedDate} at ${selectedTime} for ${guests} guest(s). ${notes}`,
            priority: 'NORMAL'
          })
        });
        setSuccess(true);
      } catch {
        alert('Unable to process reservation. Please contact the front desk.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  // Get today's date for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <PageShell>
      <Header>
        <BackBtn onClick={() => router.push('/guest/hub')}>←</BackBtn>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '2px', color: '#FFF' }}>Reservations</h1>
          <p style={{ margin: '2px 0 0', fontSize: '9px', fontWeight: 900, letterSpacing: '3px', color: '#9D00FF' }}>BOOK A SLOT</p>
        </div>
        <div style={{ width: '40px' }} />
      </Header>

      <ContentArea>
        {success ? (
          <SuccessCard>
            <div className="icon">✅</div>
            <div className="title">Reservation Confirmed</div>
            <div className="subtitle">
              Your {SERVICES.find(s => s.id === selectedService)?.name} reservation for {selectedDate} at {selectedTime} has been submitted.
              <br /><br />
              Our team will confirm availability shortly.
            </div>
            <button onClick={() => router.push('/guest/hub')}>Back to Home</button>
          </SuccessCard>
        ) : (
          <>
            <SectionLabel>Select Service</SectionLabel>
            {SERVICES.map(service => (
              <ServiceCard
                key={service.id}
                $active={selectedService === service.id}
                onClick={() => setSelectedService(service.id)}
              >
                <div className="icon">{service.icon}</div>
                <div className="info">
                  <h4>{service.name}</h4>
                  <p>{service.desc}</p>
                </div>
                <div className="check">{selectedService === service.id ? '✓' : ''}</div>
              </ServiceCard>
            ))}

            <SectionLabel>Choose Date & Time</SectionLabel>

            <FormGroup>
              <label>Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                min={today}
              />
            </FormGroup>

            <FormGroup>
              <label>Preferred Time</label>
              <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
                <option value="">Select a time slot</option>
                {TIME_SLOTS.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup>
              <label>Number of Guests</label>
              {selectedService === 'PRIVATE_EVENTS' ? (
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={guests}
                  onChange={e => setGuests(e.target.value)}
                  placeholder="Expected guest count"
                  style={{ width: '100%', padding: '18px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', borderRadius: '16px', fontSize: '14px', outline: 'none' }}
                />
              ) : (
                <select value={guests} onChange={e => setGuests(e.target.value)}>
                  {Array.from({ length: selectedService === 'VIP_SCREENING' ? 12 : 6 }).map((_, i) => (
                    <option key={i+1} value={String(i+1)} style={{ background: '#111' }}>{i+1} {i === 0 ? 'Guest' : 'Guests'}</option>
                  ))}
                </select>
              )}
            </FormGroup>

            <FormGroup>
              <label>
                {selectedService === 'VIP_SCREENING' ? 'Movie Choice & Butler Preferences' : (selectedService === 'PRIVATE_EVENTS' ? 'Venue Preference (Ballroom, Yacht, Helipad) & AV Details' : 'Special Requests (Optional)')}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={selectedService === 'VIP_SCREENING' ? 'e.g. Onyx Room, choice of movie, catering preferences...' : (selectedService === 'PRIVATE_EVENTS' ? 'e.g. Grand Ballroom, Yacht Cruise, catering and decor requirements...' : 'e.g. Couples spa, specific trainer preference...')}
              />
            </FormGroup>

            <SubmitBtn
              $disabled={!selectedDate || !selectedTime || submitting}
              disabled={!selectedDate || !selectedTime || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting...' : 'Confirm Reservation'}
            </SubmitBtn>
          </>
        )}
      </ContentArea>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { background: #030303; margin: 0; }
      `}</style>
    </PageShell>
  );
}
