'use client';

import React from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function AboutPage() {
  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        overflow: 'hidden',
        padding: '140px 8% 100px 8%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Aurora />
      <CursorGlow />

      <div style={{ width: '100%', maxWidth: '800px', position: 'relative', zIndex: 5 }}>
        
        {/* Back Link */}
        <Link 
          href="/" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: '#808085', 
            textDecoration: 'none', 
            fontSize: '0.85rem', 
            marginBottom: '30px',
            fontFamily: 'monospace',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#808085'}
        >
          <span>←</span> Back to home
        </Link>

        {/* Header containing OMR Logo and Name */}
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '25px', flexWrap: 'wrap' }}>
          <img 
            src="/omr.jpeg" 
            alt="OMR Enterprises Logo" 
            style={{ 
              width: '90px', 
              height: '90px', 
              objectFit: 'cover', 
              borderRadius: '12px',
              border: '2px solid rgba(255, 0, 60, 0.4)',
              boxShadow: '0 0 20px rgba(255, 0, 60, 0.25)'
            }} 
          />
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Creator Profile
            </span>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '10px 0 5px 0', letterSpacing: '-1.5px', fontFamily: 'var(--font-orbitron)' }}>
              OMR Enterprises
            </h1>
            <p style={{ color: '#a0a0a5', fontSize: '1.1rem', margin: 0 }}>
              The developer house behind OrBit.
            </p>
          </div>
        </div>

        {/* Content Card */}
        <div
          style={{
            background: 'rgba(10, 8, 8, 0.7)',
            border: '1px solid rgba(255, 0, 60, 0.12)',
            borderRadius: '16px',
            padding: '40px 30px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '30px',
            color: '#a0a0a5',
            lineHeight: 1.6,
            fontSize: '0.95rem'
          }}
        >
          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              Who is OMR Enterprises?
            </h3>
            <p>
              OMR Enterprises is a high-performance developer tools group specialized in localized, high-speed, and secure synchronizers. We believe the future of modern developer operations is local-first, peer-to-peer, and zero-latency.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              Developing OrBit
            </h3>
            <p>
              OrBit is OMR Enterprises' flagship workspace sync engine. Built on a foundation of low-footprint Rust daemons and hardware-accelerated Tauri desktop frames, it keeps local code directories synchronized at sub-millisecond rates without exposing proprietary assets to central cloud relays.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              Our Ecosystem
            </h3>
            <p>
              In addition to OrBit, OMR Enterprises designs advanced local networking protocols, local-first database wrappers, and conflict-free replication systems. We enable developer teams to keep their workspaces, configs, and plugins in perfect alignment across every host screen.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
