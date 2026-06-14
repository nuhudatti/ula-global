import { Router } from 'express';
import { requirePlatformAuth, requirePlatformRole } from '../middleware/platformAuth.js';
import { backupRateLimit } from '../middleware/rateLimitMiddleware.js';
import {
  getBackups,
  getStatus,
  removeBackup,
  restoreBackup,
  runBackup,
  runRetention,
  validateBackup,
} from '../controllers/backupController.js';
import { getAnalyticsOverview, getInstitutionAnalytics } from '../services/platformAnalytics.js';
import { getPlatformOverview } from '../services/platformService.js';
import { listPlatformAudits, listPlatformAuditsPaginated } from '../services/platformAudit.js';
import { DASHBOARD_AUDIT_ACTIONS } from '../services/auditActions.js';
import {
  getTenantDetail,
  getTenantStats,
  listTenants,
  provisionInstitution,
  copyInstitutionAdminInvitationLink,
  resendInstitutionAdminInvitation,
  revokeInstitutionAdminInvitation,
  updateInstitutionStatus,
} from '../services/tenantService.js';
import {
  getEmailStatus,
  sendTestEmail,
  verifySmtpConnection,
} from '../services/email.js';
import {
  getPlatformEmailSettingsPublic,
  updatePlatformEmailSettings,
} from '../services/platformEmailSettings.js';

const router = Router();

router.use(requirePlatformAuth, requirePlatformRole('PLATFORM_SUPER_ADMIN'));

router.get('/overview', async (_req, res) => {
  try {
    res.json(await getPlatformOverview());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load platform overview' });
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const items = await listTenants({ status });
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list institutions' });
  }
});

router.get('/tenants/:id', async (req, res) => {
  try {
    res.json(await getTenantDetail(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to load institution' });
  }
});

router.post('/tenants', async (req, res) => {
  try {
    const result = await provisionInstitution(req.body, req.platformUser.id);
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Provision failed' });
  }
});

router.get('/tenants/:id/stats', async (req, res) => {
  try {
    res.json(await getTenantStats(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load institution stats' });
  }
});

router.post('/tenants/:id/resend-credentials', async (req, res) => {
  try {
    const result = await resendInstitutionAdminInvitation(req.params.id, req.platformUser.id);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Resend failed' });
  }
});

router.get('/tenants/:id/invitation/link', async (req, res) => {
  try {
    res.json(await copyInstitutionAdminInvitationLink(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to load invitation link' });
  }
});

router.post('/tenants/:id/invitation/resend', async (req, res) => {
  try {
    const result = await resendInstitutionAdminInvitation(req.params.id, req.platformUser.id);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Resend failed' });
  }
});

router.post('/tenants/:id/invitation/revoke', async (req, res) => {
  try {
    res.json(await revokeInstitutionAdminInvitation(req.params.id, req.platformUser.id));
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Revoke failed' });
  }
});

router.patch('/tenants/:id/status', async (req, res) => {
  try {
    const institution = await updateInstitutionStatus(req.params.id, req.body.status, req.platformUser.id);
    res.json(institution);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Status update failed' });
  }
});

router.get('/analytics/overview', async (_req, res) => {
  try {
    res.json(await getAnalyticsOverview());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load analytics overview' });
  }
});

router.get('/analytics/institutions', async (req, res) => {
  try {
    res.json(
      await getInstitutionAnalytics({
        page: Number(req.query.page) || 1,
        take: Number(req.query.take) || 20,
      }),
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load institution analytics' });
  }
});

router.get('/audit/actions', (_req, res) => {
  res.json({ items: DASHBOARD_AUDIT_ACTIONS });
});

router.get('/audit', async (req, res) => {
  try {
    if (req.query.page != null || req.query.action) {
      const result = await listPlatformAuditsPaginated({
        page: Number(req.query.page) || 1,
        take: Number(req.query.take) || 30,
        institutionId: req.query.institutionId || null,
        action: req.query.action || null,
      });
      return res.json(result);
    }

    const items = await listPlatformAudits({
      take: Number(req.query.take) || 50,
      institutionId: req.query.institutionId || null,
    });
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

const backupRouter = Router();
backupRouter.use(backupRateLimit);
backupRouter.get('/status', getStatus);
backupRouter.get('/', getBackups);
backupRouter.post('/run', runBackup);
backupRouter.post('/retention', runRetention);
backupRouter.post('/validate/:id', validateBackup);
backupRouter.post('/restore/:id', restoreBackup);
backupRouter.delete('/:id', removeBackup);

router.use('/backup', backupRouter);

/** Platform email configuration (centralized — not tied to user accounts). */
router.get('/email/settings', async (_req, res) => {
  try {
    res.json(await getPlatformEmailSettingsPublic());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load email settings' });
  }
});

router.patch('/email/settings', async (req, res) => {
  try {
    const updated = await updatePlatformEmailSettings(req.body, req.platformUser.id);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Failed to update email settings' });
  }
});

/** Email / SendGrid status and test (platform operators only). */
router.get('/email/status', async (_req, res) => {
  try {
    const status = getEmailStatus();
    const verify = status.configured ? await verifySmtpConnection() : { ok: false, mode: status.mode };
    res.json({ ...status, connection: verify });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to read email status' });
  }
});

router.post('/email/verify', async (_req, res) => {
  try {
    const result = await verifySmtpConnection();
    if (!result.ok) return res.status(502).json({ error: result.error || 'SMTP verification failed', ...result });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'SMTP verification failed' });
  }
});

router.post('/email/test', async (req, res) => {
  try {
    const to = String(req.body.to || req.platformUser?.email || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email (to) is required' });
    }
    const result = await sendTestEmail({
      to,
      requestedBy: req.platformUser?.email,
    });
    res.json({
      ok: result.sent,
      to,
      mode: result.mode,
      messageId: result.messageId,
      attempts: result.attempts,
      outboxFile: result.outboxFile,
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message || 'Test email failed' });
  }
});

export default router;
