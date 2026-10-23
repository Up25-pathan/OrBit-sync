import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth';
import { generateLicenseKey, normalizeTier } from '../utils/licenseGenerator';

const router = Router();

// In-memory rate limiter for auth endpoints (keyed by IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }
    entry.count++;
    next();
  };
}
// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 600000).unref();

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:9090',
  'https://orbit-sync.dev',
  'https://www.orbit-sync.dev',
  'https://api.orbit-sync.dev',
  'https://relay.orbit-sync.dev',
  'https://orbit-sync.onrender.com',
  'https://orbitcollab-three.vercel.app',
  'https://orbit-server-xbr5.onrender.com',
].filter((x): x is string => !!x);

const resolveClientUrl = (req: Request): string => {
  const state = req.query.state as string;
  let dynamicUrl = '';
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
      if (parsed.origin && ALLOWED_ORIGINS.some((o) => parsed.origin.startsWith(o))) {
        dynamicUrl = parsed.origin;
      }
    } catch (e) { }
  }
  return dynamicUrl || process.env.CLIENT_URL || 'http://localhost:3000';
};

// Helper to provision permanent single account license and default subscription for new users
async function provisionUserDefaultResources(tx: any, userId: string) {
  // Generate permanent 4x4 block Account License Key (ORBIT-7F9A-B23C-8E1D-4A5B)
  const licenseKey = generateLicenseKey();

  await tx.license.create({
    data: {
      userId,
      licenseKey,
      maxDevices: 3,
    },
  });

  // Create default free subscription active for 1 year
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await tx.subscription.create({
    data: {
      userId,
      planTier: 'free',
      status: 'active',
      expiresAt,
    },
  });
}

import { sendVerificationEmail, sendTwoFactorOtpEmail, sendForgotPasswordOtpEmail, sendEnterpriseOtpEmail } from '../utils/mailer';

// ----------------------------------------------------
// SECTION A: EMAIL & PASSWORD REGISTRATION WITH OTP
// ----------------------------------------------------

// POST /api/auth/signup
router.post('/signup', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanPass.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Handle existing registered users
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      }

      // If user exists but is not verified, refresh verification code and resend
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          verificationCode: code,
          verificationExpires: expiresAt,
          passwordHash: hashPassword(cleanPass),
          displayName: displayName ? displayName.trim() : existingUser.displayName,
        },
      });

      sendVerificationEmail(cleanEmail, code).catch((err) => {
        console.error('[Background Resend Dispatch Error]:', err);
      });

      return res.status(200).json({
        status: 'PENDING_VERIFICATION',
        email: cleanEmail,
        message: 'Account pending verification. A new 6-digit code has been sent to your email.',
      });
    }

    // Generate cryptographic 6-digit code (100000 - 999999)
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    // Create unverified user
    await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash: hashPassword(cleanPass),
        displayName: displayName ? displayName.trim() : cleanEmail.split('@')[0],
        isVerified: false,
        verificationCode: code,
        verificationExpires: expiresAt,
      },
    });

    // Dispatch Verification Code via Resend
    sendVerificationEmail(cleanEmail, code).catch((err) => {
      console.error('[Background Resend Dispatch Error]:', err);
    });

    return res.status(200).json({
      status: 'PENDING_VERIFICATION',
      email: cleanEmail,
      message: 'Account created. Please verify your email address using the 6-digit code sent to your inbox.',
    });

  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to process registration.' });
  }
});

// POST /api/auth/resend-code
router.post('/resend-code', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationExpires: expiresAt,
      },
    });

    // Dispatch via Resend (use 2FA template if user is verified with 2FA, else signup template)
    if (user.isVerified && user.twoFactorEnabled) {
      sendTwoFactorOtpEmail(cleanEmail, code).catch((err) => {
        console.error('[Background Resend 2FA Dispatch Error]:', err);
      });
    } else {
      sendVerificationEmail(cleanEmail, code).catch((err) => {
        console.error('[Background Resend Dispatch Error]:', err);
      });
    }

    return res.status(200).json({
      status: 'CODE_RESENT',
      email: cleanEmail,
      message: 'A fresh 6-digit verification code has been dispatched to your email.',
    });
  } catch (error: any) {
    console.error('Resend code error:', error);
    return res.status(500).json({ error: 'Failed to resend verification code.' });
  }
});

