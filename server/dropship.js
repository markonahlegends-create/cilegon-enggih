/**
 * Analisis kesiapan dropship untuk Cilegon Enggih.
 *
 * KENAPA MODUL INI ADA
 * --------------------
 * Toko ini tidak menyimpan stok sendiri. Setiap pesanan dipesan ulang ke toko
 * Shopee/Tokopedia lalu dikirim langsung ke alamat pembeli (dropship).
 * Konsekuensinya: kualitas layanan Cilegon Enggih sepenuhnya bergantung pada
 * pemasok. Satu pemasok yang memakai box bermerek toko lain atau menyertakan
 * invoice harga kulakan langsung merusak kepercayaan pembeli — dan itu tidak
 * terlihat dari dashboard mana pun sebelum terjadi.
 *
 * Modul ini TIDAK menyimpan data pemasok baru. Data pemasok sudah ada di
 * koleksi `vendors` (dipakai modul Keuangan untuk HPP). Yang ditambahkan di
 * sini hanyalah penilaian kelayakan dropship dan analisis margin, supaya
 * keputusan "pakai vendor A atau B" punya dasar angka.
 */

/** Syarat wajib. Gagal satu saja = vendor tidak layak untuk dropship. */
export const REQUIRED_CHECKS = [
  {
    key: 'acceptsDropship',
    label: 'Menerima dropship',
    why: 'Tanpa ini paket dikirim ke alamat Anda, bukan alamat pembeli.'
  },
  {
    key: 'neutralPackaging',
    label: 'Packing netral (tanpa merek vendor)',
    why: 'Kalau box bertuliskan nama toko lain, pembeli sadar Anda hanya perantara.'
  },
  {
    key: 'noInvoice',
    label: 'Tidak menyertakan invoice/harga kulakan',
    why: 'Invoice berisi modal Anda. Pembeli akan melihat margin Anda.'
  }
];

/** Nilai tambah, bukan syarat mati. */
export const BONUS_CHECKS = [
  { key: 'supportsCustomLogo', label: 'Bisa custom logo/branding', penalty: 8 },
  { key: 'hasRealPhotos', label: 'Ada foto produk asli', penalty: 6 },
  { key: 'responsiveChat', label: 'Balas chat cepat (<2 jam)', penalty: 6 }
];

/** Cadangan biaya retur/rusak yang jarang dihitung pemula. */
export const DEFAULT_RETURN_RESERVE_PERCENT = 3;

/**
 * Nilai kelayakan dropship satu vendor.
 *
 * @returns {{eligible:boolean, score:number, blockers:string[], notes:string[]}}
 */
export const scoreVendorForDropship = (vendor = {}) => {
  const blockers = [];
  const notes = [];
  let score = 100;

  for (const cek of REQUIRED_CHECKS) {
    if (vendor[cek.key] !== true) blockers.push(`${cek.label} — ${cek.why}`);
  }

  const rating = Number(vendor.rating) || 0;
  if (!rating) {
    notes.push('Rating toko belum diisi.');
    score -= 20;
  } else if (rating < 4.5) {
    notes.push(`Rating ${rating} terlalu rendah — cari di atas 4,7.`);
    score -= 35;
  } else if (rating < 4.7) {
    notes.push(`Rating ${rating} pas-pasan — idealnya di atas 4,7.`);
    score -= 15;
  }

  const count = Number(vendor.ratingCount) || 0;
  if (!count) {
    notes.push('Jumlah ulasan belum diisi.');
    score -= 10;
  } else if (count < 50) {
    notes.push(`Baru ${count} ulasan — toko baru, risiko lebih tinggi.`);
    score -= 20;
  } else if (count < 200) {
    notes.push(`${count} ulasan — masih sedikit, pantau terus.`);
    score -= 8;
  }

  const lead = Number(vendor.leadTimeDays);
  if (Number.isFinite(lead) && lead > 0) {
    if (lead > 4) {
      notes.push(`Proses ${lead} hari terlalu lama untuk dropship.`);
      score -= 25;
    } else if (lead > 2) {
      notes.push(`Proses ${lead} hari — sampaikan estimasi yang jujur ke pembeli.`);
      score -= 10;
    }
  } else {
    notes.push('Lama proses belum diisi.');
    score -= 8;
  }

  for (const b of BONUS_CHECKS) {
    if (vendor[b.key] !== true) score -= b.penalty;
  }

  return {
    eligible: blockers.length === 0,
    score: Math.max(0, Math.min(100, Math.round(score))),
    blockers,
    notes
  };
};

