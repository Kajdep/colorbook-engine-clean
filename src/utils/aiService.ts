import { APISettings, StoryData } from '../types';
import { sleep } from './helpers';
import { googleImagesAI } from './googleImagesAI';

export interface StoryGenerationParams {
  theme: string;
  characters: string;
  ageMin: number;
  ageMax: number;
  isAdult: boolean;
  numPages: number;
  wordsPerPage: number;
  imageStyle: string;
  lineWeight: number;
  aspectRatio: string;
  moral?: string;
  generalInstructions?: string;
}

export class AIService {
  protected apiSettings: APISettings;

  constructor(apiSettings: APISettings) {
    this.apiSettings = apiSettings;
  }

  async generateStoryWithImagePrompts(params: StoryGenerationParams): Promise<StoryData> {
    if (!this.apiSettings.apiKey) {
      throw new Error('API key not configured');
    }

    const ageGroup = params.isAdult ? 'adults' : `children aged ${params.ageMin}-${params.ageMax} years`;
    const totalWords = params.numPages * params.wordsPerPage;
    
    const aspectRatioMap: { [key: string]: string } = {
      'square': '1:1',
      'landscape': '4:3', 
      'portrait': '3:4',
      'wide': '16:9'
    };
    
    const lineWeightDesc: { [key: number]: string } = {
      1: 'very thin, delicate lines',
      2: 'thin lines', 
      3: 'light-medium lines',
      4: 'medium lines',
      5: 'medium-thick lines',
      6: 'thick lines',
      7: 'very thick lines',
      8: 'bold thick lines',
      9: 'extra bold lines',
      10: 'maximum thickness lines'
    };
    
    const prompt = `Create a ${params.numPages}-page children's coloring book story with accompanying image prompts. 

🎯 STORY SPECIFICATIONS:
- Target Audience: ${ageGroup}
- Theme: ${params.theme}
- Main Characters: ${params.characters}
- Total Pages: ${params.numPages}
- Words per Page: approximately ${params.wordsPerPage} words
- Total Story Length: approximately ${totalWords} words
- Moral/Lesson: ${params.moral || 'friendship and positive values'}

📝 STORY REQUIREMENTS:
- Write exactly ${params.numPages} pages
- Each page should be approximately ${params.wordsPerPage} words
- Use engaging, age-appropriate language for ${ageGroup}
- Each page should describe a scene perfect for illustration
- Include character development and interaction
- Build to the moral/lesson naturally
- Make each page complete but part of the larger story

🎨 IMAGE PROMPT REQUIREMENTS:
For each page, create a detailed image prompt for generating a perfect coloring page:
- Style: ${params.imageStyle} style
- Aspect ratio: ${aspectRatioMap[params.aspectRatio]}
- Line weight: ${lineWeightDesc[params.lineWeight]} (${params.lineWeight}/10)
- Black and white outlines only, suitable for coloring
- Clear, distinct areas for coloring
- Age-appropriate complexity for ${ageGroup}
- Include all characters and scene elements from the story text
- Specify "coloring book style", "black outlines", "no shading", "white background"

📋 OUTPUT FORMAT:
Structure your response EXACTLY like this:

PAGE 1:
STORY: [Write engaging story text for page 1 - approximately ${params.wordsPerPage} words describing the scene and action]

IMAGE_PROMPT: [Detailed prompt for AI image generation - specify: "${params.imageStyle} style coloring book illustration, ${aspectRatioMap[params.aspectRatio]} aspect ratio, ${lineWeightDesc[params.lineWeight]}, black and white outlines, no shading, white background, showing [describe the exact scene from the story with characters and setting], suitable for coloring, clear distinct areas"]

PAGE 2:
STORY: [Continue the story for page 2 - approximately ${params.wordsPerPage} words]

IMAGE_PROMPT: [Detailed image prompt for page 2 following same format]

[Continue for all ${params.numPages} pages...]

IMPORTANT: Each IMAGE_PROMPT must be detailed enough to generate a proper coloring page that matches the story content exactly.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiSettings.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ColorBook Engine'
        },
        body: JSON.stringify({
          model: this.apiSettings.aiModel,
          messages: [{
            role: 'system',
            content: 'You are a professional children\'s book author and illustrator who creates engaging stories paired with perfect coloring book image prompts. You always follow the exact format requested and create age-appropriate content that pairs perfectly with illustrations.'
          }, {
            role: 'user',
            content: prompt
          }],
          temperature: 0.8,
          max_tokens: Math.max(2000, params.numPages * 200)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseStoryWithImagePrompts(data.choices[0].message.content, params);
    } catch (error) {
      console.error('Story generation error:', error);
      throw error;
    }
  }

  private parseStoryWithImagePrompts(content: string, params: StoryGenerationParams): StoryData {
    const pages: any[] = [];
    const pageMatches = content.match(/PAGE \d+:([\s\S]*?)(?=PAGE \d+:|$)/g);
    
    if (!pageMatches) {
      throw new Error('Failed to parse story format. Please try again.');
    }
    
    pageMatches.forEach((pageMatch, index) => {
      const storyMatch = pageMatch.match(/STORY:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/);
      const imageMatch = pageMatch.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/);
      
      const storyText = storyMatch ? storyMatch[1].trim() : `Page ${index + 1} story content`;
      const imagePrompt = imageMatch ? imageMatch[1].trim() : `${params.imageStyle} style coloring page for page ${index + 1}`;
      
      pages.push({
        pageNumber: index + 1,
        story: storyText,
        imagePrompt: imagePrompt,
        wordCount: storyText.split(' ').length,
        imageGenerated: false,
        imageData: undefined
      });
    });
    
    return {
      pages: pages,
      metadata: {
        imageStyle: params.imageStyle,
        lineWeight: params.lineWeight,
        aspectRatio: params.aspectRatio,
        totalPages: params.numPages,
        targetWordsPerPage: params.wordsPerPage,
        generatedAt: new Date().toISOString()
      }
    };
  }

  async generateImage(prompt: string): Promise<string> {
    if (this.apiSettings.imageService === 'none' || !this.apiSettings.imageApiKey) {
      return this.generatePlaceholderColoringPage(prompt);
    }

    try {
      switch (this.apiSettings.imageService) {
        case 'openai':
          return await this.generateWithOpenAI(prompt);
        case 'stabilityai':
          return await this.generateWithStabilityAI(prompt);
        case 'replicate':
          return await this.generateWithReplicate(prompt);
        case 'google-imagen':
          return await this.generateWithGoogleImagen(prompt);
        case 'google-imagen2':
          return await this.generateWithGoogleImagen2(prompt);
        case 'google-vertex':
          return await this.generateWithGoogleVertex(prompt);
        default:
          throw new Error('Unsupported image service');
      }
    } catch (error) {
      console.error('Image generation failed, using placeholder:', error);
      return this.generatePlaceholderColoringPage(prompt);
    }
  }

  // Google AI image generation methods
  private async generateWithGoogleImagen(prompt: string): Promise<string> {
    const result = await googleImagesAI.generateImage(prompt, 'imagen', {
      aspectRatio: '1:1',
      stylePreset: 'line-art',
      guidanceScale: 8.0,
      safetyFilter: 'medium'
    });

    if (result.success && result.imageUrl) {
      return result.imageUrl;
    } else {
      throw new Error(result.error || 'Google Imagen generation failed');
    }
  }

  private async generateWithGoogleImagen2(prompt: string): Promise<string> {
    const result = await googleImagesAI.generateImage(prompt, 'imagen-2', {
      aspectRatio: '1:1',
      stylePreset: 'line-art',
      guidanceScale: 8.0,
      safetyFilter: 'medium',
      negativePrompt: 'color, colored, shading, gradient, realistic, photograph'
    });

    if (result.success && result.imageUrl) {
      return result.imageUrl;
    } else {
      throw new Error(result.error || 'Google Imagen 2 generation failed');
    }
  }

  private async generateWithGoogleVertex(prompt: string): Promise<string> {
    const result = await googleImagesAI.generateImage(prompt, 'vertex-ai', {
      aspectRatio: '1:1',
      guidanceScale: 7.5,
      safetyFilter: 'high'
    });

    if (result.success && result.imageUrl) {
      return result.imageUrl;
    } else {
      throw new Error(result.error || 'Google Vertex AI generation failed');
    }
  }

  private async generateWithOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiSettings.imageApiKey}`
      },
      body: JSON.stringify({
        model: this.apiSettings.imageModel,
        prompt: prompt + ' coloring book style, black and white line art, no color, clear outlines',
        n: 1,
        size: '1024x1024',
        style: 'natural'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Failed to generate image'}`);
    }

    const data = await response.json();
    return data.data[0].url;
  }

