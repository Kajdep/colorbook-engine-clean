import { APISettings, ImageService } from '../types';
import { AIService } from '../utils/aiService';
import { errorTracker } from '../utils/errorTracking';
import { persistentStorage } from '../utils/persistentStorage';

// Visual content types that can be generated
export type VisualContentType = 'coloring-page' | 'cover' | 'illustration' | 'character-reference' | 'background';

// Priority levels for generation requests
export type GenerationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Status of generation requests
export type GenerationStatus = 'queued' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

// Generation request interface
export interface VisualGenerationRequest {
  id: string;
  type: VisualContentType;
  prompt: string;
  priority: GenerationPriority;
  status: GenerationStatus;
  projectId?: string;
  pageId?: string;
  metadata: {
    requestedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    attempts: number;
    maxAttempts: number;
    imageStyle?: string;
    aspectRatio?: string;
    provider?: ImageService;
  };
  result?: {
    imageData: string;
    imageUrl?: string;
    provider: ImageService;
    generationTime: number;
  };
  error?: {
    message: string;
    code: string;
    retryable: boolean;
  };
}

// Progress tracking interface
export interface GenerationProgress {
  requestId: string;
  status: GenerationStatus;
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number;
}

// Event types for the agent
export type AgentEventType = 
  | 'request-queued'
  | 'request-started'
  | 'request-progress'
  | 'request-completed'
  | 'request-failed'
  | 'request-cancelled'
  | 'queue-empty'
  | 'agent-error';

export interface AgentEvent {
  type: AgentEventType;
  requestId?: string;
  data?: any;
  timestamp: Date;
}

// Event listener type
export type AgentEventListener = (event: AgentEvent) => void;

// Configuration for the agent
export interface AgentConfig {
  maxConcurrentRequests: number;
  defaultRetryAttempts: number;
  retryDelayMs: number;
  queueProcessingIntervalMs: number;
  enableAutoRetry: boolean;
  priorityProcessing: boolean;
}

/**
 * Visual Generation Workflow Agent
 * 
 * Manages the end-to-end visual content generation workflow including:
 * - Request queuing and prioritization
 * - Progress monitoring and status updates
 * - Error handling and retry logic
 * - Result delivery and storage
 * - Extensible content type support
 */
export class VisualGenerationAgent {
  private apiSettings: APISettings;
  private config: AgentConfig;
  private queue: VisualGenerationRequest[] = [];
  private activeRequests: Map<string, VisualGenerationRequest> = new Map();
  private eventListeners: Set<AgentEventListener> = new Set();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private aiService: AIService;

  constructor(apiSettings: APISettings, config: Partial<AgentConfig> = {}) {
    this.apiSettings = apiSettings;
    this.config = {
      maxConcurrentRequests: 3,
      defaultRetryAttempts: 3,
      retryDelayMs: 5000,
      queueProcessingIntervalMs: 1000,
      enableAutoRetry: true,
      priorityProcessing: true,
      ...config
    };
    this.aiService = new AIService(apiSettings);
    this.startProcessing();
  }