/**
 * Margin bersih setelah biaya yang sering terlupa.
 *
 * Rumus: harga jual - HPP - biaya admin - cadangan retur.
 * HPP = costPrice + extraCost (mengikuti ProductEditor yang sudah ada).
 */
export const computeMargin = ({
  sellPrice = 0,
  costPrice = 0,
  extraCost = 0,
  adminFeePercent = 0,
  returnReservePercent = DEFAULT_RETURN_RESERVE_PERCENT
} = {}) => {
  const sell = Number(sellPrice) || 0;
  const hpp = (Number(costPrice) || 0) + (Number(extraCost) || 0);
  const adminFee = (sell * (Number(adminFeePercent) || 0)) / 100;
  const reserve = (sell * (Number(returnReservePercent) || 0)) / 100;
  const margin = sell - hpp - adminFee - reserve;
  const marginPercent = sell > 0 ? Number(((margin / sell) * 100).toFixed(1)) : 0;

  let health = 'sehat';
  let note = '';

  if (hpp <= 0) {
    health = 'belum-diketahui';
    note = 'HPP belum diisi — margin tidak bisa dihitung.';
    // Tanpa modal, angka "margin" hanya harga jual — menyesatkan kalau ditampilkan.
    return { margin: 0, marginPercent: 0, health, note, hpp };
  } else if (margin <= 0) {
    health = 'rugi';
    note = 'Rugi. Naikkan harga jual atau ganti vendor yang lebih murah.';
  } else if (marginPercent < 15) {
    health = 'tipis';
    note = 'Di bawah 15%. Satu retur bisa menghapus beberapa transaksi.';
  } else if (marginPercent < 25) {
    health = 'cukup';
    note = '15–25%. Aman, tapi jangan tambah diskon besar.';
  }

  return { margin: Math.round(margin), marginPercent, health, note, hpp };
};

/**
 * Susun gambaran lengkap kesiapan dropship toko.
 *
 * @param {{vendors:Array, products:Array, adminFeePercent?:number}} input
 */
export const buildDropshipReadiness = ({ vendors = [], products = [], adminFeePercent = 0 }) => {
  const scored = vendors.map((v) => {
    const assessment = scoreVendorForDropship(v);
    const assigned = products.filter(
      (p) => p.active !== false && String(p.vendorId || '') === String(v.id)
    );

    const rows = assigned.map((p) => {
      const m = computeMargin({
        sellPrice: p.price,
        costPrice: p.costPrice,
        extraCost: p.extraCost,
        adminFeePercent
      });
      return { id: p.id, name: p.shortName || p.name, sellPrice: p.price, ...m };
    });

    return {
      id: v.id,
      name: v.name,
      code: v.code || '',
      contactName: v.contactName || '',
      phone: v.phone || '',
      category: v.category || '',
      active: v.active !== false,
      ...assessment,
      productCount: rows.length,
      products: rows,
      avgMarginPercent: rows.filter((r) => r.health !== 'belum-diketahui').length
        ? Number(
            (
              rows.filter((r) => r.health !== 'belum-diketahui')
                .reduce((s, r) => s + r.marginPercent, 0) /
              rows.filter((r) => r.health !== 'belum-diketahui').length
            ).toFixed(1)
          )
        : null
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const activeProducts = products.filter((p) => p.active !== false);
  const tanpaVendor = activeProducts
    .filter((p) => !p.vendorId)
    .map((p) => ({ id: p.id, name: p.shortName || p.name, price: p.price }));
  const tanpaHpp = activeProducts
    .filter((p) => !(Number(p.costPrice) > 0))
    .map((p) => ({ id: p.id, name: p.shortName || p.name, price: p.price }));

  return {
    vendors: scored,
    eligibleVendors: scored.filter((v) => v.eligible && v.active).length,
    totalVendors: scored.length,
    coverage: {
      totalProducts: activeProducts.length,
      withoutVendor: tanpaVendor,
      withoutHpp: tanpaHpp,
      percentCovered:
        activeProducts.length > 0
          ? Number((((activeProducts.length - tanpaVendor.length) / activeProducts.length) * 100).toFixed(0))
          : 0
    }
  };
};
