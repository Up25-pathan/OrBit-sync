import { prisma } from '../db';

export interface AuditLogEntry {
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType: 'user' | 'enterprise' | 'license' | 'device' | 'release' | 'subscription' | 'system';
  targetId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await (prisma as any).auditLog.create({
      data: {
        adminUserId: entry.adminUserId,
        adminEmail: entry.adminEmail,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (err: any) {
    if (err.code !== 'P2003') {
      console.error('[AuditLog] Failed to write audit log:', err);
    }
  }
}

export function createAuditMiddleware() {
  return async (req: any, res: any, next: any) => {
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      if (req.adminUser && (res.statusCode === 200 || res.statusCode === 201)) {
        const action = `${req.method} ${req.path}`;
        const targetId = req.params.id || req.body?.id || 'unknown';
        let targetType: AuditLogEntry['targetType'] = 'system';

        if (req.path.includes('/users')) targetType = 'user';
        else if (req.path.includes('/enterprise')) targetType = 'enterprise';
        else if (req.path.includes('/license')) targetType = 'license';
        else if (req.path.includes('/device')) targetType = 'device';
        else if (req.path.includes('/release')) targetType = 'release';
        else if (req.path.includes('/subscription') || req.path.includes('/tier')) targetType = 'subscription';

        logAuditEvent({
          adminUserId: req.adminUser.id,
          adminEmail: req.adminUser.email,
          action,
          targetType,
          targetId,
          details: { body: req.body, query: req.query },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch(() => {});
      }
      return originalJson(data);
    };
    next();
  };
}