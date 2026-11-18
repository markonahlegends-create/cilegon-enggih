import { useEffect, useRef } from 'react';

/**
 * Menutup modal / panel / menu ketika pengguna menekan tombol "kembali".
 *
 * MASALAH YANG DIPERBAIKI
 * ------------------------------------------------------------------
 * Sebelumnya modal (checkout, keranjang, menu HP) hanya mendengarkan
 * tombol `Escape`. Di HP tidak ada tombol Escape, dan Android/iOS hanya
 * meneruskan tombol "kembali" sebagai navigasi riwayat browser.
 * Akibatnya menekan "kembali" MENINGGALKAN halaman, sementara popup
 * checkout tetap terbuka di atasnya — persis keluhan pemilik toko.
 *
 * MENGAPA MEMAKAI SATU REGISTRY, BUKAN SATU LISTENER PER MODAL
 * ------------------------------------------------------------------
 * Percobaan pertama memasang listener `popstate` di setiap modal. Hasil
 * pengujian: saat keranjang pindah ke checkout, listener keranjang ikut
 * menangkap `popstate` dan checkout tertutup sendiri sebelum terlihat.
 * Dua modal yang bereaksi pada satu tekanan tombol kembali juga membuat
 * riwayat mundur dua langkah sehingga pengguna terlempar keluar halaman.
 *
 * Solusinya: satu daftar (stack) overlay global dengan SATU listener.
 * Hanya overlay paling atas yang ditutup, dan entri riwayat penanda
 * dipakai bersama selama masih ada overlay terbuka.
 *
 * CARA KERJA
 * ------------------------------------------------------------------
 * - Overlay pertama dibuka  -> satu entri riwayat penanda didorong.
 *   URL-nya sama, jadi alamat tidak berubah dan halaman tidak dimuat ulang.
 * - Tombol kembali ditekan  -> entri penanda dikonsumsi, overlay teratas
 *   ditutup, pengguna tetap di halaman yang sama.
 * - Overlay ditutup lewat X -> penanda dimundurkan agar riwayat tidak
 *   menumpuk (tanpa ini, tombol kembali terasa "tidak berfungsi").
 */

interface Overlay {
  id: symbol;
  close: () => void;
}

const overlays: Overlay[] = [];
let markerActive = false;
/** URL saat penanda dipasang, untuk mendeteksi navigasi di atasnya. */
let markerHref = '';
let listenerAttached = false;
/** Jumlah `history.back()` yang kita picu sendiri (bukan oleh pengguna). */
let selfBacks = 0;

const handlePopState = () => {
  // Abaikan popstate yang berasal dari pembersihan riwayat kita sendiri.
  if (selfBacks > 0) {
    selfBacks -= 1;
    return;
  }

  /*
   * CATATAN: `history.state` di sini adalah milik entri TUJUAN, bukan
   * entri yang ditinggalkan, sehingga tidak bisa dipakai untuk memastikan
   * penanda kita yang dikonsumsi. Karena itu kita memakai `markerActive`
   * yang diset saat penanda dipasang, ditambah penjaga URL pada
   * `disarmIfUnused` agar navigasi pengguna tidak ditarik mundur.
   */
  markerActive = false;
  const top = overlays[overlays.length - 1];
  if (top) top.close();
};

const attachListener = () => {
  if (listenerAttached) return;
  window.addEventListener('popstate', handlePopState);
  listenerAttached = true;
};

/** Pastikan selalu ada tepat satu entri penanda selama ada overlay. */
const arm = () => {
  if (overlays.length === 0) return;
  if (markerActive) return;
  markerActive = true;
  markerHref = window.location.href;
  // `{ ceOverlay: true }` membuat entri ini bisa dikenali saat debugging.
  window.history.pushState({ ceOverlay: true }, '');
};

/**
 * Lepas penanda yang tidak terpakai supaya riwayat tidak menumpuk.
 *
 * Ditunda satu putaran event loop: saat keranjang berganti ke checkout,
 * overlay lama ditutup dan overlay baru dibuka pada commit yang sama.
 * Tanpa penundaan, daftar sempat kosong sekejap dan kita sudah terlanjur
 * memundurkan riwayat — penanda checkout lalu hilang dan tombol kembali
 * berikutnya malah meninggalkan halaman.
 */
let disarmTimer: ReturnType<typeof setTimeout> | null = null;

const disarmIfUnused = () => {
  if (disarmTimer) clearTimeout(disarmTimer);
  disarmTimer = setTimeout(() => {
    disarmTimer = null;
    if (overlays.length > 0) return;
    if (!markerActive) return;
    markerActive = false;

    /*
     * Kalau pengguna sudah berpindah halaman di atas penanda (misalnya
     * mengetuk tautan di dalam menu), JANGAN mundurkan riwayat: back()
     * akan menarik mereka kembali ke halaman sebelumnya sehingga tautan
     * yang baru diklik terasa "tidak berfungsi". Entri penanda dibiarkan
     * terkubur; efek sampingnya tidak terasa (tombol kembali berikutnya
     * hanya kembali ke halaman asal, seperti biasa).
     */
    if (window.location.href !== markerHref) return;

    selfBacks += 1;
    window.history.back();
  }, 0);
};

const register = (overlay: Overlay) => {
  attachListener();
  overlays.push(overlay);
  arm();
};

const unregister = (id: symbol) => {
  const index = overlays.findIndex((o) => o.id === id);
  if (index !== -1) overlays.splice(index, 1);
  // Setelah menutup satu overlay, sisa overlay di bawahnya butuh penanda
  // baru karena penanda sebelumnya sudah dikonsumsi tombol kembali.
  arm();
  disarmIfUnused();
};

/**
 * @param isOpen  apakah overlay sedang terbuka
 * @param onClose dipanggil ketika tombol kembali ditekan
 */
export const useBackClose = (isOpen: boolean, onClose: () => void): void => {
  // Disimpan di ref agar perubahan fungsi onClose tidak memicu efek ulang.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const id = Symbol('overlay');
    register({ id, close: () => onCloseRef.current() });
    return () => unregister(id);
  }, [isOpen]);
};
