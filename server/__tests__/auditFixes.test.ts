import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { store, isCafeAcceptingOrders } from '../store';
import { CreateReservationSchema } from '../schemas';
import { formatRestaurantTime, restaurantDateString, addDaysToDateString } from '../time';

// Regression coverage for the second full audit (admin auth bypasses, data loss on refresh,
// zod partial-update defaults, IST date/time handling, open/closed scheduling).

let ownerToken = '';
const auth = () => ({ Authorization: `Bearer ${ownerToken}` });

beforeAll(async () => {
  const res = await request(app).post('/api/admin/login').send({ password: 'admin123' });
  ownerToken = res.body.token;
});

afterEach(() => {
  store.cafeInfo = { ...store.cafeInfo, isOpen: true, closedUntil: null, closedReason: '' };
});

const teaOrder = (phone: string, extra: Record<string, unknown> = {}) => ({
  customerName: 'Audit Test',
  customerPhone: phone,
  orderType: 'pickup',
  items: [{ menuItemId: 'ott-tea-1', name: 'OTT Special Tea', price: 50, quantity: 1, isVeg: true, image: 'x' }],
  ...extra,
});

describe('Admin access cannot be obtained without a real credential', () => {
  it('?email=<owner> no longer grants owner access', async () => {
    const check = await request(app).get('/api/admin/check-access?email=kumarsatyam5868@gmail.com');
    expect(check.body.hasAccess).toBe(false);
    expect(check.body.adminToken).toBeUndefined();
    const orders = await request(app).get('/api/admin/orders?email=kumarsatyam5868@gmail.com');
    expect(orders.status).toBe(401);
  });

  it('a self-made admin_session_<base64 email> token is rejected', async () => {
    const forged = `admin_session_${Buffer.from('kumarsatyam5868@gmail.com').toString('base64')}_x`;
    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("signing in as a customer with the owner's email gives no admin access", async () => {
    const payload = { email: 'kumarsatyam5868@gmail.com', phone: '9500000101', name: 'Not The Owner' };
    const sent = await request(app).post('/api/auth/customer/send-otp').send(payload);
    const verified = await request(app)
      .post('/api/auth/customer/verify-otp')
      .send({ ...payload, otp: sent.body.otpPreview });
    expect(verified.status).toBe(200);
    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${verified.body.token}`);
    expect(res.status).toBe(401);
  });

  it('the old hard-coded demo customer token is gone', async () => {
    const res = await request(app).get('/api/user/profile').set('Authorization', 'Bearer cust-mock-jwt-token-CUST-1001');
    expect(res.status).toBe(401);
  });

  it('the owner session token does not contain the admin password', async () => {
    expect(ownerToken).toBeTruthy();
    expect(ownerToken).not.toContain('admin123');
    const check = await request(app).get('/api/admin/check-access').set(auth());
    expect(check.body.hasAccess).toBe(true);
    expect(check.body.adminToken).not.toContain('admin123');
  });
});

describe('Admin edits only change what was sent', () => {
  it('marking a non-veg dish unavailable keeps it non-veg with its tags and rating', async () => {
    const before = store.menuItems.find((m) => m.id === 'ott-soup-5')!;
    expect(before.isVeg).toBe(false);
    const res = await request(app).put('/api/admin/menu/ott-soup-5').set(auth()).send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);
    expect(res.body.data.isVeg).toBe(false);
    expect(res.body.data.tags).toEqual(['Soup', 'Chicken', 'Non-Veg']);
    expect(res.body.data.rating).toBe(4.8);
  });

  it('renaming a hidden banner keeps it hidden', async () => {
    await request(app).put('/api/admin/banners/promo-2').set(auth()).send({ active: false });
    const res = await request(app).put('/api/admin/banners/promo-2').set(auth()).send({ title: 'Renamed Banner' });
    expect(res.body.data.title).toBe('Renamed Banner');
    expect(res.body.data.active).toBe(false);
  });
});

describe('Orders only contain real, available dishes at server prices', () => {
  it('rejects an item id that is not on the menu (used to be charged at the client price)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(teaOrder('9500000102', {
        items: [{ menuItemId: 'made-up', name: 'Free Feast', price: 1, quantity: 1, isVeg: true, image: 'x' }],
      }));
    expect(res.status).toBe(400);
  });

  it('rejects a dish marked unavailable', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(teaOrder('9500000103', {
        items: [{ menuItemId: 'ott-soup-5', name: 'Chicken Soup', price: 1, quantity: 1, isVeg: false, image: 'x' }],
      }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it('prices custom-cake add-ons the customer selected', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(teaOrder('9500000104', {
        isCustomCake: true,
        items: [{ menuItemId: 'custom-cake-preorder', name: 'Cake', price: 1, quantity: 1, isVeg: true, image: 'x' }],
        customCakeDetails: {
          occasion: 'Birthday', flavor: 'Chocolate', weightKg: 1, isEggless: true, designDescription: 'Simple',
          targetDate: addDaysToDateString(restaurantDateString(), 3), targetTime: '06:00 PM',
          addSparklerCandle: true, addAcrylicTopper: true,
        },
      }));
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(950 + 50 + 80);
  });
});

describe('Admin responses match what the dashboard reads', () => {
  it('reset-access returns the new passcode under data', async () => {
    const created = await request(app)
      .post('/api/admin/team').set(auth())
      .send({ email: 'reset.me@example.com', name: 'Reset Me', role: 'staff' });
    const res = await request(app).post(`/api/admin/team/${created.body.data.id}/reset-access`).set(auth());
    expect(res.body.data.passcode).toMatch(/^\d{6}$/);
    expect(res.body.data.user.id).toBe(created.body.data.id);
    const login = await request(app).post('/api/admin/login').send({ password: res.body.data.passcode });
    expect(login.status).toBe(200);
  });

  it('purge-fake returns data', async () => {
    const res = await request(app).post('/api/admin/orders/purge-fake').set(auth());
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ purgedCount: expect.any(Number) });
  });

  it('rejects a custom staff passcode that is already in use', async () => {
    const res = await request(app)
      .post('/api/admin/team').set(auth())
      .send({ email: 'dupe@example.com', name: 'Dupe', role: 'staff', passcode: 'admin123' });
    expect(res.status).toBe(400);
  });
});

describe('Delivery assignment survives a dashboard refresh', () => {
  it('GET /admin/orders keeps the rider assignment on the order', async () => {
    const order = await request(app)
      .post('/api/orders')
      .send(teaOrder('9500000105', { orderType: 'delivery', deliveryAddress: '12 Test Street, Jaipur' }));
    const id = order.body.data.id;
    const assign = await request(app)
      .post(`/api/admin/orders/${id}/assign-delivery`).set(auth())
      .send({ partner: { id: 'rider-x', name: 'Rider X', phone: '9500000999', vehicleType: 'bike', vehicleNumber: 'RJ14 AB 1' } });
    expect(assign.status).toBe(200);
    const list = await request(app).get('/api/admin/orders').set(auth());
    const found = list.body.data.find((o: any) => o.id === id);
    expect(found.deliveryPartner?.name).toBe('Rider X');
    expect(found.deliveryTracking?.stage).toBe('assigned');
  });
});

describe('Open / closed scheduling', () => {
  it('reopens by itself once "closed until" passes, even when the manual switch is off', () => {
    const info = { ...store.cafeInfo, isOpen: false, closedUntil: '2026-10-01T05:30:00.000Z' };
    expect(isCafeAcceptingOrders(info, Date.parse('2026-10-01T05:00:00Z')).open).toBe(false);
    expect(isCafeAcceptingOrders(info, Date.parse('2026-10-01T06:00:00Z')).open).toBe(true);
    // manual close with no reopen time stays closed
    expect(isCafeAcceptingOrders({ ...info, closedUntil: null }).open).toBe(false);
  });

  it('rejects a reopen time without a timezone (would be read as UTC on the server)', async () => {
    const res = await request(app).put('/api/admin/cafe-info').set(auth()).send({ closedUntil: '2099-10-01T18:00' });
    expect(res.status).toBe(400);
  });

  it('blocks customer orders while closed but lets staff log a phone order', async () => {
    const until = new Date(Date.now() + 2 * 3600_000).toISOString();
    const put = await request(app).put('/api/admin/cafe-info').set(auth())
      .send({ isOpen: false, closedUntil: until, closedReason: 'Closed for Diwali' });
    expect(put.status).toBe(200);

    const customer = await request(app).post('/api/orders').send(teaOrder('9500000106'));
    expect(customer.status).toBe(403);
    expect(customer.body.error).toBe('Closed for Diwali');
    expect(customer.body.reopensAt).toBe(until);

    const staff = await request(app).post('/api/orders').set(auth()).send(teaOrder('9500000107'));
    expect(staff.status).toBe(201);
  });

  it('cafe-info ignores unknown fields', async () => {
    await request(app).put('/api/admin/cafe-info').set(auth()).send({ isAdmin: true, name: 'Out of the Town' });
    expect((store.cafeInfo as any).isAdmin).toBeUndefined();
  });
});

describe('India time on a UTC server', () => {
  afterEach(() => vi.useRealTimers());

  const booking = { customerName: 'T Test', customerPhone: '9828919626', customerEmail: 'a@b.com', guestCount: 2 };

  it('uses the Jaipur calendar day, not the UTC one', () => {
    // 01:30 IST on 29 Sep is still 28 Sep in UTC -- the 28th must count as the past.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T20:00:00Z'));
    expect(restaurantDateString()).toBe('2026-09-29');
    expect(CreateReservationSchema.safeParse({ ...booking, date: '2026-09-28', time: '07:30 PM' }).success).toBe(false);
  });

  it('rejects a slot earlier today (IST) and accepts a later one', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T15:00:00Z')); // 8:30 PM IST
    expect(CreateReservationSchema.safeParse({ ...booking, date: '2026-09-28', time: '07:30 PM' }).success).toBe(false);
    expect(CreateReservationSchema.safeParse({ ...booking, date: '2026-09-28', time: '09:00 PM' }).success).toBe(true);
  });

  it('rejects impossible dates and bookings more than 90 days out', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T06:00:00Z'));
    expect(CreateReservationSchema.safeParse({ ...booking, date: '2026-02-31', time: '07:30 PM' }).success).toBe(false);
    expect(CreateReservationSchema.safeParse({ ...booking, date: '2027-01-15', time: '07:30 PM' }).success).toBe(false);
    expect(CreateReservationSchema.safeParse({ ...booking, date: '2026-12-20', time: '07:30 PM' }).success).toBe(true);
  });

  it('shows rider arrival times in IST', () => {
    expect(formatRestaurantTime(new Date('2026-09-28T14:45:00Z'))).toBe('08:15 PM');
  });
});

describe('Customer accounts are matched by phone, not the unverified email', () => {
  it("signing in with someone else's email does not reveal their orders", async () => {
    await request(app).post('/api/orders').send(teaOrder('9500000201', { customerEmail: 'victim@example.com' }));
    const payload = { email: 'victim@example.com', phone: '9500000202', name: 'Attacker' };
    const sent = await request(app).post('/api/auth/customer/send-otp').send(payload);
    const verified = await request(app).post('/api/auth/customer/verify-otp').send({ ...payload, otp: sent.body.otpPreview });
    const mine = await request(app).get('/api/user/orders').set('Authorization', `Bearer ${verified.body.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(0);
  });
});
