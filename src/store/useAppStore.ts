import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Project,
  StoryData,
  APISettings,
  DrawingSettings,
  ExportSettings,
  Notification,
  Section,
  ComplianceResults
} from '../types';
import { persistentStorage } from '../utils/persistentStorage';
import backendAPI from '../utils/backendAPI';
import driveService from '../utils/driveService';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  subscription?: {
    tier: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'expired' | 'cancelled';
    expiresAt?: string;
  };
}

interface AppState {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  isInitializingAuth: boolean;
  authToken: string | null;
  
  // UI State
  currentSection: Section;
  notifications: Notification[];
  isSidebarCollapsed: boolean; // New state for sidebar
  
  // Project State
  projects: Project[];
  currentProject: Project | null;
  currentStory: StoryData | null;
  isLoading: boolean;
  
  // API Settings
  apiSettings: APISettings;
  
  // Drawing State
  drawingSettings: DrawingSettings;
  canvasHistory: string[];
  historyStep: number;
  
  // Export State
  exportSettings: ExportSettings;
  
  // Compliance State
  lastComplianceResults: ComplianceResults | null;
  
  // Storage State
  storageStats: {
    projects: number;
    stories: number;
    images: number;
    drawings: number;
    totalSize: number;
    syncQueueSize: number;
  };
  syncStatus: {
    isOnline: boolean;
    syncInProgress: boolean;
    queueSize: number;
    lastSync: string | null;
  };
  // Google Drive
  driveConnected: boolean;
  connectDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  syncProjectToDrive: (project: Project) => Promise<void>;
  getProjectDriveStatus: (id: string) => 'local' | 'syncing' | 'synced' | 'error';
  
  // Auth Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  
  // Actions
  setCurrentSection: (section: Section) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  toggleSidebar: () => void; // New action for sidebar
  
  // Project Actions
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  duplicateProject: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  
  // Story Actions
  setCurrentStory: (story: StoryData | null) => void;
  saveStory: (story: StoryData, projectId: string) => Promise<void>;
  loadProjectStories: (projectId: string) => Promise<StoryData[]>;
  
  // Image Actions
  saveImage: (imageData: {
    id: string;
    projectId: string;
    type: 'story' | 'cover' | 'drawing';
    data: string;
    metadata?: any;
  }) => Promise<void>;
  loadProjectImages: (projectId: string) => Promise<any[]>;
  
  // Drawing Actions
  updateDrawingSettings: (settings: Partial<DrawingSettings>) => void;
  addToCanvasHistory: (dataUrl: string) => void;
  undoCanvas: () => boolean;
  redoCanvas: () => boolean;
  clearCanvasHistory: () => void;
  saveDrawing: (drawingData: {
    id: string;
    projectId: string;
    canvasData: string;
    metadata?: any;
  }) => Promise<void>;
  loadProjectDrawings: (projectId: string) => Promise<any[]>;
  
  // API Actions
  updateApiSettings: (settings: Partial<APISettings>) => void;
  loadApiSettings: () => void;
  
  // Export Actions
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  loadExportSettings: () => void;
  
  // Compliance Actions
  setComplianceResults: (results: ComplianceResults | null) => void;
  
  // Storage Management Actions
  updateStorageStats: () => Promise<void>;
  updateSyncStatus: () => void;
  clearAllData: () => Promise<void>;
  exportAllData: () => Promise<string>;
  importData: (jsonData: string) => Promise<void>;
  forceSyncAll: () => Promise<void>;
  
