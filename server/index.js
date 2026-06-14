import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import resourceRoutes from './routes/resources.js';
import ratingRoutes from './routes/ratings.js';
import departmentRoutes from './routes/department.js';
import suggestionsRoutes from './routes/suggestions.js';
import facultyRoutes from './routes/faculty.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';
import discussionsRoutes from './routes/discussions.js';
import assignmentsRoutes from './routes/assignments.js';
import fileRoutes from './routes/fileRoutes.js';
import platformAuthRoutes from './routes/platformAuth.js';
import platformRoutes from './routes/platform.js';
import armRoutes from './routes/arm.js';
import { bootstrapTenants } from './services/tenantBootstrap.js';
import { optionalTenantMiddleware, resolveTenantMiddleware } from './middleware/tenant.js';
import {
  configureCloudinary,
  isCloudinaryConfigured,
} from './services/cloudinaryService.js';
import { scheduleBackupValidation, scheduleDailyBackup } from './services/backupService.js';
import { logEmailStartupStatus, warnIfProductionWithoutSmtp, getEmailStatus } from './services/email.js';
import { loadPlatformEmailSettings } from './services/platformEmailSettings.js';
import { validateProductionBoot } from './services/productionBoot.js';
import { validateJwtSecrets, getJwtSecurityStatus } from './services/jwtSecrets.js';
import { getUrlSecurityStatus, getClientOrigin } from './services/publicUrl.js';
import {
  configureTrustProxy,
  httpsRedirectMiddleware,
  securityHeadersMiddleware,
} from './middleware/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  validateProductionBoot();
} else {
  validateJwtSecrets();
}
warnIfProductionWithoutSmtp();

configureCloudinary();

if (isProd) {
  console.log('[ibbul-ula] File storage: Cloudinary CDN (ula_files/)');
} else if (isCloudinaryConfigured()) {
  console.log('[ibbul-ula] File storage: Cloudinary CDN (ula_files/)');
} else {
  console.warn(
    '[ibbul-ula] Cloudinary not configured — uploads will fail until CLOUDINARY_* env vars are set.',
  );
}

const app = express();
configureTrustProxy(app);

const clientOrigin = getClientOrigin();
const corsOrigins = clientOrigin.includes(',')
  ? clientOrigin.split(',').map((s) => s.trim())
  : clientOrigin;

app.use(httpsRedirectMiddleware);
app.use(securityHeadersMiddleware());
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

/** Legacy local uploads — disabled; all files live on Cloudinary. */
app.use('/uploads', (_req, res) => {
  res.status(410).json({
    error: 'Local file storage is disabled. Files are served from Cloudinary CDN.',
  });
});

app.get('/api/health', (req, res) => {
  const email = getEmailStatus();
  const https = getUrlSecurityStatus();
  res.json({
    ok: true,
    service: 'ibbul-ula',
    ts: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development',
    tls: {
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      forwardedProto: req.headers['x-forwarded-proto'] || null,
    },
    https,
    jwt: getJwtSecurityStatus(),
    storage: isCloudinaryConfigured() ? 'cloudinary' : 'unconfigured',
    folder: process.env.CLOUDINARY_FOLDER || 'ula_files',
    fileAccess: 'signed-authenticated',
    backupCron: process.env.BACKUP_CRON_ENABLED !== 'false',
    email: { mode: email.mode, provider: email.provider, configured: email.configured },
  });
});

app.use('/api/auth', optionalTenantMiddleware, authRoutes);
app.use('/api/meta', resolveTenantMiddleware, metaRoutes);
app.use('/api/resources', resolveTenantMiddleware, resourceRoutes);
app.use('/api/ratings', resolveTenantMiddleware, ratingRoutes);
app.use('/api/department', resolveTenantMiddleware, departmentRoutes);
app.use('/api/suggestions', resolveTenantMiddleware, suggestionsRoutes);
app.use('/api/faculty', resolveTenantMiddleware, facultyRoutes);
app.use('/api/settings', resolveTenantMiddleware, settingsRoutes);
app.use('/api/admin', resolveTenantMiddleware, adminRoutes);
app.use('/api/arm', resolveTenantMiddleware, armRoutes);
app.use('/api/discussions', resolveTenantMiddleware, discussionsRoutes);
app.use('/api/assignments', resolveTenantMiddleware, assignmentsRoutes);
app.use('/api/files', resolveTenantMiddleware, fileRoutes);
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform', platformRoutes);

const webDist = path.join(rootDir, 'web', 'dist');
const indexHtml = path.join(webDist, 'index.html');
const devWebOrigin = process.env.DEV_WEB_ORIGIN || 'http://localhost:5173';

if (isProd && fs.existsSync(indexHtml)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else if (!isProd) {
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    const target = `${devWebOrigin}${req.path === '/' ? '' : req.path}`;
    res.redirect(302, target);
  });
}

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || (isProd ? '127.0.0.1' : '0.0.0.0');
app.listen(PORT, HOST, async () => {
  try {
    await bootstrapTenants();
  } catch (e) {
    console.warn('[ibbul-ula] Tenant bootstrap:', e.message);
  }
  console.log(`[ibbul-ula] API listening on ${HOST}:${PORT}`);
  if (isProd) {
    console.log(`[ibbul-ula] HTTPS public URL: ${getUrlSecurityStatus().appPublicUrl}`);
  }
  if (isProd && fs.existsSync(indexHtml)) {
    console.log('[ibbul-ula] Serving SPA from web/dist');
  } else if (!isProd) {
    console.log(`[ibbul-ula] Dev UI → ${devWebOrigin} (API only on this port)`);
  }
  scheduleDailyBackup();
  scheduleBackupValidation();
  try {
    await loadPlatformEmailSettings();
  } catch (e) {
    console.warn('[ibbul-ula] Platform email settings load:', e.message);
  }
  await logEmailStartupStatus();
});
