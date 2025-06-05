require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('rate-limiter-flexible');
const performanceLogger = require('./middleware/performanceLogger');
const path = require('path'); // Ensure path is imported

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const storyRoutes = require('./routes/stories');
const imageRoutes = require('./routes/images');
const drawingRoutes = require('./routes/drawings');
const exportRoutes = require('./routes/exports');
const templateRoutes = require('./routes/templates');
const subscriptionRoutes = require('./routes/subscriptions');
const paymentRoutes = require('./routes/payments');
const monitoringRoutes = require('./routes/monitoring');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { validateRequest } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const rateLimiter = new rateLimit.RateLimiterMemory({
  keyStore: new Map(),
  points: parseInt(process.env.RATE_LIMIT_POINTS || '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_DURATION || '60', 10),
});

const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }
};

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(performanceLogger);

// Apply rate limiting
app.use(rateLimitMiddleware);

// Health check endpoint (enhanced)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/projects', authenticateToken, projectRoutes);
app.use('/api/stories', authenticateToken, storyRoutes);
app.use('/api/images', authenticateToken, imageRoutes);
app.use('/api/drawings', authenticateToken, drawingRoutes);
app.use('/api/exports', authenticateToken, exportRoutes);
app.use('/api/templates', templateRoutes); // Some template routes are public
app.use('/api/subscriptions', authenticateToken, subscriptionRoutes);
app.use('/api/payments', paymentRoutes); // Payment routes handle their own auth
app.use('/api/monitoring', monitoringRoutes); // Monitoring routes

// Static file serving for uploads
// Corrected path to be absolute, resolving from server.js location
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ColorBook Engine API running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

module.exports = app;