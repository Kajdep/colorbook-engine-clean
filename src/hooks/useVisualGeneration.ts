import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VisualGenerationAgent, 
  getVisualGenerationAgent,
  VisualContentType,
  GenerationPriority,
  VisualGenerationRequest,
  AgentEvent,
  AgentEventListener
} from '../agents';
import { useAppStore } from '../store/useAppStore';

// Hook state interface
interface VisualGenerationHookState {
  isProcessing: boolean;
  queueLength: number;
  activeRequests: number;
  error: string | null;
  requests: Map<string, VisualGenerationRequest>;
}

// Hook return interface
interface UseVisualGenerationReturn {
  // State
  state: VisualGenerationHookState;
  
  // Actions
  generateImage: (
    type: VisualContentType,
    prompt: string,
    options?: {
      priority?: GenerationPriority;
      projectId?: string;
      pageId?: string;
      imageStyle?: string;
      aspectRatio?: string;
    }
  ) => Promise<string>;
  
  cancelRequest: (requestId: string) => Promise<boolean>;
  getRequest: (requestId: string) => VisualGenerationRequest | null;
  
  // Events
  onProgress: (requestId: string, callback: (progress: number, message: string) => void) => () => void;
  onCompleted: (requestId: string, callback: (result: { imageData: string; generationTime: number }) => void) => () => void;
  onFailed: (requestId: string, callback: (error: { message: string; retryable: boolean }) => void) => () => void;
}

/**
 * React hook for integrating with the Visual Generation Agent
 */
