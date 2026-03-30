import React from 'react';
import { Tile } from '@carbon/react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  footer?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'neutral';
  className?: string;
}

const accentMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'var(--cds-support-info-inverse,#0f62fe)', text: 'var(--cds-text-on-color,#ffffff)' },
  green: { bg: 'var(--cds-support-success-inverse,#24a148)', text: 'var(--cds-text-on-color,#ffffff)' },
  red: { bg: 'var(--cds-support-error-inverse,#da1e28)', text: 'var(--cds-text-on-color,#ffffff)' },
  amber: { bg: 'var(--cds-support-warning-inverse,#f1c21b)', text: 'var(--cds-text-primary,#161616)' },
  purple: { bg: '#8a3ffc', text: '#ffffff' },
  neutral: { bg: 'var(--cds-layer-02,#e0e0e0)', text: 'var(--cds-text-primary,#161616)' },
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  footer,
  color = 'blue',
  className = '',
}) => {
  const accent = accentMap[color] ?? accentMap.blue;

  return (
    <Tile className={className} style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: accent.bg,
        }}
      />
      <div style={{ padding: '1.5rem', paddingLeft: 'calc(1.5rem + 4px)' }}>
        {/* Header */}
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--cds-text-secondary, #525252)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            margin: '0 0 0.75rem',
          }}
        >
          {title}
        </p>

        {/* Value */}
        <p
          style={{
            fontSize: '2rem',
            fontWeight: 300,
            color: 'var(--cds-text-primary, #161616)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
            margin: '0 0 0.5rem',
          }}
        >
          {value}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--cds-text-secondary, #525252)',
              margin: '0 0 0.75rem',
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Footer content */}
        {footer && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--cds-border-subtle, #e0e0e0)' }}>
            {footer}
          </div>
        )}
      </div>
    </Tile>
  );
};

export default DashboardCard;
