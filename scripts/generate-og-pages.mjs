/**
 * Generator halaman share statis (`og/<slug>.html`) — pengganti middleware.
 *
 * RIWAYAT (penting, jangan diulang):
 * Versi sebelumnya memakai Vercel Routing Middleware yang memanggil
 * `fetch(origin/index.html)` ke origin situs sendiri. Di Vercel langkah itu
 * memicu `500 MIDDLEWARE_INVOCATION_FAILED` untuk SEMUA halaman publik.
 * Fetch ke origin sendiri dari middleware tidak boleh dipakai.
 *
 * PENDEKATAN SEKARANG — tanpa function sama sekali:
 *  1. Skrip ini menulis file HTML kecil yang hanya berisi <head> + meta OG
 *     untuk tiap halaman (/produk/:slug, /katalog, dll).
 *  2. `vercel.json` mengarahkan HANYA crawler (berdasarkan header User-Agent)
 *     ke file itu lewat `rewrites` + `has`. Pengunjung biasa tetap menerima
 *     `/index.html` statis dari CDN.
 *  3. Karena semuanya file statis, tidak ada invocation, tidak ada biaya,
 *     dan tidak ada kemungkinan situs utama ikut mati.
 *
 * Halaman ini juga memuat skrip kecil yang mengarahkan pembaca manusia yang
 * tidak sengaja masuk ke halaman aplikasi sebenarnya.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'og');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

/**
 * User-Agent yang dipakai platform social media & search engine saat mengambil
 * metadata link. Ditulis sebagai satu regex PCRE (dipakai di `has` vercel.json).
 */
/**
 * Regex UA crawler. Ditulis dengan character-class `[Ww]hatsapp` (bukan flag
 * `(?i)`) agar kompatibel dengan mesin regex Vercel (PCRE/RE2). Harus exactly
 * match dengan `CRAWLER_RE_TEST` di scripts/preflight.mjs.
 */
/**
 * Daftar crawler, ditulis sebagai huruf KECIL tanpa pola regex.
 *
 * KENAPA BUKAN POLA MANUAL
 * Versi sebelumnya memakai `[Ww]hatsapp` dan `[Vv][Kk]share`. Pola itu GAGAL
 * cocok dengan User-Agent asli WhatsApp — `WhatsApp/2.23.20.0 A` — karena
 * huruf A pada "WhatsApp" kapital, dan `[Ww]hatsapp` menuntut "hatsapp" huruf
 * kecil semua. Akibatnya WhatsApp selalu menerima index.html (kartu beranda),
 * sehingga link produk yang dibagikan menampilkan gambar toko — bukan foto
 * produk. Gejalanya persis seperti laporan "thumbnail tidak sesuai".
 *
 * `caseInsensitive()` di bawah mengubah tiap huruf menjadi kelas `[aA]`,
 * sehingga `whatsapp` menjadi `[wW][hH][aA][tT][sS][aA][pP][pP]`. Ini tetap
 * kompatibel dengan mesin regex Vercel (tanpa flag `(?i)`), tetapi kebal
 * terhadap perbedaan kapitalisasi.
 */
const caseInsensitive = (literal) =>
  literal
    .split('')
    .map((ch) => (/[a-z]/i.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : ch))
    .join('');

const CRAWLER_NAMES = [
  'whatsapp',
  'facebookexternalhit',
  'facebookcatalog',
  'facebook',
  'facebot',
  'meta-externalagent',
  'instagram',
  'threads',
  'twitterbot',
  'telegrambot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'embedly',
  'pinterest',
  'redditbot',
  'skypeuripreview',
  'applebot',
  'vkshare',
  'nuzzel',
  'mastodon',
  'bluesky',
  'cardyb',
  'line/',
  'viber',
  'kakaotalk',
  'tumblr',
  'quora link preview',
  'pocketparser',
  'buffer',
  'hootsuite',
  'snapchat',
  'iframely',
  'slurp',
  'qwantify',
  'yandexbot',
  'duckduckbot',
  'semrushbot',
  'ahrefsbot',
  'baiduspider',
  'notif'
  /*
   * Googlebot/Bingbot SENGAJA tidak ada di daftar: halaman share diberi
   * header noindex. Bila search engine diarahkan ke sini, halaman produk bisa
   * hilang dari hasil pencarian. Search engine tetap menerima SPA yang sudah
   * punya canonical, sitemap, dan JSON-LD.
   */
];

