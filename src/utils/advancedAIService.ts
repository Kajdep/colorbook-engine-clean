import { APISettings, StoryData } from '../types';
import { AIService } from './aiService';

interface CharacterReference {
  name: string;
  description: string;
  physicalTraits: string[];
  personalityTraits: string[];
  clothing: string;
  accessories: string[];
  colorScheme: string[];
  age?: string;
  species?: string;
}

interface StyleConsistencySettings {
  artStyle: string;
  colorPalette: string[];
  lineWeight: number;
  shadingStyle: 'none' | 'minimal' | 'detailed';
  backgroundStyle: 'simple' | 'detailed' | 'minimal';
  perspective: 'front' | 'side' | '3quarter' | 'varied';
}

interface ContentOptimization {
  targetAge: number;
  difficulty: 'easy' | 'medium' | 'hard';
  themes: string[];
  educationalGoals: string[];
  culturalSensitivity: boolean;
  inclusivity: boolean;
}

interface MarketAnalysis {
  trendingTopics: string[];
  seasonalThemes: string[];
  popularCharacterTypes: string[];
  competitorAnalysis: {
    topPerformers: string[];
    gaps: string[];
    opportunities: string[];
  };
  demographics: {
    primaryAge: string;
    secondaryAge: string;
    interests: string[];
  };
}

export class AdvancedAIService extends AIService {
  private characterReferences: Map<string, CharacterReference> = new Map();
  private styleSettings: StyleConsistencySettings;
  private contentOptimization: ContentOptimization;

  constructor(apiSettings: APISettings) {
    super(apiSettings);
    this.styleSettings = this.getDefaultStyleSettings();
    this.contentOptimization = this.getDefaultContentOptimization();
  }

  // ===== CHARACTER CONSISTENCY SYSTEM =====
  
  public createCharacterReference(character: Omit<CharacterReference, 'name'>, name: string): CharacterReference {
    const reference: CharacterReference = {
      name,
      ...character
    };
    
    this.characterReferences.set(name.toLowerCase(), reference);
    return reference;
  }

  public getCharacterReference(name: string): CharacterReference | undefined {
    return this.characterReferences.get(name.toLowerCase());
  }

  public async generateCharacterSheet(characterName: string, basicDescription: string): Promise<CharacterReference> {
    const prompt = `Create a detailed character reference sheet for a coloring book character:

Character Name: ${characterName}
Basic Description: ${basicDescription}

Please provide:
1. Detailed physical description (height, build, facial features, hair, etc.)
2. Clothing style and typical outfit
3. Accessories they commonly wear
4. Color scheme (2-4 main colors that represent this character)
5. Personality traits that would show in their expressions/poses
6. Age range and species (if not human)

Format as JSON with these fields:
{
  "physicalTraits": ["trait1", "trait2", ...],
  "personalityTraits": ["trait1", "trait2", ...],
  "clothing": "description",
  "accessories": ["item1", "item2", ...],
  "colorScheme": ["#color1", "#color2", ...],
  "age": "age range",
  "species": "human/animal/fantasy",
  "description": "comprehensive visual description"
}`;

    const data = await this.generateStructuredContent<any>(prompt);
    const reference = this.createCharacterReference(data, characterName);
    return reference;
  }

  // ===== STYLE CONSISTENCY SYSTEM =====
  
  public setStyleSettings(settings: Partial<StyleConsistencySettings>) {
    this.styleSettings = { ...this.styleSettings, ...settings };
  }

