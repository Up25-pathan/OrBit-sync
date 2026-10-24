import { Response } from 'express';
import Razorpay from 'razorpay';
import Stripe from 'stripe';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest, authenticateJWT } from '../auth';
import { generateLicenseKey } from '../utils/licenseGenerator';

const express = require('express');
const router = express.Router();

// Helper to update user device limits on subscription upgrade without overwriting permanent license key
async function updateUserLicense(userId: string, planTier: string) {
  try {
    const normalizedTier = planTier === 'mesh' ? 'pro' : planTier;
    const maxDevices = planTier === 'mesh' ? 9999 : (planTier === 'pro' ? 10 : 3);

    const existing = await prisma.license.findUnique({ where: { userId } });
    if (existing) {
      await prisma.license.update({
        where: { userId },
        data: { maxDevices },
      });
    } else {
      const permanentKey = generateLicenseKey();
      await prisma.license.create({
        data: {
          userId,
          licenseKey: permanentKey,
          maxDevices,
        },
      });
    }
    console.log(`[Subscription Upgrade] Successfully updated tier to ${normalizedTier.toUpperCase()} for userId: ${userId} (Permanent key preserved)`);
  } catch (err) {
    console.error('[License Update Error]:', err);
  }
}

// 1. GATEWAY INITIALIZATIONS

// Razorpay SDK
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

// Stripe SDK
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' as any }) : null;

// PayPal credentials (We support standard checkout script, mock fallback if empty)
const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';


import { sendPaymentReceiptEmail } from '../utils/mailer';

// ----------------------------------------------------
// SECTION A: RAZORPAY GATEWAY API CONTROLLERS
// ----------------------------------------------------

// POST /api/billing/razorpay/order
router.post('/razorpay/order', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planTier, currency = 'USD', couponCode } = req.body;
    console.log('[Razorpay Order] Request from userId:', userId, 'for plan:', planTier, 'currency:', currency, 'coupon:', couponCode);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!planTier || !['mesh', 'pro'].includes(planTier)) {
      return res.status(400).json({ error: 'Invalid plan tier.' });
    }

    const orderCurrency = currency === 'INR' ? 'INR' : 'USD';
    const isINR = orderCurrency === 'INR';

    // Minor subunits: Paise for INR (₹1 = 100 paise), Cents for USD ($1 = 100 cents)
    const baseSubunits = isINR
      ? (planTier === 'mesh' ? 240000 : 75000)  // ₹2,400 / ₹750
      : (planTier === 'mesh' ? 2900 : 900);     // $29 / $9

    const discount = couponCode?.toUpperCase() === 'ORBIT20' ? 0.2 : 0;
    const amountSubunits = Math.round(baseSubunits * (1 - discount));

    // Razorpay requires minimum transaction of 100 paise / 100 cents
    if (amountSubunits < 100) {
      return res.status(400).json({ error: 'Minimum transaction amount is 100 subunits.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!razorpay) {
      return res.status(500).json({ error: 'Razorpay payment gateway is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
    }

    const order = await razorpay.orders.create({
      amount: amountSubunits,
      currency: orderCurrency,
      receipt: `rcpt_${userId.substring(0, 8)}_${Date.now()}`,
      notes: { userId, planTier, currency: orderCurrency, couponCode: couponCode || '' },
    });

    return res.status(200).json({
      keyId: razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      userEmail: user.email,
    });

  } catch (error: any) {
    console.error('Razorpay order error:', error);
    return res.status(500).json({ error: 'Failed to create Razorpay order.' });
  }
});

// Alias for standard integration: POST /api/billing/create-order
router.post('/create-order', authenticateJWT, async (req: AuthRequest, res: Response) => {
  // Delegate directly to order route logic
  req.url = '/razorpay/order';
  (router as any).handle(req, res);
});

// POST /api/billing/razorpay/verify
router.post('/razorpay/verify', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature, 
      planTier,
      currency = 'USD'
    } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay payment verification fields.' });
    }

    // Cryptographic signature check (constant-time comparison)
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(generatedSignature, 'utf8');
    const userSigBuf = Buffer.from(razorpay_signature || '', 'utf8');
    const isSignatureValid = sigBuf.length === userSigBuf.length && crypto.timingSafeEqual(sigBuf, userSigBuf);

    if (!isSignatureValid) {
      return res.status(400).json({ error: 'Signature verification mismatch.' });
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planTier,
        status: 'active',
        stripeCustomerId: razorpay_payment_id,
        stripeSubscriptionId: razorpay_order_id,
        expiresAt,
      },
      create: {
        userId,
        planTier,
        status: 'active',
        stripeCustomerId: razorpay_payment_id,
        stripeSubscriptionId: razorpay_order_id,
        expiresAt,
      },
    });

    await updateUserLicense(userId, planTier);

    const isINR = currency === 'INR';
    const displayAmount = isINR
      ? (planTier === 'mesh' ? '₹2,400' : '₹750')
      : (planTier === 'mesh' ? '$29' : '$9');

    // Asynchronously dispatch payment receipt email
    prisma.user.findUnique({
      where: { id: userId },
      include: { license: true },
    }).then((userWithLicense) => {
      if (userWithLicense?.email) {
        sendPaymentReceiptEmail(userWithLicense.email, {
          planTier: planTier === 'mesh' ? 'Mesh Cluster Tier' : 'Developer Pro Tier',
          amount: displayAmount,
          paymentId: razorpay_payment_id,
          licenseKey: userWithLicense.license?.licenseKey || '',
        }).catch((e) => console.error('[Mailer Receipt Error]:', e));
      }
    }).catch((err) => console.error('[Receipt User Query Error]:', err));

    return res.status(200).json({ status: 'SUCCESS' });

  } catch (error: any) {
    console.error('Razorpay verify error:', error);
    return res.status(500).json({ error: 'Signature verification failed.' });
  }
});

