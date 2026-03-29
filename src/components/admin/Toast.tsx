"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ToastType = "success" | "error";

type ToastContextValue = {
  showToast: (message: string, type: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: ToastType;
  } | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((message: string, type: ToastType) => {
    toastSeq += 1;
    setVisible(false);
    setToast({ id: toastSeq, message, type });
  }, []);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }

    const show = requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => setVisible(false), 3000);
    const clear = window.setTimeout(() => setToast(null), 3300);

    return () => {
      cancelAnimationFrame(show);
      window.clearTimeout(hide);
      window.clearTimeout(clear);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div
          role="status"
          className="fixed z-[200] flex max-w-sm items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-medium motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-kpai max-lg:bottom-24 max-lg:left-1/2 max-lg:-translate-x-1/2 lg:bottom-4 lg:right-4"
          style={{
            background: "var(--neu-bg)",
            boxShadow: "var(--neu-raised-lg)",
            color: "var(--neu-text-primary)",
            borderLeft:
              toast.type === "success"
                ? "4px solid var(--neu-success)"
                : "4px solid var(--neu-danger)",
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translateY(0)"
              : "translateY(12px)",
          }}
        >
          {toast.type === "success" ? (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--neu-success)" }}
            >
              ✓
            </span>
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--neu-danger)" }}
            >
              ✕
            </span>
          )}
          {toast.message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
