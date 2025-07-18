import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { Transport, LogEntry, LogLevel } from '../core/types';
import { JSONFormatter } from '../formatters/json';

export interface HTTPTransportOptions {
  level?: LogLevel;
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  batchSize?: number;
  flushInterval?: number;
  timeout?: number;
  retry?: {
    attempts: number;
    delay: number;
    backoff?: number;
  };
}

export class HTTPTransport implements Transport {
  type = 'http';
  level?: LogLevel;
  private options: HTTPTransportOptions;
  private batch: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private formatter: JSONFormatter;
  private closed: boolean = false;

  constructor(options: HTTPTransportOptions) {
    this.level = options.level;
    this.options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      batchSize: 100,
      flushInterval: 5000,
      timeout: 30000,
      retry: { attempts: 3, delay: 1000, backoff: 2 },
      ...options
    };
    
    this.formatter = new JSONFormatter();
    this.startFlushTimer();
  }

  write(entry: LogEntry): void {
    if (this.closed) return;
    
    this.batch.push(entry);
    
    if (this.batch.length >= (this.options.batchSize || 100)) {
      this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval || 5000);
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;
    
    const logs = this.batch.splice(0, this.batch.length);
    await this.sendWithRetry(logs);
  }

  private async sendWithRetry(logs: LogEntry[]): Promise<void> {
    const retry = this.options.retry || { attempts: 3, delay: 1000 };
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < retry.attempts; attempt++) {
      try {
        await this.send(logs);
        return;
      } catch (err) {
        lastError = err as Error;
        
        if (attempt < retry.attempts - 1) {
          const delay = retry.delay * Math.pow(retry.backoff || 1, attempt);
          await this.sleep(delay);
        }
      }
    }
    
    console.error('Failed to send logs after retries:', lastError);
  }

  private async send(logs: LogEntry[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.options.url);
      const isHttps = url.protocol === 'https:';
      const request = isHttps ? httpsRequest : httpRequest;
      
      const data = JSON.stringify({ logs });
      
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: this.options.method || 'POST',
        headers: {
          ...(this.options.headers || { 'Content-Type': 'application/json' }),
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: this.options.timeout || 30000
      };
      
      const req = request(reqOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(data);
      req.end();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    this.closed = true;
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flush();
  }
}