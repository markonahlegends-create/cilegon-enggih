/**
 * Audit responsif dengan browser sungguhan (headless Chrome).
 *
 * CARA PAKAI (jalankan server dulu di port 3100):
 *   npx puppeteer-core   # perlu chrome/chromium terpasang
 *   node scripts/audit-mobile.cjs
 *
 * Skrip ini mengukur lebar dokumen vs viewport di 4 ukuran layar HP
 * (280, 320, 360, 390 px) pada 6 halaman utama, lalu melaporkan elemen
 * yang melewati batas layar. Dipakai untuk memastikan tidak ada halaman
 * yang bisa digeser ke samping di HP.
 *
 * CATATAN: path chrome di bawah mengikuti lingkungan pengembangan saat
 * skrip dibuat. Sesuaikan `executablePath` (atau set env CHROME_PATH)
 * dengan lokasi Chrome di komputer Anda.
 */
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');

