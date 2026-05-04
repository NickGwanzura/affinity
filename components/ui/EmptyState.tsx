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
    className={`app-fade-in flex flex-col items-center justify-center px-4 py-12 text-center sm:py-16 ${className}`}
  >
    {/* Soft tinted circular backdrop with subtle ring — feels intentional, not placeholder. */}
    <div
      aria-hidden="true"
      className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-stone-50 to-stone-100 text-zinc-500 ring-1 ring-stone-200/80 shadow-sm"
    >
      <span className="absolute inset-0 rounded-full bg-[#D97706]/[0.04]" />
      <span className="relative">{icon ?? defaultIcons.folder}</span>
    </div>

    <h3 className="mb-1.5 text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
      {title}
    </h3>

    {description && (
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-zinc-500">
        {description}
      </p>
    )}

    {(action || secondaryAction) && (
      <div className="flex flex-wrap justify-center gap-3">
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
