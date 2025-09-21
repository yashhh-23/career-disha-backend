const express = require('express');
// In serverless mode we don't create an HTTP server; Cloud Functions handles it
require('dotenv').config();

// Initialize MongoDB connection
const { connectDB } = require('./config/mongoose');
connectDB();

// Security imports
const { 
  helmet, 
  cors, 
  rateLimiters, 
  sanitizeInput, 
  securityHeaders, 
  securityLogger,
  getSecurityConfig 
} = require('./middlewares/security');

// Swagger documentation imports
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Socket.io removed for serverless compatibility

// Monitoring services
const monitoringService = require('./services/monitoringService');
const { 
  performanceMiddleware, 
  errorTrackingMiddleware, 
  healthCheckMiddleware, 
  wsEventWrapper,
  rateLimitTrackingWrapper,
  resourceMonitoringMiddleware 
} = require('./middlewares/monitoring');

const authRoutes = require('./api/auth');
const profileRoutes = require('./api/profile');
const uploadRoutes = require('./api/uploads');
const lessonsRoutes = require('./api/lessons');
const progressRoutes = require('./api/progress');
const interviewRoutes = require('./api/interview');
const recommendationsRoutes = require('./api/recommendations');
const mentorshipRoutes = require('./api/mentorship');
const adminRoutes = require('./api/admin');
const constellationRoutes = require('./api/constellation');
const notificationsRoutes = require('./api/notifications');
const externalRoutes = require('./api/external');
const monitoringRoutes = require('./routes/monitoring');
const accountRoutes = require('./api/account');
const authMiddleware = require('./middlewares/auth');
const { requireAnyRole } = require('./middlewares/roleAuth');

const app = express();
const PORT = process.env.PORT || 3000;
const securityConfig = getSecurityConfig();

// Optional Sentry init
try {
  if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    const Tracing = require('@sentry/tracing');
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
    global.__SENTRY__ = Sentry;
  }
} catch (_) {}

// Trust proxy in production (for proper IP detection behind load balancers)
if (securityConfig.trustProxy) {
  app.set('trust proxy', 1);
}

// Apply security middleware in correct order
app.use(securityLogger); // Log all requests
app.use(helmet); // Security headers
app.use(cors); // CORS configuration
app.use(securityHeaders); // Additional security headers
app.use(sanitizeInput); // Input sanitization
app.use(express.json({ limit: '10mb' })); // Body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply monitoring middleware
app.use(healthCheckMiddleware); // Handle health checks early
app.use(performanceMiddleware); // Performance tracking
app.use(resourceMonitoringMiddleware); // Resource usage monitoring

// Apply general rate limiting to all routes with monitoring
app.use(rateLimitTrackingWrapper(rateLimiters.general));

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check endpoint
 *     description: Check if the API server is running and responsive
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Backend server is running!
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 */
// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Career Disha Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      docs: '/api/docs',
      auth: '/api/v1/auth',
      interview: '/api/v1/interview',
      recommendations: '/api/v1/recommendations',
      uploads: '/api/v1/uploads'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Apply specific rate limiting for auth routes with monitoring
app.use('/api/v1/auth', rateLimitTrackingWrapper(rateLimiters.auth), authRoutes);
app.use('/api/v1/profile', authMiddleware, requireAnyRole(), profileRoutes);
app.use('/api/v1/uploads', rateLimitTrackingWrapper(rateLimiters.upload), authMiddleware, requireAnyRole(), uploadRoutes);
app.use('/api/v1/lessons', authMiddleware, requireAnyRole(), lessonsRoutes);
app.use('/api/v1/progress', authMiddleware, requireAnyRole(), progressRoutes);
app.use('/api/v1/interview', rateLimitTrackingWrapper(rateLimiters.ai), authMiddleware, requireAnyRole(), interviewRoutes);
app.use('/api/v1/recommendations', rateLimitTrackingWrapper(rateLimiters.ai), authMiddleware, requireAnyRole(), recommendationsRoutes);
app.use('/api/v1/mentorship', authMiddleware, requireAnyRole(), mentorshipRoutes);
app.use('/api/v1/admin', rateLimitTrackingWrapper(rateLimiters.admin), authMiddleware, requireAnyRole(), adminRoutes);
app.use('/api/v1/constellation', authMiddleware, requireAnyRole(), constellationRoutes);
app.use('/api/v1/notifications', authMiddleware, requireAnyRole(), notificationsRoutes);
app.use('/api/v1/external', rateLimitTrackingWrapper(rateLimiters.ai), authMiddleware, requireAnyRole(), externalRoutes);
app.use('/api/v1/account', authMiddleware, requireAnyRole(), accountRoutes);

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Swagger Documentation Routes
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CareerDisha API Documentation'
}));

// JSON version of the API spec
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Socket routes removed

// Health pings for DB and AI
app.get('/api/health/deps', async (req, res) => {
  const status = { db: false, ai: false };
  try {
    const mongoose = require('mongoose');
    status.db = mongoose.connection.readyState === 1;
  } catch (_) {}
  try {
    const aiService = require('./services/aiService');
    // Lightweight call: build prompt only
    status.ai = !!aiService;
  } catch (_) {}
  res.json({ status, timestamp: new Date().toISOString() });
});

// Error tracking middleware (must be last)
app.use(errorTrackingMiddleware);

// For local/dev only, start listener. In serverless, we export the app.
if (process.env.FUNCTIONS_FRAMEWORK === 'true' || process.env.K_SERVICE) {
  // Running in serverless; do not listen
} else {
  app.listen(PORT, () => {
    console.log(`🚀 Server is listening on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`📊 Monitoring available at http://localhost:${PORT}/api/monitoring/health`);
    console.log(`📈 Performance metrics at http://localhost:${PORT}/api/monitoring/summary`);
  });
}

module.exports = app;
