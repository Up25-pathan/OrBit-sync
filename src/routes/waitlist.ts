import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { createRateLimiter } from '../utils/rateLimiter';
import { authenticateJWT, AuthRequest } from '../auth';
import { createWaitlistCoupon, EARLY_BIRD_PERCENT, normalizeCouponCode } from '../utils/coupons';
import { sendWaitlistConfirmationEmail, sendWaitlistWelcomeEmail, sendWaitlistLaunchReminderEmail } from '../utils/mailer';

const router = Router();

const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  source: z.string().trim().max(40).optional(),
  referredBy: z.string().trim().max(40).optional(),
  os: z.string().trim().max(40).optional(),
  teamSize: z.string().trim().max(40).optional(),
  useCase: z.string().trim().max(200).optional(),
});

function randomReferralCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(7);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `ORB-${out}`;
}

function clientUrl(req: Request): string {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL.replace(/\/$/, '');
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') {
    const origin = req.get('origin');
    if (origin) return origin.replace(/\/$/, '');
    return 'http://localhost:3000';
  }
  return 'https://orbit-sync.dev';
}

function requestIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip;
}

// POST /api/waitlist
router.post(
  '/',
  createRateLimiter({ maxRequests: 30, windowMs: 60000, keyPrefix: 'waitlist:signup' }),
  async (req: Request, res: Response) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid signup details.' });
      }

      const email = parsed.data.email.toLowerCase();
      const referredBy = parsed.data.referredBy ? normalizeCouponCode(parsed.data.referredBy) : undefined;
      const confirmationToken = crypto.randomBytes(32).toString('hex');
      const confirmationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const existing = await prisma.waitlistSignup.findUnique({ where: { email } });

      if (existing?.status === 'CONFIRMED') {
        return res.status(200).json({
          success: true,
          alreadyConfirmed: true,
          message: 'You are already on the early-access list. Check your inbox for your discount code.',
        });
      }

      if (existing) {
        await prisma.waitlistSignup.update({
          where: { id: existing.id },
          data: {
            confirmationToken,
            confirmationExpires,
            source: parsed.data.source || existing.source,
            os: parsed.data.os || existing.os,
            teamSize: parsed.data.teamSize || existing.teamSize,
            useCase: parsed.data.useCase || existing.useCase,
            referredBy: referredBy || existing.referredBy,
          },
        });
      } else {
        let referralCode = randomReferralCode();
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const collision = await prisma.waitlistSignup.findUnique({ where: { referralCode } });
          if (!collision) break;
          referralCode = randomReferralCode();
        }

        await prisma.waitlistSignup.create({
          data: {
            email,
            referralCode,
            referredBy: referredBy || null,
            status: 'PENDING',
            confirmationToken,
            confirmationExpires,
            source: parsed.data.source || 'unknown',
            os: parsed.data.os || null,
            teamSize: parsed.data.teamSize || null,
            useCase: parsed.data.useCase || null,
            ipAddress: requestIp(req) || null,
            userAgent: req.headers['user-agent'] || null,
          },
        });
      }

      const confirmUrl = `${clientUrl(req)}/waitlist/confirmed?token=${encodeURIComponent(confirmationToken)}`;

      sendWaitlistConfirmationEmail(email, confirmUrl).catch((err) => {
        console.error('[Waitlist] Confirmation email failed:', err);
      });

      return res.status(200).json({
        success: true,
        pending: true,
        message: 'Check your inbox and confirm your email to unlock your 50% early-bird code.',
      });
    } catch (err: any) {
      console.error('[Waitlist] Signup error:', err);
      return res.status(500).json({ error: 'Could not join the early-access list. Please try again.' });
    }
  }
);

