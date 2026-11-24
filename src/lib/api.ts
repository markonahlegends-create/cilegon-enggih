/**
 * Klien API Cilegon Enggih.
 * Semua request memakai path relatif `/api/*` sehingga:
 *  - dev  → diproxy Vite ke backend :3001
 *  - prod → same-origin (Vercel / Express / Cloudflare Function)
 * Kalau frontend & backend beda domain, isi VITE_API_BASE_URL.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

/**
 * Sesi admin disimpan di cookie **HttpOnly** yang dipasang server.
 * JavaScript tidak bisa (dan tidak perlu) membacanya — ini menutup pencurian
 * token lewat XSS. Token lama di localStorage dibersihkan saat aplikasi
 * dimuat agar tidak tertinggal di perangkat yang pernah dipakai.
 */
const LEGACY_TOKEN_KEY = 'cilegon_enggih_admin_token_v1';

try {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
} catch {
  // localStorage bisa diblokir mode privat — abaikan.
}

/** @deprecated Token tidak lagi disimpan di klien. Selalu string kosong. */
export const getAdminToken = (): string => '';
/** @deprecated Tidak ada efek — sesi diatur server lewat Set-Cookie. */
export const setAdminToken = (_token: string): void => {
  void _token;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  admin?: boolean;
  signal?: AbortSignal;
}

