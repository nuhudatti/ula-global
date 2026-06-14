import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { loginRateLimit } from '../middleware/rateLimitMiddleware.js';
import { requirePlatformAuth } from '../middleware/platformAuth.js';
import {
  requestPlatformPasswordReset,
  validatePlatformResetToken,
  resetPlatformPasswordWithToken,
} from '../services/authLifecycle.js';
import { getPlatformJwtSecret, isPlatformJwtConfigured } from '../services/jwtSecrets.js';
import { validateStrongPassword } from '../services/passwordPolicy.js';
import {
  createFirstPlatformSuperAdmin,
  getPlatformSetupStatus,
  isPlatformSetupRequired,
} from '../services/platformSetup.js';
import { logPlatformAudit } from '../services/platformAudit.js';

const prisma = new PrismaClient();
const router = Router();

function signPlatformToken(operator) {
  return jwt.sign(
    {
      sub: operator.id,
      role: operator.role,
      email: operator.email,
      scope: 'platform',
    },
    getPlatformJwtSecret(),
    { expiresIn: '8h' },
  );
}

/** Public — tells UI whether first-run setup is required. */
router.get('/setup/status', async (_req, res) => {
  try {
    res.json(await getPlatformSetupStatus());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not read setup status' });
  }
});

/** Public — one-time first super admin creation (locked after first operator exists). */
router.post('/setup', loginRateLimit, async (req, res) => {
  try {
    if (!isPlatformJwtConfigured()) {
      return res.status(503).json({ error: 'Platform JWT secret not configured' });
    }

    if (!(await isPlatformSetupRequired())) {
      return res.status(403).json({
        error: 'Platform setup already completed',
        redirect: '/platform/login',
      });
    }

    const operator = await createFirstPlatformSuperAdmin({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
    });

    const token = signPlatformToken(operator);
    res.status(201).json({
      ok: true,
      message: 'Platform super admin created. Setup is now permanently locked.',
      token,
      operator,
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Setup failed' });
  }
});

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    if (!isPlatformJwtConfigured()) {
      return res.status(503).json({ error: 'Platform JWT secret not configured' });
    }

    if (await isPlatformSetupRequired()) {
      return res.status(403).json({
        error: 'Platform setup required before sign-in',
        setupRequired: true,
        redirect: '/platform/setup',
      });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const operator = await prisma.platformOperator.findUnique({ where: { email } });
    if (!operator || operator.accountStatus !== 'ACTIVE') {
      await logPlatformAudit({
        action: 'PLATFORM_FAILED_LOGIN',
        actorId: null,
        detail: 'Invalid credentials',
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, operator.passwordHash);
    if (!ok) {
      await logPlatformAudit({
        action: 'PLATFORM_FAILED_LOGIN',
        actorId: operator.id,
        detail: 'Invalid password',
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.platformOperator.update({
      where: { id: operator.id },
      data: { lastActiveAt: new Date() },
    });

    await logPlatformAudit({
      action: 'PLATFORM_OPERATOR_LOGIN',
      actorId: operator.id,
      detail: 'Platform operator signed in',
    }).catch(() => {});

    const token = signPlatformToken(operator);
    res.json({
      token,
      operator: {
        id: operator.id,
        email: operator.email,
        fullName: operator.fullName,
        role: operator.role,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Platform login failed' });
  }
});

router.post('/forgot-password', loginRateLimit, async (req, res) => {
  try {
    if (await isPlatformSetupRequired()) {
      return res.status(403).json({ error: 'Complete platform setup first', setupRequired: true });
    }

    const email = String(req.body.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email is required' });

    const result = await requestPlatformPasswordReset(email);
    const body = {
      ok: true,
      message: 'If a platform operator account exists for this email, we sent password reset instructions.',
    };
    if (process.env.NODE_ENV !== 'production') {
      if (result.devResetUrl) body.devResetUrl = result.devResetUrl;
      if (result.outboxFile) body.devOutboxFile = result.outboxFile;
      if (result.found === false) body.devHint = 'No platform operator matched this email.';
      else if (result.emailSent === false) {
        body.devHint = result.emailError || 'Email delivery failed — use the dev reset link below if shown.';
      }
    }
    res.json(body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not process request' });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  try {
    const row = await validatePlatformResetToken(req.params.token);
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });
    res.json({ email: row.operator.email, fullName: row.operator.fullName, expiresAt: row.expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to validate reset link' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }

    const policy = validateStrongPassword(password, { label: 'Password' });
    if (!policy.valid) {
      return res.status(400).json({ error: policy.errors.join('. ') });
    }

    const profile = await resetPlatformPasswordWithToken(token, password);
    const operator = await prisma.platformOperator.findUnique({
      where: { id: profile.operatorId },
      select: { id: true, email: true, fullName: true, role: true },
    });

    res.json({
      ok: true,
      message: 'Password updated. You can sign in now.',
      token: signPlatformToken(operator),
      operator,
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || 'Could not reset password' });
  }
});

router.get('/me', requirePlatformAuth, async (req, res) => {
  const operator = await prisma.platformOperator.findUnique({
    where: { id: req.platformUser.id },
    select: { id: true, email: true, fullName: true, role: true, accountStatus: true },
  });
  if (!operator) return res.status(404).json({ error: 'Operator not found' });
  res.json(operator);
});

export default router;
