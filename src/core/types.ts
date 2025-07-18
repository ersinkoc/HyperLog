export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  time: number;
  msg?: string;
  err?: Error;
  hostname?: string;
  pid?: number;
  [key: string]: any;
}

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  pretty?: boolean;
  timestamp?: boolean;
  hostname?: boolean;
  pid?: boolean;
  transports?: Transport[];
  context?: Record<string, any>;
  redact?: string[];
  filter?: (entry: LogEntry) => boolean;
  sampling?: {
    enabled: boolean;
    rate: number;
    adaptive?: boolean;
  };
  rateLimit?: {
    enabled: boolean;
    maxPerSecond: number;
    maxBurst?: number;
  };
  metrics?: {
    enabled: boolean;
    interval?: number;
  };
}

export interface Transport {
  type: string;
  level?: LogLevel;
  format?: 'json' | 'pretty' | 'logfmt' | 'csv' | ((entry: LogEntry) => string);
  write(entry: LogEntry): void | Promise<void>;
  close?(): void | Promise<void>;
}

export interface Formatter {
  format(entry: LogEntry): string | Buffer;
}

export interface Timer {
  done(obj?: Record<string, any>, msg?: string): void;
}