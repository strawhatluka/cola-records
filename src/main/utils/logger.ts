import log from 'electron-log/main';

// Configure file transport
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB rotation
log.transports.console.level = 'debug';

// Tagged logger factory for service identification
export function createLogger(tag: string) {
  return {
    error: (message: string, ...args: unknown[]) => log.error(`[${tag}]`, message, ...args),
    warn: (message: string, ...args: unknown[]) => log.warn(`[${tag}]`, message, ...args),
    info: (message: string, ...args: unknown[]) => log.info(`[${tag}]`, message, ...args),
    debug: (message: string, ...args: unknown[]) => log.debug(`[${tag}]`, message, ...args),
  };
}

export default log;
