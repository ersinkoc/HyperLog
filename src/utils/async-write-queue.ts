export interface QueueItem {
  data: string;
  size: number;
}

export interface AsyncWriteQueueOptions {
  highWaterMark?: number;
  concurrency?: number;
}

export class AsyncWriteQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private highWaterMark: number;
  private concurrency: number;
  private activeCount: number = 0;
  private drainCallbacks: (() => void)[] = [];

  constructor(options: AsyncWriteQueueOptions = {}) {
    this.highWaterMark = options.highWaterMark || 1000;
    this.concurrency = options.concurrency || 1;
  }

  enqueue(item: QueueItem): boolean {
    this.queue.push(item);
    return this.queue.length < this.highWaterMark;
  }

  async process(handler: (item: QueueItem) => Promise<void>): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const promises: Promise<void>[] = [];
    
    while (this.queue.length > 0 && this.activeCount < this.concurrency) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeCount++;
      const promise = handler(item)
        .catch(err => console.error('Queue processing error:', err))
        .finally(() => {
          this.activeCount--;
          if (this.queue.length === 0 && this.activeCount === 0) {
            this.notifyDrain();
          }
        });
      promises.push(promise);
    }

    this.processing = false;
    await Promise.all(promises);
  }

  async drain(): Promise<void> {
    if (this.queue.length === 0 && this.activeCount === 0) {
      return;
    }

    return new Promise(resolve => {
      this.drainCallbacks.push(resolve);
    });
  }

  private notifyDrain(): void {
    const callbacks = this.drainCallbacks.slice();
    this.drainCallbacks = [];
    callbacks.forEach(cb => cb());
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}