  /**
   * Submit a visual generation request
   */
  async submitRequest(
    type: VisualContentType,
    prompt: string,
    options: {
      priority?: GenerationPriority;
      projectId?: string;
      pageId?: string;
      imageStyle?: string;
      aspectRatio?: string;
      provider?: ImageService;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const requestId = this.generateRequestId();
    
    const request: VisualGenerationRequest = {
      id: requestId,
      type,
      prompt,
      priority: options.priority || 'normal',
      status: 'queued',
      projectId: options.projectId,
      pageId: options.pageId,
      metadata: {
        requestedAt: new Date(),
        attempts: 0,
        maxAttempts: options.maxAttempts || this.config.defaultRetryAttempts,
        imageStyle: options.imageStyle,
        aspectRatio: options.aspectRatio,
        provider: options.provider
      }
    };

    // Add to queue with priority ordering
    this.addToQueue(request);
    
    // Emit event
    this.emitEvent({
      type: 'request-queued',
      requestId,
      data: { request },
      timestamp: new Date()
    });

    return requestId;
  }

  /**
   * Get the status of a generation request
   */
  getRequestStatus(requestId: string): VisualGenerationRequest | null {
    // Check active requests first
    const activeRequest = this.activeRequests.get(requestId);
    if (activeRequest) {
      return activeRequest;
    }

    // Check queue
    return this.queue.find(req => req.id === requestId) || null;
  }

  /**
   * Cancel a generation request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    // Remove from queue if present
    const queueIndex = this.queue.findIndex(req => req.id === requestId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      this.emitEvent({
        type: 'request-cancelled',
        requestId,
        timestamp: new Date()
      });
      return true;
    }

    // Cancel active request if present
    const activeRequest = this.activeRequests.get(requestId);
    if (activeRequest) {
      activeRequest.status = 'cancelled';
      this.activeRequests.delete(requestId);
      this.emitEvent({
        type: 'request-cancelled',
        requestId,
        timestamp: new Date()
      });
      return true;
    }

    return false;
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      queuedByPriority: {
        urgent: this.queue.filter(r => r.priority === 'urgent').length,
        high: this.queue.filter(r => r.priority === 'high').length,
        normal: this.queue.filter(r => r.priority === 'normal').length,
        low: this.queue.filter(r => r.priority === 'low').length,
      }
    };
  }

  /**
   * Subscribe to agent events
   */
  addEventListener(listener: AgentEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Update API settings
   */
  updateApiSettings(newSettings: APISettings) {
    this.apiSettings = newSettings;
    this.aiService = new AIService(newSettings);
  }

  /**
   * Gracefully shutdown the agent
   */
  async shutdown() {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active requests to complete or timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Cancel any remaining active requests
    for (const [requestId, request] of this.activeRequests) {
      request.status = 'cancelled';
      this.emitEvent({
        type: 'request-cancelled',
        requestId,
        timestamp: new Date()
      });
    }

    this.activeRequests.clear();
    this.queue.length = 0;
  }

  // Private methods

  private generateRequestId(): string {
    return `vga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToQueue(request: VisualGenerationRequest) {
    if (this.config.priorityProcessing) {
      // Insert based on priority
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const insertIndex = this.queue.findIndex(
        req => priorityOrder[req.priority] > priorityOrder[request.priority]
      );
      
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }
    } else {
      this.queue.push(request);
    }
  }

  private startProcessing() {
    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.queueProcessingIntervalMs);
  }

  private async processQueue() {
    if (!this.isProcessing || this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }

    const nextRequest = this.queue.shift();
    if (!nextRequest) {
      // Queue is empty
      if (this.activeRequests.size === 0) {
        this.emitEvent({
          type: 'queue-empty',
          timestamp: new Date()
        });
      }
      return;
    }

    this.processRequest(nextRequest);
  }

  private async processRequest(request: VisualGenerationRequest) {
    this.activeRequests.set(request.id, request);
    
    request.status = 'in-progress';
    request.metadata.startedAt = new Date();
    request.metadata.attempts++;

    this.emitEvent({
      type: 'request-started',
      requestId: request.id,
      data: { request },
      timestamp: new Date()
    });

    try {
      const startTime = Date.now();
      
      // Generate the visual content
      const imageData = await this.generateVisualContent(request);
      
      const generationTime = Date.now() - startTime;
      
      request.status = 'completed';
      request.metadata.completedAt = new Date();
      request.result = {
        imageData,
        provider: this.getProviderUsed(request),
        generationTime
      };

      this.emitEvent({
        type: 'request-completed',
        requestId: request.id,
        data: { request },
        timestamp: new Date()
      });

      // Store result if needed
      await this.storeResult(request);

    } catch (error) {
      await this.handleRequestError(request, error);
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  private async generateVisualContent(request: VisualGenerationRequest): Promise<string> {
    // Emit progress event
    this.emitEvent({
      type: 'request-progress',
      requestId: request.id,
      data: { progress: 25, message: 'Preparing generation...' },
      timestamp: new Date()
    });

    // Enhance prompt based on content type
    const enhancedPrompt = this.enhancePromptForContentType(request);

    this.emitEvent({
      type: 'request-progress',
      requestId: request.id,
      data: { progress: 50, message: 'Generating image...' },
      timestamp: new Date()
    });

    // Use AI service to generate the image
    const imageData = await this.aiService.generateImage(enhancedPrompt);

    this.emitEvent({
      type: 'request-progress',
      requestId: request.id,
      data: { progress: 90, message: 'Finalizing...' },
      timestamp: new Date()
    });

    return imageData;
  }

  private enhancePromptForContentType(request: VisualGenerationRequest): string {
    let enhancedPrompt = request.prompt;

    switch (request.type) {
      case 'coloring-page':
        enhancedPrompt += ' coloring book style, black and white line art, clear outlines, no shading, white background, suitable for coloring';
        break;
      case 'cover':
        enhancedPrompt += ' book cover design, professional, eye-catching, with title space';
        break;
      case 'illustration':
        enhancedPrompt += ' detailed illustration, professional quality';
        break;
      case 'character-reference':
        enhancedPrompt += ' character reference sheet, multiple angles, clean design';
        break;
      case 'background':
        enhancedPrompt += ' background scene, detailed environment, suitable for overlay';
        break;
    }

    // Add style and aspect ratio if specified
    if (request.metadata.imageStyle) {
      enhancedPrompt += ` in ${request.metadata.imageStyle} style`;
    }

    if (request.metadata.aspectRatio) {
      enhancedPrompt += ` ${request.metadata.aspectRatio} aspect ratio`;
    }

    return enhancedPrompt;
  }

  private async handleRequestError(request: VisualGenerationRequest, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = this.isErrorRetryable(error);

    request.error = {
      message: errorMessage,
      code: this.getErrorCode(error),
      retryable: isRetryable
    };

    // Track error
    errorTracker.captureError(
      error instanceof Error ? error : new Error(errorMessage),
      { 
        operation: 'visual-generation',
        requestId: request.id,
        type: request.type,
        prompt: request.prompt.substring(0, 100)
      },
      'medium'
    );

    // Retry if appropriate
    if (this.config.enableAutoRetry && 
        isRetryable && 
        request.metadata.attempts < request.metadata.maxAttempts) {
      
      // Add back to queue with delay
      setTimeout(() => {
        request.status = 'queued';
        this.addToQueue(request);
      }, this.config.retryDelayMs);

      return;
    }

    // Mark as failed
    request.status = 'failed';
    request.metadata.completedAt = new Date();

    this.emitEvent({
      type: 'request-failed',
      requestId: request.id,
      data: { request, error: request.error },
      timestamp: new Date()
    });
  }

  private isErrorRetryable(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryableErrors = [
      'rate limit',
      'timeout',
      'network',
      'temporary',
      'service unavailable',
      'internal server error'
    ];

    return retryableErrors.some(retryable => 
      errorMessage.toLowerCase().includes(retryable)
    );
  }

  private getErrorCode(error: any): string {
    if (error?.code) return error.code;
    if (error?.status) return `HTTP_${error.status}`;
    return 'UNKNOWN_ERROR';
  }

  private getProviderUsed(request: VisualGenerationRequest): ImageService {
    return request.metadata.provider || this.apiSettings.imageService;
  }

  private async storeResult(request: VisualGenerationRequest) {
    // Store the result in persistent storage if needed
    try {
      const storageKey = `generation_result_${request.id}`;
      await persistentStorage.setItem(storageKey, {
        request,
        result: request.result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to store generation result:', error);
    }
  }

  private emitEvent(event: AgentEvent) {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in agent event listener:', error);
      }
    });
  }
}

// Singleton instance for global use
let globalAgent: VisualGenerationAgent | null = null;

export function getVisualGenerationAgent(apiSettings?: APISettings): VisualGenerationAgent {
  if (!globalAgent && apiSettings) {
    globalAgent = new VisualGenerationAgent(apiSettings);
  } else if (!globalAgent) {
    throw new Error('Visual Generation Agent not initialized. Provide API settings.');
  }
  
  if (apiSettings) {
    globalAgent.updateApiSettings(apiSettings);
  }
  
  return globalAgent;
}

export function shutdownVisualGenerationAgent() {
  if (globalAgent) {
    globalAgent.shutdown();
    globalAgent = null;
  }
}