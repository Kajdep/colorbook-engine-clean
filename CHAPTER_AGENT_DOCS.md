# Chapter Generation Agent - Documentation

## Overview

The Chapter Generation Agent is an AI-powered system that automates the chapter generation workflow for the ColorBook Engine. It provides a sophisticated workflow management system with status monitoring, error reporting, and support for advanced AI features.

## Architecture

### Core Components

1. **ChapterGenerationAgent** (`src/utils/chapterGenerationAgent.ts`)
   - Main agent class handling workflow automation
   - Job queue management and concurrency control
   - Progress tracking and error handling

2. **ChapterAgentService** (`src/utils/chapterAgentService.ts`)
   - Frontend service layer for agent integration
   - Supports both local agent and backend API modes
   - Real-time progress monitoring

3. **useChapterAgent Hook** (`src/hooks/useChapterAgent.ts`)
   - React hook for easy agent integration
   - State management and lifecycle handling
   - Progress callbacks and job management

4. **Backend API Routes** (`backend/src/routes/chapterAgent.js`)
   - REST API endpoints for agent operations
   - Job scheduling and status monitoring
   - Batch processing support

## Features

### 🤖 Advanced AI Workflow
- **Single Chapter Generation**: Generate one chapter with full workflow
- **Batch Chapter Generation**: Generate multiple chapters simultaneously
- **Iterative Refinement**: Progressive improvement of generated content
- **Character Consistency**: Maintain character traits across pages
- **Style Consistency**: Ensure visual style coherence

### 📊 Status Monitoring
- Real-time progress tracking
- Step-by-step workflow visibility
- Error reporting and recovery
- Estimated completion times

### 🔧 Configuration Options
- **Advanced AI Service**: Use enhanced AI capabilities
- **Character Consistency**: Enable character reference tracking
- **Style Consistency**: Apply style consistency algorithms
- **Auto Image Generation**: Generate images during workflow

### 🚀 Performance Features
- Concurrent job processing (configurable limit)
- Job queue management
- Automatic cleanup of completed jobs
- Error recovery and retry mechanisms

## Usage

### Frontend Integration

#### Basic Usage with React Hook

```typescript
import { useChapterAgent } from '../hooks/useChapterAgent';

const MyComponent = () => {
  const chapterAgent = useChapterAgent({
    config: {
      apiSettings: yourApiSettings,
      useBackendAPI: false,
      enableRealTimeUpdates: true
    }
  });

  const handleGenerate = async () => {
    try {
      const story = await chapterAgent.generateChapter(params, {
        useAdvancedAI: true,
        enableCharacterConsistency: true,
        generateImages: true
      });
      console.log('Generated story:', story);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  return (
    <div>
      {chapterAgent.isGenerating && (
        <div>
          Progress: {chapterAgent.currentJob?.status.progress.percentage}%
        </div>
      )}
      <button onClick={handleGenerate}>Generate Chapter</button>
    </div>
  );
};
```

#### Batch Generation

```typescript
const handleBatchGenerate = async () => {
  const baseParams = { theme: 'Adventure', characters: 'Hero, Dragon' };
  const variations = [
    { moral: 'Courage' },
    { moral: 'Friendship' },
    { moral: 'Perseverance' }
  ];

  const stories = await chapterAgent.generateBatchChapters(
    baseParams, 
    variations
  );
};
```

### Backend API Usage

#### Start Chapter Generation

```http
POST /api/agent/chapter/generate
Content-Type: application/json

{
  "projectId": "project-123",
  "params": {
    "theme": "Magical forest adventure",
    "characters": "Brave rabbit, wise owl",
    "numPages": 5,
    "wordsPerPage": 50,
    "imageStyle": "cute"
  },
  "workflowType": "single",
  "options": {
    "useAdvancedAI": true,
    "enableCharacterConsistency": true,
    "generateImages": true
  }
}
```

#### Check Job Status

```http
GET /api/agent/chapter/status/{jobId}
```

Response:
```json
{
  "id": "job_1234567890",
  "status": "in-progress",
  "progress": {
    "currentStep": "Generating story content",
    "completedSteps": 2,
    "totalSteps": 5,
    "percentage": 40
  },
  "startedAt": "2023-12-07T10:00:00Z",
  "estimatedTimeRemaining": 30000
}
```

