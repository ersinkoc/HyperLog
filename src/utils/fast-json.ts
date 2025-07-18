export class FastJSON {
  private static readonly stringCache = new Map<string, string>();
  private static readonly cacheSize = 1000;

  stringify(obj: any): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    
    const type = typeof obj;
    
    switch (type) {
      case 'string':
        return this.stringifyString(obj);
      case 'number':
        return this.stringifyNumber(obj);
      case 'boolean':
        return obj ? 'true' : 'false';
      case 'object':
        if (obj instanceof Date) {
          return `"${obj.toISOString()}"`;
        }
        if (Array.isArray(obj)) {
          return this.stringifyArray(obj);
        }
        return this.stringifyObject(obj);
      default:
        return `"${String(obj)}"`;
    }
  }

  private stringifyString(str: string): string {
    // Check cache first
    const cached = FastJSON.stringCache.get(str);
    if (cached) return cached;

    // Fast path for strings without special characters
    if (!/[\\"\\n\\r\\t\\b\\f]/.test(str)) {
      const result = `"${str}"`;
      this.addToCache(str, result);
      return result;
    }

    // Escape special characters
    let result = '"';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      switch (char) {
        case '"': result += '\\"'; break;
        case '\\': result += '\\\\'; break;
        case '\n': result += '\\n'; break;
        case '\r': result += '\\r'; break;
        case '\t': result += '\\t'; break;
        case '\b': result += '\\b'; break;
        case '\f': result += '\\f'; break;
        default: result += char;
      }
    }
    result += '"';
    
    this.addToCache(str, result);
    return result;
  }

  private stringifyNumber(num: number): string {
    if (Number.isFinite(num)) {
      return String(num);
    }
    return 'null';
  }

  private stringifyArray(arr: any[]): string {
    if (arr.length === 0) return '[]';
    
    let result = '[';
    for (let i = 0; i < arr.length; i++) {
      if (i > 0) result += ',';
      result += this.stringify(arr[i]);
    }
    result += ']';
    
    return result;
  }

  private stringifyObject(obj: Record<string, any>): string {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    
    let result = '{';
    let first = true;
    
    // Common log fields first for better performance
    const priorityFields = ['level', 'time', 'msg', 'name', 'hostname', 'pid'];
    
    for (const field of priorityFields) {
      if (field in obj && obj[field] !== undefined) {
        if (!first) result += ',';
        result += `"${field}":${this.stringify(obj[field])}`;
        first = false;
      }
    }
    
    // Then other fields
    for (const key of keys) {
      if (!priorityFields.includes(key) && obj[key] !== undefined) {
        if (!first) result += ',';
        result += `"${key}":${this.stringify(obj[key])}`;
        first = false;
      }
    }
    
    result += '}';
    return result;
  }

  private addToCache(key: string, value: string): void {
    if (FastJSON.stringCache.size >= FastJSON.cacheSize) {
      // Simple LRU: clear half the cache when full
      const toDelete = Math.floor(FastJSON.cacheSize / 2);
      const keys = Array.from(FastJSON.stringCache.keys());
      for (let i = 0; i < toDelete; i++) {
        FastJSON.stringCache.delete(keys[i]);
      }
    }
    FastJSON.stringCache.set(key, value);
  }

  static clearCache(): void {
    FastJSON.stringCache.clear();
  }
}