/* global process */

import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import React from 'react';
import {
  getResendClient,
  getAppBaseUrl,
  getEmailFromAddress,
  isResendConfigured,
} from './_email-utils.js';

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
};

type InviteEmailArgs = {
  to: string;
  name: string;
  role: string;
  inviteToken: string;
  invitedBy?: string;
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
      })
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

export async function sendPasswordResetEmail({
  to,
  name,
  token,
}: PasswordResetEmailArgs): Promise<void> {
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

const InviteEmailTemplate: React.FC<InviteEmailArgs> = ({ name, role, inviteToken, invitedBy }) => (
  <div
    style={{
      fontFamily: 'IBM Plex Sans, Arial, sans-serif',
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
    }}
  >
    <h1 style={{ color: '#161616', fontSize: '24px', marginBottom: '16px' }}>You're Invited!</h1>
    <p style={{ color: '#525252', fontSize: '16px', marginBottom: '16px' }}>Hello {name},</p>
    <p style={{ color: '#525252', fontSize: '16px', marginBottom: '16px' }}>
      You've been invited to join <strong>Affinity Logistics</strong> as a <strong>{role}</strong>.
    </p>
    <p style={{ color: '#525252', fontSize: '16px', marginBottom: '16px' }}>
      {invitedBy ? `Invited by: ${invitedBy}` : 'Invited by: Administrator'}
    </p>
    <div style={{ margin: '24px 0' }}>
      <a
        href={`${getAppBaseUrl()}?type=invite&token=${inviteToken}`}
        style={{
          backgroundColor: '#0f62fe',
          color: '#ffffff',
          padding: '12px 24px',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: '600',
          borderRadius: '0',
          display: 'inline-block',
        }}
      >
        Accept Invitation
      </a>
    </div>
    <p style={{ color: '#525252', fontSize: '14px', marginBottom: '8px' }}>Or copy this link:</p>
    <p style={{ color: '#0f62fe', fontSize: '14px', wordBreak: 'break-all' }}>
      {getAppBaseUrl()}?type=invite&token={inviteToken}
    </p>
    <p style={{ color: '#a8a8a8', fontSize: '14px', marginTop: '24px' }}>
      This invitation expires in 7 days.
    </p>
    <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '24px 0' }} />
    <p style={{ color: '#a8a8a8', fontSize: '12px' }}>Affinity Logistics CRM</p>
  </div>
);

export async function sendInviteEmail({
  to,
  name,
  role,
  inviteToken,
  invitedBy,
}: InviteEmailArgs): Promise<void> {
  const fromAddress = getEmailFromAddress();

  if (isResendConfigured()) {
    const html = await render(
      React.createElement(InviteEmailTemplate, { name, role, inviteToken, invitedBy })
    );

    await getResendClient().emails.send({
      from: fromAddress,
      to,
      subject: `You're invited to join Affinity Logistics as ${role}`,
      html,
    });
    return;
  }

  const nodemailerConfig = getMailConfig();
  if (nodemailerConfig) {
    const transporter = await getTransporter();
    const inviteUrl = `${getAppBaseUrl()}?type=invite&token=${inviteToken}`;

    await transporter.sendMail({
      from: nodemailerConfig.from,
      to,
      subject: `You're invited to join Affinity Logistics as ${role}`,
      text: [
        `Hello ${name},`,
        '',
        `You've been invited to join Affinity Logistics as a ${role}.`,
        invitedBy ? `Invited by: ${invitedBy}` : 'Invited by: Administrator',
        '',
        `Accept your invitation: ${inviteUrl}`,
        '',
        'This invitation expires in 7 days.',
      ].join('\n'),
      html: await render(
        React.createElement(InviteEmailTemplate, { name, role, inviteToken, invitedBy })
      ),
    });
    return;
  }

  throw new Error('No email transport configured');
}
