/**
 * UJI STOK — memastikan pesanan yang sah tidak ditolak "stok tidak mencukupi".
 *
 * LATAR BELAKANG (audit 20 Nov 2026)
 * Produk yang punya daftar varian tetapi pesanannya TIDAK menyebut `variantId`
 * dianggap berstok 0, sehingga pesanan ditolak dengan pesan menyesatkan
 * "tersedia 0" padahal stok totalnya puluhan. Ini nyata terjadi pada produk
 * bundling: pembeli tidak memilih varian.
 *
 * Cara pakai: node scripts/test-stock.mjs
 */
import { checkStock, applyStockMovement } from '../server/stock.js';

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`);
};

const bundle = () => [
  {
    id: 'bundle-1',
    name: 'Paket Hemat',
    stock: 80,
    variants: [
      { id: 'bw-m', label: 'M', stock: 25 },
      { id: 'bw-l', label: 'L', stock: 30 },
      { id: 'bw-xl', label: 'XL', stock: 25 }
    ]
  }
];

const plano = () => [{ id: 'p1', name: 'Stiker', stock: 50, variants: [] }];

const multi = () => [
  {
    id: 'prod-4',
    name: 'Kaos',
    stock: 20,
    optionGroups: [
      {
        id: 'ukuran',
        name: 'Ukuran',
        values: [
          { id: 'uk-xl', label: 'XL' },
          { id: 'uk-xxl', label: '2XL' }
        ]
      }
    ]
  }
];

console.log('\n1. Produk ber-varian TANPA variantId (kasus bundling)');
check('dianggap tersedia', checkStock([{ productId: 'bundle-1', name: 'Paket', qty: 1 }], bundle()).problems, []);
check('qty melebihi total tetap ditolak', checkStock([{ productId: 'bundle-1', name: 'Paket', qty: 999 }], bundle()).problems.length, 1);

console.log('\n2. Produk ber-varian DENGAN variantId');
check('varian benar tersedia', checkStock([{ productId: 'bundle-1', name: 'P', qty: 25, variantId: 'bw-m' }], bundle()).problems, []);
check('varian benar melebihi stok', checkStock([{ productId: 'bundle-1', name: 'P', qty: 26, variantId: 'bw-m' }], bundle()).problems.length, 1);
check('variantId tidak dikenal ditolak', checkStock([{ productId: 'bundle-1', name: 'P', qty: 1, variantId: 'tidak-ada' }], bundle()).problems.length, 1);

console.log('\n3. Produk tanpa varian');
check('stok cukup', checkStock([{ productId: 'p1', name: 'S', qty: 10 }], plano()).problems, []);
check('stok kurang', checkStock([{ productId: 'p1', name: 'S', qty: 51 }], plano()).problems.length, 1);

console.log('\n4. Produk multi-dimensi (optionGroups)');
check('tanpa kombinasi memakai stok produk', checkStock([{ productId: 'prod-4', name: 'K', qty: 20 }], multi()).problems, []);
check('melebihi stok ditolak', checkStock([{ productId: 'prod-4', name: 'K', qty: 21 }], multi()).problems.length, 1);

console.log('\n5. Pre-order dilewati');
check(
  'pre-order boleh melebihi stok',
  checkStock([{ productId: 'p1', name: 'S', qty: 9999, isPreOrder: true }], plano()).problems,
  []
);

console.log('\n6. Pemotongan & pengembalian stok');
{
  const mkStore = (products) => ({
    _p: products,
    async list() {
      return this._p.map((p) => ({ ...p }));
    },
    async put(_c, rec) {
      this._p = this._p.map((p) => (p.id === rec.id ? rec : p));
    }
  });
  const store = mkStore(bundle());
  await applyStockMovement(store, [{ productId: 'bundle-1', variantId: 'bw-xxl', qty: 1 }], { direction: 1 });
  // variantId tidak dikenal -> dilewati, tidak boleh mengurangi varian lain
  check('variantId tak dikenal tidak memotong varian lain', store._p[0].variants.map((v) => v.stock), [25, 30, 25]);

  await applyStockMovement(store, [{ productId: 'bundle-1', variantId: 'bw-l', qty: 2 }], { direction: 1 });
  check('memotong varian yang tepat', store._p[0].variants.map((v) => v.stock), [25, 28, 25]);

  await applyStockMovement(store, [{ productId: 'bundle-1', variantId: 'bw-l', qty: 2 }], { direction: -1 });
  check('mengembalikan stok', store._p[0].variants.map((v) => v.stock), [25, 30, 25]);
  check('stok total ikut menyesuaikan', store._p[0].stock, 80);
}

console.log(gagal === 0 ? '\n✅ SEMUA UJI STOK LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
