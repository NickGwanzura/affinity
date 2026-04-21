import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  renderIcon?: React.ComponentType<{ size?: number }>;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-black text-white hover:bg-gray-800 focus:ring-gray-500 border-0',
  secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  renderIcon: RenderIcon,
  style,
  ...props
}) => {
  const baseClasses = [
    'inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-md',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');

  return (
    <button className={baseClasses} disabled={disabled || isLoading} style={style} {...props}>
      {isLoading && <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />}
      {!isLoading && leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
      {!isLoading && RenderIcon && <RenderIcon size={size === 'sm' ? 14 : 16} />}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
    </button>
  );
};

// ── Icon button ─────────────────────────────────────────────────────────────
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  label?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  label = 'Action',
  className = '',
  disabled,
  ...props
}) => {
  const sizeMap = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
  const baseClasses = [
    'inline-flex items-center justify-center transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeMap[size],
    className,
  ].join(' ');

  return (
    <button
      className={baseClasses}
      disabled={isLoading || disabled}
      title={label}
      aria-label={label}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />
      ) : (
        <span className="inline-flex items-center">{icon}</span>
      )}
    </button>
  );
};
