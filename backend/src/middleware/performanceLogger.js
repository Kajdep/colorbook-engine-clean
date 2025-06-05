const performanceTracker = require('../services/performanceTracker');

// Middleware to log response time, CPU, and memory usage for key endpoints
module.exports = (req, res, next) => {
  const startHrTime = process.hrtime();
  const startCpu = process.cpuUsage();

  res.on('finish', () => {
    const hrDiff = process.hrtime(startHrTime);
    const durationMs = hrDiff[0] * 1000 + hrDiff[1] / 1e6;
    const cpuDiff = process.cpuUsage(startCpu);
    const mem = process.memoryUsage();

    if (['/api/generateStory', '/api/exportPdf'].includes(req.path)) {
      const data = {
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: Math.round(durationMs),
        cpu: { user: cpuDiff.user, system: cpuDiff.system },
        memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
        timestamp: Date.now()
      };
      performanceTracker.record(req.path, data);
      console.log('PERFORMANCE', req.path, data);
    }
  });

  next();
};
