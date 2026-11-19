/**
 * Validator `vercel.json` — dijalankan sebelum build & oleh preflight.
 *
 * LATAR BELAKANG (insiden nyata)
 * Dua kali deployment produksi gagal total karena pola `source` yang tidak sah:
 *
 *   1. "source": "/og/*.jpg"      → Vercel: invalid source pattern
 *   2. "source": "/og/(.*)\\.jpg" → Vercel: invalid source pattern
 *
 * Keduanya lolos dari pengujian saya karena yang diuji hanya *logika
 * pencocokan path* di Node, bukan *validasi skema* milik Vercel. Skrip ini
 * menutup celah itu: memeriksa aturan yang benar-benar ditegakkan Vercel,
 * sebelum konfigurasi sempat di-commit.
 *
 * Cara pakai:
 *   node scripts/validate-vercel-config.mjs
 *   (juga otomatis lewat `npm run build`)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'vercel.json');

const errors = [];
const warnings = [];

const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/* ------------------------------------------------------------------ */
/* Aturan pola `source` (path-to-regexp ala Vercel)                    */
/* ------------------------------------------------------------------ */

/**
 * `source` di Vercel memakai path-to-regexp, BUKAN regex bebas.
 * Yang diizinkan: literal path, parameter `:name`, wildcard `:name*`,
 * dan grup regex di dalam kurung `(.*)`.
 */
const validateSource = (source, where) => {
  if (typeof source !== 'string' || source.length === 0) {
    err(`${where}: "source" wajib berupa string yang tidak kosong.`);
    return;
  }

  if (!source.startsWith('/')) {
    err(`${where}: "source" harus diawali "/" — ditemukan "${source}".`);
  }

  // Backslash: penyebab langsung insiden. Path-to-regexp tidak menerima escape.
  if (source.includes('\\')) {
    err(
      `${where}: "source" mengandung backslash ("${source}"). ` +
        `Vercel menolak escape seperti "\\." — gunakan "/og/(.*)" lalu saring di dalam kurung.`
    );
  }

  // Bintang telanjang hanya sah sebagai bagian dari `:param*`.
  // Grup bersarang seperti "((?!api/).*)" harus dihapus utuh, bukan hanya
  // bagian dalamnya — kalau tidak, pola catch-all yang sah ikut tertandai.
  const stripGroups = (input) => {
    let out = '';
    let depth = 0;
    for (const ch of input) {
      if (ch === '(') {
        depth += 1;
        continue;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth === 0) out += ch;
    }
    return out;
  };
  const withoutGroups = stripGroups(source).replace(/:[A-Za-z_][A-Za-z0-9_]*\*/g, '');
  if (withoutGroups.includes('*')) {
    err(
      `${where}: "source" memakai glob "*" di luar grup ("${source}"). ` +
        `Glob hanya sah di "destination"/"rewrites", bukan "source". ` +
        `Gunakan bentuk "(.*)": contoh "/og/(.*)".`
    );
  }

  // Kurung tidak seimbang.
  const open = (source.match(/\(/g) || []).length;
  const close = (source.match(/\)/g) || []).length;
  if (open !== close) {
    err(`${where}: tanda kurung pada "source" tidak seimbang ("${source}").`);
  }
};

/** Regex pada `has`/`missing` harus bisa dikompilasi. */
const validateHas = (has, where) => {
  if (has === undefined) return;
  if (!Array.isArray(has)) {
    err(`${where}: "has" harus berupa array.`);
    return;
  }
  has.forEach((cond, i) => {
    if (!cond || typeof cond !== 'object') {
      err(`${where}: has[${i}] bukan objek.`);
      return;
    }
    if (!['header', 'cookie', 'host', 'query'].includes(cond.type)) {
      err(`${where}: has[${i}].type harus header|cookie|host|query (ditemukan "${cond.type}").`);
    }
    if (!cond.key && cond.type !== 'host') {
      err(`${where}: has[${i}].key wajib diisi untuk type "${cond.type}".`);
    }
    const value = cond.value;
    const re =
      typeof value === 'string' ? null : value && typeof value === 'object' ? value.re : null;
    if (re) {
      try {
        new RegExp(re);
      } catch (e) {
        err(`${where}: has[${i}].value.re bukan regex yang valid — ${e.message}`);
      }
      // Flag inline (?i) tidak didukung mesin regex Vercel.
      if (re.includes('(?i)')) {
        err(
          `${where}: has[${i}].value.re memakai flag inline "(?i)" yang tidak didukung. ` +
            `Gunakan character-class, mis. "[Ww]hatsapp".`
        );
      }
    }
  });
};

/* ------------------------------------------------------------------ */
/* Validasi utama                                                      */
/* ------------------------------------------------------------------ */

