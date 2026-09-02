'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TiltCard from '@/components/effects/TiltCard';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://orbit-sync.onrender.com' : 'http://localhost:5000');

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification Code Modal States
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isTwoFactor, setIsTwoFactor] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (showVerifyModal) {
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [showVerifyModal]);

  const handleOtpChange = (index: number, val: string) => {
    const sanitized = val.replace(/\D/g, '');
    if (!sanitized) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (sanitized.length > 1) {
      const newDigits = [...otpDigits];
      const chars = sanitized.slice(0, 6).split('');
      chars.forEach((char, i) => {
        if (index + i < 6) {
          newDigits[index + i] = char;
        }
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(index + chars.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = sanitized[0];
    setOtpDigits(newDigits);

    if (index < 5 && sanitized[0]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((char, i) => {
      newDigits[i] = char;
    });
    setOtpDigits(newDigits);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !verifyEmail) return;
    setVerifyError('');
    setResendMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/resend-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code.');
      }
      setResendMessage('A fresh verification code was sent to your email!');
      setResendCooldown(60);
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to resend code.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      // Catch Two-Factor Authentication Challenge
      if (res.ok && data.status === 'REQUIRES_2FA') {
        setIsTwoFactor(true);
        setVerifyEmail(email);
        setShowVerifyModal(true);
        setResendCooldown(60);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        // Catch pending unverified registration
        if (res.status === 403 && data.status === 'PENDING_VERIFICATION') {
          setIsTwoFactor(false);
          setVerifyEmail(email);
          setShowVerifyModal(true);
          setResendCooldown(60);
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to authenticate.');
      }

      // Store credentials in localStorage
      localStorage.setItem('orbit_user', JSON.stringify({ email: data.user.email, token: data.token, role: data.user.role, displayName: data.user.displayName, licenseKey: data.user.licenseKey, planTier: data.user.planTier }));
      
      // Dispatch storage event to notify Navbar immediately in this tab
      window.dispatchEvent(new Event('storage'));
      
      setLoading(false);
      if (redirectParam === 'checkout') {
        const plan = searchParams.get('plan') || 'pro';
        router.push(`/checkout?plan=${plan}`);
      } else if (data.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/console');
      }
    } catch (err: any) {
      setError(err.message || 'Server connection failed.');
      setLoading(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');

    const code = otpDigits.join('');
    if (!code || code.length !== 6) {
      setVerifyError('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifyLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: verifyEmail, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      // Store authenticated credentials
      localStorage.setItem('orbit_user', JSON.stringify({ email: data.user.email, token: data.token, role: data.user.role, displayName: data.user.displayName, licenseKey: data.user.licenseKey, planTier: data.user.planTier }));
      window.dispatchEvent(new Event('storage'));
      
      setVerifyLoading(false);
      setShowVerifyModal(false);

      if (redirectParam === 'checkout') {
        const plan = searchParams.get('plan') || 'pro';
        router.push(`/checkout?plan=${plan}`);
      } else if (data.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/console');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Code validation failed.');
      setVerifyLoading(false);
    }
  };

  const handleSocialOAuth = (provider: string) => {
    setLoading(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    window.location.href = `${API_BASE_URL}/api/auth/${provider.toLowerCase()}?origin=${encodeURIComponent(origin)}`;
  };

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '80px 20px',
      }}
    >
      <Aurora />
      <CursorGlow />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '480px' }}>
        
        {/* Title branding */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', fontFamily: 'var(--font-orbitron)', margin: '0 0 10px 0' }}>
            Welcome Back, Peer
          </h2>
          <p style={{ color: '#a0a0a5', fontSize: '0.9rem', margin: 0 }}>
            Log in to manage your active daemon licenses.
          </p>
        </div>

        {/* Login form card */}
        <TiltCard
          style={{
            background: 'rgba(10, 8, 8, 0.75)',
            border: '1px solid rgba(255, 0, 60, 0.15)',
            borderRadius: '16px',
            padding: '40px 35px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* SSO Mock login buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px', transform: 'translateZ(10px)' }}>
            <button
              onClick={() => handleSocialOAuth('Google')}
              style={{
                background: '#070505',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.background = '#070505'; }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Google
            </button>
            <button
              onClick={() => handleSocialOAuth('GitHub')}
              style={{
                background: '#070505',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.background = '#070505'; }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              GitHub
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', transform: 'translateZ(5px)' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
            <span style={{ fontSize: '0.75rem', color: '#606065', textTransform: 'uppercase', letterSpacing: '1px' }}>or continue with email</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />
          </div>

          {/* Alert Message Box */}
          {error && (
            <div style={{ background: 'rgba(255, 76, 117, 0.08)', border: '1px solid rgba(255, 76, 117, 0.2)', borderRadius: '8px', padding: '12px 16px', color: '#ff4c75', fontSize: '0.85rem', marginBottom: '25px', transform: 'translateZ(10px)' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', transform: 'translateZ(15px)' }}>
            
            {/* Email Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
              <input
                required
                type="email"
                placeholder="dev@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: '#070505',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-red)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 0, 60, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Password</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  background: '#070505',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-red)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 0, 60, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              className="glow-btn"
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--accent-red)',
                border: 'none',
                color: '#fff',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(255, 0, 60, 0.35)',
                transition: 'all 0.2s',
                marginTop: '10px',
                fontFamily: 'var(--font-orbitron)',
                letterSpacing: '1px',
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Footer Navigation */}
          <div
            style={{
              marginTop: '30px',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: '#808085',
              transform: 'translateZ(10px)',
            }}
          >
            Don't have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent-red)', textDecoration: 'none', fontWeight: 600 }}>
              Sign Up
            </Link>
          </div>
        </TiltCard>
      </div>

      {/* EMAIL CODE VERIFICATION MODAL OVERLAY */}
      {showVerifyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0a0808', border: '1.5px solid var(--accent-red)', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '40px 30px', boxShadow: '0 0 30px rgba(255, 0, 60, 0.25)', position: 'relative' }}>
            
            <button onClick={() => setShowVerifyModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#606065', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>

            <div style={{ marginBottom: '25px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {isTwoFactor ? '🔒 Two-Factor Authentication' : '✉️ Email Verification Required'}
              </span>
              <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800, margin: '5px 0 0 0', fontFamily: 'var(--font-orbitron)' }}>
                {isTwoFactor ? 'Enter 2FA Security Code' : 'Verify Registration Code'}
              </h3>
              <p style={{ color: '#808085', fontSize: '0.85rem', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                {isTwoFactor
                  ? <>A 2-step security verification code was dispatched to <strong>{verifyEmail}</strong>. Enter it below to sign in.</>
                  : <>This account registration is pending verification. Please enter the 6-digit verification code sent to <strong>{verifyEmail}</strong>.</>}
              </p>
            </div>

            {resendMessage && (
              <div style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '8px', padding: '10px 14px', color: '#00e676', fontSize: '0.8rem', marginBottom: '15px' }}>
                ✓ {resendMessage}
              </div>
            )}

            {verifyError && (
              <div style={{ background: 'rgba(255, 76, 117, 0.08)', border: '1px solid rgba(255, 76, 117, 0.2)', borderRadius: '8px', padding: '10px 14px', color: '#ff4c75', fontSize: '0.8rem', marginBottom: '20px' }}>
                ⚠️ {verifyError}
              </div>
            )}

            <form onSubmit={handleVerifyCodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ color: '#a0a0a5', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px', textAlign: 'center' }}>
                  ENTER 6-DIGIT CODE
                </label>
                
                {/* 6 Segmented OTP Boxes */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={idx === 0 ? 6 : 1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      style={{
                        width: '48px',
                        height: '56px',
                        background: digit ? '#0f0a0b' : '#060404',
                        border: digit ? '1.5px solid var(--accent-red)' : '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        fontFamily: 'var(--font-orbitron), monospace',
                        outline: 'none',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: digit ? '0 0 14px rgba(255, 0, 60, 0.3), inset 0 0 8px rgba(255, 0, 60, 0.15)' : 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-red)';
                        e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 0, 60, 0.45)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onBlur={(e) => {
                        if (!digit) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                        e.currentTarget.style.transform = 'translateY(0px)';
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyLoading}
                className="glow-btn"
                style={{
                  width: '100%',
                  background: 'var(--accent-red)',
                  border: 'none',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: verifyLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-orbitron)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                {verifyLoading ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
                    Verifying Code...
                  </>
                ) : 'Complete Login Handshake'}
              </button>

              <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '0.8rem', color: '#808085' }}>
                Didn't receive the email?{' '}
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendCooldown > 0 ? '#606065' : 'var(--accent-red)',
                    fontWeight: 600,
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                    fontSize: '0.8rem',
                  }}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a0a0a5', fontSize: '1.2rem', fontFamily: 'monospace' }}>Loading Secure Portal...</p>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
