/**
 * Vercel Serverless Function (catch-all `/api/*`).
 * Seluruh logika ada di `server/vercel-handler.js` — satu sumber untuk semua
 * titik masuk di folder `api/`.
 */
export { default, config } from '../server/vercel-handler.js';
