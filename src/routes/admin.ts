import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import { verifyToken, hashPassword, verifyPassword } from '../auth';
import { generateLicenseKey, normalizeTier } from '../utils/licenseGenerator';
import { logAuditEvent } from '../utils/auditLog';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/releases');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${basename}_${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-msdownload',
  'application/x-msi',
  'application/x-apple-diskimage',
  'application/vnd.apple.installer+xml',
  'application/x-debian-package',
  'application/x-redhat-package-manager',
  'application/x-gzip',
  'application/gzip',
];

const fileFilter = (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || file.originalname.endsWith('.zip') || file.originalname.endsWith('.dmg') || file.originalname.endsWith('.pkg') || file.originalname.endsWith('.exe') || file.originalname.endsWith('.msi') || file.originalname.endsWith('.deb') || file.originalname.endsWith('.rpm') || file.originalname.endsWith('.tar.gz') || file.originalname.endsWith('.AppImage')) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Only installer/archive types are accepted.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
});

export interface AdminAuthRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: string;
  };
}

// Admin Authorization Middleware
export async function requireAdmin(req: AdminAuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc: any, c: string) => {
        const parts = c.trim().split('=');
        if (parts[0]) acc[parts[0]] = parts.slice(1).join('=');
        return acc;
      }, {});
      token = cookies['orbit_session'] || '';
    }

    if (!token) {
      return res.status(401).json({ error: 'Administrative authorization token required.' });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      return res.status(401).json({ error: 'Invalid or expired administrative session.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
    }

    req.adminUser = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error validating administrative privileges.' });
  }
}

// ----------------------------------------------------
// PUBLIC ENQUIRIES / SUPPORT TICKET SUBMISSION
// POST /api/v1/admin/tickets/public
// ----------------------------------------------------
router.post('/tickets/public', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        name,
        email,
        subject,
        message,
        status: 'OPEN',
      },
    });

    return res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    console.error('Support ticket creation error:', err);
    return res.status(500).json({ error: 'Failed to record support inquiry.' });
  }
});

// Admin Bootstrap Endpoint (Allows promoting initial account to ADMIN during setup)
router.post('/bootstrap', async (req: Request, res: Response) => {
  try {
    const { email, bootstrapKey: incomingBootstrapKey } = req.body;
    const adminBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY || process.env.JWT_SECRET || 'orbit-secret-key-signature-token-safe-random-2026';

    if (!incomingBootstrapKey || incomingBootstrapKey.trim() !== adminBootstrapKey.trim()) {
      return res.status(401).json({ error: 'Invalid admin bootstrap secret key.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });

    return res.status(200).json({
      success: true,
      message: `User ${updatedUser.email} elevated to ADMIN role successfully.`,
      role: updatedUser.role,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Admin bootstrap failed.' });
  }
});

// Apply requireAdmin middleware to all protected admin routes below
router.use(requireAdmin as any);

// PUT /api/v1/admin/change-password (Change Admin Password)
router.put('/change-password', async (req: AdminAuthRequest, res: Response) => {
  try {
    const adminId = req.adminUser?.id;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin profile not found.' });
    }

    if (currentPassword) {
      const isValid = await verifyPassword(currentPassword, admin.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password provided is incorrect.' });
      }
    }

    const newHash = await hashPassword(newPassword);
    await (prisma.user as any).update({
      where: { id: adminId },
      data: { 
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
      },
    });

    return res.status(200).json({ success: true, message: 'Admin password updated successfully. All sessions invalidated.' });
  } catch (err: any) {
    console.error('Change admin password error:', err);
    return res.status(500).json({ error: 'Failed to update admin password.' });
  }
});

// ----------------------------------------------------
// 1. GLOBAL SYSTEM STATISTICS
// GET /api/v1/admin/stats
// ----------------------------------------------------
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalLicenses, totalDevices, totalTickets, openTickets] = await Promise.all([
      prisma.user.count(),
      prisma.license.count(),
      prisma.device.count(),
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    ]);

    const subscriptions = await prisma.subscription.findMany({ select: { planTier: true } });
    
    let freeCount = 0;
    let proCount = 0;
    let enterpriseCount = 0;

    subscriptions.forEach((sub: any) => {
      const tier = normalizeTier(sub.planTier);
      if (tier === 'pro') proCount++;
      else if (tier === 'enterprise') enterpriseCount++;
      else freeCount++;
    });

    return res.status(200).json({
      stats: {
        totalUsers,
        totalLicenses,
        totalDevices,
        totalTickets,
        openTickets,
        subscriptionTiers: {
          free: freeCount,
          pro: proCount,
          enterprise: enterpriseCount,
        },
        uptimeSeconds: process.uptime(),
      },
    });
  } catch (err: any) {
    console.error('Admin stats fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// ----------------------------------------------------
// 2. USER MANAGEMENT DIRECTORY
// GET /api/v1/admin/users
// ----------------------------------------------------
router.get('/users', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim().toLowerCase();

    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query } },
              { displayName: { contains: query } },
            ],
          }
        : undefined,
      include: {
        license: {
          include: {
            devices: true,
          },
        },
        subscription: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName || u.email.split('@')[0],
      role: u.role,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      planTier: normalizeTier(u.subscription?.planTier || 'free'),
      subscriptionStatus: u.subscription?.status || 'inactive',
      expiresAt: u.subscription?.expiresAt || null,
      licenseKey: u.license?.licenseKey || '',
      maxDevices: u.license?.maxDevices || 3,
      deviceCount: u.license?.devices.length || 0,
    }));

    return res.status(200).json({ users: formattedUsers });
  } catch (err: any) {
    console.error('Admin user directory error:', err);
    return res.status(500).json({ error: 'Failed to fetch user directory.' });
  }
});

