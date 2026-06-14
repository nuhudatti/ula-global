#!/usr/bin/env node
/**
 * CLI: verify SendGrid SMTP and optionally send a test email.
 *
 * Usage:
 *   node scripts/test-email.js --verify
 *   node scripts/test-email.js --send you@gmail.com
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const { verifySmtpConnection, sendTestEmail, getEmailStatus } = await import('../server/services/email.js');

const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify');
const sendIdx = args.indexOf('--send');
const recipient = sendIdx >= 0 ? args[sendIdx + 1] : null;

console.log('\nULA Email / SendGrid status:\n', JSON.stringify(getEmailStatus(), null, 2));

const verify = await verifySmtpConnection();
console.log('\nSMTP verify:\n', JSON.stringify(verify, null, 2));

if (!verify.ok) {
  console.error('\nSMTP verification failed. See SENDGRID_SETUP.md');
  process.exit(1);
}

if (verifyOnly && !recipient) {
  console.log('\nSMTP connection OK.');
  process.exit(0);
}

const to = recipient || process.env.EMAIL_TEST_TO;
if (!to) {
  console.log('\nAdd --send your@email.com or set EMAIL_TEST_TO in .env to send a test message.');
  process.exit(0);
}

const result = await sendTestEmail({ to, requestedBy: 'cli-test' });
console.log('\nTest send:\n', JSON.stringify(result, null, 2));
if (!result.sent) process.exit(1);
console.log(`\nCheck inbox (and spam) for: ${to}`);
