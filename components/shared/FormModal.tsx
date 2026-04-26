import React from 'react';
import { Modal, type ModalSize } from '../ui';

interface FormModalShellProps {
  isOpen:   boolean;
  title:    string;
  label?:   string;
  size?:    ModalSize;
  onClose:  () => void;
  children: React.ReactNode;
}

export const FormModalShell: React.FC<FormModalShellProps> = ({
  isOpen, title, label, size = 'lg', onClose, children,
}) => (
  <Modal isOpen={isOpen} title={title} label={label} size={size} onClose={onClose}>
    <div className="space-y-6">{children}</div>
  </Modal>
);

export default FormModalShell;