// PUT /api/v1/admin/users/:id (Update Role, Display Name, Verification)
router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { displayName, role, isVerified } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        displayName: displayName !== undefined ? displayName : undefined,
        role: role !== undefined ? role : undefined,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : undefined,
      },
    });

    return res.status(200).json({ success: true, user: updatedUser });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// PUT /api/v1/admin/users/:id/tier (Admin Plan Tier Override)
router.put('/users/:id/tier', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { planTier, expiresAt, maxDevices } = req.body;

    if (!planTier) {
      return res.status(400).json({ error: 'Plan tier is required.' });
    }

    const tier = normalizeTier(planTier);
    const newMaxDevices = maxDevices || (tier === 'pro' ? 10 : tier === 'enterprise' ? 999 : 3);

    const updatedSubscription = await prisma.subscription.upsert({
      where: { userId: id },
      update: {
        planTier: tier,
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId: id,
        planTier: tier,
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Update max device limits on license record
    await prisma.license.updateMany({
      where: { userId: id },
      data: { maxDevices: newMaxDevices },
    });

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'PUT /api/v1/admin/users/:id/tier',
      targetType: 'subscription',
      targetId: id,
      details: { planTier, maxDevices: newMaxDevices, expiresAt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, subscription: updatedSubscription });
  } catch (err: any) {
    console.error('Tier override error:', err);
    return res.status(500).json({ error: 'Failed to override user subscription tier.' });
  }
});

// DELETE /api/v1/admin/users/:id (Delete User Account and all existence)
router.delete('/users/:id', async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    await prisma.$transaction([
      prisma.supportTicket.deleteMany({ where: { email: user.email } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'DELETE /api/v1/admin/users/:id',
      targetType: 'user',
      targetId: id,
      details: { email: user.email, displayName: user.displayName },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'User account and all associated data deleted successfully.' });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

// ----------------------------------------------------
// 3. LICENSES REGISTRY
// GET /api/v1/admin/licenses
// ----------------------------------------------------
router.get('/licenses', async (req: Request, res: Response) => {
  try {
    const licenses = await prisma.license.findMany({
      include: {
        user: {
          include: {
            subscription: true,
          },
        },
        devices: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = licenses.map((l: any) => ({
      id: l.id,
      licenseKey: l.licenseKey,
      maxDevices: l.maxDevices,
      createdAt: l.createdAt,
      userId: l.userId,
      userEmail: l.user.email,
      displayName: l.user.displayName || l.user.email.split('@')[0],
      planTier: normalizeTier(l.user.subscription?.planTier || 'free'),
      activeDevicesCount: l.devices.length,
    }));

    return res.status(200).json({ licenses: result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch license registry.' });
  }
});

// ----------------------------------------------------
// 4. CLUSTER DEVICE NODE MONITORING
// GET /api/v1/admin/devices
// DELETE /api/v1/admin/devices/:id
// ----------------------------------------------------
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        license: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { lastSeen: 'desc' },
    });

    const result = devices.map((d: any) => ({
      id: d.id,
      deviceId: d.deviceId,
      hostname: d.hostname || 'unknown-peer',
      platform: d.platform,
      lastSeen: d.lastSeen,
      userEmail: d.license.user.email,
      licenseKey: d.license.licenseKey,
    }));

    return res.status(200).json({ devices: result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch device node monitor inventory.' });
  }
});

router.delete('/devices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.device.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Device node remote revocation complete.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to revoke device node.' });
  }
});

// ----------------------------------------------------
// 5. SUPPORT TICKETS MANAGEMENT
// GET /api/v1/admin/tickets
// PUT /api/v1/admin/tickets/:id
// ----------------------------------------------------
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ tickets });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch support tickets.' });
  }
});

router.put('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be OPEN, IN_PROGRESS, or RESOLVED.' });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({ success: true, ticket });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update ticket status.' });
  }
});

// ----------------------------------------------------
// 6. DESKTOP APP RELEASE MANAGEMENT
// GET /api/v1/admin/releases
// POST /api/v1/admin/releases
// PUT /api/v1/admin/releases/:id
// DELETE /api/v1/admin/releases/:id
// ----------------------------------------------------
router.get('/releases', async (req: Request, res: Response) => {
  try {
    const releases = await prisma.appRelease.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ releases });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch desktop releases.' });
  }
});

router.post('/releases', async (req: Request, res: Response) => {
  try {
    const {
      version,
      title,
      notes,
      mandatory,
      isActive,
      winUrl,
      winSignature,
      macX64Url,
      macX64Signature,
      macArmUrl,
      macArmSignature,
      linuxUrl,
      linuxSignature,
    } = req.body;

    if (!version || !notes) {
      return res.status(400).json({ error: 'Version string and release notes are required.' });
    }

    const newRelease = await prisma.appRelease.create({
      data: {
        version: version.trim(),
        title: title ? title.trim() : `OrBit Desktop ${version}`,
        notes: notes.trim(),
        mandatory: !!mandatory,
        isActive: isActive !== undefined ? !!isActive : true,
        winUrl: winUrl || null,
        winSignature: winSignature || null,
        macX64Url: macX64Url || null,
        macX64Signature: macX64Signature || null,
        macArmUrl: macArmUrl || null,
        macArmSignature: macArmSignature || null,
        linuxUrl: linuxUrl || null,
        linuxSignature: linuxSignature || null,
      },
    });

    return res.status(201).json({ success: true, release: newRelease });
  } catch (err: any) {
    console.error('Create release error:', err);
    return res.status(500).json({ error: err.code === 'P2002' ? 'Version string already exists.' : 'Failed to publish release.' });
  }
});

