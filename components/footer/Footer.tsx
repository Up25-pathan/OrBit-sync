'use client';

import React from 'react';

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect x="2" y="9" width="4" height="12"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

export default function Footer() {
  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = '#fff';
    e.currentTarget.style.transform = 'translateX(2px)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = '#808085';
    e.currentTarget.style.transform = 'translateX(0)';
  };

  return (
    <footer
      style={{
        padding: '60px 8% 40px 8%',
        background: '#020202',
        borderTop: '1px solid rgba(255, 0, 60, 0.05)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {/* Main Footer Directory Grid */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '40px',
          paddingBottom: '50px',
        }}
      >
        {/* Column 1: Brand Block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="OrBit Logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-orbitron)', letterSpacing: '1px' }}>OrBit</span>
          </div>
          <p style={{ color: '#606065', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
            High-performance local-first workspace synchronization engine. Built for sub-millisecond editor sync loops.
          </p>

          <a
            href="/download"
            className="glow-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--accent-red)',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 800,
              textDecoration: 'none',
              fontFamily: 'var(--font-orbitron)',
              width: 'fit-content',
              marginTop: '5px',
              boxShadow: '0 0 15px rgba(255,0,60,0.3)',
            }}
          >
            <span>🚀 Download Desktop Client</span>
          </a>
        </div>

        {/* Column 2: Documentation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h5 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-orbitron)', letterSpacing: '0.5px' }}>
            Documentation
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <a href="/docs" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Getting Started Guide</a>
            <a href="/docs" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Local-First P2P Sync</a>
            <a href="/docs" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Shadow Git Architecture</a>
            <a href="/docs" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>3-Way Conflict Resolver</a>
            <a href="/download" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Desktop Releases</a>
          </div>
        </div>

        {/* Column 3: Company */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h5 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-orbitron)', letterSpacing: '0.5px' }}>
            Company
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <a href="/about" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>About Us</a>
            <a href="/contact" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Contact Sales</a>
            <a href="/status" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>System Status</a>
          </div>
        </div>

        {/* Column 4: Legal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h5 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-orbitron)', letterSpacing: '0.5px' }}>
            Legal
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <a href="/terms" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Terms of Service</a>
            <a href="/privacy" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Privacy Policy</a>
            <a href="/security" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>Security Trust Center</a>
          </div>
        </div>

        {/* Column 5 (LAST): Social Channels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h5 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-orbitron)', letterSpacing: '0.5px' }}>
            Social Channels
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <a href="https://www.instagram.com/orbit_sync.dev?igsh=MW80d3I1ZDUyYmVveQ==" target="_blank" rel="noreferrer" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <InstagramIcon /> Instagram
            </a>
            <a href="https://www.linkedin.com/showcase/orbit-sync/" target="_blank" rel="noreferrer" style={{ color: '#808085', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <LinkedInIcon /> LinkedIn
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Row */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: '25px',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          fontSize: '0.75rem',
          color: '#505055',
          fontFamily: 'monospace',
        }}
      >
        <span>© {new Date().getFullYear()} OrBit Sync. All rights reserved.</span>
        <span>Crafted for high performance local-first development.</span>
      </div>
    </footer>
  );
}
