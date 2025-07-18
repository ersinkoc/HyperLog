const { Logger, StreamTransport } = require('../dist');
const { Writable } = require('stream');

class NullStream extends Writable {
  _write(chunk, encoding, callback) {
    callback();
  }
}

async function runBenchmark() {
  console.log('HyperLog Performance Benchmark\n');

  const iterations = 1000000;
  const logger = new Logger({
    transports: [new StreamTransport({ stream: new NullStream() })]
  });

  // Warmup
  for (let i = 0; i < 10000; i++) {
    logger.info({ index: i }, 'warmup message');
  }

  // Benchmark simple string logging
  console.log('Simple string logging:');
  let start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    logger.info('simple message');
  }
  let end = process.hrtime.bigint();
  let duration = Number(end - start) / 1e9;
  let opsPerSec = iterations / duration;
  console.log(`  ${iterations} logs in ${duration.toFixed(3)}s`);
  console.log(`  ${opsPerSec.toFixed(0)} ops/sec`);
  console.log(`  ${(duration * 1e9 / iterations).toFixed(0)} ns/op\n`);

  // Benchmark object logging
  console.log('Object logging:');
  start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    logger.info({ userId: i, action: 'test', timestamp: Date.now() }, 'action performed');
  }
  end = process.hrtime.bigint();
  duration = Number(end - start) / 1e9;
  opsPerSec = iterations / duration;
  console.log(`  ${iterations} logs in ${duration.toFixed(3)}s`);
  console.log(`  ${opsPerSec.toFixed(0)} ops/sec`);
  console.log(`  ${(duration * 1e9 / iterations).toFixed(0)} ns/op\n`);

  // Benchmark child logger
  console.log('Child logger:');
  const child = logger.child({ service: 'api', version: '1.0.0' });
  start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    child.info({ requestId: i }, 'request processed');
  }
  end = process.hrtime.bigint();
  duration = Number(end - start) / 1e9;
  opsPerSec = iterations / duration;
  console.log(`  ${iterations} logs in ${duration.toFixed(3)}s`);
  console.log(`  ${opsPerSec.toFixed(0)} ops/sec`);
  console.log(`  ${(duration * 1e9 / iterations).toFixed(0)} ns/op\n`);

  // Memory usage
  const used = process.memoryUsage();
  console.log('Memory usage:');
  console.log(`  RSS: ${(used.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Used: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`);

  await logger.close();
}

runBenchmark().catch(console.error);