import { promises as fs } from 'fs';
import { dirname, basename, extname, join } from 'path';
import { createGzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface FileRotatorOptions {
  filename: string;
  maxSize?: string;
  maxFiles?: number | string;
  compress?: boolean;
  datePattern?: string;
  compressionLevel?: number;
}

export class FileRotator {
  private options: FileRotatorOptions;
  private currentDate?: string;

  constructor(options: FileRotatorOptions) {
    this.options = options;
    this.updateCurrentDate();
  }

  getFilename(): string {
    if (this.options.datePattern) {
      return this.getDateBasedFilename();
    }
    return this.options.filename;
  }

  private getDateBasedFilename(): string {
    const date = this.formatDate(new Date(), this.options.datePattern!);
    const dir = dirname(this.options.filename);
    const base = basename(this.options.filename);
    const ext = extname(base);
    const name = base.slice(0, -ext.length);
    
    return join(dir, `${name}-${date}${ext}`);
  }

  private formatDate(date: Date, pattern: string): string {
    if (!pattern) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    return pattern
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour);
  }

  async rotate(): Promise<void> {
    const filename = this.getFilename();
    
    try {
      // Check if file exists before attempting rotation
      if (!(await this.fileExists(filename))) {
        return;
      }
      
      const rotatedName = await this.getRotatedFilename(filename);
      await fs.rename(filename, rotatedName);
      
      if (this.options.compress) {
        await this.compressFile(rotatedName);
        await fs.unlink(rotatedName);
      }
      
      await this.cleanup();
    } catch (err) {
      console.error('Rotation error:', err);
    }
  }

  private async getRotatedFilename(filename: string): Promise<string> {
    const dir = dirname(filename);
    const base = basename(filename);
    const ext = extname(base);
    const name = base.slice(0, -ext.length);
    
    let counter = 1;
    let rotatedName: string;
    
    do {
      rotatedName = join(dir, `${name}.${counter}${ext}`);
      counter++;
    } while (await this.fileExists(rotatedName) || await this.fileExists(rotatedName + '.gz'));
    
    return rotatedName;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async compressFile(filename: string): Promise<void> {
    const gzip = createGzip({ level: this.options.compressionLevel || 6 });
    const source = createReadStream(filename);
    const destination = createWriteStream(filename + '.gz');
    
    await pipeline(source, gzip, destination);
  }

  private async cleanup(): Promise<void> {
    if (!this.options.maxFiles) return;

    const dir = dirname(this.options.filename);
    const base = basename(this.options.filename);
    const namePattern = base.replace(extname(base), '');

    const files = await fs.readdir(dir);
    const logFiles = files
      .filter(f => f.startsWith(namePattern) && (f.endsWith('.log') || f.endsWith('.log.gz')))
      .map(f => join(dir, f));

    const fileStats = await Promise.all(
      logFiles.map(async f => ({
        path: f,
        mtime: (await fs.stat(f)).mtime
      }))
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Check if maxFiles is a days string (e.g., '2d')
    if (typeof this.options.maxFiles === 'string' && this.options.maxFiles.endsWith('d')) {
      const match = this.options.maxFiles.match(/^(\d+)d$/);
      if (match) {
        const days = parseInt(match[1]);
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filesToDelete = fileStats.filter(f => f.mtime.getTime() < cutoff);
        await Promise.all(filesToDelete.map(f => fs.unlink(f.path)));
        return;
      }
    }

    // Otherwise use numeric maxFiles as count
    const maxFiles = this.parseMaxFiles(this.options.maxFiles);
    const filesToDelete = fileStats.slice(maxFiles);
    await Promise.all(filesToDelete.map(f => fs.unlink(f.path)));
  }

  private parseMaxFiles(maxFiles: number | string): number {
    if (typeof maxFiles === 'number') {
      return maxFiles;
    }

    const match = maxFiles.match(/^(\d+)d$/);
    if (match) {
      // Keep files from last N days
      const days = parseInt(match[1]);
      return days * 24; // Rough estimate assuming hourly rotation
    }

    return parseInt(maxFiles) || 10;
  }

  private updateCurrentDate(): void {
    if (this.options.datePattern) {
      this.currentDate = this.formatDate(new Date(), this.options.datePattern);
    }
  }

  needsRotation(): boolean {
    if (!this.options.datePattern) return false;
    
    const newDate = this.formatDate(new Date(), this.options.datePattern);
    if (newDate !== this.currentDate) {
      this.currentDate = newDate;
      return true;
    }
    
    return false;
  }
}