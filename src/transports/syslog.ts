import { createSocket, Socket } from 'dgram';
import { Transport, LogEntry, LogLevel } from '../core/types';

export interface SyslogTransportOptions {
  level?: LogLevel;
  host?: string;
  port?: number;
  protocol?: 'udp4' | 'udp6' | 'tcp';
  facility?: number;
  tag?: string;
  rfc3164?: boolean;
}

// Syslog severity levels mapping
const SYSLOG_SEVERITY: Record<LogLevel, number> = {
  trace: 7,   // Debug
  debug: 7,   // Debug
  info: 6,    // Informational
  warn: 4,    // Warning
  error: 3,   // Error
  fatal: 2    // Critical
};

// Syslog facilities
export const SYSLOG_FACILITY = {
  KERN: 0,
  USER: 1,
  MAIL: 2,
  DAEMON: 3,
  AUTH: 4,
  SYSLOG: 5,
  LPR: 6,
  NEWS: 7,
  UUCP: 8,
  CRON: 9,
  AUTHPRIV: 10,
  FTP: 11,
  LOCAL0: 16,
  LOCAL1: 17,
  LOCAL2: 18,
  LOCAL3: 19,
  LOCAL4: 20,
  LOCAL5: 21,
  LOCAL6: 22,
  LOCAL7: 23
};

export class SyslogTransport implements Transport {
  type = 'syslog';
  level?: LogLevel;
  private options: SyslogTransportOptions;
  private socket?: Socket;
  private connected: boolean = false;
  private hostname: string;

  constructor(options: SyslogTransportOptions = {}) {
    this.level = options.level;
    this.options = {
      host: 'localhost',
      port: 514,
      protocol: 'udp4',
      facility: SYSLOG_FACILITY.LOCAL0,
      tag: 'hyperlog',
      rfc3164: true,
      ...options
    };
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.hostname = require('os').hostname();
    this.connect();
  }

  private connect(): void {
    if (this.options.protocol === 'udp4' || this.options.protocol === 'udp6') {
      this.socket = createSocket(this.options.protocol);
      this.connected = true;
      
      this.socket.on('error', (err) => {
        console.error('Syslog socket error:', err);
        this.connected = false;
      });
    } else {
      // TCP implementation would go here
      console.warn('TCP syslog not implemented yet, falling back to UDP');
      this.options.protocol = 'udp4';
      this.connect();
    }
  }

  write(entry: LogEntry): void {
    if (!this.connected || !this.socket) return;

    const message = this.formatSyslogMessage(entry);
    const buffer = Buffer.from(message);

    this.socket.send(buffer, this.options.port, this.options.host, (err) => {
      if (err) {
        console.error('Failed to send syslog message:', err);
      }
    });
  }

  private formatSyslogMessage(entry: LogEntry): string {
    const severity = SYSLOG_SEVERITY[entry.level];
    const facility = this.options.facility || SYSLOG_FACILITY.LOCAL0;
    const priority = facility * 8 + severity;
    
    if (this.options.rfc3164) {
      // RFC3164 format: <priority>timestamp hostname tag[pid]: message
      const timestamp = this.formatRFC3164Timestamp(entry.time);
      const pid = entry.pid || process.pid;
      const tag = this.options.tag;
      const message = this.formatMessage(entry);
      
      return `<${priority}>${timestamp} ${this.hostname} ${tag}[${pid}]: ${message}`;
    } else {
      // RFC5424 format (structured data)
      return this.formatRFC5424Message(priority, entry);
    }
  }

  private formatRFC3164Timestamp(time: number): string {
    const date = new Date(time);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const month = months[date.getMonth()];
    const day = date.getDate().toString().padStart(2, ' ');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${month} ${day} ${hours}:${minutes}:${seconds}`;
  }

  private formatRFC5424Message(priority: number, entry: LogEntry): string {
    const version = 1;
    const timestamp = new Date(entry.time).toISOString();
    const hostname = this.hostname;
    const appName = this.options.tag;
    const procId = entry.pid || process.pid;
    const msgId = entry.level;
    
    // Structured data
    const structuredData = this.formatStructuredData(entry);
    
    // Message
    const message = this.formatMessage(entry);
    
    return `<${priority}>${version} ${timestamp} ${hostname} ${appName} ${procId} ${msgId} ${structuredData} ${message}`;
  }

  private formatStructuredData(entry: LogEntry): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { level: _, time: __, msg: ___, err, hostname: ____, pid: _____, name: ______, ...meta } = entry;
    
    if (Object.keys(meta).length === 0 && !err) {
      return '-'; // No structured data
    }
    
    const elements: string[] = [];
    
    // Add metadata
    if (Object.keys(meta).length > 0) {
      const params = Object.entries(meta)
        .map(([key, value]) => `${key}="${this.escapeSDParam(String(value))}"`)
        .join(' ');
      elements.push(`[meta@32473 ${params}]`);
    }
    
    // Add error data
    if (err) {
      const errorParams = [
        `name="${this.escapeSDParam(err.name || 'Error')}"`,
        `message="${this.escapeSDParam(err.message || '')}"`
      ];
      if ('code' in err && err.code) {
        errorParams.push(`code="${this.escapeSDParam(String(err.code))}"`);
      }
      elements.push(`[error@32473 ${errorParams.join(' ')}]`);
    }
    
    return elements.join('');
  }

  private escapeSDParam(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/]/g, '\\]');
  }

  private formatMessage(entry: LogEntry): string {
    if (entry.msg) {
      return entry.msg;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { level: _, time: __, hostname: ___, pid: ____, name: _____, err, ...meta } = entry;
    
    if (err) {
      return `${err.name || 'Error'}: ${err.message || 'Unknown error'}`;
    }
    
    if (Object.keys(meta).length > 0) {
      return JSON.stringify(meta);
    }
    
    return 'Log entry';
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.connected = false;
      return new Promise((resolve) => {
        this.socket!.close(() => resolve());
      });
    }
  }
}