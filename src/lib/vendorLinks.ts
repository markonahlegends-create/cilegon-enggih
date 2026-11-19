/**
 * Tautan toko vendor (Shopee / TikTok Shop / Tokopedia / WhatsApp).
 *
 * KENAPA PERLU HELPER, BUKAN LANGSUNG `href={vendor.shopUrl}`:
 *  1. **Keamanan.** `shopUrl` diisi admin lewat input teks bebas. Tanpa
 *     validasi, `javascript:alert(1)` bisa disimpan dan menjadi tautan aktif
 *     di dashboard — praktis setara XSS yang bisa mencuri sesi admin.
 *     Di sini hanya `http:` dan `https:` yang diterima.
 *  2. **Data lama tidak lengkap.** Banyak vendor hanya diisi nomor HP, tanpa
 *     tautan toko. Supaya admin tetap bisa menghubungi vendor dalam satu
 *     klik, nomor HP diubah menjadi tautan WhatsApp.
 *  3. **Nama platform tidak konsisten.** Admin menulis "Shopee", "shopee",
 *     "Tik Tok", "TikTok Shop". Label yang ditampilkan perlu seragam.
 *
 * Semua tautan dibuka di tab baru dengan rel yang aman.
 */

export type VendorLink = {
  href: string;
  label: string;
  /** 'shop' = toko daring, 'wa' = WhatsApp, 'phone' = telepon */
  kind: 'shop' | 'wa' | 'phone';
};

/** Bersihkan nomor HP Indonesia menjadi format 62… (dipakai wa.me / tel:). */
export const normalizePhone = (raw: string): string => {
  const digits = String(raw || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

/** Label platform yang seragam dari tulisan bebas admin. */
const platformLabel = (platform: string): string => {
  const p = String(platform || '').trim().toLowerCase();
  if (!p) return 'Toko Vendor';
  if (p.includes('shopee')) return 'Shopee';
  if (p.includes('tiktok') || p.includes('tik tok') || p.includes('tik-tok')) return 'TikTok Shop';
  if (p.includes('tokopedia')) return 'Tokopedia';
  if (p.includes('lazada')) return 'Lazada';
  if (p.includes('bukalapak')) return 'Bukalapak';
  if (p.includes('instagram') || p === 'ig') return 'Instagram';
  if (p.includes('whatsapp') || p === 'wa') return 'WhatsApp';
  return platform.trim();
};

/**
 * Tautan toko vendor bila ada, kalau tidak tautan WhatsApp dari nomor HP.
 * Mengembalikan array karena satu vendor bisa punya keduanya — toko dan WA.
 */
export const vendorLinks = (vendor: {
  shopUrl?: string;
  platform?: string;
  phone?: string;
}): VendorLink[] => {
  if (!vendor) return [];
  const out: VendorLink[] = [];

  const raw = String(vendor.shopUrl || '').trim();
  if (raw) {
    /*
     * Rapikan input malas: "shopee.co.id/toko" (tanpa https://) tetap bisa
     * diklik. Kalau diawali "javascript:" atau skema lain, URL() tetap
     * menghasilkan protokol yang bukan http/https dan tautannya dibuang.
     */
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      /*
       * URL() menerima hostname aneh seperti "ht!tp" (tanpa lempar error),
       * sehingga tautannya tampil tapi tidak bisa dibuka. Host harus punya
       * titik dan hanya berisi huruf/angka/tanda hubung.
       */
      const hostValid = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(parsed.hostname);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && hostValid) {
        out.push({
          href: parsed.toString(),
          label: platformLabel(vendor.platform || ''),
          kind: 'shop'
        });
      }
    } catch {
      // Bukan URL yang bisa dibuka — jangan tampilkan tautan rusak.
    }
  }

  const phone = normalizePhone(vendor.phone || '');
  if (phone) {
    out.push({ href: `https://wa.me/${phone}`, label: 'WhatsApp', kind: 'wa' });
  }

  return out;
};

/** Apakah vendor punya tautan yang bisa diklik sama sekali? */
export const hasVendorLink = (vendor: { shopUrl?: string; phone?: string }): boolean =>
  vendorLinks(vendor).length > 0;
