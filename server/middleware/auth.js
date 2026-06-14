import jwt from 'jsonwebtoken';

import { resolveTenantForUser } from '../services/tenantService.js';
import { getInstitutionJwtSecret } from '../services/jwtSecrets.js';



export async function requireAuth(req, res, next) {

  const header = req.headers.authorization;

  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {

    return res.status(401).json({ error: 'Authentication required' });

  }

  try {

    const payload = jwt.verify(token, getInstitutionJwtSecret());

    if (payload.scope === 'platform') {

      return res.status(403).json({ error: 'Use platform APIs with platform token' });

    }

    req.user = {

      id: payload.sub,

      role: payload.role,

      institutionId: payload.institutionId || null,

    };

    req.tenant = await resolveTenantForUser(req.user, req.tenant);

    next();

  } catch {

    return res.status(401).json({ error: 'Invalid or expired token' });

  }

}



/** Attach req.user when a valid token is present, but never block the request. */

export function optionalAuth(req, _res, next) {

  const header = req.headers.authorization;

  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {

    try {

      const payload = jwt.verify(token, getInstitutionJwtSecret());

      const institutionId = payload.institutionId || null;

      if (req.tenant?.id && institutionId && institutionId !== req.tenant.id) {

        /* Cross-tenant browse — treat as anonymous for public catalogue */

      } else {

        req.user = {

          id: payload.sub,

          role: payload.role,

          institutionId,

        };

      }

    } catch {

      /* anonymous */

    }

  }

  next();

}



export function requireRole(...roles) {

  return (req, res, next) => {

    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    if (!roles.includes(req.user.role)) {

      return res.status(403).json({ error: 'Insufficient permissions' });

    }

    next();

  };

}


