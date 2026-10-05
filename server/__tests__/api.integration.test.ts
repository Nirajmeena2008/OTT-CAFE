import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { restaurantDateString, addDaysToDateString } from '../time';

const FUTURE_DATE = addDaysToDateString(restaurantDateString(), 10);

// These hit the real Express app in-process (no real network port, no dev server needed).
// Kept deliberately lean on request COUNT per suite run — orderLimiter (12/10min),
// reservationLimiter (8/15min) and adminAuthLimiter (6/15min) are real, shared, module-level
// limiters, so a bloated test suite would start failing on 429s rather than the assertions
// actually being tested.

describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Admin auth — regression coverage for the bypass fixes', () => {
  it('rejects the bare "123" bearer token (this used to grant full owner access)', async () => {
    const res = await request(app).get('/api/admin/check-access').set('Authorization', 'Bearer 123');
    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(false);
  });

  it('the old demo staff passcodes ("2026" manager, "3030" counter) no longer log anyone in', async () => {
    for (const password of ['2026', '3030']) {
      const res = await request(app).post('/api/admin/login').send({ password });
      expect(res.status).toBe(401);
    }
  });

  it('a staff account created by the owner can sign in with its generated passcode', async () => {
    const owner = await request(app).post('/api/admin/login').send({ password: 'admin123' });
    const created = await request(app)
      .post('/api/admin/team')
      .set('Authorization', `Bearer ${owner.body.token}`)
      .send({ email: 'itest.manager@example.com', name: 'ITest Manager', role: 'manager' });
    expect(created.status).toBe(201);
    expect(created.body.data.passcode).toMatch(/^\d{6}$/);

    const res = await request(app).post('/api/admin/login').send({ password: created.body.data.passcode });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('manager');
  });

  it('accepts the real configured admin password', async () => {
    const res = await request(app).post('/api/admin/login').send({ password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.permissions).toContain('*');
  });
});

describe('Order price integrity', () => {
  it('recalculates price server-side for a real catalog item, ignoring the client-supplied price', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Vitest Runner',
        customerPhone: '9500000001',
        orderType: 'pickup',
        items: [{ menuItemId: 'ott-tea-1', name: 'OTT Special Tea', price: 1, quantity: 1, isVeg: true, image: 'x' }],
        paymentMethod: 'upi',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.items[0].price).toBe(50); // real catalog price, not the tampered 1
    expect(res.body.data.subtotal).toBe(50);
  });

  it('rejects an order with quantity 0', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Vitest Runner',
        customerPhone: '9500000002',
        orderType: 'pickup',
        items: [{ menuItemId: 'ott-tea-1', name: 'x', price: 50, quantity: 0, isVeg: true, image: 'x' }],
      });
    expect(res.status).toBe(400);
  });
});

describe('Order/Reservation IDOR — regression coverage for both fixes this engagement', () => {
  it('GET /orders/:id with no auth and no guest phone is rejected', async () => {
    const create = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'IDOR Test',
        customerPhone: '9500000003',
        orderType: 'pickup',
        items: [{ menuItemId: 'ott-tea-1', name: 'x', price: 50, quantity: 1, isVeg: true, image: 'x' }],
      });
    expect(create.status).toBe(201);
    const orderId = create.body.data.id;

    const noAuth = await request(app).get(`/api/orders/${orderId}`);
    expect(noAuth.status).toBe(401);

    const wrongPhone = await request(app).get(`/api/orders/${orderId}?phone=9999999999`);
    expect(wrongPhone.status).toBe(401);

    const correctPhone = await request(app).get(`/api/orders/${orderId}?phone=9500000003`);
    expect(correctPhone.status).toBe(200);
  });

  it('GET /reservations/:id with no auth and no guest phone is rejected (this endpoint had ZERO access control before this fix)', async () => {
    const create = await request(app).post('/api/reservations').send({
      customerName: 'IDOR Resv Test',
      customerPhone: '9500000004',
      customerEmail: 'idor@test.com',
      date: FUTURE_DATE,
      time: '19:00',
      guestCount: 2,
    });
    expect(create.status).toBe(201);
    const reservationId = create.body.data.id;

    const noAuth = await request(app).get(`/api/reservations/${reservationId}`);
    expect(noAuth.status).toBe(401);

    const wrongPhone = await request(app).get(`/api/reservations/${reservationId}?phone=9999999999`);
    expect(wrongPhone.status).toBe(401);

    const correctPhone = await request(app).get(`/api/reservations/${reservationId}?phone=9500000004`);
    expect(correctPhone.status).toBe(200);
  });
});

describe('Customer OTP flow — regression for the blank-name bug', () => {
  it('send-otp succeeds with the optional name left blank', async () => {
    const res = await request(app).post('/api/auth/customer/send-otp').send({
      email: 'vitest-guest@example.com',
      phone: '9500000005',
      name: '',
    });
    expect(res.status).toBe(200);
    expect(res.body.otpPreview).toMatch(/^\d{6}$/);
  });

  it('verify-otp rejects the wrong code', async () => {
    const send = await request(app).post('/api/auth/customer/send-otp').send({
      email: 'vitest-guest2@example.com',
      phone: '9500000006',
    });
    const verify = await request(app).post('/api/auth/customer/verify-otp').send({
      email: 'vitest-guest2@example.com',
      phone: '9500000006',
      otp: '000000',
    });
    expect(send.status).toBe(200);
    expect(verify.status).toBe(400);
  });

  it('rejects the old universal bypass code "123456" when no OTP was ever requested for this identity', async () => {
    const res = await request(app).post('/api/auth/customer/verify-otp').send({
      email: 'never-requested@example.com',
      phone: '9500000099',
      otp: '123456',
    });
    expect(res.status).toBe(400);
  });
});

describe('Delivery partner auth', () => {
  it('refuses to send an OTP to a phone that is not a registered delivery partner', async () => {
    const res = await request(app).post('/api/delivery/send-otp').send({ phone: '9500000007' });
    expect(res.status).toBe(404);
  });

  it('rejects delivery routes with no auth at all (regression: these used to be fully open)', async () => {
    const res = await request(app).get('/api/delivery/orders');
    expect(res.status).toBe(401);
  });
});

describe('API hygiene — regression for the "unmatched route returns the SPA shell" bug', () => {
  it('an unmatched /api/* route returns a clean JSON 404, not HTML', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
  });

  it('a wrong HTTP method on a real route path also 404s cleanly', async () => {
    const res = await request(app).get('/api/orders'); // only POST /orders and GET /orders/:id exist
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
  });
});
