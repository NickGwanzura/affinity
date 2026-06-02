import React, { useState, useCallback } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal, Button } from '../ui';

interface ConfirmModalProps {
  isOpen:          boolean;
  title:           string;
  message:         string;
  confirmLabel?:   string;
  cancelLabel?:    string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm:       () => void;
  onCancel:        () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  confirmVariant = 'danger', onConfirm, onCancel,
}) => {
  const isDanger = confirmVariant === 'danger';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="xs"
      preventCloseOnClickOutside
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isDanger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
          }`}
        >
          {isDanger ? (
            <AlertTriangle size={22} />
          ) : (
            <Info size={22} />
          )}
        </div>
        <p className="pt-1.5 text-sm leading-relaxed text-gray-700">{message}</p>
      </div>
    </Modal>
  );
};

interface ConfirmOptions {
  title:           string;
  message:         string;
  confirmLabel?:   string;
  cancelLabel?:    string;
  confirmVariant?: 'danger' | 'primary';
}

export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((resolve) => { setResolveRef(() => resolve); });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(true);
    setResolveRef(null);
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(false);
    setResolveRef(null);
  }, [resolveRef]);

  const ConfirmDialog = () =>
    options ? (
      <ConfirmModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        confirmVariant={options.confirmVariant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ) : null;

  return { confirm, ConfirmDialog };
};

export default ConfirmModal;