  // Initialization
  initializeApp: () => Promise<void>;
}

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial Auth State
      user: null,
      isAuthenticated: false,
      isInitializingAuth: false,
      authToken: null,
      
      // Initial State
      currentSection: 'dashboard',
      notifications: [],
      projects: [],
      currentProject: null,
      currentStory: null,
      isLoading: false,
      apiSettings: {
        apiKey: '',
        aiModel: 'google/gemma-2-9b-it:free',
        imageService: 'none',
        imageApiKey: '',
        imageModel: 'dall-e-3'
      },
      drawingSettings: {
        brushSize: 5,
        opacity: 100,
        currentColor: '#000000',
        drawingMode: 'draw'
      },
      canvasHistory: [],
      historyStep: -1,
      exportSettings: {
        pageSize: 'letter',
        margins: {
          vertical: 0.5,
          horizontal: 0.5
        },
        quality: 'print-high',
        colorMode: 'rgb',
        includeBleed: false,
        includeCropMarks: false,
        includeColorBars: false,
        doubleSided: false
      },
      lastComplianceResults: null,
      storageStats: {
        projects: 0,
        stories: 0,
        images: 0,
        drawings: 0,
        totalSize: 0,
        syncQueueSize: 0
      },
      syncStatus: {
        isOnline: navigator.onLine,
        syncInProgress: false,
        queueSize: 0,
        lastSync: null
      },
      driveConnected: false,
      isSidebarCollapsed: false, // Initialize new state

      // Auth Actions
      login: async (email: string, password: string) => {
        try {
          set({ isInitializingAuth: true });

          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || 'Login failed');
          }

          const { user, tokens } = data;

          // Persist tokens for backendAPI and components
          if (tokens?.accessToken) {
            localStorage.setItem('accessToken', tokens.accessToken);
            localStorage.setItem('authToken', tokens.accessToken);
            if (tokens.refreshToken) {
              localStorage.setItem('refreshToken', tokens.refreshToken);
            }
            // Update backendAPI instance with fresh tokens
            (backendAPI as any).accessToken = tokens.accessToken;
            (backendAPI as any).refreshToken = tokens.refreshToken;
          }

          set({
            user: {
              id: user.id,
              email: user.email,
              name: user.username || user.firstName || user.email,
              createdAt: user.createdAt || new Date().toISOString(),
              subscription: {
                tier: user.subscriptionTier || 'free',
                status: user.subscriptionStatus || 'active',
              },
            },
            authToken: tokens.accessToken,
            isAuthenticated: true,
            isInitializingAuth: false,
          });

          await get().loadProjects();

        } catch (error: any) {
          set({ isInitializingAuth: false });
          throw error;
        }
      },

      register: async (email: string, name: string, password: string) => {
        try {
          set({ isInitializingAuth: true });

          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username: name })
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || 'Registration failed');
          }

          const { user, tokens } = data;

          // Persist tokens for backendAPI and components
          if (tokens?.accessToken) {
            localStorage.setItem('accessToken', tokens.accessToken);
            localStorage.setItem('authToken', tokens.accessToken);
            if (tokens.refreshToken) {
              localStorage.setItem('refreshToken', tokens.refreshToken);
            }
            (backendAPI as any).accessToken = tokens.accessToken;
            (backendAPI as any).refreshToken = tokens.refreshToken;
          }

          set({
            user: {
              id: user.id,
              email: user.email,
              name: user.username || user.firstName || user.email,
              createdAt: user.createdAt || new Date().toISOString(),
              subscription: {
                tier: user.subscriptionTier || 'free',
                status: user.subscriptionStatus || 'active',
              },
            },
            authToken: tokens.accessToken,
            isAuthenticated: true,
            isInitializingAuth: false,
          });

          await get().loadProjects();

        } catch (error: any) {
          set({ isInitializingAuth: false });
          throw error;
        }
      },
      
      logout: async () => {
        try {
          await backendAPI.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            authToken: null,
            isAuthenticated: false,
            projects: [],
            currentProject: null,
            currentStory: null,
          });
        }
      },
      
      refreshAuth: async () => {
        try {
          // For development, auto-authenticate with mock user
          const existingUser = localStorage.getItem('mockUser');
          if (existingUser) {
            const user = JSON.parse(existingUser);
            set({
              user,
              authToken: 'mock-token',
              isAuthenticated: true,
            });
            return;
          }

          const response = await backendAPI.getCurrentUser();

          if (response.error || !response.data) return;

          const { user } = response.data;

          set({
            user: {
              id: user.id,
              email: user.email,
              name: user.username || user.firstName || user.email,
              createdAt: user.createdAt || new Date().toISOString(),
              subscription: {
                tier: user.subscriptionTier || 'free',
                status: user.subscriptionStatus || 'active',
              },
            },
            authToken: backendAPI.getAccessToken(),
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Auth refresh failed:', error);
          // For development, create mock user
          const mockUser = {
            id: 'mock-user-1',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: new Date().toISOString(),
            subscription: {
              tier: 'free' as const,
              status: 'active' as const,
            },
          };
          localStorage.setItem('mockUser', JSON.stringify(mockUser));
          set({
            user: mockUser,
            authToken: 'mock-token',
            isAuthenticated: true,
          });
        }
      },
      
      updateUser: async (updates: Partial<User>) => {
        const user = get().user;
        if (!user) return;
        
        try {
          const updatedUser = { ...user, ...updates };
          
          // Update localStorage for now
          localStorage.setItem('user_data', JSON.stringify(updatedUser));
          
          set({ user: updatedUser });
          
          get().addNotification({
            type: 'success',
            message: 'Profile updated successfully!'
          });
        } catch (error: any) {
          get().addNotification({
            type: 'error',
            message: 'Failed to update profile'
          });
        }
      },

      // UI Actions
      setCurrentSection: (section) => set({ currentSection: section }),
      
      addNotification: (notification) => {
        const id = generateId();
        const newNotification = { ...notification, id };
        set((state) => ({
          notifications: [...state.notifications, newNotification]
        }));
        
        // Auto remove after duration
        setTimeout(() => {
          get().removeNotification(id);
        }, notification.duration || 5000);
      },
      
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),

      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })), // Implement new action

      // Project Actions
      createProject: async (projectData) => {
        set({ isLoading: true });
        
        try {
          const project: Project = {
            ...projectData,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Always save to persistent storage for now
          await persistentStorage.saveProject(project);
          
          set((state) => ({
            projects: [...state.projects, project],
            currentProject: project,
            isLoading: false
          }));
          
          get().addNotification({
            type: 'success',
            message: 'Project created successfully!'
          });
          
          // Update storage stats
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error creating project:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to create project'
          });
          set({ isLoading: false });
        }
      },
      
      updateProject: async (id, updates) => {
        try {
          const updatedProject = {
            ...updates,
            updatedAt: new Date().toISOString()
          };
          
          // Update in persistent storage
          const currentProject = get().projects.find(p => p.id === id);
          if (currentProject) {
            const fullProject = { ...currentProject, ...updatedProject };
            await persistentStorage.saveProject(fullProject);
            
            set((state) => ({
              projects: state.projects.map(p => 
                p.id === id ? fullProject : p
              ),
              currentProject: state.currentProject?.id === id 
                ? fullProject
                : state.currentProject
            }));
          }
          
          get().addNotification({
            type: 'success',
            message: 'Project updated successfully!'
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error updating project:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to update project'
          });
        }
      },
      
      deleteProject: async (id) => {
        try {
          await persistentStorage.deleteProject(id);
          
          // Update state
          set((state) => ({
            projects: state.projects.filter(p => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject
          }));
          
          get().addNotification({
            type: 'success',
            message: 'Project deleted successfully!'
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error deleting project:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to delete project'
          });
        }
      },
      
      setCurrentProject: (project) => set({ currentProject: project }),
      
      duplicateProject: async (id) => {
        try {
          set({ isLoading: true });
          
          const original = get().projects.find(p => p.id === id);
          if (!original) {
            throw new Error('Project not found');
          }
          
          const duplicate: Project = {
            ...original,
            id: generateId(),
            title: original.title + ' (Copy)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pages: original.pages.map(page => ({
              ...page,
              id: generateId()
            }))
          };
          
          // Save to persistent storage
          await persistentStorage.saveProject(duplicate);
          
          // Update state
          set((state) => ({
            projects: [...state.projects, duplicate],
            isLoading: false
          }));
          
          get().addNotification({
            type: 'success',
            message: 'Project duplicated successfully!'
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error duplicating project:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to duplicate project'
          });
          set({ isLoading: false });
        }
      },
      
      loadProjects: async () => {
        try {
          set({ isLoading: true });
          
          const projects = await persistentStorage.getAllProjects();
          
          set({
            projects,
            isLoading: false
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error loading projects:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to load projects'
          });
          set({ isLoading: false });
        }
      },

      // Story Actions
      setCurrentStory: (story) => set({ currentStory: story }),
      
      saveStory: async (story, projectId) => {
        try {
          await persistentStorage.saveStory(story, projectId);
          
          get().addNotification({
            type: 'success',
            message: 'Story saved successfully!'
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error saving story:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to save story'
          });
        }
      },
      
      loadProjectStories: async (projectId) => {
        try {
          return await persistentStorage.getProjectStories(projectId);
        } catch (error) {
          console.error('Error loading project stories:', error);
          return [];
        }
      },

      // Image Actions
      saveImage: async (imageData) => {
        try {
          await persistentStorage.saveImage(imageData);
          
          get().addNotification({
            type: 'success',
            message: 'Image saved successfully!'
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error saving image:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to save image'
          });
        }
      },
      
      loadProjectImages: async (projectId) => {
        try {
          return await persistentStorage.getProjectImages(projectId);
        } catch (error) {
          console.error('Error loading project images:', error);
          return [];
        }
      },

      // Drawing Actions
      updateDrawingSettings: (settings) => {
        const newSettings = { ...get().drawingSettings, ...settings };
        set({ drawingSettings: newSettings });
        persistentStorage.saveDrawingSettings(newSettings);
      },
      
      addToCanvasHistory: (dataUrl) => set((state) => {
        const newHistory = state.canvasHistory.slice(0, state.historyStep + 1);
        return {
          canvasHistory: [...newHistory, dataUrl],
          historyStep: newHistory.length
        };
      }),
      
      undoCanvas: () => {
        const state = get();
        if (state.historyStep > 0) {
          set({ historyStep: state.historyStep - 1 });
          return true;
        }
        return false;
      },
      
      redoCanvas: () => {
        const state = get();
        if (state.historyStep < state.canvasHistory.length - 1) {
          set({ historyStep: state.historyStep + 1 });
          return true;
        }
        return false;
      },
      
      clearCanvasHistory: () => set({
        canvasHistory: [],
        historyStep: -1
      }),
      
      saveDrawing: async (drawingData) => {
        try {
          await persistentStorage.saveDrawing(drawingData);
          
          get().addNotification({
            type: 'success',
            message: 'Drawing saved successfully!'
          });
          
          await get().updateStorageStats();
        } catch (error) {
          console.error('Error saving drawing:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to save drawing'
          });
        }
      },
      
      loadProjectDrawings: async (projectId) => {
        try {
          return await persistentStorage.getProjectDrawings(projectId);
        } catch (error) {
          console.error('Error loading project drawings:', error);
          return [];
        }
      },

      // API Actions
      updateApiSettings: (settings) => {
        const newSettings = { ...get().apiSettings, ...settings };
        set({ apiSettings: newSettings });
        persistentStorage.saveAPISettings(newSettings);
      },
      
      loadApiSettings: () => {
        const settings = persistentStorage.getAPISettings();
        if (settings) {
          set({ apiSettings: settings });
        }
      },

      // Export Actions
      updateExportSettings: (settings) => {
        const newSettings = { ...get().exportSettings, ...settings };
        set({ exportSettings: newSettings });
        persistentStorage.saveExportSettings(newSettings);
      },
      
      loadExportSettings: () => {
        const settings = persistentStorage.getExportSettings();
        if (settings) {
          set({ exportSettings: settings });
        }
      },

      // Compliance Actions
      setComplianceResults: (results) => set({ lastComplianceResults: results }),

      // Storage Management Actions
      updateStorageStats: async () => {
        try {
          const stats = await persistentStorage.getStorageStats();
          set({ storageStats: stats });
        } catch (error) {
          console.error('Error updating storage stats:', error);
        }
      },
      
      updateSyncStatus: () => {
        const status = persistentStorage.getSyncStatus();
        set({ syncStatus: status });
      },
      
      clearAllData: async () => {
        try {
          await persistentStorage.clearAllData();
          
          // Reset state
          set({
            projects: [],
            currentProject: null,
            currentStory: null,
            storageStats: {
              projects: 0,
              stories: 0,
              images: 0,
              drawings: 0,
              totalSize: 0,
              syncQueueSize: 0
            }
          });
          
          get().addNotification({
            type: 'success',
            message: 'All data cleared successfully!'
          });
        } catch (error) {
          console.error('Error clearing data:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to clear data'
          });
        }
      },
      
      exportAllData: async () => {
        try {
          const exportData = await persistentStorage.exportAllData();
          
          get().addNotification({
            type: 'success',
            message: 'Data exported successfully!'
          });
          
          return exportData;
        } catch (error) {
          console.error('Error exporting data:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to export data'
          });
          throw error;
        }
      },
      
      importData: async (jsonData) => {
        try {
          set({ isLoading: true });
          
          await persistentStorage.importData(jsonData);
          
          // Reload projects after import
          await get().loadProjects();
          
          get().addNotification({
            type: 'success',
            message: 'Data imported successfully!'
          });
          
          set({ isLoading: false });
        } catch (error) {
          console.error('Error importing data:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to import data'
          });
          set({ isLoading: false });
          throw error;
        }
      },
      
      forceSyncAll: async () => {
        try {
          await persistentStorage.forceSyncAll();
          get().updateSyncStatus();
          
          get().addNotification({
            type: 'success',
            message: 'Sync completed successfully!'
          });
        } catch (error) {
          console.error('Error syncing data:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to sync data'
          });
        }
      },

      connectDrive: async () => {
        try {
          const { apiSettings } = get();
          if (!apiSettings.googleApiKey || !apiSettings.googleProjectId) {
            throw new Error('Missing Google API credentials');
          }
          await driveService.init({
            apiKey: apiSettings.googleApiKey,
            clientId: apiSettings.googleProjectId
          });
          await driveService.signIn();
          set({ driveConnected: true });
          get().addNotification({ type: 'success', message: 'Connected to Google Drive' });
        } catch (error) {
          console.error('Drive connect error:', error);
          get().addNotification({ type: 'error', message: 'Failed to connect Drive' });
        }
      },

      disconnectDrive: async () => {
        try {
          await driveService.signOut();
          set({ driveConnected: false });
          get().addNotification({ type: 'success', message: 'Disconnected from Google Drive' });
        } catch (error) {
          console.error('Drive disconnect error:', error);
          get().addNotification({ type: 'error', message: 'Failed to disconnect Drive' });
        }
      },

      syncProjectToDrive: async (project) => {
        try {
          if (!get().driveConnected) return;
          await driveService.syncProject(project);
        } catch (error) {
          console.error('Drive sync error:', error);
        }
      },

      getProjectDriveStatus: (id) => driveService.getSyncStatus(id),
      
      // Initialization
      initializeApp: async () => {
        try {
          set({ isLoading: true });
          
          // Check for existing auth
          await get().refreshAuth();
          
          // Load settings from persistent storage
          get().loadApiSettings();
          get().loadExportSettings();
          
          const drawingSettings = persistentStorage.getDrawingSettings();
          if (drawingSettings) {
            set({ drawingSettings });
          }
          
          // Load projects
          await get().loadProjects();
          
          // Update stats and sync status
          await get().updateStorageStats();
          get().updateSyncStatus();
          
          get().addNotification({
            type: 'success',
            message: 'ColorBook Engine initialized successfully!'
          });
          
          set({ isLoading: false });
        } catch (error) {
          console.error('Error initializing app:', error);
          get().addNotification({
            type: 'error',
            message: 'Failed to initialize app'
          });
          set({ isLoading: false });
        }
      }
    }),
    {
      name: 'colorbook-engine-storage',
      partialize: (state) => ({
        // Only persist UI state in Zustand, everything else goes to IndexedDB
        currentSection: state.currentSection,
        drawingSettings: state.drawingSettings,
        exportSettings: state.exportSettings,
        apiSettings: state.apiSettings,
        authToken: state.authToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isSidebarCollapsed: state.isSidebarCollapsed // Persist sidebar state
      })
    }
  )
);