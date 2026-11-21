/** Klien API Info Kelurahan — tipis di atas fetch, dipakai semua halaman. */

export interface Category {
  id: string;
  slug: string;
  name: string;
  accent: string;
  description: string;
  total?: number;
}

export interface Author {
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  accent: string;
}

export interface Settings {
  name: string;
  tagline: string;
  description: string;
  village: string;
  district: string;
  city: string;
  province: string;
  address: string;
  email: string;
  phone: string;
  whatsapp: string;
  officeHours: string;
  socials: Record<string, string>;
  credit: { name: string; url: string };
  editors: string[];
  announcement: string;
  seo: { title?: string; description?: string; keywords?: string };
}

export interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  place: string;
  description: string;
}

export interface CommentItem {
  id: string;
  articleSlug: string;
  name: string;
  body: string;
  status?: 'approved' | 'pending' | 'rejected';
  createdAt: string;
  articleTitle?: string;
}

export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  dek: string;
  cover: string;
  coverCaption: string;
  category: string;
  categoryName: string;
  categoryAccent: string;
  author: string;
  authorName: string;
  authorRole: string;
  authorAccent: string;
  tags: string[];
  featured: boolean;
  breaking: boolean;
  status: 'published' | 'draft';
  views: number;
  readingTime: number;
  publishedAt: string;
  updatedAt: string;
  url: string;
  commentCount: number;
  sourceName?: string;
  sourceDate?: string;
  sourceUrl?: string;
}

export interface ArticleDetail extends ArticleListItem {
  content: string;
  comments: CommentItem[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ArticleListResponse {
  items: ArticleListItem[];
  meta: PaginationMeta;
  category: Category | null;
}

export interface ArticleResponse {
  article: ArticleDetail;
  related: ArticleListItem[];
  popular: ArticleListItem[];
  tags: string[];
  moreFromTag: ArticleListItem[];
  prev: ArticleListItem | null;
  next: ArticleListItem | null;
  seo: { title: string; description: string; image: string; publishedAt: string; author: string };
}

export interface Bootstrap {
  settings: Settings;
  categories: Category[];
  authors: Author[];
  agenda: AgendaItem[];
  breaking: ArticleListItem[];
  headlines: ArticleListItem[];
  tags: { name: string; count: number; slug: string }[];
  counts: { articles: number; categories: number; readers: number };
}

export interface AdminOverview {
  counts: {
    published: number;
    drafts: number;
    totalViews: number;
    todayViews: number;
    pendingComments: number;
    unreadMessages: number;
    subscribers: number;
    categories: number;
  };
  views: { date: string; views: number }[];
  topArticles: ArticleListItem[];
  categories: Category[];
  recentComments: CommentItem[];
  storage: { mode: string };
}

export interface MessageItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'ik-admin-token';

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error || `Permintaan gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  articles: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) query.set(key, String(value));
    });
    const qs = query.toString();
    return request<ArticleListResponse>(`/api/articles${qs ? `?${qs}` : ''}`);
  },
  article: (slug: string) =>
    request<ArticleResponse>(`/api/index?path=${encodeURIComponent(`/api/articles/${slug}`)}`),
  comments: (slug: string) => request<{ items: CommentItem[] }>(`/api/comments?slug=${encodeURIComponent(slug)}`),
  postComment: (payload: { articleSlug: string; name: string; email?: string; body: string; honeypot?: string }) =>
    request<{ ok: boolean; message: string }>('/api/comments', { method: 'POST', body: JSON.stringify(payload) }),
  popular: (limit = 5) => request<{ items: ArticleListItem[] }>(`/api/popular?limit=${limit}`),
  agenda: () => request<{ items: AgendaItem[] }>('/api/agenda'),
  tags: () => request<{ items: { name: string; count: number; slug: string }[] }>('/api/tags'),
  contact: (payload: { name: string; email: string; subject: string; body: string; honeypot?: string }) =>
    request<{ ok: boolean; message: string }>('/api/contact', { method: 'POST', body: JSON.stringify(payload) }),
  subscribe: (email: string) =>
    request<{ ok: boolean; message: string }>('/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  login: (password: string) =>
    request<{ token: string; expiresIn: number; user: { name: string; role: string } }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  session: () => request<{ user: unknown; devPassword: boolean }>('/api/admin/session'),
  overview: () => request<AdminOverview>('/api/admin/overview'),
  adminArticles: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    const qs = query.toString();
    return request<{ items: ArticleDetail[]; meta: PaginationMeta }>(`/api/admin/articles${qs ? `?${qs}` : ''}`);
  },
  adminArticle: (id: string) => request<{ article: ArticleDetail }>(`/api/admin/articles/${id}`),
  saveArticle: (payload: Partial<ArticleDetail> & { title: string; content: string }, id?: string) =>
    request<{ ok: boolean; article: ArticleDetail }>(
      id ? `/api/admin/articles/${id}` : '/api/admin/articles',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) }
    ),
  deleteArticle: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/articles/${id}`, { method: 'DELETE' }),
  adminComments: (status = 'semua') =>
    request<{ items: CommentItem[] }>(`/api/admin/comments?status=${status}`),
  moderateComment: (id: string, status: 'approved' | 'pending' | 'rejected') =>
    request<{ ok: boolean }>(`/api/admin/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteComment: (id: string) => request<{ ok: boolean }>(`/api/admin/comments/${id}`, { method: 'DELETE' }),
  messages: () => request<{ items: MessageItem[] }>('/api/admin/messages'),
  readMessage: (id: string, read: boolean) =>
    request<{ ok: boolean }>(`/api/admin/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ read }) }),
  deleteMessage: (id: string) => request<{ ok: boolean }>(`/api/admin/messages/${id}`, { method: 'DELETE' }),
  subscribers: () => request<{ items: { id: string; email: string; createdAt: string }[] }>('/api/admin/subscribers'),
  deleteSubscriber: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/subscribers/${id}`, { method: 'DELETE' }),
  categories: () => request<{ items: Category[] }>('/api/admin/categories'),
  saveCategory: (payload: Partial<Category>, id?: string) =>
    request<{ ok: boolean; category: Category }>(id ? `/api/admin/categories/${id}` : '/api/admin/categories', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string) => request<{ ok: boolean }>(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  adminAgenda: () => request<{ items: AgendaItem[] }>('/api/admin/agenda'),
  saveAgenda: (payload: Partial<AgendaItem>) =>
    request<{ ok: boolean; item: AgendaItem }>('/api/admin/agenda', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAgenda: (id: string) => request<{ ok: boolean }>(`/api/admin/agenda/${id}`, { method: 'DELETE' }),
  settings: () => request<{ settings: Settings }>('/api/admin/settings'),
  saveSettings: (payload: Partial<Settings>) =>
    request<{ ok: boolean; settings: Settings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  uploadMedia: (payload: { dataUrl: string; name: string }) =>
    request<{ ok: boolean; media: { id: string; url: string; name: string; size: number } }>('/api/admin/media', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