// GET /api/waitlist/confirm?token=...
router.get('/confirm', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const wantsJson = req.query.format === 'json' || (req.get('accept') || '').includes('application/json');
  const base = clientUrl(req);

  if (!token) {
    if (wantsJson) return res.status(400).json({ error: 'Confirmation token is required.' });
    return res.redirect(`${base}/waitlist/confirmed?error=missing`);
  }

  try {
    const signup = await prisma.waitlistSignup.findUnique({ where: { confirmationToken: token } });

    if (!signup) {
      if (wantsJson) return res.status(404).json({ error: 'This confirmation link is invalid.' });
      return res.redirect(`${base}/waitlist/confirmed?error=invalid`);
    }

    if (signup.status === 'CONFIRMED') {
      if (wantsJson) {
        return res.status(200).json({
          success: true,
          alreadyConfirmed: true,
          referralCode: signup.referralCode,
          discountCode: signup.discountCode,
          position: signup.position,
        });
      }
      return res.redirect(
        `${base}/waitlist/confirmed?code=${encodeURIComponent(signup.referralCode)}&coupon=${encodeURIComponent(
          signup.discountCode || ''
        )}&position=${signup.position || ''}`
      );
    }

    if (signup.confirmationExpires && signup.confirmationExpires.getTime() < Date.now()) {
      if (wantsJson) return res.status(410).json({ error: 'This confirmation link has expired.' });
      return res.redirect(`${base}/waitlist/confirmed?error=expired`);
    }

    let discountCode = signup.discountCode;
    if (!discountCode) {
      const coupon = await createWaitlistCoupon();
      discountCode = coupon.code;
    }

    const confirmedCount = await prisma.waitlistSignup.count({ where: { status: 'CONFIRMED' } });
    const position = confirmedCount + 1;

    const confirmed = await prisma.waitlistSignup.update({
      where: { id: signup.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmationExpires: null,
        discountCode,
        position,
      },
    });

    if (confirmed.referredBy) {
      await prisma.waitlistSignup.updateMany({
        where: { referralCode: confirmed.referredBy, status: 'CONFIRMED' },
        data: { referralCount: { increment: 1 } },
      });
    }

    const referralUrl = `${base}/?ref=${encodeURIComponent(confirmed.referralCode)}`;

    sendWaitlistWelcomeEmail(confirmed.email, {
      referralCode: confirmed.referralCode,
      discountCode: discountCode!,
      referralUrl,
      position,
    }).catch((err) => {
      console.error('[Waitlist] Welcome email failed:', err);
    });

    sendWaitlistLaunchReminderEmail(confirmed.email, {
      discountCode: discountCode!,
      referralCode: confirmed.referralCode,
      referralUrl,
      position,
    }).catch((err) => {
      console.error('[Waitlist] Launch reminder email failed:', err);
    });

    if (wantsJson) {
      return res.status(200).json({
        success: true,
        referralCode: confirmed.referralCode,
        discountCode,
        position,
      });
    }

    return res.redirect(
      `${base}/waitlist/confirmed?code=${encodeURIComponent(confirmed.referralCode)}&coupon=${encodeURIComponent(
        discountCode!
      )}&position=${position}`
    );
  } catch (err: any) {
    console.error('[Waitlist] Confirmation error:', err);
    if (wantsJson) return res.status(500).json({ error: 'Could not confirm your email.' });
    return res.redirect(`${base}/waitlist/confirmed?error=server`);
  }
});

// GET /api/waitlist/stats - real counts only
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [confirmed, total] = await Promise.all([
      prisma.waitlistSignup.count({ where: { status: 'CONFIRMED' } }),
      prisma.waitlistSignup.count(),
    ]);

    return res.status(200).json({
      confirmed,
      total,
      earlyBirdPercent: EARLY_BIRD_PERCENT,
    });
  } catch (err: any) {
    console.error('[Waitlist] Stats error:', err);
    return res.status(500).json({ error: 'Could not load waitlist stats.' });
  }
});

// GET /api/waitlist/me - current user's waitlist referral info (auth required)
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;
    if (!userId || !email) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const signup = await prisma.waitlistSignup.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        referralCode: true,
        discountCode: true,
        status: true,
        referralCount: true,
        createdAt: true,
        confirmedAt: true,
      },
    });

    return res.status(200).json({ signup });
  } catch (err: any) {
    console.error('[Waitlist] Me lookup error:', err);
    return res.status(500).json({ error: 'Could not load your referral info.' });
  }
});

export default router;
