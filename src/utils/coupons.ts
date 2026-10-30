import crypto from 'crypto';
import { prisma } from '../db';

export const EARLY_BIRD_PERCENT = 50;
export const EARLY_BIRD_VALID_DAYS = 90;

export function normalizeCouponCode(code: string): string {
  return (code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function randomBlock(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function createWaitlistCoupon(): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EARLY_BIRD_VALID_DAYS);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `ORBIT-EARLY-${randomBlock(6)}`;
    try {
      await prisma.coupon.create({
        data: {
          code,
          kind: 'percent',
          value: EARLY_BIRD_PERCENT,
          active: true,
          waitlistOnly: true,
          maxRedemptions: 1,
          expiresAt,
        },
      });
      return { code, expiresAt };
    } catch (err: any) {
      if (err?.code !== 'P2002') {
        throw err;
      }
    }
  }

  throw new Error('Unable to allocate a unique early-bird coupon code.');
}

export interface CouponValidation {
  valid: boolean;
  code?: string;
  discountPercent?: number;
  expiresAt?: Date | null;
  reason?: string;
}

export async function validateCoupon(code: string, userId?: string): Promise<CouponValidation> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    return { valid: false, reason: 'Enter a coupon code.' };
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.active) {
    return { valid: false, reason: 'This coupon code is not valid.' };
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'This coupon has expired.' };
  }

  if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) {
    return { valid: false, reason: 'This coupon has already been redeemed.' };
  }

  if (coupon.kind !== 'percent') {
    return { valid: false, reason: 'Unsupported coupon type.' };
  }

  if (coupon.waitlistOnly) {
    const signup = await prisma.waitlistSignup.findFirst({
      where: { discountCode: normalized, status: 'CONFIRMED' },
      select: { email: true },
    });
    if (!signup) {
      return { valid: false, reason: 'This coupon is reserved for confirmed early-access members.' };
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user || user.email.toLowerCase() !== signup.email.toLowerCase()) {
        return {
          valid: false,
          reason: 'This coupon is reserved for the email that confirmed the early-access signup.',
        };
      }
    }
  }

  if (userId) {
    const redemption = await prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
      select: { id: true },
    });
    if (redemption) {
      return { valid: false, reason: 'You have already used this coupon.' };
    }
  }

  return {
    valid: true,
    code: coupon.code,
    discountPercent: coupon.value,
    expiresAt: coupon.expiresAt,
  };
}

export async function redeemCoupon(code: string, userId: string, planTier?: string): Promise<boolean> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return false;

  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return false;

  try {
    await prisma.$transaction([
      prisma.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          planTier: planTier || null,
        },
      }),
      prisma.coupon.update({
        where: { id: coupon.id },
        data: { redemptions: { increment: 1 } },
      }),
    ]);
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return false;
    }
    console.error('[Coupon] Redemption failed:', err);
    return false;
  }
}
