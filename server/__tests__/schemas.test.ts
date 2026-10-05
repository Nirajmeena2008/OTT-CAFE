import { describe, it, expect } from 'vitest';
import {
  CustomerSendOtpSchema,
  CustomerVerifyOtpSchema,
  CreateOrderSchema,
  CreateReservationSchema,
  OrderItemSchema,
} from '../schemas';
import { restaurantDateString, addDaysToDateString } from '../time';

describe('CustomerSendOtpSchema — regression for the blank-optional-name bug', () => {
  it('accepts an empty string for the optional name field (this used to be rejected)', () => {
    const result = CustomerSendOtpSchema.safeParse({
      email: 'guest@example.com',
      phone: '9828919626',
      name: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts the name field being entirely absent', () => {
    const result = CustomerSendOtpSchema.safeParse({
      email: 'guest@example.com',
      phone: '9828919626',
    });
    expect(result.success).toBe(true);
  });

  it('still rejects a name that is a single character (genuinely too short, not just blank)', () => {
    const result = CustomerSendOtpSchema.safeParse({
      email: 'guest@example.com',
      phone: '9828919626',
      name: 'X',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing phone', () => {
    const result = CustomerSendOtpSchema.safeParse({ email: 'guest@example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = CustomerSendOtpSchema.safeParse({ email: 'not-an-email', phone: '9828919626' });
    expect(result.success).toBe(false);
  });
});

describe('CustomerVerifyOtpSchema', () => {
  it('accepts a blank name (same fix as send-otp)', () => {
    const result = CustomerVerifyOtpSchema.safeParse({
      email: 'guest@example.com',
      phone: '9828919626',
      otp: '123456',
      name: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an OTP that is not exactly 6 digits', () => {
    expect(CustomerVerifyOtpSchema.safeParse({ email: 'a@b.com', phone: '9828919626', otp: '12345' }).success).toBe(false);
    expect(CustomerVerifyOtpSchema.safeParse({ email: 'a@b.com', phone: '9828919626', otp: '1234567' }).success).toBe(false);
  });
});

describe('OrderItemSchema — boundary values', () => {
  const base = { menuItemId: 'ott-tea-1', name: 'Tea', price: 50, isVeg: true, image: 'x' };

  it('accepts quantity at the minimum boundary (1)', () => {
    expect(OrderItemSchema.safeParse({ ...base, quantity: 1 }).success).toBe(true);
  });
  it('rejects quantity 0', () => {
    expect(OrderItemSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
  });
  it('rejects negative quantity', () => {
    expect(OrderItemSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });
  it('accepts quantity at the maximum boundary (50)', () => {
    expect(OrderItemSchema.safeParse({ ...base, quantity: 50 }).success).toBe(true);
  });
  it('rejects quantity above the maximum (51)', () => {
    expect(OrderItemSchema.safeParse({ ...base, quantity: 51 }).success).toBe(false);
  });
  it('rejects a non-positive price', () => {
    expect(OrderItemSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
    expect(OrderItemSchema.safeParse({ ...base, price: -50 }).success).toBe(false);
  });
});

describe('CreateOrderSchema — business rules', () => {
  const item = { menuItemId: 'ott-tea-1', name: 'Tea', price: 50, quantity: 1, isVeg: true, image: 'x' };

  it('requires a delivery address when orderType is delivery', () => {
    const result = CreateOrderSchema.safeParse({
      customerName: 'Test', customerPhone: '9828919626', orderType: 'delivery', items: [item],
    });
    expect(result.success).toBe(false);
  });

  it('requires a table number when orderType is dine-in', () => {
    const result = CreateOrderSchema.safeParse({
      customerName: 'Test', customerPhone: '9828919626', orderType: 'dine-in', items: [item],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid pickup order with no address/table required', () => {
    const result = CreateOrderSchema.safeParse({
      customerName: 'Test', customerPhone: '9828919626', orderType: 'pickup', items: [item],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an order with zero items', () => {
    const result = CreateOrderSchema.safeParse({
      customerName: 'Test', customerPhone: '9828919626', orderType: 'pickup', items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateReservationSchema — regression for the past-date bug', () => {
  const base = {
    customerName: 'Test', customerPhone: '9828919626', customerEmail: 'a@b.com', time: '19:00', guestCount: 2,
  };

  it('rejects a date in the past (this used to be silently accepted)', () => {
    const result = CreateReservationSchema.safeParse({ ...base, date: '2020-01-01' });
    expect(result.success).toBe(false);
  });

  it("accepts today's date for a slot later today", () => {
    const result = CreateReservationSchema.safeParse({ ...base, date: restaurantDateString(), time: '11:59 PM' });
    expect(result.success).toBe(true);
  });

  it('accepts a future date', () => {
    const result = CreateReservationSchema.safeParse({ ...base, date: addDaysToDateString(restaurantDateString(), 10) });
    expect(result.success).toBe(true);
  });

  it('rejects zero guests', () => {
    expect(CreateReservationSchema.safeParse({ ...base, date: addDaysToDateString(restaurantDateString(), 10), guestCount: 0 }).success).toBe(false);
  });

  it('rejects more than 20 guests', () => {
    expect(CreateReservationSchema.safeParse({ ...base, date: addDaysToDateString(restaurantDateString(), 10), guestCount: 21 }).success).toBe(false);
  });
});
