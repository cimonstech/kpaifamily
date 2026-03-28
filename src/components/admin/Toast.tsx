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
          className={`fixed bottom-4 right-4 z-[200] max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ease-out ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          } ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
        >
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
