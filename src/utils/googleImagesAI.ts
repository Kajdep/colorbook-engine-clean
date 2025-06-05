interface GoogleImageGenOptions {
  prompt?: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  seed?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  safetyFilter?: 'none' | 'low' | 'medium' | 'high';
  stylePreset?: 'photographic' | 'digital-art' | 'comic-book' | 'fantasy-art' | 'line-art' | 'anime' | 'neon-punk' | 'isometric';
}

interface GoogleImageResponse {
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

class GoogleImagesAIService {
  private apiKey: string | null = null;
  private projectId: string | null = null;
  private location: string = 'us-central1';
  private baseUrl = 'https://us-central1-aiplatform.googleapis.com/v1/projects';

  constructor() {
    this.loadCredentials();
  }

  private loadCredentials() {
    this.apiKey = localStorage.getItem('google_ai_api_key');
    this.projectId = localStorage.getItem('google_project_id');
  }

  setCredentials(apiKey: string, projectId: string) {
    this.apiKey = apiKey;
    this.projectId = projectId;
    localStorage.setItem('google_ai_api_key', apiKey);
    localStorage.setItem('google_project_id', projectId);
  }

  // Google Imagen API integration
  async generateWithImagen(prompt: string, options: GoogleImageGenOptions = {}): Promise<GoogleImageResponse> {
    if (!this.apiKey || !this.projectId) {
      return { success: false, error: 'Google AI credentials not configured' };
    }

    try {
      const imagenPrompt = this.optimizePromptForColoring(prompt, options);
      
      const requestBody = {
        instances: [{
          prompt: imagenPrompt,
          image: {
            bytesBase64Encoded: ""
          }
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.aspectRatio || '1:1',
          negativePrompt: options.negativePrompt || 'blurry, low quality, distorted, text, watermark, signature',
          safetyFilterLevel: options.safetyFilter || 'medium',
          personGeneration: 'dont_allow', // Good for children's content
          guidanceScale: options.guidanceScale || 7.5,
          seed: options.seed,
        }
      };

      const response = await fetch(
        `${this.baseUrl}/${this.projectId}/locations/${this.location}/publishers/google/models/imagegeneration:predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Google Imagen API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const data = await response.json();
      
      if (data.predictions && data.predictions[0]) {
        const prediction = data.predictions[0];
        
        // Convert base64 to blob URL
        const imageData = prediction.bytesBase64Encoded;
        const blob = this.base64ToBlob(imageData, 'image/png');
        const imageUrl = URL.createObjectURL(blob);

        return {
          success: true,
          imageUrl,
          metadata: {
            prompt: imagenPrompt,
            seed: options.seed,
            safetyRating: prediction.safetyAttributes?.blocked ? 'blocked' : 'safe',
            modelVersion: 'imagen'
          }
        };
      }

      return { success: false, error: 'No image generated' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Imagen generation failed'
      };
    }
  }

  // Google Vertex AI Imagen 2 integration
  async generateWithImagen2(prompt: string, options: GoogleImageGenOptions = {}): Promise<GoogleImageResponse> {
    if (!this.apiKey || !this.projectId) {
      return { success: false, error: 'Google AI credentials not configured' };
    }

    try {
      const optimizedPrompt = this.optimizePromptForColoring(prompt, options);
      
      const requestBody = {
        instances: [{
          prompt: optimizedPrompt
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.aspectRatio || '1:1',
          negativePrompt: options.negativePrompt || 'blurry, low quality, distorted, text, watermark, signature, nsfw',
          seed: options.seed,
          guidanceScale: options.guidanceScale || 7.5,
          safetyFilterLevel: options.safetyFilter || 'medium',
          stylePreset: options.stylePreset || 'line-art'
        }
      };

      const response = await fetch(
        `${this.baseUrl}/${this.projectId}/locations/${this.location}/publishers/google/models/imagen-3.0-generate-001:predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Google Imagen 2 API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const data = await response.json();
      
      if (data.predictions && data.predictions[0]) {
        const prediction = data.predictions[0];
        
        // Handle different response formats
        let imageUrl: string;
        if (prediction.bytesBase64Encoded) {
          const blob = this.base64ToBlob(prediction.bytesBase64Encoded, 'image/png');
          imageUrl = URL.createObjectURL(blob);
        } else if (prediction.uri) {
          imageUrl = prediction.uri;
        } else {
          return { success: false, error: 'No image data in response' };
        }

        return {
          success: true,
          imageUrl,
          metadata: {
            prompt: optimizedPrompt,
            seed: options.seed,
            safetyRating: prediction.safetyAttributes?.blocked ? 'blocked' : 'safe',
            modelVersion: 'imagen-2'
          }
        };
      }

      return { success: false, error: 'No image generated' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Imagen 2 generation failed'
      };
    }
  }

  // Google Vertex AI Studio integration (newer API)
  async generateWithVertexAI(prompt: string, options: GoogleImageGenOptions = {}): Promise<GoogleImageResponse> {
    if (!this.apiKey || !this.projectId) {
      return { success: false, error: 'Google AI credentials not configured' };
    }

    try {
      const optimizedPrompt = this.optimizePromptForColoring(prompt, options);
      
      const requestBody = {
        contents: [{
          parts: [{
            text: `Generate a coloring book page: ${optimizedPrompt}`
          }]
        }],
        generationConfig: {
          responseMimeType: 'image/png',
          responseSchema: {
            type: 'object',
            properties: {
              image: {
                type: 'string',
                format: 'byte'
              }
            }
          }
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Google Vertex AI error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]) {
        const imageData = data.candidates[0].content.parts[0].inlineData?.data;
        
        if (imageData) {
          const blob = this.base64ToBlob(imageData, 'image/png');
          const imageUrl = URL.createObjectURL(blob);

          return {
            success: true,
            imageUrl,
            metadata: {
              prompt: optimizedPrompt,
              seed: options.seed,
              safetyRating: data.candidates[0].safetyRatings ? 'checked' : 'unknown',
              modelVersion: 'vertex-ai'
            }
          };
        }
      }

      return { success: false, error: 'No image generated by Vertex AI' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Vertex AI generation failed'
      };
    }
  }

  // Main generation method with provider selection
  async generateImage(
    prompt: string, 
    provider: 'imagen' | 'imagen-2' | 'vertex-ai' = 'imagen-2',
    options: GoogleImageGenOptions = {}
  ): Promise<GoogleImageResponse> {
    // Add coloring book optimization
    const coloringOptions = {
      ...options,
      negativePrompt: (options.negativePrompt || '') + ', color, colored, shading, gradient, realistic photo, 3d render',
      stylePreset: 'line-art' as const,
      guidanceScale: options.guidanceScale || 8.0 // Higher guidance for better line art
    };

    switch (provider) {
      case 'imagen':
        return this.generateWithImagen(prompt, coloringOptions);
      case 'imagen-2':
        return this.generateWithImagen2(prompt, coloringOptions);
      case 'vertex-ai':
        return this.generateWithVertexAI(prompt, coloringOptions);
      default:
        return { success: false, error: 'Unknown Google AI provider' };
    }
  }

  // Optimize prompts specifically for coloring book pages
  private optimizePromptForColoring(prompt: string, options: GoogleImageGenOptions): string {
    let optimized = prompt;

    // Add coloring book specific terms
    const coloringTerms = [
      'coloring book page',
      'black and white line art',
      'clear outlines',
      'simple line drawing',
      'no shading',
      'white background',
      'thick lines',
      'clean lineart'
    ];

    // Add style-specific optimizations
    if (options.stylePreset === 'line-art') {
      optimized += ', ' + coloringTerms.slice(0, 4).join(', ');
    } else {
      optimized += ', ' + coloringTerms.join(', ');
    }

    // Add age-appropriate modifiers
    optimized += ', child-friendly, safe for kids, appropriate content';

    // Remove color-related terms that might interfere
    const removeTerms = ['colorful', 'vibrant colors', 'rainbow', 'bright colors', 'multicolored'];
    removeTerms.forEach(term => {
      optimized = optimized.replace(new RegExp(term, 'gi'), '');
    });

    return optimized.trim();
  }

  // Utility function to convert base64 to blob
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  // Test Google AI connection
  async testConnection(provider: 'imagen' | 'imagen-2' | 'vertex-ai' = 'imagen-2'): Promise<{
    success: boolean;
    provider: string;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testPrompt = 'simple flower outline';
      const result = await this.generateImage(testPrompt, provider, {
        aspectRatio: '1:1',
        guidanceScale: 5.0
      });
      
      const responseTime = Date.now() - startTime;
      
      if (result.success) {
        // Clean up test image
        if (result.imageUrl) {
          URL.revokeObjectURL(result.imageUrl);
        }
        
        return {
          success: true,
          provider,
          responseTime
        };
      } else {
        return {
          success: false,
          provider,
          error: result.error,
          responseTime
        };
      }
    } catch (error) {
      return {
        success: false,
        provider,
        error: error instanceof Error ? error.message : 'Connection test failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  // Get available models/providers
  getAvailableProviders(): Array<{
    id: 'imagen' | 'imagen-2' | 'vertex-ai';
    name: string;
    description: string;
    features: string[];
    recommended?: boolean;
  }> {
    return [
      {
        id: 'imagen',
        name: 'Google Imagen',
        description: 'Google\'s original text-to-image model',
        features: ['High quality', 'Fast generation', 'Good for simple images'],
      },
      {
        id: 'imagen-2',
        name: 'Google Imagen 2',
        description: 'Latest version with improved quality and style control',
        features: ['Best quality', 'Style presets', 'Better line art', 'Safety filters'],
        recommended: true
      },
      {
        id: 'vertex-ai',
        name: 'Google Vertex AI',
        description: 'Enterprise-grade AI with advanced safety features',
        features: ['Enterprise features', 'Advanced safety', 'Custom models', 'Scalable'],
      }
    ];
  }

  // Batch generation for multiple images
  async generateBatch(
    prompts: string[],
    provider: 'imagen' | 'imagen-2' | 'vertex-ai' = 'imagen-2',
    options: GoogleImageGenOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<GoogleImageResponse[]> {
    const results: GoogleImageResponse[] = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const result = await this.generateImage(prompts[i], provider, {
        ...options,
        seed: options.seed ? options.seed + i : undefined // Vary seed for different results
      });
      
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, prompts.length);
      }
      
      // Add delay to respect rate limits
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }
    
    return results;
  }

  // Get usage information
  getUsageInfo(): {
    configured: boolean;
    provider: string;
    features: string[];
    requirements: string[];
  } {
    return {
      configured: !!(this.apiKey && this.projectId),
      provider: 'Google AI (Imagen/Vertex)',
      features: [
        'High-quality image generation',
        'Multiple model options',
        'Style presets for line art',
        'Advanced safety filters',
        'Batch generation support',
        'Enterprise-grade reliability'
      ],
      requirements: [
        'Google Cloud Project ID',
        'Google AI Platform API Key or Service Account',
        'Vertex AI API enabled',
        'Billing account configured'
      ]
    };
  }
}

export const googleImagesAI = new GoogleImagesAIService();
export default googleImagesAI;
