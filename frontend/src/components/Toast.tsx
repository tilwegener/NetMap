import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export type ToastOptions = {
  /** Longer second line under the headline. */
  detail?: string;
  /** Auto-dismiss delay in ms; errors default to 8000, others 4000. */
  durationMs?: number;
};

type ToastEntry = {
  id: number;
  variant: ToastVariant;
  message: string;
  detail?: string;
  leaving: boolean;
};

type ToastApi = {
  toast: (variant: ToastVariant, message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastCtx);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

const variantIcons = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
} as const;

const LEAVE_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.map((entry) => (entry.id === id ? { ...entry, leaving: true } : entry)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, LEAVE_MS);
  }, []);

  const toast = useCallback((variant: ToastVariant, message: string, options?: ToastOptions) => {
    const id = nextIdRef.current++;
    const durationMs = options?.durationMs ?? (variant === "error" ? 8000 : 4000);
    setToasts((current) => [...current.slice(-4), { id, variant, message, detail: options?.detail, leaving: false }]);
    timersRef.current.set(id, window.setTimeout(() => dismiss(id), durationMs));
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    toast,
    success: (message, options) => toast("success", message, options),
    error: (message, options) => toast("error", message, options),
    info: (message, options) => toast("info", message, options),
  }), [toast]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="nm-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((entry) => {
          const Icon = variantIcons[entry.variant];
          return (
            <div
              key={entry.id}
              className={`nm-toast nm-toast--${entry.variant}${entry.leaving ? " nm-toast--leaving" : ""}`}
              role={entry.variant === "error" ? "alert" : "status"}
            >
              <span className="nm-toast-icon" aria-hidden="true"><Icon size={16} /></span>
              <div className="nm-toast-copy">
                <strong>{entry.message}</strong>
                {entry.detail && <span>{entry.detail}</span>}
              </div>
              <button type="button" className="nm-toast-dismiss" onClick={() => dismiss(entry.id)} aria-label="Dismiss notification">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
