// The concrete AI providers are handled by AIService. Importing the
// class here avoids build errors if individual providers are missing.
import { AIService } from './aiService';

// Placeholder service instance. Real settings will be provided by
// the application when used.
const aiService = new AIService({ apiKey: '', aiModel: '', imageService: 'none', imageApiKey: '', imageModel: '' });

// Simple wrapper objects used by the legacy code paths below. They delegate to
// the generic AIService instance so TypeScript doesn't complain about missing
// exports.
const wrap = async (prompt: string) => ({
  success: true,
  imageUrl: await aiService.generateImage(prompt),
  error: undefined as string | undefined
});
const openai = { generateImage: wrap };
const stabilityAI = { generateImage: wrap };
const replicate = { generateImage: wrap };

interface CharacterReference {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  stylePrompt: string;
  consistencyPrompts: string[];
  createdAt: Date;
}

interface StyleProfile {
  id: string;
  name: string;
  description: string;
  basePrompt: string;
  modifiers: string[];
  examples: string[];
}

class AdvancedAIService {
  private characterReferences: Map<string, CharacterReference> = new Map();
  private styleProfiles: Map<string, StyleProfile> = new Map();

  constructor() {
    this.initializeDefaultStyles();
    this.loadFromStorage();
  }

  private initializeDefaultStyles() {
    const defaultStyles: StyleProfile[] = [
      {
        id: 'cute-simple',
        name: 'Cute & Simple',
        description: 'Clean, minimal designs perfect for young children',
        basePrompt: 'cute, simple, clean lines, minimal detail, child-friendly',
        modifiers: ['thick outlines', 'large features', 'rounded shapes'],
        examples: ['simple flower', 'basic animal', 'geometric shape']
      },
      {
        id: 'detailed-intricate',
        name: 'Detailed & Intricate',
        description: 'Complex patterns for advanced colorers',
        basePrompt: 'detailed, intricate, complex patterns, fine lines',
        modifiers: ['mandala-style', 'ornate details', 'zentangle elements'],
        examples: ['detailed butterfly', 'ornate flower', 'complex mandala']
      },
      {
        id: 'cartoon-style',
        name: 'Cartoon Style',
        description: 'Fun, animated character style',
        basePrompt: 'cartoon style, animated, expressive, fun',
        modifiers: ['big eyes', 'exaggerated features', 'playful poses'],
        examples: ['cartoon animal', 'character face', 'action pose']
      }
    ];

    defaultStyles.forEach(style => {
      this.styleProfiles.set(style.id, style);
    });
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('advancedAI_data');
      if (stored) {
        const data = JSON.parse(stored);
        
        if (data.characters) {
          data.characters.forEach((char: any) => {
            this.characterReferences.set(char.id, {
              ...char,
              createdAt: new Date(char.createdAt)
            });
          });
        }

        if (data.styles) {
          data.styles.forEach((style: any) => {
            this.styleProfiles.set(style.id, style);
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load advanced AI data from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        characters: Array.from(this.characterReferences.values()),
        styles: Array.from(this.styleProfiles.values())
      };
      localStorage.setItem('advancedAI_data', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save advanced AI data to storage:', error);
    }
  }

  // Character Reference Management
  createCharacterReference(name: string, description: string, stylePrompt: string): CharacterReference {
    const character: CharacterReference = {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      description,
      stylePrompt,
      consistencyPrompts: [
        `${name}, ${description}`,
        `character: ${name}`,
        `consistent with previous images of ${name}`
      ],
      createdAt: new Date()
    };

    this.characterReferences.set(character.id, character);
    this.saveToStorage();
    return character;
  }

  getCharacterReference(id: string): CharacterReference | undefined {
    return this.characterReferences.get(id);
  }

  getAllCharacterReferences(): CharacterReference[] {
    return Array.from(this.characterReferences.values());
  }

  updateCharacterReference(id: string, updates: Partial<CharacterReference>): boolean {
    const character = this.characterReferences.get(id);
    if (character) {
      Object.assign(character, updates);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  deleteCharacterReference(id: string): boolean {
    const deleted = this.characterReferences.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  // Style Consistency
  generateConsistentPrompt(basePrompt: string, characterIds: string[] = [], styleId?: string): string {
    let enhancedPrompt = basePrompt;

    // Add character consistency
    characterIds.forEach(charId => {
      const character = this.characterReferences.get(charId);
      if (character) {
        enhancedPrompt = `${enhancedPrompt}, featuring ${character.consistencyPrompts[0]}, ${character.stylePrompt}`;
      }
    });

    // Add style consistency
    if (styleId) {
      const style = this.styleProfiles.get(styleId);
      if (style) {
        enhancedPrompt = `${enhancedPrompt}, ${style.basePrompt}, ${style.modifiers.join(', ')}`;
      }
    }

    // Add general consistency modifiers
    enhancedPrompt += ', consistent art style, matching character design, coherent visual theme';

    return enhancedPrompt;
  }

  // Enhanced Image Generation with Consistency
  async generateConsistentImage(
    basePrompt: string,
    options: {
      characterIds?: string[];
      styleId?: string;
      previousImageStyle?: string;
      seed?: number;
      provider?: 'openai' | 'stability' | 'replicate';
    } = {}
  ): Promise<{ success: boolean; imageUrl?: string; error?: string; metadata?: any }> {
    try {
      const consistentPrompt = this.generateConsistentPrompt(
        basePrompt,
        options.characterIds,
        options.styleId
      );

      // Add style consistency from previous images
      let finalPrompt = consistentPrompt;
      if (options.previousImageStyle) {
        finalPrompt += `, maintaining the same style as: ${options.previousImageStyle}`;
      }

      // Add coloring book specific enhancements
      finalPrompt += ', black and white line art, coloring book page, clean outlines, white background';

      const provider = options.provider || 'openai';
      let result;

      switch (provider) {
        case 'openai':
          result = await openai.generateImage(finalPrompt);
          break;
        case 'stability':
          result = await stabilityAI.generateImage(finalPrompt);
          break;
        case 'replicate':
          result = await replicate.generateImage(finalPrompt);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      if (result.success) {
        // Store metadata for future consistency
        const metadata = {
          prompt: finalPrompt,
          characters: options.characterIds,
          style: options.styleId,
          seed: options.seed,
          provider,
          timestamp: new Date().toISOString()
        };

        return {
          success: true,
          imageUrl: result.imageUrl,
          metadata
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Style Transfer
  async transferStyle(
    targetPrompt: string,
    styleId?: string
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    try {
      let stylePrompt = targetPrompt;
      
      if (styleId) {
        const style = this.styleProfiles.get(styleId);
        if (style) {
          stylePrompt = `${targetPrompt}, in the style of: ${style.basePrompt}, ${style.modifiers.join(', ')}`;
        }
      }

      // Use Replicate's style transfer model (example)
      const result = await replicate.generateImage(
        `${stylePrompt}, based on reference image style`
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Style transfer failed'
      };
    }
  }

  // Batch Generation with Consistency
  async generateConsistentBatch(
    prompts: string[],
    options: {
      characterIds?: string[];
      styleId?: string;
      provider?: 'openai' | 'stability' | 'replicate';
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<Array<{ success: boolean; imageUrl?: string; error?: string; metadata?: any }>> {
    const results = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const result = await this.generateConsistentImage(prompts[i], {
        ...options,
        seed: options.provider === 'stability' ? 12345 + i : undefined // Use consistent seed for Stability AI
      });
      
      results.push(result);
      
      if (options.onProgress) {
        options.onProgress(i + 1, prompts.length);
      }

      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  // Smart Prompt Enhancement
  enhancePromptForColoring(basePrompt: string, ageRange: [number, number]): string {
    let enhanced = basePrompt;

    // Age-appropriate complexity
    if (ageRange[1] <= 6) {
      enhanced += ', very simple, large shapes, thick lines, minimal detail';
    } else if (ageRange[1] <= 10) {
      enhanced += ', moderately detailed, clear outlines, age-appropriate complexity';
    } else {
      enhanced += ', detailed, intricate patterns, fine lines, complex design';
    }

    // Coloring book optimization
    enhanced += ', black and white line art, coloring book style, clean outlines, no shading, white background';

    return enhanced;
  }

  // Style Profile Management
  createStyleProfile(name: string, description: string, basePrompt: string, modifiers: string[]): StyleProfile {
    const style: StyleProfile = {
      id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      description,
      basePrompt,
      modifiers,
      examples: []
    };

    this.styleProfiles.set(style.id, style);
    this.saveToStorage();
    return style;
  }

  getStyleProfile(id: string): StyleProfile | undefined {
    return this.styleProfiles.get(id);
  }

  getAllStyleProfiles(): StyleProfile[] {
    return Array.from(this.styleProfiles.values());
  }

  // Quality Analysis
  analyzeImageQuality(): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    // This would integrate with an image analysis service
    return Promise.resolve({
      score: 85,
      issues: ['Background not completely white', 'Some lines too thin'],
      suggestions: ['Increase contrast', 'Thicken outline strokes']
    });
  }

  // Auto-Translation Support
  async translatePrompt(prompt: string, targetLanguage: string): Promise<string> {
    // This would integrate with a translation service
    // For now, return the original prompt with a note
    return `${prompt} (language: ${targetLanguage})`;
  }
}

export const advancedAI = new AdvancedAIService();
export default advancedAI;
