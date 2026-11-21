import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Send, UserRound } from 'lucide-react';
import type { CommentItem } from '../lib/api';
import { api } from '../lib/api';
import { formatDateWithTime, initials } from '../lib/format';

export function Comments({ slug, comments = [] }: { slug: string; comments?: CommentItem[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.postComment({ articleSlug: slug, name: name.trim(), email: email.trim(), body: body.trim() });
      setSuccess(result.message || 'Terima kasih. Komentar Anda menunggu moderasi redaksi.');
      setName('');
      setEmail('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komentar gagal dikirim.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="komentar" className="scroll-mt-28">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-brand-600" />
        <h2 className="text-xl font-extrabold text-navy-900 dark:text-white">Komentar <span className="text-slate-400">({comments.length})</span></h2>
      </div>

      <div className="surface p-4 sm:p-5">
        {success ? (
          <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> {success}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="comment-name">Nama</label><input id="comment-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Nama Anda" /></div>
              <div><label className="label" htmlFor="comment-email">Email <span className="font-normal normal-case tracking-normal">(tidak ditampilkan)</span></label><input id="comment-email" type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="email@contoh.com" /></div>
            </div>
            <div><label className="label" htmlFor="comment-body">Komentar</label><textarea id="comment-body" required minLength={8} maxLength={1200} rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="field resize-y" placeholder="Tulis tanggapan yang santun dan relevan…" /></div>
            {error && <p className="text-xs font-semibold text-brand-600">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10.5px] text-slate-500">Komentar dimoderasi sebelum ditampilkan.</p>
              <button type="submit" disabled={busy} className="btn-primary !py-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Komentar
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {comments.map((comment) => (
          <article key={comment.id} className="flex gap-3 rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-white/[.03]">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              {comment.name ? initials(comment.name) : <UserRound className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <p className="text-[13px] font-bold text-slate-800 dark:text-white">{comment.name}</p>
                <time className="text-[10px] text-slate-400" dateTime={comment.createdAt}>{formatDateWithTime(comment.createdAt)}</time>
              </div>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{comment.body}</p>
            </div>
          </article>
        ))}
        {!comments.length && <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-white/10">Belum ada komentar. Jadilah yang pertama berdiskusi.</p>}
      </div>
    </section>
  );
}
