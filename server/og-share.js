/**
 * KARTU SHARE (Open Graph) — satu sumber untuk crawler dinamis & halaman statis.
 *
 * MASALAH YANG DISELESAIKAN
 * Halaman share statis (`public/og/*.html`) hanya dibuat saat BUILD, dari
 * katalog di `src/data/products.ts`. Produk yang ditambahkan admin sesudahnya
 * — seperti `kaos-edisi-cilegon-enggih` — tidak punya halaman share. Ketika
 * tautannya dibagikan, crawler menerima `index.html` dan menampilkan kartu
 * beranda ("thumbnail tidak sesuai"), dan Scrape Again di Facebook Debugger
 * tidak menolong karena tidak ada kartu untuk produk itu.
 *
 * SOLUSI
 * Endpoint `GET /api/share` membangun HTML kartu langsung dari database.
 * `vercel.json` mengarahkan crawler ke sana HANYA untuk produk yang tidak
 * punya berkas statis, sehingga:
 *   - produk katalog lama  → tetap file statis (nol invocation, nol biaya)
 *   - produk baru dari admin → endpoint dinamis (selalu ikut database)
 *
 * Modul ini juga dipakai `scripts/generate-og-data.mjs` untuk ringkasan
 * deskripsi, supaya teks di kartu statis dan dinamis tidak pernah berbeda.
 */

/** Panjang maksimum deskripsi yang nyaman di pratinjau chat. */
export const OG_DESC_MAX = 150;

/**
 * Ringkas deskripsi jadi ~150 karakter yang enak dibaca di chat.
 * Diutamakan berhenti di akhir kalimat/koma supaya tidak terpotong di tengah
 * kata ("Cotton…").
 */
export const summarize = (text, max = OG_DESC_MAX) => {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const jendela = clean.slice(0, max + 30);
  const kalimat = jendela.search(/[.!?](\s|$)/);
  if (kalimat > 60) return jendela.slice(0, kalimat + 1).trim();
  const koma = jendela.lastIndexOf(', ');
  if (koma > 90) return `${clean.slice(0, koma).trimEnd()}.`;
  const potong = clean.slice(0, max);
  const spasi = potong.lastIndexOf(' ');
  return `${potong.slice(0, spasi > 60 ? spasi : max).trimEnd()}…`;
};

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * URL gambar lewat PROXY NORMALISASI.
 *
 * KENAPA PERLU
 * Foto produk asli bentuknya bermacam-macam: 1086x1448 (portrait),
 * 1920x1280, 1000x667, bahkan > 400 KB. WhatsApp dan Facebook sangat rewel
 * soal gambar pratinjau — berkas portrait ekstrem, dimensi yang tidak sama
 * dengan yang dideklarasikan di `og:image:width/height`, atau berkas gemuk
 * sering dibuang tanpa pesan error, sehingga tautan tampil tanpa thumbnail.
 *
 * Endpoint `/api/og-image` merapikan semuanya ke satu bentuk yang sudah
 * terbukti diterima crawler: JPEG sRGB 1200x630 (rasio 1,91:1), di bawah
 * ~300 KB, dengan `Content-Length` yang pasti.
 *
 * Sumber gambar SELALU foto utama produk (`product.image`); kartu templat
 * hanya dipakai bila produk benar-benar tidak punya foto.
 */
export const ogImageUrl = (base, product) => {
  const slug = String(product?.slug || '').trim();
  if (!slug) return '';
  return `${base}/api/og-image/${encodeURIComponent(slug)}.jpg`;
};

/** Kartu toko bawaan — dipakai halaman non-produk dan sebagai cadangan terakhir. */
export const TOKO_IMAGE = '/og/toko-cilegon-enggih.jpg';

/**
 * Susun metadata kartu untuk satu produk.
 *
 * @param {object} product  dokumen produk dari database
 * @param {string} base     origin toko, mis. https://cilegon-enggih.vercel.app
 */
