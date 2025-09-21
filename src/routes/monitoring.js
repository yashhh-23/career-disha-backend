const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const authMiddleware = require('../middlewares/auth');
const { requireRole: roleMiddleware } = require('../middlewares/roleAuth');
const { userActionMiddleware } = require('../middlewares/monitoring');

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: System monitoring and performance metrics endpoints
 */

/**
 * @swagger
 * /api/monitoring/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, critical]
 *                 issues:
 *                   type: array
 *                   items:
 *                     type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in milliseconds
 *                 lastCheck:
 *                   type: number
 *                   description: Last health check timestamp
 *       503:
 *         description: System is in critical state
 */
router.get('/health', (req, res) => {
  try {
    const health = monitoringService.getHealthStatus();
    const statusCode = health.status === 'critical' ? 503 : 200;
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get health status',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/metrics:
 *   get:
 *     summary: Get comprehensive system metrics (Admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: object
 *                       description: Request metrics
 *                     errors:
 *                       type: object
 *                       description: Error metrics
 *                     auth:
 *                       type: object
 *                       description: Authentication metrics
 *                     ai:
 *                       type: object
 *                       description: AI service metrics
 *                     database:
 *                       type: object
 *                       description: Database performance metrics
 *                     websocket:
 *                       type: object
 *                       description: WebSocket metrics
 *                     system:
 *                       type: object
 *                       description: System resource metrics
 *                     computed:
 *                       type: object
 *                       description: Computed analytics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/metrics', 
  authMiddleware, 
  roleMiddleware(['admin']),
  userActionMiddleware('view_system_metrics'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/requests:
 *   get:
 *     summary: Get request-specific metrics (Admin/Mentor only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     byStatus:
 *                       type: object
 *                     byRoute:
 *                       type: object
 *                     byMethod:
 *                       type: object
 *                     responseTime:
 *                       type: object
 *                     errorRate:
 *                       type: number
 *                     averageResponseTime:
 *                       type: number
 */
router.get('/metrics/requests',
  authMiddleware,
  roleMiddleware(['admin', 'mentor']),
  userActionMiddleware('view_request_metrics'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics.requests,
          errorRate: metrics.computed.errorRate,
          averageResponseTime: metrics.computed.averageResponseTime
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get request metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/errors:
 *   get:
 *     summary: Get error metrics (Admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Error metrics
 */
router.get('/metrics/errors',
  authMiddleware,
  roleMiddleware(['admin']),
  userActionMiddleware('view_error_metrics'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics.errors,
          errorRate: metrics.computed.errorRate
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get error metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/system:
 *   get:
 *     summary: Get system resource metrics (Admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics including memory, CPU, and process info
 */
router.get('/metrics/system',
  authMiddleware,
  roleMiddleware(['admin']),
  userActionMiddleware('view_system_resources'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics.system,
          uptime: metrics.computed.uptime
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get system metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/ai:
 *   get:
 *     summary: Get AI service metrics (Admin/Mentor only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI service performance metrics
 */
router.get('/metrics/ai',
  authMiddleware,
  roleMiddleware(['admin', 'mentor']),
  userActionMiddleware('view_ai_metrics'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics.ai,
          averageResponseTime: metrics.computed.averageAIResponseTime,
          successRate: metrics.ai.callCount > 0 
            ? (metrics.ai.callCount - metrics.ai.fallbacksUsed) / metrics.ai.callCount 
            : 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get AI metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/database:
 *   get:
 *     summary: Get database performance metrics (Admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database performance metrics
 */
router.get('/metrics/database',
  authMiddleware,
  roleMiddleware(['admin']),
  userActionMiddleware('view_database_metrics'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics.database,
          averageQueryTime: metrics.computed.averageDatabaseQueryTime,
          slowQueryRate: metrics.database.queries > 0 
            ? metrics.database.queryTime.slow / metrics.database.queries 
            : 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get database metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/websocket:
 *   get:
 *     summary: Get WebSocket metrics (Admin/Mentor only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WebSocket performance metrics
 */
router.get('/metrics/websocket',
  authMiddleware,
  roleMiddleware(['admin', 'mentor']),
  userActionMiddleware('view_websocket_metrics'),
  (req, res) => {
    try {
      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics.websocket,
          totalMessages: metrics.websocket.messagesReceived + metrics.websocket.messagesSent
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get WebSocket metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/metrics/reset:
 *   post:
 *     summary: Reset all metrics counters (Admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/metrics/reset',
  authMiddleware,
  roleMiddleware(['admin']),
  userActionMiddleware('reset_system_metrics'),
  (req, res) => {
    try {
      monitoringService.resetMetrics();
      
      res.json({
        success: true,
        message: 'Metrics reset successfully',
        resetAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to reset metrics',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/summary:
 *   get:
 *     summary: Get monitoring summary dashboard (Admin/Mentor only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: High-level monitoring summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     health:
 *                       type: object
 *                     performance:
 *                       type: object
 *                     activity:
 *                       type: object
 *                     alerts:
 *                       type: array
 */
router.get('/summary',
  authMiddleware,
  roleMiddleware(['admin', 'mentor']),
  userActionMiddleware('view_monitoring_summary'),
  (req, res) => {
    try {
      const health = monitoringService.getHealthStatus();
      const metrics = monitoringService.getMetrics();
      
      const summary = {
        health: {
          status: health.status,
          uptime: health.uptime,
          issues: health.issues
        },
        performance: {
          totalRequests: metrics.requests.total,
          errorRate: metrics.computed.errorRate,
          averageResponseTime: metrics.computed.averageResponseTime,
          activeWebSocketConnections: metrics.websocket.activeConnections
        },
        activity: {
          recentLogins: metrics.auth.logins,
          aiServiceCalls: metrics.ai.callCount,
          databaseQueries: metrics.database.queries,
          websocketMessages: metrics.websocket.messagesReceived + metrics.websocket.messagesSent
        },
        resources: {
          memoryUsage: metrics.system.memory?.system?.usage || 0,
          cpuLoad: metrics.system.cpu?.loadAvg?.[0] || 0
        }
      };
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get monitoring summary',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/monitoring/alerts:
 *   get:
 *     summary: Get current system alerts (Admin only)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current system alerts
 */
router.get('/alerts',
  authMiddleware,
  roleMiddleware(['admin']),
  userActionMiddleware('view_system_alerts'),
  (req, res) => {
    try {
      const alerts = [];
      const metrics = monitoringService.getMetrics();
      
      // Check for active alerts based on current metrics
      if (metrics.computed.errorRate > 0.05) {
        alerts.push({
          type: 'HIGH_ERROR_RATE',
          severity: 'high',
          message: `Error rate ${(metrics.computed.errorRate * 100).toFixed(2)}% exceeds 5% threshold`,
          timestamp: new Date().toISOString()
        });
      }
      
      if (metrics.computed.averageResponseTime > 2000) {
        alerts.push({
          type: 'HIGH_RESPONSE_TIME',
          severity: 'medium',
          message: `Average response time ${metrics.computed.averageResponseTime.toFixed(2)}ms exceeds 2000ms threshold`,
          timestamp: new Date().toISOString()
        });
      }
      
      if (metrics.system.memory?.system?.usage > 0.9) {
        alerts.push({
          type: 'HIGH_MEMORY_USAGE',
          severity: 'critical',
          message: `Memory usage ${(metrics.system.memory.system.usage * 100).toFixed(2)}% exceeds 90% threshold`,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: alerts,
        count: alerts.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get alerts',
        error: error.message
      });
    }
  }
);

module.exports = router;