#!/usr/bin/env node
/**
 * Switch Prisma datasource provider (sqlite | postgresql) and regenerate client.
 * Prisma requires provider in schema.prisma — DATABASE_URL alone is not enough.
 *
 * Usage: node scripts/db-use-provider.js sqlite|postgresql
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');

const provider = process.argv[2];
if (!['sqlite', 'postgresql'].includes(provider)) {
  console.error('Usage: node scripts/db-use-provider.js [sqlite|postgresql]');
  process.exit(1);
}

let content = fs.readFileSync(schemaPath, 'utf8');
const datasourceBlock = `datasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}`;

if (!/datasource db \{[\s\S]*?\}/.test(content)) {
  console.error('Could not find datasource block in prisma/schema.prisma');
  process.exit(1);
}

content = content.replace(/datasource db \{[\s\S]*?\}/, datasourceBlock);
fs.writeFileSync(schemaPath, content, 'utf8');

console.log(`[db] Prisma provider set to ${provider}`);
execSync('npx prisma generate', { cwd: rootDir, stdio: 'inherit' });
console.log(`[db] Client regenerated for ${provider}`);
