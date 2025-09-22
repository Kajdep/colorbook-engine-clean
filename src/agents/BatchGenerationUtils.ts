import { VisualGenerationAgent, VisualContentType, GenerationPriority, AgentEvent } from './VisualGenerationAgent';
import { Project, StoryData, APISettings } from '../types';

// Batch request configuration
export interface BatchGenerationConfig {
  maxConcurrentRequests?: number;
  priority?: GenerationPriority;
  retryAttempts?: number;
  progressCallback?: (progress: BatchProgress) => void;
  filterExisting?: boolean; // Skip pages that already have images
}

// Batch progress tracking
export interface BatchProgress {
  batchId: string;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  inProgressRequests: number;
  queuedRequests: number;
  progress: number; // 0-100
  startTime: Date;
  estimatedTimeRemaining?: number;
  errors: BatchError[];
}

export interface BatchError {
  requestId: string;
  pageId?: string;
  projectId?: string;
  error: string;
  retryable: boolean;
}

// Request for batch processing
export interface BatchRequest {
  projectId: string;
  pageId: string;
  type: VisualContentType;
  prompt: string;
  metadata?: any;
}

/**
 * Batch Generation Utilities for Visual Generation Agent
 * 
 * Provides high-level utilities for batch processing of visual content generation
 */
export class BatchGenerationUtils {
  private agent: VisualGenerationAgent;
  private batchTracking: Map<string, BatchProgress> = new Map();

  constructor(agent: VisualGenerationAgent) {
    this.agent = agent;
  }

  /**
   * Generate images for all pages in a story that don't have images
   */
  async generateStoryImages(
    story: StoryData,
    config: BatchGenerationConfig = {}
  ): Promise<string> {
    const batchId = this.generateBatchId();
    
    // Create batch requests for pages without images
    const requests: BatchRequest[] = story.pages
      .filter(page => config.filterExisting !== false ? !page.imageData : true)
      .map(page => ({
        projectId: story.id || 'story',
        pageId: `page_${page.pageNumber}`,
        type: 'coloring-page' as VisualContentType,
        prompt: page.imagePrompt,
        metadata: {
          pageNumber: page.pageNumber,
          story: page.story,
          imageStyle: story.metadata.imageStyle,
          aspectRatio: story.metadata.aspectRatio
        }
      }));

    return this.processBatch(batchId, requests, config);
  }

  /**
   * Generate images for all pages in multiple projects
   */
  async generateProjectImages(
    projects: Project[],
    config: BatchGenerationConfig = {}
  ): Promise<string> {
    const batchId = this.generateBatchId();
    
    // Create batch requests for all pages without images
    const requests: BatchRequest[] = [];
    
    for (const project of projects) {
      for (const page of project.pages) {
        if (config.filterExisting !== false && page.content.imageData) {
          continue; // Skip pages that already have images
        }
        
        requests.push({
          projectId: project.id,
          pageId: page.id,
          type: this.getContentTypeFromPageType(page.type),
          prompt: page.content.imagePrompt || page.content.text || 'coloring page',
          metadata: {
            pageType: page.type,
            pageNumber: page.pageNumber,
            imageStyle: project.metadata.imageStyle,
            aspectRatio: project.metadata.aspectRatio
          }
        });
      }
    }

    return this.processBatch(batchId, requests, config);
  }

  /**
   * Generate cover images for multiple projects
   */
  async generateProjectCovers(
    projects: Project[],
    config: BatchGenerationConfig = {}
  ): Promise<string> {
    const batchId = this.generateBatchId();
    
    const requests: BatchRequest[] = projects.map(project => ({
      projectId: project.id,
      pageId: 'cover',
      type: 'cover' as VisualContentType,
      prompt: `Cover for "${project.title}" - ${project.description || 'coloring book'}`,
      metadata: {
        title: project.title,
        description: project.description,
        imageStyle: project.metadata.imageStyle,
        aspectRatio: project.metadata.aspectRatio
      }
    }));

    return this.processBatch(batchId, requests, config);
  }

  /**
   * Generate character reference sheets
   */
  async generateCharacterReferences(
    characters: Array<{
      name: string;
      description: string;
      projectId?: string;
      style?: string;
    }>,
    config: BatchGenerationConfig = {}
  ): Promise<string> {
    const batchId = this.generateBatchId();
    
    const requests: BatchRequest[] = characters.map((character, index) => ({
      projectId: character.projectId || 'characters',
      pageId: `character_${index}`,
      type: 'character-reference' as VisualContentType,
      prompt: `Character reference for ${character.name}: ${character.description}`,
      metadata: {
        characterName: character.name,
        description: character.description,
        imageStyle: character.style
      }
    }));

    return this.processBatch(batchId, requests, config);
  }

  /**
   * Get the progress of a batch operation
   */
  getBatchProgress(batchId: string): BatchProgress | null {
    return this.batchTracking.get(batchId) || null;
  }

