import React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { Divider, EmailLayout } from './_layout.js';
import { styles, color } from './_theme.js';

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

export interface NotificationEmailProps {
  /** Short subject-line-style heading shown at top. */
  title: string;
  /** Preheader / inbox preview snippet. */
  preview: string;
  /** Optional salutation name, e.g. "Jane". */
  recipientName?: string;
  /** Main body paragraph(s). Pass either a string or a ReactNode for rich content. */
  message: React.ReactNode;
  /** Optional list of key/value rows rendered in a highlight box. */
  summary?: Array<{ label: string; value: React.ReactNode }>;
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Visual treatment of the left accent bar. */
  tone?: NotificationTone;
  /** Extra small-print shown above the standard footer. */
  footerNote?: React.ReactNode;
}

const toneColor: Record<NotificationTone, string> = {
  info: color.primary,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
};

export const NotificationEmail: React.FC<NotificationEmailProps> = ({
  title,
  preview,
  recipientName,
  message,
  summary,
  cta,
  tone = 'info',
  footerNote,
}) => {
  const accent = toneColor[tone];
  return (
    <EmailLayout preview={preview} footerNote={footerNote}>
      <Text
        style={{
          ...styles.h1,
          borderLeft: `3px solid ${accent}`,
          paddingLeft: '12px',
        }}
      >
        {title}
      </Text>

      {recipientName ? (
        <Text style={styles.paragraph}>Hi {recipientName},</Text>
      ) : null}

      {typeof message === 'string' ? (
        <Text style={styles.paragraph}>{message}</Text>
      ) : (
        message
      )}

      {summary && summary.length > 0 ? (
        <Section style={{ ...styles.summaryBox, borderLeftColor: accent }}>
          {summary.map((row, idx) => (
            <Text key={idx} style={styles.summaryRow}>
              <strong style={{ color: color.textPrimary }}>{row.label}:</strong>{' '}
              {row.value}
            </Text>
          ))}
        </Section>
      ) : null}

      {cta ? (
        <Section style={{ margin: '24px 0' }}>
          <Button href={cta.url} style={styles.button}>
            {cta.label}
          </Button>
        </Section>
      ) : null}

      <Divider />

      <Text style={{ ...styles.small, margin: 0 }}>
        This is an automated notification. Replies go to our support team.
      </Text>
    </EmailLayout>
  );
};

export default NotificationEmail;
