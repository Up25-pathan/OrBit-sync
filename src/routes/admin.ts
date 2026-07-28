import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import { verifyToken, hashPassword, verifyPassword } from '../auth';
import { generateLicenseKey, normalizeTier } from '../utils/licenseGenerator';

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
      const cookies = req.headers.cookie.split(';').reduce((acc: any, c) => {
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
    const adminBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
    if (!adminBootstrapKey) {
      console.error('=============================================');
      console.error('  CRITICAL: ADMIN_BOOTSTRAP_KEY env var not set!');
      console.error('  Set a strong random value in production.');
      console.error('=============================================');
    }
    const expectedKey = adminBootstrapKey || 'dev-only-insecure-bootstrap-key';

    if (incomingBootstrapKey !== expectedKey) {
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
      const isValid = verifyPassword(currentPassword, admin.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password provided is incorrect.' });
      }
    }

    const newHash = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: adminId },
      data: { passwordHash: newHash },
    });

    return res.status(200).json({ success: true, message: 'Admin password updated successfully.' });
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

    subscriptions.forEach((sub) => {
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

    const formattedUsers = users.map((u) => ({
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
router.put('/users/:id/tier', async (req: Request, res: Response) => {
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
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId: id,
        planTier: tier,
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Update max device limits on license record
    await prisma.license.updateMany({
      where: { userId: id },
      data: { maxDevices: newMaxDevices },
    });

    return res.status(200).json({ success: true, subscription: updatedSubscription });
  } catch (err: any) {
    console.error('Tier override error:', err);
    return res.status(500).json({ error: 'Failed to override user subscription tier.' });
  }
});

// POST /api/v1/admin/users/:id/license/rotate (Admin Rotate License Key)
router.post('/users/:id/license/rotate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const tier = normalizeTier(user.subscription?.planTier || 'free');
    const newLicenseKey = generateLicenseKey(tier);

    const license = await prisma.license.upsert({
      where: { userId: id },
      update: { licenseKey: newLicenseKey },
      create: { userId: id, licenseKey: newLicenseKey, maxDevices: tier === 'pro' ? 10 : 3 },
    });

    return res.status(200).json({ success: true, licenseKey: license.licenseKey });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to rotate license key.' });
  }
});

// DELETE /api/v1/admin/users/:id (Delete User Account)
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'User account deleted successfully.' });
  } catch (err: any) {
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

    const result = licenses.map((l) => ({
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

    const result = devices.map((d) => ({
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

export default router;
