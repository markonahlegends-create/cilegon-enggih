import { trackAddToCart } from '../lib/tracker';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  ProductVariant,
  PRODUCTS as STATIC_PRODUCTS,
  VOUCHER_CODES as STATIC_VOUCHERS,
  CATEGORIES,
  WHATSAPP_NUMBER,
  STORE_EMAIL,
  STORE_INFO
} from '../data/products';
import { fetchStorefront } from '../lib/api';

export interface CartItem {
  key: string;
  product: Product;
  variant?: ProductVariant;
  qty: number;
  note?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  subtitle?: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface Voucher {
  code: string;
  title: string;
  minPurchase: number;
  discountAmount: number;
  description: string;
  active?: boolean;
}

export interface StoreSettings {
  storeName: string;
  legalName: string;
  tagline: string;
  address: string;
  addressShort: string;
  originDistrict: string;
  originCity: string;
  originPostal: string;
  email: string;
  whatsapp: string;
  whatsappDisplay: string;
  openHours: string;
  mapsUrl: string;
  instagram: string;
  developerTitle: string;
  developerUrl: string;
  banks: BankAccount[];
  qris: {
    enabled: boolean;
    dynamicEnabled: boolean;
    mode: string;
    merchantName: string;
    nmid: string;
    staticImageUrl: string;
    note: string;
  };
  payment: {
    uniqueCodeEnabled: boolean;
    bankTransferEnabled: boolean;
    qrisEnabled: boolean;
    codEnabled: boolean;
    paymentWindowHours: number;
    instructions: string;
  };
  invoice: { prefix: string; footerNote: string; signerName: string };
  announcement: string;
  updatedAt?: string;
}

export interface BankAccount {
  id: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  color?: string;
  isPlaceholder?: boolean;
}

const FALLBACK_SETTINGS: StoreSettings = {
  storeName: STORE_INFO.name,
  legalName: STORE_INFO.legalName,
  tagline: STORE_INFO.tagline,
  address: STORE_INFO.address,
  addressShort: STORE_INFO.addressShort,
  originDistrict: STORE_INFO.originDistrict,
  originCity: STORE_INFO.originCity,
  originPostal: STORE_INFO.originPostal,
  email: STORE_EMAIL,
  whatsapp: WHATSAPP_NUMBER,
  whatsappDisplay: '0819-2715-7103',
  openHours: STORE_INFO.openHours,
  mapsUrl: STORE_INFO.mapsUrl,
  instagram: 'https://instagram.com/cilegonenggih',
  developerTitle: 'Web Develop by Fadil Labs',
  developerUrl: 'https://fadil-labs.vercel.app/',
  banks: [
    {
      id: 'bca',
      bank: 'BCA',
      accountNumber: '1234567890',
      accountHolder: 'Cilegon Enggih (PLACEHOLDER)',
      color: '#0060AF',
      isPlaceholder: true
    }
  ],
  qris: {
    enabled: true,
    dynamicEnabled: true,
    mode: 'dynamic',
    merchantName: 'CILEGON ENGGIH',
    nmid: 'ID1020030405060',
    staticImageUrl: '/qris-placeholder.png',
    note: 'Scan QRIS dengan GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin Mandiri, atau BRImo.'
  },
  payment: {
    uniqueCodeEnabled: true,
    bankTransferEnabled: true,
    qrisEnabled: true,
    codEnabled: false,
    paymentWindowHours: 24,
    instructions:
      'Transfer sesuai NOMINAL AKHIR (termasuk 3 angka unik) agar pesanan terverifikasi tanpa biaya gateway.'
  },
  invoice: {
    prefix: 'CE',
    footerNote:
      'Terima kasih telah berbelanja merchandise resmi Cilegon Enggih. Pesanan Anda disiapkan dan dikirim dari gudang mitra pemasok kami, lengkap dengan nomor resi yang dapat dilacak.',
    signerName: 'Cilegon Enggih Official Store'
  },
  announcement: '',
  updatedAt: undefined
};

interface StoreContextValue {
  cart: CartItem[];
  wishlist: string[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  addToCart: (product: Product, qty?: number, variant?: ProductVariant, note?: string) => void;
  updateCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  cartCount: number;
  cartSubtotal: number;
  cartWeightGrams: number;
  toasts: ToastMessage[];
  pushToast: (title: string, subtitle?: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  selectedZoneId: string;
  setSelectedZoneId: (id: string) => void;

  // Data dinamis dari backend (Super Admin Dashboard)
  products: Product[];
  vouchers: Voucher[];
  settings: StoreSettings;
  categories: typeof CATEGORIES;
  storefrontLoading: boolean;
  storefrontSource: 'api' | 'fallback';
  refreshStorefront: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'cilegon_enggih_cart_v1';
const WISHLIST_STORAGE_KEY = 'cilegon_enggih_wishlist_v1';
const ZONE_STORAGE_KEY = 'cilegon_enggih_zone_v1';
const ORDER_CACHE_KEY = 'cilegon_enggih_my_orders_v1';

/* ------------------------------------------------------------------ */
/* Cache pesanan lokal — supaya pelacakan tetap jalan saat cold start  */
/* server serverless (data JSON di /tmp hilang setelah idle).          */
/* ------------------------------------------------------------------ */

export const cacheOrderLocally = (order: any) => {
  try {
    const raw = localStorage.getItem(ORDER_CACHE_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((o) => o.orderId !== order.orderId);
    filtered.unshift({
      orderId: order.orderId,
      invoiceNumber: order.invoiceNumber,
      resi: order.resi,
      courier: order.courier,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      destination: order.destination,
      addressDetail: order.addressDetail,
      items: order.items,
      timeline: order.timeline,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      uniqueCodeValue: order.uniqueCodeValue,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      voucherCode: order.voucherCode,
      voucherDiscount: order.voucherDiscount,
      notes: order.notes,
      cachedAt: new Date().toISOString()
    });
    localStorage.setItem(ORDER_CACHE_KEY, JSON.stringify(filtered.slice(0, 25)));
  } catch {
    // ignore
  }
};

export const findCachedOrder = (code: string) => {
  try {
    const raw = localStorage.getItem(ORDER_CACHE_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const q = String(code || '').trim().toUpperCase().replace(/\s|-/g, '');
    const digits = String(code || '').replace(/\D/g, '').replace(/^62/, '0');
    return (
      list.find((o) => {
        const oid = String(o.orderId || '').toUpperCase().replace(/-/g, '');
        const resi = String(o.resi || '').toUpperCase().replace(/\s/g, '');
        const phone = String(o.customerPhone || '').replace(/\D/g, '').replace(/^62/, '0');
        return oid === q || (resi && resi === q) || (digits.length >= 8 && phone === digits);
      }) || null
    );
  } catch {
    return null;
  }
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['prod-1', 'prod-4'];
    } catch {
      return [];
    }
  });

  const [selectedZoneId, setSelectedZoneIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(ZONE_STORAGE_KEY) || 'cilegon-pusat';
    } catch {
      return 'cilegon-pusat';
    }
  });

