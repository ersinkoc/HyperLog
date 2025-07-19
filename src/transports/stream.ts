import { Writable } from 'stream';
import { Transport, LogEntry, LogLevel } from '../core/types';
import { JSONFormatter } from '../formatters/json';
import { Formatter } from '../core/types';

export interface StreamTransportOptions {
  level?: LogLevel;
  stream: NodeJS.WritableStream | Writable;
  format?: 'json' | ((entry: LogEntry) => string);
}

export class StreamTransport implements Transport {
  type = 'stream';
  level?: LogLevel;
  private stream: NodeJS.WritableStream | Writable;
  private formatter: Formatter;
  private formatFunc?: (entry: LogEntry) => string;

  constructor(options: StreamTransportOptions) {
    this.level = options.level;
    this.stream = options.stream;
    
    if (typeof options.format === 'function') {
      this.formatFunc = options.format;
    }
    
    this.formatter = new JSONFormatter();
    
    // Handle stream errors
    if (this.stream && typeof this.stream.on === 'function') {
      this.stream.on('error', (err) => {
        console.error('Stream write error:', err);
      });
    }
  }

  write(entry: LogEntry): void {
    try {
      const formatted = this.formatFunc 
        ? this.formatFunc(entry)
        : this.formatter.format(entry);
      
      this.stream.write(formatted + '\n', (err) => {
        if (err) {
          console.error('Stream write error:', err);
        }
      });
    } catch (err) {
      console.error('Stream write error:', err);
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if ('end' in this.stream && typeof this.stream.end === 'function') {
        this.stream.end(() => resolve());
      } else {
        resolve();
      }
    });
  }
}