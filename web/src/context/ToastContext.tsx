import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import '../styles/ula-toast.css';

export type ToastTone = 'success' | 'info' | 'error';

type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastContextValue = {
  toast: (opts: { title: string; message?: string; tone?: ToastTone; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const icon =
    item.tone === 'error'
      ? 'fa-circle-xmark'
      : item.tone === 'info'
        ? 'fa-arrow-down-to-bracket'
        : 'fa-circle-check';

  return (
    <div className={`ula-toast ula-toast--${item.tone}`} role="status" aria-live="polite">
      <span className="ula-toast__icon-wrap" aria-hidden>
        <i className={`fa-solid ${icon}`} />
      </span>
      <div className="ula-toast__body">
        <p className="ula-toast__title">{item.title}</p>
        {item.message ? <p className="ula-toast__message">{item.message}</p> : null}
      </div>
      <button type="button" className="ula-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <i className="fa-solid fa-xmark text-[12px]" aria-hidden />
      </button>
      <span
        className="ula-toast__progress"
        style={{ animationDuration: `${item.durationMs}ms` }}
        aria-hidden
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      message,
      tone = 'success',
      durationMs = 4800,
    }: {
      title: string;
      message?: string;
      tone?: ToastTone;
      durationMs?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-2), { id, title, message, tone, durationMs }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {items.length > 0 ? (
        <div className="ula-toast-stack" aria-label="Notifications">
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
