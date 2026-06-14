export {
  getAppPublicUrl,
  getPublicBaseUrl,
  getClientOrigin,
  enforceHttps,
} from './config.js';

export {
  getEmailConfig,
  isSmtpConfigured,
  shouldUseDevOutbox,
  warnIfProductionWithoutSmtp,
} from './config.js';

export { verifySmtpConnection, getTransportStatus, deliverEmail } from './transport.js';

export {
  sendEmail,
  sendInviteEmail,
  sendLecturerInvitationEmail,
  sendInstitutionAdminWelcomeEmail,
  sendInstitutionActivationEmail,
  sendWelcomeCredentialsEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  sendTestEmail,
} from './flows.js';

import { isSmtpConfigured, getEmailConfig } from './config.js';
import { getTransportStatus, verifySmtpConnection } from './transport.js';
import { emailLog } from './logger.js';

/** Log email mode at API startup. */
export async function logEmailStartupStatus() {
  const status = getTransportStatus();
  if (status.configured) {
    emailLog.info('email_startup', status);
    const verify = await verifySmtpConnection();
    if (!verify.ok) {
      emailLog.warn('email_startup_verify_failed', { error: verify.error });
    }
  } else if (process.env.NODE_ENV !== 'production') {
    emailLog.info('email_startup', { ...status, note: 'Dev mode — emails go to data/email-outbox/' });
  }
}

export function getEmailStatus() {
  return getTransportStatus();
}