  private async generateWithStabilityAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiSettings.imageApiKey}`
      },
      body: JSON.stringify({
        text_prompts: [{
          text: prompt + ' coloring book style, black and white line art, no shading, clear outlines for coloring',
          weight: 1
        }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stability AI Error: ${error.message || 'Failed to generate image'}`);
    }

    const data = await response.json();
    return `data:image/png;base64,${data.artifacts[0].base64}`;
  }

  private async generateWithReplicate(prompt: string): Promise<string> {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.apiSettings.imageApiKey}`
      },
      body: JSON.stringify({
        version: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        input: {
          prompt: prompt + ' coloring book style, black and white line art, clear outlines',
          negative_prompt: 'color, shading, gradient, photorealistic'
        }
      })
    });

    if (!response.ok) {
      throw new Error('Replicate API Error');
    }

    const prediction = await response.json();
    
    await sleep(10000);
    
    const resultResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Token ${this.apiSettings.imageApiKey}`
      }
    });

    if (resultResponse.ok) {
      const result = await resultResponse.json();
      return result.output?.[0] || '';
    }
    
    throw new Error('Replicate generation timeout');
  }

  getImageProviders(): Array<{
    id: string;
    name: string;
    description: string;
    models?: string[];
    requirements: string[];
  }> {
    return [
      {
        id: 'openai',
        name: 'OpenAI DALL-E',
        description: 'High-quality image generation with excellent instruction following',
        models: ['dall-e-3', 'dall-e-2'],
        requirements: ['OpenAI API Key', 'Pay-per-use billing']
      },
      {
        id: 'stabilityai',
        name: 'Stability AI',
        description: 'Stable Diffusion models for creative image generation',
        models: ['stable-diffusion-xl-1024-v1-0'],
        requirements: ['Stability AI API Key', 'Credits-based billing']
      },
      {
        id: 'replicate',
        name: 'Replicate',
        description: 'Access to various open-source image generation models',
        models: ['SDXL', 'Flux', 'Various community models'],
        requirements: ['Replicate API Token', 'Pay-per-run billing']
      },
      {
        id: 'google-imagen',
        name: 'Google Imagen',
        description: 'Google\'s text-to-image model with high quality output',
        models: ['imagen'],
        requirements: ['Google Cloud Project', 'Vertex AI API enabled', 'Service Account']
      },
      {
        id: 'google-imagen2',
        name: 'Google Imagen 2',
        description: 'Latest Google image model with improved quality and safety',
        models: ['imagen-3.0-generate-001'],
        requirements: ['Google Cloud Project', 'Vertex AI API enabled', 'Service Account']
      },
      {
        id: 'google-vertex',
        name: 'Google Vertex AI',
        description: 'Enterprise-grade AI with advanced safety and custom models',
        models: ['gemini-pro-vision'],
        requirements: ['Google Cloud Project', 'Vertex AI API enabled', 'Service Account']
      }
    ];
  }

  private generatePlaceholderColoringPage(prompt: string): string {
    const subjects = {
      'rabbit': { emoji: '🐰', paths: this.generateRabbitPaths() },
      'cat': { emoji: '🐱', paths: this.generateCatPaths() },
      'flower': { emoji: '🌸', paths: this.generateFlowerPaths() },
      'tree': { emoji: '🌳', paths: this.generateTreePaths() },
      'house': { emoji: '🏠', paths: this.generateHousePaths() },
      'butterfly': { emoji: '🦋', paths: this.generateButterflyPaths() },
      'star': { emoji: '⭐', paths: this.generateStarPaths() },
      'heart': { emoji: '❤️', paths: this.generateHeartPaths() },
      'bird': { emoji: '🐦', paths: this.generateBirdPaths() },
      'fish': { emoji: '🐠', paths: this.generateFishPaths() }
    };

    let selectedSubject = { emoji: '🎨', paths: this.generateDefaultPaths() };
    
    for (const [key, data] of Object.entries(subjects)) {
      if (prompt.toLowerCase().includes(key)) {
        selectedSubject = data;
        break;
      }
    }

    return `data:image/svg+xml;base64,${btoa(`
      <svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" style="background: white;">
        <rect width="400" height="300" fill="white"/>
        <rect x="10" y="10" width="380" height="280" fill="none" stroke="#000" stroke-width="2" rx="5"/>
        ${selectedSubject.paths}
        <circle cx="350" cy="50" r="15" fill="none" stroke="#000" stroke-width="2"/>
        <circle cx="50" cy="50" r="15" fill="none" stroke="#000" stroke-width="2"/>
        <circle cx="50" cy="250" r="15" fill="none" stroke="#000" stroke-width="2"/>
        <circle cx="350" cy="250" r="15" fill="none" stroke="#000" stroke-width="2"/>
        <text x="200" y="290" text-anchor="middle" font-size="10" fill="#666" font-family="Arial, sans-serif">
          ${selectedSubject.emoji} Coloring Page - Generated with AI
        </text>
      </svg>
    `)}`;
  }
  
  private generateRabbitPaths(): string {
    return `
      <ellipse cx="200" cy="180" rx="40" ry="60" fill="none" stroke="#000" stroke-width="3"/>
      <ellipse cx="200" cy="120" rx="35" ry="40" fill="none" stroke="#000" stroke-width="3"/>
      <ellipse cx="180" cy="90" rx="8" ry="25" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="220" cy="90" rx="8" ry="25" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="190" cy="115" r="5" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="210" cy="115" r="5" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="200" cy="125" rx="3" ry="2" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="160" cy="190" r="8" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateCatPaths(): string {
    return `
      <ellipse cx="200" cy="180" rx="45" ry="55" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="200" cy="120" r="40" fill="none" stroke="#000" stroke-width="3"/>
      <polygon points="170,90 180,110 160,110" fill="none" stroke="#000" stroke-width="2"/>
      <polygon points="230,90 240,110 220,110" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="185" cy="115" rx="6" ry="8" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="215" cy="115" rx="6" ry="8" fill="none" stroke="#000" stroke-width="2"/>
      <polygon points="200,125 195,130 205,130" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="150" y1="120" x2="175" y2="118" stroke="#000" stroke-width="1"/>
      <line x1="225" y1="118" x2="250" y2="120" stroke="#000" stroke-width="1"/>
      <path d="M 155 200 Q 120 180 110 220 Q 130 240 155 220" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateFlowerPaths(): string {
    return `
      <circle cx="200" cy="150" r="15" fill="none" stroke="#000" stroke-width="3"/>
      <ellipse cx="200" cy="120" rx="12" ry="20" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="230" cy="150" rx="12" ry="20" fill="none" stroke="#000" stroke-width="2" transform="rotate(90 230 150)"/>
      <ellipse cx="200" cy="180" rx="12" ry="20" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="170" cy="150" rx="12" ry="20" fill="none" stroke="#000" stroke-width="2" transform="rotate(90 170 150)"/>
      <line x1="200" y1="180" x2="200" y2="250" stroke="#000" stroke-width="3"/>
      <ellipse cx="180" cy="210" rx="8" ry="15" fill="none" stroke="#000" stroke-width="2" transform="rotate(-30 180 210)"/>
      <ellipse cx="220" cy="220" rx="8" ry="15" fill="none" stroke="#000" stroke-width="2" transform="rotate(30 220 220)"/>
    `;
  }
  
  private generateTreePaths(): string {
    return `
      <rect x="185" y="200" width="30" height="60" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="200" cy="140" r="50" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="170" cy="120" r="25" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="230" cy="120" r="25" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="160" cy="160" r="20" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="240" cy="160" r="20" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateHousePaths(): string {
    return `
      <rect x="150" y="160" width="100" height="80" fill="none" stroke="#000" stroke-width="3"/>
      <polygon points="140,160 200,100 260,160" fill="none" stroke="#000" stroke-width="3"/>
      <rect x="180" y="200" width="20" height="40" fill="none" stroke="#000" stroke-width="2"/>
      <rect x="160" y="180" width="15" height="15" fill="none" stroke="#000" stroke-width="2"/>
      <rect x="220" y="180" width="15" height="15" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="195" cy="220" r="2" fill="none" stroke="#000" stroke-width="1"/>
      <rect x="220" y="120" width="15" height="30" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateButterflyPaths(): string {
    return `
      <ellipse cx="200" cy="150" rx="3" ry="40" fill="none" stroke="#000" stroke-width="3"/>
      <ellipse cx="170" cy="130" rx="25" ry="35" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="230" cy="130" rx="25" ry="35" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="175" cy="170" rx="20" ry="25" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="225" cy="170" rx="20" ry="25" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="170" cy="125" r="8" fill="none" stroke="#000" stroke-width="1"/>
      <circle cx="230" cy="125" r="8" fill="none" stroke="#000" stroke-width="1"/>
      <line x1="195" y1="115" x2="190" y2="105" stroke="#000" stroke-width="2"/>
      <line x1="205" y1="115" x2="210" y2="105" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateStarPaths(): string {
    return `
      <path d="M 200 80 L 210 120 L 250 120 L 220 145 L 230 185 L 200 165 L 170 185 L 180 145 L 150 120 L 190 120 Z" 
            fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="200" cy="140" r="20" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateHeartPaths(): string {
    return `
      <path d="M 200 200 C 200 180, 170 150, 150 170 C 130 190, 130 210, 150 230 C 170 250, 200 270, 200 270 C 200 270, 230 250, 250 230 C 270 210, 270 190, 250 170 C 230 150, 200 180, 200 200 Z" 
            fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="180" cy="180" r="8" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="220" cy="180" r="8" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateBirdPaths(): string {
    return `
      <ellipse cx="200" cy="160" rx="30" ry="45" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="200" cy="120" r="25" fill="none" stroke="#000" stroke-width="3"/>
      <polygon points="175,120 165,125 175,130" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="190" cy="115" r="5" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="220" cy="150" rx="15" ry="30" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="190" y1="205" x2="185" y2="220" stroke="#000" stroke-width="2"/>
      <line x1="210" y1="205" x2="215" y2="220" stroke="#000" stroke-width="2"/>
    `;
  }
  
  private generateFishPaths(): string {
    return `
      <ellipse cx="200" cy="150" rx="50" ry="25" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="160" cy="150" r="20" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="155" cy="145" r="6" fill="none" stroke="#000" stroke-width="2"/>
      <polygon points="250,150 280,130 290,150 280,170" fill="none" stroke="#000" stroke-width="2"/>
      <ellipse cx="190" cy="130" rx="8" ry="15" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="180" cy="145" r="4" fill="none" stroke="#000" stroke-width="1"/>
      <circle cx="200" cy="140" r="4" fill="none" stroke="#000" stroke-width="1"/>
      <circle cx="220" cy="150" r="4" fill="none" stroke="#000" stroke-width="1"/>
    `;
  }
  
  private generateDefaultPaths(): string {
    return `
      <circle cx="200" cy="150" r="60" fill="none" stroke="#000" stroke-width="3"/>
      <circle cx="200" cy="150" r="40" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="200" cy="150" r="20" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="170" cy="120" r="10" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="230" cy="120" r="10" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="170" cy="180" r="10" fill="none" stroke="#000" stroke-width="2"/>
      <circle cx="230" cy="180" r="10" fill="none" stroke="#000" stroke-width="2"/>
    `;
  }

  async generateSimpleText(prompt: string): Promise<string> {
    if (!this.apiSettings.apiKey) {
      throw new Error('API key not configured');
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiSettings.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Coloring Book Engine'
        },
        body: JSON.stringify({
          model: this.apiSettings.aiModel || 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Simple text generation error:', error);
      throw error;
    }
  }
}