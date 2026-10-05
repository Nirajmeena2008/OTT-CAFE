import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    // 100 users test
    { duration: '30s', target: 100 },
    { duration: '30s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% error rate
    errors: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

export function setup() {
  // Verify server is up
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { 'health check passed': (r) => r.status === 200 });

  // Get initial data
  const categories = http.get(`${BASE_URL}/api/categories`, { headers: commonHeaders });
  const banners = http.get(`${BASE_URL}/api/banners`, { headers: commonHeaders });
  const menu = http.get(`${BASE_URL}/api/menu`, { headers: commonHeaders });
  const cafeInfo = http.get(`${BASE_URL}/api/cafe-info`, { headers: commonHeaders });

  return {
    categories: categories.json().data || [],
    banners: banners.json().data || [],
    menuItems: menu.json().data || [],
    cafeInfo: cafeInfo.json().data || {},
  };
}

export default function (data) {
  const headers = { ...commonHeaders };

  // 1. Health check (lightweight)
  let res = http.get(`${BASE_URL}/api/health`, { headers });
  check(res, { 'health ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 2. Get cafe info
  res = http.get(`${BASE_URL}/api/cafe-info`, { headers });
  check(res, { 'cafe-info ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 3. Get categories
  res = http.get(`${BASE_URL}/api/categories`, { headers });
  check(res, { 'categories ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 4. Get promotional banners
  res = http.get(`${BASE_URL}/api/banners`, { headers });
  check(res, { 'banners ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 5. Get menu items (most data-intensive)
  res = http.get(`${BASE_URL}/api/menu`, { headers });
  check(res, { 'menu ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 6. Search menu (simulate user search)
  const searchTerms = ['paneer', 'chicken', 'pizza', 'burger', 'biryani', 'coffee', 'cake', 'bread', 'soup', 'salad'];
  const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  res = http.get(`${BASE_URL}/api/menu?search=${searchTerm}`, { headers });
  check(res, { 'menu search ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 7. Filter by category
  if (data.categories.length > 0) {
    const cat = data.categories[Math.floor(Math.random() * data.categories.length)];
    res = http.get(`${BASE_URL}/api/menu?category=${cat.slug}`, { headers });
    check(res, { 'menu category filter ok': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(0.1);
  }

  // 8. Filter veg only
  res = http.get(`${BASE_URL}/api/menu?isVeg=true`, { headers });
  check(res, { 'menu veg filter ok': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.1);

  // 9. Send OTP (simulate user login attempt - but we don't want to spam)
  // Only a small percentage of users will do this
  if (Math.random() < 0.05) {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const email = `test${Math.floor(Math.random() * 10000)}@example.com`;
    res = http.post(`${BASE_URL}/api/auth/customer/send-otp`, JSON.stringify({
      phone,
      email,
      name: 'Test User'
    }), { headers });
    check(res, { 'send-otp ok': (r) => r.status === 200 || r.status === 429 }) || errorRate.add(1);
  }

  sleep(1); // Think time between iterations
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}