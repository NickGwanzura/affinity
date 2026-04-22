import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger'
  | 'danger-tertiary'
  | 'success'
  | 'warning';
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

// Carbon-inspired, square-cornered button palette.
// Each variant defines idle / hover / active states for background + text + border.
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#0f62fe] text-white border border-transparent ' +
    'hover:bg-[#0353e9] active:bg-[#002d9c]',
  secondary:
    'bg-[#393939] text-white border border-transparent ' +
    'hover:bg-[#4c4c4c] active:bg-[#6f6f6f]',
  tertiary:
    'bg-transparent text-[#0f62fe] border border-[#0f62fe] ' +
    'hover:bg-[#0f62fe] hover:text-white active:bg-[#002d9c] active:border-[#002d9c]',
  danger:
    'bg-[#da1e28] text-white border border-transparent ' +
    'hover:bg-[#b81921] active:bg-[#750e13]',
  'danger-tertiary':
    'bg-transparent text-[#da1e28] border border-[#da1e28] ' +
    'hover:bg-[#da1e28] hover:text-white active:bg-[#750e13] active:border-[#750e13]',
  success:
    'bg-[#198038] text-white border border-transparent ' +
    'hover:bg-[#0e6027] active:bg-[#044317]',
  ghost:
    'bg-transparent text-[#0f62fe] border border-transparent ' +
    'hover:bg-gray-100 active:bg-gray-200',
  warning:
    'bg-[#f1c21b] text-gray-900 border border-transparent ' +
    'hover:bg-[#ddab06] active:bg-[#b28600]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] leading-none',
  md: 'h-10 px-4 text-sm leading-none',
  lg: 'h-12 px-6 text-base leading-none',
};

const baseButton = [
  'relative inline-flex items-center justify-center gap-2 select-none',
  'font-medium tracking-[0.01em] whitespace-nowrap',
  'rounded-none',
  'transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-[cubic-bezier(0.2,0,0.38,0.9)]',
  'focus:outline-none focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0f62fe] focus-visible:ring-offset-white',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none',
  'active:translate-y-0',
].join(' ');

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
  const classes = [
    baseButton,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    isLoading ? 'cursor-wait' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      style={style}
      {...props}
    >
      {isLoading && (
        <Loader2 className="animate-spin shrink-0" size={iconSize} aria-hidden="true" />
      )}
      {!isLoading && leftIcon && (
        <span className="inline-flex items-center shrink-0" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      {!isLoading && RenderIcon && <RenderIcon size={iconSize} />}
      {children}
      {!isLoading && rightIcon && (
        <span className="inline-flex items-center shrink-0" aria-hidden="true">
          {rightIcon}
        </span>
      )}
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
  const sizeMap: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  const classes = [
    baseButton,
    variantClasses[variant],
    sizeMap[size],
    'p-0',
    className,
  ].join(' ');

  return (
    <button
      className={classes}
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
      title={label}
      aria-label={label}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={iconSize} aria-hidden="true" />
      ) : (
        <span className="inline-flex items-center justify-center">{icon}</span>
      )}
    </button>
  );
};
