'use client';

import React, { useState } from 'react';
import TiltCard from '../effects/TiltCard';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    // Simulate peer pairing / registration delay
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1200);
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '60px' }}>
      <TiltCard
        style={{
          width: '100%',
          maxWidth: '800px',
          background: 'radial-gradient(circle at 10% 10%, rgba(255, 0, 60, 0.08) 0%, rgba(10, 8, 8, 0.85) 60%)',
          border: '1.5px solid rgba(255, 0, 60, 0.25)',
          borderRadius: '16px',
          padding: '40px 50px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(255, 0, 60, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {!isSubmitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', transform: 'translateZ(20px)', width: '100%' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 900,
                color: 'var(--accent-red)',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}
            >
              Beta Enrollment
            </span>
            
            <h3
              style={{
                fontSize: '1.8rem',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.5px',
                fontFamily: 'var(--font-orbitron)',
              }}
            >
              Join the OrBit Sync Grid
            </h3>
            
            <p
              style={{
                fontSize: '0.95rem',
                color: '#a0a0a5',
                maxWidth: '520px',
                lineHeight: 1.5,
              }}
            >
              Sign up for private beta access to WAN network pairing servers and cross-platform native client releases.
            </p>

            {/* Input Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                gap: '12px',
                width: '100%',
                maxWidth: '480px',
                marginTop: '10px',
              }}
            >
              <input
                type="email"
                required
                placeholder="Enter developer email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0d0a0b',
                  border: '1px solid rgba(255, 0, 60, 0.2)',
                  borderRadius: '8px',
                  padding: '12px 18px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-space-grotesk)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-red)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 0, 60, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 60, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="glow-btn"
                style={{
                  background: 'var(--accent-red)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0 24px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {isSubmitting ? 'Pairing...' : 'Request Node'}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', transform: 'translateZ(20px)' }}>
            {/* Success icon checkmark */}
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'rgba(0, 230, 118, 0.1)',
                border: '2px solid #00e676',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00e676',
                fontSize: '1.25rem',
                boxShadow: '0 0 20px rgba(0, 230, 118, 0.2)',
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              ✓
            </div>

            <h3
              style={{
                fontSize: '1.6rem',
                fontWeight: 900,
                color: '#fff',
                fontFamily: 'var(--font-orbitron)',
              }}
            >
              Node Synced Successfully!
            </h3>

            <p style={{ fontSize: '0.95rem', color: '#a0a0a5', maxWidth: '420px', lineHeight: 1.5 }}>
              Your developer pairing token has been allocated. Keep watch on <span style={{ color: '#fff', fontFamily: 'monospace' }}>{email}</span> for setup links.
            </p>
          </div>
        )}
      </TiltCard>
    </div>
  );
}
