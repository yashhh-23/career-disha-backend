const { loggers, logHelpers } = require('../config/logger');
const os = require('os');
const process = require('process');

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byStatus: {},
        byRoute: {},
        byMethod: {},
        responseTime: {
          sum: 0,
          count: 0,
          min: Infinity,
          max: 0,
          buckets: {
            '50ms': 0,
            '100ms': 0,
            '250ms': 0,
            '500ms': 0,
            '1s': 0,
            '2s+': 0
          }
        }
      },
      errors: {
        total: 0,
        byType: {},
        byRoute: {}
      },
      auth: {
        logins: 0,
        loginFailures: 0,
        registrations: 0,
        tokenRefreshes: 0
      },
      ai: {
        geminiCalls: 0,
        huggingFaceCalls: 0,
        fallbacksUsed: 0,
        totalResponseTime: 0,
        callCount: 0
      },
      database: {
        queries: 0,
        queryTime: {
          sum: 0,
          count: 0,
          slow: 0 // queries > 1000ms
        },
        connections: {
          active: 0,
          created: 0,
          destroyed: 0
        }
      },
      websocket: {
        connections: 0,
        disconnections: 0,
        messagesReceived: 0,
        messagesSent: 0,
        activeConnections: 0
      }
    };

    this.alerts = {
      highErrorRate: { threshold: 0.05, triggered: false }, // 5% error rate
      highResponseTime: { threshold: 2000, triggered: false }, // 2 seconds
      highMemoryUsage: { threshold: 0.9, triggered: false }, // 90% memory
      highCPUUsage: { threshold: 0.8, triggered: false }, // 80% CPU
      lowDiskSpace: { threshold: 0.9, triggered: false } // 90% disk usage
    };

    this.startTime = Date.now();
    this.lastHealthCheck = Date.now();

    // Start periodic monitoring
    this.startPeriodicMonitoring();

    console.log('📊 Monitoring Service initialized');
  }

  // === METRIC COLLECTION METHODS ===

  recordRequest(req, res, responseTime) {
    try {
      this.metrics.requests.total++;
      
      // By status code
      const statusCode = res.statusCode.toString();
      this.metrics.requests.byStatus[statusCode] = (this.metrics.requests.byStatus[statusCode] || 0) + 1;
      
      // By route (simplified)
      const route = this.simplifyRoute(req.route?.path || req.path);
      this.metrics.requests.byRoute[route] = (this.metrics.requests.byRoute[route] || 0) + 1;
      
      // By method
      const method = req.method;
      this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;

      // Response time tracking
      this.updateResponseTimeMetrics(responseTime);

      // Log to Winston
      logHelpers.logApiRequest(req, res, responseTime);

      // Check for alerts
      this.checkResponseTimeAlert(responseTime);
      this.checkErrorRateAlert();

    } catch (error) {
      logHelpers.logError(error, { context: 'recordRequest' });
    }
  }

  recordError(error, req = null) {
    try {
      this.metrics.errors.total++;
      
      // By error type
      const errorType = error.name || 'Unknown';
      this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
      
      // By route if available
      if (req) {
        const route = this.simplifyRoute(req.route?.path || req.path);
        this.metrics.errors.byRoute[route] = (this.metrics.errors.byRoute[route] || 0) + 1;
      }

      // Log error
      logHelpers.logError(error, {
        route: req?.path,
        method: req?.method,
        userId: req?.user?.id
      });

    } catch (logError) {
      console.error('Error recording error metrics:', logError);
    }
  }

  recordAuth(event, success = true, details = {}) {
    try {
      switch (event) {
        case 'login':
          if (success) {
            this.metrics.auth.logins++;
          } else {
            this.metrics.auth.loginFailures++;
          }
          break;
        case 'register':
          if (success) {
            this.metrics.auth.registrations++;
          }
          break;
        case 'token_refresh':
          this.metrics.auth.tokenRefreshes++;
          break;
      }

      logHelpers.logAuth(event, { success, ...details });

    } catch (error) {
      logHelpers.logError(error, { context: 'recordAuth' });
    }
  }

  recordAICall(service, operation, responseTime, success = true) {
    try {
      this.metrics.ai.callCount++;
      this.metrics.ai.totalResponseTime += responseTime;

      if (service === 'gemini') {
        this.metrics.ai.geminiCalls++;
      } else if (service === 'huggingface') {
        this.metrics.ai.huggingFaceCalls++;
      }

      if (!success) {
        this.metrics.ai.fallbacksUsed++;
      }

      logHelpers.logAI(service, operation, { success }, responseTime);

    } catch (error) {
      logHelpers.logError(error, { context: 'recordAICall' });
    }
  }

  recordDatabaseQuery(operation, table, duration) {
    try {
      this.metrics.database.queries++;
      this.metrics.database.queryTime.sum += duration;
      this.metrics.database.queryTime.count++;

      if (duration > 1000) { // Slow query threshold
        this.metrics.database.queryTime.slow++;
        logHelpers.logPerformance('slow_query', duration, { operation, table });
      }

      logHelpers.logDatabase(operation, table, {}, duration);

    } catch (error) {
      logHelpers.logError(error, { context: 'recordDatabaseQuery' });
    }
  }

  recordWebSocketEvent(event, details = {}) {
    try {
      switch (event) {
        case 'connect':
          this.metrics.websocket.connections++;
          this.metrics.websocket.activeConnections++;
          break;
        case 'disconnect':
          this.metrics.websocket.disconnections++;
          this.metrics.websocket.activeConnections = Math.max(0, this.metrics.websocket.activeConnections - 1);
          break;
        case 'message_received':
          this.metrics.websocket.messagesReceived++;
          break;
        case 'message_sent':
          this.metrics.websocket.messagesSent++;
          break;
      }

      logHelpers.logPerformance('websocket_event', event, details);

    } catch (error) {
      logHelpers.logError(error, { context: 'recordWebSocketEvent' });
    }
  }

  // === UTILITY METHODS ===

  updateResponseTimeMetrics(responseTime) {
    const rt = this.metrics.requests.responseTime;
    rt.sum += responseTime;
    rt.count++;
    rt.min = Math.min(rt.min, responseTime);
    rt.max = Math.max(rt.max, responseTime);

    // Update buckets
    if (responseTime <= 50) rt.buckets['50ms']++;
    else if (responseTime <= 100) rt.buckets['100ms']++;
    else if (responseTime <= 250) rt.buckets['250ms']++;
    else if (responseTime <= 500) rt.buckets['500ms']++;
    else if (responseTime <= 1000) rt.buckets['1s']++;
    else rt.buckets['2s+']++;
  }

  simplifyRoute(path) {
    if (!path) return 'unknown';
    
    // Replace IDs with placeholder
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid');
  }

  // === SYSTEM METRICS ===

  getSystemMetrics() {
    try {
      const uptime = Date.now() - this.startTime;
      const memUsage = process.memoryUsage();
      const loadAvg = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      return {
        uptime: uptime,
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          system: {
            total: totalMem,
            free: freeMem,
            used: totalMem - freeMem,
            usage: (totalMem - freeMem) / totalMem
          }
        },
        cpu: {
          loadAvg: loadAvg,
          usage: process.cpuUsage()
        },
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
    } catch (error) {
      logHelpers.logError(error, { context: 'getSystemMetrics' });
      return {};
    }
  }

  // === ALERT CHECKING ===

  checkResponseTimeAlert(responseTime) {
    const threshold = this.alerts.highResponseTime.threshold;
    if (responseTime > threshold && !this.alerts.highResponseTime.triggered) {
      this.triggerAlert('HIGH_RESPONSE_TIME', `Response time ${responseTime}ms exceeded threshold ${threshold}ms`);
      this.alerts.highResponseTime.triggered = true;
    } else if (responseTime <= threshold && this.alerts.highResponseTime.triggered) {
      this.clearAlert('HIGH_RESPONSE_TIME');
      this.alerts.highResponseTime.triggered = false;
    }
  }

  checkErrorRateAlert() {
    const errorRate = this.getErrorRate();
    const threshold = this.alerts.highErrorRate.threshold;
    
    if (errorRate > threshold && !this.alerts.highErrorRate.triggered) {
      this.triggerAlert('HIGH_ERROR_RATE', `Error rate ${(errorRate * 100).toFixed(2)}% exceeded threshold ${(threshold * 100)}%`);
      this.alerts.highErrorRate.triggered = true;
    } else if (errorRate <= threshold && this.alerts.highErrorRate.triggered) {
      this.clearAlert('HIGH_ERROR_RATE');
      this.alerts.highErrorRate.triggered = false;
    }
  }

  checkSystemAlerts() {
    const systemMetrics = this.getSystemMetrics();

    // Memory usage alert
    const memUsage = systemMetrics.memory?.system?.usage || 0;
    if (memUsage > this.alerts.highMemoryUsage.threshold && !this.alerts.highMemoryUsage.triggered) {
      this.triggerAlert('HIGH_MEMORY_USAGE', `Memory usage ${(memUsage * 100).toFixed(2)}% exceeded threshold`);
      this.alerts.highMemoryUsage.triggered = true;
    } else if (memUsage <= this.alerts.highMemoryUsage.threshold && this.alerts.highMemoryUsage.triggered) {
      this.clearAlert('HIGH_MEMORY_USAGE');
      this.alerts.highMemoryUsage.triggered = false;
    }
  }

  triggerAlert(type, message) {
    logHelpers.logSecurity('ALERT_TRIGGERED', {
      alertType: type,
      message: message,
      severity: 'high'
    }, 'error');

    // In production, you might want to send notifications here
    // e.g., Slack, email, PagerDuty, etc.
  }

  clearAlert(type) {
    logHelpers.logSecurity('ALERT_CLEARED', {
      alertType: type,
      severity: 'info'
    }, 'info');
  }

  // === ANALYTICS ===

  getErrorRate() {
    if (this.metrics.requests.total === 0) return 0;
    return this.metrics.errors.total / this.metrics.requests.total;
  }

  getAverageResponseTime() {
    const rt = this.metrics.requests.responseTime;
    return rt.count > 0 ? rt.sum / rt.count : 0;
  }

  getAverageAIResponseTime() {
    return this.metrics.ai.callCount > 0 
      ? this.metrics.ai.totalResponseTime / this.metrics.ai.callCount 
      : 0;
  }

  getAverageDatabaseQueryTime() {
    const db = this.metrics.database.queryTime;
    return db.count > 0 ? db.sum / db.count : 0;
  }

  // === PERIODIC MONITORING ===

  startPeriodicMonitoring() {
    // Log system metrics every 5 minutes
    setInterval(() => {
      this.logSystemMetrics();
      this.checkSystemAlerts();
    }, 5 * 60 * 1000);

    // Log performance summary every hour
    setInterval(() => {
      this.logPerformanceSummary();
    }, 60 * 60 * 1000);
  }

  logSystemMetrics() {
    const systemMetrics = this.getSystemMetrics();
    logHelpers.logPerformance('system_metrics', 'hourly', systemMetrics);
  }

  logPerformanceSummary() {
    const summary = {
      requests: {
        total: this.metrics.requests.total,
        errorRate: this.getErrorRate(),
        averageResponseTime: this.getAverageResponseTime()
      },
      ai: {
        totalCalls: this.metrics.ai.callCount,
        averageResponseTime: this.getAverageAIResponseTime(),
        geminiCalls: this.metrics.ai.geminiCalls,
        fallbacks: this.metrics.ai.fallbacksUsed
      },
      database: {
        totalQueries: this.metrics.database.queries,
        averageQueryTime: this.getAverageDatabaseQueryTime(),
        slowQueries: this.metrics.database.queryTime.slow
      },
      websocket: {
        activeConnections: this.metrics.websocket.activeConnections,
        totalMessages: this.metrics.websocket.messagesReceived + this.metrics.websocket.messagesSent
      }
    };

    logHelpers.logPerformance('performance_summary', 'hourly', summary);
  }

  // === PUBLIC API ===

  getMetrics() {
    return {
      ...this.metrics,
      system: this.getSystemMetrics(),
      computed: {
        errorRate: this.getErrorRate(),
        averageResponseTime: this.getAverageResponseTime(),
        averageAIResponseTime: this.getAverageAIResponseTime(),
        averageDatabaseQueryTime: this.getAverageDatabaseQueryTime(),
        uptime: Date.now() - this.startTime
      }
    };
  }

  getHealthStatus() {
    const systemMetrics = this.getSystemMetrics();
    const errorRate = this.getErrorRate();
    const avgResponseTime = this.getAverageResponseTime();

    const issues = [];
    let status = 'healthy';

    // Check various health indicators
    if (errorRate > 0.1) {
      issues.push('High error rate');
      status = 'degraded';
    }

    if (avgResponseTime > 1000) {
      issues.push('High response time');
      status = 'degraded';
    }

    if (systemMetrics.memory?.system?.usage > 0.9) {
      issues.push('High memory usage');
      status = 'critical';
    }

    this.lastHealthCheck = Date.now();

    return {
      status: status,
      issues: issues,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      lastCheck: this.lastHealthCheck
    };
  }

  resetMetrics() {
    // Reset counters but keep structural data
    Object.keys(this.metrics).forEach(key => {
      if (typeof this.metrics[key] === 'object') {
        Object.keys(this.metrics[key]).forEach(subKey => {
          if (typeof this.metrics[key][subKey] === 'number') {
            this.metrics[key][subKey] = 0;
          } else if (typeof this.metrics[key][subKey] === 'object') {
            Object.keys(this.metrics[key][subKey]).forEach(subSubKey => {
              if (typeof this.metrics[key][subKey][subSubKey] === 'number') {
                this.metrics[key][subKey][subSubKey] = 0;
              }
            });
          }
        });
      }
    });

    logHelpers.logPerformance('metrics_reset', 'manual', {
      resetBy: 'system',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new MonitoringService();