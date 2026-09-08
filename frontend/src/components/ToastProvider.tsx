"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

type Listener = (toast: Omit<ToastItem, "id"> & { id?: string }) => void;
const listeners = new Set<Listener>();

/** Imperative toast helper — works from any client module. */
export const toast = {
  success(message: string) {
    listeners.forEach((l) => l({ message, tone: "success" }));
  },
  error(message: string) {
    listeners.forEach((l) => l({ message, tone: "error" }));
  },
  info(message: string) {
    listeners.forEach((l) => l({ message, tone: "info" }));
  },
};

function toneStyles(tone: ToastTone) {
  switch (tone) {
    case "error":
      return {
        wrap: "border-[var(--danger)]/40 bg-[var(--bg-elevated)] text-[var(--text)]",
        icon: "text-[var(--danger)]",
        Icon: AlertCircle,
      };
    case "info":
      return {
        wrap: "border-[var(--info)]/40 bg-[var(--bg-elevated)] text-[var(--text)]",
        icon: "text-[var(--info)]",
        Icon: Info,
      };
    default:
      return {
        wrap: "border-[var(--success)]/40 bg-[var(--bg-elevated)] text-[var(--text)]",
        icon: "text-[var(--success)]",
        Icon: CheckCircle2,
      };
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { id, message, tone }].slice(-5));
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
      dismiss,
    }),
    [push, dismiss]
  );

  useEffect(() => {
    const listener: Listener = ({ message, tone }) => push(message, tone);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(100%-2rem,24rem)] flex-col gap-2 sm:right-5 sm:top-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const style = toneStyles(item.tone);
          const Icon = style.Icon;
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-[var(--shadow)] backdrop-blur-sm animate-[toast-in_0.22s_ease-out] ${style.wrap}`}
              role="status"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} />
              <p className="min-w-0 flex-1 text-sm leading-snug text-[var(--text)]">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
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
