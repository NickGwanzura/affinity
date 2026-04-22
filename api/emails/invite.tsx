import React from 'react';
import { Button, Link, Section, Text } from '@react-email/components';
import { Divider, EmailLayout } from './_layout.js';
import { styles, color, brand } from './_theme.js';

export interface InviteEmailProps {
  name: string;
  role: string;
  inviteUrl: string;
  invitedBy?: string;
  expiresInDays?: number;
}

export const InviteEmail: React.FC<InviteEmailProps> = ({
  name,
  role,
  inviteUrl,
  invitedBy,
  expiresInDays = 7,
}) => (
  <EmailLayout
    preview={`Join ${brand.name} as ${role} — your invitation is waiting.`}
    footerNote="You received this email because someone invited you to collaborate."
  >
    <Text style={styles.h1}>You've been invited</Text>
    <Text style={styles.paragraph}>Hi {name},</Text>
    <Text style={styles.paragraph}>
      <strong style={{ color: color.textPrimary }}>
        {invitedBy || 'An administrator'}
      </strong>{' '}
      has invited you to join <strong>{brand.name}</strong> as a{' '}
      <strong>{role}</strong>. Accept the invite to set your password and get into the
      workspace.
    </Text>

    <Section style={{ margin: '28px 0' }}>
      <Button href={inviteUrl} style={styles.button}>
        Accept invitation
      </Button>
    </Section>

    <Text style={styles.small}>Or paste this link into your browser:</Text>
    <Text style={styles.codeBlock}>
      <Link href={inviteUrl} style={{ color: color.primary, textDecoration: 'none' }}>
        {inviteUrl}
      </Link>
    </Text>

    <Divider />

    <Text style={{ ...styles.small, margin: 0 }}>
      This invitation expires in {expiresInDays} days. If you weren't expecting this, you
      can safely ignore this email — no account will be created until you accept.
    </Text>
  </EmailLayout>
);

export default InviteEmail;
