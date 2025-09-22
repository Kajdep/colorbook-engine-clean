# Backend Integration Guide for Visual Generation Agent

## Overview

This guide provides step-by-step instructions for backend teams to integrate with the Visual Generation Workflow Agent. The agent provides RESTful endpoints for managing visual content generation requests.

## Prerequisites

- Node.js backend with Express.js (or similar framework)
- Database for storing generation requests and results
- Message queue system (optional but recommended for production)
- AI service integrations (OpenAI, Stability AI, etc.)

## Core Backend Components

### 1. Database Schema

#### Generation Requests Table
```sql
CREATE TABLE generation_requests (
    id VARCHAR(255) PRIMARY KEY,
    type ENUM('coloring-page', 'cover', 'illustration', 'character-reference', 'background'),
    prompt TEXT NOT NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    status ENUM('queued', 'in-progress', 'completed', 'failed', 'cancelled') DEFAULT 'queued',
    project_id VARCHAR(255),
    page_id VARCHAR(255),
    metadata JSON,
    result JSON,
    error JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3
);

CREATE INDEX idx_generation_requests_status ON generation_requests(status);
CREATE INDEX idx_generation_requests_priority ON generation_requests(priority);
CREATE INDEX idx_generation_requests_project ON generation_requests(project_id);
```

#### Generation Queue Table
```sql
CREATE TABLE generation_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    priority_weight INT DEFAULT 0,
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES generation_requests(id) ON DELETE CASCADE
);

CREATE INDEX idx_generation_queue_priority ON generation_queue(priority_weight DESC, queued_at ASC);
```

### 2. REST API Endpoints

#### POST /api/visual-generation/submit
Submit a new visual generation request.

**Request Body:**
```json
{
  "type": "coloring-page",
  "prompt": "A friendly dragon playing in a garden",
  "priority": "normal",
  "projectId": "proj_123",
  "pageId": "page_456",
  "metadata": {
    "imageStyle": "cartoon",
    "aspectRatio": "square",
    "maxAttempts": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "vga_1234567890_abc123",
  "status": "queued",
  "estimatedWaitTime": 120
}
```

