'use client';

import React, { useState } from 'react';
import Aurora from '@/components/effects/Aurora';
import CursorGlow from '@/components/effects/CursorGlow';

const DOCS_CONTENT = {
  'getting-started': {
    title: 'Module 01: Getting Started & System Setup',
    subtitle: 'System Requirements, Account Elevation & License Key Activation',
    desc: 'OrBit is a next-generation, decentralized local-first collaboration engine designed for software engineering teams. Unlike cloud-centric code hosting platforms, OrBit operates directly on your local machine using P2P mesh networking and hidden Shadow Git repositories.',
    sections: [
      {
        title: 'System Architecture Concept',
        body: 'OrBit splits collaboration into two distinct planes:\n\n1. Local Data Plane: All code diffs, snapshot calculations, and file transfers execute locally using Rust and direct P2P mesh networking.\n2. Central Control Plane: A lightweight Go server manages identity verification, friend requests, presence heartbeats, and encrypted dead-drop relays for offline peers.',
        code: '// Default Ports & Endpoints\nLocal Daemon P2P Port: 65337\nWebSocket Bridge: ws://127.0.0.1:65337/ws\nWeb Server: https://orbit-sync.onrender.com\nControl Server: https://orbit-server-xbr5.onrender.com',
      },
      {
        title: 'System Requirements',
        body: '• Operating System: Windows 10/11 (64-bit), macOS 12+ (Apple Silicon/Intel), Linux (Ubuntu 22.04+ / AppImage)\n• Memory: 4 GB RAM minimum (8 GB recommended)\n• Disk Space: 250 MB for OrBit Desktop App & Local Daemon\n• IDE: Visual Studio Code (version 1.80.0 or higher)',
        code: '# Verify System Capabilities\nnode -v && rustc --version && code --version',
      },
      {
        title: 'Step-by-Step Installation',
        body: '1. Download OrBit Desktop Client installer for your OS from /download.\n2. Launch installer. On Windows, OrBit installs cleanly as a GUI application without spawning terminal windows.\n3. Install VS Code Extension: Open VS Code -> Extensions -> Install from VSIX -> Select orbit-vscode-0.1.0.vsix.',
        code: '# CLI Extension Installation\ncode --install-extension orbit-vscode-0.1.0.vsix',
      },
      {
        title: 'Account Authentication & Licensing',
        body: 'Launch OrBit Desktop Client, enter your assigned single permanent License Key from your OrBit Console, and click Authenticate Key. The client verifies your key against the server and receives a secure JWT token.',
        code: '// Identity Encryption\nYour identity is anchored by an Ed25519 keypair:\n%APPDATA%/OrBit/daemon/identity.key',
      },
    ],
  },

  'local-first-sync': {
    title: 'Module 02: Local-First Code Synchronization & P2P Pushing',
    subtitle: 'Continuous Synchronization, P2P Delta Broadcasting & Dead-Drop Relays',
    desc: 'OrBit replaces manual Git staging and remote pushing with a local-first continuous sync paradigm. Code changes are monitored continuously by the Rust daemon and distributed over a P2P mesh network using libp2p.',
    sections: [
      {
        title: '1. Previewing Diffs (Pre-Push Review)',
        body: 'Before broadcasting code changes to your team, OrBit allows you to review modified, added, and removed files:\n\n1. Press Ctrl+Shift+P to launch the OrBit Overlay HUD.\n2. Click Preview Push.\n3. The client compares your working tree against baseline main snapshot and displays diff counts.',
        code: '# Daemon Preview Command\norbit daemon preview_push --project <project_id>',
      },
      {
        title: '2. Executing a Peer-to-Peer Push (local_push)',
        body: 'When you click Confirm Push:\n1. The local daemon takes a workspace snapshot.\n2. Computes a Blake3 delta payload containing changed file contents.\n3. Signs delta with Ed25519 identity key and encrypts with ChaCha20Poly1305.\n4. Broadcasts encrypted delta directly to active peers over libp2p mesh.',
        code: '// Encryption Pipeline\nDelta = Blake3(Changed_Files)\nEncryptedPayload = ChaCha20Poly1305(Delta, ProjectToken)\nSignature = Ed25519_Sign(IdentityKey, EncryptedPayload)',
      },
      {
        title: '3. Encrypted Cloud Relay Fallback (full_push)',
        body: 'If target peers are offline during push:\n1. The daemon detects zero connected online peers.\n2. Uploads E2EE encrypted delta blob to Control Server Dead-Drop Vault (POST /api/v1/projects/{id}/push).\n3. When offline peers reconnect, their client queries GET /api/v1/projects/{id}/pull to download and apply pending deltas.',
        code: '// Dead-Drop Vault API\nPOST https://orbit-server-xbr5.onrender.com/api/v1/projects/:id/push\nGET  https://orbit-server-xbr5.onrender.com/api/v1/projects/:id/pull',
      },
    ],
  },

  'shadow-git': {
    title: 'Module 03: The Shadow Git Architecture',
    subtitle: 'Isolated Bare Repositories & Non-Disruptive Branching',
    desc: 'OrBit maintains a hidden bare Git repository located at <project_root>/.orbit/shadow.git. It never modifies your main .git folder, index, or HEAD pointer.',
    sections: [
      {
        title: 'The Two-Branch Model',
        body: 'Inside every OrBit Shadow Git repository, the daemon maintains two primary logical branches:\n\n• main Branch (Team Baseline): Authoritative snapshot agreed upon by all team members.\n• sub Branch (Local Scratchpad): Developer\'s current uncommitted work, capturing real-time working tree snapshots.',
        code: '[Team Baseline]  main ---> Commit A ---> Commit B (Synced)\n                             |\n[Local Scratch]  sub  -----> Commit C (Unpushed)',
      },
      {
        title: 'How Shadow Git Works Under the Hood',
        body: '1. File watcher in local daemon detects filesystem events.\n2. Daemon creates in-memory snapshot manifest via sync-diff::create_snapshot.\n3. Temporary tree object is written to .orbit/shadow.git.\n4. Clicking Push generates delta commit linking main to sub.\n5. Remote peers fast-forward local main branch in shadow.git upon receiving push.',
        code: '# Interoperability with Standard Git\n# Standard Git works 100% normally alongside OrBit!\ngit status\ngit commit -m "Official release"\ngit push origin main',
      },
    ],
  },

  'conflict-resolution': {
    title: 'Module 04: 3-Way Conflict Detection & Resolution',
    subtitle: 'Deterministic Delta Merges & Visual Conflict Inspector',
    desc: 'When two developers modify overlapping file regions concurrently, OrBit uses a formal 3-Way Merge Algorithm implemented in crates/sync-diff/src/conflict.rs.',
    sections: [
      {
        title: 'The 3-Way Conflict Algorithm',
        body: 'When an incoming remote delta arrives from a peer:\n1. Base Snapshot (O): Common ancestor baseline snapshot on main branch.\n2. Local Workspace (A): Current state of local working directory on sub branch.\n3. Remote Payload (B): Incoming delta pushed by teammate.',
        code: '// Conflict Logic\nIf File X modified in B untouched in A => Auto-applied\nIf File X modified in A & B at non-overlapping lines => Auto-merged\nIf File X modified in A & B at overlapping lines => Conflict Declared',
      },
      {
        title: 'Conflict Resolution Strategies',
        body: 'Inside the Conflict Resolver Modal in OrBit Desktop Client, developers choose between:\n\n1. Accept Local ("Keep Mine"): Preserves local code and discards remote changes.\n2. Accept Remote ("Keep Teammates"): Overwrites conflicting local regions with peer code.\n3. Manual Merge / Conflict Markers: Inserts standard Git conflict block markers (<<<<<<< LOCAL) for manual editing.',
        code: '<<<<<<< LOCAL (Your Changes)\nconst port = 8080;\n=======\nconst port = 9090;\n>>>>>>> REMOTE (Peer ed25519:7f8a3b...)',
      },
    ],
  },

  'p2p-bootstrap': {
    title: 'Module 05: P2P Repository Seeding & Bootstrapping',
    subtitle: 'Decentralized Packfile Streaming & Signature Verification',
    desc: 'When joining a project, developers download an encrypted, signed Git packfile directly from an online team member (a Seeder Peer) over local LAN or P2P mesh network.',
    sections: [
      {
        title: 'The Bootstrap Lifecycle Pipeline',
        body: 'Stage 1: Downloading — Client sends BootstrapNetworkMessage::TransferRequest to seeder peer over libp2p.\nStage 2: Verifying — Seeder packages shadow.git into packfile, encrypts with project_token, signs with Ed25519 key, and streams back. Client verifies signature.\nStage 3: Restoring — Client imports packfile atomically into local .orbit/shadow.git via ShadowRepo::import_packfile_atomic.\nStage 4: Completed — Workspace files are checked out to disk.',
        code: '// P2P Bootstrap Request\nrequest_bootstrap({ project_id: "orbit-core" })\nStatus: Downloading -> Verifying -> Restoring -> Completed',
      },
      {
        title: 'Signature Verification Security',
        body: 'The downloading peer verifies the seeder\'s Ed25519 signature against packfile bytes before importing. If signature validation fails or tampered bytes are detected, bootstrap aborts immediately to prevent malicious code injection.',
        code: 'Ed25519_Verify(SeederPublicKey, PackfileBytes, Signature) == true',
      },
    ],
  },

  'ide-presence': {
    title: 'Module 06: Deep IDE Presence & Flow State Gamification',
    subtitle: 'Real-time Teammate Cursors, Conflict Warnings & Flow Streaks',
    desc: 'OrBit bridges desktop application state and VS Code via Deep IDE Presence and Flow State Gamification over local WebSocket connections (ws://127.0.0.1:65337/ws).',
    sections: [
      {
        title: 'Real-Time Inline Teammate Cursors',
        body: 'When a teammate opens a file that you are currently editing in VS Code:\n1. Teammate\'s editor reports active document path and selection line number.\n2. Daemon broadcasts presence event over P2P.\n3. VS Code extension renders an inline presence badge directly next to their cursor line.',
        code: '15: const total = data.items.reduce((acc, x) => acc + x, 0);  // 👤 Teammate (Alex) is here',
      },
      {
        title: 'Pre-emptive Conflict Warnings & Overlay HUD',
        body: 'If you open or type in a file where a teammate is actively working, VS Code displays: ⚠️ Pre-emptive Conflict Warning: Peer 7f8a3b is actively editing this file!\n\nGlobal Hotkey: Press Ctrl+Shift+P (or Cmd+Shift+P on macOS) anywhere to toggle the OrBit Overlay HUD widget.',
        code: '// Global Hotkey Toggle\nCtrl+Shift+P / Cmd+Shift+P -> Toggles OrBit HUD Overlay Widget',
      },
      {
        title: 'Flow State Gamification Engine',
        body: 'Tracks typing velocity (keystrokes per minute) and save frequencies. Sustaining steady coding velocity for 10+ minutes triggers a flow_state event, earning streak points displayed on team leaderboards in OrBit Desktop Client.',
        code: '// Flow Threshold Event\nif (keystrokes_per_min > 40 && sustained_minutes >= 10) {\n  trigger_flow_streak_badge();\n}',
      },
    ],
  },
};

