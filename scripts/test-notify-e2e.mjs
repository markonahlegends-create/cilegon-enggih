/**
 * UJI UJUNG-KE-UJUNG: pesanan masuk → notifikasi Telegram → bukti transfer → tombol.
 *
 * KENAPA UJI INI ADA
 * Laporan lapangan: bot mengirim "Total: Rp 0", dan setelah pembeli mengunggah
 * bukti transfer TIDAK ADA notifikasi atau tombol apa pun yang masuk ke chat
 * bot. Dua hal itu tidak bisa diperiksa dari unit test template saja — harus
 * dijalankan lewat HTTP sungguhan, dengan Telegram tiruan yang mencatat setiap
 * request.
 *
 * Uji ini:
 *   1. menyalakan server tiruan Telegram (mencatat isi sendMessage);
 *   2. menyalakan server Cilegon Enggih sungguhan di port acak;
 *   3. membuat pesanan lewat POST /api/orders;
 *   4. mengunggah bukti lewat POST /api/orders/:id/proof;
 *   5. memeriksa isi pesan + tombol yang benar-benar dikirim.
 *
 * Cara pakai: node scripts/test-notify-e2e.mjs
 */
import http from 'node:http';
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
const benar = (nama, kondisi) => check(nama, Boolean(kondisi), true);

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

/** Server tiruan Bot API: mencatat semua permintaan masuk. */
const mulaiTelegramTiruan = () =>
  new Promise((resolve) => {
    const pesan = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let parsed = {};
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch {
          parsed = { raw: body };
        }
        const metode = req.url.split('/').pop();
        pesan.push({ metode, ...parsed });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: { message_id: pesan.length } }));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, pesan, port: server.address().port }));
  });

/** Jalankan server aplikasi dengan data terpisah supaya tidak mengotori data asli. */
const mulaiAplikasi = (dataDir, telegramBase) =>
  new Promise((resolve, reject) => {
    const port = 3200 + Math.floor(Math.random() * 300);
    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        BIND_HOST: '127.0.0.1',
        CE_DATA_DIR: dataDir,
        TELEGRAM_API_BASE: telegramBase,
        TELEGRAM_WEBHOOK_SECRET: 'rahasia-uji-e2e-32-karakter-acak-panjang',
        ADMIN_PASSWORD: 'uji-e2e-password',
        // Supabase dimatikan agar uji memakai JSON lokal & tidak menyentuh produksi.
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        SUPABASE_ANON_KEY: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    const selesai = (ok) => {
      if (ok) resolve({ child, port, log: () => log });
      else reject(new Error(`Server gagal start:\n${log}`));
    };
    child.stdout.on('data', (d) => {
      log += d.toString();
      if (log.includes('listening at')) selesai(true);
    });
    child.stderr.on('data', (d) => {
      log += d.toString();
    });
    child.on('exit', (code) => {
      if (!log.includes('listening at')) selesai(false);
      void code;
    });
    setTimeout(() => {
      if (!log.includes('listening at')) selesai(false);
    }, 25000);
  });

