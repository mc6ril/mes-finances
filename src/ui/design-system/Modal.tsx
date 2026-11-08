import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import Button from './Button';
import Text from './Text';
import Title from './Title';
import { cx } from './cx';

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
    className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 backdrop-blur-sm sm:items-center sm:p-4"
    role="dialog"
    aria-modal
    aria-label={title}
  >
    <div className="absolute inset-0" onClick={onClose} aria-hidden />
    <div
      className={cx(
        'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl animate-in dark:bg-[#1c1c1b] sm:rounded-2xl',
        SIZES[size],
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 dark:border-stone-800">
        <Title level={2}>{title}</Title>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose} label="Fermer" />
      </header>
      <div className="overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-5 py-3 dark:border-stone-800">
          {footer}
        </footer>
      )}
    </div>
  </div>
);

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) => (
  <Modal
    title={title}
    onClose={onCancel}
    footer={
      <>
        <Button onClick={onCancel}>Annuler</Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <Text>{message}</Text>
  </Modal>
);
