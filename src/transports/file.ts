import { createWriteStream, WriteStream, promises as fs } from 'fs';
import { dirname } from 'path';
import { Transport, LogEntry, LogLevel } from '../core/types';
import { JSONFormatter } from '../formatters/json';
import { AsyncWriteQueue } from '../utils/async-write-queue';
import { FileRotator } from '../rotation/file-rotator';

export interface FileTransportOptions {
  level?: LogLevel;
  filename: string;
  maxSize?: string;
  maxFiles?: number | string;
  compress?: boolean;
  bufferSize?: number;
  flushInterval?: number;
  datePattern?: string;
  format?: 'json' | ((entry: LogEntry) => string);
}

export class FileTransport implements Transport {
  type = 'file';
  level?: LogLevel;
  private options: FileTransportOptions;
  private formatter: JSONFormatter;
  private writeStream?: WriteStream;
  private writeQueue: AsyncWriteQueue;
  private rotator: FileRotator;
  private currentSize: number = 0;
  private buffer: string[] = [];
  private bufferSize: number;
  private flushTimer?: NodeJS.Timeout;
  private closed: boolean = false;
  private maxSize?: number;
  private initPromise?: Promise<void>;
  private initialized: boolean = false;

  constructor(options: FileTransportOptions) {
    this.options = options;
    this.level = options.level;
    this.formatter = new JSONFormatter();
    this.bufferSize = options.bufferSize || 4096;
    this.writeQueue = new AsyncWriteQueue({ highWaterMark: 1000 });
    this.rotator = new FileRotator(options);

    // Parse and validate maxSize during construction
    if (options.maxSize) {
      this.maxSize = this.parseSize(options.maxSize);
    }

    this.initPromise = this.initializeStream();
    this.startFlushTimer();
  }

  private async initializeStream(): Promise<void> {
    const dir = dirname(this.options.filename);
    await fs.mkdir(dir, { recursive: true });

    const filename = this.rotator.getFilename();
    this.writeStream = createWriteStream(filename, {
      flags: 'a',
      encoding: 'utf8',
      highWaterMark: 16384
    });

    this.writeStream.on('error', (err) => {
      console.error('File transport write error:', err);
    });

    try {
      const stats = await fs.stat(filename);
      this.currentSize = stats.size;
    } catch {
      this.currentSize = 0;
    }
    
    this.initialized = true;
  }

  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  write(entry: LogEntry): void {
    if (this.closed) return;

    const formatted = this.formatEntry(entry);
    this.buffer.push(formatted);

    const bufferLength = this.buffer.reduce((acc, item) => acc + item.length, 0);
    if (bufferLength >= this.bufferSize) {
      this.flush();
    }
  }

  private formatEntry(entry: LogEntry): string {
    if (typeof this.options.format === 'function') {
      return this.options.format(entry);
    }
    return this.formatter.format(entry);
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    const data = this.buffer.map(entry => entry.endsWith('\n') ? entry : entry + '\n').join('');
    this.buffer = [];

    this.writeQueue.enqueue({
      data,
      size: Buffer.byteLength(data)
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    await this.writeQueue.process(async (item) => {
      if (this.closed) return;
      
      // Ensure initialization is complete
      if (this.initPromise) {
        await this.initPromise;
      }
      
      if (!this.writeStream) return;

      await this.checkRotation(item.size);

      return new Promise((resolve, reject) => {
        this.writeStream!.write(item.data, (err) => {
          if (err) reject(err);
          else {
            this.currentSize += item.size;
            resolve();
          }
        });
      });
    });
  }

  private async checkRotation(nextSize: number): Promise<void> {
    if (!this.maxSize) return;

    if (this.currentSize + nextSize > this.maxSize) {
      await this.rotate();
    }
  }

  private async rotate(): Promise<void> {
    if (!this.writeStream) return;

    this.writeStream.end();
    await new Promise<void>(resolve => this.writeStream!.once('finish', resolve));

    await this.rotator.rotate();
    await this.initializeStream();
  }

  private parseSize(size: string): number {
    const match = size.match(/^(\d+)(k|m|g)?b?$/i);
    if (!match) throw new Error(`Invalid size format: ${size}`);

    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase();

    switch (unit) {
      case 'k': return value * 1024;
      case 'm': return value * 1024 * 1024;
      case 'g': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  private startFlushTimer(): void {
    if (!this.options.flushInterval) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Ensure initialization is complete before closing
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch {
        // Ignore init errors during close
      }
    }

    // Flush any remaining buffered data
    this.flush();
    
    // Process any pending writes
    await this.processQueue();
    
    // Mark as closed only after flushing
    this.closed = true;
    
    // Drain the write queue
    await this.writeQueue.drain();

    if (this.writeStream && !this.writeStream.destroyed) {
      return new Promise((resolve) => {
        this.writeStream!.end(() => resolve());
      });
    }
  }
}