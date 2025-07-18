import { Formatter, LogEntry } from '../core/types';

export class LogfmtFormatter implements Formatter {
  format(entry: LogEntry): string {
    const pairs: string[] = [];
    
    // Add standard fields in consistent order
    if (entry.time) {
      pairs.push(`time=${this.formatValue(new Date(entry.time).toISOString())}`);
    }
    
    if (entry.level) {
      pairs.push(`level=${entry.level}`);
    }
    
    if (entry.name) {
      pairs.push(`name=${this.formatValue(entry.name)}`);
    }
    
    if (entry.hostname) {
      pairs.push(`hostname=${this.formatValue(entry.hostname)}`);
    }
    
    if (entry.pid) {
      pairs.push(`pid=${entry.pid}`);
    }
    
    if (entry.msg) {
      pairs.push(`msg=${this.formatValue(entry.msg)}`);
    }
    
    // Add error fields
    if (entry.err) {
      const err = entry.err;
      if (err.message) {
        pairs.push(`error=${this.formatValue(err.message)}`);
      }
      if (err.name) {
        pairs.push(`errorName=${this.formatValue(err.name)}`);
      }
      if ('code' in err && err.code) {
        pairs.push(`errorCode=${this.formatValue(err.code)}`);
      }
      if (err.stack) {
        pairs.push(`errorStack=${this.formatValue(err.stack)}`);
      }
    }
    
    // Add remaining fields
    for (const [key, value] of Object.entries(entry)) {
      if (['time', 'level', 'name', 'hostname', 'pid', 'msg', 'err'].includes(key)) {
        continue;
      }
      
      const formattedValue = this.formatValue(value);
      if (formattedValue !== null) {
        pairs.push(`${key}=${formattedValue}`);
      }
    }
    
    return pairs.join(' ');
  }
  
  private formatValue(value: any): string | null {
    if (value === null) return 'null';
    if (value === undefined) return null;
    
    const type = typeof value;
    
    switch (type) {
      case 'string':
        return this.escapeString(value);
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (value instanceof Date) {
          return this.escapeString(value.toISOString());
        }
        if (Array.isArray(value)) {
          return this.escapeString(JSON.stringify(value));
        }
        return this.escapeString(JSON.stringify(value));
      default:
        return this.escapeString(String(value));
    }
  }
  
  private escapeString(str: string): string {
    // Check if string needs escaping
    if (!/[\s"=]/.test(str)) {
      return str;
    }
    
    // Escape quotes and wrap in quotes
    return '"' + str.replace(/"/g, '\\"') + '"';
  }
}