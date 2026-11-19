import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  RefreshCw,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { formatRupiah } from '../data/products';
import { adminUploadImage, adminRequestVideoTicket, ApiError } from '../lib/api';

/* ------------------------------------------------------------------ */
/* Helper kecil                                                        */
/* ------------------------------------------------------------------ */

const CATEGORIES: [string, string][] = [
  ['apparel-tas', 'Apparel & Tas'],
  ['drinkware', 'Drinkware'],
  ['aksesoris-dekorasi', 'Aksesoris & Dekorasi'],
  ['perlengkapan-cetak', 'Perlengkapan & Cetak'],
  ['paket-bundling', 'Paket Bundling / Hampers']
];

const KAOS_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const newVariant = (idx: number) => ({
  id: `var-new-${Date.now().toString(36)}-${idx}`,
  label: '',
  price: 0,
  originalPrice: 0,
  stock: 0
});

const SectionCard: React.FC<{
  step: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ step, title, hint, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-soft">
    <header className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
      <span className="w-5 h-5 rounded-md bg-forest-600 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
        {step}
      </span>
      <h4 className="text-xs font-extrabold text-navy-800 uppercase tracking-wide">{title}</h4>
      {hint && <span className="text-[10.5px] text-slate-400 font-medium ml-auto">{hint}</span>}
    </header>
    <div className="p-4 space-y-2.5">{children}</div>
  </section>
);

const Labelled: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, children, className = '' }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="block text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400">{hint}</span>}
  </label>
);

/* Kompres gambar di browser supaya upload ringan (maks sisi 1200px, JPEG 82%). */
const compressImage = (file: File, maxSide = 1200, quality = 0.82): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Browser tidak mendukung kompresi gambar.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

/* ------------------------------------------------------------------ */
/* Editor utama                                                        */
/* ------------------------------------------------------------------ */

export interface ProductEditorProps {
  value: any;
  vendors?: { id: string; name: string; code?: string }[];
  onChange: (next: any) => void;
  onCancel: () => void;
  onSave: (product: any) => Promise<void> | void;
  busy: boolean;
}