/** metaProduk bisa sinkron (generator statis) atau async (bila pickImage async). */
export const metaProduk = (product, base, pickImage = null) => {
  const slug = String(product.slug || '').trim();
  const nama = String(product.shortName || product.name || 'Produk').trim();
  const judul = `${nama} | Cilegon Enggih`;

  const hargaMin = Number(product.price) || 0;
  const hargaVarian = Array.isArray(product.variants)
    ? product.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const semua = [hargaMin, ...hargaVarian].filter((n) => n > 0);
  const rentang = product.priceRangeText
    ? String(product.priceRangeText)
    : semua.length > 1
      ? `Rp ${Math.min(...semua).toLocaleString('id-ID')} – Rp ${Math.max(...semua).toLocaleString('id-ID')}`
      : semua.length === 1
        ? `Rp ${semua[0].toLocaleString('id-ID')}`
        : '';

  const deskripsiDasar = summarize(product.description || product.name || nama, 120).replace(
    /[.…]+$/,
    ''
  );
  const deskripsi = `${deskripsiDasar}.${rentang ? ` ${rentang}.` : ''}`;

  /*
   * GAMBAR KARTU — SUMBERNYA FOTO UTAMA PRODUK.
   *
   * Riwayat (jangan diulang): versi sebelumnya mendahulukan kartu templat
   * `/og/<slug>.jpg`, sehingga produk lama yang kartunya sudah usang tetap
   * menampilkan gambar lama, dan produk baru (tanpa kartu) memakai foto
   * mentah yang dimensinya tidak cocok dengan `og:image:width/height`.
   * Keduanya bikin crawler membuang pratinjau tanpa pesan error.
   *
   * Sekarang: foto utama → `/api/og-image/<slug>.jpg` (dinormalisasi
   * 1200x630). `pickImage` hanya menentukan apakah endpoint itu bisa
   * melayani produk ini (mis. foto belum ada).
   */
  const kartu = `${base}/og/${slug}.jpg`;
  const foto = String(product.image || '').trim();
  const fotoAbsolut = foto.startsWith('http') ? foto : foto ? `${base}${foto}` : '';
  const toko = `${base}${TOKO_IMAGE}`;
  const normal = slug ? ogImageUrl(base, product) : '';

  /*
   * `pickImage` boleh diisi pemanggil yang sudah memeriksa ketersediaan foto.
   * Boleh mengembalikan Promise — hasilnya diselesaikan di bawah.
   */
  const pilihanGambar =
    typeof pickImage === 'function'
      ? pickImage({ kartu, foto: fotoAbsolut, toko, normal, slug, product })
      : normal || fotoAbsolut || toko;

  const hasil = {
    slug,
    title: judul.length > 70 ? `${nama.slice(0, 55)}… | Cilegon Enggih` : judul,
    description: deskripsi,
    image: pilihanGambar,
    /*
     * Dimensi WAJIB cocok dengan berkas yang benar-benar dikirim. Endpoint
     * normalisasi selalu menghasilkan 1200x630; bila yang dipakai foto mentah
     * atau kartu toko, dimensinya tidak diketahui dengan pasti sehingga
     * dibiarkan kosong (lebih aman daripada salah).
     */
    imageWidth: 0,
    imageHeight: 0,
    imageFallback: fotoAbsolut || toko,
    url: `${base}/produk/${slug}`,
    priceRange: rentang,
    category: product.categoryLabel || 'Oleh-Oleh & Merchandise'
  };

  // pickImage async → kembalikan Promise dengan objek yang sudah final.
  if (pilihanGambar && typeof pilihanGambar.then === 'function') {
    /*
     * `image` WAJIB ditimpa dengan hasil Promise-nya. Tanpa `image: gambar`,
     * objek hasil masih menyimpan Promise di bidang `image`, dan HTML kartu
     * mencetaknya sebagai "[object Promise]" — crawler tidak menemukan gambar.
     */
    return pilihanGambar.then((gambar) => ({
      ...hasil,
      image: gambar,
      ...ukuranGambar(gambar, base, normal)
    }));
  }
  return { ...hasil, ...ukuranGambar(pilihanGambar, base, normal) };
};

/**
 * Tentukan dimensi yang boleh dideklarasikan untuk sebuah URL gambar.
 * Hanya endpoint normalisasi yang dimensinya DIJAMIN 1200x630.
 */
const ukuranGambar = (url, base, normal) => {
  if (url && normal && url === normal) return { imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' };
  if (url && String(url).startsWith(base) && String(url).includes('/og/')) {
    // Kartu templat yang di-commit ke repo memang 1200x630.
    return { imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' };
  }
  return { imageWidth: 0, imageHeight: 0, imageType: '' };
};

/**
 * HTML kartu share.
 *
 * Isinya sengaja ringan: hanya <head> + satu blok teks. Pembaca manusia yang
 * tidak sengaja mendarat di sini diarahkan ke halaman aplikasi.
 */
/**
 * Bangun HTML kartu share.
 *
 * Menerima `meta` hasil `metaProduk()`. Karena `metaProduk` bisa mengembalikan
 * Promise (saat `pickImage` async), fungsi ini menerima keduanya dan
 * menunggu hasilnya lebih dulu. Tanpa penanganan itu, `meta.image` yang masih
 * Promise akan tercetak sebagai "[object Promise]" di `og:image` — crawler
 * lalu tidak menemukan gambar sama sekali.
 */
export const buildShareHtml = (metaAtauPromise, opsi = {}) => {
  if (metaAtauPromise && typeof metaAtauPromise.then === 'function') {
    return metaAtauPromise.then((meta) => renderShareHtml(meta, opsi));
  }
  return renderShareHtml(metaAtauPromise, opsi);
};

const renderShareHtml = (meta, { siteName = 'Cilegon Enggih Official Store' } = {}) => {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  const route = (() => {
    try {
      return new URL(meta.url).pathname;
    } catch {
      return '/';
    }
  })();

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:locale" content="id_ID" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
${
  meta.imageType
    ? `    <meta property="og:image:type" content="${escapeHtml(meta.imageType)}" />
    <meta property="og:image:width" content="${meta.imageWidth}" />
    <meta property="og:image:height" content="${meta.imageHeight}" />
`
    : ''
}    <meta property="og:image:alt" content="${t}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />

    <meta name="robots" content="noindex, follow" />
    <script>
      if (!/bot|crawler|spider|whatsapp|facebook|telegram|twitter|linkedin|slack|discord|embedly|pinterest|instagram|threads|line|viber|kakao/i.test(navigator.userAgent)) {
        window.location.replace(${JSON.stringify(route)});
      }
    </script>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #1b365d; color: #f8faf8; text-align: center; padding: 24px;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      a { color: #e5a93c; }
      img { max-width: 100%; border-radius: 12px; margin-bottom: 16px; }
    </style>
  </head>
  <body>
    <main>
      <img src="${img}" alt="${t}" width="600" height="315" />
      <h1 style="font-size: 20px; margin: 0 0 8px">${t}</h1>
      <p style="color: #98b9dc; font-size: 14px; max-width: 520px; margin: 0 auto 16px">${d}</p>
      <p><a href="${url}">Buka halaman &rarr;</a></p>
    </main>
  </body>
</html>
`;
};
