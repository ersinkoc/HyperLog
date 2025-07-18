const hyperlog = require('../dist');
const { 
  ConsoleTransport, 
  FileTransport, 
  HTTPTransport 
} = hyperlog;

// Create logger with multiple transports
const logger = hyperlog.create({
  level: 'debug',
  transports: [
    // Console for development
    new ConsoleTransport({
      level: 'debug',
      pretty: true,
      colors: true
    }),
    
    // File for all logs
    new FileTransport({
      level: 'info',
      filename: 'logs/app.log',
      maxSize: '10MB',
      maxFiles: 5,
      compress: true
    }),
    
    // Separate file for errors
    new FileTransport({
      level: 'error',
      filename: 'logs/error.log',
      maxSize: '10MB',
      maxFiles: 10
    }),
    
    // HTTP transport for centralized logging
    new HTTPTransport({
      level: 'warn',
      url: 'https://logs.example.com/ingest',
      batchSize: 50,
      flushInterval: 5000,
      retry: {
        attempts: 3,
        delay: 1000,
        backoff: 2
      }
    })
  ]
});

// Example usage
logger.info('Application starting');
logger.debug({ config: process.env }, 'Configuration loaded');

// Simulate various log levels
setInterval(() => {
  const levels = ['debug', 'info', 'warn', 'error'];
  const level = levels[Math.floor(Math.random() * levels.length)];
  
  logger[level]({
    random: Math.random(),
    timestamp: new Date().toISOString()
  }, `Random ${level} message`);
}, 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down application');
  await logger.close();
  process.exit(0);
});