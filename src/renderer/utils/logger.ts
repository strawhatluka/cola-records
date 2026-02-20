import log from 'electron-log/renderer';

export function createLogger(tag: string) {
  return {
    error: (message: string, ...args: unknown[]) => log.error(`[${tag}]`, message, ...args),
    warn: (message: string, ...args: unknown[]) => log.warn(`[${tag}]`, message, ...args),
    info: (message: string, ...args: unknown[]) => log.info(`[${tag}]`, message, ...args),
    debug: (message: string, ...args: unknown[]) => log.debug(`[${tag}]`, message, ...args),
  };
}

export default log;
