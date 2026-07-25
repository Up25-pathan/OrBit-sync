import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { verifyToken, hashPassword, verifyPassword } from '../auth';
import { generateLicenseKey, normalizeTier } from '../utils/licenseGenerator';

const router = Router();

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
    const { email, bootstrapKey } = req.body;
    const expectedKey = process.env.ADMIN_BOOTSTRAP_KEY || 'orbit_admin_super_secret_bootstrap_2026';

    if (bootstrapKey !== expectedKey) {
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

export default router;
