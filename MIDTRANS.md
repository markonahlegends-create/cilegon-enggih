# Skema Migrasi: WhatsApp Manual → Midtrans Otomatis

Status: **tahap 1–3 SELESAI** (modul, endpoint, checkout Snap).
Tahap 4–5 belum: jalur manual di server dan tombol pesan WhatsApp masih ada,
dan baru dihapus setelah Midtrans terbukti jalan di produksi.
Tanggal: 16 November 2026

> **Catatan kemajuan.** Modul `server/midtrans.js` dan tiga endpoint
> (`/api/payments/midtrans/token`, `/notification`, `/status/:orderId`) sudah
> terpasang dan teruji — termasuk verifikasi tanda tangan, pencocokan nominal,
> idempotensi, pengembalian stok saat kedaluwarsa, dan penanganan
> `capture` + `challenge`. Yang belum berubah: tampilan checkout, tombol
> WhatsApp, dan jalur pembayaran manual. Jadi **toko masih berjalan seperti
> sekarang** — tidak ada risiko dari perubahan ini. Persetujuan pemilik toko:
> tahap 3–5 menunggu kredensial Midtrans.

Keputusan yang sudah dikonfirmasi pemilik toko:

1. Midtrans **Snap** (popup di web) — bukan Core API.
2. Transfer bank manual & QRIS statis **dihapus total**. Hanya Midtrans.
3. Tombol **"Pesan via WhatsApp"** dihapus. Kontak WA hanya tinggal untuk
   pertanyaan umum (bukan untuk memesan).

---

## 1. Masalah yang sebenarnya terjadi

Perlu ditegaskan lebih dulu, karena ini menentukan besar-kecilnya pekerjaan:
**pesanan sudah tersimpan otomatis.** `POST /api/orders` menyimpan pesanan ke
database, mengurangi stok, dan mengirim notifikasi Telegram — semua tanpa
WhatsApp.

Yang membuat Anda capek bukan penyimpanan pesanan, melainkan **verifikasi
pembayaran**:

- Pembeli transfer → unggah bukti → **Anda harus mencocokkan nominal di mutasi
  bank dengan kode unik 3 digit** → tandai lunas.
- Kalau pembeli tidak mengunggah bukti, Anda harus mengejar lewat WhatsApp.
- Kalau nominal tidak cocok (kurang transfer, salah kode unik), Anda harus
  menagih selisihnya.

Jadi target sebenarnya: **hilangkan langkah "cocokkan mutasi bank"**, bukan
sekadar menghilangkan tombol WhatsApp. Midtrans menyelesaikan tepat bagian itu.

---

## 2. Alur sekarang vs alur baru

### Sekarang

```
Pembeli isi data → POST /api/orders → pesanan tersimpan, stok turun
      ↓
Halaman instruksi: "Transfer Rp 105.123 ke BCA 2950546193"
      ↓
Pembeli transfer sendiri → unggah bukti (atau tidak sama sekali)
      ↓
ADMIN cek mutasi bank → cocokkan nominal + kode unik → tandai LUNAS
      ↓                              ↑
      └──── sering nyangkut di sini ─┘   (inilah beban manualnya)
```

### Dengan Midtrans Snap

```
Pembeli isi data → POST /api/orders → pesanan tersimpan, stok turun
      ↓
Server minta token Snap → pembeli pilih QRIS / GoPay / VA BCA / kartu
      ↓
Pembeli bayar di dalam popup Midtrans (di halaman toko, tidak pindah situs)
      ↓
Midtrans kirim webhook → server verifikasi tanda tangan → otomatis LUNAS
      ↓
Pesanan otomatis pindah ke antrean DIPROSES + notifikasi Telegram ke Anda
```

**Tidak ada lagi langkah yang menyentuh Anda.** Anda hanya menerima kabar
"Pesanan CE-… sudah lunas" di Telegram, lalu cukup mengirim barang.

---

## 3. Perubahan status pembayaran

Sistem sekarang memakai tiga status (`server/constants.js:363`):

```js
PAYMENT_STATUSES = ['MENUNGGU_VERIFIKASI', 'LUNAS', 'DIBATALKAN']
```

`MENUNGGU_VERIFIKASI` artinya "sudah transfer, menunggu admin mencocokkan".
Dengan Midtrans, status ini tidak lagi berarti apa-apa — karena kalau belum
lunas, pembeli memang belum membayar.

Usulan: **ganti nama, jangan tambah status baru.**

```js
PAYMENT_STATUSES = ['MENUNGGU_PEMBAYARAN', 'LUNAS', 'DIBATALKAN']
```

| Sekarang | Baru | Alasan |
|---|---|---|
| `MENUNGGU_VERIFIKASI` | `MENUNGGU_PEMBAYARAN` | Bukan lagi soal verifikasi admin, tapi menunggu pembeli membayar |

