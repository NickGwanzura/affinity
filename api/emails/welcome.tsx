import React from 'react';
import { Button, Column, Row, Section, Text } from '@react-email/components';
import { Divider, EmailLayout } from './_layout.js';
import { brand, color, styles } from './_theme.js';

export interface WelcomeEmailProps {
  name: string;
  role: string;
  appUrl: string;
}

const feature = (title: string, detail: string) => (
  <Row style={{ marginBottom: '12px' }}>
    <Column style={{ verticalAlign: 'top', width: '24px', paddingRight: '12px' }}>
      <div
        style={{
          backgroundColor: color.primary,
          color: color.brandInkContrast,
          fontSize: '12px',
          fontWeight: 600,
          height: '18px',
          lineHeight: '18px',
          textAlign: 'center',
          width: '18px',
        }}
      >
        ✓
      </div>
    </Column>
    <Column>
      <Text style={{ ...styles.paragraph, margin: 0 }}>
        <strong style={{ color: color.textPrimary }}>{title}</strong>{' '}
        <span style={{ color: color.textSecondary }}>— {detail}</span>
      </Text>
    </Column>
  </Row>
);

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ name, role, appUrl }) => (
  <EmailLayout
    preview={`Welcome to ${brand.name}, ${name.split(' ')[0]} — here's how to get started.`}
  >
    <Text style={styles.h1}>Welcome aboard, {name.split(' ')[0]}.</Text>
    <Text style={styles.paragraph}>
      Your {brand.name} account is live. You're signed in as{' '}
      <strong style={{ color: color.textPrimary }}>{role}</strong>.
    </Text>

    <Section style={{ margin: '24px 0' }}>
      <Button href={appUrl} style={styles.button}>
        Open dashboard
      </Button>
    </Section>

    <Divider />

    <Text style={styles.h2}>What you can do next</Text>
    {feature('Review live shipments', 'Track vehicle movement in real time across borders.')}
    {feature('Manage clients and quotes', 'Create quotes, convert to invoices, issue receipts.')}
    {feature('Track landed cost', 'Match expenses against shipments to see true per-unit margin.')}
    {feature('Generate documents', 'Invoices, statements, and delivery notes export as polished PDFs.')}

    <Divider />

    <Text style={{ ...styles.small, margin: 0 }}>
      Need a hand getting oriented? Reply to this email and the team will jump in.
    </Text>
  </EmailLayout>
);

export default WelcomeEmail;
