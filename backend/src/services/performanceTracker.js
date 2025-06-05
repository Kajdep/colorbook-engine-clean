class PerformanceTracker {
  constructor() {
    this.metrics = {};
  }

  record(endpoint, data) {
    if (!this.metrics[endpoint]) {
      this.metrics[endpoint] = [];
    }
    this.metrics[endpoint].push(data);
    if (this.metrics[endpoint].length > 100) {
      this.metrics[endpoint].shift();
    }
  }

  getMetrics() {
    return this.metrics;
  }
}

module.exports = new PerformanceTracker();