#### Batch Generation

```http
POST /api/agent/chapter/batch
Content-Type: application/json

{
  "projectId": "project-123",
  "baseParams": {
    "theme": "Adventure",
    "characters": "Hero, Companion"
  },
  "variations": [
    { "moral": "Courage" },
    { "moral": "Friendship" }
  ]
}
```

## Configuration

### Agent Configuration

```typescript
interface AgentConfiguration {
  maxConcurrentJobs: number;        // Default: 3
  defaultTimeout: number;           // Default: 300000 (5 min)
  retryAttempts: number;           // Default: 2
  enableProgressCallbacks: boolean; // Default: true
  enableErrorRecovery: boolean;    // Default: true
}
```

### Service Configuration

```typescript
interface ChapterAgentServiceConfig {
  useBackendAPI?: boolean;         // Use backend API vs local agent
  apiSettings: APISettings;        // AI service settings
  enableRealTimeUpdates?: boolean; // Enable progress polling
  pollingInterval?: number;        // Polling interval in ms
}
```

## Workflow Types

### Single Chapter Generation
1. **Initialize**: Validate parameters and setup
2. **Generate Content**: Create story text and image prompts
3. **Apply Consistency**: Character and style consistency (if enabled)
4. **Generate Images**: Create images for each page (if enabled)
5. **Finalize**: Validate and package result

### Batch Chapter Generation
1. **Setup Batch**: Create individual jobs for each variation
2. **Process Concurrently**: Generate multiple chapters in parallel
3. **Monitor Progress**: Track completion across all jobs
4. **Aggregate Results**: Combine all completed chapters

### Iterative Refinement
1. **Initial Draft**: Generate base content
2. **Analyze Content**: Use AI to identify improvements
3. **Apply Suggestions**: Implement high-confidence improvements
4. **Generate Images**: Create final images
5. **Validate**: Ensure quality and consistency

## Error Handling

The agent provides robust error handling:

- **Validation Errors**: Parameter validation before processing
- **AI Service Errors**: Graceful handling of API failures
- **Timeout Management**: Automatic timeout and retry logic
- **Resource Cleanup**: Proper cleanup on failures
- **Error Recovery**: Attempt recovery for transient failures

## Performance Optimization

### Concurrency Control
- Configurable maximum concurrent jobs
- Queue management for overflow
- Resource-aware scheduling

### Memory Management
- Automatic cleanup of completed jobs
- Configurable retention periods
- Memory usage monitoring

### Progress Optimization
- Efficient progress tracking
- Minimal overhead polling
- Optimized status updates

## Integration Points

### UI Components
- **StoryGenerator**: Main component with agent toggle
- **Progress Display**: Real-time workflow progress
- **Status Monitoring**: Job status and error display

### Store Integration
- Uses existing `useAppStore` for state management
- Integrates with notification system
- Maintains compatibility with existing project structure

### Backend Integration
- REST API endpoints for remote processing
- Database storage for job persistence
- Scalable architecture for multiple users

## Future Enhancements

### Planned Features
- **Scheduled Generation**: Time-based chapter generation
- **Template Library**: Pre-configured workflow templates
- **Analytics Dashboard**: Performance and usage metrics
- **Multi-language Support**: Internationalization features

### API Extensions
- **Webhook Support**: Real-time status notifications
- **Bulk Operations**: Enhanced batch processing
- **Export Integration**: Direct export pipeline
- **Version Control**: Chapter revision management

## Troubleshooting

### Common Issues

1. **Agent Not Starting**
   - Check API key configuration
   - Verify network connectivity
   - Review console for errors

2. **Generation Failures**
   - Validate input parameters
   - Check AI service status
   - Review error messages

3. **Progress Not Updating**
   - Verify polling is enabled
   - Check network connectivity
   - Confirm job is still active

4. **Performance Issues**
   - Reduce concurrent job limit
   - Increase timeout values
   - Monitor system resources

### Debug Mode

Enable debug logging:
```typescript
const chapterAgent = useChapterAgent({
  config: {
    apiSettings,
    debugMode: true // Enable detailed logging
  }
});
```

## Support

For technical support or feature requests, please refer to the project repository or contact the development team.