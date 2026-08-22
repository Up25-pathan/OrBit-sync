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

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:9090',
  'https://orbit-sync.onrender.com',
  'https://orbitcollab-three.vercel.app',
  'https://orbit-server-ymao.onrender.com',
  'tauri://localhost',
  'https://tauri.localhost',
].filter(Boolean) as string[];

// Enable CORS for client connections & Control Server verifications
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Cross-Origin Access Denied by OrBit Security Policy'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Control-Server-Secret'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Global Error]:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Ensure avatarUrl column exists (raw SQL fallback for databases missing the column)
async function ensureSchema() {
  try {
    const result = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "PRAGMA table_info('User')"
    );
    const hasAvatarUrl = result.some((col) => col.name === 'avatarUrl');
    if (!hasAvatarUrl) {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT');
      console.log('[Schema] Added missing avatarUrl column to User table.');
    } else {
      console.log('[Schema] avatarUrl column already exists.');
    }
  } catch (err: any) {
    console.error('[Schema] Failed to ensure avatarUrl column:', err.message);
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
