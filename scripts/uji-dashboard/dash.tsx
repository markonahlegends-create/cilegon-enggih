import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { StoreProvider } from '../../src/context/StoreContext';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { AdminDashboardPage } from '../../src/pages/AdminDashboardPage';

const balas = (data: any, status = 200) => ({
  ok: status < 400, status, headers: { get: () => 'application/json' },
  json: async () => data, text: async () => JSON.stringify(data)
});

/* MODE=0: /api/diagnose mengembalikan 200 TANPA summary (biang keroknya)
   MODE=1: normal */
const MODE = Number((globalThis as any).__MODE__ ?? 0);

(globalThis as any).fetch = async (url: any) => {
  const u = String(url);
  if (u.includes('/api/diagnose')) {
    return MODE === 0
      ? balas({ ready: true, checks: [], storage: 'supabase', generatedAt: '2026-01-01T00:00:00Z', note: '' })
      : balas({ ready: true, summary: { ok: 16, warn: 0, fail: 1 }, checks: [], storage: 'supabase', generatedAt: '2026-01-01T00:00:00Z', note: 'x' });
  }
  if (u.includes('/api/admin/session')) return balas({ ok: true, admin: true });
  if (u.includes('/api/admin/analytics')) return balas({ ok: true, analytics: { totalRevenue: 0, totalOrders: 0, totalRevenueToday: 0, itemsSold: 0, unpaidOrders: 0, cancelledOrders: 0, paidOrders: 0, topProducts: [], dailyRevenue: [] } });
  if (u.includes('/api/admin/orders')) {
    /*
     * MODE 2: bentuk pesanan CACAT (bukan array). Ini menguji pembungkus tab
     * "Pesanan" — bukan HealthCheckPanel. Dulu satu galat seperti ini
     * mematikan seluruh dashboard.
     */
    if (MODE === 2) return balas({ ok: true, orders: { rusak: true } });
    return balas({ ok: true, orders: [] });
  }
  if (u.includes('/api/admin/b2b')) return balas({ ok: true, inquiries: [] });
  if (u.includes('/api/admin/products')) return balas({ ok: true, products: [] });
  if (u.includes('/api/admin/vendors')) return balas({ ok: true, vendors: [] });
  if (u.includes('/api/admin/settings')) return balas({ ok: true, settings: { storeName: 'Cilegon Enggih', telegram: {}, banks: [], vouchers: [], whatsappApi: {}, payment: {}, ongkir: {}, qris: {}, invoice: {}, preOrder: {} } });
  if (u.includes('/api/settings')) return balas({ ok: true, settings: { storeName: 'Cilegon Enggih' } });
  return balas({ ok: true });
};

(async () => {
  const wadah = document.getElementById('root')!;
  const root = createRoot(wadah);
  const galat: string[] = [];
  const asli = console.error;
  console.error = (...a: any[]) => galat.push(a.map(String).join(' '));

  await act(async () => {
    root.render(
      React.createElement(ErrorBoundary, { bagian: 'aplikasi' },
        React.createElement(StoreProvider, null, React.createElement(AdminDashboardPage)))
    );
  });
  for (let i = 0; i < 30; i++) await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  console.error = asli;

  /* MODE 2: buka tab Pesanan, tempat data cacat dirender. */
  if (MODE === 2) {
    const tombol = [...wadah.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes('Pesanan')
    );
    console.log('TOMBOL TAB PESANAN DITEMUKAN:', Boolean(tombol));
    if (tombol) {
      await act(async () => {
        tombol.dispatchEvent(new (globalThis as any).window.MouseEvent('click', { bubbles: true }));
      });
      for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    }
  }

  /*
   * Toast dirender lewat portal ke document.body, BUKAN ke dalam #root —
   * mencari pesannya di wadah akan selalu kosong. Pakai seluruh body.
   */
  const teks = document.body.textContent || '';
  if (galat.length) console.log('CONTOH GALAT REACT:', galat[0].slice(0, 200).replace(/\n/g, ' '));
  console.log('MODE:', MODE);
  console.log('BOUNDARY GLOBAL AKTIF (halaman mati total):', teks.includes('Halaman ini gagal ditampilkan'));
  console.log('PANEL RINGKAS TAMPIL (panel gagal saja):', teks.includes('Bagian ini gagal ditampilkan'));
  console.log('PESAN DI DALAM PANEL:', teks.includes('Status konfigurasi tidak terbaca'));
  /*
   * Kendali mutu: pada MODE 2, data pesanan berbentuk salah harus DILAPORKAN
   * ke admin — bukan hilang diam-diam. Toast yang menyebut "pesanan" adalah
   * buktinya. Tanpa ini, admin melihat daftar kosong dan menyangka tidak ada
   * pesanan.
   */
  console.log(
    'PESAN DATA GAGAL DIMUAT:',
    /Sebagian data tidak bisa dimuat/i.test(teks) && /pesanan/i.test(teks)
  );
  console.log('DASHBOARD MASIH HIDUP:', teks.includes('Kesiapan Go-Live') || teks.includes('Total Omzet') || teks.includes('Pesanan'));
  console.log('GALAT REACT:', galat.filter((g) => !/deprecated/i.test(g)).length);
  if (MODE === 2) console.log('CUPLIKAN TEKS:', teks.slice(0, 600).replace(/\s+/g, ' '));
  process.exit(0);
})();