export const ProductEditor: React.FC<ProductEditorProps> = ({
  value,
  onChange,
  onCancel,
  onSave,
  busy,
  vendors = []
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  /** Indeks varian yang sedang diunggah fotonya (null = tidak ada). */
  const [variantUploadIdx, setVariantUploadIdx] = useState<number | null>(null);
  const variantInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  /** Indeks nilai (grup,nilai) yang gambarnya sedang diunggah. */
  const optionImageInputRef = useRef<HTMLInputElement | null>(null);
  const [optionImageTarget, setOptionImageTarget] = useState<{ gi: number; vi: number } | null>(
    null
  );
  /** Indeks video yang sedang diunggah file-nya. */
  const [videoUploadIdx, setVideoUploadIdx] = useState<number>(0);

  const isNew: boolean = Boolean(value.__isNew);
  const dirty = Boolean(value.__dirty);

  const set = (key: string, val: any) =>
    onChange({ ...value, [key]: val, __dirty: true });

  const setMany = (patch: Record<string, any>) =>
    onChange({ ...value, ...patch, __dirty: true });

  /* ----------------------------- varian ----------------------------- */
  const variants: any[] = Array.isArray(value.variants) ? value.variants : [];

  const updateVariant = (idx: number, key: string, val: any) => {
    const next = variants.map((v, i) => (i === idx ? { ...v, [key]: val } : v));
    const patch: Record<string, any> = { variants: next };
    if (!value.stockManual) {
      patch.stock = next.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }
    setMany(patch);
  };

  const addVariant = () => setMany({ variants: [...variants, newVariant(variants.length)] });

  const removeVariant = (idx: number) => {
    const next = variants.filter((_, i) => i !== idx);
    const patch: Record<string, any> = { variants: next };
    if (!value.stockManual) {
      patch.stock = next.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }
    setMany(patch);
  };

  const moveVariant = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= variants.length) return;
    const next = [...variants];
    [next[idx], next[target]] = [next[target], next[idx]];
    setMany({ variants: next });
  };

  const duplicateVariant = (idx: number) => {
    const copy = {
      ...variants[idx],
      id: `var-${Date.now().toString(36)}-${idx}`,
      label: `${variants[idx].label} (Salinan)`
    };
    const next = [...variants];
    next.splice(idx + 1, 0, copy);
    setMany({ variants: next });
  };

  const fillKaosSizes = () => {
    const basePrice = Number(value.price) || 0;
    const baseOriginal = Number(value.originalPrice) || basePrice;
    const created = KAOS_SIZES.map((size, idx) => ({
      id: `var-${size.toLowerCase()}-${Date.now().toString(36)}-${idx}`,
      label: size,
      price: basePrice,
      originalPrice: baseOriginal,
      stock: 0
    }));
    setMany({ variants: created, hasSizeChart: true });
  };

  /**
   * Unggah foto khusus satu varian.
   *
   * Dipisah dari uploadFiles karena hasilnya masuk ke variants[idx].image /
   * .images, bukan ke galeri produk. Batas 3 foto per varian supaya ringan.
   */
  const uploadVariantFiles = async (files: FileList | null, idx: number) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);
    setVariantUploadIdx(idx);
    try {
      const current = Array.isArray(variants[idx]?.images) ? variants[idx].images : [];
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 3)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${file.name} lebih dari 8 MB. Kompres dulu.`);
        }
        const dataUrl = await compressImage(file);
        const res = await adminUploadImage({ dataUrl, filename: file.name.replace(/\.[^.]+$/, '') });
        uploaded.push(res.url);
      }
      if (uploaded.length === 0) return;

      const [first, ...rest] = uploaded;
      const merged = Array.from(new Set([...current, ...rest])).slice(0, 4);
      const next = variants.map((v, i) =>
        i === idx ? { ...v, image: v.image || first, images: merged } : v
      );
      setMany({ variants: next });
    } catch (err) {
      setUploadError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload gagal.');
    } finally {
      setUploading(false);
      setVariantUploadIdx(null);
      if (variantInputRef.current) variantInputRef.current.value = '';
    }
  };

  const removeVariantImage = (idx: number, url: string) => {
    const v = variants[idx] || {};
    const images = (Array.isArray(v.images) ? v.images : []).filter((x: string) => x !== url);
    // Kalau foto utama dihapus, promosikan foto tambahan pertama.
    const image = v.image === url ? images[0] || '' : v.image;
    const next = variants.map((item, i) =>
      i === idx ? { ...item, image, images: images.filter((x: string) => x !== image) } : item
    );
    setMany({ variants: next });
  };

  const clearVariantImages = (idx: number) => {
    const next = variants.map((item, i) =>
      i === idx ? { ...item, image: '', images: [] } : item
    );
    setMany({ variants: next });
  };

  /* --------------------- pilihan multi-dimensi ---------------------- */
  const optionGroups: any[] = Array.isArray(value.optionGroups) ? value.optionGroups : [];
  const combinations: any[] = Array.isArray(value.combinations) ? value.combinations : [];

  const patchGroups = (next: any[]) => setMany({ optionGroups: next.slice(0, 3) });

  const addGroup = () => {
    if (optionGroups.length >= 3) return;
    const id = `grup-${Date.now().toString(36)}`;
    patchGroups([
      ...optionGroups,
      {
        id,
        name: '',
        display: 'button',
        required: true,
        values: [{ id: `${id}-1`, label: '', priceDelta: 0 }]
      }
    ]);
  };

  const updateGroup = (gi: number, patch: any) =>
    patchGroups(optionGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const removeGroup = (gi: number) =>
    patchGroups(optionGroups.filter((_, i) => i !== gi));

  const addValue = (gi: number) => {
    const g = optionGroups[gi];
    if (!g || g.values.length >= 30) return;
    updateGroup(gi, {
      values: [
        ...g.values,
        { id: `${g.id}-v${Date.now().toString(36)}`, label: '', priceDelta: 0 }
      ]
    });
  };

  const updateValue = (gi: number, vi: number, patch: any) =>
    updateGroup(gi, {
      values: optionGroups[gi].values.map((v: any, i: number) =>
        i === vi ? { ...v, ...patch } : v
      )
    });

  const removeValue = (gi: number, vi: number) =>
    updateGroup(gi, { values: optionGroups[gi].values.filter((_: any, i: number) => i !== vi) });

  /**
   * Unggah gambar untuk SATU nilai pilihan (mis. warna Navy, atau model
   * Oversize). Gambar ini yang muncul di halaman produk saat pembeli memilih
   * nilai tersebut.
   *
   * Tanpa tombol ini, `ProductOptionValue.image` hanya bisa diisi lewat API —
   * jadi praktis tidak terpakai, dan pembeli selalu melihat foto yang sama
   * untuk semua warna/model.
   */
  const uploadOptionImage = async (files: FileList | null) => {
    const target = optionImageTarget;
    const file = files && files[0];
    if (!target || !file) return;
    setUploadError('');
    setUploading(true);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error(`${file.name} bukan berkas gambar.`);
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error(`${file.name} lebih dari 8 MB. Kompres dulu.`);
      }
      const dataUrl = await compressImage(file);
      const res = await adminUploadImage({
        dataUrl,
        filename: file.name.replace(/\.[^.]+$/, '')
      });
      updateValue(target.gi, target.vi, { image: res.url });
    } catch (err) {
      setUploadError(
        err instanceof ApiError || err instanceof Error ? err.message : 'Upload gambar gagal.'
      );
    } finally {
      setUploading(false);
      setOptionImageTarget(null);
      if (optionImageInputRef.current) optionImageInputRef.current.value = '';
    }
  };

  /** Harga akhir hasil rumus untuk satu kombinasi (dipakai di pratinjau). */
  const comboPrice = (ids: string[]) => {
    const base = Number(value.price) || 0;
    const delta = optionGroups.reduce((sum, g, gi) => {
      const v = g.values.find((x: any) => x.id === ids[gi]);
      return sum + (Number(v?.priceDelta) || 0);
    }, 0);
    const exact = combinations.find(
      (c: any) => Array.isArray(c.optionValueIds) && c.optionValueIds.join('|') === ids.join('|')
    );
    return Math.max(0, Number(exact?.price ?? base + delta));
  };

  /* ------------------------------ video ----------------------------- */
  const videos: any[] = Array.isArray(value.videos) ? value.videos : [];

  const patchVideos = (next: any[]) => setMany({ videos: next.slice(0, 3) });

  const addVideoLink = () => {
    if (videos.length >= 3) return;
    patchVideos([
      ...videos,
      { id: `vid-${Date.now().toString(36)}`, url: '', source: 'embed', poster: '', title: '', startAt: 0 }
    ]);
  };

  const updateVideo = (idx: number, key: string, val: any) =>
    patchVideos(videos.map((v, i) => (i === idx ? { ...v, [key]: val } : v)));

  const removeVideo = (idx: number) => patchVideos(videos.filter((_, i) => i !== idx));

  /** Unggah file video (maks 5 MB) — tanpa kompresi, jadi batasnya ketat. */
  const uploadVideoFile = async (files: FileList | null, idx: number) => {
    const file = files && files[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    setVariantUploadIdx(null);
    try {
      /*
       * Batas 5 MB dicek di sini SEBELUM apa pun dikirim.
       *
       * KENAPA: Vercel menolak body request > 4.5 MB (HTTP 413) dan batas itu
       * tidak bisa dinaikkan. Dulu video diubah jadi base64 lalu dikirim ke
       * server — 5 MB menjadi ±6,7 MB, jadi unggahan gagal dengan pesan samar
       * "Permintaan gagal (HTTP 413)". Sekarang file TIDAK melewati server:
       * browser meminta tiket, lalu mengunggah langsung ke Supabase Storage.
       */
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          `${file.name} berukuran ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maksimal 5 MB — pendekkan durasi atau kecilkan resolusi ke 720p.`
        );
      }

      /*
       * TEMBAK LANGSUNG SEBELUM JARINGAN.
       *
       * Bucket `product-video` hanya menerima `video/mp4` dan `video/webm`.
       * File dari iPhone bernama .mov (video/quicktime) akan DITOLAK storage
       * di tahap PUT — dulu pesannya menyalahkan bucket sehingga Anda
       * kebingungan. Lebih baik ditolak di sini dengan solusi yang jelas.
       */
      const mime = (file.type || '').toLowerCase();
      if (!['video/mp4', 'video/webm'].includes(mime)) {
        throw new Error(
          `${file.name} bertipe ${mime || 'tidak dikenal'}. Yang didukung hanya MP4 dan WebM. ` +
            'Kalau ini rekaman iPhone (.mov), ubah dulu ke MP4 — atau kirim ke WhatsApp lalu simpan ' +
            'kembali, iPhone otomatis menyimpannya sebagai MP4.'
        );
      }

      /*
       * Ekstensi ikut dikirim: server memakainya untuk menentukan nama file
       * (mp4/webm). Tanpa ekstensi, video WebM bisa tersimpan sebagai .mp4 dan
       * tidak bisa diputar browser.
       */
      const ticket = await adminRequestVideoTicket({
        filename: file.name,
        sizeBytes: file.size
      });

      /*
       * Unggahan langsung ke Supabase bisa gagal SEBELUM request terkirim:
       * kebijakan keamanan (CSP `connect-src`), campuran http/https, atau
       * jaringan terputus. fetch() melempar TypeError "Failed to fetch" yang
       * tidak menjelaskan apa pun, jadi kita terjemahkan di sini.
       */
      let putRes: Response;
      try {
        putRes = await fetch(ticket.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'video/mp4' },
          body: file
        });
      } catch {
        throw new Error(
          'Unggahan ke penyimpanan diblokir sebelum terkirim. Penyebab tersering: ' +
            'kebijakan keamanan browser (Content-Security-Policy) belum mengizinkan domain ' +
            'Supabase, atau koneksi internet terputus. Coba lagi; bila tetap gagal, ' +
            'laporkan pesan ini beserta alamat Supabase yang muncul di Console (F12).'
        );
      }

      if (!putRes.ok) {
        let detail = '';
        try {
          detail = (await putRes.text()).slice(0, 160);
        } catch {
          detail = '';
        }
        /*
         * Pesan spesifik per kode: sebelumnya semua kegagalan menyebut
         * "pastikan bucket Public", padahal bucket tidak pernah menjadi
         * masalahnya. Sekarang pembaca langsung tahu apa yang harus dilakukan.
         */
        let sebab = '';
        try {
          sebab = JSON.parse(detail)?.message || detail;
        } catch {
          sebab = detail;
        }
        const saran =
          putRes.status === 413
            ? 'File melebihi batas 5 MB — pendekkan durasi atau kecilkan ke 720p.'
            : putRes.status === 415
              ? 'Tipe file tidak didukung. Gunakan MP4 atau WebM.'
              : putRes.status === 403 || putRes.status === 401
                ? 'Tiket unggah kedaluwarsa. Coba unggah ulang.'
                : `Bucket "${ticket.bucket}" harus ada dan Public.`;
        throw new Error(
          `Unggah video ke penyimpanan gagal (${putRes.status}). ${saran}` +
            (sebab ? ` Detail: ${sebab}` : '')
        );
      }

      updateVideo(idx, 'url', ticket.publicUrl);
      updateVideo(idx, 'source', 'file');
    } catch (err) {
      setUploadError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload video gagal.');
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  /* --------------------------- spesifikasi --------------------------- */
  const specs: any[] = Array.isArray(value.specs) ? value.specs : [];

  /* ---------------------------- gambar ------------------------------ */
  const gallery: string[] = useMemo(() => {
    const list: string[] = Array.isArray(value.galleryImages) ? value.galleryImages : [];
    const merged = [value.image, ...list].filter(Boolean) as string[];
    return Array.from(new Set(merged)).slice(0, 9);
  }, [value.galleryImages, value.image]);

  const uploadFiles = async (files: FileList | null, replaceMain: boolean) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 9)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${file.name} lebih dari 8 MB. Kompres dulu.`);
        }
        const dataUrl = await compressImage(file);
        const res = await adminUploadImage({
          dataUrl,
          filename: file.name.replace(/\.[^.]+$/, '')
        });
        uploaded.push(res.url);
      }
      if (uploaded.length === 0) return;
      if (replaceMain) {
        const rest = gallery.filter((g) => g !== value.image).slice(0, 8);
        setMany({ image: uploaded[0], galleryImages: [uploaded[0], ...rest].slice(0, 9) });
      } else {
        const merged = Array.from(new Set([...gallery, ...uploaded])).slice(0, 9);
        setMany({
          image: value.image || merged[0],
          galleryImages: merged
        });
      }
    } catch (err) {
      setUploadError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload gagal.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const removeGalleryImage = (url: string) => {
    const next = gallery.filter((g) => g !== url);
    const patch: Record<string, any> = { galleryImages: next };
    if (value.image === url) patch.image = next[0] || '';
    setMany(patch);
  };

  const makeMainImage = (url: string) => set('image', url);

  const moveGalleryImage = (url: string, dir: -1 | 1) => {
    const idx = gallery.indexOf(url);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    [next[idx], next[target]] = [next[target], next[idx]];
    setMany({ image: next[0], galleryImages: next });
  };

  /* ---------------------------- validasi ---------------------------- */
  const errors = useMemo(() => {
    const list: string[] = [];
    if (!String(value.name || '').trim()) list.push('Nama produk wajib diisi.');
    if (!(Number(value.price) > 0)) list.push('Harga jual harus lebih besar dari 0.');
    if (Number(value.originalPrice) > 0 && Number(value.originalPrice) < Number(value.price)) {
      list.push('Harga sebelum diskon tidak boleh lebih kecil dari harga jual.');
    }
    if (Number(value.stock) < 0) list.push('Stok tidak boleh negatif.');
    if (!(Number(value.weightGrams) > 0)) list.push('Berat produk harus lebih dari 0 gram.');
    variants.forEach((v, idx) => {
      if (!String(v.label || '').trim()) list.push(`Varian baris ${idx + 1}: label wajib diisi.`);
      if (!(Number(v.price) > 0)) list.push(`Varian "${v.label || idx + 1}": harga harus > 0.`);
      if (Number(v.stock) < 0) list.push(`Varian "${v.label || idx + 1}": stok tidak boleh negatif.`);
    });
    const labels = variants.map((v) => String(v.label || '').trim().toLowerCase()).filter(Boolean);
    if (new Set(labels).size !== labels.length) list.push('Ada label varian yang sama (duplikat).');
    if (Number(value.minWholesaleQty) > 0 && Number(value.wholesalePrice) > Number(value.price)) {
      list.push('Harga grosir seharusnya lebih murah daripada harga jual.');
    }
    if (
      (Number(value.costPrice) || 0) + (Number(value.extraCost) || 0) > 0 &&
      Number(value.price) < (Number(value.costPrice) || 0) + (Number(value.extraCost) || 0)
    ) {
      list.push('Harga jual lebih rendah dari HPP — produk akan dijual rugi.');
    }
    return list;
  }, [value, variants]);

  const discountPercent = useMemo(() => {
    const price = Number(value.price) || 0;
    const original = Number(value.originalPrice) || 0;
    if (original > price && original > 0) {
      return Math.round(((original - price) / original) * 100);
    }
    return 0;
  }, [value.price, value.originalPrice]);

  const variantStockTotal = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  const totalHpp = (Number(value.costPrice) || 0) + (Number(value.extraCost) || 0);
  const marginAmount = (Number(value.price) || 0) - totalHpp;
  const marginPercent =
    Number(value.price) > 0 ? Math.round((marginAmount / Number(value.price)) * 1000) / 10 : 0;

  const handleSave = () => {
    if (errors.length) {
      setShowErrors(true);
      return;
    }
    onSave(value);
  };

  return (
    <div className="space-y-3">
      {/* Header + ringkasan */}
      <div className="bg-white rounded-2xl border-2 border-forest-300 p-4 shadow-soft sticky top-0 z-20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-navy-800 truncate">
              {isNew ? 'Tambah Produk Baru' : `Edit: ${value.shortName || value.name || '(tanpa nama)'}`}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {variants.length} varian • total stok {variantStockTotal} •{' '}
              {discountPercent > 0 ? `diskon ${discountPercent}%` : 'tanpa diskon'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {busy ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Batal
            </button>
          </div>
        </div>
        {dirty && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-amberbrand-800 bg-amberbrand-100/70 px-2 py-1 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" /> Ada perubahan belum disimpan
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        {/* Kolom kiri: form */}
        <div className="xl:col-span-2 space-y-3">
          {/* 1. Informasi dasar */}
          <SectionCard step="1" title="Informasi Dasar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Labelled label="Nama Produk">
                <input
                  value={value.name || ''}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Kalender Dinding Eksklusif Ukuran A3"
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Nama Pendek" hint="Dipakai di kartu produk & tabel admin">
                <input
                  value={value.shortName || ''}
                  onChange={(e) => set('shortName', e.target.value)}
                  placeholder="Kalender Dinding A3"
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Subjudul (Inggris)" hint="Opsional, tampil di halaman detail">
                <input
                  value={value.englishSubtitle || ''}
                  onChange={(e) => set('englishSubtitle', e.target.value)}
                  placeholder="Exclusive A3 Wall Calendar"
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Slug URL" hint="Kosongkan untuk dibuat otomatis dari nama">
                <input
                  value={value.slug || ''}
                  onChange={(e) => set('slug', e.target.value)}
                  placeholder="kalender-dinding-a3"
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Kategori">
                <select
                  value={value.categorySlug || 'aksesoris-dekorasi'}
                  onChange={(e) => {
                    const slug = e.target.value;
                    const label = CATEGORIES.find(([s]) => s === slug)?.[1] || 'Aksesoris & Dekorasi';
                    setMany({ categorySlug: slug, categoryLabel: label });
                  }}
                  className="input-admin"
                >
                  {CATEGORIES.map(([slug, label]) => (
                    <option key={slug} value={slug}>
                      {label}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="Status Tampil">
                <div className="flex items-center gap-2 h-[38px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={value.active !== false}
                    onChange={(e) => set('active', e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="truncate">Tampilkan di storefront</span>
                </div>
              </Labelled>
            </div>
            <Labelled label="Deskripsi">
              <textarea
                rows={4}
                value={value.description || ''}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Jelaskan bahan, ukuran, dan keunggulan produk…"
                className="input-admin"
              />
            </Labelled>
          </SectionCard>

          {/* 2. Harga & stok */}
          <SectionCard step="2" title="Harga, Stok & Grosir">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Labelled label="Harga Jual (Rp)">
                <input
                  type="number"
                  min={0}
                  value={value.price ?? 0}
                  onChange={(e) => set('price', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
              <Labelled
                label="Harga Sebelum Diskon (Rp)"
                hint={discountPercent > 0 ? `Diskon tampil: ${discountPercent}%` : 'Isi sama dengan harga jual bila tanpa diskon'}
              >
                <input
                  type="number"
                  min={0}
                  value={value.originalPrice ?? 0}
                  onChange={(e) => set('originalPrice', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Berat (gram)" hint="Dipakai untuk hitung ongkir">
                <input
                  type="number"
                  min={1}
                  value={value.weightGrams ?? 300}
                  onChange={(e) => set('weightGrams', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
              <Labelled
                label="Stok Total (pcs)"
                hint={
                  variants.length > 0 && value.stockManual
                    ? 'Mode manual — stok varian tidak dijumlahkan otomatis'
                    : variants.length > 0
                      ? 'Otomatis = jumlah stok semua varian'
                      : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={value.stock ?? 0}
                    disabled={variants.length > 0 && !value.stockManual}
                    onChange={(e) => set('stock', Number(e.target.value))}
                    className="input-admin disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  {variants.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={Boolean(value.stockManual)}
                        onChange={(e) => {
                          const manual = e.target.checked;
                          setMany({
                            stockManual: manual,
                            stock: manual ? Number(value.stock) || variantStockTotal : variantStockTotal
                          });
                        }}
                        className="rounded border-slate-300"
                      />
                      Manual
                    </label>
                  )}
                </div>
              </Labelled>
              <Labelled label="Min. Qty Harga Grosir" hint="0 = nonaktifkan harga grosir">
                <input
                  type="number"
                  min={0}
                  value={value.minWholesaleQty ?? 0}
                  onChange={(e) => set('minWholesaleQty', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Harga Grosir / pcs (Rp)">
                <input
                  type="number"
                  min={0}
                  value={value.wholesalePrice ?? 0}
                  onChange={(e) => set('wholesalePrice', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
            </div>
          </SectionCard>

          {/* 2b. HPP & vendor */}
          <SectionCard step="2b" title="HPP, Margin & Vendor" hint="dasar laporan laba rugi">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Labelled label="HPP / Modal per pcs (Rp)" hint="Harga beli dari vendor / biaya produksi">
                <input
                  type="number"
                  min={0}
                  value={value.costPrice ?? 0}
                  onChange={(e) => set('costPrice', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Biaya Tambahan per pcs (Rp)" hint="Packing, stiker, kartu ucapan">
                <input
                  type="number"
                  min={0}
                  value={value.extraCost ?? 0}
                  onChange={(e) => set('extraCost', Number(e.target.value))}
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="SKU / Kode Produk">
                <input
                  value={value.sku || ''}
                  onChange={(e) => set('sku', e.target.value)}
                  placeholder="CE-KAL-A3"
                  className="input-admin"
                />
              </Labelled>
              <Labelled label="Vendor / Supplier">
                <select
                  value={value.vendorId || ''}
                  onChange={(e) => {
                    const vendor = vendors.find((v) => v.id === e.target.value);
                    setMany({
                      vendorId: e.target.value || null,
                      vendorName: vendor ? vendor.name : ''
                    });
                  }}
                  className="input-admin"
                >
                  <option value="">— Belum ditentukan —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.code ? ` (${v.code})` : ''}
                    </option>
                  ))}
                </select>
              </Labelled>
            </div>

            {/* Ringkasan margin */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                ['HPP total', formatRupiah(totalHpp)],
                ['Harga jual', formatRupiah(Number(value.price) || 0)],
                ['Laba / pcs', formatRupiah(marginAmount)],
                ['Margin', `${marginPercent}%`]
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2"
                >
                  <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </div>
                  <div className="text-[12px] font-extrabold text-navy-800">{val}</div>
                </div>
              ))}
            </div>

            {Number(value.costPrice) + Number(value.extraCost) > 0 && marginPercent < 15 && (
              <div className="text-[11px] font-semibold text-amberbrand-800 bg-amberbrand-100 rounded-xl px-3 py-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Margin di bawah 15%. Pastikan harga jual masih menutup biaya iklan, ongkir
                  subsidi, dan biaya operasional.
                </span>
              </div>
            )}
          </SectionCard>

          {/* 3. Varian */}
          <SectionCard
            step="3"
            title="Varian / Ukuran"
            hint={variants.length ? `${variants.length} varian` : 'opsional'}
          >
            {variants.length === 0 && (
              <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                Belum ada varian. Produk akan dijual dengan harga & stok utama saja. Tambahkan varian
                bila ada beberapa ukuran/paket (mis. S/M/L/XL atau 1 pcs / paket 3 pcs).
              </p>
            )}

            {variants.length > 0 && (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[11px] min-w-[640px]">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left px-1 py-1 font-bold">Label Varian</th>
                      <th className="text-left px-1 py-1 font-bold w-24">Harga</th>
                      <th className="text-left px-1 py-1 font-bold w-24">Harga Coret</th>
                      <th className="text-left px-1 py-1 font-bold w-20">Stok</th>
                      <th className="text-left px-1 py-1 font-bold w-24">HPP</th>
                      <th className="text-left px-1 py-1 font-bold w-32">Foto Varian</th>
                      <th className="text-right px-1 py-1 font-bold w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => (
                      <tr key={v.id || idx} className="border-t border-slate-100">
                        <td className="px-1 py-1.5">
                          <input
                            value={v.label || ''}
                            onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                            placeholder={idx === 0 ? 'Satuan (1 Pcs)' : 'XL / Paket 3 Pcs'}
                            className="input-admin !text-[11px] !py-1.5"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={v.price ?? 0}
                            onChange={(e) => updateVariant(idx, 'price', Number(e.target.value))}
                            className="input-admin !text-[11px] !py-1.5"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={v.originalPrice ?? 0}
                            onChange={(e) => updateVariant(idx, 'originalPrice', Number(e.target.value))}
                            className="input-admin !text-[11px] !py-1.5"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={v.stock ?? 0}
                            onChange={(e) => updateVariant(idx, 'stock', Number(e.target.value))}
                            className="input-admin !text-[11px] !py-1.5"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            type="number"
                            min={0}
                            value={v.costPrice ?? 0}
                            onChange={(e) => updateVariant(idx, 'costPrice', Number(e.target.value))}
                            placeholder="0"
                            title="Harga pokok per varian (0 = ikut HPP produk)"
                            className="input-admin !text-[11px] !py-1.5"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          {(() => {
                            const shots: string[] = [
                              v.image,
                              ...(Array.isArray(v.images) ? v.images : [])
                            ].filter(Boolean);
                            return (
                              <div className="flex items-center gap-1">
                                {shots.slice(0, 2).map((url: string) => (
                                  <div key={url} className="relative shrink-0">
                                    <img
                                      src={url}
                                      alt=""
                                      className="w-8 h-8 rounded-md object-cover border border-slate-200"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeVariantImage(idx, url)}
                                      title="Hapus foto"
                                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] leading-none flex items-center justify-center"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                {shots.length > 2 && (
                                  <span className="text-[9px] text-slate-400 font-bold">
                                    +{shots.length - 2}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVariantUploadIdx(idx);
                                    variantInputRef.current?.click();
                                  }}
                                  disabled={uploading || shots.length >= 5}
                                  title="Unggah foto khusus varian ini"
                                  className="w-8 h-8 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-forest-500 hover:text-forest-600 disabled:opacity-40 flex items-center justify-center"
                                >
                                  {uploading && variantUploadIdx === idx ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ImagePlus className="w-3 h-3" />
                                  )}
                                </button>
                                {shots.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => clearVariantImages(idx)}
                                    title="Kosongkan — pakai galeri produk"
                                    className="text-[9px] text-slate-400 hover:text-red-600 font-bold underline"
                                  >
                                    reset
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-1 py-1.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveVariant(idx, -1)}
                              disabled={idx === 0}
                              title="Naikkan (varian pertama = default terpilih)"
                              className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveVariant(idx, 1)}
                              disabled={idx === variants.length - 1}
                              title="Turunkan"
                              className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateVariant(idx)}
                              title="Duplikat varian"
                              className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVariant(idx)}
                              title="Hapus varian"
                              className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={addVariant}
                className="px-3 py-1.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Varian
              </button>
              <button
                type="button"
                onClick={fillKaosSizes}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700"
              >
                Isi otomatis ukuran kaos S–XXL
              </button>
              {variants.length > 0 && (
                <span className="text-[10.5px] text-slate-500 ml-auto">
                  Total stok varian: <strong>{variantStockTotal}</strong>
                </span>
              )}
            </div>
          </SectionCard>

          {/* 4. Gambar */}
          <SectionCard step="4" title="Gambar Produk" hint={`${gallery.length}/9 gambar`}>
            {uploadError && (
              <div className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {gallery.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className={`relative group rounded-xl overflow-hidden border-2 aspect-square bg-slate-50 ${
                    value.image === url ? 'border-forest-600' : 'border-slate-200'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {value.image === url && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-forest-600 text-white text-[9px] font-extrabold">
                      UTAMA
                    </span>
                  )}
                  <div className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {value.image !== url && (
                      <button
                        type="button"
                        onClick={() => makeMainImage(url)}
                        title="Jadikan gambar utama"
                        className="p-1 rounded bg-white/95 text-[9px] font-bold text-slate-700 shadow"
                      >
                        <ImageIcon className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveGalleryImage(url, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded bg-white/95 text-slate-700 shadow disabled:opacity-30"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGalleryImage(url, 1)}
                      disabled={idx === gallery.length - 1}
                      className="p-1 rounded bg-white/95 text-slate-700 shadow disabled:opacity-30"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(url)}
                      className="p-1 rounded bg-white/95 text-red-600 shadow"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {gallery.length < 9 && (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-forest-500 hover:bg-forest-50/40 flex flex-col items-center justify-center gap-1 text-slate-400"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] font-bold">Tambah</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading || gallery.length >= 9}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Unggah Gambar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Ganti Gambar Utama
              </button>
              <span className="text-[10px] text-slate-400">
                JPG/PNG/WEBP • otomatis dikompres • maks 9 gambar
              </span>
            </div>

            <details className="pt-1">
              <summary className="text-[10.5px] font-bold text-slate-500 cursor-pointer">
                Atau tempel URL / path gambar manual
              </summary>
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Labelled label="Gambar Utama (path/URL)">
                  <input
                    value={value.image || ''}
                    onChange={(e) => set('image', e.target.value)}
                    placeholder="/products/kaos-distro.jpg"
                    className="input-admin"
                  />
                </Labelled>
                <Labelled label="Galeri (pisahkan dengan koma, maks 9)">
                  <input
                    value={(value.galleryImages || []).join(', ')}
                    onChange={(e) =>
                      set(
                        'galleryImages',
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .slice(0, 9)
                      )
                    }
                    placeholder="/products/a.png, /products/b.png"
                    className="input-admin"
                  />
                </Labelled>
              </div>
            </details>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files, true)}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files, false)}
            />
            {/* Foto khusus varian — target diambil dari variantUploadIdx. */}
            <input
              ref={variantInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (variantUploadIdx !== null) uploadVariantFiles(e.target.files, variantUploadIdx);
              }}
            />
          </SectionCard>

          {/* 5. Spesifikasi & isi paket */}
          {/* 4c. Pilihan multi-dimensi (Model / Ukuran / Warna) */}
          <SectionCard
            step="4c"
            title="Pilihan Multi-Dimensi"
            hint={`${optionGroups.length}/3 dimensi`}
          >
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                ref={optionImageInputRef}
                className="hidden"
                onChange={(e) => uploadOptionImage(e.target.files)}
              />
              {/*
                Penjelasan ini menjawab pertanyaan yang paling sering muncul:
                "apakah menambah dimensi berarti menambah harga?"
                Jawabannya tidak — biaya hanya berubah bila kolom Selisih diisi.
              */}
              <div className="text-[10.5px] text-slate-600 bg-forest-50/60 border border-forest-100 rounded-lg px-2.5 py-2 leading-snug space-y-1">
                <p>
                  <strong>Dimensi tidak menambah harga.</strong> Biaya hanya berubah bila kolom{' '}
                  <strong>Selisih</strong> diisi. Biarkan 0 untuk pilihan yang harganya sama
                  (mis. semua warna).
                </p>
                <p>
                  <strong>Foto per pilihan:</strong> klik <em>Tambah foto</em> di baris nilai
                  untuk mengunggah gambar khusus nilai itu — mis. foto model Oversize beda dengan
                  Reguler, atau Navy beda dengan Hitam. Gratis, tidak memengaruhi harga.
                </p>
                <p>
                  Kosongkan seluruh bagian ini bila produk cukup memakai <em>varian biasa</em>{' '}
                  (satu dimensi saja).
                </p>
              </div>

              {optionGroups.map((group, gi) => (
                <div key={group.id} className="rounded-xl border border-slate-200 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={group.name}
                      onChange={(e) => updateGroup(gi, { name: e.target.value })}
                      placeholder="Nama dimensi (mis. Ukuran)"
                      className="input-admin !text-[11px] !py-1 flex-1 font-bold"
                    />
                    <select
                      value={group.display || 'button'}
                      onChange={(e) => updateGroup(gi, { display: e.target.value })}
                      className="input-admin !text-[10.5px] !py-1 w-24"
                      title="Tampilan pilihan"
                    >
                      <option value="button">Tombol</option>
                      <option value="swatch">Warna</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <label className="text-[9.5px] text-slate-600 inline-flex items-center gap-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={group.required !== false}
                        onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                        className="w-3 h-3 accent-forest-600"
                      />
                      wajib
                    </label>
                    <button
                      type="button"
                      onClick={() => removeGroup(gi)}
                      title="Hapus dimensi"
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                      <span className="flex-1">Nilai</span>
                      <span className="w-20 text-right">Selisih (Rp)</span>
                      <span className="w-14 text-center">Swatch</span>
                      <span className="w-6" />
                    </div>
                    {group.values.map((v: any, vi: number) => (
                      <div key={v.id} className="rounded-lg bg-slate-50/70 p-1 space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          value={v.label}
                          onChange={(e) => updateValue(gi, vi, { label: e.target.value })}
                          placeholder="mis. XL"
                          className="input-admin !text-[10.5px] !py-1 flex-1"
                        />
                        <input
                          type="number"
                          value={v.priceDelta ?? 0}
                          onChange={(e) =>
                            updateValue(gi, vi, { priceDelta: Number(e.target.value) || 0 })
                          }
                          placeholder="0"
                          title="Selisih harga. Boleh minus, mis. -4000"
                          className="input-admin !text-[10.5px] !py-1 w-20 text-right"
                        />
                        <input
                          type="color"
                          value={v.colorHex || '#1B365D'}
                          onChange={(e) => updateValue(gi, vi, { colorHex: e.target.value })}
                          title="Warna swatch (opsional)"
                          className="w-9 h-6 rounded border border-slate-200 bg-white cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => removeValue(gi, vi)}
                          className="p-1 rounded bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600"
                          title="Hapus nilai"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Foto khusus nilai ini — tampil di halaman produk saat dipilih. */}
                      <div className="flex items-center gap-1.5 pl-0.5">
                        {v.image ? (
                          <img
                            src={v.image}
                            alt={`Foto ${v.label || 'nilai'}`}
                            className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-md border border-dashed border-slate-300 text-slate-400 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-3 h-3" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setOptionImageTarget({ gi, vi });
                            optionImageInputRef.current?.click();
                          }}
                          className="text-[9.5px] font-bold text-forest-700 hover:text-forest-800"
                        >
                          {v.image ? 'Ganti foto' : 'Tambah foto'}
                        </button>
                        {v.image && (
                          <button
                            type="button"
                            onClick={() => updateValue(gi, vi, { image: '' })}
                            className="text-[9.5px] font-bold text-slate-400 hover:text-red-600"
                          >
                            hapus
                          </button>
                        )}
                        <span className="text-[9px] text-slate-400 ml-auto">
                          opsional · tanpa biaya
                        </span>
                      </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addValue(gi)}
                      className="text-[10px] font-bold text-forest-700 hover:text-forest-800 inline-flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" /> Tambah nilai
                    </button>
                  </div>
                </div>
              ))}

              {optionGroups.length < 3 && (
                <button
                  type="button"
                  onClick={addGroup}
                  className="px-2.5 py-1.5 rounded-lg bg-navy-50 hover:bg-navy-100 text-[10.5px] font-bold text-navy-800 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah dimensi
                </button>
              )}

              {/*
                Pratinjau harga: admin TIDAK perlu mengisi harga tiap kombinasi.
                Rumus harga produk + jumlah selisih ditampilkan di sini, jadi
                langsung terlihat bila ada angka yang salah.
              */}
              {optionGroups.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-2 py-1.5 bg-slate-50 text-[9.5px] font-extrabold uppercase text-slate-500">
                    Pratinjau harga (otomatis dari selisih di atas)
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      // Susun kombinasi contoh: nilai pertama tiap grup + variasi.
                      const first = optionGroups.map((g) => g.values[0]?.id).filter(Boolean);
                      const sample: string[][] = [];
                      if (first.length === optionGroups.length) sample.push(first);
                      optionGroups.forEach((g, gi) => {
                        g.values.slice(1, 4).forEach((v: any) => {
                          const ids = [...first];
                          ids[gi] = v.id;
                          sample.push(ids);
                        });
                      });
                      return sample.slice(0, 12).map((ids, idx) => {
                        const labels = ids.map(
                          (id, gi) =>
                            optionGroups[gi].values.find((v: any) => v.id === id)?.label || '?'
                        );
                        return (
                          <div key={idx} className="flex justify-between px-2 py-1 text-[10.5px]">
                            <span className="text-slate-600">{labels.join(' · ')}</span>
                            <span className="font-bold text-navy-800">
                              {formatRupiah(comboPrice(ids))}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* 4b. Video produk */}
          <SectionCard
            step="4b"
            title="Video Produk"
            hint={`${videos.length}/3 video · maks 5 MB per file`}
          >
            <div className="space-y-2">
              {videos.length === 0 && (
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                  Belum ada video. Video singkat (20–30 detik) membuat calon pembeli jauh lebih
                  yakin — cukup rekam produk berputar dengan ponsel.
                </p>
              )}

              {videos.map((v, idx) => (
                <div key={v.id || idx} className="rounded-xl border border-slate-200 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={v.source || 'embed'}
                      onChange={(e) => updateVideo(idx, 'source', e.target.value)}
                      className="input-admin !text-[11px] !py-1.5 w-28"
                    >
                      <option value="embed">Tautan</option>
                      <option value="file">File</option>
                    </select>
                    <input
                      value={v.url || ''}
                      onChange={(e) => updateVideo(idx, 'url', e.target.value)}
                      placeholder={
                        v.source === 'embed'
                          ? 'https://youtube.com/watch?v=...'
                          : 'Unggah file di bawah'
                      }
                      className="input-admin !text-[11px] !py-1.5 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeVideo(idx)}
                      title="Hapus video"
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {v.source === 'file' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoUploadIdx(idx);
                          videoInputRef.current?.click();
                        }}
                        disabled={uploading}
                        className="px-2 py-1 rounded-lg bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-white text-[10px] font-bold inline-flex items-center gap-1"
                      >
                        {uploading && videoUploadIdx === idx ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        {v.url ? 'Ganti file' : 'Unggah MP4/WebM'}
                      </button>
                      <input
                        value={v.poster || ''}
                        onChange={(e) => updateVideo(idx, 'poster', e.target.value)}
                        placeholder="URL poster (wajib agar tidak kotak hitam)"
                        className="input-admin !text-[10.5px] !py-1 flex-1"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <input
                      value={v.title || ''}
                      onChange={(e) => updateVideo(idx, 'title', e.target.value)}
                      placeholder="Judul video (opsional)"
                      className="input-admin !text-[10.5px] !py-1 flex-1"
                    />
                    {v.source === 'embed' && (
                      <input
                        type="number"
                        min={0}
                        value={v.startAt ?? 0}
                        onChange={(e) => updateVideo(idx, 'startAt', Number(e.target.value))}
                        placeholder="Mulai (detik)"
                        title="Detik mulai pemutaran"
                        className="input-admin !text-[10.5px] !py-1 w-24"
                      />
                    )}
                  </div>

                  {v.url && (
                    <div className="text-[9.5px] text-slate-400 break-all">
                      {v.source === 'file' && !v.poster && (
                        <span className="text-amber-600 font-bold">Poster belum diisi. </span>
                      )}
                      {v.url}
                    </div>
                  )}
                </div>
              ))}

              {videos.length < 3 && (
                <button
                  type="button"
                  onClick={addVideoLink}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10.5px] font-bold text-slate-700 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah slot video
                </button>
              )}

              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm"
                className="hidden"
                onChange={(e) => uploadVideoFile(e.target.files, videoUploadIdx)}
              />
            </div>
          </SectionCard>

          <SectionCard step="5" title="Spesifikasi & Isi Paket">
            <div className="space-y-1.5">
              {specs.map((sp, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    value={sp.label || ''}
                    onChange={(e) => {
                      const next = specs.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s));
                      set('specs', next);
                    }}
                    placeholder="Bahan"
                    className="input-admin !text-[11px] !py-1.5 w-32 sm:w-40 shrink-0"
                  />
                  <input
                    value={sp.value || ''}
                    onChange={(e) => {
                      const next = specs.map((s, i) => (i === idx ? { ...s, value: e.target.value } : s));
                      set('specs', next);
                    }}
                    placeholder="Art Carton 230 gsm"
                    className="input-admin !text-[11px] !py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => set('specs', specs.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => set('specs', [...specs, { label: '', value: '' }])}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Spesifikasi
            </button>

            {value.isBundle && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-navy-800">
                  <Layers className="w-3.5 h-3.5 text-forest-600" /> Isi Paket Bundling
                </div>
                {(value.bundleItems || []).map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      value={item}
                      onChange={(e) => {
                        const next = [...(value.bundleItems || [])];
                        next[idx] = e.target.value;
                        set('bundleItems', next);
                      }}
                      placeholder="Gantungan kunci 3D × 1"
                      className="input-admin !text-[11px] !py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'bundleItems',
                          (value.bundleItems || []).filter((_: string, i: number) => i !== idx)
                        )
                      }
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('bundleItems', [...(value.bundleItems || []), ''])}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Isi Paket
                </button>
              </div>
            )}
          </SectionCard>

          {/* 6. Label & status */}
          <SectionCard step="6" title="Label & Status">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['isBestSeller', 'Best Seller', 'Tampilkan label TERLARIS di kartu produk'],
                ['isFlashDeal', 'Flash Deal', 'Masuk daftar promo flash deal'],
                ['isBundle', 'Paket Bundling', 'Aktifkan editor isi paket'],
                ['hasSizeChart', 'Tampilkan Size Chart', 'Tombol panduan ukuran kaos'],
                ['isPreOrder', 'Pre-Order 7–15 Hari', 'Pembeli diberi tahu estimasi produksi'],
                ['active', 'Tampil di Storefront', 'Matikan untuk menyembunyikan produk']
              ].map(([key, label, hint]) => (
                <label
                  key={key}
                  className="flex items-start gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <input
                    type="checkbox"
                    checked={key === 'active' ? value.active !== false : Boolean(value[key])}
                    onChange={(e) => set(key, e.target.checked)}
                    className="rounded border-slate-300 mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-slate-700">{label}</span>
                    <span className="block text-[10px] text-slate-400">{hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {value.isPreOrder && (
              <Labelled label="Keterangan Pre-Order" hint="Tampil di halaman produk, checkout, & invoice">
                <input
                  value={value.preOrderNote || ''}
                  onChange={(e) => set('preOrderNote', e.target.value)}
                  placeholder="Pre Order 7–15 hari kerja"
                  className="input-admin"
                />
              </Labelled>
            )}

            <div className="pt-1">
              <Labelled label="Badge tambahan" hint="Tampil di atas foto produk pada halaman detail">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(value.badges || []).map((badge: string, idx: number) => (
                    <span
                      key={`${badge}-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-navy-800 text-white text-[10px] font-bold"
                    >
                      {badge}
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            'badges',
                            (value.badges || []).filter((_: string, i: number) => i !== idx)
                          )
                        }
                        className="hover:text-red-300"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    placeholder="Tulis badge lalu Enter"
                    className="input-admin !text-[11px] !py-1 !w-40"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const input = e.currentTarget;
                      const text = input.value.trim();
                      if (!text) return;
                      set('badges', [...(value.badges || []), text]);
                      input.value = '';
                    }}
                  />
                </div>
              </Labelled>
            </div>
          </SectionCard>

          {/* Error list */}
          {showErrors && errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-1">
              <div className="text-[11px] font-extrabold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Perbaiki dulu sebelum menyimpan:
              </div>
              <ul className="list-disc list-inside text-[11px] text-red-700 space-y-0.5">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Kolom kanan: pratinjau */}
        <div className="space-y-3 xl:sticky xl:top-24">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-soft">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">
              Pratinjau Kartu Produk
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <div className="relative aspect-[4/4.2] bg-slate-100">
                {value.image ? (
                  <img src={value.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {value.isBundle && (
                    <span className="px-2 py-0.5 rounded bg-amberbrand-400 text-navy-950 text-[9px] font-extrabold">
                      PAKET BUNDLING
                    </span>
                  )}
                  {value.isBestSeller && !value.isBundle && (
                    <span className="px-2 py-0.5 rounded bg-navy-800/95 text-white text-[9px] font-bold">
                      ★ TERLARIS
                    </span>
                  )}
                  {value.isPreOrder && (
                    <span className="px-2 py-0.5 rounded bg-forest-600 text-white text-[9px] font-extrabold">
                      PRE-ORDER
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2.5 space-y-1">
                <div className="text-[10px] font-semibold text-forest-700">
                  {value.categoryLabel || 'Kategori'}
                </div>
                <div className="text-[11.5px] font-bold text-slate-800 line-clamp-2 leading-snug">
                  {value.name || 'Nama produk'}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-extrabold text-navy-800">
                    {formatRupiah(Number(value.price) || 0)}
                  </span>
                  {discountPercent > 0 && (
                    <span className="text-[10px] text-slate-400 line-through">
                      {formatRupiah(Number(value.originalPrice) || 0)}
                    </span>
                  )}
                </div>
                {discountPercent > 0 && (
                  <div className="text-[10px] font-bold text-forest-700">
                    Hemat {discountPercent}%
                  </div>
                )}
                {value.isPreOrder && (
                  <div className="text-[10px] text-forest-700 font-semibold">
                    ⏳ {value.preOrderNote || 'Pre Order 7–15 hari kerja'}
                  </div>
                )}
                {Number(value.minWholesaleQty) > 0 && (
                  <div className="text-[10px] text-slate-500">
                    Grosir ≥{value.minWholesaleQty}: {formatRupiah(Number(value.wholesalePrice) || 0)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-soft space-y-1.5">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-slate-500">
              Ringkasan
            </div>
            {[
              ['Varian', variants.length ? `${variants.length} varian` : 'tanpa varian'],
              ['Stok', `${value.stock ?? 0} pcs`],
              ['Berat', `${value.weightGrams ?? 0} gram`],
              ['HPP', totalHpp > 0 ? formatRupiah(totalHpp) : 'belum diisi'],
              ['Margin', totalHpp > 0 ? `${marginPercent}%` : '—'],
              ['Gambar', `${gallery.length} / 9`],
              ['Spesifikasi', `${specs.length} baris`],
              ['Badge', `${(value.badges || []).length} badge`]
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{label}</span>
                <span className="font-bold text-slate-700">{val}</span>
              </div>
            ))}
            <div
              className={`mt-1 rounded-lg px-2 py-1.5 text-[10.5px] font-bold ${
                errors.length === 0
                  ? 'bg-forest-50 text-forest-800'
                  : 'bg-amberbrand-100 text-amberbrand-800'
              }`}
            >
              {errors.length === 0 ? '✓ Semua data valid' : `${errors.length} hal perlu diperbaiki`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductEditor;
