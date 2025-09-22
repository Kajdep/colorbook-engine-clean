/**
 * Basic tests for Visual Generation Agent
 * Note: These are simple integration tests that would typically use Jest or Vitest
 */

import { VisualGenerationAgent } from '../agents/VisualGenerationAgent';
import { APISettings } from '../types';

// Mock API settings for testing
const mockApiSettings: APISettings = {
  apiKey: 'test-api-key',
  aiModel: 'test-model',
  imageService: 'none',
  imageApiKey: '',
  imageModel: ''
};

// Simple test runner function
function runTest(name: string, testFn: () => Promise<void> | void) {
  console.log(`Testing: ${name}`);
  try {
    const result = testFn();
    if (result instanceof Promise) {
      result
        .then(() => console.log(`✅ ${name} passed`))
        .catch((error) => console.error(`❌ ${name} failed:`, error));
    } else {
      console.log(`✅ ${name} passed`);
    }
  } catch (error) {
    console.error(`❌ ${name} failed:`, error);
  }
}

// Test 1: Agent initialization
runTest('Agent initialization', () => {
  const agent = new VisualGenerationAgent(mockApiSettings);
  
  if (!agent) {
    throw new Error('Agent should be initialized');
  }
  
  const queueStatus = agent.getQueueStatus();
  if (queueStatus.queueLength !== 0 || queueStatus.activeRequests !== 0) {
    throw new Error('Initial queue should be empty');
  }
});

// Test 2: Request submission
runTest('Request submission', async () => {
  const agent = new VisualGenerationAgent(mockApiSettings, {
    maxConcurrentRequests: 1,
    enableAutoRetry: false
  });
  
  let eventReceived = false;
  const unsubscribe = agent.addEventListener((event) => {
    if (event.type === 'request-queued') {
      eventReceived = true;
    }
  });
  
  try {
    const requestId = await agent.submitRequest(
      'coloring-page',
      'Test prompt',
      { priority: 'normal' }
    );
    
    if (!requestId || !requestId.startsWith('vga_')) {
      throw new Error('Request ID should be generated');
    }
    
    const request = agent.getRequestStatus(requestId);
    if (!request || request.status !== 'queued') {
      throw new Error('Request should be queued');
    }
    
    // Give some time for event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!eventReceived) {
      throw new Error('Request queued event should be emitted');
    }
    
    // Cancel the request to prevent actual processing
    await agent.cancelRequest(requestId);
    
  } finally {
    unsubscribe();
    await agent.shutdown();
  }
});

// Test 3: Priority ordering
runTest('Priority ordering', async () => {
  const agent = new VisualGenerationAgent(mockApiSettings, {
    maxConcurrentRequests: 0, // Prevent processing
    priorityProcessing: true,
    enableAutoRetry: false
  });
  
  try {
    // Submit requests with different priorities
    const lowId = await agent.submitRequest('coloring-page', 'Low priority', { priority: 'low' });
    const highId = await agent.submitRequest('coloring-page', 'High priority', { priority: 'high' });
    const normalId = await agent.submitRequest('coloring-page', 'Normal priority', { priority: 'normal' });
    const urgentId = await agent.submitRequest('coloring-page', 'Urgent priority', { priority: 'urgent' });
    
    const queueStatus = agent.getQueueStatus();
    if (queueStatus.queueLength !== 4) {
      throw new Error('Should have 4 queued requests');
    }
    
    if (queueStatus.queuedByPriority.urgent !== 1 ||
        queueStatus.queuedByPriority.high !== 1 ||
        queueStatus.queuedByPriority.normal !== 1 ||
        queueStatus.queuedByPriority.low !== 1) {
      throw new Error('Priority distribution should be correct');
    }
    
  } finally {
    await agent.shutdown();
  }
});

// Test 4: Request cancellation
runTest('Request cancellation', async () => {
  const agent = new VisualGenerationAgent(mockApiSettings, {
    maxConcurrentRequests: 0, // Prevent processing
    enableAutoRetry: false
  });
  
  let cancelEventReceived = false;
  const unsubscribe = agent.addEventListener((event) => {
    if (event.type === 'request-cancelled') {
      cancelEventReceived = true;
    }
  });
  
  try {
    const requestId = await agent.submitRequest('coloring-page', 'Test prompt');
    
    const success = await agent.cancelRequest(requestId);
    if (!success) {
      throw new Error('Cancellation should succeed');
    }
    
    const request = agent.getRequestStatus(requestId);
    if (request && request.status !== 'cancelled') {
      throw new Error('Request should be cancelled');
    }
    
    // Give some time for event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!cancelEventReceived) {
      throw new Error('Request cancelled event should be emitted');
    }
    
  } finally {
    unsubscribe();
    await agent.shutdown();
  }
});

// Test 5: Content type prompt enhancement
runTest('Content type prompt enhancement', async () => {
  const agent = new VisualGenerationAgent(mockApiSettings, {
    maxConcurrentRequests: 0,
    enableAutoRetry: false
  });
  
  try {
    const coloringPageId = await agent.submitRequest('coloring-page', 'A cat');
    const coverId = await agent.submitRequest('cover', 'A book');
    const illustrationId = await agent.submitRequest('illustration', 'A scene');
    
    const coloringPage = agent.getRequestStatus(coloringPageId);
    const cover = agent.getRequestStatus(coverId);
    const illustration = agent.getRequestStatus(illustrationId);
    
    // Note: The prompt enhancement happens during processing,
    // so we can't easily test it without mocking the AI service
    // This test verifies that different content types are handled
    
    if (!coloringPage || coloringPage.type !== 'coloring-page') {
      throw new Error('Coloring page request should be created');
    }
    
    if (!cover || cover.type !== 'cover') {
      throw new Error('Cover request should be created');
    }
    
    if (!illustration || illustration.type !== 'illustration') {
      throw new Error('Illustration request should be created');
    }
    
  } finally {
    await agent.shutdown();
  }
});

// Test 6: Configuration update
runTest('Configuration update', () => {
  const agent = new VisualGenerationAgent(mockApiSettings);
  
  const newApiSettings: APISettings = {
    ...mockApiSettings,
    apiKey: 'new-api-key',
    imageService: 'openai'
  };
  
  // This should not throw an error
  agent.updateApiSettings(newApiSettings);
  
  // We can't easily verify the internal state change without exposing
  // the apiSettings property, but at least we can verify the method exists
  // and doesn't throw
});

console.log('All tests completed. Check above for results.');

export {}; // Make this a module