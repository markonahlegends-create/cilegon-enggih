/**
 * Entry server lokal / self-host.
 * Bind default 0.0.0.0 supaya bisa dipreview dari browser sandbox.
 */
import { createApp } from './app.js';
import { store } from './db.js';
import { ADMIN_PASSWORD } from './core.js';

const PORT = Number(process.env.PORT) || 3001;
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

const app = createApp();

app.listen(PORT, BIND_HOST, () => {
  console.log(`[Cilegon Enggih] API + SPA listening at http://${BIND_HOST}:${PORT}`);
  console.log(`[Cilegon Enggih] Storage mode: ${store.mode}${store.dataDir ? ` (${store.dataDir})` : ''}`);
  console.log(
    `[Cilegon Enggih] Admin: /admin (user: admin, password: ${
      process.env.ADMIN_PASSWORD ? 'dari ADMIN_PASSWORD' : `default "${ADMIN_PASSWORD}"`
    })`
  );
});
