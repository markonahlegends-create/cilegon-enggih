# Panduan Admin Info Kelurahan

## Masuk

Buka `/admin`, masukkan nilai `ADMIN_PASSWORD`. Pada lokal awal, password fallback adalah `infokelurahan2026`; jangan gunakan fallback ini di produksi. Atur environment sebelum menyalakan server:

```env
ADMIN_PASSWORD=password-kuat-dan-unik
```

## Menulis dan menerbitkan berita

Buka menu **Berita → Tulis berita**. Isi judul, ringkasan, kategori, path sampul, caption, tag, dan isi berita. Isi berita menerima Markdown ringan: paragraf, `## Subjudul`, `**tebal**`, daftar `-`, tautan `[teks](https://...)`, dan kutipan `>`. Pilih status draf atau terbit. Centang pilihan redaksi atau berita terkini bila diperlukan.

Gambar dapat memakai file lokal di `public/images/` dengan path seperti `/images/musrenbang.jpg`, atau `/covers/pemerintahan.svg`. Pastikan Anda memiliki hak untuk foto yang dipublikasikan.

## Komentar, pesan, agenda

- Komentar warga masuk ke **Komentar** dengan status menunggu. Setujui/tolak/hapus sebelum tampil.
- Pesan pada formulir kontak terlihat di **Pesan masuk**. Tandai telah dibaca setelah ditindaklanjuti.
- Agenda dapat dibuat/dihapus pada menu **Agenda**.
- Kategori dapat ditambah/hapus pada menu **Kategori**.

## Penyimpanan dan backup

Mode lokal menulis ke `server/data/db.json`. Backup file ini secara berkala. Jika memakai Supabase, backup tabel `site_state` dan jangan membagikan service-role key. Untuk deployment serverless, Supabase diperlukan agar perubahan bertahan lintas instance.