export function useVisualGeneration(): UseVisualGenerationReturn {
  const { apiSettings, addNotification } = useAppStore();
  const agentRef = useRef<VisualGenerationAgent | null>(null);
  const [state, setState] = useState<VisualGenerationHookState>({
    isProcessing: false,
    queueLength: 0,
    activeRequests: 0,
    error: null,
    requests: new Map()
  });

  // Event callback storage
  const eventCallbacks = useRef<Map<string, {
    onProgress?: (progress: number, message: string) => void;
    onCompleted?: (result: { imageData: string; generationTime: number }) => void;
    onFailed?: (error: { message: string; retryable: boolean }) => void;
  }>>(new Map());

  // Initialize agent
  useEffect(() => {
    if (!agentRef.current && apiSettings.apiKey) {
      try {
        agentRef.current = getVisualGenerationAgent(apiSettings);
        
        // Set up event listener
        const unsubscribe = agentRef.current.addEventListener(handleAgentEvent);
        
        // Update initial state
        updateQueueStatus();
        
        return () => {
          unsubscribe();
        };
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize agent'
        }));
      }
    } else if (agentRef.current && apiSettings.apiKey) {
      // Update API settings if they changed
      agentRef.current.updateApiSettings(apiSettings);
    }
  }, [apiSettings]);

  // Handle agent events
  const handleAgentEvent: AgentEventListener = useCallback((event: AgentEvent) => {
    const { type, requestId, data } = event;
    
    switch (type) {
      case 'request-queued':
        setState(prev => ({
          ...prev,
          requests: new Map(prev.requests.set(requestId!, data.request))
        }));
        updateQueueStatus();
        break;
        
      case 'request-started':
        setState(prev => ({
          ...prev,
          isProcessing: true,
          requests: new Map(prev.requests.set(requestId!, data.request))
        }));
        updateQueueStatus();
        break;
        
      case 'request-progress':
        if (requestId) {
          const callbacks = eventCallbacks.current.get(requestId);
          if (callbacks?.onProgress) {
            callbacks.onProgress(data.progress, data.message);
          }
        }
        break;
        
      case 'request-completed':
        if (requestId) {
          const callbacks = eventCallbacks.current.get(requestId);
          if (callbacks?.onCompleted && data.request.result) {
            callbacks.onCompleted({
              imageData: data.request.result.imageData,
              generationTime: data.request.result.generationTime
            });
          }
          
          setState(prev => ({
            ...prev,
            requests: new Map(prev.requests.set(requestId, data.request))
          }));
          
          addNotification({
            type: 'success',
            message: `Image generated successfully! (${Math.round(data.request.result.generationTime / 1000)}s)`
          });
        }
        updateQueueStatus();
        break;
        
      case 'request-failed':
        if (requestId) {
          const callbacks = eventCallbacks.current.get(requestId);
          if (callbacks?.onFailed && data.error) {
            callbacks.onFailed({
              message: data.error.message,
              retryable: data.error.retryable
            });
          }
          
          setState(prev => ({
            ...prev,
            requests: new Map(prev.requests.set(requestId, data.request))
          }));
          
          addNotification({
            type: 'error',
            message: `Image generation failed: ${data.error.message}`
          });
        }
        updateQueueStatus();
        break;
        
      case 'queue-empty':
        setState(prev => ({
          ...prev,
          isProcessing: false
        }));
        break;
        
      case 'agent-error':
        setState(prev => ({
          ...prev,
          error: data?.message || 'Agent error occurred'
        }));
        addNotification({
          type: 'error',
          message: 'Visual generation agent error occurred'
        });
        break;
    }
  }, [addNotification]);

  // Update queue status
  const updateQueueStatus = useCallback(() => {
    if (agentRef.current) {
      const status = agentRef.current.getQueueStatus();
      setState(prev => ({
        ...prev,
        queueLength: status.queueLength,
        activeRequests: status.activeRequests
      }));
    }
  }, []);

  // Generate image
  const generateImage = useCallback(async (
    type: VisualContentType,
    prompt: string,
    options: {
      priority?: GenerationPriority;
      projectId?: string;
      pageId?: string;
      imageStyle?: string;
      aspectRatio?: string;
    } = {}
  ): Promise<string> => {
    if (!agentRef.current) {
      throw new Error('Visual Generation Agent not initialized');
    }

    if (!apiSettings.apiKey) {
      throw new Error('API key not configured');
    }

    setState(prev => ({ ...prev, error: null }));
    
    addNotification({
      type: 'info',
      message: `Starting ${type} generation...`
    });

    try {
      const requestId = await agentRef.current.submitRequest(type, prompt, {
        priority: options.priority || 'normal',
        projectId: options.projectId,
        pageId: options.pageId,
        imageStyle: options.imageStyle,
        aspectRatio: options.aspectRatio
      });

      return requestId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, [apiSettings, addNotification]);

  // Cancel request
  const cancelRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!agentRef.current) {
      return false;
    }

    const success = await agentRef.current.cancelRequest(requestId);
    
    if (success) {
      setState(prev => {
        const newRequests = new Map(prev.requests);
        const request = newRequests.get(requestId);
        if (request) {
          request.status = 'cancelled';
          newRequests.set(requestId, request);
        }
        return { ...prev, requests: newRequests };
      });
      
      addNotification({
        type: 'info',
        message: 'Generation request cancelled'
      });
    }
    
    updateQueueStatus();
    return success;
  }, [addNotification, updateQueueStatus]);

  // Get request
  const getRequest = useCallback((requestId: string): VisualGenerationRequest | null => {
    return state.requests.get(requestId) || null;
  }, [state.requests]);

  // Event subscription helpers
  const onProgress = useCallback((
    requestId: string, 
    callback: (progress: number, message: string) => void
  ): (() => void) => {
    const current = eventCallbacks.current.get(requestId) || {};
    eventCallbacks.current.set(requestId, { ...current, onProgress: callback });
    
    return () => {
      const current = eventCallbacks.current.get(requestId);
      if (current) {
        delete current.onProgress;
        if (Object.keys(current).length === 0) {
          eventCallbacks.current.delete(requestId);
        } else {
          eventCallbacks.current.set(requestId, current);
        }
      }
    };
  }, []);

  const onCompleted = useCallback((
    requestId: string, 
    callback: (result: { imageData: string; generationTime: number }) => void
  ): (() => void) => {
    const current = eventCallbacks.current.get(requestId) || {};
    eventCallbacks.current.set(requestId, { ...current, onCompleted: callback });
    
    return () => {
      const current = eventCallbacks.current.get(requestId);
      if (current) {
        delete current.onCompleted;
        if (Object.keys(current).length === 0) {
          eventCallbacks.current.delete(requestId);
        } else {
          eventCallbacks.current.set(requestId, current);
        }
      }
    };
  }, []);

  const onFailed = useCallback((
    requestId: string, 
    callback: (error: { message: string; retryable: boolean }) => void
  ): (() => void) => {
    const current = eventCallbacks.current.get(requestId) || {};
    eventCallbacks.current.set(requestId, { ...current, onFailed: callback });
    
    return () => {
      const current = eventCallbacks.current.get(requestId);
      if (current) {
        delete current.onFailed;
        if (Object.keys(current).length === 0) {
          eventCallbacks.current.delete(requestId);
        } else {
          eventCallbacks.current.set(requestId, current);
        }
      }
    };
  }, []);

  return {
    state,
    generateImage,
    cancelRequest,
    getRequest,
    onProgress,
    onCompleted,
    onFailed
  };
}