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

export const trackOrder = (code: string) =>
  apiRequest<{ order: any; recentSamples?: any[] }>(
    `/api/orders/track?q=${encodeURIComponent(code)}`
  );

export const submitB2B = (payload: Record<string, unknown>) =>
  apiRequest<{ inquiry: any }>('/api/b2b', { method: 'POST', body: payload });

/* ---------------------------- Admin ------------------------------- */

export const adminLogin = (password: string, username = 'admin') =>
  apiRequest<{ token: string; username: string; storage: string; expiresInHours: number }>(
    '/api/admin/login',
    { method: 'POST', body: { password, username } }
  );

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

export const adminUploadImage = (payload: { dataUrl: string; filename?: string }) =>
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
