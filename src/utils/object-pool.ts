export interface Poolable {
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private size: number;
  private factory: () => T;
  private activeCount: number = 0;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number = 10, maxSize: number = 1000) {
    this.factory = factory;
    this.size = initialSize;
    this.maxSize = maxSize;
    
    // Pre-fill the pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    let obj: T;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else if (this.activeCount < this.maxSize) {
      obj = this.factory();
    } else {
      // Pool exhausted, create new object but warn
      console.warn('Object pool exhausted, creating new object');
      obj = this.factory();
    }
    
    this.activeCount++;
    return obj;
  }

  release(obj: T): void {
    if (!obj) return;
    
    obj.reset();
    this.activeCount--;
    
    if (this.pool.length < this.size) {
      this.pool.push(obj);
    }
    // If pool is full, let the object be garbage collected
  }

  clear(): void {
    this.pool = [];
    this.activeCount = 0;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  resize(newSize: number): void {
    if (newSize < this.pool.length) {
      // Shrink pool
      this.pool.splice(newSize);
    } else if (newSize > this.pool.length) {
      // Grow pool
      const toAdd = newSize - this.pool.length;
      for (let i = 0; i < toAdd; i++) {
        this.pool.push(this.factory());
      }
    }
    this.size = newSize;
  }
}

// Example poolable log entry
export class PoolableLogEntry implements Poolable {
  level?: string;
  time?: number;
  msg?: string;
  [key: string]: any;

  reset(): void {
    // Clear all properties
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        delete this[key];
      }
    }
  }
}