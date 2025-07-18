import { FileRotator } from '../src/rotation/file-rotator';
import * as fs from 'fs';
import * as path from 'path';

describe('FileRotator', () => {
  const testDir = path.join(__dirname, 'test-rotation');
  const testFile = path.join(testDir, 'test.log');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.readdirSync(testDir).forEach(file => {
        fs.unlinkSync(path.join(testDir, file));
      });
      fs.rmdirSync(testDir);
    }
  });

  describe('basic functionality', () => {
    it('should get filename without date pattern', () => {
      const rotator = new FileRotator({ filename: testFile });
      const filename = rotator.getFilename();
      expect(filename).toBe(testFile);
    });

    it('should get filename with date pattern', () => {
      const rotator = new FileRotator({
        filename: testFile,
        datePattern: 'YYYY-MM-DD'
      });
      const filename = rotator.getFilename();
      expect(filename).toMatch(/test-\d{4}-\d{2}-\d{2}\.log$/);
    });

    it('should format date correctly', () => {
      const rotator = new FileRotator({
        filename: testFile,
        datePattern: 'YYYY-MM-DD-HH'
      });
      const filename = rotator.getFilename();
      expect(filename).toMatch(/test-\d{4}-\d{2}-\d{2}-\d{2}\.log$/);
    });
  });

  describe('rotation', () => {
    it('should rotate file', async () => {
      const rotator = new FileRotator({ filename: testFile });
      
      // Create initial file
      fs.writeFileSync(testFile, 'test content');
      
      await rotator.rotate();
      
      // Original file should not exist
      expect(fs.existsSync(testFile)).toBe(false);
      
      // Rotated file should exist
      const files = fs.readdirSync(testDir);
      const rotatedFiles = files.filter(f => f.startsWith('test.') && f.endsWith('.log'));
      expect(rotatedFiles.length).toBe(1);
    });

    it('should check if rotation is needed based on date', () => {
      const rotator = new FileRotator({
        filename: testFile,
        datePattern: 'YYYY-MM-DD'
      });
      
      // Initial check should be false
      expect(rotator.needsRotation()).toBe(false);
      
      // Force date change
      (rotator as any).currentDate = '2020-01-01';
      expect(rotator.needsRotation()).toBe(true);
    });
  });

  describe('file operations', () => {
    it('should handle rotation errors gracefully', async () => {
      const rotator = new FileRotator({ filename: testFile });
      
      // Try to rotate non-existent file
      await expect(rotator.rotate()).resolves.not.toThrow();
    });

    it('should parse max files as number', () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: 5
      });
      
      const parsed = (rotator as any).parseMaxFiles(5);
      expect(parsed).toBe(5);
    });

    it('should parse max files as days string', () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: '7d'
      });
      
      const parsed = (rotator as any).parseMaxFiles('7d');
      expect(parsed).toBe(7 * 24); // 7 days * 24 hours
    });

    it('should parse max files as numeric string', () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: '10'
      });
      
      const parsed = (rotator as any).parseMaxFiles('10');
      expect(parsed).toBe(10);
    });
  });

  describe('compression', () => {
    it('should compress file when option enabled', async () => {
      const rotator = new FileRotator({
        filename: testFile,
        compress: true
      });
      
      // Create a file to compress
      const testContent = 'This is test content for compression'.repeat(100);
      fs.writeFileSync(testFile, testContent);
      
      // Mock the compressFile method to test it's called
      const compressSpy = jest.spyOn(rotator as any, 'compressFile').mockResolvedValue(undefined);
      
      await rotator.rotate();
      
      expect(compressSpy).toHaveBeenCalled();
      compressSpy.mockRestore();
    });

    it('should handle compression errors', async () => {
      const rotator = new FileRotator({
        filename: testFile,
        compress: true
      });
      
      // Create test file
      fs.writeFileSync(testFile, 'test content');
      
      // Mock compression to fail
      const mockError = new Error('Compression failed');
      jest.spyOn(rotator as any, 'compressFile').mockRejectedValue(mockError);
      
      // Should not throw
      await expect(rotator.rotate()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup old files based on count', async () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: 2
      });
      
      // Create multiple rotated files with different timestamps
      const now = Date.now();
      fs.writeFileSync(path.join(testDir, 'test.1.log'), 'old1');
      fs.utimesSync(path.join(testDir, 'test.1.log'), (now - 4000) / 1000, (now - 4000) / 1000);
      
      fs.writeFileSync(path.join(testDir, 'test.2.log'), 'old2');
      fs.utimesSync(path.join(testDir, 'test.2.log'), (now - 3000) / 1000, (now - 3000) / 1000);
      
      fs.writeFileSync(path.join(testDir, 'test.3.log'), 'old3');
      fs.utimesSync(path.join(testDir, 'test.3.log'), (now - 2000) / 1000, (now - 2000) / 1000);
      
      fs.writeFileSync(path.join(testDir, 'test.4.log'), 'old4');
      fs.utimesSync(path.join(testDir, 'test.4.log'), (now - 1000) / 1000, (now - 1000) / 1000);
      
      await (rotator as any).cleanup();
      
      const files = fs.readdirSync(testDir);
      const logFiles = files.filter(f => f.match(/test\.\d+\.log$/));
      expect(logFiles.length).toBe(2); // Should keep only 2 most recent
      expect(files).toContain('test.3.log'); // More recent files
      expect(files).toContain('test.4.log'); // Most recent file
    });

    it('should cleanup old files based on date (days)', async () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: '2d' // Keep files from last 2 days (48 hours)
      });
      
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
      
      // Create files with different timestamps
      fs.writeFileSync(path.join(testDir, 'test.1.log'), 'recent');
      fs.utimesSync(path.join(testDir, 'test.1.log'), oneDayAgo / 1000, oneDayAgo / 1000);
      
      fs.writeFileSync(path.join(testDir, 'test.2.log'), 'old');
      fs.utimesSync(path.join(testDir, 'test.2.log'), threeDaysAgo / 1000, threeDaysAgo / 1000);
      
      await (rotator as any).cleanup();
      
      const files = fs.readdirSync(testDir);
      expect(files).toContain('test.1.log'); // Recent file kept
      expect(files).not.toContain('test.2.log'); // Old file deleted
    });

    it('should handle cleanup errors gracefully', async () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: 1
      });
      
      // Create a file
      fs.writeFileSync(path.join(testDir, 'test.1.log'), 'content');
      
      // Mock fs.unlink to fail
      const originalUnlink = fs.promises.unlink;
      (fs.promises as any).unlink = jest.fn().mockRejectedValue(new Error('Delete failed'));
      
      // Should not throw
      await expect((rotator as any).cleanup()).resolves.not.toThrow();
      
      // Restore
      (fs.promises as any).unlink = originalUnlink;
    });

    it('should ignore non-matching files during cleanup', async () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: 1
      });
      
      // Create various files
      fs.writeFileSync(path.join(testDir, 'test.1.log'), 'match');
      fs.writeFileSync(path.join(testDir, 'other.log'), 'no match');
      fs.writeFileSync(path.join(testDir, 'test.txt'), 'wrong extension');
      
      await (rotator as any).cleanup();
      
      const files = fs.readdirSync(testDir);
      expect(files).toContain('test.1.log');
      expect(files).toContain('other.log'); // Not deleted
      expect(files).toContain('test.txt'); // Not deleted
    });
  });

  describe('edge cases', () => {
    it('should handle needsRotation when currentDate is same', () => {
      const rotator = new FileRotator({
        filename: testFile,
        datePattern: 'YYYY-MM-DD'
      });
      
      const formatted = (rotator as any).formatDate(new Date(), 'YYYY-MM-DD');
      (rotator as any).currentDate = formatted;
      
      expect(rotator.needsRotation()).toBe(false);
    });

    it('should create numbered rotation files', async () => {
      const rotator = new FileRotator({ filename: testFile });
      
      // Create initial file
      fs.writeFileSync(testFile, 'content1');
      await rotator.rotate();
      
      // Create another and rotate
      fs.writeFileSync(testFile, 'content2');
      await rotator.rotate();
      
      const files = fs.readdirSync(testDir);
      expect(files).toContain('test.1.log');
      expect(files).toContain('test.2.log');
    });

    it('should handle parseMaxFiles with non-numeric suffix', () => {
      const rotator = new FileRotator({
        filename: testFile,
        maxFiles: '7x' // Invalid suffix
      });
      
      const parsed = (rotator as any).parseMaxFiles('7x');
      expect(parsed).toBe(7); // Should parse the numeric part
    });
  });
});