type DocKey = keyof typeof DOCS_CONTENT;

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<DocKey>('getting-started');
  const currentDoc = DOCS_CONTENT[activeTab];

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: '#030303',
        overflow: 'hidden',
        padding: '120px 6% 100px 6%',
      }}
    >
      <Aurora />
      <CursorGlow />

      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 5,
          display: 'grid',
          gridTemplateColumns: '290px 1fr',
          gap: '45px',
        }}
      >
        {/* Left Side: Sidebar Navigation */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            borderRight: '1px solid rgba(255, 0, 60, 0.1)',
            paddingRight: '22px',
            height: 'fit-content',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent-red)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '14px', fontFamily: 'var(--font-orbitron)' }}>
            User Guide Documentation
          </span>

          {(Object.keys(DOCS_CONTENT) as DocKey[]).map((key) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  border: 'none',
                  color: isActive ? '#fff' : '#a0a0a5',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(255, 0, 60, 0.12)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? 'var(--accent-red)' : 'transparent'}`,
                  transition: 'all 0.2s',
                  lineHeight: 1.4,
                }}
              >
                {DOCS_CONTENT[key].title}
              </button>
            );
          })}
        </aside>

        {/* Right Side: Docs Content Viewer */}
        <article style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '20px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {currentDoc.subtitle}
            </span>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff', margin: '8px 0 12px 0', fontFamily: 'var(--font-orbitron)' }}>
              {currentDoc.title}
            </h1>
            <p style={{ color: '#a0a0a5', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
              {currentDoc.desc}
            </p>
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
            {currentDoc.sections.map((sec, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(10, 8, 8, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-orbitron)' }}>
                  {sec.title}
                </h3>
                
                <p style={{ color: '#909095', fontSize: '0.92rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>
                  {sec.body}
                </p>

                {/* Code Snippet Block */}
                {sec.code && (
                  <div
                    style={{
                      background: '#060404',
                      border: '1px solid rgba(255, 0, 60, 0.2)',
                      borderRadius: '8px',
                      padding: '16px 20px',
                      fontFamily: 'var(--font-space-mono)',
                      fontSize: '0.85rem',
                      color: '#ff859f',
                      whiteSpace: 'pre-wrap',
                      marginTop: '6px',
                    }}
                  >
                    {sec.code}
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>

      </div>
    </main>
  );
}
