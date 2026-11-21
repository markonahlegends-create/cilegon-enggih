/** Format tanggal, angka, dan teks khas media Indonesia. */

const TZ = 'Asia/Jakarta';

export function formatDate(iso: string, style: 'full' | 'long' | 'short' | 'date' = 'long'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions =
    style === 'full'
      ? { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : style === 'long'
        ? { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }
        : style === 'short'
          ? { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }
          : { timeZone: TZ, day: '2-digit', month: 'short' };
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

export function formatDateWithTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date) + ' WIB';
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso)) + ' WIB';
}

export function timeAgo(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} pekan lalu`;
  return formatDate(iso, 'short');
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value || 0);
}

export function formatCompact(value: number): string {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1).replace('.', ',')} jt`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace('.', ',')} rb`;
  return String(num);
}

export function todayLabel(): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function agendaDateParts(dateStr: string): { day: string; month: string; weekday: string } {
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '---', weekday: '' };
  return {
    day: new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('id-ID', { timeZone: TZ, month: 'short' }).format(date),
    weekday: new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long' }).format(date),
  };
}

export function slugToTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
