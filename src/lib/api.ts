/**
 * Klien API Cilegon Enggih.
 * Semua request memakai path relatif `/api/*` sehingga:
 *  - dev  → diproxy Vite ke backend :3001
 *  - prod → same-origin (Vercel / Express / Cloudflare Function)
 * Kalau frontend & backend beda domain, isi VITE_API_BASE_URL.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

const TOKEN_KEY = 'cilegon_enggih_admin_token_v1';

export const getAdminToken = (): string => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setAdminToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
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
  if (admin) {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
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
    token?: string;
    otpRequired?: boolean;
    challengeId?: string;
    expiresInSeconds?: number;
    username: string;
    storage?: string;
    expiresInHours?: number;
    warning?: string;
  }>('/api/admin/login', { method: 'POST', body: { password, username } });

export const adminVerifyOtp = (challengeId: string, code: string) =>
  apiRequest<{ token: string; username: string; storage: string; expiresInHours: number }>(
    '/api/admin/verify-otp',
    { method: 'POST', body: { challengeId, code } }
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

export const adminCreateProduct = (payload: Record<string, unknown>) =>
  apiRequest<{ product: any; products: any[] }>('/api/admin/products', {
    method: 'POST',
    body: payload,
    admin: true
  });

export const adminUpdateProduct = (id: string, payload: Record<string, unknown>) =>
  apiRequest<{ product: any; products: any[] }>(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
    admin: true
  });

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
  kind?: 'product' | 'proof';
}) =>
  apiRequest<{ url: string; filename: string; storage: string; note?: string }>(
    '/api/admin/upload',
    { method: 'POST', body: payload, admin: true }
  );

export const adminSettingsFull = () =>
  apiRequest<{ settings: any }>('/api/admin/settings', { admin: true });

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
