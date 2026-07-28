'use client';

import React from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function PrivacyPage() {
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

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Data Transparency
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '15px 0 10px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
            Privacy Policy
          </h1>
          <p style={{ color: '#606065', fontSize: '0.9rem', fontFamily: 'monospace' }}>
            Last Updated: July 2026
          </p>
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
              1. Zero-Cloud Local-First Promise
            </h3>
            <p>
              Your source code, file structures, and credentials never touch our servers. OrBit is designed from the ground up as a local-first system. All conflict-free replicated data types (CRDTs) and local filesystem sync updates are stored and validated directly on your host machines.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              2. Analytical & Performance Telemetry
            </h3>
            <p>
              To improve sync loops and diagnose daemon memory footprints, OrBit collects limited performance telemetry. This includes client round-trip times (RTT), platform operating systems, daemon connection states, and exception crash reports. No file names, source code text, paths, or content payloads are ever captured or transmitted.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              3. Telemetry Opt-Out
            </h3>
            <p>
              We fully respect your workspace privacy. You can completely opt-out of all performance metrics, analytics, and heartbeat tracking by adding an environment variable to your terminal configuration or using the switches inside the Tauri UI settings. Review our Telemetry Opt-Out guide for explicit CLI switches.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              4. P2P Cryptographic Identifiers
            </h3>
            <p>
              During mesh pairing validation, cryptographic public keys are exchanged to build local-loop handshakes. These identifiers remain on your local machines and are never centralized.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
