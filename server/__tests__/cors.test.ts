import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

// The site (ottcafe.in) and API (api.ottcafe.in) are separate origins, so every signed-in
// request is preflighted. If a header the frontend sends isn't allowed, the browser blocks the
// real request with no error in the API logs -- this is what broke reservations/orders.
describe('CORS for the split frontend/backend deployment', () => {
  it('preflight from an allowed origin permits the customer auth headers', async () => {
    const res = await request(app)
      .options('/api/reservations')
      .set('Origin', 'http://localhost:1350')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization,x-customer-token');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:1350');
    const allowed = res.headers['access-control-allow-headers'].toLowerCase();
    for (const h of ['content-type', 'authorization', 'x-customer-token']) {
      expect(allowed).toContain(h);
    }
  });

  it('does not grant CORS access to an unknown origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
