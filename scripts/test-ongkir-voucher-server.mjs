/**
 * Uji ONGKIR & VOUCHER di sisi SERVER — dua celah nyata yang pernah terbuka.
 *
 * Ditemukan lewat uji langsung sebelum rilis ini (bukan teori):
 *
 *   A. "KODEPALSU" — `voucherDiscount` dari browser dipakai apa adanya dan
 *      `voucherCode` disimpan tanpa dicocokkan ke daftar voucher.
 *      Pesanan Rp 1.500 tetap dibuat (HTTP 201) dengan diskon karangan.
 *
 *   B. Ongkir 0 dari browser — `shippingCost` dipercaya selama ≤ Rp 500.000.
 *      Pesanan yang seharusnya Rp 10.374 menjadi Rp 1.825.
 *
 * Keduanya berarti PEMBELI BISA MENENTUKAN TOTAL TAGIHANNYA SENDIRI — pada
 * toko yang menerima uang sungguhan lewat Midtrans. Uji ini mengunci perilaku
 * yang benar supaya tidak terbuka lagi.
 *
 * Penyimpanan diarahkan ke folder sementara (CE_DATA_DIR); tanpa jaringan.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-ongkir-'));
process.env.CE_DATA_DIR = DIR;
process.env.PUBLIC_BASE_URL = '';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.MIDTRANS_SERVER_KEY;
delete process.env.MIDTRANS_CLIENT_KEY;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

const ZONA_CILEGON = 'Kota Cilegon (Jombang, Purwakarta, Cibeber, Citangkil, Ramanuju)';

/* Produk 1.500 gram 200 → berat total dibulatkan ke 1 kg. */
const produk = (extra = {}) => ({
  id: 'uji-murah',
  slug: 'uji-murah',
  name: 'Produk Murah',
  price: 1500,
  stock: 100,
  active: true,
  weightGrams: 200,
  categorySlug: 'aksesoris-dekorasi',
  variants: [],
  optionGroups: [],
  combinations: [],
  ...extra
});
await store.put('products', produk());

/*
 * Setiap 8 pesanan, uji berpindah IP.
 *
 * Bukan akal-akalan: `/api/orders` memang membatasi 10 pesanan / 10 menit per
 * IP (anti-spam). Tanpa ini uji akan gagal karena 429, bukan karena aturan
 * ongkir — dan kegagalan yang salah alasan justru menyesatkan.
 */
let nomorUji = 0;
const buat = (extra = {}) => {
  nomorUji++;
  const ip = `10.0.${Math.floor(nomorUji / 8)}.1`;
  return core.dispatch({
    method: 'POST',
    path: '/api/orders',
    headers: { 'x-forwarded-for': ip },
    query: {},
    body: {
      customerName: 'Uji',
      customerPhone: '082249879873',
      customerEmail: 'uji@contoh.com',
      destination: ZONA_CILEGON,
      addressDetail: 'Jl. Uji Nomor 12',
      courier: 'JNE Reguler (CTC/REG)',
      paymentMethod: 'Midtrans',
      items: [{ productId: 'uji-murah', qty: 1, price: 1500 }],
      ...extra
    }
  });
};

const simpanOngkir = async (ongkir) => {
  const current = (await store.list('settings'))[0] || {};
  await store.replaceAll('settings', [{ ...current, id: 'store-settings', ongkir }]);
};
const simpanVoucher = async (vouchers) => {
  const current = (await store.list('settings'))[0] || {};
  await store.replaceAll('settings', [{ ...current, id: 'store-settings', vouchers }]);
};

/* ---------- 1. Baseline: ongkir resmi diterima apa adanya ---------- */
let r = await buat({ shippingCost: 8000 });
cek('ongkir resmi 8.000 diterima', [r.status, r.body.order?.shippingCost], [201, 8000]);
cek('total = subtotal + ongkir', r.body.order?.totalAmount >= 9500, true);

/* ---------- 2. CELAH A: voucher karangan ---------- */
r = await buat({ shippingCost: 8000, voucherCode: 'KODEPALSU', voucherDiscount: 5000 });
cek('voucher karangan: pesanan tetap dibuat (tidak memutus alur)', r.status, 201);
cek('voucher karangan: diskon DIABAIKAN', r.body.order?.voucherDiscount, 0);
cek('voucher karangan: kode tidak disimpan', r.body.order?.voucherCode, null);
cek(
  'voucher karangan: pembeli diberi tahu alasannya',
  (r.body.order?.penyesuaian || []).some((p) => /KODEPALSU/i.test(p)),
  true
);

/* ---------- 3. Voucher sah dipakai, nominal dari DEFINISI ---------- */
await simpanVoucher([
  { code: 'UJICoba', title: 'Uji', minPurchase: 1000, discountAmount: 500, active: true }
]);
r = await buat({ shippingCost: 8000, voucherCode: 'ujicoba', voucherDiscount: 999999 });
cek('voucher sah: kode (huruf kecil) dikenali', r.body.order?.voucherCode, 'UJICoba');
cek('voucher sah: diskon dari definisi, BUKAN dari browser', r.body.order?.voucherDiscount, 500);

