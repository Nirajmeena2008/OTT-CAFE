import type { Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { RazorpayCreateOrderSchema, RazorpayVerifyPaymentSchema } from './schemas';

/**
 * Returns a configured Razorpay client instance, or null if credentials are not configured.
 */
export function getRazorpayClient(): Razorpay | null {
  const key_id = process.env.RAZORPAY_KEY_ID || (process.env.NODE_ENV === 'test' ? 'rzp_test_TlnPLJTh89dNF1' : '');
  const key_secret = process.env.RAZORPAY_KEY_SECRET || (process.env.NODE_ENV === 'test' ? 'Fq72E6IardljrNHz57NqTagY' : '');
  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

/**
 * Timing-safe string comparison for cryptographic HMAC signatures.
 */
export function timingSafeCompare(expected: string, actual: string): boolean {
  if (typeof expected !== 'string' || typeof actual !== 'string') {
    return false;
  }
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actual, 'utf8');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * STEP 1: BACKEND - Create Order
 * POST /api/create-order
 * Request body: { amount (paise), currency, receipt }
 * Return: { order_id, amount, currency }
 * Minimum amount: 100 paise
 */
export async function createOrderHandler(req: Request, res: Response) {
  try {
    // 1. Validate payload using Zod schema
    const parseResult = RazorpayCreateOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid order creation request',
        details: parseResult.error.flatten(),
      });
    }

    const { amount, currency = 'INR', receipt, notes } = parseResult.data;

    // Strict validation: amount >= 100 paise
    if (amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least 100 paise',
      });
    }

    // 2. Check Razorpay credentials
    const client = getRazorpayClient();
    if (!client) {
      return res.status(401).json({
        success: false,
        error: 'Razorpay authentication failed: Credentials not configured on server',
      });
    }

    // 3. Call Razorpay API: POST https://api.razorpay.com/v1/orders
    const options: any = {
      amount,
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
    };
    if (notes && Object.keys(notes).length > 0) {
      options.notes = notes;
    }

    const order = await client.orders.create(options);

    // 4. Return: { order_id, amount, currency } along with success indicator
    return res.status(200).json({
      success: true,
      order_id: order.id,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error('Error creating Razorpay order:', err);

    // Handle authentication failures (return 401)
    const statusCode = err.statusCode || err.status;
    const isAuthFailure =
      statusCode === 401 ||
      (err.error?.code === 'BAD_REQUEST_ERROR' &&
        typeof err.error?.description === 'string' &&
        err.error.description.toLowerCase().includes('auth'));

    if (isAuthFailure) {
      return res.status(401).json({
        success: false,
        error: err.error?.description || 'Razorpay authentication failed. Please verify API keys.',
      });
    }

    // Handle other Razorpay API errors (return 500)
    return res.status(500).json({
      success: false,
      error: err.error?.description || err.message || 'Failed to create order with Razorpay',
    });
  }
}

/**
 * STEP 3: BACKEND - Verify Payment Signature
 * POST /api/verify-payment
 * Request body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 * Return success only if signatures match
 */
export async function verifyPaymentHandler(req: Request, res: Response) {
  try {
    const parseResult = RazorpayVerifyPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Missing required payment verification fields',
      });
    }

    const orderId = (req.body.razorpay_order_id || req.body.order_id || '').trim();
    const paymentId = (req.body.razorpay_payment_id || req.body.payment_id || '').trim();
    const clientSignature = (req.body.razorpay_signature || req.body.signature || '').trim();

    if (!orderId || !paymentId || !clientSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification fields (order_id, payment_id, signature)',
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || (process.env.NODE_ENV === 'test' ? 'Fq72E6IardljrNHz57NqTagY' : '');
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay secret key not configured on server',
      });
    }

    // Compute HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const payload = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    const isValid = timingSafeCompare(generatedSignature, clientSignature);

    if (!isValid) {
      // Signature mismatch: return 400, do NOT mark as paid
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: Signature mismatch',
        verified: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      verified: true,
      order_id: orderId,
      payment_id: paymentId,
    });
  } catch (err: any) {
    console.error('Error verifying Razorpay payment:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error verifying payment',
    });
  }
}

/**
 * Returns public Razorpay key ID for client-side checkout
 * GET /api/razorpay/config
 */
export function getRazorpayConfigHandler(req: Request, res: Response) {
  res.json({
    success: true,
    key_id: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || (process.env.NODE_ENV === 'test' ? 'rzp_test_TlnPLJTh89dNF1' : ''),
  });
}
