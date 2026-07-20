// web/app/dashboard/reservations/layout.tsx
'use client';
import React from 'react';

export default function ReservationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section style={{ 
      width: '100%', 
      height: '100%', 
      animation: 'fadeIn 0.8s ease-out' 
    }}>
      {/* LOCAL ZONE STYLE INJECTION */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
      
      {/* The Reservation Content */}
      {children}
    </section>
  );
}
