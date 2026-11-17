import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import Button from '@/ui/components/atoms/Button';
import Title from '@/ui/components/atoms/Title';
import { cx } from '@/ui/design-system/cx';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
};

const SIZES = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export const Modal = ({ title, onClose, children, footer, size = 'md' }: ModalProps) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-xs sm:items-center sm:p-4"
    role="dialog"
    aria-modal
    aria-label={title}
  >
    <div className="absolute inset-0" onClick={onClose} aria-hidden />
    <div
      className={cx(
        'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl animate-in sm:rounded-2xl',
        SIZES[size],
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <Title level={2}>{title}</Title>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose} label="Fermer" />
      </header>
      <div className="overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>
      )}
    </div>
  </div>
);
