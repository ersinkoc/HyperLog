# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HyperLog is an ultra-fast, zero-dependency Node.js logger with advanced features. The project is written in TypeScript and provides multiple transports, formatters, and middleware integrations for production use.

## Common Commands

### Development
- **Build**: `npm run build` - Compiles TypeScript to JavaScript in the `dist/` directory
- **Test**: `npm test` - Runs Jest tests with coverage (must maintain 90% threshold)
- **Test specific file**: `npm test -- tests/core.test.ts`
- **Lint**: `npm run lint` - Runs ESLint on all TypeScript files in `src/`
- **Benchmarks**: `npm run bench` - Runs performance benchmarks

### Pre-publish
- **Full validation**: `npm run prepublishOnly` - Builds and tests before publishing

## Architecture

### Core Components

1. **Logger Core** (`src/core/`)
   - `logger.ts`: Main Logger class with async context support, child loggers, and performance timing
   - `levels.ts`: Log level definitions and validation (trace, debug, info, warn, error, fatal)
   - `types.ts`: TypeScript interfaces and types

2. **Transports** (`src/transports/`)
   - Console, File, HTTP, Stream, and Syslog transports
   - Each transport implements the `Transport` interface
   - File transport includes rotation support

3. **Formatters** (`src/formatters/`)
   - JSON, Pretty, Logfmt, and CSV formatters
   - Formatters transform log entries into specific output formats

4. **Utilities** (`src/utils/`)
   - Performance-critical utilities like object pooling, ring buffers, and async write queues
   - Sampling and rate limiting for high-throughput scenarios
   - Metrics aggregation for monitoring

5. **Middleware** (`src/middleware/`)
   - Express and Fastify integrations
   - Request/response logging with customizable options

### Key Design Patterns

- **Zero Dependencies**: All functionality implemented from scratch for maximum performance
- **Object Pooling**: Reuses log entry objects to reduce GC pressure
- **Async Context**: Uses AsyncLocalStorage for context propagation
- **Non-blocking I/O**: All write operations are async to prevent blocking
- **Modular Architecture**: Transports, formatters, and utilities are pluggable

### Performance Considerations

- The codebase is heavily optimized for throughput (1M+ logs/sec)
- Uses object pooling and ring buffers to minimize allocations
- Implements sampling and rate limiting for production use
- Fast JSON serialization with custom implementation
- Async write queues prevent blocking on I/O

## Testing

- Tests are in the `tests/` directory with `.test.ts` extension
- Jest with ts-jest for TypeScript support
- 90% coverage threshold enforced
- Run specific test: `npm test -- tests/logger.test.ts`

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps and declarations generated
- Incremental compilation enabled