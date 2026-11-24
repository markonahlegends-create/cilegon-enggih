/**
 * PENYEDIA PEMBAYARAN MIDTRANS SNAP
 *
 * Satu tempat untuk seluruh interaksi browser dengan Midtrans, supaya
 * CheckoutModal tidak dipenuhi urusan memuat skrip pihak ketiga.
 *
 * TIGA HAL YANG PERLU DIPAHAMI:
 *
 *  1. `onSuccess` DARI SNAP BUKAN BUKTI PEMBAYARAN.
 *     Callback itu bisa dipicu oleh pembeli yang menekan tombol di peramban
 *     sendiri. Yang menentukan pesanan benar-benar lunas hanyalah webhook yang
 *     tanda tangannya sudah diverifikasi server (server/core.js). Karena itu
 *     setelah `onSuccess`, kita hanya menampilkan "menunggu konfirmasi" dan
 *     menanyakan status ke server — bukan langsung menganggap lunas.
 *
 *  2. SKRIP DIMUAT DARI DOMAIN MIDTRANS, BUKAN DIBUNDEL.
 *     snap.js harus datang dari app.midtrans.com / app.sandbox.midtrans.com
 *     karena ia membuka iframe ke domain itu. URL-nya ditentukan server
 *     (lewat `snapScriptUrl`) supaya sandbox dan produksi tidak tertukar.
 *
 *  3. TIDAK ADA KUNCI RAHASIA DI SINI.
 *     Hanya `clientKey` yang menyentuh browser; itu memang publik. `serverKey`
 *     tetap di server dan tidak pernah dikirim ke halaman.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSnapToken, checkMidtransStatus } from '../lib/api';

export type SnapOutcome = 'success' | 'pending' | 'error' | 'closed';

interface SnapResult {
  order_id?: string;
  transaction_status?: string;
  status_code?: string;
  status_message?: string;
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: SnapResult) => void;
          onPending?: (result: SnapResult) => void;
          onError?: (result: SnapResult) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

/**
 * Muat snap.js sekali saja, lalu panggil ulang pemanggil berikutnya.
 * Tanpa penanda `data-ce-snap`, React yang memasang ulang komponen akan
 * menambahkan <script> baru setiap kali — dan popup bisa terbuka dua kali.
 */
const muatSnapScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Tanpa peramban.'));

    const penanda = 'data-ce-snap';
    const sudahAda = document.querySelector<HTMLScriptElement>(`script[${penanda}]`);

    if (sudahAda) {
      if (window.snap) return resolve();
      sudahAda.addEventListener('load', () => resolve());
      sudahAda.addEventListener('error', () => reject(new Error('snap.js gagal dimuat.')));
      return;
    }

    if (window.snap) return resolve();

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(penanda, '1');
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Tidak bisa memuat Midtrans. Periksa koneksi internet Anda.'));
    document.body.appendChild(script);
  });

export const useMidtransSnap = () => {
  const [sedangMenyiapkan, setSedangMenyiapkan] = useState(false);
  const [galat, setGalat] = useState('');
  /** Menyimpan callback yang menunggu popup ditutup, agar state React segar. */
  const selesaiRef = useRef<((outcome: SnapOutcome) => void) | null>(null);

  useEffect(() => {
    return () => {
      selesaiRef.current = null;
    };
  }, []);

  /**
   * Buka popup pembayaran untuk sebuah pesanan.
   * `onOutcome` selalu dipanggil tepat satu kali, apa pun hasilnya.
   */
  const bayar = useCallback(
    async (orderId: string, onOutcome: (outcome: SnapOutcome) => void) => {
      setGalat('');
      setSedangMenyiapkan(true);

      let sudahSelesai = false;
      const selesaikan = (outcome: SnapOutcome) => {
        if (sudahSelesai) return;
        sudahSelesai = true;
        selesaiRef.current = null;
        setSedangMenyiapkan(false);
        onOutcome(outcome);
      };

      try {
        const sesi = await createSnapToken(orderId);
        await muatSnapScript(sesi.snapScriptUrl);

        if (!window.snap) throw new Error('Midtrans tidak tersedia di peramban ini.');

        selesaiRef.current = selesaikan;

        window.snap.pay(sesi.token, {
          onSuccess: () => selesaikan('success'),
          onPending: () => selesaikan('pending'),
          onError: () => selesaikan('error'),
          /*
           * onClose dipanggil juga setelah onSuccess/onPending di sebagian
           * peramban. Penanda `sudahSelesai` mencegah callback ganda — tanpa
           * itu, layar bisa berubah dari "berhasil" menjadi "dibatalkan".
           */
          onClose: () => selesaikan('closed')
        });
      } catch (err) {
        const pesan =
          err instanceof Error ? err.message : 'Gagal membuka pembayaran Midtrans.';
        setGalat(pesan);
        selesaikan('error');
      }
    },
    []
  );

  return { bayar, sedangMenyiapkan, galat, checkStatus: checkMidtransStatus };
};
