const monitoringService = require('../services/monitoringService');
const { logHelpers } = require('../config/logger');

// Performance tracking middleware
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Track the start time
  req._startTime = startTime;

  // Override res.end to capture response time and metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Record metrics
    monitoringService.recordRequest(req, res, responseTime);

    // Call original end
    originalEnd.apply(this, args);
  };

  // Track errors if they occur
  const originalNext = next;
  const trackedNext = (error) => {
    if (error) {
      monitoringService.recordError(error, req);
    }
    originalNext(error);
  };

  trackedNext();
};

// Error tracking middleware (should be after all routes)
const errorTrackingMiddleware = (err, req, res, next) => {
  // Record the error
  monitoringService.recordError(err, req);

  // Optional Sentry capture
  try {
    if (process.env.SENTRY_DSN && global.__SENTRY__) {
      global.__SENTRY__.captureException(err);
    }
  } catch (_) {}

  // If response hasn't been sent, send error response
  if (!res.headersSent) {
    const statusCode = err.statusCode || err.status || 500;
    const isDev = process.env.NODE_ENV === 'development';

    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal Server Error',
      ...(isDev && { 
        stack: err.stack,
        details: err.details 
      })
    });
  }

  next(err);
};

// Middleware to track authentication events
const authTrackingWrapper = (authFunction, eventType) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      await authFunction(req, res, next);
      
      // If we get here, auth was successful
      monitoringService.recordAuth(eventType, true, {
        userId: req.user?.id,
        userRole: req.user?.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime: Date.now() - startTime
      });
      
    } catch (error) {
      // Auth failed
      monitoringService.recordAuth(eventType, false, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error.message,
        responseTime: Date.now() - startTime
      });
      
      throw error;
    }
  };
};

// Database query tracking wrapper
const dbQueryWrapper = (queryFunction, operation, table) => {
  return async (...args) => {
    const startTime = Date.now();
    
    try {
      const result = await queryFunction.apply(this, args);
      const duration = Date.now() - startTime;
      
      monitoringService.recordDatabaseQuery(operation, table, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      monitoringService.recordDatabaseQuery(operation, table, duration);
      monitoringService.recordError(error);
      
      throw error;
    }
  };
};

// AI service call tracking wrapper
const aiServiceWrapper = (aiFunction, service, operation) => {
  return async (...args) => {
    const startTime = Date.now();
    
    try {
      const result = await aiFunction.apply(this, args);
      const responseTime = Date.now() - startTime;
      
      monitoringService.recordAICall(service, operation, responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      monitoringService.recordAICall(service, operation, responseTime, false);
      
      throw error;
    }
  };
};

// WebSocket event tracking wrapper
const wsEventWrapper = (socketService) => {
  const originalEmit = socketService.io.emit;
  const originalOn = socketService.io.on;

  // Track outgoing messages
  socketService.io.emit = function(event, ...args) {
    monitoringService.recordWebSocketEvent('message_sent', { event });
    return originalEmit.apply(this, [event, ...args]);
  };

  // Track connections and disconnections
  socketService.io.on('connection', (socket) => {
    monitoringService.recordWebSocketEvent('connect', { socketId: socket.id });

    // Track incoming messages
    const originalSocketOn = socket.on;
    socket.on = function(event, handler) {
      const wrappedHandler = (...args) => {
        monitoringService.recordWebSocketEvent('message_received', { event });
        return handler.apply(this, args);
      };
      return originalSocketOn.call(this, event, wrappedHandler);
    };

    socket.on('disconnect', () => {
      monitoringService.recordWebSocketEvent('disconnect', { socketId: socket.id });
    });
  });
};

// Health check middleware - lightweight endpoint that doesn't interfere with metrics
const healthCheckMiddleware = (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    // Skip normal monitoring for health checks
    const health = monitoringService.getHealthStatus();
    return res.status(health.status === 'critical' ? 503 : 200).json(health);
  }
  next();
};

// Rate limiting tracking
const rateLimitTrackingWrapper = (rateLimitMiddleware) => {
  return (req, res, next) => {
    const originalNext = next;
    
    next = (error) => {
      if (error && error.status === 429) {
        logHelpers.logSecurity('RATE_LIMIT_EXCEEDED', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id
        }, 'warn');
      }
      originalNext(error);
    };

    rateLimitMiddleware(req, res, next);
  };
};

// Security event tracking
const securityTracker = {
  trackSuspiciousActivity: (req, activity, severity = 'medium') => {
    logHelpers.logSecurity(`SUSPICIOUS_${activity.toUpperCase()}`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    }, severity);
  },

  trackUnauthorizedAccess: (req, resource) => {
    logHelpers.logSecurity('UNAUTHORIZED_ACCESS', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      resource: resource,
      userId: req.user?.id,
      userRole: req.user?.role,
      timestamp: new Date().toISOString()
    }, 'high');
  },

  trackPrivilegeEscalation: (req, attemptedRole) => {
    logHelpers.logSecurity('PRIVILEGE_ESCALATION_ATTEMPT', {
      ip: req.ip,
      path: req.path,
      currentRole: req.user?.role,
      attemptedRole: attemptedRole,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    }, 'critical');
  }
};

// User action tracking middleware
const userActionMiddleware = (action) => {
  return (req, res, next) => {
    // Track after successful response
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode < 400) {
        logHelpers.logUserAction(req.user?.id, action, {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString()
        });
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

// Resource usage monitoring
const resourceMonitoringMiddleware = (req, res, next) => {
  const startMemory = process.memoryUsage();
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };

    // Log resource intensive requests
    if (executionTime > 1000 || memoryDelta.heapUsed > 50 * 1024 * 1024) { // 50MB
      logHelpers.logPerformance('resource_intensive_request', executionTime, {
        path: req.path,
        method: req.method,
        memoryDelta: memoryDelta,
        statusCode: res.statusCode
      });
    }
  });

  next();
};

module.exports = {
  performanceMiddleware,
  errorTrackingMiddleware,
  authTrackingWrapper,
  dbQueryWrapper,
  aiServiceWrapper,
  wsEventWrapper,
  healthCheckMiddleware,
  rateLimitTrackingWrapper,
  securityTracker,
  userActionMiddleware,
  resourceMonitoringMiddleware
};