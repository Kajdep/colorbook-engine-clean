# Visual Generation Workflow Agent Documentation

## Overview

The Visual Generation Workflow Agent is a comprehensive system designed to manage the end-to-end visual content generation workflow within the ColorBook Engine platform. It provides intelligent queuing, progress monitoring, error handling, and extensible support for different types of visual content.

## Architecture

### Core Components

1. **VisualGenerationAgent** - Main orchestrator class
2. **BatchGenerationUtils** - Batch processing utilities
3. **useVisualGeneration** - React hook for frontend integration
4. **Enhanced BatchManager** - Integration with existing batch processing

### Key Features

- ✅ **Request Queuing and Prioritization** - Intelligent queue management with priority-based processing
- ✅ **Progress Monitoring** - Real-time status updates and progress tracking
- ✅ **Error Handling and Retry Logic** - Automatic retry with exponential backoff
- ✅ **Extensible Content Types** - Support for coloring pages, covers, illustrations, etc.
- ✅ **Batch Processing** - Efficient handling of multiple generation requests
- ✅ **Event-Driven Architecture** - Real-time notifications and status updates
- ✅ **Frontend Integration** - Seamless React hook integration

## API Reference

### VisualGenerationAgent

#### Constructor
```typescript
constructor(apiSettings: APISettings, config?: Partial<AgentConfig>)
```

#### Core Methods

##### submitRequest
```typescript
async submitRequest(
  type: VisualContentType,
  prompt: string,
  options?: {
    priority?: GenerationPriority;
    projectId?: string;
    pageId?: string;
    imageStyle?: string;
    aspectRatio?: string;
    provider?: ImageService;
    maxAttempts?: number;
  }
): Promise<string>
```

##### getRequestStatus
```typescript
getRequestStatus(requestId: string): VisualGenerationRequest | null
```

##### cancelRequest
```typescript
async cancelRequest(requestId: string): Promise<boolean>
```

##### addEventListener
```typescript
addEventListener(listener: AgentEventListener): () => void
```

### Content Types

```typescript
type VisualContentType = 
  | 'coloring-page'    // Standard coloring book pages
  | 'cover'            // Book covers
  | 'illustration'     // General illustrations
  | 'character-reference' // Character reference sheets
  | 'background'       // Background scenes
```

### Priority Levels

```typescript
type GenerationPriority = 'low' | 'normal' | 'high' | 'urgent'
```

### Request Status

```typescript
type GenerationStatus = 'queued' | 'in-progress' | 'completed' | 'failed' | 'cancelled'
```

## Integration Guide

### Frontend Integration (React)

#### Basic Usage with Hook

```typescript
import { useVisualGeneration } from '../hooks/useVisualGeneration';

function MyComponent() {
  const visualGeneration = useVisualGeneration();

  const handleGenerateImage = async () => {
    try {
      const requestId = await visualGeneration.generateImage(
        'coloring-page',
        'A friendly dragon playing in a garden',
        {
          priority: 'normal',
          imageStyle: 'cartoon',
          aspectRatio: 'square'
        }
      );

      // Set up progress tracking
      const unsubscribeProgress = visualGeneration.onProgress(requestId, (progress, message) => {
        console.log(`Progress: ${progress}% - ${message}`);
      });

      // Set up completion handler
      const unsubscribeCompleted = visualGeneration.onCompleted(requestId, (result) => {
        console.log('Image generated:', result.imageData);
        // Cleanup
        unsubscribeProgress();
        unsubscribeCompleted();
      });

    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleGenerateImage}>Generate Image</button>
      
      {/* Queue Status Display */}
      {visualGeneration.state.queueLength > 0 && (
        <div>
          Queue: {visualGeneration.state.queueLength} pending, 
          {visualGeneration.state.activeRequests} active
        </div>
      )}
    </div>
  );
}
```

#### Advanced Usage with Batch Processing

