import React from 'react';
import { Tile } from '@carbon/react';
import { SkeletonText, SkeletonPlaceholder } from '@carbon/react';

interface StatCardProps {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon?:     React.ReactNode;
  trend?: {
    value:      number;
    isPositive: boolean;
  };
  color?:     'blue' | 'green' | 'red' | 'amber' | 'purple' | 'zinc';
  isLoading?: boolean;
  className?: string;
}

// Carbon design-token colors mapped from the old palette
const accentMap: Record<string, { bg: string; text: string }> = {
  blue:   { bg: 'var(--cds-support-info-inverse,#4589ff)',    text: 'var(--cds-background,#fff)' },
  green:  { bg: 'var(--cds-support-success-inverse,#24a148)', text: 'var(--cds-background,#fff)' },
  red:    { bg: 'var(--cds-support-error-inverse,#da1e28)',   text: 'var(--cds-background,#fff)' },
  amber:  { bg: 'var(--cds-support-warning-inverse,#f1c21b)', text: 'var(--cds-text-primary,#161616)' },
  purple: { bg: '#8a3ffc',                                    text: '#fff' },
  zinc:   { bg: 'var(--cds-layer-02,#e0e0e0)',               text: 'var(--cds-text-primary,#161616)' },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color     = 'blue',
  isLoading = false,
  className = '',
}) => {
  const accent = accentMap[color] ?? accentMap.blue;

  if (isLoading) {
    return (
      <Tile className={className} style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{ width: '60%' }}><SkeletonText /></div>
          <div style={{ width: 40, height: 40 }}><SkeletonPlaceholder /></div>
        </div>
        <div style={{ width: '40%', marginBottom: '0.5rem' }}><SkeletonText heading /></div>
        <div style={{ width: '25%' }}><SkeletonText /></div>
      </Tile>
    );
  }

  return (
    <Tile
      className={className}
      style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0,
        width: 4,
        height: '100%',
        background: accent.bg,
      }} />

      <div style={{ paddingLeft: '0.5rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <p style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--cds-text-secondary, #525252)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            {title}
          </p>
          {icon && (
            <div style={{
              width: 40, height: 40,
              background: accent.bg,
              color: accent.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <p style={{
          fontSize: '2rem',
          fontWeight: 300,
          color: 'var(--cds-text-primary, #161616)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          margin: '0 0 0.5rem',
        }}>
          {value}
        </p>

        {/* Trend / subtitle */}
        {(trend || subtitle) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {trend && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: trend.isPositive
                  ? 'var(--cds-support-success, #24a148)'
                  : 'var(--cds-support-error, #da1e28)',
              }}>
                {trend.isPositive ? '↑' : '↓'}
                {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && (
              <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary, #525252)' }}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </Tile>
  );
};
