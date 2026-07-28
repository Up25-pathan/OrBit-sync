'use client';

import React from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function SecurityPage() {
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
            System Integrity
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '15px 0 10px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
            Security & Trust Center
          </h1>
          <p style={{ color: '#a0a0a5', fontSize: '1.05rem', lineHeight: 1.6 }}>
            OrBit builds cryptographic trust gates around your local workspace synchronizers. Review our architecture parameters below.
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
              1. End-to-End Cryptographic Pairing
            </h3>
            <p>
              Pairing connection scripts exchange local Ed25519 public keys. All synced messages, CRDT operations, and folder validation hashes are signed client-side, making spoofing or unauthorized daemon loops impossible.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              2. Zero-Knowledge Relay Loops
            </h3>
            <p>
              When clients operate across WAN networks, packages pass through secure proxy relays. Because payloads are encrypted using keys stored strictly on your local endpoints (never on the relay), relay nodes have zero knowledge of folder schemas or files.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              3. Port Security & Loopback Defaults
            </h3>
            <p>
              The background Rust daemon binds natively to <code>localhost</code>. By default, it ignores external network requests, preventing port-scanning or unauthorized network loops. Multi-peer pairing must be explicitly enabled and authenticated.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              4. Sandboxed Code Audits
            </h3>
            <p>
              Editor plugins and compiled Tauri binaries undergo strict static analyses before shipping. We ensure no external scripts or unverified third-party libraries run inside the core workspace indexer loops.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
