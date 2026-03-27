import React from 'react';
import { Button as CarbonButton, InlineLoading } from '@carbon/react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'warning';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children?: React.ReactNode;
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  isLoading?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  renderIcon?: React.ComponentType<{ size?: number }>;
}

// Map our variant names → Carbon Button kinds
const kindMap: Record<ButtonVariant, 'primary' | 'secondary' | 'danger' | 'ghost' | 'tertiary'> = {
  primary:   'primary',
  secondary: 'primary',   // Use primary instead of secondary to avoid faded look
  danger:    'danger',
  success:   'primary',   // Carbon has no "success" kind; use primary (icon conveys success)
  ghost:     'ghost',
  warning:   'tertiary',  // Carbon has no "warning" kind; use tertiary
};

// Map our size names → Carbon Button sizes
const sizeMap: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant   = 'primary',
  size      = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  renderIcon,
  style,
  ...props
}) => {
  if (isLoading) {
    return (
      <CarbonButton
        kind={kindMap[variant]}
        size={sizeMap[size]}
        disabled
        style={{ ...(fullWidth ? { width: '100%', maxWidth: '100%' } : {}), ...style }}
        className={className}
      >
        <InlineLoading status="active" style={{ display: 'inline-flex', marginRight: '0.5rem' }} />
        {children}
      </CarbonButton>
    );
  }

  return (
    <CarbonButton
      kind={kindMap[variant]}
      size={sizeMap[size]}
      disabled={disabled}
      renderIcon={renderIcon as React.ComponentType | undefined}
      style={{ ...(fullWidth ? { width: '100%', maxWidth: '100%' } : {}), ...style }}
      className={className}
      {...(props as Record<string, unknown>)}
    >
      {leftIcon && <span style={{ marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center' }}>{leftIcon}</span>}
      {children}
      {rightIcon && <span style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center' }}>{rightIcon}</span>}
    </CarbonButton>
  );
};

// ── Icon button ─────────────────────────────────────────────────────────────
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon:       React.ReactNode;
  variant?:   ButtonVariant;
  size?:      'sm' | 'md' | 'lg';
  isLoading?: boolean;
  label?:     string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant   = 'ghost',
  size      = 'md',
  isLoading = false,
  label     = 'Action',
  className = '',
  disabled,
  ...props
}) => (
  <CarbonButton
    kind={kindMap[variant]}
    size={sizeMap[size]}
    hasIconOnly
    iconDescription={label}
    renderIcon={() => (isLoading ? (
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
    ))}
    disabled={isLoading || disabled}
    className={`min-w-[44px] min-h-[44px] ${className}`}
    {...(props as Record<string, unknown>)}
  />
);
