/**
 * Generator data Open Graph (`src/data/og-meta.json`).
 *
 * Kenapa dipisah jadi JSON:
 *  - `middleware.ts` berjalan di Edge dan **tidak boleh** mengimpor
 *    `src/data/products.ts` (berisi TSX/asset yang tidak bisa di-bundle ke Edge).
 *  - `index.html` juga butuh isi yang sama saat build.
 *  Jadi keduanya membaca satu file JSON kecil ini.
 *
 * Dijalankan otomatis lewat `npm run build` (lihat package.json) dan manual
 * lewat `node scripts/generate-og-data.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOMAIN = (process.env.VITE_STORE_DOMAIN || process.env.STORE_DOMAIN || 'cilegon-enggih.vercel.app')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');
const BASE = `https://${DOMAIN}`;

/** Ambil nilai string pertama untuk sebuah key dari satu blok produk. */
const pick = (chunk, key) => {
  const re = new RegExp(`${key}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`);
  const m = chunk.match(re);
  return m ? m[1].replace(/\\'/g, "'") : null;
};

/**
 * Ringkas deskripsi panjang jadi ~150 karakter yang enak dibaca di chat.
 * Diutamakan berhenti di akhir kalimat/koma supaya tidak terpotong di tengah
 * kata ("Cotton…").
 */
const summarize = (text, max = 150) => {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const window = clean.slice(0, max + 30);
  const sentence = window.search(/[.!?](\s|$)/);
  if (sentence > 60) return window.slice(0, sentence + 1).trim();
  const comma = window.lastIndexOf(', ');
  if (comma > 90) return `${clean.slice(0, comma).trimEnd()}.`;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max).trimEnd()}…`;
};

const readProducts = () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const PRODUCTS: Product[] = ['));
  const chunks = body.split(/\n  \{\n/).slice(1);
  const products = [];

  for (const chunk of chunks) {
    const id = pick(chunk, 'id');
    const slug = pick(chunk, 'slug');
    if (!id || !slug) continue;
    const name = pick(chunk, 'name');
    const shortName = pick(chunk, 'shortName');
    const categoryLabel = pick(chunk, 'categoryLabel');
    const priceRangeText = pick(chunk, 'priceRangeText');
    const description = pick(chunk, 'description');

    const ogImage = `${BASE}/og/${slug}.jpg`;
    const title = `${shortName || name} | Cilegon Enggih`;
    // Sertakan rentang harga supaya pembaca chat langsung tahu kisaran harga.
    const priceSuffix = priceRangeText ? ` ${priceRangeText}.` : '';
    const description155 = `${summarize(description || name, 120).replace(/[.…]+$/, '')}.${priceSuffix}`;

    products.push({
      slug,
      id,
      name,
      title: title.length > 70 ? `${(shortName || name).slice(0, 55)}… | Cilegon Enggih` : title,
      description: description155 || `${name}.${price} Oleh-oleh resmi khas Kota Cilegon.`,
      category: categoryLabel || 'Oleh-Oleh & Merchandise',
      priceRange: priceRangeText || '',
      image: ogImage,
      url: `${BASE}/produk/${slug}`
    });
  }
  return products;
};

const build = () => {
  const products = readProducts();

  /** Metadata halaman statis (selain produk). */
  const pages = {
    '/': {
      title: 'Cilegon Enggih | Oleh-Oleh & Merchandise Khas Kota Cilegon',
      description:
        'Merchandise resmi & oleh-oleh modern khas Cilegon. Kaos, mug, tumbler, tote bag, souvenir. Guest checkout, transfer bank / QRIS, kirim GoSend/JNE/J&T/SiCepat.',
      image: `${BASE}/og/toko-cilegon-enggih.jpg`,
      url: `${BASE}/`
    },
    '/katalog': {
      title: 'Katalog Produk | Cilegon Enggih',
      description:
        'Lihat semua merchandise dan oleh-oleh khas Cilegon: kaos distro, mug keramik, tumbler, tote bag, payung, gantungan kunci, dan paket hemat.',
      image: `${BASE}/og/toko-cilegon-enggih.jpg`,
      url: `${BASE}/katalog`
    },
    '/custom-korporat': {
      title: 'Custom Merchandise & Souvenir Korporat | Cilegon Enggih',
      description:
        'Pesan souvenir korporat custom: hardbox eksekutif, tote bag, tumbler, dan paket souvenir dengan logo instansi Anda. Melayani seluruh Indonesia.',
      image: `${BASE}/og/cilegon-enggih-toko.jpg`,
      url: `${BASE}/custom-korporat`
    },
    '/tentang-kami': {
      title: 'Tentang Cilegon Enggih | CV Cilegon Enggih Kreatif',
      description:
        'Kami memproduksi oleh-oleh dan merchandise modern khas Kota Cilegon — Khas Kota Baja, Bangga Membawanya.',
      image: `${BASE}/og/cilegon-enggih-toko.jpg`,
      url: `${BASE}/tentang-kami`
    },
    '/cara-order-faq': {
      title: 'Cara Order & FAQ | Cilegon Enggih',
      description:
        'Panduan cara memesan di Cilegon Enggih: pilih produk, checkout tanpa daftar akun, transfer bank atau QRIS, lalu lacak pesanan dengan nomor order.',
      image: `${BASE}/og/cilegon-enggih-toko.jpg`,
      url: `${BASE}/cara-order-faq`
    },
    '/lacak-pesanan': {
      title: 'Lacak Pesanan | Cilegon Enggih',
      description: 'Lacak status dan nomor resi pesanan Anda di Cilegon Enggih.',
      image: `${BASE}/og/cilegon-enggih-toko.jpg`,
      url: `${BASE}/lacak-pesanan`
    },
    '/legalitas': {
      title: 'Legalitas & Kebijakan | Cilegon Enggih',
      description:
        'Informasi legalitas CV Cilegon Enggih Kreatif, kebijakan privasi, pengiriman, retur, dan syarat ketentuan.',
      image: `${BASE}/og/cilegon-enggih-toko.jpg`,
      url: `${BASE}/legalitas`
    }
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    domain: DOMAIN,
    baseUrl: BASE,
    defaultImage: `${BASE}/og/toko-cilegon-enggih.jpg`,
    fallbackImage: `${BASE}/og/cilegon-enggih-toko.jpg`,
    imageWidth: 1200,
    imageHeight: 630,
    imageType: 'image/jpeg',
    siteName: 'Cilegon Enggih Official Store',
    pages,
    products: Object.fromEntries(products.map((p) => [`/produk/${p.slug}`, p]))
  };

  const dest = path.join(ROOT, 'src', 'data', 'og-meta.json');
  fs.writeFileSync(dest, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(
    `[og] og-meta.json: ${Object.keys(pages).length} halaman + ${products.length} produk → ${BASE}`
  );
  return payload;
};

const payload = build();
export default payload;
