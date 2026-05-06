import { Resend } from 'resend';

let cachedClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!cachedClient) {
    cachedClient = new Resend(process.env.RESEND_API_KEY || '');
  }
  return cachedClient;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getAppBaseUrl(): string {
  const explicitBaseUrl = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/, '');
  return 'http://localhost:5173';
}

export function getEmailFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS || 'noreply@affinitylogistics.site';
}
