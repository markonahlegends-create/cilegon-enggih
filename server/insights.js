/**
 * Modul analitik trafik & konversi.
 *
 * FILOSOFI DATA
 * Tujuan modul ini bukan mengumpulkan data pribadi, melainkan menjawab
 * pertanyaan bisnis: produk mana yang harus diproduksi lebih banyak,
 * ke daerah mana promosi diarahkan, dan jam berapa orang paling aktif.
 *
 * Karena itu:
 *   • Tidak ada nama/HP/email di event — hanya path, produk, dan durasi.
 *   • Pengunjung unik dihitung dari hash IP harian (SHA-256 + salt),
 *     bukan IP mentah, dan hash itu dibuang setelah 30 hari.
 *   • Lokasi & demografi diambil dari pesanan yang SUDAH ada
 *     (zona pengiriman), bukan dari pelacakan tambahan.
 */

import crypto from 'node:crypto';

/** Jenis event yang diterima. Selain ini diabaikan (mencegah data sampah). */
export const EVENT_TYPES = new Set([
  'page_view',
  'product_view',
  'add_to_cart',
  'checkout_start',
  'search',
  'share'
]);

const SALT =
  process.env.ANALYTICS_SALT ||
  process.env.ADMIN_TOKEN_SECRET ||
  'cilegon-enggih-analytics-default-salt';

/**
 * Hash harian untuk menghitung pengunjung unik tanpa menyimpan IP.
 * Hasilnya berubah setiap hari, sehingga tidak bisa dipakai melacak
 * seseorang lintas hari, dan hilang sama sekali setelah IP asli dibuang.
 */
export const dailyVisitorHash = (ip, day) => {
  // Fallback bila IP tidak tersedia (mis. server lokal tanpa reverse proxy):
  // tetap hasilkan hash agar statistik pengunjung unik tidak selalu nol.
  // Nilainya konstan per hari, jadi hanya berarti "ada kunjungan", bukan
  // menghitung orang — tidak menyalahi prinsip privasi.
  const basis = ip && ip !== 'unknown' ? ip : 'tanpa-ip';
  return crypto
    .createHash('sha256')
    .update(`${day}|${basis}|${SALT}`)
    .digest('hex')
    .slice(0, 16);
};

/** Tanggal lokal toko (WIB = UTC+7), bukan UTC — supaya "hari ramai" akurat. */
export const storeDay = (date = new Date()) => {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
};

export const storeHour = (date = new Date()) => {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return wib.getUTCHours();
};

/**
 * Daftar kode kampanye yang dibuat lewat alat "Buat link kampanye" di dashboard.
 *
 * Kalau parameter `?src=` cocok dengan daftar ini, nilainya dipakai APA ADANYA
 * sebagai sumber. Tanpa ini, semua kampanye akan menumpuk jadi satu baris
 * "instagram" sehingga tidak kelihatan mana yang benar-benar mendatangkan
 * pengunjung (bio vs story vs broadcast WA).
 */
const CAMPAIGN_CODES = new Set([
  'ig-bio',
  'ig-story',
  'tiktok-bio',
  'wa-broadcast',
  'wa-katalog',
  'fb-page',
  'offline-qr'
]);

/** Label ramah untuk sumber trafik yang ditampilkan di dashboard. */
export const SOURCE_LABEL = {
  langsung: 'Langsung / tidak diketahui',
  instagram: 'Instagram',
  'ig-bio': 'Instagram — bio',
  'ig-story': 'Instagram — story',
  'tiktok-bio': 'TikTok — bio',
  'wa-broadcast': 'WhatsApp — broadcast',
  'wa-katalog': 'WhatsApp — katalog',
  'fb-page': 'Facebook — halaman',
  'offline-qr': 'QR offline',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google / pencarian',
  twitter: 'X / Twitter',
  email: 'Email',
  internal: 'Navigasi dalam situs',
  lainnya: 'Lainnya'
};

