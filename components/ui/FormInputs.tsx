import React from 'react';
import { Eye, EyeOff, Loader2, Check, AlertCircle, ChevronDown } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Shared tokens
   ──────────────────────────────────────────────────────────────────────── */
const labelCls = 'block text-xs font-medium text-gray-700 mb-1.5 tracking-[0.02em]';
const helperCls = 'mt-1.5 text-xs text-gray-500 leading-snug';
const errorCls = 'mt-1.5 flex items-start gap-1 text-xs text-[#da1e28] leading-snug';

// Carbon-style input: #f4f4f4 fill, top/side 1px #c6c6c6, bottom 1px #8d8d8d,
// focus ring in Carbon Blue (#0f62fe), invalid red (#da1e28).
const baseInput =
  'block w-full bg-[#f4f4f4] text-gray-900 text-sm placeholder-gray-400 ' +
  'border border-[#c6c6c6] border-b-[#8d8d8d] rounded-none ' +
  'px-3 py-2 min-h-[2.5rem] shadow-none appearance-none ' +
  'transition-[background-color,border-color,outline-color] duration-150 ease-[cubic-bezier(0.2,0,0.38,0.9)] ' +
  'hover:bg-[#e8e8e8] ' +
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0f62fe] ' +
  'disabled:bg-[#f4f4f4] disabled:text-gray-400 disabled:border-[#e0e0e0] disabled:border-b-[#c6c6c6] disabled:cursor-not-allowed';

const invalidCls =
  'border-[#da1e28] border-b-[#da1e28] focus-visible:outline-[#da1e28]';

/* ── Field wrapper ─────────────────────────────────────────────────────── */
interface FieldProps {
  id: string;
  labelText: string;
  hideLabel?: boolean;
  helperText?: string;
  invalid?: boolean;
  invalidText?: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({
  id,
  labelText,
  hideLabel,
  helperText,
  invalid,
  invalidText,
  children,
}) => (
  <div className="w-full">
    <label htmlFor={id} className={hideLabel ? 'sr-only' : labelCls}>
      {labelText}
    </label>
    {children}
    {invalid && invalidText ? (
      <p className={errorCls} role="alert">
        <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{invalidText}</span>
      </p>
    ) : helperText ? (
      <p className={helperCls}>{helperText}</p>
    ) : null}
  </div>
);

/* ── TextInput ─────────────────────────────────────────────────────────── */
export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  id: string;
  labelText: string;
  hideLabel?: boolean;
  helperText?: string;
  invalid?: boolean;
  invalidText?: string;
}
export const TextInput: React.FC<TextInputProps> = ({
  id,
  labelText,
  hideLabel,
  helperText,
  invalid,
  invalidText,
  className = '',
  ...props
}) => (
  <Field
    id={id}
    labelText={labelText}
    hideLabel={hideLabel}
    helperText={helperText}
    invalid={invalid}
    invalidText={invalidText}
  >
    <input
      id={id}
      aria-invalid={invalid || undefined}
      className={`${baseInput} ${invalid ? invalidCls : ''} ${className}`}
      {...props}
    />
  </Field>
);

