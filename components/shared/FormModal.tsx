import React from 'react';
import { Modal, type ModalSize } from '../ui';

interface FormModalShellProps {
  isOpen:   boolean;
  title:    string;
  label?:   string;
  size?:    ModalSize;
  onClose:  () => void;
  footer?:  React.ReactNode;
  children: React.ReactNode;
}

export const FormModalShell: React.FC<FormModalShellProps> = ({
  isOpen, title, label, size = 'lg', onClose, footer, children,
}) => (
  <Modal isOpen={isOpen} title={title} label={label} size={size} onClose={onClose} footer={footer}>
    {children}
  </Modal>
);

export default FormModalShell;
