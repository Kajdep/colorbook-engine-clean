const Sentry = require('@sentry/node');
const axios = require('axios');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0
});

// Fetch summarized error data from Sentry
async function getErrorSummary(timeframe = '24h') {
  if (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT) {
    return null;
  }

  const url = `https://sentry.io/api/0/projects/${process.env.SENTRY_ORG}/${process.env.SENTRY_PROJECT}/issues/`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` },
    params: { statsPeriod: timeframe, limit: 25 }
  });

  const issues = response.data || [];

  const summary = {
    totalErrors: 0,
    criticalErrors: 0,
    warningErrors: 0,
    infoErrors: 0,
    topErrors: [],
    affectedUsers: 0,
    resolvedErrors: 0
  };

  for (const issue of issues) {
    const count = parseInt(issue.count || 0, 10);
    summary.totalErrors += count;
    if (issue.level === 'fatal' || issue.level === 'error') {
      summary.criticalErrors += count;
    } else if (issue.level === 'warning') {
      summary.warningErrors += count;
    } else {
      summary.infoErrors += count;
    }
    if (issue.status === 'resolved') {
      summary.resolvedErrors += count;
    }
    summary.affectedUsers += issue.userCount || 0;
  }

  summary.topErrors = issues
    .sort((a, b) => parseInt(b.count, 10) - parseInt(a.count, 10))
    .slice(0, 5)
    .map(issue => ({
      id: issue.id,
      title: issue.title,
      count: parseInt(issue.count, 10),
      level: issue.level
    }));

  return summary;
}

module.exports = {
  Sentry,
  getErrorSummary
};
