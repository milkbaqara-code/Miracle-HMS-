'use client';
import React, { useEffect, useState } from 'react';

export default function NeonGridPulses() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Generate random pulses for matrix-like dot flow
  const xPulses = Array.from({ length: 120 }).map((_, i) => ({
    id: `x-${i}`,
    top: `${Math.floor(Math.random() * 100)}vh`,
    animationDelay: `${Math.random() * 5}s`,
    animationDuration: `${3 + Math.random() * 7}s`,
    direction: i % 2 === 0 ? 'normal' : 'reverse'
  }));

  const yPulses = Array.from({ length: 120 }).map((_, i) => ({
    id: `y-${i}`,
    left: `${Math.floor(Math.random() * 100)}vw`,
    animationDelay: `${Math.random() * 5}s`,
    animationDuration: `${4 + Math.random() * 8}s`,
    direction: i % 2 === 0 ? 'normal' : 'reverse'
  }));

  return (
    <>
      <div className="sovereign-data-grid" />
      {xPulses.map((pulse) => (
        <div 
          key={pulse.id} 
          className="data-pulse-x" 
          style={{ 
            top: pulse.top, 
            animationDelay: pulse.animationDelay, 
            animationDuration: pulse.animationDuration,
            animationDirection: pulse.direction as any
          }} 
        />
      ))}
      {yPulses.map((pulse) => (
        <div 
          key={pulse.id} 
          className="data-pulse-y" 
          style={{ 
            left: pulse.left, 
            animationDelay: pulse.animationDelay, 
            animationDuration: pulse.animationDuration,
            animationDirection: pulse.direction as any
          }} 
        />
      ))}
    </>
  );
}