export const apiRequest = async <T = any>(
  path: string,
  { method = 'GET', body, admin = false, signal }: RequestOptions = {}
): Promise<T> => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      // Sertakan cookie sesi HttpOnly. `include` diperlukan bila API berada
      // di domain berbeda (VITE_API_BASE_URL); same-origin juga tetap aman.
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    });
  } catch (err) {
    throw new ApiError(
      'Tidak dapat menghubungi server. Periksa koneksi internet Anda lalu coba lagi.',
      0
    );
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Permintaan gagal (HTTP ${res.status}). Silakan coba lagi.`;
    throw new ApiError(message, res.status);
  }

  return (data ?? {}) as T;
};

/* ------------------------------------------------------------------ */
/* Endpoint helpers                                                    */
/* ------------------------------------------------------------------ */

export interface StorefrontPayload {
  settings: Record<string, any>;
  vouchers: any[];
  products: any[];
  origin: Record<string, string>;
  storage: string;
}

export const fetchStorefront = () => apiRequest<StorefrontPayload>('/api/storefront');

export const fetchShippingZones = () =>
  apiRequest<{ zones: any[]; origin: any }>('/api/shipping/zones');

export const calculateShipping = (destinationId: string, weightGrams: number) =>
  apiRequest<any>('/api/shipping/calculate', {
    method: 'POST',
    body: { destinationId, weightGrams }
  });

export const requestQris = (amount: number, orderRef?: string) =>
  apiRequest<any>('/api/payment/qris', { method: 'POST', body: { amount, orderRef } });

export const createOrder = (payload: Record<string, unknown>) =>
  apiRequest<{ order: any; whatsappConfirmUrl: string }>('/api/orders', {
    method: 'POST',
    body: payload
  });

/* ------------------------- Midtrans Snap --------------------------- */

export interface SnapTokenPayload {
  token: string;
  redirectUrl: string | null;
  clientKey: string;
  isProduction: boolean;
  snapScriptUrl: string;
}

/**
 * Minta token pembayaran untuk pesanan yang baru dibuat.
 *
 * Server yang menentukan nominalnya (dari database), bukan browser — jadi
 * angka yang dibayar pembeli tidak bisa diubah dari sisi klien.
 */
export const createSnapToken = (orderId: string) =>
  apiRequest<SnapTokenPayload>('/api/payments/midtrans/token', {
    method: 'POST',
    body: { orderId }
  });

/**
 * Tanyakan status langsung ke Midtrans.
 * Jaring pengaman kalau webhook telat masuk — tanpa ini pembeli yang sudah
 * membayar bisa melihat pesanannya masih "menunggu pembayaran".
 */
export const checkMidtransStatus = (orderId: string) =>
  apiRequest<{
    orderId: string;
    paymentStatus: string;
    gateway: {
      ok: boolean;
      transactionStatus: string | null;
      fraudStatus: string | null;
      paymentType: string | null;
    } | null;
  }>(`/api/payments/midtrans/status/${encodeURIComponent(orderId)}`);

export const uploadPaymentProof = (
  orderId: string,
  payload: { paymentProofNote?: string; paymentProofImage?: string }
) =>
  apiRequest<{ order: any }>(`/api/orders/${encodeURIComponent(orderId)}/proof`, {
    method: 'POST',
    body: payload
  });

export const trackOrder = (code: string, phoneLast4: string) =>
  apiRequest<{ order: any }>(
    `/api/orders/track?q=${encodeURIComponent(code)}&phone=${encodeURIComponent(phoneLast4)}`
  );

export const submitB2B = (payload: Record<string, unknown>) =>
  apiRequest<{ inquiry: any }>('/api/b2b', { method: 'POST', body: payload });

/* ---------------------------- Admin ------------------------------- */

export const adminLogin = (password: string, username = 'admin') =>
  apiRequest<{
    otpRequired?: boolean;
    challengeId?: string;
    expiresInSeconds?: number;
    username: string;
    storage?: string;
    expiresInHours?: number;
    warning?: string;
    /** true = sesi dipasang lewat cookie HttpOnly (bukan token di body). */
    cookieAuth?: boolean;
    sid?: string | null;
    expiresAt?: number;
  }>('/api/admin/login', { method: 'POST', body: { password, username } });

export const adminVerifyOtp = (challengeId: string, code: string) =>
  apiRequest<{
    username: string;
    storage: string;
    expiresInHours: number;
    cookieAuth?: boolean;
    sid?: string | null;
    expiresAt?: number;
  }>('/api/admin/verify-otp', { method: 'POST', body: { challengeId, code } });

/* ---------------------- Sesi (Tahap 3) --------------------------- */

/** Cek apakah cookie sesi masih berlaku (dipakai saat halaman dimuat). */
export const adminMe = () =>
  apiRequest<{ username: string; via: string; expiresAt: number; storage: string }>(
    '/api/admin/me',
    { admin: true }
  );

export const adminLogout = () =>
  apiRequest<{ loggedOut: boolean }>('/api/admin/logout', { method: 'POST', admin: true });

export const adminSessions = () =>
  apiRequest<{ sessions: any[]; currentSid: string | null }>('/api/admin/sessions', { admin: true });

export const adminRevokeAllSessions = () =>
  apiRequest<{ revoked: number; message: string }>('/api/admin/sessions', {
    method: 'DELETE',
    admin: true
  });

/* ---------------------- Backup (Tahap 3) ------------------------- */

export const adminBackups = () =>
  apiRequest<{
    total: number;
    items: { filename: string; createdAt: string | null }[];
    schedule: string;
    retention: number;
    configured: boolean;
    /** Nama bucket yang dicari server (default "backups", huruf kecil). */
    bucket?: string;
    bucketReachable?: boolean;
    cronSecretConfigured?: boolean;
    diagnostic?: string | null;
  }>('/api/admin/backups', { admin: true });

export const adminRunBackup = () =>
  apiRequest<{
    filename: string;
    bytes: number;
    compressedBytes: number;
    counts: Record<string, number>;
    message: string;
  }>('/api/admin/backups', { method: 'POST', admin: true });

export const adminRestoreBackup = (filename: string, mode: 'merge' | 'replace' = 'merge') =>
  apiRequest<{ restored: Record<string, number>; mode: string; message: string }>(
    '/api/admin/backups/restore',
    { method: 'POST', body: { filename, mode }, admin: true }
  );

export const adminSetTwoFactor = (enabled: boolean) =>
  apiRequest<{ enabled: boolean }>('/api/admin/2fa', {
    method: 'POST',
    body: { enabled },
    admin: true
  });

/* ---------------- Keuangan ---------------- */

export const adminFinanceMeta = () => apiRequest<any>('/api/admin/finance/meta', { admin: true });

export const adminVendors = () => apiRequest<{ vendors: any[] }>('/api/admin/vendors', { admin: true });

/** Kesiapan dropship: skor kelayakan vendor + margin per produk. */
export const adminDropship = () => apiRequest<any>('/api/admin/dropship', { admin: true });

/** Prosedur dropship harian & hal yang tidak boleh dijanjikan. */
export const adminDropshipChecklist = () =>
  apiRequest<{ steps: any[]; restrictions: string[] }>('/api/admin/dropship/checklist', {
    admin: true
  });

export const adminCreateVendor = (payload: Record<string, unknown>) =>
  apiRequest<{ vendor: any; vendors: any[] }>('/api/admin/vendors', {
    method: 'POST',
    body: payload,
    admin: true
  });

export const adminUpdateVendor = (id: string, payload: Record<string, unknown>) =>
  apiRequest<{ vendor: any; vendors: any[] }>(`/api/admin/vendors/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
    admin: true
  });

