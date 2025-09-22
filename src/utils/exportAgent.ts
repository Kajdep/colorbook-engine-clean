/**
 * Export Agent - Automates export workflows for different formats (EPUB, DOCX, PDF)
 * 
 * Features:
 * - Coordinates export requests from the frontend
 * - Interfaces with the export backend logic
 * - Tracks export progress and handles errors gracefully
 * - Returns download links/results to the user
 * - Ensures extensibility for future export formats
 */

import { Project, PublishingOptions, ExportResult } from '../types';
import { advancedPublishing } from './advancedPublishing';
import { errorTracker } from './errorTracking';

export type ExportFormat = 'PDF' | 'EPUB' | 'DOCX' | 'CBZ' | 'Print-Package' | 'All-Formats';

export interface ExportJob {
  id: string;
  projectId: string;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: ExportResult;
  error?: string;
  settings?: any;
  retryCount: number;
  maxRetries: number;
}

export interface ExportJobOptions {
  format: ExportFormat;
  settings?: any;
  priority?: 'low' | 'normal' | 'high';
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface ExportProgress {
  jobId: string;
  status: ExportJob['status'];
  progress: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  downloadUrl?: string;
  metadata?: any;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;
export type ExportCompletionCallback = (job: ExportJob) => void;

/**
 * Export Agent manages and automates export workflows
 */
export class ExportAgent {
  private jobs: Map<string, ExportJob> = new Map();
  private progressCallbacks: Map<string, ExportProgressCallback[]> = new Map();
  private completionCallbacks: Map<string, ExportCompletionCallback[]> = new Map();
  private maxConcurrentJobs = 3;
  private activeJobs = 0;
  private jobQueue: string[] = [];

  /**
   * Submit an export job for processing
   */
  async submitExportJob(
    project: Project,
    options: ExportJobOptions
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: ExportJob = {
      id: jobId,
      projectId: project.id,
      format: options.format,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      settings: options.settings
    };

    this.jobs.set(jobId, job);
    
    // Add to queue based on priority
    if (options.priority === 'high') {
      this.jobQueue.unshift(jobId);
    } else {
      this.jobQueue.push(jobId);
    }

    // Track job submission
    errorTracker.captureUserAction('export_job_submitted', {
      jobId,
      projectId: project.id,
      format: options.format,
      priority: options.priority || 'normal'
    });

    // Start processing if slots available
    this.processNextJob();

    return jobId;
  }

  /**
   * Get current status of an export job
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs for a project
   */
  getProjectJobs(projectId: string): ExportJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel an export job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      // Remove from queue
      const queueIndex = this.jobQueue.indexOf(jobId);
      if (queueIndex !== -1) {
        this.jobQueue.splice(queueIndex, 1);
      }
    }

    job.status = 'cancelled';
    job.completedAt = new Date();

    this.notifyProgress(jobId, {
      jobId,
      status: 'cancelled',
      progress: job.progress
    });

    this.notifyCompletion(jobId, job);

    errorTracker.captureUserAction('export_job_cancelled', {
      jobId,
      projectId: job.projectId,
      format: job.format
    });

    return true;
  }

