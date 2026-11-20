/**
 * Fungsi datar `/api` — tujuan rewrite berbentuk `/api?__path=<path asli>`.
 *
 * MENGAPA PERLU BERKAS SENDIRI
 * Tujuan rewrite `/api` hanya dilayani berkas `api/index.js`. Tanpa berkas ini
 * Vercel tidak menemukan fungsi untuk tujuan tersebut dan permintaan jatuh ke
 * aturan SPA — crawler menerima kartu beranda, bukan kartu produk.
 * (Tujuan `/api?__path=` juga tidak boleh menggantikan berkas nyata: rewrite
 * yang tujuannya bertabrakan dengan berkas statis tidak diterapkan.)
 */
export { default, config } from '../server/vercel-handler.js';
