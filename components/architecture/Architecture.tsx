'use client';

import React, { useState } from 'react';

export default function Architecture() {
  const [activeLayer, setActiveLayer] = useState<number | null>(null);

  const layers = [
    {
      id: 1,
      title: 'VS Code Extension / CLI',
      desc: 'Hooks into editor save/edit events, piping changes directly into the sync buffer.',
      zOffset: '60px',
      color: '#ff3366',
    },
    {
      id: 2,
      title: 'Tauri Desktop GUI',
      desc: 'Beautiful native control panel showing sync health, latency logs, and peer pairing.',
      zOffset: '0px',
      color: '#ff003c',
    },
    {
      id: 3,
      title: 'Rust Local Daemon',
      desc: 'Zero-overhead filesystem watcher, local SQLite database, and cryptographic synchronization server.',
      zOffset: '-60px',
      color: '#990022',
    },
  ];

  return (
    <section
      id="architecture"
      style={{
        padding: '100px 8%',
        background: '#050505',
        borderTop: '1px solid rgba(255, 0, 60, 0.05)',
        borderBottom: '1px solid rgba(255, 0, 60, 0.05)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div className="architecture-grid" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '80px', alignItems: 'center' }}>
        
        {/* Text Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
            Multi-Layered <br />
            <span style={{ color: 'var(--accent-red)' }}>Sync Architecture</span>
          </h2>
          <p style={{ color: '#a0a0a5', lineHeight: 1.6, fontSize: '1.05rem' }}>
            OrBit splits duties across three specialized layers to ensure maximum reliability, speed, and CPU friendliness.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
            {layers.map((layer) => (
              <div
                key={layer.id}
                onMouseEnter={() => setActiveLayer(layer.id)}
                onMouseLeave={() => setActiveLayer(null)}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: activeLayer === layer.id ? 'rgba(255, 0, 60, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                  borderLeft: `3px solid ${activeLayer === layer.id ? layer.color : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '6px' }}>{layer.title}</h4>
                <p style={{ color: '#808085', fontSize: '0.9rem', lineHeight: 1.4 }}>{layer.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 3D Isometric Stack Visualizer */}
        <div
          style={{
            height: '500px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
          className="perspective-1000"
        >
          <div
            style={{
              position: 'relative',
              width: '320px',
              height: '240px',
              transform: 'rotateX(55deg) rotateZ(-45deg)',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s ease',
            }}
          >
            {/* Visualizing flying data pulses (Pulsing particles between layers) */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#ff003c',
                boxShadow: '0 0 10px #ff003c',
                transformStyle: 'preserve-3d',
                transform: 'translate3d(-50%, -50%, 0)',
                animation: 'float 2s infinite linear',
              }}
            />

            {/* Render stack layers */}
            {layers.map((layer) => {
              const isActive = activeLayer === layer.id;
              return (
                <div
                  key={layer.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: isActive ? 'rgba(255, 0, 60, 0.12)' : 'rgba(10, 8, 8, 0.85)',
                    border: `1px solid ${isActive ? layer.color : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '16px',
                    boxShadow: isActive 
                      ? `0 20px 40px rgba(255, 0, 60, 0.15), 0 0 20px ${layer.color}`
                      : '0 15px 30px rgba(0, 0, 0, 0.5)',
                    transform: `translateZ(${isActive ? `calc(${layer.zOffset} + 20px)` : layer.zOffset})`,
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '24px',
                    transformStyle: 'preserve-3d',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setActiveLayer(layer.id)}
                  onMouseLeave={() => setActiveLayer(null)}
                >
                  {/* Layer title & subtitle */}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: layer.color,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Layer 0{layer.id}
                  </span>
                  <h3 style={{ color: '#fff', fontSize: '1.25rem', margin: '6px 0 10px 0' }}>
                    {layer.title.split(' / ')[0]}
                  </h3>
                  <div
                    style={{
                      width: '40px',
                      height: '2px',
                      background: layer.color,
                      borderRadius: '1px',
                    }}
                  />
                  
                  {/* Subtle Grid Pattern Inside Layer */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      width: '60px',
                      height: '60px',
                      backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)',
                      backgroundSize: '10px 10px',
                      opacity: 0.5,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
