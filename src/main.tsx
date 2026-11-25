import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { hapusAsetBasi, periksaAsetSekali } from './lib/asetBasi';
import './index.css';

/*
 * PEMULIHAN "HALAMAN TANPA GAYA" — dijalankan SEBELUM React menulis apa pun.
 *
 * Peramban yang terlanjur menyimpan dokumen HTML lama menunjuk berkas
 * /assets/index-<hash>.css yang sudah tidak ada di server, sehingga halaman
 * tampil tanpa tata letak. Lihat src/lib/asetBasi.ts untuk sebab lengkapnya.
 *
 * Urutannya penting: `hapusAsetBasi` membersihkan penanda sesi lebih dulu
 * (supaya pemulihan berikutnya tidak terhalang), baru `periksaAsetSekali`
 * memeriksa apakah CSS benar-benar terpasang.
 */
hapusAsetBasi();
periksaAsetSekali();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      Penangkap galat di lapisan TERLUAR.
      Tanpa ini, satu galat di komponen mana pun mengosongkan seluruh
      halaman menjadi putih kosong — tanpa pesan, tanpa petunjuk.
    */}
    <ErrorBoundary bagian="aplikasi">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
