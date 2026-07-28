'use client';

import React from 'react';
import TiltCard from '../effects/TiltCard';

const FEATURE_LIST = [
  {
    title: 'Rust Watcher Daemon',
    description: 'An ultra-lightweight background process that tracks filesystem edits using kernel events (inotify/FSEvents). Zero CPU spikes.',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'Tauri & Editor Clients',
    description: 'Beautiful native dashboard for config adjustments alongside a seamless VS Code extension. Setup in under 30 seconds.',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    title: 'Offline-First Sync Core',
    description: 'Built-in Conflict-free Replicated Data Types (CRDTs) to sync workspaces peer-to-peer without server roundtrips.',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section
      id="features"
      style={{
        padding: '100px 8%',
        background: '#030303',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '15px' }}>
            Built for <span style={{ color: 'var(--accent-red)' }}>Speed & Control</span>
          </h2>
          <p style={{ color: '#a0a0a5', maxWidth: '600px', margin: '0 auto', fontSize: '1.05rem' }}>
            No heavy cloud servers. OrBit relies on lightweight client engines and state replication to align your codebases.
          </p>
        </div>

        {/* Feature Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px',
          }}
        >
          {FEATURE_LIST.map((feat, index) => (
            <TiltCard
              key={index}
              style={{
                padding: '40px 30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
                overflow: 'hidden',
                height: '100%',
              }}
            >
              {/* Icon Holder */}
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '10px',
                  background: 'var(--accent-red-dim)',
                  color: 'var(--accent-red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(255, 0, 60, 0.1)',
                  transform: 'translateZ(30px)',
                }}
              >
                {feat.icon}
              </div>

              {/* Texts */}
              <div style={{ transform: 'translateZ(20px)' }}>
                <h3 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700, marginBottom: '10px' }}>
                  {feat.title}
                </h3>
                <p style={{ color: '#808085', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {feat.description}
                </p>
              </div>

              {/* Corner Accent Glow */}
              <div
                style={{
                  position: 'absolute',
                  top: '-50px',
                  right: '-50px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255, 0, 60, 0.05) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
            </TiltCard>
          ))}
        </div>

      </div>
    </section>
  );
}