// POST /api/auth/verify-code
router.post('/verify-code', rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        license: true,
        subscription: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Verification profile not found.' });
    }

    // Check code validity
    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email.' });
    }

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please click "Resend Code".' });
    }

    // CASE 1: 2FA Login Verification (User is already verified)
    if (user.isVerified) {
      if (!user.twoFactorEnabled) {
        return res.status(400).json({ error: 'This account is already verified. Please sign in.' });
      }

      // Clear 2FA OTP code
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: null,
          verificationExpires: null,
        },
      });

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
          displayName: user.displayName || user.email.split('@')[0],
          avatarUrl: user.avatarUrl || null,
          role: user.role,
          licenseKey: user.license?.licenseKey || '',
          planTier: normalizeTier(user.subscription?.planTier || 'free'),
        },
        token,
      });
    }

    // CASE 2: Initial Registration Handshake
    const result = await prisma.$transaction(async (tx: any) => {
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
        displayName: result.user.displayName || result.user.email.split('@')[0],
        avatarUrl: result.user.avatarUrl || null,
        role: result.user.role,
        licenseKey: result.license?.licenseKey || '',
        planTier: normalizeTier(result.subscription?.planTier || 'free'),
      },
      token,
    });

  } catch (error: any) {
    console.error('Verification verify code error:', error);
    return res.status(500).json({ error: 'Internal server error verifying profile.' });
  }
});

