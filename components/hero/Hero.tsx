'use client';

import React from 'react';
import OrbitBall from './OrbitBall';

export default function Hero() {
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
