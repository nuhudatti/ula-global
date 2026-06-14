const PREFIX = '[ula-email]';

export function logEmailEvent(level, event, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };
  const line = `${PREFIX} ${JSON.stringify(entry)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const emailLog = {
  info: (event, meta) => logEmailEvent('info', event, meta),
  warn: (event, meta) => logEmailEvent('warn', event, meta),
  error: (event, meta) => logEmailEvent('error', event, meta),
};