Kalau ada pesanan lama dengan status `MENUNGGU_VERIFIKASI` di database, perlu
satu skrip migrasi kecil agar tidak muncul sebagai status tak dikenal. Saya
sudah cek: saat ini `awaitingVerification` dipakai di 4 tempat
(`core.js:329`, `core.js:2552`, `AdminDashboardPage.tsx:108`,
`InvoiceDocument.tsx:201`) — semuanya ikut disesuaikan.

---

## 4. Pemetaan status Midtrans → status pesanan

Ini bagian yang paling menentukan benar-tidaknya sistem. Aturannya:
**status Midtrans adalah satu-satunya sumber kebenaran**, dan setiap notifikasi
diproses **idempoten** (dikirim dua kali tidak mengubah apa pun).

| `transaction_status` | `fraud_status` | Tindakan | Status pesanan |
|---|---|---|---|
| `pending` | — | Tunggu saja. Belum ada yang perlu dilakukan. | `MENUNGGU_PEMBAYARAN` |
| `settlement` | — | **LUNAS** via `markOrderPaid({via:'midtrans'})` | `LUNAS` → `DIPROSES` |
| `capture` | `accept` | **LUNAS** (kartu kredit) | `LUNAS` → `DIPROSES` |
| `capture` | `challenge` | **Tinjau manual.** Jangan dilunaskan otomatis. | `MENUNGGU_PEMBAYARAN` + tanda peringatan |
| `deny` | — | Biarkan. Pembeli biasanya diizinkan coba lagi. | `MENUNGGU_PEMBAYARAN` |
| `cancel` | — | Batalkan, **kembalikan stok** | `DIBATALKAN` |
| `expire` | — | Batalkan, **kembalikan stok** | `DIBATALKAN` |
| `failure` | — | Batalkan, **kembalikan stok** | `DIBATALKAN` |
| (tidak dikenal) | — | **Fail safe**: anggap belum lunas, catat di log | tidak berubah |

Dua hal yang mudah salah dan harus dijaga:

- **`capture` + `challenge` jangan dianggap lunas.** Ini transaksi kartu yang
  ditandai berisiko oleh Midtrans. Kalau dilunaskan otomatis, Anda bisa
  kehilangan barang.
- **Pengembalian stok wajib.** Sekarang pembatalan mengembalikan stok lewat
  `applyStockMovement(..., { direction: -1 })`. Jalur `expire`/`cancel` dari
  Midtrans harus memakai fungsi yang sama, kalau tidak stok akan menyusut
  sendiri setiap ada pembeli yang membuka halaman bayar lalu kabur.

---

## 5. Endpoint baru

Mengikuti pola `routes` tabel yang sudah dipakai (`server/core.js:754`):

### `POST /api/payments/midtrans/token`

Dipanggil setelah pesanan berhasil dibuat.

```
masuk : { orderId }
keluar: { token, redirectUrl, clientKey }
```

Server:
1. Ambil pesanan dari database.
2. Tolak kalau sudah `LUNAS` (jangan buat tagihan ganda).
3. Minta token ke Snap dengan **`gross_amount` diambil dari database**, bukan
   dari browser. Ini penting — kalau nominal dikirim dari browser, pembeli bisa
   mengubahnya jadi Rp 1.000.
4. `order_id` Midtrans = `orderId` pesanan (mis. `CE-20261116-041`). Harus
   unik; kalau pembeli mencoba bayar ulang setelah kedaluwarsa, pakai akhiran
   (`CE-20261116-041-R2`) karena Midtrans menolak `order_id` yang sudah dipakai.
5. Simpan `midtransOrderId` + `snapToken` ke pesanan.

`serverKey` **tidak pernah** dikirim ke browser. Yang boleh pemain depan hanya
`clientKey`, dan itu pun sifatnya publik.

### `POST /api/payments/midtrans/notification`

Webhook dari Midtrans. **Tanpa login admin** (Midtrans yang memanggil), jadi
keamanannya bergantung sepenuhnya pada tanda tangan:

```
expected = SHA512(order_id + status_code + gross_amount + SERVER_KEY)
if (expected !== signature_key) return 403
```

Tiga pengaman tambahan:

1. **Cocokkan `gross_amount` dengan `totalAmount` di database.** Tanda tangan
   sah hanya berarti "pesan ini dari Midtrans", bukan "nominalnya benar".
   Kalau tidak dicocokkan, pesanan Rp 300.000 bisa dilunaskan oleh transaksi
   Rp 1.000 yang sah secara tanda tangan.
2. **Idempoten.** Kalau `paymentStatus` sudah `LUNAS`, langsung balas `200`
   tanpa mengubah apa pun. Midtrans mengirim ulang notifikasi yang gagal
   direspons — tanpa ini, timeline pesanan bisa terisi berulang.
