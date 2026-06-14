import { resolveSecuredFile } from '../services/authFileAccessService.js';

/** Attach req.securedFile after role-based permission check. */
export function requireFileAccess(kindParam = 'kind', idParam = 'id') {
  return async (req, res, next) => {
    try {
      const kind = req.query[kindParam] || req.params[kindParam];
      const id = req.query[idParam] || req.params[idParam];
      if (!kind || !id) {
        return res.status(400).json({ error: 'kind and id are required' });
      }
      req.securedFile = await resolveSecuredFile(req.user?.id, kind, id);
      req.fileKind = kind;
      req.fileEntityId = id;
      next();
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      res.status(status).json({ error: e.message || 'Access denied' });
    }
  };
}
