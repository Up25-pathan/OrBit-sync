'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TiltCard from '@/components/effects/TiltCard';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

interface Device {
  id: string;
  hostname: string;
  platform: 'windows' | 'macos' | 'linux';
  status: 'ACTIVE' | 'IDLE';
  ping: number;
  lastSeen: string;
}

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'PAID' | 'FAILED';
}

const INITIAL_DEVICES: Device[] = [
  { id: '1', hostname: 'macbook-pro-m3', platform: 'macos', status: 'ACTIVE', ping: 0.8, lastSeen: 'Just now' },
  { id: '2', hostname: 'ubuntu-threadripper-station', platform: 'linux', status: 'ACTIVE', ping: 1.5, lastSeen: '3s ago' },
  { id: '3', hostname: 'win-drilling-rig-desktop', platform: 'windows', status: 'IDLE', ping: 34.2, lastSeen: '5m ago' },
];

const INITIAL_INVOICES: Invoice[] = [
  { id: 'INV-2026-003', date: 'Jul 10, 2026', amount: '$0.00', status: 'PAID' },
  { id: 'INV-2026-002', date: 'Jun 10, 2026', amount: '$0.00', status: 'PAID' },
  { id: 'INV-2026-001', date: 'May 10, 2026', amount: '$0.00', status: 'PAID' },
];

