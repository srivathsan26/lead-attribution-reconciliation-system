import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map(toast => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
          error: <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
          info: <Info className="w-5 h-5 text-cyan-400 flex-shrink-0" />,
        };

        const bgStyles = {
          success: 'bg-[#0a1820]/90 border-emerald-500/30 text-white backdrop-blur-xl shadow-[0_0_20px_rgba(16,185,129,0.15)]',
          warning: 'bg-[#1c140a]/90 border-amber-500/30 text-white backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.15)]',
          error: 'bg-[#1f0a10]/90 border-rose-500/30 text-white backdrop-blur-xl shadow-[0_0_20px_rgba(244,63,94,0.15)]',
          info: 'bg-[#09152a]/90 border-cyan-500/30 text-white backdrop-blur-xl shadow-[0_0_20px_rgba(6,182,212,0.15)]',
        };

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl transition-all transform duration-200 ${bgStyles[toast.type]}`}
          >
            {icons[toast.type]}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold tracking-tight text-white">{toast.title}</h4>
              <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              aria-label="Close notification"
              className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
