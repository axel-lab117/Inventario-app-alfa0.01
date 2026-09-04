'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../utils';
import { Button } from './Button';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const newToast = { ...t, id };
    setToasts(prev => [...prev, newToast]);
    if (t.duration !== 0) {
      setTimeout(() => dismiss(id), t.duration ?? 5000);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={cn('toast', colors[t.type], 'pointer-events-auto animate-slide-up')}>
          <icons[t.type] className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t.title}</p>
            {t.message && <p className="text-sm opacity-90">{t.message}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(t.id)} className="-m-1 p-1">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}