const SYNC_FILES = [
  'src/main.rs', 'include/engine.h', 'app/page.tsx', 'styles/globals.css',
  'Cargo.toml', 'README.md', 'lib.rs', 'src/solver.cu', 'tests/perf.py'
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://orbit-sync.onrender.com' : 'http://localhost:5000');

function ConsoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'wan' | 'logs' | 'billing' | 'profile'>('dashboard');
  const [isClient, setIsClient] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Dashboard States
  const [licenseKey, setLicenseKey] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);

  // Pairing Wizard States
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDevicePlatform, setNewDevicePlatform] = useState<'windows' | 'macos' | 'linux'>('macos');
  const [pairingProgress, setPairingProgress] = useState(0);

  // WAN & Security States
  const [wanEnabled, setWanEnabled] = useState(false);
  const [stunServer, setStunServer] = useState('stun:stun.l.google.com:19302');
  const [aesKey, setAesKey] = useState('aes_gcm_256_vault_key_e3d9f2b1a0c4f8d2b9d3');
  const [copiedAes, setCopiedAes] = useState(false);

  // Live Logs States
  const [logLines, setLogLines] = useState<string[]>([]);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Billing States
  const [planTier, setPlanTier] = useState<'Free Tier' | 'Developer Tier' | 'Enterprise Tier'>('Free Tier');
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  // Account Profile States
  const [displayName, setDisplayName] = useState('Developer Profile');
  const [profileEmail, setProfileEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState(false);
  const [userRole, setUserRole] = useState<'USER' | 'ADMIN'>('USER');

  const fetchDashboardData = async () => {
    const userString = localStorage.getItem('orbit_user');
    if (!userString) return;
    try {
      const parsed = JSON.parse(userString);
      const token = parsed.token;
      if (parsed.role) setUserRole(parsed.role);

      const res = await fetch(`${API_BASE_URL}/api/console/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setLicenseKey(data.license?.licenseKey || '');
        setDevices(data.devices || []);
        if (data.user?.displayName) setDisplayName(data.user.displayName);
        const tier = data.subscription?.planTier || 'solo';
        if (tier === 'mesh' || tier === 'pro') {
          setPlanTier('Developer Tier');
        } else if (tier === 'enterprise') {
          setPlanTier('Enterprise Tier');
        } else {
          setPlanTier('Free Tier');
        }
        setUserEmail(data.user.email);
        setProfileEmail(data.user.email);
        if (data.user.role) setUserRole(data.user.role);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  // Load Auth & fetch real data
  useEffect(() => {
    setIsClient(true);

    // Check for incoming Google/GitHub OAuth redirect credentials
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthToken = searchParams.get('token');
    const oauthEmail = searchParams.get('email');

    if (oauthSuccess === 'true' && oauthToken && oauthEmail) {
      const oauthRole = searchParams.get('role') || 'USER';
      localStorage.setItem('orbit_user', JSON.stringify({ email: oauthEmail, token: oauthToken, role: oauthRole }));
      window.dispatchEvent(new Event('storage'));
      // Clean query parameters from URL path
      router.replace('/console');
      return;
    }

    const user = localStorage.getItem('orbit_user');
    if (!user) {
      router.push('/login');
    } else {
      try {
        const parsed = JSON.parse(user);
        if (!parsed.token) {
          router.push('/login');
          return;
        }
        setUserEmail(parsed.email || 'developer@orbit.dev');
        setProfileEmail(parsed.email || 'developer@orbit.dev');
        if (parsed.displayName) setDisplayName(parsed.displayName);

        // Fetch database parameters
        fetchDashboardData();

        // Check for success checkout parameter redirects
        const checkoutSuccess = searchParams.get('checkout_success');
        if (checkoutSuccess === 'true') {
          alert('Subscription upgrade successful!');
        }
      } catch (e) {
        router.push('/login');
      }
    }
  }, [router, searchParams]);

  // Live Logs Generation Effect
  useEffect(() => {
    if (activeTab !== 'logs') return;

    // Add initial log buffer if empty
    if (logLines.length === 0) {
      setLogLines([
        `[${new Date().toLocaleTimeString()}] ORBIT DAEMON v1.4.0 started. Listening for fs events.`,
        `[${new Date().toLocaleTimeString()}] Peer connection established: macbook-pro-m3 (RTT 0.8ms)`,
        `[${new Date().toLocaleTimeString()}] Peer connection established: ubuntu-threadripper-station (RTT 1.5ms)`,
        `[${new Date().toLocaleTimeString()}] Local indexing vault loaded in 12ms. SQLite sync database: OK.`,
      ]);
    }

    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString();
      const randomFile = SYNC_FILES[Math.floor(Math.random() * SYNC_FILES.length)];
      const randomSize = Math.floor(Math.random() * 5000) + 120;
      const targetDevice = devices[Math.floor(Math.random() * devices.length)]?.hostname || 'peer-node';
      const syncSpeed = (Math.random() * 1.5 + 0.1).toFixed(2);

      const syncLogs = [
        `[${time}] fs_event: file modified -> ${randomFile} (${randomSize} bytes)`,
        `[${time}] indexing: calculating cryptographic signature diff hashes...`,
        `[${time}] syncing: uploading changes -> target: ${targetDevice} via local-mesh`,
        `[${time}] sync_complete: successfully pushed -> ${randomFile} to ${targetDevice} in ${syncSpeed}ms (AES-GCM)`,
        `[${time}] heartbeat: ping latency to ${targetDevice} is ${(Math.random() * 2 + 0.5).toFixed(1)}ms`,
      ];

      // Pick a random event to append
      const randomLog = syncLogs[Math.floor(Math.random() * syncLogs.length)];
      setLogLines((prev) => [...prev.slice(-40), randomLog]); // Keep last 40 lines
    }, 2500);

    return () => clearInterval(interval);
  }, [activeTab, logLines, devices]);

  // Auto-scroll logs
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logLines]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyAes = () => {
    navigator.clipboard.writeText(aesKey);
    setCopiedAes(true);
    setTimeout(() => setCopiedAes(false), 2000);
  };

  const handleRotateKey = async () => {
    const userString = localStorage.getItem('orbit_user');
    if (!userString) return;
    try {
      const parsed = JSON.parse(userString);
      const token = parsed.token;

      const res = await fetch(`${API_BASE_URL}/api/console/license/rotate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setLicenseKey(data.licenseKey);
        alert('License verification key successfully rotated!');
      } else {
        alert(data.error || 'Failed to rotate key.');
      }
    } catch (err) {
      console.error('Error rotating key:', err);
    }
  };

  const handleGenerateAes = () => {
    const chars = '0123456789abcdef';
    let newKey = 'aes_gcm_256_vault_key_';
    for (let i = 0; i < 20; i++) {
      newKey += chars[Math.floor(Math.random() * 16)];
    }
    setAesKey(newKey);
    alert('Cryptographic AES key rotated locally.');
  };

  const handleRevokeDevice = async (id: string) => {
    const userString = localStorage.getItem('orbit_user');
    if (!userString) return;
    try {
      const parsed = JSON.parse(userString);
      const token = parsed.token;

      const res = await fetch(`${API_BASE_URL}/api/console/devices/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deviceRowId: id })
      });
      const data = await res.json();
      if (res.ok) {
        setDevices(devices.filter((dev) => dev.id !== id));
      } else {
        alert(data.error || 'Failed to revoke node authorization.');
      }
    } catch (err) {
      console.error('Error revoking device:', err);
    }
  };

  // Node Pairing simulation handler (Query verify route)
  const handleStartPairing = () => {
    if (!newDeviceName.trim()) {
      alert('Please enter a device hostname.');
      return;
    }
    setWizardStep(3);
    setPairingProgress(0);

    let progress = 0;
    const interval = setInterval(async () => {
      progress += 20;
      setPairingProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);

        try {
          const mockDeviceId = 'dev-fingerprint-' + Math.random().toString(36).substring(2, 15);
          const res = await fetch(`${API_BASE_URL}/api/license/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              licenseKey,
              deviceId: mockDeviceId,
              hostname: newDeviceName.trim(),
              platform: newDevicePlatform
            })
          });

          const data = await res.json();
          if (res.ok && data.status === 'VALID') {
            await fetchDashboardData();
            setShowPairModal(false);
            setNewDeviceName('');
            setWizardStep(1);
          } else {
            alert(data.message || 'Verification handshake failed.');
            setWizardStep(2);
          }
        } catch (err) {
          console.error('Pairing error:', err);
          alert('Network handshake failure.');
          setWizardStep(2);
        }
      }
    }, 200);
  };

  // Billing checkout simulation handler (Express stripe checkout)
  const handleUpgradeMock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);

    const userString = localStorage.getItem('orbit_user');
    if (!userString) return;

    try {
      const parsed = JSON.parse(userString);
      const token = parsed.token;

      const res = await fetch(`${API_BASE_URL}/api/billing/stripe/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planTier: 'mesh' })
      });

      const data = await res.json();
      if (res.ok) {
        // Redirect to session checkout (Stripe URL or sandbox success route)
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate billing session.');
        setPayLoading(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Billing connection failed.');
      setPayLoading(false);
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUserEmail(profileEmail);
    alert('Settings successfully updated!');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('orbit_user');
    window.dispatchEvent(new Event('storage'));
    router.push('/login');
  };

  const maxDeviceLimit = planTier === 'Free Tier'
    ? 3
    : planTier === 'Developer Tier'
      ? 10
      : 9999;

  if (!isClient || !userEmail) {
    return (
      <main style={{ minHeight: '100vh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a0a0a5', fontSize: '1.2rem', fontFamily: 'monospace' }}>Verifying Profile Session...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        overflow: 'hidden',
        padding: '110px 6% 60px 6%',
      }}
    >
      <Aurora />
      <CursorGlow />

      <div style={{ maxWidth: '1250px', margin: '0 auto', position: 'relative', zIndex: 10 }}>

        {/* Header Title */}
        <div style={{ borderBottom: '1px solid rgba(255, 0, 60, 0.12)', paddingBottom: '25px', marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Core Cluster Console
            </span>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', margin: '8px 0 2px 0', letterSpacing: '-1px' }}>
              OrBit <span style={{ color: 'var(--accent-red)' }}>Console</span>
            </h1>
            <p style={{ color: '#808085', fontSize: '0.85rem', margin: 0 }}>
              Device Profile: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{userEmail}</span> | Plan: <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{planTier}</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {userRole === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                style={{
                  background: 'var(--accent-red)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-orbitron)',
                  boxShadow: '0 0 12px var(--accent-red-glow)',
                }}
              >
                🛡️ Open Admin Panel
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255, 0, 60, 0.05)',
                border: '1.5px solid rgba(255, 0, 60, 0.25)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-red)';
                e.currentTarget.style.boxShadow = '0 0 12px var(--accent-red-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 0, 60, 0.05)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Dashboard Workspace */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '40px', alignItems: 'start' }}>

          {/* Left Sidebar Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'dashboard', name: 'Dashboard Overview', desc: 'Active nodes & license' },
              { id: 'wan', name: 'WAN Settings', desc: 'Relays & cryptokeys' },
              { id: 'logs', name: 'Live Sync Logs', desc: 'Realtime node events' },
              { id: 'billing', name: 'Billing & Tiers', desc: 'Plans and invoices' },
              { id: 'profile', name: 'Account Profile', desc: 'Credentials & details' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    background: isActive ? 'rgba(255, 0, 60, 0.08)' : 'rgba(10, 8, 8, 0.5)',
                    border: `1px solid ${isActive ? 'rgba(255, 0, 60, 0.3)' : 'rgba(255,255,255,0.04)'}`,
                    color: isActive ? '#fff' : '#a0a0a5',
                    textAlign: 'left',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    boxShadow: isActive ? 'inset 0 0 10px rgba(255,0,60,0.05)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(255, 0, 60, 0.15)';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'rgba(255, 0, 60, 0.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.color = '#a0a0a5';
                      e.currentTarget.style.background = 'rgba(10, 8, 8, 0.5)';
                    }
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, textShadow: isActive ? '0 0 5px rgba(255,0,60,0.4)' : 'none' }}>
                    {tab.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isActive ? '#ff859f' : '#606065', marginTop: '3px' }}>
                    {tab.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Main Panel Content */}
          <div style={{ minHeight: '500px' }}>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>

                  {/* License Key Card */}
                  <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>License Verification Key</h4>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Authorized</span>
                    </div>
                    <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                      Add this private key signature into your background daemon config file or VS Code extension settings panel.
                    </p>

                    {/* Key box */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#060404', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '6px', padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#ff859f', marginBottom: '20px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{licenseKey}</span>
                      <button onClick={handleCopyKey} style={{ background: 'transparent', border: 'none', color: copiedKey ? '#00e676' : '#a0a0a5', cursor: 'pointer', fontSize: '0.8rem' }}>
                        {copiedKey ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#808085' }}>
                      <span style={{ color: '#00e676' }}>🔒</span> Fixed Permanent License Key (Tier Signature Encrypted)
                    </div>
                  </TiltCard>

                  {/* Usage / Node Cluster Statistics */}
                  <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', marginBottom: '15px' }}>Cluster Node Capacity</h4>
                      <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                        Your tier controls the maximum number of pairing peer host nodes syncable inside your workspace cluster directory.
                      </p>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                        <span style={{ color: '#a0a0a5' }}>Active Allocation:</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{devices.length} / {maxDeviceLimit} Nodes</span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                        <div style={{ width: `${(devices.length / maxDeviceLimit) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ff003c, #ff5e00)', borderRadius: '4px' }} />
                      </div>

                      {planTier === 'Free Tier' && (
                        <p style={{ fontSize: '0.75rem', color: '#ff859f', margin: 0 }}>
                          Need more than 1 node? <span onClick={() => setActiveTab('billing')} style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Upgrade to Developer Tier</span>
                        </p>
                      )}
                    </div>
                  </TiltCard>

                </div>

                {/* Node Cluster List Module */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)' }}>Paired Daemon Nodes</h3>
                      <p style={{ color: '#808085', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Manage local and remote instances paired under your workspace profile key.</p>
                    </div>
                    <button
                      onClick={() => {
                        setWizardStep(1);
                        setShowPairModal(true);
                      }}
                      className="glow-btn"
                      style={{ background: 'linear-gradient(135deg, #25090f 0%, #0c0304 100%)', border: '1.5px solid var(--accent-red)', color: '#fff', padding: '10px 18px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-orbitron)' }}
                    >
                      Pair New Node
                    </button>
                  </div>

                  {/* Nodes Table/List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {devices.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 10px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                        <p style={{ color: '#606065', fontSize: '0.9rem', margin: 0 }}>No host nodes paired. Copy your license key above and trigger a local daemon connection loop.</p>
                      </div>
                    ) : (
                      devices.map((dev) => (
                        <div
                          key={dev.id}
                          style={{
                            background: 'rgba(255, 255, 255, 0.015)',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            borderRadius: '8px',
                            padding: '16px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '15px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {/* Platform Icon Badge */}
                            <div style={{ background: 'rgba(255, 0, 60, 0.08)', border: '1px solid rgba(255, 0, 60, 0.2)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff859f', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                              {dev.platform.substring(0, 3)}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dev.status === 'ACTIVE' ? '#00e676' : '#ff9100', boxShadow: dev.status === 'ACTIVE' ? '0 0 8px #00e676' : '0 0 8px #ff9100' }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{dev.hostname}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#606065', marginTop: '4px' }}>
                                Ping Latency: <span style={{ color: '#a0a0a5' }}>{dev.ping}ms</span> | Last Heartbeat: <span style={{ color: '#a0a0a5' }}>{dev.lastSeen}</span>
                              </div>
                            </div>
                          </div>

                          <button onClick={() => handleRevokeDevice(dev.id)} style={{ background: 'transparent', border: '1px solid rgba(255, 76, 117, 0.3)', color: '#ff4c75', padding: '8px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 0, 60, 0.08)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255, 76, 117, 0.3)'; }}>
                            Revoke Node
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: WAN & ENCRYPTION */}
            {activeTab === 'wan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>WAN Synchronization & Relays</h3>
                  <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '25px' }}>
                    Toggle WAN synchronization to route database diff packages across different local routers using secure TURN relays. This allows synchronization between home and office workspaces automatically.
                  </p>

                  {/* Toggle Card */}
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>Enable Global WAN Relay Network</h5>
                      <p style={{ color: '#606065', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Route packets over public internet using peer-to-peer punching relays.</p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => {
                        if (planTier === 'Free Tier') {
                          alert('Global WAN Relays require a Developer Tier subscription. Upgrade your plan in the Billing center.');
                          setActiveTab('billing');
                          return;
                        }
                        setWanEnabled(!wanEnabled);
                      }}
                      style={{
                        width: '52px',
                        height: '28px',
                        borderRadius: '20px',
                        background: wanEnabled ? 'var(--accent-red)' : '#1e1a1a',
                        border: `1px solid ${wanEnabled ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)'}`,
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 0.2s',
                        outline: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: '3px',
                          left: wanEnabled ? '27px' : '3px',
                          transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </button>
                  </div>

                  {/* STUN / TURN forms */}
                  <div style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>STUN Server Node</label>
                      <input
                        type="text"
                        value={stunServer}
                        onChange={(e) => setStunServer(e.target.value)}
                        disabled={!wanEnabled}
                        style={{
                          background: '#060404',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          color: wanEnabled ? '#fff' : '#606065',
                          fontSize: '0.85rem',
                          fontFamily: 'monospace',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Network Encryption Mode</label>
                      <select
                        disabled={!wanEnabled}
                        style={{
                          background: '#060404',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          color: wanEnabled ? '#fff' : '#606065',
                          fontSize: '0.85rem',
                          outline: 'none',
                        }}
                      >
                        <option>End-to-End AES-GCM-256 (Enforced)</option>
                        <option>E2E AES-CBC-128 (Legacy support)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Vault Cards */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>End-to-End Cryptographic Vault</h3>
                  <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '25px' }}>
                    OrBit encrypts index logs before transferring them. A local vault key is kept on your devices. Rotate this secret key to re-encrypt files across all synchronized daemon peers.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#060404', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '6px', padding: '14px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#ff859f', marginBottom: '20px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{aesKey}</span>
                    <button onClick={handleCopyAes} style={{ background: 'transparent', border: 'none', color: copiedAes ? '#00e676' : '#a0a0a5', cursor: 'pointer', fontSize: '0.85rem' }}>
                      {copiedAes ? 'Copied' : 'Copy Key'}
                    </button>
                  </div>

                  <button onClick={handleGenerateAes} className="glow-btn" style={{ background: 'rgba(255, 0, 60, 0.08)', border: '1.5px solid var(--accent-red)', color: '#fff', padding: '10px 18px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-orbitron)' }}>
                    Re-key Crypto Vault
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: LIVE SYNC LOG WATCHER */}
            {activeTab === 'logs' && (
              <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)' }}>Live Sync Log Terminal</h3>
                  <p style={{ color: '#808085', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Real-time event watcher capturing file modification heartbeats, indexing outputs, and secure pushes.</p>
                </div>

                {/* Terminal Console */}
                <div
                  ref={logTerminalRef}
                  style={{
                    background: '#020101',
                    border: '1.5px solid rgba(255, 0, 60, 0.25)',
                    borderRadius: '8px',
                    padding: '20px',
                    height: '380px',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-space-mono), monospace',
                    fontSize: '0.8rem',
                    color: '#ff859f',
                    boxShadow: 'inset 0 0 20px rgba(255, 0, 60, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    scrollBehavior: 'smooth',
                  }}
                >
                  {logLines.map((line, idx) => {
                    let color = '#ff859f'; // Default
                    if (line.includes('sync_complete')) color = '#00e676';
                    if (line.includes('established')) color = '#00b0ff';
                    if (line.includes('Scanning') || line.includes('heartbeat')) color = '#a0a0a5';
                    if (line.includes('started') || line.includes('OK')) color = '#ffd600';

                    return (
                      <div key={idx} style={{ color, lineBreak: 'anywhere' }}>
                        {line}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#606065' }}>
                  <span>Status: Connected to cluster daemon watcher process</span>
                  <button
                    onClick={() => setLogLines([])}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a0a0a5',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear Terminal Output
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: BILLING & SUBSCRIPTIONS */}
            {activeTab === 'billing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* Active Plan tier overview */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)', letterSpacing: '1px' }}>Current Allocation Status</span>
                    <h3 style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 900, margin: '5px 0' }}>{planTier} Tier</h3>
                    <p style={{ color: '#808085', fontSize: '0.85rem', margin: 0 }}>
                      Active peer slots: {devices.length} of {maxDeviceLimit} utilized. Next billing date: Aug 12, 2026.
                    </p>
                  </div>

                  {planTier === 'Free Tier' && (
                    <button
                      onClick={() => router.push('/checkout?plan=pro')}
                      className="glow-btn"
                      style={{
                        background: 'var(--accent-red)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        padding: '12px 24px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px var(--accent-red-glow)',
                        fontFamily: 'var(--font-orbitron)',
                      }}
                    >
                      Upgrade to Developer Tier
                    </button>
                  )}
                </div>

                {/* Plan Selection Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>

                  {/* Card: Community */}
                  <div style={{ background: planTier === 'Free Tier' ? 'rgba(255,0,60,0.02)' : 'rgba(10,8,8,0.5)', border: `1.5px solid ${planTier === 'Free Tier' ? 'var(--accent-red)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Free Tier</span>
                        {planTier === 'Free Tier' && <span style={{ fontSize: '0.7rem', background: 'var(--accent-red)', color: '#fff', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Current</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '15px' }}>
                        <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-orbitron)' }}>$0</span>
                        <span style={{ fontSize: '0.8rem', color: '#606065' }}>/ forever free</span>
                      </div>
                      <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                        Perfect for individual developers pairing code spaces locally across LAN routers.
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#a0a0a5' }}>
                        <li>✓ 1 Node license allocation</li>
                        <li>✓ Max 2 peers per project sync</li>
                        <li>✓ Max 1 active workspace directory</li>
                        <li>✓ Up to 50MB sync file size limits</li>
                        <li>✓ Real-time sync logging HUD</li>
                      </ul>
                    </div>
                  </div>

                  {/* Card: Mesh Cluster */}
                  <div style={{ background: planTier === 'Developer Tier' ? 'rgba(255,0,60,0.02)' : 'rgba(10,8,8,0.5)', border: `1.5px solid ${planTier === 'Developer Tier' ? 'var(--accent-red)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Developer Tier</span>
                        {planTier === 'Developer Tier' && <span style={{ fontSize: '0.7rem', background: 'var(--accent-red)', color: '#fff', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Current</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '15px' }}>
                        <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-orbitron)' }}>$9</span>
                        <span style={{ fontSize: '0.8rem', color: '#606065' }}>/ per month</span>
                      </div>
                      <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                        For power users syncing remote machines across WAN relays with encryption keys.
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#a0a0a5' }}>
                        <li>✓ 1 Active developer seat</li>
                        <li>✓ Max 10 peers per project sync</li>
                        <li>✓ Max 10 active workspace directories</li>
                        <li>✓ Up to 1GB sync file size limits</li>
                        <li>✓ 7-day logs history & dashboard metrics</li>
                      </ul>
                    </div>
                    {planTier === 'Free Tier' && (
                      <button onClick={() => router.push('/checkout?plan=pro')} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', marginTop: '20px' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.background = 'rgba(255,0,60,0.02)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                        Upgrade Plan
                      </button>
                    )}
                  </div>

                </div>

                {/* Invoice History Module */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '20px' }}>Billing Statements</h3>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#606065' }}>
                          <th style={{ padding: '12px 10px' }}>Invoice ID</th>
                          <th style={{ padding: '12px 10px' }}>Billing Date</th>
                          <th style={{ padding: '12px 10px' }}>Charge Amount</th>
                          <th style={{ padding: '12px 10px' }}>Payment Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#a0a0a5' }}>
                            <td style={{ padding: '12px 10px', color: '#fff', fontFamily: 'monospace' }}>{inv.id}</td>
                            <td style={{ padding: '12px 10px' }}>{inv.date}</td>
                            <td style={{ padding: '12px 10px' }}>{inv.amount}</td>
                            <td style={{ padding: '12px 10px' }}>
                              <span style={{ color: inv.status === 'PAID' ? '#00e676' : '#ff4c75', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                ● {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 5: ACCOUNT PROFILE */}
            {activeTab === 'profile' && (
              <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '25px' }}>Account Settings</h3>

                <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        style={{
                          background: '#060404',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Registered Email</label>
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        style={{
                          background: '#060404',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>New Password</label>
                      <input
                        type="password"
                        placeholder="Leave blank to keep current password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{
                          background: '#060404',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px 14px', height: '100%', marginTop: '22px' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>2-Factor Authentication</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTwoFactor(!twoFactor)}
                          style={{
                            width: '40px',
                            height: '22px',
                            borderRadius: '15px',
                            background: twoFactor ? 'var(--accent-red)' : '#1e1a1a',
                            border: '1px solid transparent',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: twoFactor ? '21px' : '2px', transition: 'left 0.2s' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="glow-btn" style={{ background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-orbitron)', alignSelf: 'start', marginTop: '10px' }}>
                    Save Profile Settings
                  </button>
                </form>

                <div style={{ borderTop: '1px solid rgba(255, 0, 60, 0.1)', marginTop: '40px', paddingTop: '30px' }}>
                  <h4 style={{ color: '#ff4c75', fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Danger Zone</h4>
                  <p style={{ color: '#808085', fontSize: '0.8rem', marginBottom: '15px' }}>Deleting your account will purge all active node pairings and licensing keys permanently.</p>
                  <button onClick={() => { if (confirm('Are you sure you want to permanently delete your developer profile?')) { alert('Account deletion simulator triggered.'); handleLogout(); } }} style={{ background: 'transparent', border: '1px solid #ff4c75', color: '#ff4c75', padding: '10px 18px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 76, 117, 0.06)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    Delete Account Permanent
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* NODE PAIRING WIZARD MODAL */}
      {showPairModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#0a0808', border: '1.5px solid var(--accent-red)', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '35px 30px', boxShadow: '0 0 30px rgba(255, 0, 60, 0.25)', position: 'relative' }}>

            {/* Close Button */}
            <button onClick={() => setShowPairModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#606065', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>

            {/* Header */}
            <div style={{ marginBottom: '25px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-red)', letterSpacing: '1px' }}>Step {wizardStep} of 3</span>
              <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800, margin: '5px 0 0 0', fontFamily: 'var(--font-orbitron)' }}>Pair Synchronization Node</h3>
            </div>

            {/* Wizard Steps */}

            {/* Step 1: Copy Command */}
            {wizardStep === 1 && (
              <div>
                <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                  Run the following curl command in your device's terminal folder to download the watch daemon.
                </p>
                <div style={{ background: '#030202', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px', fontSize: '0.75rem', fontFamily: 'monospace', color: '#ff859f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>curl -s https://orbit.dev/install.sh | sh</span>
                  <button onClick={() => navigator.clipboard.writeText('curl -s https://orbit.dev/install.sh | sh')} style={{ background: 'transparent', border: 'none', color: '#a0a0a5', cursor: 'pointer', fontSize: '0.75rem' }}>Copy</button>
                </div>
                <button onClick={() => setWizardStep(2)} className="glow-btn" style={{ width: '100%', background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-orbitron)' }}>
                  I Installed Daemon, Next
                </button>
              </div>
            )}

            {/* Step 2: Configure device */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Device Hostname Alias</label>
                  <input
                    type="text"
                    placeholder="e.g. desktop-workstation"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    style={{ background: '#030202', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 14px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Platform System</label>
                  <select
                    value={newDevicePlatform}
                    onChange={(e) => setNewDevicePlatform(e.target.value as any)}
                    style={{ background: '#030202', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 14px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                  >
                    <option value="macos">macOS</option>
                    <option value="windows">Windows</option>
                    <option value="linux">Linux</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                  <button onClick={() => setWizardStep(1)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0a5', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>Back</button>
                  <button onClick={handleStartPairing} className="glow-btn" style={{ flex: 1, background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-orbitron)' }}>Pair Node</button>
                </div>
              </div>
            )}

            {/* Step 3: Simulation */}
            {wizardStep === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,0,60,0.15)', borderTopColor: 'var(--accent-red)', borderRadius: '50%', animation: 'spin-slow 1s linear infinite', margin: '0 auto 20px auto' }} />
                <h5 style={{ color: '#fff', fontSize: '1rem', margin: '0 0 10px 0' }}>Establishing Secure Handshake...</h5>
                <p style={{ color: '#808085', fontSize: '0.8rem', margin: '0 0 15px 0' }}>Exchanging TLS certificates and binding socket relays ({pairingProgress}%). Do not close this drawer.</p>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${pairingProgress}%`, height: '100%', background: 'var(--accent-red)', transition: 'width 0.2s' }} />
                </div>
              </div>
            )}

          </div>
        </div>
      )}



    </main>
  );
}

export default function ConsolePage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a0a0a5', fontSize: '1.2rem', fontFamily: 'monospace' }}>Loading Console Engine...</p>
      </main>
    }>
      <ConsoleContent />
    </Suspense>
  );
}
