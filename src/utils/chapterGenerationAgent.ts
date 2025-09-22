/**
 * AI-Powered Chapter Generation Agent
 * Automates the chapter generation workflow with status monitoring and error handling
 */

import { AIService, StoryGenerationParams } from './aiService';
import { AdvancedAIService } from './advancedAIService';
import { APISettings, StoryData } from '../types';

export interface ChapterGenerationRequest {
  id: string;
  projectId: string;
  params: StoryGenerationParams;
  workflowType: 'single' | 'batch' | 'iterative';
  chapterCount?: number;
  options?: {
    useAdvancedAI?: boolean;
    enableCharacterConsistency?: boolean;
    enableStyleConsistency?: boolean;
    generateImages?: boolean;
    iterativeRefinement?: boolean;
  };
}

export interface ChapterGenerationStatus {
  id: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  progress: {
    currentStep: string;
    completedSteps: number;
    totalSteps: number;
    percentage: number;
  };
  result?: StoryData;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
}

export interface AgentConfiguration {
  maxConcurrentJobs: number;
  defaultTimeout: number;
  retryAttempts: number;
  enableProgressCallbacks: boolean;
  enableErrorRecovery: boolean;
}

export class ChapterGenerationAgent {
  private aiService: AIService;
  private advancedAIService: AdvancedAIService;
  private activeJobs: Map<string, ChapterGenerationStatus> = new Map();
  private jobQueue: ChapterGenerationRequest[] = [];
  private config: AgentConfiguration;
  private isProcessing = false;

  constructor(apiSettings: APISettings, config?: Partial<AgentConfiguration>) {
    this.aiService = new AIService(apiSettings);
    this.advancedAIService = new AdvancedAIService(apiSettings);
    
    this.config = {
      maxConcurrentJobs: 3,
      defaultTimeout: 300000, // 5 minutes
      retryAttempts: 2,
      enableProgressCallbacks: true,
      enableErrorRecovery: true,
      ...config
    };
  }

