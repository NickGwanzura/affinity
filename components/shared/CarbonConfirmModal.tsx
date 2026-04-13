import React from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import { WarningAlt, Information } from '@carbon/icons-react';

interface CarbonConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const CarbonConfirmModal: React.FC<CarbonConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const isDanger = confirmVariant === 'danger';

  return (
    <ComposedModal
      open={isOpen}
      onClose={onCancel}
      size="xs"
      preventCloseOnClickOutside
    >
      <ModalHeader
        title={title}
        iconDescription={isDanger ? 'Warning' : 'Information'}
      />
      
      <ModalBody>
        <div style={{ display: 'flex', gap: 'var(--cds-spacing-04, 0.75rem)' }}>
          <div
            style={{
              flexShrink: 0,
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDanger 
                ? 'var(--cds-support-error, #da1e28)' 
                : 'var(--cds-support-info, #0f62fe)',
            }}
          >
            {isDanger ? (
              <WarningAlt size={24} style={{ color: '#ffffff' }} />
            ) : (
              <Information size={24} style={{ color: '#ffffff' }} />
            )}
          </div>
          <p
            style={{
              fontSize: 'var(--cds-body-01-font-size, 0.875rem)',
              lineHeight: 'var(--cds-body-01-line-height, 1.5)',
              color: 'var(--cds-text-secondary, #525252)',
              margin: 0,
            }}
          >
            {message}
          </p>
        </div>
      </ModalBody>

      <ModalFooter
        primaryButtonText={confirmLabel}
        secondaryButtonText={cancelLabel}
        onRequestSubmit={onConfirm}
        onRequestClose={onCancel}
        danger={isDanger}
      />
    </ComposedModal>
  );
};

// Hook for using confirmation modal
import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

export const useCarbonConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
    });
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
      <CarbonConfirmModal
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

// Backward-compat alias — use useCarbonConfirm for new code
export const useConfirm = useCarbonConfirm;

export default CarbonConfirmModal;
