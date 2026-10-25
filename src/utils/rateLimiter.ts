import Redis from 'ioredis';

let redis: Redis | null = null;
let hasWarnedRedis = false;

function getRedis(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (!hasWarnedRedis) {
      console.warn('[RateLimiter] REDIS_URL not configured, rate limiting will be disabled (in-memory pass-through)');
      hasWarnedRedis = true;
    }
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    redis.on('error', (err: any) => {
      console.error('[RateLimiter] Redis connection error:', err?.message || err);
    });

    redis.on('connect', () => {
      console.log('[RateLimiter] Redis connected');
    });

    redis.connect().catch(() => {});
    return redis;
  } catch (err: any) {
    console.error('[RateLimiter] Failed to initialize Redis:', err);
    return null;
  }
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const client = getRedis();
  const prefix = options.keyPrefix || 'ratelimit';
  const key = `${prefix}:${identifier}`;
  const windowSec = Math.ceil(options.windowMs / 1000);

  if (!client) {
    return {
      allowed: true,
      remaining: options.maxRequests,
      resetAt: Date.now() + options.windowMs,
      total: options.maxRequests,
    };
  }

  try {
    const now = Date.now();
    const windowStart = now - options.windowMs;

    const multi = client.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.expire(key, windowSec);
    const results = await multi.exec();

    const currentCount = (results?.[1]?.[1] as number) || 0;
    const allowed = currentCount < options.maxRequests;
    const remaining = Math.max(0, options.maxRequests - currentCount - (allowed ? 0 : 1));

    if (!allowed) {
      await client.zrem(key, `${now}-${Math.random()}`);
    }

    const ttl = await client.ttl(key);
    const resetAt = now + (ttl > 0 ? ttl * 1000 : options.windowMs);

    return { allowed, remaining, resetAt, total: options.maxRequests };
  } catch (err) {
    console.error('[RateLimiter] Error checking rate limit:', err);
    return {
      allowed: true,
      remaining: options.maxRequests,
      resetAt: Date.now() + options.windowMs,
      total: options.maxRequests,
    };
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  return async (req: any, res: any, next: any) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const result = await checkRateLimit(ip, options);

    res.setHeader('X-RateLimit-Limit', result.total);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter,
      });
    }

    next();
  };
}

export async function incrementFailedLogin(email: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;

  const key = `failed_login:${email.toLowerCase()}`;
  const count = await client.incr(key);
  await client.expire(key, 3600);
  return count;
}

export async function resetFailedLogin(email: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const key = `failed_login:${email.toLowerCase()}`;
  await client.del(key);
}

export async function getFailedLoginCount(email: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;

  const key = `failed_login:${email.toLowerCase()}`;
  const count = await client.get(key);
  return count ? parseInt(count, 10) : 0;
}

export async function isAccountLocked(email: string, maxAttempts = 5): Promise<boolean> {
  const count = await getFailedLoginCount(email);
  return count >= maxAttempts;
}