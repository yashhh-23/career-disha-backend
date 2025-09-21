const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { body, query, param, validationResult } = require('express-validator');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
    // Using default key generator (IP-based) which handles IPv6 properly
  });
};

// Different rate limits for different endpoint types
const rateLimiters = {
  // Very strict for auth endpoints
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per window
    'Too many authentication attempts. Please try again in 15 minutes.'
  ),
  
  // Moderate for AI-powered endpoints (expensive operations)
  ai: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    10, // 10 requests per window
    'Too many AI requests. Please wait 5 minutes before trying again.'
  ),
  
  // Lenient for general API endpoints
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many requests. Please try again in 15 minutes.'
  ),
  
  // Very lenient for read-only endpoints
  read: createRateLimiter(
    1 * 60 * 1000, // 1 minute
    60, // 60 requests per minute
    'Too many read requests. Please slow down.'
  ),
  
  // Moderate for upload endpoints
  upload: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    20, // 20 uploads per hour
    'Too many file uploads. Please try again in an hour.'
  ),
  
  // Strict for admin endpoints
  admin: createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    20, // 20 requests per 5 minutes
    'Too many admin requests. Please wait 5 minutes.'
  )
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow localhost
    if (process.env.NODE_ENV === 'development') {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173', // Vite default
        'http://localhost:5174', // Vite alternative port
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174'
      ];
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // In production, check against allowed domains
    const allowedDomains = process.env.ALLOWED_DOMAINS ? 
      process.env.ALLOWED_DOMAINS.split(',') : [];
    
    if (allowedDomains.includes(origin)) {
      return callback(null, true);
    }
    
    // Default: reject
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  maxAge: 86400 // 24 hours
};

// Helmet security configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://generativelanguage.googleapis.com",
        "https://api-inference.huggingface.co",
        "wss:",
        "ws:"
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API server
};

// Input validation helpers
const validationRules = {
  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Password validation
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be 8-128 characters with uppercase, lowercase, number, and special character'),
  
  // Generic text validation
  text: (field, min = 1, max = 1000) => body(field)
    .trim()
    .isLength({ min, max })
    .withMessage(`${field} must be ${min}-${max} characters long`)
    .escape(),
  
  // ID validation
  id: (paramName = 'id') => param(paramName)
    .isInt({ min: 1 })
    .withMessage('Invalid ID parameter'),
  
  // Query parameter validation
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  offset: query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  // Array validation
  array: (field) => body(field)
    .optional()
    .isArray()
    .withMessage(`${field} must be an array`),
  
  // Role validation
  role: body('role')
    .isIn(['student', 'mentor', 'admin'])
    .withMessage('Role must be student, mentor, or admin'),
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Sanitize input middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts from request body
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), location=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// Request logging middleware for security monitoring
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalJson = res.json;
  
  // Override res.json to log response status
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      size: JSON.stringify(data).length
    };
    
    // Log suspicious activities
    if (res.statusCode >= 400 || duration > 5000) {
      console.warn('SECURITY LOG:', logData);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('REQUEST LOG:', logData);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Environment-specific security configurations
const getSecurityConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    isProduction,
    enforceHttps: isProduction,
    trustProxy: isProduction,
    secureCookies: isProduction,
    strictCors: isProduction
  };
};

module.exports = {
  rateLimiters,
  corsOptions,
  helmetConfig,
  validationRules,
  handleValidationErrors,
  sanitizeInput,
  securityHeaders,
  securityLogger,
  getSecurityConfig,
  
  // Convenience exports
  helmet: helmet(helmetConfig),
  cors: cors(corsOptions)
};