import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, X, Film, Volume2, VolumeX } from 'lucide-react';
import type { ProductVideo } from '../data/products';

/**
 * Ubah tautan YouTube / Instagram / TikTok menjadi URL embed.
 *
 * KENAPA DI FRONTEND: server hanya menyimpan URL apa adanya. Kalau format
 * embed berubah (mis. YouTube mengubah parameter), perbaikannya cukup di sini
 * tanpa migrasi data.
 *
 * Mengembalikan null bila tautan tidak dikenali → video tidak ditampilkan
 * (lebih baik hilang daripada menampilkan iframe kosong).
 */
export const toEmbedUrl = (video: ProductVideo): string | null => {
  const url = String(video.url || '').trim();
  if (!url) return null;

  // Sudah berupa URL embed/shorts yang bisa langsung dipakai.
  if (/youtube\.com\/embed\//i.test(url) || /youtube-nocookie\.com\/embed\//i.test(url)) {
    return url;
  }
  if (/tiktok\.com\/embed/i.test(url) || /instagram\.com\/(p|reel)\//i.test(url)) {
    return url.endsWith('/') ? `${url}embed/` : url;
  }

  // YouTube: watch?v=ID, youtu.be/ID, /shorts/ID
  const yt =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/i.exec(url);
  if (yt) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (video.startAt) params.set('start', String(video.startAt));
    return `https://www.youtube-nocookie.com/embed/${yt[1]}?${params.toString()}`;
  }

  return null;
};

/**
 * APAKAH AUTOPLAY BOLEH DIPAKAI DI PERANGKAT INI?
 *
 * Browser modern MEMBLOKIR autoplay yang bersuara (kebijakan Chrome/Safari).
 * Kalau kita paksa, hasilnya justru video yang diam membeku di frame pertama
 * — terlihat seperti gambar rusak. Satu-satunya bentuk autoplay yang
 * diizinkan secara universal adalah **senyap**.
 *
 * Jadi: autoplay selalu `muted`. Suara hanya aktif bila pembeli menekan
 * tombol speaker. Ini bukan kekurangan — video produk di Shopee/Tokopedia
 * juga berjalan tanpa suara sampai ditekan.
 */
const AUTOPLAY_SENYAP = true;
interface GaleriVideoProps {
  videos?: ProductVideo[];
  /**
   * true = berjalan sendiri di dalam galeri (layar pertama, menarik perhatian).
   * false = hanya poster + tombol play.
   */
  autoplay?: boolean;
  className?: string;
  /** Poster pengganti bila video tidak punya poster sendiri (mis. embed). */
  fallbackPoster?: string;
}

/**
 * Video produk untuk GALERI PRODUK.
 *
 * KENAPA DIPISAH DARI `ProductVideoPlayer`
 * Versi lama hanya menampilkan poster + tombol play, dan diletakkan jauh di
 * bawah halaman (setelah tabel spesifikasi). Pembeli tidak pernah melihatnya,
 * apalagi terpancing menonton — padahal video produk adalah hal pertama yang
 * membuat orang berhenti menggulir.
 *
 * RIWAYAT BUG (penting, jangan diulang)
 * Versi pertama komponen ini punya dua cacat yang membuat video TIDAK PERNAH
 * bisa diputar — autoplay tidak jalan, dan tombol play pun tidak bereaksi:
 *
 *   1. Tombol play memanggil prop `onOpen` yang TIDAK PERNAH dikirim oleh
 *      halaman produk. Karena kosong, cabang `else` yang dijalankan, yaitu
 *      `setGagal(false)` — dan nilai `gagal` memang sudah `false`, jadi
 *      menekan tombol tidak mengubah apa pun. Tidak ada error, tidak ada
 *      jejak: tombol mati diam-diam.
 *   2. Elemen `<video>` dirender tanpa atribut `controls`, sehingga bahkan
 *      bila video berhasil tampil, pembeli tidak punya cara memutar,
 *      menjeda, atau menggeser waktunya.
 *
 * Sekarang tidak ada ketergantungan pada prop dari luar: tombol play bekerja
 * sendiri di dalam komponen ini, dan `<video>` SELALU punya `controls`.
 */
