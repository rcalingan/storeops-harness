type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const resolveLevel = (): Level => {
  const fromEnv = process.env.LOG_LEVEL as Level | undefined;
  if (fromEnv && fromEnv in LEVELS) return fromEnv;
  return process.env.NODE_ENV === 'test' ? 'silent' : 'info';
};

export const createLogger = (level: Level = resolveLevel()): Logger => {
  const write =
    (target: Exclude<Level, 'silent'>) =>
    (message: string, meta?: Record<string, unknown>): void => {
      if (LEVELS[target] < LEVELS[level]) return;
      const line = JSON.stringify({ level: target, time: new Date().toISOString(), message, ...meta });
      if (target === 'error' || target === 'warn') console.error(line);
      else console.log(line);
    };
  return { debug: write('debug'), info: write('info'), warn: write('warn'), error: write('error') };
};

export const logger = createLogger();