  /**
   * Cancel a batch operation
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    const progress = this.batchTracking.get(batchId);
    if (!progress) {
      return false;
    }

    // Cancel all pending requests
    // Note: This would require extending the agent to track requests by batch
    // For now, we'll mark the batch as cancelled
    progress.completedRequests = progress.totalRequests;
    this.batchTracking.set(batchId, progress);
    
    return true;
  }

  /**
   * Get all active batches
   */
  getActiveBatches(): BatchProgress[] {
    return Array.from(this.batchTracking.values())
      .filter(batch => batch.completedRequests + batch.failedRequests < batch.totalRequests);
  }

  /**
   * Clean up completed batch tracking data
   */
  cleanupCompletedBatches(): void {
    for (const [batchId, progress] of this.batchTracking.entries()) {
      if (progress.completedRequests + progress.failedRequests >= progress.totalRequests) {
        this.batchTracking.delete(batchId);
      }
    }
  }

  // Private methods

  private async processBatch(
    batchId: string,
    requests: BatchRequest[],
    config: BatchGenerationConfig
  ): Promise<string> {
    if (requests.length === 0) {
      throw new Error('No requests to process in batch');
    }

    // Initialize batch tracking
    const batchProgress: BatchProgress = {
      batchId,
      totalRequests: requests.length,
      completedRequests: 0,
      failedRequests: 0,
      inProgressRequests: 0,
      queuedRequests: requests.length,
      progress: 0,
      startTime: new Date(),
      errors: []
    };

    this.batchTracking.set(batchId, batchProgress);

    // Set up event listener for tracking progress
    const unsubscribe = this.agent.addEventListener((event: AgentEvent) => {
      this.handleBatchEvent(batchId, event);
    });

    try {
      // Submit all requests to the agent
      const requestIds: string[] = [];
      
      for (const request of requests) {
        const requestId = await this.agent.submitRequest(
          request.type,
          request.prompt,
          {
            priority: config.priority || 'normal',
            projectId: request.projectId,
            pageId: request.pageId,
            maxAttempts: config.retryAttempts,
            ...request.metadata
          }
        );
        requestIds.push(requestId);
      }

      // Wait for completion or timeout
      await this.waitForBatchCompletion(batchId, requestIds);
      
      return batchId;
      
    } finally {
      unsubscribe();
    }
  }

  private async waitForBatchCompletion(batchId: string, requestIds: string[]): Promise<void> {
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const progress = this.batchTracking.get(batchId);
      if (!progress) {
        break;
      }

      // Check if all requests are completed
      if (progress.completedRequests + progress.failedRequests >= progress.totalRequests) {
        break;
      }

      // Update progress based on actual request statuses
      this.updateBatchProgressFromRequests(batchId, requestIds);
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  private updateBatchProgressFromRequests(batchId: string, requestIds: string[]): void {
    const progress = this.batchTracking.get(batchId);
    if (!progress) return;

    let completed = 0;
    let failed = 0;
    let inProgress = 0;
    let queued = 0;

    for (const requestId of requestIds) {
      const request = this.agent.getRequestStatus(requestId);
      if (!request) continue;

      switch (request.status) {
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'in-progress':
          inProgress++;
          break;
        case 'queued':
          queued++;
          break;
      }
    }

    progress.completedRequests = completed;
    progress.failedRequests = failed;
    progress.inProgressRequests = inProgress;
    progress.queuedRequests = queued;
    progress.progress = Math.round((completed + failed) / progress.totalRequests * 100);

    // Update estimated time remaining
    const elapsed = Date.now() - progress.startTime.getTime();
    if (completed > 0) {
      const avgTimePerRequest = elapsed / completed;
      const remaining = progress.totalRequests - completed - failed;
      progress.estimatedTimeRemaining = Math.round(avgTimePerRequest * remaining);
    }

    this.batchTracking.set(batchId, progress);
  }

  private handleBatchEvent(batchId: string, event: AgentEvent): void {
    // This is a simplified event handler
    // In a real implementation, you'd need to track which requests belong to which batch
    const progress = this.batchTracking.get(batchId);
    if (!progress) return;

    if (event.type === 'request-failed' && event.requestId) {
      progress.errors.push({
        requestId: event.requestId,
        error: event.data?.error?.message || 'Unknown error',
        retryable: event.data?.error?.retryable || false
      });
    }

    this.batchTracking.set(batchId, progress);
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getContentTypeFromPageType(pageType: string): VisualContentType {
    switch (pageType) {
      case 'cover':
        return 'cover';
      case 'story':
        return 'illustration';
      case 'coloring':
      default:
        return 'coloring-page';
    }
  }
}

/**
 * Factory function to create batch utilities with the global agent
 */
export function createBatchGenerationUtils(apiSettings: APISettings): BatchGenerationUtils {
  // This would typically get the global agent instance
  // For now, we'll create a new one
  const agent = new VisualGenerationAgent(apiSettings);
  return new BatchGenerationUtils(agent);
}