import React from 'react';
import {
  FolderOpen,
  FileText,
  Users,
  Receipt,
  BarChart3,
  Truck,
  Search,
} from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title:        string;
  description?: string;
  icon?:        React.ReactNode;
  action?: {
    label:    string;
    onClick:  () => void;
    variant?: 'primary' | 'success' | 'secondary';
  };
  secondaryAction?: {
    label:   string;
    onClick: () => void;
  };
  className?: string;
}

// Default icons using lucide-react
const defaultIcons = {
  folder:   <FolderOpen size={32} />,
  document: <FileText size={32} />,
  users:    <Users size={32} />,
  receipt:  <Receipt size={32} />,
  chart:    <BarChart3 size={32} />,
  truck:    <Truck size={32} />,
  search:   <Search size={32} />,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
  >
    {/* Icon box */}
    <div className="w-20 h-20 bg-gray-100 flex items-center justify-center text-gray-500 mb-6">
      {icon ?? defaultIcons.folder}
    </div>

    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      {title}
    </h3>

    {description && (
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">
        {description}
      </p>
    )}

    {(action || secondaryAction) && (
      <div className="flex gap-3 flex-wrap justify-center">
        {action && (
          <Button
            variant={action.variant ?? 'primary'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="ghost" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    )}
  </div>
);

export { defaultIcons };
