"use client";

// =============================================================================
// components/Toast.tsx — lightweight toast system for the SaaS pages.
//
// API:
//   const toast = useToast();
//   toast.success("Saved!");
//   toast.error("Something went wrong");
//   toast.info("Heads up");
//
// Renders in the top-right of the viewport, auto-dismisses after 4s, and is
// safe to call from any client component because the provider mounts a
// portal-style fixed container.
//
// Intentionally NOT a global context — each page that uses it imports the
// `useToast()` hook + renders `<ToastViewport />` once at the top of the page.
// This keeps the SaaS pages independent of the editor's existing
// NotificationProvider while still giving consistent visual treatment.
// =============================================================================

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastCtx {
  toasts: Toast[];
  push: (variant: ToastVariant, message: string) => void;
  remove: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idRef.current;
      setToasts((cur) => [...cur, { id, variant, message }]);
      // Auto-dismiss
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <Ctx.Provider value={{ toasts, push, remove }}>
      {children}
      <ToastViewport />
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  // Graceful fallback — if a page forgot the provider, toasts become no-ops
  // and we log a warning to the console rather than crashing.
  if (!ctx) {
    return {
      success: (m: string) => console.warn("[toast]", m),
      error: (m: string) => console.warn("[toast:error]", m),
      info: (m: string) => console.warn("[toast:info]", m),
    };
  }
  return {
    success: (m: string) => ctx.push("success", m),
    error: (m: string) => ctx.push("error", m),
    info: (m: string) => ctx.push("info", m),
  };
}

function ToastViewport() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => ctx.remove(t.id)}
          className={
            "pointer-events-auto cursor-pointer min-w-[240px] max-w-sm rounded-xl shadow-lg border px-4 py-3 text-sm bg-white transition " +
            (t.variant === "success"
              ? "border-emerald-200 text-emerald-800"
              : t.variant === "error"
              ? "border-rose-200 text-rose-800"
              : "border-slate-200 text-slate-800")
          }
        >
          <div className="flex items-start gap-2">
            <span
              className={
                "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs " +
                (t.variant === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : t.variant === "error"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-700")
              }
            >
              {t.variant === "success" ? "✓" : t.variant === "error" ? "!" : "i"}
            </span>
            <div className="flex-1 leading-snug">{t.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
