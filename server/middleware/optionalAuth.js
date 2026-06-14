import jwt from 'jsonwebtoken';
import { getInstitutionJwtSecret, isInstitutionJwtConfigured } from '../services/jwtSecrets.js';

/** Sets req.user when Authorization Bearer JWT is valid; otherwise continues without user */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !isInstitutionJwtConfigured()) {
    return next();
  }
  try {
    const payload = jwt.verify(token, getInstitutionJwtSecret());
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    req.user = undefined;
  }
  next();
}
