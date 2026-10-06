import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET;
if (!LICENSE_SECRET) {
  console.error('=============================================');
  console.error('  CRITICAL: LICENSE_SECRET env var not set!');
  console.error('  Set a strong random value in production.');
  console.error('=============================================');
}
const LICENSE_SECRET_FALLBACK = LICENSE_SECRET || 'dev-only-insecure-license-secret';

export type PlanTier = 'free' | 'pro' | 'enterprise';

/**
 * Normalizes tier names (maps legacy terms like 'solo' -> 'free', 'mesh' -> 'pro')
 */
export function normalizeTier(tier: string): PlanTier {
  const t = (tier || '').toLowerCase().trim();
  if (t === 'pro' || t === 'mesh' || t === 'developer') return 'pro';
  if (t === 'enterprise' || t === 'grid') return 'enterprise';
  return 'free';
}

/**
 * Generates a permanent account license key in modern 4x4 block format:
 * Format: ORBIT-XXXX-XXXX-XXXX-XXXX
 * Example: ORBIT-7F9A-B23C-8E1D-4A5B
 *
 * This key is generated once per user account and remains permanent forever.
 * Tier access (Free vs Pro) is dynamically resolved on the server via subscription state.
 */
export function generateLicenseKey(_tierInput?: string): string {
  const b1 = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars
  const b2 = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars
  const b3 = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars

  // Generate 4th block as HMAC checksum of the first three blocks
  const payload = `${b1}-${b2}-${b3}`;
  const b4 = crypto
    .createHmac('sha256', LICENSE_SECRET_FALLBACK)
    .update(payload)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase();

  return `ORBIT-${b1}-${b2}-${b3}-${b4}`;
}

/**
 * Parses and verifies the format and signature of an OrBit license key.
 */
export function parseLicenseKey(key: string): { isValid: boolean; planTier: PlanTier; timestamp?: number } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, planTier: 'free' };
  }

  const cleanKey = key.trim().toUpperCase();
  const parts = cleanKey.split('-');

  // Format: ORBIT-XXXX-XXXX-XXXX-XXXX (5 parts)
  if (parts.length === 5 && parts[0] === 'ORBIT') {
    const b1 = parts[1];
    const b2 = parts[2];
    const b3 = parts[3];
    const b4 = parts[4];

    // Check 4-character blocks
    if (b1.length === 4 && b2.length === 4 && b3.length === 4 && b4.length === 4) {
      const payload = `${b1}-${b2}-${b3}`;
      const expectedSig = crypto
        .createHmac('sha256', LICENSE_SECRET_FALLBACK)
        .update(payload)
        .digest('hex')
        .substring(0, 4)
        .toUpperCase();

      const provBuf = Buffer.from(b4, 'utf-8');
      const expBuf = Buffer.from(expectedSig, 'utf-8');

      let isValid = false;
      if (provBuf.length === expBuf.length) {
        isValid = crypto.timingSafeEqual(provBuf, expBuf);
      }
      return { isValid, planTier: 'free' };
    }

    // Legacy format support: ORBIT-PRO-9F8A2B-1775865600-A3F9B2
    const tierStr = parts[1].toLowerCase();
    return { isValid: true, planTier: normalizeTier(tierStr) };
  }

  // Fallback for legacy keys (e.g. orbit_dev_pk_...)
  if (cleanKey.startsWith('ORBIT_') || cleanKey.startsWith('ORBIT-')) {
    return { isValid: true, planTier: 'free' };
  }

  return { isValid: false, planTier: 'free' };
}

