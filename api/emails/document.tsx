import React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { Divider, EmailLayout } from './_layout.js';
import { brand, color, styles } from './_theme.js';

export type DocumentKind = 'invoice' | 'statement' | 'quote' | 'receipt' | 'delivery-note';

export interface DocumentEmailProps {
  kind: DocumentKind;
  /** Invoice #, Quote #, Receipt # as appropriate. */
  documentNumber?: string;
  clientName?: string;
  /** Pre-formatted amount string, e.g. "USD 1,234.56". Pass already formatted so the
   *  caller owns currency/locale rules. */
  amountFormatted?: string;
  /** Optional supplementary description / line summary. */
  description?: string;
  /** Optional URL for a "View online" CTA (deep link into the portal). */
  viewUrl?: string;
  /** Optional due date shown in the summary box. Already-formatted date string. */
  dueDateFormatted?: string;
  /** Validity note for quotes, e.g. "30 days". */
  validityNote?: string;
}

const KIND_META: Record<
  DocumentKind,
  { title: string; lede: (props: DocumentEmailProps) => string; cta: string }
> = {
  invoice: {
    title: 'Invoice',
    lede: ({ documentNumber }) =>
      `Please find invoice ${documentNumber ?? ''} attached. Payment details are below.`,
    cta: 'View invoice',
  },
  statement: {
    title: 'Statement of account',
    lede: () =>
      'Your current statement of account is attached. Let us know if any line item looks off.',
    cta: 'View statement',
  },
  quote: {
    title: 'Quote',
    lede: ({ documentNumber, validityNote }) =>
      `Quote ${documentNumber ?? ''} is attached${
        validityNote ? ` and is valid for ${validityNote}` : ''
      }.`,
    cta: 'View quote',
  },
  receipt: {
    title: 'Payment receipt',
    lede: ({ documentNumber }) =>
      `Thanks — we've received your payment. Receipt ${documentNumber ?? ''} is attached for your records.`,
    cta: 'View receipt',
  },
  'delivery-note': {
    title: 'Delivery note',
    lede: ({ documentNumber }) =>
      `Delivery note ${documentNumber ?? ''} is attached. Please confirm receipt on arrival.`,
    cta: 'View delivery note',
  },
};

export const DocumentEmail: React.FC<DocumentEmailProps> = (props) => {
  const {
    kind,
    documentNumber,
    clientName,
    amountFormatted,
    description,
    viewUrl,
    dueDateFormatted,
  } = props;
  const meta = KIND_META[kind];
  const heading = documentNumber ? `${meta.title} ${documentNumber}` : meta.title;
  const preview = `${meta.title}${documentNumber ? ` ${documentNumber}` : ''} from ${brand.name}${
    amountFormatted ? ` — ${amountFormatted}` : ''
  }`;

  return (
    <EmailLayout preview={preview}>
      <Text style={styles.h1}>{heading}</Text>
      <Text style={styles.paragraph}>
        Dear {clientName?.trim() || 'valued client'},
      </Text>
      <Text style={styles.paragraph}>{meta.lede(props)}</Text>

      {description ? <Text style={styles.paragraph}>{description}</Text> : null}

      {(amountFormatted || dueDateFormatted) ? (
        <Section style={styles.summaryBox}>
          {amountFormatted ? (
            <Text style={styles.summaryRow}>
              <strong style={{ color: color.textPrimary }}>Amount:</strong>{' '}
              <span style={{ fontSize: '17px', fontWeight: 600 }}>{amountFormatted}</span>
            </Text>
          ) : null}
          {dueDateFormatted ? (
            <Text style={styles.summaryRow}>
              <strong style={{ color: color.textPrimary }}>
                {kind === 'quote' ? 'Valid until' : 'Due'}:
              </strong>{' '}
              {dueDateFormatted}
            </Text>
          ) : null}
          {documentNumber ? (
            <Text style={styles.summaryRow}>
              <strong style={{ color: color.textPrimary }}>Reference:</strong>{' '}
              <code style={{ fontFamily: 'monospace' }}>{documentNumber}</code>
            </Text>
          ) : null}
        </Section>
      ) : null}

      {viewUrl ? (
        <Section style={{ margin: '24px 0' }}>
          <Button href={viewUrl} style={styles.button}>
            {meta.cta}
          </Button>
        </Section>
      ) : null}

      <Divider />

      <Text style={{ ...styles.small, margin: 0 }}>
        Questions about this {meta.title.toLowerCase()}? Reply to this email and
        we&apos;ll help sort it out.
      </Text>
    </EmailLayout>
  );
};

export default DocumentEmail;
