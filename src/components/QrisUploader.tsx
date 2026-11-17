import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImageUp, Loader2, Trash2 } from 'lucide-react';
import { adminUploadImage, ApiError } from '../lib/api';

/**
 * Unggah gambar QRIS ke Storage lewat /api/admin/upload (kind: 'qris').
 *
 * Keamanan yang dijaga di sisi klien hanyalah kenyamanan (kompres & validasi
 * cepat); validasi sebenarnya dilakukan server: magic bytes, batas ukuran,
 * penolakan SVG, dan nama file dibuat server.
 */
const compressImage = (file: File, maxSize = 1000, quality = 0.85): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Browser tidak mendukung pemrosesan gambar.'));
        // Latar putih: QRIS sering PNG transparan, jangan sampai hitam saat di-JPEG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG untuk ketajaman modul QR (JPEG bisa mengaburkan pola).
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Gambar tidak bisa dibaca. Coba file lain.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });

interface Props {
  value: string;
  onChange: (url: string) => void;
  pushToast: (title: string, message: string, kind?: 'success' | 'error' | 'info') => void;
}

export const QrisUploader: React.FC<Props> = ({ value, onChange, pushToast }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar JPG atau PNG.');
      return;
    }
    if (file.type === 'image/svg+xml') {
      setError('SVG tidak diizinkan. Gunakan JPG atau PNG.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Ukuran file melebihi 8 MB. Kompres dulu.');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      const res = await adminUploadImage({
        dataUrl,
        filename: `qris-${new Date().toISOString().slice(0, 10)}`,
        kind: 'qris'
      });
      onChange(res.url);
      pushToast(
        'Gambar QRIS terunggah',
        res.storage === 'supabase'
          ? 'Tersimpan permanen. Jangan lupa klik Simpan Pengaturan.'
          : 'Tersimpan lokal (sementara di Vercel). Klik Simpan Pengaturan.',
        'success'
      );
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload gagal.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const hasImage = Boolean(value);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="relative">
          {hasImage ? (
            <img
              src={value}
              alt="Gambar QRIS"
              className="w-28 h-28 rounded-xl border border-slate-200 object-contain bg-white"
            />
          ) : (
            <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
              <ImageUp className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-1">BELUM ADA</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-xl bg-white/80 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-forest-600 animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-2.5 py-1.5 rounded-lg bg-forest-600 hover:bg-forest-700 text-white text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-60"
            >
              <ImageUp className="w-3 h-3" />
              {uploading ? 'Mengunggah…' : hasImage ? 'Ganti Gambar' : 'Unggah Gambar QRIS'}
            </button>
            {hasImage && (
              <button
                type="button"
                onClick={() => onChange('')}
                disabled={uploading}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Hapus
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Unggah gambar QRIS resmi dari bank/merchant (JPG/PNG). Pastikan seluruh QR terlihat
            utuh dan tidak terpotong.
          </p>
          {hasImage && (
            <p className="text-[10px] text-slate-400 break-all font-mono">{value}</p>
          )}
          {error && (
            <p className="text-[10.5px] font-semibold text-red-600 inline-flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {hasImage && !error && (
            <p className="text-[10px] font-semibold text-forest-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Gambar siap — klik Simpan Pengaturan.
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
    </div>
  );
};

export default QrisUploader;
