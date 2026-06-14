#!/usr/bin/env node
/**
 * Generate cryptographically secure JWT secrets for ULA.
 * Usage: npm run jwt:generate
 *
 * Copy output into .env (development) or server .env (production).
 * Never commit generated values to source control.
 */
import { generateJwtSecret } from '../server/services/jwtSecrets.js';

const institution = generateJwtSecret();
const platform = generateJwtSecret();

console.log('ULA JWT secrets (store in .env only — do not commit)\n');
console.log('# Institution / tenant users');
console.log(`JWT_SECRET=${institution}\n`);
console.log('# Platform operators (separate secret — required in production)');
console.log(`PLATFORM_JWT_SECRET=${platform}\n`);
console.log('After updating .env, restart the API: npm run dev  (or pm2 restart ula)');