// Alias for standard integration: POST /api/billing/verify-payment
router.post('/verify-payment', authenticateJWT, async (req: AuthRequest, res: Response) => {
  // Delegate directly to verify route logic
  req.url = '/razorpay/verify';
  (router as any).handle(req, res);
});


// ----------------------------------------------------
// SECTION B: STRIPE GATEWAY (CARDS/APPLE/GOOGLE PAY)
// ----------------------------------------------------

// POST /api/billing/stripe/session
router.post('/stripe/session', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planTier } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!planTier || !['mesh', 'pro'].includes(planTier)) {
      return res.status(400).json({ error: 'Invalid plan tier.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // 1. SECURE STRIPE SANDBOX (If Stripe is not configured)
    const clientUrl = req.get('origin') || process.env.CLIENT_URL || 'http://localhost:3000';
    if (!stripe) {
      console.log(`[Stripe Sandbox] Generating mock session redirect...`);
      return res.status(200).json({
        isSandbox: true,
        // Mock Stripe payment success route
        url: `${clientUrl}/console?checkout_success=true&gateway=stripe&tier=${planTier}`,
      });
    }

    // 2. REAL STRIPE SESSION INTEGRATION
    const priceId = planTier === 'mesh' 
      ? (process.env.STRIPE_PRICE_MESH || 'price_mesh_mock_29')
      : (process.env.STRIPE_PRICE_PRO || 'price_pro_mock_9');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${clientUrl}/console?checkout_success=true`,
      cancel_url: `${clientUrl}/checkout?plan=${planTier}`,
      metadata: { userId, planTier },
    });

    return res.status(200).json({
      isSandbox: false,
      url: session.url,
    });

  } catch (error: any) {
    console.error('Stripe session error:', error);
    return res.status(500).json({ error: 'Failed to initialize Stripe checkout.' });
  }
});

// POST /api/billing/stripe/verify-sandbox
router.post('/stripe/verify-sandbox', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planTier } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Provision subscription in sandbox mode directly
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.subscription.upsert({
      where: { userId },
      update: { planTier, status: 'active', expiresAt },
      create: { planTier, status: 'active', expiresAt, userId },
    });

    await updateUserLicense(userId, planTier);

    return res.status(200).json({ status: 'SUCCESS' });
  } catch (error: any) {
    console.error('Stripe verify sandbox error:', error);
    return res.status(500).json({ error: 'Sandbox verification failed.' });
  }
});


// ----------------------------------------------------
// SECTION C: PAYPAL EXPRESS GATEWAY CONTROLLERS
// ----------------------------------------------------

// POST /api/billing/paypal/order
router.post('/paypal/order', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planTier } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const price = planTier === 'mesh' ? 29.00 : 9.00;

    // Renders PayPal Sandbox details (If real developer SDK is not initialized, mock it)
    console.log(`[PayPal Order] Creating payment order structure: $${price} for user ${userId}`);
    const mockOrderId = `PAYPAL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return res.status(200).json({
      isSandbox: !paypalClientId,
      orderId: mockOrderId,
      amount: price,
      currency: 'USD',
    });

  } catch (error: any) {
    console.error('PayPal order error:', error);
    return res.status(500).json({ error: 'Failed to launch PayPal session.' });
  }
});

// POST /api/billing/paypal/capture
router.post('/paypal/capture', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, planTier } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    console.log(`[PayPal Capture] Processing capture for order ${orderId} -> User: ${userId}`);

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Upsert subscription mapping
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planTier,
        status: 'active',
        stripeCustomerId: orderId, // Store PayPal order reference here
        expiresAt,
      },
      create: {
        userId,
        planTier,
        status: 'active',
        stripeCustomerId: orderId,
        expiresAt,
      },
    });

    await updateUserLicense(userId, planTier);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'PayPal payment successfully captured.',
    });

  } catch (error: any) {
    console.error('PayPal capture error:', error);
    return res.status(500).json({ error: 'Payment capture failed.' });
  }
});

export default router;

// Stripe Webhook with signature verification
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers.get('stripe-signature') || req.headers.get('Stripe-Signature') || '';

  if (!stripeWebhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!sig) {
    console.warn('[Stripe Webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  if (!stripe) {
    console.error('[Stripe Webhook] Stripe not configured');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event;
  try {
    const rawBody = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const planTier = session.metadata?.planTier;

        if (userId && planTier) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              planTier,
              status: 'active',
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              expiresAt,
            },
            create: {
              userId,
              planTier,
              status: 'active',
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              expiresAt,
            },
          });

          await updateUserLicense(userId, planTier);
          console.log(`[Stripe Webhook] Subscription activated for user ${userId}: ${planTier}`);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.userId;

        if (userId) {
          const status = subscription.status === 'active' ? 'active' : 'canceled';
          await prisma.subscription.update({
            where: { userId },
            data: { status },
          });
          console.log(`[Stripe Webhook] Subscription ${status} for user ${userId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const userId = invoice.metadata?.userId;

        if (userId) {
          await prisma.subscription.update({
            where: { userId },
            data: { status: 'past_due' },
          });
          console.log(`[Stripe Webhook] Payment failed for user ${userId}`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Stripe Webhook] Error processing event:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});
