const express = require('express');
const os = require('os');
const performanceTracker = require('../services/performanceTracker');
const { getErrorSummary } = require('../services/sentryService');
const { pool, query } = require('../database/connection');
const router = express.Router();

// System health check
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database connectivity
    const dbStart = Date.now();
    await query('SELECT 1');
    const dbResponseTime = Date.now() - dbStart;

    // System metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = process.memoryUsage();

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      services: {
        database: {
          status: 'healthy',
          responseTime: dbResponseTime
        },
        api: {
          status: 'healthy',
          responseTime: Date.now() - startTime
        }
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: usedMemory,
          usagePercent: Math.round((usedMemory / totalMemory) * 100),
          heap: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            external: memoryUsage.external
          }
        },
        cpu: {
          loadAverage: os.loadavg(),
          cores: os.cpus().length
        }
      },
      environment: process.env.NODE_ENV
    };

    // Check for concerning metrics
    if (healthData.system.memory.usagePercent > 90) {
      healthData.status = 'warning';
      healthData.warnings = ['High memory usage'];
    }

    if (dbResponseTime > 1000) {
      healthData.status = 'warning';
      healthData.warnings = healthData.warnings || [];
      healthData.warnings.push('Slow database response');
    }

    res.status(200).json(healthData);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: {
          status: 'unhealthy',
          error: 'Database connection failed'
        },
        api: {
          status: 'healthy'
        }
      }
    });
  }
});

// Detailed system metrics
router.get('/metrics', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get active connections and database stats
    let dbStats = null;
    try {
      const dbStatsQuery = await query(`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
          (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size
      `);
      const userCount = await query('SELECT COUNT(*) FROM users');
      const projectCount = await query('SELECT COUNT(*) FROM projects');
      dbStats = {
        ...dbStatsQuery.rows[0],
        connectionPool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        },
        rows: {
          users: parseInt(userCount.rows[0].count, 10),
          projects: parseInt(projectCount.rows[0].count, 10)
        }
      };
    } catch (dbError) {
      console.error('Database metrics error:', dbError);
    }

    // Get recent error summary from Sentry
    let errorSummary = null;
    try {
      errorSummary = await getErrorSummary('24h');
    } catch (sentryErr) {
      console.error('Sentry metrics error:', sentryErr);
    }

    const metrics = {
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      system: {
        arch: os.arch(),
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        memory: {
          total: os.totalmem(),
          free: os.freemem()
        },
        loadAverage: os.loadavg(),
        networkInterfaces: Object.keys(os.networkInterfaces()).length
      },
      database: dbStats,
      errors: errorSummary || { available: false },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nodeVersion: process.version,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    res.json(metrics);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

// Application-specific analytics
router.get('/analytics', async (req, res) => {
  try {
    // Get application usage statistics
    const userStats = await query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h,
        COUNT(CASE WHEN subscription_plan != 'free' THEN 1 END) as paid_users
      FROM users
    `);

    const projectStats = await query(`
      SELECT
        COUNT(*) as total_projects,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_projects_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_projects_24h,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_project_duration_hours
      FROM projects
    `);

    const metrics = performanceTracker.getMetrics();
    let totalTime = 0;
    let requestCount = 0;
    let errorCount = 0;

    for (const calls of Object.values(metrics)) {
      for (const entry of calls) {
        totalTime += entry.responseTimeMs;
        requestCount += 1;
        if (entry.statusCode >= 400) {
          errorCount += 1;
        }
      }
    }

    const avgResponse = requestCount ? totalTime / requestCount : 0;
    const errorRate = requestCount ? (errorCount / requestCount) * 100 : 0;

    const analytics = {
      timestamp: new Date().toISOString(),
      users: userStats.rows[0],
      projects: projectStats.rows[0],
      performance: {
        avgResponseTime: `${avgResponse.toFixed(2)}ms`,
        errorRate: `${errorRate.toFixed(2)}%`,
        uptime: `${(process.uptime() / 3600).toFixed(2)}h`
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Analytics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect analytics',
      message: error.message
    });
  }
});

// Error tracking summary
router.get('/errors', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;

    if (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) {
      return res.status(503).json({
        error: 'Monitoring unavailable',
        message: 'Sentry configuration missing'
      });
    }

    const summary = await getErrorSummary(timeframe);

    res.json({
      timestamp: new Date().toISOString(),
      timeframe,
      ...summary
    });
  } catch (error) {
    console.error('Error summary failed:', error);
    res.status(500).json({
      error: 'Failed to get error summary',
      message: error.message
    });
  }
});

// Performance metrics for specific endpoints
router.get('/performance', (req, res) => {
  try {
    res.json({
      timestamp: new Date().toISOString(),
      metrics: performanceTracker.getMetrics()
    });
  } catch (error) {
    console.error('Performance metrics failed:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error.message
    });
  }
});

module.exports = router;
