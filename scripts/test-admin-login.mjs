/**
 * UJI LOGIN ADMIN — memastikan password yang BENAR tidak ditolak.
 *
 * LATAR BELAKANG (laporan 22 Nov 2026)
 * "password salah tolong diperbaiki"
 *
 * Saat diuji, ditemukan bug terukur: perbandingan password memakai `===`
 * mentah. Akibatnya password yang benar TETAPI tersalin dengan spasi atau
 * baris baru di ujung — hal yang hampir selalu terjadi saat menyalin dari
 * WhatsApp, Notion, atau Catatan HP — ditolak dengan pesan
 * "Password admin salah". Admin lalu mengira passwordnya keliru, padahal
 * yang salah hanya satu karakter tak terlihat di ujung.
 *
 * Yang diuji di sini:
 *   1. password benar → 200 + sesi terbit
 *   2. password salah → 401
 *   3. password benar + spasi/baris baru di ujung → 200 (bug yang diperbaiki)
 *   4. beda huruf besar/kecil → 401 dengan pesan KHUSUS, bukan pesan umum
 *   5. spasi di TENGAH password tidak ikut dipangkas
 *   6. audit mencatat BENTUK password, tidak pernah isinya
 *
 * Cara pakai: node scripts/test-admin-login.mjs
 */
import crypto from 'node:crypto';

/* Password uji acak — tidak meniru nilai produksi apa pun. */
const PASSWORD = `Uji${crypto.randomBytes(6).toString('hex')}!`;
process.env.ADMIN_PASSWORD = PASSWORD;
process.env.ADMIN_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'production';

/** Penanda waktu mulai uji — dipakai menyaring catatan audit run ini saja. */
const MULAI = Date.now();

const { dispatch } = await import('../server/core.js');
const { store } = await import('../server/db.js');

let gagal = 0;
const cek = (nama, kondisi, detail = '') => {
  if (!kondisi) gagal += 1;
  console.log(`  ${kondisi ? 'OK  ' : 'SALAH'} ${nama}${kondisi || !detail ? '' : ` (${detail})`}`);
};

let ip = 0;
/** Pesan galat harus bisa ditindaklanjuti, bukan sekadar "salah". */
const sebutPanjang = (pesan) => /\d+ karakter/.test(String(pesan || ''));

const login = async (password) => {
  ip += 1;
  const hasil = await dispatch({
    method: 'POST',
    path: '/api/admin/login',
    query: {},
    body: { username: 'admin', password },
    headers: { 'x-forwarded-for': `10.20.30.${ip}`, 'content-type': 'application/json' }
  });
  return {
    status: hasil.status,
    body: hasil.body || {},
    headers: hasil.headers || {}
  };
};

const setCookie = (headers) => headers['Set-Cookie'] || headers['set-cookie'] || '';

console.log('\n1. Password benar diterima');
{
  const r = await login(PASSWORD);
  cek('status 200', r.status === 200, `dapat ${r.status}`);
  cek('sesi diterbitkan lewat cookie HttpOnly', /ce_admin_session=/.test(setCookie(r.headers)));
  cek('cookie ditandai HttpOnly', /HttpOnly/i.test(setCookie(r.headers)));
  cek('tidak meminta OTP (2FA mati di uji ini)', r.body.otpRequired === false);
}

console.log('\n2. Password salah ditolak, dengan pesan yang bisa ditindaklanjuti');
{
  /*
   * KASUS NYATA (22 Nov 2026): admin mengetik 19 karakter, sedangkan nilai
   * yang terpasang 43 karakter. Pesan lama "Password admin salah" membuat
   * admin mengira salah ketik dan mencoba berulang, padahal nilai di hosting
   * memang nilai lain. Pesan sekarang menyebut PANJANG (bukan isi) supaya
   * pemilik toko tahu bahwa yang perlu dilakukan adalah MENGGANTI nilai.
   */
  const panjangBeda = await login(`${PASSWORD}-beda-jauh-lebih-panjang`);
  cek('panjang berbeda → 401', panjangBeda.status === 401, `dapat ${panjangBeda.status}`);
  cek(
    'pesan menyebut jumlah karakter',
    sebutPanjang(panjangBeda.body.error),
    String(panjangBeda.body.error || '').slice(0, 90)
  );
  cek(
    'pesan menyuruh MENGGANTI nilai di hosting',
    /ganti\s+ADMIN_PASSWORD/i.test(String(panjangBeda.body.error || '')),
    String(panjangBeda.body.error || '').slice(0, 120)
  );
  cek(
    'panjang dikirim lewat field terstruktur',
    typeof panjangBeda.body.panjangDikirim === 'number' &&
      typeof panjangBeda.body.panjangTersimpan === 'number',
    JSON.stringify(panjangBeda.body).slice(0, 90)
  );

  /* Panjang SAMA tetapi isi beda → arahkan ke ejaan/kapitalisasi. */
  const samaPanjang = await login(`${PASSWORD.slice(0, -1)}Z`);
  cek('panjang sama → 401', samaPanjang.status === 401, `dapat ${samaPanjang.status}`);
  cek(
    'panjang sama → pesan mengarah ke ejaan/kapitalisasi, bukan menyuruh ganti',
    /kapitalisasi|ejaan/i.test(String(samaPanjang.body.error || '')) &&
      !/ganti\s+ADMIN_PASSWORD/i.test(String(samaPanjang.body.error || '')),
    String(samaPanjang.body.error || '').slice(0, 110)
  );
  cek(
    'password asli TIDAK dibocorkan di pesan galat',
    !String(panjangBeda.body.error).includes(PASSWORD) &&
      !String(samaPanjang.body.error).includes(PASSWORD)
  );
}

