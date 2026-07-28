'use client';

import React, { useState } from 'react';
import TiltCard from '../effects/TiltCard';

interface ClientPeer {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  orbitRadius: number;
  speed: number;
}

export default function OrbitalPairingSandbox() {
  const [activePeers, setActivePeers] = useState<string[]>(['vscode', 'tauri']);

  const PEER_TEMPLATES: Record<string, ClientPeer> = {
    vscode: {
      id: 'vscode',
      name: 'VS Code Extension',
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      color: '#ff3366',
      orbitRadius: 110,
      speed: 6,
    },
    tauri: {
      id: 'tauri',
      name: 'Tauri Native App',
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      color: '#ff003c',
      orbitRadius: 160,
      speed: 10,
    },
    cli: {
      id: 'cli',
      name: 'CLI Sync Tool',
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
      color: '#ff859f',
      orbitRadius: 210,
      speed: 14,
    },
    mobile: {
      id: 'mobile',
      name: 'Mobile Client (iOS/Android)',
      icon: (
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
        </svg>
      ),
      color: '#ffffff',
      orbitRadius: 260,
      speed: 18,
    },
  };

  const togglePeer = (id: string) => {
    if (activePeers.includes(id)) {
      // Keep at least one peer
      if (activePeers.length === 1) return;
      setActivePeers((prev) => prev.filter((p) => p !== id));
    } else {
      setActivePeers((prev) => [...prev, id]);
    }
  };

  return (
    <section
      id="benchmarks"
      style={{
        padding: '100px 8%',
        background: '#040404',
        borderTop: '1px solid rgba(255, 0, 60, 0.05)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div
        className="sandbox-grid"
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '70px',
          alignItems: 'center',
        }}
      >
        {/* Left column: Text details and selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
            Multi-Peer <br />
            <span style={{ color: 'var(--accent-red)' }}>Mesh Pairing</span>
          </h2>
          
          <p style={{ color: '#a0a0a5', lineHeight: 1.6, fontSize: '1.05rem' }}>
            OrBit is not limited to standard server syncing. You can bind local CLI modules, editor packages, and native UI panels into a single distributed network cluster.
          </p>

          {/* Toggle buttons - 2x2 futuristic cockpit grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' }}>
            {Object.values(PEER_TEMPLATES).map((peer) => {
              const isActive = activePeers.includes(peer.id);
              
              // Latency metric readouts for flavor
              const metricsMap: Record<string, string> = {
                vscode: 'RTT: 0.18ms • Extension Link',
                tauri: 'RTT: 0.05ms • Desktop Host',
                cli: 'RTT: 0.42ms • Local Daemon',
                mobile: 'RTT: 28.6ms • WAN Relay Node',
              };

              return (
                <div
                  key={peer.id}
                  onClick={() => togglePeer(peer.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px',
                    borderRadius: '12px',
                    background: isActive ? 'rgba(255, 0, 60, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                    border: `1px solid ${isActive ? 'rgba(255, 0, 60, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                    boxShadow: isActive ? '0 0 15px rgba(255, 0, 60, 0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    transformStyle: 'preserve-3d',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    if (!isActive) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    if (!isActive) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  {/* Glowing background grid trace */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent, var(--accent-red), transparent)',
                      }}
                    />
                  )}

                  {/* Icon & Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: isActive ? 'rgba(255, 0, 60, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? 'var(--accent-red)' : '#808085',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        border: `1.5px solid ${isActive ? 'rgba(255, 0, 60, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                      }}
                    >
                      {peer.icon}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', margin: 0 }}>{peer.name.split(' (')[0]}</h4>
                      <span style={{ fontSize: '0.65rem', color: '#606065', fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                        {metricsMap[peer.id]}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch Handle & Connection State */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    {/* Status Indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isActive ? 'var(--accent-red)' : '#404045',
                          boxShadow: isActive ? '0 0 8px var(--accent-red)' : 'none',
                          animation: isActive ? 'pulse-red 1.5s infinite' : 'none',
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isActive ? '#fff' : '#606065', letterSpacing: '0.5px' }}>
                        {isActive ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </div>

                    {/* Cyber Switch Slider Toggle */}
                    <div
                      style={{
                        width: '30px',
                        height: '16px',
                        borderRadius: '10px',
                        background: isActive ? 'var(--accent-red)' : '#1a1a1c',
                        border: `1.5px solid ${isActive ? 'var(--accent-red)' : 'rgba(255,255,255,0.06)'}`,
                        position: 'relative',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: '1.5px',
                          left: isActive ? '14.5px' : '2px',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: 3D Pairing mesh grid */}
        <TiltCard
          style={{
            height: '420px',
            padding: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
        >
          <div
            className="sandbox-canvas-wrapper"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Center Core Daemon Node with Logo */}
            <div
              style={{
                position: 'absolute',
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                background: '#0d0a0b',
                border: '1.5px solid var(--accent-red)',
                boxShadow: '0 0 30px rgba(255, 0, 60, 0.7)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transformStyle: 'preserve-3d',
                padding: '8px',
              }}
            >
              <img
                src="/logo.png"
                alt="OrBit Core"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Active/Inactive Orbit lines and Peers */}
            {Object.values(PEER_TEMPLATES).map((peer) => {
              const isActive = activePeers.includes(peer.id);
              
              const metricsMap: Record<string, string> = {
                vscode: 'RTT: 0.18ms',
                tauri: 'RTT: 0.05ms',
                cli: 'RTT: 0.42ms',
                mobile: 'RTT: 28.6ms',
              };

              return (
                <div
                  key={peer.id}
                  style={{
                    position: 'absolute',
                    width: `${peer.orbitRadius * 2}px`,
                    height: `${peer.orbitRadius * 2}px`,
                    borderRadius: '50%',
                    border: `1.2px solid ${isActive ? 'rgba(255, 0, 60, 0.18)' : 'rgba(255, 255, 255, 0.02)'}`,
                    transformStyle: 'preserve-3d',
                    transform: 'rotateX(50deg) rotateY(10deg)',
                    pointerEvents: 'none',
                    transition: 'all 0.5s ease',
                  }}
                >
                  {/* Revolving Handle */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      animation: `spin-slow ${peer.speed}s linear infinite`,
                      animationPlayState: isActive ? 'running' : 'paused',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {/* Connect pulse line */}
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          width: '1px',
                          height: `${peer.orbitRadius}px`,
                          background: `linear-gradient(to top, ${peer.color}, transparent)`,
                          transform: 'translateX(-50%) translateY(-100%)',
                          opacity: 0.35,
                        }}
                      />
                    )}

                    {/* Node Positioner at the top edge of circle */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      {/* Counter-Spin and Counter-Tilt node to keep it standing upright */}
                      <div
                        style={{
                          animation: `spin-reverse-slow ${peer.speed}s linear infinite`,
                          animationPlayState: isActive ? 'running' : 'paused',
                          transformStyle: 'preserve-3d',
                          transform: 'rotateY(-10deg) rotateX(-50deg)',
                          transition: 'all 0.5s ease',
                          opacity: isActive ? 1 : 0.25,
                        }}
                      >
                        {/* Node Bubble */}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#0d0a0b',
                            border: `1.5px solid ${isActive ? peer.color : 'rgba(255,255,255,0.1)'}`,
                            boxShadow: isActive ? `0 0 15px ${peer.color}` : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            position: 'relative',
                          }}
                        >
                          {peer.icon}

                          {/* Floating HUD Label */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '42px',
                              top: '-6px',
                              width: '140px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(10, 8, 8, 0.85)',
                              border: `1.5px solid ${isActive ? 'rgba(255, 0, 60, 0.25)' : 'rgba(255,255,255,0.06)'}`,
                              boxShadow: isActive ? '0 4px 15px rgba(0,0,0,0.5), 0 0 10px rgba(255,0,60,0.05)' : 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              pointerEvents: 'none',
                              zIndex: 100,
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                              {peer.name.split(' (')[0]}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: isActive ? 'var(--accent-red)' : '#606065', fontFamily: 'monospace', fontWeight: 600 }}>
                              {isActive ? `${metricsMap[peer.id]} • ACTIVE` : 'OFFLINE'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}


          </div>
        </TiltCard>

      </div>
    </section>
  );
}
