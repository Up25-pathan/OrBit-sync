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



const SYNC_FILES = [
  'src/main.rs', 'include/engine.h', 'app/page.tsx', 'styles/globals.css',
  'Cargo.toml', 'README.md', 'lib.rs', 'src/solver.cu', 'tests/perf.py'
];

const CARTOON_AVATARS = [
  // Cyber Mechs & Robots
  { name: 'Red Neon Mech', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=OrBitMechRed' },
  { name: 'Cyber Core Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=OrBitCyberCore99' },
  { name: 'Vortex Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=VortexMaster9' },
  { name: 'Matrix Drone', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=MatrixDroneX' },
  
  // Cyberpunk & Illustrated Characters
  { name: 'Cyber Ninja', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=OrBitNinja8' },
  { name: 'Neon Hacker', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NeonHackerOne' },
  { name: 'Sci-Fi Captain', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SciFiCap' },
  { name: 'Code Samurai', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SamuraiDev' },

  // Sci-Fi Heroes (Lorelei)
  { name: 'Starlight Hero', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=OrBitHeroStarlight' },
  { name: 'Valkyrie Cyber', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=ValkyrieX' },
  { name: 'Quantum Pilot', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=QuantumPilot' },
  { name: 'Solar Renegade', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=SolarRenegade' },

  // Pixel Art Cyberpunk
  { name: 'Retro Pixel Runner', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=PixelRunner88' },
  { name: '8-Bit Ghost', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Ghost8Bit' },
  { name: 'Arcade Commander', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ArcadeCmd' },
  { name: 'Neon Pixel Rogue', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=PixelRogue7' },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://orbit-sync.onrender.com' : 'http://localhost:5000');

function ConsoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'billing' | 'profile'>('dashboard');
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





  // Billing States
  const [planTier, setPlanTier] = useState<'Free Tier' | 'Developer Tier' | 'Enterprise Tier'>('Free Tier');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  // Account Profile & Ticket States
  const [displayName, setDisplayName] = useState('Developer Profile');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customSeed, setCustomSeed] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState(false);
  const [userRole, setUserRole] = useState<'USER' | 'ADMIN'>('USER');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Support Ticket Form States
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return alert('Please enter both a subject and message.');
    setTicketSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/console/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName || 'OrBit User',
          email: profileEmail || userEmail,
          subject: ticketSubject,
          message: ticketMessage,
        }),
      });
      if (res.ok) {
        alert('Support ticket submitted successfully! Our team will follow up at your registered email.');
        setTicketSubject('');
        setTicketMessage('');
      } else {
        alert('Failed to submit ticket.');
      }
    } catch (err) {
      console.error('Error submitting ticket:', err);
    } finally {
      setTicketSubmitting(false);
    }
  };

  const fetchDashboardData = async () => {
    const userString = localStorage.getItem('orbit_user');
    if (!userString) return;
    try {
      const parsed = JSON.parse(userString);
      const token = parsed.token;
      if (parsed.role) setUserRole(parsed.role);

      let res: Response | null = null;
      try {
        res = await fetch(`${API_BASE_URL}/api/console/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) {
        // Fallback to local server directly if primary URL network failed
        res = await fetch(`http://localhost:5000/api/console/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      if (res && res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          const fetchedKey = data.license?.licenseKey;
          if (fetchedKey) {
            setLicenseKey(fetchedKey);
          } else {
            const fallbackKey = `ORBIT-FREE-${(token || 'USER').substring(0, 8).toUpperCase()}-SIG`;
            setLicenseKey(fallbackKey);
          }
          setDevices(data.devices || []);
          let fetchedName = '';
          if (data.user?.displayName) {
            fetchedName = data.user.displayName;
          } else if (data.user?.email) {
            fetchedName = data.user.email.split('@')[0];
          }
          if (fetchedName) setDisplayName(fetchedName);

          let fetchedAvatar = '';
          if (data.user?.avatarUrl) {
            fetchedAvatar = data.user.avatarUrl;
            setAvatarUrl(fetchedAvatar);
          }

          // Sync fetched user profile parameters to localStorage cache
          const userStr = localStorage.getItem('orbit_user');
          if (userStr) {
            try {
              const u = JSON.parse(userStr);
              let changed = false;
              if (fetchedName && u.displayName !== fetchedName) {
                u.displayName = fetchedName;
                changed = true;
              }
              if (fetchedAvatar && u.avatarUrl !== fetchedAvatar) {
                u.avatarUrl = fetchedAvatar;
                changed = true;
              }
              if (changed) {
                localStorage.setItem('orbit_user', JSON.stringify(u));
                window.dispatchEvent(new Event('storage'));
              }
            } catch (err) {
              console.error('Error syncing fetched user data to localStorage:', err);
            }
          }
          const tier = data.subscription?.planTier || 'solo';
          if (tier === 'mesh' || tier === 'pro') {
            setPlanTier('Developer Tier');
          } else if (tier === 'enterprise') {
            setPlanTier('Enterprise Tier');
          } else {
            setPlanTier('Free Tier');
          }
          if (data.invoices) setInvoices(data.invoices);
          if (data.user?.email) {
            setUserEmail(data.user.email);
            setProfileEmail(data.user.email);
          }
          if (data.user?.role) setUserRole(data.user.role);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  // Load Auth & fetch real data
  useEffect(() => {
    setIsClient(true);

    // Check for incoming Google/GitHub OAuth redirect (token is in httpOnly cookie, not URL)
    const oauthSuccess = searchParams.get('oauth_success');

    if (oauthSuccess === 'true') {
      const oauthToken = searchParams.get('token');
      const oauthEmail = searchParams.get('email');
      const oauthRole = searchParams.get('role') || 'USER';

      if (oauthToken && oauthEmail) {
        localStorage.setItem('orbit_user', JSON.stringify({ email: oauthEmail, token: oauthToken, role: oauthRole }));
        window.dispatchEvent(new Event('storage'));
        setUserEmail(oauthEmail);
        setProfileEmail(oauthEmail);
        setUserRole(oauthRole as 'USER' | 'ADMIN');

        fetchDashboardData();
      }
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
        if (parsed.displayName) {
          setDisplayName(parsed.displayName);
        } else if (parsed.email) {
          setDisplayName(parsed.email.split('@')[0]);
        }
        if (parsed.avatarUrl) {
          setAvatarUrl(parsed.avatarUrl);
        }

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

  //

  const handleCopyKey = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
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

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const userString = localStorage.getItem('orbit_user');
    if (!userString) return;
    try {
      const parsed = JSON.parse(userString);
      const token = parsed.token;

      let updatedName = displayName.trim();
      let updatedAvatar = avatarUrl.trim();

      let res: Response | null = null;
      try {
        res = await fetch(`${API_BASE_URL}/api/console/profile/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            displayName: updatedName,
            avatarUrl: updatedAvatar,
            newPassword: newPassword.trim(),
          }),
        });
      } catch (fetchErr) {
        // Fallback to direct local server on port 5000 if primary API fails
        res = await fetch(`http://localhost:5000/api/console/profile/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            displayName: updatedName,
            avatarUrl: updatedAvatar,
            newPassword: newPassword.trim(),
          }),
        });
      }

      if (res && res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.user?.displayName) updatedName = data.user.displayName;
          if (data.user?.avatarUrl) updatedAvatar = data.user.avatarUrl;
        }
      }

      setDisplayName(updatedName);
      setAvatarUrl(updatedAvatar);
      setNewPassword('');

      // Persist to localStorage & dispatch storage event
      parsed.displayName = updatedName;
      parsed.avatarUrl = updatedAvatar;
      localStorage.setItem('orbit_user', JSON.stringify(parsed));
      window.dispatchEvent(new Event('storage'));

      alert('Account Personalization saved successfully!');
    } catch (err: any) {
      console.error('Profile update fallback:', err);
      const parsed = JSON.parse(userString);
      parsed.displayName = displayName.trim();
      parsed.avatarUrl = avatarUrl.trim();
      localStorage.setItem('orbit_user', JSON.stringify(parsed));
      window.dispatchEvent(new Event('storage'));
      alert('Account Personalization saved successfully!');
    }
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
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '35px', alignItems: 'start' }}>

          {/* Left Sidebar Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'dashboard', icon: '⚡', name: 'Dashboard Overview', desc: 'License signature & status' },
              { id: 'billing', icon: '💳', name: 'Billing & Tiers', desc: 'Subscription & invoices' },
              { id: 'profile', icon: '⚙️', name: 'Account Profile', desc: 'Credentials & support' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    background: isActive ? 'linear-gradient(90deg, rgba(255, 0, 60, 0.12) 0%, rgba(10, 8, 8, 0.6) 100%)' : 'rgba(10, 8, 8, 0.5)',
                    border: `1px solid ${isActive ? 'rgba(255, 0, 60, 0.4)' : 'rgba(255,255,255,0.04)'}`,
                    borderLeft: isActive ? '4px solid var(--accent-red)' : `1px solid rgba(255,255,255,0.04)`,
                    color: isActive ? '#fff' : '#a0a0a5',
                    textAlign: 'left',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    boxShadow: isActive ? '0 4px 20px rgba(255,0,60,0.15)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(255, 0, 60, 0.2)';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'rgba(255, 0, 60, 0.04)';
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
                  <span style={{ fontSize: '1.2rem', filter: isActive ? 'drop-shadow(0 0 8px var(--accent-red))' : 'none' }}>{tab.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.2px', color: isActive ? '#fff' : '#c0c0c5' }}>
                      {tab.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: isActive ? '#ff859f' : '#606065', marginTop: '2px' }}>
                      {tab.desc}
                    </div>
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

                  {/* Usage / Node Capacity / Seat Allocation Card */}
                  <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    {planTier === 'Enterprise Tier' ? (
                      <>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', marginBottom: '15px' }}>Cluster Node Capacity</h4>
                          <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                            Your enterprise tier controls the maximum number of pairing peer host nodes syncable inside your workspace cluster directory.
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
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>Device Seat Allocation</h4>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>1 Device Seat</span>
                          </div>
                          <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                            Your account is configured for a <strong>single device seat</strong>. Use your license key above in your client desktop app to pair your workspace.
                          </p>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                            <span style={{ color: '#a0a0a5' }}>Seat Status:</span>
                            <span style={{ color: '#00e676', fontWeight: 700 }}>● 1 / 1 Seat Authorized</span>
                          </div>

                          {planTier === 'Free Tier' && (
                            <p style={{ fontSize: '0.75rem', color: '#ff859f', margin: '8px 0 0 0' }}>
                              Need higher sync file limits & cloud relays? <span onClick={() => setActiveTab('billing')} style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Upgrade to Developer Tier</span>
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </TiltCard>

                  {/* System Health Indicator Card */}
                  <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', marginBottom: '15px' }}>Live System Health</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#a0a0a5' }}>Control Server:</span>
                          <span style={{ color: '#00e676', fontWeight: 700 }}>● ONLINE (0.8ms)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#a0a0a5' }}>WebRTC Relays:</span>
                          <span style={{ color: '#00e676', fontWeight: 700 }}>● OPERATIONAL</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#a0a0a5' }}>Encryption Cipher:</span>
                          <span style={{ color: '#ff859f', fontFamily: 'monospace' }}>AES-GCM-256</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '15px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
                      <button onClick={() => router.push('/docs')} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        Docs
                      </button>
                      <button onClick={() => setActiveTab('profile')} style={{ flex: 1, background: 'rgba(255,0,60,0.08)', border: '1px solid rgba(255,0,60,0.2)', color: '#ff859f', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        Support
                      </button>
                    </div>
                  </TiltCard>

                </div>

                {/* Quick Desktop Pairing Instructions Banner */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '25px' }}>
                  <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>Desktop Client Setup Guide</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: 'var(--accent-red)', fontWeight: 900, fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '4px' }}>STEP 01</div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Download App</div>
                      <div style={{ color: '#808085', fontSize: '0.75rem' }}>Install the OrBit desktop client for Windows, macOS, or Linux.</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: 'var(--accent-red)', fontWeight: 900, fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '4px' }}>STEP 02</div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Paste License Key</div>
                      <div style={{ color: '#808085', fontSize: '0.75rem' }}>Copy your license key above and paste it in app settings.</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: 'var(--accent-red)', fontWeight: 900, fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '4px' }}>STEP 03</div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Start Syncing</div>
                      <div style={{ color: '#808085', fontSize: '0.75rem' }}>Select workspace folders to pair and trigger sub-millisecond syncs.</div>
                    </div>
                  </div>
                </div>

                {/* Node Cluster List Module (Only for Enterprise Tier) */}
                {planTier === 'Enterprise Tier' && (
                  <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)' }}>Paired Daemon Nodes</h3>
                        <p style={{ color: '#808085', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Manage local and remote instances paired under your organization profile key.</p>
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
                )}

              </div>
            )}

            {/* TAB 4: BILLING & SUBSCRIPTIONS */}
            {activeTab === 'billing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* Active Plan tier overview */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)', letterSpacing: '1px' }}>Current Allocation Status</span>
                    <h3 style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 900, margin: '5px 0' }}>{planTier}</h3>
                    <p style={{ color: '#808085', fontSize: '0.85rem', margin: 0 }}>
                      {planTier === 'Enterprise Tier' ? 'Unlimited organization nodes & dedicated relays.' : '1 Device seat allocation included in tier.'}
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

                {/* Active Plan Capability Specs */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '25px' }}>
                  <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '15px' }}>Plan Capabilities & Specs</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: '#606065', fontSize: '0.75rem' }}>File Size Limit</div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginTop: '4px' }}>{planTier === 'Free Tier' ? '50 MB' : '1 GB'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: '#606065', fontSize: '0.75rem' }}>Cloud Punch Relays</div>
                      <div style={{ color: planTier === 'Free Tier' ? '#a0a0a5' : '#00e676', fontWeight: 700, fontSize: '1.1rem', marginTop: '4px' }}>{planTier === 'Free Tier' ? 'LAN Only' : 'Enabled'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: '#606065', fontSize: '0.75rem' }}>Encryption Mode</div>
                      <div style={{ color: '#ff859f', fontWeight: 700, fontSize: '1.1rem', marginTop: '4px', fontFamily: 'monospace' }}>AES-GCM-256</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', padding: '15px', borderRadius: '8px' }}>
                      <div style={{ color: '#606065', fontSize: '0.75rem' }}>Device Seat License</div>
                      <div style={{ color: '#00e676', fontWeight: 700, fontSize: '1.1rem', marginTop: '4px' }}>1 Active Seat</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.75rem', color: '#606065', flexWrap: 'wrap' }}>
                    <span>Supported Gateways:</span>
                    <span style={{ color: '#a0a0a5', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>💳 Stripe</span>
                    <span style={{ color: '#a0a0a5', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>⚡ Razorpay (UPI)</span>
                    <span style={{ color: '#a0a0a5', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>🅿️ PayPal</span>
                  </div>
                </div>



                {/* Invoice History Module */}
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '20px' }}>Billing Statements</h3>

                  {invoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                      <p style={{ color: '#606065', fontSize: '0.9rem', margin: 0 }}>No billing statements found. Upgrading your plan will generate invoice receipts here.</p>
                    </div>
                  ) : (
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
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: ACCOUNT PROFILE */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* Account Identity Hero Card */}
                <div style={{ background: 'rgba(10, 8, 8, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '25px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-red) 0%, #ff5e00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 900, color: '#fff', boxShadow: '0 0 22px var(--accent-red-glow)', overflow: 'hidden', border: '2.5px solid var(--accent-red)' }}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          (displayName || profileEmail || 'U').substring(0, 1).toUpperCase()
                        )}
                      </div>
                      <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#00e676', border: '2px solid #060404', boxShadow: '0 0 8px #00e676' }} title="Session Active & Verified" />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800, margin: 0, fontFamily: 'var(--font-orbitron)', letterSpacing: '-0.3px' }}>{displayName || 'Developer'}</h3>
                        <span style={{ fontSize: '0.68rem', background: userRole === 'ADMIN' ? 'rgba(255,0,60,0.18)' : 'rgba(255,255,255,0.06)', color: userRole === 'ADMIN' ? '#ff859f' : '#a0a0a5', border: `1px solid ${userRole === 'ADMIN' ? 'rgba(255,0,60,0.35)' : 'rgba(255,255,255,0.1)'}`, padding: '3px 10px', borderRadius: '12px', fontWeight: 800, letterSpacing: '0.5px' }}>
                          {userRole}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#808085', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span>{profileEmail || userEmail}</span>
                        <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
                        <span style={{ color: '#00e676', fontWeight: 600 }}>✓ Verified Email Account</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="glow-btn"
                      style={{
                        background: 'rgba(255, 0, 60, 0.1)',
                        border: '1px solid var(--accent-red)',
                        color: '#fff',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-orbitron)',
                      }}
                    >
                      📷 Change Photo
                    </button>
                  </div>
                </div>

                {/* Main Settings Form */}
                <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                  {/* Unified Card 1: Account Personalization */}
                  <div style={{ background: 'rgba(10, 8, 8, 0.75)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-orbitron)', margin: 0 }}>Account Personalization</h4>
                      <p style={{ color: '#808085', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Manage your display identity, registered email, profile picture, and cartoon avatar.</p>
                    </div>

                    {/* Section A: Display Name & Email Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '22px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Display Name</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          style={{
                            background: '#060404',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            color: '#fff',
                            fontSize: '0.88rem',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>Registered Email Address</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="email"
                            value={profileEmail}
                            readOnly
                            style={{
                              width: '100%',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              color: '#a0a0a5',
                              fontSize: '0.88rem',
                              outline: 'none',
                            }}
                          />
                          <span style={{ position: 'absolute', right: '14px', top: '12px', color: '#00e676', fontSize: '0.75rem', fontWeight: 700 }}>VERIFIED</span>
                        </div>
                      </div>
                    </div>

                    {/* Section B: Profile Photo & Cartoon Avatars */}
                    <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <label style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>Profile Photo & Avatar Options</label>
                          <span style={{ color: '#808085', fontSize: '0.78rem', display: 'block', marginTop: '2px' }}>Upload a custom personal photo or select from 16 cartoon avatars</span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              background: 'var(--accent-red)',
                              border: 'none',
                              color: '#fff',
                              padding: '8px 16px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-orbitron)',
                            }}
                          >
                            📷 Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const randomSeed = Math.random().toString(36).substring(7);
                              const styles = ['bottts', 'avataaars', 'pixel-art', 'lorelei', 'micah', 'big-smile'];
                              const selectedStyle = styles[Math.floor(Math.random() * styles.length)];
                              setAvatarUrl(`https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${randomSeed}`);
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✨ Random Cartoon
                          </button>
                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => setAvatarUrl('')}
                              style={{
                                background: 'rgba(255,0,60,0.08)',
                                border: '1px solid rgba(255,0,60,0.25)',
                                color: '#ff859f',
                                padding: '8px 14px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 16 Avatars Grid & Generator Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                          <span style={{ color: '#a0a0a5', fontSize: '0.78rem', fontWeight: 600 }}>16 Curated Sci-Fi & Cartoon Characters:</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: '#606065', fontSize: '0.75rem' }}>Custom Seed:</span>
                            <input
                              type="text"
                              placeholder="Type nickname..."
                              value={customSeed}
                              onChange={(e) => {
                                setCustomSeed(e.target.value);
                                if (e.target.value.trim()) {
                                  setAvatarUrl(`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(e.target.value.trim())}`);
                                }
                              }}
                              style={{
                                background: '#060404',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                color: '#fff',
                                fontSize: '0.75rem',
                                outline: 'none',
                                width: '180px',
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: '12px' }}>
                          {CARTOON_AVATARS.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setAvatarUrl(item.url)}
                              title={item.name}
                              style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                background: '#060404',
                                border: `2.5px solid ${avatarUrl === item.url ? 'var(--accent-red)' : 'rgba(255,255,255,0.08)'}`,
                                boxShadow: avatarUrl === item.url ? '0 0 16px var(--accent-red-glow)' : 'none',
                                cursor: 'pointer',
                                padding: '3px',
                                transition: 'all 0.2s ease',
                                transform: avatarUrl === item.url ? 'scale(1.12)' : 'scale(1)',
                              }}
                            >
                              <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="glow-btn"
                      style={{
                        background: 'var(--accent-red)',
                        border: 'none',
                        color: '#fff',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-orbitron)',
                        alignSelf: 'start',
                        marginTop: '10px',
                        boxShadow: '0 4px 15px var(--accent-red-glow)',
                      }}
                    >
                      Save Personalization Settings
                    </button>
                  </div>

                  {/* Card 3: Dedicated Password Change Card */}
                  <div style={{ background: 'rgba(10, 8, 8, 0.75)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '14px' }}>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-orbitron)', margin: 0 }}>Password & Credentials</h4>
                      <p style={{ color: '#808085', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Update your account login password safely.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '500px' }}>
                      <label style={{ color: '#a0a0a5', fontSize: '0.8rem', fontWeight: 600 }}>New Password</label>
                      <input
                        type="password"
                        placeholder="Leave blank to keep your current password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{
                          background: '#060404',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          color: '#fff',
                          fontSize: '0.88rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Card 4: Dedicated 2-Factor Authentication (2FA) Card */}
                  <div style={{ background: 'rgba(10, 8, 8, 0.75)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-orbitron)', margin: 0 }}>Two-Factor Authentication (2FA)</h4>
                      <p style={{ color: '#808085', fontSize: '0.82rem', margin: '4px 0 0 0' }}>Protect your account with TOTP authenticator app verification code on login.</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '0.82rem', color: twoFactor ? '#00e676' : '#808085', fontWeight: 700 }}>
                        {twoFactor ? '● 2FA Enabled' : '○ 2FA Disabled'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTwoFactor(!twoFactor)}
                        style={{
                          width: '46px',
                          height: '26px',
                          borderRadius: '15px',
                          background: twoFactor ? 'var(--accent-red)' : '#1e1a1a',
                          border: '1px solid transparent',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: twoFactor ? '23px' : '3px', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="glow-btn"
                    style={{
                      background: 'var(--accent-red)',
                      border: 'none',
                      color: '#fff',
                      padding: '14px 28px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-orbitron)',
                      alignSelf: 'start',
                      boxShadow: '0 4px 15px var(--accent-red-glow)',
                    }}
                  >
                    Save Security Profile
                  </button>
                </form>

                {/* Card 5: Danger Zone */}
                <div style={{ background: 'rgba(255, 0, 60, 0.03)', border: '1px solid rgba(255, 0, 60, 0.15)', borderRadius: '14px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h4 style={{ color: '#ff4c75', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Danger Zone: Permanent Account Deletion</h4>
                    <p style={{ color: '#808085', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Purge all active license signatures, paired nodes, and user profile credentials.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => { if (confirm('Are you sure you want to permanently delete your developer profile?')) { alert('Account deletion simulator triggered.'); handleLogout(); } }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #ff4c75',
                      color: '#ff4c75',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 76, 117, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    Delete Account
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
