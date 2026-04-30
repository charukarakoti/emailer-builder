"use client";

import { createContext, useContext, useCallback, useMemo, useState } from "react";

type ToastVariant = "success" | "info" | "error";

type Toast = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

interface NotificationContextValue {
  notify: (message: string, variant?: ToastVariant, title?: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: ToastVariant = "success", title?: string) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const toast: Toast = { id, title, message, variant };
      setToasts((current) => [toast, ...current]);
      window.setTimeout(() => removeToast(id), 4200);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2 sm:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-xl transition-all duration-200 ${
              toast.variant === "success"
                ? "border-emerald-200 bg-white"
                : toast.variant === "error"
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="text-sm font-semibold text-slate-900">{toast.title}</div>
                )}
                <div className="text-sm text-slate-700 break-words">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors duration-150"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
