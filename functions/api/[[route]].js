/**
 * Cloudflare Pages Function — proxy /api/* ke backend Cilegon Enggih.
 *
 * Arsitektur yang direkomendasikan (dan paling murah):
 *   • Frontend statis  → Cloudflare Pages (bandwidth unlimited, gratis)
 *   • Backend API      → Vercel Serverless (api/[...route].js) + Supabase Postgres
 *
 * Cloudflare Pages Functions tidak punya filesystem & lebih ketat soal Node API,
 * jadi daripada menduplikasi logika bisnis, function ini mem-proxy request ke
 * API backend (Node runtime) yang sama. Semua tetap 1 origin dari sisi browser
 * karena request /api/* diarahkan lewat sini.
 *
 * Setup: di Cloudflare Pages → Settings → Environment variables:
 *   API_ORIGIN = https://<project-vercel-anda>.vercel.app
 *
 * Kalau API_ORIGIN tidak diset, function mengembalikan pesan konfigurasi yang jelas
 * supaya tidak menimbulkan error misterius di UI.
 */
export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = (env.API_ORIGIN || '').replace(/\/+$/, '');

  const cors = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!origin) {
    return new Response(
      JSON.stringify({
        error:
          'Backend API belum dikonfigurasi. Set environment variable API_ORIGIN pada Cloudflare Pages (Settings → Environment variables) ke URL deployment Vercel Anda.',
        hint: 'Lihat DEPLOYMENT.md bagian "Opsi B — Cloudflare Pages + Vercel API".'
      }),
      {
        status: 503,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  const target = `${origin}${url.pathname}${url.search}`;
  const headers = new Headers();
  ['content-type', 'authorization', 'accept'].forEach((key) => {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  });

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text()
  });

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: {
      ...cors,
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
};
