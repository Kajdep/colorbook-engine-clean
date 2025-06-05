const express = require('express');
const os = require('os');
const { Pool } = require('pg');
const performanceTracker = require('../services/performanceTracker');
const router = express.Router();

// Database connection for health checks
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// System health check
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database connectivity
    const dbStart = Date.now();
    await pool.query('SELECT 1');
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
      const dbStatsQuery = await pool.query(`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
          (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size
      `);
      dbStats = dbStatsQuery.rows[0];
    } catch (dbError) {
      console.error('Database metrics error:', dbError);
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
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h,
        COUNT(CASE WHEN subscription_plan != 'free' THEN 1 END) as paid_users
      FROM users
    `);

    const projectStats = await pool.query(`
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_projects_24h,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_projects_24h,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_project_duration_hours
      FROM projects
    `);

    const analytics = {
      timestamp: new Date().toISOString(),
      users: userStats.rows[0],
      projects: projectStats.rows[0],
      performance: {
        avgResponseTime: '< 200ms', // This would be calculated from actual request logs
        errorRate: '< 0.1%', // This would be calculated from error tracking
        uptime: '99.9%' // This would be calculated from monitoring data
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
    
    // This would typically connect to your error tracking service
    // For now, we'll return a placeholder structure
    const errorSummary = {
      timestamp: new Date().toISOString(),
      timeframe,
      summary: {
        totalErrors: 0,
        criticalErrors: 0,
        warningErrors: 0,
        infoErrors: 0
      },
      topErrors: [
        // This would be populated from actual error tracking data
      ],
      affectedUsers: 0,
      resolvedErrors: 0
    };

    res.json(errorSummary);
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
