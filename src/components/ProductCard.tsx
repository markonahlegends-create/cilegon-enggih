import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Heart, MapPin, ShieldCheck, Layers } from 'lucide-react';
import { Product, formatRupiah } from '../data/products';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const isWishlisted = wishlist.includes(product.id);

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 hover:border-forest-500/50 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col overflow-hidden relative">
      {/* Image Container */}
      <div className="relative aspect-[4/4.2] bg-slate-100 overflow-hidden">
        <Link to={`/produk/${product.slug}`} className="block w-full h-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
        </Link>

        {/* Top Left Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none">
          {product.isBundle ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amberbrand-400 text-navy-950 text-[11px] font-extrabold shadow-sm">
              <Layers className="w-3 h-3" /> PAKET BUNDLING
            </span>
          ) : product.isBestSeller ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-navy-800/95 text-white text-[11px] font-bold shadow-sm backdrop-blur-sm">
              ★ TERLARIS
            </span>
          ) : null}

          {product.discountPercent > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-forest-600 text-white text-[10.5px] font-bold w-fit">
              Hemat {product.discountPercent}%
            </span>
          )}
        </div>

        {/* Wishlist Heart */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          aria-label="Simpan ke Wishlist"
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-sm ${
            isWishlisted
              ? 'bg-rose-500 text-white'
              : 'bg-white/90 text-slate-600 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Wholesale subtle pill at bottom of image */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-navy-800 text-[10.5px] font-semibold border border-slate-200/70">
            Grosir ≥{product.minWholesaleQty}: {formatRupiah(product.wholesalePrice)}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-forest-700 mb-1">
            <span>{product.categoryLabel}</span>
          </div>

          <Link
            to={`/produk/${product.slug}`}
            className="text-sm font-bold text-slate-800 group-hover:text-navy-800 line-clamp-2 leading-snug mb-2 transition-colors"
          >
            {product.name}
          </Link>

          {/* Price Block */}
          <div className="mb-1.5">
            <div className="text-base sm:text-lg font-extrabold text-navy-800 leading-tight">
              {formatRupiah(product.price)}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-400 line-through">
                {formatRupiah(product.originalPrice)}
              </span>
              <span className="text-[11px] font-semibold text-forest-700 bg-forest-50 px-1.5 py-0.5 rounded">
                -{product.discountPercent}%
              </span>
            </div>
          </div>

          {/* Official Store + Location (Tokopedia trust style) */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-forest-600 shrink-0" />
            <span className="font-semibold text-slate-600 truncate">Official Store</span>
            <span>•</span>
            <span className="inline-flex items-center gap-0.5 truncate">
              <MapPin className="w-3 h-3 text-slate-400" /> Kota Cilegon
            </span>
          </div>
        </div>

        {/* Rating + Sold + Quick Add */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Star className="w-3.5 h-3.5 fill-amberbrand-400 text-amberbrand-400" />
            <span className="font-bold text-slate-800">{product.rating.toFixed(1)}</span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-500">
              {product.soldCount >= 1000
                ? `${(product.soldCount / 1000).toFixed(1)}rb+`
                : `${product.soldCount}`}{' '}
              terjual
            </span>
          </div>

          <button
            type="button"
            onClick={() => addToCart(product, 1, product.variants?.[0])}
            title="Tambah ke Keranjang"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>+ Keranjang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
