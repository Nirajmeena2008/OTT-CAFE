import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// ALLOWED_ORIGIN is read when app.ts loads, so set it before importing.
vi.stubEnv('ALLOWED_ORIGIN', 'https://ottcafe.in/, https://admin.example.com');
const { app } = await import('../app');

const allowed = async (origin: string) =>
  (await request(app).get('/api/health').set('Origin', origin)).headers['access-control-allow-origin'];

describe('ALLOWED_ORIGIN', () => {
  it('allows each listed origin and its www. variant', async () => {
    expect(await allowed('https://ottcafe.in')).toBe('https://ottcafe.in');
    expect(await allowed('https://www.ottcafe.in')).toBe('https://www.ottcafe.in');
    expect(await allowed('https://admin.example.com')).toBe('https://admin.example.com');
  });

  it('does not allow look-alike domains', async () => {
    expect(await allowed('https://ottcafe.in.evil.com')).toBeUndefined();
    expect(await allowed('https://evilottcafe.in')).toBeUndefined();
    expect(await allowed('http://ottcafe.in')).toBeUndefined();
  });
});
