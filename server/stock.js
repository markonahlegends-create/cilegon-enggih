/**
 * Pengelolaan stok: reservasi saat order dibuat, pengembalian saat batal.
 *
 * Keputusan desain:
 *  - Stok dipotong **saat order dibuat**, bukan saat admin menandai LUNAS.
 *    Alasannya: pembeli yang sudah transfer tidak boleh kehabisan barang
 *    karena pembeli lain memesan lebih dulu. Kalau dipotong saat LUNAS,
 *    dua orang bisa membayar barang yang sama (oversell nyata).
 *  - Kompensasinya: order yang kedaluwarsa / dibatalkan **mengembalikan**
 *    stok otomatis, sehingga barang tidak "hilang" karena order fiktif.
 *  - Stok varian dikelola terpisah; stok produk = jumlah stok varian bila
 *    `stockManual` tidak diaktifkan (mengikuti `normalizeProduct`).
 */

const clampQty = (value) => Math.max(0, Math.round(Number(value) || 0));

/** Stok efektif satu varian (atau produk bila tanpa varian). */
export const availableStock = (product, variantId) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length === 0) return Number(product?.stock) || 0;
  const variant = variants.find((v) => v.id === variantId);
  if (!variant) return 0;
  return Number(variant.stock) || 0;
};

/**
 * Periksa ketersediaan seluruh item sebelum order dibuat.
 * @returns {{ok:boolean, problems:Array<{name:string, requested:number, available:number}>}}
 */
export const checkStock = (items, catalog) => {
  const problems = [];
  for (const item of items) {
    if (!item?.productId) continue;
    const product = catalog.find((p) => p.id === item.productId);
    if (!product) continue; // produk hilang sudah ditangani validasi harga
    if (product.stockManual === false && product.active === false) continue;

    // Produk pre-order boleh melebihi stok (diproduksi sesuai pesanan).
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant = variants.find((v) => v.id === item.variantId);
    const isPreOrderItem = Boolean(product.isPreOrder || item.isPreOrder);
    if (isPreOrderItem) continue;

    const wanted = clampQty(item.qty);

    /*
     * PRODUK MULTI-DIMENSI (Model x Ukuran x Warna) tidak punya `variantId`,
     * jadi kalau memakai aturan varian di bawah hasilnya selalu 0 — semua
     * pesanan akan ditolak "stok tidak mencukupi" padahal barangnya ada.
     *
     * Urutan sumber stok:
     *  1. stok kombinasi (bila admin mengisinya untuk kombinasi itu)
     *  2. stok produk (bila diisi manual)
     *  3. total stok varian lama
     */
    const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
    let stock;
    if (groups.length) {
      const combos = Array.isArray(product.combinations) ? product.combinations : [];
      const combo = combos.find(
        (c) =>
          Array.isArray(c.optionValueIds) &&
          c.optionValueIds.join('|') === String(item.optionKey || '')
      );
      if (combo && typeof combo.stock === 'number') {
        stock = Number(combo.stock) || 0;
      } else if (product.stockManual === true) {
        stock = Number(product.stock) || 0;
      } else if (variants.length > 0) {
        stock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      } else {
        stock = Number(product.stock) || 0;
      }
    } else {
      stock =
        variants.length > 0
          ? Number(variant?.stock) || 0
          : product.stockManual === true
            ? Number(product.stock) || 0
            : variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }

    if (wanted > stock) {
      problems.push({
        name: item.name || product.shortName || product.name,
        requested: wanted,
        available: Math.max(0, stock)
      });
    }
  }
  return { ok: problems.length === 0, problems };
};

/**
 * Kurangi stok untuk item order. `direction = 1` mengurangi,
 * `direction = -1` mengembalikan.
 * @returns {Promise<{changed:number, skipped:number}>}
 */
export const applyStockMovement = async (store, items, { direction = 1 } = {}) => {
  const catalog = await store.list('products').catch(() => []);
  let changed = 0;
  let skipped = 0;

  for (const item of items || []) {
    const qty = clampQty(item?.qty) * direction;
    if (!qty || !item?.productId) {
      skipped += 1;
      continue;
    }
    const product = catalog.find((p) => p.id === item.productId);
    if (!product) {
      skipped += 1;
      continue;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const next = { ...product };

    if (variants.length > 0) {
      const targetId = item.variantId || variants[0]?.id;
      const idx = variants.findIndex((v) => v.id === targetId);
      if (idx < 0) {
        skipped += 1;
        continue;
      }
      const updated = [...variants];
      updated[idx] = { ...updated[idx], stock: Math.max(0, (Number(updated[idx].stock) || 0) - qty) };
      next.variants = updated;
      // Stok total mengikuti jumlah varian, kecuali admin mengaktifkan stok manual.
      if (!product.stockManual) {
        next.stock = updated.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
    } else {
      next.stock = Math.max(0, (Number(product.stock) || 0) - qty);
    }

    await store.put('products', { ...next, updatedAt: new Date().toISOString() });
    changed += 1;
  }

  return { changed, skipped };
};

/** Apakah order ini sudah pernah memotong stok? (mencegah pemotongan ganda) */
export const stockAlreadyApplied = (order) =>
  Boolean(order?.stockAppliedAt) || Boolean(order?.stockReleasedAt);
