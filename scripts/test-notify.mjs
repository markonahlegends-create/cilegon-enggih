/**
 * UJI NOTIFIKASI TELEGRAM — memastikan pesan yang diterima admin benar.
 *
 * LATAR BELAKANG (laporan 20 Nov 2026)
 * Bot mengirim notifikasi pesanan baru dengan "Total: Rp 0" padahal subtotal
 * Rp 24.000 + ongkir Rp 8.000 + kode unik Rp 666. Penyebabnya: template membaca
 * `order.total`, sementara pesanan yang BARU dibuat menyimpan `totalAmount`.
 * Angka nol pada notifikasi berbahaya — admin bisa mengira pesanan gratis.
 *
 * Uji ini juga mengunci hal lain yang mudah rusak tanpa terlihat:
 *   - notifikasi bukti transfer WAJIB membawa tombol verifikasi;
 *   - callback_data harus di bawah batas 64 byte milik Telegram;
 *   - tidak ada karakter yang merusak parse_mode HTML;
 *   - nominal tidak pernah nol bila komponennya ada.
 *
 * Cara pakai: node scripts/test-notify.mjs
 */
import {
  templateNewOrder,
  templatePaymentProof,
  templatePaid,
  templateShipped,
  paymentProofKeyboard,
  orderTotal,
  telegramConfig
} from '../server/notify.js';

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, kondisi) => check(nama, Boolean(kondisi), true);

/* Pesanan seperti yang dikirim notifikasi saat BARU dibuat (punya totalAmount) */
const pesananBaru = () => ({
  orderId: 'CE-20261120-403',
  invoiceNumber: 'INV/CE/2026/11/0001',
  customerName: 'SOBNet',
  customerPhone: '082249879873',
  destination: 'Kota Cilegon (Jombang, Purwakarta, Cibeber, Citangkil, Ramanuju)',
  items: [
    {
      name: 'Gantungan Kunci Karet 3D (CEGAN-01 · LARGE) (CEGAN-01 · LARGE)',
      qty: 1,
      price: 24000
    }
  ],
  subtotal: 24000,
  shippingCost: 8000,
  uniqueCode: 666,
  totalAmount: 32666,
  paymentMethod: 'Transfer Bank DANA (E-Wallet)',
  isPreOrder: true,
  preOrderNote: 'PRE-ORDER 10-15 HARI KERJA'
});

/* Pesanan yang dibaca ulang dari database (punya total) */
const pesananLama = () => ({ ...pesananBaru(), total: 32666, totalAmount: undefined });

console.log('— Nominal —');
check('orderTotal membaca totalAmount', orderTotal(pesananBaru()), 32666);
check('orderTotal membaca total', orderTotal(pesananLama()), 32666);
check(
  'orderTotal menghitung ulang bila keduanya kosong',
  orderTotal({ subtotal: 24000, shippingCost: 8000, uniqueCode: 666 }),
  32666
);
check('orderTotal aman untuk null', orderTotal(null), 0);

console.log('\n— Notifikasi pesanan baru —');
{
  const teks = templateNewOrder(pesananBaru());
  benar('tidak lagi menampilkan Rp 0', !teks.includes('Total: Rp 0'));
  benar('menampilkan total yang benar', teks.includes('Total: Rp 32.666'));
  benar('menampilkan subtotal', teks.includes('Subtotal: Rp 24.000'));
  benar('menampilkan ongkir', teks.includes('Ongkir: Rp 8.000'));
  benar('menampilkan kode unik', teks.includes('Kode unik: Rp 666'));
  benar('menampilkan nomor pesanan', teks.includes('CE-20261120-403'));
  benar('menampilkan pre-order', teks.includes('PRE-ORDER'));
  benar('tanpa baris kosong berlebih', !teks.includes('\n\n\n'));
  // Pesanan lama yang sudah punya `total` harus sama persis hasilnya.
  check('bentuk data lama menghasilkan teks sama', templateNewOrder(pesananLama()), teks);
}

