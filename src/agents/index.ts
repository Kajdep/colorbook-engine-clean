export { 
  VisualGenerationAgent,
  getVisualGenerationAgent,
  shutdownVisualGenerationAgent,
  type VisualGenerationRequest,
  type GenerationProgress,
  type AgentEvent,
  type AgentEventListener,
  type VisualContentType,
  type GenerationPriority,
  type GenerationStatus,
  type AgentConfig
} from './VisualGenerationAgent';

export {
  BatchGenerationUtils,
  createBatchGenerationUtils,
  type BatchGenerationConfig,
  type BatchProgress,
  type BatchError,
  type BatchRequest
} from './BatchGenerationUtils';