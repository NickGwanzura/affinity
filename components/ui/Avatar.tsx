import React from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarTone = 'brand' | 'sidebar';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const toneClasses: Record<AvatarTone, string> = {
  brand: 'bg-[#D97706] text-white',
  sidebar: 'bg-[#44403C] text-white',
};

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  tone = 'brand',
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`flex items-center justify-center rounded-full font-semibold shrink-0 ${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
  >
    {initialsOf(name)}
  </div>
);

export default Avatar;