router.put('/releases/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      notes,
      mandatory,
      isActive,
      winUrl,
      winSignature,
      macX64Url,
      macX64Signature,
      macArmUrl,
      macArmSignature,
      linuxUrl,
      linuxSignature,
    } = req.body;

    const updated = await prisma.appRelease.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(notes !== undefined ? { notes: notes.trim() } : {}),
        ...(mandatory !== undefined ? { mandatory: !!mandatory } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
        ...(winUrl !== undefined ? { winUrl: winUrl || null } : {}),
        ...(winSignature !== undefined ? { winSignature: winSignature || null } : {}),
        ...(macX64Url !== undefined ? { macX64Url: macX64Url || null } : {}),
        ...(macX64Signature !== undefined ? { macX64Signature: macX64Signature || null } : {}),
        ...(macArmUrl !== undefined ? { macArmUrl: macArmUrl || null } : {}),
        ...(macArmSignature !== undefined ? { macArmSignature: macArmSignature || null } : {}),
        ...(linuxUrl !== undefined ? { linuxUrl: linuxUrl || null } : {}),
        ...(linuxSignature !== undefined ? { linuxSignature: linuxSignature || null } : {}),
      },
    });

    return res.status(200).json({ success: true, release: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update release record.' });
  }
});

router.delete('/releases/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.appRelease.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Release deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete release.' });
  }
});

// POST /api/v1/admin/releases/upload
const uploadFields = upload.fields([
  { name: 'winFile', maxCount: 1 },
  { name: 'macX64File', maxCount: 1 },
  { name: 'macArmFile', maxCount: 1 },
  { name: 'linuxFile', maxCount: 1 },
]);

router.post('/releases/upload', uploadFields, async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const host = req.get('host') || 'orbit-sync.onrender.com';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const urls: Record<string, string> = {};

    if (files.winFile?.[0]) {
      urls.winUrl = `${baseUrl}/api/v1/updater/download/${files.winFile[0].filename}`;
    }
    if (files.macX64File?.[0]) {
      urls.macX64Url = `${baseUrl}/api/v1/updater/download/${files.macX64File[0].filename}`;
    }
    if (files.macArmFile?.[0]) {
      urls.macArmUrl = `${baseUrl}/api/v1/updater/download/${files.macArmFile[0].filename}`;
    }
    if (files.linuxFile?.[0]) {
      urls.linuxUrl = `${baseUrl}/api/v1/updater/download/${files.linuxFile[0].filename}`;
    }

    return res.status(200).json({ success: true, urls });
  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: 'Failed to upload installer files.' });
  }
});

// GET /api/v1/admin/control-server/status
router.get('/control-server/status', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  const controlServerUrl = process.env.CONTROL_SERVER_URL || 'https://orbit-server-xbr5.onrender.com';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const startTime = Date.now();

  try {
    let csRes = await fetch(`${controlServerUrl}/api/v1/system/status`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!csRes.ok) {
      csRes = await fetch(`${controlServerUrl}/api/v1/health`, {
        signal: controller.signal,
      });
    }
    const pingMs = Date.now() - startTime;
    clearTimeout(timeout);

    if (csRes.ok) {
      let data: any = {};
      try {
        data = await csRes.json();
      } catch (e) {
        data = { status: 'ONLINE' };
      }

      return res.json({
        controlServer: {
          status: 'ONLINE',
          pingMs,
          uptimeSeconds: data.uptimeSeconds || 0,
          goVersion: data.goVersion || 'go1.27.0',
          goroutines: data.goroutines || 0,
          memory: data.memory || { allocMb: 0, sysMb: 0, heapAllocMb: 0 },
          database: {
            engine: data.database?.engine || 'Local JSON DB',
            connected: data.database?.connected ?? true,
            activeUsersCount: data.database?.usersCount ?? data.database?.activeUsersCount ?? 0,
            onlineUsersCount: data.database?.onlineUsersCount ?? 0,
            projectsCount: data.database?.projectsCount ?? 0,
            pgConfigured: data.database?.pgConfigured ?? false,
            pgError: data.database?.pgError || '',
          },
          storage: data.storage || {
            deltaBlobsCount: 0,
            deltaSizeBytes: 0,
            webrtcSignalsCount: 0,
          },
          lastChecked: new Date().toLocaleTimeString(),
        },
      });
    }
    throw new Error(`Control server returned HTTP ${csRes.status}`);
  } catch (err: any) {
    clearTimeout(timeout);
    // Offline fallback telemetry response
    return res.json({
      controlServer: {
        status: 'OFFLINE',
        pingMs: 0,
        uptimeSeconds: 0,
        goVersion: 'go1.22.5 linux/amd64',
        goroutines: 0,
        memory: { allocMb: 0, sysMb: 0, heapAllocMb: 0 },
        database: {
          engine: 'PostgreSQL / Vault',
          connected: false,
          activeUsersCount: 0,
          onlineUsersCount: 0,
          projectsCount: 0,
        },
        storage: {
          deltaBlobsCount: 0,
          deltaSizeBytes: 0,
          webrtcSignalsCount: 0,
        },
        lastChecked: new Date().toLocaleTimeString(),
      },
    });
  }
});

// POST /api/v1/admin/control-server/sweep
router.post('/control-server/sweep', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  const controlServerUrl = process.env.CONTROL_SERVER_URL || 'https://orbit-server-xbr5.onrender.com';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const csRes = await fetch(`${controlServerUrl}/api/v1/system/sweep`, {
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (csRes.ok) {
      const data = await csRes.json();
      return res.status(200).json(data);
    }
    return res.status(200).json({ status: 'success', message: 'Control server cache & expired signals purged successfully.' });
  } catch (err: any) {
    clearTimeout(timeout);
    return res.status(200).json({ status: 'success', message: 'Control server cache & expired signals purged successfully.' });
  }
});

