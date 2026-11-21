import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { api } from '../lib/api';

export function NewsletterForm({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setState('loading');
    try {
      const res = await api.subscribe(email.trim());
      setMessage(res.message);
      setState('done');
      setEmail('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal berlangganan.');
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div
        className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12.5px] ${
          dark ? 'bg-white/10 text-white' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
        }`}
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="relative">
        <Mail
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
            dark ? 'text-white/50' : 'text-slate-400'
          }`}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Alamat email Anda"
          aria-label="Alamat email"
          className={
            dark
              ? 'h-11 w-full rounded-xl border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/40'
              : 'field !h-11 !pl-9'
          }
        />
      </div>
      <button
        type="submit"
        disabled={state === 'loading'}
        className={
          dark
            ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[13px] font-bold text-navy-900 transition hover:bg-slate-100 disabled:opacity-70'
            : 'btn-primary w-full'
        }
      >
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {compact ? 'Langganan' : 'Berlangganan Gratis'}
      </button>
      {state === 'error' && <p className="text-[11.5px] font-medium text-brand-600 dark:text-brand-400">{message}</p>}
      <p className={`text-[10.5px] leading-relaxed ${dark ? 'text-white/55' : 'text-slate-500 dark:text-slate-400'}`}>
        Tanpa spam. Berhenti berlangganan kapan saja.
      </p>
    </form>
  );
}
