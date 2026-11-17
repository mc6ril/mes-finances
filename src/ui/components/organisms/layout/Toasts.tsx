import { useToast } from '@/hooks/useToast';
import { cx } from '@/ui/design-system/cx';

const Toasts = () => {
  const { toasts, dismiss } = useToast();
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-60 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={cx(
            'pointer-events-auto animate-in rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg ring-1',
            toast.tone === 'error' && 'bg-negative-banner text-negative-ink-deep ring-negative-line',
            toast.tone === 'success' && 'bg-surface-raised text-ink-emphasis ring-line-field',
            toast.tone === 'info' && 'bg-info-banner text-info-ink-deep ring-info-line',
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
};

export default Toasts;