// POST /api/auth/login
router.post('/login', rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
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

    // Block unverified logins and dispatch a fresh code
    if (!user.isVerified) {
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: code,
          verificationExpires: expiresAt,
        },
      });

      // Dispatch email via Resend
      sendVerificationEmail(user.email, code).catch((err) => {
        console.error('[Background Resend Dispatch Error during Login]:', err);
      });

      return res.status(403).json({
        error: 'Email verification is pending. A fresh verification code has been dispatched.',
        status: 'PENDING_VERIFICATION',
        email: user.email,
      });
    }

    // Handle Two-Factor Authentication (2FA) Challenge
    if (user.twoFactorEnabled) {
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: code,
          verificationExpires: expiresAt,
        },
      });

      sendTwoFactorOtpEmail(user.email, code).catch((err) => {
        console.error('[Background 2FA Dispatch Error during Login]:', err);
      });

      return res.status(200).json({
        status: 'REQUIRES_2FA',
        email: user.email,
        message: 'Two-Factor Authentication is active. A 6-digit login security code has been sent to your email.',
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
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        licenseKey: user.license?.licenseKey || '',
        planTier: normalizeTier(user.subscription?.planTier || 'free'),
      },
      token,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// ----------------------------------------------------
// SECTION F: FORGOT & RESET PASSWORD VIA OTP
// ----------------------------------------------------

// POST /api/auth/forgot-password/request-otp
router.post('/forgot-password/request-otp', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationExpires: expiresAt,
      },
    });

    sendForgotPasswordOtpEmail(cleanEmail, code).catch((err) => {
      console.error('[Background Forgot Password Dispatch Error]:', err);
    });

    return res.status(200).json({
      status: 'CODE_SENT',
      email: cleanEmail,
      message: 'A 6-digit password reset code has been dispatched to your email.',
    });
  } catch (error: any) {
    console.error('Forgot password request OTP error:', error);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// POST /api/auth/forgot-password/reset
router.post('/forgot-password/reset', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();
    const cleanNewPass = String(newPassword).trim();

    if (cleanNewPass.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email.' });
    }

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    const newPasswordHash = hashPassword(cleanNewPass);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        verificationCode: null,
        verificationExpires: null,
      },
    });

    return res.status(200).json({
      status: 'PASSWORD_RESET_SUCCESS',
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('Password reset confirmation error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});



// ----------------------------------------------------
// SECTION B: GOOGLE & GITHUB OAUTH 2.0 REDIRECTS
// ----------------------------------------------------

// Sets JWT as httpOnly cookie and redirects without exposing token in URL
function redirectWithSession(res: Response, clientUrl: string, token: string, email: string, role: string) {
  const redirectUrl = new URL(`${clientUrl}/console`);
  redirectUrl.searchParams.set('oauth_success', 'true');
  redirectUrl.searchParams.set('email', email);
  redirectUrl.searchParams.set('role', role);
  redirectUrl.searchParams.set('token', token);
  res.cookie('orbit_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return res.redirect(redirectUrl.toString());
}

// GET /api/auth/google
router.get('/google', (req: Request, res: Response) => {
  const origin = req.query.origin as string || '';
  const state = origin ? Buffer.from(JSON.stringify({ origin })).toString('base64') : '';

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
    if (process.env.NODE_ENV === 'production') {
      const clientUrl = resolveClientUrl(req);
      return res.redirect(`${clientUrl}/login?error=Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.`);
    }
    console.log('[Google OAuth Sandbox] No credentials found. Redirecting to sandbox callback...');
    return res.redirect(`/api/auth/google/callback?state=${encodeURIComponent(state)}`);
  }
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent('profile email')}&state=${encodeURIComponent(state)}`;
  return res.redirect(url);
});

// GET /api/auth/github
router.get('/github', (req: Request, res: Response) => {
  const origin = req.query.origin as string || '';
  const state = origin ? Buffer.from(JSON.stringify({ origin })).toString('base64') : '';

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_REDIRECT_URI) {
    if (process.env.NODE_ENV === 'production') {
      const clientUrl = resolveClientUrl(req);
      return res.redirect(`${clientUrl}/login?error=GitHub OAuth is not configured on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.`);
    }
    console.log('[GitHub OAuth Sandbox] No credentials found. Redirecting to local sandbox callback...');
    return res.redirect(`/api/auth/github/callback?state=${encodeURIComponent(state)}`);
  }
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent('user:email')}&state=${encodeURIComponent(state)}`;
  return res.redirect(url);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const clientUrl = resolveClientUrl(req);
  try {
    const code = req.query.code as string;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !code) {
      console.warn('[Google OAuth] Missing client credentials or authorization code.');
      return res.redirect(`${clientUrl}/login?error=Google authentication configuration missing.`);
    }

    // Real Google OAuth - Fetch google tokens
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

    if (!tokens.access_token) {
      console.error('[Google OAuth Error] Token exchange failed:', tokens);
      return res.redirect(`${clientUrl}/login?error=Google authentication token exchange failed.`);
    }

    // Fetch user details from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileRes.json()) as any;
    const email = profile.email;

    if (!email) {
      return res.redirect(`${clientUrl}/login?error=Could not retrieve email from Google profile.`);
    }

    let user = await prisma.user.findUnique({ where: { email }, include: { license: true, subscription: true } });

    if (!user) {
      user = await prisma.$transaction(async (tx: any) => {
        const u = await tx.user.create({
          data: {
            email,
            displayName: profile.name || email.split('@')[0],
            avatarUrl: profile.picture || null,
            passwordHash: crypto.randomBytes(16).toString('hex'),
            isVerified: true
          },
        });
        await provisionUserDefaultResources(tx, u.id);
        return tx.user.findUnique({ where: { id: u.id }, include: { license: true, subscription: true } });
      }) as any;
    }

    const token = signToken({ id: user!.id, email: user!.email });
    return redirectWithSession(res, clientUrl, token, user!.email, user!.role);

  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    return res.redirect(`${clientUrl}/login?error=Google OAuth failed`);
  }
});

// GET /api/auth/github/callback
router.get('/github/callback', async (req: Request, res: Response) => {
  const clientUrl = resolveClientUrl(req);
  try {
    const code = req.query.code as string;

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET || !code) {
      console.warn('[GitHub OAuth] Missing client credentials or authorization code.');
      return res.redirect(`${clientUrl}/login?error=GitHub authentication configuration missing.`);
    }

    // Real GitHub OAuth - Fetch GitHub access token
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

    if (!tokens.access_token) {
      console.error('[GitHub OAuth Error] Token exchange failed:', tokens);
      return res.redirect(`${clientUrl}/login?error=GitHub token exchange failed.`);
    }

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'User-Agent': 'OrBit-Sync-App',
      },
    });
    const userProfile = (await userRes.json()) as any;

    // Fetch user email
    let primaryEmail = userProfile.email;
    try {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'OrBit-Sync-App',
        },
      });
      const emails = (await emailsRes.json()) as any;
      if (Array.isArray(emails)) {
        primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email || primaryEmail;
      }
    } catch (e) { }

    if (!primaryEmail) {
      primaryEmail = userProfile.login ? `${userProfile.login}@github.com` : `user_${Date.now()}@github.com`;
    }

    let user = await prisma.user.findUnique({ where: { email: primaryEmail }, include: { license: true, subscription: true } });

    if (!user) {
      user = await prisma.$transaction(async (tx: any) => {
        const u = await tx.user.create({
          data: {
            email: primaryEmail,
            displayName: userProfile.name || userProfile.login || primaryEmail.split('@')[0],
            avatarUrl: userProfile.avatar_url || null,
            passwordHash: crypto.randomBytes(16).toString('hex'),
            isVerified: true
          },
        });
        await provisionUserDefaultResources(tx, u.id);
        return tx.user.findUnique({ where: { id: u.id }, include: { license: true, subscription: true } });
      }) as any;
    }

    const token = signToken({ id: user!.id, email: user!.email });
    return redirectWithSession(res, clientUrl, token, user!.email, user!.role);

  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    return res.redirect(`${clientUrl}/login?error=GitHub OAuth failed`);
  }
});

