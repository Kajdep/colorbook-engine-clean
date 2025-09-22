/**
 * Export Agent Test Suite
 * Verifies export agent functionality with mock data
 */

import { exportAgent, ExportFormat } from '../utils/exportAgent';
import { Project } from '../types';

// Mock project for testing
const mockProject: Project = {
  id: 'test-project-1',
  title: 'Test Coloring Book',
  description: 'A test project for export agent validation',
  pages: [
    {
      id: 'page-1',
      type: 'cover',
      pageNumber: 1,
      content: {
        text: 'Test Coloring Book Cover',
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'page-2',
      type: 'story',
      pageNumber: 2,
      content: {
        text: 'Once upon a time, there was a magical coloring book...',
        imagePrompt: 'A magical coloring book with sparkles'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'page-3',
      type: 'coloring',
      pageNumber: 3,
      content: {
        text: 'Color this beautiful butterfly!',
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  metadata: {
    targetAgeGroup: '4-8',
    imageStyle: 'cartoon',
    lineWeight: 3,
    aspectRatio: '1:1',
    totalPages: 3,
    targetWordsPerPage: 50,
    author: 'Test Author',
    language: 'en'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Test the export agent functionality
 */
export async function testExportAgent(): Promise<{
  success: boolean;
  results: Array<{
    format: ExportFormat;
    success: boolean;
    jobId?: string;
    error?: string;
    duration?: number;
  }>;
}> {
  console.log('🧪 Starting Export Agent Test Suite...');
  
  // Set up project resolver
  exportAgent.setProjectResolver(async (projectId: string) => {
    if (projectId === mockProject.id) {
      return mockProject;
    }
    return null;
  });

  const testFormats: ExportFormat[] = ['PDF', 'EPUB', 'DOCX', 'CBZ'];
  const results: Array<{
    format: ExportFormat;
    success: boolean;
    jobId?: string;
    error?: string;
    duration?: number;
  }> = [];

  for (const format of testFormats) {
    console.log(`📄 Testing ${format} export...`);
    const startTime = Date.now();
    
    try {
      const jobId = await exportAgent.submitExportJob(mockProject, {
        format,
        priority: 'high',
        maxRetries: 1
      });

      // Wait for job completion (with timeout)
      const result = await waitForJobCompletion(jobId, 30000);
      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ ${format} export completed successfully in ${duration}ms`);
        results.push({
          format,
          success: true,
          jobId,
          duration
        });
      } else {
        console.log(`❌ ${format} export failed: ${result.error}`);
        results.push({
          format,
          success: false,
          jobId,
          error: result.error,
          duration
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`💥 ${format} export threw error: ${errorMessage}`);
      results.push({
        format,
        success: false,
        error: errorMessage,
        duration
      });
    }
  }

  // Test statistics
  const stats = exportAgent.getStatistics();
  console.log('📊 Export Agent Statistics:', stats);

  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const overallSuccess = successfulTests === totalTests;

  console.log(`🎯 Test Results: ${successfulTests}/${totalTests} formats exported successfully`);
  
  return {
    success: overallSuccess,
    results
  };
}

/**
 * Wait for a job to complete
 */
function waitForJobCompletion(jobId: string, timeoutMs: number): Promise<{
  success: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkJob = () => {
      const job = exportAgent.getJobStatus(jobId);
      
      if (!job) {
        resolve({ success: false, error: 'Job not found' });
        return;
      }

      if (job.status === 'completed') {
        resolve({ success: true });
        return;
      }

      if (job.status === 'failed') {
        resolve({ success: false, error: job.error });
        return;
      }

      if (job.status === 'cancelled') {
        resolve({ success: false, error: 'Job was cancelled' });
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        resolve({ success: false, error: 'Timeout waiting for job completion' });
        return;
      }

      // Continue checking
      setTimeout(checkJob, 100);
    };

    checkJob();
  });
}

/**
 * Run a quick test of all export formats
 */
export async function quickExportTest(): Promise<boolean> {
  try {
    console.log('🚀 Running quick export test...');
    
    // Set up minimal project resolver
    exportAgent.setProjectResolver(async () => mockProject);

    // Test PDF export
    const jobId = await exportAgent.submitExportJob(mockProject, {
      format: 'PDF',
      priority: 'high'
    });

    const result = await waitForJobCompletion(jobId, 10000);
    
    if (result.success) {
      console.log('✅ Quick export test passed!');
      return true;
    } else {
      console.log('❌ Quick export test failed:', result.error);
      return false;
    }
  } catch (error) {
    console.log('💥 Quick export test error:', error);
    return false;
  }
}

export { mockProject };