3. **Balas `200` secepat mungkin.** Kalau server lambat, Midtrans menganggap
   gagal dan mengirim ulang.

Butuh `SERVER_KEY` di server. Sudah ada pola yang sama untuk
`TELEGRAM_WEBHOOK_SECRET` — menolak semua permintaan kalau rahasianya belum
diisi (fail-closed).

### `GET /api/payments/midtrans/status/:orderId`

Pengaman terakhir. Dipakai halaman "pesanan selesai" untuk menanyakan status
langsung ke Midtrans kalau webhook telat masuk. Webhook bisa gagal sesekali;
tanpa endpoint ini, pembeli yang sudah membayar bisa melihat pesanannya masih
"menunggu pembayaran" sampai berjam-jam.

---

## 6. Variabel lingkungan baru

| Nama | Isi | Rahasia? |
|---|---|---|
| `MIDTRANS_SERVER_KEY` | dari dashboard Midtrans → Access Keys | **ya** |
| `MIDTRANS_CLIENT_KEY` | dikirim ke browser untuk membuka popup | tidak |
| `MIDTRANS_IS_PRODUCTION` | `true` untuk uang sungguhan, `false` untuk sandbox | tidak |

Catatan dari pengalaman proyek ini: **mengubah env var di Vercel tidak berlaku
pada deploy yang sudah ada** — harus redeploy. Dan env bertipe `sensitive` tidak
bisa di-`update`, harus dihapus lalu dibuat ulang.

Rekomendasi urutan: **satu minggu di sandbox dulu** (`MIDTRANS_IS_PRODUCTION=false`)
dengan kartu uji `4811 1111 1111 1114` / OTP `112233`, baru pindah ke produksi.

---

## 7. Yang dihapus

### Jalur pembayaran manual

| Berkas | Yang dibuang |
|---|---|
| `CheckoutModal.tsx` | Pilihan "Transfer Bank" & "QRIS Toko"; unggah bukti transfer; tombol "Konfirmasi via WhatsApp" |
| `server/core.js` | `POST /api/orders/:orderId/proof` (unggah bukti) — **atau** dibiarkan mati tanpa dipanggil |
| `server/core.js` | `POST /api/payment/qris` (QRIS statis) |
| `QrisUploader.tsx` | Panel unggah QRIS di dashboard admin |
| `settings.payment` | `uniqueCodeEnabled`, `bankTransferEnabled`, `qrisEnabled`, `instructions` |
| `AdminDashboardPage.tsx` | Tombol "tandai lunas manual" — **kecuali** untuk kasus `challenge` |

**Kode unik 3 digit ikut dihapus.** Kode itu ada semata-mata supaya admin bisa
mencocokkan nominal transfer di mutasi bank. Dengan webhook, pencocokan nominal
tidak lagi manual. Efek sampingnya: total bayar jadi angka bulat lagi
(Rp 105.000, bukan Rp 105.123).

### Tombol WhatsApp untuk memesan

| Berkas | Baris | Yang dibuang |
|---|---|---|
| `CartDrawer.tsx` | 90, 293 | "Pesan Cepat via WhatsApp Admin" |
| `CheckoutModal.tsx` | 813, 907 | "Konfirmasi via WhatsApp" |
| `Navbar.tsx` | 456, 668 | "Pesan / Tanya via WhatsApp" |
| `ToastContainer.tsx` | — | tombol WA melayang |
| `Footer.tsx` | 50 | teks "Transfer Bank, QRIS Toko & WhatsApp" → "QRIS, GoPay, Virtual Account" |

**Yang tetap:** nomor WhatsApp di footer dan halaman Tentang sebagai kontak
umum, dan `settings.whatsapp` untuk tombol "hubungi penjual" di invoice. Anda
tetap bisa dihubungi kalau ada pertanyaan — hanya saja tidak ada lagi tombol
yang mendorong orang memesan lewat chat.

---

## 8. Rencana kerja (5 tahap, bisa berhenti di tahap mana pun)

| Tahap | Isi | Bisa diuji? |
|---|---|---|
| **1** | Modul `server/midtrans.js`: buat token, verifikasi tanda tangan, petakan status | ya — unit test tanpa jaringan |
| **2** | Endpoint token + webhook + status | ya — sandbox Midtrans |
| **3** | Checkout: Snap popup menggantikan pilihan bank/QRIS | ya — kartu uji |
| **4** | Hapus jalur manual + tombol WA pesanan | ya — klik manual |
| **5** | Dokumentasi + skrip migrasi status lama | ya — `preflight` |

Tahap 1–2 tidak mengubah apa pun yang dilihat pembeli, jadi aman dikerjakan
lebih dulu. Tahap 4 baru dijalankan setelah Midtrans terbukti jalan — supaya
tidak ada jendela waktu di mana toko tidak bisa menerima uang sama sekali.

---

