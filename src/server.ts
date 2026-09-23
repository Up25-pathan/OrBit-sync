import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dns from 'dns';
import authRouter from './routes/auth';
import consoleRouter from './routes/console';
import licenseRouter from './routes/license';
import billingRouter from './routes/billing';
import adminRouter from './routes/admin';
import updaterRouter from './routes/updater';
import telemetryRouter from './routes/telemetry';
import { prisma } from './db';

// Force DNS resolver to prefer IPv4 over IPv6 (fixes Render ENETUNREACH socket connect errors)
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers (relaxed cross-origin policies to allow Vercel frontend + desktop app)
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

// Parse any additional comma-separated origins from environment variables
const envOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : []),
].filter(Boolean) as string[];

const allowedOrigins = [
  ...envOrigins,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:9090',
  'https://orbit-sync.dev',
  'https://www.orbit-sync.dev',
  'https://api.orbit-sync.dev',
  'https://relay.orbit-sync.dev',
  'https://orbit-sync.onrender.com',
  'https://orbitcollab-three.vercel.app',
  'https://orbit-server-xbr5.onrender.com',
  'tauri://localhost',
  'https://tauri.localhost',
];

// Helper to check if an origin is permitted
function isOriginAllowed(origin: string): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    // Allow custom production domain and all subdomains (orbit-sync.dev, www.orbit-sync.dev, api.orbit-sync.dev, etc.)
    if (host === 'orbit-sync.dev' || host.endsWith('.orbit-sync.dev')) return true;
    // Allow all Vercel deployments (previews, production, branches)
    if (host.endsWith('.vercel.app')) return true;
    // Allow all Render services within the ecosystem
    if (host.endsWith('.onrender.com')) return true;
  } catch {
    // String matching fallback
    if (origin.includes('orbit-sync.dev') || origin.includes('vercel.app') || origin.includes('onrender.com')) {
      return true;
    }
  }

  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, desktop apps)
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Control-Server-Secret', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200,
};

// Enable CORS for client connections & Control Server verifications
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Route Stripe Webhook directly to parse raw request buffers (Stripe SDK signature checks require this)
// For all other routes, parse JSON bodies (supporting larger payloads like base64 avatars)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Mount Routes (supporting both legacy /api/ and versioned /api/v1/ endpoints)
app.use('/api/auth', authRouter);
app.use('/api/v1/auth', authRouter);

app.use('/api/console', consoleRouter);
app.use('/api/v1/console', consoleRouter);

app.use('/api/license', licenseRouter);
app.use('/api/licenses', licenseRouter);
app.use('/api/v1/license', licenseRouter);
app.use('/api/v1/licenses', licenseRouter);

app.use('/api/billing', billingRouter);
app.use('/api/v1/billing', billingRouter);

app.use('/api/admin', adminRouter);
app.use('/api/v1/admin', adminRouter);

app.use('/api/updater', updaterRouter);
app.use('/api/v1/updater', updaterRouter);

