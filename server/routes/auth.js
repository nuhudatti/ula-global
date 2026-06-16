import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { hashSecret } from '../services/authCrypto.js';
import {
  requestPasswordReset,
  validateResetToken,
  resetPasswordWithToken,
} from '../services/authLifecycle.js';
import {
  acceptLecturerInvitation,
  previewLecturerInvitation,
} from '../services/lecturerInvites.js';
import {
  acceptFacultyAdminInvite,
  previewFacultyAdminInvite,
} from '../services/facultyAdminInvites.js';
import { normalizeStoredMediaUrl, absolutizePublicMediaUrl } from '../services/mediaUrls.js';
import { getPublicBaseUrl } from '../services/publicUrl.js';
import { loginRateLimit } from '../middleware/rateLimitMiddleware.js';
import { normalizeSlug, resolveTenantBySlug } from '../services/tenantService.js';
import { userEmailWhere } from '../services/tenantScope.js';
import { getInstitutionJwtSecret, isInstitutionJwtConfigured } from '../services/jwtSecrets.js';
import { logPlatformAudit } from '../services/platformAudit.js';

const prisma = new PrismaClient();
const router = Router();
const isDev = process.env.NODE_ENV !== 'production';

function authConfigError(res) {
  return res.status(503).json({
    error:
      'Server authentication is not configured. Set JWT_SECRET in your .env file, then restart the API (npm run dev).',
  });
}

function signToken(user) {
  if (!isInstitutionJwtConfigured()) {
    const err = new Error('JWT_SECRET_NOT_CONFIGURED');
    err.code = 'JWT_SECRET_NOT_CONFIGURED';
    throw err;
  }
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      institutionId: user.institutionId,
      scope: 'institution',
    },
    getInstitutionJwtSecret(),
    { expiresIn: '7d' },
  );
}

function loginErrorMessage(err) {
  if (err?.code === 'JWT_SECRET_NOT_CONFIGURED') {
    return 'Server authentication is not configured. Set JWT_SECRET in .env and restart the API.';
  }
  if (typeof err?.code === 'string' && err.code.startsWith('P')) {
    return 'Database schema is out of date. From the project root run: npm run db:push && npm run db:generate, then restart npm run dev.';
  }
  if (isDev && err?.message) return `Login failed: ${err.message}`;
  return 'Login failed';
}

async function resolveLoginTenant(req) {
  const slug = normalizeSlug(req.headers['x-institution-slug'] || req.body.institutionSlug || '');
  if (!slug) return null;
  return resolveTenantBySlug(slug);
}

const userPublicSelect = {
  id: true,
  institutionId: true,
  institution: { select: { slug: true, name: true, shortName: true } },
  email: true,
  fullName: true,
  matricNumber: true,
  role: true,
  facultyId: true,
  bio: true,
  profilePhotoUrl: true,
  bannerUrl: true,
  mustChangePassword: true,
  accountStatus: true,
  department: {
    select: {
      id: true,
      name: true,
      faculty: { select: { id: true, name: true, code: true } },
    },
  },
  faculty: { select: { id: true, name: true, code: true } },
};

function mapPublicUser(row) {
  if (!row) return row;
  const base = getPublicBaseUrl();
  return {
    ...row,
    profilePhotoUrl: absolutizePublicMediaUrl(row.profilePhotoUrl, base) || normalizeStoredMediaUrl(row.profilePhotoUrl),
    bannerUrl: absolutizePublicMediaUrl(row.bannerUrl, base) || normalizeStoredMediaUrl(row.bannerUrl),
  };
}

async function loadPublicUser(userId) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  });
  return mapPublicUser(row);
}

function loginBlockedMessage(user) {
  if (user.accountStatus === 'SUSPENDED') return 'Account suspended. Contact your administrator.';
  if (user.accountStatus === 'PENDING') {
    return 'Account pending activation. Check your email for the invitation link.';
  }
  return null;
}

