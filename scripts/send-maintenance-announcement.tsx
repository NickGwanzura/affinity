/**
 * One-off broadcast: notify all Active users that platform updates are in progress.
 *
 * Usage:
 *   tsx scripts/send-maintenance-announcement.tsx           # send
 *   tsx scripts/send-maintenance-announcement.tsx --dry-run # preview recipients, don't send
 *
 * Requires NEON_DATABASE_URL, RESEND_API_KEY (or SMTP_*), APP_BASE_URL in .env.
 */

import 'dotenv/config';
import React from 'react';
import { Text } from '@react-email/components';
import { sendNotificationEmail, getAppBaseUrl } from '../api/_email.js';
import { sql } from '../api/_db.js';
import { styles, color } from '../api/emails/_theme.js';

type UserRow = { email: string; name: string };

const firstName = (full: string | null | undefined): string => {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] ?? 'there';
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const appUrl = getAppBaseUrl();

  const users = (await sql`
    SELECT email, name
    FROM public.user_profiles
    WHERE status = 'Active' AND email IS NOT NULL AND email <> ''
    ORDER BY name
  `) as UserRow[];

  console.log(`Recipients: ${users.length}`);
  users.forEach((u) => console.log(`  - ${u.name} <${u.email}>`));

  if (dryRun) {
    console.log('\n(dry run — not sending)');
    return;
  }

  const subject = 'Affinity Logistics — platform updates in progress';
  const preview = "We're rolling out improvements to your Affinity Logistics workspace.";
  const title = 'Updates in progress';

  let ok = 0;
  let fail = 0;

  for (const u of users) {
    const message = (
      <>
        <Text style={styles.paragraph}>
          We&apos;re currently rolling out a set of improvements to the Affinity Logistics
          platform. You may notice brief visual changes or short interruptions while the
          new versions finish deploying.
        </Text>
        <Text style={styles.paragraph}>
          All of your data — clients, quotes, invoices, payments, vehicles, shipments, and
          documents — is preserved. There&apos;s nothing you need to do on your end.
        </Text>
        <Text style={{ ...styles.paragraph, color: color.textMuted, fontSize: '13px' }}>
          Here&apos;s what&apos;s changing:
        </Text>
      </>
    );

    try {
      await sendNotificationEmail({
        to: u.email,
        subject,
        title,
        preview,
        recipientName: firstName(u.name),
        tone: 'info',
        message,
        summary: [
          {
            label: 'Client directory',
            value: 'Refreshed layout with vehicle linking and client shipments',
          },
          {
            label: 'Financials',
            value: 'Faster page loads and a cleaner quotes / invoices / payments view',
          },
          {
            label: 'Notifications',
            value: 'New branded email experience (this message is a preview)',
          },
          {
            label: 'Accounts',
            value: 'Improved sign-in security and password-change alerts',
          },
        ],
        cta: { label: 'Open Affinity Logistics', url: appUrl },
        footerNote:
          'If anything looks unexpected, reply to this email or reach out to support@affinitylogistics.site. Thanks for your patience.',
      });
      ok += 1;
      console.log(`  ✓ sent to ${u.email}`);
    } catch (err) {
      fail += 1;
      console.error(`  ✗ failed ${u.email}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. ${ok} sent, ${fail} failed.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Broadcast failed:', err);
    process.exit(1);
  },
);