**Implementation:**
```javascript
app.post('/api/visual-generation/submit', async (req, res) => {
  try {
    const { type, prompt, priority = 'normal', projectId, pageId, metadata = {} } = req.body;
    
    // Validate request
    if (!type || !prompt) {
      return res.status(400).json({ error: 'Type and prompt are required' });
    }
    
    // Generate request ID
    const requestId = `vga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate priority weight
    const priorityWeights = { urgent: 1000, high: 100, normal: 10, low: 1 };
    const priorityWeight = priorityWeights[priority] || 10;
    
    // Insert into database
    await db.transaction(async (trx) => {
      await trx('generation_requests').insert({
        id: requestId,
        type,
        prompt,
        priority,
        project_id: projectId,
        page_id: pageId,
        metadata: JSON.stringify(metadata),
        max_attempts: metadata.maxAttempts || 3
      });
      
      await trx('generation_queue').insert({
        request_id: requestId,
        priority_weight: priorityWeight
      });
    });
    
    // Estimate wait time based on queue length
    const queueLength = await getQueueLength();
    const estimatedWaitTime = queueLength * 30; // 30 seconds per request
    
    res.json({
      success: true,
      requestId,
      status: 'queued',
      estimatedWaitTime
    });
    
  } catch (error) {
    console.error('Error submitting generation request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### GET /api/visual-generation/status/:requestId
Get the status of a generation request.

**Response:**
```json
{
  "requestId": "vga_1234567890_abc123",
  "type": "coloring-page",
  "prompt": "A friendly dragon playing in a garden",
  "status": "completed",
  "priority": "normal",
  "progress": 100,
  "metadata": {
    "requestedAt": "2024-01-15T10:30:00Z",
    "startedAt": "2024-01-15T10:32:00Z",
    "completedAt": "2024-01-15T10:35:00Z",
    "attempts": 1,
    "generationTime": 180000
  },
  "result": {
    "imageData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "provider": "openai",
    "generationTime": 180000
  }
}
```

**Implementation:**
```javascript
app.get('/api/visual-generation/status/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await db('generation_requests')
      .where('id', requestId)
      .first();
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Calculate progress based on status
    const progressMap = {
      'queued': 0,
      'in-progress': 50,
      'completed': 100,
      'failed': 0,
      'cancelled': 0
    };
    
    res.json({
      requestId: request.id,
      type: request.type,
      prompt: request.prompt,
      status: request.status,
      priority: request.priority,
      progress: progressMap[request.status],
      metadata: {
        requestedAt: request.created_at,
        startedAt: request.started_at,
        completedAt: request.completed_at,
        attempts: request.attempts,
        maxAttempts: request.max_attempts
      },
      result: request.result ? JSON.parse(request.result) : null,
      error: request.error ? JSON.parse(request.error) : null
    });
    
  } catch (error) {
    console.error('Error getting request status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### DELETE /api/visual-generation/cancel/:requestId
Cancel a generation request.

**Response:**
```json
{
  "success": true,
  "message": "Request cancelled successfully"
}
```

**Implementation:**
```javascript
app.delete('/api/visual-generation/cancel/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const result = await db.transaction(async (trx) => {
      // Update request status
      const updated = await trx('generation_requests')
        .where('id', requestId)
        .whereIn('status', ['queued', 'in-progress'])
        .update({
          status: 'cancelled',
          completed_at: new Date()
        });
      
      // Remove from queue if still queued
      await trx('generation_queue')
        .where('request_id', requestId)
        .del();
      
      return updated;
    });
    
    if (result === 0) {
      return res.status(404).json({ 
        error: 'Request not found or cannot be cancelled' 
      });
    }
    
    res.json({
      success: true,
      message: 'Request cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### GET /api/visual-generation/queue/status
Get current queue status and statistics.

**Response:**
```json
{
  "queueLength": 15,
  "activeRequests": 3,
  "averageWaitTime": 45,
  "queuedByPriority": {
    "urgent": 2,
    "high": 5,
    "normal": 7,
    "low": 1
  },
  "systemStatus": "healthy"
}
```

#### POST /api/visual-generation/batch
Submit multiple generation requests as a batch.

**Request Body:**
```json
{
  "requests": [
    {
      "type": "coloring-page",
      "prompt": "A cat playing",
      "projectId": "proj_123",
      "pageId": "page_1"
    },
    {
      "type": "coloring-page", 
      "prompt": "A dog running",
      "projectId": "proj_123",
      "pageId": "page_2"
    }
  ],
  "batchOptions": {
    "priority": "normal",
    "maxConcurrent": 3
  }
}
```

### 3. Background Processing Worker

#### Queue Processor
```javascript
class GenerationQueueProcessor {
  constructor(config = {}) {
    this.maxConcurrent = config.maxConcurrent || 3;
    this.processingInterval = config.processingInterval || 5000;
    this.retryDelay = config.retryDelay || 10000;
    this.activeJobs = new Map();
    this.isRunning = false;
  }
  
  async start() {
    this.isRunning = true;
    this.processQueue();
  }
  
  async stop() {
    this.isRunning = false;
    // Wait for active jobs to complete
    await Promise.all(this.activeJobs.values());
  }
  
  async processQueue() {
    if (!this.isRunning) return;
    
    try {
      // Get next requests from queue
      const requests = await this.getNextRequests();
      
      for (const request of requests) {
        if (this.activeJobs.size >= this.maxConcurrent) break;
        
        const jobPromise = this.processRequest(request);
        this.activeJobs.set(request.id, jobPromise);
        
        jobPromise.finally(() => {
          this.activeJobs.delete(request.id);
        });
      }
      
    } catch (error) {
      console.error('Queue processing error:', error);
    }
    
    // Schedule next processing cycle
    setTimeout(() => this.processQueue(), this.processingInterval);
  }
  
  async getNextRequests() {
    return await db('generation_requests')
      .join('generation_queue', 'generation_requests.id', 'generation_queue.request_id')
      .where('generation_requests.status', 'queued')
      .orderBy('generation_queue.priority_weight', 'desc')
      .orderBy('generation_queue.queued_at', 'asc')
      .limit(this.maxConcurrent - this.activeJobs.size);
  }
  
  async processRequest(request) {
    try {
      // Update status to in-progress
      await db('generation_requests')
        .where('id', request.id)
        .update({
          status: 'in-progress',
          started_at: new Date(),
          attempts: request.attempts + 1
        });
      
      // Remove from queue
      await db('generation_queue')
        .where('request_id', request.id)
        .del();
      
      // Generate the image
      const result = await this.generateImage(request);
      
      // Update with result
      await db('generation_requests')
        .where('id', request.id)
        .update({
          status: 'completed',
          completed_at: new Date(),
          result: JSON.stringify(result)
        });
      
      // Emit completion event
      this.emitEvent('request-completed', { requestId: request.id, result });
      
    } catch (error) {
      await this.handleRequestError(request, error);
    }
  }
  
  async generateImage(request) {
    // Enhance prompt based on content type
    const enhancedPrompt = this.enhancePrompt(request);
    
    // Call AI service
    const aiService = new AIService(await getApiSettings());
    const imageData = await aiService.generateImage(enhancedPrompt);
    
    return {
      imageData,
      provider: aiService.getLastUsedProvider(),
      generationTime: Date.now() - new Date(request.started_at).getTime()
    };
  }
  
  enhancePrompt(request) {
    let prompt = request.prompt;
    
    switch (request.type) {
      case 'coloring-page':
        prompt += ' coloring book style, black and white line art, clear outlines';
        break;
      case 'cover':
        prompt += ' book cover design, professional, eye-catching';
        break;
      // ... other types
    }
    
    return prompt;
  }
  
  async handleRequestError(request, error) {
    const isRetryable = this.isErrorRetryable(error);
    const canRetry = request.attempts < request.max_attempts && isRetryable;
    
    if (canRetry) {
      // Re-queue for retry with delay
      setTimeout(async () => {
        await db('generation_queue').insert({
          request_id: request.id,
          priority_weight: 1, // Lower priority for retries
          queued_at: new Date()
        });
        
        await db('generation_requests')
          .where('id', request.id)
          .update({ status: 'queued' });
      }, this.retryDelay);
      
    } else {
      // Mark as failed
      await db('generation_requests')
        .where('id', request.id)
        .update({
          status: 'failed',
          completed_at: new Date(),
          error: JSON.stringify({
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            retryable: isRetryable
          })
        });
      
      // Emit failure event
      this.emitEvent('request-failed', { 
        requestId: request.id, 
        error: error.message 
      });
    }
  }
  
  isErrorRetryable(error) {
    const retryableErrors = [
      'rate limit',
      'timeout',
      'network',
      'temporary',
      'service unavailable'
    ];
    
    return retryableErrors.some(retryable => 
      error.message.toLowerCase().includes(retryable)
    );
  }
  
  emitEvent(type, data) {
    // Emit to WebSocket clients, event bus, etc.
    // Implementation depends on your event system
  }
}

// Start the processor
const processor = new GenerationQueueProcessor({
  maxConcurrent: 5,
  processingInterval: 3000
});

processor.start();
```

### 4. WebSocket Support for Real-time Updates

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Client subscription management
const subscriptions = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe' && data.requestId) {
        subscriptions.set(data.requestId, ws);
      } else if (data.type === 'unsubscribe' && data.requestId) {
        subscriptions.delete(data.requestId);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    // Clean up subscriptions
    for (const [requestId, client] of subscriptions.entries()) {
      if (client === ws) {
        subscriptions.delete(requestId);
      }
    }
  });
});

