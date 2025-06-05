import React, { useState } from 'react';
import { Sparkles, BookOpen, Settings, Wand2, Download, RefreshCw, Edit } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AIService, StoryGenerationParams } from '../utils/aiService';
import { StoryData, StoryPage } from '../types';
import './StoryGenerator.css';

const StoryGenerator: React.FC = () => {
  const { 
    apiSettings, 
    currentProject, 
    currentStory,
    setCurrentStory, 
    addNotification,
    setCurrentSection 
  } = useAppStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<StoryGenerationParams>({
    theme: '',
    characters: '',
    ageMin: 4,
    ageMax: 8,
    isAdult: false,
    numPages: 5,
    wordsPerPage: 50,
    imageStyle: 'cute',
    lineWeight: 5,
    aspectRatio: 'square',
    moral: '',
    generalInstructions: ''
  });

  const handleInputChange = (field: keyof StoryGenerationParams, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const loadTemplate = (templateType: string) => {
    const templates = {
      adventure: {
        theme: 'Epic adventure through magical lands',
        characters: 'Brave knight Sir Luna, wise dragon Ember',
        moral: 'Courage and determination'
      },
      friendship: {
        theme: 'Forest animals working together',
        characters: 'Curious rabbit Pip, gentle bear Bruno, clever fox Sage',
        moral: 'The power of friendship and cooperation'
      },
      fantasy: {
        theme: 'Enchanted kingdom with magical creatures',
        characters: 'Young wizard apprentice Zara, talking unicorn Starlight',
        moral: 'Believing in yourself and using magic responsibly'
      }
    };

    const template = templates[templateType as keyof typeof templates];
    if (template) {
      setFormData(prev => ({
        ...prev,
        theme: template.theme,
        characters: template.characters,
        moral: template.moral
      }));
      addNotification({
        type: 'info',
        message: `Loaded ${templateType} template`
      });
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiSettings.apiKey) {
      addNotification({
        type: 'warning',
        message: 'Please configure your API key in settings first'
      });
      setCurrentSection('api-settings');
      return;
    }

    if (!formData.theme.trim() || !formData.characters.trim()) {
      addNotification({
        type: 'warning',
        message: 'Please fill in theme and characters'
      });
      return;
    }

    setIsGenerating(true);

    try {
      const aiService = new AIService(apiSettings);
      const storyData = await aiService.generateStoryWithImagePrompts(formData);
      
      setCurrentStory(storyData);
      addNotification({
        type: 'success',
        message: `Story with ${storyData.pages.length} pages generated! 🎉`
      });
    } catch (error) {
      console.error('Story generation error:', error);
      addNotification({
        type: 'error',
        message: `Error generating story: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Story editing functions
  const editStoryText = (pageIndex: number, newText: string) => {
    if (!currentStory) return;

    const updatedStory = {
      ...currentStory,
      pages: currentStory.pages.map((page, index) => 
        index === pageIndex 
          ? { 
              ...page, 
              story: newText, 
              wordCount: newText.split(' ').filter(word => word.length > 0).length,
              // Clear generated image since content changed
              imageGenerated: false,
              imageData: undefined
            }
          : page
      )
    };

    setCurrentStory(updatedStory);
    addNotification({
      type: 'success',
      message: `Story text updated for page ${pageIndex + 1}! 📝`
    });
  };

  const editImagePrompt = (pageIndex: number, newPrompt: string) => {
    if (!currentStory) return;

    const updatedStory = {
      ...currentStory,
      pages: currentStory.pages.map((page, index) => 
        index === pageIndex 
          ? { 
              ...page, 
              imagePrompt: newPrompt,
              // Clear generated image since prompt changed
              imageGenerated: false,
              imageData: undefined
            }
          : page
      )
    };

    setCurrentStory(updatedStory);
    addNotification({
      type: 'success',
      message: `Image prompt updated for page ${pageIndex + 1}! 🎨`
    });
  };


  async function generateSingleImage(pageIndex: number) {
    if (!currentStory || !currentStory.pages[pageIndex]) {
      addNotification({
        type: 'error',
        message: 'Invalid page index'
      });
      return;
    }
    
    const page = currentStory.pages[pageIndex];
    
    addNotification({
      type: 'info',
      message: `Generating image for page ${pageIndex + 1}...`
    });
    
    try {
      const aiService = new AIService(apiSettings);
      const imageData = await aiService.generateImage(page.imagePrompt);
      
      // Update the story with the generated image
      const updatedStory = {
        ...currentStory,
        pages: currentStory.pages.map((p, i) => 
          i === pageIndex 
            ? { ...p, imageGenerated: true, imageData }
            : p
        )
      };
      
      setCurrentStory(updatedStory);
      
      addNotification({
        type: 'success',
        message: `Image generated for page ${pageIndex + 1}!`
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  async function regenerateImage(pageIndex: number) {
    if (!currentStory || !currentStory.pages[pageIndex]) return;
    
    const page = currentStory.pages[pageIndex];
    const variations = [
      ' with more detail',
      ' in a different style', 
      ' from a different angle',
      ' with additional elements',
      ' simplified version'
    ];
    
    const variation = variations[Math.floor(Math.random() * variations.length)];
    const modifiedPrompt = page.imagePrompt + variation;
    
    addNotification({
      type: 'info',
      message: `Regenerating image for page ${pageIndex + 1}...`
    });
    
    try {
      const aiService = new AIService(apiSettings);
      const imageData = await aiService.generateImage(modifiedPrompt);
      
      const updatedStory = {
        ...currentStory,
        pages: currentStory.pages.map((p, i) => 
          i === pageIndex 
            ? { ...p, imageGenerated: true, imageData }
            : p
        )
      };
      
      setCurrentStory(updatedStory);
      
      addNotification({
        type: 'success',
        message: `Image regenerated for page ${pageIndex + 1}!`
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to regenerate image: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  async function generateAllImages() {
    if (!currentStory) return;
    
    addNotification({
      type: 'info',
      message: 'Generating all images... This may take a few minutes.'
    });
    
    for (let i = 0; i < currentStory.pages.length; i++) {
      if (!currentStory.pages[i].imageGenerated) {
        await generateSingleImage(i);
        // Add delay between generations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    addNotification({
      type: 'success',
      message: 'All images generated successfully! 🎉'
    });
  }
  
  function exportStory() {
    if (!currentStory) return;
    
    const exportData = {
      title: 'Generated Coloring Book Story',
      generatedAt: new Date().toISOString(),
      metadata: currentStory.metadata,
      pages: currentStory.pages.map(page => ({
        pageNumber: page.pageNumber,
        story: page.story,
        imagePrompt: page.imagePrompt,
        wordCount: page.wordCount,
        hasImage: page.imageGenerated
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `story-${new Date().getTime()}.json`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
    
    addNotification({
      type: 'success',
      message: 'Story exported successfully!'
    });
  }

  return (
    <div className="story-generator">
      <div className="story-generator-header">
        <BookOpen size={32} className="text-blue-600" />
        <div>
          <h1 className="story-generator-title">AI Story Generator</h1>
          <p className="story-generator-subtitle">Create engaging stories with detailed image prompts for coloring pages</p>
        </div>
      </div>

      {!currentProject && (
        <div className="notification-warning">
          <p>
            💡 <strong>Tip:</strong> Create a project first to save your generated stories.
            <button 
              onClick={() => setCurrentSection('projects')}
              className="ml-2 text-yellow-600 underline hover:text-yellow-700"
            >
              Go to Projects
            </button>
          </p>
        </div>
      )}

      <div className="grid-2">
        {/* Story Generation Form */}
        <div className="form-section">
          <h2>Create Your Story</h2>
          
          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Basic Story Info */}
            <div className="space-y-4">
              <div>
                <label htmlFor="story-theme" className="form-label">
                  Story Theme *
                </label>
                <input
                  id="story-theme"
                  type="text"
                  value={formData.theme}
                  onChange={(e) => handleInputChange('theme', e.target.value)}
                  className="form-input"
                  placeholder="e.g., Adventure in the Magical Forest"
                  required
                />
              </div>

              <div>
                <label htmlFor="story-characters" className="form-label">
                  Main Characters *
                </label>
                <input
                  id="story-characters"
                  type="text"
                  value={formData.characters}
                  onChange={(e) => handleInputChange('characters', e.target.value)}
                  className="form-input"
                  placeholder="e.g., Brave rabbit Luna, wise owl Oliver"
                  required
                />
              </div>

              <div>
                <label htmlFor="story-moral" className="form-label">
                  Story Moral/Lesson
                </label>
                <input
                  id="story-moral"
                  type="text"
                  value={formData.moral}
                  onChange={(e) => handleInputChange('moral', e.target.value)}
                  className="form-input"
                  placeholder="e.g., The importance of friendship and helping others"
                />
              </div>

              <div>
                <label htmlFor="story-instructions" className="form-label">
                  General Story Instructions
                </label>
                <textarea
                  id="story-instructions"
                  value={formData.generalInstructions || ''}
                  onChange={(e) => handleInputChange('generalInstructions', e.target.value)}
                  className="form-input"
                  style={{ height: '5rem', resize: 'none' }}
                  placeholder="Additional instructions to guide story generation (e.g., 'Include educational elements about nature', 'Make it rhyme', 'Focus on emotional growth')"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Provide specific guidance for how the AI should approach writing your story
                </p>
              </div>
            </div>

            {/* Age and Pages */}
            <div className="grid-cols-2">
              <div>
                <label className="form-label">
                  Age Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.ageMin}
                    onChange={(e) => handleInputChange('ageMin', parseInt(e.target.value))}
                    className="form-input"
                    min="2"
                    max="12"
                    placeholder="Min"
                    aria-label="Minimum age"
                  />
                  <input
                    type="number"
                    value={formData.ageMax}
                    onChange={(e) => handleInputChange('ageMax', parseInt(e.target.value))}
                    className="form-input"
                    min="2"
                    max="12"
                    placeholder="Max"
                    aria-label="Maximum age"
                  />
                </div>
                <label className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    checked={formData.isAdult}
                    onChange={(e) => handleInputChange('isAdult', e.target.checked)}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm">Adult coloring book</span>
                </label>
              </div>

              <div>
                <label htmlFor="num-pages" className="form-label">
                  Number of Story/Image Page Pairs
                </label>
                <input
                  id="num-pages"
                  type="number"
                  value={formData.numPages}
                  onChange={(e) => handleInputChange('numPages', parseInt(e.target.value))}
                  className="form-input"
                  min="1"
                  max="50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Each pair creates 2 pages: 1 story page + 1 coloring page (e.g., 5 pairs = 10 total pages)
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="words-per-page" className="form-label">
                Words per Page
              </label>
              <input
                id="words-per-page"
                type="number"
                value={formData.wordsPerPage}
                onChange={(e) => handleInputChange('wordsPerPage', parseInt(e.target.value))}
                className="form-input"
                min="20"
                max="200"
              />
            </div>

            {/* Image Style Settings */}
            <div className="grid-cols-3">
              <div>
                <label htmlFor="image-style" className="form-label">
                  Image Style
                </label>
                <select
                  id="image-style"
                  value={formData.imageStyle}
                  onChange={(e) => handleInputChange('imageStyle', e.target.value)}
                  className="form-input"
                >
                  <option value="cute">Cute & Simple</option>
                  <option value="detailed">Detailed & Intricate</option>
                  <option value="cartoon">Cartoon Style</option>
                  <option value="realistic">Realistic</option>
                  <option value="whimsical">Whimsical & Fantasy</option>
                </select>
              </div>

              <div>
                <label htmlFor="line-weight" className="form-label">
                  Line Weight ({formData.lineWeight}/10)
                </label>
                <input
                  id="line-weight"
                  type="range"
                  value={formData.lineWeight}
                  onChange={(e) => handleInputChange('lineWeight', parseInt(e.target.value))}
                  className="w-full"
                  min="1"
                  max="10"
                />
                <div className="text-xs text-gray-500 text-center mt-1">
                  Thin ← → Thick
                </div>
              </div>

              <div>
                <label htmlFor="aspect-ratio" className="form-label">
                  Aspect Ratio
                </label>
                <select
                  id="aspect-ratio"
                  value={formData.aspectRatio}
                  onChange={(e) => handleInputChange('aspectRatio', e.target.value)}
                  className="form-input"
                >
                  <option value="square">Square (1:1)</option>
                  <option value="portrait">Portrait (3:4)</option>
                  <option value="landscape">Landscape (4:3)</option>
                  <option value="wide">Wide (16:9)</option>
                </select>
              </div>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="form-label">
                Quick Templates
              </label>
              <div className="template-buttons">
                <button
                  type="button"
                  onClick={() => loadTemplate('adventure')}
                  className="template-button"
                >
                  🗡️ Adventure
                </button>
                <button
                  type="button"
                  onClick={() => loadTemplate('friendship')}
                  className="template-button green"
                >
                  🤝 Friendship
                </button>
                <button
                  type="button"
                  onClick={() => loadTemplate('fantasy')}
                  className="template-button purple"
                >
                  🦄 Fantasy
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              disabled={isGenerating}
              className="generate-button"
            >
              {isGenerating ? (
                <>
                  <div className="spinner"></div>
                  Generating Story...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate Story with Image Prompts
                </>
              )}
            </button>
          </form>
        </div>

        {/* Generated Story Display */}
        <div className="form-section">
          <div className="flex justify-between items-center mb-6">
            <h2>Generated Story</h2>
            {currentStory && (
              <div className="flex gap-2">
                <button
                  onClick={() => generateAllImages()}
                  className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors flex items-center gap-1"
                >
                  <Sparkles size={14} />
                  Generate All Images
                </button>
                <button
                  onClick={() => exportStory()}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex items-center gap-1"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>
            )}
          </div>
          
          {currentStory ? (
            <StoryDisplay 
              story={currentStory} 
              onGenerateImage={generateSingleImage} 
              onRegenerateImage={regenerateImage}
              onEditStory={editStoryText}
              onEditImagePrompt={editImagePrompt}
            />
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Wand2 size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="mb-2">Generated story will appear here</p>
              <p className="text-sm">Fill out the form and click "Generate" to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* API Configuration Notice */}
      {!apiSettings.apiKey && (
        <div className="notification-info">
          <div className="flex items-start gap-3">
            <Settings className="text-blue-600 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">API Configuration Required</h3>
              <p className="text-blue-800 mb-4">
                To generate AI stories, you need to configure your OpenRouter API key. 
                This enables access to various AI models for story generation.
              </p>
              <button
                onClick={() => setCurrentSection('api-settings')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Configure API Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Story Display Component
interface StoryDisplayProps {
  story: StoryData;
  onGenerateImage: (pageIndex: number) => void;
  onRegenerateImage: (pageIndex: number) => void;
  onEditStory: (pageIndex: number, newText: string) => void;
  onEditImagePrompt: (pageIndex: number, newPrompt: string) => void;
}

const StoryDisplay: React.FC<StoryDisplayProps> = ({ 
  story, 
  onGenerateImage, 
  onRegenerateImage,
  onEditStory,
  onEditImagePrompt 
}) => {
  return (
    <div className="space-y-6">
      {/* Story Overview */}
      <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl p-4 border-2 border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-green-800">📖 Story Generated Successfully!</h3>
            <p className="text-sm text-green-600">
              {story.pages.length} pages • {story.pages.reduce((sum, p) => sum + p.wordCount, 0)} total words • {story.metadata.imageStyle} style
            </p>
          </div>
          <div className="text-2xl">🎉</div>
        </div>
      </div>
      
      {/* Story Pages */}
      <div className="space-y-6">
        {story.pages.map((page, index) => (
          <StoryPageCard 
            key={index}
            page={page}
            pageIndex={index}
            onGenerateImage={onGenerateImage}
            onRegenerateImage={onRegenerateImage}
            onEditStory={onEditStory}
            onEditImagePrompt={onEditImagePrompt}
            metadata={story.metadata}
          />
        ))}
      </div>
    </div>
  );
};

// Story Page Card Component
interface StoryPageCardProps {
  page: StoryPage;
  pageIndex: number;
  onGenerateImage: (pageIndex: number) => void;
  onRegenerateImage: (pageIndex: number) => void;
  onEditStory: (pageIndex: number, newText: string) => void;
  onEditImagePrompt: (pageIndex: number, newPrompt: string) => void;
  metadata: any;
}

const StoryPageCard: React.FC<StoryPageCardProps> = ({ 
  page, 
  pageIndex, 
  onGenerateImage, 
  onRegenerateImage,
  onEditStory,
  onEditImagePrompt,
  metadata 
}) => {
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedStoryText, setEditedStoryText] = useState(page.story);
  const [editedPromptText, setEditedPromptText] = useState(page.imagePrompt);
  
  // Magic editor state
  const [selectedText, setSelectedText] = useState('');
  const [showMagicEditor, setShowMagicEditor] = useState(false);
  const [magicEditorPosition, setMagicEditorPosition] = useState({ x: 0, y: 0 });
  const [isApplyingMagicEdit, setIsApplyingMagicEdit] = useState(false);
  
  const { apiSettings, addNotification } = useAppStore();

  const handleSaveStoryEdit = () => {
    onEditStory(pageIndex, editedStoryText);
    setIsEditingStory(false);
  };

  const handleSavePromptEdit = () => {
    onEditImagePrompt(pageIndex, editedPromptText);
    setIsEditingPrompt(false);
  };

  const handleCancelStoryEdit = () => {
    setEditedStoryText(page.story);
    setIsEditingStory(false);
  };

  const handleCancelPromptEdit = () => {
    setEditedPromptText(page.imagePrompt);
    setIsEditingPrompt(false);
  };

  const downloadImage = () => {
    if (!page.imageData) return;
    
    // For SVG images
    if (page.imageData.includes('<svg')) {
      const svgBlob = new Blob([page.imageData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      
      const link = document.createElement('a');
      link.download = `story-page-${page.pageNumber}.svg`;
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
    } else {
      // For other image types
      const link = document.createElement('a');
      link.download = `story-page-${page.pageNumber}.png`;
      link.href = page.imageData;
      link.click();
    }
  };

  // Magic editor functionality
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const selectedText = selection.toString();
      setSelectedText(selectedText);
      
      // Get selection position
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setMagicEditorPosition({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY - 40
      });
      
      setShowMagicEditor(true);
    } else {
      setShowMagicEditor(false);
    }
  };

  const applyMagicEdit = async (action: string) => {
    if (!selectedText) return;
    
    setIsApplyingMagicEdit(true);
    
    try {
      const aiService = new AIService(apiSettings);
      let prompt = '';
      
      switch (action) {
        case 'improve':
          prompt = `Improve this text while keeping the same meaning: "${selectedText}"`;
          break;
        case 'simplify':
          prompt = `Simplify this text for children: "${selectedText}"`;
          break;
        case 'expand':
          prompt = `Expand this text with more descriptive details: "${selectedText}"`;
          break;
        case 'fix-grammar':
          prompt = `Fix any grammar or spelling errors in this text: "${selectedText}"`;
          break;
      }
      
      const improvedText = await aiService.generateSimpleText(prompt);
      
      // Apply the improved text by replacing in the current edited text
      const updatedText = editedStoryText.replace(selectedText, improvedText);
      setEditedStoryText(updatedText);
      
      addNotification({
        type: 'success',
        message: `Text ${action} applied! Remember to save your changes.`
      });
      
    } catch (error) {
      addNotification({
        type: 'error',
        message: `Failed to apply magic edit: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsApplyingMagicEdit(false);
      setShowMagicEditor(false);
    }
  };

  return (
    <div className="story-card">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
            {page.pageNumber}
          </div>
          <div>
            <h3 className="text-xl font-bold text-blue-800">Page {page.pageNumber}</h3>
            <p className="text-sm text-gray-600">{page.wordCount} words • {metadata?.imageStyle} style</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-medium">
            {page.wordCount} words
          </span>
          <button
            onClick={() => onGenerateImage(pageIndex)}
            className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-md"
          >
            🎨 Generate Image
          </button>
        </div>
      </div>
      
      {/* Story Text */}
      <div className="story-text mb-4">
        {isEditingStory ? (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-yellow-800">✏️ Editing Story Text</h4>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveStoryEdit}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                >
                  ✅ Save
                </button>
                <button
                  onClick={handleCancelStoryEdit}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
            <textarea
              value={editedStoryText}
              onChange={(e) => setEditedStoryText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ height: '8rem' }}
              placeholder="Edit your story text here..."
              aria-label="Edit story text"
            />
            <div className="text-xs text-gray-600 mt-2">
              Word count: {editedStoryText.split(' ').filter(word => word.length > 0).length}
            </div>
          </div>
        ) : (
          <div className="story-text">
            <div className="absolute top-2 right-2">
              <button
                onClick={() => setIsEditingStory(true)}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit story text"
                aria-label="Edit story text"
              >
                <Edit size={16} />
              </button>
            </div>
            <div 
              className="text-gray-800 leading-relaxed text-lg pr-8 select-text cursor-text"
              onMouseUp={handleTextSelection}
              title="Select text to use Magic Editor"
            >
              {page.story}
            </div>
          </div>
        )}
      </div>

      {/* Magic Editor Popup */}
      {showMagicEditor && (
        <div 
          className="magic-editor-popup"
          style={{
            left: `${magicEditorPosition.x}px`,
            top: `${magicEditorPosition.y}px`,
          }}
        >
          <div className="text-xs text-gray-600 mb-2 text-center">✨ Magic Editor</div>
          <div className="magic-editor-buttons">
            <button
              onClick={() => applyMagicEdit('improve')}
              disabled={isApplyingMagicEdit}
              className="magic-editor-button blue"
              title="Improve the selected text"
            >
              ✨ Improve
            </button>
            <button
              onClick={() => applyMagicEdit('simplify')}
              disabled={isApplyingMagicEdit}
              className="magic-editor-button green"
              title="Simplify for children"
            >
              🎈 Simplify
            </button>
            <button
              onClick={() => applyMagicEdit('expand')}
              disabled={isApplyingMagicEdit}
              className="magic-editor-button orange"
              title="Add more details"
            >
              📝 Expand
            </button>
            <button
              onClick={() => applyMagicEdit('fix-grammar')}
              disabled={isApplyingMagicEdit}
              className="magic-editor-button red"
              title="Fix grammar and spelling"
            >
              ✏️ Fix
            </button>
            <button
              onClick={() => setShowMagicEditor(false)}
              className="magic-editor-button gray"
              title="Close magic editor"
            >
              ✕
            </button>
          </div>
          {isApplyingMagicEdit && (
            <div className="text-xs text-center text-purple-600 mt-2">
              <div className="spinner inline-block w-3 h-3 mr-1"></div>
              Applying magic...
            </div>
          )}
        </div>
      )}
      
      {/* Image Prompt Section */}
      <div className="image-prompt-section border-t-2 border-gray-200 pt-4">
        <details className="text-sm bg-gray-50 rounded-lg">
          <summary className="cursor-pointer text-gray-700 font-semibold p-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2">
            🎨 AI Image Prompt
            <span className="text-xs bg-gray-200 px-2 py-1 rounded ml-auto">Click to expand</span>
          </summary>
          <div className="mt-2 p-4 bg-white rounded border-l-4 border-purple-500">
            {isEditingPrompt ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="font-semibold text-purple-800">✏️ Editing Image Prompt</h5>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSavePromptEdit}
                      className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                    >
                      ✅ Save
                    </button>
                    <button
                      onClick={handleCancelPromptEdit}
                      className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 transition-colors"
                    >
                      ❌ Cancel
                    </button>
                  </div>
                </div>
                <textarea
                  value={editedPromptText}
                  onChange={(e) => setEditedPromptText(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={{ height: '6rem' }}
                  placeholder="Edit your image prompt here..."
                  aria-label="Edit image prompt"
                />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute top-0 right-0">
                  <button
                    onClick={() => setIsEditingPrompt(true)}
                    className="text-gray-400 hover:text-purple-600 transition-colors"
                    title="Edit image prompt"
                    aria-label="Edit image prompt"
                  >
                    <Edit size={14} />
                  </button>
                </div>
                <div className="text-xs text-gray-600 font-mono leading-relaxed pr-6">
                  {page.imagePrompt}
                </div>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                📐 {metadata?.aspectRatio}
              </span>
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                ✏️ Line Weight: {metadata?.lineWeight}/10
              </span>
              <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded">
                🎨 {metadata?.imageStyle}
              </span>
            </div>
          </div>
        </details>
        
        {/* Generated Image Display */}
        <div className="mt-4">
          {page.imageGenerated && page.imageData ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="text-green-600 font-semibold mb-3 flex items-center gap-2">
                ✅ Image Generated
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={downloadImage}
                    className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                  >
                    📥 Download
                  </button>
                  <button
                    onClick={() => onRegenerateImage(pageIndex)}
                    className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded hover:bg-purple-200 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    Regenerate
                  </button>
                </div>
              </div>
              <div className="border rounded p-2 bg-white max-h-96 overflow-auto">
                <img 
                  src={`data:image/png;base64,${page.imageData}`} 
                  alt={`Generated illustration for page ${pageIndex + 1}`}
                  className="w-full h-auto rounded"
                />
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
              <div className="text-blue-600 font-semibold mb-2">🎨 Ready for Image Generation</div>
              <div className="text-sm text-blue-500 mb-3">Click "Generate Image" above to create the illustration</div>
              <button
                onClick={() => onGenerateImage(pageIndex)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                🎨 Generate Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryGenerator;