  const [products, setProducts] = useState<Product[]>(STATIC_PRODUCTS);
  const [vouchers, setVouchers] = useState<Voucher[]>(STATIC_VOUCHERS as Voucher[]);
  const [settings, setSettings] = useState<StoreSettings>(FALLBACK_SETTINGS);
  const [storefrontLoading, setStorefrontLoading] = useState(true);
  const [storefrontSource, setStorefrontSource] = useState<'api' | 'fallback'>('fallback');

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const refreshStorefront = useCallback(async () => {
    try {
      const data = await fetchStorefront();
      if (Array.isArray(data.products) && data.products.length > 0) {
        const active = data.products.filter((p: any) => p.active !== false);
        setProducts(active as Product[]);
      }
      if (Array.isArray(data.vouchers) && data.vouchers.length > 0) {
        setVouchers(data.vouchers as Voucher[]);
      }
      if (data.settings) {
        setSettings({
          ...FALLBACK_SETTINGS,
          ...data.settings,
          qris: { ...FALLBACK_SETTINGS.qris, ...(data.settings.qris || {}) },
          payment: { ...FALLBACK_SETTINGS.payment, ...(data.settings.payment || {}) },
          invoice: { ...FALLBACK_SETTINGS.invoice, ...(data.settings.invoice || {}) },
          banks:
            Array.isArray(data.settings.banks) && data.settings.banks.length
              ? data.settings.banks
              : FALLBACK_SETTINGS.banks
        } as StoreSettings);
      }
      setStorefrontSource('api');
    } catch {
      // Backend belum siap → tetap pakai katalog statis bawaan (offline-friendly).
      setStorefrontSource('fallback');
    } finally {
      setStorefrontLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStorefront();
  }, [refreshStorefront]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // ignore
    }
  }, [wishlist]);

  const setSelectedZoneId = (id: string) => {
    setSelectedZoneIdState(id);
    try {
      localStorage.setItem(ZONE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  // useCallback penting: dipakai sebagai dependency effect di halaman lain.
  const pushToast = useCallback(
    (title: string, subtitle?: string, type: ToastMessage['type'] = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, title, subtitle, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToCart = (
    product: Product,
    qty = 1,
    variant?: ProductVariant,
    note?: string
  ) => {
    const chosenVariant = variant || product.variants?.[0];
    const key = `${product.id}::${chosenVariant?.id || 'default'}`;
    // Analitik: minat terhadap produk (dasar konversi dilihat → keranjang).
    trackAddToCart({
      productId: product.id,
      productName: product.shortName || product.name,
      variantId: chosenVariant?.id,
      variantLabel: chosenVariant?.label
    });

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.key === key);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: updated[existingIndex].qty + qty,
          note: note || updated[existingIndex].note
        };
        return updated;
      }
      return [...prev, { key, product, variant: chosenVariant, qty, note }];
    });

    pushToast(
      'Berhasil masuk keranjang!',
      `${qty}x ${product.shortName}${chosenVariant ? ` (${chosenVariant.label})` : ''}`,
      'success'
    );
  };

  const updateCartQty = (key: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.key !== key));
      return;
    }
    setCart((prev) => prev.map((item) => (item.key === key ? { ...item, qty } : item)));
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => setCart([]);

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        pushToast('Dihapus dari Wishlist', 'Produk dihapus dari daftar favorit Anda', 'info');
        return prev.filter((id) => id !== productId);
      }
      pushToast('Disimpan ke Wishlist!', 'Produk ditambahkan ke koleksi favorit Anda', 'success');
      return [...prev, productId];
    });
  };

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const unitPrice = item.variant?.price ?? item.product.price;
        const effectivePrice =
          item.product.minWholesaleQty > 0 && item.qty >= item.product.minWholesaleQty
            ? Math.min(unitPrice, item.product.wholesalePrice || unitPrice)
            : unitPrice;
        return sum + effectivePrice * item.qty;
      }, 0),
    [cart]
  );

  const cartWeightGrams = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.weightGrams * item.qty, 0),
    [cart]
  );

  return (
    <StoreContext.Provider
      value={{
        cart,
        wishlist,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        toggleWishlist,
        cartCount,
        cartSubtotal,
        cartWeightGrams,
        toasts,
        pushToast,
        dismissToast,
        selectedZoneId,
        setSelectedZoneId,
        products,
        vouchers,
        settings,
        categories: CATEGORIES,
        storefrontLoading,
        storefrontSource,
        refreshStorefront
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextValue => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
};
