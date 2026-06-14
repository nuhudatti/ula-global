/** Platform audit action codes — safe for display (no PII in labels). */
export const AUDIT_ACTIONS = {
  INSTITUTION_CREATED: 'Institution created',
  INSTITUTION_SUSPENDED: 'Institution suspended',
  INSTITUTION_REACTIVATED: 'Institution activated',
  INSTITUTION_ARCHIVED: 'Institution archived',
  INSTITUTION_ADMIN_ASSIGNED: 'Institution admin invited',
  INSTITUTION_ADMIN_INVITE_RESENT: 'Institution admin invitation resent',
  INSTITUTION_ADMIN_INVITE_REVOKED: 'Institution admin invitation revoked',
  INSTITUTION_ADMIN_CREDENTIALS_RESENT: 'Institution admin credentials resent',
  INSTITUTION_ADMIN_LOGIN: 'Institution admin login',
  RESOURCE_UPLOADED: 'Resource uploaded',
  RESULT_UPLOADED: 'Result uploaded',
  RESOURCE_DOWNLOAD: 'Resource downloaded',
  RESULT_DOWNLOAD: 'Result downloaded',
  BULK_IMPORT_PERFORMED: 'Bulk import performed',
  BACKUP_CREATED: 'Backup created',
  BACKUP_COMPLETED: 'Backup created',
  BACKUP_FAILED: 'Backup failed',
  BACKUP_RESTORED: 'Backup restored',
  RESTORE_COMPLETED: 'Backup restored',
  RESTORE_FAILED: 'Backup restore failed',
  RESTORE_VALIDATION_PASSED: 'Backup validation passed',
  RESTORE_VALIDATION_FAILED: 'Backup validation failed',
  RETENTION_RUN: 'Backup retention run',
  FAILED_LOGIN: 'Failed login attempt',
  FIRST_SUPER_ADMIN_CREATED: 'First super admin created',
  PLATFORM_OPERATOR_LOGIN: 'Platform operator login',
  PLATFORM_FAILED_LOGIN: 'Platform failed login',
};

export const DASHBOARD_AUDIT_ACTIONS = [
  'INSTITUTION_CREATED',
  'INSTITUTION_SUSPENDED',
  'INSTITUTION_REACTIVATED',
  'INSTITUTION_ADMIN_ASSIGNED',
  'INSTITUTION_ADMIN_LOGIN',
  'RESOURCE_UPLOADED',
  'RESULT_UPLOADED',
  'BULK_IMPORT_PERFORMED',
  'BACKUP_CREATED',
  'BACKUP_COMPLETED',
  'RESTORE_COMPLETED',
  'BACKUP_RESTORED',
  'RESTORE_COMPLETED',
  'BACKUP_FAILED',
  'RESTORE_FAILED',
  'FAILED_LOGIN',
  'FIRST_SUPER_ADMIN_CREATED',
  'PLATFORM_OPERATOR_LOGIN',
  'PLATFORM_FAILED_LOGIN',
  'RESOURCE_DOWNLOAD',
  'RESULT_DOWNLOAD',
];

export function labelAuditAction(action) {
  return AUDIT_ACTIONS[action] || action.replace(/_/g, ' ').toLowerCase();
}

/** Strip anything that looks like an email from audit detail before API response. */
export function sanitizeAuditDetail(detail) {
  if (!detail) return null;
  const text = String(detail);
  if (text.includes('@')) {
    const parts = text.split(':');
    return parts[0] || '—';
  }
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