function passwordStrengthError(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

function normalizeMatric(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Public registration — students only (invites for staff). Real academic identity required. */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, departmentId, matricNumber } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'email, password, and fullName are required' });
    }
    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId is required — select your department' });
    }

    const matric = normalizeMatric(matricNumber);
    if (!matric || matric.length < 4 || matric.length > 30) {
      return res.status(400).json({ error: 'A valid matric number is required' });
    }
    if (!/^[A-Z0-9/_-]+$/.test(matric)) {
      return res.status(400).json({ error: 'Matric number can only contain letters, numbers, / and -' });
    }

    const weak = passwordStrengthError(password);
    if (weak) return res.status(400).json({ error: weak });

    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      include: { faculty: { select: { institutionId: true } } },
    });
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    const institutionId = dept.faculty.institutionId;
    const emailNorm = email.trim().toLowerCase();

    const exists = await prisma.user.findUnique({
      where: { institutionId_email: { institutionId, email: emailNorm } },
    });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const matricTaken = await prisma.user.findUnique({
      where: { institutionId_matricNumber: { institutionId, matricNumber: matric } },
    });
    if (matricTaken) return res.status(409).json({ error: 'This matric number is already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        institutionId,
        email: emailNorm,
        passwordHash,
        fullName: fullName.trim(),
        matricNumber: matric,
        role: 'STUDENT',
        departmentId: dept.id,
        accountStatus: 'ACTIVE',
        passwordChangedAt: new Date(),
      },
    });

    const profile = await loadPublicUser(user.id);
    const token = signToken(profile);
    res.status(201).json({ token, user: profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    if (!isInstitutionJwtConfigured()) return authConfigError(res);

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email/matric number and password required' });
    }

    const tenant = await resolveLoginTenant(req);
    if (!tenant) {
      const slug = normalizeSlug(req.headers['x-institution-slug'] || req.body.institutionSlug || '');
      return res.status(slug ? 404 : 400).json({
        error: slug
          ? 'Institution not found'
          : 'Institution context required. Open your university sign-in page (e.g. /ibbul/login).',
      });
    }
    if (tenant.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'This institution is temporarily suspended' });
    }

    // One field, two identities: email address or student matric number.
    const identifier = String(email).trim();
    const user = identifier.includes('@')
      ? await prisma.user.findUnique({
          where: {
            institutionId_email: { institutionId: tenant.id, email: identifier.toLowerCase() },
          },
        })
      : await prisma.user.findUnique({
          where: {
            institutionId_matricNumber: {
              institutionId: tenant.id,
              matricNumber: normalizeMatric(identifier),
            },
          },
        });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await logPlatformAudit({
        action: 'FAILED_LOGIN',
        actorType: 'user',
        institutionId: tenant.id,
        detail: tenant.slug,
      });
      return res.status(401).json({ error: 'Invalid email/matric number or password' });
    }

    const blocked = loginBlockedMessage(user);
    if (blocked) return res.status(403).json({ error: blocked });

    const profile = await loadPublicUser(user.id);
    if (!profile) return res.status(500).json({ error: 'Login failed' });

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      });
    } catch (activityErr) {
      console.warn('[auth] lastActiveAt update skipped:', activityErr.message);
    }

    if (user.role === 'INSTITUTION_ADMIN') {
      await logPlatformAudit({
        action: 'INSTITUTION_ADMIN_LOGIN',
        actorId: user.id,
        actorType: 'user',
        institutionId: tenant.id,
        detail: tenant.slug,
      });
    }

    res.json({
      token: signToken(profile),
      user: profile,
      mustChangePassword: profile.mustChangePassword === true,
    });
  } catch (e) {
    console.error('[auth] login error:', e);
    if (e?.code === 'JWT_SECRET_NOT_CONFIGURED') return authConfigError(res);
    res.status(500).json({ error: loginErrorMessage(e) });
  }
});