// Function to broadcast updates
function broadcastUpdate(requestId, update) {
  const client = subscriptions.get(requestId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'update',
      requestId,
      data: update
    }));
  }
}
```

### 5. Monitoring and Analytics

#### Metrics Collection
```javascript
class GenerationMetrics {
  constructor() {
    this.metrics = {
      requestsTotal: 0,
      requestsCompleted: 0,
      requestsFailed: 0,
      averageGenerationTime: 0,
      queueLength: 0,
      activeRequests: 0
    };
  }
  
  async updateMetrics() {
    const stats = await db('generation_requests')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(CASE WHEN status = "completed" THEN 1 END) as completed'),
        db.raw('COUNT(CASE WHEN status = "failed" THEN 1 END) as failed'),
        db.raw('COUNT(CASE WHEN status = "in-progress" THEN 1 END) as active'),
        db.raw('AVG(CASE WHEN completed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, started_at, completed_at) END) as avg_time')
      )
      .where('created_at', '>=', db.raw('DATE_SUB(NOW(), INTERVAL 24 HOUR)'))
      .first();
    
    const queueLength = await db('generation_queue').count('* as count').first();
    
    this.metrics = {
      requestsTotal: stats.total,
      requestsCompleted: stats.completed,
      requestsFailed: stats.failed,
      averageGenerationTime: stats.avg_time || 0,
      queueLength: queueLength.count,
      activeRequests: stats.active
    };
    
