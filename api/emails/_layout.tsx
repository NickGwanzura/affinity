import React from 'react';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { brand, color, styles } from './_theme.js';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  footerNote?: React.ReactNode;
}

// Branded shell wrapping every transactional email.
// - `preview` shows in the inbox snippet (e.g. Gmail's preview row) and is hidden in the body.
// - The footer carries brand name, address, and an unsubscribe/support hint.
export const EmailLayout: React.FC<EmailLayoutProps> = ({ preview, children, footerNote }) => (
  <Html>
    <Head>
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Section style={styles.header}>
          <Text style={styles.headerTitle}>{brand.name}</Text>
          <Text style={styles.headerTagline}>{brand.tagline}</Text>
        </Section>

        <Section style={styles.body_inner}>{children}</Section>

        <Section style={styles.footer}>
          {footerNote ? (
            <Text style={{ margin: '0 0 8px', color: color.textMuted, fontSize: '12px' }}>
              {footerNote}
            </Text>
          ) : null}
          <Text style={{ margin: 0, color: color.textMuted, fontSize: '12px' }}>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </Text>
          <Text style={{ margin: '4px 0 0', color: color.textMuted, fontSize: '12px' }}>
            Questions?{' '}
            <Link href={`mailto:${brand.supportEmail}`} style={styles.footerLink}>
              {brand.supportEmail}
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

// Small helper: a horizontal rule aligned with the layout's token system.
export const Divider: React.FC = () => <Hr style={styles.divider} />;
