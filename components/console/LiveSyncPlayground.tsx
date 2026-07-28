'use client';

import React, { useState, useEffect } from 'react';
import TiltCard from '../effects/TiltCard';

export default function LiveSyncPlayground() {
  // Grid is 6x6 (36 pixels) for optimal size
  const GRID_SIZE = 6;
  const [localGrid, setLocalGrid] = useState<boolean[]>(Array(GRID_SIZE * GRID_SIZE).fill(false));
  const [remoteGrid, setRemoteGrid] = useState<boolean[]>(Array(GRID_SIZE * GRID_SIZE).fill(false));
  const [latencyMode, setLatencyMode] = useState<'LAN' | 'WAN'>('LAN');
  const [activeSyncing, setActiveSyncing] = useState<number[]>([]);
  const [stats, setStats] = useState({
    latency: '0.12ms',
    transferSize: '0 Bytes',
    packets: 0,
  });

  const clearGrids = () => {
    setLocalGrid(Array(GRID_SIZE * GRID_SIZE).fill(false));
    setRemoteGrid(Array(GRID_SIZE * GRID_SIZE).fill(false));
    setStats({ latency: '0.00ms', transferSize: '0 Bytes', packets: 0 });
  };

  const handleCellHover = (index: number, forceClick = false) => {
    // Enable hover drawing (if mouse button is down, or on direct click)
    // We toggle the local cell
    const newLocal = [...localGrid];
    if (newLocal[index] && !forceClick) return; // already active and not forced
    
    newLocal[index] = !newLocal[index];
    setLocalGrid(newLocal);

    // Trigger sync animation pulse
    setActiveSyncing((prev) => [...prev, index]);

    // Calculate replication delay based on latency mode
    // LAN: 0.1ms to 0.3ms
    // WAN: 15ms to 25ms
    const baseDelay = latencyMode === 'LAN' ? 120 : 600; // visual delay for pulses in UI
    const actualLatencyVal = latencyMode === 'LAN' 
      ? (0.1 + Math.random() * 0.15).toFixed(2) + 'ms'
      : (15.2 + Math.random() * 5.4).toFixed(2) + 'ms';

    setTimeout(() => {
      const newRemote = [...newLocal]; // sync state
      setRemoteGrid(newRemote);
      setActiveSyncing((prev) => prev.filter((i) => i !== index));
      
      // Update statistics
      setStats((prev) => ({
        latency: actualLatencyVal,
        transferSize: `${(64 + Math.floor(Math.random() * 32))} Bytes`,
        packets: prev.packets + 1,
      }));
    }, baseDelay);
  };

  return (
    <section
      id="terminal"
      style={{
        padding: '100px 8%',
        background: '#020202',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '15px' }}>
            Interactive <span style={{ color: 'var(--accent-red)' }}>Sync Playground</span>
          </h2>
          <p style={{ color: '#a0a0a5', maxWidth: '650px', margin: '0 auto', fontSize: '1.05rem' }}>
            Click or drag your mouse across the Local Workspace grid and witness how OrBit's CRDT engine synchronizes peer nodes in real-time.
          </p>
        </div>

        {/* Dynamic Sandbox Layout */}
        <div className="playground-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '50px', alignItems: 'center' }}>
          
          {/* Left Side: Playground Card */}
          <TiltCard
            style={{
              padding: '40px 30px',
              background: 'rgba(10, 8, 8, 0.65)',
              border: '1px solid rgba(255, 0, 60, 0.15)',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* Grid sync comparison */}
              <div
                className="playground-grids-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '20px',
                }}
              >
                {/* Local Node Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff3366', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Local Workspace
                  </span>
                  
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                      gap: '6px',
                      background: '#0d0a0b',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(255, 0, 60, 0.1)',
                      width: '100%',
                      maxWidth: '220px',
                      aspectRatio: '1',
                    }}
                  >
                    {localGrid.map((active, idx) => (
                      <div
                        key={idx}
                        onMouseDown={() => handleCellHover(idx, true)}
                        onMouseEnter={(e) => {
                          if (e.buttons === 1) handleCellHover(idx);
                        }}
                        style={{
                          background: active ? 'radial-gradient(circle, #ff003c 0%, #990011 100%)' : '#181213',
                          border: active ? '1px solid #ff6688' : '1.5px solid rgba(255,255,255,0.02)',
                          boxShadow: active ? '0 0 15px #ff003c' : 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease-out',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Bridge Synclink Animation */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '60px' }}>
                  {/* Laser sync link visual */}
                  <div
                    style={{
                      width: '100%',
                      height: '2px',
                      background: 'rgba(255, 0, 60, 0.15)',
                      position: 'relative',
                    }}
                  >
                    {/* Glowing pulse moving across */}
                    {activeSyncing.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: '0 0 10px #ff003c, 0 0 4px #fff',
                          animation: 'float 0.5s infinite alternate',
                          left: '0%',
                          transform: 'translateY(-50%)',
                          animationName: 'spin-slow', // reuse a rotating keyframe or similar
                        }}
                        className="pulse-glow-red"
                      />
                    )}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#606065', marginTop: '10px', fontFamily: 'monospace' }}>
                    PeerLink
                  </span>
                </div>

                {/* Remote Paired Node Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', flex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Remote Peer Node
                  </span>
                  
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                      gap: '6px',
                      background: '#0d0a0b',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(255, 255, 255, 0.05)',
                      width: '100%',
                      maxWidth: '220px',
                      aspectRatio: '1',
                      pointerEvents: 'none', // remote is read-only
                    }}
                  >
                    {remoteGrid.map((active, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: active ? 'radial-gradient(circle, #ff3366 0%, #770011 100%)' : '#100e0e',
                          border: active ? '1px solid #ff859f' : '1.5px solid rgba(255,255,255,0.01)',
                          boxShadow: active ? '0 0 12px rgba(255, 51, 102, 0.5)' : 'none',
                          borderRadius: '4px',
                          transition: 'all 0.15s ease-out',
                        }}
                      />
                    ))}
                  </div>
                </div>

              </div>

              {/* Sandbox Controls panel */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#0c0a0a',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 0, 60, 0.08)',
                }}
              >
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setLatencyMode(latencyMode === 'LAN' ? 'WAN' : 'LAN')}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--accent-red)',
                      color: 'var(--accent-red)',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-red-dim)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Mode: {latencyMode === 'LAN' ? 'LAN Peer (Fast)' : 'WAN Peer (Global)'}
                  </button>
                  <button
                    onClick={clearGrids}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#a0a0a5',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#a0a0a5';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                  >
                    Reset Grid
                  </button>
                </div>

                <span style={{ fontSize: '0.75rem', color: '#606065', fontFamily: 'monospace' }}>
                  Click & drag to draw
                </span>
              </div>

            </div>
          </TiltCard>

          {/* Right Side: Performance stats display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Sub-Millisecond <br />
              <span style={{ color: 'var(--accent-red)' }}>Sync Guarantee</span>
            </h3>
            
            <p style={{ color: '#a0a0a5', lineHeight: 1.6, fontSize: '1rem' }}>
              Unlike centralized syncing, OrBit shares peer changes locally first. If an internet partition occurs, nodes communicate via peer link, merging writes on reconnect.
            </p>

            {/* Metrics cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ padding: '20px', background: '#080606', border: '1px solid rgba(255,0,60,0.06)', borderRadius: '8px' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#808085', marginBottom: '8px', fontFamily: 'monospace' }}>
                  REPLICATION LATENCY
                </span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-red)', textShadow: '0 0 10px var(--accent-red-glow)' }}>
                  {stats.latency}
                </span>
              </div>

              <div style={{ padding: '20px', background: '#080606', border: '1px solid rgba(255,0,60,0.06)', borderRadius: '8px' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#808085', marginBottom: '8px', fontFamily: 'monospace' }}>
                  SYNC PACKET WEIGHT
                </span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>
                  {stats.transferSize}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#606065', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px #00e676' }} />
              <span>Daemon watcher responsive. Active sync updates: {stats.packets}</span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
