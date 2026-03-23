import React from 'react';
import { Button } from '@carbon/react';

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

// Default SVG icons kept exactly as before (no change to API)
const defaultIcons = {
  folder: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  document: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  users: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  receipt: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  chart: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  truck: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  ),
  search: (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
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