/** Klasifikasi sumber trafik dari referrer. */
export const classifyReferrer = (referrer, utm = '') => {
  const u = String(utm || '').toLowerCase().trim();
  if (u) {
    // Kode kampanye spesifik dari dashboard → simpan apa adanya.
    if (CAMPAIGN_CODES.has(u)) return u;
    if (/ig|instagram/.test(u)) return 'instagram';
    if (/wa|whatsapp/.test(u)) return 'whatsapp';
    if (/fb|facebook/.test(u)) return 'facebook';
    if (/tiktok/.test(u)) return 'tiktok';
    if (/google|ads/.test(u)) return 'google';
    if (/email|newsletter/.test(u)) return 'email';
    return 'lainnya';
  }
  const r = String(referrer || '').toLowerCase();
  if (!r) return 'langsung';
  if (/instagram|ig\.me/.test(r)) return 'instagram';
  if (/whatsapp|wa\.me/.test(r)) return 'whatsapp';
  if (/facebook|fb\./.test(r)) return 'facebook';
  if (/tiktok/.test(r)) return 'tiktok';
  if (/google|bing|yahoo|duckduckgo/.test(r)) return 'google';
  if (/t\.co|twitter|x\.com/.test(r)) return 'twitter';
  if (/cilegon-enggih|cilegonenggih/.test(r)) return 'internal';
  return 'lainnya';
};

/**
 * Validasi & normalisasi event dari klien. Mengembalikan null bila ditolak.
 */
