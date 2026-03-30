import React from 'react';
import { Modal, type ModalProps } from '@carbon/react';

interface CarbonFormModalProps {
  isOpen: boolean;
  title: string;
  label?: string;
  size?: ModalProps['size'];
  onClose: () => void;
  children: React.ReactNode;
}

export const CarbonFormModal: React.FC<CarbonFormModalProps> = ({
  isOpen,
  title,
  label,
  size = 'lg',
  onClose,
  children,
}) => (
  <Modal
    open={isOpen}
    passiveModal
    hasScrollingContent
    size={size}
    modalHeading={title}
    modalLabel={label}
    onRequestClose={onClose}
  >
    <div className="space-y-6 pt-2">{children}</div>
  </Modal>
);

export default CarbonFormModal;