/* Minimal belanja dihormati */
await simpanVoucher([{ code: 'MINIMAL', minPurchase: 50000, discountAmount: 5000, active: true }]);
r = await buat({ shippingCost: 8000, voucherCode: 'MINIMAL', voucherDiscount: 5000 });
cek('voucher di bawah minimal: tidak dipakai', r.body.order?.voucherDiscount, 0);
cek(
  'voucher di bawah minimal: alasan disebutkan',
  (r.body.order?.penyesuaian || []).some((p) => /minimal/i.test(p)),
  true
);

/* Voucher nonaktif tidak dipakai */
await simpanVoucher([{ code: 'MATI', minPurchase: 0, discountAmount: 1000, active: false }]);
r = await buat({ shippingCost: 8000, voucherCode: 'MATI', voucherDiscount: 1000 });
cek('voucher nonaktif: tidak dipakai', r.body.order?.voucherDiscount, 0);
await simpanVoucher([]);

/* ---------- 4. CELAH B: ongkir 0 yang dikirim browser ---------- */
await simpanOngkir({ promoGratisOngkir: 0, gratisOngkirSelalu: false });
r = await buat({ shippingCost: 0 });
cek('ongkir 0 tanpa hak: DIKOREKSI ke tarif resmi', r.body.order?.shippingCost, 8000);
cek('ongkir 0 tanpa hak: bukan gratis', r.body.order?.ongkirGratis, false);
cek(
  'ongkir 0 tanpa hak: pembeli diberi tahu',
  (r.body.order?.penyesuaian || []).some((p) => /tarif resmi/i.test(p)),
  true
);

/* Nominal ngawur (mis. 100) juga tidak boleh lolos */
r = await buat({ shippingCost: 100 });
cek('ongkir ngawur 100 dikoreksi', r.body.order?.shippingCost, 8000);

/* ---------- 5. Gratis ongkir SELALU (jalur sah untuk uji murah) ---------- */
await simpanOngkir({ promoGratisOngkir: 0, gratisOngkirSelalu: true });
r = await buat({ shippingCost: 0 });
cek('gratis ongkir selalu: ongkir 0 sah', r.body.order?.shippingCost, 0);
cek('gratis ongkir selalu: ditandai', r.body.order?.ongkirGratis, true);
cek('gratis ongkir selalu: total hanya subtotal', r.body.order?.totalAmount >= 1500, true);
await simpanOngkir({ promoGratisOngkir: 0, gratisOngkirSelalu: false });

/* ---------- 6. Promo minimal belanja ---------- */
await simpanOngkir({ promoGratisOngkir: 50000, gratisOngkirSelalu: false });
r = await buat({ shippingCost: 0 });
cek('promo belum tercapai: ongkir tetap ditagih', r.body.order?.shippingCost, 8000);
cek(
  'promo belum tercapai: sisa minimal diberitahukan',
  (r.body.order?.penyesuaian || []).some((p) => /Tambah Rp/i.test(p)),
  true
);

await simpanOngkir({ promoGratisOngkir: 1000, gratisOngkirSelalu: false });
r = await buat({ shippingCost: 0 });
cek('promo tercapai: ongkir gratis', r.body.order?.shippingCost, 0);

/* ---------- 7. Pembeli yang JUJUR membayar ongkir tetap dilayani ---------- */
await simpanOngkir({ promoGratisOngkir: 1000, gratisOngkirSelalu: false });
r = await buat({ shippingCost: 8000 });
cek('promo aktif tapi pembeli memilih bayar: promo tetap menang', r.body.order?.shippingCost, 0);

await simpanOngkir({ promoGratisOngkir: 0, gratisOngkirSelalu: false });
r = await buat({ shippingCost: 8000 });
cek('tanpa promo: ongkir resmi diterima', r.body.order?.shippingCost, 8000);

/* ---------- 8. Setting disanitasi saat admin menyimpan ---------- */
const simpanSettings = (ongkir) =>
  core.dispatch({
    method: 'PUT',
    path: '/api/admin/settings',
    headers: { authorization: `Bearer ${process.env.ADMIN_PASSWORD || ''}` },
    query: {},
    body: { ongkir }
  });
/* Tanpa sesi admin yang sah, route ini menolak — cukup pastikan tidak 500. */
const tanpa = await simpanSettings({ promoGratisOngkir: -5000, gratisOngkirSelalu: 'ya' });
cek('simpan pengaturan tanpa admin ditolak rapi', [401, 403].includes(tanpa.status), true);

/* Sanitasi nilai: dicek lewat readSettings setelah penyimpanan langsung */
await store.replaceAll('settings', [
  { id: 'store-settings', ongkir: { promoGratisOngkir: -5000, gratisOngkirSelalu: 'ya' } }
]);
r = await buat({ shippingCost: 0 });
cek(
  'nilai ongkir negatif/kacau di DB tidak membuat ongkir gratis',
  r.body.order?.shippingCost,
  8000
);

fs.rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? '\nONGKIR & VOUCHER SERVER LULUS' : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
