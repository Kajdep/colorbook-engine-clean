export interface Project {
  id: string;
  title: string;
  description?: string;
  pages: Page[];
  currentStory?: StoryData;
  drawings?: any[];
  metadata: ProjectMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  type: 'story' | 'coloring' | 'cover';
  pageNumber: number;
  content: PageContent;
  createdAt: string;
  updatedAt: string;
}

export interface PageContent {
  text?: string;
  imageData?: string;
  imagePrompt?: string;
  wordCount?: number;
  version?: number;
}

export interface ProjectMetadata {
  targetAgeGroup?: string;
  imageStyle?: string;
  lineWeight?: number;
  aspectRatio?: string;
  totalPages?: number;
  targetWordsPerPage?: number;
  generatedAt?: string;
  author?: string;
  language?: string;
  originalLanguage?: string;
  characterReferences?: any[];
  styleSettings?: any;
  marketAnalysis?: any;
  optimizationApplied?: boolean;
}

export interface StoryPage {
  pageNumber: number;
  story: string;
  imagePrompt: string;
  wordCount: number;
  imageGenerated: boolean;
  imageData?: string;
}

export interface StoryData {
  id?: string;
  pages: StoryPage[];
  metadata: ProjectMetadata;
}

export interface ComplianceCheck {
  category: string;
  status: 'pass' | 'warning' | 'fail';
  issues: string[];
  recommendations: string[];
  description: string;
}

export interface ComplianceResults {
  score: number;
  checks: ComplianceCheck[];
  hasIssues: boolean;
  project: Project;
}

export interface APISettings {
  apiKey: string;
  aiModel: string;
  imageService: 'none' | 'openai' | 'stabilityai' | 'replicate' | 'google-imagen' | 'google-imagen2' | 'google-vertex';
  imageApiKey: string;
  imageModel: string;
  googleApiKey?: string;
  googleProjectId?: string;
}

export interface DrawingSettings {
  brushSize: number;
  opacity: number;
  currentColor: string;
  drawingMode: 'draw' | 'erase';
}

export interface ExportSettings {
  pageSize: string;
  margins: {
    vertical: number;
    horizontal: number;
  };
  quality: 'web' | 'print-standard' | 'print-high' | 'professional';
  colorMode: 'rgb' | 'cmyk';
  includeBleed: boolean;
  includeCropMarks: boolean;
  includeColorBars: boolean;
  doubleSided: boolean;
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

export type Section = 'dashboard' | 'projects' | 'story' | 'canvas' | 'pdf' | 'kdp' | 'settings' | 'help' | 'api-settings' | 'story-generator' | 'image-generator' | 'cloud-upload' | 'account';

// Define ImageService type based on APISettings
export type ImageService = APISettings['imageService'];

// Google AI specific types
export interface GoogleImageGenOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  safetyFilter?: 'none' | 'low' | 'medium' | 'high';
  stylePreset?: 'photographic' | 'digital-art' | 'comic-book' | 'fantasy-art' | 'line-art' | 'anime' | 'neon-punk' | 'isometric';
}

export interface GoogleImageResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  metadata?: {
    prompt: string;
    seed?: number;
    safetyRating?: string;
    modelVersion?: string;
  };
}