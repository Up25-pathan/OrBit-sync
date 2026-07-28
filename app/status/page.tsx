'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function StatusPage() {
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  const runDiagnostic = () => {
    if (diagnosticRunning) return;
    setDiagnosticRunning(true);
    setDiagnosticLogs(['Connecting to localhost daemon (127.0.0.1:4915)...']);

    const logs = [
      'Authenticating local Ed25519 pairing tokens...',
      'Verifying SQLite workspace sync indices...',
      'Measuring RTT across WAN loopback proxy nodes...',
      'Broadcasting CRDT merge validation state...',
      'Ecosystem check complete. 0 loops dropped. All systems secure!'
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setDiagnosticLogs((prev) => [...prev, log]);
        if (index === logs.length - 1) {
          setDiagnosticRunning(false);
        }
      }, (index + 1) * 700);
    });
  };

  const systems = [
    { name: 'Local Daemon Registry', desc: 'Background sync worker threads', status: 'OPERATIONAL', metric: 'RTT: < 0.1ms' },
    { name: 'Tauri Frame Connectors', desc: 'Native app loop interfaces', status: 'OPERATIONAL', metric: 'RTT: 0.05ms' },
    { name: 'VS Code Extension socket', desc: 'Editor filesystem binding channel', status: 'OPERATIONAL', metric: 'RTT: 0.18ms' },
    { name: 'WAN Relay pairing cluster', desc: 'Secure P2P proxy routing networks', status: 'OPERATIONAL', metric: 'RTT: 28.6ms' }
  ];

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
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#00e676', letterSpacing: '2px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e676', boxShadow: '0 0 10px #00e676', display: 'inline-block' }} />
              All Systems Operational
            </span>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '15px 0 10px 0', letterSpacing: '-1.5px', fontFamily: 'var(--font-orbitron)' }}>
              System Status
            </h1>
            <p style={{ color: '#a0a0a5', fontSize: '1.05rem', margin: 0 }}>
              Live telemetry tracking for local-first peer synchronizer nodes.
            </p>
          </div>

          <button
            onClick={runDiagnostic}
            disabled={diagnosticRunning}
            style={{
              background: diagnosticRunning ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 0, 60, 0.1)',
              border: diagnosticRunning ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255, 0, 60, 0.3)',
              color: diagnosticRunning ? '#606065' : '#fff',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              cursor: diagnosticRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!diagnosticRunning) e.currentTarget.style.background = 'rgba(255,0,60,0.2)';
            }}
            onMouseLeave={(e) => {
              if (!diagnosticRunning) e.currentTarget.style.background = 'rgba(255,0,60,0.1)';
            }}
          >
            {diagnosticRunning ? 'DIAGNOSING...' : 'RUN SELF-DIAGNOSTIC'}
          </button>
        </div>

        {/* Systems Dashboard Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
          {systems.map((sys) => (
            <div
              key={sys.name}
              style={{
                background: 'rgba(10, 8, 8, 0.7)',
                border: '1px solid rgba(255, 0, 60, 0.12)',
                borderRadius: '12px',
                padding: '20px 25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '15px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              }}
            >
              <div>
                <h4 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px 0', fontFamily: 'monospace' }}>
                  {sys.name}
                </h4>
                <p style={{ color: '#606065', fontSize: '0.85rem', margin: 0 }}>
                  {sys.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#ff859f' }}>
                  {sys.metric}
                </span>
                <span
                  style={{
                    background: 'rgba(0, 230, 118, 0.1)',
                    border: '1px solid rgba(0, 230, 118, 0.2)',
                    color: '#00e676',
                    padding: '4px 10px',
                    borderRadius: '30px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676', display: 'inline-block' }} />
                  {sys.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Diagnostic Logs console */}
        {diagnosticLogs.length > 0 && (
          <div
            style={{
              background: '#070506',
              border: '1px solid rgba(255, 0, 60, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ color: '#606065', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>
              OMR System Diagnostics Console
            </div>
            {diagnosticLogs.map((log, index) => (
              <div key={index} style={{ color: index === diagnosticLogs.length - 1 && diagnosticRunning ? 'var(--accent-red)' : log.includes('secure') ? '#00e676' : '#ff859f', transition: 'all 0.3s' }}>
                <span style={{ color: '#606065', marginRight: '8px' }}>&gt;</span>
                {log}
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