/*
 * INTI PERBAIKAN. Setiap variasi di bawah ini dulu menghasilkan 401 padahal
 * password yang diketik benar.
 */
console.log('\n3. Spasi / baris baru di UJUNG diabaikan (bug yang diperbaiki)');
{
  const variasi = [
    ['spasi di akhir', `${PASSWORD} `],
    ['spasi di awal', ` ${PASSWORD}`],
    ['spasi di kedua ujung', `  ${PASSWORD}  `],
    ['baris baru di akhir (Enter di HP)', `${PASSWORD}\n`],
    ['CRLF (salin dari Windows)', `${PASSWORD}\r\n`],
    ['tab di akhir', `${PASSWORD}\t`]
  ];
  for (const [label, nilai] of variasi) {
    const r = await login(nilai);
    cek(label, r.status === 200, `dapat ${r.status}`);
  }
}

console.log('\n4. Kapitalisasi tetap dihormati, dengan pesan yang tepat');
{
  const r = await login(PASSWORD.toLowerCase());
  cek('huruf kecil semua → 401', r.status === 401, `dapat ${r.status}`);
  cek(
    'pesan menyebut HURUF BESAR/kecil, bukan pesan umum',
    /huruf besar\/kecil/i.test(String(r.body.error || '')),
    String(r.body.error || '').slice(0, 90)
  );
}

console.log('\n5. Spasi di TENGAH password tidak ikut dipangkas');
{
  /*
   * Server menormalkan HANYA ujung. Untuk membuktikan spasi tengah tetap
   * dibandingkan apa adanya, kita uji lewat bentuk audit: password benar
   * yang diberi spasi di tengah harus DITOLAK.
   */
  const denganSpasiTengah = `${PASSWORD.slice(0, 3)} ${PASSWORD.slice(3)}`;
  const r = await login(denganSpasiTengah);
  cek('spasi disisipkan di tengah → 401', r.status === 401, `dapat ${r.status}`);
}

console.log('\n6. Audit mencatat BENTUK password, tidak pernah isinya');
{
  /*
   * Hanya catatan yang dibuat RUN INI. Audit bersifat menumpuk, jadi tanpa
   * filter waktu uji akan membaca catatan lama dari kode sebelum perbaikan
   * dan gagal secara palsu.
   */
  const audit = await store.list('audit').catch(() => []);
  const gagalLogin = audit.filter(
    (d) => d.action === 'login.gagal' && new Date(d.at).getTime() >= MULAI
  );
  cek('ada catatan login.gagal', gagalLogin.length > 0, `${gagalLogin.length} catatan`);

  const isi = JSON.stringify(audit);
  cek('password asli TIDAK pernah masuk audit', !isi.includes(PASSWORD));
  cek('tidak ada kunci bernama password di detail', !/"password"\s*:/.test(isi));

  /*
   * Audit diurutkan dengan yang terbaru di depan. Blok 4 menghasilkan
   * login gagal karena BEDA KAPITALISASI, blok 5 karena spasi di tengah.
   * Kita cari catatan yang tepat, bukan mengasumsikan urutan.
   */
  const bedaKapital = gagalLogin.find((d) => d.detail?.kemungkinanBedaHurufBesarKecil === true);
  cek('audit menandai beda kapitalisasi', Boolean(bedaKapital), JSON.stringify(gagalLogin[0]?.detail || {}));
  cek(
    'audit menyimpan panjang password yang dikirim',
    gagalLogin.length > 0 && gagalLogin.every((d) => typeof d.detail?.panjangDikirim === 'number'),
    JSON.stringify(gagalLogin[0]?.detail || {})
  );
}

console.log('\n7. Diagnosa melaporkan BENTUK password tersimpan');
{
  const r = await dispatch({
    method: 'GET',
    path: '/api/diagnose',
    query: {},
    body: null,
    headers: { 'x-forwarded-for': '10.20.31.1' }
  });

  const daftar = r.body?.checks || [];
  const baris = daftar.find((x) => x.id === 'password-shape');
  cek('diagnosa punya baris password-shape', Boolean(baris), `status ${r.status}`);
  if (baris) {
    cek('password uji dilaporkan sehat (tanpa spasi ujung)', baris.status === 'ok', JSON.stringify(baris));
    cek('detail memuat panjang karakter', sebutPanjang(baris.detail), String(baris.detail || ''));
    cek('detail TIDAK memuat nilai password', !JSON.stringify(baris).includes(PASSWORD));
  }
}

console.log(gagal === 0 ? '\n✅ LOGIN ADMIN LOLOS SEMUA UJI\n' : `\n❌ ${gagal} uji gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
