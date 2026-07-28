'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function TelemetryPage() {
  const [copiedVar, setCopiedVar] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            System Settings
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '15px 0 10px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
            Telemetry Opt-Out
          </h1>
          <p style={{ color: '#a0a0a5', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Disable heartbeat tracking, round-trip checks, and crash reports. Learn how to configure your OrBit daemon to run in absolute silent mode.
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
            gap: '35px',
            color: '#a0a0a5',
            lineHeight: 1.6,
            fontSize: '0.95rem'
          }}
        >
          {/* Method 1 */}
          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              Method 1: Global Environment Variable
            </h3>
            <p style={{ marginBottom: '15px' }}>
              Set the standard environment variable globally in your terminal shell (`.bashrc`, `.zshrc`, or Windows Environment Settings). The Rust daemon automatically checks this state before initiating websocket telemetry threads.
            </p>
            <div
              style={{
                background: '#0d0a0b',
                border: '1px solid rgba(255, 0, 60, 0.15)',
                borderRadius: '8px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'monospace',
                fontSize: '0.85rem'
              }}
            >
              <code style={{ color: 'var(--accent-red)' }}>ORBIT_TELEMETRY_DISABLED=1</code>
              <button
                onClick={() => copyText('ORBIT_TELEMETRY_DISABLED=1', setCopiedVar)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: copiedVar ? '#00e676' : '#808085',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace'
                }}
              >
                {copiedVar ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Method 2 */}
          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              Method 2: Daemon Config JSON
            </h3>
            <p style={{ marginBottom: '15px' }}>
              Alternatively, modify your local JSON config located at `~/.config/orbit/config.json` (or `%APPDATA%\orbit\config.json` on Windows):
            </p>
            <div
              style={{
                background: '#0d0a0b',
                border: '1px solid rgba(255, 0, 60, 0.15)',
                borderRadius: '8px',
                padding: '16px 18px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                position: 'relative'
              }}
            >
              <pre style={{ margin: 0, color: '#ff859f' }}>{`{
  "sync": {
    "local_loopback_only": true
  },
  "telemetry": {
    "enabled": false
  }
}`}</pre>
              <button
                onClick={() => copyText(`{\n  "sync": {\n    "local_loopback_only": true\n  },\n  "telemetry": {\n    "enabled": false\n  }\n}`, setCopiedJson)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '18px',
                  background: 'transparent',
                  border: 'none',
                  color: copiedJson ? '#00e676' : '#808085',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace'
                }}
              >
                {copiedJson ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Method 3 */}
          <div>
            <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px', fontFamily: 'var(--font-orbitron)' }}>
              Method 3: Tauri Desktop GUI & VS Code Settings
            </h3>
            <p>
              In the Tauri native app, toggle the <strong>Telemetry</strong> switch under settings. In VS Code, search settings for <code>orbit.telemetry.enabled</code> and check the box to <code>false</code>. All settings dynamically bind to prevent analytic transmissions.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
