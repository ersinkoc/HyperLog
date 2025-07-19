export interface RateLimiterOptions {
  maxPerSecond: number;
  maxBurst?: number;
  windowMs?: number;
}

export class RateLimiter {
  private maxPerSecond: number;
  private maxBurst: number;
  private windowMs: number;
  private tokens: number;
  private lastRefill: number;
  private dropped: number = 0;

  constructor(options: RateLimiterOptions) {
    this.maxPerSecond = options.maxPerSecond;
    this.maxBurst = options.maxBurst || options.maxPerSecond;
    this.windowMs = options.windowMs || 1000;
    this.tokens = this.maxBurst;
    this.lastRefill = Date.now();
  }

  tryAcquire(): boolean {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    this.dropped++;
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    // Refill tokens proportionally to elapsed time
    const refillAmount = (elapsed / this.windowMs) * this.maxPerSecond;
    if (refillAmount >= 1) {
      const tokensToAdd = Math.floor(refillAmount);
      this.tokens = Math.min(this.maxBurst, this.tokens + tokensToAdd);
      // Update lastRefill only for the tokens we actually added
      this.lastRefill += Math.floor(tokensToAdd * this.windowMs / this.maxPerSecond);
    }
  }

  getDroppedCount(): number {
    return this.dropped;
  }

  resetDroppedCount(): void {
    this.dropped = 0;
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

export class SlidingWindowRateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[] = [];
  private dropped: number = 0;

  constructor(options: { maxRequests: number; windowMs: number }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  tryAcquire(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove old requests
    this.requests = this.requests.filter(time => time > cutoff);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    this.dropped++;
    return false;
  }

  getDroppedCount(): number {
    return this.dropped;
  }

  getCurrentUsage(): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter(time => time > cutoff);
    return this.requests.length;
  }

  getUsagePercentage(): number {
    return (this.getCurrentUsage() / this.maxRequests) * 100;
  }
}