import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const server5xxErrors = new Counter('server_5xx_errors');
const connectionErrors = new Counter('connection_errors');
const successfulRequests = new Counter('successful_requests');

const BASE_URL = __ENV.BASE_URL || 'https://ottcafe.in';

export const options = {
  // Push toward the ultimate breaking limit: 500 -> 800 -> 1200 -> 1500 VUs
  stages: [
    { duration: '15s', target: 500 },   // 500 VUs
    { duration: '20s', target: 800 },   // 800 VUs
    { duration: '25s', target: 1200 },  // 1200 VUs
    { duration: '25s', target: 1500 },  // 1500 VUs
    { duration: '15s', target: 0 },     // Ramp-down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.10'], // Monitor if errors exceed 10%
  },
};

export default function () {
  const headers = {
    'User-Agent': 'k6-stress-tester/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  const routes = ['/', '/menu', '/book-table', '/track-order', '/contact'];
  const targetRoute = routes[Math.floor(Math.random() * routes.length)];

  const res = http.get(`${BASE_URL}${targetRoute}`, {
    headers,
    timeout: '10s',
    tags: { name: 'Route_Request' },
  });

  responseTimeTrend.add(res.timings.duration);

  const isOk = res.status === 200;
  if (isOk) {
    successfulRequests.add(1);
  } else {
    if (res.status >= 500) {
      server5xxErrors.add(1);
    } else if (res.status === 0) {
      connectionErrors.add(1); // timeout or network reset
    }
  }

  errorRate.add(!isOk);

  // Think time between customer actions (0.2s - 0.6s)
  sleep(0.2 + Math.random() * 0.4);
}
