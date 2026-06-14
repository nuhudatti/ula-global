const buckets = new Map();

function pruneBucket(bucket, windowMs, now) {
  while (bucket.length && now - bucket[0] > windowMs) bucket.shift();
}

/**
 * Lightweight in-memory rate limiter (single-node; swap for Redis in multi-instance deploy).
 */
export function rateLimit({ windowMs = 60_000, max = 60, keyFn, message }) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    pruneBucket(bucket, windowMs, now);

    if (bucket.length >= max) {
      const retryAfter = Math.ceil((bucket[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      return res.status(429).json({
        error: message || 'Too many requests — try again shortly',
      });
    }

    bucket.push(now);
    next();
  };
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
  keyFn: (req) => `login:${req.ip || req.socket?.remoteAddress || 'unknown'}`,
  message: 'Too many login attempts — wait 15 minutes',
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 30,
  keyFn: (req) => (req.user?.id ? `upload:${req.user.id}` : null),
  message: 'Upload limit reached — try again later',
});

export const backupRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: Number(process.env.RATE_LIMIT_BACKUP_MAX) || 5,
  keyFn: (req) => (req.user?.id ? `backup:${req.user.id}` : null),
  message: 'Backup/restore limit reached — try again later',
});
