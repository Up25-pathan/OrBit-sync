import crypto from 'crypto';

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'orbit_secret_license_signing_key_2026';

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
 * Generates a formatted, cryptographically signed license key:
 * Format: ORBIT-{TIER}-{RANDOM_HEX}-{TIMESTAMP}-{HMAC_SIG}
 * Example: ORBIT-PRO-9F8A2B-1775865600-A3F9B2
 */
export function generateLicenseKey(tierInput: string): string {
  const tier = normalizeTier(tierInput).toUpperCase();
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  const timestamp = Math.floor(Date.now() / 1000); // 10-digit UNIX timestamp

  const payload = `${tier}-${randomHex}-${timestamp}`;
  const sigHex = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 6)
    .toUpperCase(); // 6-char HMAC signature truncation

  return `ORBIT-${tier}-${randomHex}-${timestamp}-${sigHex}`;
}

/**
 * Parses and verifies the format and signature of an OrBit license key.
 */
export function parseLicenseKey(key: string): { isValid: boolean; planTier: PlanTier; timestamp?: number } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, planTier: 'free' };
  }

  const parts = key.trim().split('-');
  
  // Handlers for standard format: ORBIT-PRO-9F8A2B-1775865600-A3F9B2 (5 parts)
  if (parts.length === 5 && parts[0] === 'ORBIT') {
    const tierStr = parts[1].toLowerCase();
    const randomHex = parts[2];
    const timestampStr = parts[3];
    const providedSig = parts[4];

    const planTier = normalizeTier(tierStr);
    const timestamp = parseInt(timestampStr, 10);

    const payload = `${tierStr.toUpperCase()}-${randomHex}-${timestampStr}`;
    const expectedSig = crypto
      .createHmac('sha256', LICENSE_SECRET)
      .update(payload)
      .digest('hex')
      .substring(0, 6)
      .toUpperCase();

    const provBuf = Buffer.from(providedSig.toUpperCase(), 'utf-8');
    const expBuf = Buffer.from(expectedSig, 'utf-8');

    let isValid = false;
    if (provBuf.length === expBuf.length) {
      isValid = crypto.timingSafeEqual(provBuf, expBuf);
    }
    return { isValid, planTier, timestamp: isNaN(timestamp) ? undefined : timestamp };
  }

  // Fallback for legacy keys (e.g. orbit_dev_pk_...)
  if (key.startsWith('orbit_')) {
    return { isValid: true, planTier: 'free' };
  }

  return { isValid: false, planTier: 'free' };
}
