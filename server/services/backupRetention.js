/** Grandfather–father–son retention for SQLite backups. */

export function getRetentionConfig() {
  return {
    daily: Math.max(1, Number(process.env.BACKUP_RETENTION_DAILY) || 7),
    weekly: Math.max(0, Number(process.env.BACKUP_RETENTION_WEEKLY) || 4),
    monthly: Math.max(0, Number(process.env.BACKUP_RETENTION_MONTHLY) || 12),
  };
}

function weekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const dayOfYear = Math.floor((d - start) / 86_400_000) + 1;
  const week = Math.ceil((dayOfYear + start.getDay()) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** IDs to keep under retention policy. */
export function computeRetainedIds(backups, config = getRetentionConfig()) {
  const keep = new Set();
  const now = Date.now();
  const msDay = 86_400_000;
  const sorted = [...backups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  for (const b of sorted) {
    const ageDays = (now - new Date(b.createdAt).getTime()) / msDay;
    if (ageDays <= config.daily) keep.add(b.id);
  }

  const dailyCutoff = now - config.daily * msDay;
  const olderThanDaily = sorted.filter((b) => new Date(b.createdAt).getTime() < dailyCutoff);

  const weekBuckets = new Map();
  for (const b of olderThanDaily) {
    const wk = weekKey(b.createdAt);
    const prev = weekBuckets.get(wk);
    if (!prev || new Date(b.createdAt) > new Date(prev.createdAt)) weekBuckets.set(wk, b);
  }
  const weekKeys = [...weekBuckets.keys()].sort().reverse().slice(0, config.weekly);
  for (const k of weekKeys) keep.add(weekBuckets.get(k).id);

  const monthlyCandidates = sorted.filter((b) => !keep.has(b.id));
  const monthBuckets = new Map();
  for (const b of monthlyCandidates) {
    const mk = monthKey(b.createdAt);
    const prev = monthBuckets.get(mk);
    if (!prev || new Date(b.createdAt) > new Date(prev.createdAt)) monthBuckets.set(mk, b);
  }
  const monthKeys = [...monthBuckets.keys()].sort().reverse().slice(0, config.monthly);
  for (const k of monthKeys) keep.add(monthBuckets.get(k).id);

  return keep;
}

export function listExpiredBackupIds(backups, config = getRetentionConfig()) {
  const keep = computeRetainedIds(backups, config);
  return backups.filter((b) => b.status === 'COMPLETED' && !keep.has(b.id)).map((b) => b.id);
}
