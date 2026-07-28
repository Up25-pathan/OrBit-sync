'use client';

import React from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function TermsPage() {
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
            Legal Framework
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '15px 0 10px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
            Terms of Service
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
              1. Acceptance of Terms
            </h3>
            <p>
              By installing the OrBit synchronizer daemon, invoking CLI connection scripts, or integrating editor plugin extensions, you agree to comply with and be bound by these Terms of Service. If you do not accept these terms in full, do not load or execute the daemon modules.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              2. Service Scope & local-first Sync Loops
            </h3>
            <p>
              OrBit provides high-performance local-first workspace synchronization. Data syncing runs client-side between paired endpoints using peer-to-peer networks. You acknowledge that synchronization performance, sub-millisecond latencies, and validation metrics depend directly on host machine performance, network latency, and custom CRDT configurations.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              3. System Allocations & Beta Releases
            </h3>
            <p>
              The OrBit daemon, Tauri desktop GUI, and editor plugins are active pre-releases. You understand that beta software contains performance variables, and it is your responsibility to execute back-ups of directory data before scheduling file indexing loops or syncing tasks.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              4. Code Licenses & Daemon Ownership
            </h3>
            <p>
              All proprietary binary files, trademarked naming scopes, compiled Tauri frames, and server networks are protected. Re-distributing compiled binaries or utilizing OrBit brand signatures for standalone cloud syncing services is strictly prohibited without prior written alignment.
            </p>
          </div>

          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              5. Governing Law & Dispute Resolution
            </h3>
            <p>
              These terms are governed by federal digital safety specifications. Disputes arising from daemon crashes, telemetry loops, or sync anomalies shall be solved via interactive alignment first, prior to legal escalation.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
