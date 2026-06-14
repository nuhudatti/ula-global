import { useEffect } from 'react';

export type ToastTone = 'success' | 'info' | 'error';

export function AdminToast({
  message,
  tone = 'success',
  onDismiss,
  durationMs = 4200,
}: {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs, message, onDismiss]);

  const toneCls =
    tone === 'error'
      ? 'ula-admin-toast--error'
      : tone === 'info'
        ? 'ula-admin-toast--info'
        : 'ula-admin-toast--success';

  const icon =
    tone === 'error' ? 'fa-circle-xmark' : tone === 'info' ? 'fa-circle-info' : 'fa-circle-check';

  return (
    <div className={`ula-admin-toast ${toneCls}`} role="status" aria-live="polite">
      <i className={`fa-solid ${icon} ula-admin-toast__icon`} aria-hidden />
      <p className="ula-admin-toast__text">{message}</p>
      <button type="button" className="ula-admin-toast__close" onClick={onDismiss} aria-label="Dismiss">
        <i className="fa-solid fa-xmark" aria-hidden />
      </button>
    </div>
  );
}