const main = () => {
  if (!fs.existsSync(CONFIG)) {
    err('vercel.json tidak ditemukan di root project.');
    return report();
  }

  let cfg;
  try {
    // JSON ketat: komentar & trailing comma akan gagal di sini — sama seperti Vercel.
    cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));
  } catch (e) {
    err(`vercel.json bukan JSON yang valid: ${e.message}`);
    return report();
  }

  /* --- rewrites --- */
  const rewrites = Array.isArray(cfg.rewrites) ? cfg.rewrites : [];
  rewrites.forEach((rule, i) => {
    const where = `rewrites[${i}]`;
    validateSource(rule.source, where);
    validateHas(rule.has, where);
    if (typeof rule.destination !== 'string' || !rule.destination) {
      err(`${where}: "destination" wajib diisi.`);
    }
    // Tujuan berupa file statis harus benar-benar ada.
    if (typeof rule.destination === 'string' && rule.destination.startsWith('/og/')) {
      const file = path.join(ROOT, 'public', rule.destination);
      if (!fs.existsSync(file)) {
        err(
          `${where}: destination "${rule.destination}" tidak ada di public/. ` +
            `Crawler akan menerima 404 — jalankan "npm run og:pages".`
        );
      }
    }
  });

  // Catch-all SPA harus paling akhir, kalau tidak halaman lain tak terjangkau.
  const last = rewrites[rewrites.length - 1];
  if (last && !last.source.includes('(?!')) {
    warn(
      `rewrites: aturan terakhir "${last.source}" bukan catch-all SPA. ` +
        `Pastikan halaman aplikasi tetap terjangkau.`
    );
  }

  /* --- headers --- */
  const headers = Array.isArray(cfg.headers) ? cfg.headers : [];
  headers.forEach((rule, i) => {
    const where = `headers[${i}]`;
    validateSource(rule.source, where);
    validateHas(rule.has, where);
    if (!Array.isArray(rule.headers) || rule.headers.length === 0) {
      err(`${where}: "headers" wajib berisi minimal satu pasangan key/value.`);
    }
  });

  /*
   * --- CSP: domain yang dipakai browser harus diizinkan ---
   *
   * INSIDEN NYATA (19 Nov 2026): unggah video gagal dengan "Failed to fetch".
   * Penyebabnya `connect-src 'self'` — browser memblokir PUT langsung ke
   * Supabase Storage SEBELUM request terkirim, tanpa kode status. Semua
   * pemeriksaan lain lolos, jadi gejalanya menyesatkan.
   *
   * Pemeriksaan ini memastikan: begitu aplikasi memakai Supabase (unggah
   * video langsung dari browser, foto, video produk), CSP mengizinkan
   * domainnya — kalau tidak, build memberi PERINGATAN.
   */
  const cspHeader = headers
    .flatMap((rule) => (Array.isArray(rule.headers) ? rule.headers : []))
    .find((h) => String(h.key || '').toLowerCase() === 'content-security-policy');

  // Apakah aplikasi ini memang memakai Supabase?
  const usesSupabase = Boolean(
    process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      // Fallback: cari jejak Supabase di kode, karena build lokal biasanya
      // tidak menyetel env produksi.
      fs.existsSync(path.join(ROOT, 'server', 'storage.js'))
  );

  if (cspHeader && usesSupabase) {
    const value = String(cspHeader.value || '');

    // Ambil isi satu direktif CSP, mis. "connect-src 'self' https://x".
    const directive = (name) => {
      const re = new RegExp('(?:^|;)\\s*' + name + '\\s+([^;]*)', 'i');
      const m = re.exec(value);
      return m ? m[1].trim() : null;
    };

    // Apakah daftar sumber mengizinkan Supabase (wildcard, host persis, atau https:)?
    const allowsSupabase = (list) =>
      list
        .split(/\s+/)
        .filter(Boolean)
        .some((tok) => {
          if (tok === 'https:') return true;
          if (!tok.startsWith('https://')) return false;
          const host = tok.slice('https://'.length);
          return host === '*.supabase.co' || host.endsWith('.supabase.co');
        });

    const connectSrc = directive('connect-src');
    if (connectSrc !== null && !allowsSupabase(connectSrc)) {
      warn(
        'CSP connect-src ("' +
          connectSrc +
          '") belum mengizinkan Supabase. Unggah video langsung ke Supabase Storage ' +
          'akan DIBLOKIR browser dengan "Failed to fetch" tanpa kode status. ' +
          'Tambahkan https://*.supabase.co pada connect-src.'
      );
    }

    const mediaSrc = directive('media-src');
    if (mediaSrc === null) {
      warn(
        'CSP tidak punya media-src, sehingga default-src berlaku dan video produk ' +
          'dari Supabase tidak bisa diputar di halaman detail. ' +
          "Tambahkan: media-src 'self' blob: https://*.supabase.co"
      );
    } else if (!allowsSupabase(mediaSrc)) {
      warn(
        'CSP media-src ("' + mediaSrc + '") belum mengizinkan Supabase — video produk tidak bisa diputar.'
      );
    }
  }

  /* --- redirects --- */
  const redirects = Array.isArray(cfg.redirects) ? cfg.redirects : [];
  redirects.forEach((rule, i) => {
    validateSource(rule.source, `redirects[${i}]`);
    validateHas(rule.has, `redirects[${i}]`);
  });

  /* --- cron --- */
  const crons = Array.isArray(cfg.crons) ? cfg.crons : [];
  crons.forEach((c, i) => {
    if (!c.path || !c.schedule) err(`crons[${i}]: "path" dan "schedule" wajib diisi.`);
  });

  return report();
};

const report = () => {
  for (const w of warnings) console.warn(`⚠️  ${w}`);

  if (errors.length) {
    console.error('\n❌ vercel.json TIDAK VALID — build dibatalkan.\n');
    errors.forEach((e, i) => console.error(`   ${i + 1}. ${e}`));
    console.error(
      '\nKonfigurasi ini akan ditolak Vercel sebelum build dimulai ' +
        '(gejala: deployment tidak pernah muncul, tanpa Build Logs).\n'
    );
    process.exit(1);
  }

  const n = (Array.isArray(JSON.parse(fs.readFileSync(CONFIG, 'utf-8')).rewrites)
    ? JSON.parse(fs.readFileSync(CONFIG, 'utf-8')).rewrites.length
    : 0);
  console.log(`✅ vercel.json valid (${n} rewrites diperiksa)`);
};

main();
