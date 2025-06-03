const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

class ErrorTracker {
  constructor() {
    this.logger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'colorbook-engine' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d'
        })
      ]
    });

    this.metrics = {
      errors: new Map(),
      apiCalls: new Map(),
      performance: new Map()
    };
  }

  logError(error, context = {}) {
    const errorKey = error.name || 'UnknownError';
    const count = this.metrics.errors.get(errorKey) || 0;
    this.metrics.errors.set(errorKey, count + 1);

    this.logger.error({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      count: count + 1
    });

    // If critical error, send alert
    if (this.isCritical(error)) {
      this.sendAlert(error, context);
    }
  }

  trackAPICall(endpoint, duration, status) {
    const key = `${endpoint}-${status}`;
    const calls = this.metrics.apiCalls.get(key) || [];
    calls.push({ duration, timestamp: Date.now() });
    
    // Keep only last 1000 calls
    if (calls.length > 1000) {
      calls.shift();
    }
    
    this.metrics.apiCalls.set(key, calls);
  }

  trackPerformance(operation, duration) {
    const operations = this.metrics.performance.get(operation) || [];
    operations.push({ duration, timestamp: Date.now() });
    
    if (operations.length > 100) {
      operations.shift();
    }
    
    this.metrics.performance.set(operation, operations);
  }

  isCritical(error) {
    const criticalErrors = [
      'DatabaseConnectionError',
      'PaymentProcessingError',
      'AuthenticationError',
      'DataCorruptionError'
    ];
    return criticalErrors.includes(error.name) || error.message.includes('CRITICAL');
  }

  sendAlert(error, context) {
    // In production, this would send to Slack, email, or monitoring service
    console.error('🚨 CRITICAL ERROR ALERT:', {
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  getMetrics() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    return {
      errors: Object.fromEntries(this.metrics.errors),
      apiStats: this.calculateAPIStats(now - oneHour),
      performance: this.calculatePerformanceStats(now - oneHour),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  calculateAPIStats(since) {
    const stats = {};
    
    for (const [key, calls] of this.metrics.apiCalls) {
      const recentCalls = calls.filter(call => call.timestamp > since);
      if (recentCalls.length > 0) {
        const durations = recentCalls.map(call => call.duration);
        stats[key] = {
          count: recentCalls.length,
          avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
          maxDuration: Math.max(...durations),
          minDuration: Math.min(...durations)
        };
      }
    }
    
    return stats;
  }

  calculatePerformanceStats(since) {
    const stats = {};
    
    for (const [operation, measurements] of this.metrics.performance) {
      const recent = measurements.filter(m => m.timestamp > since);
      if (recent.length > 0) {
        const durations = recent.map(m => m.duration);
        stats[operation] = {
          count: recent.length,
          avg: durations.reduce((a, b) => a + b, 0) / durations.length,
          max: Math.max(...durations),
          min: Math.min(...durations)
        };
      }
    }
    
    return stats;
  }

  middleware() {
    return (err, req, res, next) => {
      this.logError(err, {
        url: req.url,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : err.message,
        requestId: req.id || 'unknown'
      });
    };
  }

  performanceMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.trackAPICall(req.route?.path || req.url, duration, res.statusCode);
      });
      
      next();
    };
  }
}

module.exports = new ErrorTracker();