export const GaleriVideo: React.FC<GaleriVideoProps> = ({
  videos,
  autoplay = false,
  className = '',
  fallbackPoster
}) => {
  const list = useMemo(
    () => (Array.isArray(videos) ? videos.filter((v) => v && v.url) : []),
    [videos]
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * `siap` menandai pembeli sudah menekan play pada video FILE.
   *
   * Sebelum ditekan, yang dirender adalah poster (ringan, hemat kuota). Begitu
   * ditekan, elemen `<video controls>` dipasang dan langsung diputar. Ini juga
   * cara paling andal menghindari blokir autoplay: pemutaran terjadi karena
   * tindakan pengguna, bukan karena halaman dimuat.
   */
  const [siap, setSiap] = useState(false);
  const [suaraAktif, setSuaraAktif] = useState(false);
  const [gagal, setGagal] = useState(false);
  const [embedDibuka, setEmbedDibuka] = useState(false);
  const [kurangiGerak, setKurangiGerak] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setKurangiGerak(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setKurangiGerak(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const aktif = list[0];
  const embedUrl = aktif && aktif.source === 'embed' ? toEmbedUrl(aktif) : null;

  /*
   * KAPAN PEMUTAR DIPASANG.
   *
   * `siap`            → pembeli sudah menekan play.
   * autoplay aktif    → pemutar dipasang langsung supaya bisa berjalan sendiri.
   *                     Tanpa syarat ini, autoplay mustahil terjadi: pemutar
   *                     baru ada setelah diklik, dan yang mengklik sudah
   *                     pasti menonton — bukan autoplay namanya.
   * reduced-motion    → jangan pasang sendiri; hormati pilihan pembeli.
   */
  const tampilPemutar = siap || (autoplay && !kurangiGerak);

  /*
   * AUTOPLAY SENYAP.
   *
   * Syarat yang tidak bisa dilanggar: `muted` + `playsInline`. Tanpa keduanya,
   * Chrome dan iOS menolak memutar video yang belum disentuh pengguna.
   *
   * Autoplay hanya dicoba sekali di awal. Kalau browser menolak (mode hemat
   * daya, iOS Low Power Mode), poster + tombol play tetap ada dan berfungsi —
   * jadi penolakan bukan kegagalan, cukup diamkan.
   */
  useEffect(() => {
    const v = videoRef.current;
    if (!autoplay || kurangiGerak || gagal) return;
    if (!v) return;

    let dibatalkan = false;
    const coba = async () => {
      try {
        v.muted = true;
        await v.play();
      } catch {
        /* Ditolak browser — biarkan poster yang tampil, jangan tampilkan error. */
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      void coba();
      return () => {
        dibatalkan = true;
      };
    }

    /* Hanya saat benar-benar terlihat — menghemat kuota pembeli. */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void coba();
          else v.pause();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(v);

    const onVisibility = () => {
      if (document.hidden) v.pause();
      else void coba();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      dibatalkan = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoplay, kurangiGerak, gagal, tampilPemutar]);

  if (!list.length || !aktif) return null;

  /* Video dari tautan yang tidak dikenali: jangan tampilkan kotak kosong. */
  if (aktif.source === 'embed' && !embedUrl) return null;

  const poster = aktif.poster || fallbackPoster || '';

  const mulaiPutar = () => {
    setGagal(false);
    setSiap(true);
  };

  /* ------------------------- EMBED (YouTube/TikTok) ------------------------ */
  if (aktif.source === 'embed') {
    return (
      <div className={`relative h-full w-full bg-slate-900 ${className}`}>
        {embedDibuka && embedUrl ? (
          <>
            <iframe
              src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
              title={aktif.title || 'Video produk'}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              type="button"
              onClick={() => setEmbedDibuka(false)}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Tutup video"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEmbedDibuka(true)}
            className="group relative flex h-full w-full items-center justify-center"
            aria-label="Putar video produk"
          >
            {poster ? (
              <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-navy-800 to-forest-700" />
            )}
            <span className="absolute inset-0 bg-navy-900/25" />
            <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-105 group-hover:bg-white">
              <Play className="ml-0.5 h-5 w-5 text-navy-800" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    );
  }

  /* ----------------------------- FILE (mp4/webm) --------------------------- */

  /*
   * Kalau berkasnya gagal dimuat (dihapus dari storage, format ditolak),
   * PEMBELI HARUS TAHU. Sebelum ini kegagalan hanya membuat pemutar diam di
   * frame pertama tanpa penjelasan apa pun.
   */
  if (gagal) {
    return (
      <div className={`relative flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 ${className}`}>
        {poster ? (
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        ) : null}
        <Film className="relative z-10 h-6 w-6 text-white/70" />
        <p className="relative z-10 px-4 text-center text-[11px] text-white/80">
          Video tidak bisa dimuat. Silakan lihat foto produk di samping.
        </p>
        <button
          type="button"
          onClick={() => {
            setGagal(false);
            setSiap(true);
          }}
          className="relative z-10 rounded-lg bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/25"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  /* Pemutar belum perlu dipasang → poster + tombol play. */
  if (!tampilPemutar) {
    return (
      <div className={`relative h-full w-full bg-slate-900 ${className}`}>
        <button
          type="button"
          onClick={mulaiPutar}
          className="group relative flex h-full w-full items-center justify-center"
          aria-label="Putar video produk"
        >
          {poster ? (
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 bg-gradient-to-br from-navy-800 to-forest-700" />
          )}
          <span className="absolute inset-0 bg-navy-900/20" />
          <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-105 group-hover:bg-white">
            <Play className="ml-0.5 h-5 w-5 text-navy-800" fill="currentColor" />
          </span>
          <span className="pointer-events-none absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            <Film className="h-3 w-3" /> Video
          </span>
        </button>
      </div>
    );
  }

  /* Sudah ditekan → pemutar sungguhan, SELALU dengan controls. */
  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <video
        ref={videoRef}
        src={aktif.url}
        poster={poster || undefined}
        /*
         * `controls` WAJIB. Tanpanya, video yang tampil tidak bisa dijeda
         * atau digeser — dan itulah yang membuat pembeli mengira pemutarnya
         * rusak meskipun gambarnya berjalan.
         */
        controls
        /* Dipasang hanya saat autoplay aktif atau setelah diklik. */
        autoPlay
        /*
         * MULAI DALAM KEADAAN SENYAP — selalu.
         *
         * Autoplay bersuara diblokir browser; kalau tidak senyap, video
         * membeku di frame pertama dan pembeli mengira pemutarnya rusak.
         * Suara dinyalakan lewat tombol (atau kontrol bawaan browser).
         */
        muted={!suaraAktif}
        loop
        playsInline
        preload="metadata"
        onError={() => setGagal(true)}
        className="h-full w-full object-cover"
        aria-label={aktif.title || 'Video produk'}
      />

      {/*
        Tombol suara terpisah tetap disediakan: `controls` bawaan browser sudah
        punya tombol mute, tetapi di layar sempit (galeri 260px) tombol itu
        kadang terpotong. Ini jaring pengamannya.
      */}
      <button
        type="button"
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          const jadi = !suaraAktif;
          v.muted = !jadi;
          setSuaraAktif(jadi);
          void v.play().catch(() => null);
        }}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"
        aria-label={suaraAktif ? 'Matikan suara' : 'Nyalakan suara'}
        title={suaraAktif ? 'Matikan suara' : 'Nyalakan suara'}
      >
        {suaraAktif ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
    </div>
  );
};

export const ProductVideoPlayer: React.FC<{ videos?: ProductVideo[] }> = ({ videos }) => {
  const list = useMemo(
    () => (Array.isArray(videos) ? videos.filter((v) => v && v.url) : []),
    [videos]
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  if (list.length === 0) return null;

  const active = list.find((v) => v.id === activeId) || list[0];
  const embedUrl = active.source === 'embed' ? toEmbedUrl(active) : null;
  const canPlay = active.source === 'embed' ? Boolean(embedUrl) : true;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Film className="w-3.5 h-3.5 text-forest-600" />
        <span className="text-[11.5px] font-extrabold text-slate-800">Video Produk</span>
        <span className="text-[10px] text-slate-400">— lihat produk dari dekat</span>
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative">
        {!canPlay ? (
          <div className="aspect-video flex items-center justify-center text-slate-400 text-[11px] px-4 text-center">
            Tautan video tidak dikenali. Hubungi admin.
          </div>
        ) : active.source === 'embed' ? (
          playing ? (
            <iframe
              src={embedUrl!}
              title={active.title || 'Video produk'}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="w-full aspect-video relative flex items-center justify-center group"
            >
              {active.poster ? (
                <img src={active.poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 bg-gradient-to-br from-navy-800 to-forest-700" />
              )}
              <span className="relative z-10 w-12 h-12 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                <Play className="w-5 h-5 text-navy-800 ml-0.5" fill="currentColor" />
              </span>
            </button>
          )
        ) : playing ? (
          <video
            src={active.url}
            poster={active.poster || undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="w-full aspect-video bg-black"
          >
            Browser Anda tidak mendukung pemutar video.
          </video>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="w-full aspect-video relative flex items-center justify-center group"
          >
            {active.poster ? (
              <img
                src={active.poster}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-navy-800 to-forest-700" />
            )}
            <span className="absolute inset-0 bg-navy-900/20" />
            <span className="relative z-10 w-12 h-12 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <Play className="w-5 h-5 text-navy-800 ml-0.5" fill="currentColor" />
            </span>
          </button>
        )}

        {playing && (
          <button
            type="button"
            onClick={() => setPlaying(false)}
            title="Tutup video"
            className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {active.title && (
        <p className="text-[10.5px] text-slate-500 leading-snug">{active.title}</p>
      )}

      {list.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {list.map((v, idx) => {
            const on = v.id === active.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setActiveId(v.id);
                  setPlaying(false);
                }}
                className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                  on
                    ? 'bg-forest-50 border-forest-600 text-forest-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-forest-400'
                }`}
              >
                Video {idx + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductVideoPlayer;
