'use client';

import React, { useState, useEffect } from 'react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    const handleResize = () => {
      const mobileState = window.innerWidth < 768;
      setIsMobile(mobileState);
      if (!mobileState) {
        setMobileMenuOpen(false);
      }
    };

    const checkAuth = () => {
      const user = localStorage.getItem('orbit_user');
      setIsLoggedIn(!!user);
    };

    handleScroll();
    handleResize();
    checkAuth();

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    window.addEventListener('storage', checkAuth);

    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  const navLinks = [
    { name: 'Features', href: '/#features', id: 'features' },
    { name: 'Architecture', href: '/#architecture', id: 'architecture' },
    { name: 'Playground', href: '/#terminal', id: 'playground' },
    { name: 'Sandbox', href: '/#benchmarks', id: 'sandbox' },
    { name: 'Docs', href: '/docs', id: 'docs' },
    { name: 'Pricing', href: '/pricing', id: 'pricing' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 100,
        pointerEvents: 'none',
        padding: '0 20px',
      }}
    >
      {/* Navbar Container */}
      <nav
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: isScrolled ? '15px' : '20px',
          width: '100%',
          maxWidth: isScrolled ? '850px' : '1200px',
          height: isScrolled ? '58px' : '68px',
          padding: isScrolled ? '0 25px' : '0 40px',
          background: isScrolled ? 'rgba(5, 5, 5, 0.85)' : 'rgba(8, 6, 6, 0.65)',
          backdropFilter: 'blur(16px)',
          borderRadius: '50px',
          border: isScrolled 
            ? '1.5px solid rgba(255, 0, 60, 0.3)' 
            : '1px solid rgba(255, 0, 60, 0.12)',
          boxShadow: isScrolled
            ? '0 20px 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 0, 60, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
            : '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transformStyle: 'preserve-3d',
          transform: 'perspective(1000px) rotateX(0deg)',
          position: 'relative',
        }}
      >
        {/* Brand Logo */}
        <a 
          href="/" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            textDecoration: 'none', 
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
            transform: 'translateZ(10px)',
          }}
        >
          <img
            src="/logo.png"
            alt="OrBit Logo"
            style={{
              width: '24px',
              height: '24px',
              objectFit: 'contain',
              borderRadius: '4px',
            }}
          />
          <span
            style={{
              fontSize: '1.2rem',
              fontWeight: 900,
              letterSpacing: '1.5px',
              color: '#fff',
              textShadow: '0 0 8px rgba(255, 0, 60, 0.4)',
              fontFamily: 'var(--font-orbitron)',
            }}
          >
            OrBit
          </span>
        </a>

        {/* Desktop Navigation Menu (hidden on mobile via CSS class in globals.css) */}
        <div
          className="nav-links-menu"
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            transformStyle: 'preserve-3d',
          }}
        >
          {navLinks.map((link) => {
            const isHovered = hoveredLink === link.id;
            return (
              <div
                key={link.id}
                style={{
                  perspective: '400px',
                  transformStyle: 'preserve-3d',
                }}
                onMouseEnter={() => setHoveredLink(link.id)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                <a
                  href={link.href}
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: isHovered ? 700 : 500,
                    color: isHovered ? '#fff' : '#a0a0a5',
                    padding: '8px 16px',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    transform: isHovered 
                      ? 'translateZ(12px) rotateX(8deg)' 
                      : 'translateZ(0px) rotateX(0deg)',
                    transformStyle: 'preserve-3d',
                    background: isHovered ? 'rgba(255, 0, 60, 0.12)' : 'transparent',
                    border: `1px solid ${isHovered ? 'rgba(255, 0, 60, 0.25)' : 'transparent'}`,
                    textShadow: isHovered ? '0 0 6px rgba(255, 0, 60, 0.5)' : 'none',
                  }}
                >
                  {link.name}
                </a>
              </div>
            );
          })}
        </div>

        {/* Right side controls: Hamburger & CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Floating Action Button */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              transformStyle: 'preserve-3d',
              transform: 'translateZ(10px)',
            }}
          >
            <a
              href={isLoggedIn ? "/console" : "/login"}
              className="glow-btn"
              style={{
                background: 'linear-gradient(135deg, #25090f 0%, #0c0304 100%)',
                border: '1.5px solid var(--accent-red)',
                color: '#fff',
                fontSize: '0.8rem',
                padding: isScrolled ? '6px 14px' : '8px 18px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 700,
                textShadow: '0 0 8px rgba(255, 0, 60, 0.4)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: 'var(--font-orbitron)',
              }}
            >
              {isLoggedIn ? "Console" : "Sign In"}
            </a>
          </div>

          {/* Mobile Hamburger menu toggle */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '50%',
                outline: 'none',
                transition: 'background 0.2s',
              }}
            >
              {mobileMenuOpen ? (
                // Close Icon (X)
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                // Hamburger Menu Icon
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Slide-Down Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            pointerEvents: 'auto',
            width: 'calc(100% - 40px)',
            maxWidth: '450px',
            marginTop: '10px',
            background: 'rgba(10, 8, 8, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(255, 0, 60, 0.25)',
            borderRadius: '20px',
            padding: '25px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(255,0,60,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            animation: 'float 0.4s ease-out', // slide/fade layout
            zIndex: 99,
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'block',
                color: '#a0a0a5',
                fontSize: '1rem',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid transparent',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-space-grotesk)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 0, 60, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 0, 60, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#a0a0a5';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
