#!/usr/bin/env node

import { readFileSync, createReadStream } from 'fs';
import { createInterface } from 'readline';

const COMMANDS = {
  pretty: 'Pretty print JSON log files',
  tail: 'Tail log files with optional filtering',
  analyze: 'Analyze log patterns and statistics',
  convert: 'Convert between log formats',
  merge: 'Merge multiple log files',
  extract: 'Extract logs by time range',
  perf: 'Performance analysis'
};

class LogCLI {
  private args: string[];
  private command: string;

  constructor() {
    this.args = process.argv.slice(2);
    this.command = this.args[0] || 'help';
  }

  async run(): Promise<void> {
    try {
      switch (this.command) {
        case 'pretty':
          await this.pretty();
          break;
        case 'tail':
          await this.tail();
          break;
        case 'analyze':
          await this.analyze();
          break;
        case 'convert':
          await this.convert();
          break;
        case 'merge':
          await this.merge();
          break;
        case 'extract':
          await this.extract();
          break;
        case 'perf':
          await this.perf();
          break;
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;
        default:
          console.error(`Unknown command: ${this.command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log('HyperLog CLI - Log file manipulation and analysis tool\n');
    console.log('Usage: hyperlog <command> [options]\n');
    console.log('Commands:');
    
    Object.entries(COMMANDS).forEach(([cmd, desc]) => {
      console.log(`  ${cmd.padEnd(10)} ${desc}`);
    });
    
    console.log('\nExamples:');
    console.log('  hyperlog pretty app.log');
    console.log('  hyperlog tail -f app.log --level error');
    console.log('  hyperlog analyze app.log --top-errors');
    console.log('  hyperlog convert app.log --from json --to csv');
  }

  private async pretty(): Promise<void> {
    const filename = this.args[1];
    if (!filename) {
      throw new Error('Filename required');
    }

    const rl = createInterface({
      input: createReadStream(filename),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        console.log(this.formatPretty(entry));
      } catch {
        // Not JSON, print as-is
        console.log(line);
      }
    }
  }

  private formatPretty(entry: any): string {
    const time = entry.time ? new Date(entry.time).toISOString() : '';
    const level = (entry.level || 'info').toUpperCase().padEnd(5);
    const msg = entry.msg || '';
    
    const levelColors = {
      TRACE: '\x1b[90m',
      DEBUG: '\x1b[36m',
      INFO: '\x1b[32m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      FATAL: '\x1b[35m'
    };
    
    const color = levelColors[level.trim() as keyof typeof levelColors] || '';
    const reset = '\x1b[0m';
    
    let output = `\x1b[90m${time}${reset} ${color}${level}${reset} ${msg}`;
    
    // Add additional fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { time: _, level: __, msg: ___, err, ...rest } = entry;
    
    if (Object.keys(rest).length > 0) {
      const fields = Object.entries(rest)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      output += ` ${fields}`;
    }
    
    if (err) {
      output += `\n${color}${err.name || 'Error'}: ${err.message || ''}${reset}`;
      if (err.stack) {
        output += `\n\x1b[90m${err.stack}${reset}`;
      }
    }
    
    return output;
  }

  private async tail(): Promise<void> {
    const filename = this.args[1];
    if (!filename) {
      throw new Error('Filename required');
    }

    const follow = this.args.includes('-f') || this.args.includes('--follow');
    const levelFilter = this.getOption('--level');
    const grepFilter = this.getOption('--grep');
    const lines = parseInt(this.getOption('--lines') || '10');

    // Read last N lines
    const allLines = readFileSync(filename, 'utf-8').split('\n').filter(l => l);
    const lastLines = allLines.slice(-lines);

    lastLines.forEach(line => {
      if (this.matchesFilters(line, levelFilter, grepFilter)) {
        this.printLine(line);
      }
    });

    if (follow) {
      // TODO: Implement file following with fs.watch
      console.log('\nFollowing file... (Press Ctrl+C to stop)');
    }
  }

  private async analyze(): Promise<void> {
    const filename = this.args[1];
    if (!filename) {
      throw new Error('Filename required');
    }

    const stats = {
      total: 0,
      levels: {} as Record<string, number>,
      errors: {} as Record<string, number>,
      timing: [] as number[],
      hourly: {} as Record<string, number>
    };

    const rl = createInterface({
      input: createReadStream(filename),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        stats.total++;
        
        // Count by level
        stats.levels[entry.level] = (stats.levels[entry.level] || 0) + 1;
        
        // Count errors
        if (entry.err) {
          const errorKey = `${entry.err.name}: ${entry.err.message}`;
          stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
        }
        
        // Timing stats
        if (entry.duration) {
          stats.timing.push(entry.duration);
        }
        
        // Hourly distribution
        if (entry.time) {
          const hour = new Date(entry.time).getHours();
          stats.hourly[hour] = (stats.hourly[hour] || 0) + 1;
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    this.printAnalysis(stats);
  }

  private printAnalysis(stats: any): void {
    console.log('\n=== Log Analysis ===\n');
    console.log(`Total entries: ${stats.total}`);
    
    console.log('\nLevel distribution:');
    Object.entries(stats.levels).forEach(([level, count]) => {
      const percent = ((count as number) / stats.total * 100).toFixed(1);
      console.log(`  ${level}: ${count} (${percent}%)`);
    });
    
    if (Object.keys(stats.errors).length > 0) {
      console.log('\nTop errors:');
      const sortedErrors = Object.entries(stats.errors)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 10);
      
      sortedErrors.forEach(([error, count]) => {
        console.log(`  ${count}x ${error}`);
      });
    }
    
    if (stats.timing.length > 0) {
      const sorted = stats.timing.sort((a: number, b: number) => a - b);
      console.log('\nPerformance timing:');
      console.log(`  Min: ${sorted[0]}ms`);
      console.log(`  Max: ${sorted[sorted.length - 1]}ms`);
      console.log(`  Avg: ${(sorted.reduce((a: number, b: number) => a + b) / sorted.length).toFixed(1)}ms`);
      console.log(`  P50: ${sorted[Math.floor(sorted.length * 0.5)]}ms`);
      console.log(`  P95: ${sorted[Math.floor(sorted.length * 0.95)]}ms`);
      console.log(`  P99: ${sorted[Math.floor(sorted.length * 0.99)]}ms`);
    }
  }

  private async convert(): Promise<void> {
    const filename = this.args[1];
    if (!filename) {
      throw new Error('Filename required');
    }

    const to = this.getOption('--to') || 'csv';

    if (to === 'csv') {
      // CSV header
      console.log('time,level,name,hostname,pid,msg');
      
      const rl = createInterface({
        input: createReadStream(filename),
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const entry = JSON.parse(line);
          const csv = [
            entry.time ? new Date(entry.time).toISOString() : '',
            entry.level || '',
            entry.name || '',
            entry.hostname || '',
            entry.pid || '',
            this.escapeCSV(entry.msg || '')
          ].join(',');
          console.log(csv);
        } catch {
          // Skip non-JSON
        }
      }
    }
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async merge(): Promise<void> {
    const files = this.args.slice(1).filter(arg => !arg.startsWith('--'));
    const sort = this.getOption('--sort') === 'time';

    if (files.length < 2) {
      throw new Error('At least 2 files required');
    }

    const entries: any[] = [];

    for (const file of files) {
      const rl = createInterface({
        input: createReadStream(file),
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip non-JSON
        }
      }
    }

    if (sort) {
      entries.sort((a, b) => (a.time || 0) - (b.time || 0));
    }

    entries.forEach(entry => {
      console.log(JSON.stringify(entry));
    });
  }

  private async extract(): Promise<void> {
    const filename = this.args[1];
    if (!filename) {
      throw new Error('Filename required');
    }

    const from = this.getOption('--from');
    const to = this.getOption('--to');

    if (!from || !to) {
      throw new Error('--from and --to dates required');
    }

    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();

    const rl = createInterface({
      input: createReadStream(filename),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        if (entry.time >= fromTime && entry.time <= toTime) {
          console.log(line);
        }
      } catch {
        // Skip non-JSON
      }
    }
  }

  private async perf(): Promise<void> {
    const filename = this.args[1];
    if (!filename) {
      throw new Error('Filename required');
    }

    const slowThreshold = parseInt(this.getOption('--slow') || '1000');
    const slowQueries: any[] = [];
    const responseTimes: number[] = [];

    const rl = createInterface({
      input: createReadStream(filename),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        
        if (entry.duration) {
          responseTimes.push(entry.duration);
          
          if (entry.duration > slowThreshold) {
            slowQueries.push(entry);
          }
        }
      } catch {
        // Skip non-JSON
      }
    }

    console.log('\n=== Performance Analysis ===\n');
    
    if (slowQueries.length > 0) {
      console.log(`Slow operations (>${slowThreshold}ms): ${slowQueries.length}`);
      slowQueries.slice(0, 10).forEach(entry => {
        console.log(`  ${entry.duration}ms - ${entry.msg || 'No message'}`);
      });
    }

    if (responseTimes.length > 0) {
      const histogram = this.createHistogram(responseTimes);
      console.log('\nResponse time distribution:');
      histogram.forEach(({ range, count, bar }) => {
        console.log(`  ${range.padEnd(10)} ${bar} ${count}`);
      });
    }
  }

  private createHistogram(values: number[]): any[] {
    const buckets = [0, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const counts: Record<string, number> = {};
    
    values.forEach(value => {
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (value >= buckets[i]) {
          const range = i === buckets.length - 1 
            ? `${buckets[i]}+ms` 
            : `${buckets[i]}-${buckets[i + 1]}ms`;
          counts[range] = (counts[range] || 0) + 1;
          break;
        }
      }
    });

    const maxCount = Math.max(...Object.values(counts));
    const barWidth = 40;

    return Object.entries(counts).map(([range, count]) => ({
      range,
      count,
      bar: '█'.repeat(Math.ceil(count / maxCount * barWidth))
    }));
  }

  private matchesFilters(line: string, level?: string, grep?: string): boolean {
    if (level) {
      try {
        const entry = JSON.parse(line);
        if (entry.level !== level) return false;
      } catch {
        return false;
      }
    }

    if (grep && !line.includes(grep)) {
      return false;
    }

    return true;
  }

  private printLine(line: string): void {
    try {
      const entry = JSON.parse(line);
      console.log(this.formatPretty(entry));
    } catch {
      console.log(line);
    }
  }

  private getOption(name: string): string | undefined {
    const index = this.args.indexOf(name);
    if (index !== -1 && index + 1 < this.args.length) {
      return this.args[index + 1];
    }
    return undefined;
  }
}

// Run CLI
const cli = new LogCLI();
cli.run().catch(console.error);