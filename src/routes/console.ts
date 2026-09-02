import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest, authenticateJWT, hashPassword, verifyPassword } from '../auth';
import { generateLicenseKey, parseLicenseKey, normalizeTier } from '../utils/licenseGenerator';
import { sendPasswordChangeOtpEmail } from '../utils/mailer';

const router = Router();

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
    } else {
      // Auto-sync existing license key to the current subscription tier if there is a mismatch!
      const subscriptionTier = user.subscription?.planTier || 'free';
      const parsed = parseLicenseKey(userLicense.licenseKey);
      const normalizedSubTier = normalizeTier(subscriptionTier);

      if (parsed.planTier !== normalizedSubTier) {
        const newLicenseKey = generateLicenseKey(subscriptionTier);
        const maxDevices = subscriptionTier === 'enterprise' ? 9999 : (subscriptionTier === 'pro' ? 10 : 3);

        userLicense = await prisma.license.update({
          where: { id: userLicense.id },
          data: {
            licenseKey: newLicenseKey,
            maxDevices,
          },
          include: { devices: true },
        });
        console.log(`[License Sync] Automatically upgraded license key for user: ${user.email} from ${parsed.planTier.toUpperCase()} to ${normalizedSubTier.toUpperCase()}`);
      }
    }

    return res.status(200).json({
      user: {
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled || false,
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
    const { displayName, avatarUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = String(displayName).trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = String(avatarUrl).trim();

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

// ----------------------------------------------------
// SECURE OTP PASSWORD CHANGE ENDPOINTS
// ----------------------------------------------------

// POST /api/console/password/request-otp
router.post('/password/request-otp', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (String(newPassword).trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Verify that current password is correct
    const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'The current password you entered is incorrect.' });
    }

    // Generate cryptographic 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationCode: code,
        verificationExpires: expiresAt,
      },
    });

    // Dispatch Security Alert OTP email via Resend
    sendPasswordChangeOtpEmail(user.email, code).catch((err) => {
      console.error('[Background Password OTP Dispatch Error]:', err);
    });

    return res.status(200).json({
      success: true,
      message: 'A 6-digit security confirmation code has been dispatched to your email.',
      email: user.email,
    });
  } catch (err: any) {
    console.error('Password request OTP error:', err);
    return res.status(500).json({ error: 'Failed to generate password verification code.' });
  }
});

// POST /api/console/password/verify-and-update
router.post('/password/verify-and-update', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { code, currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!code || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Verification code, current password, and new password are required.' });
    }

    const cleanCode = String(code).trim();
    const cleanNewPass = String(newPassword).trim();

    if (cleanNewPass.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Verify current password again
    const isCurrentValid = verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password verification failed.' });
    }

    // Verify OTP code
    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email.' });
    }

    // Check expiry
    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Hash new password
    const newPasswordHash = hashPassword(cleanNewPass);

    // Update password and invalidate OTP code
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        verificationCode: null,
        verificationExpires: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully! Your account is secure.',
    });
  } catch (err: any) {
    console.error('Password verify and update error:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// POST /api/console/2fa/toggle
router.post('/2fa/toggle', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { enabled } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: Boolean(enabled),
      },
    });

    return res.status(200).json({
      success: true,
      twoFactorEnabled: updated.twoFactorEnabled,
      message: updated.twoFactorEnabled 
        ? 'Two-Factor Authentication (Email OTP) enabled successfully.' 
        : 'Two-Factor Authentication disabled.',
    });
  } catch (err: any) {
    console.error('2FA toggle error:', err);
    return res.status(500).json({ error: 'Failed to update 2FA settings.' });
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