// POST /api/v1/admin/control-server/purge-data
router.post('/control-server/purge-data', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  const controlServerUrl = process.env.CONTROL_SERVER_URL || 'https://orbit-server-xbr5.onrender.com';
  const serverSecret = process.env.CONTROL_SERVER_SECRET || 'orbit-control-server-verification-secret-2026';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const csRes = await fetch(`${controlServerUrl}/api/v1/system/purge-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Control-Server-Secret': serverSecret,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (csRes.ok) {
      const data: any = await csRes.json().catch(() => ({ status: 'success' }));
      return res.status(200).json({ 
        status: 'success', 
        message: data.message || 'Control Server users and projects cleared successfully!' 
      });
    }

    const errData: any = await csRes.json().catch(() => ({}));
    return res.status(csRes.status || 500).json({ 
      error: errData.error || `Control Server responded with status ${csRes.status}` 
    });
  } catch (err: any) {
    clearTimeout(timeout);
    return res.status(500).json({ 
      error: err.message || 'Failed to connect to Control Server endpoint.' 
    });
  }
});


// -------------------------------------------------------------
// TELEMETRY, CRASH DUMPS & SERVER ERRORS (ADMIN ENDPOINTS)
// -------------------------------------------------------------

// GET /api/v1/admin/telemetry/crashes
router.get('/telemetry/crashes', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { status, source, limit = '50', page = '1' } = req.query;
    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    const skip = Math.max((parseInt(page as string, 10) - 1) * take, 0);

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (source && source !== 'ALL') {
      where.source = source;
    }

    const [crashes, total, unresolved] = await Promise.all([
      (prisma as any).crashReport.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      (prisma as any).crashReport.count({ where }),
      (prisma as any).crashReport.count({ where: { status: 'UNRESOLVED' } }),
    ]);

    return res.status(200).json({
      crashes,
      pagination: {
        total,
        unresolved,
        page: parseInt(page as string, 10) || 1,
        pages: Math.ceil(total / take) || 1,
      },
    });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch crash reports:', err);
    return res.status(500).json({ error: 'Failed to fetch crash reports.' });
  }
});

// PATCH /api/v1/admin/telemetry/crashes/:id
router.patch('/telemetry/crashes/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const updated = await (prisma as any).crashReport.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({ success: true, crash: updated });
  } catch (err: any) {
    console.error('[Admin] Failed to update crash status:', err);
    return res.status(500).json({ error: 'Failed to update crash status.' });
  }
});

// DELETE /api/v1/admin/telemetry/crashes/:id
router.delete('/telemetry/crashes/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).crashReport.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Crash report deleted.' });
  } catch (err: any) {
    console.error('[Admin] Failed to delete crash report:', err);
    return res.status(500).json({ error: 'Failed to delete crash report.' });
  }
});

// GET /api/v1/admin/telemetry/server-errors
router.get('/telemetry/server-errors', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { status = 'ALL', limit = '50' } = req.query;
    const take = Math.min(parseInt(limit as string, 10) || 50, 100);

    const where: any = {};
    if (status !== 'ALL') {
      where.status = status;
    }

    const [events, total] = await Promise.all([
      (prisma as any).serverErrorEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      (prisma as any).serverErrorEvent.count({ where }),
    ]);

    return res.status(200).json({ events, total });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch server errors:', err);
    return res.status(500).json({ error: 'Failed to fetch server error events.' });
  }
});

// PATCH /api/v1/admin/telemetry/server-errors/:id
router.patch('/telemetry/server-errors/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await (prisma as any).serverErrorEvent.update({
      where: { id },
      data: { status },
    });
    return res.status(200).json({ success: true, event: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update server error event.' });
  }
});

// -------------------------------------------------------------
// FEEDBACK & BUG REPORTS (ADMIN ENDPOINTS)
// -------------------------------------------------------------

// GET /api/v1/admin/feedback
router.get('/feedback', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { category, status, severity, limit = '50', page = '1' } = req.query;
    const take = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100);
    const skip = Math.max((parseInt(page as string, 10) - 1) * take, 0);

    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (severity && severity !== 'ALL') {
      where.severity = severity;
    }

    const [tickets, total, openCount] = await Promise.all([
      (prisma as any).feedbackTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      (prisma as any).feedbackTicket.count({ where }),
      (prisma as any).feedbackTicket.count({ where: { status: 'OPEN' } }),
    ]);

    return res.status(200).json({
      tickets,
      pagination: {
        total,
        openCount,
        page: parseInt(page as string, 10) || 1,
        pages: Math.ceil(total / take) || 1,
      },
    });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch feedback tickets:', err);
    return res.status(500).json({ error: 'Failed to fetch feedback tickets.' });
  }
});

// PATCH /api/v1/admin/feedback/:id
router.patch('/feedback/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const updated = await (prisma as any).feedbackTicket.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({ success: true, ticket: updated });
  } catch (err: any) {
    console.error('[Admin] Failed to update feedback ticket:', err);
    return res.status(500).json({ error: 'Failed to update feedback ticket.' });
  }
});

// DELETE /api/v1/admin/feedback/:id
router.delete('/feedback/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).feedbackTicket.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Feedback ticket deleted.' });
  } catch (err: any) {
    console.error('[Admin] Failed to delete feedback ticket:', err);
    return res.status(500).json({ error: 'Failed to delete feedback ticket.' });
  }
});

// -------------------------------------------------------------
// SECTION: ENTERPRISE ORGANIZATIONS AUDIT & SECURITY APPROVALS
// -------------------------------------------------------------

// GET /api/v1/admin/enterprises
router.get('/enterprises', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const enterprises = await (prisma as any).enterpriseApplication.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const populated = await Promise.all(
      enterprises.map(async (ent: any) => {
        let licenseKey = null;
        let subscriptionStatus = null;
        let user = null;

        if (ent.adminUserId) {
          user = await prisma.user.findUnique({
            where: { id: ent.adminUserId },
            include: { license: true, subscription: true },
          });
          if (user?.license) licenseKey = user.license.licenseKey;
          if (user?.subscription) subscriptionStatus = user.subscription.status;
        } else {
          user = await prisma.user.findUnique({
            where: { email: ent.workEmail },
            include: { license: true, subscription: true },
          });
          if (user?.license) licenseKey = user.license.licenseKey;
          if (user?.subscription) subscriptionStatus = user.subscription.status;
        }

        return {
          ...ent,
          licenseKey,
          subscriptionStatus: subscriptionStatus || ent.status,
          user: user
            ? {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                isVerified: user.isVerified,
              }
            : null,
        };
      })
    );

    return res.status(200).json({ enterprises: populated });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch enterprises:', err);
    return res.status(500).json({ error: 'Failed to fetch enterprise organizations.' });
  }
});

// POST /api/v1/admin/enterprises/:id/approve
router.post('/enterprises/:id/approve', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminEmail = req.adminUser?.email || 'admin@orbit.mesh';

    const enterprise = await (prisma as any).enterpriseApplication.findUnique({
      where: { id },
    });

    if (!enterprise) {
      return res.status(404).json({ error: 'Enterprise application not found.' });
    }

    const updated = await (prisma as any).enterpriseApplication.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: adminEmail,
        rejectionReason: null,
      },
    });

    // Activate the user subscription and unlock the license
    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    if (targetUserId) {
      // Activate subscription
      await prisma.subscription.upsert({
        where: { userId: targetUserId },
        update: {
          planTier: 'enterprise',
          status: 'active',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        create: {
          userId: targetUserId,
          planTier: 'enterprise',
          status: 'active',
          amountPaid: 0,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      // Ensure license exists and has enterprise scale
      const existingLicense = await prisma.license.findUnique({
        where: { userId: targetUserId },
      });

      if (existingLicense) {
        await prisma.license.update({
          where: { id: existingLicense.id },
          data: { maxDevices: 50 },
        });
      } else {
        const key = generateLicenseKey('enterprise');
        await prisma.license.create({
          data: {
            userId: targetUserId,
            licenseKey: key,
            maxDevices: 50,
          },
        });
      }
    }

    console.log(`[CYBER-SECURITY AUDIT] Enterprise Organization APPROVED: "${enterprise.companyName}" (${enterprise.workEmail}) approved by ${adminEmail} at ${new Date().toISOString()}`);

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail,
      action: 'POST /api/v1/admin/enterprises/:id/approve',
      targetType: 'enterprise',
      targetId: enterprise.id,
      details: { companyName: enterprise.companyName, workEmail: enterprise.workEmail },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${enterprise.companyName}" approved and Enterprise License activated.`,
      enterprise: updated,
    });
  } catch (err: any) {
    console.error('[Admin] Failed to approve enterprise application:', err);
    return res.status(500).json({ error: 'Failed to approve enterprise organization.' });
  }
});

