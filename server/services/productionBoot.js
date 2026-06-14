import { getProductionDatabaseErrors } from './dbEngine.js';
import { getProductionJwtErrors } from './jwtSecrets.js';
import { getProductionUrlErrors } from './publicUrl.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

function printProductionBootFailure(errors) {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('  ULA PRODUCTION BOOT BLOCKED — configuration is not safe to run');
  console.error('═══════════════════════════════════════════════════════════════');
  for (const err of errors) console.error(`  • ${err}`);
  console.error('');
  console.error('  Remediation:');
  console.error('    1. Copy .env.production.example → .env on the server');
  console.error('    2. Set strong JWT_SECRET and PLATFORM_JWT_SECRET: npm run jwt:generate');
  console.error('    3. Set HTTPS URLs for CLIENT_ORIGIN, APP_PUBLIC_URL, PUBLIC_BASE_URL');
  console.error('    4. Set DATABASE_URL to your PostgreSQL connection string');
  console.error('    5. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  console.error('    6. Restart: npm run start:production  (or pm2 restart ula)');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('');
}

function getProductionCloudinaryErrors() {
  if (process.env.NODE_ENV !== 'production') return [];
  if (isCloudinaryConfigured()) return [];
  return [
    'Cloudinary is required in production — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET',
  ];
}

/** Aggregate production safety checks — single failure report, no partial boot. */
export function validateProductionBoot({ exitOnError = true } = {}) {
  if (process.env.NODE_ENV !== 'production') {
    return { ok: true, errors: [] };
  }

  const errors = [
    ...getProductionDatabaseErrors(),
    ...getProductionJwtErrors(),
    ...getProductionUrlErrors(),
    ...getProductionCloudinaryErrors(),
  ];

  if (errors.length) {
    printProductionBootFailure(errors);
    if (exitOnError) {
      setTimeout(() => process.exit(1), 50);
    }
    return { ok: false, errors };
  }

  console.log('[ula-boot] Production configuration validated (database, JWT, URLs, storage).');
  return { ok: true, errors: [] };
}
