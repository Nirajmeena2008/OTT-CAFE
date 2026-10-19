import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom performance metrics
const errorRate = new Rate('errors');
const pageLoadTrend = new Trend('homepage_load_duration');
const assetLoadTrend = new Trend('assets_load_duration');
const spaRouteTrend = new Trend('spa_route_duration');
const http2Counter = new Counter('http2_requests');

// Target URLs (configurable via environment variables)
const BASE_URL = __ENV.BASE_URL || 'https://ottcafe.in';
const API_URL = __ENV.API_URL || 'https://api.ottcafe.in';
const TEST_API = __ENV.TEST_API === 'true';

export const options = {
  stages: [
    { duration: '20s', target: 5 },   // Ramp-up to 5 VUs
    { duration: '40s', target: 25 },  // Ramp-up to 25 VUs
    { duration: '40s', target: 50 },  // Peak sustained load at 50 VUs
    { duration: '20s', target: 0 },   // Ramp-down to 0 VUs
  ],
  thresholds: {
    // 95% of HTML page and SPA navigation requests under 1000ms
    'homepage_load_duration': ['p(95)<1000', 'p(99)<2000'],
    'spa_route_duration': ['p(95)<1000', 'p(99)<2000'],
    // 95% of asset requests under 2500ms
    'assets_load_duration': ['p(95)<2500'],
    // Error rate must remain under 2%
    'http_req_failed': ['rate<0.02'],
    'errors': ['rate<0.02'],
  },
};

export default function () {
  const commonHeaders = {
    'User-Agent': 'k6-load-tester/1.0 (OTT-CAFE Performance Verification)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  // Group 1: Landing Page Load (Simulates browser navigation to root)
  group('01_Homepage_Load', () => {
    const res = http.get(`${BASE_URL}/`, { headers: commonHeaders, tags: { name: 'Homepage' } });
    pageLoadTrend.add(res.timings.duration);

    const checkSuccess = check(res, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage content has root container': (r) => r.body && r.body.includes('id="root"'),
      'homepage content has title': (r) => r.body && r.body.includes('Out of the Town'),
    });

    if (res.proto === 'HTTP/2.0' || res.proto === 'h2') {
      http2Counter.add(1);
    }
    errorRate.add(!checkSuccess);
  });

  // Group 2: Static Assets
  // In real browser behavior, static assets are cached. ~25% of requests represent cold-cache visitors.
  const isColdVisitor = Math.random() < 0.25;
  if (isColdVisitor) {
    sleep(0.3);
    group('02_Static_Assets_Load', () => {
      const responses = http.batch([
        ['GET', `${BASE_URL}/ott-logo.svg`, null, { tags: { name: 'Asset_Logo' } }],
        ['GET', `${BASE_URL}/assets/index-Be6qe4mQ.css`, null, { tags: { name: 'Asset_CSS' } }],
        ['GET', `${BASE_URL}/assets/index-CLbM9srD.js`, null, { tags: { name: 'Asset_MainJS' } }],
      ]);

      for (const res of responses) {
        assetLoadTrend.add(res.timings.duration);
        const ok = check(res, {
          'asset status is 200': (r) => r.status === 200,
          'asset is not empty': (r) => r.body && r.body.length > 0,
        });
        errorRate.add(!ok);
      }
    });
  }

  // Realistic human think time between clicks (0.5s - 1.5s)
  sleep(0.5 + Math.random());

  // Group 3: SPA Route Navigation (Simulates customer browsing different pages)
  group('03_SPA_Routes_Navigation', () => {
    const spaRoutes = ['/menu', '/book-table', '/track-order', '/contact'];
    const selectedRoute = spaRoutes[Math.floor(Math.random() * spaRoutes.length)];

    const res = http.get(`${BASE_URL}${selectedRoute}`, {
      headers: commonHeaders,
      tags: { name: 'SPA_Route' },
    });

    spaRouteTrend.add(res.timings.duration);
    const ok = check(res, {
      'spa route returns 200': (r) => r.status === 200,
      'spa route serves SPA index shell': (r) => r.body && r.body.includes('id="root"'),
    });
    errorRate.add(!ok);
  });

  // Group 4: Optional API Health check (paced)
  if (TEST_API) {
    sleep(0.5);
    group('04_API_Health', () => {
      const res = http.get(`${API_URL}/api/health`, {
        headers: { 'Accept': 'application/json' },
        tags: { name: 'API_Health' },
      });
      const ok = check(res, {
        'api health status is 200': (r) => r.status === 200,
        'api health status is ok': (r) => {
          try {
            return JSON.parse(r.body).status === 'ok';
          } catch {
            return false;
          }
        },
      });
      errorRate.add(!ok);
    });
  }

  // Inter-iteration delay
  sleep(0.5 + Math.random());
}