app.use('/api/telemetry', telemetryRouter);
app.use('/api/v1/telemetry', telemetryRouter);
app.use('/api/feedback', telemetryRouter);
app.use('/api/v1/feedback', telemetryRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Minimal Frontend for OAuth flow completion
app.get('/console', async (req, res) => {
  const email = req.query.email as string;
  const token = req.query.token as string;
  let licenseKey = 'Not found';

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-insecure-fallback-change-me') as any;
      if (decoded && decoded.id) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          include: { license: true }
        });
        if (user && user.license) {
          licenseKey = user.license.licenseKey;
        }
      }
    } catch (e) {
      console.error('Failed to parse token in /console', e);
    }
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OrBit Console</title>
      <style>
        body { font-family: 'Inter', sans-serif; background: #0a0808; color: #fff; padding: 40px; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: rgba(255,255,255,0.05); padding: 40px; border-radius: 12px; border: 1px solid rgba(0, 178, 255, 0.3); text-align: center; max-width: 550px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; overflow: hidden; }
        .card::before { content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(0, 178, 255, 0.1) 0%, transparent 60%); z-index: 0; pointer-events: none; }
        .content { position: relative; z-index: 1; }
        h1 { color: #00B2FF; margin-top: 0; font-weight: 800; letter-spacing: 1px; }
        .key { background: #000; padding: 15px; border-radius: 8px; color: #00FF9D; font-family: monospace; font-size: 1.2rem; margin: 24px 0; border: 1px solid #333; }
        p { color: #aaa; line-height: 1.6; }
        .btn { display: inline-block; margin-top: 10px; padding: 14px 28px; background: linear-gradient(135deg, #00B2FF 0%, #0077FF 100%); color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0, 178, 255, 0.3); transition: 0.2s; cursor: pointer; border: none; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 178, 255, 0.4); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="content">
          <h1>Authentication Successful</h1>
          <p>Welcome, <strong style="color:#fff;">${email || 'User'}</strong>!</p>
          <p>We are securely redirecting you back to the OrBit Desktop App...</p>
          
          <a href="orbit://auth?token=${licenseKey}" class="btn" id="deepLinkBtn">Open OrBit Desktop App</a>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="font-size: 0.85rem; margin-bottom: 10px;">If the app does not open automatically, copy your Access Key and paste it into the app manually:</p>
            <div class="key">${licenseKey}</div>
          </div>
        </div>
      </div>
      
      <script>
        // Attempt to deep link automatically
        setTimeout(() => {
          window.location.href = "orbit://auth?token=${licenseKey}";
        }, 500);
      </script>
    </body>
    </html>
  `);
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Global Error]:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Ensure avatarUrl and twoFactorEnabled columns exist (raw SQL fallback for databases)
async function ensureSchema() {
  try {
    const result = (await prisma.$queryRawUnsafe("PRAGMA table_info('User')")) as Array<{ name: string }>;
    const hasAvatarUrl = result.some((col: { name: string }) => col.name === 'avatarUrl');
    if (!hasAvatarUrl) {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT');
      console.log('[Schema] Added missing avatarUrl column to User table.');
    }

    const hasTwoFactor = result.some((col: { name: string }) => col.name === 'twoFactorEnabled');
    if (!hasTwoFactor) {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN DEFAULT 0');
      console.log('[Schema] Added missing twoFactorEnabled column to User table.');
    }

    // Ensure Telemetry and Feedback tables exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CrashReport" (
        "id" TEXT PRIMARY KEY,
        "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "appVersion" TEXT NOT NULL DEFAULT '0.1.0',
        "os" TEXT NOT NULL DEFAULT 'unknown',
        "source" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "stackTrace" TEXT,
        "location" TEXT,
        "payload" TEXT,
        "userFingerprint" TEXT,
        "metadata" TEXT,
        "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FeedbackTicket" (
        "id" TEXT PRIMARY KEY,
        "ticketId" TEXT UNIQUE NOT NULL,
        "category" TEXT NOT NULL,
        "severity" TEXT,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "userId" TEXT,
        "userEmail" TEXT,
        "fingerprint" TEXT,
        "appVersion" TEXT NOT NULL DEFAULT '0.1.0',
        "os" TEXT NOT NULL DEFAULT 'unknown',
        "logs" TEXT,
        "status" TEXT NOT NULL DEFAULT 'OPEN',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ServerErrorEvent" (
        "id" TEXT PRIMARY KEY,
        "errorType" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "stackTrace" TEXT,
        "metadata" TEXT,
        "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err: any) {
    console.error('[Schema] Failed to ensure schema columns:', err.message);
  }
}

// Start Server
ensureSchema().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(` OrBit API Server running on port ${PORT}`);
    console.log(` Client Origin: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    console.log(` SQLite Database: Active`);
    console.log(`=============================================`);
  });

  // Graceful shutdown on SIGTERM/SIGINT (Render sends SIGTERM on restart)
  async function shutdown(signal: string) {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await prisma.$disconnect();
      console.log('[Server] Database connection closed.');
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}).catch((err) => {
  console.error('[FATAL] Failed to ensure schema on startup:', err);
  process.exit(1);
});
