import React from 'react';
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import {
  getAppBaseUrl,
  getEmailFromAddress,
  getResendClient,
  isResendConfigured,
} from './_email-utils.js';
import { InviteEmail, type InviteEmailProps } from './emails/invite.js';
import {
  PasswordResetEmail,
  type PasswordResetEmailProps,
} from './emails/password-reset.js';
import { WelcomeEmail, type WelcomeEmailProps } from './emails/welcome.js';
import {
  PasswordChangedEmail,
  type PasswordChangedEmailProps,
} from './emails/password-changed.js';
import {
  NotificationEmail,
  type NotificationEmailProps,
} from './emails/notification.js';
import { DocumentEmail, type DocumentEmailProps } from './emails/document.js';

// ── Transport configuration ─────────────────────────────────────────────
type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
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

export const isEmailTransportConfigured = (): boolean =>
  isResendConfigured() || getMailConfig() !== null;

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
        auth: { user: config.user, pass: config.pass },
      }),
    );
  }
  return transporterPromise;
};

// ── Delivery primitive ──────────────────────────────────────────────────
// Resolves Resend first, falls back to SMTP. Callers provide plain text for
// clients that strip HTML.
type DispatchArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

async function dispatch({ to, subject, html, text, replyTo }: DispatchArgs): Promise<void> {
  const fromAddress = getEmailFromAddress();

  if (isResendConfigured()) {
    const result = await getResendClient().emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });
    if ('error' in result && result.error) {
      throw new Error(`Resend error: ${result.error.message ?? 'unknown'}`);
    }
    return;
  }

  const config = getMailConfig();
  if (config) {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: config.from,
      to,
      replyTo: replyTo ?? config.replyTo,
      subject,
      text,
      html,
    });
    return;
  }

  throw new Error('No email transport configured');
}

// Render helper — React-email's render returns a string. Plain text is rendered
// separately for clients that prefer it.
const renderBoth = async (node: React.ReactElement) => {
  const [html, text] = await Promise.all([
    render(node),
    render(node, { plainText: true }),
  ]);
  return { html, text };
};

// ── URL builders ────────────────────────────────────────────────────────
const buildInviteUrl = (token: string): string => {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set('type', 'invite');
  url.searchParams.set('token', token);
  return url.toString();
};

const buildPasswordResetUrl = (token: string): string => {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set('type', 'recovery');
  url.searchParams.set('token', token);
  return url.toString();
};

// ── Public API: lifecycle emails ────────────────────────────────────────
export type SendInviteEmailArgs = {
  to: string;
  name: string;
  role: string;
  inviteToken: string;
  invitedBy?: string;
  expiresInDays?: number;
};

export async function sendInviteEmail(args: SendInviteEmailArgs): Promise<void> {
  const inviteUrl = buildInviteUrl(args.inviteToken);
  const props: InviteEmailProps = {
    name: args.name,
    role: args.role,
    inviteUrl,
    invitedBy: args.invitedBy,
    expiresInDays: args.expiresInDays,
  };
  const { html, text } = await renderBoth(React.createElement(InviteEmail, props));
  await dispatch({
    to: args.to,
    subject: `You're invited to join Affinity Logistics as ${args.role}`,
    html,
    text,
  });
}

export type SendPasswordResetEmailArgs = {
  to: string;
  name?: string;
  token: string;
  expiresInMinutes?: number;
  requestIp?: string;
};

export async function sendPasswordResetEmail(
  args: SendPasswordResetEmailArgs,
): Promise<void> {
  const resetUrl = buildPasswordResetUrl(args.token);
  const props: PasswordResetEmailProps = {
    name: args.name,
    resetUrl,
    expiresInMinutes: args.expiresInMinutes,
    requestIp: args.requestIp,
  };
  const { html, text } = await renderBoth(React.createElement(PasswordResetEmail, props));
  await dispatch({
    to: args.to,
    subject: 'Reset your Affinity Logistics password',
    html,
    text,
  });
}

export type SendWelcomeEmailArgs = {
  to: string;
  name: string;
  role: string;
};

export async function sendWelcomeEmail(args: SendWelcomeEmailArgs): Promise<void> {
  const props: WelcomeEmailProps = {
    name: args.name,
    role: args.role,
    appUrl: getAppBaseUrl(),
  };
  const { html, text } = await renderBoth(React.createElement(WelcomeEmail, props));
  await dispatch({
    to: args.to,
    subject: `Welcome to Affinity Logistics, ${args.name.split(' ')[0]}`,
    html,
    text,
  });
}

export type SendPasswordChangedEmailArgs = {
  to: string;
  name?: string;
  changedAt?: string;
  requestIp?: string;
  supportUrl?: string;
};

export async function sendPasswordChangedEmail(
  args: SendPasswordChangedEmailArgs,
): Promise<void> {
  const props: PasswordChangedEmailProps = {
    name: args.name,
    changedAt: args.changedAt ?? new Date().toISOString(),
    requestIp: args.requestIp,
    supportUrl: args.supportUrl,
  };
  const { html, text } = await renderBoth(
    React.createElement(PasswordChangedEmail, props),
  );
  await dispatch({
    to: args.to,
    subject: 'Your Affinity Logistics password was changed',
    html,
    text,
  });
}

// ── Public API: transactional documents ─────────────────────────────────
export type SendDocumentEmailArgs = {
  to: string;
  subject?: string;
} & DocumentEmailProps;

export async function sendDocumentEmail(args: SendDocumentEmailArgs): Promise<void> {
  const { to, subject, ...docProps } = args;
  const { html, text } = await renderBoth(React.createElement(DocumentEmail, docProps));
  const finalSubject =
    subject ??
    (docProps.documentNumber
      ? `${docProps.kind[0].toUpperCase() + docProps.kind.slice(1)} ${docProps.documentNumber} from Affinity Logistics`
      : `${docProps.kind[0].toUpperCase() + docProps.kind.slice(1)} from Affinity Logistics`);
  await dispatch({ to, subject: finalSubject, html, text });
}

// Back-compat: keep name-matching senders that invoices.ts / quotes.ts used before.
export const sendInvoiceEmail = (
  args: Omit<SendDocumentEmailArgs, 'kind'> & { kind?: 'invoice' | 'statement' | 'receipt' },
) => sendDocumentEmail({ kind: args.kind ?? 'invoice', ...args });

export const sendQuoteEmail = (
  args: Omit<SendDocumentEmailArgs, 'kind'>,
) => sendDocumentEmail({ kind: 'quote', ...args });

// ── Public API: generic branded notification ────────────────────────────
export type SendNotificationEmailArgs = {
  to: string;
  subject: string;
} & NotificationEmailProps;

export async function sendNotificationEmail(
  args: SendNotificationEmailArgs,
): Promise<void> {
  const { to, subject, ...props } = args;
  const { html, text } = await renderBoth(React.createElement(NotificationEmail, props));
  await dispatch({ to, subject, html, text });
}

// Re-export low-level helpers that callers depend on.
export { getAppBaseUrl, getEmailFromAddress, getResendClient, isResendConfigured };
