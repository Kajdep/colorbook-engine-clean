import { Project, APISettings } from '../types';
import { advancedPublishing } from '../utils/advancedPublishing';
import { AIService } from '../utils/aiService';
import { errorTracker } from '../utils/errorTracking';
import { getVisualGenerationAgent, BatchGenerationUtils } from '../agents';

export type BatchOperationType = 'export-pdf' | 'generate-images';

export interface BatchError {
  projectId: string;
  message: string;
}

export interface BatchProgress {
  jobId: string;
  operation: BatchOperationType;
  total: number;
  completed: number;
  errors: BatchError[];
}

export type ProgressListener = (progress: BatchProgress) => void;

export class BatchManager {
  private listeners: Set<ProgressListener> = new Set();

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(progress: BatchProgress) {
    this.listeners.forEach((cb) => {
      try {
        cb(progress);
      } catch (err) {
        console.warn('Batch progress listener error', err);
      }
    });
  }

  async exportProjectsToPDF(projects: Project[]): Promise<BatchProgress> {
    const jobId = `batch_${Date.now()}`;
    const progress: BatchProgress = {
      jobId,
      operation: 'export-pdf',
      total: projects.length,
      completed: 0,
      errors: []
    };

    for (const project of projects) {
      try {
        await advancedPublishing.generateKDPPDF({
          title: project.title,
          author: project.metadata?.author || 'Unknown',
          description: project.description,
          language: project.metadata?.language || 'en',
          pages: project.pages.map((p) => ({
            type: p.type,
            content: p.content.text || '',
            imageUrl: p.content.imageData
          }))
        });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        progress.errors.push({ projectId: project.id, message });
        errorTracker.captureError(
          err instanceof Error ? err : new Error(message),
          { operation: 'export-pdf', projectId: project.id },
          'medium'
        );
      } finally {
        progress.completed += 1;
        this.notify({ ...progress });
      }
    }

    return progress;
  }

  async generateMissingImages(projects: Project[], apiSettings: APISettings): Promise<BatchProgress> {
    const jobId = `batch_${Date.now()}`;
    
    // Use the new Visual Generation Agent for better workflow management
    try {
      const agent = getVisualGenerationAgent(apiSettings);
      const batchUtils = new BatchGenerationUtils(agent);
      
      const batchId = await batchUtils.generateProjectImages(projects, {
        filterExisting: true,
        priority: 'normal',
        progressCallback: (progress) => {
          // Convert agent batch progress to our BatchProgress format
          const batchProgress: BatchProgress = {
            jobId,
            operation: 'generate-images',
            total: progress.totalRequests,
            completed: progress.completedRequests,
            errors: progress.errors.map(err => ({
              projectId: err.projectId || 'unknown',
              message: err.error
            }))
          };
          this.notify(batchProgress);
        }
      });
      
      // Monitor the batch and return final progress
      let finalProgress: BatchProgress = {
        jobId,
        operation: 'generate-images',
        total: 0,
        completed: 0,
        errors: []
      };
      
      // Wait for completion and get final status
      const maxWaitTime = 30 * 60 * 1000; // 30 minutes
      const startTime = Date.now();
      const checkInterval = 5000; // 5 seconds
      
      while (Date.now() - startTime < maxWaitTime) {
        const agentProgress = batchUtils.getBatchProgress(batchId);
        if (agentProgress) {
          finalProgress = {
            jobId,
            operation: 'generate-images',
            total: agentProgress.totalRequests,
            completed: agentProgress.completedRequests,
            errors: agentProgress.errors.map(err => ({
              projectId: err.projectId || 'unknown',
              message: err.error
            }))
          };
          
          // Check if completed
          if (agentProgress.completedRequests + agentProgress.failedRequests >= agentProgress.totalRequests) {
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      return finalProgress;
      
    } catch (error) {
      // Fallback to original implementation if agent fails
      console.warn('Visual Generation Agent failed, falling back to original implementation:', error);
      return this.generateMissingImagesLegacy(projects, apiSettings);
    }
  }

  // Keep the original implementation as a fallback
  private async generateMissingImagesLegacy(projects: Project[], apiSettings: APISettings): Promise<BatchProgress> {
    const jobId = `batch_${Date.now()}`;
    const tasks: Array<{ projectId: string; pageIndex: number; prompt: string }> = [];
    projects.forEach((project) => {
      project.pages.forEach((page, index) => {
        if (!page.content.imageData) {
          tasks.push({ projectId: project.id, pageIndex: index, prompt: page.content.imagePrompt || page.content.text || 'coloring page' });
        }
      });
    });

    const progress: BatchProgress = {
      jobId,
      operation: 'generate-images',
      total: tasks.length,
      completed: 0,
      errors: []
    };

    const ai = new AIService(apiSettings);

    for (const task of tasks) {
      try {
        const img = await ai.generateImage(task.prompt);
        const project = projects.find(p => p.id === task.projectId);
        if (project) {
          const page = project.pages[task.pageIndex];
          page.content.imageData = img.startsWith('data:') ? img.split(',')[1] : img;
        }
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        progress.errors.push({ projectId: task.projectId, message });
        errorTracker.captureError(
          err instanceof Error ? err : new Error(message),
          { operation: 'generate-images', projectId: task.projectId },
          'medium'
        );
      } finally {
        progress.completed += 1;
        this.notify({ ...progress });
      }
    }

    return progress;
  }
}

export const batchManager = new BatchManager();
export default batchManager;