// GET /api/auth/me or GET /api/v1/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc: any, c: string) => {
        const parts = c.trim().split('=');
        if (parts[0]) acc[parts[0]] = parts.slice(1).join('=');
        return acc;
      }, {});
      token = cookies['orbit_session'] || '';
    }

    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided.' });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        license: true,
        subscription: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        licenseKey: user.license?.licenseKey || '',
        planTier: normalizeTier(user.subscription?.planTier || 'free'),
      },
    });
  } catch (error: any) {
    return res.status(401).json({ error: 'Unauthorized profile access.' });
  }
});

// -------------------------------------------------------------
// SECTION G: ENTERPRISE ORGANIZATION REGISTRATION & SMART LOGIN
// -------------------------------------------------------------

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com',
  'zoho.com', 'yandex.com', 'mail.com', 'gmx.com', 'fastmail.com'
]);

function extractDomain(email: string): string {
  const parts = email.trim().toLowerCase().split('@');
  return parts.length > 1 ? parts[1] : '';
}

// POST /api/auth/enterprise/check-domain
router.post('/enterprise/check-domain', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const domain = extractDomain(email);
    if (CONSUMER_EMAIL_DOMAINS.has(domain)) {
      return res.status(400).json({
        validCorporate: false,
        domain,
        error: 'Personal email providers (@gmail, @yahoo, etc.) cannot be used for Organization onboarding. Please use your corporate work email.',
      });
    }

    // Check if an enterprise application or organization exists with this domain
    const existing = await (prisma as any).enterpriseApplication.findFirst({
      where: {
        OR: [
          { companyDomain: domain },
          { workEmail: { endsWith: `@${domain}` } },
        ],
      },
    });

    return res.status(200).json({
      validCorporate: true,
      domain,
      exists: !!existing,
      companyName: existing ? existing.companyName : null,
      status: existing ? existing.status : null,
      authPreference: existing ? existing.authPreference : 'otp',
    });
  } catch (err: any) {
    console.error('Check domain error:', err);
    return res.status(500).json({ error: 'Failed to verify organization domain.' });
  }
});

