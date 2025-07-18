import { Formatter, LogEntry } from '../core/types';
import { SafeStringify } from '../utils/safe-stringify';

export class JSONFormatter implements Formatter {
  private safeStringify: SafeStringify;

  constructor() {
    this.safeStringify = new SafeStringify();
  }

  format(entry: LogEntry): string {
    return this.safeStringify.stringify(entry);
  }
}