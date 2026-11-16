import React from 'react';
import { CheckCircle2, Info, AlertCircle, X, MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildWhatsAppUrl } from '../data/products';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useStore();

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white rounded-2xl shadow-card-hover border border-slate-200 p-3.5 flex items-start gap-3 animate-fade-in"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
          )}
          {toast.type === 'warning' && (
            <AlertCircle className="w-5 h-5 text-amberbrand-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-800">
              {toast.title}
            </div>
            {toast.subtitle && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {toast.subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const FloatingWhatsApp: React.FC = () => {
  return (
    <a
      href={buildWhatsAppUrl(
        'Halo Admin Cilegon Enggih! Saya ingin bertanya seputar produk merchandise / pesanan grosir.'
      )}
      target="_blank"
      rel="noreferrer"
      aria-label="Hubungi Admin via WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-forest-600 hover:bg-forest-700 text-white shadow-card-hover transition-transform hover:scale-105"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="text-xs font-extrabold hidden sm:inline">
        Tanya / Pesan WA
      </span>
    </a>
  );
};
