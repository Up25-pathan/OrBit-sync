'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    scale: '< 10 nodes',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
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

      <div style={{ width: '100%', maxWidth: '700px', position: 'relative', zIndex: 5 }}>
        
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
            OMR Enterprises Sales
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '15px 0 10px 0', letterSpacing: '-1.5px', fontFamily: 'var(--font-orbitron)' }}>
            Contact <span style={{ color: 'var(--accent-red)' }}>Sales</span>
          </h1>
          <p style={{ color: '#a0a0a5', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Inquire about enterprise workspace pairing licensing, cluster sizes, or dedicated WAN relay configurations.
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            background: 'rgba(10, 8, 8, 0.7)',
            border: '1px solid rgba(255, 0, 60, 0.12)',
            borderRadius: '16px',
            padding: '40px 30px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
            color: '#a0a0a5'
          }}
        >
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✉️</div>
              <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-orbitron)', marginBottom: '10px' }}>
                Inquiry Transmitted
              </h3>
              <p style={{ color: '#808085', maxWidth: '400px', margin: '0 auto 25px auto', fontSize: '0.9rem' }}>
                Our systems engineering group at OMR Enterprises will review your sync loop requirements and align back shortly.
              </p>
              <button 
                onClick={() => setSubmitted(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 0, 60, 0.3)',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: '30px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,0,60,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {/* Name */}
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name..."
                    style={{ background: '#0a0808', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                {/* Email */}
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Developer Email</label>
                  <input 
                    type="email" 
                    required 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.com"
                    style={{ background: '#0a0808', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {/* Company */}
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Company</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Enter company..."
                    style={{ background: '#0a0808', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                {/* Scale */}
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Sync Network Scale</label>
                  <select 
                    value={formData.scale}
                    onChange={(e) => setFormData({ ...formData, scale: e.target.value })}
                    style={{ background: '#0a0808', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="< 10 nodes">&lt; 10 active peers</option>
                    <option value="10-100 nodes">10 to 100 cluster nodes</option>
                    <option value="100+ nodes">100+ WAN distributed peers</option>
                  </select>
                </div>
              </div>

              {/* Message */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Sync Requirements / Notes</label>
                <textarea 
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Outline your cluster load, database size, and security constraints..."
                  style={{ background: '#0a0808', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                style={{
                  background: 'var(--accent-red)',
                  border: 'none',
                  color: '#fff',
                  padding: '14px 24px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontFamily: 'monospace',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 15px rgba(255, 0, 60, 0.25)',
                  marginTop: '10px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e60036';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 0, 60, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-red)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 0, 60, 0.25)';
                }}
              >
                TRANSMIT INQUIRY
              </button>

            </form>
          )}
        </div>

      </div>
    </main>
  );
}