/* ── PasswordInput ─────────────────────────────────────────────────────── */
export const PasswordInput: React.FC<TextInputProps> = (props) => {
  const [show, setShow] = React.useState(false);
  const {
    id,
    labelText,
    hideLabel,
    helperText,
    invalid,
    invalidText,
    className = '',
    ...rest
  } = props;
  return (
    <Field
      id={id}
      labelText={labelText}
      hideLabel={hideLabel}
      helperText={helperText}
      invalid={invalid}
      invalidText={invalidText}
    >
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          className={`${baseInput} pr-11 ${invalid ? invalidCls : ''} ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center text-gray-500 transition-colors duration-150 hover:text-gray-900 hover:bg-gray-200/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f62fe]"
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  );
};

/* ── TextArea ──────────────────────────────────────────────────────────── */
export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  labelText: string;
  hideLabel?: boolean;
  helperText?: string;
  invalid?: boolean;
  invalidText?: string;
}
export const TextArea: React.FC<TextAreaProps> = ({
  id,
  labelText,
  hideLabel,
  helperText,
  invalid,
  invalidText,
  rows = 4,
  className = '',
  ...props
}) => (
  <Field
    id={id}
    labelText={labelText}
    hideLabel={hideLabel}
    helperText={helperText}
    invalid={invalid}
    invalidText={invalidText}
  >
    <textarea
      id={id}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`${baseInput} min-h-[6rem] resize-y leading-relaxed ${invalid ? invalidCls : ''} ${className}`}
      {...props}
    />
  </Field>
);

/* ── NumberInput ───────────────────────────────────────────────────────── */
export interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'size' | 'onChange' | 'value'
  > {
  id: string;
  labelText: string;
  hideLabel?: boolean;
  helperText?: string;
  invalid?: boolean;
  invalidText?: string;
  value?: number | string;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (
    event: React.ChangeEvent<HTMLInputElement>,
    payload: { value: number | string },
  ) => void;
}
export const NumberInput: React.FC<NumberInputProps> = ({
  id,
  labelText,
  hideLabel,
  helperText,
  invalid,
  invalidText,
  value,
  min,
  max,
  step,
  onChange,
  className = '',
  ...props
}) => (
  <Field
    id={id}
    labelText={labelText}
    hideLabel={hideLabel}
    helperText={helperText}
    invalid={invalid}
    invalidText={invalidText}
  >
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      aria-invalid={invalid || undefined}
      onChange={(e) =>
        onChange?.(e, { value: e.target.value === '' ? '' : Number(e.target.value) })
      }
      className={`${baseInput} tabular-nums ${invalid ? invalidCls : ''} ${className}`}
      {...props}
    />
  </Field>
);

/* ── Select ────────────────────────────────────────────────────────────── */
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  id: string;
  labelText: string;
  hideLabel?: boolean;
  helperText?: string;
  invalid?: boolean;
  invalidText?: string;
  children: React.ReactNode;
}
export const Select: React.FC<SelectProps> = ({
  id,
  labelText,
  hideLabel,
  helperText,
  invalid,
  invalidText,
  className = '',
  children,
  ...props
}) => (
  <Field
    id={id}
    labelText={labelText}
    hideLabel={hideLabel}
    helperText={helperText}
    invalid={invalid}
    invalidText={invalidText}
  >
    <div className="relative">
      <select
        id={id}
        aria-invalid={invalid || undefined}
        className={`${baseInput} pr-9 cursor-pointer ${invalid ? invalidCls : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
      />
    </div>
  </Field>
);

export interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  value: string | number;
  text: string;
}
export const SelectItem: React.FC<SelectItemProps> = ({ value, text, ...rest }) => (
  <option value={value} {...rest}>
    {text}
  </option>
);

/* ── Checkbox ──────────────────────────────────────────────────────────── */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  labelText: string;
  helperText?: string;
}
export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  labelText,
  helperText,
  className = '',
  disabled,
  ...props
}) => (
  <div className={`flex items-start gap-2.5 ${disabled ? 'opacity-60' : ''}`}>
    <span className="relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center mt-0.5">
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        className={`peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-none border border-gray-500 bg-white transition-colors duration-150 checked:border-[#0f62fe] checked:bg-[#0f62fe] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] disabled:cursor-not-allowed disabled:border-gray-300 ${className}`}
        {...props}
      />
      <Check
        size={12}
        strokeWidth={3}
        aria-hidden="true"
        className="pointer-events-none hidden text-white peer-checked:block"
      />
    </span>
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={`text-sm text-gray-800 select-none ${disabled ? '' : 'cursor-pointer'}`}
      >
        {labelText}
      </label>
      {helperText && <p className="mt-0.5 text-xs text-gray-500 leading-snug">{helperText}</p>}
    </div>
  </div>
);

/* ── InlineLoading / Loading ───────────────────────────────────────────── */
interface InlineLoadingProps {
  description?: string;
  status?: 'active' | 'finished' | 'error' | 'inactive';
  className?: string;
}
export const InlineLoading: React.FC<InlineLoadingProps> = ({
  description,
  status = 'active',
  className = '',
}) => (
  <div
    className={`inline-flex items-center gap-2 text-sm text-gray-600 ${className}`}
    role="status"
    aria-live="polite"
  >
    {status === 'active' && <Loader2 className="animate-spin text-[#0f62fe]" size={16} />}
    {status === 'finished' && <Check className="text-[#198038]" size={16} />}
    {status === 'error' && <AlertCircle className="text-[#da1e28]" size={16} />}
    {description && <span>{description}</span>}
  </div>
);

interface LoadingProps {
  description?: string;
  withOverlay?: boolean;
}
export const Loading: React.FC<LoadingProps> = ({
  description = 'Loading…',
  withOverlay = true,
}) => (
  <div
    className={
      withOverlay
        ? 'fixed inset-0 z-[9500] flex items-center justify-center bg-black/30 backdrop-blur-sm'
        : 'flex items-center justify-center p-8'
    }
    role="status"
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="animate-spin text-[#0f62fe]" size={32} />
      <span className="text-sm text-gray-700">{description}</span>
    </div>
  </div>
);

