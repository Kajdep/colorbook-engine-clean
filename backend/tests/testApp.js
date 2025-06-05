const express = require('express');
const authRoutes = require('../src/routes/auth');
const projectRoutes = require('../src/routes/projects');
const userRoutes = require('../src/routes/users');
const storyRoutes = require('../src/routes/stories');
const imageRoutes = require('../src/routes/images');
const drawingRoutes = require('../src/routes/drawings');
// const exportRoutes = require('../src/routes/exports'); // Not explicitly asked for in this task for testApp
// const templateRoutes = require('../src/routes/templates'); // Not explicitly asked for in this task for testApp
// const subscriptionRoutes = require('../src/routes/subscriptions'); // Not explicitly asked for in this task for testApp
const paymentsRoutes = require('../src/routes/payments');
const monitoringRoutes = require('../src/routes/monitoring');
const { authenticateToken } = require('../src/middleware/auth');

const app = express();
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentsRoutes); // Assuming payments routes handle their own auth or are partially public
app.use('/api/monitoring', monitoringRoutes); // Monitoring routes might be public or have specific auth

// Authenticated routes (matching server.js)
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/stories', authenticateToken, storyRoutes);
app.use('/api/images', authenticateToken, imageRoutes);
app.use('/api/drawings', authenticateToken, drawingRoutes);
// app.use('/api/exports', authenticateToken, exportRoutes);
// app.use('/api/templates', templateRoutes); // templates might have mixed auth, ensure consistency
// app.use('/api/subscriptions', authenticateToken, subscriptionRoutes);


// Catch-all for 404
app.use('*', (req, res) => res.status(404).json({ error: 'Not Found in testApp' }));

module.exports = app;