## 9. Yang saya butuhkan dari Anda

1. **`MIDTRANS_SERVER_KEY`** dan **`MIDTRANS_CLIENT_KEY`** dari dashboard
   Midtrans (Settings → Access Keys). Jangan kirim lewat chat — nanti saya
   pandu memasukkannya langsung ke Vercel.
2. Konfirmasi akun Midtrans Anda **statusnya aktif/produksi** atau masih
   sandbox.
3. Keputusan soal **biaya gateway** (lihat bagian 10).

---

## 10. Dua konsekuensi bisnis yang harus Anda putuskan

### a. Biaya transaksi Midtrans

Selama ini keunggulan toko Anda adalah *"tanpa biaya admin gateway"* — itu
tertulis di halaman checkout. Dengan Midtrans, setiap transaksi dipotong biaya
(QRIS sekitar 0,7%, kartu kredit & e-wallet lebih tinggi, plus biaya tetap per
transaksi). Angkanya tergantung kontrak Anda dengan Midtrans.

**KEPUTUSAN PEMILIK TOKO: diserap ke harga.**

Tidak ada baris "biaya pemrosesan" di checkout. Konsekuensinya:

- Harga produk di katalog perlu dinaikkan tipis saat Anda sudah tahu angka
  pasti dari kontrak Midtrans (untuk keranjang rata-rata toko ini, biaya
  berkisar Rp 3.000–8.000 per transaksi).
- Penyesuaian harga dilakukan **di dashboard admin** (Produk → harga), bukan
  di kode — supaya Anda bisa mengubahnya sendiri kapan saja.
- Janji lama *"tanpa biaya admin gateway"* di halaman checkout **sudah
  dihapus**, karena tidak lagi benar.

### b. Apa yang terjadi pada pelanggan yang tidak punya e-wallet

Snap menyediakan QRIS, GoPay, ShopeePay, VA bank, dan kartu. Hampir semua orang
Indonesia punya salah satunya. Tapi kalau ada pelanggan yang hanya bisa
transfer tunai/ATM, dia **tidak akan bisa checkout sama sekali** setelah jalur
manual dihapus.

Kalau ini terasa berisiko, ada jalan tengah: Midtrans jadi satu-satunya jalur,
tapi pembeli yang gagal bayar diarahkan ke **"hubungi kami"** — bukan sebagai
jalur pemesanan, hanya jalan keluar terakhir. Saya tidak menyarankan
mengaktifkannya kecuali Anda memang sering dapat pelanggan seperti itu.

---

## 11. Risiko yang perlu diketahui

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Webhook tidak masuk | Pesanan sudah dibayar tapi status masih menunggu | Endpoint `status/:orderId` **melunaskan sendiri** saat dipanggil tombol "Saya Sudah Bayar — Periksa Status" |
| Tanda tangan tidak dicek | Siapa pun bisa melunaskan pesanan | Wajib `SHA512` + fail-closed kalau `SERVER_KEY` kosong |
| `gross_amount` tidak dicocokkan | Pesanan mahal dilunaskan transaksi recehan | Bandingkan dengan `totalAmount` di database |
| Notifikasi ganda | Timeline ganda, stok terpotong dua kali | Idempoten sejak awal |
| Server key bocor ke browser | Orang bisa membuat transaksi atas nama Anda | Server key hanya di server; `clientKey` saja yang publik |
| Sandbox terpakai di produksi | Pembeli "berhasil bayar" tapi uang tidak masuk | `MIDTRANS_IS_PRODUCTION` dicek di `preflight` |

---

## 12. Catatan plan Vercel: kenapa TIDAK memakai cron

Rencana awal memakai cron `*/15 * * * *` untuk menambal webhook yang gagal
masuk. **Itu membuat deploy GAGAL.** Plan Hobby membatasi maksimal **2 cron
per proyek** dan **minimal sekali sehari**; jadwal lebih sering dari harian
ditolak saat deploy, sebelum aplikasi sempat dibangun.

Solusi yang dipakai: endpoint `GET /api/payments/midtrans/status/:orderId`
tidak hanya *melaporkan* status, tetapi **ikut melunaskan** kalau Midtrans
menyatakan settlement — dengan nominal tetap dicocokkan.

Endpoint itu dipanggil justru saat paling dibutuhkan, yaitu ketika pembeli
menekan **"Saya Sudah Bayar — Periksa Status"**. Artinya tidak ada cron yang
perlu diandalkan: jaring pengamannya aktif tepat pada saat ada orang yang
menunggu jawaban.

Konsekuensinya yang perlu diketahui: pesanan yang ditinggalkan pembeli tanpa
pernah menekan tombol itu **tidak akan otomatis terlacak** kalau webhook gagal.
Untuk kasus seperti itu, admin bisa menandai lunas manual dari dashboard —
jalur itu sengaja tetap ada.
