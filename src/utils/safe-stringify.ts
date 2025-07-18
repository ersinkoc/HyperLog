export class SafeStringify {
  private seen: WeakSet<any>;

  constructor() {
    this.seen = new WeakSet();
  }

  stringify(obj: any, replacer?: (key: string, value: any) => any, space?: string | number): string {
    this.seen = new WeakSet();
    
    try {
      return JSON.stringify(obj, (key, value) => {
        if (replacer) {
          value = replacer(key, value);
        }

        if (value === undefined) {
          return undefined;
        }

        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (typeof value === 'function') {
          return '[Function: ' + (value.name || 'anonymous') + ']';
        }

        if (typeof value === 'symbol') {
          return value.toString();
        }

        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        }

        if (value instanceof RegExp) {
          return value.toString();
        }

        if (value instanceof Date) {
          return value.toISOString();
        }

        if (value instanceof Set) {
          return Array.from(value);
        }

        if (value instanceof Map) {
          return Object.fromEntries(value);
        }

        if (typeof value === 'object' && value !== null) {
          if (this.seen.has(value)) {
            return '[Circular]';
          }
          this.seen.add(value);
        }

        return value;
      }, space);
    } catch (err) {
      return '[Stringify Error: ' + (err as Error).message + ']';
    }
  }
}