    return this.metrics;
  }
  
  getHealthStatus() {
    const failureRate = this.metrics.requestsTotal > 0 
      ? this.metrics.requestsFailed / this.metrics.requestsTotal 
      : 0;
    
    if (failureRate > 0.5) return 'critical';
    if (failureRate > 0.2) return 'warning';
    if (this.metrics.queueLength > 100) return 'warning';
    return 'healthy';
  }
}
```

## Deployment Considerations

### Environment Variables
```bash
# API Configuration
OPENAI_API_KEY=your_openai_key
STABILITY_API_KEY=your_stability_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id

# Database
DATABASE_URL=mysql://user:pass@host:port/database

# Queue Processing
MAX_CONCURRENT_REQUESTS=5
QUEUE_PROCESSING_INTERVAL=3000
RETRY_DELAY_MS=10000

# Monitoring
ENABLE_METRICS=true
METRICS_COLLECTION_INTERVAL=60000
```

### Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000 8080

CMD ["npm", "start"]
```

### Load Balancing
- Use multiple worker instances for queue processing
- Implement sticky sessions for WebSocket connections
- Consider using Redis for shared queue state

### Scaling Strategy
1. **Horizontal Scaling**: Multiple worker instances
2. **Queue Partitioning**: Separate queues by priority or content type
3. **Caching**: Cache frequently requested images
4. **CDN Integration**: Store results in CDN for faster delivery

## Security Considerations

### Authentication
```javascript
// JWT middleware for API protection
app.use('/api/visual-generation', authenticateJWT);

function authenticateJWT(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
}
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const createLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/visual-generation/submit', createLimit);
```

### Input Validation
```javascript
const { body, param, validationResult } = require('express-validator');

const validateSubmission = [
  body('type').isIn(['coloring-page', 'cover', 'illustration', 'character-reference', 'background']),
  body('prompt').isLength({ min: 10, max: 1000 }).trim(),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

app.post('/api/visual-generation/submit', validateSubmission, submitHandler);
```

## Testing

### Integration Tests
```javascript
const request = require('supertest');
const app = require('./app');

describe('Visual Generation API', () => {
  test('should submit generation request', async () => {
    const response = await request(app)
      .post('/api/visual-generation/submit')
      .send({
        type: 'coloring-page',
        prompt: 'A test prompt',
        priority: 'normal'
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.requestId).toMatch(/^vga_/);
  });
  
  test('should get request status', async () => {
    // Create a request first
    const submitResponse = await request(app)
      .post('/api/visual-generation/submit')
      .send({
        type: 'coloring-page',
        prompt: 'A test prompt'
      });
    
    const requestId = submitResponse.body.requestId;
    
    const statusResponse = await request(app)
      .get(`/api/visual-generation/status/${requestId}`)
      .expect(200);
    
    expect(statusResponse.body.requestId).toBe(requestId);
    expect(statusResponse.body.status).toBe('queued');
  });
});
```

## Troubleshooting

### Common Issues

1. **High queue buildup**
   - Increase worker instances
   - Check AI service rate limits
   - Review failed request patterns

2. **Slow processing**
   - Monitor AI service response times
   - Check database query performance
   - Review network connectivity

3. **Memory leaks**
   - Monitor active job cleanup
   - Check WebSocket connection management
   - Review image data storage

### Monitoring Queries
```sql
-- Queue backlog
SELECT 
  priority,
  COUNT(*) as count,
  MIN(queued_at) as oldest_request
FROM generation_queue gq
JOIN generation_requests gr ON gq.request_id = gr.id
GROUP BY priority;

-- Processing performance
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_processing_time,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM generation_requests
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at);
```

This integration guide provides a comprehensive foundation for backend teams to implement the Visual Generation Workflow Agent system. Adjust the implementation details based on your specific technology stack and requirements.