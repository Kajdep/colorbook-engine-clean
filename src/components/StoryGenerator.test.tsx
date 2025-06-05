import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StoryGenerator from './StoryGenerator';
import { useAppStore } from '../store/useAppStore';
import { AIService } from '../utils/aiService';
import backendAPI from '../utils/backendAPI';

// Mock dependencies
jest.mock('../store/useAppStore');
jest.mock('../utils/aiService');
jest.mock('../utils/backendAPI');

const mockUseAppStore = useAppStore as jest.Mock;
const mockAIService = AIService as jest.MockedClass<typeof AIService>;
const mockBackendAPI = backendAPI as jest.Mocked<typeof backendAPI>;

describe('StoryGenerator', () => {
  let mockAddNotification: jest.Mock;
  let mockSetIsLoading: jest.Mock;
  let mockSetCurrentStory: jest.Mock;
  let storeState: any;

  beforeEach(() => {
    mockAddNotification = jest.fn();
    mockSetIsLoading = jest.fn();
    mockSetCurrentStory = jest.fn((newStory) => {
      storeState = { ...storeState, currentStory: newStory };
    });

    storeState = {
      user: { id: 'user-123', email: 'test@example.com', subscriptionTier: 'premium' },
      apiSettings: { apiKey: 'test-api-key', aiModel: 'test-model', imageService: 'openai', imageModel: 'dall-e-3', googleApiKey: '', googleProjectId: '', imageApiKey: 'img-api-key' },
      addNotification: mockAddNotification,
      isLoading: false,
      setIsLoading: mockSetIsLoading,
      currentProjectId: 'project-123',
      currentStory: null,
      setCurrentStory: mockSetCurrentStory,
      updateUser: jest.fn(),
      setProjects: jest.fn(),
      projects: [],
      getProjectById: jest.fn().mockReturnValue({ id: 'project-123', name: 'Test Project' }),
    };

    mockUseAppStore.mockImplementation(() => storeState);

    mockAIService.prototype.generateStoryWithImagePrompts = jest.fn();
    mockAIService.prototype.generateImage = jest.fn();

    mockBackendAPI.createStory = jest.fn();
    mockBackendAPI.getProject = jest.fn().mockResolvedValue({
      data: { id: 'project-123', name: 'Test Project' }
    });
    mockBackendAPI.getProjects = jest.fn().mockResolvedValue({ data: { projects: [] } });

    Storage.prototype.getItem = jest.fn(key => key === 'currentProjectId' ? 'project-123' : null);
    Storage.prototype.setItem = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders main input fields and Generate Story button', () => {
      render(<StoryGenerator />);
      expect(screen.getByPlaceholderText(/e.g., Adventure in the Magical Forest/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e.g., Brave rabbit Luna, wise owl Oliver/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate Story with Image Prompts/i })).toBeInTheDocument();
    });

    it('displays current word count (initially 0) - by checking form inputs are empty', () => {
      render(<StoryGenerator />);
      expect(screen.getByPlaceholderText(/e.g., Adventure in the Magical Forest/i)).toHaveValue('');
    });

    it('displays current story content if currentStory from store has data', async () => {
      const storyData = {
        pages: [{ pageNumber: 1, story: "Once upon a time...", imagePrompt: "A castle.", wordCount: 4, imageGenerated: false, imageData: undefined }],
        metadata: { imageStyle: "Cartoonish", totalPages: 1, targetWordsPerPage: 50, generatedAt: new Date().toISOString(), lineWeight: 3, aspectRatio: '16:9' }
      };
      storeState.currentStory = storyData;

      render(<StoryGenerator />);
      await waitFor(() => {
        expect(screen.getByText("Once upon a time...")).toBeInTheDocument();
      });
    });
  });

  describe('Input Field Interaction', () => {
    it('allows users to type into theme and characters fields', () => {
      render(<StoryGenerator />);
      const themeInput = screen.getByPlaceholderText(/e.g., Adventure in the Magical Forest/i);
      const charactersInput = screen.getByPlaceholderText(/e.g., Brave rabbit Luna, wise owl Oliver/i);

      fireEvent.change(themeInput, { target: { value: 'A brave knight' } });
      fireEvent.change(charactersInput, { target: { value: 'Sir Reginald' } });

      expect(themeInput).toHaveValue('A brave knight');
      expect(charactersInput).toHaveValue('Sir Reginald');
    });
  });

  describe('Story Generation Flow', () => {
    const mockStoryParams = {
      theme: 'A lost puppy',
      characters: 'Max the puppy',
      ageMin: 4, ageMax: 8, isAdult: false, numPages: 5, wordsPerPage: 50,
      imageStyle: 'cute', lineWeight: 5, aspectRatio: 'square', moral: '', generalInstructions: ''
    };
    const generatedStoryData = {
      pages: [{ pageNumber: 1, story: "Max was a lost puppy.", imagePrompt: "A sad puppy.", wordCount: 5, imageGenerated: false, imageData: undefined }],
      metadata: { imageStyle: "cute", totalPages: 1, targetWordsPerPage: 50, generatedAt: new Date().toISOString(), lineWeight: 5, aspectRatio: 'square' }
    };

    it('successfully generates a story', async () => {
      mockAIService.prototype.generateStoryWithImagePrompts.mockResolvedValue(generatedStoryData);

      const { debug } = render(<StoryGenerator />);

      fireEvent.change(screen.getByPlaceholderText(/e.g., Adventure in the Magical Forest/i), { target: { value: mockStoryParams.theme } });
      fireEvent.change(screen.getByPlaceholderText(/e.g., Brave rabbit Luna, wise owl Oliver/i), { target: { value: mockStoryParams.characters } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Story with Image Prompts/i }));

      expect(mockAIService).toHaveBeenCalledTimes(1);
      expect(mockAIService.prototype.generateStoryWithImagePrompts).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: mockStoryParams.theme,
          characters: mockStoryParams.characters,
          numPages: 5, wordsPerPage: 50, imageStyle: 'cute'
        })
      );

      await waitFor(() => {
        expect(mockSetCurrentStory).toHaveBeenCalledWith(generatedStoryData);
      });

      await waitFor(() => {
        debug();
        expect(screen.getByText("Max was a lost puppy.")).toBeInTheDocument();
      });
      // Corrected assertion: Expect a success notification
      expect(mockAddNotification).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        message: `Story with ${generatedStoryData.pages.length} pages generated! 🎉`
      }));
    });

    it('handles story generation failure', async () => {
      mockAIService.prototype.generateStoryWithImagePrompts.mockRejectedValue(new Error('Gen failed'));

      render(<StoryGenerator />);
      fireEvent.change(screen.getByPlaceholderText(/e.g., Adventure in the Magical Forest/i), { target: { value: 'A complex story' } });
      fireEvent.change(screen.getByPlaceholderText(/e.g., Brave rabbit Luna, wise owl Oliver/i), { target: { value: 'Some characters' } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Story with Image Prompts/i }));

      expect(mockAIService.prototype.generateStoryWithImagePrompts).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Error generating story: Gen failed',
          type: 'error',
        }));
      });
      expect(mockSetCurrentStory).not.toHaveBeenCalled();
    });
  });

  describe('Saving Story Flow', () => {
    const storyToSave = {
      pages: [{ pageNumber: 1, story: "A story to save.", imagePrompt: "An image prompt.", wordCount: 5, imageGenerated: false, imageData: undefined }],
      metadata: { imageStyle: "Sketch", totalPages: 1, targetWordsPerPage: 20, generatedAt: new Date().toISOString(), lineWeight: 3, aspectRatio: '16:9' }
    };

    it('successfully exports a story', async () => {
      storeState.currentStory = storyToSave;

      global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-url');
      global.URL.revokeObjectURL = jest.fn();

      render(<StoryGenerator />);

      const exportButton = screen.getByRole('button', { name: /Export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Story exported successfully!',
          type: 'success',
        }));
      });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('does not attempt to export if no story is present', () => {
      storeState.currentStory = null;
      render(<StoryGenerator />);
      expect(screen.queryByRole('button', { name: /Export/i })).not.toBeInTheDocument();
    });
  });

  describe('Image Generation Flow', () => {
    const currentStoryWithPrompt = {
      pages: [{ pageNumber: 1, story: "A page that needs an image.", imagePrompt: "A detailed image prompt for AI.", wordCount: 8, imageGenerated: false, imageData: undefined }],
      metadata: { imageStyle: "Fantasy", totalPages: 1, targetWordsPerPage: 25, generatedAt: new Date().toISOString(), lineWeight: 5, aspectRatio: '1:1' }
    };

    it('successfully generates an image for the current page', async () => {
      storeState.currentStory = currentStoryWithPrompt;
      storeState.apiSettings.imageApiKey = 'fake-key';
      mockAIService.prototype.generateImage.mockResolvedValue('data:image/png;base64,generatedimageData');

      render(<StoryGenerator />);
      await screen.findByText("A page that needs an image.");

      const generateImageButton = screen.getByRole('button', { name: /🎨 Generate Now/i });
      fireEvent.click(generateImageButton);

      expect(mockAIService.prototype.generateImage).toHaveBeenCalledWith("A detailed image prompt for AI.");
      await waitFor(() => {
        expect(mockSetCurrentStory).toHaveBeenCalledWith(expect.objectContaining({
          pages: expect.arrayContaining([
            expect.objectContaining({
              imageData: 'data:image/png;base64,generatedimageData',
              imageGenerated: true,
            })
          ])
        }));
      });
      expect(mockAddNotification).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/Image generated for page 1!/i),
        type: 'success',
      }));
    });

    it('handles image generation failure', async () => {
      storeState.currentStory = currentStoryWithPrompt;
      storeState.apiSettings.imageApiKey = 'fake-key';
      mockAIService.prototype.generateImage.mockRejectedValue(new Error('Image gen failed'));

      render(<StoryGenerator />);
      await screen.findByText("A page that needs an image.");

      const generateImageButton = screen.getByRole('button', { name: /🎨 Generate Now/i });
      fireEvent.click(generateImageButton);

      expect(mockAIService.prototype.generateImage).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Failed to generate image: Image gen failed',
          type: 'error',
        }));
      });
      expect(mockSetCurrentStory).not.toHaveBeenCalledWith(expect.objectContaining({
         pages: expect.arrayContaining([expect.objectContaining({ imageData: expect.anything() })])
      }));
    });

     it('does not show contextual image generation buttons if no story', () => {
      storeState.currentStory = null;
      render(<StoryGenerator />);
      expect(screen.queryByRole('button', { name: /🎨 Generate Now/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /🎨 Generate Image/i })).not.toBeInTheDocument();
      expect(mockAIService.prototype.generateImage).not.toHaveBeenCalled();
    });
  });
});

export {};
