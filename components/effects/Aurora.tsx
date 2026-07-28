'use client';

import React from 'react';

export default function Aurora() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: '#030303',
      }}
    >
      {/* Red grid background */}
      <div className="grid-overlay" />

      {/* Floating blurred glowing blobs */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '15%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 0, 60, 0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'float 12s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '10%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(229, 9, 20, 0.08) 0%, transparent 75%)',
          filter: 'blur(100px)',
          animation: 'float 18s ease-in-out infinite alternate',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '60%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 0, 60, 0.05) 0%, transparent 80%)',
          filter: 'blur(120px)',
        }}
      />
    </div>
  );
}
