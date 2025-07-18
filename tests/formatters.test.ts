import { JSONFormatter } from '../src/formatters/json';
import { PrettyFormatter } from '../src/formatters/pretty';
import { LogfmtFormatter } from '../src/formatters/logfmt';
import { CSVFormatter } from '../src/formatters/csv';
import { LogEntry } from '../src/core/types';

describe('Formatters', () => {
  const mockEntry: LogEntry = {
    level: 'info',
    time: 1640995200000, // 2022-01-01T00:00:00.000Z
    msg: 'Test message',
    hostname: 'test-host',
    pid: 1234,
    userId: 123,
    action: 'test-action'
  };

  describe('JSONFormatter', () => {
    let formatter: JSONFormatter;

    beforeEach(() => {
      formatter = new JSONFormatter();
    });

    it('should format log entry as JSON', () => {
      const result = formatter.format(mockEntry);
      const parsed = JSON.parse(result);
      
      expect(parsed.level).toBe('info');
      expect(parsed.msg).toBe('Test message');
      expect(parsed.userId).toBe(123);
    });

    it('should handle circular references', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        data: circular
      };

      const result = formatter.format(entry);
      expect(result).toContain('[Circular]');
    });

    it('should handle special values', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        bigint: BigInt(123),
        func: () => {},
        symbol: Symbol('test'),
        undef: undefined
      };

      const result = formatter.format(entry);
      const parsed = JSON.parse(result);
      
      expect(parsed.bigint).toBe('123');
      expect(parsed.func).toContain('[Function');
      expect(parsed.symbol).toBe('Symbol(test)');
      expect(parsed.undef).toBeUndefined();
    });

  });

  describe('LogfmtFormatter', () => {
    let formatter: LogfmtFormatter;

    beforeEach(() => {
      formatter = new LogfmtFormatter();
    });

    it('should include name field when present (line 17)', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        name: 'test-logger',
        msg: 'Test message'
      };

      const result = formatter.format(entry);
      expect(result).toContain('name=test-logger');
    });
  });

  describe('PrettyFormatter', () => {
    let formatter: PrettyFormatter;

    beforeEach(() => {
      formatter = new PrettyFormatter({ colors: false });
    });

    it('should format log entry in pretty format', () => {
      const result = formatter.format(mockEntry);
      
      expect(result).toContain('2022-01-01T00:00:00.000Z');
      expect(result).toContain('INFO');
      expect(result).toContain('Test message');
      expect(result).toContain('userId=123');
      expect(result).toContain('action=test-action');
    });

    it('should format errors properly', () => {
      const error = new Error('Test error');
      const entry: LogEntry = {
        level: 'error',
        time: Date.now(),
        msg: 'Error occurred',
        err: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };

      const result = formatter.format(entry);
      expect(result).toContain('Error: Test error');
      expect(result).toContain('Error occurred');
    });

    it('should handle entries without message', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        data: { foo: 'bar' }
      };

      const result = formatter.format(entry);
      expect(result).toContain('data={"foo":"bar"}');
    });

    it('should include name in output when present (line 45)', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        name: 'test-logger',
        msg: 'Test message'
      };

      const result = formatter.format(entry);
      expect(result).toContain('[test-logger]');
    });

    it('should handle non-object errors (line 105)', () => {
      const entry: LogEntry = {
        level: 'error',
        time: Date.now(),
        err: 'String error message' as any,
        msg: 'Error occurred'
      };

      const result = formatter.format(entry);
      expect(result).toContain('String error message');
    });

    it('should include error code when present (line 116)', () => {
      const error: any = new Error('File not found');
      error.code = 'ENOENT';
      const entry: LogEntry = {
        level: 'error',
        time: Date.now(),
        err: error,
        msg: 'File operation failed'
      };

      const result = formatter.format(entry);
      expect(result).toContain('Code: ENOENT');
    });

    it('should handle non-Date time values (line 77)', () => {
      // Create a formatter with default timestamp format (not ISO8601)
      const nonISOFormatter = new PrettyFormatter({ colors: false, timestamp: 'default' as any });
      const entry: LogEntry = {
        level: 'info',
        time: 'custom-time-string' as any,
        msg: 'Test message'
      };

      const result = nonISOFormatter.format(entry);
      expect(result).toContain('custom-time-string');
    });

    it('should handle colorize when colors enabled (line 84)', () => {
      const colorFormatter = new PrettyFormatter({ colors: true });
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        msg: 'Colored message'
      };

      const result = colorFormatter.format(entry);
      // Should contain color codes when colors are enabled
      expect(result).toContain('\x1b['); // ANSI color code
    });
  });

  describe('CSVFormatter', () => {
    let formatter: CSVFormatter;

    beforeEach(() => {
      formatter = new CSVFormatter();
    });

    it('should handle error field formatting (line 47)', () => {
      const formatter = new CSVFormatter({
        fields: ['level', 'err', 'msg'],
        includeHeader: false
      });
      
      // Test error with message
      const result1 = formatter.format({
        level: 'error',
        time: Date.now(),
        err: { message: 'Test error', name: 'Error' },
        msg: 'Something failed'
      });
      expect(result1).toContain('Test error');
      
      // Test error with name only (no message)
      const errorWithName: any = new Error();
      errorWithName.message = '';
      errorWithName.name = 'CustomError';
      const result2 = formatter.format({
        level: 'error', 
        time: Date.now(),
        err: errorWithName,
        msg: 'Something failed'
      });
      expect(result2).toContain('CustomError');
      
      // Test error with neither message nor name  
      const emptyError: any = new Error();
      emptyError.message = '';
      emptyError.name = '';
      const result3 = formatter.format({
        level: 'error',
        time: Date.now(), 
        err: emptyError,
        msg: 'Something failed'
      });
      expect(result3).toContain('Error');
    });

    it('should handle null and undefined values (line 55)', () => {
      const formatter = new CSVFormatter({
        fields: ['level', 'nullField', 'undefinedField'],
        includeHeader: false
      });
      const result = formatter.format({
        level: 'info',
        time: Date.now(),
        nullField: null,
        undefinedField: undefined
      });
      
      expect(result).toBe('info,,'); // Both null and undefined should become empty strings
    });

    it('should escape values with special characters', () => {
      const formatter = new CSVFormatter({
        fields: ['level', 'msg', 'quotes'],
        includeHeader: false
      });
      const result = formatter.format({
        level: 'info',
        time: Date.now(),
        msg: 'Value with "quotes" and commas, here',
        quotes: 'Another "quoted" value'
      });
      
      expect(result).toContain('"Value with ""quotes"" and commas, here"');
      expect(result).toContain('"Another ""quoted"" value"');
    });
  });

  describe('LogfmtFormatter', () => {
    let formatter: LogfmtFormatter;

    beforeEach(() => {
      formatter = new LogfmtFormatter();
    });

    it('should format log entry in logfmt format', () => {
      const result = formatter.format(mockEntry);
      
      expect(result).toContain('time=2022-01-01T00:00:00.000Z');
      expect(result).toContain('level=info');
      expect(result).toContain('msg="Test message"');
      expect(result).toContain('hostname=test-host');
      expect(result).toContain('pid=1234');
      expect(result).toContain('userId=123');
      expect(result).toContain('action=test-action');
    });

    it('should escape values with spaces', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        msg: 'Message with spaces',
        path: '/path/with spaces/file.txt'
      };

      const result = formatter.format(entry);
      expect(result).toContain('msg="Message with spaces"');
      expect(result).toContain('path="/path/with spaces/file.txt"');
    });

    it('should handle error objects', () => {
      const entry: LogEntry = {
        level: 'error',
        time: Date.now(),
        err: {
          message: 'Test error',
          name: 'Error',
          stack: 'Error: Test error\n    at ...'
        } as any
      };

      const result = formatter.format(entry);
      expect(result).toContain('error="Test error"');
      expect(result).toContain('errorName=Error');
    });

    it('should handle Date values', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        createdAt: date,
        updatedAt: date
      };

      const result = formatter.format(entry);
      expect(result).toContain('createdAt=2023-01-01T00:00:00.000Z');
      expect(result).toContain('updatedAt=2023-01-01T00:00:00.000Z');
    });

    it('should handle arrays and complex objects', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        tags: ['tag1', 'tag2', 'tag3'],
        nested: { foo: 'bar', baz: 123 }
      };

      const result = formatter.format(entry);
      expect(result).toContain('tags="[\\"tag1\\",\\"tag2\\",\\"tag3\\"]"');
      expect(result).toContain('nested="{\\"foo\\":\\"bar\\",\\"baz\\":123}"');
    });

    it('should handle undefined, null, and symbol values', () => {
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        undefinedValue: undefined as any,
        nullValue: null,
        symbolValue: Symbol('test') as any
      };

      const result = formatter.format(entry);
      expect(result).toContain('nullValue=null');
      expect(result).toContain('symbolValue=Symbol(test)');
      // undefined values are skipped in logfmt
      expect(result).not.toContain('undefinedValue');
    });

    it('should handle errors with code', () => {
      const error: any = new Error('Test error');
      error.code = 'ERR_CODE';
      const entry: LogEntry = {
        level: 'error',
        time: Date.now(),
        err: error
      };

      const result = formatter.format(entry);
      expect(result).toContain('error="Test error"');
      expect(result).toContain('errorCode=ERR_CODE');
    });
  });

  describe('CSVFormatter', () => {
    let formatter: CSVFormatter;

    beforeEach(() => {
      formatter = new CSVFormatter({ includeHeader: true });
    });

    it('should format log entry as CSV with header', () => {
      const result = formatter.format(mockEntry);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('time,level,name,hostname,pid,msg');
      expect(lines[1]).toContain('2022-01-01T00:00:00.000Z,info,,test-host,1234,Test message');
    });

    it('should escape values with commas', () => {
      formatter.reset(); // Reset to get header again
      const entry: LogEntry = {
        level: 'info',
        time: Date.now(),
        msg: 'Message, with, commas'
      };

      const result = formatter.format(entry);
      const lines = result.split('\n');
      expect(lines[1]).toContain('"Message, with, commas"');
    });

    it('should handle custom fields', () => {
      formatter = new CSVFormatter({
        fields: ['time', 'level', 'userId', 'action'],
        includeHeader: true
      });

      const result = formatter.format(mockEntry);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('time,level,userId,action');
      expect(lines[1]).toContain('2022-01-01T00:00:00.000Z,info,123,test-action');
    });
  });
});