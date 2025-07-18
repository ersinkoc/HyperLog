# Changelog

All notable changes to @oxog/hyperlog will be documented in this file.

## [1.0.0] - 2025-07-18

### Features

- **Core Logger**: High-performance logger with zero dependencies
- **Log Levels**: Support for trace, debug, info, warn, error, and fatal levels
- **Multiple Transports**: 
  - Console transport with pretty printing
  - File transport with rotation and compression
  - Stream transport for custom outputs
  - HTTP transport with batching and retries
  - Syslog transport (RFC3164/RFC5424 compliant)
- **Child Loggers**: Hierarchical logging with context inheritance
- **Context Management**: AsyncLocalStorage-based context propagation
- **Performance Timing**: Built-in timer utility for measuring operations
- **Error Serialization**: Comprehensive error object handling
- **Sensitive Data Redaction**: Automatic redaction of configured fields
- **Multiple Formatters**:
  - JSON formatter with circular reference handling
  - Pretty formatter with colors
  - Logfmt formatter
  - CSV formatter with custom fields
- **File Rotation**: Size-based and time-based rotation with compression
- **Framework Integration**:
  - Express.js middleware
  - Fastify plugin
- **CLI Tools**: 
  - Pretty print JSON logs
  - Tail logs with filtering
  - Analyze log patterns
  - Convert between formats
  - Extract by time range
  - Performance analysis
- **Advanced Features**:
  - Log sampling (fixed and adaptive)
  - Rate limiting (token bucket and sliding window)
  - Metrics aggregation and reporting
  - Prometheus metrics export
- **Performance Optimizations**:
  - Ring buffer for zero-allocation logging
  - Object pooling for log entries
  - Fast JSON stringifier
  - Async write queue with backpressure

### Performance
- 1M+ logs/second for simple strings
- 700K+ logs/second for objects
- Memory usage < 6MB for 1M logs
- 10M+ logs/second with 10% sampling

### Development
- Full TypeScript support
- 100% type coverage
- Comprehensive test suite
- Performance benchmarks
- Zero runtime dependencies