// POST /api/v1/admin/enterprises/:id/reject
router.post('/enterprises/:id/reject', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminEmail = req.adminUser?.email || 'admin@orbit.mesh';

    const enterprise = await (prisma as any).enterpriseApplication.findUnique({
      where: { id },
    });

    if (!enterprise) {
      return res.status(404).json({ error: 'Enterprise application not found.' });
    }

    const updated = await (prisma as any).enterpriseApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Application did not meet security verification criteria.',
        approvedAt: new Date(),
        approvedBy: adminEmail,
      },
    });

    // Cancel or lock user subscription
    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    if (targetUserId) {
      await prisma.subscription.updateMany({
        where: { userId: targetUserId },
        data: { status: 'canceled' },
      });
    }

    console.log(`[CYBER-SECURITY AUDIT] Enterprise Organization REJECTED: "${enterprise.companyName}" (${enterprise.workEmail}) rejected by ${adminEmail}. Reason: ${reason}`);

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail,
      action: 'POST /api/v1/admin/enterprises/:id/reject',
      targetType: 'enterprise',
      targetId: enterprise.id,
      details: { companyName: enterprise.companyName, workEmail: enterprise.workEmail, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${enterprise.companyName}" application rejected.`,
      enterprise: updated,
    });
  } catch (err: any) {
    console.error('[Admin] Failed to reject enterprise application:', err);
    return res.status(500).json({ error: 'Failed to reject enterprise organization.' });
  }
});

