/**
 * PEMULIHAN ASET BASI — menyembuhkan "halaman tampil tanpa gaya".
 *
 * GEJALA
 * Halaman muncul sebagai HTML mentah: teks biru bergaris bawah tanpa tata
 * letak, logo SVG raksasa memenuhi layar. Terjadi hanya di SATU profil
 * peramban, padahal profil lain di komputer yang sama normal.
 *
 * SEBABNYA
 * Peramban memakai dokumen HTML dari cache/diska. HTML itu menunjuk berkas
 * `/assets/index-<hash>.css` dan `.js` dari build LAMA. Setelah deploy baru,
 * berkas ber-hash lama sudah tidak ada di server — jadi CSS tidak pernah
 * termuat, dan halaman tampil apa adanya tanpa gaya.
 *
 * Mengapa hanya di satu profil: profil itu pernah membuka versi lama dan
 * menyimpannya; profil baru selalu mengambil HTML terbaru. Inilah kenapa
 * gejalanya "aneh" dan sulit dipercaya saat pertama dilaporkan.
 *
 * DUA LAPIS PERBAIKAN
 *
 *   1. PENCEGAHAN (sisi server, sudah dilakukan): dokumen HTML sekarang
 *      `Cache-Control: no-cache, must-revalidate`, sehingga peramban selalu
 *      memvalidasi HTML ke server dan tidak bisa memakai HTML basi. Aset
 *      tetap `immutable` karena namanya ber-hash.
 *
 *   2. PENYEMBUHAN (berkas ini): untuk peramban yang SUDAH terlanjur
 *      menyimpan HTML basi — termasuk milik pemilik toko sekarang — kita
 *      tidak bisa mengandalkan mereka membersihkan cache manual. Jadi saat
 *      CSS ternyata tidak terpasang, halaman memuat ulang SEKALI dengan
 *      penanda yang melewati cache.
 *
 * PENJAGA
 * Pemulihan hanya dilakukan SEKALI per sesi. Tanpa penjaga itu, kegagalan
 * CSS karena sebab lain (mis. gangguan jaringan) akan memicu muat ulang
 * berulang tanpa henti — dan itu jauh lebih buruk daripada halaman tanpa gaya.
 */

const KUNCI = 'ce-pulih-aset';
const TANDA = 'ce_pulih=1';

/** Apakah dokumen ini dimuat sebagai bagian dari pemulihan? */
const sedangPulih = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('ce_pulih') === '1';
  } catch {
    return false;
  }
};

/**
 * Apakah CSS benar-benar terpasang?
 *
 * Diperiksa dari CSSOM, bukan dari ada/tidaknya tag <link>. Tag <link> tetap
 * ada walaupun berkasnya gagal dimuat (404) — jadi keberadaan tag tidak
 * membuktikan apa pun. Stylesheet yang gagal dimuat tidak muncul di
 * `document.styleSheets` sebagai aturan yang bisa dibaca.
 */
export const cssTerpasang = (): boolean => {
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      /* Stylesheet dari origin lain akan melempar saat `cssRules` dibaca. */
      try {
        const aturan = sheet.cssRules;
        if (aturan && aturan.length > 0) return true;
      } catch {
        /* lintas-origin: bukan stylesheet kita, lewati */
      }
    }
    return false;
  } catch {
    /* Kalau tidak bisa diperiksa, jangan memicu muat ulang. */
    return true;
  }
};

/** Muat ulang melewati cache, sekali saja. */
export const pulihkanSekali = (): boolean => {
  try {
    if (sessionStorage.getItem(KUNCI) === '1') return false;
    sessionStorage.setItem(KUNCI, '1');

    const url = new URL(window.location.href);
    url.searchParams.set('ce_pulih', '1');
    /*
     * `location.replace` dipakai supaya halaman rusak tidak masuk riwayat —
     * kalau masuk, tombol "kembali" pembeli akan mengembalikannya ke layar
     * tanpa gaya.
     */
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
};

/**
 * Dipanggil sekali saat modul dimuat, SEBELUM React menulis apa pun.
 *
 * Penundaan kecil dipakai supaya peramban sempat mencoba memuat stylesheet
 * lebih dulu; memeriksa terlalu awal akan salah menyimpulkan bahwa CSS gagal.
 */
export const periksaAsetSekali = () => {
  if (typeof window === 'undefined') return;

  const jalankan = () => {
    if (cssTerpasang()) return;
    pulihkanSekali();
  };

  if (document.readyState === 'complete') {
    window.setTimeout(jalankan, 300);
  } else {
    window.addEventListener('load', () => window.setTimeout(jalankan, 300), { once: true });
  }
};

/**
 * Membersihkan penanda setelah pemulihan berhasil.
 *
 * Tanpa ini, sesi tetap dianggap "sudah pernah dipulihkan" sampai tab
 * ditutup. Akibatnya, kalau masalah yang sama muncul lagi esok hari di tab
 * baru, pemulihan tidak akan dicoba — pembeli terjebak di halaman tanpa gaya.
 */
export const hapusAsetBasi = () => {
  try {
    if (!sedangPulih()) {
      sessionStorage.removeItem(KUNCI);
      return;
    }
    /*
     * Kita baru saja melewati pemulihan. Kalau CSS sekarang terpasang,
     * penanda boleh dihapus; kalau TIDAK, penanda dibiarkan supaya tidak
     * terjadi muat ulang tanpa henti.
     */
    const tunggu = () => {
      if (cssTerpasang()) sessionStorage.removeItem(KUNCI);
    };
    if (document.readyState === 'complete') window.setTimeout(tunggu, 500);
    else window.addEventListener('load', () => window.setTimeout(tunggu, 500), { once: true });
  } catch {
    /* mode privat: abaikan */
  }
};
