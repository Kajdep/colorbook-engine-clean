/**
 * React Hook for Chapter Generation Agent
 * Provides easy access to chapter generation workflows with React state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChapterAgentService, ChapterAgentServiceConfig, createChapterAgentService } from '../utils/chapterAgentService';
import { ChapterGenerationStatus } from '../utils/chapterGenerationAgent';
import { StoryGenerationParams } from '../utils/aiService';
import { StoryData } from '../types';

export interface UseChapterAgentOptions {
  config: ChapterAgentServiceConfig;
  autoCleanup?: boolean;
}

export interface ChapterGenerationJob {
  id: string;
  status: ChapterGenerationStatus;
  params: StoryGenerationParams;
  result?: StoryData;
  error?: string;
}

export interface UseChapterAgentReturn {
  // Generation functions
  generateChapter: (params: StoryGenerationParams, options?: any) => Promise<StoryData>;
  generateBatchChapters: (baseParams: StoryGenerationParams, variations: Partial<StoryGenerationParams>[]) => Promise<StoryData[]>;
  
  // Job management
  cancelJob: (jobId: string) => Promise<boolean>;
  getAllJobs: () => Promise<ChapterGenerationStatus[]>;
  
  // State
  isGenerating: boolean;
  currentJob: ChapterGenerationJob | null;
  allJobs: ChapterGenerationStatus[];
  agentStats: any;
  
  // Utilities
  refreshJobs: () => Promise<void>;
  clearCompletedJobs: () => void;
  
  // Agent service instance for advanced usage
  service: ChapterAgentService | null;
}

export function useChapterAgent(options: UseChapterAgentOptions): UseChapterAgentReturn {
  const [service, setService] = useState<ChapterAgentService | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState<ChapterGenerationJob | null>(null);
  const [allJobs, setAllJobs] = useState<ChapterGenerationStatus[]>([]);
  const [agentStats, setAgentStats] = useState<any>(null);
  
  const serviceRef = useRef<ChapterAgentService | null>(null);
  const { config, autoCleanup = true } = options;

  // Initialize service
  useEffect(() => {
    const newService = createChapterAgentService(config);
    setService(newService);
    serviceRef.current = newService;

    return () => {
      if (autoCleanup && serviceRef.current) {
        serviceRef.current.cleanup();
      }
    };
  }, [config, autoCleanup]);

  // Load initial jobs and stats
  useEffect(() => {
    if (service) {
      refreshJobs();
      loadAgentStats();
    }
  }, [service]);

  const refreshJobs = useCallback(async () => {
    if (!service) return;
    
    try {
      const jobs = await service.getAllJobs();
      setAllJobs(jobs);
    } catch (error) {
      console.error('Failed to refresh jobs:', error);
    }
  }, [service]);

  const loadAgentStats = useCallback(async () => {
    if (!service) return;
    
    try {
      const stats = await service.getAgentStats();
      setAgentStats(stats);
    } catch (error) {
      console.error('Failed to load agent stats:', error);
    }
  }, [service]);

  const generateChapter = useCallback(async (
    params: StoryGenerationParams,
    options: {
      useAdvancedAI?: boolean;
      enableCharacterConsistency?: boolean;
      enableStyleConsistency?: boolean;
      generateImages?: boolean;
    } = {}
  ): Promise<StoryData> => {
    if (!service) {
      throw new Error('Chapter agent service not initialized');
    }

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      const result = await service.generateChapter(params, {
        ...options,
        onProgress: (status: ChapterGenerationStatus) => {
          setCurrentJob({
            id: status.id,
            status,
            params,
            result: status.result,
            error: status.error
          });
        }
      });

      // Update jobs list
      await refreshJobs();
      
      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsGenerating(false);
      setCurrentJob(null);
    }
  }, [service, refreshJobs]);

  const generateBatchChapters = useCallback(async (
    baseParams: StoryGenerationParams,
    variations: Partial<StoryGenerationParams>[]
  ): Promise<StoryData[]> => {
    if (!service) {
      throw new Error('Chapter agent service not initialized');
    }

    setIsGenerating(true);

    try {
      const results = await service.generateBatchChapters(baseParams, variations, {
        onProgress: (batchStatus: any) => {
          setCurrentJob({
            id: batchStatus.id,
            status: {
              id: batchStatus.id,
              status: batchStatus.status,
              progress: {
                currentStep: `Processing ${batchStatus.completedChapters}/${batchStatus.totalChapters} chapters`,
                completedSteps: batchStatus.completedChapters,
                totalSteps: batchStatus.totalChapters,
                percentage: Math.round((batchStatus.completedChapters / batchStatus.totalChapters) * 100)
              },
              startedAt: new Date(batchStatus.startedAt),
              completedAt: batchStatus.completedAt ? new Date(batchStatus.completedAt) : undefined
            },
            params: baseParams
          });
        }
      });

      await refreshJobs();
      return results;
    } catch (error) {
      throw error;
    } finally {
      setIsGenerating(false);
      setCurrentJob(null);
    }
  }, [service, refreshJobs]);

  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    if (!service) return false;

    try {
      const success = await service.cancelJob(jobId);
      if (success) {
        await refreshJobs();
        
        // Clear current job if it was cancelled
        if (currentJob?.id === jobId) {
          setCurrentJob(null);
          setIsGenerating(false);
        }
      }
      return success;
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }, [service, refreshJobs, currentJob]);

  const getAllJobsCallback = useCallback(async (): Promise<ChapterGenerationStatus[]> => {
    if (!service) return [];
    
    try {
      return await service.getAllJobs();
    } catch (error) {
      console.error('Failed to get all jobs:', error);
      return [];
    }
  }, [service]);

  const clearCompletedJobs = useCallback(() => {
    setAllJobs(prev => prev.filter(job => 
      !['completed', 'failed', 'cancelled'].includes(job.status)
    ));
  }, []);

  return {
    generateChapter,
    generateBatchChapters,
    cancelJob,
    getAllJobs: getAllJobsCallback,
    isGenerating,
    currentJob,
    allJobs,
    agentStats,
    refreshJobs,
    clearCompletedJobs,
    service
  };
}

export default useChapterAgent;