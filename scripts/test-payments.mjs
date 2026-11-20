/**
 * UJI PELUNASAN PEMBAYARAN — memastikan satu pintu `markOrderPaid()` benar.
 *
 * LATAR BELAKANG
 * Sebelumnya pembayaran bisa ditandai LUNAS dari dua tempat dengan logika
 * masing-masing (dashboard admin & bot Telegram). Uji ini mengunci aturan yang
 * harus sama di kedua jalur:
 *   1. pesanan DIBATALKAN tidak boleh jadi LUNAS;
 *   2. menekan LUNAS dua kali tidak menggandakan timeline;
 *   3. pesanan MENUNGGU_KONFIRMASI otomatis pindah ke DIPROSES;
 *   4. jalur verifikasi (admin/telegram) tercatat agar bisa diaudit.
 *
 * Cara pakai: node scripts/test-payments.mjs
 */
import { markOrderPaid } from '../server/payments.js';

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

// Penyimpanan tiruan: tidak menyentuh Supabase / berkas JSON.
const buatPenyimpanan = () => {
  const data = [];
  return { data, persist: async (doc) => void data.push(doc) };
};

const pesanan = (extra = {}) => ({
  id: 'CE-UJI-1',
  status: 'MENUNGGU_KONFIRMASI',
  paymentStatus: 'MENUNGGU_VERIFIKASI',
  total: 250000,
  timeline: [{ time: '01 Jan 2026 10:00', status: 'Pesanan dibuat', location: 'Web' }],
  ...extra
});

const jalankan = async () => {
  // 1. Pesanan dibatalkan tidak bisa dilunasi.
  {
    const { data, persist } = buatPenyimpanan();
    const hasil = await markOrderPaid(pesanan({ status: 'DIBATALKAN' }), { persist });
    check('dibatalkan ditolak', hasil.ok, false);
    check('dibatalkan tidak menyimpan apa pun', data.length, 0);
  }

  // 2. Pelunasan lewat Telegram: lunas, atas nama telegram, pindah ke DIPROSES.
  {
    const { data, persist } = buatPenyimpanan();
    const hasil = await markOrderPaid(pesanan(), {
      via: 'telegram',
      actor: 'telegram:admin',
      verifiedAmount: 250000,
      persist
    });
    check('telegram: berhasil', hasil.ok, true);
    check('telegram: berubah', hasil.changed, true);
    check('telegram: status lunas', hasil.order.paymentStatus, 'LUNAS');
    check('telegram: jalur tercatat', hasil.order.paidVerifiedVia, 'telegram');
    check('telegram: pindah ke DIPROSES', hasil.order.status, 'DIPROSES');
    check('telegram: dua baris timeline', hasil.order.timeline.length, 3);
    check('telegram: tersimpan sekali', data.length, 1);
    check(
      'telegram: timeline menyebut nominal',
      hasil.order.timeline[1].status.includes('250.000'),
      true
    );
  }

  // 3. Menekan LUNAS dua kali (mis. tombol di Telegram ditekan ulang) idempoten.
  {
    const { data, persist } = buatPenyimpanan();
    const pertama = await markOrderPaid(pesanan(), { via: 'telegram', persist });
    const kedua = await markOrderPaid(pertama.order, { via: 'telegram', persist });
    check('ulang: tetap sukses', kedua.ok, true);
    check('ulang: tidak berubah', kedua.changed, false);
    check('ulang: timeline tidak bertambah', kedua.order.timeline.length, 3);
    check('ulang: hanya satu penyimpanan', data.length, 1);
  }

  // 4. Jalur dashboard admin pada pesanan reguler: status pesanan tidak diutak-atik.
  {
    const { persist } = buatPenyimpanan();
    const hasil = await markOrderPaid(pesanan({ status: 'DIKEMAS' }), {
      via: 'admin',
      actor: 'admin',
      persist
    });
    check('admin: status pesanan tetap', hasil.order.status, 'DIKEMAS');
    check('admin: jalur tercatat', hasil.order.paidVerifiedVia, 'admin');
    check('admin: timeline bertambah satu', hasil.order.timeline.length, 2);
    check(
      'admin: lokasi dashboard',
      hasil.order.timeline[1].location,
      'Dashboard Admin Cilegon Enggih'
    );
  }

  // 5. Pesanan tanpa argumen tidak boleh melempar error.
  {
    const hasil = await markOrderPaid(null);
    check('tanpa pesanan ditolak rapi', hasil.ok, false);
  }

  // 6. paidAt lama dipertahankan bila sudah pernah diisi (tidak menimpa riwayat).
  {
    const { persist } = buatPenyimpanan();
    const lama = '2026-01-02T03:04:05.000Z';
    const hasil = await markOrderPaid(pesanan({ paidAt: lama }), { persist });
    check('paidAt lama dipertahankan', hasil.order.paidAt, lama);
  }
};

jalankan()
  .then(() => {
    console.log(
      gagal === 0 ? '\n✅ SEMUA UJI PELUNASAN LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`
    );
    process.exit(gagal === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('Uji gagal dijalankan:', err);
    process.exit(1);
  });
