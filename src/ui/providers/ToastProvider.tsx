import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type Toast, type ToastTone } from './contexts';

const TOAST_DURATION_MS = 4000;

type ToastProviderProps = { children: ReactNode };

const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  );
  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export default ToastProvider;
