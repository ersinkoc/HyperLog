/**
 * Microservices logging example
 * Demonstrates distributed tracing and correlation across services
 */

const hyperlog = require('../dist');

// Shared logger configuration for all microservices
function createServiceLogger(serviceName, options = {}) {
  return hyperlog.create({
    name: serviceName,
    level: process.env.LOG_LEVEL || 'info',
    ...options,
    
    // Add service metadata to all logs
    context: {
      service: serviceName,
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      region: process.env.AWS_REGION || 'us-east-1',
      ...options.context
    },
    
    transports: [
      // Console for local development
      new hyperlog.ConsoleTransport({
        pretty: process.env.NODE_ENV !== 'production'
      }),
      
      // Centralized logging service
      new hyperlog.HTTPTransport({
        url: process.env.LOG_AGGREGATOR_URL || 'http://logs.internal/ingest',
        headers: {
          'X-Service-Name': serviceName,
          'X-Service-Version': process.env.SERVICE_VERSION || '1.0.0'
        },
        batchSize: 100,
        flushInterval: 2000
      })
    ]
  });
}

// Example: API Gateway Service
class ApiGateway {
  constructor() {
    this.logger = createServiceLogger('api-gateway');
  }
  
  // Middleware to propagate trace context
  traceMiddleware(req, res, next) {
    // Extract or generate trace ID
    const traceId = req.headers['x-trace-id'] || this.generateTraceId();
    const spanId = this.generateSpanId();
    const parentSpanId = req.headers['x-span-id'];
    
    // Create request logger with trace context
    const requestLogger = this.logger.child({
      traceId,
      spanId,
      parentSpanId,
      requestId: req.headers['x-request-id'] || this.generateRequestId(),
      userId: req.user?.id,
      method: req.method,
      path: req.path
    });
    
    // Attach to request
    req.traceContext = { traceId, spanId };
    req.log = requestLogger;
    
    // Propagate headers
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-span-id', spanId);
    
    requestLogger.info('Request received at gateway');
    
    // Track request duration
    const timer = requestLogger.startTimer();
    
    res.on('finish', () => {
      timer.done({
        statusCode: res.statusCode,
        route: req.route?.path
      }, 'Request completed');
    });
    
    next();
  }
  
  // Forward request to microservice
  async forwardRequest(req, serviceName, path) {
    const spanId = this.generateSpanId();
    const forwardLogger = req.log.child({
      targetService: serviceName,
      targetPath: path,
      spanId,
      parentSpanId: req.traceContext.spanId
    });
    
    forwardLogger.info('Forwarding request to service');
    
    try {
      const response = await fetch(`http://${serviceName}.internal${path}`, {
        method: req.method,
        headers: {
          ...req.headers,
          'x-trace-id': req.traceContext.traceId,
          'x-span-id': spanId,
          'x-parent-span-id': req.traceContext.spanId,
          'x-request-id': req.requestId
        },
        body: req.body
      });
      
      forwardLogger.info({
        statusCode: response.status,
        responseTime: response.headers.get('x-response-time')
      }, 'Service response received');
      
      return response;
    } catch (error) {
      forwardLogger.error({
        err: error
      }, 'Service request failed');
      throw error;
    }
  }
  
  generateTraceId() {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }
  
  generateSpanId() {
    return `span-${Math.random().toString(36).substr(2, 8)}`;
  }
  
  generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Example: User Service
class UserService {
  constructor() {
    this.logger = createServiceLogger('user-service');
    this.cache = new Map();
  }
  
  // Extract trace context from incoming request
  extractTraceContext(headers) {
    return {
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
      parentSpanId: headers['x-parent-span-id'],
      requestId: headers['x-request-id']
    };
  }
  
  async getUser(userId, traceContext) {
    const operationLogger = this.logger.child({
      ...traceContext,
      operation: 'getUser',
      userId
    });
    
    operationLogger.debug('Fetching user');
    
    // Check cache
    if (this.cache.has(userId)) {
      operationLogger.debug('User found in cache');
      return this.cache.get(userId);
    }
    
    // Query database
    const timer = operationLogger.startTimer();
    
    try {
      const user = await this.db.query('SELECT * FROM users WHERE id = ?', [userId]);
      
      timer.done({
        source: 'database',
        cacheHit: false
      }, 'User fetched');
      
      // Update cache
      this.cache.set(userId, user);
      
      return user;
    } catch (error) {
      operationLogger.error({
        err: error,
        query: 'SELECT * FROM users WHERE id = ?'
      }, 'Database query failed');
      throw error;
    }
  }
  
  async updateUser(userId, updates, traceContext) {
    const operationLogger = this.logger.child({
      ...traceContext,
      operation: 'updateUser',
      userId,
      updateFields: Object.keys(updates)
    });
    
    operationLogger.info('Updating user');
    
    const timer = operationLogger.startTimer();
    
    try {
      await this.db.query('UPDATE users SET ? WHERE id = ?', [updates, userId]);
      
      // Invalidate cache
      this.cache.delete(userId);
      
      // Publish event
      await this.publishEvent('user.updated', {
        userId,
        updates,
        traceId: traceContext.traceId
      });
      
      timer.done({
        fieldsUpdated: Object.keys(updates).length
      }, 'User updated');
      
    } catch (error) {
      operationLogger.error({
        err: error
      }, 'Failed to update user');
      throw error;
    }
  }
  