// POST /api/auth/enterprise/send-signup-otp
router.post('/enterprise/send-signup-otp', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { companyName, workEmail, adminName } = req.body;

    if (!workEmail || !workEmail.includes('@')) {
      return res.status(400).json({ error: 'Corporate work email is required.' });
    }

    const cleanEmail = workEmail.trim().toLowerCase();
    const domain = extractDomain(cleanEmail);

    if (CONSUMER_EMAIL_DOMAINS.has(domain)) {
      return res.status(400).json({
        error: 'Personal email providers (@gmail, @yahoo, etc.) are strictly prohibited. Please provide your corporate email domain.',
      });
    }

    // Check if this enterprise application was already approved
    const existingApp = await (prisma as any).enterpriseApplication.findUnique({
      where: { workEmail: cleanEmail },
    });

    if (existingApp && existingApp.status === 'APPROVED') {
      return res.status(409).json({
        error: 'An active approved Organization already exists for this work email. Please sign in instead.',
        status: existingApp.status,
      });
    }

    // Generate 6-digit OTP code
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          verificationCode: code,
          verificationExpires: expiresAt,
          displayName: adminName ? adminName.trim() : existingUser.displayName,
          role: 'USER', // Strictly USER, never ADMIN
        },
      });
    } else {
      // Store pending verification user with isVerified: false, role: 'USER'
      // No license is generated before verification or approval!
      await prisma.user.create({
        data: {
          email: cleanEmail,
          displayName: adminName ? adminName.trim() : cleanEmail.split('@')[0],
          passwordHash: hashPassword(crypto.randomBytes(32).toString('hex')),
          isVerified: false,
          role: 'USER', // Strictly USER, never ADMIN
          verificationCode: code,
          verificationExpires: expiresAt,
        },
      });
    }

    // Send Enterprise OTP Email
    sendEnterpriseOtpEmail(cleanEmail, code, (companyName || 'Your Organization').trim(), false).catch((err) => {
      console.error('[Enterprise OTP Mailer Error]:', err);
    });

    return res.status(200).json({
      success: true,
      status: 'OTP_SENT',
      email: cleanEmail,
      message: 'A 6-digit verification code has been dispatched to your corporate work email.',
    });
  } catch (err: any) {
    console.error('Enterprise send-signup-otp error:', err);
    return res.status(500).json({ error: 'Failed to dispatch enterprise verification code.' });
  }
});

