import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest, authenticateJWT, hashPassword } from '../auth';
import { generateLicenseKey } from '../utils/licenseGenerator';

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

    let userLicense = user.license;
    if (!userLicense) {
      const generatedKey = generateLicenseKey(user.subscription?.planTier || 'free');
      userLicense = await prisma.license.create({
        data: {
          userId,
          licenseKey: generatedKey,
          maxDevices: user.subscription?.planTier === 'enterprise' ? 9999 : 3,
        },
        include: { devices: true },
      });
    }

    return res.status(200).json({
      user: {
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || null,
        role: user.role,
      },
      license: {
        licenseKey: userLicense.licenseKey,
        maxDevices: userLicense.maxDevices,
      },
      subscription: user.subscription
        ? {
            planTier: user.subscription.planTier,
            status: user.subscription.status,
            expiresAt: user.subscription.expiresAt,
          }
        : null,
      devices: userLicense.devices
        ? userLicense.devices.map((dev) => ({
            id: dev.id,
            hostname: dev.hostname || 'unknown-host',
            platform: dev.platform,
            status: (Date.now() - new Date(dev.lastSeen).getTime()) < 60000 ? 'ACTIVE' : 'IDLE', // active if seen in last 60s
            ping: parseFloat((Math.random() * 2 + 0.5).toFixed(1)), // mock active ping values
            lastSeen: new Date(dev.lastSeen).toISOString(),
          }))
        : [],
      invoices: (user.subscription && user.subscription.planTier !== 'free' && user.subscription.planTier !== 'Free Tier')
        ? [
            {
              id: `INV-${new Date(user.createdAt).getFullYear()}-001`,
              date: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              amount: user.subscription.planTier === 'mesh' ? '$24.00' : '$9.00',
              status: user.subscription.status === 'active' ? 'PAID' : 'PENDING',
            },
          ]
        : [],
    });
  } catch (error: any) {
    console.error('Fetch dashboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

// POST /api/console/profile/update
router.post('/profile/update', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { displayName, avatarUrl, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = String(displayName).trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = String(avatarUrl).trim();
    if (newPassword && String(newPassword).trim().length > 0) {
      updateData.passwordHash = hashPassword(String(newPassword).trim());
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        avatarUrl: (updatedUser as any).avatarUrl || null,
        role: updatedUser.role,
      },
    });
  } catch (err: any) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ error: 'Failed to update profile settings.' });
  }
});

// POST /api/console/license/rotate (Disabled for user self-service security)
router.post('/license/rotate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: 'Self-service key rotation is disabled for system security during Beta. Contact an administrator for key re-issuance.',
  });
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

    return res.status(200).json({
      message: 'License key is permanently locked for Beta launch. Self-service key rotation is disabled.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process request.' });
  }
});

// POST /tickets (Public / Desktop App Bug Report submission)
router.post('/tickets', async (req: any, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message content are required.' });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        name: name ? String(name).trim() : 'OrBit Desktop Client User',
        email: email ? String(email).trim() : 'client-report@orbit-sync.com',
        subject: String(subject).trim(),
        message: String(message).trim(),
        status: 'OPEN',
      },
    });

    return res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    console.error('Error submitting bug report ticket:', err);
    return res.status(500).json({ error: 'Failed to submit bug report.' });
  }
});

export default router;
