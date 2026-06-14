import crypto from 'crypto';

const MIN_LENGTH = 64;

/** Known weak / placeholder values — compared case-insensitively. */
const WEAK_EXACT = new Set([
  'change-this-to-a-long-random-string-in-production',
  'replace_with_64_char_random_string',
  'replace_with_long_random_string',
  'your-secret-key',
  'secret',
  'jwt_secret',
  'changeme',
  'password',
  'test',
  'dev',
  'shhhhh',
]);

const WEAK_SUBSTRINGS = ['change-this', 'replace_with', 'yourdomain', 'example', 'placeholder'];

function normalize(secret) {
  return String(secret || '').trim();
}

export function generateJwtSecret(byteLength = 48) {
  /** 48 bytes → 64 chars in base64url (cryptographically secure). */
  return crypto.randomBytes(byteLength).toString('base64url');
}

export function isWeakJwtSecret(secret) {
  const s = normalize(secret);
  if (!s || s.length < MIN_LENGTH) return true;

  const lower = s.toLowerCase();
  if (WEAK_EXACT.has(lower)) return true;

  for (const frag of WEAK_SUBSTRINGS) {
    if (lower.includes(frag)) return true;
  }

  return false;
}

/** Institution / tenant user tokens. */
export function getInstitutionJwtSecret() {
  return normalize(process.env.JWT_SECRET);
}

/** Platform operator tokens — separate secret in production. */
export function getPlatformJwtSecret() {
  const platform = normalize(process.env.PLATFORM_JWT_SECRET);
  if (platform) return platform;

  // Development: optional fallback so existing .env keeps working.
  if (process.env.NODE_ENV !== 'production') {
    return getInstitutionJwtSecret();
  }

  return '';
}

export function isInstitutionJwtConfigured() {
  return Boolean(getInstitutionJwtSecret());
}

export function isPlatformJwtConfigured() {
  if (process.env.NODE_ENV === 'production') {
    return Boolean(normalize(process.env.PLATFORM_JWT_SECRET)) && !isWeakJwtSecret(getPlatformJwtSecret());
  }
  return isInstitutionJwtConfigured();
}

/** Collect JWT configuration errors for production boot (no exit). */
export function getProductionJwtErrors() {
  if (process.env.NODE_ENV !== 'production') return [];

  const institution = getInstitutionJwtSecret();
  const platformEnv = normalize(process.env.PLATFORM_JWT_SECRET);
  const platformEffective = getPlatformJwtSecret();
  const errors = [];

  if (!institution) {
    errors.push('JWT_SECRET is required in production');
  } else if (isWeakJwtSecret(institution)) {
    errors.push(
      `JWT_SECRET must be at least ${MIN_LENGTH} cryptographically random characters (not a default or placeholder) — run: npm run jwt:generate`,
    );
  }

  if (!platformEnv) {
    errors.push('PLATFORM_JWT_SECRET is required in production (must differ from JWT_SECRET)');
  } else if (isWeakJwtSecret(platformEffective)) {
    errors.push(
      `PLATFORM_JWT_SECRET must be at least ${MIN_LENGTH} cryptographically random characters (not a default or placeholder) — run: npm run jwt:generate`,
    );
  }

  if (institution && platformEffective && institution === platformEffective) {
    errors.push('PLATFORM_JWT_SECRET must differ from JWT_SECRET in production');
  }

  return errors;
}

/** Validate secrets on boot. Production: hard fail. Development: warn only. */
export function validateJwtSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const institution = getInstitutionJwtSecret();
  const platformEnv = normalize(process.env.PLATFORM_JWT_SECRET);

  if (!isProd) {
    if (!institution) {
      console.warn('[ula-jwt] WARNING: JWT_SECRET not set — institution auth will fail.');
    } else if (isWeakJwtSecret(institution)) {
      console.warn('[ula-jwt] WARNING: JWT_SECRET is a placeholder — acceptable in development only.');
    }

    if (!platformEnv && institution) {
      console.warn('[ula-jwt] INFO: PLATFORM_JWT_SECRET not set — using JWT_SECRET for platform auth in development.');
    } else if (platformEnv && isWeakJwtSecret(platformEnv)) {
      console.warn('[ula-jwt] WARNING: PLATFORM_JWT_SECRET is weak — acceptable in development only.');
    }

    return { ok: true, mode: 'development' };
  }

  const errors = getProductionJwtErrors();
  if (errors.length) {
    return { ok: false, mode: 'production', errors };
  }

  console.log('[ula-jwt] Institution and platform JWT secrets validated.');
  return { ok: true, mode: 'production' };
}

export function getJwtSecurityStatus() {
  const isProd = process.env.NODE_ENV === 'production';
  const institution = getInstitutionJwtSecret();
  const platformEnv = normalize(process.env.PLATFORM_JWT_SECRET);

  return {
    institutionConfigured: isInstitutionJwtConfigured(),
    platformConfigured: isPlatformJwtConfigured(),
    platformUsesSeparateSecret: isProd ? Boolean(platformEnv) : Boolean(platformEnv),
    institutionSecretLength: institution.length,
    platformSecretLength: (platformEnv || institution).length,
    productionEnforced: isProd,
    minLength: MIN_LENGTH,
  };
}