export const normalizeEvent = (raw, { ip, headers } = {}) => {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim();
  if (!EVENT_TYPES.has(type)) return null;

  const now = new Date();
  const day = storeDay(now);
  const path = String(raw.path || '/').slice(0, 200);
  const productId = raw.productId ? String(raw.productId).slice(0, 60) : null;
  const variantId = raw.variantId ? String(raw.variantId).slice(0, 60) : null;

  return {
    // id unik ringan: cukup untuk dedup & pengurutan
    id: `ev-${now.getTime().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    type,
    day,
    hour: storeHour(now),
    at: now.toISOString(),
    path,
    productId,
    variantId,
    variantLabel: raw.variantLabel ? String(raw.variantLabel).slice(0, 60) : null,
    productName: raw.productName ? String(raw.productName).slice(0, 120) : null,
    // untuk checkout_start: nilai keranjang (bukan data pembeli)
    cartValue: Number.isFinite(Number(raw.cartValue)) ? Math.max(0, Number(raw.cartValue)) : null,
    cartQty: Number.isFinite(Number(raw.cartQty)) ? Math.max(0, Number(raw.cartQty)) : null,
    zone: raw.zone ? String(raw.zone).slice(0, 40) : null,
    // Zona pengunjung dari header hosting (nama kota saja, tanpa IP/koordinat).
    geoZone: raw.geoZone ? String(raw.geoZone).slice(0, 30) : null,
    keyword: raw.keyword ? String(raw.keyword).slice(0, 60) : null,
    source: classifyReferrer(raw.referrer, raw.utm),
    visitor: dailyVisitorHash(ip, day),
    device: /mobile|android|iphone|ipad/i.test(String(headers?.['user-agent'] || ''))
      ? 'mobile'
      : 'desktop'
  };
};

/**
 * Terjemahkan isyarat lokasi dari infrastruktur hosting menjadi zona toko.
 *
 * PENTING — privasi: fungsi ini HANYA memakai nama kota/region/provinsi.
 * Koordinat & IP diabaikan sepenuhnya di pemanggil (lihat geoHintFromHeaders),
 * sehingga tidak ada lokasi presisi yang pernah tersimpan.
 */
export const zoneFromGeo = ({ city = '', region = '', country = '' } = {}) => {
  const hay = `${city} ${region}`.toLowerCase();
  // Pengunjung luar negeri dibedakan supaya tidak tercampur data domestik.
  if (country && !/^id$/i.test(country)) return 'mancanegara';
  if (!hay.trim()) return null;
  if (/cilegon barat|ciwandan|anyer|pulomerak|grogol|gerogol/.test(hay)) return 'local-cilegon-west';
  if (/cilegon/.test(hay)) return 'local-cilegon';
  if (/serang|pandeglang|lebak|banten|tangerang/.test(hay)) return 'banten-near';
  if (/jakarta|bekasi|bogor|depok/.test(hay)) return 'jabodetabek';
  if (/bandung|jawa barat|west java|banjar|ciamis|tasik|garut|sukabumi|cirebon/.test(hay)) return 'jabar';
  if (/semarang|yogya|solo|surakarta|jawa tengah|central java|magelang|purwokerto/.test(hay))
    return 'jateng';
  if (/surabaya|malang|jawa timur|east java|denpasar|bali/.test(hay)) return 'jatim';
  if (/lampung|palembang|medan|sumatera|sumatra|aceh|padang|batam|jambi|bengkulu/.test(hay))
    return 'sumatera';
  if (/balikpapan|banjarmasin|makassar|samarinda|pontianak|manado|kalimantan|sulawesi|papua/.test(hay))
    return 'timur';
  if (/dki|indonesia|jawa|java/.test(hay)) return 'lainnya';
  return null;
};

/**
 * Ambil isyarat lokasi KASAR dari header hosting.
 * Hanya nama kota & negara — tidak ada IP, tidak ada koordinat.
 */
export const geoHintFromHeaders = (headers = {}) => {
  const h = headers || {};
  const city = decodeURIComponent(String(h['x-vercel-ip-city'] || '')).trim();
  const region = decodeURIComponent(String(h['x-vercel-ip-country-region'] || '')).trim();
  const country = String(h['x-vercel-ip-country'] || '').trim();
  if (!city && !region && !country) return null;
  const zone = zoneFromGeo({ city, region, country });
  return zone ? { zone, city: city.slice(0, 40) || null, country: country || null } : null;
};

/** Rentang tanggal (YYYY-MM-DD) untuk N hari terakhir, termasuk hari ini. */
const rangeDays = (days) => {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86400000);
    out.push(storeDay(d));
  }
  return out;
};

const ZONE_LABEL = {
  'local-cilegon': 'Kota Cilegon',
  'local-cilegon-west': 'Cilegon Barat & Pelabuhan',
  'banten-near': 'Serang & Banten',
  'jabodetabek': 'Jabodetabek',
  jabar: 'Jawa Barat',
  lainnya: 'Lainnya',
  jateng: 'Jawa Tengah & Yogyakarta',
  jatim: 'Jawa Timur & Bali',
  sumatera: 'Sumatera',
  timur: 'Indonesia Timur',
  mancanegara: 'Luar Negeri'
};

/** Tebak zona dari label destinasi pada pesanan lama. */
const zoneFromDestination = (destination) => {
  const d = String(destination || '').toLowerCase();
  if (/cilegon barat|ciwandan|anyer|pulomerak|grogol/.test(d)) return 'local-cilegon-west';
  if (/cilegon/.test(d)) return 'local-cilegon';
  if (/serang|banten/.test(d)) return 'banten-near';
  if (/jakarta|tangerang|bekasi|bogor|depok|bsd|tangsel/.test(d)) return 'jabodetabek';
  if (/bandung|jawa barat|banjar/.test(d)) return 'jabar';
  if (/semarang|yogya|solo|jawa tengah/.test(d)) return 'jateng';
  if (/surabaya|malang|denpasar|bali|jawa timur/.test(d)) return 'jatim';
  if (/lampung|palembang|medan|sumatera/.test(d)) return 'sumatera';
  if (/balikpapan|banjarmasin|makassar|timur/.test(d)) return 'timur';
  return 'lainnya';
};

/**
 * Bangun laporan lengkap.
 * @param {{events:object[], orders:object[], products:object[], days:number}} input
 */
export const buildInsights = ({ events = [], orders = [], products = [], days = 30 }) => {
  const period = rangeDays(days);
  const inPeriod = new Set(period);

  // Rentang sebelumnya (panjang sama) untuk pembanding "naik/turun".
  const prevPeriod = rangeDays(days * 2).slice(0, days);
  const inPrev = new Set(prevPeriod);

  const dayOfOrder = (o) => storeDay(new Date(o.createdAt || Date.now()));
  const evs = events.filter((e) => inPeriod.has(e.day));
  const ord = orders.filter((o) => inPeriod.has(dayOfOrder(o)));
  const prevEvs = events.filter((e) => inPrev.has(e.day));
  const prevOrd = orders.filter((o) => inPrev.has(dayOfOrder(o)));

  /* ---------- A. Trafik harian ---------- */
  const traffic = period.map((day) => {
    const dayEvents = evs.filter((e) => e.day === day);
    const views = dayEvents.filter((e) => e.type === 'page_view' || e.type === 'product_view').length;
    const visitors = new Set(dayEvents.map((e) => e.visitor).filter(Boolean)).size;
    const dayOrders = ord.filter((o) => storeDay(new Date(o.createdAt || Date.now())) === day);
    return {
      day,
      views,
      visitors,
      orders: dayOrders.length,
      revenue: dayOrders
        .filter((o) => o.paymentStatus === 'LUNAS')
        .reduce((s, o) => s + Number(o.totalAmount || 0), 0),
      conversion: visitors > 0 ? Number(((dayOrders.length / visitors) * 100).toFixed(2)) : 0
    };
  });

  const totalVisitors = new Set(evs.map((e) => e.visitor).filter(Boolean)).size;
  const totalViews = evs.filter((e) => e.type === 'page_view' || e.type === 'product_view').length;

  /* ---------- B. Produk: dilihat vs dibeli ---------- */
  const perProduct = new Map();
  const ensure = (id, name) => {
    const key = id || name || 'tidak-diketahui';
    if (!perProduct.has(key)) {
      perProduct.set(key, { productId: id, name: name || key, views: 0, carts: 0, sold: 0, revenue: 0 });
    }
    const row = perProduct.get(key);
    if (name && (!row.name || row.name === key)) row.name = name;
    return row;
  };

  evs.forEach((e) => {
    if (e.type === 'product_view') ensure(e.productId, e.productName).views += 1;
    if (e.type === 'add_to_cart') ensure(e.productId, e.productName).carts += 1;
  });

  ord.forEach((o) => {
    (o.items || []).forEach((it) => {
      const row = ensure(it.productId, it.name);
      row.sold += Number(it.qty) || 0;
      row.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
    });
  });

  const productRows = [...perProduct.values()]
    // Hanya produk yang punya aktivitas (dilihat / masuk keranjang / terjual).
    // Produk tanpa data tidak perlu memenuhi tabel.
    .filter((p) => p.views > 0 || p.carts > 0 || p.sold > 0)
    .map((p) => {
    // Konversi = dari yang melihat ke yang benar-benar membeli.
    const conversion = p.views > 0 ? Number(((p.sold / p.views) * 100).toFixed(1)) : null;
    let verdict = 'cukup data';
    if (p.views >= 10) {
      if (conversion !== null && conversion < 5) verdict = 'banyak dilihat, jarang dibeli — perbaiki halaman produk';
      else if (conversion !== null && conversion >= 15) verdict = 'konversi tinggi — perbanyak produksi & promosi';
      else verdict = 'konversi wajar';
    }
    return { ...p, conversion, verdict };
  });

  /* ---------- Stok vs laju penjualan ---------- */
  const soldByName = new Map(productRows.map((p) => [p.productId, p.sold]));
  const stockForecast = products
    .map((prod) => {
      const sold = soldByName.get(prod.id) || 0;
      const perDay = sold / Math.max(1, days);
      const stock = Number(prod.stock) || 0;
      const daysLeft = perDay > 0 ? Math.round(stock / perDay) : null;
      return {
        id: prod.id,
        name: prod.shortName || prod.name,
        stock,
        sold,
        perDay: Number(perDay.toFixed(2)),
        daysLeft,
        urgent: daysLeft !== null && daysLeft <= 14
      };
    })
    .filter((p) => p.sold > 0 || p.urgent)
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

  /* ---------- C. Lokasi ---------- */
  const zoneMap = new Map();
  orders.forEach((o) => {
    const zone = o.shippingZone || zoneFromDestination(o.destination);
    const row = zoneMap.get(zone) || {
      zone,
      label: ZONE_LABEL[zone] || 'Lainnya',
      orders: 0,
      revenue: 0
    };
    row.orders += 1;
    row.revenue += Number(o.totalAmount) || 0;
    zoneMap.set(zone, row);
  });
  const byZone = [...zoneMap.values()].sort((a, b) => b.orders - a.orders);
  const zoneTotal = byZone.reduce((s, z) => s + z.orders, 0) || 1;
  byZone.forEach((z) => {
    z.share = Number(((z.orders / zoneTotal) * 100).toFixed(1));
  });

  /* ---------- D. Waktu ---------- */
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
  const dayBuckets = {};
  orders.forEach((o) => {
    const created = new Date(o.createdAt || Date.now());
    const wibHour = storeHour(created);
    hourBuckets[wibHour].orders += 1;
    const dayName = new Date(created.getTime() + 7 * 3600000).toLocaleDateString('id-ID', {
      weekday: 'long'
    });
    dayBuckets[dayName] = (dayBuckets[dayName] || 0) + 1;
  });
  const busiestHours = [...hourBuckets].sort((a, b) => b.orders - a.orders).slice(0, 4);

  /* ---------- E. Sumber trafik ---------- */
  const sourceMap = new Map();
  evs.forEach((e) => {
    const row = sourceMap.get(e.source) || { source: e.source, visitors: new Set(), views: 0, orders: 0 };
    if (e.visitor) row.visitors.add(e.visitor);
    if (e.type === 'page_view' || e.type === 'product_view') row.views += 1;
    sourceMap.set(e.source, row);
  });
  const bySource = [...sourceMap.values()]
    .map((s) => ({
      source: s.source,
      label: SOURCE_LABEL[s.source] || s.source,
      visitors: s.visitors.size,
      views: s.views
    }))
    .sort((a, b) => b.views - a.views || b.visitors - a.visitors);

  /* ---------- F. Perangkat ---------- */
  // Berguna untuk memutuskan prioritas desain: HP vs desktop.
  const deviceMap = { mobile: new Set(), desktop: new Set() };
  evs.forEach((e) => {
    const key = e.device === 'mobile' ? 'mobile' : 'desktop';
    if (e.visitor) deviceMap[key].add(e.visitor);
  });
  const deviceTotal = deviceMap.mobile.size + deviceMap.desktop.size;
  const byDevice = ['mobile', 'desktop'].map((device) => {
    const visitors = deviceMap[device].size;
    return {
      device,
      label: device === 'mobile' ? 'HP / Tablet' : 'Komputer',
      visitors,
      share: deviceTotal > 0 ? Number(((visitors / deviceTotal) * 100).toFixed(1)) : 0
    };
  });

  /* ---------- G. Halaman paling sering dibuka ---------- */
  // Halaman "pintu masuk" menentukan halaman mana yang layak dioptimalkan.
  const pathMap = new Map();
  evs
    .filter((e) => e.type === 'page_view')
    .forEach((e) => {
      const row = pathMap.get(e.path) || { path: e.path, views: 0, visitors: new Set() };
      row.views += 1;
      if (e.visitor) row.visitors.add(e.visitor);
      pathMap.set(e.path, row);
    });
  const topPaths = [...pathMap.values()]
    .map((p) => ({
      path: p.path,
      // Nama ramah untuk halaman yang dikenal
      label:
        p.path === '/' ? 'Beranda'
        : p.path.startsWith('/katalog') ? 'Katalog'
        : p.path.startsWith('/produk/') ? 'Halaman produk'
        : p.path.startsWith('/lacak') ? 'Lacak pesanan'
        : p.path.startsWith('/tentang') ? 'Tentang'
        : p.path.startsWith('/kontak') ? 'Kontak'
        : p.path,
      views: p.views,
      visitors: p.visitors.size
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  /* ---------- H. Varian produk (dilihat vs dibeli) ---------- */
  // Sangat penting untuk produksi: varian mana yang paling diminati.
  const variantMap = new Map();
  const ensureVariant = (productId, variantId, variantLabel) => {
    const key = `${productId || 'produk'}::${variantId || 'default'}`;
    if (!variantMap.has(key)) {
      variantMap.set(key, {
        productId: productId || null,
        variantId: variantId || null,
        label: variantLabel || 'Tanpa varian',
        productName: null,
        views: 0,
        carts: 0,
        sold: 0,
        revenue: 0
      });
    }
    return variantMap.get(key);
  };
  evs.forEach((e) => {
    if (!e.productId) return;
    if (e.type === 'product_view' && e.variantId) {
      ensureVariant(e.productId, e.variantId, e.variantLabel).views += 1;
    }
    if (e.type === 'add_to_cart' && e.variantId) {
      const row = ensureVariant(e.productId, e.variantId, e.variantLabel);
      row.carts += 1;
      if (!row.productName && e.productName) row.productName = e.productName;
    }
  });
  ord.forEach((o) => {
    (o.items || []).forEach((it) => {
      if (!it.variantId) return;
      const row = ensureVariant(it.productId, it.variantId, it.variantLabel);
      row.sold += Number(it.qty) || 0;
      row.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
      if (!row.productName && it.name) row.productName = String(it.name).split(' (')[0];
    });
  });
  const variants = [...variantMap.values()]
    .filter((v) => v.views > 0 || v.carts > 0 || v.sold > 0)
    .map((v) => ({ ...v, label: String(v.label).slice(0, 60) }))
    .sort((a, b) => b.sold - a.sold || b.carts - a.carts || b.views - a.views)
    .slice(0, 15);

  /* ---------- I. Lokasi pengunjung (bukan hanya pembeli) ---------- */
  // Diambil dari header hosting: hanya nama kota, tanpa IP/koordinat.
  const visitorZoneMap = new Map();
  evs.forEach((e) => {
    if (!e.geoZone) return;
    const row = visitorZoneMap.get(e.geoZone) || { zone: e.geoZone, visitors: new Set(), views: 0 };
    if (e.visitor) row.visitors.add(e.visitor);
    if (e.type === 'page_view' || e.type === 'product_view') row.views += 1;
    visitorZoneMap.set(e.geoZone, row);
  });
  const visitorZoneRows = [...visitorZoneMap.values()].map((z) => ({
    zone: z.zone,
    label: ZONE_LABEL[z.zone] || z.zone,
    visitors: z.visitors.size,
    views: z.views
  }));
  const visitorZoneTotal = visitorZoneRows.reduce((sum, z) => sum + z.visitors, 0);
  const byVisitorZone = visitorZoneRows
    .map((z) => ({
      ...z,
      share: visitorZoneTotal > 0 ? Number(((z.visitors / visitorZoneTotal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.visitors - a.visitors);

  /* ---------- J. Peta panas jam x hari ---------- */
  // Digabung supaya jadwal promosi lebih tepat daripada melihat jam/hari terpisah.
  const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const heatCells = [];
  const heatIndex = new Map();
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      const cell = { weekday: d, day: WEEKDAYS[d], hour: h, views: 0, visitors: new Set() };
      heatCells.push(cell);
      heatIndex.set(`${d}-${h}`, cell);
    }
  }
  evs.forEach((e) => {
    if (e.type !== 'page_view' && e.type !== 'product_view') return;
    // storeDay -> Date pada tengah malam WIB, agar nama hari konsisten.
    const wib = new Date(`${e.day}T00:00:00+07:00`);
    const weekday = (wib.getUTCDay() + 6) % 7; // Senin = 0
    const cell = heatIndex.get(`${weekday}-${Number(e.hour) || 0}`);
    if (!cell) return;
    cell.views += 1;
    if (e.visitor) cell.visitors.add(e.visitor);
  });
  const peakSlots = [...heatCells]
    .map((c) => ({ day: c.day, hour: c.hour, views: c.views, visitors: c.visitors.size }))
    .filter((c) => c.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);
  /**
   * `grid` selalu berisi 7 x 24 sel agar tampilan peta panas utuh.
   * `max` = nilai tertinggi (0 bila belum ada kunjungan) sehingga UI bisa
   * membedakan "belum ada data" dari "semua sel kosong".
   */
  const heatmap = {
    weekdays: WEEKDAYS,
    // grid[hari][jam] = jumlah kunjungan
    grid: WEEKDAYS.map((_, d) =>
      Array.from({ length: 24 }, (_, h) => heatIndex.get(`${d}-${h}`).views)
    ),
    peakSlots,
    max: Math.max(...heatCells.map((c) => c.views), 0),
    filledCells: heatCells.filter((c) => c.views > 0).length
  };

  /* ---------- K. Pembanding periode sebelumnya ---------- */
  const prevVisitors = new Set(prevEvs.map((e) => e.visitor).filter(Boolean)).size;
  const prevViews = prevEvs.filter((e) => e.type === 'page_view' || e.type === 'product_view').length;
  const delta = (now, before) => {
    if (!before) return now > 0 ? null : 0; // null = tidak ada pembanding
    return Number((((now - before) / before) * 100).toFixed(1));
  };
  const comparison = {
    hasPreviousData: prevEvs.length > 0,
    prevVisitors,
    prevViews,
    prevOrders: prevOrd.length,
    visitors: delta(totalVisitors, prevVisitors),
    views: delta(totalViews, prevViews),
    orders: delta(ord.length, prevOrd.length)
  };

  /* ---------- Funnel ---------- */
  const funnel = {
    visitors: totalVisitors,
    productViews: evs.filter((e) => e.type === 'product_view').length,
    addToCart: evs.filter((e) => e.type === 'add_to_cart').length,
    checkoutStart: evs.filter((e) => e.type === 'checkout_start').length,
    orders: ord.length
  };
  /**
   * dropOff = persentase yang TIDAK melanjutkan ke tahap berikutnya.
   * Nilai dijepit 0..100: pembagian bisa menghasilkan angka negatif
   * (mis. pesanan lebih banyak daripada event checkout_start) yang tidak
   * masuk akal untuk ditampilkan sebagai "drop-off".
   */
  const dropOff = (from, to) => {
    if (!from) return null;
    const pct = 100 - (to / from) * 100;
    return Number(Math.min(100, Math.max(0, pct)).toFixed(1));
  };
  funnel.dropOff = {
    viewToCart: dropOff(funnel.productViews, funnel.addToCart),
    cartToCheckout: dropOff(funnel.addToCart, funnel.checkoutStart),
    checkoutToOrder: dropOff(funnel.checkoutStart, funnel.orders)
  };

  /**
   * Penting untuk kejujuran data: pesanan lama (sebelum pelacakan aktif)
   * tidak punya event checkout_start, sehingga funnel bisa terlihat
   * "lebih banyak pesanan daripada checkout". Tandai agar UI menjelaskan,
   * bukan menampilkan angka menyesatkan.
   */
  funnel.trackingGap = funnel.orders > funnel.checkoutStart;

  return {
    period: { days, from: period[0], to: period[period.length - 1] },
    traffic: {
      daily: traffic,
      totalVisitors,
      totalViews,
      totalOrders: ord.length,
      conversion: totalVisitors > 0 ? Number(((ord.length / totalVisitors) * 100).toFixed(2)) : 0
    },
    products: productRows.sort((a, b) => b.sold - a.sold),
    stockForecast,
    byZone,
    byVisitorZone,
    hours: { buckets: hourBuckets, busiest: busiestHours, byWeekday: dayBuckets },
    heatmap,
    bySource,
    byDevice,
    topPaths,
    variants,
    comparison,
    funnel,
    /** Penanda agar UI bisa menjelaskan kenapa angkanya masih kosong. */
    dataStatus: {
      trackedEvents: evs.length,
      ready: evs.length >= 20,
      note:
        evs.length === 0
          ? 'Pelacakan baru aktif. Data trafik muncul setelah ada kunjungan.'
          : evs.length < 20
            ? 'Data masih sedikit — angka konversi belum bisa diandalkan.'
            : null
    }
  };
};

/** Buang event lebih tua dari N hari (retensi privasi & ukuran data). */
export const pruneOldEvents = (events, retentionDays = 180) => {
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  const cutoffDay = storeDay(cutoff);
  return events.filter((e) => e.day >= cutoffDay);
};
