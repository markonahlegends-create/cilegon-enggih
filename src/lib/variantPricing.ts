/**
 * Perhitungan harga & stok untuk produk berpilihan multi-dimensi
 * (Model × Ukuran × Warna).
 *
 * KENAPA DIPISAH KE MODUL SENDIRI:
 * Rumus yang sama dipakai di tiga tempat — halaman produk, keranjang, dan
 * server saat membuat pesanan. Kalau masing-masing menulis sendiri, cepat atau
 * lambat angkanya akan berbeda, dan pembeli melihat harga yang berbeda dari
 * yang ditagih. Satu sumber kebenaran menghilangkan kelas bug itu.
 *
 * ATURAN HARGA
 *   harga = kombinasi.price ?? (product.price + Σ priceDelta nilai terpilih)
 *
 * Kombinasi menang bila ada. Jadi admin cukup mengisi 2–3 kombinasi istimewa
 * (mis. harga vendor khusus untuk warna tertentu) dan sisanya dihitung.
 */

import type {
  Product,
  ProductCombination,
  ProductOptionGroup,
  ProductOptionValue
} from '../data/products';

/** Batas wajar agar salah ketik langsung ketahuan. */
/**
 * Batas jumlah grup pilihan.
 *
 * Dinaikkan dari 3 ke 4 karena produk apparel memakai tiga dimensi
 * (Kode × Warna × Ukuran) DAN perlu satu grup tambahan "Momen" untuk
 * akhir tahun, Ramadhan, Idul Fitri, ulang tahun, dan seterusnya.
 * Dengan batas 3, grup keempat dibuang diam-diam setiap kali admin menyimpan.
 *
 * Tetap dibatasi: 4 × 30 nilai = 120 tombol sudah lebih dari cukup, dan
 * lebih dari itu halaman produk jadi tidak terpakai di layar HP.
 */
export const MAX_OPTION_GROUPS = 4;
export const MAX_OPTION_VALUES = 30;

export type SelectedOptions = Record<string, string>;

/** Kunci stabil untuk keranjang: 'model=oversize|ukuran=xl|warna=navy'. */
export const optionsKey = (groups: ProductOptionGroup[], selected: SelectedOptions): string =>
  groups
    .map((g) => `${g.id}=${selected[g.id] || ''}`)
    .join('|');

/** Daftar nilai terpilih, urut sesuai grup (dipakai untuk mencari kombinasi). */
export const selectedValueIds = (
  groups: ProductOptionGroup[],
  selected: SelectedOptions
): string[] => groups.map((g) => selected[g.id] || '');

/** Apakah semua grup wajib sudah terisi? */
export const isSelectionComplete = (
  groups: ProductOptionGroup[],
  selected: SelectedOptions
): boolean =>
  groups.every((g) => g.required === false || Boolean(selected[g.id]));

/**
 * Cari kombinasi yang cocok. Pencocokan harus persis untuk seluruh grup —
 * kombinasi parsial (hanya sebagian grup terisi) tidak dianggap cocok,
 * karena harga untuk sisa grupnya tidak jelas.
 */
export const findCombination = (
  combinations: ProductCombination[] | undefined,
  valueIds: string[]
): ProductCombination | undefined => {
  if (!Array.isArray(combinations) || !valueIds.length) return undefined;
  return combinations.find(
    (c) =>
      Array.isArray(c.optionValueIds) &&
      c.optionValueIds.length === valueIds.length &&
      c.optionValueIds.every((id, i) => id === valueIds[i])
  );
};

/** Jumlahkan selisih harga dari nilai yang dipilih. */
export const sumDeltas = (
  groups: ProductOptionGroup[],
  selected: SelectedOptions
): number =>
  groups.reduce((total, g) => {
    const value = g.values.find((v) => v.id === selected[g.id]);
    return total + (Number(value?.priceDelta) || 0);
  }, 0);

export interface ResolvedSelection {
  /** Harga satuan yang harus ditagih. */
  price: number;
  /** Harga coret (bila ada). */
  originalPrice?: number;
  /** Stok yang ditampilkan. null = tidak diketahui (pakai stok produk). */
  stock: number | null;
  /** false bila kombinasi ditandai tidak tersedia. */
  available: boolean;
  /** Gambar utama untuk pilihan ini (kombinasi > nilai > produk). */
  image?: string;
  /** Label ringkas: 'Oversize · XL · Navy'. */
  label: string;
  /** Kombinasi yang dipakai, bila ada. */
  combination?: ProductCombination;
}

/**
 * Hitung harga/stok/gambar akhir untuk satu pilihan.
 *
 * Tidak pernah mengembalikan harga negatif: selisih besar yang salah ketik
 * (mis. -999999) akan menghasilkan 0, bukan angka mustahil.
 */
