import React from 'react';
import { Button, Link, Section, Text } from '@react-email/components';
import { Divider, EmailLayout } from './_layout.js';
import { brand, color, styles } from './_theme.js';

export interface PasswordResetEmailProps {
  name?: string;
  resetUrl: string;
  expiresInMinutes?: number;
  requestIp?: string;
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  name,
  resetUrl,
  expiresInMinutes = 60,
  requestIp,
}) => {
  const greetingName = name?.trim() || 'there';
  return (
    <EmailLayout
      preview={`Reset your ${brand.name} password`}
      footerNote="For security, never share this link with anyone."
    >
      <Text style={styles.h1}>Reset your password</Text>
      <Text style={styles.paragraph}>Hi {greetingName},</Text>
      <Text style={styles.paragraph}>
        We received a request to reset the password for your {brand.name} account. Use
        the button below to choose a new one.
      </Text>

      <Section style={{ margin: '28px 0' }}>
        <Button href={resetUrl} style={styles.button}>
          Reset password
        </Button>
      </Section>

      <Text style={styles.small}>Or paste this link into your browser:</Text>
      <Text style={styles.codeBlock}>
        <Link href={resetUrl} style={{ color: color.primary, textDecoration: 'none' }}>
          {resetUrl}
        </Link>
      </Text>

      <Divider />

      <Text style={{ ...styles.small, margin: 0 }}>
        This link expires in {expiresInMinutes} minutes. If you didn&apos;t request a
        reset, you can safely ignore this email — your password will not change.
        {requestIp ? (
          <>
            {' '}Request origin: <code style={{ color: color.textPrimary }}>{requestIp}</code>.
          </>
        ) : null}
      </Text>
    </EmailLayout>
  );
};

export default PasswordResetEmail;
