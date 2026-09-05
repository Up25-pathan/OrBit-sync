import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'OrBit - Local-First Workspace Synchronization Engine';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#030303',
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(255, 0, 60, 0.25) 0%, rgba(3, 3, 3, 0.95) 70%)',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          position: 'relative',
          padding: '60px',
        }}
      >
        {/* Glowing border box */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            right: '30px',
            bottom: '30px',
            border: '1px solid rgba(255, 0, 60, 0.35)',
            borderRadius: '24px',
            display: 'flex',
          }}
        />

        {/* Brand Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#ff003c',
              boxShadow: '0 0 20px #ff003c',
            }}
          />
          <span
            style={{
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '6px',
              textTransform: 'uppercase',
              color: '#ffffff',
            }}
          >
            ORBIT<span style={{ color: '#ff003c' }}>.SYNC</span>
          </span>
        </div>

        {/* Hero Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.15,
            letterSpacing: '-1.5px',
            maxWidth: '1000px',
            marginBottom: '24px',
          }}
        >
          Local-First Workspace Synchronization Engine
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: '#a0a0a5',
            textAlign: 'center',
            maxWidth: '850px',
            lineHeight: 1.4,
            marginBottom: '40px',
          }}
        >
          Sub-millisecond P2P file & state sync across VS Code, Tauri desktop frames, and background Rust daemons.
        </div>

        {/* Protocol badges */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
          }}
        >
          {['ZERO-KNOWLEDGE E2EE', 'P2P MESH', 'RUST DAEMON', 'DEAD-DROP VAULT'].map(
            (badge) => (
              <div
                key={badge}
                style={{
                  padding: '8px 18px',
                  backgroundColor: 'rgba(255, 0, 60, 0.1)',
                  border: '1px solid rgba(255, 0, 60, 0.4)',
                  borderRadius: '100px',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  color: '#ff4d6d',
                }}
              >
                {badge}
              </div>
            )
          )}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
