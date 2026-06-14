/** Shared database engine detection from DATABASE_URL. */
export function detectDbEngine(url = process.env.DATABASE_URL || '') {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  if (url.startsWith('file:')) return 'sqlite';
  return 'unknown';
}

export function isPostgresUrl(url = process.env.DATABASE_URL || '') {
  return detectDbEngine(url) === 'postgresql';
}

export function isSqliteUrl(url = process.env.DATABASE_URL || '') {
  return detectDbEngine(url) === 'sqlite';
}

/** Production boot: PostgreSQL only — no SQLite file paths. */
export function getProductionDatabaseErrors() {
  if (process.env.NODE_ENV !== 'production') return [];

  const url = String(process.env.DATABASE_URL || '').trim();
  const errors = [];

  if (!url) {
    errors.push('DATABASE_URL is required in production');
    return errors;
  }

  const engine = detectDbEngine(url);
  if (engine !== 'postgresql') {
    errors.push(
      'DATABASE_URL must be a PostgreSQL connection string in production (SQLite file: URLs are not supported on VPS deploy)',
    );
  }

  return errors;
}
