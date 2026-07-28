import React from 'react';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';
import Hero from '@/components/hero/Hero';
import Features from '@/components/features/Features';
import Architecture from '@/components/architecture/Architecture';
import LiveSyncPlayground from '@/components/console/LiveSyncPlayground';
import OrbitalPairingSandbox from '@/components/benchmark/OrbitalPairingSandbox';

export default function Home() {
  return (
    <main style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#030303', overflow: 'hidden' }}>
      {/* Background Nebulas and Grid */}
      <Aurora />

      {/* Interactive Cursor Light Trail */}
      <CursorGlow />

      {/* Main Sections */}
      <Hero />
      <Features />
      <Architecture />
      <LiveSyncPlayground />
      <OrbitalPairingSandbox />
    </main>
  );
}
