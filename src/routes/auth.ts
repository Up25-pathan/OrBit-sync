import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../db';
import { hashPassword, verifyPassword, signToken } from '../auth';

const router = Router();

// Nodemailer SMTP setup
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';

const transporter = smtpHost && smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })
  : null;

// Helper to provision default license and subscription for new users
async function provisionUserDefaultResources(tx: any, userId: string) {
  // Generate default license key
  const keyHex = crypto.randomBytes(12).toString('hex');
  const licenseKey = `orbit_dev_pk_${keyHex}`;

  await tx.license.create({
    data: {
      userId,
      licenseKey,
      maxDevices: 3,
    },
  });

  // Create free Community subscription active for 1 year
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await tx.subscription.create({
    data: {
      userId,
      planTier: 'solo',
      status: 'active',
      expiresAt,
    },
  });
}

// ----------------------------------------------------
// SECTION A: EMAIL & PASSWORD REGISTRATION WITH CODES
// ----------------------------------------------------

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    // Save unverified user profile in database
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        isVerified: false,
        verificationCode: code,
        verificationExpires: expiresAt,
      },
    });

    // Send code to email
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"OrBit Security" <${smtpUser}>`,
          to: email,
          subject: 'OrBit Portal - Verify Your Email',
          text: `Your email verification code is: ${code}. It expires in 15 minutes.`,
          html: `
            <div style="background:#0c0a0a; color:#fff; padding:30px; font-family:sans-serif; border:1px solid #ff003c; border-radius:8px; max-width: 480px; margin: 0 auto;">
              <h2 style="color:#ff003c; text-align: center; font-family: monospace;">Email Verification</h2>
              <p>Welcome to OrBit Platform. Use the code below to complete your developer registration:</p>
              <div style="font-size:36px; font-weight:bold; letter-spacing:6px; padding:15px; background:#181414; border-radius:6px; text-align:center; color:#ff003c; margin:25px 0; border: 1px solid rgba(255, 0, 60, 0.2);">${code}</div>
              <p style="color:#808085; font-size:12px; text-align: center;">This verification code is valid for 15 minutes.</p>
            </div>
          `,
        });
        console.log(`[SMTP Mailer] Verification email successfully sent to ${email}`);
      } catch (err) {
        console.error('[SMTP Mailer Error] Failed to send SMTP email:', err);
      }
    } else {
      // Sandbox fallback: print code directly in logs
      console.log(`=========================================`);
      console.log(`[SMTP Sandbox] EMAIL VERIFICATION CODE`);
      console.log(`Recipient: ${email}`);
      console.log(`Verification Code: ${code}`);
      console.log(`=========================================`);
    }

    return res.status(200).json({
      status: 'PENDING_VERIFICATION',
      email,
      message: 'A 6-digit verification code has been dispatched.',
    });

  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/verify-code
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ error: 'Verification profile not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'This account is already verified.' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please signup again.' });
    }

    // Verify user and provision resources in a secure transaction block
    const result = await prisma.$transaction(async (tx) => {
      const verifiedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          verificationCode: null,
          verificationExpires: null,
        },
      });

      await provisionUserDefaultResources(tx, user.id);

      const license = await tx.license.findUnique({ where: { userId: user.id } });
      const subscription = await tx.subscription.findUnique({ where: { userId: user.id } });

      return { user: verifiedUser, license, subscription };
    });

    // Sign session JWT token
    const token = signToken({ id: result.user.id, email: result.user.email });

    res.cookie('orbit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        licenseKey: result.license?.licenseKey || '',
        planTier: result.subscription?.planTier || 'solo',
      },
      token,
    });

  } catch (error: any) {
    console.error('Verification verify code error:', error);
    return res.status(500).json({ error: 'Internal server error verifying profile.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        license: true,
        subscription: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify Password
    const isValidPassword = verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Block unverified logins
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Email verification is pending.',
        status: 'PENDING_VERIFICATION',
        email: user.email,
      });
    }

    const token = signToken({ id: user.id, email: user.email });

    res.cookie('orbit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        licenseKey: user.license?.licenseKey || '',
        planTier: user.subscription?.planTier || 'solo',
      },
      token,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});


// ----------------------------------------------------
// SECTION B: GOOGLE & GITHUB OAUTH 2.0 REDIRECTS
// ----------------------------------------------------

// GET /api/auth/google
router.get('/google', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
    console.log('[Google OAuth Sandbox] No credentials found. Redirecting to sandbox callback...');
    return res.redirect('/api/auth/google/callback');
  }
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent('profile email')}`;
  return res.redirect(url);
});

