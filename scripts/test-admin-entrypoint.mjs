import { DEFAULT_DEV_PASSWORD } from '../server/auth.js';
import handler from '../api/index.js';

function response() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(body) {
      this.body = typeof body === 'string' ? JSON.parse(body) : body;
    },
  };
}

const loginRes = response();
await handler(
  {
    method: 'POST',
    url: '/api/index?path=%2Fapi%2Fadmin%2Flogin',
    headers: { host: 'localhost:5579' },
    body: { password: process.env.ADMIN_PASSWORD || DEFAULT_DEV_PASSWORD },
  },
  loginRes
);
if (loginRes.statusCode !== 200 || !loginRes.body?.token) {
  throw new Error(`Admin login entrypoint failed (HTTP ${loginRes.statusCode}).`);
}

const overviewRes = response();
await handler(
  {
    method: 'GET',
    url: '/api/index?path=%2Fapi%2Fadmin%2Foverview',
    headers: {
      host: 'localhost:5579',
      authorization: `Bearer ${loginRes.body.token}`,
    },
  },
  overviewRes
);
if (overviewRes.statusCode !== 200 || !overviewRes.body?.counts) {
  throw new Error(`Admin API query routing failed (HTTP ${overviewRes.statusCode}).`);
}

console.log('✓ Admin login and authenticated request work through the explicit Vercel API entrypoint.');
