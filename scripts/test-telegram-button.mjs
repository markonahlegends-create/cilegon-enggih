/**
 * UJI UJUNG-KE-UJUNG TOMBOL "VERIFIKASI LUNAS" DI TELEGRAM.
 *
 * LATAR BELAKANG (laporan 20 Nov 2026)
 * "Pada tombol verifikasi lunas di chatbot Telegram tombol muncul tapi tidak
 *  berfungsi."
 *
 * Tombol inline hanya berfungsi bila TIGA hal bertemu:
 *   1. pesan dikirim dengan `reply_markup` berisi `callback_data`;
 *   2. webhook terdaftar di Telegram dengan URL publik yang benar;
 *   3. endpoint menerima `callback_query` dan lolos 4 lapis pengaman
 *      (secret header, chat id admin, aksi dikenal, pesanan ada).
 *
 * Uji ini menjalankan ketiganya dengan server sungguhan + Telegram tiruan,
 * sehingga kegagalan seperti "tombol tampil tetapi diam" tertangkap sebelum
 * naik ke produksi. Termasuk batas 64 byte `callback_data` yang membuat
 * Telegram MENOLAK seluruh pesan bila terlampaui.
 *
 * Cara pakai: node scripts/test-telegram-button.mjs
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SECRET = 'rahasia-uji-tombol-32-karakter-acak-panjang';

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

/** Telegram tiruan: mencatat semua request & membalas seperti aslinya. */
const mulaiTelegram = () =>
  new Promise((resolve) => {
    const catatan = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let parsed = {};
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch {
          parsed = {};
        }
        const metode = req.url.split('/').pop().split('?')[0];
        catatan.push({ metode, body: parsed });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: { message_id: catatan.length } }));
      });
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, catatan, port: server.address().port })
    );
  });

