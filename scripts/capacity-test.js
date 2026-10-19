import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Capacity & Breakpoint metrics
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const serverErrors = new Counter('server_5xx_errors');
const rateLimitErrors = new Counter('rate_limited_429');
const successfulRequests = new Counter('successful_requests');

const BASE_URL = __ENV.BASE_URL || 'https://ottcafe.in';

export const options = {
  // Stepped ramp-up to determine capacity limits & breaking point
  stages: [
    { duration: '20s', target: 50 },   // Tier 1: 50 concurrent users
    { duration: '20s', target: 100 },  // Tier 2: 100 concurrent users
    { duration: '25s', target: 200 },  // Tier 3: 200 concurrent users
    { duration: '25s', target: 350 },  // Tier 4: 350 concurrent users
    { duration: '25s', target: 500 },  // Tier 5: 500 concurrent users
    { duration: '15s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // We observe where failures start occurring
    'http_req_failed': ['rate<0.05'],
  },
};

export default function () {
  const headers = {
    'User-Agent': 'k6-capacity-tester/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  // 1. Customer visits homepage
  const resHome = http.get(`${BASE_URL}/`, { headers, tags: { name: 'Home' } });
  responseTimeTrend.add(resHome.timings.duration);

  let success = check(resHome, {
    'home status is 200': (r) => r.status === 200,
  });

  if (resHome.status >= 500) serverErrors.add(1);
  if (resHome.status === 429) rateLimitErrors.add(1);
  if (resHome.status === 200) successfulRequests.add(1);
  errorRate.add(!success);

  // Think time between browsing actions (simulating real user interaction)
  sleep(0.3 + Math.random() * 0.5);

  // 2. Customer navigates to a section (Menu, Booking, Contact, etc.)
  const routes = ['/menu', '/book-table', '/track-order', '/contact'];
  const targetRoute = routes[Math.floor(Math.random() * routes.length)];
  const resRoute = http.get(`${BASE_URL}${targetRoute}`, { headers, tags: { name: 'Route' } });
  responseTimeTrend.add(resRoute.timings.duration);

  success = check(resRoute, {
    'route status is 200': (r) => r.status === 200,
  });

  if (resRoute.status >= 500) serverErrors.add(1);
  if (resRoute.status === 429) rateLimitErrors.add(1);
  if (resRoute.status === 200) successfulRequests.add(1);
  errorRate.add(!success);

  sleep(0.3 + Math.random() * 0.5);
}