// GET /api/auth/github
router.get('/github', (req: Request, res: Response) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_REDIRECT_URI) {
    console.log('[GitHub OAuth Sandbox] No credentials found. Redirecting to sandbox callback...');
    return res.redirect('/api/auth/github/callback');
  }
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent('user:email')}`;
  return res.redirect(url);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    // 1. Sandbox Google login simulation
    if (!process.env.GOOGLE_CLIENT_ID || !code) {
      console.log(`[Google OAuth Sandbox] Mocking login for developer...`);
      const mockEmail = 'google-developer@orbit.dev';

      let user = await prisma.user.findUnique({ where: { email: mockEmail }, include: { license: true, subscription: true } });

      if (!user) {
        // Create verified Google user directly
        user = await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: { email: mockEmail, passwordHash: 'oauth_dummy_hash_2026', isVerified: true },
          });
          await provisionUserDefaultResources(tx, u.id);
          return tx.user.findUnique({ where: { id: u.id }, include: { license: true, subscription: true } });
        }) as any;
      }

      const token = signToken({ id: user!.id, email: user!.email });
      return res.redirect(`${clientUrl}/console?oauth_success=true&token=${token}&email=${user!.email}`);
    }

    // 2. Real Google OAuth
    // Fetch google tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenRes.json()) as any;

    // Fetch user details from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileRes.json()) as any;
    const email = profile.email;

    let user = await prisma.user.findUnique({ where: { email }, include: { license: true, subscription: true } });

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email, passwordHash: crypto.randomBytes(16).toString('hex'), isVerified: true },
        });
        await provisionUserDefaultResources(tx, u.id);
        return tx.user.findUnique({ where: { id: u.id }, include: { license: true, subscription: true } });
      }) as any;
    }

    const token = signToken({ id: user!.id, email: user!.email });
    return res.redirect(`${clientUrl}/console?oauth_success=true&token=${token}&email=${user!.email}`);

  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=Google OAuth failed`);
  }
});

// GET /api/auth/github/callback
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    // 1. Sandbox GitHub login simulation
    if (!process.env.GITHUB_CLIENT_ID || !code) {
      console.log(`[GitHub OAuth Sandbox] Mocking login for developer...`);
      const mockEmail = 'github-developer@orbit.dev';

      let user = await prisma.user.findUnique({ where: { email: mockEmail }, include: { license: true, subscription: true } });

      if (!user) {
        user = await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: { email: mockEmail, passwordHash: 'oauth_dummy_hash_2026', isVerified: true },
          });
          await provisionUserDefaultResources(tx, u.id);
          return tx.user.findUnique({ where: { id: u.id }, include: { license: true, subscription: true } });
        }) as any;
      }

      const token = signToken({ id: user!.id, email: user!.email });
      return res.redirect(`${clientUrl}/console?oauth_success=true&token=${token}&email=${user!.email}`);
    }

    // 2. Real GitHub OAuth
    // Fetch GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const tokens = (await tokenRes.json()) as any;

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userProfile = (await userRes.json()) as any;

    // Fetch user email
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const emails = (await emailsRes.json()) as any;
    const primaryEmail = emails.find((e: any) => e.primary)?.email || userProfile.email || `${userProfile.login}@github.com`;

    let user = await prisma.user.findUnique({ where: { email: primaryEmail }, include: { license: true, subscription: true } });

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email: primaryEmail, passwordHash: crypto.randomBytes(16).toString('hex'), isVerified: true },
        });
        await provisionUserDefaultResources(tx, u.id);
        return tx.user.findUnique({ where: { id: u.id }, include: { license: true, subscription: true } });
      }) as any;
    }

    const token = signToken({ id: user!.id, email: user!.email });
    return res.redirect(`${clientUrl}/console?oauth_success=true&token=${token}&email=${user!.email}`);

  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=GitHub OAuth failed`);
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('orbit_session');
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

export default router;
