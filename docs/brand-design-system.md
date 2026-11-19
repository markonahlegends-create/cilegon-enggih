# Sistem Desain Visual — CILEGON ENGGIH

> Dokumen kerja untuk menghasilkan gambar produk yang konsisten.
> Referensi foto resmi: `public/brand/landmark-simpang-tiga.jpg`

## 1. Anatomi Menara Simpang Tiga (WAJIB akurat)

Menara ini tidak boleh digambar sebagai mercusuar, obelisk, atau menara generik.
Ciri yang membuatnya khas — semua harus ada:

1. **Kanopi cakram lebar** di puncak — seperti payung / saucer, tepi menjorok, warna gelap,
   ada **antena tipis** menjulang di tengahnya.
2. **Cincin kaca terbuka** tepat di bawah kanopi (bukan dinding solid).
3. **Badan baja berongga** — rangka vertikal, tangga & inti lift terlihat menembus.
4. **Sirip diagonal** — deretan pita horizontal yang miring ke bawah dan menyebar
   di kedua sisi badan, seperti *pinecone* / tulang ikan. Ini tanda tangan visualnya.
5. **Empat drum silinder** besar sebagai kaki, menopang platform.
6. **Tangga lebar** naik ke platform, taman hijau, dan jalan di depan.

Urutan dari atas ke bawah: antena → cakram → cincin kaca → badan berongga + sirip → 4 drum → tangga & taman.

## 2. Palet warna merek

Palet ini diambil langsung dari `tailwind.config.js` — bukan perkiraan. Semua
gambar produk WAJIB memakai warna ini.

| Peran | Nama | HEX | Token Tailwind |
|---|---|---|---|
| Dominan | Navy | `#1B365D` | `navy-800` |
| Sekunder | Forest | `#2E6F40` / `#255935` | `forest-600` / `forest-700` |
| Aksen | Amber | `#E5A93C` | `amberbrand-400` |
| Netral terang | Krem gading | `#F6F1E6` | (custom) |
| Netral gelap | Arang | `#1A1D22` | (custom) |

### Pembagian peran (jangan dibalik)

- **Navy = 60%** — badan menara, panel latar cetakan, judul teks.
- **Forest green = 25%** — taman, terasering, trim bawah tas, panel aksen.
- **Amber = 5%** — HANYA satu titik fokus: lift, satu garis tipis, satu matahari.
- **Cream = 10%** — garis arsitektural, ruang negatif, teks di atas navy.

**Larangan mutlak:**
- ❌ Merah Tokopedia/Shopee.
- ❌ Gradasi ungu-biru neon.
- ❌ **Biru baja pucat (`#748D9D`), biru langit (`#99D1E2`), teal pudar (`#5F919F`).**
  Ini kesalahan yang pernah terjadi: gambar lama memakai biru-biru ini sehingga
  produk terlihat lepas dari merek.
- ❌ **Khaki, olive, mustard-brown (`#898970`).** Warna ini muncul di tote bag
  versi lama dan membuatnya terlihat kotor.
- ❌ Amber sebagai warna dominan — kesannya jadi murah, bukan premium.

### Cara memeriksa

```bash
# Ambil warna dominan area artwork (sesuaikan crop)
convert gambar.png -crop 340x340+240+250 +repage \
  -resize 40x40 -colors 5 -format "%c" histogram:info: | sort -rn | head -4
```

Hasil yang benar harus didominasi `#1B365D` dan `#2E6F40`. Kalau muncul
`#6B8FA3` atau `#898970`, gambar itu belum ikut merek.

## 3. Tiga gaya grafis yang dipakai

Supaya katalog terasa satu keluarga, hanya tiga gaya ini yang boleh muncul:

### A. Blueprint / Line-art arsitektural
Garis tipis presisi di atas kertas krem atau navy gelap, seperti gambar arsitek.
Kesan: **teknis, premium, tenang**. Dipakai untuk kaos, tote bag, mug.
Detail: garis 1px konsisten, tanpa bayangan, aksen amber hanya di satu titik fokus.

### B. Poster travel retro (flat illustration)
Bidang warna datar, langit bergaris lembut, siluet pohon & awan, tipografi tebal.
Kesan: **hangat, mudah diingat, cocok oleh-oleh**. Dipakai untuk kalender, stiker, payung.
Detail: maksimal 5 warna, tanpa gradasi rumit, sudut membulat.

### C. Fotoreal produk
Foto studio produk sungguhan (AI), latar meja kayu / dinding beton / dapur.
Kesan: **nyata dan bisa dibeli**. Dipakai untuk gambar utama semua produk.
Detail: cahaya jendela lembut dari kiri, kedalaman bidang dangkal.

## 4. Aturan tipografi pada produk

- Nama merek selalu **"CILEGON ENGGIH"** — dua kata, huruf kapital semua.
- Sering dikombinasikan dengan tagar kecil **"SOUVENIR OF CILEGON"**.
- Jangan menulis "Enggih" dengan satu G. Ejaan baku: **ENGGIH**.
- Jangan memakai font script tebal untuk nama merek — pakai sans-serif geometris
  atau serif tajam untuk kesan arsitektural.

## 5. Aturan komposisi

- Menara selalu jadi **titik fokus vertikal**, tidak terpotong.
- Ruang kosong (negative space) minimal 15% di setiap sisi.
- Untuk kaos: cetakan di dada, tinggi maksimal 30 cm, lebar maksimal 28 cm.
- Untuk mug: cetakan membelit, menara di satu sisi penuh.
- Untuk stiker: die-cut mengikuti siluet menara + alas tanah.

## 6. Larangan

- ❌ Mercusuar, obelisk, menara Eiffel, menara TV generik.
- ❌ Menara yang miring atau terlihat akan roboh.
- ❌ Teks yang salah eja atau tidak terbaca.
- ❌ Watermark, tanda tangan, atau logo pihak lain.
- ❌ Mengklaim sebagai foto produk asli (ini render AI).