function invitationPreviewError(status) {
  if (status === 'ACCEPTED') return 'This invitation has already been accepted';
  if (status === 'CANCELLED' || status === 'REVOKED') return 'This invitation was cancelled';
  return 'This invitation has expired';
}

async function loadInvitationPreview(token) {
  const facultyPreview = await previewFacultyAdminInvite(token);
  if (facultyPreview) {
    if (facultyPreview.invalid) {
      return { error: invitationPreviewError(facultyPreview.status), status: facultyPreview.status };
    }
    return facultyPreview;
  }

  const lecturerPreview = await previewLecturerInvitation(token);
  if (!lecturerPreview) return { error: 'Invalid invitation link' };
  if (lecturerPreview.invalid) {
    return { error: invitationPreviewError(lecturerPreview.status), status: lecturerPreview.status };
  }
  return lecturerPreview;
}

/** Preview invite before activation (public, legacy path). */
router.get('/invite/:token', async (req, res) => {
  try {
    const preview = await loadInvitationPreview(req.params.token);
    if (preview.error) return res.status(400).json({ error: preview.error, status: preview.status });
    res.json(preview);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load invitation' });
  }
});

/** Preview staff invitation — faculty admin, HOD, or lecturer (link-only). */
router.get('/invitation/:token', async (req, res) => {
  try {
    const preview = await loadInvitationPreview(req.params.token);
    if (preview.error) return res.status(400).json({ error: preview.error, status: preview.status });
    res.json(preview);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load invitation' });
  }
});

async function acceptInvitationHandler(req, res) {
  try {
    const { token, password, firstName, lastName } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const facultyInvite = await prisma.facultyAdminInvite.findUnique({ where: { token } });
    if (facultyInvite) {
      const user = await acceptFacultyAdminInvite({ token, password, firstName, lastName });
      const profile = await loadPublicUser(user.id);
      if (!profile) return res.status(500).json({ error: 'Failed to load new account' });
      return res.status(201).json({ token: signToken(profile), user: profile });
    }

    const userId = await acceptLecturerInvitation({ token, password, firstName, lastName });
    const profile = await loadPublicUser(userId);
    if (!profile) return res.status(500).json({ error: 'Failed to load new account' });
    res.status(201).json({ token: signToken(profile), user: profile });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
}

/** Legacy accept path — same link-only flow as /accept-invitation. */
router.post('/accept-invite', acceptInvitationHandler);

/** Accept staff invitation — faculty admin, HOD, or lecturer (secure link only). */
router.post('/accept-invitation', acceptInvitationHandler);

/** Forgot password — always returns success (no email enumeration). */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const tenant = await resolveLoginTenant(req);
    const result = await requestPasswordReset(email, tenant?.id);
    const body = {
      ok: true,
      message: 'If an account exists for this email, we sent password reset instructions.',
    };
    if (process.env.NODE_ENV !== 'production') {
      if (result.devResetUrl) body.devResetUrl = result.devResetUrl;
      if (result.outboxFile) body.devOutboxFile = result.outboxFile;
      if (result.found === false) body.devHint = 'No account matched this email for the selected institution.';
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

/** Validate reset token (public). */
router.get('/reset-password/:token', async (req, res) => {
  try {
    const row = await validateResetToken(req.params.token);
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });
    res.json({ email: row.user.email, fullName: row.user.fullName, expiresAt: row.expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to validate reset link' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const { userId } = await resetPasswordWithToken(token, password);
    const profile = await loadPublicUser(userId);
    res.json({
      ok: true,
      message: 'Password updated. You can sign in now.',
      token: signToken(profile),
      user: profile,
    });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/** Force password change after temporary credentials (authenticated). */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await hashSecret(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        accountStatus: 'ACTIVE',
      },
    });

    const profile = await loadPublicUser(user.id);
    res.json({ ok: true, user: profile, token: signToken(profile) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await loadPublicUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

export default router;