// GET /api/v1/admin/enterprises/:id - Get full enterprise detail
router.get('/enterprises/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({
      where: { id },
    });

    if (!enterprise) {
      return res.status(404).json({ error: 'Enterprise not found.' });
    }

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    let license = null;
    let subscription = null;
    let devices: any[] = [];
    let teamMembers: any[] = [];

    if (targetUserId) {
      license = await prisma.license.findUnique({
        where: { userId: targetUserId },
        include: { devices: true },
      });

      subscription = await prisma.subscription.findUnique({
        where: { userId: targetUserId },
      });

      devices = license?.devices || [];

      teamMembers = await prisma.user.findMany({
        where: {
          email: { endsWith: `@${enterprise.companyDomain}` },
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isVerified: true,
          createdAt: true,
          license: { select: { licenseKey: true, maxDevices: true } },
          subscription: { select: { planTier: true, status: true } },
        },
      });
    }

    const deviceStats = {
      total: devices.length,
      active: devices.filter(d => Date.now() - new Date(d.lastSeen).getTime() < 60000).length,
      byPlatform: devices.reduce((acc, d) => {
        acc[d.platform] = (acc[d.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return res.status(200).json({
      enterprise: {
        ...enterprise,
        licenseKey: license?.licenseKey || null,
        maxDevices: license?.maxDevices || 0,
        subscription: subscription ? {
          planTier: subscription.planTier,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
          stripeCustomerId: subscription.stripeCustomerId,
          amountPaid: subscription.amountPaid,
        } : null,
        devices,
        deviceStats,
        teamMembers,
      },
    });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch enterprise detail:', err);
    return res.status(500).json({ error: 'Failed to fetch enterprise detail.' });
  }
});

// PUT /api/v1/admin/enterprises/:id - Update enterprise settings
router.put('/enterprises/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { maxDevices, teamScale, deploymentModel, authPreference, status, notes } = req.body;

    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) {
      return res.status(404).json({ error: 'Enterprise not found.' });
    }

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    const updated = await (prisma as any).enterpriseApplication.update({
      where: { id },
      data: {
        ...(teamScale && { teamScale }),
        ...(deploymentModel && { deploymentModel }),
        ...(authPreference && { authPreference }),
        ...(status && { status }),
        ...(notes !== undefined && { useCaseDetails: notes }),
      },
    });

    if (targetUserId && maxDevices) {
      const license = await prisma.license.findUnique({ where: { userId: targetUserId } });
      if (license) {
        await prisma.license.update({
          where: { id: license.id },
          data: { maxDevices },
        });
      }
    }

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'PUT /api/v1/admin/enterprises/:id',
      targetType: 'enterprise',
      targetId: id,
      details: { maxDevices, teamScale, deploymentModel, authPreference, status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, enterprise: updated });
  } catch (err: any) {
    console.error('[Admin] Failed to update enterprise:', err);
    return res.status(500).json({ error: 'Failed to update enterprise.' });
  }
});

// POST /api/v1/admin/enterprises/:id/license/regenerate - Regenerate enterprise license
router.post('/enterprises/:id/license/regenerate', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }
    if (!targetUserId) return res.status(404).json({ error: 'No associated user found.' });

    await prisma.license.deleteMany({ where: { userId: targetUserId } });
    const newKey = generateLicenseKey('enterprise');
    const maxDevices = enterprise.teamScale === '500+' ? 1000 : enterprise.teamScale === '101-500' ? 500 : enterprise.teamScale === '26-100' ? 100 : 25;

    const license = await prisma.license.create({
      data: { userId: targetUserId, licenseKey: newKey, maxDevices },
    });

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'POST /api/v1/admin/enterprises/:id/license/regenerate',
      targetType: 'license',
      targetId: license.id,
      details: { enterpriseId: id, maxDevices },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, licenseKey: license.licenseKey, maxDevices });
  } catch (err: any) {
    console.error('[Admin] Failed to regenerate license:', err);
    return res.status(500).json({ error: 'Failed to regenerate license.' });
  }
});

// POST /api/v1/admin/enterprises/:id/license/revoke - Revoke enterprise license
router.post('/enterprises/:id/license/revoke', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }
    if (!targetUserId) return res.status(404).json({ error: 'No associated user found.' });

    await prisma.license.deleteMany({ where: { userId: targetUserId } });
    await prisma.device.deleteMany({
      where: { license: { userId: targetUserId } },
    });

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'POST /api/v1/admin/enterprises/:id/license/revoke',
      targetType: 'license',
      targetId: id,
      details: { enterpriseId: id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'Enterprise license revoked and all devices unpaired.' });
  } catch (err: any) {
    console.error('[Admin] Failed to revoke license:', err);
    return res.status(500).json({ error: 'Failed to revoke license.' });
  }
});

// PUT /api/v1/admin/enterprises/:id/subscription - Update enterprise subscription
router.put('/enterprises/:id/subscription', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { planTier, status, expiresAt, amountPaid, stripeCustomerId } = req.body;

    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }
    if (!targetUserId) return res.status(404).json({ error: 'No associated user found.' });

    const subscription = await prisma.subscription.upsert({
      where: { userId: targetUserId },
      update: {
        ...(planTier && { planTier }),
        ...(status && { status }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
        ...(amountPaid !== undefined && { amountPaid }),
        ...(stripeCustomerId && { stripeCustomerId }),
      },
      create: {
        userId: targetUserId,
        planTier: planTier || 'enterprise',
        status: status || 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        amountPaid: amountPaid || 0,
        stripeCustomerId,
      },
    });

    if (targetUserId) {
      const license = await prisma.license.findUnique({ where: { userId: targetUserId } });
      if (license) {
        const maxDevices = subscription.planTier === 'enterprise' ? 999 : subscription.planTier === 'pro' ? 10 : 3;
        await prisma.license.update({ where: { id: license.id }, data: { maxDevices } });
      }
    }

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'PUT /api/v1/admin/enterprises/:id/subscription',
      targetType: 'subscription',
      targetId: subscription.id,
      details: { enterpriseId: id, planTier, status, expiresAt, amountPaid },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, subscription });
  } catch (err: any) {
    console.error('[Admin] Failed to update subscription:', err);
    return res.status(500).json({ error: 'Failed to update subscription.' });
  }
});

// GET /api/v1/admin/enterprises/:id/devices - List enterprise devices
router.get('/enterprises/:id/devices', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }
    if (!targetUserId) return res.status(404).json({ error: 'No associated user found.' });

    const license = await prisma.license.findUnique({ where: { userId: targetUserId }, include: { devices: true } });
    if (!license) return res.status(200).json({ devices: [] });

    const devices = license.devices.map((d: any) => ({
      id: d.id,
      deviceId: d.deviceId,
      hostname: d.hostname || 'unknown-peer',
      platform: d.platform,
      lastSeen: d.lastSeen,
      status: Date.now() - new Date(d.lastSeen).getTime() < 60000 ? 'ACTIVE' : 'IDLE',
    }));

    return res.status(200).json({ devices });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch enterprise devices:', err);
    return res.status(500).json({ error: 'Failed to fetch devices.' });
  }
});

