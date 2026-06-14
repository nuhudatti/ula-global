#!/usr/bin/env node
/**
 * Production entrypoint: validate config → prisma migrate deploy → start API.
 * Used by PM2 and `npm run start:production`.
 */
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });
process.env.NODE_ENV = 'production';

const { validateProductionBoot } = await import('../server/services/productionBoot.js');
const boot = validateProductionBoot({ exitOnError: true });
if (!boot.ok) process.exit(1);

console.log('[ula-boot] Applying database migrations (prisma migrate deploy)…');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const migrate = spawnSync(npx, ['prisma', 'migrate', 'deploy'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

if (migrate.status !== 0) {
  console.error('[ula-boot] FATAL: prisma migrate deploy failed — fix migrations before starting the server.');
  process.exit(migrate.status || 1);
}

console.log('[ula-boot] Migrations up to date — starting API server…');
const child = spawn(process.execPath, ['server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[ula-boot] Server stopped by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
