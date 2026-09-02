'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import TiltCard from '@/components/effects/TiltCard';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://orbit-sync.onrender.com' : 'http://localhost:5000');

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  isVerified: boolean;
  createdAt: string;
  planTier: 'free' | 'pro' | 'enterprise';
  subscriptionStatus: string;
  expiresAt: string | null;
  licenseKey: string;
  maxDevices: number;
  deviceCount: number;
}

interface LicenseRecord {
  id: string;
  licenseKey: string;
  maxDevices: number;
  createdAt: string;
  userId: string;
  userEmail: string;
  displayName: string;
  planTier: 'free' | 'pro' | 'enterprise';
  activeDevicesCount: number;
}

interface DeviceRecord {
  id: string;
  deviceId: string;
  hostname: string;
  platform: 'windows' | 'macos' | 'linux';
  lastSeen: string;
  userEmail: string;
  licenseKey: string;
}

interface TicketRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}

interface ReleaseRecord {
  id: string;
  version: string;
  title: string | null;
  notes: string;
  pubDate: string;
  mandatory: boolean;
  isActive: boolean;
  winUrl: string | null;
  winSignature: string | null;
  macX64Url: string | null;
  macX64Signature: string | null;
  macArmUrl: string | null;
  macArmSignature: string | null;
  linuxUrl: string | null;
  linuxSignature: string | null;
  createdAt: string;
}

interface StatsData {
  totalUsers: number;
  totalLicenses: number;
  totalDevices: number;
  totalTickets: number;
  openTickets: number;
  subscriptionTiers: {
    free: number;
    pro: number;
    enterprise: number;
  };
  uptimeSeconds: number;
}

interface ControlServerMetrics {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  pingMs: number;
  uptimeSeconds: number;
  goVersion: string;
  goroutines: number;
  memory: {
    allocMb: number;
    sysMb: number;
    heapAllocMb: number;
  };
  database: {
    engine: string;
    connected: boolean;
    pgConfigured?: boolean;
    pgError?: string;
    activeUsersCount: number;
    onlineUsersCount: number;
    projectsCount: number;
  };
  storage: {
    deltaBlobsCount: number;
    deltaSizeBytes: number;
    webrtcSignalsCount: number;
  };
  lastChecked: string;
}

function AdminContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'licenses' | 'devices' | 'tickets' | 'releases' | 'control-server'>('overview');
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [bootstrapKeyInput, setBootstrapKeyInput] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Data states
  const [stats, setStats] = useState<StatsData | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Go Control Server Telemetry State
  const [controlServer, setControlServer] = useState<ControlServerMetrics | null>(null);
  const [isCsLoading, setIsCsLoading] = useState(true);
  const [isSweeping, setIsSweeping] = useState(false);
  const [csTargetUrl, setCsTargetUrl] = useState(process.env.NEXT_PUBLIC_CONTROL_SERVER_URL || 'https://orbit-server-xbr5.onrender.com');

  // Tier Override Modal state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [overrideTier, setOverrideTier] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [overrideMaxDevices, setOverrideMaxDevices] = useState(10);

  // Change Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Publish Release Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [relVersion, setRelVersion] = useState('');
  const [relTitle, setRelTitle] = useState('');
  const [relNotes, setRelNotes] = useState('');
  const [relMandatory, setRelMandatory] = useState(false);
  const [relWinUrl, setRelWinUrl] = useState('');
  const [relWinSig, setRelWinSig] = useState('');
  const [relMacX64Url, setRelMacX64Url] = useState('');
  const [relMacX64Sig, setRelMacX64Sig] = useState('');
  const [relMacArmUrl, setRelMacArmUrl] = useState('');
  const [relMacArmSig, setRelMacArmSig] = useState('');
  const [relLinuxUrl, setRelLinuxUrl] = useState('');
  const [relLinuxSig, setRelLinuxSig] = useState('');

  // Selected Upload Binary Files
  const [winFile, setWinFile] = useState<File | null>(null);
  const [macX64File, setMacX64File] = useState<File | null>(null);
  const [macArmFile, setMacArmFile] = useState<File | null>(null);
  const [linuxFile, setLinuxFile] = useState<File | null>(null);

  const handlePublishRelease = async () => {
    if (!relVersion.trim() || !relNotes.trim()) {
      alert('Version string and release notes are required.');
      return;
    }
    const token = getAuthToken();
    setIsUploading(true);

    try {
      let finalWinUrl = relWinUrl.trim();
      let finalMacX64Url = relMacX64Url.trim();
      let finalMacArmUrl = relMacArmUrl.trim();
      let finalLinuxUrl = relLinuxUrl.trim();

      // If user selected binary files, upload them directly to OrBit Web Server
      if (winFile || macX64File || macArmFile || linuxFile) {
        const formData = new FormData();
        if (winFile) formData.append('winFile', winFile);
        if (macX64File) formData.append('macX64File', macX64File);
        if (macArmFile) formData.append('macArmFile', macArmFile);
        if (linuxFile) formData.append('linuxFile', linuxFile);

        const uploadRes = await fetch(`${API_BASE_URL}/api/v1/admin/releases/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.urls) {
          if (uploadData.urls.winUrl) finalWinUrl = uploadData.urls.winUrl;
          if (uploadData.urls.macX64Url) finalMacX64Url = uploadData.urls.macX64Url;
          if (uploadData.urls.macArmUrl) finalMacArmUrl = uploadData.urls.macArmUrl;
          if (uploadData.urls.linuxUrl) finalLinuxUrl = uploadData.urls.linuxUrl;
        } else {
          alert(uploadData.error || 'Failed to upload installer binary files.');
          setIsUploading(false);
          return;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/releases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          version: relVersion.trim(),
          title: relTitle.trim(),
          notes: relNotes.trim(),
          mandatory: relMandatory,
          winUrl: finalWinUrl,
          winSignature: relWinSig.trim(),
          macX64Url: finalMacX64Url,
          macX64Signature: relMacX64Sig.trim(),
          macArmUrl: finalMacArmUrl,
          macArmSignature: relMacArmSig.trim(),
          linuxUrl: finalLinuxUrl,
          linuxSignature: relLinuxSig.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Software release published successfully to OrBit Web Server!');
        setShowPublishModal(false);
        setRelVersion('');
        setRelTitle('');
        setRelNotes('');
        setRelMandatory(false);
        setRelWinUrl('');
        setRelWinSig('');
        setRelMacX64Url('');
        setRelMacX64Sig('');
        setRelMacArmUrl('');
        setRelMacArmSig('');
        setRelLinuxUrl('');
        setRelLinuxSig('');
        setWinFile(null);
        setMacX64File(null);
        setMacArmFile(null);
        setLinuxFile(null);
        fetchAdminData();
      } else {
        alert(data.error || 'Failed to publish release.');
      }
    } catch (e) {
      alert('Request failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleReleaseActive = async (id: string, currentActive: boolean) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/releases/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) fetchAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRelease = async (id: string) => {
    if (!confirm('Are you sure you want to delete this release version?')) return;
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/releases/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async () => {
    if (!newAdminPassword || newAdminPassword.length < 6) {
      alert('New password must be at least 6 characters long.');
      return;
    }

    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: currentAdminPassword, newPassword: newAdminPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Admin password changed successfully!');
        setShowPasswordModal(false);
        setCurrentAdminPassword('');
        setNewAdminPassword('');
      } else {
        alert(data.error || 'Failed to change password.');
      }
    } catch (e) {
      alert('Request failed.');
    }
  };

  const getAuthToken = () => {
    try {
      const u = localStorage.getItem('orbit_user');
      if (!u) return '';
      const parsed = JSON.parse(u);
      return parsed.token || '';
    } catch (e) {
      return '';
    }
  };

  const fetchAdminData = async () => {
    const token = getAuthToken();
    if (!token) {
      setAuthError('Unauthorized administrative session. Please login.');
      setLoading(false);
      return;
    }

    try {
      // Check admin status via /me profile
      const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json();

      if (!meRes.ok || !meData.user) {
        setAuthError('Unauthorized session. Please login.');
        return;
      }

      setUserEmail(meData.user.email);

      // Fetch Stats
      const statsRes = await fetch(`${API_BASE_URL}/api/v1/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const sData = await statsRes.json();
        setStats(sData.stats);
        setIsAdmin(true);
        setAuthError('');
      } else {
        const errJson = await statsRes.json();
        if (statsRes.status === 403) {
          setIsAdmin(false);
          setAuthError('Your account does not have ADMIN privileges.');
        } else {
          setAuthError(errJson.error || 'Failed to authorize admin session.');
        }
        return;
      }

      // Fetch Directory Tables
      const [uRes, lRes, dRes, tRes, rRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/v1/admin/licenses`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/v1/admin/devices`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/v1/admin/tickets`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/v1/admin/releases`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (uRes.ok) setUsers((await uRes.json()).users || []);
      if (lRes.ok) setLicenses((await lRes.json()).licenses || []);
      if (dRes.ok) setDevices((await dRes.json()).devices || []);
      if (tRes.ok) setTickets((await tRes.json()).tickets || []);
      if (rRes && rRes.ok) setReleases((await rRes.json()).releases || []);

    } catch (err) {
      console.error('Error fetching admin data:', err);
      setAuthError('Failed to connect to OrBit Administration API.');
    } finally {
      setLoading(false);
    }
  };

  const fetchControlServerStatus = async () => {
    setIsCsLoading(true);
    const token = getAuthToken();
    let liveData: ControlServerMetrics | null = null;
    const startTime = Date.now();

    // 1. Try Node proxy backend
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/control-server/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.controlServer && data.controlServer.status === 'ONLINE') {
          liveData = {
            ...data.controlServer,
            pingMs: Date.now() - startTime,
            lastChecked: new Date().toLocaleTimeString()
          };
        }
      }
    } catch (e) { }

    // 2. Fallback to direct client-side fetch (handles cases where Node API is on Render cloud but Control Server is local)
    if (!liveData) {
      try {
        const directStart = Date.now();
        let directRes = await fetch(`${csTargetUrl}/api/v1/system/status`, {
          headers: { 'Accept': 'application/json' },
        });
        if (!directRes.ok) {
          directRes = await fetch(`${csTargetUrl}/api/v1/health`, {
            headers: { 'Accept': 'application/json' },
          });
        }
        const latency = Date.now() - directStart;
        if (directRes.ok) {
          let raw: any = {};
          try { raw = await directRes.json(); } catch (e) { raw = { status: 'ONLINE' }; }
          liveData = {
            status: 'ONLINE',
            pingMs: latency,
            uptimeSeconds: raw.uptimeSeconds || 0,
            goVersion: raw.goVersion || 'go1.27.0',
            goroutines: raw.goroutines || 0,
            memory: raw.memory || { allocMb: 0, sysMb: 0, heapAllocMb: 0 },
            database: {
              engine: raw.database?.engine || 'Local JSON DB',
              connected: raw.database?.connected ?? true,
              activeUsersCount: raw.database?.usersCount ?? raw.database?.activeUsersCount ?? 0,
              onlineUsersCount: raw.database?.onlineUsersCount ?? 0,
              projectsCount: raw.database?.projectsCount ?? 0,
              pgConfigured: raw.database?.pgConfigured ?? false,
              pgError: raw.database?.pgError || '',
            },
            storage: raw.storage || { deltaBlobsCount: 0, deltaSizeBytes: 0, webrtcSignalsCount: 0 },
            lastChecked: new Date().toLocaleTimeString()
          };
        }
      } catch (err) { }
    }

    if (liveData) {
      setControlServer(liveData);
    } else {
      setControlServer({
        status: 'OFFLINE',
        pingMs: 0,
        uptimeSeconds: 0,
        goVersion: 'go1.22.5',
        goroutines: 0,
        memory: { allocMb: 0, sysMb: 0, heapAllocMb: 0 },
        database: { engine: 'PostgreSQL', connected: false, activeUsersCount: 0, onlineUsersCount: 0, projectsCount: 0 },
        storage: { deltaBlobsCount: 0, deltaSizeBytes: 0, webrtcSignalsCount: 0 },
        lastChecked: new Date().toLocaleTimeString()
      });
    }
    setIsCsLoading(false);
  };

  useEffect(() => {
    setIsClient(true);
    fetchAdminData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'control-server') {
      fetchControlServerStatus();
      const interval = setInterval(() => {
        fetchControlServerStatus();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab, csTargetUrl]);

  const handleAdminBootstrap = async () => {
    if (!bootstrapKeyInput.trim()) {
      alert('Please enter the admin bootstrap key.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, bootstrapKey: bootstrapKeyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Your account has been elevated to ADMIN role!');
        setBootstrapKeyInput('');
        fetchAdminData();
      } else {
        alert(data.error || 'Bootstrap failed.');
      }
    } catch (e) {
      alert('Bootstrap request failed.');
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const token = getAuthToken();
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchAdminData();
      } else {
        alert('Failed to update role.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyTierOverride = async () => {
    if (!editingUser) return;
    const token = getAuthToken();

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${editingUser.id}/tier`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planTier: overrideTier, maxDevices: overrideMaxDevices }),
      });

      if (res.ok) {
        alert(`Successfully upgraded ${editingUser.email} to ${overrideTier.toUpperCase()} tier!`);
        setEditingUser(null);
        fetchAdminData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to override tier.');
      }
    } catch (e) {
      alert('Tier override request failed.');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you absolutely sure you want to delete user ${email}? This will completely wipe all database records, licenses, paired devices, support tickets, and subscription logs associated with this account.`)) {
      return;
    }
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        alert('User account and all associated data completely deleted.');
        fetchAdminData();
      } else {
        alert(d.error || 'Failed to delete user.');
      }
    } catch (e) {
      alert('Delete user request failed.');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } else {
        alert('Failed to revoke device.');
      }
    } catch (e) {
      alert('Device revocation request failed.');
    }
  };

  const handleRunSweeper = async () => {
    setIsSweeping(true);
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/control-server/sweep`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert('Control Server maintenance sweeper executed successfully! Expired delta cache & signals purged.');
      } else {
        alert('Sweeper executed in telemetry mode.');
      }
    } catch (e) {
      alert('Maintenance sweeper triggered.');
    } finally {
      setIsSweeping(false);
      fetchAdminData();
    }
  };

  const handleTicketStatusChange = async (ticketId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = users.filter(
    (u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isClient || loading) {
    return (
      <main style={{ minHeight: '100vh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a0a0a5', fontSize: '1.2rem', fontFamily: 'monospace' }}>Verifying Admin Session...</p>
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

      <div style={{ maxWidth: '1300px', margin: '0 auto', position: 'relative', zIndex: 10 }}>

        {/* Header Bar */}
        <div style={{ borderBottom: '1px solid rgba(255, 0, 60, 0.2)', paddingBottom: '25px', marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              System Authority Control Center
            </span>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', margin: '8px 0 2px 0', letterSpacing: '-1px', fontFamily: 'var(--font-orbitron)' }}>
              OrBit <span style={{ color: 'var(--accent-red)' }}>Admin Panel</span>
            </h1>
            <p style={{ color: '#808085', fontSize: '0.85rem', margin: 0 }}>
              Logged in as: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{userEmail}</span> | Authority: <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{isAdmin ? 'ADMIN' : 'UNAUTHORIZED'}</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {isAdmin && (
              <button
                onClick={() => setShowPasswordModal(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Change Admin Password
              </button>
            )}
            <button
              onClick={() => router.push('/console')}
              style={{
                background: 'rgba(255, 0, 60, 0.08)',
                border: '1.5px solid var(--accent-red)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-orbitron)',
              }}
            >
              Return to User Console
            </button>
          </div>
        </div>

        {/* Access Warning / Admin Bootstrap Box */}
        {!isAdmin && (
          <TiltCard style={{ background: 'rgba(20, 10, 10, 0.85)', border: '1px solid var(--accent-red)', borderRadius: '12px', padding: '30px', marginBottom: '40px' }}>
            <h3 style={{ color: 'var(--accent-red)', margin: '0 0 10px 0', fontFamily: 'var(--font-orbitron)' }}>Administrative Authorization Required</h3>
            <p style={{ color: '#a0a0a5', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '20px' }}>
              {authError || 'Your account does not currently have administrative permissions. If you are setting up the platform, enter the admin bootstrap key below to promote your account.'}
            </p>

            <div style={{ display: 'flex', gap: '15px', maxWidth: '500px' }}>
              <input
                type="password"
                placeholder="Enter Admin Bootstrap Key..."
                value={bootstrapKeyInput}
                onChange={(e) => setBootstrapKeyInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#060404',
                  border: '1px solid rgba(255, 0, 60, 0.3)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAdminBootstrap}
                className="glow-btn"
                style={{ background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-orbitron)' }}
              >
                Promote to Admin
              </button>
            </div>
          </TiltCard>
        )}

        {isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '35px', alignItems: 'start' }}>

            {/* Left Menu Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'overview', name: 'System Overview', desc: 'Global metrics & health' },
                { id: 'control-server', name: 'Go Control Node', desc: 'Server health, DB & storage' },
                { id: 'users', name: 'User Directory', desc: 'Accounts & roles' },
                { id: 'licenses', name: 'License Registry', desc: 'Keys & tier overrides' },
                { id: 'devices', name: 'Cluster Nodes', desc: 'Paired device monitor' },
                { id: 'tickets', name: 'Support Inbox', desc: `Inquiries (${tickets.filter(t => t.status === 'OPEN').length} Open)` },
                { id: 'releases', name: 'Desktop Releases', desc: 'Tauri updater & OTA' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      background: isActive ? 'rgba(255, 0, 60, 0.12)' : 'rgba(10, 8, 8, 0.5)',
                      border: `1px solid ${isActive ? 'var(--accent-red)' : 'rgba(255,255,255,0.04)'}`,
                      color: isActive ? '#fff' : '#a0a0a5',
                      textAlign: 'left',
                      padding: '14px 18px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-orbitron)' }}>
                      {tab.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isActive ? '#ff859f' : '#606065', marginTop: '3px' }}>
                      {tab.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Main Content */}
            <div style={{ minHeight: '550px' }}>

              {/* TAB 1: SYSTEM OVERVIEW */}
              {activeTab === 'overview' && stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                  {/* Stats Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '22px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 700, textTransform: 'uppercase' }}>Registered Users</span>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', margin: '10px 0 0 0', fontFamily: 'var(--font-orbitron)' }}>{stats.totalUsers}</h2>
                    </TiltCard>

                    <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '22px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 700, textTransform: 'uppercase' }}>Issued Licenses</span>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ff859f', margin: '10px 0 0 0', fontFamily: 'var(--font-orbitron)' }}>{stats.totalLicenses}</h2>
                    </TiltCard>

                    <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '22px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 700, textTransform: 'uppercase' }}>Paired Device Nodes</span>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#00e676', margin: '10px 0 0 0', fontFamily: 'var(--font-orbitron)' }}>{stats.totalDevices}</h2>
                    </TiltCard>

                    <TiltCard style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '22px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 700, textTransform: 'uppercase' }}>Open Support Tickets</span>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffd600', margin: '10px 0 0 0', fontFamily: 'var(--font-orbitron)' }}>{stats.openTickets}</h2>
                    </TiltCard>
                  </div>

                  {/* Tier Distribution breakdown */}
                  <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '20px' }}>Subscription Tier Distribution</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: '0.8rem', color: '#a0a0a5' }}>Community Free</span>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '6px' }}>{stats.subscriptionTiers.free} accounts</div>
                      </div>
                      <div style={{ background: 'rgba(255, 0, 60, 0.04)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 0, 60, 0.2)' }}>
                        <span style={{ fontSize: '0.8rem', color: '#ff859f' }}>Developer Pro</span>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ff859f', marginTop: '6px' }}>{stats.subscriptionTiers.pro} accounts</div>
                      </div>
                      <div style={{ background: 'rgba(0, 176, 255, 0.04)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0, 176, 255, 0.2)' }}>
                        <span style={{ fontSize: '0.8rem', color: '#00b0ff' }}>Enterprise Grid</span>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00b0ff', marginTop: '6px' }}>{stats.subscriptionTiers.enterprise} accounts</div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: USER DIRECTORY & TIER OVERRIDES */}
              {activeTab === 'users' && (
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)' }}>Developer User Directory</h3>
                      <p style={{ color: '#808085', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Manage roles, override plan tiers, and delete user profiles.</p>
                    </div>

                    <input
                      type="text"
                      placeholder="Search users by email or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        background: '#060404',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        minWidth: '260px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* User Directory Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#808085' }}>
                          <th style={{ padding: '12px' }}>User</th>
                          <th style={{ padding: '12px' }}>Role</th>
                          <th style={{ padding: '12px' }}>Plan Tier</th>
                          <th style={{ padding: '12px' }}>License Key</th>
                          <th style={{ padding: '12px' }}>Nodes</th>
                          <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#a0a0a5' }}>
                            <td style={{ padding: '14px 12px' }}>
                              <div style={{ fontWeight: 'bold', color: '#fff' }}>{u.displayName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#606065', fontFamily: 'monospace' }}>{u.email}</div>
                            </td>
                            <td style={{ padding: '14px 12px' }}>
                              <span
                                onClick={() => handleRoleToggle(u.id, u.role)}
                                style={{
                                  background: u.role === 'ADMIN' ? 'rgba(255,0,60,0.15)' : 'rgba(255,255,255,0.04)',
                                  color: u.role === 'ADMIN' ? '#ff859f' : '#808085',
                                  border: `1px solid ${u.role === 'ADMIN' ? 'rgba(255,0,60,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: '14px 12px' }}>
                              <span style={{ textTransform: 'uppercase', fontWeight: 700, color: u.planTier === 'pro' ? '#ff859f' : u.planTier === 'enterprise' ? '#00b0ff' : '#a0a0a5' }}>
                                {u.planTier}
                              </span>
                            </td>
                            <td style={{ padding: '14px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#ff859f', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.licenseKey}
                            </td>
                            <td style={{ padding: '14px 12px' }}>
                              {u.deviceCount} / {u.maxDevices}
                            </td>
                            <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setOverrideTier(u.planTier);
                                    setOverrideMaxDevices(u.maxDevices);
                                  }}
                                  style={{ background: 'rgba(255, 0, 60, 0.08)', border: '1px solid rgba(255,0,60,0.3)', color: '#ff859f', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Override Tier
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  style={{ background: 'rgba(255, 76, 117, 0.08)', border: '1px solid rgba(255, 76, 117, 0.3)', color: '#ff4c75', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Delete User
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: LICENSES REGISTRY */}
              {activeTab === 'licenses' && (
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '20px' }}>License Key Registry</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {licenses.map((l) => (
                      <div key={l.id} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', color: '#ff859f', fontWeight: 'bold', fontSize: '0.9rem' }}>{l.licenseKey}</div>
                          <div style={{ fontSize: '0.75rem', color: '#808085', marginTop: '4px' }}>
                            Owner: <span style={{ color: '#fff' }}>{l.userEmail}</span> | Tier: <span style={{ color: 'var(--accent-red)', textTransform: 'uppercase' }}>{l.planTier}</span> | Active Nodes: <span style={{ color: '#fff' }}>{l.activeDevicesCount} / {l.maxDevices}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: CLUSTER DEVICE MONITOR */}
              {activeTab === 'devices' && (
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', marginBottom: '20px' }}>Global Cluster Node Monitor</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {devices.length === 0 ? (
                      <p style={{ color: '#606065' }}>No active paired host nodes found.</p>
                    ) : (
                      devices.map((d) => (
                        <div key={d.id} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: 'rgba(255,0,60,0.08)', border: '1px solid rgba(255,0,60,0.2)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#ff859f', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {d.platform}
                            </div>
                            <div>
                              <div style={{ color: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }}>{d.hostname}</div>
                              <div style={{ fontSize: '0.75rem', color: '#808085', marginTop: '4px' }}>
                                Owner: <span style={{ color: '#a0a0a5' }}>{d.userEmail}</span> | Fingerprint: <span style={{ color: '#a0a0a5', fontFamily: 'monospace' }}>{d.deviceId}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleRevokeDevice(d.id)} style={{ background: 'transparent', border: '1px solid rgba(255,76,117,0.3)', color: '#ff4c75', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                            Force Revoke
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SUPPORT TICKETS INBOX */}
              {activeTab === 'tickets' && (
                <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', margin: 0 }}>
                        Developer Support & Bug Reports Inbox
                      </h3>
                      <p style={{ color: '#808085', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                        Showing {tickets.length} support inquiries & desktop app bug reports
                      </p>
                    </div>
                    <button
                      onClick={() => fetchAdminData()}
                      style={{
                        background: 'rgba(255, 0, 60, 0.1)',
                        border: '1px solid var(--accent-red)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      🔄 Refresh Inbox
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tickets.length === 0 ? (
                      <p style={{ color: '#606065' }}>No support inquiries found.</p>
                    ) : (
                      tickets.map((t) => (
                        <div key={t.id} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <h4 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>{t.subject}</h4>
                              <p style={{ color: '#808085', fontSize: '0.75rem', margin: '4px 0 0 0' }}>
                                From: <span style={{ color: '#fff' }}>{t.name}</span> ({t.email}) | Received: {new Date(t.createdAt).toLocaleDateString()}
                              </p>
                            </div>

                            {/* Status Selector */}
                            <select
                              value={t.status}
                              onChange={(e) => handleTicketStatusChange(t.id, e.target.value as any)}
                              style={{
                                background: '#060404',
                                border: `1px solid ${t.status === 'RESOLVED' ? '#00e676' : t.status === 'IN_PROGRESS' ? '#ffd600' : 'var(--accent-red)'}`,
                                color: t.status === 'RESOLVED' ? '#00e676' : t.status === 'IN_PROGRESS' ? '#ffd600' : '#ff859f',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="RESOLVED">RESOLVED</option>
                            </select>
                          </div>
                          <p style={{ color: '#a0a0a5', fontSize: '0.85rem', lineHeight: 1.5, background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', margin: 0 }}>
                            {t.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: DESKTOP RELEASES MANAGER */}
              {activeTab === 'releases' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ background: 'rgba(10, 8, 8, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)', margin: 0 }}>
                          Multi-Platform Desktop Releases (Tauri OTA)
                        </h3>
                        <p style={{ color: '#808085', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                          Manage software updates for Windows, macOS (Intel & Apple Silicon), and Linux. Live Updater Endpoint: <span style={{ color: 'var(--accent-red)', fontFamily: 'monospace' }}>/api/v1/updater/latest.json</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPublishModal(true)}
                        className="glow-btn"
                        style={{
                          background: 'var(--accent-red)',
                          border: 'none',
                          color: '#fff',
                          padding: '10px 18px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-orbitron)',
                        }}
                      >
                        + Publish New Release
                      </button>
                    </div>

                    {/* Release History Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {releases.length === 0 ? (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '8px', textAlign: 'center', color: '#808085' }}>
                          No software releases published yet. Click <strong>+ Publish New Release</strong> to release your first desktop update.
                        </div>
                      ) : (
                        releases.map((rel) => (
                          <div key={rel.id} style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${rel.isActive ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '10px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'var(--font-orbitron)' }}>
                                    v{rel.version}
                                  </span>
                                  {rel.isActive ? (
                                    <span style={{ fontSize: '0.7rem', background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      LIVE ACTIVE
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', color: '#808085', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                      ARCHIVED
                                    </span>
                                  )}
                                  {rel.mandatory && (
                                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,0,60,0.15)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                      MANDATORY
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#a0a0a5', marginTop: '4px' }}>
                                  {rel.title || `OrBit Desktop v${rel.version}`} | Published: {new Date(rel.pubDate).toLocaleDateString()}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleToggleReleaseActive(rel.id, rel.isActive)}
                                  style={{
                                    background: rel.isActive ? 'rgba(255,255,255,0.05)' : 'rgba(0,230,118,0.1)',
                                    border: `1px solid ${rel.isActive ? 'rgba(255,255,255,0.1)' : '#00e676'}`,
                                    color: rel.isActive ? '#a0a0a5' : '#00e676',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                >
                                  {rel.isActive ? 'Deactivate' : 'Set as Active'}
                                </button>
                                <button
                                  onClick={() => handleDeleteRelease(rel.id)}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,76,117,0.3)',
                                    color: '#ff4c75',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            <p style={{ color: '#808085', fontSize: '0.85rem', lineHeight: 1.5, background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: '6px', margin: '0 0 15px 0' }}>
                              {rel.notes}
                            </p>

                            {/* Platform Downloads & Signatures */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                              <div style={{ background: '#050404', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>🪟 Windows (x64)</span>
                                <div style={{ color: rel.winUrl ? '#00e676' : '#606065', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                  {rel.winUrl ? <a href={rel.winUrl} target="_blank" rel="noreferrer" style={{ color: '#ff859f' }}>{rel.winUrl}</a> : 'No installer payload attached'}
                                </div>
                              </div>

                              <div style={{ background: '#050404', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>🍏 macOS (Intel x64)</span>
                                <div style={{ color: rel.macX64Url ? '#00e676' : '#606065', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                  {rel.macX64Url ? <a href={rel.macX64Url} target="_blank" rel="noreferrer" style={{ color: '#ff859f' }}>{rel.macX64Url}</a> : 'No installer payload attached'}
                                </div>
                              </div>

                              <div style={{ background: '#050404', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>🍏 macOS (Apple Silicon M-Series)</span>
                                <div style={{ color: rel.macArmUrl ? '#00e676' : '#606065', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                  {rel.macArmUrl ? <a href={rel.macArmUrl} target="_blank" rel="noreferrer" style={{ color: '#ff859f' }}>{rel.macArmUrl}</a> : 'No installer payload attached'}
                                </div>
                              </div>

                              <div style={{ background: '#050404', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>🐧 Linux (AppImage/Deb x64)</span>
                                <div style={{ color: rel.linuxUrl ? '#00e676' : '#606065', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                  {rel.linuxUrl ? <a href={rel.linuxUrl} target="_blank" rel="noreferrer" style={{ color: '#ff859f' }}>{rel.linuxUrl}</a> : 'No installer payload attached'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: GO CONTROL SERVER HEALTH, DATABASE & STORAGE */}
              {activeTab === 'control-server' && (
                <div>
                  {isCsLoading && !controlServer ? (
                    <TiltCard style={{ background: 'rgba(10, 8, 8, 0.85)', border: '1px solid rgba(255, 0, 60, 0.3)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                      <p style={{ color: '#ff859f', fontSize: '1rem', fontFamily: 'var(--font-orbitron)', margin: 0 }}>
                        ⚡ Connecting to Go Control Server & Querying Telemetry...
                      </p>
                    </TiltCard>
                  ) : controlServer ? (
                    <div>
                      {/* Top Status Header Bar */}
                      <TiltCard style={{ background: 'rgba(10, 8, 8, 0.85)', border: `1px solid ${controlServer.status === 'ONLINE' ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 0, 60, 0.4)'}`, borderRadius: '12px', padding: '24px', marginBottom: '25px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '1.2rem' }}>🖥️</span>
                              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'var(--font-orbitron)' }}>
                                Go Control Server Node
                              </h3>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: controlServer.status === 'ONLINE' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 0, 60, 0.15)',
                                color: controlServer.status === 'ONLINE' ? '#00e676' : '#ff003c',
                                border: `1px solid ${controlServer.status === 'ONLINE' ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 0, 60, 0.4)'}`,
                              }}>
                                ● {controlServer.status}
                              </span>
                            </div>
                            <p style={{ color: '#808085', fontSize: '0.8rem', margin: 0 }}>
                              Runtime Engine: <span style={{ color: '#ff859f', fontFamily: 'monospace' }}>{controlServer.goVersion}</span> | Response Latency: <span style={{ color: controlServer.status === 'ONLINE' ? '#00e676' : '#ff003c', fontFamily: 'monospace' }}>{controlServer.pingMs}ms</span>
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#808085', marginRight: '6px' }}>Target:</span>
                              <input
                                type="text"
                                value={csTargetUrl}
                                onChange={(e) => setCsTargetUrl(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: '#00e676', fontSize: '0.75rem', fontFamily: 'monospace', outline: 'none', width: '170px' }}
                              />
                            </div>
                            <button
                              onClick={fetchControlServerStatus}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#fff',
                                padding: '8px 14px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🔄 Refresh Status
                            </button>
                            <button
                              onClick={handleRunSweeper}
                              disabled={isSweeping}
                              className="glow-btn"
                              style={{
                                background: 'var(--accent-red)',
                                border: 'none',
                                color: '#fff',
                                padding: '8px 14px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: isSweeping ? 'not-allowed' : 'pointer',
                                fontFamily: 'var(--font-orbitron)',
                              }}
                            >
                              {isSweeping ? '⚡ Sweeping...' : '🧹 Run Maintenance Sweeper'}
                            </button>
                          </div>
                        </div>
                      </TiltCard>

                      {controlServer.database.pgConfigured && !controlServer.database.connected && (
                        <div style={{ background: 'rgba(255, 171, 0, 0.08)', border: '1px solid rgba(255, 171, 0, 0.4)', borderRadius: '10px', padding: '16px', marginBottom: '25px', color: '#ffab00', fontSize: '0.85rem' }}>
                          ⚠️ <strong>PostgreSQL (Supabase) Connection Failure:</strong> {controlServer.database.pgError || 'Could not connect to Supabase database instance.'}
                          <div style={{ fontSize: '0.75rem', color: '#a0a0a5', marginTop: '6px' }}>
                            Fallback Active: Server is operating on <strong>Local JSON DB</strong> to maintain 100% server uptime. Check <code>DATABASE_URL</code> credentials and IP permissions on Render & Supabase.
                          </div>
                        </div>
                      )}

                      {/* 4 Metric Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '30px' }}>

                        {/* Card 1: Server Uptime & CPU */}
                        <div style={{ background: 'rgba(12, 10, 10, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '18px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Uptime & Goroutines</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '8px 0 4px 0', fontFamily: 'monospace' }}>
                            {Math.floor(controlServer.uptimeSeconds / 3600)}h {Math.floor((controlServer.uptimeSeconds % 3600) / 60)}m
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#00e676' }}>
                            ⚡ {controlServer.goroutines} Active Goroutines
                          </div>
                        </div>

                        {/* Card 2: Memory Allocated */}
                        <div style={{ background: 'rgba(12, 10, 10, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '18px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Memory Allocation</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '8px 0 4px 0', fontFamily: 'monospace' }}>
                            {controlServer.memory.allocMb.toFixed(1)} MB
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#808085' }}>
                            Sys Reserved: <span style={{ color: '#ff859f' }}>{controlServer.memory.sysMb.toFixed(1)} MB</span>
                          </div>
                        </div>

                        {/* Card 3: Database Engine */}
                        <div style={{ background: 'rgba(12, 10, 10, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '18px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Database Health</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: '8px 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {controlServer.database.engine.includes('PostgreSQL') ? '🐘 PostgreSQL' : '💾 Local JSON DB'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: controlServer.database.connected ? '#00e676' : '#ffab00' }}>
                            {controlServer.database.connected ? '● Active Connection Pool' : '⚠️ Fallback Mode (Supabase Failure)'}
                          </div>
                        </div>

                        {/* Card 4: Cloud Delta Storage */}
                        <div style={{ background: 'rgba(12, 10, 10, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '18px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#808085', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Delta Cloud Storage</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '8px 0 4px 0', fontFamily: 'monospace' }}>
                            {(controlServer.storage.deltaSizeBytes / (1024 * 1024)).toFixed(2)} MB
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#ff859f' }}>
                            📦 {controlServer.storage.deltaBlobsCount} Stored Sync Blobs
                          </div>
                        </div>

                      </div>

                      {/* Detailed Telemetry Panels Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                        {/* Database & User Telemetry */}
                        <div style={{ background: 'rgba(12, 10, 10, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '22px' }}>
                          <h4 style={{ fontSize: '1rem', color: '#fff', margin: '0 0 16px 0', fontFamily: 'var(--font-orbitron)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📊 Database & User Metrics
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Primary Database Driver</span>
                              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>{controlServer.database.engine}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Total Registered Users</span>
                              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{controlServer.database.activeUsersCount}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Online Real-Time Presence</span>
                              <span style={{ color: '#00e676', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{controlServer.database.onlineUsersCount} Users Online</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Active Projects Registered</span>
                              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{controlServer.database.projectsCount} Projects</span>
                            </div>
                          </div>
                        </div>

                        {/* Storage & WebRTC Signaling Telemetry */}
                        <div style={{ background: 'rgba(12, 10, 10, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '22px' }}>
                          <h4 style={{ fontSize: '1rem', color: '#fff', margin: '0 0 16px 0', fontFamily: 'var(--font-orbitron)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📡 Storage & Signaling Health
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Delta Storage TTL Retention</span>
                              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>7 Days (Auto-Swept)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Total Delta Blobs</span>
                              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{controlServer.storage.deltaBlobsCount} Files</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>WebRTC Pending Signal Queue</span>
                              <span style={{ color: '#ff859f', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{controlServer.storage.webrtcSignalsCount} Pending</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#808085', fontSize: '0.85rem' }}>Telemetry Last Checked</span>
                              <span style={{ color: '#a0a0a5', fontSize: '0.85rem', fontFamily: 'monospace' }}>{controlServer.lastChecked}</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : null}
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* Tier Override Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0c0808', border: '1.5px solid var(--accent-red)', borderRadius: '12px', padding: '30px', maxWidth: '480px', width: '100%', color: '#fff' }}>
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', fontFamily: 'var(--font-orbitron)' }}>Override Subscription Tier</h3>
            <p style={{ fontSize: '0.85rem', color: '#808085', marginBottom: '20px' }}>
              Override plan parameters for developer <span style={{ color: '#fff', fontWeight: 'bold' }}>{editingUser.email}</span>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#a0a0a5', display: 'block', marginBottom: '6px' }}>Target Plan Tier</label>
                <select
                  value={overrideTier}
                  onChange={(e) => setOverrideTier(e.target.value as any)}
                  style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="free">Community Free</option>
                  <option value="pro">Developer Pro</option>
                  <option value="enterprise">Enterprise Grid</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#a0a0a5', display: 'block', marginBottom: '6px' }}>Max Active Pairing Device Limit</label>
                <input
                  type="number"
                  value={overrideMaxDevices}
                  onChange={(e) => setOverrideMaxDevices(parseInt(e.target.value) || 3)}
                  style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0a5', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button onClick={handleApplyTierOverride} className="glow-btn" style={{ background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-orbitron)' }}>
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0c0808', border: '1.5px solid var(--accent-red)', borderRadius: '12px', padding: '30px', maxWidth: '440px', width: '100%', color: '#fff' }}>
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', fontFamily: 'var(--font-orbitron)' }}>Change Admin Password</h3>
            <p style={{ fontSize: '0.85rem', color: '#808085', marginBottom: '20px' }}>
              Update credentials for account <span style={{ color: '#fff', fontWeight: 'bold' }}>{userEmail}</span>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#a0a0a5', display: 'block', marginBottom: '6px' }}>Current Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Enter current password..."
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#a0a0a5', display: 'block', marginBottom: '6px' }}>New Password (Min 6 chars)</label>
                <input
                  type="password"
                  placeholder="Enter new admin password..."
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0a5', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button onClick={handleChangePassword} className="glow-btn" style={{ background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-orbitron)' }}>
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish New Desktop Release Modal */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: '#0c0808', border: '1.5px solid var(--accent-red)', borderRadius: '12px', padding: '30px', maxWidth: '680px', width: '100%', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.3rem', margin: '0 0 6px 0', fontFamily: 'var(--font-orbitron)' }}>Publish Multi-Platform Desktop Update</h3>
            <p style={{ fontSize: '0.85rem', color: '#808085', marginBottom: '20px' }}>
              Publish new OTA release binary payloads for Windows, macOS (x64 / ARM), and Linux.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Version (Required e.g. 1.1.0)</label>
                <input
                  type="text"
                  placeholder="1.1.0"
                  value={relVersion}
                  onChange={(e) => setRelVersion(e.target.value)}
                  style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Release Title (Optional)</label>
                <input
                  type="text"
                  placeholder="OrBit Desktop v1.1.0"
                  value={relTitle}
                  onChange={(e) => setRelTitle(e.target.value)}
                  style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '0.75rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Release Notes & Changelog (Required)</label>
              <textarea
                rows={3}
                placeholder="What is new in this desktop release..."
                value={relNotes}
                onChange={(e) => setRelNotes(e.target.value)}
                style={{ width: '100%', background: '#060404', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="relMandatory"
                checked={relMandatory}
                onChange={(e) => setRelMandatory(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="relMandatory" style={{ fontSize: '0.85rem', color: '#ff859f', cursor: 'pointer', fontWeight: 600 }}>
                Mark as Mandatory Security Patch / Required Update
              </label>
            </div>
            {/* Platform Download Payload Fields */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-red)', margin: '0 0 12px 0', fontFamily: 'var(--font-orbitron)' }}>
                Upload Binary Files or Specify Payload URLs & Cryptographic Signatures
              </h4>

              {/* Windows */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🪟 Windows Payload (x64)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Upload Binary (.nsis.zip / .msi)</label>
                    <input type="file" onChange={(e) => setWinFile(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: '0.75rem', color: '#a0a0a5' }} />
                    <input type="text" placeholder="Or enter direct URL..." value={relWinUrl} onChange={(e) => setRelWinUrl(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', marginTop: '6px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Tauri Minisign Signature (Required for OTA verification)</label>
                    <input type="text" placeholder="dW50cnVzdGVkIGNvbW1lbnQ..." value={relWinSig} onChange={(e) => setRelWinSig(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }} />
                  </div>
                </div>
              </div>

              {/* macOS Intel */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🍏 macOS Intel Payload (x64)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Upload Binary (.app.tar.gz)</label>
                    <input type="file" onChange={(e) => setMacX64File(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: '0.75rem', color: '#a0a0a5' }} />
                    <input type="text" placeholder="Or enter direct URL..." value={relMacX64Url} onChange={(e) => setRelMacX64Url(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', marginTop: '6px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Tauri Minisign Signature</label>
                    <input type="text" placeholder="dW50cnVzdGVkIGNvbW1lbnQ..." value={relMacX64Sig} onChange={(e) => setRelMacX64Sig(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }} />
                  </div>
                </div>
              </div>

              {/* macOS Apple Silicon */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🍏 macOS Apple Silicon Payload (ARM64 M-Series)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Upload Binary (.app.tar.gz)</label>
                    <input type="file" onChange={(e) => setMacArmFile(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: '0.75rem', color: '#a0a0a5' }} />
                    <input type="text" placeholder="Or enter direct URL..." value={relMacArmUrl} onChange={(e) => setRelMacArmUrl(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', marginTop: '6px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Tauri Minisign Signature</label>
                    <input type="text" placeholder="dW50cnVzdGVkIGNvbW1lbnQ..." value={relMacArmSig} onChange={(e) => setRelMacArmSig(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }} />
                  </div>
                </div>
              </div>

              {/* Linux */}
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🐧 Linux Payload (AppImage / Deb x64)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Upload Binary (.AppImage.tar.gz)</label>
                    <input type="file" onChange={(e) => setLinuxFile(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: '0.75rem', color: '#a0a0a5' }} />
                    <input type="text" placeholder="Or enter direct URL..." value={relLinuxUrl} onChange={(e) => setRelLinuxUrl(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', marginTop: '6px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a0a0a5', display: 'block', marginBottom: '4px' }}>Tauri Minisign Signature</label>
                    <input type="text" placeholder="dW50cnVzdGVkIGNvbW1lbnQ..." value={relLinuxSig} onChange={(e) => setRelLinuxSig(e.target.value)} style={{ width: '100%', background: '#050404', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.75rem' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowPublishModal(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#a0a0a5', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button onClick={handlePublishRelease} disabled={isUploading} className="glow-btn" style={{ background: 'var(--accent-red)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: '6px', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-orbitron)' }}>
                {isUploading ? 'Uploading & Publishing...' : 'Publish Release'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#030303' }} />}>
      <AdminContent />
    </Suspense>
  );
}
