/**
 * UJI SIGNATURE SECRET KEY — kunci KETIGA Midtrans.
 *
 * LATAR BELAKANG
 * Sejak 28 Oktober 2026 Midtrans memisahkan dua pekerjaan yang dulu dipegang
 * satu kunci:
 *
 *   Server Key           → Authorization pada panggilan API (Snap, cek status)
 *   Signature Secret Key → SHA512(order_id+status_code+gross_amount+KUNCI INI)
 *
 * Untuk merchant lama kedua nilai AWALNYA SAMA, sehingga integrasi yang hanya
 * memakai Server Key lulus semua uji — sampai salah satu kunci di-generate
 * ulang. Setelah itu:
 *
 *   cek status  → 200 (uang masuk, transaksi ada)
 *   notifikasi  → 403 (tanda tangan tidak sah)
 *
 * Persis gejala toko ini. Uji ini mengunci perilaku yang benar supaya
 * perbaikannya tidak hilang lagi.
 *
 * Cara pakai: node scripts/test-midtrans-signature-key.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-sigkey-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-uji';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
process.env.ADMIN_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const SERVER_KEY = 'Mid-server-KUNCI-API';
const SIGNATURE_KEY = 'Mid-server-KUNCI-TANDA-TANGAN-BERBEDA';
const SIGNATURE_LAMA = 'Mid-server-KUNCI-TANDA-TANGAN-LAMA';
process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;

const { verifySignature, midtransConfig } = await import('../server/midtrans.js');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`);
};

const tandaTangan = (kunci, p) =>
  crypto.createHash('sha512').update(`${p.order_id}${p.status_code}${p.gross_amount}${kunci}`).digest('hex');

const dasar = { order_id: 'CE-SIG-1', status_code: '200', gross_amount: '50000.00' };
const notifDengan = (kunci) => ({ ...dasar, signature_key: tandaTangan(kunci, dasar) });

console.log('\n▶ 1. Kunci kosong → jatuh ke Server Key (integrasi lama tetap jalan)');
delete process.env.MIDTRANS_SIGNATURE_SECRET_KEY;
let cfg = midtransConfig();
cek('signatureKey = serverKey', cfg.signatureKey, SERVER_KEY);
cek('signatureKeyTerpisah = false', cfg.signatureKeyTerpisah, false);
cek('notif bertanda Server Key diterima', verifySignature(notifDengan(SERVER_KEY), [cfg.signatureKey, cfg.serverKey]), true);

console.log('\n▶ 2. Kunci diisi terpisah → HANYA kunci itu yang sah');
process.env.MIDTRANS_SIGNATURE_SECRET_KEY = SIGNATURE_KEY;
cfg = midtransConfig();
cek('signatureKey = kunci tanda tangan', cfg.signatureKey, SIGNATURE_KEY);
cek('terpisah dari Server Key', cfg.signatureKeyTerpisah, true);
cek('Server Key kini BUKAN kunci verifikasi', cfg.signatureKey !== cfg.serverKey, true);

const kandidat = [cfg.signatureKey, cfg.signatureKeyLama, cfg.serverKey].filter(Boolean);
cek('notif bertanda Signature Secret Key DITERIMA', verifySignature(notifDengan(SIGNATURE_KEY), kandidat), true);

/*
 * INI INTI BUG YANG DIPERBAIKI.
 * Sebelum perbaikan, kode memakai cfg.serverKey → hasilnya false → semua
 * pembayaran sah ditolak dan tidak pernah masuk ke pesanan.
 */
cek('notif bertanda Server Key kini DITOLAK', verifySignature(notifDengan(SERVER_KEY), [cfg.signatureKey]), false);

console.log('\n▶ 3. Masa transisi setelah "Regenerate" → kunci lama masih diterima');
process.env.MIDTRANS_SIGNATURE_SECRET_KEY_LAMA = SIGNATURE_LAMA;
cfg = midtransConfig();
const kandidatRotasi = [cfg.signatureKey, cfg.signatureKeyLama, cfg.serverKey].filter(Boolean);
cek('kunci BARU diterima', verifySignature(notifDengan(SIGNATURE_KEY), kandidatRotasi), true);
cek('kunci LAMA masih diterima (retry tertunda)', verifySignature(notifDengan(SIGNATURE_LAMA), kandidatRotasi), true);
cek('kunci asing tetap ditolak', verifySignature(notifDengan('Mid-server-KUNCI-ORANG-LAIN'), kandidatRotasi), false);

console.log('\n▶ 4. Pengaman tanda tangan');
cek('tanpa signature_key ditolak', verifySignature({ ...dasar }, [SIGNATURE_KEY]), false);
cek('signature_key kosong ditolak', verifySignature({ ...dasar, signature_key: '' }, [SIGNATURE_KEY]), false);
cek('payload null ditolak', verifySignature(null, [SIGNATURE_KEY]), false);
cek('tanpa kandidat ditolak', verifySignature(notifDengan(SIGNATURE_KEY), []), false);
cek('kunci berisi spasi tidak dianggap sah', verifySignature(notifDengan(SIGNATURE_KEY), [` ${SIGNATURE_KEY} `]), true);
cek('gross_amount dipakai apa adanya', verifySignature(
  { ...dasar, gross_amount: '50000', signature_key: tandaTangan(SIGNATURE_KEY, { ...dasar, gross_amount: '50000' }) },
  [SIGNATURE_KEY]
), true);

console.log('\n▶ 5. Pembuatan & cek status TETAP memakai Server Key (tidak berubah)');
cek('serverKey untuk API', cfg.serverKey, SERVER_KEY);

fs.rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? '\nSIGNATURE SECRET KEY LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
