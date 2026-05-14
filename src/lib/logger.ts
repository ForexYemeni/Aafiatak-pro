const isDev = process.env.NODE_ENV !== 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, obj: Record<string, unknown> | string, msg?: string) {
  const timestamp = new Date().toISOString();
  const message = typeof obj === 'string' ? obj : (msg ?? '');
  const meta = typeof obj === 'object' ? obj : {};

  const entry = { level, timestamp, ...meta, msg: message };

  if (isDev) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level.toUpperCase()}]`, message, Object.keys(meta).length ? meta : '');
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

export const logger = {
  info:  (obj: Record<string, unknown> | string, msg?: string) => log('info',  obj, msg),
  warn:  (obj: Record<string, unknown> | string, msg?: string) => log('warn',  obj, msg),
  error: (obj: Record<string, unknown> | string, msg?: string) => log('error', obj, msg),
  debug: (obj: Record<string, unknown> | string, msg?: string) => log('debug', obj, msg),
};

export default logger;
