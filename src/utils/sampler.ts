export interface SamplerOptions {
  rate: number; // Sampling rate between 0 and 1
  seed?: number; // Optional seed for deterministic sampling
}

export class Sampler {
  private rate: number;
  private counter: number = 0;
  private seed: number;

  constructor(options: SamplerOptions) {
    if (options.rate < 0 || options.rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
    
    this.rate = options.rate;
    this.seed = options.seed || Date.now();
  }

  shouldSample(): boolean {
    if (this.rate === 1) return true;
    if (this.rate === 0) return false;

    // Simple deterministic sampling based on counter
    this.counter++;
    const threshold = Math.floor(1 / this.rate);
    return (this.counter + this.seed) % threshold === 0;
  }

  reset(): void {
    this.counter = 0;
  }

  getRate(): number {
    return this.rate;
  }

  setRate(rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
    this.rate = rate;
  }
}

export class AdaptiveSampler extends Sampler {
  private window: number[] = [];
  private windowSize: number;
  private targetRate: number;
  private minRate: number;
  private maxRate: number;

  constructor(options: SamplerOptions & {
    windowSize?: number;
    targetRate?: number;
    minRate?: number;
    maxRate?: number;
  }) {
    super(options);
    this.windowSize = options.windowSize || 1000;
    this.targetRate = options.targetRate || 1000; // logs per second
    this.minRate = options.minRate || 0.001;
    this.maxRate = options.maxRate || 1;
  }

  shouldSample(): boolean {
    const now = Date.now();
    this.window.push(now);

    // Remove old entries outside the window
    const cutoff = now - 1000; // 1 second window
    while (this.window.length > 0 && this.window[0] < cutoff) {
      this.window.shift();
    }

    // Adjust rate based on current throughput
    if (this.window.length > this.targetRate) {
      // Too many logs, decrease sampling rate
      this.setRate(Math.max(this.minRate, this.getRate() * 0.9));
    } else if (this.window.length < this.targetRate * 0.8) {
      // Too few logs, increase sampling rate
      this.setRate(Math.min(this.maxRate, this.getRate() * 1.1));
    }

    return super.shouldSample();
  }

  getCurrentThroughput(): number {
    const now = Date.now();
    const cutoff = now - 1000;
    const recentLogs = this.window.filter(t => t >= cutoff);
    return recentLogs.length;
  }
}