  async publishEvent(eventType, data) {
    this.logger.debug({
      eventType,
      data
    }, 'Publishing event');
    
    // Publish to message queue
    await this.messageQueue.publish(eventType, {
      ...data,
      timestamp: Date.now(),
      service: 'user-service'
    });
  }
}

// Example: Order Service with distributed transaction
class OrderService {
  constructor() {
    this.logger = createServiceLogger('order-service');
  }
  
  async createOrder(orderData, traceContext) {
    const orderLogger = this.logger.child({
      ...traceContext,
      operation: 'createOrder',
      orderId: this.generateOrderId()
    });
    
    orderLogger.info('Creating new order');
    
    const transactionLogger = orderLogger.child({
      transactionId: this.generateTransactionId()
    });
    
    try {
      // Start distributed transaction
      transactionLogger.info('Starting distributed transaction');
      
      // Step 1: Validate user
      const userResponse = await this.callService('user-service', `/users/${orderData.userId}`, {
        method: 'GET',
        traceContext
      });
      
      if (!userResponse.ok) {
        throw new Error('User validation failed');
      }
      
      transactionLogger.debug('User validated');
      
      // Step 2: Check inventory
      const inventoryResponse = await this.callService('inventory-service', '/check', {
        method: 'POST',
        body: orderData.items,
        traceContext
      });
      
      if (!inventoryResponse.ok) {
        throw new Error('Insufficient inventory');
      }
      
      transactionLogger.debug('Inventory checked');
      
      // Step 3: Process payment
      const paymentResponse = await this.callService('payment-service', '/charge', {
        method: 'POST',
        body: {
          userId: orderData.userId,
          amount: orderData.total,
          orderId: orderLogger.bindings.orderId
        },
        traceContext
      });
      
      if (!paymentResponse.ok) {
        throw new Error('Payment failed');
      }
      
      transactionLogger.debug('Payment processed');
      
      // Step 4: Create order record
      const order = await this.db.createOrder({
        ...orderData,
        id: orderLogger.bindings.orderId,
        status: 'confirmed',
        paymentId: paymentResponse.data.paymentId
      });
      
      transactionLogger.info({
        orderId: order.id,
        total: order.total,
        itemCount: order.items.length
      }, 'Order created successfully');
      
      // Publish order created event
      await this.publishEvent('order.created', {
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        traceId: traceContext.traceId
      });
      
      return order;
      
    } catch (error) {
      transactionLogger.error({
        err: error,
        stage: error.stage || 'unknown'
      }, 'Order creation failed - rolling back');
      
      // Compensating transactions would go here
      await this.rollbackOrder(orderLogger.bindings.orderId, traceContext);
      
      throw error;
    }
  }
  
  async callService(serviceName, path, options) {
    const { traceContext, ...fetchOptions } = options;
    const spanId = this.generateSpanId();
    
    this.logger.debug({
      ...traceContext,
      spanId,
      targetService: serviceName,
      targetPath: path
    }, 'Calling service');
    
    const response = await fetch(`http://${serviceName}.internal${path}`, {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
        'x-trace-id': traceContext.traceId,
        'x-span-id': spanId,
        'x-parent-span-id': traceContext.spanId,
        'content-type': 'application/json'
      },
      body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined
    });
    
    return response;
  }
  
  generateOrderId() {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
  
  generateTransactionId() {
    return `tx-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
  
  generateSpanId() {
    return `span-${Math.random().toString(36).substr(2, 8)}`;
  }
}

// Example: Background Job Worker
class JobWorker {
  constructor(jobType) {
    this.jobType = jobType;
    this.logger = createServiceLogger(`worker-${jobType}`);
  }
  
  async processJob(job) {
    const jobLogger = this.logger.child({
      jobId: job.id,
      jobType: job.type,
      traceId: job.metadata?.traceId || this.generateTraceId(),
      attempt: job.attemptNumber || 1
    });
    
    jobLogger.info('Processing job');
    
    const timer = jobLogger.startTimer();
    
    try {
      // Process based on job type
      const result = await this.handlers[job.type](job.data, jobLogger);
      
      timer.done({
        resultSize: JSON.stringify(result).length
      }, 'Job completed successfully');
      
      return result;
      
    } catch (error) {
      jobLogger.error({
        err: error,
        willRetry: job.attemptNumber < job.maxAttempts
      }, 'Job processing failed');
      
      if (job.attemptNumber < job.maxAttempts) {
        // Requeue with exponential backoff
        const delay = Math.pow(2, job.attemptNumber) * 1000;
        jobLogger.info({ delay }, 'Requeueing job');
        await this.requeue(job, delay);
      } else {
        // Move to dead letter queue
        jobLogger.error('Job failed permanently - moving to DLQ');
        await this.moveToDeadLetterQueue(job);
      }
      
      throw error;
    }
  }
  
  generateTraceId() {
    return `job-trace-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }
}

// Export configured services
module.exports = {
  createServiceLogger,
  ApiGateway,
  UserService,
  OrderService,
  JobWorker
};