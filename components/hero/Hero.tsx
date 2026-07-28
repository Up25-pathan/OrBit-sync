'use client';

import React, { useState } from 'react';
import OrbitBall from './OrbitBall';

export default function Hero() {
  const [copied, setCopied] = useState(false);
  const installCmd = 'curl -s https://orbit.dev/install.sh | sh';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      style={{
        position: 'relative',
        minHeight: 'calc(100vh - 70px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 8%',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      <div
        className="hero-grid"
        style={{
          width: '100%',
          maxWidth: '1200px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '60px',
          alignItems: 'center',
        }}
      >
        {/* Left Side: Headline & CTAs */}
        <div className="hero-left" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

          {/* Heading */}
          <h1
            className="hero-heading"
            style={{
              fontSize: '4rem',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-1.5px',
              color: '#fff',
            }}
          >
            Your workspace, <br />
            <span
              style={{
                background: 'linear-gradient(to right, #ff003c, #ff5e00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              perfectly aligned.
            </span>
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontSize: '1.15rem',
              color: '#a0a0a5',
              lineHeight: 1.6,
              maxWidth: '520px',
            }}
          >
            OrBit is a local-first development synchronizer. It hooks into a background Rust daemon, a Tauri desktop client, and your VS Code editor, keeping local workspaces connected with sub-millisecond latencies.
          </p>

          {/* Installation Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a0808',
              border: '1px solid rgba(255, 0, 60, 0.15)',
              borderRadius: '8px',
              padding: '12px 16px',
              maxWidth: '480px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: '#ff859f',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#ff3366', userSelect: 'none' }}>$</span>
              <span>{installCmd}</span>
            </div>
            <button
              onClick={copyToClipboard}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#00e676' : '#a0a0a5',
                cursor: 'pointer',
                fontSize: '0.85rem',
                marginLeft: '15px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
              }}
            >
              {copied ? 'Copied!' : (
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
            <a
              href="/download"
              className="glow-btn"
              style={{
                background: 'var(--accent-red)',
                border: 'none',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                padding: '14px 28px',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 4px 15px rgba(255, 0, 60, 0.3)',
              }}
            >
              Get OrBit Desktop
            </a>
            <a
              href="#architecture"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                padding: '14px 28px',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 0, 60, 0.4)';
                e.currentTarget.style.background = 'rgba(255, 0, 60, 0.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Explore Architecture
            </a>
          </div>
        </div>

        {/* Right Side: 3D OrbitBall Graphic */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <OrbitBall />
        </div>
      </div>
    </section>
  );
}
