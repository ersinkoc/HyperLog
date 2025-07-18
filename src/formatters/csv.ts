import { Formatter, LogEntry } from '../core/types';

export interface CSVFormatterOptions {
  fields?: string[];
  delimiter?: string;
  includeHeader?: boolean;
}

export class CSVFormatter implements Formatter {
  private options: Required<CSVFormatterOptions>;
  private headerWritten: boolean = false;
  
  constructor(options: CSVFormatterOptions = {}) {
    this.options = {
      fields: ['time', 'level', 'name', 'hostname', 'pid', 'msg'],
      delimiter: ',',
      includeHeader: true,
      ...options
    };
  }
  
  format(entry: LogEntry): string {
    let result = '';
    
    // Write header if needed
    if (this.options.includeHeader && !this.headerWritten) {
      result = this.options.fields.join(this.options.delimiter) + '\n';
      this.headerWritten = true;
    }
    
    // Write data row
    const values = this.options.fields.map(field => {
      const value = this.getFieldValue(entry, field);
      return this.escapeValue(value);
    });
    
    result += values.join(this.options.delimiter);
    return result;
  }
  
  private getFieldValue(entry: LogEntry, field: string): any {
    if (field === 'time' && entry.time) {
      return new Date(entry.time).toISOString();
    }
    
    if (field === 'err' && entry.err) {
      return entry.err.message || entry.err.name || 'Error';
    }
    
    return entry[field] ?? '';
  }
  
  private escapeValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const str = String(value);
    
    // Check if value needs escaping
    if (!str.includes(this.options.delimiter) && 
        !str.includes('"') && 
        !str.includes('\n') && 
        !str.includes('\r')) {
      return str;
    }
    
    // Escape quotes and wrap in quotes
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  reset(): void {
    this.headerWritten = false;
  }
}