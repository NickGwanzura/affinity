import React from 'react';
import { Button } from '@carbon/react';
import {
  FolderOpen,
  Document,
  UserMultiple,
  Receipt,
  ChartBar,
  DeliveryTruck,
  Search,
} from '@carbon/icons-react';

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

// Default icons using @carbon/icons-react for consistent icon system
const defaultIcons = {
  folder:   <FolderOpen size={32} />,
  document: <Document size={32} />,
  users:    <UserMultiple size={32} />,
  receipt:  <Receipt size={32} />,
  chart:    <ChartBar size={32} />,
  truck:    <DeliveryTruck size={32} />,
  search:   <Search size={32} />,
};

const kindMap: Record<string, 'primary' | 'secondary' | 'ghost'> = {
  primary:   'primary',
  success:   'primary',
  secondary: 'secondary',
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
    className={className}
    style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '4rem 1rem',
      textAlign:      'center',
    }}
  >
    {/* Icon box */}
    <div style={{
      width:           80,
      height:          80,
      background:      'var(--cds-layer-02, #e0e0e0)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      color:           'var(--cds-text-secondary, #525252)',
      marginBottom:    '1.5rem',
    }}>
      {icon ?? defaultIcons.folder}
    </div>

    <h3 style={{
      fontSize:    '1.125rem',
      fontWeight:  600,
      color:       'var(--cds-text-primary, #161616)',
      margin:      '0 0 0.5rem',
    }}>
      {title}
    </h3>

    {description && (
      <p style={{
        fontSize:   '0.875rem',
        color:      'var(--cds-text-secondary, #525252)',
        maxWidth:   '360px',
        lineHeight: 1.5,
        margin:     '0 0 1.5rem',
      }}>
        {description}
      </p>
    )}

    {(action || secondaryAction) && (
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {action && (
          <Button
            kind={kindMap[action.variant ?? 'primary']}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button kind="ghost" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    )}
  </div>
);

export { defaultIcons };
