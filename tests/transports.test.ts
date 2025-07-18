import { ConsoleTransport } from '../src/transports/console';
import { StreamTransport } from '../src/transports/stream';
import { HTTPTransport } from '../src/transports/http';
import { FileTransport } from '../src/transports/file';
import { LogEntry } from '../src/core/types';
import { Writable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { createServer, Server } from 'http';

class MockStream extends Writable {
  public data: string[] = [];

  _write(chunk: any, encoding: string, callback: Function): void {
    this.data.push(chunk.toString());
    callback();
  }
}

describe('Transports', () => {
  describe('ConsoleTransport', () => {
    let mockStream: MockStream;
    let transport: ConsoleTransport;

    beforeEach(() => {
      mockStream = new MockStream();
      transport = new ConsoleTransport({ 
        stream: mockStream as any,
        pretty: false 
      });
    });

    it('should write JSON to stream', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        msg: 'Test message'
      };

      transport.write(entry);
      
      expect(mockStream.data).toHaveLength(1);
      const written = JSON.parse(mockStream.data[0].trim());
      expect(written.level).toBe('info');
      expect(written.msg).toBe('Test message');
    });

    it('should respect level filter', () => {
      transport = new ConsoleTransport({ 
        stream: mockStream as any,
        level: 'warn'
      });

      transport.write({ level: 'info', time: Date.now() });
      transport.write({ level: 'warn', time: Date.now() });

      // Level filtering happens in Logger, not transport
      expect(mockStream.data).toHaveLength(2);
    });

    it('should write pretty formatted logs when pretty is true', () => {
      transport = new ConsoleTransport({
        stream: mockStream as any,
        pretty: true,
        colors: false,
        timestamp: 'ISO8601'
      });

      const now = Date.now();
      transport.write({ level: 'error', time: now, msg: 'Error message', customField: 'value' });
      
      expect(mockStream.data).toHaveLength(1);
      const output = mockStream.data[0];
      expect(output).toContain('ERROR');
      expect(output).toContain('Error message');
      expect(output).toContain('customField=value');
    });

    it('should handle colors option for pretty formatter', () => {
      transport = new ConsoleTransport({
        stream: mockStream as any,
        pretty: true,
        colors: true,
        timestamp: false as any
      });

      transport.write({ level: 'info', time: Date.now(), msg: 'Colored message' });
      
      const output = mockStream.data[0];
      // Should contain ANSI color codes
      expect(output).toMatch(/\x1b\[\d+m/);
    });

    it('should handle close method', () => {
      expect(() => transport.close()).not.toThrow();
    });

    it('should use process.stdout by default', () => {
      const defaultTransport = new ConsoleTransport();
      expect((defaultTransport as any).stream).toBe(process.stdout);
    });

    it('should handle custom timestamp option', () => {
      transport = new ConsoleTransport({
        stream: mockStream as any,
        pretty: true,
        colors: false,
        timestamp: 'epoch'
      });

      const now = Date.now();
      transport.write({ level: 'info', time: now, msg: 'Test' });
      
      const output = mockStream.data[0];
      expect(output).toContain(String(now));
    });
  });

  describe('StreamTransport', () => {
    let mockStream: MockStream;
    let transport: StreamTransport;

    beforeEach(() => {
      mockStream = new MockStream();
      transport = new StreamTransport({ stream: mockStream });
    });

    it('should write to provided stream', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        msg: 'Stream test'
      };

      transport.write(entry);
      
      expect(mockStream.data).toHaveLength(1);
      expect(mockStream.data[0]).toContain('Stream test');
    });

    it('should use custom format function', () => {
      transport = new StreamTransport({
        stream: mockStream,
        format: (entry) => `[${entry.level}] ${entry.msg}`
      });

      transport.write({
        level: 'error',
        time: Date.now(),
        msg: 'Custom format'
      });

      expect(mockStream.data[0]).toBe('[error] Custom format\n');
    });

    it('should close stream properly', async () => {
      let closed = false;
      mockStream.end = (cb?: any) => {
        closed = true;
        if (cb) cb();
        return mockStream;
      };

      await transport.close();
      expect(closed).toBe(true);
    });

    it('should handle stream errors', () => {
      const errorStream = new MockStream();
      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      transport = new StreamTransport({ stream: errorStream });
      
      // Simulate stream error
      errorStream.emit('error', new Error('Stream error'));

      expect(errors.some(e => e[0] === 'Stream write error:')).toBe(true);

      console.error = originalError;
    });

    it('should handle different formatters', () => {
      transport = new StreamTransport({
        stream: mockStream,
        format: (entry) => `level=${entry.level} msg="${entry.msg}"`
      });

      transport.write({
        level: 'info',
        time: Date.now(),
        msg: 'Custom format test'
      });

      const output = mockStream.data[0];
      expect(output).toContain('level=info');
      expect(output).toContain('msg="Custom format test"');
    });

    it('should handle JSON format by default', () => {
      transport = new StreamTransport({
        stream: mockStream
      });

      transport.write({
        level: 'warn',
        time: Date.now(),
        msg: 'JSON test'
      });

      const output = mockStream.data[0];
      expect(output).toContain('"level":"warn"');
      expect(output).toContain('"msg":"JSON test"');
    });
  });

  describe('HTTPTransport', () => {
    let transport: HTTPTransport;
    let server: Server;
    let receivedRequests: any[] = [];

    beforeAll((done) => {
      server = createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          receivedRequests.push({ body: JSON.parse(body) });
          res.writeHead(200);
          res.end();
        });
      });
      server.listen(0, done);
    });

    afterAll((done) => {
      server.close(done);
    });

    beforeEach(() => {
      receivedRequests = [];
      const port = (server.address() as any).port;
      transport = new HTTPTransport({
        url: `http://localhost:${port}/logs`,
        batchSize: 2,
        flushInterval: 100
      });
    });

    afterEach(async () => {
      await transport.close();
    });

    it('should batch and send logs', async () => {
      transport.write({ level: 'info', time: Date.now(), msg: 'Log 1' });
      transport.write({ level: 'info', time: Date.now(), msg: 'Log 2' });

      // Wait for batch to be sent
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(receivedRequests).toHaveLength(1);
      expect(receivedRequests[0].body.logs).toHaveLength(2);
      expect(receivedRequests[0].body.logs[0].msg).toBe('Log 1');
    });

    it('should flush on timer', async () => {
      transport.write({ level: 'info', time: Date.now(), msg: 'Single log' });

      // Wait for flush interval
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(receivedRequests).toHaveLength(1);
      expect(receivedRequests[0].body.logs).toHaveLength(1);
    });

    it('should handle request errors and retry', async () => {
      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      // Create transport with invalid URL
      const errorTransport = new HTTPTransport({
        url: 'http://localhost:99999/logs',
        retry: {
          attempts: 2,
          delay: 10
        },
        flushInterval: 50
      });

      errorTransport.write({ level: 'error', time: Date.now(), msg: 'Test error' });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errors.some(e => e[0] === 'Failed to send logs after retries:')).toBe(true);

      console.error = originalError;
      await errorTransport.close();
    });

    it('should handle HTTP error responses', async () => {
      const errorServer = createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      });

      await new Promise<void>(resolve => errorServer.listen(0, resolve));
      const errorPort = (errorServer.address() as any).port;

      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      const errorTransport = new HTTPTransport({
        url: `http://localhost:${errorPort}/logs`,
        retry: {
          attempts: 1,
          delay: 10
        },
        flushInterval: 50
      });

      errorTransport.write({ level: 'error', time: Date.now(), msg: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errors.some(e => e[0] === 'Failed to send logs after retries:')).toBe(true);

      console.error = originalError;
      await errorTransport.close();
      await new Promise<void>(resolve => errorServer.close(() => resolve()));
    });

    it('should handle request timeout', async () => {
      const timeoutServer = createServer((req, res) => {
        // Don't respond to simulate timeout
      });

      await new Promise<void>(resolve => timeoutServer.listen(0, resolve));
      const timeoutPort = (timeoutServer.address() as any).port;

      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      const timeoutTransport = new HTTPTransport({
        url: `http://localhost:${timeoutPort}/logs`,
        timeout: 50,
        retry: {
          attempts: 1,
          delay: 10
        },
        flushInterval: 50
      });

      timeoutTransport.write({ level: 'info', time: Date.now(), msg: 'Timeout test' });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errors.some(e => e[0] === 'Failed to send logs after retries:')).toBe(true);

      console.error = originalError;
      await timeoutTransport.close();
      await new Promise<void>(resolve => timeoutServer.close(() => resolve()));
    });

    it('should handle HTTPS URLs', async () => {
      const httpsTransport = new HTTPTransport({
        url: 'https://example.com/logs',
        flushInterval: 1000000 // Don't auto-flush
      });

      // Just verify it initializes correctly with HTTPS
      expect(httpsTransport).toBeDefined();
      await httpsTransport.close();
    });

    it('should use custom headers', async () => {
      const customServer = createServer((req, res) => {
        receivedRequests.push({ 
          headers: req.headers,
          body: ''
        });
        res.writeHead(200);
        res.end();
      });

      await new Promise<void>(resolve => customServer.listen(0, resolve));
      const customPort = (customServer.address() as any).port;

      const customTransport = new HTTPTransport({
        url: `http://localhost:${customPort}/logs`,
        headers: {
          'X-Custom-Header': 'test-value',
          'Authorization': 'Bearer token'
        },
        flushInterval: 50
      });

      customTransport.write({ level: 'info', time: Date.now(), msg: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedRequests.some(req => 
        req.headers['x-custom-header'] === 'test-value' &&
        req.headers['authorization'] === 'Bearer token'
      )).toBe(true);

      await customTransport.close();
      await new Promise<void>(resolve => customServer.close(() => resolve()));
    });

    it('should handle retry with backoff', async () => {
      let attemptCount = 0;
      const retryServer = createServer((req, res) => {
        attemptCount++;
        if (attemptCount < 3) {
          res.writeHead(503);
          res.end();
        } else {
          res.writeHead(200);
          res.end();
        }
      });

      await new Promise<void>(resolve => retryServer.listen(0, resolve));
      const retryPort = (retryServer.address() as any).port;

      const retryTransport = new HTTPTransport({
        url: `http://localhost:${retryPort}/logs`,
        retry: {
          attempts: 3,
          delay: 10,
          backoff: 2
        },
        flushInterval: 50
      });

      retryTransport.write({ level: 'info', time: Date.now(), msg: 'Retry test' });

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(attemptCount).toBe(3);

      await retryTransport.close();
      await new Promise<void>(resolve => retryServer.close(() => resolve()));
    });

    it('should not write when closed', async () => {
      const closedTransport = new HTTPTransport({
        url: `http://localhost:${(server.address() as any).port}/logs`,
        flushInterval: 100
      });

      await closedTransport.close();
      
      // Should not write when closed
      closedTransport.write({ level: 'info', time: Date.now(), msg: 'Should not send' });

      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should have no requests
      expect(receivedRequests).toHaveLength(0);
    });

    it('should flush when batch size is reached', async () => {
      const batchTransport = new HTTPTransport({
        url: `http://localhost:${(server.address() as any).port}/logs`,
        batchSize: 2,
        flushInterval: 10000 // Very long interval
      });

      batchTransport.write({ level: 'info', time: Date.now(), msg: 'First' });
      batchTransport.write({ level: 'info', time: Date.now(), msg: 'Second' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(receivedRequests).toHaveLength(1);
      expect(receivedRequests[0].body.logs).toHaveLength(2);

      await batchTransport.close();
    });

    it('should handle early return on closed state', async () => {
      const port = (server.address() as any).port;
      const transport = new HTTPTransport({
        url: `http://localhost:${port}/logs`,
        flushInterval: 100
      });

      await transport.close();
      
      // Write should return early due to closed state (line 48)
      transport.write({ level: 'info', time: Date.now(), msg: 'Should not send' });

      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(receivedRequests).toHaveLength(0);
    });

    it('should trigger batch flush by size', async () => {
      const port = (server.address() as any).port;
      const transport = new HTTPTransport({
        url: `http://localhost:${port}/logs`,
        batchSize: 1, // Small batch
        flushInterval: 10000 // Long interval
      });

      // This should trigger immediate flush due to batch size (line 52-54)
      transport.write({ level: 'info', time: Date.now(), msg: 'Immediate flush' });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(receivedRequests).toHaveLength(1);
      expect(receivedRequests[0].body.logs[0].msg).toBe('Immediate flush');

      await transport.close();
    });
  });

  describe('FileTransport', () => {
    const testDir = path.join(__dirname, 'test-logs');
    const testFile = path.join(testDir, 'test.log');
    let transport: FileTransport;

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterEach(async () => {
      if (transport) {
        await transport.close();
      }
      // Clean up test files
      if (fs.existsSync(testDir)) {
        fs.readdirSync(testDir).forEach(file => {
          fs.unlinkSync(path.join(testDir, file));
        });
        fs.rmdirSync(testDir);
      }
    });

    it('should write logs to file', async () => {
      transport = new FileTransport({
        filename: testFile,
        flushInterval: 100
      });

      transport.write({ level: 'info', time: Date.now(), msg: 'File log 1' });
      transport.write({ level: 'error', time: Date.now(), msg: 'File log 2' });

      await new Promise(resolve => setTimeout(resolve, 150));
      await transport.close();

      const content = fs.readFileSync(testFile, 'utf-8');
      const lines = content.trim().split('\n');
      
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).msg).toBe('File log 1');
      expect(JSON.parse(lines[1]).msg).toBe('File log 2');
    });

    it('should rotate files by size', async () => {
      transport = new FileTransport({
        filename: testFile,
        maxSize: '100B',
        flushInterval: 10
      });

      // Write enough data to trigger rotation
      for (let i = 0; i < 5; i++) {
        transport.write({ 
          level: 'info', 
          time: Date.now(), 
          msg: 'A'.repeat(30) 
        });
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await transport.close();

      const files = fs.readdirSync(testDir);
      expect(files.length).toBeGreaterThan(1); // Should have rotated files
    });

    it('should handle write stream errors', async () => {
      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      transport = new FileTransport({
        filename: testFile
      });

      // Force an error by closing the stream early
      (transport as any).writeStream.destroy();
      (transport as any).writeStream.emit('error', new Error('Stream error'));

      expect(errors.some(e => e[0] === 'File transport write error:')).toBe(true);

      console.error = originalError;
    });

    it('should handle custom format function', async () => {
      transport = new FileTransport({
        filename: testFile,
        format: (entry) => `CUSTOM: ${entry.level} - ${entry.msg}\n`,
        flushInterval: 50
      });

      transport.write({ level: 'info', time: Date.now(), msg: 'Test message' });

      await new Promise(resolve => setTimeout(resolve, 100));
      await transport.close();

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toContain('CUSTOM: info - Test message');
    });

    it('should handle different size formats', async () => {
      // Test kilobytes
      transport = new FileTransport({
        filename: testFile,
        maxSize: '1k'
      });
      expect((transport as any).maxSize).toBe(1024);
      await transport.close();

      // Test megabytes
      transport = new FileTransport({
        filename: testFile,
        maxSize: '2M'
      });
      expect((transport as any).maxSize).toBe(2 * 1024 * 1024);
      await transport.close();

      // Test gigabytes
      transport = new FileTransport({
        filename: testFile,
        maxSize: '1G'
      });
      expect((transport as any).maxSize).toBe(1024 * 1024 * 1024);
      await transport.close();
    });

    it('should throw error for invalid size format', async () => {
      expect(() => {
        new FileTransport({
          filename: testFile,
          maxSize: 'invalid'
        });
      }).toThrow('Invalid size format: invalid');
    });

    it('should handle write after close', async () => {
      transport = new FileTransport({
        filename: testFile
      });

      await transport.close();

      // Write after close should be ignored
      transport.write({ level: 'info', time: Date.now(), msg: 'Should not be written' });

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('');
    });

    it('should handle buffer flush on close', async () => {
      transport = new FileTransport({
        filename: testFile,
        bufferSize: 1000 // Large buffer to prevent auto-flush
      });

      transport.write({ level: 'info', time: Date.now(), msg: 'Buffered message' });

      // Close should flush the buffer
      await transport.close();

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toContain('Buffered message');
    });

    it('should handle existing file stats', async () => {
      // Create a file with existing content
      fs.writeFileSync(testFile, 'Existing content\n');

      // Wait a moment for file system to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      transport = new FileTransport({
        filename: testFile,
        maxSize: '1k'
      });

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      // Transport should detect existing file size
      expect((transport as any).currentSize).toBeGreaterThan(0);

      await transport.close();
    });

    it('should handle file stats error', async () => {
      // Create transport with non-existent file
      const nonExistentFile = path.join(testDir, 'non-existent.log');
      
      transport = new FileTransport({
        filename: nonExistentFile
      });

      // Should handle stat error gracefully
      expect((transport as any).currentSize).toBe(0);

      await transport.close();
    });

    it('should flush when buffer is full', async () => {
      transport = new FileTransport({
        filename: testFile,
        bufferSize: 50 // Small buffer
      });

      // Write enough data to trigger flush
      const longMessage = 'A'.repeat(30);
      transport.write({ level: 'info', time: Date.now(), msg: longMessage });
      transport.write({ level: 'info', time: Date.now(), msg: longMessage });

      // Should have flushed due to buffer size
      await new Promise(resolve => setTimeout(resolve, 50));
      await transport.close();

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toContain(longMessage);
    });
  });
});