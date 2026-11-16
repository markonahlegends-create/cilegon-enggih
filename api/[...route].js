/**
 * Vercel Serverless Function (catch-all).
 * Vercel: `api/[...route].js` menangkap seluruh /api/* dan meneruskannya ke core.
 * Deploy: set env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ADMIN_PASSWORD.
 */
import { dispatch } from '../server/core.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  const result = await dispatch({
    method: req.method,
    path: req.url || '/',
    query: req.query || {},
    body: req.body,
    headers: req.headers
  });

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
