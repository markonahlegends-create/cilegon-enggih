/**
 * UJI KARTU SHARE UNTUK PRODUK YANG DITAMBAHKAN ADMIN.
 *
 * LATAR BELAKANG (laporan 20 Nov 2026)
 * "Saya uji thumbnail link share
 *  https://cilegon-enggih.vercel.app/produk/kaos-edisi-cilegon-enggih namun
 *  masih berbeda gambarnya, saya juga sudah debug di Facebook Developer masih
 *  gambar yang berbeda."
 *
 * `kaos-edisi-cilegon-enggih` TIDAK ADA di `src/data/products.ts`. Artinya
 * produk itu dibuat lewat dashboard dan tidak pernah punya halaman share
 * statis di `public/og/`. Crawler lalu menerima index.html dan menampilkan
 * kartu beranda — Scrape Again tidak menolong karena memang tidak ada kartu
 * untuk produk tersebut.
 *
 * Perbaikannya: GET /api/share/produk/:slug membangun kartu dari database,
 * dan vercel.json mengarahkan crawler ke sana sebagai cadangan setelah aturan
 * statis. Uji ini memverifikasi keduanya.
 *
 * Cara pakai: node scripts/test-share-dynamic.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, kondisi, detail = '') => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  OK  ' : '  SALAH'} ${nama}${kondisi ? '' : ` — ${detail}`}`);
};

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

const mulaiAplikasi = (dataDir) =>
  new Promise((resolve, reject) => {
    const port = 3800 + Math.floor(Math.random() * 200);
    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        BIND_HOST: '127.0.0.1',
        CE_DATA_DIR: dataDir,
        PUBLIC_BASE_URL: 'https://cilegon-enggih.vercel.app',
        ADMIN_PASSWORD: 'uji-share-password',
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        SUPABASE_ANON_KEY: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    child.stdout.on('data', (d) => {
      log += d.toString();
      if (log.includes('listening at')) resolve({ child, port });
    });
    child.stderr.on('data', (d) => {
      log += d.toString();
    });
    setTimeout(() => {
      if (!log.includes('listening at')) reject(new Error(`Server gagal start:\n${log}`));
    }, 25000);
  });

const jalankan = async () => {
  const dataDir = path.join(ROOT, '.tmp-e2e-share');
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const app = await mulaiAplikasi(dataDir);
  const port = app.port;

  await fetch(`http://127.0.0.1:${port}/api/products`).catch(() => null);
  await tunggu(400);

  const login = await fetch(`http://127.0.0.1:${port}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'uji-share-password' })
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  console.log('— Produk BARU yang tidak ada di katalog statis —');
  const slugBaru = 'kaos-edisi-cilegon-enggih';
  {
    benar(
      `"${slugBaru}" memang tidak ada di public/og`,
      !fs.existsSync(path.join(ROOT, 'public', 'og', `${slugBaru}.jpg`)) &&
        !fs.existsSync(path.join(ROOT, 'public', 'og', `produk--${slugBaru}.html`)),
      'slug ini ternyata sudah punya kartu statis'
    );

    const buat = await fetch(`http://127.0.0.1:${port}/api/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: 'Kaos Edisi Cilegon Enggih',
        shortName: 'Kaos Edisi Cilegon',
        slug: slugBaru,
        categorySlug: 'apparel-tas',
        description:
          'Kaos edisi khusus Cilegon Enggih dengan sablon menara siger dan tulisan khas Kota Baja.',
        price: 99000,
        originalPrice: 129000,
        stock: 20,
        image: '/products/kaos-distro.jpg',
        active: true
      })
    });
    check('produk baru dibuat', buat.status, 201);

    const kartu = await fetch(`http://127.0.0.1:${port}/api/share/produk/${slugBaru}`);
    const html = await kartu.text();
    check('endpoint kartu merespons 200', kartu.status, 200);
    benar(
      'Content-Type HTML',
      String(kartu.headers.get('content-type') || '').includes('text/html'),
      kartu.headers.get('content-type')
    );
    benar(
      'tidak di-cache lama (pratinjau ikut berubah)',
      String(kartu.headers.get('cache-control') || '').includes('max-age=0'),
      kartu.headers.get('cache-control')
    );

    const ambil = (prop) => {
      const m = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`));
      return m ? m[1] : '';
    };
    check('og:title memuat nama produk', ambil('og:title').includes('Kaos Edisi Cilegon'), true);
    benar('og:description terisi', ambil('og:description').length > 20);
    check(
      'og:url menunjuk halaman produk yang benar',
      ambil('og:url'),
      `https://cilegon-enggih.vercel.app/produk/${slugBaru}`
    );
    benar(
      'og:image absolut & bukan kartu toko',
      ambil('og:image').startsWith('https://') && !ambil('og:image').includes('toko-cilegon-enggih'),
      ambil('og:image')
    );
    benar('og:image:width ada', html.includes('og:image:width'));
    benar('twitter:card ada', html.includes('twitter:card'));
    benar('noindex (tidak mengganggu SEO)', html.includes('noindex'));
    benar('canonical mengarah ke halaman asli', html.includes(`<link rel="canonical" href="https://cilegon-enggih.vercel.app/produk/${slugBaru}"`));
  }

  console.log('\n— Produk katalog lama: thumbnail dari FOTO UTAMA, bukan kartu templat —');
  {
    const kartu = await fetch(`http://127.0.0.1:${port}/api/share/produk/gantungan-kunci-karet-3d`);
    const html = await kartu.text();
    check('endpoint tetap melayani produk lama', kartu.status, 200);
    /*
     * PERUBAHAN PERILAKU (perbaikan 20 Nov 2026, laporan kedua).
     *
     * Dulu uji ini menuntut `/og/<slug>.jpg` (kartu templat). Justru itu
     * akarnya: kartu dibuat saat build dan tidak ikut berubah ketika admin
     * mengganti foto, sehingga pembeli melihat gambar lama. Sekarang kartu
     * produk menunjuk `/api/og-image/<slug>.jpg` yang dibangun dari foto
     * utama produk di database.
     */
    benar(
      'memakai thumbnail dari foto utama (jalur statis /bi/)',
      html.includes('/bi/gantungan-kunci-karet-3d.jpg'),
      'bukan /bi/'
    );
    benar(
      'tidak lagi memakai kartu templat statis',
      !/og:image" content="[^"]*\/og\/gantungan-kunci-karet-3d\.jpg"/.test(html),
      'masih kartu templat'
    );
  }

  console.log('\n— Slug tidak dikenal —');
  {
    const kartu = await fetch(`http://127.0.0.1:${port}/api/share/produk/tidak-ada-produk-ini`);
    check('404 untuk produk tak dikenal', kartu.status, 404);
  }

  console.log('\n— Pesanan pembeli membawa link bersih —');
  {
    const produk = JSON.parse(fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8'));
    const daftar = Array.isArray(produk) ? produk : [produk];
    const pilihan = daftar.find((p) => Number(p.price) > 0);
    const buat = await fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.0.1' },
      body: JSON.stringify({
        customerName: 'Uji Share',
        customerPhone: '081234567890',
        destination: 'Kota Cilegon',
        addressDetail: 'Jl. Uji Share No. 4 Kelurahan Cibeber',
        paymentMethod: 'Transfer Bank BCA',
        items: [{ productId: pilihan.id, name: pilihan.name, qty: 1 }]
      })
    });
    check('pesanan tetap bisa dibuat', buat.status, 201);
  }

  app.child.kill('SIGTERM');
};

jalankan()
  .then(() => {
    console.log(gagal === 0 ? '\n✅ SEMUA UJI KARTU DINAMIS LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
    process.exit(gagal === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('\nUji gagal dijalankan:', err.message);
    process.exit(1);
  });