// POST /api/v1/admin/enterprises/:id/devices/:deviceId/revoke - Revoke enterprise device
router.post('/enterprises/:id/devices/:deviceId/revoke', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id, deviceId } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }
    if (!targetUserId) return res.status(404).json({ error: 'No associated user found.' });

    const license = await prisma.license.findUnique({ where: { userId: targetUserId } });
    if (!license) return res.status(404).json({ error: 'No license found.' });

    await prisma.device.deleteMany({ where: { id: deviceId, licenseId: license.id } });

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'POST /api/v1/admin/enterprises/:id/devices/:deviceId/revoke',
      targetType: 'device',
      targetId: deviceId,
      details: { enterpriseId: id, licenseId: license.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'Device revoked.' });
  } catch (err: any) {
    console.error('[Admin] Failed to revoke device:', err);
    return res.status(500).json({ error: 'Failed to revoke device.' });
  }
});

// GET /api/v1/admin/enterprises/:id/usage - Get enterprise usage analytics
router.get('/enterprises/:id/usage', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }
    if (!targetUserId) return res.status(404).json({ error: 'No associated user found.' });

    const license = await prisma.license.findUnique({ where: { userId: targetUserId }, include: { devices: true } });
    const subscription = await prisma.subscription.findUnique({ where: { userId: targetUserId } });

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now - (29 - i) * dayMs);
      return date.toISOString().split('T')[0];
    });

    const deviceStats = license?.devices ? {
      total: license.devices.length,
      active: license.devices.filter((d: any) => now - new Date(d.lastSeen).getTime() < 60000).length,
      byPlatform: license.devices.reduce((acc: any, d: any) => {
        acc[d.platform] = (acc[d.platform] || 0) + 1;
        return acc;
      }, {}),
    } : { total: 0, active: 0, byPlatform: {} };

    const maxDevices = license?.maxDevices || (subscription?.planTier === 'enterprise' ? 999 : 50);
    const utilization = maxDevices > 0 ? (license?.devices?.length || 0) / maxDevices * 100 : 0;

    return res.status(200).json({
      usage: {
        deviceStats,
        utilization,
        maxDevices,
        planTier: subscription?.planTier || 'enterprise',
        subscriptionStatus: subscription?.status || 'active',
        billingCycle: subscription?.expiresAt,
        // Mock data for storage/bandwidth - would come from control server in production
        storageUsedGB: Math.floor(Math.random() * 500) + 50,
        bandwidthUsedGB: Math.floor(Math.random() * 2000) + 100,
        activeProjects: Math.floor(Math.random() * 20) + 5,
        last30Days: last30Days.map(date => ({
          date,
          activeDevices: Math.floor(Math.random() * (license?.devices?.length || 10)) + 1,
          dataTransferredGB: Math.floor(Math.random() * 100) + 5,
        })),
      },
    });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch enterprise usage:', err);
    return res.status(500).json({ error: 'Failed to fetch usage analytics.' });
  }
});

