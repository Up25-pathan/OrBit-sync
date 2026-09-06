import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

/**
 * POST /api/telemetry/crash
 * Ingests fatal crash reports from desktop client (Rust panics & React UI errors).
 */
router.post('/crash', async (req: Request, res: Response) => {
  try {
    const {
      id,
      timestamp,
      appVersion,
      os,
      source,
      message,
      stackTrace,
      location,
      payload,
      userFingerprint,
      metadata,
    } = req.body;

    if (!message && !source) {
      return res.status(400).json({ error: 'Crash report requires at least a source or message.' });
    }

    const crash = await (prisma as any).crashReport.create({
      data: {
        id: id || undefined,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        appVersion: appVersion || '0.1.0',
        os: os || 'unknown',
        source: source || 'unhandled_error',
        message: String(message || 'Unknown panic/error'),
        stackTrace: stackTrace ? String(stackTrace) : null,
        location: location ? String(location) : null,
        payload: payload ? String(payload) : null,
        userFingerprint: userFingerprint ? String(userFingerprint) : null,
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        status: 'UNRESOLVED',
      },
    });

    console.log(`[Telemetry] Recorded ${source || 'error'} crash report: ${crash.id} (${appVersion})`);
    return res.status(201).json({ success: true, id: crash.id });
  } catch (err: any) {
    console.error('[Telemetry] Failed to record crash report:', err);
    return res.status(500).json({ error: 'Failed to record crash report.' });
  }
});

/**
 * POST /api/telemetry/server-error
 * Ingests 5xx server-error webhooks from the Go control server.
 */
router.post('/server-error', async (req: Request, res: Response) => {
  try {
    const controlSecret = process.env.CONTROL_SERVER_SECRET;
    const incomingSecret = req.headers['x-control-server-secret'];

    // If a control secret is configured on web server, verify it
    if (controlSecret && incomingSecret !== controlSecret) {
      console.warn('[Telemetry] Unauthorized server-error webhook attempt.');
      return res.status(401).json({ error: 'Unauthorized webhook source.' });
    }

    const { errorType, message, stackTrace, metadata } = req.body;

    if (!message && !errorType) {
      return res.status(400).json({ error: 'Server error event requires a message or errorType.' });
    }

    const event = await (prisma as any).serverErrorEvent.create({
      data: {
        errorType: errorType || 'SERVER_ERROR',
        message: String(message || 'Unhandled server error'),
        stackTrace: stackTrace ? String(stackTrace) : null,
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        status: 'UNRESOLVED',
      },
    });

    console.log(`[Telemetry] Recorded Control Server error webhook: ${event.id} [${errorType}]`);
    return res.status(201).json({ success: true, id: event.id });
  } catch (err: any) {
    console.error('[Telemetry] Failed to record server error event:', err);
    return res.status(500).json({ error: 'Failed to record server error event.' });
  }
});

/**
 * POST /api/feedback
 * Ingests user feedback and bug reports from the desktop client with attached logs.
 */
router.post(['/', '/submit'], async (req: Request, res: Response) => {
  try {
    const {
      ticketId,
      category,
      severity,
      title,
      description,
      user,
      appVersion,
      os,
      logs,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    const finalTicketId = ticketId || `FB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const feedback = await (prisma as any).feedbackTicket.upsert({
      where: { ticketId: finalTicketId },
      create: {
        ticketId: finalTicketId,
        category: category || 'feedback',
        severity: severity || 'medium',
        title: String(title).trim(),
        description: String(description).trim(),
        userId: user?.id || null,
        userEmail: user?.email || null,
        fingerprint: user?.fingerprint || null,
        appVersion: appVersion || '0.1.0',
        os: os || 'unknown',
        logs: logs ? String(logs) : null,
        status: 'OPEN',
      },
      update: {
        category: category || 'feedback',
        severity: severity || 'medium',
        title: String(title).trim(),
        description: String(description).trim(),
        logs: logs ? String(logs) : undefined,
      },
    });

    console.log(`[Feedback] Saved ${feedback.category} ticket ${feedback.ticketId} from ${feedback.userEmail || 'anonymous'}`);
    return res.status(201).json({ success: true, ticketId: feedback.ticketId });
  } catch (err: any) {
    console.error('[Feedback] Failed to save feedback ticket:', err);
    return res.status(500).json({ error: 'Failed to save feedback ticket.' });
  }
});

export default router;
