import { Transport, LogEntry, LogLevel } from '../core/types';
import { JSONFormatter } from '../formatters/json';
import { PrettyFormatter } from '../formatters/pretty';

export interface ConsoleTransportOptions {
  level?: LogLevel;
  pretty?: boolean;
  colors?: boolean;
  timestamp?: string;
  stream?: NodeJS.WriteStream;
}

export class ConsoleTransport implements Transport {
  type = 'console';
  level?: LogLevel;
  private options: ConsoleTransportOptions;
  private formatter: JSONFormatter | PrettyFormatter;
  private stream: NodeJS.WriteStream;

  constructor(options: ConsoleTransportOptions = {}) {
    this.options = {
      pretty: false,
      colors: true,
      timestamp: 'ISO8601',
      ...options
    };
    this.level = options.level;
    this.stream = options.stream || process.stdout;
    
    if (this.options.pretty) {
      this.formatter = new PrettyFormatter({
        colors: this.options.colors,
        timestamp: this.options.timestamp
      });
    } else {
      this.formatter = new JSONFormatter();
    }
  }

  write(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);
    this.stream.write(formatted + '\n');
  }

  close(): void {
    // Console transport doesn't need cleanup
  }
}