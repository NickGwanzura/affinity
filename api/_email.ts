/* global process */

import nodemailer from 'nodemailer';

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
};

type PasswordResetEmailArgs = {
  to: string;
  name?: string;
  token: string;
};

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

const getMailConfig = (): MailConfig | null => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from || Number.isNaN(port)) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    user,
    pass,
    from,
    replyTo: process.env.SMTP_REPLY_TO || undefined,
  };
};

export const isEmailTransportConfigured = (): boolean => getMailConfig() !== null;

const getAppBaseUrl = (): string => {
  const explicitBaseUrl = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:5173';
};

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (!transporterPromise) {
    const config = getMailConfig();
    if (!config) {
      throw new Error('SMTP transport is not configured');
    }

    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      }),
    );
  }

  return transporterPromise;
};

const buildPasswordResetUrl = (token: string): string => {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set('type', 'recovery');
  url.searchParams.set('token', token);
  return url.toString();
};

export async function sendPasswordResetEmail({ to, name, token }: PasswordResetEmailArgs): Promise<void> {
  const config = getMailConfig();
  if (!config) {
    throw new Error('SMTP transport is not configured');
  }

  const transporter = await getTransporter();
  const resetUrl = buildPasswordResetUrl(token);
  const greetingName = name?.trim() || 'there';

  await transporter.sendMail({
    from: config.from,
    to,
    replyTo: config.replyTo,
    subject: 'Reset your Affinity Logistics password',
    text: [
      `Hello ${greetingName},`,
      '',
      'We received a request to reset your Affinity Logistics password.',
      `Reset your password using this link: ${resetUrl}`,
      '',
      'If you did not request this change, you can ignore this email.',
      'This link expires in 1 hour.',
    ].join('\n'),
    html: `
      <p>Hello ${greetingName},</p>
      <p>We received a request to reset your Affinity Logistics password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>If you did not request this change, you can ignore this email.</p>
      <p>This link expires in 1 hour.</p>
    `,
  });
}
