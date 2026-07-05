import {
  createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode,
} from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "./Modal";

export type ConfirmOptions = {
  title: string;
  /** Main consequence statement, e.g. "This permanently deletes 12 devices." */
  message: string;
  /** Optional secondary line with extra context. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styling (default). Set false for non-destructive confirmations. */
  danger?: boolean;
  /** Require typing this exact string before the confirm button enables (bulk deletes). */
  typeToConfirm?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmCtx);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    // Settle any confirm dialog that is somehow still open as cancelled.
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const entry = { options, resolve };
      pendingRef.current = entry;
      setTypedValue("");
      setPending(entry);
    });
  }, []);

  function settle(confirmed: boolean) {
    pendingRef.current = null;
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }

  const options = pending?.options;
  const danger = options?.danger !== false;
  const typeGate = options?.typeToConfirm;
  const confirmDisabled = Boolean(typeGate) && typedValue.trim() !== typeGate;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!confirmDisabled) settle(true);
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {options && (
        <Modal
          size="sm"
          title={options.title}
          onCancel={() => settle(false)}
          modalClassName="nm-confirm-modal"
          titleIcon={danger ? (
            <span className="nm-confirm-title-icon" aria-hidden="true">
              <TriangleAlert size={18} />
            </span>
          ) : undefined}
        >
          <form className="nm-confirm-body" onSubmit={onSubmit}>
            <div className="nm-confirm-message-row">
              <div className="nm-confirm-copy">
                <p className="nm-confirm-message">{options.message}</p>
                {options.detail && <p className="nm-confirm-detail">{options.detail}</p>}
              </div>
            </div>
            {typeGate && (
              <label className="nm-field nm-confirm-gate">
                <span>Type <code>{typeGate}</code> to confirm</span>
                <input
                  className="nm-input"
                  value={typedValue}
                  onChange={(event) => setTypedValue(event.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            )}
            <div className="nm-confirm-actions">
              <button type="button" className="nm-btn" onClick={() => settle(false)} autoFocus={!typeGate}>
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="submit"
                className={danger ? "nm-btn nm-btn--danger" : "nm-btn nm-btn--primary"}
                disabled={confirmDisabled}
              >
                {options.confirmLabel ?? (danger ? "Delete" : "Confirm")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