export const resolveSelection = (
  product: Product,
  selected: SelectedOptions
): ResolvedSelection => {
  const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  const valueIds = selectedValueIds(groups, selected);
  const combination = findCombination(product.combinations, valueIds);

  const basePrice = Number(product.price) || 0;
  const delta = sumDeltas(groups, selected);
  const price = Math.max(0, combination?.price ?? basePrice + delta);

  const originalCandidate = combination?.originalPrice ?? product.originalPrice;
  const originalPrice =
    originalCandidate && originalCandidate > price ? originalCandidate : undefined;

  /*
   * Gambar: kombinasi menang, lalu nilai terpilih, lalu produk.
   *
   * URUTAN PENTING — grup berjenis `swatch` (warna) didahulukan.
   * Kalau admin mengisi foto untuk grup Model DAN grup Warna, memilih Navy
   * harus mengganti gambar menjadi foto Navy. Versi sebelumnya selalu memakai
   * grup pertama yang punya foto, sehingga ganti warna tampak tidak bereaksi.
   *
   * Bila hanya satu grup yang punya foto (kasus paling umum: hanya Model),
   * aturan ini tidak mengubah apa pun — fotonya tetap dipakai.
   */
  let image: string | undefined = combination?.image;
  if (!image) {
    const ordered = [
      ...groups.filter((g) => g.display === 'swatch'),
      ...groups.filter((g) => g.display !== 'swatch')
    ];
    for (const g of ordered) {
      const value = g.values.find((v) => v.id === selected[g.id]);
      if (value?.image) {
        image = value.image;
        break;
      }
    }
  }
  if (!image) image = product.image;

  const labels = groups
    .map((g) => g.values.find((v) => v.id === selected[g.id])?.label)
    .filter(Boolean) as string[];

  return {
    price,
    originalPrice,
    stock: typeof combination?.stock === 'number' ? combination.stock : null,
    available: combination?.available !== false,
    image,
    label: labels.join(' · '),
    combination
  };
};

/**
 * Nilai yang masih bisa dipilih, mengingat pilihan grup lain.
 *
 * PENTING — `combinations` adalah DAFTAR PENGECUALIAN, bukan daftar lengkap.
 * Admin hanya mengisi kombinasi yang harganya/stoknya istimewa. Jadi:
 *
 *   tidak ada kombinasi yang menyebut nilai ini  ->  TERSEDIA (normal)
 *   ada kombinasi yang menyebutnya & available:false ->  TIDAK tersedia
 *   nilai ditandai available:false sendiri       ->  TIDAK tersedia
 *
 * Versi pertama fungsi ini membalik aturan tersebut (harus ada kombinasi baru
 * dianggap tersedia). Akibatnya, produk dengan 1 kombinasi istimewa mengunci
 * hampir semua pilihan — pembeli hanya bisa memilih satu kombinasi. Sekarang
 * dibalik: default-nya tersedia, pengecualian yang mengurangi.
 */
export const isValueAvailable = (
  product: Product,
  groupId: string,
  value: ProductOptionValue,
  selected: SelectedOptions
): boolean => {
  if (value.available === false) return false;

  const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  const combos = Array.isArray(product.combinations) ? product.combinations : [];
  if (!combos.length) return true;

  const index = groups.findIndex((g) => g.id === groupId);
  if (index < 0) return true;

  // Kombinasi yang akan terbentuk bila nilai ini dipilih sekarang.
  const candidate = groups.map((g, i) => (i === index ? value.id : selected[g.id] || ''));

  const blocked = combos.some(
    (c) =>
      c.available === false &&
      Array.isArray(c.optionValueIds) &&
      c.optionValueIds.length === candidate.length &&
      c.optionValueIds.every((id, i) => !candidate[i] || id === candidate[i])
  );

  return !blocked;
};

/**
 * Pilihan awal saat halaman dibuka.
 *
 * KENAPA TIDAK SEKADAR "nilai pertama tiap grup":
 * Kalau nilai pertama itu milik kombinasi yang ditandai `available: false`
 * (mis. kombinasi termurah memang sudah habis), seluruh chip akan tampil
 * nonaktif dan pembeli tidak bisa memilih apa pun — halaman jadi buntu.
 *
 * Urutan upaya:
 *  1. kombinasi pertama yang masih tersedia -> pilihan awalnya
 *  2. kalau tidak ada kombinasi, ambil nilai pertama yang tersedia tiap grup
 *  3. kalau tetap kosong, biarkan kosong supaya pembeli memilih sendiri
 */
export const defaultSelection = (product: Product): SelectedOptions => {
  const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  const combos = Array.isArray(product.combinations) ? product.combinations : [];
  const selected: SelectedOptions = {};

  /*
   * Ambil nilai pertama yang tersedia, lalu pastikan hasilnya bukan kombinasi
   * yang sengaja dimatikan (mis. stok habis). Kalau ternyata dimatikan,
   * geser nilai grup terakhir sampai menemukan kombinasi yang tersedia —
   * supaya halaman TIDAK terbuka dengan pilihan yang sudah tidak bisa dibeli.
   */
  for (const g of groups) {
    const first = g.values.find((v) => v.available !== false);
    if (first) selected[g.id] = first.id;
  }
  if (!combos.length) return selected;

  const blocked = (sel: SelectedOptions) =>
    combos.some(
      (c) =>
        c.available === false &&
        Array.isArray(c.optionValueIds) &&
        c.optionValueIds.length === groups.length &&
        groups.every((g) => c.optionValueIds[groups.indexOf(g)] === sel[g.id])
    );

  if (!blocked(selected)) return selected;

  // Cari kombinasi pertama yang tersedia, lalu pakai itu sebagai pilihan awal.
  const usable = combos.find(
    (c) =>
      c.available !== false &&
      Array.isArray(c.optionValueIds) &&
      c.optionValueIds.length === groups.length
  );
  if (usable) {
    groups.forEach((g, i) => {
      selected[g.id] = usable.optionValueIds[i];
    });
    return selected;
  }

  return selected;
};
