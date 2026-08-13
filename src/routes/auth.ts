import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dns from 'dns';
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
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
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
  'https://orbit-sync.onrender.com',
  'https://orbitcollab-three.vercel.app',
  'https://orbit-server-kae6.onrender.com',
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
    } catch (e) {}
  }
  return dynamicUrl || process.env.CLIENT_URL || 'http://localhost:3000';
};

// Nodemailer SMTP setup
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';

// Custom DNS lookup forcing IPv4 resolution for Nodemailer sockets
const customLookup = (hostname: string, options: any, callback: any) => {
  return dns.lookup(hostname, { ...options, family: 4 }, callback);
};

const transporter = smtpHost && smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      },
      lookup: customLookup
    } as any)
  : null;

// Helper to provision default license and subscription for new users
async function provisionUserDefaultResources(tx: any, userId: string) {
  // Generate formatted default Free Tier license key (ORBIT-FREE-XXXXXX-TIMESTAMP-SIG)
  const licenseKey = generateLicenseKey('free');

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
      planTier: 'free',
      status: 'active',
      expiresAt,
    },
  });
}

// Background Email Helper Definition
const sendVerificationEmail = async (targetEmail: string, verificationCode: string) => {
  const brevoKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'security@orbit.dev';

  const subject = 'OrBit Portal - Verify Your Email';
  const htmlContent = `
    <div style="background:#0c0a0a; color:#fff; padding:30px; font-family:sans-serif; border:1px solid #ff003c; border-radius:8px; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#ff003c; text-align: center; font-family: monospace;">Email Verification</h2>
      <p>Welcome to OrBit Platform. Use the code below to complete your developer registration:</p>
      <div style="font-size:36px; font-weight:bold; letter-spacing:6px; padding:15px; background:#181414; border-radius:6px; text-align:center; color:#ff003c; margin:25px 0; border: 1px solid rgba(255, 0, 60, 0.2);">${verificationCode}</div>
      <p style="color:#808085; font-size:12px; text-align: center;">This verification code is valid for 15 minutes.</p>
    </div>
  `;

  if (brevoKey) {
    try {
      console.log(`[Brevo Mailer] Dispatching verification email via HTTPS REST API to ${targetEmail}...`);
      const apiRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: "OrBit Security",
            email: senderEmail
          },
          to: [
            {
              email: targetEmail
            }
          ],
          subject: subject,
          htmlContent: htmlContent
        })
      });

      const resData = await apiRes.json();
      if (apiRes.ok) {
        console.log(`[Brevo Mailer] Verification email successfully sent to ${targetEmail}`);
      } else {
        console.error('[Brevo Mailer Error] API returned error response:', resData);
      }
    } catch (err) {
      console.error('[Brevo Mailer Error] REST API connection failed:', err);
    }
  } else if (transporter) {
    try {
      console.log(`[SMTP Mailer] Dispatching verification email to ${targetEmail}...`);
      await transporter.sendMail({
        from: `"OrBit Security" <${senderEmail}>`,
        to: targetEmail,
        subject: subject,
        text: `Your email verification code is: ${verificationCode}. It expires in 15 minutes.`,
        html: htmlContent,
      });
      console.log(`[SMTP Mailer] Verification email successfully sent to ${targetEmail}`);
    } catch (err) {
      console.error('[SMTP Mailer Error] Failed to send SMTP email:', err);
      console.log(`=========================================`);
      console.log(`[SMTP Fallback Logs] EMAIL VERIFICATION CODE (SMTP Failed)`);
      console.log(`Recipient: ${targetEmail}`);
      console.log(`Verification Code: ${verificationCode}`);
      console.log(`=========================================`);
    }
  } else {
    console.log(`=========================================`);
    console.log(`[SMTP Sandbox] EMAIL VERIFICATION CODE`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Verification Code: ${verificationCode}`);
    console.log(`=========================================`);
  }
};

// ----------------------------------------------------
// SECTION A: EMAIL & PASSWORD REGISTRATION WITH CODES
// ----------------------------------------------------

// POST /api/auth/signup
router.post('/signup', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

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
        displayName: displayName || email.split('@')[0],
        passwordHash,
        isVerified: false,
        verificationCode: code,
        verificationExpires: expiresAt,
      },
    });

    // Dispatch email in the background without awaiting it to keep responses instant (prevents frontend freeze)
    sendVerificationEmail(email, code).catch((err) => {
      console.error('[Background Email Dispatch Error]:', err);
    });

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
router.post('/verify-code', rateLimit(10, 60000), async (req: Request, res: Response) => {
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
        displayName: result.user.displayName || result.user.email.split('@')[0],
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
      // Generate a new verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: code,
          verificationExpires: expiresAt,
        },
      });

      // Dispatch email in the background
      sendVerificationEmail(user.email, code).catch((err) => {
        console.error('[Background Email Dispatch Error during Login]:', err);
      });

      return res.status(403).json({
        error: 'Email verification is pending. A new code has been sent.',
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
        displayName: user.displayName || user.email.split('@')[0],
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
// SECTION B: GOOGLE & GITHUB OAUTH 2.0 REDIRECTS
// ----------------------------------------------------

// Sets JWT as httpOnly cookie and redirects without exposing token in URL
function redirectWithSession(res: Response, clientUrl: string, token: string, email: string, role: string) {
  const redirectUrl = new URL(`${clientUrl}/console`);
  redirectUrl.searchParams.set('oauth_success', 'true');
  redirectUrl.searchParams.set('email', email);
  redirectUrl.searchParams.set('role', role);
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
    console.log('[GitHub OAuth Sandbox] No credentials found. Redirecting to sandbox callback...');
    return res.redirect(`/api/auth/github/callback?state=${encodeURIComponent(state)}`);
  }
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent('user:email')}&state=${encodeURIComponent(state)}`;
  return res.redirect(url);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clientUrl = resolveClientUrl(req);

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
      return redirectWithSession(res, clientUrl, token, user!.email, user!.role);
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
    return redirectWithSession(res, clientUrl, token, user!.email, user!.role);

  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    const clientUrl = resolveClientUrl(req);
    return res.redirect(`${clientUrl}/login?error=Google OAuth failed`);
  }
});

// GET /api/auth/github/callback
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const clientUrl = resolveClientUrl(req);

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
      return redirectWithSession(res, clientUrl, token, user!.email, user!.role);
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
    return redirectWithSession(res, clientUrl, token, user!.email, user!.role);

  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    const clientUrl = resolveClientUrl(req);
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
      const cookies = req.headers.cookie.split(';').reduce((acc: any, c) => {
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
        role: user.role,
        licenseKey: user.license?.licenseKey || '',
        planTier: normalizeTier(user.subscription?.planTier || 'free'),
      },
    });
  } catch (error: any) {
    return res.status(401).json({ error: 'Unauthorized profile access.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('orbit_session');
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

export default router;
