import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import argon2 from 'argon2';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  console.error('=============================================');
  console.error('  WARNING: JWT_SECRET env var not set!');
  console.error('  Using INSECURE fallback for development only.');
  console.error('=============================================');
}
const JWT_SECRET_FALLBACK = JWT_SECRET || 'dev-only-insecure-fallback-change-me';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tokenVersion?: number;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    return await argon2.verify(stored, password);
  } catch {
    return false;
  }
}

export async function hashOtpCode(code: string): Promise<string> {
  return argon2.hash(code, {
    type: argon2.argon2id,
    memoryCost: 1024,
    timeCost: 2,
    parallelism: 1,
    hashLength: 16,
  });
}

export async function verifyOtpCode(code: string, stored: string): Promise<boolean> {
  try {
    return await argon2.verify(stored, code);
  } catch {
    return false;
  }
}

export function signToken(payload: { id: string; email: string; tokenVersion?: number }): string {
  return jwt.sign(payload, JWT_SECRET_FALLBACK, { expiresIn: '7d' });
}

export function verifyToken(token: string): { id: string; email: string; tokenVersion?: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET_FALLBACK) as { id: string; email: string; tokenVersion?: number };
  } catch (e) {
    return null;
  }
}

export async function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc: any, c) => {
      const parts = c.trim().split('=');
      const name = parts[0];
      const val = parts.slice(1).join('=');
      if (name) acc[name] = val;
      return acc;
    }, {});
    token = cookies['orbit_session'] || '';
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired session token.' });
  }

  // Verify token version matches user's current token version
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { tokenVersion: true },
  });

  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
    return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
  }

  req.user = decoded;
  next();
}
