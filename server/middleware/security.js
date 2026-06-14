import helmet from 'helmet';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Express sits behind Nginx in production. Trust X-Forwarded-* for req.secure / client IP.
 */
export function configureTrustProxy(app) {
  if (isProd) {
    app.set('trust proxy', 1);
  }
}

/** Belt-and-suspenders redirect when Node is reached without TLS (e.g. misconfigured proxy). */
export function httpsRedirectMiddleware(req, res, next) {
  if (!isProd) return next();

  const proto = req.headers['x-forwarded-proto'];
  if (req.secure || proto === 'https') return next();

  const host = req.headers.host;
  if (!host) return res.status(400).send('HTTPS required');
  return res.redirect(301, `https://${host}${req.originalUrl}`);
}

/** Defense-in-depth headers. Nginx sets the same headers for static paths; Helmet covers API responses. */
export function securityHeadersMiddleware() {
  if (!isProd) {
    return (_req, _res, next) => next();
  }

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
        connectSrc: ["'self'", 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
        frameSrc: ["'self'", 'blob:'],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
