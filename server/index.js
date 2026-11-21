/**
 * Entry server lokal / self-host Info Kelurahan.
 * Bind 0.0.0.0 agar bisa dipreview dari browser sandbox.
 */
import './env.js';
import { createApp } from './app.js';
import { store, storageInfo } from './db.js';
import { ADMIN_PASSWORD, IS_DEV_PASSWORD } from './auth.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.BIND_HOST || '0.0.0.0';

const app = createApp();

store
  .init()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`[Info Kelurahan] API + SPA siap di http://${HOST}:${PORT}`);
      console.log(`[Info Kelurahan] Penyimpanan: ${storageInfo.mode}${storageInfo.supabase ? ` (Supabase: ${storageInfo.table})` : ''}`);
      console.log(`[Info Kelurahan] Admin: /admin — login "admin" / password ${
        process.env.ADMIN_PASSWORD ? 'dari ADMIN_PASSWORD' : IS_DEV_PASSWORD ? `DEV: ${ADMIN_PASSWORD}` : '—'
      }`);
    });
  })
  .catch((error) => {
    console.error('[Info Kelurahan] Gagal init database:', error);
    process.exit(1);
  });
