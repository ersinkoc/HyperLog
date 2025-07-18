// Example of using HyperLog with Express (standalone demo)
// Note: This example shows how you would integrate with Express
// To run with actual Express, install: npm install express

const hyperlog = require('../dist');

// Simulate Express-like behavior for demonstration
const mockExpress = {
  json: () => console.log('Body parser middleware attached'),
  listen: (port, callback) => {
    console.log(`Mock server would listen on port ${port}`);
    if (callback) callback();
  }
};

const mockApp = {
  use: (middleware) => console.log('Middleware attached:', typeof middleware),
  get: (path, handler) => console.log(`GET route registered: ${path}`),
  post: (path, handler) => console.log(`POST route registered: ${path}`)
};

// Create logger instance
const logger = hyperlog.create({
  level: 'debug',
  pretty: true,
  transports: [
    new hyperlog.ConsoleTransport({ pretty: true }),
    new hyperlog.FileTransport({
      filename: 'logs/express-app.log',
      maxSize: '10MB',
      maxFiles: 5
    })
  ]
});

// Create mock Express app for demonstration
const app = mockApp;

// Add body parser (simulated)
app.use(mockExpress.json());

// Demonstrate HyperLog express middleware configuration
const expressMiddlewareConfig = {
  logger,
  excludePaths: ['/health', '/metrics'],
  includeBody: true,
  includeQuery: true,
  includeHeaders: ['user-agent', 'content-type'],
  customProps: (req, res) => ({
    userId: req.user?.id,
    sessionId: req.session?.id
  })
};

console.log('Express middleware would be configured with:', Object.keys(expressMiddlewareConfig));

// Add HyperLog middleware (simulated)
app.use('hyperlog-middleware');

// Example routes (simulated)
app.get('/', 'home-handler');
app.post('/api/users', 'create-user-handler');
app.get('/api/error', 'error-handler');

// Demonstrate request logging
function simulateRequest() {
  const requestLogger = logger.child({ 
    requestId: 'req-123',
    method: 'GET',
    path: '/',
    ip: '127.0.0.1'
  });

  requestLogger.info('Simulated request received');
  
  // Simulate processing
  setTimeout(() => {
    requestLogger.info({ statusCode: 200, duration: 45 }, 'Request completed');
  }, 50);
}

// Demonstrate error handling
function simulateError() {
  const errorLogger = logger.child({
    requestId: 'req-124',
    method: 'POST',
    path: '/api/error'
  });

  try {
    throw new Error('Simulated API error');
  } catch (error) {
    errorLogger.error({ err: error }, 'Unhandled error in request');
  }
}

// Start simulation
const PORT = process.env.PORT || 3000;
console.log(`\nDemonstrating Express integration with HyperLog:`);
logger.info({ port: PORT }, 'Express server simulation started');

// Run simulated requests
simulateRequest();
setTimeout(simulateError, 100);

// Graceful shutdown simulation
setTimeout(async () => {
  logger.info('Shutting down gracefully (simulated)');
  await logger.close();
  console.log('\nExpress integration demo completed!');
}, 200);