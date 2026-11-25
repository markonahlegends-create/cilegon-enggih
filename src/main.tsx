import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { hapusAsetBasi, periksaAsetSekali } from './lib/asetBasi';
import './index.css';

/*
 * Bersihkan penanda aset basi sebelum React berjalan. Kalau halaman ini
 * dimuat ulang setelah pemulihan, penandanya harus hilang agar tidak
 * memicu pemulihan berulang.
 */
hapusAsetBasi();
/*
 * Deteksi & pemulihan "halaman tanpa gaya": kalau CSS ternyata tidak
 * terpasang (HTML basi dari cache menunjuk aset yang sudah tidak ada),
 * muat ulang sekali melewati cache. Lihat src/lib/asetBasi.ts.
 */
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
