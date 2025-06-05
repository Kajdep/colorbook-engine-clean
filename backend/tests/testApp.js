const express = require('express');
const authRoutes = require('../src/routes/auth');
const projectRoutes = require('../src/routes/projects');
const paymentsRoutes = require('../src/routes/payments');
const monitoringRoutes = require('../src/routes/monitoring');
const { authenticateToken } = require('../src/middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('*', (req, res) => res.status(404).json({ error: 'Not Found' }));
module.exports = app;
