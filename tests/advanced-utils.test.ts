import { Sampler, AdaptiveSampler } from '../src/utils/sampler';
import { RateLimiter, SlidingWindowRateLimiter } from '../src/utils/rate-limiter';
import { MetricsAggregator } from '../src/utils/metrics-aggregator';

describe('Advanced Utils', () => {
  describe('Sampler', () => {
    it('should sample at specified rate', () => {
      const sampler = new Sampler({ rate: 0.5 });
      
      let sampled = 0;
      const total = 1000;
      
      for (let i = 0; i < total; i++) {
        if (sampler.shouldSample()) {
          sampled++;
        }
      }
      
      // Should be approximately 50%
      expect(sampled).toBeGreaterThan(400);
      expect(sampled).toBeLessThan(600);
    });

    it('should always sample at rate 1', () => {
      const sampler = new Sampler({ rate: 1 });
      
      for (let i = 0; i < 100; i++) {
        expect(sampler.shouldSample()).toBe(true);
      }
    });

    it('should never sample at rate 0', () => {
      const sampler = new Sampler({ rate: 0 });
      
      for (let i = 0; i < 100; i++) {
        expect(sampler.shouldSample()).toBe(false);
      }
    });

    it('should throw on invalid rate', () => {
      expect(() => new Sampler({ rate: -1 })).toThrow();
      expect(() => new Sampler({ rate: 2 })).toThrow();
    });

    it('should reset counter', () => {
      const sampler = new Sampler({ rate: 0.5 });
      sampler.shouldSample();
      sampler.shouldSample();
      sampler.reset();
      // Counter should be reset
    });

    it('should get and set rate', () => {
      const sampler = new Sampler({ rate: 0.5 });
      expect(sampler.getRate()).toBe(0.5);
      
      sampler.setRate(0.7);
      expect(sampler.getRate()).toBe(0.7);
      
      expect(() => sampler.setRate(1.5)).toThrow();
    });
  });

  describe('AdaptiveSampler', () => {
    it('should adjust rate based on throughput', () => {
      const sampler = new AdaptiveSampler({
        rate: 0.5,
        targetRate: 100,
        minRate: 0.1,
        maxRate: 1
      });

      // Simulate high throughput
      for (let i = 0; i < 200; i++) {
        sampler.shouldSample();
      }

      // Rate should decrease
      expect(sampler.getRate()).toBeLessThan(0.5);
    });

    it('should get current throughput', () => {
      const sampler = new AdaptiveSampler({ rate: 1 });
      
      for (let i = 0; i < 10; i++) {
        sampler.shouldSample();
      }
      
      const throughput = sampler.getCurrentThroughput();
      expect(throughput).toBeGreaterThanOrEqual(10);
    });
  });

  describe('RateLimiter', () => {
    it('should limit requests', () => {
      const limiter = new RateLimiter({
        maxPerSecond: 10,
        maxBurst: 5
      });

      let allowed = 0;
      for (let i = 0; i < 20; i++) {
        if (limiter.tryAcquire()) {
          allowed++;
        }
      }

      expect(allowed).toBe(5); // Burst size
      expect(limiter.getDroppedCount()).toBe(15);
    });

    it('should refill tokens over time', (done) => {
      const limiter = new RateLimiter({
        maxPerSecond: 10,
        windowMs: 100
      });

      // Use all tokens
      for (let i = 0; i < 10; i++) {
        limiter.tryAcquire();
      }

      expect(limiter.getAvailableTokens()).toBe(0);

      // Wait for refill
      setTimeout(() => {
        expect(limiter.getAvailableTokens()).toBeGreaterThan(0);
        done();
      }, 150);
    });

    it('should reset dropped count', () => {
      const limiter = new RateLimiter({ maxPerSecond: 1 });
      
      limiter.tryAcquire();
      limiter.tryAcquire(); // Should be dropped
      
      expect(limiter.getDroppedCount()).toBe(1);
      limiter.resetDroppedCount();
      expect(limiter.getDroppedCount()).toBe(0);
    });
  });

  describe('SlidingWindowRateLimiter', () => {
    it('should limit requests in window', () => {
      const limiter = new SlidingWindowRateLimiter({
        maxRequests: 5,
        windowMs: 1000
      });

      let allowed = 0;
      for (let i = 0; i < 10; i++) {
        if (limiter.tryAcquire()) {
          allowed++;
        }
      }

      expect(allowed).toBe(5);
      expect(limiter.getDroppedCount()).toBe(5);
    });

    it('should calculate usage percentage', () => {
      const limiter = new SlidingWindowRateLimiter({
        maxRequests: 10,
        windowMs: 1000
      });

      for (let i = 0; i < 5; i++) {
        limiter.tryAcquire();
      }

      expect(limiter.getCurrentUsage()).toBe(5);
      expect(limiter.getUsagePercentage()).toBe(50);
    });
  });

  describe('MetricsAggregator', () => {
    it('should aggregate metrics', () => {
      const aggregator = new MetricsAggregator();

      aggregator.recordLog({ level: 'info', time: Date.now() });
      aggregator.recordLog({ level: 'error', time: Date.now(), err: { message: 'Test error', name: 'Error' } });
      aggregator.recordLog({ level: 'warn', time: Date.now(), duration: 100 });
      aggregator.recordDropped();

      const snapshot = aggregator.getSnapshot();
      
      expect(snapshot.counts.total).toBe(3);
      expect(snapshot.counts.byLevel.info).toBe(1);
      expect(snapshot.counts.byLevel.error).toBe(1);
      expect(snapshot.counts.errors).toBe(1);
      expect(snapshot.counts.dropped).toBe(1);
      expect(snapshot.performance.avgDuration).toBe(100);
    });

    it('should track top errors', () => {
      const aggregator = new MetricsAggregator();

      for (let i = 0; i < 5; i++) {
        aggregator.recordLog({
          level: 'error',
          time: Date.now(),
          err: { message: 'Database error', name: 'DBError' }
        });
      }

      for (let i = 0; i < 3; i++) {
        aggregator.recordLog({
          level: 'error',
          time: Date.now(),
          err: { message: 'Network error', name: 'NetworkError' }
        });
      }

      const snapshot = aggregator.getSnapshot();
      expect(snapshot.topErrors[0].message).toBe('DBError: Database error');
      expect(snapshot.topErrors[0].count).toBe(5);
    });

    it('should calculate performance percentiles', () => {
      const aggregator = new MetricsAggregator();

      for (let i = 1; i <= 100; i++) {
        aggregator.recordLog({
          level: 'info',
          time: Date.now(),
          duration: i
        });
      }

      const snapshot = aggregator.getSnapshot();
      expect(snapshot.performance.p50Duration).toBe(50);
      expect(snapshot.performance.p95Duration).toBe(95);
      expect(snapshot.performance.p99Duration).toBe(99);
      expect(snapshot.performance.maxDuration).toBe(100);
    });

    it('should export prometheus metrics', () => {
      const aggregator = new MetricsAggregator();

      aggregator.recordLog({ level: 'info', time: Date.now() });
      aggregator.recordLog({ level: 'error', time: Date.now() });

      const prometheus = aggregator.toPrometheus('test');
      
      expect(prometheus).toContain('test_logs_total 2');
      expect(prometheus).toContain('test_logs_by_level_total{level="info"} 1');
      expect(prometheus).toContain('test_logs_by_level_total{level="error"} 1');
    });

    it('should reset metrics', () => {
      const aggregator = new MetricsAggregator();

      aggregator.recordLog({ level: 'info', time: Date.now() });
      aggregator.reset();

      const snapshot = aggregator.getSnapshot();
      expect(snapshot.counts.total).toBe(0);
    });
  });
});