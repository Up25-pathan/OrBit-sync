'use client';

import React, { useEffect, useState } from 'react';
import TiltCard from '@/components/effects/TiltCard';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

const AppleIcon = ({ size = 26, color = "#a259ff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.13-1.97.99-3.12-1 .04-2.21.67-2.92 1.5-.64.74-1.2 1.92-1.05 3.05 1.12.09 2.26-.58 2.98-1.43z"/>
  </svg>
);

const WindowsIcon = ({ size = 26, color = "#00a4ef" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm0 17.102l9.75 1.35v-9.451H0v8.101zM11.25 1.9L24 0v11.25H11.25V1.9zm0 20.2L24 24V12.75H11.25v9.35z"/>
  </svg>
);

const LinuxIcon = ({ size = 26, color = "#f34b7d" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

interface PlatformUrls {
  winUrl?: string;
  macX64Url?: string;
  macArmUrl?: string;
  linuxUrl?: string;
}

interface ReleaseData {
  version: string;
  notes?: string;
  pubDate?: string;
  urls: PlatformUrls;
}

const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://orbit-sync.onrender.com')
  : 'https://orbit-sync.onrender.com';

export default function DownloadPage() {
  const [detectedOs, setDetectedOs] = useState<'windows' | 'mac' | 'linux'>('windows');
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [hasActiveRelease, setHasActiveRelease] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Detect User Operating System
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.includes('mac')) {
        setDetectedOs('mac');
      } else if (userAgent.includes('linux')) {
        setDetectedOs('linux');
      } else {
        setDetectedOs('windows');
      }
    }

    fetchLatestRelease();
  }, []);

  // Fetch Real Live Release from OrBit Server
  async function fetchLatestRelease() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/updater/latest.json`);
      if (res.ok && res.status !== 204) {
        const data = await res.json();
        const platforms = data.platforms || {};
        const urls: PlatformUrls = {
          winUrl: platforms['windows-x86_64']?.url || platforms['x86_64-pc-windows-msvc']?.url,
          macX64Url: platforms['darwin-x86_64']?.url || platforms['x86_64-apple-darwin']?.url,
          macArmUrl: platforms['darwin-aarch64']?.url || platforms['aarch64-apple-darwin']?.url,
          linuxUrl: platforms['linux-x86_64']?.url || platforms['x86_64-unknown-linux-gnu']?.url,
        };

        const hasAnyUrl = Object.values(urls).some((u) => !!u);
        setHasActiveRelease(hasAnyUrl);

        setRelease({
          version: data.version || '1.0.0-beta',
          notes: data.notes || 'Official OrBit Desktop Client Release',
          pubDate: data.pub_date,
          urls,
        });
      } else {
        setHasActiveRelease(false);
        setRelease(null);
      }
    } catch (err) {
      console.error('Failed to fetch live release specs from server:', err);
      setHasActiveRelease(false);
      setRelease(null);
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = (url?: string, platformName?: string) => {
    if (url) {
      window.location.href = url;
    } else {
      alert(`No binary package has been uploaded for ${platformName || 'this platform'} yet. Administrators can upload release installer files directly in the Admin Panel (/admin).`);
    }
  };

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        overflow: 'hidden',
        padding: '120px 6% 100px 6%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Background Ambience */}
      <Aurora />
      <CursorGlow />

      <div style={{ width: '100%', maxWidth: '1200px', position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '45px' }}>
        
        {/* Page Title & Status Badge */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 0, 60, 0.08)', border: '1px solid rgba(255, 0, 60, 0.25)', padding: '6px 18px', borderRadius: '30px', marginBottom: '20px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasActiveRelease ? '#00ff88' : '#ffaa00', boxShadow: hasActiveRelease ? '0 0 10px #00ff88' : '0 0 10px #ffaa00' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'var(--font-orbitron)' }}>
              {hasActiveRelease ? `OFFICIAL BETA RELEASE — ${release?.version}` : 'RELEASE SYSTEM READY — AWAITING FIRST ADMIN PUBLISH'}
            </span>
          </div>

          <h1 style={{ fontSize: '3.8rem', fontWeight: 900, color: '#fff', margin: '0 0 16px 0', letterSpacing: '-1.5px', fontFamily: 'var(--font-orbitron)' }}>
            Cross-Platform <span style={{ color: 'var(--accent-red)' }}>OrBit Desktop</span>
          </h1>
          <p style={{ color: '#a0a0a5', maxWidth: '680px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Native local-first code synchronization engine compiled natively for macOS, Windows, and Linux. Choose your operating system below to begin.
          </p>
        </div>

        {/* 3 EQUAL PLATFORM CARDS GRID (macOS, Windows, Linux) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', width: '100%' }}>
          
          {/* CARD 1: macOS (Apple Silicon & Intel) */}
          <TiltCard
            style={{
              background: detectedOs === 'mac'
                ? 'linear-gradient(145deg, rgba(20, 15, 25, 0.9), rgba(8, 6, 14, 0.95))'
                : 'linear-gradient(145deg, rgba(12, 10, 14, 0.8), rgba(6, 5, 8, 0.9))',
              border: detectedOs === 'mac' ? '1.5px solid #a259ff' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: detectedOs === 'mac' ? '0 15px 40px rgba(162, 89, 255, 0.2)' : '0 15px 35px rgba(0,0,0,0.5)',
              position: 'relative',
            }}
          >
            <div style={{ transform: 'translateZ(20px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 44, height: 44, background: 'rgba(162, 89, 255, 0.12)', border: '1px solid rgba(162, 89, 255, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AppleIcon size={24} color="#a259ff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'var(--font-orbitron)' }}>macOS</h3>
                    <span style={{ fontSize: '0.75rem', color: '#a259ff', fontWeight: 700 }}>Universal Binary</span>
                  </div>
                </div>
                {detectedOs === 'mac' && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.4)', color: '#d8b4ff', padding: '3px 10px', borderRadius: '20px', fontWeight: 800 }}>
                    YOUR OS
                  </span>
                )}
              </div>

              <p style={{ color: '#909098', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                Native Metal & Cocoa rendering stack optimized for M1, M2, M3, M4 Apple Silicon and Intel Macs.
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 700 }}>Apple Silicon (M-Series ARM64)</span>
                  <button
                    onClick={() => handleDownload(release?.urls.macArmUrl, 'macOS Apple Silicon ARM64')}
                    style={{ background: 'rgba(162, 89, 255, 0.15)', border: '1px solid rgba(162, 89, 255, 0.35)', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Download ARM64
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#a0a0a5' }}>macOS Intel (x86_64)</span>
                  <button
                    onClick={() => handleDownload(release?.urls.macX64Url, 'macOS Intel x64')}
                    style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Download x64
                  </button>
                </div>
              </div>
            </div>

            <div style={{ transform: 'translateZ(30px)', width: '100%', marginTop: '24px' }}>
              <button
                onClick={() => handleDownload(release?.urls.macArmUrl || release?.urls.macX64Url, 'macOS')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #a259ff 0%, #7928ca 100%)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-orbitron)',
                  boxShadow: '0 0 20px rgba(162, 89, 255, 0.4)',
                }}
              >
                Download for macOS
              </button>
            </div>
          </TiltCard>

          {/* CARD 2: Windows (x64 Setup & MSI) */}
          <TiltCard
            style={{
              background: detectedOs === 'windows'
                ? 'linear-gradient(145deg, rgba(10, 18, 25, 0.9), rgba(5, 8, 14, 0.95))'
                : 'linear-gradient(145deg, rgba(8, 12, 16, 0.8), rgba(4, 6, 9, 0.9))',
              border: detectedOs === 'windows' ? '1.5px solid #00a4ef' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: detectedOs === 'windows' ? '0 15px 40px rgba(0, 164, 239, 0.2)' : '0 15px 35px rgba(0,0,0,0.5)',
              position: 'relative',
            }}
          >
            <div style={{ transform: 'translateZ(20px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 44, height: 44, background: 'rgba(0, 164, 239, 0.12)', border: '1px solid rgba(0, 164, 239, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <WindowsIcon size={24} color="#00a4ef" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'var(--font-orbitron)' }}>Windows</h3>
                    <span style={{ fontSize: '0.75rem', color: '#00a4ef', fontWeight: 700 }}>64-bit Installer</span>
                  </div>
                </div>
                {detectedOs === 'windows' && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(0, 164, 239, 0.15)', border: '1px solid rgba(0, 164, 239, 0.4)', color: '#80d4ff', padding: '3px 10px', borderRadius: '20px', fontWeight: 800 }}>
                    YOUR OS
                  </span>
                )}
              </div>

              <p style={{ color: '#909098', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                High-performance Win32 daemon integrated with Windows File Change Notification APIs.
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 700 }}>Windows 10 & 11 (64-bit)</span>
                  <span style={{ fontSize: '0.75rem', color: '#808085' }}>`.nsis.zip` / `.msi`</span>
                </div>
              </div>
            </div>

            <div style={{ transform: 'translateZ(30px)', width: '100%', marginTop: '24px' }}>
              <button
                onClick={() => handleDownload(release?.urls.winUrl, 'Windows x64')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #00a4ef 0%, #0078d4 100%)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-orbitron)',
                  boxShadow: '0 0 20px rgba(0, 164, 239, 0.4)',
                }}
              >
                Download for Windows
              </button>
            </div>
          </TiltCard>

          {/* CARD 3: Linux (AppImage & Deb) */}
          <TiltCard
            style={{
              background: detectedOs === 'linux'
                ? 'linear-gradient(145deg, rgba(25, 10, 18, 0.9), rgba(14, 5, 10, 0.95))'
                : 'linear-gradient(145deg, rgba(14, 8, 12, 0.8), rgba(8, 4, 6, 0.9))',
              border: detectedOs === 'linux' ? '1.5px solid #f34b7d' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: detectedOs === 'linux' ? '0 15px 40px rgba(243, 75, 125, 0.2)' : '0 15px 35px rgba(0,0,0,0.5)',
              position: 'relative',
            }}
          >
            <div style={{ transform: 'translateZ(20px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 44, height: 44, background: 'rgba(243, 75, 125, 0.12)', border: '1px solid rgba(243, 75, 125, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LinuxIcon size={24} color="#f34b7d" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'var(--font-orbitron)' }}>Linux</h3>
                    <span style={{ fontSize: '0.75rem', color: '#f34b7d', fontWeight: 700 }}>Portable AppImage</span>
                  </div>
                </div>
                {detectedOs === 'linux' && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(243, 75, 125, 0.15)', border: '1px solid rgba(243, 75, 125, 0.4)', color: '#ff9ebb', padding: '3px 10px', borderRadius: '20px', fontWeight: 800 }}>
                    YOUR OS
                  </span>
                )}
              </div>

              <p style={{ color: '#909098', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                POSIX kernel inotify daemon compatible with Ubuntu, Debian, Fedora, and Arch Linux.
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 700 }}>Linux AppImage (x86_64)</span>
                  <span style={{ fontSize: '0.75rem', color: '#808085' }}>`.AppImage.tar.gz`</span>
                </div>
              </div>
            </div>

            <div style={{ transform: 'translateZ(30px)', width: '100%', marginTop: '24px' }}>
              <button
                onClick={() => handleDownload(release?.urls.linuxUrl, 'Linux x86_64')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #f34b7d 0%, #d0104c 100%)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-orbitron)',
                  boxShadow: '0 0 20px rgba(243, 75, 125, 0.4)',
                }}
              >
                Download for Linux
              </button>
            </div>
          </TiltCard>

        </div>

        {/* License Activation Callout */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 0, 60, 0.02)',
            border: '1px solid rgba(255, 0, 60, 0.15)',
            borderRadius: '16px',
            padding: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          <div>
            <h4 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 6px 0', fontFamily: 'var(--font-orbitron)' }}>
              🔑 Have your License Key ready?
            </h4>
            <p style={{ color: '#808085', fontSize: '0.85rem', margin: 0 }}>
              Launch OrBit Desktop after installation and paste your single permanent License Key from your OrBit Console.
            </p>
          </div>
          <a
            href="/console"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Get License Key
          </a>
        </div>

      </div>
    </main>
  );
}
