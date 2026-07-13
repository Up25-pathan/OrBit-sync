import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'orbit-secret-key-signature-token-safe-random-2026';

// POST /api/license/verify
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { licenseKey, deviceId, hostname, platform } = req.body;

    if (!licenseKey || !deviceId) {
      return res.status(400).json({ error: 'License key and device ID are required.' });
    }

    // 1. Find the license key in DB
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        devices: true,
        user: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!license) {
      return res.status(404).json({
        status: 'INVALID',
        message: 'The license key provided is invalid.',
      });
    }

    // 2. Validate user subscription status
    const subscription = license.user.subscription;
    if (!subscription || subscription.status !== 'active' || new Date(subscription.expiresAt) < new Date()) {
      return res.status(402).json({
        status: 'EXPIRED',
        message: 'The subscription associated with this license has expired or is inactive.',
      });
    }

    // 3. Check node limitations
    const maxDevices = subscription.planTier === 'mesh' ? 15 : license.maxDevices;
    const existingDevice = license.devices.find((d) => d.deviceId === deviceId);

    if (existingDevice) {
      // Device is already registered: Update heartbeat/lastSeen
      await prisma.device.update({
        where: { id: existingDevice.id },
        data: {
          lastSeen: new Date(),
          hostname: hostname || existingDevice.hostname,
          platform: platform || existingDevice.platform,
        },
      });
    } else {
      // New device pairing request: Check capacity limits
      if (license.devices.length >= maxDevices) {
        return res.status(409).json({
          status: 'LIMIT_EXCEEDED',
          message: `Your subscription tier limit of ${maxDevices} active node devices has been reached. Please revoke an existing device or upgrade.`,
        });
      }

      // Add device mapping
      await prisma.device.create({
        data: {
          licenseId: license.id,
          deviceId,
          hostname: hostname || 'unknown-peer',
          platform: platform || 'linux',
        },
      });
    }

    // 4. Return cryptographically signed validation token
    const payload = {
      status: 'VALID',
      plan: subscription.planTier === 'mesh' ? 'Mesh Cluster' : 'Solo Developer',
      expiresAt: subscription.expiresAt.toISOString(),
      deviceId,
    };

    // Sign the validation token with HMAC-SHA256
    const validationToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      status: 'VALID',
      plan: payload.plan,
      expiresAt: payload.expiresAt,
      token: validationToken,
    });
  } catch (error: any) {
    console.error('License verification error:', error);
    return res.status(500).json({ error: 'Internal server error verifying license.' });
  }
});

export default router;
