import React from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarTone = 'brand' | 'sidebar';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
  /** When true, shows an inset ring that brightens on group-hover for interactive contexts. */
  interactive?: boolean;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const toneClasses: Record<AvatarTone, string> = {
  brand: 'bg-gradient-to-br from-[#E8881A] to-[#B45309] text-white shadow-sm ring-1 ring-black/[0.04]',
  sidebar: 'bg-gradient-to-br from-[#52504D] to-[#3a3936] text-white shadow-sm ring-1 ring-white/[0.06]',
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
  interactive = false,
}) => (
  <div
    aria-hidden="true"
    className={`flex items-center justify-center rounded-full font-semibold shrink-0 transition-shadow duration-150 ${sizeClasses[size]} ${toneClasses[tone]} ${interactive ? 'group-hover:shadow-md group-hover:ring-[#D97706]/40' : ''} ${className}`}
  >
    {initialsOf(name)}
  </div>
);

export default Avatar;
