/**
 * Chapter Agent Service
 * Frontend service that interfaces with the Chapter Generation Agent
 */

import { ChapterGenerationAgent, ChapterGenerationStatus } from './chapterGenerationAgent';
import { backendAPI } from './backendAPI';
import { StoryGenerationParams } from './aiService';
import { APISettings, StoryData } from '../types';

export interface ChapterAgentServiceConfig {
  useBackendAPI?: boolean;
  apiSettings: APISettings;
  enableRealTimeUpdates?: boolean;
  pollingInterval?: number;
}

export class ChapterAgentService {
  private agent: ChapterGenerationAgent;
  private config: ChapterAgentServiceConfig;
  private statusPollers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ChapterAgentServiceConfig) {
    this.config = {
      useBackendAPI: false,
      enableRealTimeUpdates: true,
      pollingInterval: 2000,
      ...config
    };

    this.agent = new ChapterGenerationAgent(config.apiSettings);
  }

  /**
   * Generate a single chapter using the agent workflow
   */
  async generateChapter(
    params: StoryGenerationParams,
    options: {
      useAdvancedAI?: boolean;
      enableCharacterConsistency?: boolean;
      enableStyleConsistency?: boolean;
      generateImages?: boolean;
      onProgress?: (status: ChapterGenerationStatus) => void;
    } = {}
  ): Promise<StoryData> {
    if (this.config.useBackendAPI) {
      return this.generateChapterViaAPI(params, options);
    }

    // Use local agent
    const jobId = await this.agent.submitChapterGeneration({
      id: '',
      projectId: 'frontend-single',
      params,
      workflowType: 'single',
      options
    });

    // Set up progress monitoring if callback provided
    if (options.onProgress && this.config.enableRealTimeUpdates) {
      this.startProgressPolling(jobId, options.onProgress);
    }

    // Wait for completion
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const status = this.agent.getJobStatus(jobId);
        if (!status) {
          reject(new Error('Job not found'));
          return;
        }

        if (status.status === 'completed' && status.result) {
          this.stopProgressPolling(jobId);
          resolve(status.result);
        } else if (status.status === 'failed') {
          this.stopProgressPolling(jobId);
          reject(new Error(status.error || 'Generation failed'));
        } else if (status.status === 'cancelled') {
          this.stopProgressPolling(jobId);
          reject(new Error('Generation cancelled'));
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };

      checkCompletion();
    });
  }

  /**
   * Generate multiple chapters in batch
   */
  async generateBatchChapters(
    baseParams: StoryGenerationParams,
    variations: Partial<StoryGenerationParams>[],
    options: {
      useAdvancedAI?: boolean;
      onProgress?: (batchStatus: any) => void;
    } = {}
  ): Promise<StoryData[]> {
    if (this.config.useBackendAPI) {
      return this.generateBatchChaptersViaAPI(baseParams, variations, options);
    }

    // Use local agent
    return this.agent.generateBatchChapters(baseParams, variations, options);
  }

  /**
   * Monitor job progress with real-time updates
   */
  async monitorJob(
    jobId: string,
    onProgress: (status: ChapterGenerationStatus) => void
  ): Promise<void> {
    if (this.config.useBackendAPI) {
      return this.monitorJobViaAPI(jobId, onProgress);
    }

    this.startProgressPolling(jobId, onProgress);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (this.config.useBackendAPI) {
      try {
        const response = await backendAPI.request(`/agent/chapter/jobs/${jobId}`, {
          method: 'DELETE'
        });
        return !response.error;
      } catch (error) {
        console.error('Failed to cancel job via API:', error);
        return false;
      }
    }

    return this.agent.cancelJob(jobId);
  }

  /**
   * Get all jobs for the current user
   */
  async getAllJobs(): Promise<ChapterGenerationStatus[]> {
    if (this.config.useBackendAPI) {
      try {
        const response = await backendAPI.request('/agent/chapter/jobs');
        return response.data?.jobs || [];
      } catch (error) {
        console.error('Failed to get jobs via API:', error);
        return [];
      }
    }

    return this.agent.getAllJobs();
  }

  /**
   * Get agent statistics
   */
  async getAgentStats() {
    if (this.config.useBackendAPI) {
      try {
        const response = await backendAPI.request('/agent/stats');
        return response.data;
      } catch (error) {
        console.error('Failed to get stats via API:', error);
        return null;
      }
    }

    return this.agent.getAgentStats();
  }

  /**
   * Generate chapter via backend API
   */
  private async generateChapterViaAPI(
    params: StoryGenerationParams,
    options: any
  ): Promise<StoryData> {
    try {
      // Start generation
      const response = await backendAPI.request('/agent/chapter/generate', {
        method: 'POST',
        body: JSON.stringify({
          params,
          workflowType: 'single',
          options
        })
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const jobId = response.data.jobId;

      // Monitor progress if callback provided
      if (options.onProgress && this.config.enableRealTimeUpdates) {
        this.monitorJobViaAPI(jobId, options.onProgress);
      }

      // Poll for completion
      return new Promise((resolve, reject) => {
        const checkStatus = async () => {
          try {
            const statusResponse = await backendAPI.request(`/agent/chapter/status/${jobId}`);
            
            if (statusResponse.error) {
              reject(new Error(statusResponse.error));
              return;
            }

            const status = statusResponse.data;
            
            if (status.status === 'completed' && status.result) {
              resolve(status.result);
            } else if (status.status === 'failed') {
              reject(new Error(status.error || 'Generation failed'));
            } else if (status.status === 'cancelled') {
              reject(new Error('Generation cancelled'));
            } else {
              setTimeout(checkStatus, 2000);
            }
          } catch (error) {
            reject(error);
          }
        };

        checkStatus();
      });

    } catch (error) {
      throw new Error(`API generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate batch chapters via backend API
   */
  private async generateBatchChaptersViaAPI(
    baseParams: StoryGenerationParams,
    variations: Partial<StoryGenerationParams>[],
    options: any
  ): Promise<StoryData[]> {
    try {
      const response = await backendAPI.request('/agent/chapter/batch', {
        method: 'POST',
        body: JSON.stringify({
          baseParams,
          variations,
          options
        })
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const batchJobId = response.data.batchJobId;

      // Monitor batch progress
      if (options.onProgress) {
        this.monitorBatchJobViaAPI(batchJobId, options.onProgress);
      }

      // Wait for all jobs to complete
      return new Promise((resolve, reject) => {
        const checkBatchStatus = async () => {
          try {
            const batchResponse = await backendAPI.request(`/agent/chapter/batch/${batchJobId}`);
            
            if (batchResponse.error) {
              reject(new Error(batchResponse.error));
              return;
            }

            const batch = batchResponse.data;
            
            if (batch.status === 'completed') {
              // Get all completed job results
              const results: StoryData[] = [];
              for (const job of batch.jobs) {
                if (job.status === 'completed') {
                  const jobResponse = await backendAPI.request(`/agent/chapter/status/${job.id}`);
                  if (jobResponse.data?.result) {
                    results.push(jobResponse.data.result);
                  }
                }
              }
              resolve(results);
            } else if (batch.status === 'failed') {
              reject(new Error('Batch generation failed'));
            } else {
              setTimeout(checkBatchStatus, 3000);
            }
          } catch (error) {
            reject(error);
          }
        };

        checkBatchStatus();
      });

    } catch (error) {
      throw new Error(`API batch generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor job via API with polling
   */
  private async monitorJobViaAPI(
    jobId: string,
    onProgress: (status: ChapterGenerationStatus) => void
  ): Promise<void> {
    const poll = async () => {
      try {
        const response = await backendAPI.request(`/agent/chapter/status/${jobId}`);
        if (!response.error && response.data) {
          onProgress(response.data);
          
          // Continue polling if job is still running
          if (['pending', 'in-progress'].includes(response.data.status)) {
            setTimeout(poll, this.config.pollingInterval);
          }
        }
      } catch (error) {
        console.error('Progress polling error:', error);
      }
    };

    poll();
  }

  /**
   * Monitor batch job via API
   */
  private async monitorBatchJobViaAPI(
    batchJobId: string,
    onProgress: (batchStatus: any) => void
  ): Promise<void> {
    const poll = async () => {
      try {
        const response = await backendAPI.request(`/agent/chapter/batch/${batchJobId}`);
        if (!response.error && response.data) {
          onProgress(response.data);
          
          if (['pending', 'in-progress'].includes(response.data.status)) {
            setTimeout(poll, this.config.pollingInterval);
          }
        }
      } catch (error) {
        console.error('Batch progress polling error:', error);
      }
    };

    poll();
  }

  /**
   * Start progress polling for local agent
   */
  private startProgressPolling(
    jobId: string,
    onProgress: (status: ChapterGenerationStatus) => void
  ): void {
    const poll = () => {
      const status = this.agent.getJobStatus(jobId);
      if (status) {
        onProgress(status);
        
        if (['pending', 'in-progress'].includes(status.status)) {
          const pollerId = setTimeout(poll, this.config.pollingInterval);
          this.statusPollers.set(jobId, pollerId);
        } else {
          this.stopProgressPolling(jobId);
        }
      }
    };

    poll();
  }

  /**
   * Stop progress polling
   */
  private stopProgressPolling(jobId: string): void {
    const pollerId = this.statusPollers.get(jobId);
    if (pollerId) {
      clearTimeout(pollerId);
      this.statusPollers.delete(jobId);
    }
  }

  /**
   * Update agent configuration
   */
  updateConfig(newConfig: Partial<ChapterAgentServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.apiSettings) {
      this.agent = new ChapterGenerationAgent(newConfig.apiSettings);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Stop all polling
    for (const [jobId] of this.statusPollers) {
      this.stopProgressPolling(jobId);
    }
    
    // Cleanup agent
    this.agent.cleanupCompletedJobs();
  }
}

// Export configured service instance
let chapterAgentService: ChapterAgentService | null = null;

export function createChapterAgentService(config: ChapterAgentServiceConfig): ChapterAgentService {
  chapterAgentService = new ChapterAgentService(config);
  return chapterAgentService;
}

export function getChapterAgentService(): ChapterAgentService | null {
  return chapterAgentService;
}

export default ChapterAgentService;