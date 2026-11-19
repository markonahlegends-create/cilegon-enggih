import React, { useMemo, useState } from 'react';
import { Play, X, Film } from 'lucide-react';
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
 * Pemutar video produk.
 *
 * Keputusan penting:
 *  - `preload="none"` + poster: pembeli berkuota kecil tidak dipaksa
 *    mengunduh 5 MB video yang mungkin tidak ditonton. Poster kecil yang
 *    tampil lebih dulu.
 *  - Video file baru dimuat setelah tombol play ditekan.
 *  - Embed memakai iframe lazy, bukan <video>.
 *  - Tidak ada video → komponen tidak dirender sama sekali (tidak ada ruang kosong).
 */
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
