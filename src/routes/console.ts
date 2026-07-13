import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest, authenticateJWT } from '../auth';

const express = require('express');
const router = express.Router();

// GET /api/console/dashboard
router.get('/dashboard', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Get user details, license key, subscription and paired devices
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        license: {
          include: {
            devices: true,
          },
        },
        subscription: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({
      user: {
        email: user.email,
      },
      license: user.license
        ? {
            licenseKey: user.license.licenseKey,
            maxDevices: user.license.maxDevices,
          }
        : null,
      subscription: user.subscription
        ? {
            planTier: user.subscription.planTier,
            status: user.subscription.status,
            expiresAt: user.subscription.expiresAt,
          }
        : null,
      devices: user.license?.devices
        ? user.license.devices.map((dev) => ({
            id: dev.id,
            hostname: dev.hostname || 'unknown-host',
            platform: dev.platform,
            status: (Date.now() - new Date(dev.lastSeen).getTime()) < 60000 ? 'ACTIVE' : 'IDLE', // active if seen in last 60s
            ping: parseFloat((Math.random() * 2 + 0.5).toFixed(1)), // mock active ping values
            lastSeen: new Date(dev.lastSeen).toISOString(),
          }))
        : [],
    });
  } catch (error: any) {
    console.error('Fetch dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error fetching dashboard.' });
  }
});

// POST /api/console/license/rotate
router.post('/license/rotate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const keyHex = crypto.randomBytes(12).toString('hex');
    const licenseKey = `orbit_dev_pk_${keyHex}`;

    // Update license key signature in DB
    const updated = await prisma.license.update({
      where: { userId },
      data: {
        licenseKey,
      },
    });

    return res.status(200).json({
      licenseKey: updated.licenseKey,
    });
  } catch (error: any) {
    console.error('Rotate license error:', error);
    return res.status(500).json({ error: 'Internal server error rotating license.' });
  }
});

// POST /api/console/devices/revoke
router.post('/devices/revoke', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deviceRowId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!deviceRowId) {
      return res.status(400).json({ error: 'Device row ID is required.' });
    }

    // Verify the device belongs to the user's license
    const device = await prisma.device.findFirst({
      where: {
        id: deviceRowId,
        license: {
          userId,
        },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found or not owned.' });
    }

    // Delete device mapping
    await prisma.device.delete({
      where: { id: deviceRowId },
    });

    return res.status(200).json({ success: true, message: 'Device authorization revoked.' });
  } catch (error: any) {
    console.error('Revoke device error:', error);
    return res.status(500).json({ error: 'Internal server error revoking device.' });
  }
});

export default router;