const mulaiAplikasi = (dataDir, telegramBase) =>
  new Promise((resolve, reject) => {
    const port = 3500 + Math.floor(Math.random() * 300);
    const child = spawn(process.execPath, ['server/index.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        BIND_HOST: '127.0.0.1',
        CE_DATA_DIR: dataDir,
        TELEGRAM_API_BASE: telegramBase,
        TELEGRAM_WEBHOOK_SECRET: SECRET,
        PUBLIC_BASE_URL: 'https://contoh-toko.vercel.app',
        ADMIN_PASSWORD: 'uji-tombol-password',
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        SUPABASE_ANON_KEY: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    child.stdout.on('data', (d) => {
      log += d.toString();
      if (log.includes('listening at')) resolve({ child, port, log: () => log });
    });
    child.stderr.on('data', (d) => {
      log += d.toString();
    });
    setTimeout(() => {
      if (!log.includes('listening at')) reject(new Error(`Server gagal start:\n${log}`));
    }, 25000);
  });

const kirim = async (port, jalur, body, headers = {}) => {
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
  const tg = await mulaiTelegram();
  const dataDir = path.join(ROOT, '.tmp-e2e-telegram');
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const app = await mulaiAplikasi(dataDir, `http://127.0.0.1:${tg.port}`);
  const port = app.port;

  // Picu seed, lalu siapkan koneksi Telegram lewat API admin (jalur nyata).
  await fetch(`http://127.0.0.1:${port}/api/products`).catch(() => null);
  await tunggu(400);

  const login = await kirim(port, '/api/admin/login', {
    username: 'admin',
    password: 'uji-tombol-password'
  });
  check('login admin berhasil', login.status, 200);
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

  const simpan = await fetch(`http://127.0.0.1:${port}/api/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      telegram: {
        enabled: true,
        botToken: '999888:token-uji-tombol',
        chatId: '777001',
        notifyNewOrder: true,
        notifyPaymentProof: true,
        notifyPaid: true,
        notifyShipped: true,
        notifyB2B: true
      }
    })
  });
  check('pengaturan Telegram tersimpan', simpan.status, 200);

  console.log('\n— 1. Daftarkan webhook (yang dilakukan tombol di dashboard) —');
  const daftar = await kirim(
    port,
    '/api/admin/telegram/webhook',
    { publicUrl: 'https://contoh-toko.vercel.app' },
    { Cookie: cookie }
  );
  check('webhook didaftarkan', daftar.status, 200);
  benar(
    'url memakai PUBLIC_BASE_URL / publicUrl, bukan localhost',
    String(daftar.data?.url || '').startsWith('https://contoh-toko.vercel.app'),
    String(daftar.data?.url)
  );

  const setWebhook = tg.catatan.filter((c) => c.metode === 'setWebhook').pop();
  benar('Telegram menerima setWebhook', Boolean(setWebhook));
  check('secret_token ikut dikirim', Boolean(setWebhook?.body?.secret_token), true);
  benar(
    'allowed_updates memuat callback_query',
    Array.isArray(setWebhook?.body?.allowed_updates) &&
      setWebhook.body.allowed_updates.includes('callback_query'),
    JSON.stringify(setWebhook?.body?.allowed_updates)
  );

  console.log('\n— 2. Buat pesanan & unggah bukti → tombol harus menempel —');
  const produk = JSON.parse(fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8'));
  const daftarProduk = Array.isArray(produk) ? produk : [produk];
  const pilihan = daftarProduk.find((p) => Number(p.price) > 0);

  const buat = await kirim(
    port,
    '/api/orders',
    {
      customerName: 'Uji Tombol',
      customerPhone: '081234567890',
      destination: 'Kota Cilegon',
      addressDetail: 'Jl. Uji Tombol No. 3 Kelurahan Cibeber',
      paymentMethod: 'Transfer Bank BCA',
      shippingCost: 8000,
      items: [{ productId: pilihan.id, name: pilihan.name, qty: 1 }]
    },
    { 'X-Forwarded-For': '10.88.0.1' }
  );
  check('pesanan dibuat', buat.status, 201);
  const order = buat.data.order;

  await kirim(
    port,
    `/api/orders/${encodeURIComponent(order.orderId)}/proof`,
    { paymentProofNote: 'Transfer BCA' },
    { 'X-Forwarded-For': '10.88.0.1' }
  );
  await tunggu(600);

  const pesanBukti = tg.catatan
    .filter((c) => c.metode === 'sendMessage' && String(c.body?.text || '').includes('BUKTI'))
    .pop();
  benar('notifikasi bukti terkirim', Boolean(pesanBukti));
  const keyboard = pesanBukti?.body?.reply_markup?.inline_keyboard || [];
  const tombol = keyboard.flat();
  benar('notifikasi membawa tombol', tombol.length > 0);

  /*
   * Telegram MENOLAK SELURUH PESAN bila callback_data > 64 byte. Uji ini
   * menangkapnya di lokal, bukan lewat notifikasi yang diam-diam gagal.
   */
  const callback = tombol.filter((t) => t.callback_data);
  const terpanjang = Math.max(...callback.map((t) => t.callback_data.length), 0);
  benar(`callback_data ${terpanjang} byte ≤ 64`, terpanjang <= 64 && terpanjang > 0);
  benar(
    'ada tombol paid: untuk pesanan ini',
    callback.some((t) => t.callback_data === `paid:${order.orderId}`),
    JSON.stringify(callback.map((t) => t.callback_data))
  );

  console.log('\n— 3. Tekan tombol (callback_query dari Telegram) —');
  const tekan = (data, chatId = '777001', fromId = 4242) =>
    kirim(
      port,
      '/api/telegram/webhook',
      {
        update_id: 1,
        callback_query: {
          id: 'cb-1',
          data,
          from: { id: fromId, username: 'pemilik' },
          message: {
            message_id: 11,
            chat: { id: chatId },
            text: pesanBukti?.body?.text || 'BUKTI TRANSFER'
          }
        }
      },
      { 'x-telegram-bot-api-secret-token': SECRET }
    );

  const hasil = await tekan(`paid:${order.orderId}`);
  check('verifikasi berhasil', hasil.status, 200);
  check('status pesanan jadi LUNAS', hasil.data.status, 'LUNAS');
  check('benar-benar berubah', hasil.data.changed, true);

  benar(
    'Telegram menerima answerCallbackQuery (indikator loading berhenti)',
    tg.catatan.some((c) => c.metode === 'answerCallbackQuery'),
    'tidak ada answerCallbackQuery'
  );
  benar(
    'pesan di Telegram diperbarui (ditandai LUNAS)',
    tg.catatan.some(
      (c) => c.metode === 'editMessageText' && String(c.body?.text || '').includes('LUNAS')
    ),
    'tidak ada editMessageText'
  );

  const lacak = await fetch(
    `http://127.0.0.1:${port}/api/orders/track?q=${encodeURIComponent(order.orderId)}&phone=7890`
  ).then((r) => r.json());
  check('halaman lacak pembeli ikut LUNAS', lacak?.order?.paymentStatus, 'LUNAS');

  console.log('\n— 4. Pengaman tetap bekerja —');
  {
    const tanpaSecret = await kirim(port, '/api/telegram/webhook', {
      callback_query: { id: 'x', data: 'paid:apa-saja', message: { chat: { id: '777001' } } }
    });
    check('tanpa secret ditolak', tanpaSecret.status, 401);

    const chatLain = await tekan(`paid:${order.orderId}`, '999999');
    check('chat bukan admin diabaikan', chatLain.data.ignored, true);

    const ulang = await tekan(`paid:${order.orderId}`);
    check('tekan ulang aman', ulang.data.changed, false);
  }

  app.child.kill('SIGTERM');
  tg.server.close();
};

jalankan()
  .then(() => {
    console.log(gagal === 0 ? '\n✅ SEMUA UJI TOMBOL TELEGRAM LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
    process.exit(gagal === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('\nUji gagal dijalankan:', err.message);
    process.exit(1);
  });
