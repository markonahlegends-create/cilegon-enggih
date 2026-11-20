/**
 * UJI POLA CRAWLER — memastikan halaman share terbaca SEMUA platform.
 *
 * LATAR BELAKANG (audit 20 Nov 2026)
 * vercel.json mengarahkan crawler ke halaman OG statis lewat `has.user-agent`.
 * Pola lamanya `[Ww]hatsapp`, `[Vv][Kk]share`, dst. Dua pola itu salah:
 *   - User-Agent asli WhatsApp adalah `WhatsApp/2.23.20.0 A` (A kapital),
 *     sedangkan `[Ww]hatsapp` menuntut "hatsapp" huruf kecil semua → TIDAK
 *     PERNAH cocok. WhatsApp selalu menerima index.html, sehingga link produk
 *     menampilkan kartu beranda ("thumbnail tidak sesuai").
 *   - `[Vv][Kk]share` menghasilkan `[Vv][Kk]share` yang menuntut "Kk" —
 *     sedangkan UA aslinya `vkShare`.
 *
 * Uji ini memeriksa regex yang BENAR-BENAR ada di vercel.json terhadap daftar
 * User-Agent nyata. Bila ada yang berubah tanpa sengaja, uji gagal.
 *
 * Cara pakai: node scripts/test-crawler-ua.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

let gagal = 0;
const benar = (nama, kondisi, detail = '') => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  OK  ' : '  SALAH'} ${nama}${kondisi ? '' : ` — ${detail}`}`);
};

const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

const aturanCrawler = (vercel.rewrites || []).filter(
  (r) => Array.isArray(r.has) && r.has.some((h) => h.key === 'user-agent')
);

check('ada aturan crawler', aturanCrawler.length > 0, true);

const pola = aturanCrawler[0]?.has?.[0]?.value?.re || '';
check('pola tidak kosong', pola.length > 100, true);

let re;
try {
  re = new RegExp(pola);
} catch (err) {
  console.log(`  SALAH pola regex tidak sah: ${err.message}`);
  process.exit(1);
}

/** User-Agent nyata yang HARUS mendapat halaman OG statis. */
const harusCocok = [
  ['WhatsApp Android (A kapital)', 'WhatsApp/2.23.20.0 A'],
  ['WhatsApp iOS', 'WhatsApp/2.23.20.0 i'],
  ['Facebook', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ['Facebook katalog', 'facebookcatalog/1.0'],
  ['Meta external agent', 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'],
  ['Instagram', 'Instagram 219.0.0.12.117 Android'],
  ['Threads', 'Threads/300.0.0.0.0'],
  ['Twitter / X', 'Twitterbot/1.0'],
  ['Telegram', 'TelegramBot (like TwitterBot)'],
  ['LinkedIn', 'LinkedInBot/1.0 (compatible; Mozilla/5.0)'],
  ['Slack', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  ['Discord', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
  ['Pinterest', 'Pinterest/0.2 (+https://www.pinterest.com/bot.html)'],
  ['Reddit', 'redditbot/1.0'],
  ['Skype', 'Mozilla/5.0 (Windows NT 6.1) SkypeUriPreview Preview/0.5'],
  ['Apple iMessage', 'Applebot/0.1'],
  ['VK', 'vkShare; +http://vk.com/dev/Share'],
  ['Mastodon', 'Mastodon/4.0.0'],
  ['Bluesky', 'Bluesky Cardyb/1.1'],
  ['LINE', 'Line/13.6.0'],
  ['Viber', 'Viber/15.0'],
  ['KakaoTalk', 'KakaoTalk/10.0'],
  ['Tumblr', 'Tumblr/13.0'],
  ['Iframely', 'Iframely/1.3.4'],
  ['Yandex', 'Mozilla/5.0 (compatible; YandexBot/3.0)'],
  ['DuckDuckGo', 'DuckDuckBot/1.0'],
  ['Baidu', 'Baiduspider/2.0']
];

/** User-Agent yang TIDAK boleh diarahkan ke halaman share. */
const harusDitolak = [
  ['Chrome desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'],
  ['Safari iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1'],
  ['Chrome Android', 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'],
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['curl', 'curl/8.4.0']
];

console.log('\n— Harus mendapat halaman OG statis —');
for (const [nama, ua] of harusCocok) {
  check(nama, re.test(ua), true);
}

console.log('\n— Harus tetap menerima SPA —');
for (const [nama, ua] of harusDitolak) {
  check(nama, re.test(ua), false);
}

console.log('\n— Kartu dinamis untuk produk yang ditambahkan admin —');
{
  const penangkap = (vercel.rewrites || []).find(
    (r) => String(r.destination || '').startsWith('/api/share/produk') && Array.isArray(r.has)
  );
  benar('ada aturan cadangan /produk/:slug → /api/share/produk', Boolean(penangkap));
  benar(
    'aturan cadangan memakai pola crawler yang sama',
    penangkap ? penangkap.has[0].value.re === pola : false,
    'pola berbeda → sebagian crawler akan menerima SPA'
  );

  /*
   * Urutan penting: Vercel mengevaluasi rewrite dari atas ke bawah. Aturan
   * statis (destination /og/*.html) harus lebih dulu agar produk katalog tetap
   * dilayani berkas (nol invocation), dan penangkap dinamis setelahnya.
   */
  const idx = (pred) => vercel.rewrites.findIndex(pred);
  const idxStatis = idx((r) => String(r.destination || '').startsWith('/og/'));
  const idxDinamis = idx((r) => String(r.destination || '').startsWith('/api/share/produk'));
  benar(
    'aturan statis dievaluasi sebelum cadangan dinamis',
    idxStatis >= 0 && idxDinamis > idxStatis,
    `statis=${idxStatis}, dinamis=${idxDinamis}`
  );
}

console.log('\n— Konsistensi dengan generator —');
{
  // Semua aturan harus memakai pola yang sama (kalau tidak, sebagian halaman
  // memakai pola lama dan gejalanya kembali pada produk tertentu saja).
  const unik = new Set(aturanCrawler.map((r) => r.has[0].value.re));
  check('semua aturan memakai pola identik', unik.size, 1);

  /*
   * Destination HARUS ada sebagai berkas — kecuali endpoint dinamis
   * (/api/share/produk/:slug), yang memang tidak berupa berkas; keberadaannya
   * diuji terpisah di scripts/test-share-dynamic.mjs.
   */
  const hilang = aturanCrawler.filter((r) => {
    if (String(r.destination || '').startsWith('/api/')) return false;
    const f = path.join(ROOT, 'public', r.destination.replace(/^\//, ''));
    return !fs.existsSync(f);
  });
  check('semua destination ada', hilang.map((r) => r.destination), []);
}

console.log(
  gagal === 0 ? '\n✅ SEMUA UJI CRAWLER LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`
);
process.exit(gagal === 0 ? 0 : 1);
