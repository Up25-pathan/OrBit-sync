import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

export function validateRequest(schema: ZodObject<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

import { z } from 'zod';

export const schemas = {
  signup: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128),
      displayName: z.string().min(1).max(50).optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required'),
    }),
  }),

  verifyCode: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
    }),
  }),

  resendCode: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
    }),
  }),

  forgotPasswordRequest: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
    }),
  }),

  forgotPasswordReset: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
      newPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128),
    }),
  }),

  passwordChangeRequest: z.object({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128),
    }),
  }),

  passwordChangeVerify: z.object({
    body: z.object({
      code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128),
    }),
  }),

  profileUpdate: z.object({
    body: z.object({
      displayName: z.string().min(1).max(50).optional(),
      avatarUrl: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
    }),
  }),

  toggle2FA: z.object({
    body: z.object({
      enabled: z.boolean(),
    }),
  }),

  revokeDevice: z.object({
    body: z.object({
      deviceRowId: z.string().uuid('Invalid device ID'),
    }),
  }),

  enterpriseCheckDomain: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
    }),
  }),

  enterpriseSendSignupOtp: z.object({
    body: z.object({
      workEmail: z.string().email('Invalid email format'),
      companyName: z.string().min(1).max(100),
      adminName: z.string().min(1).max(100),
      companyDomain: z.string().optional(),
      country: z.string().optional(),
      teamScale: z.string().optional(),
      industry: z.string().optional(),
      deploymentModel: z.string().optional(),
      adminRole: z.string().optional(),
      password: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128).optional(),
      authPreference: z.string().optional(),
      useCaseDetails: z.string().optional(),
    }),
  }),

  enterpriseVerifySignupOtp: z.object({
    body: z.object({
      code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
      workEmail: z.string().email('Invalid email format'),
      companyName: z.string().min(1).max(100),
      companyDomain: z.string().optional(),
      country: z.string().optional(),
      teamScale: z.string().optional(),
      industry: z.string().optional(),
      deploymentModel: z.string().optional(),
      adminName: z.string().min(1).max(100),
      adminRole: z.string().optional(),
      password: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128).optional(),
      authPreference: z.string().optional(),
      useCaseDetails: z.string().optional(),
    }),
  }),

  enterpriseSendLoginOtp: z.object({
    body: z.object({
      workEmail: z.string().email('Invalid email format'),
    }),
  }),

  enterpriseVerifyLoginOtp: z.object({
    body: z.object({
      workEmail: z.string().email('Invalid email format'),
      code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
    }),
  }),

  enterpriseRegister: z.object({
    body: z.object({
      companyName: z.string().min(1).max(100),
      workEmail: z.string().email('Invalid email format'),
      companyDomain: z.string().optional(),
      teamScale: z.string().optional(),
      industry: z.string().optional(),
      deploymentModel: z.string().optional(),
      adminName: z.string().min(1).max(100),
      adminRole: z.string().optional(),
      password: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128).optional(),
      authPreference: z.string().optional(),
      country: z.string().optional(),
      useCaseDetails: z.string().optional(),
      code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits').optional(),
    }),
  }),

  createOrder: z.object({
    body: z.object({
      planTier: z.enum(['mesh', 'pro']),
      currency: z.enum(['USD', 'INR']).optional(),
      couponCode: z.string().optional(),
    }),
  }),

  verifyPayment: z.object({
    body: z.object({
      razorpay_payment_id: z.string().min(1),
      razorpay_order_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
      planTier: z.enum(['mesh', 'pro']),
      currency: z.enum(['USD', 'INR']).optional(),
    }),
  }),

  stripeSession: z.object({
    body: z.object({
      planTier: z.enum(['mesh', 'pro']),
    }),
  }),

  paypalOrder: z.object({
    body: z.object({
      planTier: z.enum(['mesh', 'pro']),
    }),
  }),

  paypalCapture: z.object({
    body: z.object({
      orderId: z.string().min(1),
      planTier: z.enum(['mesh', 'pro']),
    }),
  }),

  adminBootstrap: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      bootstrapKey: z.string().min(1, 'Bootstrap key is required'),
    }),
  }),

  adminChangePassword: z.object({
    body: z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().regex(passwordRegex, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)').max(128),
    }),
  }),

  adminUpdateUser: z.object({
    params: z.object({
      id: z.string().uuid('Invalid user ID'),
    }),
    body: z.object({
      displayName: z.string().min(1).max(50).optional(),
      role: z.enum(['USER', 'ADMIN']).optional(),
      isVerified: z.boolean().optional(),
    }),
  }),

  adminUpdateTier: z.object({
    params: z.object({
      id: z.string().uuid('Invalid user ID'),
    }),
    body: z.object({
      planTier: z.enum(['free', 'pro', 'enterprise']),
      expiresAt: z.string().datetime().optional(),
      maxDevices: z.number().int().positive().optional(),
    }),
  }),

  adminDeleteUser: z.object({
    params: z.object({
      id: z.string().uuid('Invalid user ID'),
    }),
  }),

  adminCreateRelease: z.object({
    body: z.object({
      version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.-]+)?$/, 'Invalid version format (semver)'),
      title: z.string().max(100).optional(),
      notes: z.string().min(1).max(5000),
      mandatory: z.boolean().optional(),
      isActive: z.boolean().optional(),
      winUrl: z.string().url().optional().nullable(),
      winSignature: z.string().optional().nullable(),
      macX64Url: z.string().url().optional().nullable(),
      macX64Signature: z.string().optional().nullable(),
      macArmUrl: z.string().url().optional().nullable(),
      macArmSignature: z.string().optional().nullable(),
      linuxUrl: z.string().url().optional().nullable(),
      linuxSignature: z.string().optional().nullable(),
    }),
  }),

  adminUpdateRelease: z.object({
    params: z.object({
      id: z.string().uuid('Invalid release ID'),
    }),
    body: z.object({
      title: z.string().max(100).optional(),
      notes: z.string().max(5000).optional(),
      mandatory: z.boolean().optional(),
      isActive: z.boolean().optional(),
      winUrl: z.string().url().optional().nullable(),
      winSignature: z.string().optional().nullable(),
      macX64Url: z.string().url().optional().nullable(),
      macX64Signature: z.string().optional().nullable(),
      macArmUrl: z.string().url().optional().nullable(),
      macArmSignature: z.string().optional().nullable(),
      linuxUrl: z.string().url().optional().nullable(),
      linuxSignature: z.string().optional().nullable(),
    }),
  }),

  adminDeleteRelease: z.object({
    params: z.object({
      id: z.string().uuid('Invalid release ID'),
    }),
  }),

  adminUpdateTicket: z.object({
    params: z.object({
      id: z.string().uuid('Invalid ticket ID'),
    }),
    body: z.object({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
    }),
  }),

  adminApproveEnterprise: z.object({
    params: z.object({
      id: z.string().uuid('Invalid enterprise ID'),
    }),
  }),

  adminRejectEnterprise: z.object({
    params: z.object({
      id: z.string().uuid('Invalid enterprise ID'),
    }),
    body: z.object({
      reason: z.string().min(1).max(500),
    }),
  }),

  adminUpdateCrash: z.object({
    params: z.object({
      id: z.string().uuid('Invalid crash ID'),
    }),
    body: z.object({
      status: z.enum(['UNRESOLVED', 'INVESTIGATING', 'RESOLVED']),
    }),
  }),

  adminDeleteCrash: z.object({
    params: z.object({
      id: z.string().uuid('Invalid crash ID'),
    }),
  }),

  adminUpdateFeedback: z.object({
    params: z.object({
      id: z.string().uuid('Invalid feedback ID'),
    }),
    body: z.object({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
    }),
  }),

  adminDeleteFeedback: z.object({
    params: z.object({
      id: z.string().uuid('Invalid feedback ID'),
    }),
  }),

  crashReport: z.object({
    body: z.object({
      id: z.string().uuid().optional(),
      timestamp: z.string().datetime().optional(),
      appVersion: z.string().optional(),
      os: z.string().optional(),
      source: z.string().min(1, 'Source is required'),
      message: z.string().min(1, 'Message is required'),
      stackTrace: z.string().optional(),
      location: z.string().optional(),
      payload: z.string().optional(),
      userFingerprint: z.string().optional(),
      metadata: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    }),
  }),

  serverError: z.object({
    body: z.object({
      errorType: z.string().min(1),
      message: z.string().min(1),
      stackTrace: z.string().optional(),
      metadata: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    }),
  }),

  feedback: z.object({
    body: z.object({
      ticketId: z.string().optional(),
      category: z.enum(['bug', 'feature', 'feedback']).optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(10000),
      user: z.object({
        id: z.string().optional(),
        email: z.string().email().optional(),
        fingerprint: z.string().optional(),
      }).optional(),
      appVersion: z.string().optional(),
      os: z.string().optional(),
      logs: z.string().optional(),
    }),
  }),

  licenseVerify: z.object({
    query: z.object({
      key: z.string().min(1).optional(),
      licenseKey: z.string().min(1).optional(),
    }).optional(),
    body: z.object({
      licenseKey: z.string().min(1).optional(),
      key: z.string().min(1).optional(),
      deviceId: z.string().optional(),
      hostname: z.string().optional(),
      platform: z.enum(['windows', 'macos', 'linux']).optional(),
    }).optional(),
  }),
};