const post = async (port, jalur, body, headers = {}) => {
  const res = await fetch(`http://127.0.0.1:${port}${jalur}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const teks = await res.text();
  let data = null;
  try {
    data = JSON.parse(teks);
  } catch {
    data = { raw: teks };
  }
  return { status: res.status, data, headers: res.headers };
};

const jalankan = async () => {
  const tg = await mulaiTelegramTiruan();
  const dataDir = path.join(ROOT, '.tmp-e2e-notify');

  // Mulai dari keadaan bersih setiap kali dijalankan.
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  console.log(`Telegram tiruan di :${tg.port}`);

  // Konfigurasi awal: token & chat id harus terisi SEBELUM server membaca settings.
  // Settings dibuat dengan menjalankan server sekali, lalu menulis berkasnya.
  let app = await mulaiAplikasi(dataDir, `http://127.0.0.1:${tg.port}`);

  const settingsPath = path.join(dataDir, 'settings.json');
  const produkPath = path.join(dataDir, 'products.json');

  /*
   * Seed bersifat LAZY: berkas baru dibuat saat request pertama masuk.
   * Jadi picu dulu satu request, baru tunggu produk tersedia.
   */
  await fetch(`http://127.0.0.1:${app.port}/api/products`).catch(() => null);
  for (let i = 0; i < 60 && !fs.existsSync(produkPath); i += 1) await tunggu(150);
  if (!fs.existsSync(produkPath)) {
    throw new Error(`Seed tidak terbentuk di ${dataDir} (isi: ${fs.readdirSync(dataDir).join(', ')})`);
  }

  /*
   * Konfigurasi Telegram lewat API admin — jalur yang sama dengan yang dipakai
   * pemilik toko di dashboard, bukan menulis berkas langsung. Dengan begitu uji
   * ini sekaligus memverifikasi penyimpanan settings-nya.
   */
  const login = await post(app.port, '/api/admin/login', {
    username: 'admin',
    password: 'uji-e2e-password'
  });
  if (login.status !== 200) {
    throw new Error(`Login admin gagal (${login.status}): ${JSON.stringify(login.data).slice(0, 300)}`);
  }
  const cookie = (login.headers?.get?.('set-cookie') || '').split(';')[0];
  const sesi = cookie || login.data?.token;
  if (!sesi) throw new Error('Login admin tidak mengembalikan sesi.');

  const simpan = await fetch(`http://127.0.0.1:${app.port}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : { Authorization: `Bearer ${sesi}` })
    },
    body: JSON.stringify({
      telegram: {
        enabled: true,
        botToken: '111222:token-uji',
        chatId: '555001',
        notifyNewOrder: true,
        notifyPaymentProof: true,
        notifyPaid: true,
        notifyShipped: true,
        notifyB2B: true
      }
    })
  });
  if (!simpan.ok) {
    throw new Error(`Gagal menyimpan settings (${simpan.status}): ${(await simpan.text()).slice(0, 300)}`);
  }
  console.log('Pengaturan Telegram tersimpan lewat API admin.');

  const port = app.port;
  void settingsPath;

  if (!fs.existsSync(produkPath)) {
    await fetch(`http://127.0.0.1:${port}/api/products`).catch(() => null);
    for (let i = 0; i < 40 && !fs.existsSync(produkPath); i += 1) await tunggu(150);
  }
  if (!fs.existsSync(produkPath)) throw new Error('products.json tidak terbentuk.');
  const produk = JSON.parse(fs.readFileSync(produkPath, 'utf8'));
  const daftar = Array.isArray(produk) ? produk : [produk];
  const pilihan =
    daftar.find((p) => !p.variants?.length && !p.groups?.length && Number(p.price) > 0) ||
    daftar.find((p) => Number(p.price) > 0);
  if (!pilihan) throw new Error('Tidak ada produk seed yang bisa dipakai uji.');
  console.log(`Produk uji: ${pilihan.id} — ${pilihan.name} (Rp ${pilihan.price})`);

  const buat = await post(
    port,
    '/api/orders',
    {
      customerName: 'Uji E2E Telegram',
      customerPhone: '081234567890',
      destination: 'Kota Cilegon',
      addressDetail: 'Jl. Uji E2E No. 7 Kelurahan Cibeber',
      paymentMethod: 'Transfer Bank BCA',
      shippingCost: 8000,
      items: [{ productId: pilihan.id, name: pilihan.name, qty: 1 }]
    },
    { 'X-Forwarded-For': '10.77.0.1' }
  );
  check('pesanan dibuat', buat.status, 201);
  const order = buat.data.order;
  if (!order) {
    console.log(JSON.stringify(buat.data).slice(0, 400));
    throw new Error('Pesanan gagal dibuat, uji tidak bisa lanjut.');
  }
  const total = Number(order.totalAmount ?? order.total);
  console.log(`Pesanan: ${order.orderId} — total Rp ${total.toLocaleString('id-ID')}`);

  await tunggu(700);

  console.log('\n— Notifikasi pesanan baru —');
  const notifOrder = tg.pesan.filter((p) => p.metode === 'sendMessage').pop();
  benar('notifikasi pesanan baru terkirim', Boolean(notifOrder));
  const teksOrder = notifOrder?.text || '';
  benar('bukan "Total: Rp 0"', !teksOrder.includes('Total: Rp 0'));
  benar(
    `total cocok (Rp ${total.toLocaleString('id-ID')})`,
    teksOrder.includes(`Rp ${total.toLocaleString('id-ID')}`)
  );
  benar('memuat nomor pesanan', teksOrder.includes(order.orderId));

  console.log('\n— Notifikasi bukti transfer —');
  const sebelum = tg.pesan.length;
  const bukti = await post(
    port,
    `/api/orders/${encodeURIComponent(order.orderId)}/proof`,
    { paymentProofNote: 'Transfer BCA a/n Uji E2E' },
    { 'X-Forwarded-For': '10.77.0.1' }
  );
  check('bukti diterima server', bukti.status, 200);
  await tunggu(700);

  const setelah = tg.pesan.slice(sebelum);
  const notifBukti = setelah.filter((p) => p.metode === 'sendMessage').pop();
  benar('notifikasi bukti terkirim', Boolean(notifBukti));
  const teksBukti = notifBukti?.text || '';
  benar('berjudul bukti transfer', teksBukti.includes('BUKTI TRANSFER'));
  benar('memuat nomor pesanan', teksBukti.includes(order.orderId));
  benar('bukan "Rp 0"', !teksBukti.includes('Rp 0'));
  benar(
    `nominal benar (Rp ${total.toLocaleString('id-ID')})`,
    teksBukti.includes(`Rp ${total.toLocaleString('id-ID')}`)
  );
  benar('memuat catatan pembeli', teksBukti.includes('Transfer BCA a/n Uji E2E'));

  const tombol = notifBukti?.reply_markup?.inline_keyboard || [];
  const datar = tombol.flat();
  benar('ada tombol (reply_markup)', datar.length > 0);
  benar(
    'tombol verifikasi LUNAS ada',
    datar.some((b) => b.callback_data === `paid:${order.orderId}`)
  );
  benar(
    'tombol batal ada',
    datar.some((b) => b.callback_data === `void:${order.orderId}`)
  );
  benar('parse_mode HTML dipakai', notifBukti?.parse_mode === 'HTML');

  /*
   * Jalur GAMBAR — ini yang dipakai pembeli sungguhan (screenshot transfer).
   * Berbeda dari jalur teks karena gambar melewati Supabase Storage dulu.
   */
  console.log('\n— Bukti berupa GAMBAR (foto/screenshot) —');
  {
    const buat2 = await post(
      port,
      '/api/orders',
      {
        customerName: 'Uji Gambar',
        customerPhone: '081234567891',
        destination: 'Kota Cilegon',
        addressDetail: 'Jl. Uji Gambar No. 9 Kelurahan Cibeber',
        paymentMethod: 'Transfer Bank BCA',
        shippingCost: 8000,
        items: [{ productId: pilihan.id, name: pilihan.name, qty: 1 }]
      },
      { 'X-Forwarded-For': '10.77.0.2' }
    );
    const order2 = buat2.data.order;
    // PNG 1x1 piksel — cukup untuk menguji jalur unggah tanpa data besar.
    const gambar =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const sebelum2 = tg.pesan.length;
    const kirim = await post(
      port,
      `/api/orders/${encodeURIComponent(order2.orderId)}/proof`,
      { paymentProofNote: 'Screenshot DANA', paymentProofImage: gambar },
      { 'X-Forwarded-For': '10.77.0.2' }
    );
    check('server menerima bukti gambar', kirim.status, 200);
    benar('bukti gambar tersimpan (url/base64)', Boolean(kirim.data?.order?.paymentProofUrl || kirim.data?.order?.paymentProofImage));
    await tunggu(700);

    const notif2 = tg.pesan.slice(sebelum2).filter((x) => x.metode === 'sendMessage').pop();
    benar('notifikasi bukti GAMBAR tetap terkirim', Boolean(notif2));
    const t2 = notif2?.text || '';
    benar('judul bukti transfer', t2.includes('BUKTI TRANSFER'));
    benar('nomor pesanan benar', t2.includes(order2.orderId));
    benar('nominal bukan Rp 0', !t2.includes('Rp 0'));
    const tombol2 = (notif2?.reply_markup?.inline_keyboard || []).flat();
    benar('tombol muncul pada bukti gambar', tombol2.length > 0);
    benar(
      'callback paid: benar',
      tombol2.some((b) => b.callback_data === `paid:${order2.orderId}`)
    );
  }

  console.log('\n— Timestamp bukti tersimpan —');
  const lacak = await fetch(
    `http://127.0.0.1:${port}/api/orders/track?q=${encodeURIComponent(order.orderId)}&phone=7890`
  ).then((r) => r.json());
  benar('bukti punya waktu unggah', Boolean(lacak?.order?.paymentProofAt));

  app.child.kill('SIGTERM');
  tg.server.close();
};

jalankan()
  .then(() => {
    console.log(gagal === 0 ? '\n✅ SEMUA UJI E2E LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
    process.exit(gagal === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('\nUji E2E gagal dijalankan:', err.message);
    process.exit(1);
  });