export const adminDeleteVendor = (id: string) =>
  apiRequest<{ deleted: string; vendors: any[] }>(`/api/admin/vendors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    admin: true
  });

export const adminExpenses = (params: { from?: string; to?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return apiRequest<{ expenses: any[]; categories: any[] }>(
    `/api/admin/expenses${qs.toString() ? `?${qs}` : ''}`,
    { admin: true }
  );
};

export const adminCreateExpense = (payload: Record<string, unknown>) =>
  apiRequest<{ expense: any; expenses: any[] }>('/api/admin/expenses', {
    method: 'POST',
    body: payload,
    admin: true
  });

export const adminUpdateExpense = (id: string, payload: Record<string, unknown>) =>
  apiRequest<{ expense: any; expenses: any[] }>(`/api/admin/expenses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
    admin: true
  });

export const adminDeleteExpense = (id: string) =>
  apiRequest<{ deleted: string; expenses: any[] }>(`/api/admin/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    admin: true
  });

const rangeQuery = (params: { from?: string; to?: string }) => {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return qs.toString() ? `?${qs}` : '';
};

export const adminProfitLoss = (params: { from?: string; to?: string } = {}) =>
  apiRequest<any>(`/api/admin/finance/profit-loss${rangeQuery(params)}`, { admin: true });

export const adminMarginReport = () => apiRequest<any>('/api/admin/finance/margin', { admin: true });

export const adminSalesReport = (params: { from?: string; to?: string } = {}) =>
  apiRequest<any>(`/api/admin/finance/sales${rangeQuery(params)}`, { admin: true });

export const adminCashReport = (params: { from?: string; to?: string } = {}) =>
  apiRequest<any>(`/api/admin/finance/cash${rangeQuery(params)}`, { admin: true });

export const adminReceivables = () => apiRequest<any>('/api/admin/finance/receivables', { admin: true });

export const adminAuditLog = (params: { q?: string; action?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.action) qs.set('action', params.action);
  return apiRequest<{ total: number; entries: any[] }>(
    `/api/admin/audit${qs.toString() ? `?${qs}` : ''}`,
    { admin: true }
  );
};

export const adminSession = () =>
  apiRequest<{ valid: boolean; username: string; storage: string }>('/api/admin/session', {
    admin: true
  });

/** Laporan trafik & konversi (analitik). */
export const adminInsights = (days: 7 | 30 | 90 = 30) =>
  apiRequest<any>(`/api/admin/insights?days=${days}`, { admin: true });

/** CSV mentah untuk diolah di Excel/Sheets. */
export const adminInsightsCsv = async (days: 7 | 30 | 90 = 30): Promise<string> => {
  const res = await apiRequest<{ csv: string }>(`/api/admin/insights/export?days=${days}`, {
    admin: true
  });
  return res.csv;
};

export const adminAnalytics = () =>
  apiRequest<any>('/api/admin/analytics', { admin: true });

export const adminOrders = (params: { status?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ orders: any[] }>(`/api/admin/orders${suffix}`, { admin: true });
};

export const adminUpdateOrder = (orderId: string, payload: Record<string, unknown>) =>
  apiRequest<{ order: any }>(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: payload,
    admin: true
  });

export const adminDeleteOrder = (orderId: string) =>
  apiRequest<{ deleted: string; stockRestored: boolean; message: string }>(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
    { method: 'DELETE', admin: true }
  );

/** Hapus SEMUA pesanan (bersih-bersih data uji). Perlu konfirmasi teks. */
export const adminResetOrders = () =>
  apiRequest<{ deletedOrders: number; stockRestored: number; message: string }>(
    '/api/admin/orders/reset',
    { method: 'POST', body: { confirm: 'HAPUS SEMUA' }, admin: true }
  );

export const adminCreateProduct = (payload: Record<string, unknown>) =>
  apiRequest<{ product: any; products: any[]; warnings?: string[] }>('/api/admin/products', {
    method: 'POST',
    body: payload,
    admin: true
  });

export const adminUpdateProduct = (id: string, payload: Record<string, unknown>) =>
  apiRequest<{ product: any; products: any[]; warnings?: string[] }>(
    `/api/admin/products/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: payload,
      admin: true
    }
  );

export const adminDeleteProduct = (id: string) =>
  apiRequest<{ deleted: string; products: any[] }>(
    `/api/admin/products/${encodeURIComponent(id)}`,
    { method: 'DELETE', admin: true }
  );

export const adminDuplicateProduct = (id: string) =>
  apiRequest<{ product: any; products: any[] }>(
    `/api/admin/products/${encodeURIComponent(id)}/duplicate`,
    { method: 'POST', admin: true }
  );

