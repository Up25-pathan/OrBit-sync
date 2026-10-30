import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import Stripe from 'stripe';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest, authenticateJWT, verifyToken } from '../auth';
import { generateLicenseKey } from '../utils/licenseGenerator';
import { redeemCoupon, validateCoupon } from '../utils/coupons';

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

// PayPal credentials (real Orders v2 API when configured)
const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
const paypalConfigured = Boolean(paypalClientId && paypalClientSecret);
const paypalApiBase =
  (process.env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
  const response = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PayPal auth failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data: any = await response.json();
  return data.access_token;
}


import { sendPaymentReceiptEmail } from '../utils/mailer';

// ----------------------------------------------------
// COUPON VALIDATION (EARLY-BIRD / PROMOTIONAL CODES)
// ----------------------------------------------------

// POST /api/billing/coupon/validate
router.post('/coupon/validate', async (req: Request, res: Response) => {
  try {
    const { code } = (req.body || {}) as { code?: string };
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const decoded = token ? verifyToken(token) : null;
    const result = await validateCoupon(code || '', decoded?.id);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.reason || 'Invalid coupon code.' });
    }

    return res.status(200).json({
      valid: true,
      code: result.code,
      discountPercent: result.discountPercent,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    console.error('[Coupon Validate] Error:', err);
    return res.status(500).json({ valid: false, error: 'Could not validate coupon code.' });
  }
});

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

    let discount = 0;
    if (couponCode) {
      const coupon = await validateCoupon(couponCode, userId);
      if (!coupon.valid) {
        return res.status(400).json({ error: coupon.reason || 'Invalid coupon code.' });
      }
      discount = (coupon.discountPercent || 0) / 100;
    }

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
    } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay payment verification fields.' });
    }

    if (!razorpay) {
      return res.status(503).json({ error: 'Razorpay payment gateway is not configured on the server.' });
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

    const order = await razorpay.orders.fetch(razorpay_order_id);
    const orderNotes = (order.notes || {}) as Record<string, string>;
    const orderPlanTier = orderNotes.planTier;
    const orderUserId = orderNotes.userId;

    if (orderUserId !== userId) {
      return res.status(403).json({ error: 'This payment order belongs to a different account.' });
    }

    if (!orderPlanTier || !['mesh', 'pro'].includes(orderPlanTier)) {
      return res.status(400).json({ error: 'Payment order is missing a valid plan tier.' });
    }

    if (planTier && planTier !== orderPlanTier) {
      return res.status(400).json({ error: 'Plan tier does not match the payment order.' });
    }

    const effectiveTier = orderPlanTier;
    const orderCurrency = order.currency || 'USD';
    const orderCouponCode = orderNotes.couponCode || '';

    let couponPercent = 0;
    if (orderCouponCode) {
      const coupon = await validateCoupon(orderCouponCode, userId);
      if (coupon.valid) {
        couponPercent = coupon.discountPercent || 0;
      }
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planTier: effectiveTier,
        status: 'active',
        stripeCustomerId: razorpay_payment_id,
        stripeSubscriptionId: razorpay_order_id,
        expiresAt,
      },
      create: {
        userId,
        planTier: effectiveTier,
        status: 'active',
        stripeCustomerId: razorpay_payment_id,
        stripeSubscriptionId: razorpay_order_id,
        expiresAt,
      },
    });

    await updateUserLicense(userId, effectiveTier);

    if (orderCouponCode && couponPercent > 0) {
      await redeemCoupon(orderCouponCode, userId, effectiveTier);
    }

    const orderAmount = Number(order.amount) / 100;
    const displayAmount =
      orderCurrency === 'INR'
        ? `₹${orderAmount.toLocaleString('en-IN')}`
        : `$${orderAmount.toFixed(2)}`;

    // Asynchronously dispatch payment receipt email
    prisma.user.findUnique({
      where: { id: userId },
      include: { license: true },
    }).then((userWithLicense) => {
      if (userWithLicense?.email) {
        sendPaymentReceiptEmail(userWithLicense.email, {
          planTier: effectiveTier === 'mesh' ? 'Mesh Cluster Tier' : 'Developer Pro Tier',
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
    const { planTier, couponCode } = req.body;

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

    let couponPercent = 0;
    if (couponCode) {
      const coupon = await validateCoupon(couponCode, userId);
      if (!coupon.valid) {
        return res.status(400).json({ error: coupon.reason || 'Invalid coupon code.' });
      }
      couponPercent = coupon.discountPercent || 0;
    }

    // 1. STRIPE SANDBOX (only when explicitly allowed outside production)
    const clientUrl = req.get('origin') || process.env.CLIENT_URL || 'http://localhost:3000';
    const sandboxAllowed = process.env.ALLOW_PAYMENT_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';

    if (!stripe) {
      if (!sandboxAllowed) {
        return res.status(503).json({ error: 'Stripe is not configured on the server. Please set STRIPE_SECRET_KEY.' });
      }
      console.log(`[Stripe Sandbox] Generating sandbox session redirect...`);
      return res.status(200).json({
        isSandbox: true,
        url: `${clientUrl}/console?checkout_success=true&gateway=stripe&tier=${planTier}`,
      });
    }

    // 2. REAL STRIPE SESSION INTEGRATION
    const priceId = planTier === 'mesh' 
      ? (process.env.STRIPE_PRICE_MESH || 'price_mesh_mock_29')
      : (process.env.STRIPE_PRICE_PRO || 'price_pro_mock_9');

    let discounts: any[] | undefined;
    if (couponCode && couponPercent > 0) {
      const stripeCouponId = `orbit-${String(couponCode).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      try {
        await stripe.coupons.retrieve(stripeCouponId);
      } catch {
        await stripe.coupons.create({
          id: stripeCouponId,
          percent_off: couponPercent,
          duration: 'once',
          name: String(couponCode).toUpperCase(),
        });
      }
      discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      discounts,
      success_url: `${clientUrl}/console?checkout_success=true`,
      cancel_url: `${clientUrl}/checkout?plan=${planTier}`,
      metadata: { userId, planTier, couponCode: couponCode ? String(couponCode).toUpperCase() : '' },
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
    const { planTier, couponCode } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const sandboxAllowed = process.env.ALLOW_PAYMENT_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
    if (!sandboxAllowed) {
      return res.status(403).json({ error: 'Sandbox payments are disabled in production.' });
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

    if (couponCode) {
      const coupon = await validateCoupon(couponCode, userId);
      if (coupon.valid) {
        await redeemCoupon(couponCode, userId, planTier);
      }
    }

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
    const { planTier, couponCode } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!planTier || !['mesh', 'pro'].includes(planTier)) {
      return res.status(400).json({ error: 'Invalid plan tier.' });
    }

    if (!paypalConfigured) {
      return res.status(503).json({
        error: 'PayPal is not configured on the server. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      });
    }

    let couponPercent = 0;
    if (couponCode) {
      const coupon = await validateCoupon(couponCode, userId);
      if (!coupon.valid) {
        return res.status(400).json({ error: coupon.reason || 'Invalid coupon code.' });
      }
      couponPercent = coupon.discountPercent || 0;
    }

    const basePrice = planTier === 'mesh' ? 29.0 : 9.0;
    const price = Math.round(basePrice * (1 - couponPercent / 100) * 100) / 100;
    const clientUrl = req.get('origin') || process.env.CLIENT_URL || 'http://localhost:3000';
    const token = await getPayPalAccessToken();

    const response = await fetch(`${paypalApiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: 'USD', value: price.toFixed(2) },
            description: planTier === 'mesh' ? 'OrBit Mesh Cluster Tier' : 'OrBit Developer Pro Tier',
            custom_id: planTier,
          },
        ],
        application_context: {
          brand_name: 'OrBit',
          user_action: 'PAY_NOW',
          return_url: `${clientUrl}/console?checkout_success=true&gateway=paypal&tier=${encodeURIComponent(
            planTier
          )}&coupon=${encodeURIComponent(couponCode || '')}`,
          cancel_url: `${clientUrl}/checkout?plan=${encodeURIComponent(planTier)}`,
        },
      }),
    });

    const order: any = await response.json();
    if (!response.ok) {
      console.error('[PayPal Order] API error:', order);
      return res.status(502).json({ error: 'PayPal could not create the order.' });
    }

    const approveLink = (order.links || []).find((link: any) => link.rel === 'approve');

    return res.status(200).json({
      isSandbox: false,
      orderId: order.id,
      approveUrl: approveLink?.href || null,
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
    const { orderId, planTier, couponCode } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'PayPal order ID is required.' });
    }

    if (!planTier || !['mesh', 'pro'].includes(planTier)) {
      return res.status(400).json({ error: 'Invalid plan tier.' });
    }

    if (!paypalConfigured) {
      return res.status(503).json({ error: 'PayPal is not configured on the server.' });
    }

    const token = await getPayPalAccessToken();

    const orderResponse = await fetch(`${paypalApiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const paypalOrder: any = await orderResponse.json();
    if (!orderResponse.ok) {
      console.error('[PayPal Capture] Could not load order:', paypalOrder);
      return res.status(400).json({ error: 'Could not load the PayPal order.' });
    }

    const orderUnit = Array.isArray(paypalOrder.purchase_units) ? paypalOrder.purchase_units[0] : null;
    const orderTier = orderUnit?.custom_id;
    const orderAmount = Number(orderUnit?.amount?.value);
    const orderCurrency = orderUnit?.amount?.currency_code;

    if (!['mesh', 'pro'].includes(orderTier)) {
      return res.status(400).json({ error: 'PayPal order is missing a valid plan tier.' });
    }

    if (planTier && planTier !== orderTier) {
      return res.status(400).json({ error: 'Plan tier does not match the PayPal order.' });
    }

    if (!Number.isFinite(orderAmount) || orderAmount <= 0 || orderCurrency !== 'USD') {
      return res.status(400).json({ error: 'PayPal order has an invalid amount.' });
    }

    const effectiveTier = orderTier;

    const captureResponse = await fetch(`${paypalApiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const capture: any = await captureResponse.json();
    if (!captureResponse.ok || capture.status !== 'COMPLETED') {
      console.error('[PayPal Capture] API error:', capture);
      return res.status(400).json({ error: 'PayPal payment was not completed.' });
    }

    console.log(`[PayPal Capture] Completed order ${orderId} -> User: ${userId} (${effectiveTier})`);

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Upsert subscription mapping
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planTier: effectiveTier,
        status: 'active',
        stripeCustomerId: orderId, // Store PayPal order reference here
        expiresAt,
      },
      create: {
        userId,
        planTier: effectiveTier,
        status: 'active',
        stripeCustomerId: orderId,
        expiresAt,
      },
    });

    await updateUserLicense(userId, effectiveTier);

    if (couponCode) {
      const coupon = await validateCoupon(couponCode, userId);
      if (coupon.valid) {
        await redeemCoupon(couponCode, userId, effectiveTier);
      }
    }

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
  const sig = req.headers['stripe-signature'] || req.headers['Stripe-Signature'] || '';

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

          const couponCode = session.metadata?.couponCode;
          if (couponCode) {
            const coupon = await validateCoupon(couponCode, userId);
            if (coupon.valid) {
              await redeemCoupon(couponCode, userId, planTier);
            }
          }

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
