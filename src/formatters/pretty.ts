import { Formatter, LogEntry, LogLevel } from '../core/types';

export interface PrettyFormatterOptions {
  colors?: boolean;
  timestamp?: string | boolean;
}

export class PrettyFormatter implements Formatter {
  private options: PrettyFormatterOptions;
  private colors: Record<LogLevel, string>;
  private reset = '\x1b[0m';

  constructor(options: PrettyFormatterOptions = {}) {
    this.options = {
      colors: true,
      timestamp: 'ISO8601',
      ...options
    };

    this.colors = {
      trace: '\x1b[90m',  // gray
      debug: '\x1b[36m',  // cyan
      info: '\x1b[32m',   // green
      warn: '\x1b[33m',   // yellow
      error: '\x1b[31m',  // red
      fatal: '\x1b[35m'   // magenta
    };
  }

  format(entry: LogEntry): string {
    const parts: string[] = [];
    
    // Timestamp
    if (this.options.timestamp) {
      const timestamp = this.formatTimestamp(entry.time);
      parts.push(this.colorize(timestamp, '\x1b[90m'));
    }

    // Level
    const level = entry.level.toUpperCase().padEnd(5);
    parts.push(this.colorize(level, this.colors[entry.level]));

    // Name
    if (entry.name) {
      parts.push(this.colorize(`[${entry.name}]`, '\x1b[36m'));
    }

    // PID
    if (entry.pid) {
      parts.push(this.colorize(`(${entry.pid})`, '\x1b[90m'));
    }

    // Message
    if (entry.msg) {
      parts.push(entry.msg);
    }

    // Additional fields
    const additionalFields = this.getAdditionalFields(entry);
    if (Object.keys(additionalFields).length > 0) {
      const formatted = this.formatObject(additionalFields);
      parts.push(formatted);
    }

    // Error
    if (entry.err) {
      parts.push('\n' + this.formatError(entry.err));
    }

    return parts.join(' ');
  }

  private formatTimestamp(time: number): string {
    if (this.options.timestamp === 'ISO8601') {
      return new Date(time).toISOString();
    }
    return String(time);
  }

  private colorize(text: string, color: string): string {
    if (!this.options.colors) {
      return text;
    }
    return color + text + this.reset;
  }

  private getAdditionalFields(entry: LogEntry): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { level: _, time: __, msg: ___, err: ____, name: _____, pid: ______, hostname: _______, ...rest } = entry;
    return rest;
  }

  private formatObject(obj: Record<string, any>): string {
    const pairs = Object.entries(obj).map(([key, value]) => {
      const formattedValue = typeof value === 'object' 
        ? JSON.stringify(value) 
        : String(value);
      return `${key}=${formattedValue}`;
    });
    return pairs.join(' ');
  }

  private formatError(err: any): string {
    if (!err || typeof err !== 'object') {
      return String(err);
    }

    const parts: string[] = [];
    
    if (err.name || err.message) {
      const errorLine = `${err.name || 'Error'}: ${err.message || 'Unknown error'}`;
      parts.push(this.colorize(errorLine, '\x1b[31m'));
    }

    if (err.code) {
      parts.push(this.colorize(`Code: ${err.code}`, '\x1b[33m'));
    }

    if (err.stack) {
      const stack = err.stack.split('\n').slice(1).join('\n');
      parts.push(this.colorize(stack, '\x1b[90m'));
    }

    return parts.join('\n');
  }
}