// POST /api/auth/enterprise/verify-signup-otp
router.post('/enterprise/verify-signup-otp', rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    const {
      code,
      workEmail,
      companyName,
      companyDomain,
      teamScale,
      industry,
      deploymentModel,
      adminName,
      adminRole,
      password,
      country,
      authPreference,
      useCaseDetails,
    } = req.body;

    if (!workEmail || !code) {
      return res.status(400).json({ error: 'Work email and 6-digit verification code are required.' });
    }

    const cleanEmail = workEmail.trim().toLowerCase();
    const cleanCode = String(code).trim();
    const domain = (companyDomain || extractDomain(cleanEmail)).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { license: true, subscription: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Registration session not found. Please restart sign-up.' });
    }

    // Validate OTP Code
    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email.' });
    }

    // Validate Expiration
    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Update User: isVerified = true, strictly role = 'USER', save password if provided
    const userUpdateData: any = {
      isVerified: true,
      role: 'USER', // Enterprise users are strictly USER, never platform ADMIN
      displayName: adminName ? adminName.trim() : user.displayName,
      verificationCode: null,
      verificationExpires: null,
    };
    if (password && String(password).trim().length >= 6) {
      userUpdateData.passwordHash = hashPassword(String(password).trim());
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: userUpdateData,
    });

    // DO NOT GENERATE A PREMATURE LICENSE KEY!
    // Enterprise licenses are only generated and activated upon OrBit administrator security approval!

    // Provision Enterprise Subscription with status 'pending_approval'
    let userSub = user.subscription;
    if (!userSub) {
      userSub = await prisma.subscription.create({
        data: {
          userId: updatedUser.id,
          planTier: 'enterprise',
          status: 'pending_approval',
          amountPaid: 0,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Create or update Enterprise Application with status 'PENDING_APPROVAL'
    let application = await (prisma as any).enterpriseApplication.findUnique({
      where: { workEmail: cleanEmail },
    });

    if (!application) {
      application = await (prisma as any).enterpriseApplication.create({
        data: {
          companyName: (companyName || 'Organization').trim(),
          workEmail: cleanEmail,
          companyDomain: domain,
          teamScale: teamScale || '26-100',
          industry: industry || 'Software/SaaS',
          deploymentModel: deploymentModel || 'hybrid',
          adminName: (adminName || cleanEmail.split('@')[0]).trim(),
          adminRole: adminRole || 'Engineering Lead',
          authPreference: authPreference || 'otp',
          country: country || 'United States',
          useCaseDetails: useCaseDetails || '',
          status: 'PENDING_APPROVAL',
          adminUserId: updatedUser.id,
        },
      });
    } else {
      application = await (prisma as any).enterpriseApplication.update({
        where: { id: application.id },
        data: {
          adminUserId: updatedUser.id,
          companyName: companyName ? companyName.trim() : application.companyName,
          companyDomain: domain,
          teamScale: teamScale || application.teamScale,
          industry: industry || application.industry,
          deploymentModel: deploymentModel || application.deploymentModel,
          adminName: adminName ? adminName.trim() : application.adminName,
          adminRole: adminRole || application.adminRole,
          country: country || application.country,
          authPreference: authPreference || application.authPreference,
          status: 'PENDING_APPROVAL',
        },
      });
    }

    // Issue Session Token & Set Cookie
    const token = signToken({ id: updatedUser.id, email: updatedUser.email });
    res.cookie('orbit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      status: 'PENDING_APPROVAL',
      message: 'Corporate email verified. Organization application submitted for administrative review.',
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: 'USER', // Strictly USER
        planTier: 'enterprise',
        licenseKey: '', // No premature license key
      },
      application: {
        id: application.id,
        companyName: application.companyName,
        companyDomain: application.companyDomain,
        workEmail: application.workEmail,
        teamScale: application.teamScale,
        status: application.status,
      },
    });
  } catch (err: any) {
    console.error('Enterprise verify-signup-otp error:', err);
    return res.status(500).json({ error: 'Failed to verify code and submit application.' });
  }
});

