'use client';

import React, { useState, useEffect } from 'react';

export default function OrbitBall() {
  const [rotate, setRotate] = useState({ x: 12, y: -12 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    if (window.innerWidth >= 768) {
      const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        const y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
        // Soft tilt up to 18 degrees
        setRotate({ x: -y * 18, y: x * 18 });
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('resize', checkMobile);
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Generate stardust particles with randomized 3D alignments (reduced on mobile for performance)
  const particleCount = isMobile ? 6 : 24;
  const stardust = Array.from({ length: particleCount }).map((_, i) => {
    const rotX = (i * 35) % 180;
    const rotY = (i * 25) % 180;
    const delay = -(i * 0.7);
    const size = i % 4 === 0 ? '6px' : i % 3 === 0 ? '4px' : '3px';
    
    // Vibrant neon red, pink, orange-gold, and white colors
    const color = i % 5 === 0 
      ? '#ff003c' 
      : i % 3 === 0 
        ? '#ffaa00' 
        : i % 2 === 0 
          ? '#ff859f' 
          : 'rgba(255, 255, 255, 0.75)';
          
    const speed = 7 + (i % 6) * 2.5;
    const radius = 110 + (i * 10);

    return {
      rotX,
      rotY,
      delay,
      size,
      color,
      speed,
      radius,
    };
  });

  return (
    <div
      className="orbit-ball-wrapper"
      style={{
        position: 'relative',
        width: '520px',
        height: '520px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `perspective(1200px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transition: 'transform 0.2s ease-out',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Background Volumetric Glow */}
      <div
        style={{
          position: 'absolute',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 0, 60, 0.22) 0%, transparent 70%)',
          filter: 'blur(60px)',
          zIndex: 1,
          pointerEvents: 'none',
          transform: 'translateZ(-60px)',
        }}
      />

      {/* Shaded 3D Central Core Sphere (Stays upright, not rotated by galaxy spin) */}
      <div
        style={{
          position: 'absolute',
          width: '78px',
          height: '78px',
          borderRadius: '16px',
          background: '#0d0a0b',
          border: '2px solid var(--accent-red)',
          boxShadow: '0 0 50px rgba(255, 0, 60, 0.65), inset 0 0 15px rgba(255, 0, 60, 0.3)',
          zIndex: 10,
          transform: 'translateZ(0px)',
          animation: 'float 4s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
        }}
      >
        <img
          src="/logo.png"
          alt="OrBit Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
        {/* Core Orbit Pulsing ring */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '16px',
            border: '2px solid rgba(255, 0, 60, 0.5)',
            animation: 'pulse-red 2s infinite',
            transform: 'scale(1.18)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Rotating Galaxy Container */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformStyle: 'preserve-3d',
          animation: 'spin-slow 35s linear infinite',
          pointerEvents: 'none',
        }}
      >
        {/* 3D Ring 1: Inner (Tilted X) */}
        <div
          style={{
            position: 'absolute',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            border: '1.5px solid rgba(255, 0, 60, 0.35)',
            boxShadow: '0 0 15px rgba(255, 0, 60, 0.15)',
            transformStyle: 'preserve-3d',
            transform: 'rotateX(70deg) rotateY(15deg)',
            zIndex: 4,
          }}
        >
          {/* Orbit Node with Comet Trail */}
          <div
            style={{
              position: 'absolute',
              top: '0',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '15px',
              height: '15px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #fff 0%, #ff003c 70%, #990011 100%)',
              boxShadow: '0 0 25px #ff003c, 0 0 10px #fff',
            }}
          />
        </div>

        {/* 3D Ring 2: Middle (Tilted Y) - Hidden on Mobile */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              width: '360px',
              height: '360px',
              borderRadius: '50%',
              border: '1.5px solid rgba(255, 0, 60, 0.25)',
              boxShadow: '0 0 20px rgba(255, 0, 60, 0.1)',
              transformStyle: 'preserve-3d',
              transform: 'rotateX(-35deg) rotateY(40deg)',
              zIndex: 3,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '0',
                transform: 'translate(-50%, -50%)',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #ff859f 0%, #ff3366 70%, #660011 100%)',
                boxShadow: '0 0 30px #ff3366, 0 0 12px rgba(255, 51, 102, 0.4)',
              }}
            />
          </div>
        )}

        {/* 3D Ring 3: Outer (Tilted Z) - Hidden on Mobile */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              width: '470px',
              height: '470px',
              borderRadius: '50%',
              border: '1.2px dashed rgba(255, 255, 255, 0.15)',
              transformStyle: 'preserve-3d',
              transform: 'rotateX(80deg) rotateY(-10deg)',
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: '50%',
                right: '0',
                transform: 'translate(50%, -50%)',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 0 20px #ffffff, 0 0 8px rgba(255,255,255,0.8)',
              }}
            />
          </div>
        )}

        {/* Volumetric Stardust Particles Orbiting on Different Planes */}
        {stardust.map((star, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${star.radius}px`,
              height: `${star.radius}px`,
              borderRadius: '50%',
              border: 'none',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${star.rotX}deg) rotateY(${star.rotY}deg)`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {/* Dust Particle Dot */}
            <div
              style={{
                position: 'absolute',
                top: '0',
                left: '50%',
                transform: 'translate(-50%, -50%) translateZ(0px)',
                width: star.size,
                height: star.size,
                borderRadius: '50%',
                background: star.color,
                boxShadow: `0 0 10px ${star.color}, 0 0 4px ${star.color}`,
                animation: `spin-slow ${star.speed}s linear infinite`,
                animationDelay: `${star.delay}s`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
