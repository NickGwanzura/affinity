import React from 'react';
import { SkeletonText, SkeletonPlaceholder } from '@carbon/react';

// ── Base Skeleton ─────────────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  variant?:   'text' | 'circular' | 'rectangular' | 'rounded';
  width?:     string | number;
  height?:    string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant   = 'text',
  width,
  height,
}) => {
  const wrapStyle: React.CSSProperties = { width, height };

  if (variant === 'text') {
    return (
      <div className={className} style={wrapStyle}>
        <SkeletonText />
      </div>
    );
  }

  const radius =
    variant === 'circular' ? '50%' :
    variant === 'rounded'  ? '4px' : '0';

  return (
    <div className={className} style={{ ...wrapStyle, borderRadius: radius, overflow: 'hidden' }}>
      <SkeletonPlaceholder />
    </div>
  );
};

// ── Pre-built layouts ─────────────────────────────────────────────────────────

export const SkeletonCard: React.FC = () => (
  <div style={{ padding: '1.5rem', background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div style={{ width: '55%' }}><SkeletonText /></div>
      <div style={{ width: 40, height: 40 }}><SkeletonPlaceholder /></div>
    </div>
    <div style={{ width: '40%', marginBottom: '0.5rem' }}><SkeletonText heading /></div>
    <div style={{ width: '25%' }}><SkeletonText /></div>
  </div>
);

export const SkeletonTableRow: React.FC<{ cols?: number }> = ({ cols = 4 }) => (
  <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0' }}>
    {Array.from({ length: cols }).map((_, i) => (
      <div key={i} style={{ flex: i === 0 ? '0 0 40%' : 1 }}>
        <SkeletonText />
      </div>
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div>
    <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{ flex: 1 }}><SkeletonText /></div>
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTableRow key={i} cols={cols} />
    ))}
  </div>
);

export const SkeletonStatCards: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonChart: React.FC = () => (
  <div style={{ padding: '1.5rem', background: 'var(--cds-layer-01, #fff)', border: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
    <div style={{ width: '40%', marginBottom: '1.5rem' }}><SkeletonText heading /></div>
    <div style={{ width: '100%', height: '16rem' }}><SkeletonPlaceholder /></div>
  </div>
);