  public generateStyleConsistentPrompt(basePrompt: string, pageNumber: number): string {
    let enhancedPrompt = basePrompt;

    // Add style consistency instructions
    enhancedPrompt += ` [STYLE CONSISTENCY: ${this.styleSettings.artStyle} art style, `;
    enhancedPrompt += `line weight ${this.styleSettings.lineWeight}/10, `;
    enhancedPrompt += `${this.styleSettings.shadingStyle} shading, `;
    enhancedPrompt += `${this.styleSettings.backgroundStyle} background]`;

    // Add character consistency
    const charactersInPrompt = this.extractCharacterNames(basePrompt);
    charactersInPrompt.forEach(charName => {
      const reference = this.getCharacterReference(charName);
      if (reference) {
        enhancedPrompt += ` [CHARACTER: ${charName} - ${reference.description}, `;
        enhancedPrompt += `wearing ${reference.clothing}, `;
        enhancedPrompt += `colors: ${reference.colorScheme.join(', ')}, `;
        enhancedPrompt += `traits: ${reference.physicalTraits.join(', ')}]`;
      }
    });

    // Add page-specific consistency
    enhancedPrompt += ` [PAGE ${pageNumber}: maintain visual continuity with previous pages, `;
    enhancedPrompt += `consistent character proportions and style elements]`;

    return enhancedPrompt;
  }

  // ===== CONTENT OPTIMIZATION =====
  
  public setContentOptimization(optimization: Partial<ContentOptimization>) {
    this.contentOptimization = { ...this.contentOptimization, ...optimization };
  }

  public async optimizeStoryContent(story: StoryData): Promise<StoryData> {
    const optimizationPrompt = `Optimize this coloring book story for the target audience and goals:

Target Age: ${this.contentOptimization.targetAge}
Difficulty: ${this.contentOptimization.difficulty}
Themes: ${this.contentOptimization.themes.join(', ')}
Educational Goals: ${this.contentOptimization.educationalGoals.join(', ')}
Cultural Sensitivity: ${this.contentOptimization.culturalSensitivity}
Inclusivity: ${this.contentOptimization.inclusivity}

Current Story:
${story.pages.map((page, i) => `Page ${i + 1}: ${page.story}`).join('\n\n')}

Please optimize for:
1. Age-appropriate language and concepts
2. Educational value aligned with goals
3. Cultural sensitivity and inclusivity
4. Appropriate difficulty level
5. Engaging narrative structure

Return the optimized story in the same format.`;

    const optimizedContent = await this.generateStructuredContent<any>(optimizationPrompt);
    
    // Apply optimizations to the story
    const optimizedStory: StoryData = {
      ...story,
      pages: story.pages.map((page, index) => ({
        ...page,
        story: optimizedContent.pages?.[index]?.story || page.story,
        imagePrompt: this.optimizeImagePrompt(page.imagePrompt, this.contentOptimization)
      }))
    };

    return optimizedStory;
  }

  // ===== MARKET ANALYSIS =====
  
  public async analyzeMarketTrends(): Promise<MarketAnalysis> {
    const prompt = `Analyze current market trends for children's coloring books in 2024-2025:

1. What are the trending topics and themes?
2. What seasonal themes are popular?
3. What character types are most successful?
4. Analyze top performers and identify market gaps
5. What are the primary and secondary age demographics?
6. What interests and preferences drive purchases?

Format as JSON:
{
  "trendingTopics": ["topic1", "topic2", ...],
  "seasonalThemes": ["theme1", "theme2", ...],
  "popularCharacterTypes": ["type1", "type2", ...],
  "competitorAnalysis": {
    "topPerformers": ["performer1", "performer2", ...],
    "gaps": ["gap1", "gap2", ...],
    "opportunities": ["opportunity1", "opportunity2", ...]
  },
  "demographics": {
    "primaryAge": "age range",
    "secondaryAge": "age range", 
    "interests": ["interest1", "interest2", ...]
  }
}`;

    return this.generateStructuredContent<MarketAnalysis>(prompt);
  }

  public async generateMarketOptimizedContent(marketAnalysis: MarketAnalysis, baseTheme: string): Promise<{
    optimizedTheme: string;
    characters: string[];
    storyline: string;
    marketingPoints: string[];
  }> {
    const prompt = `Based on this market analysis, optimize a coloring book concept:

Market Trends: ${marketAnalysis.trendingTopics.join(', ')}
Popular Characters: ${marketAnalysis.popularCharacterTypes.join(', ')}
Target Demographics: ${marketAnalysis.demographics.primaryAge}
Interests: ${marketAnalysis.demographics.interests.join(', ')}

Base Theme: ${baseTheme}

Create an optimized concept that:
1. Incorporates trending elements
2. Appeals to target demographics
3. Fills identified market gaps
4. Has strong commercial potential

Return JSON format:
{
  "optimizedTheme": "enhanced theme description",
  "characters": ["character1", "character2", ...],
  "storyline": "compelling storyline summary",
  "marketingPoints": ["point1", "point2", ...]
}`;

    return this.generateStructuredContent<any>(prompt);
  }

