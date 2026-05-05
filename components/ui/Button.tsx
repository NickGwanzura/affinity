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

// Subtle 1px inner highlight at the top edge of solid buttons — gives
// a refined "lit from above" feel à la Stripe/Linear without becoming gaudy.
const SOLID_INNER_HIGHLIGHT =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.04)]';
const SOLID_INNER_HIGHLIGHT_HOVER =
  'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_-2px_rgba(0,0,0,0.10)]';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    `bg-[#D97706] text-white border border-transparent ${SOLID_INNER_HIGHLIGHT} ${SOLID_INNER_HIGHLIGHT_HOVER} ` +
    'hover:bg-[#B45309] active:bg-[#92400E]',
  secondary:
    `bg-zinc-800 text-white border border-transparent ${SOLID_INNER_HIGHLIGHT} ${SOLID_INNER_HIGHLIGHT_HOVER} ` +
    'hover:bg-zinc-700 active:bg-zinc-900',
  tertiary:
    'bg-white text-[#D97706] border border-[#D97706] shadow-[0_1px_2px_rgba(0,0,0,0.02)] ' +
    'hover:bg-[#fef3c7] hover:shadow-sm active:bg-[#fde68a]',
  danger:
    `bg-red-600 text-white border border-transparent ${SOLID_INNER_HIGHLIGHT} ${SOLID_INNER_HIGHLIGHT_HOVER} ` +
    'hover:bg-red-700 active:bg-red-800',
  'danger-tertiary':
    'bg-white text-red-600 border border-red-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ' +
    'hover:bg-red-50 hover:shadow-sm active:bg-red-100',
  success:
    `bg-emerald-600 text-white border border-transparent ${SOLID_INNER_HIGHLIGHT} ${SOLID_INNER_HIGHLIGHT_HOVER} ` +
    'hover:bg-emerald-700 active:bg-emerald-800',
  ghost:
    'bg-transparent text-[#D97706] border border-transparent ' +
    'hover:bg-stone-100 active:bg-stone-200',
  warning:
    `bg-amber-500 text-white border border-transparent ${SOLID_INNER_HIGHLIGHT} ${SOLID_INNER_HIGHLIGHT_HOVER} ` +
    'hover:bg-amber-600 active:bg-amber-700',
};

// `min-h-0` neutralises the global `button { min-height: 2.5rem }` rule
// in app.css so `sm` actually renders at 32px. Without this, every sm
// button gets silently bumped to 40px tall.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 min-h-0 px-3 text-[13px] leading-none',
  md: 'h-10 min-h-0 px-4 text-sm leading-none',
  lg: 'h-12 min-h-0 px-6 text-base leading-none',
};

const baseButton = [
  'relative inline-flex items-center justify-center gap-2 select-none overflow-hidden',
  'font-medium whitespace-nowrap',
  'rounded-md',
  'transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 ease-out',
  'focus:outline-none focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-white',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none',
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
    sm: 'h-8 w-8 min-h-0',
    md: 'h-10 w-10 min-h-0',
    lg: 'h-12 w-12 min-h-0',
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
