import React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { Divider, EmailLayout } from './_layout.js';
import { brand, color, styles } from './_theme.js';

export interface PasswordChangedEmailProps {
  name?: string;
  /** ISO timestamp; formatted on render. */
  changedAt: string;
  requestIp?: string;
  /** Where the user can report "this wasn't me". */
  supportUrl?: string;
}

const formatTimestamp = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
};

export const PasswordChangedEmail: React.FC<PasswordChangedEmailProps> = ({
  name,
  changedAt,
  requestIp,
  supportUrl,
}) => {
  const greetingName = name?.trim() || 'there';
  return (
    <EmailLayout
      preview={`Your ${brand.name} password was changed`}
      footerNote="This is a security notification. We always send it when a password changes."
    >
      <Text style={styles.h1}>Password updated</Text>
      <Text style={styles.paragraph}>Hi {greetingName},</Text>
      <Text style={styles.paragraph}>
        The password for your {brand.name} account was changed successfully.
      </Text>

      <Section style={styles.summaryBox}>
        <Text style={styles.summaryRow}>
          <strong style={{ color: color.textPrimary }}>When:</strong>{' '}
          {formatTimestamp(changedAt)} (UTC)
        </Text>
        {requestIp ? (
          <Text style={styles.summaryRow}>
            <strong style={{ color: color.textPrimary }}>Origin IP:</strong>{' '}
            <code style={{ fontFamily: 'monospace' }}>{requestIp}</code>
          </Text>
        ) : null}
      </Section>

      <Text style={styles.paragraph}>
        If this was you, no further action is needed — sign in with your new password as
        usual.
      </Text>

      <Divider />

      <Text style={styles.h2}>Didn't change your password?</Text>
      <Text style={styles.paragraph}>
        Your account may be compromised. Please secure it immediately by resetting your
        password and reviewing recent activity.
      </Text>

      {supportUrl ? (
        <Section style={{ margin: '20px 0' }}>
          <Button href={supportUrl} style={{ ...styles.button, backgroundColor: color.danger }}>
            Secure my account
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  );
};

export default PasswordChangedEmail;
