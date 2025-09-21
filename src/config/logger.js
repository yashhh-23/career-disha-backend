const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// Define log levels and their priorities
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Create daily rotate file transport for different log levels
const createRotateTransport = (filename, level) => {
  return new DailyRotateFile({
    filename: path.join(logDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep logs for 14 days
    level: level,
    format: logFormat,
    zippedArchive: true, // Compress old logs
  });
};

// Configure winston logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports: [
    // Error logs
    createRotateTransport('error', 'error'),
    
    // Combined logs (all levels)
    createRotateTransport('combined', 'debug'),
    
    // HTTP access logs
    createRotateTransport('access', 'http'),
    
    // Application logs (info and above)
    createRotateTransport('app', 'info')
  ],
  
  // Handle uncaught exceptions and promise rejections
  exceptionHandlers: [
    createRotateTransport('exceptions', 'error'),
    new winston.transports.Console({ format: consoleFormat })
  ],
  
  rejectionHandlers: [
    createRotateTransport('rejections', 'error'),
    new winston.transports.Console({ format: consoleFormat })
  ],
  
  exitOnError: false
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create specialized loggers for different components
const loggers = {
  // Main application logger
  app: logger,
  
  // API request/response logger
  http: winston.createLogger({
    level: 'http',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      createRotateTransport('http-requests', 'http')
    ]
  }),
  
  // Security events logger
  security: winston.createLogger({
    level: 'warn',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      createRotateTransport('security', 'warn')
    ]
  }),
  
  // AI service logger
  ai: winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      createRotateTransport('ai-service', 'info')
    ]
  }),
  
  // Database operations logger
  database: winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      createRotateTransport('database', 'info')
    ]
  }),
  
  // Performance monitoring logger
  performance: winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      createRotateTransport('performance', 'info')
    ]
  })
};

// Helper functions for structured logging
const logHelpers = {
  // Log API requests
  logApiRequest: (req, res, duration) => {
    loggers.http.http('API Request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      statusCode: res.statusCode,
      duration: duration,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log authentication events
  logAuth: (event, details) => {
    loggers.security.warn('Authentication Event', {
      event: event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log security events
  logSecurity: (event, details, level = 'warn') => {
    loggers.security[level]('Security Event', {
      event: event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log AI service calls
  logAI: (service, operation, details, duration) => {
    loggers.ai.info('AI Service Call', {
      service: service,
      operation: operation,
      duration: duration,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log database operations
  logDatabase: (operation, table, details, duration) => {
    loggers.database.info('Database Operation', {
      operation: operation,
      table: table,
      duration: duration,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log performance metrics
  logPerformance: (metric, value, details = {}) => {
    loggers.performance.info('Performance Metric', {
      metric: metric,
      value: value,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log application errors with context
  logError: (error, context = {}) => {
    logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
      timestamp: new Date().toISOString()
    });
  },
  
  // Log user actions for audit trail
  logUserAction: (userId, action, details = {}) => {
    logger.info('User Action', {
      userId: userId,
      action: action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

// Export both individual loggers and helper functions
module.exports = {
  logger,
  loggers,
  logHelpers
};