/* ── InlineNotification ────────────────────────────────────────────────── */
interface InlineNotificationProps {
  kind: 'error' | 'success' | 'info' | 'warning';
  title: string;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  hideCloseButton?: boolean;
  className?: string;
}
const kindStyles: Record<InlineNotificationProps['kind'], string> = {
  error: 'bg-red-50 border-l-[3px] border-[#da1e28] text-red-900',
  success: 'bg-green-50 border-l-[3px] border-[#198038] text-green-900',
  info: 'bg-blue-50 border-l-[3px] border-[#0f62fe] text-blue-900',
  warning: 'bg-amber-50 border-l-[3px] border-[#f1c21b] text-amber-900',
};
export const InlineNotification: React.FC<InlineNotificationProps> = ({
  kind,
  title,
  subtitle,
  onClose,
  hideCloseButton = false,
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 border border-transparent p-3 text-sm ${kindStyles[kind]} ${className}`}
    role={kind === 'error' || kind === 'warning' ? 'alert' : 'status'}
  >
    <span className="font-semibold shrink-0">{title}</span>
    {subtitle && <span className="flex-1 leading-snug">{subtitle}</span>}
    {onClose && !hideCloseButton && (
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 inline-flex h-6 w-6 items-center justify-center opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f62fe]"
        aria-label="Dismiss"
      >
        ×
      </button>
    )}
  </div>
);

/* ── Stack / Tile / Tag ────────────────────────────────────────────────── */
interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: number; // Carbon gap: 1-10 (≈ 0.25rem per step)
  orientation?: 'vertical' | 'horizontal';
}
// Carbon spacing tokens: 1→2px, 2→4px, 3→8px, 4→12px, 5→16px, 6→24px, 7→32px, 8→40px, 9→48px, 10→64px
const stackGapPx: Record<number, number> = {
  0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64,
};
export const Stack: React.FC<StackProps> = ({
  gap = 4,
  orientation = 'vertical',
  className = '',
  style,
  children,
  ...props
}) => {
  const px = stackGapPx[gap] ?? 12;
  return (
    <div
      className={`flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row'} ${className}`}
      style={{ gap: px, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};

interface TileProps extends React.HTMLAttributes<HTMLDivElement> {
  light?: boolean;
}
export const Tile: React.FC<TileProps> = ({ light, className = '', children, ...props }) => (
  <div
    className={`border border-gray-200 ${light ? 'bg-gray-50' : 'bg-white'} p-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

type TagColor =
  | 'red' | 'magenta' | 'purple' | 'blue' | 'cyan' | 'teal' | 'green'
  | 'gray' | 'cool-gray' | 'warm-gray' | 'high-contrast' | 'outline';

interface TagProps {
  type?: TagColor;
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}
const tagTypeCls: Record<TagColor, string> = {
  red:             'bg-red-100 text-red-800',
  magenta:         'bg-pink-100 text-pink-800',
  purple:          'bg-purple-100 text-purple-800',
  blue:            'bg-blue-100 text-blue-800',
  cyan:            'bg-cyan-100 text-cyan-800',
  teal:            'bg-teal-100 text-teal-800',
  green:           'bg-green-100 text-green-800',
  gray:            'bg-gray-100 text-gray-800',
  'cool-gray':     'bg-slate-100 text-slate-800',
  'warm-gray':     'bg-stone-100 text-stone-800',
  'high-contrast': 'bg-gray-900 text-white',
  outline:         'border border-gray-400 text-gray-700',
};
export const Tag: React.FC<TagProps> = ({
  type = 'gray', size = 'md', children, className = '', onClick,
}) => {
  const sz = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs';
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      className={`inline-flex items-center font-medium ${sz} ${tagTypeCls[type]} ${className}`}
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      {children}
    </Comp>
  );
};

/* ── Grid / Column (minimal) ───────────────────────────────────────────── */
export const Grid: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { condensed?: boolean; fullWidth?: boolean }
> = ({ className = '', condensed, fullWidth, children, ...props }) => (
  <div
    className={`grid grid-cols-12 ${condensed ? 'gap-0' : 'gap-4'} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const Column: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    sm?: number; md?: number; lg?: number; xlg?: number; max?: number;
    span?: number;
  }
> = ({ className = '', sm, md, lg, xlg, max, span, style, children, ...props }) => {
  void xlg; void max; void md; void sm;
  const lgSpan = lg ?? span ?? 12;
  return (
    <div
      className={className}
      style={{ gridColumn: `span ${lgSpan} / span ${lgSpan}`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
