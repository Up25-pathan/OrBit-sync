import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { normalizeTier } from '../utils/licenseGenerator';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('=============================================');
  console.error('  CRITICAL: JWT_SECRET env var not set!');
  console.error('=============================================');
}
const JWT_SECRET_FALLBACK = JWT_SECRET || 'dev-only-insecure-fallback-change-me';

const CONTROL_SERVER_SECRET = process.env.CONTROL_SERVER_SECRET;
if (!CONTROL_SERVER_SECRET) {
  console.error('=============================================');
  console.error('  CRITICAL: CONTROL_SERVER_SECRET env var not set!');
  console.error('  Set a strong random value in production.');
  console.error('=============================================');
}
const CONTROL_SERVER_SECRET_FALLBACK = CONTROL_SERVER_SECRET || 'orbit-control-server-verification-secret-2026';

// ----------------------------------------------------
// 1. PUBLIC CONTROL SERVER LICENSE VERIFICATION ENDPOINT
// GET /api/v1/licenses/verify?key=ORBIT-PRO-9F8A2B-1775865600-A3F9B2
// ----------------------------------------------------
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const serverSecretHeader = req.headers['x-control-server-secret'];
    if (process.env.NODE_ENV === 'production' && serverSecretHeader !== CONTROL_SERVER_SECRET_FALLBACK) {
      return res.status(401).json({
        valid: false,
        status: 'UNAUTHORIZED',
        error: 'Unauthorized verification client signature.',
      });
    }

    const keyQuery = (req.query.key || req.query.licenseKey) as string;

    if (!keyQuery) {
      return res.status(400).json({
        valid: false,
        status: 'INVALID',
        error: 'License key parameter "?key=" is required.',
      });
    }

    const licenseKey = keyQuery.trim();

    // Query database for license, user details, and active subscription
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        user: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!license) {
      return res.status(404).json({
        valid: false,
        status: 'NOT_FOUND',
        error: 'The license key provided was not found in the OrBit website registry.',
      });
    }

    const user = license.user;
    const subscription = user.subscription;

    // Check subscription validity
    if (!subscription || subscription.status !== 'active') {
      return res.status(402).json({
        valid: false,
        status: 'INACTIVE',
        error: 'The subscription associated with this license key is currently inactive.',
      });
    }

    if (new Date(subscription.expiresAt) < new Date()) {
      return res.status(402).json({
        valid: false,
        status: 'EXPIRED',
        error: 'The subscription associated with this license key has expired.',
      });
    }

    const planTier = normalizeTier(subscription.planTier);
    const displayName = user.displayName || user.email.split('@')[0];

    // Return structured payload matching Dual-Server System Architecture specification
    return res.status(200).json({
      valid: true,
      status: 'VALID',
      userId: user.id,
      displayName,
      email: user.email,
      planTier,
      expiresAt: subscription.expiresAt.toISOString(),
    });

  } catch (error: any) {
    console.error('[Control Server Verification Error]:', error);
    return res.status(500).json({
      valid: false,
      status: 'ERROR',
      error: 'Internal server error verifying license key.',
    });
  }
});

// Also support POST /api/v1/licenses/verify for Control Server JSON requests
router.post('/verify', async (req: Request, res: Response) => {
  const licenseKey = req.body?.licenseKey || req.body?.key || (req.query.key as string);
  
  if (!licenseKey) {
    return res.status(400).json({
      valid: false,
      status: 'INVALID',
      error: 'License key is required in JSON body or query.',
    });
  }

  // Delegate to logic by simulating query param
  req.query.key = licenseKey;
  
  // If it's a device handshake request containing deviceId, process node registration
  if (req.body?.deviceId) {
    return handleDeviceHandshake(req, res);
  }

  // Standard Control Server key validation
  try {
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        user: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!license) {
      return res.status(404).json({ valid: false, status: 'NOT_FOUND', error: 'License key not found.' });
    }

    const user = license.user;
    const subscription = user.subscription;

    if (!subscription || subscription.status !== 'active' || new Date(subscription.expiresAt) < new Date()) {
      return res.status(402).json({ valid: false, status: 'EXPIRED', error: 'Subscription is inactive or expired.' });
    }

    const planTier = normalizeTier(subscription.planTier);
    const displayName = user.displayName || user.email.split('@')[0];

    return res.status(200).json({
      valid: true,
      status: 'VALID',
      userId: user.id,
      displayName,
      email: user.email,
      planTier,
      expiresAt: subscription.expiresAt.toISOString(),
    });

  } catch (error: any) {
    console.error('License verify error:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error.' });
  }
});

// Helper for desktop device node heartbeat registration
async function handleDeviceHandshake(req: Request, res: Response) {
  try {
    const { licenseKey, deviceId, hostname, platform } = req.body;

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
      return res.status(404).json({ status: 'INVALID', message: 'License key provided is invalid.' });
    }

    const subscription = license.user.subscription;
    if (!subscription || subscription.status !== 'active' || new Date(subscription.expiresAt) < new Date()) {
      return res.status(402).json({ status: 'EXPIRED', message: 'Subscription expired or inactive.' });
    }

    const planTier = normalizeTier(subscription.planTier);
    const maxDevices = planTier === 'pro' ? 10 : planTier === 'enterprise' ? 999 : 3;

    const existingDevice = license.devices.find((d) => d.deviceId === deviceId);

    if (existingDevice) {
      await prisma.device.update({
        where: { id: existingDevice.id },
        data: {
          lastSeen: new Date(),
          hostname: hostname || existingDevice.hostname,
          platform: platform || existingDevice.platform,
        },
      });
    } else {
      if (license.devices.length >= maxDevices) {
        return res.status(409).json({
          status: 'LIMIT_EXCEEDED',
          message: `Subscription limit of ${maxDevices} node devices reached.`,
        });
      }

      await prisma.device.create({
        data: {
          licenseId: license.id,
          deviceId,
          hostname: hostname || 'peer-node',
          platform: platform || 'linux',
        },
      });
    }

    const validationToken = jwt.sign(
      {
        status: 'VALID',
        userId: license.user.id,
        planTier,
        expiresAt: subscription.expiresAt.toISOString(),
        deviceId,
      },
      JWT_SECRET_FALLBACK,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      status: 'VALID',
      planTier,
      expiresAt: subscription.expiresAt.toISOString(),
      token: validationToken,
    });
  } catch (error: any) {
    console.error('Device handshake error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export default router;