// POST /api/auth/enterprise/send-login-otp
router.post('/enterprise/send-login-otp', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { workEmail } = req.body;

    if (!workEmail || !workEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid corporate work email is required.' });
    }

    const cleanEmail = workEmail.trim().toLowerCase();
    const domain = extractDomain(cleanEmail);

    if (CONSUMER_EMAIL_DOMAINS.has(domain)) {
      return res.status(400).json({
        error: 'Personal email providers (@gmail, @yahoo, etc.) cannot be used for Organization login.',
      });
    }

    // Look for matching user and/or enterprise application
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    const app = await (prisma as any).enterpriseApplication.findFirst({
      where: {
        OR: [
          { workEmail: cleanEmail },
          ...(user ? [{ adminUserId: user.id }] : []),
        ],
      },
    });

    if (!user && !app) {
      return res.status(404).json({
        error: 'No Enterprise organization found associated with this work email. Please register your organization first.',
      });
    }

    // Generate 6-digit OTP code
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let targetUserId = user ? user.id : null;
    if (!user) {
      // If user doesn't exist yet but application does, create the user with role 'USER'
      const newUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          displayName: app?.adminName || cleanEmail.split('@')[0],
          passwordHash: hashPassword(crypto.randomBytes(32).toString('hex')),
          isVerified: false,
          role: 'USER', // Strictly USER, never ADMIN
          verificationCode: code,
          verificationExpires: expiresAt,
        },
      });
      targetUserId = newUser.id;
      if (app && !app.adminUserId) {
        await (prisma as any).enterpriseApplication.update({
          where: { id: app.id },
          data: { adminUserId: newUser.id },
        });
      }
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: code,
          verificationExpires: expiresAt,
          role: 'USER', // Ensure strictly USER
        },
      });
    }

    // Send Enterprise Login OTP Email
    const companyName = app?.companyName || 'Your Organization';
    sendEnterpriseOtpEmail(cleanEmail, code, companyName, true).catch((err) => {
      console.error('[Enterprise Login Mailer Error]:', err);
    });

    return res.status(200).json({
      success: true,
      status: 'LOGIN_OTP_SENT',
      email: cleanEmail,
      companyName,
      message: `A 6-digit sign-in code has been dispatched to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Enterprise send-login-otp error:', err);
    return res.status(500).json({ error: 'Failed to send enterprise login code.' });
  }
});

// POST /api/auth/enterprise/verify-login-otp
router.post('/enterprise/verify-login-otp', rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    const { workEmail, code } = req.body;

    if (!workEmail || !code) {
      return res.status(400).json({ error: 'Work email and 6-digit login code are required.' });
    }

    const cleanEmail = workEmail.trim().toLowerCase();
    const cleanCode = String(code).trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        license: true,
        subscription: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Enterprise user account not found.' });
    }

    // Validate code
    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Invalid login code. Please check your email.' });
    }

    // Validate expiration
    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Login code has expired. Please request a new one.' });
    }

    // Clear OTP code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        role: 'USER', // Strictly USER, never ADMIN
        verificationCode: null,
        verificationExpires: null,
      },
    });

    // Lookup enterprise application
    const app = await (prisma as any).enterpriseApplication.findFirst({
      where: {
        OR: [
          { workEmail: cleanEmail },
          { adminUserId: user.id },
        ],
      },
    });

    // Do NOT generate a license if pending approval!
    const isPending = app && app.status === 'PENDING_APPROVAL';
    let licenseKey = user.license?.licenseKey || '';
    if (!licenseKey && !isPending && app?.status === 'APPROVED') {
      const newKey = generateLicenseKey('enterprise');
      const newLic = await prisma.license.create({
        data: {
          userId: user.id,
          licenseKey: newKey,
          maxDevices: 100,
        },
      });
      licenseKey = newLic.licenseKey;
    }

    // Sign session token
    const token = signToken({ id: user.id, email: user.email });
    res.cookie('orbit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Enterprise sign-in authorized.',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || null,
        role: 'USER', // Strictly USER, never ADMIN
        planTier: normalizeTier(user.subscription?.planTier || 'enterprise'),
        licenseKey: isPending ? '' : licenseKey,
      },
      enterpriseApplication: app ? {
        id: app.id,
        companyName: app.companyName,
        companyDomain: app.companyDomain,
        status: app.status,
      } : null,
    });
  } catch (err: any) {
    console.error('Enterprise verify-login-otp error:', err);
    return res.status(500).json({ error: 'Failed to verify login code.' });
  }
});

// POST /api/auth/enterprise/register (Enforces OTP Verification)
router.post('/enterprise/register', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      workEmail,
      companyDomain,
      teamScale,
      industry,
      deploymentModel,
      adminName,
      adminRole,
      password,
      authPreference,
      country,
      useCaseDetails,
      code, // OTP verification code
    } = req.body;

    if (!companyName || !workEmail || !adminName) {
      return res.status(400).json({ error: 'Company Name, Work Email, and Primary Admin Name are required.' });
    }

    const cleanEmail = workEmail.trim().toLowerCase();
    const domain = (companyDomain || extractDomain(cleanEmail)).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    if (CONSUMER_EMAIL_DOMAINS.has(domain)) {
      return res.status(400).json({
        error: 'Personal email providers (@gmail, @yahoo, etc.) are strictly prohibited for Organization verification. Please submit your official corporate email.',
      });
    }

    // Check if an approved organization already exists
    const existingApp = await (prisma as any).enterpriseApplication.findUnique({
      where: { workEmail: cleanEmail },
    });

    if (existingApp && existingApp.status === 'APPROVED') {
      return res.status(409).json({
        error: 'An active approved Organization already exists for this work email. Please sign in instead.',
        status: existingApp.status,
      });
    }

    // REQUIRE OTP CODE: If no code is passed, send OTP to the corporate work email!
    if (!code) {
      const generatedOtp = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            verificationCode: generatedOtp,
            verificationExpires: expiresAt,
            role: 'USER',
          },
        });
      } else {
        await prisma.user.create({
          data: {
            email: cleanEmail,
            displayName: adminName.trim(),
            passwordHash: password ? hashPassword(String(password).trim()) : hashPassword(crypto.randomBytes(32).toString('hex')),
            isVerified: false,
            role: 'USER', // Strictly USER, never ADMIN
            verificationCode: generatedOtp,
            verificationExpires: expiresAt,
          },
        });
      }

      sendEnterpriseOtpEmail(cleanEmail, generatedOtp, companyName.trim(), false).catch((err) => {
        console.error('[Enterprise OTP Mailer Error]:', err);
      });

      return res.status(200).json({
        success: true,
        status: 'OTP_REQUIRED',
        email: cleanEmail,
        message: 'A 6-digit corporate verification code has been dispatched to your email.',
      });
    }

    // Verify OTP code
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ error: 'Registration session not found. Please request a new verification code.' });
    }

    if (!user.verificationCode || user.verificationCode !== String(code).trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your email.' });
    }

    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Activate User with role 'USER'
    const passwordHash = password ? hashPassword(String(password).trim()) : user.passwordHash;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        role: 'USER', // Strictly USER
        passwordHash,
        displayName: adminName.trim(),
        verificationCode: null,
        verificationExpires: null,
      },
    });

    // Create Subscription with status 'pending_approval' (NO license key created!)
    await prisma.subscription.upsert({
      where: { userId: updatedUser.id },
      update: {
        planTier: 'enterprise',
        status: 'pending_approval',
      },
      create: {
        userId: updatedUser.id,
        planTier: 'enterprise',
        status: 'pending_approval',
        amountPaid: 0,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Create or update Enterprise Application
    let application = await (prisma as any).enterpriseApplication.findUnique({
      where: { workEmail: cleanEmail },
    });

    if (!application) {
      application = await (prisma as any).enterpriseApplication.create({
        data: {
          companyName: companyName.trim(),
          workEmail: cleanEmail,
          companyDomain: domain,
          teamScale: teamScale || '26-100',
          industry: industry || 'Software/SaaS',
          deploymentModel: deploymentModel || 'hybrid',
          adminName: adminName.trim(),
          adminRole: adminRole || 'Engineering Lead',
          authPreference: authPreference || 'otp',
          country: country || 'United States',
          useCaseDetails: useCaseDetails || '',
          status: 'PENDING_APPROVAL',
          adminUserId: updatedUser.id,
        },
      });
    } else {
      application = await (prisma as any).enterpriseApplication.update({
        where: { id: application.id },
        data: {
          adminUserId: updatedUser.id,
          companyName: companyName.trim(),
          companyDomain: domain,
          teamScale: teamScale || application.teamScale,
          industry: industry || application.industry,
          deploymentModel: deploymentModel || application.deploymentModel,
          adminName: adminName.trim(),
          adminRole: adminRole || application.adminRole,
          country: country || application.country,
          authPreference: authPreference || application.authPreference,
          status: 'PENDING_APPROVAL',
        },
      });
    }

    const token = signToken({ id: updatedUser.id, email: cleanEmail });
    res.cookie('orbit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      status: 'PENDING_APPROVAL',
      message: 'Organization verified and application submitted for administrator review.',
      application: {
        id: application.id,
        companyName: application.companyName,
        companyDomain: application.companyDomain,
        workEmail: application.workEmail,
        teamScale: application.teamScale,
        status: application.status,
      },
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: 'USER',
        planTier: 'enterprise',
        licenseKey: '',
      },
      token,
    });
  } catch (err: any) {
    console.error('Enterprise registration error:', err);
    return res.status(500).json({ error: 'Failed to complete Organization registration. Please try again.' });
  }
});


// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('orbit_session');
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

export default router;
