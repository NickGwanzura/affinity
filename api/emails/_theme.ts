// Shared design tokens for all email templates.
// Keep these aligned with the Carbon-leaning in-app theme (see styles/app.css and
// components/ui/Button.tsx) so marketing/transactional mail feels continuous with the product.

export const brand = {
  name: 'Affinity Logistics',
  tagline: 'Cross-border vehicle logistics · SADC region',
  supportEmail: 'support@affinitylogistics.site',
  // Absolute URL is resolved at render time via getAppBaseUrl(), so don't hardcode here.
};

export const color = {
  // Text
  textPrimary: '#161616',
  textSecondary: '#525252',
  textMuted: '#6f6f6f',
  textDisabled: '#a8a8a8',

  // Surfaces
  surface: '#ffffff',
  surfaceSubtle: '#f4f4f4',
  surfaceMuted: '#f2f4f8',

  // Borders
  border: '#e0e0e0',
  borderStrong: '#c6c6c6',

  // Status
  primary: '#0f62fe',
  primaryHover: '#0353e9',
  danger: '#da1e28',
  success: '#198038',
  warning: '#f1c21b',

  // Brand
  brandInk: '#000000',
  brandInkContrast: '#ffffff',
};

export const font = {
  sans: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
  mono: "'IBM Plex Mono', 'Menlo', monospace",
};

export const radius = {
  none: '0px',
  sm: '2px',
  md: '4px',
};

export const shadow = {
  sm: '0 1px 2px rgba(15, 15, 15, 0.06)',
};

// Reusable inline style chunks — emails must be inline-styled for broad client support.
export const styles = {
  body: {
    backgroundColor: color.surfaceSubtle,
    fontFamily: font.sans,
    margin: 0,
    padding: '24px 0',
    color: color.textPrimary,
  } as const,
  container: {
    backgroundColor: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    margin: '0 auto',
    maxWidth: '600px',
    padding: '0',
    width: '100%',
  } as const,
  header: {
    backgroundColor: color.brandInk,
    color: color.brandInkContrast,
    padding: '24px 32px',
  } as const,
  headerTitle: {
    color: color.brandInkContrast,
    fontSize: '16px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    margin: 0,
    textTransform: 'uppercase' as const,
  },
  headerTagline: {
    color: '#8d8d8d',
    fontSize: '11px',
    letterSpacing: '0.1em',
    margin: '6px 0 0',
    textTransform: 'uppercase' as const,
  },
  body_inner: {
    padding: '32px',
  } as const,
  h1: {
    color: color.textPrimary,
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: '1.25',
    letterSpacing: '-0.01em',
    margin: '0 0 16px',
  } as const,
  h2: {
    color: color.textPrimary,
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: '1.3',
    margin: '24px 0 12px',
  } as const,
  paragraph: {
    color: color.textSecondary,
    fontSize: '15px',
    lineHeight: '1.55',
    margin: '0 0 16px',
  } as const,
  small: {
    color: color.textMuted,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0 0 12px',
  } as const,
  button: {
    backgroundColor: color.primary,
    borderRadius: radius.none,
    color: color.brandInkContrast,
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    padding: '12px 22px',
    textDecoration: 'none',
  } as const,
  buttonSecondary: {
    backgroundColor: color.surface,
    border: `1px solid ${color.borderStrong}`,
    borderRadius: radius.none,
    color: color.textPrimary,
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    padding: '11px 22px',
    textDecoration: 'none',
  } as const,
  divider: {
    border: 'none',
    borderTop: `1px solid ${color.border}`,
    margin: '24px 0',
  } as const,
  codeBlock: {
    backgroundColor: color.surfaceMuted,
    border: `1px solid ${color.border}`,
    borderLeft: `3px solid ${color.primary}`,
    color: color.textPrimary,
    fontFamily: font.mono,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0 0 16px',
    padding: '12px 16px',
    wordBreak: 'break-all' as const,
  },
  summaryBox: {
    backgroundColor: color.surfaceSubtle,
    borderLeft: `3px solid ${color.primary}`,
    margin: '16px 0 24px',
    padding: '16px 20px',
  } as const,
  summaryRow: {
    color: color.textPrimary,
    fontSize: '14px',
    lineHeight: '1.7',
    margin: 0,
  } as const,
  footer: {
    backgroundColor: color.surfaceSubtle,
    borderTop: `1px solid ${color.border}`,
    color: color.textMuted,
    fontSize: '12px',
    lineHeight: '1.55',
    padding: '20px 32px',
    textAlign: 'center' as const,
  } as const,
  footerLink: {
    color: color.textMuted,
    textDecoration: 'underline',
  } as const,
  preheader: {
    // Hidden preview text — visible only in inbox previews.
    color: 'transparent',
    display: 'none',
    fontSize: '1px',
    height: '1px',
    lineHeight: '1px',
    maxHeight: '1px',
    maxWidth: '1px',
    opacity: 0,
    overflow: 'hidden',
    visibility: 'hidden' as const,
  },
};