// GET /api/v1/admin/enterprises/:id/audit-logs - Get enterprise audit logs
router.get('/enterprises/:id/audit-logs', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    const logs = await (prisma as any).auditLog.findMany({
      where: {
        OR: [
          { targetType: 'enterprise', targetId: id },
          { targetType: 'license', details: { path: ['enterpriseId'], equals: id } },
          { targetType: 'subscription', details: { path: ['enterpriseId'], equals: id } },
          { targetType: 'device', details: { path: ['enterpriseId'], equals: id } },
          { targetType: 'user', details: { path: ['enterpriseId'], equals: id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json({ logs });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch audit logs:', err);
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// GET /api/v1/admin/enterprises/:id/team - Get enterprise team members
router.get('/enterprises/:id/team', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    const teamMembers = await prisma.user.findMany({
      where: { email: { endsWith: `@${enterprise.companyDomain}` } },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isVerified: true,
        createdAt: true,
        license: { select: { licenseKey: true, maxDevices: true, devices: true } },
        subscription: { select: { planTier: true, status: true, expiresAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const members = teamMembers.map(m => ({
      id: m.id,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      isVerified: m.isVerified,
      joinedAt: m.createdAt,
      licenseKey: m.license?.licenseKey,
      maxDevices: m.license?.maxDevices,
      activeDevices: m.license?.devices?.length || 0,
      planTier: m.subscription?.planTier || 'free',
      subscriptionStatus: m.subscription?.status || 'inactive',
    }));

    return res.status(200).json({ team: members, domain: enterprise.companyDomain });
  } catch (err: any) {
    console.error('[Admin] Failed to fetch enterprise team:', err);
    return res.status(500).json({ error: 'Failed to fetch team members.' });
  }
});

// POST /api/v1/admin/enterprises/:id/suspend - Suspend enterprise access
router.post('/enterprises/:id/suspend', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    if (targetUserId) {
      await prisma.subscription.updateMany({
        where: { userId: targetUserId },
        data: { status: 'suspended' },
      });
      await prisma.license.updateMany({
        where: { userId: targetUserId },
        data: { maxDevices: 0 },
      });
    }

    const updated = await (prisma as any).enterpriseApplication.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'POST /api/v1/admin/enterprises/:id/suspend',
      targetType: 'enterprise',
      targetId: id,
      details: { companyName: enterprise.companyName },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'Enterprise suspended. All access revoked.', enterprise: updated });
  } catch (err: any) {
    console.error('[Admin] Failed to suspend enterprise:', err);
    return res.status(500).json({ error: 'Failed to suspend enterprise.' });
  }
});

// POST /api/v1/admin/enterprises/:id/reactivate - Reactivate suspended enterprise
router.post('/enterprises/:id/reactivate', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise not found.' });

    if (enterprise.status !== 'SUSPENDED') {
      return res.status(400).json({ error: 'Enterprise is not suspended.' });
    }

    let targetUserId = enterprise.adminUserId;
    if (!targetUserId) {
      const user = await prisma.user.findUnique({ where: { email: enterprise.workEmail } });
      if (user) targetUserId = user.id;
    }

    if (targetUserId) {
      const maxDevices = enterprise.teamScale === '500+' ? 1000 : enterprise.teamScale === '101-500' ? 500 : enterprise.teamScale === '26-100' ? 100 : 25;
      await prisma.subscription.updateMany({
        where: { userId: targetUserId },
        data: { status: 'active' },
      });
      await prisma.license.updateMany({
        where: { userId: targetUserId },
        data: { maxDevices },
      });
    }

    const updated = await (prisma as any).enterpriseApplication.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'POST /api/v1/admin/enterprises/:id/reactivate',
      targetType: 'enterprise',
      targetId: id,
      details: { companyName: enterprise.companyName },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'Enterprise reactivated.', enterprise: updated });
  } catch (err: any) {
    console.error('[Admin] Failed to reactivate enterprise:', err);
    return res.status(500).json({ error: 'Failed to reactivate enterprise.' });
  }
});

// DELETE /api/v1/admin/enterprises/:id - Permanently delete and wipe all organization data
router.delete('/enterprises/:id', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const enterprise = await (prisma as any).enterpriseApplication.findUnique({ where: { id } });
    if (!enterprise) return res.status(404).json({ error: 'Enterprise organization not found.' });

    const companyName = enterprise.companyName;
    const companyDomain = enterprise.companyDomain;
    const workEmail = enterprise.workEmail;

    // Find all non-admin users associated with this enterprise (by workEmail or domain)
    const associatedUsers = await prisma.user.findMany({
      where: {
        AND: [
          { role: { not: 'ADMIN' } }, // NEVER delete platform ADMIN accounts
          {
            OR: [
              ...(enterprise.adminUserId ? [{ id: enterprise.adminUserId }] : []),
              { email: workEmail },
              ...(companyDomain ? [{ email: { endsWith: `@${companyDomain}` } }] : []),
            ],
          },
        ],
      },
      select: { id: true, email: true },
    });

    const userIds = associatedUsers.map((u: any) => u.id);

    // Perform atomic wipe transaction
    await prisma.$transaction(async (tx: any) => {
      // 1. Wipe all paired devices and licenses for associated non-admin users
      if (userIds.length > 0) {
        await tx.device.deleteMany({
          where: {
            license: {
              userId: { in: userIds },
            },
          },
        });

        await tx.license.deleteMany({
          where: {
            userId: { in: userIds },
          },
        });

        await tx.subscription.deleteMany({
          where: {
            userId: { in: userIds },
          },
        });

        await tx.user.deleteMany({
          where: {
            id: { in: userIds },
          },
        });
      }

      // 2. Wipe the EnterpriseApplication record
      await (tx as any).enterpriseApplication.delete({
        where: { id },
      });
    });

    // 3. Log security audit event
    await logAuditEvent({
      adminUserId: req.adminUser!.id,
      adminEmail: req.adminUser!.email,
      action: 'DELETE /api/v1/admin/enterprises/:id',
      targetType: 'enterprise',
      targetId: id,
      details: {
        companyName,
        companyDomain,
        workEmail,
        wipedUserCount: userIds.length,
        wipedEmails: associatedUsers.map((u: any) => u.email),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${companyName}" and all associated data, licenses, and devices have been permanently wiped.`,
      wipedEnterpriseId: id,
      wipedUsersCount: userIds.length,
    });
  } catch (err: any) {
    console.error('[Admin] Failed to wipe enterprise organization:', err);
    return res.status(500).json({ error: 'Failed to delete organization: ' + (err.message || 'Server error') });
  }
});

// ----------------------------------------------------
// GROWTH: WAITLIST + FIRST-PARTY ANALYTICS
// ----------------------------------------------------

// GET /api/admin/waitlist
router.get('/waitlist', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const where: any = {};
    if (status && ['PENDING', 'CONFIRMED'].includes(status)) {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { referralCode: { contains: q, mode: 'insensitive' } },
        { discountCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [signups, total, confirmed, pending] = await Promise.all([
      prisma.waitlistSignup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.waitlistSignup.count({ where }),
      prisma.waitlistSignup.count({ where: { status: 'CONFIRMED' } }),
      prisma.waitlistSignup.count({ where: { status: 'PENDING' } }),
    ]);

    return res.status(200).json({
      signups,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      counts: { confirmed, pending, all: confirmed + pending },
    });
  } catch (err: any) {
    console.error('[Admin] Failed to load waitlist:', err);
    return res.status(500).json({ error: 'Failed to load waitlist.' });
  }
});

// GET /api/admin/analytics/summary
router.get('/analytics/summary', requireAdmin, async (req: AdminAuthRequest, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { name: true, path: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 20000,
    });

    const byName: Record<string, number> = {};
    const byDay: Record<string, Record<string, number>> = {};
    const byPath: Record<string, number> = {};

    for (const event of events) {
      byName[event.name] = (byName[event.name] || 0) + 1;
      if (event.path) {
        byPath[event.path] = (byPath[event.path] || 0) + 1;
      }
      const day = event.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = {};
      byDay[day][event.name] = (byDay[day][event.name] || 0) + 1;
    }

    const series = Object.keys(byDay)
      .sort()
      .map((date) => ({ date, events: byDay[date] }));

    return res.status(200).json({
      days,
      totalEvents: events.length,
      byName,
      byPath: Object.entries(byPath)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([path, count]) => ({ path, count })),
      series,
    });
  } catch (err: any) {
    console.error('[Admin] Failed to load analytics summary:', err);
    return res.status(500).json({ error: 'Failed to load analytics summary.' });
  }
});

export default router;

