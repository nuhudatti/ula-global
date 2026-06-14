import jwt from 'jsonwebtoken';
import { getPlatformJwtSecret } from '../services/jwtSecrets.js';

export function requirePlatformAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Platform authentication required' });

  try {
    const payload = jwt.verify(token, getPlatformJwtSecret());
    if (payload.scope !== 'platform') {
      return res.status(403).json({ error: 'Institution token cannot access platform APIs' });
    }
    req.platformUser = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired platform token' });
  }
}

export function requirePlatformRole(...roles) {
  return (req, res, next) => {
    if (!req.platformUser) return res.status(401).json({ error: 'Platform authentication required' });
    if (!roles.includes(req.platformUser.role)) {
      return res.status(403).json({ error: 'Insufficient platform permissions' });
    }
    next();
  };
}