export const adminUploadImage = (payload: {
  dataUrl: string;
  filename?: string;
  kind?: 'product' | 'proof' | 'qris';
}) =>
  apiRequest<{
    url: string;
    filename: string;
    storage: string;
    note?: string;
    kind?: string;
    bucket?: string;
  }>(
    '/api/admin/upload',
    { method: 'POST', body: payload, admin: true }
  );

/**
 * Unggah video produk (maks 5 MB, MP4/WebM).
 *
 * Dipisah dari adminUploadImage karena server memakai validasi berbeda:
 * video diperiksa lewat magic bytes MP4/WebM, bukan magic bytes gambar.
 */
export const adminUploadVideo = (payload: { dataUrl: string; filename?: string }) =>
  apiRequest<{
    url: string;
    filename: string;
    storage: string;
    bytes: number;
    mime: string;
    bucket?: string;
  }>('/api/admin/upload', {
    method: 'POST',
    body: { ...payload, kind: 'video' },
    admin: true
  });

/**
 * Minta tiket unggah video langsung ke Supabase Storage.
 *
 * KENAPA BUKAN adminUploadVideo: Vercel menolak body request > 4.5 MB dan
 * batas itu tidak bisa dinaikkan. video 5 MB -> base64 ±6,7 MB -> 413 sebelum
 * kode server jalan. Dengan tiket ini, file diunggah browser langsung ke
 * Supabase dan server hanya menerima URL publiknya.
 */
export const adminRequestVideoTicket = (payload: { filename: string; sizeBytes: number }) =>
  apiRequest<{
    uploadUrl: string;
    path: string;
    publicUrl: string;
    bucket: string;
    maxBytes: number;
  }>('/api/admin/video-upload-ticket', { method: 'POST', body: payload, admin: true });

/** Daftarkan webhook Telegram agar tombol "Verifikasi LUNAS" berfungsi. */
export const adminRegisterTelegramWebhook = (publicUrl?: string) =>
  apiRequest<{ registered: boolean; url: string; message: string }>(
    '/api/admin/telegram/webhook',
    { method: 'POST', body: publicUrl ? { publicUrl } : {}, admin: true }
  );

export interface TelegramDiagnosa {
  sehat: boolean;
  saran: string;
  langkah: { nama: string; ok: boolean; pesan: string }[];
}

/** Periksa kenapa notifikasi Telegram diam (token, chat id, webhook, kirim terakhir). */
export const adminTelegramDiagnosa = () =>
  apiRequest<TelegramDiagnosa>('/api/admin/telegram/diagnosa', { admin: true });

/** Status webhook Telegram yang sedang aktif (tanpa membocorkan secret). */
export const adminTelegramWebhookStatus = () =>
  apiRequest<{
    configured: boolean;
    url?: string;
    pendingUpdates?: number;
    lastError?: string;
    secretDiset?: boolean;
    reason?: string;
  }>('/api/admin/telegram/webhook', { admin: true });

export const adminSettingsFull = () =>
  apiRequest<{ settings: any }>('/api/admin/settings', { admin: true });

export const adminSendDigest = () =>
  apiRequest<{ ok: boolean; sent: boolean }>('/api/admin/digest', { method: 'POST' });

export const adminTestTelegram = (payload: { telegram: Record<string, unknown> }) =>
  apiRequest<{ sent: boolean; message: string }>('/api/admin/telegram/test', {
    method: 'POST',
    body: payload,
    admin: true
  });

export const adminResetProducts = () =>
  apiRequest<{ products: any[]; restored: number }>('/api/admin/products/reset', {
    method: 'POST',
    admin: true
  });

export const adminUpdateSettings = (payload: Record<string, unknown>) =>
  apiRequest<{ settings: any }>('/api/admin/settings', {
    method: 'PUT',
    body: payload,
    admin: true
  });

export const adminResetSettings = () =>
  apiRequest<{ settings: any }>('/api/admin/settings/reset', { method: 'POST', admin: true });

export const adminProducts = () =>
  apiRequest<{ products: any[] }>('/api/admin/products', { admin: true });

export const adminB2B = () => apiRequest<{ inquiries: any[] }>('/api/admin/b2b', { admin: true });

export const adminUpdateB2B = (quoteId: string, payload: Record<string, unknown>) =>
  apiRequest<{ inquiry: any; inquiries: any[] }>(
    `/api/admin/b2b/${encodeURIComponent(quoteId)}`,
    { method: 'PATCH', body: payload, admin: true }
  );

export const adminExport = () => apiRequest<any>('/api/admin/export', { admin: true });
