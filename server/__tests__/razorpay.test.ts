import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../app';

describe('Razorpay Standard Checkout Integration', () => {
  const TEST_SECRET = process.env.RAZORPAY_KEY_SECRET || 'Fq72E6IardljrNHz57NqTagY';
  const TEST_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TlnPLJTh89dNF1';

  describe('Create Order Endpoint (POST /api/create-order)', () => {
    it('validates minimum amount >= 100 paise (rejects amount < 100 with status 400)', async () => {
      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 99, currency: 'INR' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least 100 paise/i);
    });

    it('rejects invalid or non-numeric amount with status 400', async () => {
      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 'invalid-amount', currency: 'INR' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('handles authentication failure with status 401 when keys are rejected by Razorpay', async () => {
      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 50000, currency: 'INR', receipt: 'rcpt_test_1' });

      // If test credentials return 401 (Authentication failed), our endpoint must return 401
      // If credentials were valid live credentials, it would return 200 with order_id
      if (res.status === 401) {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
      } else {
        expect(res.status).toBe(200);
        expect(res.body.order_id).toBeDefined();
        expect(res.body.amount).toBe(50000);
      }
    });

    it('direct endpoint /create-order works as framework-equivalent route', async () => {
      const res = await request(app)
        .post('/create-order')
        .send({ amount: 50 }); // Less than 100 paise

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least 100 paise/i);
    });
  });

  describe('Verify Payment Endpoint (POST /api/verify-payment)', () => {
    it('rejects request with missing fields with status 400', async () => {
      const res = await request(app)
        .post('/api/verify-payment')
        .send({ razorpay_order_id: 'order_123', razorpay_payment_id: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/missing/i);
    });

    it('rejects signature mismatch with status 400 and does NOT mark as paid', async () => {
      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          razorpay_order_id: 'order_test_999',
          razorpay_payment_id: 'pay_test_888',
          razorpay_signature: 'invalid_tampered_signature_hex_1234567890abcdef',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/signature/i);
    });

    it('successfully verifies valid HMAC-SHA256 signature and returns status 200', async () => {
      const orderId = 'order_test_VALID_123';
      const paymentId = 'pay_test_VALID_456';

      // Generate authentic HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
      expect(res.body.order_id).toBe(orderId);
      expect(res.body.payment_id).toBe(paymentId);
    });

    it('supports alternative snake_case parameter names (order_id, payment_id, signature)', async () => {
      const orderId = 'order_test_ALT_123';
      const paymentId = 'pay_test_ALT_456';

      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          order_id: orderId,
          payment_id: paymentId,
          signature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
    });

    it('direct endpoint /verify-payment works as framework-equivalent route', async () => {
      const orderId = 'order_test_DIRECT_123';
      const paymentId = 'pay_test_DIRECT_456';

      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/verify-payment')
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
    });
  });

  describe('Config Endpoint (GET /api/razorpay/config)', () => {
    it('returns the public RAZORPAY_KEY_ID and never exposes RAZORPAY_KEY_SECRET', async () => {
      const res = await request(app).get('/api/razorpay/config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.key_id).toBe(TEST_KEY_ID);
      expect(res.body.key_secret).toBeUndefined();
    });
  });
});
