import Button from '@/ui/components/atoms/Button';
import Text from '@/ui/components/atoms/Text';
import { Modal } from './Modal';

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