  // ===== AUTO-TRANSLATION SYSTEM =====
  
  public async translateStory(story: StoryData, targetLanguage: string): Promise<StoryData> {
    const translationPrompt = `Translate this coloring book story to ${targetLanguage}, maintaining:
1. Age-appropriate language
2. Cultural sensitivity
3. Rhyme and rhythm where applicable
4. Educational value
5. Character names consistency

Story to translate:
${story.pages.map((page, i) => `Page ${i + 1}: ${page.story}`).join('\n\n')}

Return translated story maintaining the same structure and page count.`;

    const translatedContent = await this.generateStructuredContent<any>(translationPrompt);
    
    const translatedStory: StoryData = {
      ...story,
      metadata: {
        ...story.metadata,
        language: targetLanguage,
        originalLanguage: 'en'
      },
      pages: story.pages.map((page, index) => ({
        ...page,
        story: translatedContent.pages?.[index]?.story || page.story,
        // Keep original image prompts as they work across languages
        imagePrompt: page.imagePrompt
      }))
    };

    return translatedStory;
  }

  // ===== QUALITY ASSURANCE =====
  
  public async validateContentQuality(story: StoryData): Promise<{
    score: number;
    issues: Array<{
      type: 'grammar' | 'consistency' | 'age-appropriateness' | 'educational' | 'technical';
      severity: 'low' | 'medium' | 'high';
      message: string;
      suggestion: string;
      pageNumber?: number;
    }>;
    recommendations: string[];
  }> {
    const validationPrompt = `Analyze this coloring book story for quality issues:

${story.pages.map((page, i) => `Page ${i + 1}: ${page.story}`).join('\n\n')}

Check for:
1. Grammar and spelling errors
2. Character consistency across pages
3. Age-appropriate content
4. Educational value
5. Technical issues (word count, complexity)
6. Narrative flow and engagement

Rate overall quality 1-100 and identify specific issues with suggestions for improvement.

Return JSON format:
{
  "score": number,
  "issues": [
    {
      "type": "issue type",
      "severity": "low/medium/high",
      "message": "description of issue",
      "suggestion": "how to fix",
      "pageNumber": number (if applicable)
    }
  ],
  "recommendations": ["recommendation1", "recommendation2", ...]
}`;

    return this.generateStructuredContent<any>(validationPrompt);
  }

  // ===== SMART EDITING SUGGESTIONS =====
  
  public async generateEditingSuggestions(pageText: string, pageNumber: number, fullStory: StoryData): Promise<{
    suggestions: Array<{
      type: 'improve' | 'fix' | 'enhance' | 'alternative';
      originalText: string;
      suggestedText: string;
      reason: string;
      confidence: number;
    }>;
    alternativeVersions: string[];
  }> {
    const editingPrompt = `Analyze this page from a coloring book story and suggest improvements:

Page ${pageNumber}: "${pageText}"

Context from full story:
${fullStory.pages.map((page, i) => `Page ${i + 1}: ${page.story.substring(0, 100)}...`).join('\n')}

Provide:
1. Specific text improvements (grammar, flow, engagement)
2. Fixes for any issues
3. Enhancements for better age-appropriateness
4. 2-3 alternative versions of the entire page

Consider: story flow, character consistency, educational value, and engagement.

Return JSON format:
{
  "suggestions": [
    {
      "type": "improve/fix/enhance/alternative",
      "originalText": "text to change",
      "suggestedText": "improved text",
      "reason": "why this is better",
      "confidence": 0.0-1.0
    }
  ],
  "alternativeVersions": ["version1", "version2", "version3"]
}`;

    return this.generateStructuredContent<any>(editingPrompt);
  }

