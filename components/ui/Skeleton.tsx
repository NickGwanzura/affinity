import React from 'react';

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
  const baseClasses = 'animate-pulse bg-gray-200';
  const radius =
    variant === 'circular' ? 'rounded-full' :
    variant === 'rounded'  ? 'rounded' : 'rounded-none';

  return (
    <div
      className={`${baseClasses} ${radius} ${className}`}
      style={{ width, height: height ?? (variant === 'text' ? '1rem' : height) }}
    />
  );
};

// ── Pre-built layouts ─────────────────────────────────────────────────────────

export const SkeletonCard: React.FC = () => (
  <div className="p-6 bg-white border border-gray-200">
    <div className="flex justify-between items-start mb-4">
      <Skeleton width="55%" />
      <Skeleton variant="rectangular" width={40} height={40} />
    </div>
    <Skeleton width="40%" className="mb-2" />
    <Skeleton width="25%" />
  </div>
);

export const SkeletonTableRow: React.FC<{ cols?: number }> = ({ cols = 4 }) => (
  <div className="flex gap-4 py-3">
    {Array.from({ length: cols }).map((_, i) => (
      <div key={i} style={{ flex: i === 0 ? '0 0 40%' : 1 }}>
        <Skeleton />
      </div>
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div>
    <div className="flex gap-4 py-3 border-b border-gray-200">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{ flex: 1 }}>
          <Skeleton />
        </div>
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTableRow key={i} cols={cols} />
    ))}
  </div>
);

export const SkeletonStatCards: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonChart: React.FC = () => (
  <div className="p-6 bg-white border border-gray-200">
    <Skeleton width="40%" className="mb-6" />
    <Skeleton variant="rectangular" width="100%" height="16rem" />
  </div>
);