console.log('\n— Label varian tidak dobel —');
{
  // Kasus nyata dari laporan: nama sudah memuat label, jangan ditempel lagi.
  const teks = templateNewOrder({
    ...pesananBaru(),
    items: [
      {
        name: 'Gantungan Kunci Karet 3D (CEGAN-01 · LARGE)',
        variantLabel: 'CEGAN-01 · LARGE',
        qty: 1,
        price: 24000
      }
    ]
  });
  benar(
    'label tidak tercetak dua kali',
    !teks.includes('(CEGAN-01 · LARGE) (CEGAN-01 · LARGE)')
  );
  benar('nama produk tetap muncul', teks.includes('Gantungan Kunci Karet 3D'));

  // Produk tanpa label di nama tetap mendapat label dari variantLabel.
  const teks2 = templateNewOrder({
    ...pesananBaru(),
    items: [{ name: 'Kaos Baja', variantLabel: 'XL · Navy', qty: 2, price: 100000 }]
  });
  benar('label tetap ditambahkan bila belum ada', teks2.includes('Kaos Baja (XL · Navy)'));
  benar('jumlah tampil', teks2.includes('× 2'));
}

console.log('\n— Notifikasi bukti transfer —');
{
  const order = {
    ...pesananLama(),
    paymentProofNote: 'Transfer DANA a/n SOBNet',
    paymentProofAt: '2026-11-20T02:00:00.000Z'
  };
  const teks = templatePaymentProof(order);
  benar('menampilkan nominal benar', teks.includes('Rp 32.666'));
  benar('tidak menampilkan Rp 0', !teks.includes('Rp 0'));
  benar('menampilkan catatan pembeli', teks.includes('Transfer DANA a/n SOBNet'));
  benar('menyebut tombol di bawah', teks.includes('tombol di bawah'));
}

console.log('\n— Tombol verifikasi —');
{
  const kb = paymentProofKeyboard({ orderId: 'CE-20261120-403' });
  const semua = kb.inline_keyboard.flat();
  benar('ada tombol verifikasi', semua.some((b) => b.callback_data === 'paid:CE-20261120-403'));
  benar('ada tombol batal', semua.some((b) => b.callback_data === 'void:CE-20261120-403'));
  benar('tombol dashboard berupa URL', semua.some((b) => typeof b.url === 'string'));
  const terpanjang = Math.max(...semua.filter((b) => b.callback_data).map((b) => b.callback_data.length));
  benar(`callback_data ${terpanjang} byte < 64`, terpanjang < 64);
  benar(
    'callback_data hanya berisi nomor pesanan',
    semua
      .filter((b) => b.callback_data)
      .every((b) => /^(paid|void):CE-[0-9-]+$/.test(b.callback_data))
  );
}

console.log('\n— Notifikasi lain —');
{
  benar('lunas menampilkan nominal', templatePaid(pesananLama()).includes('Rp 32.666'));
  benar(
    'dikirim mencantumkan resi',
    templateShipped({ ...pesananLama(), courier: 'JNE Reguler', resi: 'JNE123' }).includes('JNE123')
  );
}

console.log('\n— Escape HTML —');
{
  const teks = templateNewOrder({ ...pesananLama(), customerName: '<script>x</script> & Co' });
  benar('kurung sudut di-escape', !teks.includes('<script>'));
  benar('ampersand di-escape', teks.includes('&amp; Co'));
}

console.log('\n— Konfigurasi —');
{
  const cfg = telegramConfig({
    telegram: { botToken: ' 123:abc ', chatId: ' 555 ', enabled: true }
  });
  check('token dirapikan spasinya', cfg.botToken, '123:abc');
  check('chat id dirapikan spasinya', cfg.chatId, '555');
  check('notifyPaymentProof default aktif', cfg.notifyPaymentProof, true);
  const mati = telegramConfig({ telegram: { botToken: '1:a', chatId: '5', notifyPaymentProof: false } });
  check('notifyPaymentProof bisa dimatikan', mati.notifyPaymentProof, false);
}

console.log(
  gagal === 0 ? '\n✅ SEMUA UJI NOTIFIKASI LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`
);
process.exit(gagal === 0 ? 0 : 1);
