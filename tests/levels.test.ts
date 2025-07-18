import { 
  LOG_LEVELS, 
  LOG_LEVEL_NAMES, 
  isValidLevel, 
  getLevelValue, 
  getLevelName, 
  shouldLog 
} from '../src/core/levels';

describe('Log Levels', () => {
  describe('LOG_LEVELS', () => {
    it('should have correct numeric values', () => {
      expect(LOG_LEVELS.trace).toBe(10);
      expect(LOG_LEVELS.debug).toBe(20);
      expect(LOG_LEVELS.info).toBe(30);
      expect(LOG_LEVELS.warn).toBe(40);
      expect(LOG_LEVELS.error).toBe(50);
      expect(LOG_LEVELS.fatal).toBe(60);
    });
  });

  describe('LOG_LEVEL_NAMES', () => {
    it('should map numbers to level names', () => {
      expect(LOG_LEVEL_NAMES[10]).toBe('trace');
      expect(LOG_LEVEL_NAMES[20]).toBe('debug');
      expect(LOG_LEVEL_NAMES[30]).toBe('info');
      expect(LOG_LEVEL_NAMES[40]).toBe('warn');
      expect(LOG_LEVEL_NAMES[50]).toBe('error');
      expect(LOG_LEVEL_NAMES[60]).toBe('fatal');
    });
  });

  describe('isValidLevel', () => {
    it('should return true for valid levels', () => {
      expect(isValidLevel('trace')).toBe(true);
      expect(isValidLevel('debug')).toBe(true);
      expect(isValidLevel('info')).toBe(true);
      expect(isValidLevel('warn')).toBe(true);
      expect(isValidLevel('error')).toBe(true);
      expect(isValidLevel('fatal')).toBe(true);
    });

    it('should return false for invalid levels', () => {
      expect(isValidLevel('invalid')).toBe(false);
      expect(isValidLevel('INFO')).toBe(false);
      expect(isValidLevel('')).toBe(false);
    });
  });

  describe('getLevelValue', () => {
    it('should return correct numeric value for level', () => {
      expect(getLevelValue('trace')).toBe(10);
      expect(getLevelValue('info')).toBe(30);
      expect(getLevelValue('error')).toBe(50);
    });
  });

  describe('getLevelName', () => {
    it('should return correct level name for value', () => {
      expect(getLevelName(10)).toBe('trace');
      expect(getLevelName(30)).toBe('info');
      expect(getLevelName(50)).toBe('error');
    });

    it('should return undefined for invalid values', () => {
      expect(getLevelName(15)).toBeUndefined();
      expect(getLevelName(100)).toBeUndefined();
    });
  });

  describe('shouldLog', () => {
    it('should return true when entry level >= min level', () => {
      expect(shouldLog('info', 'debug')).toBe(true);
      expect(shouldLog('error', 'info')).toBe(true);
      expect(shouldLog('fatal', 'trace')).toBe(true);
      expect(shouldLog('info', 'info')).toBe(true);
    });

    it('should return false when entry level < min level', () => {
      expect(shouldLog('debug', 'info')).toBe(false);
      expect(shouldLog('trace', 'debug')).toBe(false);
      expect(shouldLog('warn', 'error')).toBe(false);
    });
  });
});