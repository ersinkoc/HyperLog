import { Logger } from '../src/core/logger';
import { ConsoleTransport } from '../src/transports/console';
import { StreamTransport } from '../src/transports/stream';
import { Writable } from 'stream';

describe('Logger', () => {
  let logger: Logger;
  let mockStream: MockStream;

  class MockStream extends Writable {
    public logs: string[] = [];

    _write(chunk: any, encoding: string, callback: Function): void {
      this.logs.push(chunk.toString().trim());
      callback();
    }
  }

  beforeEach(() => {
    mockStream = new MockStream();
    logger = new Logger({
      transports: [new StreamTransport({ stream: mockStream })]
    });
  });

  describe('basic logging', () => {
    it('should create logger with default options', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger).toBeDefined();
      // Default level is 'info' as per constructor
    });

    it('should log info messages', () => {
      logger.info('test message');
      expect(mockStream.logs.length).toBe(1);
      const log = JSON.parse(mockStream.logs[0]);
      expect(log.level).toBe('info');
      expect(log.msg).toBe('test message');
    });

    it('should log with objects', () => {
      logger.info({ userId: 123 }, 'user action');
      const log = JSON.parse(mockStream.logs[0]);
      expect(log.userId).toBe(123);
      expect(log.msg).toBe('user action');
    });

    it('should respect log levels', () => {
      logger.setLevel('warn');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(mockStream.logs.length).toBe(2);
      expect(JSON.parse(mockStream.logs[0]).level).toBe('warn');
      expect(JSON.parse(mockStream.logs[1]).level).toBe('error');
    });
  });

  describe('error handling', () => {
    it('should serialize errors correctly', () => {
      const error = new Error('test error');
      logger.error(error);
      const log = JSON.parse(mockStream.logs[0]);
      expect(log.err.message).toBe('test error');
      expect(log.err.name).toBe('Error');
      expect(log.err.stack).toBeDefined();
    });
  });

  describe('child loggers', () => {
    it('should inherit context', () => {
      const childLogger = logger.child({ service: 'api' });
      childLogger.info('child log');
      const log = JSON.parse(mockStream.logs[0]);
      expect(log.service).toBe('api');
    });
  });

  describe('context management', () => {
    it('should use async context', () => {
      logger.withContext({ requestId: 'abc' }, () => {
        logger.info('with context');
      });
      const log = JSON.parse(mockStream.logs[0]);
      expect(log.requestId).toBe('abc');
    });
  });

  describe('timers', () => {
    it('should measure duration', (done) => {
      const timer = logger.startTimer();
      setTimeout(() => {
        timer.done({ operation: 'test' }, 'operation complete');
        const log = JSON.parse(mockStream.logs[0]);
        expect(log.operation).toBe('test');
        expect(log.duration).toBeGreaterThan(0);
        expect(log.msg).toBe('operation complete');
        done();
      }, 10);
    });
  });

  describe('redaction', () => {
    it('should redact sensitive fields', () => {
      const sensitiveLogger = new Logger({
        transports: [new StreamTransport({ stream: mockStream })],
        redact: ['password', 'token']
      });
      
      sensitiveLogger.info({ 
        user: 'john', 
        password: 'secret123',
        data: { token: 'abc123' }
      });
      
      const log = JSON.parse(mockStream.logs[0]);
      expect(log.password).toBe('[REDACTED]');
      expect(log.data.token).toBe('[REDACTED]');
      expect(log.user).toBe('john');
    });
  });
});