  /**
   * Subscribe to job progress updates
   */
  onProgress(jobId: string, callback: ExportProgressCallback): () => void {
    if (!this.progressCallbacks.has(jobId)) {
      this.progressCallbacks.set(jobId, []);
    }
    this.progressCallbacks.get(jobId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.progressCallbacks.get(jobId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to job completion
   */
  onCompletion(jobId: string, callback: ExportCompletionCallback): () => void {
    if (!this.completionCallbacks.has(jobId)) {
      this.completionCallbacks.set(jobId, []);
    }
    this.completionCallbacks.get(jobId)!.push(callback);

    return () => {
      const callbacks = this.completionCallbacks.get(jobId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    if (this.activeJobs >= this.maxConcurrentJobs || this.jobQueue.length === 0) {
      return;
    }

    const jobId = this.jobQueue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') {
      this.processNextJob(); // Try next job
      return;
    }

    this.activeJobs++;
    await this.executeJob(job);
    this.activeJobs--;

    // Process next job
    this.processNextJob();
  }

  /**
   * Execute an export job
   */
  private async executeJob(job: ExportJob): Promise<void> {
    try {
      job.status = 'processing';
      job.startedAt = new Date();
      
      this.notifyProgress(job.id, {
        jobId: job.id,
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing export...'
      });

      // Get project data
      const project = await this.getProjectData(job.projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Convert project to publishing options
      const publishingOptions = this.projectToPublishingOptions(project);

      // Execute export based on format
      let result: ExportResult;

      switch (job.format) {
        case 'PDF':
          result = await this.exportPDF(publishingOptions, job);
          break;
        case 'EPUB':
          result = await this.exportEPUB(publishingOptions, job);
          break;
        case 'DOCX':
          result = await this.exportDOCX(publishingOptions, job);
          break;
        case 'CBZ':
          result = await this.exportCBZ(publishingOptions, job);
          break;
        case 'Print-Package':
          result = await this.exportPrintPackage(publishingOptions, job);
          break;
        case 'All-Formats':
          result = await this.exportAllFormats(publishingOptions, job);
          break;
        default:
          throw new Error(`Unsupported export format: ${job.format}`);
      }

      // Handle result
      if (result.success) {
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();

        this.notifyProgress(job.id, {
          jobId: job.id,
          status: 'completed',
          progress: 100,
          downloadUrl: result.downloadUrl,
          metadata: result.metadata
        });

        errorTracker.captureUserAction('export_job_completed', {
          jobId: job.id,
          projectId: job.projectId,
          format: job.format,
          duration: job.completedAt.getTime() - job.startedAt!.getTime()
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }

    } catch (error) {
      await this.handleJobError(job, error);
    }

    this.notifyCompletion(job.id, job);
  }

  /**
   * Handle job errors and retry logic
   */
  private async handleJobError(job: ExportJob, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    job.retryCount++;

    if (job.retryCount <= job.maxRetries) {
      // Retry the job
      job.status = 'pending';
      job.error = undefined;
      this.jobQueue.unshift(job.id); // Add to front of queue for retry

      this.notifyProgress(job.id, {
        jobId: job.id,
        status: 'pending',
        progress: 0,
        currentStep: `Retrying... (${job.retryCount}/${job.maxRetries})`
      });

      errorTracker.captureError(
        error instanceof Error ? error : new Error(errorMessage),
        { jobId: job.id, retryCount: job.retryCount },
        'medium'
      );
    } else {
      // Max retries exceeded
      job.status = 'failed';
      job.error = errorMessage;
      job.completedAt = new Date();

      this.notifyProgress(job.id, {
        jobId: job.id,
        status: 'failed',
        progress: 0
      });

      errorTracker.captureError(
        error instanceof Error ? error : new Error(errorMessage),
        { jobId: job.id, finalFailure: true },
        'high'
      );
    }
  }

  /**
   * Export PDF format
   */
  private async exportPDF(options: PublishingOptions, job: ExportJob): Promise<ExportResult> {
    this.updateProgress(job, 25, 'Generating PDF structure...');
    
    const result = await advancedPublishing.generateKDPPDF(options);
    
    this.updateProgress(job, 100, 'PDF export completed');
    
    return result;
  }

  /**
   * Export EPUB format
   */
  private async exportEPUB(options: PublishingOptions, job: ExportJob): Promise<ExportResult> {
    this.updateProgress(job, 25, 'Generating EPUB structure...');
    
    const result = await advancedPublishing.generateEPUB(options);
    
    this.updateProgress(job, 100, 'EPUB export completed');
    
    return result;
  }

  /**
   * Export DOCX format (new implementation)
   */
  private async exportDOCX(options: PublishingOptions, job: ExportJob): Promise<ExportResult> {
    this.updateProgress(job, 25, 'Generating DOCX document...');
    
    try {
      // Create a simple DOCX-like content structure
      // Note: For full DOCX support, consider using a library like docx
      const docContent = this.generateDOCXContent(options);
      const blob = new Blob([docContent], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      this.updateProgress(job, 100, 'DOCX export completed');
      
      return {
        success: true,
        blob,
        downloadUrl: URL.createObjectURL(blob),
        metadata: {
          format: 'DOCX',
          size: blob.size,
          pages: options.pages.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DOCX generation failed'
      };
    }
  }

  /**
   * Export CBZ format
   */
  private async exportCBZ(options: PublishingOptions, job: ExportJob): Promise<ExportResult> {
    this.updateProgress(job, 25, 'Generating CBZ archive...');
    
    const result = await advancedPublishing.generateCBZ(options);
    
    this.updateProgress(job, 100, 'CBZ export completed');
    
    return result;
  }

  /**
   * Export Print Package
   */
  private async exportPrintPackage(options: PublishingOptions, job: ExportJob): Promise<ExportResult> {
    this.updateProgress(job, 25, 'Generating print package...');
    
    const result = await advancedPublishing.generatePrintPackage(options);
    
    this.updateProgress(job, 100, 'Print package completed');
    
    return result;
  }

  /**
   * Export all formats
   */
  private async exportAllFormats(options: PublishingOptions, job: ExportJob): Promise<ExportResult> {
    this.updateProgress(job, 10, 'Starting multi-format export...');
    
    const result = await advancedPublishing.exportAllFormats(options);
    
    this.updateProgress(job, 100, 'All formats export completed');
    
    return {
      success: result.summary.failed === 0,
      blob: undefined, // Results are in individual formats
      metadata: {
        format: 'All-Formats',
        results: result.results,
        summary: result.summary
      }
    };
  }

  /**
   * Generate DOCX content (simplified)
   */
  private generateDOCXContent(options: PublishingOptions): string {
    // This is a simplified XML structure for demonstration
    // In production, use a proper DOCX library
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${options.title}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>By ${options.author}</w:t></w:r>
    </w:p>
    ${options.pages.map((page, index) => `
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Page ${index + 1}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>${page.content}</w:t></w:r>
    </w:p>
    `).join('')}
  </w:body>
</w:document>`;
  }

  /**
   * Update job progress
   */
  private updateProgress(job: ExportJob, progress: number, step?: string): void {
    job.progress = progress;
    
    this.notifyProgress(job.id, {
      jobId: job.id,
      status: job.status,
      progress,
      currentStep: step
    });
  }

  /**
   * Notify progress callbacks
   */
  private notifyProgress(jobId: string, progress: ExportProgress): void {
    const callbacks = this.progressCallbacks.get(jobId) || [];
    callbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    });
  }

  /**
   * Notify completion callbacks
   */
  private notifyCompletion(jobId: string, job: ExportJob): void {
    const callbacks = this.completionCallbacks.get(jobId) || [];
    callbacks.forEach(callback => {
      try {
        callback(job);
      } catch (error) {
        console.warn('Completion callback error:', error);
      }
    });
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get project data from store
   */
  private async getProjectData(projectId: string): Promise<Project | null> {
    // This will be injected by the component using the agent
    // The actual implementation will use the projectId parameter
    console.log('Getting project data for:', projectId);
    return null;
  }

  /**
   * Set project data resolver (to be called by the store/component)
   */
  setProjectResolver(resolver: (projectId: string) => Promise<Project | null>): void {
    this.getProjectData = resolver;
  }

  /**
   * Convert project to publishing options
   */
  private projectToPublishingOptions(project: Project): PublishingOptions {
    return {
      title: project.title,
      author: project.metadata.author || 'Unknown Author',
      description: project.description,
      language: project.metadata.language || 'en',
      pages: project.pages.map(page => ({
        type: page.type as any,
        content: page.content.text || '',
        imageUrl: page.content.imageData
      })),
      metadata: {
        publisher: project.metadata.author,
        publishDate: new Date(),
        keywords: [],
        category: 'Coloring Book'
      }
    };
  }

  /**
   * Clean up completed jobs older than specified time
   */
  cleanupOldJobs(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && 
          job.completedAt && 
          job.completedAt.getTime() < cutoffTime) {
        
        // Clean up callbacks
        this.progressCallbacks.delete(jobId);
        this.completionCallbacks.delete(jobId);
        
        // Clean up blob URLs to prevent memory leaks
        if (job.result?.downloadUrl) {
          URL.revokeObjectURL(job.result.downloadUrl);
        }
        
        // Remove job
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Get export statistics
   */
  getStatistics(): {
    totalJobs: number;
    activeJobs: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => j.status === 'processing').length;
    const pendingJobs = jobs.filter(j => j.status === 'pending').length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    return {
      totalJobs,
      activeJobs,
      pendingJobs,
      completedJobs,
      failedJobs,
      successRate
    };
  }
}

// Create singleton instance
export const exportAgent = new ExportAgent();

// Auto-cleanup old jobs every hour
setInterval(() => {
  exportAgent.cleanupOldJobs(24);
}, 60 * 60 * 1000);

export default exportAgent;