```typescript
import { BatchGenerationUtils, getVisualGenerationAgent } from '../agents';

function BatchProcessor() {
  const handleBatchGeneration = async (projects: Project[]) => {
    const agent = getVisualGenerationAgent(apiSettings);
    const batchUtils = new BatchGenerationUtils(agent);

    try {
      const batchId = await batchUtils.generateProjectImages(projects, {
        filterExisting: true,
        priority: 'high',
        progressCallback: (progress) => {
          console.log(`Batch progress: ${progress.progress}%`);
        }
      });

      // Monitor batch progress
      const checkProgress = setInterval(() => {
        const progress = batchUtils.getBatchProgress(batchId);
        if (progress && progress.completedRequests + progress.failedRequests >= progress.totalRequests) {
          clearInterval(checkProgress);
          console.log('Batch completed!');
        }
      }, 1000);

    } catch (error) {
      console.error('Batch processing failed:', error);
    }
  };

  return (
    <button onClick={() => handleBatchGeneration(projects)}>
      Generate All Project Images
    </button>
  );
}
```

### Backend Integration

#### Enhanced Batch Manager

The existing `BatchManager` has been enhanced to use the Visual Generation Agent:

```typescript
import { batchManager } from '../batch/batchManager';

// The batch manager now automatically uses the agent for better workflow management
const progress = await batchManager.generateMissingImages(projects, apiSettings);
```

#### Custom Agent Configuration

```typescript
import { VisualGenerationAgent } from '../agents';

const agent = new VisualGenerationAgent(apiSettings, {
  maxConcurrentRequests: 5,        // Process up to 5 requests simultaneously
  defaultRetryAttempts: 3,         // Retry failed requests up to 3 times
  retryDelayMs: 5000,             // Wait 5 seconds between retries
  queueProcessingIntervalMs: 1000, // Check queue every second
  enableAutoRetry: true,          // Automatically retry failed requests
  priorityProcessing: true        // Process higher priority requests first
});
```

## Event System

### Event Types

```typescript
type AgentEventType = 
  | 'request-queued'     // Request added to queue
  | 'request-started'    // Request processing started
  | 'request-progress'   // Progress update during processing
  | 'request-completed'  // Request completed successfully
  | 'request-failed'     // Request failed (may retry)
  | 'request-cancelled'  // Request was cancelled
  | 'queue-empty'        // Queue is empty
  | 'agent-error'        // Agent encountered an error
```

### Event Handling

```typescript
const unsubscribe = agent.addEventListener((event: AgentEvent) => {
  switch (event.type) {
    case 'request-completed':
      console.log('Request completed:', event.requestId);
      // Handle completion
      break;
    case 'request-failed':
      console.log('Request failed:', event.data.error);
      // Handle failure
      break;
    case 'request-progress':
      console.log('Progress:', event.data.progress, event.data.message);
      // Update UI
      break;
  }
});

// Don't forget to unsubscribe when done
unsubscribe();
```

## Error Handling

### Automatic Retry Logic

The agent automatically retries failed requests based on:

- **Error Type**: Network errors, rate limits, and temporary failures are retryable
- **Retry Attempts**: Configurable maximum retry attempts per request
- **Retry Delay**: Exponential backoff with configurable base delay
- **Error Tracking**: Integration with the error tracking system

### Error Categories

```typescript
// Retryable errors (will be automatically retried)
const retryableErrors = [
  'rate limit',
  'timeout',
  'network',
  'temporary',
  'service unavailable',
  'internal server error'
];

// Non-retryable errors (will not be retried)
const nonRetryableErrors = [
  'invalid api key',
  'insufficient credits',
  'content policy violation'
];
```

## Configuration

### Agent Configuration

```typescript
interface AgentConfig {
  maxConcurrentRequests: number;    // Default: 3
  defaultRetryAttempts: number;     // Default: 3
  retryDelayMs: number;            // Default: 5000
  queueProcessingIntervalMs: number; // Default: 1000
  enableAutoRetry: boolean;        // Default: true
  priorityProcessing: boolean;     // Default: true
}
```

### Batch Configuration

```typescript
interface BatchGenerationConfig {
  maxConcurrentRequests?: number;   // Override agent's concurrent limit
  priority?: GenerationPriority;   // Priority for all requests in batch
  retryAttempts?: number;          // Override retry attempts
  progressCallback?: (progress: BatchProgress) => void;
  filterExisting?: boolean;        // Skip items that already have images
}
```

## Performance Considerations

### Queue Management

- **Priority Processing**: Higher priority requests are processed first
- **Concurrent Limits**: Configurable limit on simultaneous requests to prevent API overload
- **Rate Limiting**: Built-in delays between requests to respect API limits