  // ===== HELPER METHODS =====
  
  private extractCharacterNames(text: string): string[] {
    const characters: string[] = [];
    this.characterReferences.forEach((_, name) => {
      if (text.toLowerCase().includes(name)) {
        characters.push(name);
      }
    });
    return characters;
  }

  private optimizeImagePrompt(prompt: string, optimization: ContentOptimization): string {
    let optimizedPrompt = prompt;
    
    // Add age-appropriate complexity
    switch (optimization.difficulty) {
      case 'easy':
        optimizedPrompt += ', simple shapes, clear outlines, minimal details';
        break;
      case 'medium':
        optimizedPrompt += ', moderate detail, balanced complexity';
        break;
      case 'hard':
        optimizedPrompt += ', intricate details, complex patterns, advanced coloring';
        break;
    }
    
    // Add inclusivity elements
    if (optimization.inclusivity) {
      optimizedPrompt += ', diverse representation, inclusive imagery';
    }
    
    // Add educational elements
    if (optimization.educationalGoals.length > 0) {
      optimizedPrompt += `, educational elements: ${optimization.educationalGoals.join(', ')}`;
    }
    
    return optimizedPrompt;
  }

  private async generateStructuredContent<T>(prompt: string): Promise<T> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiSettings.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ColorBook Engine Advanced AI'
        },
        body: JSON.stringify({
          model: this.apiSettings.aiModel,
          messages: [{
            role: 'system',
            content: 'You are an expert AI assistant specializing in children\'s book creation, market analysis, and content optimization. Always return properly formatted JSON when requested.'
          }, {
            role: 'user',
            content: prompt
          }],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse JSON response
      try {
        return JSON.parse(content);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid JSON response from AI');
      }
    } catch (error) {
      console.error('Advanced AI service error:', error);
      throw error;
    }
  }

  private getDefaultStyleSettings(): StyleConsistencySettings {
    return {
      artStyle: 'cute',
      colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
      lineWeight: 5,
      shadingStyle: 'none',
      backgroundStyle: 'simple',
      perspective: 'varied'
    };
  }

  private getDefaultContentOptimization(): ContentOptimization {
    return {
      targetAge: 6,
      difficulty: 'medium',
      themes: ['friendship', 'adventure', 'learning'],
      educationalGoals: ['creativity', 'fine motor skills', 'imagination'],
      culturalSensitivity: true,
      inclusivity: true
    };
  }

  // ===== PUBLIC API METHODS =====
  
  public async generateAdvancedStory(params: any): Promise<StoryData> {
    // Generate market-optimized story
    const marketAnalysis = await this.analyzeMarketTrends();
    const optimizedConcept = await this.generateMarketOptimizedContent(marketAnalysis, params.theme);
    
    // Generate character references
    const characters = optimizedConcept.characters;
    for (const character of characters) {
      await this.generateCharacterSheet(character, `Character from ${optimizedConcept.optimizedTheme}`);
    }
    
    // Generate base story with enhanced parameters
    const enhancedParams = {
      ...params,
      theme: optimizedConcept.optimizedTheme,
      characters: characters.join(', '),
      marketOptimized: true
    };
    
    const baseStory = await super.generateStoryWithImagePrompts(enhancedParams);
    
    // Apply advanced optimizations
    const optimizedStory = await this.optimizeStoryContent(baseStory);
    
    // Enhance image prompts with style consistency
    const enhancedStory: StoryData = {
      ...optimizedStory,
      pages: optimizedStory.pages.map((page, index) => ({
        ...page,
        imagePrompt: this.generateStyleConsistentPrompt(page.imagePrompt, index + 1)
      })),
      metadata: {
        ...optimizedStory.metadata,
        characterReferences: Array.from(this.characterReferences.values()),
        styleSettings: this.styleSettings,
        marketAnalysis: marketAnalysis,
        optimizationApplied: true
      }
    };
    
    return enhancedStory;
  }
}

export default AdvancedAIService;