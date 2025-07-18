import { LogLevel } from './types';

export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

export const LOG_LEVEL_NAMES: Record<number, LogLevel> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal'
};

export function isValidLevel(level: string): level is LogLevel {
  return level in LOG_LEVELS;
}

export function getLevelValue(level: LogLevel): number {
  return LOG_LEVELS[level];
}

export function getLevelName(value: number): LogLevel | undefined {
  return LOG_LEVEL_NAMES[value];
}

export function shouldLog(entryLevel: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVELS[entryLevel] >= LOG_LEVELS[minLevel];
}