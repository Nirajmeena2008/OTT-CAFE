import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Backend API capacity metrics
const errorRate = new Rate('api_errors');
const responseTimeTrend = new Trend('api_response_time');
const successfulRequests = new Counter('successful_api_requests');
const server5xxErrors = new Counter('server_5xx_errors');
const connectionErrors = new Counter('connection_resets');

const API_URL = __ENV.API_URL || 'https://api.ottcafe.in';

export const options = {
  // Stepped ramp-up to find the backend API's maximum capacity limit
  stages: [
    { duration: '15s', target: 50 },   // 50 VUs
    { duration: '20s', target: 150 },  // 150 VUs
    { duration: '20s', target: 300 },  // 300 VUs
    { duration: '25s', target: 500 },  // 500 VUs
    { duration: '15s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.10'],
  },
};

export default function () {
  const headers = {
    'User-Agent': 'k6-api-tester/1.0',
    'Accept': 'application/json',
  };

  const res = http.get(`${API_URL}/health`, {
    headers,
    timeout: '8s',
    tags: { name: 'API_Health' },
  });

  responseTimeTrend.add(res.timings.duration);

  const isOk = res.status === 200;
  if (isOk) {
    successfulRequests.add(1);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'status is ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
    });
  } else {
    if (res.status >= 500) {
      server5xxErrors.add(1);
    } else if (res.status === 0) {
      connectionErrors.add(1);
    }
  }

  errorRate.add(!isOk);

  // High-frequency pacing (0.1s - 0.3s) to push backend throughput limits
  sleep(0.1 + Math.random() * 0.2);
}
