import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const baseStyles = 'animate-pulse bg-zinc-200';
  
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl',
  };

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton layouts
export const SkeletonCard: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl border border-zinc-200">
    <div className="flex justify-between items-start mb-4">
      <Skeleton width="6rem" height="0.875rem" />
      <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
    </div>
    <Skeleton width="8rem" height="2rem" className="mb-2" />
    <Skeleton width="4rem" height="0.75rem" />
  </div>
);

export const SkeletonTableRow: React.FC<{ cols?: number }> = ({ cols = 4 }) => (
  <div className="flex gap-4 py-3">
    {Array.from({ length: cols }).map((_, i) => (
      <Skeleton
        key={i}
        className="flex-1"
        height="1rem"
        width={i === 0 ? '40%' : '100%'}
      />
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="space-y-2">
    {/* Header */}
    <div className="flex gap-4 py-3 border-b border-zinc-200">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1"
          height="0.875rem"
          width="100%"
        />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTableRow key={i} cols={cols} />
    ))}
  </div>
);

export const SkeletonStatCards: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonChart: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl border border-zinc-200">
    <Skeleton width="12rem" height="1.25rem" className="mb-6" />
    <Skeleton variant="rounded" className="w-full" height="16rem" />
  </div>
);
