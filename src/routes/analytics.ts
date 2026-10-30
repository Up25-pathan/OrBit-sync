import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { createRateLimiter } from '../utils/rateLimiter';

const router = Router();

const eventSchema = z.object({
  name: z.string().trim().min(1).max(60),
  path: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(500).optional(),
  sessionId: z.string().trim().max(80).optional(),
  metadata: z.record(z.any()).optional(),
});

const ALLOWED_EVENTS = new Set([
  'page_view',
  'cta_click',
  'waitlist_view',
  'waitlist_submit',
  'waitlist_confirmed',
  'contact_submit',
  'checkout_start',
  'coupon_applied',
  'purchase',
]);

// POST /api/analytics/event - first-party, anonymous conversion events
router.post(
  '/event',
  createRateLimiter({ maxRequests: 120, windowMs: 60000, keyPrefix: 'analytics:event' }),
  async (req: Request, res: Response) => {
    try {
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid analytics event.' });
      }

      if (!ALLOWED_EVENTS.has(parsed.data.name)) {
        return res.status(400).json({ error: 'Unsupported analytics event.' });
      }

      let metadata: string | null = null;
      if (parsed.data.metadata) {
        const serialized = JSON.stringify(parsed.data.metadata);
        metadata = serialized.length > 4000 ? serialized.slice(0, 4000) : serialized;
      }

      await prisma.analyticsEvent.create({
        data: {
          name: parsed.data.name,
          path: parsed.data.path || null,
          referrer: parsed.data.referrer || null,
          sessionId: parsed.data.sessionId || null,
          metadata,
        },
      });

      return res.status(204).end();
    } catch (err: any) {
      console.error('[Analytics] Event write failed:', err);
      return res.status(500).json({ error: 'Could not record analytics event.' });
    }
  }
);

export default router;
