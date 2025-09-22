/**
 * React Hook for Export Agent Integration
 * Provides a seamless interface between the Export Agent and React components
 */

import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportAgent, ExportFormat, ExportJobOptions, ExportJob, ExportProgress } from '../utils/exportAgent';

export interface UseExportAgentReturn {
  // Job management
  submitExport: (projectId: string, format: ExportFormat, options?: Partial<ExportJobOptions>) => Promise<string>;
  cancelExport: (jobId: string) => Promise<boolean>;
  
  // Job queries
  getJob: (jobId: string) => ExportJob | null;
  getProjectJobs: (projectId: string) => ExportJob[];
  getAllJobs: () => ExportJob[];
  
  // Progress tracking
  subscribeToJob: (jobId: string, onProgress?: (progress: ExportProgress) => void, onComplete?: (job: ExportJob) => void) => () => void;
  
  // Statistics
  getStats: () => {
    totalJobs: number;
    activeJobs: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
  };
  
  // Utilities
  clearCompletedJobs: () => void;
  retryJob: (jobId: string) => Promise<string | null>;
}

export const useExportAgent = (): UseExportAgentReturn => {
  const store = useAppStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the export agent with project resolver
  useEffect(() => {
    if (!isInitialized) {
      exportAgent.setProjectResolver(async (projectId: string) => {
        return store.projects.find(p => p.id === projectId) || null;
      });
      setIsInitialized(true);
    }
  }, [store.projects, isInitialized]);

  // Submit export job
  const submitExport = useCallback(async (
    projectId: string, 
    format: ExportFormat, 
    options: Partial<ExportJobOptions> = {}
  ): Promise<string> => {
    const project = store.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const jobOptions: ExportJobOptions = {
      format,
      priority: 'normal',
      retryOnFailure: true,
      maxRetries: 3,
      ...options
    };

    try {
      const jobId = await exportAgent.submitExportJob(project, jobOptions);
      
      // Add job to store
      const job = exportAgent.getJobStatus(jobId);
      if (job) {
        store.addExportJob(job);
        
        // Subscribe to updates
        exportAgent.onProgress(jobId, (progress) => {
          store.updateExportJob(jobId, {
            status: progress.status,
            progress: progress.progress
          });
        });
        
        exportAgent.onCompletion(jobId, (completedJob) => {
          store.updateExportJob(jobId, completedJob);
          
          // Add notification
          if (completedJob.status === 'completed') {
            store.addNotification({
              type: 'success',
              message: `Export completed: ${format} for "${project.title}"`,
              duration: 5000
            });
          } else if (completedJob.status === 'failed') {
            store.addNotification({
              type: 'error',
              message: `Export failed: ${format} for "${project.title}" - ${completedJob.error}`,
              duration: 8000
            });
          }
        });
      }
      
      return jobId;
    } catch (error) {
      store.addNotification({
        type: 'error',
        message: `Failed to start export: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000
      });
      throw error;
    }
  }, [store]);

  // Cancel export job
  const cancelExport = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const success = await exportAgent.cancelJob(jobId);
      if (success) {
        const job = exportAgent.getJobStatus(jobId);
        if (job) {
          store.updateExportJob(jobId, job);
        }
        
        store.addNotification({
          type: 'info',
          message: 'Export job cancelled',
          duration: 3000
        });
      }
      return success;
    } catch (error) {
      store.addNotification({
        type: 'error',
        message: `Failed to cancel export: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000
      });
      return false;
    }
  }, [store]);

  // Get job status
  const getJob = useCallback((jobId: string): ExportJob | null => {
    return exportAgent.getJobStatus(jobId);
  }, []);

  // Get project jobs
  const getProjectJobs = useCallback((projectId: string): ExportJob[] => {
    return exportAgent.getProjectJobs(projectId);
  }, []);

  // Get all jobs
  const getAllJobs = useCallback((): ExportJob[] => {
    return store.exportJobs;
  }, [store.exportJobs]);

  // Subscribe to job updates
  const subscribeToJob = useCallback((
    jobId: string,
    onProgress?: (progress: ExportProgress) => void,
    onComplete?: (job: ExportJob) => void
  ): (() => void) => {
    const unsubscribers: (() => void)[] = [];

    if (onProgress) {
      unsubscribers.push(exportAgent.onProgress(jobId, onProgress));
    }

    if (onComplete) {
      unsubscribers.push(exportAgent.onCompletion(jobId, onComplete));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Get statistics
  const getStats = useCallback(() => {
    return exportAgent.getStatistics();
  }, []);

  // Clear completed jobs
  const clearCompletedJobs = useCallback(() => {
    store.clearCompletedJobs();
    exportAgent.cleanupOldJobs(0); // Clear immediately
  }, [store]);

  // Retry failed job
  const retryJob = useCallback(async (jobId: string): Promise<string | null> => {
    const job = exportAgent.getJobStatus(jobId);
    if (!job || job.status !== 'failed') {
      return null;
    }

    const project = store.projects.find(p => p.id === job.projectId);
    if (!project) {
      throw new Error('Project not found for retry');
    }

    // Submit new job with same settings
    const newJobId = await submitExport(job.projectId, job.format, {
      settings: job.settings,
      priority: 'normal',
      retryOnFailure: true,
      maxRetries: 3
    });

    // Remove old job
    store.removeExportJob(jobId);

    return newJobId;
  }, [store, submitExport]);

  return {
    submitExport,
    cancelExport,
    getJob,
    getProjectJobs,
    getAllJobs,
    subscribeToJob,
    getStats,
    clearCompletedJobs,
    retryJob
  };
};

export default useExportAgent;