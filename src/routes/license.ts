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

// Helper to resolve effective plan tier and subscription validity
function resolveEffectiveSubscription(subscription: any) {
  const isSubActive = subscription && 
                      subscription.status === 'active' && 
                      new Date(subscription.expiresAt) >= new Date();

  const planTier = isSubActive ? normalizeTier(subscription.planTier) : 'free';
  return {
    isSubActive,
    planTier,
    expiresAt: subscription?.expiresAt ? subscription.expiresAt.toISOString() : new Date().toISOString(),
    amountPaid: subscription?.amountPaid || 0,
  };
}

// ----------------------------------------------------
// 1. PUBLIC CONTROL SERVER LICENSE VERIFICATION ENDPOINT
// GET /api/v1/licenses/verify?key=ORBIT-7F9A-B23C-8E1D-4A5B
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

    // Query database for license, user details, and subscription
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
    const { planTier, expiresAt, amountPaid } = resolveEffectiveSubscription(user.subscription);
    const displayName = user.displayName || user.email.split('@')[0];

    // Return structured payload matching Dual-Server System Architecture specification
    return res.status(200).json({
      valid: true,
      status: 'VALID',
      userId: user.id,
      displayName,
      avatarUrl: user.avatarUrl || null,
      email: user.email,
      planTier,
      price: amountPaid,
      expiresAt,
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

  // Delegate to device handshake if deviceId is provided
  if (req.body?.deviceId) {
    return handleDeviceHandshake(req, res);
  }

  // Standard Control Server key validation
  try {
    const license = await prisma.license.findUnique({
      where: { licenseKey: licenseKey.trim() },
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
    const { planTier, expiresAt, amountPaid } = resolveEffectiveSubscription(user.subscription);
    const displayName = user.displayName || user.email.split('@')[0];

    return res.status(200).json({
      valid: true,
      status: 'VALID',
      userId: user.id,
      displayName,
      avatarUrl: user.avatarUrl || null,
      email: user.email,
      planTier,
      price: amountPaid,
      expiresAt,
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
      where: { licenseKey: (licenseKey || '').trim() },
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

    const { planTier, expiresAt, amountPaid } = resolveEffectiveSubscription(license.user.subscription);
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
        expiresAt,
        deviceId,
      },
      JWT_SECRET_FALLBACK,
      { expiresIn: '30d' }
    );

    const displayName = license.user.displayName || license.user.email.split('@')[0];

    return res.status(200).json({
      valid: true,
      status: 'VALID',
      userId: license.user.id,
      displayName,
      avatarUrl: license.user.avatarUrl || null,
      email: license.user.email,
      planTier,
      price: amountPaid,
      expiresAt,
      token: validationToken,
    });
  } catch (error: any) {
    console.error('Device handshake error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export default router;
