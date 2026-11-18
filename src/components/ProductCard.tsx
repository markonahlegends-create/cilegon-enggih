import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart, Layers, ShieldCheck } from 'lucide-react';
import { Product, formatRupiah } from '../data/products';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

/**
 * Kartu produk bergaya marketplace: ramping, informasi padat, tanpa hiasan.
 *
 * PERUBAHAN DARI VERSI SEBELUMNYA
 * ------------------------------------------------------------------
 * Versi lama memakai `rounded-2xl` + `shadow-card`, gambar rasio 4:4.2,
 * label kategori, baris "Official Store • Kota Cilegon" setinggi 24px,
 * beberapa badge bertumpuk di atas gambar, dan tombol "+ Keranjang"
 * berlabel teks. Hasilnya kartu setinggi 341px sehingga di layar 360px
 * hanya SATU produk terlihat.
 *
 * Versi ini: sudut `rounded-lg`, hanya garis rambut (tanpa bayangan),
 * satu badge diskon, harga tebal sebagai fokus, rating + terjual satu
 * baris kecil, dan tombol keranjang berbentuk ikon. Tinggi turun ±35%
 * sehingga grid 2 kolom menampilkan 6 produk per layar.
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const isWishlisted = wishlist.includes(product.id);
  const discount =
    product.discountPercent > 0
      ? product.discountPercent
      : product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;

  const soldLabel =
    product.soldCount >= 1000
      ? `${(product.soldCount / 1000).toFixed(1).replace('.0', '')}rb+`
      : `${product.soldCount}`;

  return (
    <div className="group bg-white rounded-lg border border-slate-200/80 hover:border-forest-400 transition-colors overflow-hidden flex flex-col">
      {/* Gambar — rasio persegi agar baris kedua cepat terlihat */}
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
        <Link to={`/produk/${product.slug}`} className="block w-full h-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Satu badge saja — diskon. Badge lain jadi teks di bawah. */}
        {discount > 0 && (
          <span className="absolute top-0 left-0 px-1.5 py-0.5 bg-forest-600 text-white text-[10px] font-extrabold rounded-br-md">
            {discount}%
          </span>
        )}

        {product.isBundle && (
          <span className="absolute top-0 right-0 px-1.5 py-0.5 bg-amberbrand-400 text-navy-950 text-[10px] font-extrabold rounded-bl-md inline-flex items-center gap-0.5">
            <Layers className="w-2.5 h-2.5" /> PAKET
          </span>
        )}

        {/* Tombol wishlist kecil di pojok kanan bawah gambar */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? 'Hapus dari wishlist' : 'Simpan ke wishlist'}
          className={`absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isWishlisted
              ? 'bg-rose-500 text-white'
              : 'bg-white/85 text-slate-500 active:text-rose-500'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Isi kartu — padat, urutan: judul → harga → rating */}
      <div className="p-1.5 flex-1 flex flex-col">
        <Link
          to={`/produk/${product.slug}`}
          className="text-[12px] leading-snug text-slate-700 line-clamp-2 min-h-[30px] hover:text-navy-800"
        >
          {product.name}
        </Link>

        <div className="mt-1">
          <div className="text-[14px] font-extrabold text-forest-700 leading-tight">
            {formatRupiah(product.price)}
          </div>
          {product.originalPrice > product.price && (
            <div className="text-[10.5px] text-slate-400 line-through leading-tight">
              {formatRupiah(product.originalPrice)}
            </div>
          )}
        </div>

        {/* Grosir — satu baris kecil, hanya bila relevan */}
        {product.minWholesaleQty > 1 && (
          <div className="mt-0.5 text-[10px] font-semibold text-forest-700 truncate">
            Grosir ≥{product.minWholesaleQty}: {formatRupiah(product.wholesalePrice)}
          </div>
        )}

        {product.isPreOrder && (
          <div className="mt-0.5 text-[10px] font-semibold text-amberbrand-700 truncate">
            ⏳ Pre-order
          </div>
        )}

        {/* Rating + terjual + tombol keranjang dalam satu baris */}
        <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 text-[10.5px] text-slate-500 min-w-0">
            <Star className="w-3 h-3 fill-amberbrand-400 text-amberbrand-400 shrink-0" />
            <span className="font-bold text-slate-700">{product.rating.toFixed(1)}</span>
            <ShieldCheck className="w-2.5 h-2.5 text-forest-500 shrink-0" aria-label="Official Store" />
            <span className="text-slate-300">·</span>
            <span className="truncate">{soldLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => addToCart(product, 1, product.variants?.[0])}
            aria-label={`Tambah ${product.shortName || product.name} ke keranjang`}
            className="shrink-0 w-7 h-7 rounded-lg bg-forest-600 active:bg-forest-700 text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
};
