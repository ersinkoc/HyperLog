import { LogEntry, LogLevel } from '../core/types';

export interface MetricsSnapshot {
  timestamp: number;
  duration: number;
  counts: {
    total: number;
    byLevel: Record<LogLevel, number>;
    errors: number;
    dropped: number;
  };
  performance: {
    avgDuration?: number;
    p50Duration?: number;
    p95Duration?: number;
    p99Duration?: number;
    maxDuration?: number;
  };
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: number;
  }>;
  throughput: {
    current: number;
    avg: number;
    max: number;
  };
}

export class MetricsAggregator {
  private startTime: number;
  private counts: Record<LogLevel, number> = {
    trace: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0
  };
  private totalCount: number = 0;
  private errorCount: number = 0;
  private droppedCount: number = 0;
  private durations: number[] = [];
  private errorMessages: Map<string, { count: number; lastSeen: number }> = new Map();
  private throughputWindow: number[] = [];
  private maxThroughput: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  recordLog(entry: LogEntry): void {
    this.totalCount++;
    this.counts[entry.level]++;

    if (entry.level === 'error' || entry.level === 'fatal') {
      this.errorCount++;
      
      if (entry.err?.message) {
        const errorKey = `${entry.err.name || 'Error'}: ${entry.err.message}`;
        const existing = this.errorMessages.get(errorKey);
        if (existing) {
          existing.count++;
          existing.lastSeen = Date.now();
        } else {
          this.errorMessages.set(errorKey, { count: 1, lastSeen: Date.now() });
        }
      }
    }

    if (entry.duration !== undefined) {
      this.durations.push(entry.duration);
    }

    // Track throughput
    const now = Date.now();
    this.throughputWindow.push(now);
    
    // Clean old entries (keep 1 second window)
    const cutoff = now - 1000;
    this.throughputWindow = this.throughputWindow.filter(t => t > cutoff);
    
    if (this.throughputWindow.length > this.maxThroughput) {
      this.maxThroughput = this.throughputWindow.length;
    }
  }

  recordDropped(): void {
    this.droppedCount++;
  }

  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const duration = now - this.startTime;
    
    // Calculate performance metrics
    const sortedDurations = [...this.durations].sort((a, b) => a - b);
    const performance: MetricsSnapshot['performance'] = {};
    
    if (sortedDurations.length > 0) {
      performance.avgDuration = sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length;
      performance.p50Duration = this.percentile(sortedDurations, 0.5);
      performance.p95Duration = this.percentile(sortedDurations, 0.95);
      performance.p99Duration = this.percentile(sortedDurations, 0.99);
      performance.maxDuration = sortedDurations[sortedDurations.length - 1];
    }

    // Get top errors
    const topErrors = Array.from(this.errorMessages.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate throughput
    const avgThroughput = this.totalCount / (duration / 1000);

    const snapshot = {
      timestamp: now,
      duration,
      counts: {
        total: this.totalCount,
        byLevel: { ...this.counts },
        errors: this.errorCount,
        dropped: this.droppedCount
      },
      performance,
      topErrors,
      throughput: {
        current: this.throughputWindow.length,
        avg: Math.round(avgThroughput),
        max: this.maxThroughput
      }
    };
    
    // Reset metrics after snapshot
    this.reset();
    
    return snapshot;
  }

  reset(): void {
    this.startTime = Date.now();
    this.counts = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0
    };
    this.totalCount = 0;
    this.errorCount = 0;
    this.droppedCount = 0;
    this.durations = [];
    this.errorMessages.clear();
    this.throughputWindow = [];
    this.maxThroughput = 0;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  // Export metrics in Prometheus format
  toPrometheus(prefix: string = 'hyperlog'): string {
    // Save durations before getSnapshot resets them
    const durationsSum = this.durations.reduce((a, b) => a + b, 0);
    const durationsCount = this.durations.length;
    
    const snapshot = this.getSnapshot();
    const lines: string[] = [];

    // Log counts
    lines.push(`# HELP ${prefix}_logs_total Total number of logs`);
    lines.push(`# TYPE ${prefix}_logs_total counter`);
    lines.push(`${prefix}_logs_total ${snapshot.counts.total}`);

    // By level
    lines.push(`# HELP ${prefix}_logs_by_level_total Number of logs by level`);
    lines.push(`# TYPE ${prefix}_logs_by_level_total counter`);
    for (const [level, count] of Object.entries(snapshot.counts.byLevel)) {
      lines.push(`${prefix}_logs_by_level_total{level="${level}"} ${count}`);
    }

    // Errors
    lines.push(`# HELP ${prefix}_errors_total Total number of errors`);
    lines.push(`# TYPE ${prefix}_errors_total counter`);
    lines.push(`${prefix}_errors_total ${snapshot.counts.errors}`);

    // Dropped
    lines.push(`# HELP ${prefix}_dropped_total Total number of dropped logs`);
    lines.push(`# TYPE ${prefix}_dropped_total counter`);
    lines.push(`${prefix}_dropped_total ${snapshot.counts.dropped}`);

    // Performance metrics
    if (snapshot.performance.avgDuration !== undefined) {
      lines.push(`# HELP ${prefix}_duration_milliseconds Log operation duration`);
      lines.push(`# TYPE ${prefix}_duration_milliseconds summary`);
      lines.push(`${prefix}_duration_milliseconds{quantile="0.5"} ${snapshot.performance.p50Duration}`);
      lines.push(`${prefix}_duration_milliseconds{quantile="0.95"} ${snapshot.performance.p95Duration}`);
      lines.push(`${prefix}_duration_milliseconds{quantile="0.99"} ${snapshot.performance.p99Duration}`);
      lines.push(`${prefix}_duration_milliseconds_sum ${durationsSum}`);
      lines.push(`${prefix}_duration_milliseconds_count ${durationsCount}`);
    }

    // Throughput
    lines.push(`# HELP ${prefix}_throughput_current Current logs per second`);
    lines.push(`# TYPE ${prefix}_throughput_current gauge`);
    lines.push(`${prefix}_throughput_current ${snapshot.throughput.current}`);

    return lines.join('\n');
  }
}