const CRAWLER_RE = CRAWLER_NAMES.map(caseInsensitive).join('|');

const readMeta = () => {
  const file = path.join(ROOT, 'src', 'data', 'og-meta.json');
  if (!fs.existsSync(file)) {
    console.error('[og-pages] src/data/og-meta.json belum ada — jalankan `npm run og:data` dulu.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Bangun HTML share.
 * @param {{title:string,description:string,image:string,url:string}} meta
 * @param {object} site
 */
const buildHtml = (meta, site) => {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  // Path aplikasi diambil dari URL canonical (mis. /produk/kaos-...).
  const routePath = (() => {
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

    <!-- Open Graph (WhatsApp / Facebook / Telegram) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(site.siteName)}" />
    <meta property="og:locale" content="id_ID" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:type" content="${site.imageType}" />
    <meta property="og:image:width" content="${site.imageWidth}" />
    <meta property="og:image:height" content="${site.imageHeight}" />
    <meta property="og:image:alt" content="${t}" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />

    <!-- Canonical menunjuk URL asli, jadi halaman bantuan ini tidak akan
         dianggap duplikat oleh search engine. -->
    <meta name="robots" content="noindex, follow" />
    <link
      rel="icon"
      type="image/svg+xml"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231B365D'/%3E%3Ctext x='32' y='44' font-family='sans-serif' font-size='30' font-weight='bold' fill='%23E5A93C' text-anchor='middle'%3ECE%3C/text%3E%3C/svg%3E"
    />

    <!-- Pembaca manusia yang tidak sengaja mendarat di halaman crawler
         diarahkan ke aplikasi sebenarnya. Crawler tidak menjalankan ini. -->
    <script>
      if (!/bot|crawler|spider|whatsapp|facebook|telegram|twitter|linkedin|slack|discord|embedly|pinterest/i.test(navigator.userAgent)) {
        window.location.replace(${JSON.stringify(routePath)});
      }
    </script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #1b365d;
        color: #f8faf8;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        padding: 24px;
      }
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

/**
 * Tulis ulang aturan `rewrites` di vercel.json: crawler diarahkan ke file share
 * statis, pengunjung biasa tetap ke index.html (SPA).
 *
 * Aturan dibuat EKSPLISIT per halaman (bukan pola `:slug`), karena bila
 * destination tidak ada, Vercel mengembalikan 404 ke crawler. Dengan aturan
 * eksplisit, produk baru tanpa kartu OG tetap jatuh ke index.html (preview
 * beranda) — tidak pernah 404.
 */
const writeVercelRewrites = (routes) => {
  const cfg = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'));
  const crawlerHas = [{ type: 'header', key: 'user-agent', value: { re: CRAWLER_RE } }];

  /*
   * Content-Type eksplisit untuk halaman share.
   *
   * Tanpa ini Vercel menyajikan berkas .html yang di-rewrite dengan
   * `Cache-Control` default untuk halaman statis, sehingga pratinjau yang
   * sudah terlanjur di-cache WhatsApp/Facebook bisa bertahan lama walau kartu
   * OG-nya sudah diperbaiki. Dengan `must-revalidate` + tipe yang tegas,
   * crawler selalu membaca versi terbaru.
   */
  cfg.headers = (cfg.headers || []).filter((h) => !String(h.source).startsWith('/og/'));

  const shareRules = routes.map(({ route, dest }) => ({
    source: route,
    has: crawlerHas,
    destination: dest
  }));

  // Pertahankan rewrite non-halaman (API) dan catch-all SPA di posisi terakhir.
  const others = (cfg.rewrites || []).filter(
    (r) => r.source.startsWith('/api/') || r.source.startsWith('/((?!')
  );
  const spa = others.filter((r) => r.source.startsWith('/((?!'));
  const api = others.filter((r) => r.source.startsWith('/api/'));

  /*
   * PENANGKAP PRODUK BARU.
   *
   * Halaman statis hanya ada untuk produk yang terdaftar saat build. Produk
   * yang ditambahkan admin sesudahnya (mis. `kaos-edisi-cilegon-enggih`) tidak
   * punya berkas, sehingga crawler jatuh ke index.html dan menampilkan kartu
   * beranda. Aturan di bawah mengarahkan crawler untuk SEMUA produk ke endpoint
   * dinamis — tetapi hanya sebagai CADANGAN, karena posisinya SETELAH aturan
   * statis di atas. Vercel mengevaluasi rewrite dari atas ke bawah, jadi
   * produk yang punya kartu statis tetap memakai berkas (nol invocation).
   */
  /*
   * Catatan pola: `source` memakai `:slug` (path-to-regexp), BUKAN
   * `([^/]+)`. Vercel menolak character class di `source`, dan insiden
   * sebelumnya membuktikan penolakan itu menggagalkan SELURUH deploy.
   * Placeholder diteruskan ke destination sebagai `:slug`.
   */
  const penangkapProduk = {
    source: '/produk/:slug',
    has: crawlerHas,
    destination: '/api/share/produk/:slug'
  };

  cfg.rewrites = [...api, ...shareRules, penangkapProduk, ...spa];

  /*
   * Header aset OG — SENGAJA dikembalikan ke bentuk yang sudah terbukti valid.
   *
   * RIWAYAT (jangan diulang)
   * Percobaan menambah aturan header per-ekstensi gagal di Vercel:
   *   "/og/(.*)\\.html"        → invalid route source pattern (backslash)
   *   "/og/((.*)[.]html)"     → invalid route source pattern juga (char class)
   * Vercel hanya menerima pola sederhana seperti "/og/(.*)" untuk `source`.
   * Karena itu penyaringan ekstensi TIDAK dilakukan di vercel.json.
   *
   * Konsekuensinya HTML halaman share ikut ter-cache panjang. Bila kartu OG
   * berubah (mis. ganti foto produk), pratinjau lama perlu dibersihkan manual:
   * kirim ulang tautan di chat baru (WhatsApp/Telegram) atau Scrape Again di
   * Facebook Sharing Debugger. Ini keterbatasan platform, bukan bug aplikasi.
   */
  cfg.headers = [
    ...cfg.headers.filter((h) => !String(h.source).startsWith('/og/')),
    {
      source: '/og/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
    }
  ];

  fs.writeFileSync(VERCEL_JSON, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
  console.log(`[og-pages] vercel.json: ${shareRules.length} aturan share untuk crawler`);
};

const main = () => {
  const meta = readMeta();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = [
    ...Object.entries(meta.pages || {}),
    ...Object.entries(meta.products || {})
  ];

  const written = [];
  const rules = [];
  for (const [route, pageMeta] of entries) {
    // "/" tidak butuh file khusus: index.html sudah berisi OG beranda.
    if (route === '/') continue;
    const slug = route.replace(/^\//, '').replace(/\//g, '--');
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), buildHtml(pageMeta, meta), 'utf8');
    written.push(`${slug}.html`);

    // Catatan: tidak perlu aturan untuk "/produk/x/". Dengan trailingSlash
    // default (false), Vercel sudah 308-redirect ke "/produk/x" SEBELUM
    // rewrite dievaluasi. Aturan tambahan hanya membuat config membengkak.
    rules.push({ route, dest: `/og/${slug}.html` });
  }

  console.log(`[og-pages] ${written.length} halaman share statis di public/og/`);
  writeVercelRewrites(rules);
  return written;
};

main();