### Memory Management

- **Request Cleanup**: Completed requests are automatically cleaned up
- **Event Listener Management**: Proper cleanup prevents memory leaks
- **Batch Tracking**: Automatic cleanup of completed batch data

### Monitoring

- **Queue Status**: Real-time monitoring of queue length and active requests
- **Progress Tracking**: Detailed progress information for long-running operations
- **Error Analytics**: Integration with error tracking for monitoring failure rates

## Examples

### Example 1: Story Image Generation

```typescript
// Generate images for all pages in a story
const storyData: StoryData = { /* story data */ };

const batchId = await batchUtils.generateStoryImages(storyData, {
  filterExisting: true,
  priority: 'normal',
  progressCallback: (progress) => {
    updateUI(`Progress: ${progress.progress}%`);
  }
});
```

### Example 2: Cover Generation

```typescript
// Generate covers for multiple projects
const projects: Project[] = [/* projects */];

const batchId = await batchUtils.generateProjectCovers(projects, {
  priority: 'high'
});
```

### Example 3: Character References

```typescript
// Generate character reference sheets
const characters = [
  { name: 'Dragon', description: 'Friendly green dragon' },
  { name: 'Princess', description: 'Brave princess with sword' }
];

const batchId = await batchUtils.generateCharacterReferences(characters, {
  priority: 'normal'
});
```

## Troubleshooting

### Common Issues

1. **Agent Not Initialized**
   - Ensure API settings are configured before using the agent
   - Check that `apiSettings.apiKey` is set

2. **Requests Stuck in Queue**
   - Check if the processing interval is running
   - Verify API credentials are valid
   - Check for error messages in the console

3. **High Failure Rate**
   - Review error logs to identify common failure causes
   - Consider adjusting retry settings
   - Check API quota and rate limits

### Debugging

```typescript
// Enable detailed logging
const agent = new VisualGenerationAgent(apiSettings, {
  // ... config
});

// Monitor all events for debugging
agent.addEventListener((event) => {
  console.log('Agent Event:', event);
});

// Check queue status periodically
setInterval(() => {
  console.log('Queue Status:', agent.getQueueStatus());
}, 5000);
```

## Migration from Legacy System

### Before (Legacy)

```typescript
// Old approach - direct AI service usage
const aiService = new AIService(apiSettings);
const imageData = await aiService.generateImage(prompt);
```

### After (Agent-based)

```typescript
// New approach - agent-based workflow
const requestId = await visualGeneration.generateImage('coloring-page', prompt);

visualGeneration.onCompleted(requestId, (result) => {
  // Handle completion
  const imageData = result.imageData;
});
```

### Benefits of Migration

- **Better Error Handling**: Automatic retries and graceful failure handling
- **Progress Tracking**: Real-time progress updates for better UX
- **Queue Management**: Intelligent prioritization and concurrent processing
- **Extensibility**: Easy to add new content types and features
- **Monitoring**: Built-in analytics and error tracking

## Future Enhancements

### Planned Features

1. **Advanced Scheduling** - Schedule generation for specific times
2. **A/B Testing** - Generate multiple variants for comparison
3. **Quality Assessment** - Automatic quality scoring of generated images
4. **Cache Management** - Intelligent caching of frequently requested images
5. **Analytics Dashboard** - Detailed metrics and performance analytics

### Extensibility Points

The agent is designed to be easily extended:

- **New Content Types**: Add new `VisualContentType` values
- **Custom Providers**: Integrate additional AI services
- **Event Plugins**: Add custom event handlers
- **Queue Strategies**: Implement custom queue management algorithms

## Support and Maintenance

### Monitoring

- Monitor queue lengths and processing times
- Track error rates and failure patterns
- Set up alerts for system health

### Maintenance

- Regular cleanup of completed batch data
- Periodic review of retry settings
- Update agent configuration based on usage patterns

### Version Updates

The agent follows semantic versioning:
- **Patch**: Bug fixes and minor improvements
- **Minor**: New features and enhancements
- **Major**: Breaking changes requiring migration

---

This documentation provides comprehensive coverage of the Visual Generation Workflow Agent system. For additional support or feature requests, please refer to the project's issue tracker.