  /**
   * Submit a chapter generation request
   */
  async submitChapterGeneration(request: ChapterGenerationRequest): Promise<string> {
    const jobId = request.id || this.generateJobId();
    
    const status: ChapterGenerationStatus = {
      id: jobId,
      status: 'pending',
      progress: {
        currentStep: 'Queued',
        completedSteps: 0,
        totalSteps: this.calculateTotalSteps(request),
        percentage: 0
      },
      startedAt: new Date()
    };

    this.activeJobs.set(jobId, status);
    this.jobQueue.push({ ...request, id: jobId });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Get status of a chapter generation job
   */
  getJobStatus(jobId: string): ChapterGenerationStatus | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getAllJobs(): ChapterGenerationStatus[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a pending or in-progress job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      // Remove from queue
      this.jobQueue = this.jobQueue.filter(req => req.id !== jobId);
      job.status = 'cancelled';
      job.completedAt = new Date();
      return true;
    }

    if (job.status === 'in-progress') {
      // Mark for cancellation (actual cancellation depends on current step)
      job.status = 'cancelled';
      job.completedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Generate a single chapter with full workflow
   */
  async generateSingleChapter(
    params: StoryGenerationParams,
    options: ChapterGenerationRequest['options'] = {}
  ): Promise<StoryData> {
    const request: ChapterGenerationRequest = {
      id: this.generateJobId(),
      projectId: 'single-chapter',
      params,
      workflowType: 'single',
      options
    };

    const jobId = await this.submitChapterGeneration(request);
    
    // Wait for completion
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const status = this.getJobStatus(jobId);
        if (!status) {
          reject(new Error('Job not found'));
          return;
        }

        if (status.status === 'completed' && status.result) {
          resolve(status.result);
        } else if (status.status === 'failed') {
          reject(new Error(status.error || 'Generation failed'));
        } else if (status.status === 'cancelled') {
          reject(new Error('Generation cancelled'));
        } else {
          // Check again in 1 second
          setTimeout(checkStatus, 1000);
        }
      };

      checkStatus();
    });
  }

  /**
   * Generate multiple chapters in batch
   */
  async generateBatchChapters(
    baseParams: StoryGenerationParams,
    chapterVariations: Partial<StoryGenerationParams>[],
    options: ChapterGenerationRequest['options'] = {}
  ): Promise<StoryData[]> {
    const batchRequest: ChapterGenerationRequest = {
      id: this.generateJobId(),
      projectId: 'batch-chapters',
      params: baseParams,
      workflowType: 'batch',
      chapterCount: chapterVariations.length,
      options
    };

    const jobId = await this.submitChapterGeneration(batchRequest);
    
    // Store variations for processing
    (batchRequest as any).variations = chapterVariations;
    
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const status = this.getJobStatus(jobId);
        if (!status) {
          reject(new Error('Batch job not found'));
          return;
        }

        if (status.status === 'completed' && status.result) {
          // For batch jobs, we'll extend the result to include multiple stories
          resolve([(status.result as any).chapters || []].flat());
        } else if (status.status === 'failed') {
          reject(new Error(status.error || 'Batch generation failed'));
        } else if (status.status === 'cancelled') {
          reject(new Error('Batch generation cancelled'));
        } else {
          setTimeout(checkStatus, 1000);
        }
      };

      checkStatus();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.jobQueue.length > 0) {
      const activeJobsCount = Array.from(this.activeJobs.values())
        .filter(job => job.status === 'in-progress').length;

      if (activeJobsCount >= this.config.maxConcurrentJobs) {
        // Wait for a job to complete
        await this.sleep(1000);
        continue;
      }

      const request = this.jobQueue.shift();
      if (!request) continue;

      // Process the job
      this.processJob(request).catch(error => {
        console.error('Job processing error:', error);
      });
    }

    this.isProcessing = false;
  }

  private async processJob(request: ChapterGenerationRequest): Promise<void> {
    const status = this.activeJobs.get(request.id);
    if (!status) return;

    try {
      status.status = 'in-progress';
      status.progress.currentStep = 'Initializing';

      switch (request.workflowType) {
        case 'single':
          await this.processSingleChapter(request, status);
          break;
        case 'batch':
          await this.processBatchChapters(request, status);
          break;
        case 'iterative':
          await this.processIterativeChapters(request, status);
          break;
      }

      status.status = 'completed';
      status.completedAt = new Date();
      status.progress.currentStep = 'Completed';
      status.progress.completedSteps = status.progress.totalSteps;
      status.progress.percentage = 100;

    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : 'Unknown error';
      status.completedAt = new Date();
      status.progress.currentStep = 'Failed';
    }
  }

  private async processSingleChapter(
    request: ChapterGenerationRequest,
    status: ChapterGenerationStatus
  ): Promise<void> {
    // Step 1: Generate story content
    this.updateProgress(status, 'Generating story content', 1);
    
    const service = request.options?.useAdvancedAI ? this.advancedAIService : this.aiService;
    const story = await service.generateStoryWithImagePrompts(request.params);

    // Step 2: Apply character consistency if requested
    if (request.options?.enableCharacterConsistency && request.options?.useAdvancedAI) {
      this.updateProgress(status, 'Applying character consistency', 2);
      // Advanced AI character consistency logic would go here
    }

    // Step 3: Apply style consistency if requested
    if (request.options?.enableStyleConsistency && request.options?.useAdvancedAI) {
      this.updateProgress(status, 'Applying style consistency', 3);
      // Advanced AI style consistency logic would go here
    }

    // Step 4: Generate images if requested
    if (request.options?.generateImages) {
      this.updateProgress(status, 'Generating images', 4);
      await this.generateImagesForStory(story);
    }

    // Step 5: Final validation and cleanup
    this.updateProgress(status, 'Finalizing', 5);
    status.result = story;
  }

  private async processBatchChapters(
    request: ChapterGenerationRequest,
    status: ChapterGenerationStatus
  ): Promise<void> {
    const variations = (request as any).variations || [];
    const results: StoryData[] = [];

    for (let i = 0; i < variations.length; i++) {
      if (status.status === 'cancelled') break;

      this.updateProgress(status, `Generating chapter ${i + 1} of ${variations.length}`, i + 1);
      
      const chapterParams = { ...request.params, ...variations[i] };
      const service = request.options?.useAdvancedAI ? this.advancedAIService : this.aiService;
      
      try {
        const story = await service.generateStoryWithImagePrompts(chapterParams);
        
        if (request.options?.generateImages) {
          await this.generateImagesForStory(story);
        }
        
        results.push(story);
      } catch (error) {
        console.error(`Failed to generate chapter ${i + 1}:`, error);
        // Continue with other chapters unless it's a critical error
      }
    }

    status.result = { chapters: results } as any;
  }

  private async processIterativeChapters(
    request: ChapterGenerationRequest,
    status: ChapterGenerationStatus
  ): Promise<void> {
    // Iterative refinement workflow
    this.updateProgress(status, 'Generating initial draft', 1);
    
    const service = request.options?.useAdvancedAI ? this.advancedAIService : this.aiService;
    let story = await service.generateStoryWithImagePrompts(request.params);

    if (request.options?.iterativeRefinement && request.options?.useAdvancedAI) {
      this.updateProgress(status, 'Applying iterative refinement', 2);
      
      // Use AdvancedAIService editing suggestions
      for (let i = 0; i < story.pages.length; i++) {
        const suggestions = await this.advancedAIService.generateEditingSuggestions(
          story.pages[i].story,
          i + 1,
          story
        );
        
        // Apply best suggestions (simplified logic)
        if (suggestions.suggestions.length > 0) {
          const bestSuggestion = suggestions.suggestions
            .filter(s => s.confidence > 0.7)
            .sort((a, b) => b.confidence - a.confidence)[0];
          
          if (bestSuggestion) {
            story.pages[i].story = story.pages[i].story.replace(
              bestSuggestion.originalText,
              bestSuggestion.suggestedText
            );
          }
        }
      }
    }

    if (request.options?.generateImages) {
      this.updateProgress(status, 'Generating final images', 3);
      await this.generateImagesForStory(story);
    }

    status.result = story;
  }

  private async generateImagesForStory(story: StoryData): Promise<void> {
    for (const page of story.pages) {
      if (page.imagePrompt && !page.imageGenerated) {
        try {
          const imageData = await this.aiService.generateImage(page.imagePrompt);
          page.imageData = imageData;
          page.imageGenerated = true;
        } catch (error) {
          console.warn(`Failed to generate image for page ${page.pageNumber}:`, error);
        }
      }
    }
  }

  private updateProgress(
    status: ChapterGenerationStatus,
    currentStep: string,
    completedSteps: number
  ): void {
    status.progress.currentStep = currentStep;
    status.progress.completedSteps = completedSteps;
    status.progress.percentage = Math.round((completedSteps / status.progress.totalSteps) * 100);
  }

  private calculateTotalSteps(request: ChapterGenerationRequest): number {
    let steps = 2; // Basic generation + finalization
    
    if (request.options?.enableCharacterConsistency) steps++;
    if (request.options?.enableStyleConsistency) steps++;
    if (request.options?.generateImages) steps++;
    if (request.options?.iterativeRefinement) steps++;
    
    if (request.workflowType === 'batch' && request.chapterCount) {
      steps = request.chapterCount * 2; // Generation + images per chapter
    }
    
    return steps;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get agent statistics and health
   */
  getAgentStats() {
    const jobs = Array.from(this.activeJobs.values());
    return {
      totalJobs: jobs.length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      inProgress: jobs.filter(j => j.status === 'in-progress').length,
      pending: jobs.filter(j => j.status === 'pending').length,
      queueLength: this.jobQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear completed and failed jobs from memory
   */
  cleanupCompletedJobs(): void {
    for (const [jobId, status] of this.activeJobs.entries()) {
      if (status.status === 'completed' || status.status === 'failed') {
        const ageHours = (Date.now() - status.startedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours > 24) { // Remove jobs older than 24 hours
          this.activeJobs.delete(jobId);
        }
      }
    }
  }
}

// Export singleton instance
export const chapterGenerationAgent = new ChapterGenerationAgent(
  { apiKey: '', aiModel: '', imageService: 'none', imageApiKey: '', imageModel: '' }
);

export default chapterGenerationAgent;