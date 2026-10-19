import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const status200 = new Counter('status_200_count');
const status429 = new Counter('status_429_count');
const rateLimitedRatio = new Rate('rate_limited_ratio');

const API_URL = __ENV.API_URL || 'https://api.ottcafe.in';

export const options = {
  // Rapid burst of requests from a single IP to test the 10 req/s and 150 req/10min limiter
  scenarios: {
    rate_limit_probe: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 200,
      maxDuration: '30s',
    },
  },
};

export default function () {
  const res = http.get(`${API_URL}/api/health`, {
    headers: { 'Accept': 'application/json' },
  });

  if (res.status === 200) {
    status200.add(1);
    rateLimitedRatio.add(0);
  } else if (res.status === 429) {
    status429.add(1);
    rateLimitedRatio.add(1);
    check(res, {
      'rate limit triggered with 429': (r) => r.status === 429,
      'has retryAfter in response': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === false && body.retryAfterSeconds !== undefined;
        } catch {
          return false;
        }
      },
    });
  }

  // Small delay: ~50ms between requests (exceeds the 10 req/s rate limit to test enforcement)
  sleep(0.05);
}
